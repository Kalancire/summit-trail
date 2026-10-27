import { useEffect, useMemo, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'
import { BackgroundGeolocation as BG } from '@capgo/background-geolocation'
import { motion } from 'motion/react'
import { Camera, Flag, Heart, Navigation, Pause, Play, Radio, Share2, Square, Undo2, X } from 'lucide-react'
import MapView from '../components/MapView'
import CheckpointSheet from '../components/CheckpointSheet'
import { Back, Mini } from '../components/ui'
import { KIND_LABEL, calc, dist, hav, hms, pace, title, type Cp, type Kind, type Pt, type Rec, type Trail } from '../lib/core'
import { toAvatar } from '../lib/image'
import { addRec, clearDraft, getDraft, getSettings, getUser, saveDraft, setSettings, useSettings } from '../lib/store'
import { bearing, compass, cumDist, makeTrail, nearestOn, peakOf } from '../lib/trail'
import { Share } from '@capacitor/share'
import { cloudOn } from '../lib/cloud'
import { connectHr, hrZone } from '../lib/hr'
import { liveLink, liveWeb, pushLive, startLive, stopLive } from '../lib/live'
import { buzz, fetchWeather, mapsLink, nextSunset, rainWarning, say, smsHref, sosText, watchBattery } from '../lib/safety'

// Native background tracker (foreground service on Android, background location on iOS): @capgo/background-geolocation
const native = Capacitor.isNativePlatform()

const CHECKINS = [0, 3600, 7200, 10800, 14400]
const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

export default function Live({ onExit, trail }: { onExit: (r: Rec | null, t?: Trail) => void; trail?: Trail }) {
  const { units } = useSettings()
  const [st, setSt] = useState<'idle' | 'run' | 'pause'>('idle')
  const [pts, setPts] = useState<Pt[]>([])
  const [cps, setCps] = useState<Cp[]>([])
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null)
  const [secs, setSecs] = useState(0)
  const [msg, setMsg] = useState('')
  const [kind, setKind] = useState<Kind>('hike')
  const [asTrail, setAsTrail] = useState(false)               // "Save this as a trail"
  const [sheet, setSheet] = useState<Cp | null>(null)         // checkpoint being written
  const [ci, setCi] = useState(0)                             // check-in timer length (seconds, 0 = off)
  const [dueAsk, setDueAsk] = useState(false), [sosOpen, setSosOpen] = useState(false)
  const [warns, setWarns] = useState<Record<string, string>>({})
  const [back, setBack] = useState(false)                     // backtrack mode
  const [prog, setProg] = useState<{ pct: number; left: number; off: number } | null>(null)
  const [hr, setHr] = useState<number | null>(null), [liveCode, setLiveCode] = useState('')
  const [stillAsk, setStillAsk] = useState<'' | 'still' | 'fall'>('')
  const hrConn = useRef<{ stop: () => void } | null>(null), hrAll = useRef<number[]>([])
  const stillAt = useRef(0), stillSent = useRef(false), impact = useRef(0), saver = useRef(false)
  const ptsRef = useRef(pts); ptsRef.current = pts
  const lastMove = useRef(0), auto = useRef(false), lastK = useRef(0), cam = useRef<HTMLInputElement>(null)
  const run = useRef(false)
  const meRef = useRef(me); meRef.current = me
  const idle = useRef<string | null>(null)   // foreground watch (shows "you are here" before start)
  const usingBg = useRef(false)
  const lastAlt = useRef<number | null>(null), course = useRef<number | null>(null)
  const dueRef = useRef(0), askedAt = useRef(0), smsSent = useRef(false)
  const hint = useRef(-1), offN = useRef(0), isOff = useRef(false)
  const flags = useRef<Record<string, boolean>>({}), wxAt = useRef(0), wxText = useRef('')
  const cum = useMemo(() => (trail ? cumDist(trail.route) : []), [trail])
  const tickRef = useRef<() => void>(() => {})
  const track = useRef<string | null>(null)  // recording watch (background-capable on native)
  // timer uses timestamps so it stays correct while the screen is off / app is in background
  const acc = useRef(0), since = useRef(0)
  const { d, g } = useMemo(() => calc(pts), [pts])

  const elapsed = () => Math.floor((acc.current + (since.current ? Date.now() - since.current : 0)) / 1000)
  useEffect(() => {
    if (st !== 'run') return
    const id = setInterval(() => {
      setSecs(elapsed())
    }, 1000)
    const vis = () => setSecs(elapsed())
    document.addEventListener('visibilitychange', vis)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', vis) }
  }, [st])

  // Kalman smoothing: weights each GPS fix by its accuracy, drops poor fixes and sudden jumps
  const kf = useRef<{ lat: number; lng: number; v: number; t: number } | null>(null)
  const fix = (la: number, ln: number, alt: number | null | undefined, accy: number) => {
    const now = Date.now(), a0 = Math.max(accy || 50, 3), s = kf.current
    if (!s) { kf.current = { lat: la, lng: ln, v: a0 * a0, t: now } }
    else {
      if (a0 > 40) return
      const dt = Math.max(0, (now - s.t) / 1000)
      if (hav({ lat: s.lat, lng: s.lng, alt: 0, t: s.t }, { lat: la, lng: ln, alt: 0, t: now }) > 15 * Math.max(dt, 1) && a0 > 15) return
      const v = s.v + dt * 9, K = v / (v + a0 * a0)
      kf.current = { lat: s.lat + K * (la - s.lat), lng: s.lng + K * (ln - s.lng), v: (1 - K) * v, t: now }
    }
    const { lat, lng } = kf.current!
    setMe({ lat, lng }); if (alt) lastAlt.current = alt
    pushLive(lat, lng, alt ?? lastAlt.current, () => ({ route: ptsRef.current, secs: elapsed() }))
    onFix(lat, lng); tickRef.current()
    if ((!run.current && !auto.current) || a0 > 25) return
    const p: Pt = { lat, lng, alt: alt ?? 0, t: now }
    const l = ptsRef.current[ptsRef.current.length - 1]
    if (l && hav(l, p) < 5) return
    ptsRef.current = [...ptsRef.current, p]; setPts(a => [...a, p]); lastMove.current = now
    if (auto.current) { auto.current = false; since.current = Date.now(); run.current = true; setSt('run'); setMsg('') }
  }
  const setWarn = (k: string, text: string | null) => setWarns(w => { const n = { ...w }; if (text) n[k] = text; else delete n[k]; return n })
  const alert2 = (k: string, text: string) => { setWarn(k, text); say(text); buzz() }

  // per GPS fix: heading, progress along a followed trail, off-trail alert
  const onFix = (lat: number, lng: number) => {
    const here = { lat, lng, alt: 0, t: 0 }, l = ptsRef.current[ptsRef.current.length - 1]
    if (l && hav(l, here) > 6) course.current = bearing(l, here)
    if (!trail || trail.route.length < 2) return
    let n = nearestOn(trail.route, cum, here, hint.current)
    if (n.off > 100) { const g = nearestOn(trail.route, cum, here); if (g.off < n.off) n = g }
    hint.current = n.idx
    const total = cum[cum.length - 1] || 1
    setProg({ pct: Math.min(100, Math.round((n.along / total) * 100)), left: Math.max(0, total - n.along), off: Math.round(n.off) })
    if (!run.current) return
    if (n.off > 50) { offN.current++; if (offN.current >= 3 && !isOff.current) { isOff.current = true; alert2('off', `You are off the trail, about ${Math.round(n.off)} meters away.`) } }
    else if (n.off < 35 && (offN.current || isOff.current)) { offN.current = 0; if (isOff.current) { isOff.current = false; setWarn('off', null); say('Back on the trail.') } }
  }

  const trigger = (k: 'still' | 'fall') => {
    setStillAsk(k); stillAt.current = Date.now(); stillSent.current = false; impact.current = 0; buzz()
    say(k === 'fall' ? 'Possible fall detected. Are you okay?' : 'No movement for ten minutes. Are you okay?')
  }
  // timers and warnings: check-in, sunset, battery, weather (runs every few seconds and on each fix)
  const tick = () => {
    const now = Date.now(), p = meRef.current
    if (dueRef.current && now >= dueRef.current) {
      if (!askedAt.current) { askedAt.current = now; setDueAsk(true); buzz(); say('Check in time reached. Are you okay?') }
      else if (now - askedAt.current > 120000 && !smsSent.current) { smsSent.current = true; sendCheckInAlert() }
    }
    const recording = run.current || auto.current, S = getSettings()
    if (run.current && S.autoPause !== false && ptsRef.current.length > 3 && now - lastMove.current > 40000) {
      acc.current += now - since.current; since.current = 0; run.current = false; auto.current = true
      setSt('pause'); setSecs(elapsed()); setMsg('Auto-paused: you stopped moving. It resumes when you move.')
    }
    if (recording && S.safety !== false) {
      if (!stillAsk) {
        if (now - lastMove.current > 10 * 60000) trigger('still')
        else if (impact.current > lastMove.current && now - impact.current > 20000) trigger('fall')
      } else {
        buzz()
        if (!stillSent.current && now - stillAt.current > (stillAsk === 'fall' ? 30000 : 120000)) {
          stillSent.current = true
          sendCheckInAlert(stillAsk === 'fall' ? 'Summit Trail detected a possible fall' : 'Summit Trail detected no movement for a while')
        }
      }
    }
    if (!p || !run.current) return
    const ss = nextSunset(p.lat, p.lng, now)
    if (ss) {
      const mins = (ss - now) / 60000
      if (mins <= 30 && !flags.current.s30) { flags.current.s30 = flags.current.s60 = true; alert2('sun', `Sunset in ${Math.max(0, Math.round(mins))} minutes, at ${clock(ss)}. Plan your way down.`) }
      else if (mins <= 60 && !flags.current.s60) { flags.current.s60 = true; alert2('sun', `Sunset at ${clock(ss)}, in about an hour.`) }
      if (trail && prog && !flags.current.sl) {
        const left = trail.estSecs * (prog.left / (cum[cum.length - 1] || 1)) * 1000
        if (now + left > ss && mins > 0) { flags.current.sl = true; alert2('sunlate', `At your pace you may finish after sunset (${clock(ss)}).`) }
      }
    }
    if (navigator.onLine && now - wxAt.current > 30 * 60000) {
      wxAt.current = now
      fetchWeather(p.lat, p.lng).then(w => { const t = rainWarning(w); if (t && t !== wxText.current) { wxText.current = t; alert2('rain', t) } }).catch(() => {})
    }
  }
  tickRef.current = tick

  const target = () => { const p = meRef.current; return p ? { ...p, alt: lastAlt.current ?? ptsRef.current[ptsRef.current.length - 1]?.alt } : null }
  const phone = () => {
    let n = getSettings().emPhone
    if (!n) { n = prompt('Phone number of your emergency contact (they get the messages)')?.trim(); if (n) setSettings({ emPhone: n }) }
    return n || ''
  }
  const sendCheckInAlert = (why = 'I have not checked in from my hike') => {
    const l = target(), n = phone(); if (!n) return
    const body = `${why}${trail ? ` on ${trail.name}` : ''} (Summit Trail).${l ? `\nLast known location: ${mapsLink(l.lat, l.lng)}${l.alt ? `\nAltitude: ${Math.round(l.alt)} m` : ''}` : ''}\nPlease try to reach me.`
    location.href = smsHref(n, body)
  }
  const sendSos = async (mode: 'sms' | 'share') => {
    const l = target(); if (!l) { setMsg('Waiting for GPS fix…'); setSosOpen(false); return }
    const text = sosText(l.lat, l.lng, l.alt)
    if (mode === 'sms') { const n = phone(); if (n) location.href = smsHref(n, text) }
    else { try { if (navigator.share) await navigator.share({ title: 'SOS', text }); else { await navigator.clipboard.writeText(text); setMsg('SOS message copied') } } catch { /* cancelled */ } }
    setSosOpen(false)
  }
  const pickCheckin = (secs: number) => { setCi(secs); if (secs && !getSettings().emPhone) phone() }
  const extend = (mins: number) => { dueRef.current = Date.now() + mins * 60000; askedAt.current = 0; smsSent.current = false; setDueAsk(false); setSecs(elapsed()) }

  // backtrack: the way back along the path you came on
  const bt = useMemo(() => {
    if (!back || !me || pts.length < 2) return null
    const cm = cumDist(pts), n = nearestOn(pts, cm, me)
    const path: Pt[] = [{ lat: me.lat, lng: me.lng, alt: 0, t: 0 }, ...pts.slice(0, n.idx + 1).reverse()]
    let k = n.idx, a = 0
    while (k > 0 && a < 25) { a += hav(pts[k], pts[k - 1]); k-- }
    return { path: path.filter((_, i) => i % Math.max(1, Math.floor(path.length / 300)) === 0 || i === path.length - 1), left: n.off + n.along, off: n.off, brg: bearing(me, pts[k]) }
  }, [back, me, pts])
  useEffect(() => { if (bt && bt.left < 15 && !flags.current.home) { flags.current.home = true; say('You are back at the start.') } }, [bt])

  useEffect(() => {
    const id = setInterval(() => tickRef.current(), 5000)
    const off = watchBattery((lv, ch) => {
      const pct = Math.round(lv * 100)
      if (!ch && lv <= 0.2 && usingBg.current && !saver.current) { saver.current = true; BG.stop().then(() => startBg(10)).then(() => setWarn('saver', 'Battery saver on: GPS updates every 10 m and voice cues are off.')).catch(() => {}) }
      else if ((ch || lv > 0.3) && saver.current && usingBg.current) { saver.current = false; BG.stop().then(() => startBg(3)).catch(() => {}); setWarn('saver', null) }
      if (ch || lv > 0.25) { flags.current.b20 = flags.current.b10 = false; setWarn('bat', null) }
      else if (lv <= 0.1 && !flags.current.b10) { flags.current.b10 = flags.current.b20 = true; alert2('bat', `Battery ${pct} percent. Save power and consider heading back.`) }
      else if (lv <= 0.2 && !flags.current.b20) { flags.current.b20 = true; alert2('bat', `Battery ${pct} percent.`) }
    })
    return () => { clearInterval(id); off() }
  }, [])

  // hard impact (about 4 g) followed by no movement = possible fall
  useEffect(() => {
    const h = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity
      if (a && (run.current || auto.current) && Math.hypot(a.x ?? 0, a.y ?? 0, a.z ?? 0) > 40) impact.current = Date.now()
    }
    addEventListener('devicemotion', h); return () => removeEventListener('devicemotion', h)
  }, [])

  // voice cue every km / mile
  useEffect(() => {
    const U = units === 'km' ? 1000 : 1609.344, k = Math.floor(d / U)
    if (k <= lastK.current) return
    lastK.current = k
    if (saver.current || getSettings().voice === false || !('speechSynthesis' in window)) return
    const s = elapsed(), w = units === 'km' ? 'kilometer' : 'mile'
    speechSynthesis.speak(new SpeechSynthesisUtterance(`${k} ${w}${k > 1 ? 's' : ''}. Time ${Math.floor(s / 60)} minutes. Pace ${pace(d, s, units).replace(':', ' ')} per ${w}`))
  }, [d])

  const stopTrack = async () => {
    if (track.current) {
      const id = track.current; track.current = null
      if (usingBg.current) { usingBg.current = false; await BG.stop().catch(() => {}) } else Geolocation.clearWatch({ id })
    }
  }
  const stopIdle = () => { if (idle.current) { Geolocation.clearWatch({ id: idle.current }); idle.current = null } }

  // restore an unfinished recording (e.g. app was killed), paused so the timer doesn't count the gap
  useEffect(() => {
    const d = getDraft()
    if (d && d.pts.length > 1 && confirm('Resume your unfinished recording?')) {
      setPts(d.pts as Pt[]); setCps(d.cps as Cp[]); lastK.current = Math.floor(calc(d.pts as Pt[]).d / (getSettings().units === 'km' ? 1000 : 1609.344)); acc.current = d.acc; setSecs(Math.floor(d.acc / 1000)); setSt('pause')
      if (d.asTrail) setAsTrail(true)
      if (d.due) { dueRef.current = d.due; setCi(1) }
    } else clearDraft()
  }, [])
  useEffect(() => { if (pts.length) saveDraft({ pts, cps, acc: acc.current + (since.current ? Date.now() - since.current : 0), at: Date.now(), asTrail, due: dueRef.current || undefined, trailId: trail?.id }) }, [pts, cps])

  useEffect(() => {
    let dead = false
    Geolocation.requestPermissions().catch(() => {}).finally(() => {
      if (dead) return
      Geolocation.watchPosition({ enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }, (pos, err) => {
        if (!err && pos && !track.current && !run.current) fix(pos.coords.latitude, pos.coords.longitude, null, pos.coords.accuracy)
      }).then(id => { if (dead) Geolocation.clearWatch({ id }); else idle.current = id }).catch(() => {})
    })
    return () => { dead = true; stopIdle(); stopTrack(); hrConn.current?.stop(); stopLive() }
  }, [])

  const startBg = (df: number) => BG.start(
    { backgroundTitle: 'Summit Trail', backgroundMessage: 'Recording your hike…', requestPermissions: true, stale: false, distanceFilter: df },
    (l, e) => {
      if (e) { if (e.code === 'NOT_AUTHORIZED') { setMsg('Set location to "Allow all the time" so recording works with the screen off.'); BG.openSettings().catch(() => {}) } return }
      if (l) fix(l.latitude, l.longitude, l.altitude, l.accuracy)
    })
  const start = async (resume = false) => {
    setMsg('')
    // iOS only lets the page speak after a tap: say an empty phrase now so later voice cues work
    if ('speechSynthesis' in window) { try { speechSynthesis.speak(new SpeechSynthesisUtterance('')) } catch { /* no speech */ } }
    lastMove.current = Date.now(); auto.current = false
    if (!resume && ci) { dueRef.current = Date.now() + ci * 1000; askedAt.current = 0; smsSent.current = false }
    if (!resume) { flags.current = {}; wxAt.current = 0; wxText.current = ''; offN.current = 0; isOff.current = false }
    run.current = true; if (!resume) acc.current = 0; since.current = Date.now(); setSt('run')
    const web = () => Geolocation.watchPosition({ enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }, (pos, err) => {
      if (!err && pos) fix(pos.coords.latitude, pos.coords.longitude, pos.coords.altitude, pos.coords.accuracy)
    })
    try {
      let ok = false
      if (native) {
        try {
          await startBg(saver.current ? 10 : 3)
          track.current = 'bg'; ok = true; usingBg.current = true; stopIdle()
        } catch { /* plugin missing or failed: fall back to normal GPS */ }
      }
      if (!ok) track.current = await web()
    } catch { setMsg('Could not start GPS.'); run.current = false; since.current = 0; setSt('idle') }
  }
  const toggle = () => {
    auto.current = false; lastMove.current = Date.now(); setMsg('')
    if (st === 'run') { acc.current += Date.now() - since.current; since.current = 0; run.current = false; setSt('pause') }
    else if (!track.current) { start(true); return }
    else { since.current = Date.now(); run.current = true; setSt('run') }
    setSecs(elapsed())
  }
  const checkpoint = (photo?: string) => {
    const l = meRef.current; if (!l) { setMsg('Waiting for GPS fix…'); return }
    setMsg(''); setSheet({ lat: l.lat, lng: l.lng, t: Date.now(), ...(photo ? { photo } : {}) })
  }
  const saveCp = (c: Cp) => { setCps(a => [...a, c]); setSheet(null); navigator.vibrate?.(40) }
  const finish = async () => {
    const s = elapsed(); run.current = false; since.current = 0; await stopTrack(); hrConn.current?.stop(); stopLive()
    if (d < 20 || s < 5) { alert('Too short to save. Record at least 20 m and 5 seconds, outdoors with GPS.'); clearDraft(); onExit(null); return }
    const pk = peakOf(pts)
    const r: Rec = { id: Date.now(), ts: Date.now() - s * 1000, distM: d, secs: s, gain: g, route: pts, cps, type: kind, ...(pk ? { peak: pk } : {}), ...(trail ? { trailId: trail.id } : {}), ...hrStat() }
    addRec(r); clearDraft()
    const t = asTrail && !trail ? makeTrail({ name: title(r), route: pts, wps: cps.map(c => ({ lat: c.lat, lng: c.lng, kind: c.kind ?? 'view', note: c.note, photo: c.photo })) }) : undefined
    onExit(r, t)
  }
  const share = async () => {
    const l = meRef.current; if (!l) { setMsg('Waiting for GPS fix…'); return }
    const url = `https://maps.google.com/?q=${l.lat},${l.lng}`
    try { if (navigator.share) await navigator.share({ title: 'My location', text: "I'm here (Summit Trail):", url }); else { await navigator.clipboard.writeText(url); setMsg('Location link copied') } } catch { /* cancelled */ }
  }
  const leave = async () => { if (st === 'idle' || confirm('Discard this recording?')) { clearDraft(); run.current = false; await stopTrack(); stopIdle(); hrConn.current?.stop(); stopLive(); onExit(null) } }

  const hrStat = () => { const a = hrAll.current; return a.length > 10 ? { hrAvg: Math.round(a.reduce((x, y) => x + y, 0) / a.length), hrMax: a.reduce((x, y) => Math.max(x, y), 0) } : {} }
  const toggleHr = async () => {
    if (hrConn.current) { hrConn.current.stop(); hrConn.current = null; setHr(null); return }
    try {
      setMsg('Choose your heart-rate strap from the list…')
      hrConn.current = await connectHr(b => { setHr(b); if (run.current) hrAll.current.push(b) }, () => { hrConn.current = null; setHr(null); setMsg('Heart-rate strap disconnected') })
      setMsg('')
    } catch (e) { setMsg((e as Error).message || 'Could not connect to a heart-rate strap') }
  }
  const toggleLive = async () => {
    if (liveCode) { await stopLive(); setLiveCode(''); setMsg('Live sharing stopped'); return }
    const u = getUser()
    if (!cloudOn || !u || !navigator.onLine) { setMsg('Live sharing needs internet and your account'); return }
    const code = startLive(u.name, trail?.name); setLiveCode(code)
    const web = liveWeb(code), text = `Follow my hike live on Summit Trail:\n${web || liveLink(code)}${web ? `\nOr in the app: ${liveLink(code)}` : ''}\nCode: ${code}`
    try { if (native) await Share.share({ title: 'Live hike', text }); else if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); setMsg('Live link copied') } } catch { /* cancelled */ }
  }

  return (
    <div className="relative h-dvh">
      <MapView route={pts} me={me} cps={cps} follow ghost={trail?.route} wps={trail?.wps} guide={bt?.path} className="absolute inset-0" />
      <div className="safe-top absolute left-5 top-0 flex gap-3"><Back onClick={leave} /><button onClick={share} aria-label="Share my location" className="card grid size-11 place-items-center rounded-full text-accent"><Share2 className="size-5" /></button><button onClick={() => setSosOpen(true)} aria-label="SOS" className="grid size-11 place-items-center rounded-full bg-red-600 text-xs font-extrabold text-white shadow-[0_6px_16px_-6px_#dc2626]">SOS</button></div>
      {Object.keys(warns).length > 0 && (
        <div className="absolute inset-x-4 top-[calc(max(env(safe-area-inset-top),1.25rem)+3.75rem)] z-10 flex flex-col gap-2">
          {Object.entries(warns).map(([k, w]) => (
            <button key={k} onClick={() => setWarn(k, null)} className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-left text-xs font-bold text-white shadow-lg ${k === 'off' || k === 'bat' ? 'bg-red-600' : k === 'rain' ? 'bg-blue-600' : 'bg-amber-600'}`}>
              <span className="flex-1">{w}</span><X className="size-4 shrink-0 opacity-80" />
            </button>
          ))}
        </div>
      )}
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={async e => { const f = e.target.files?.[0]; if (f) checkpoint(await toAvatar(f, 320).catch(() => undefined)); e.target.value = '' }} />
      <motion.div initial={{ y: 320 }} animate={{ y: 0 }} transition={{ type: 'spring', damping: 24 }}
        className="card absolute inset-x-4 bottom-4 rounded-[2rem] p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
        <p className="text-center font-mono text-5xl font-bold tabular-nums text-accent">{hms(secs)}</p>
        <div className="mt-4 grid grid-cols-4 text-center">
          <Mini label="Distance" value={dist(d, units)} />
          <Mini label={`Pace /${units}`} value={pace(d, secs, units)} />
          <Mini label="Climb" value={`${Math.round(g)} m`} />
          <Mini label="Altitude" value={pts.length ? `${Math.round(pts[pts.length - 1].alt)} m` : '--'} />
        </div>
        {trail && prog && (
          <div className="mt-3">
            <div className="flex justify-between text-xs"><span>{trail.name}</span><span><b>{prog.pct}%</b> · {dist(prog.left, units)} left · ETA {clock(Date.now() + trail.estSecs * 1000 * (prog.left / (cum[cum.length - 1] || 1)))}{prog.off > 50 ? ` · ${prog.off} m off` : ''}</span></div>
            <span className="mt-1 block h-2 overflow-hidden rounded-full bg-white/10"><span className={`block h-full ${prog.off > 50 ? 'bg-red-500' : 'grad'}`} style={{ width: prog.pct + '%' }} /></span>
          </div>
        )}
        {back && (
          <div className="inset mt-3 flex items-center gap-3 rounded-2xl p-3">
            {bt ? <>
              <Navigation className="glow size-9 shrink-0 text-accent" style={{ transform: `rotate(${Math.round(bt.brg - (course.current ?? 0) - 45)}deg)` }} />
              <span className="flex-1 text-sm"><b>{bt.left < 15 ? 'You are back at the start' : `Head ${compass(bt.brg)} · ${dist(bt.left, units)} to the start`}</b><span className="block text-xs text-mute">{bt.off > 30 ? `${Math.round(bt.off)} m off your path. ` : ''}Follow the blue line{course.current === null ? ' (arrow shows north-up until you move)' : ''}</span></span>
            </> : <span className="text-sm text-mute">Record a little of your path first, then backtrack guides you back along it.</span>}
          </div>
        )}
        {dueRef.current > 0 && st !== 'idle' && (
          <p className="mt-3 flex items-center justify-center gap-3 text-xs text-mute">
            <span>Check-in {Date.now() < dueRef.current ? `in ${hms(Math.round((dueRef.current - Date.now()) / 1000))}` : 'overdue'}</span>
            <button onClick={() => extend(30)} className="card rounded-full px-3 py-0.5 font-bold text-accent">+30 min</button>
            <button onClick={() => { dueRef.current = 0; setCi(0); setSecs(elapsed()) }} className="font-bold text-red-400">Off</button>
          </p>
        )}
        {msg && <p className="mt-3 text-center text-sm text-red-400">{msg}</p>}
        {st === 'idle' && (
          <div className="mt-4 space-y-3 text-sm">
            {!trail && (
              <button onClick={() => setAsTrail(v => !v)} className="flex w-full items-center justify-between">
                <span className="text-left"><b>Save this as a trail</b><span className="block text-xs text-mute">Turns this hike into a reusable trail</span></span>
                <span className={`inset flex h-8 w-14 shrink-0 items-center rounded-full p-1 ${asTrail ? 'justify-end' : ''}`}><span className={`size-6 rounded-full ${asTrail ? 'grad' : 'bg-mute'}`} /></span>
              </button>
            )}
            <div>
              <span className="text-xs text-mute">Check-in timer: messages your contact if you are not done in time</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {[...CHECKINS, ...(trail ? [Math.round((trail.estSecs * 1.5) / 60) * 60] : [])].map(v => (
                  <button key={v} onClick={() => pickCheckin(v)} className={`rounded-full px-3 py-1 text-xs font-bold ${ci === v ? 'grad text-white' : 'card text-mute'}`}>
                    {v === 0 ? 'Off' : v < 36000 && !CHECKINS.includes(v) ? `Trail +50% (${Math.floor(v / 3600)}h ${Math.round((v % 3600) / 60)}m)` : `${v / 3600} h`}
                  </button>
                ))}
              </div>
            </div>
            {me && (() => { const ss = nextSunset(me.lat, me.lng); return ss ? <p className="text-xs text-mute">Sunset today {clock(ss)}{trail ? ` · est. finish ${clock(Date.now() + trail.estSecs * 1000)}` : ''}</p> : null })()}
          </div>
        )}
        {st === 'idle' && <div className="mt-4 flex justify-center gap-2">{(Object.keys(KIND_LABEL) as Kind[]).map(k => <button key={k} onClick={() => setKind(k)} className={`rounded-full px-4 py-1 text-sm font-bold ${kind === k ? 'grad text-white' : 'card text-mute'}`}>{KIND_LABEL[k]}</button>)}</div>}
        {st !== 'idle' && (
          <div className="mt-4 flex justify-center gap-2 text-xs font-bold">
            <button onClick={toggleHr} className={`flex items-center gap-1 rounded-full px-3 py-1.5 ${hr ? 'grad text-white' : 'card text-accent'}`}><Heart className="size-4" />{hr ? `${hr} bpm · Z${hrZone(hr, getSettings().maxHr ?? 190)}` : 'Heart rate'}</button>
            <button onClick={toggleLive} className={`flex items-center gap-1 rounded-full px-3 py-1.5 ${liveCode ? 'grad text-white' : 'card text-accent'}`}><Radio className="size-4" />{liveCode ? 'Sharing live' : 'Share live'}</button>
          </div>
        )}
        <div className="mt-5 flex items-center justify-center gap-4">
          {st === 'idle' ? (
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => start()} className="grad flex h-16 w-full items-center justify-center gap-2 rounded-3xl text-lg font-bold text-white shadow-[0_10px_28px_-8px_var(--accent)]">
              <Play className="fill-white" /> {trail ? 'FOLLOW TRAIL' : 'START'}
            </motion.button>
          ) : (
            <>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => checkpoint()} className="card relative grid size-14 place-items-center rounded-full text-accent">
                <Flag className="size-7" />
                {cps.length > 0 && <span className="absolute -right-1 -top-1 grid size-6 place-items-center rounded-full bg-accent text-xs font-bold text-white">{cps.length}</span>}
              </motion.button>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => cam.current?.click()} className="card grid size-14 place-items-center rounded-full text-accent"><Camera className="size-6" /></motion.button>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => setBack(v => !v)} aria-label="Backtrack" className={`grid size-14 place-items-center rounded-full ${back ? 'grad text-white' : 'card text-accent'}`}><Undo2 className="size-6" /></motion.button>
              <motion.button whileTap={{ scale: 0.9 }} onClick={toggle} className="card grid size-14 place-items-center rounded-full text-accent">
                {st === 'run' ? <Pause className="size-7" /> : <Play className="size-7" />}
              </motion.button>
              <motion.button whileTap={{ scale: 0.9 }} onClick={finish} className="grad grid size-14 place-items-center rounded-full text-white">
                <Square className="size-7 fill-white" />
              </motion.button>
            </>
          )}
        </div>
      </motion.div>
      {sheet && <CheckpointSheet cp={sheet} forTrail={asTrail || !!trail} onSave={saveCp} onCancel={() => setSheet(null)} />}
      {dueAsk && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-black/80 p-6">
          <div className="card w-full max-w-sm rounded-3xl p-6 text-center">
            <h2 className="text-xl font-bold">Check-in time</h2>
            <p className="mt-2 text-sm text-mute">Are you okay? If you do not answer, your emergency contact is messaged with your location in 2 minutes.</p>
            <button onClick={() => extend(30)} className="grad mt-5 h-14 w-full rounded-2xl font-bold text-white">I am okay, +30 min</button>
            <button onClick={() => { smsSent.current = true; sendCheckInAlert() }} className="mt-3 h-12 w-full rounded-2xl bg-red-600 font-bold text-white">Message my contact now</button>
            <button onClick={() => { dueRef.current = 0; setCi(0); setDueAsk(false) }} className="mt-3 text-sm text-mute">Turn check-in off</button>
          </div>
        </div>
      )}
      {stillAsk && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-black/85 p-6">
          <div className="card w-full max-w-sm rounded-3xl p-6 text-center">
            <h2 className="text-xl font-bold text-red-400">{stillAsk === 'fall' ? 'Did you fall?' : 'No movement'}</h2>
            <p className="mt-2 text-sm text-mute">{stillAsk === 'fall' ? 'A hard impact was detected and you have not moved.' : 'You have not moved for 10 minutes.'} If you do not answer, a message with your location is prepared for your emergency contact in {stillAsk === 'fall' ? '30 seconds' : '2 minutes'}.</p>
            <button onClick={() => { setStillAsk(''); lastMove.current = Date.now(); impact.current = 0 }} className="grad mt-5 h-14 w-full rounded-2xl font-bold text-white">I am okay</button>
            <button onClick={() => { stillSent.current = true; sendCheckInAlert(stillAsk === 'fall' ? 'Summit Trail detected a possible fall' : 'Summit Trail detected no movement for a while') }} className="mt-3 h-12 w-full rounded-2xl bg-red-600 font-bold text-white">Message my contact now</button>
          </div>
        </div>
      )}
      {sosOpen && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-black/80 p-6" onClick={() => setSosOpen(false)}>
          <div onClick={e => e.stopPropagation()} className="card w-full max-w-sm rounded-3xl p-6 text-center">
            <h2 className="text-xl font-bold text-red-400">Send SOS?</h2>
            <p className="mt-2 text-sm text-mute">{me ? `Shares your coordinates (${me.lat.toFixed(5)}, ${me.lng.toFixed(5)})${lastAlt.current ? ` and altitude (${Math.round(lastAlt.current)} m)` : ''}.` : 'Waiting for a GPS fix…'}</p>
            <button onClick={() => sendSos('sms')} disabled={!me} className="mt-5 h-14 w-full rounded-2xl bg-red-600 font-bold text-white disabled:opacity-50">{getSettings().emPhone ? 'Message my emergency contact' : 'Set contact and message'}</button>
            <button onClick={() => sendSos('share')} disabled={!me} className="card mt-3 h-12 w-full rounded-2xl font-bold text-accent disabled:opacity-50">Share with another app</button>
            <button onClick={() => setSosOpen(false)} className="mt-3 text-sm text-mute">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

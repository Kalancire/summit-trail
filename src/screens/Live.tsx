import { useEffect, useMemo, useRef, useState } from 'react'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'
import { motion } from 'motion/react'
import { Camera, Flag, Pause, Play, Share2, Square } from 'lucide-react'
import MapView from '../components/MapView'
import { Back, Mini } from '../components/ui'
import { KIND_LABEL, calc, dist, hav, hms, pace, type Cp, type Kind, type Pt, type Rec } from '../lib/core'
import { toAvatar } from '../lib/image'
import { addRec, clearDraft, getDraft, getSettings, saveDraft, useSettings } from '../lib/store'

// Native background tracker (foreground service on Android, background location on iOS).
type Loc = { latitude: number; longitude: number; altitude?: number | null; accuracy: number }
type BG = {
  addWatcher(o: Record<string, unknown>, cb: (l?: Loc, e?: { code?: string }) => void): Promise<string>
  removeWatcher(o: { id: string }): Promise<void>
  openSettings(): Promise<void>
}
const BG = registerPlugin<BG>('BackgroundGeolocation')
const native = Capacitor.isNativePlatform()

export default function Live({ onExit }: { onExit: (r: Rec | null) => void }) {
  const { units } = useSettings()
  const [st, setSt] = useState<'idle' | 'run' | 'pause'>('idle')
  const [pts, setPts] = useState<Pt[]>([])
  const [cps, setCps] = useState<Cp[]>([])
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null)
  const [secs, setSecs] = useState(0)
  const [msg, setMsg] = useState('')
  const [kind, setKind] = useState<Kind>('hike')
  const ptsRef = useRef(pts); ptsRef.current = pts
  const lastMove = useRef(0), auto = useRef(false), lastK = useRef(0), cam = useRef<HTMLInputElement>(null)
  const run = useRef(false)
  const meRef = useRef(me); meRef.current = me
  const idle = useRef<string | null>(null)   // foreground watch (shows "you are here" before start)
  const usingBg = useRef(false)
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
    setMe({ lat, lng })
    if ((!run.current && !auto.current) || a0 > 25) return
    const p: Pt = { lat, lng, alt: alt ?? 0, t: now }
    const l = ptsRef.current[ptsRef.current.length - 1]
    if (l && hav(l, p) < 5) return
    ptsRef.current = [...ptsRef.current, p]; setPts(a => [...a, p]); lastMove.current = now
    if (auto.current) { auto.current = false; since.current = Date.now(); run.current = true; setSt('run'); setMsg('') }
  }
  // voice cue every km / mile
  useEffect(() => {
    const U = units === 'km' ? 1000 : 1609.344, k = Math.floor(d / U)
    if (k <= lastK.current) return
    lastK.current = k
    if (getSettings().voice === false || !('speechSynthesis' in window)) return
    const s = elapsed(), w = units === 'km' ? 'kilometer' : 'mile'
    speechSynthesis.speak(new SpeechSynthesisUtterance(`${k} ${w}${k > 1 ? 's' : ''}. Time ${Math.floor(s / 60)} minutes. Pace ${pace(d, s, units).replace(':', ' ')} per ${w}`))
  }, [d])

  const stopTrack = async () => {
    if (track.current) {
      const id = track.current; track.current = null
      if (usingBg.current) await BG.removeWatcher({ id }).catch(() => {}); else Geolocation.clearWatch({ id })
    }
  }
  const stopIdle = () => { if (idle.current) { Geolocation.clearWatch({ id: idle.current }); idle.current = null } }

  // restore an unfinished recording (e.g. app was killed), paused so the timer doesn't count the gap
  useEffect(() => {
    const d = getDraft()
    if (d && d.pts.length > 1 && confirm('Resume your unfinished recording?')) {
      setPts(d.pts as Pt[]); setCps(d.cps as Cp[]); acc.current = d.acc; setSecs(Math.floor(d.acc / 1000)); setSt('pause')
    } else clearDraft()
  }, [])
  useEffect(() => { if (pts.length) saveDraft({ pts, cps, acc: acc.current + (since.current ? Date.now() - since.current : 0), at: Date.now() }) }, [pts, cps])

  useEffect(() => {
    Geolocation.requestPermissions().catch(() => {}).finally(() => {
      Geolocation.watchPosition({ enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }, (pos, err) => {
        if (!err && pos && !track.current) fix(pos.coords.latitude, pos.coords.longitude, null, pos.coords.accuracy)
      }).then(id => { idle.current = id }).catch(() => {})
    })
    return () => { stopIdle(); stopTrack() }
  }, [])

  const start = async (resume = false) => {
    setMsg('')
    lastMove.current = Date.now(); auto.current = false
    run.current = true; if (!resume) acc.current = 0; since.current = Date.now(); setSt('run')
    const web = () => Geolocation.watchPosition({ enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }, (pos, err) => {
      if (!err && pos) fix(pos.coords.latitude, pos.coords.longitude, pos.coords.altitude, pos.coords.accuracy)
    })
    try {
      let ok = false
      if (native) {
        try {
          track.current = await BG.addWatcher(
            { backgroundTitle: 'Summit Trail', backgroundMessage: 'Recording your hike…', requestPermissions: true, stale: false, distanceFilter: 3 },
            (l, e) => {
              if (e) { if (e.code === 'NOT_AUTHORIZED') setMsg('Set location to "Allow all the time" so recording works with the screen off.'); return }
              if (l) fix(l.latitude, l.longitude, l.altitude, l.accuracy)
            })
          ok = true; usingBg.current = true; stopIdle()
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
    setMsg(''); setCps(a => [...a, { lat: l.lat, lng: l.lng, t: Date.now(), ...(photo ? { photo } : {}) }])
    navigator.vibrate?.(40)
  }
  const finish = async () => {
    const s = elapsed(); run.current = false; since.current = 0; await stopTrack()
    if (d < 20 || s < 5) { alert('Too short to save. Record at least 20 m and 5 seconds, outdoors with GPS.'); clearDraft(); onExit(null); return }
    const r: Rec = { id: Date.now(), ts: Date.now() - s * 1000, distM: d, secs: s, gain: g, route: pts, cps, type: kind }
    addRec(r); clearDraft(); onExit(r)
  }
  const share = async () => {
    const l = meRef.current; if (!l) { setMsg('Waiting for GPS fix…'); return }
    const url = `https://maps.google.com/?q=${l.lat},${l.lng}`
    try { if (navigator.share) await navigator.share({ title: 'My location', text: "I'm here (Summit Trail):", url }); else { await navigator.clipboard.writeText(url); setMsg('Location link copied') } } catch { /* cancelled */ }
  }
  const back = async () => { if (st === 'idle' || confirm('Discard this recording?')) { clearDraft(); run.current = false; await stopTrack(); stopIdle(); onExit(null) } }

  return (
    <div className="relative h-dvh">
      <MapView route={pts} me={me} cps={cps} follow className="absolute inset-0" />
      <div className="safe-top absolute left-5 top-0 flex gap-3"><Back onClick={back} /><button onClick={share} aria-label="Share my location" className="card grid size-10 place-items-center rounded-full text-accent"><Share2 className="size-5" /></button></div>
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
        {msg && <p className="mt-3 text-center text-sm text-red-400">{msg}</p>}
        {st === 'idle' && <div className="mt-4 flex justify-center gap-2">{(Object.keys(KIND_LABEL) as Kind[]).map(k => <button key={k} onClick={() => setKind(k)} className={`rounded-full px-4 py-1 text-sm font-bold ${kind === k ? 'grad text-white' : 'card text-mute'}`}>{KIND_LABEL[k]}</button>)}</div>}
        <div className="mt-5 flex items-center justify-center gap-4">
          {st === 'idle' ? (
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => start()} className="grad flex h-16 w-full items-center justify-center gap-2 rounded-3xl text-lg font-bold text-white shadow-[0_10px_28px_-8px_var(--accent)]">
              <Play className="fill-white" /> START
            </motion.button>
          ) : (
            <>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => checkpoint()} className="card relative grid size-14 place-items-center rounded-full text-accent">
                <Flag className="size-7" />
                {cps.length > 0 && <span className="absolute -right-1 -top-1 grid size-6 place-items-center rounded-full bg-accent text-xs font-bold text-white">{cps.length}</span>}
              </motion.button>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => cam.current?.click()} className="card grid size-14 place-items-center rounded-full text-accent"><Camera className="size-6" /></motion.button>
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
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'
import { motion } from 'motion/react'
import { Flag, Pause, Play, Square } from 'lucide-react'
import MapView from '../components/MapView'
import { Back, Mini } from '../components/ui'
import { calc, dist, hav, hms, pace, type Cp, type Pt, type Rec } from '../lib/core'
import { addRec, useSettings } from '../lib/store'

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
    const id = setInterval(() => setSecs(elapsed()), 1000)
    const vis = () => setSecs(elapsed())
    document.addEventListener('visibilitychange', vis)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', vis) }
  }, [st])

  const fix = (lat: number, lng: number, alt: number | null | undefined, accy: number) => {
    setMe({ lat, lng })
    if (!run.current || accy > 35) return
    const p: Pt = { lat, lng, alt: alt ?? 0, t: Date.now() }
    setPts(a => { const l = a[a.length - 1]; return l && hav(l, p) < 3 ? a : [...a, p] })
  }

  const stopTrack = async () => {
    if (track.current) {
      const id = track.current; track.current = null
      if (usingBg.current) await BG.removeWatcher({ id }).catch(() => {}); else Geolocation.clearWatch({ id })
    }
  }
  const stopIdle = () => { if (idle.current) { Geolocation.clearWatch({ id: idle.current }); idle.current = null } }

  useEffect(() => {
    Geolocation.requestPermissions().catch(() => {}).finally(() => {
      Geolocation.watchPosition({ enableHighAccuracy: true, timeout: 20000 }, (pos, err) => {
        if (!err && pos && !track.current) setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      }).then(id => { idle.current = id }).catch(() => {})
    })
    return () => { stopIdle(); stopTrack() }
  }, [])

  const start = async () => {
    setMsg('')
    run.current = true; acc.current = 0; since.current = Date.now(); setSt('run')
    const web = () => Geolocation.watchPosition({ enableHighAccuracy: true, timeout: 20000 }, (pos, err) => {
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
    if (st === 'run') { acc.current += Date.now() - since.current; since.current = 0; run.current = false; setSt('pause') }
    else { since.current = Date.now(); run.current = true; setSt('run') }
    setSecs(elapsed())
  }
  const checkpoint = () => {
    const l = meRef.current; if (!l) { setMsg('Waiting for GPS fix…'); return }
    setMsg(''); setCps(a => [...a, { lat: l.lat, lng: l.lng, t: Date.now() }])
    navigator.vibrate?.(40)
  }
  const finish = async () => {
    const s = elapsed(); run.current = false; since.current = 0; await stopTrack()
    if (d < 20 || s < 5) { alert('Too short to save. Record at least 20 m and 5 seconds, outdoors with GPS.'); onExit(null); return }
    const r: Rec = { id: Date.now(), ts: Date.now() - s * 1000, distM: d, secs: s, gain: g, route: pts, cps }
    addRec(r); onExit(r)
  }
  const back = async () => { if (st === 'idle' || confirm('Discard this recording?')) { run.current = false; await stopTrack(); stopIdle(); onExit(null) } }

  return (
    <div className="relative h-dvh">
      <MapView route={pts} me={me} cps={cps} follow className="absolute inset-0" />
      <div className="safe-top absolute left-5 top-0"><Back onClick={back} /></div>
      <motion.div initial={{ y: 320 }} animate={{ y: 0 }} transition={{ type: 'spring', damping: 24 }}
        className="card absolute inset-x-4 bottom-4 rounded-[2rem] p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
        <p className="text-center font-mono text-5xl font-bold tabular-nums text-accent">{hms(secs)}</p>
        <div className="mt-4 grid grid-cols-3 text-center">
          <Mini label="Distance" value={dist(d, units)} />
          <Mini label={`Pace /${units}`} value={pace(d, secs, units)} />
          <Mini label="Climb" value={`${Math.round(g)} m`} />
        </div>
        {msg && <p className="mt-3 text-center text-sm text-red-400">{msg}</p>}
        <div className="mt-5 flex items-center justify-center gap-5">
          {st === 'idle' ? (
            <motion.button whileTap={{ scale: 0.95 }} onClick={start} className="grad flex h-16 w-full items-center justify-center gap-2 rounded-3xl text-lg font-bold text-white shadow-[0_10px_28px_-8px_var(--accent)]">
              <Play className="fill-white" /> START
            </motion.button>
          ) : (
            <>
              <motion.button whileTap={{ scale: 0.9 }} onClick={checkpoint} className="card relative grid size-16 place-items-center rounded-full text-accent">
                <Flag className="size-7" />
                {cps.length > 0 && <span className="absolute -right-1 -top-1 grid size-6 place-items-center rounded-full bg-accent text-xs font-bold text-white">{cps.length}</span>}
              </motion.button>
              <motion.button whileTap={{ scale: 0.9 }} onClick={toggle} className="card grid size-16 place-items-center rounded-full text-accent">
                {st === 'run' ? <Pause className="size-7" /> : <Play className="size-7" />}
              </motion.button>
              <motion.button whileTap={{ scale: 0.9 }} onClick={finish} className="grad grid size-16 place-items-center rounded-full text-white">
                <Square className="size-7 fill-white" />
              </motion.button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { Geolocation } from '@capacitor/geolocation'
import { motion } from 'motion/react'
import { Pause, Play, Square } from 'lucide-react'
import MapView from '../components/MapView'
import { Back, Mini } from '../components/ui'
import { calc, dist, hav, hms, pace, type Pt, type Rec } from '../lib/core'
import { addRec, useSettings } from '../lib/store'

export default function Live({ onExit }: { onExit: (r: Rec | null) => void }) {
  const { units } = useSettings()
  const [st, setSt] = useState<'idle' | 'run' | 'pause'>('idle')
  const [pts, setPts] = useState<Pt[]>([])
  const [secs, setSecs] = useState(0)
  const [msg, setMsg] = useState('')
  const run = useRef(false)
  const watch = useRef<string | null>(null)
  const lock = useRef<WakeLockSentinel | null>(null)
  const { d, g } = useMemo(() => calc(pts), [pts])

  useEffect(() => {
    if (st !== 'run') return
    const id = setInterval(() => setSecs(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [st])

  const stopWatch = () => {
    if (watch.current) { Geolocation.clearWatch({ id: watch.current }); watch.current = null }
    lock.current?.release().catch(() => {}); lock.current = null
  }
  useEffect(() => () => stopWatch(), [])

  const start = async () => {
    setMsg('')
    try { const p = await Geolocation.requestPermissions(); if (p.location === 'denied') { setMsg('Allow location access to record a hike.'); return } } catch { /* browser */ }
    try { lock.current = (await navigator.wakeLock?.request('screen')) ?? null } catch { /* optional */ }
    run.current = true; setSt('run')
    try {
      watch.current = await Geolocation.watchPosition({ enableHighAccuracy: true, timeout: 20000 }, (pos, err) => {
        if (err || !pos || !run.current || pos.coords.accuracy > 35) return
        const p: Pt = { lat: pos.coords.latitude, lng: pos.coords.longitude, alt: pos.coords.altitude ?? 0, t: Date.now() }
        setPts(a => { const l = a[a.length - 1]; return l && hav(l, p) < 3 ? a : [...a, p] })
      })
    } catch { setMsg('Could not start GPS.'); run.current = false; setSt('idle') }
  }
  const toggle = () => { run.current = st !== 'run'; setSt(st === 'run' ? 'pause' : 'run') }
  const finish = () => {
    run.current = false; stopWatch()
    if (d < 20 || secs < 5) { alert('Too short to save. Record at least 20 m and 5 seconds, outdoors with GPS.'); onExit(null); return }
    const r: Rec = { id: Date.now(), ts: Date.now() - secs * 1000, distM: d, secs, gain: g, route: pts }
    addRec(r); onExit(r)
  }
  const back = () => { if (st === 'idle' || confirm('Discard this recording?')) { run.current = false; stopWatch(); onExit(null) } }

  return (
    <div className="relative h-dvh">
      <MapView route={pts} follow className="absolute inset-0" />
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

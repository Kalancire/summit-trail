import { useEffect, useMemo, useState } from 'react'
import { Geolocation } from '@capacitor/geolocation'
import { Undo2, Trash2 } from 'lucide-react'
import MapView from '../components/MapView'
import { Back, Btn, Mini } from '../components/ui'
import { densify, makeTrail, trailStats, withElevation } from '../lib/trail'
import { WP_EMOJI, WP_LABEL, dist, type Pt, type Trail, type Wp, type WpKind } from '../lib/core'
import { useSettings } from '../lib/store'

// Plan a trail you have not hiked yet: tap points on the map to draw the path, and drop waypoints along it
export default function DrawTrail({ onBack, onDone }: { onBack: () => void; onDone: (t: Trail) => void }) {
  const { units } = useSettings()
  const [pts, setPts] = useState<Pt[]>([]), [wps, setWps] = useState<Wp[]>([]), [mode, setMode] = useState<'path' | WpKind>('path')
  const [center, setCenter] = useState<[number, number] | undefined>(), [busy, setBusy] = useState(false), [msg, setMsg] = useState('')
  useEffect(() => { Geolocation.getCurrentPosition({ timeout: 8000, maximumAge: 60000 }).then(p => setCenter([p.coords.longitude, p.coords.latitude])).catch(() => {}) }, [])
  const tap = (lng: number, lat: number) => {
    if (mode === 'path') setPts(a => [...a, { lat, lng, alt: 0, t: Date.now() }])
    else setWps(a => [...a, { lat, lng, kind: mode }])
  }
  const d = useMemo(() => trailStats(pts).distM, [pts])
  const finish = async () => {
    setBusy(true); setMsg('')
    const dense = densify(pts, 60)
    const withAlt = await withElevation(dense)
    if (!withAlt) setMsg('No internet, so climb and highest point are unknown. You can still save it.')
    const route = withAlt ?? dense
    onDone({ ...makeTrail({ name: 'Planned trail', route, wps, drawn: true }) })
    setBusy(false)
  }
  const kinds = Object.keys(WP_LABEL) as WpKind[]
  return (
    <div className="relative h-dvh">
      <MapView route={pts} wps={wps} showPts noFit center={center} onTap={tap} className="absolute inset-0" />
      <div className="safe-top absolute left-5 top-0"><Back onClick={onBack} /></div>
      <div className="card absolute inset-x-4 bottom-4 rounded-[2rem] p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
        <p className="text-center text-sm text-mute">{mode === 'path' ? 'Tap the map to add points along your trail' : `Tap the map to place a ${WP_LABEL[mode].toLowerCase()}`}</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <button onClick={() => setMode('path')} className={`rounded-full px-3 py-1 text-sm font-bold ${mode === 'path' ? 'grad text-white' : 'card text-mute'}`}>Path</button>
          {kinds.map(k => <button key={k} onClick={() => setMode(k)} className={`rounded-full px-3 py-1 text-sm font-bold ${mode === k ? 'grad text-white' : 'card text-mute'}`}>{WP_EMOJI[k]}</button>)}
        </div>
        <div className="mt-4 grid grid-cols-3 text-center"><Mini label="Distance" value={dist(d, units)} /><Mini label="Points" value={String(pts.length)} /><Mini label="Waypoints" value={String(wps.length)} /></div>
        {msg && <p className="mt-2 text-center text-xs text-red-400">{msg}</p>}
        <div className="mt-4 flex gap-3">
          <button onClick={() => (mode === 'path' ? setPts(a => a.slice(0, -1)) : setWps(a => a.slice(0, -1)))} aria-label="Undo" className="card grid size-12 place-items-center rounded-full text-accent"><Undo2 className="size-5" /></button>
          <button onClick={() => { if (confirm('Clear everything you drew?')) { setPts([]); setWps([]) } }} aria-label="Clear" className="card grid size-12 place-items-center rounded-full text-red-400"><Trash2 className="size-5" /></button>
          <Btn onClick={finish} disabled={pts.length < 2 || busy} className="flex-1">{busy ? 'Calculating…' : 'Done'}</Btn>
        </div>
      </div>
    </div>
  )
}

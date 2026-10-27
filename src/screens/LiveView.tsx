import { useEffect, useMemo, useState } from 'react'
import { Back, Mini } from '../components/ui'
import MapView from '../components/MapView'
import { dist, hms } from '../lib/core'
import { getLiveDoc, livePts, type LiveDoc } from '../lib/live'
import { mapsLink } from '../lib/safety'
import { useSettings } from '../lib/store'

// Read-only page for family and friends: follows a hiker who is sharing live. Needs no account.
export default function LiveView({ code, onClose }: { code: string; onClose: () => void }) {
  const { units } = useSettings()
  const [d, setD] = useState<LiveDoc | null | undefined>(undefined), [err, setErr] = useState(false), [, tick] = useState(0)
  useEffect(() => {
    let alive = true
    const load = () => getLiveDoc(code).then(x => { if (alive) { setD(x); setErr(false) } }).catch(() => { if (alive) setErr(true) })
    load(); const a = setInterval(load, 8000), b = setInterval(() => tick(n => n + 1), 15000)
    return () => { alive = false; clearInterval(a); clearInterval(b) }
  }, [code])
  const route = useMemo(() => (d ? livePts(d) : []), [d])
  const me = d ? { lat: d.lat, lng: d.lng, alt: d.alt, t: d.at } : null
  const ago = d ? Math.max(0, Math.round((Date.now() - d.at) / 60000)) : 0
  return (
    <div className="relative h-dvh">
      {d ? <MapView route={route} me={me} follow className="absolute inset-0" /> : <div className="absolute inset-0 bg-bg" />}
      <div className="safe-top absolute left-5 top-0"><Back onClick={onClose} /></div>
      <div className="card absolute inset-x-4 bottom-4 rounded-[2rem] p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
        {d === undefined ? <p className="text-center text-mute">{err ? 'No connection. Retrying…' : 'Finding the hiker…'}</p>
          : d === null ? <p className="text-center"><b>This live link has ended or expired.</b><span className="mt-1 block text-sm text-mute">Ask your hiker to share a new one.</span></p>
          : <>
            <p className="text-center text-lg font-bold">{d.name}{d.done ? ' finished the hike' : ' is hiking'}{d.trail ? ` · ${d.trail}` : ''}</p>
            <p className={`text-center text-xs ${ago > 5 && !d.done ? 'text-red-400' : 'text-mute'}`}>{d.done ? 'Sharing has ended' : `Updated ${ago < 1 ? 'just now' : `${ago} min ago`}${ago > 5 ? ' · they may be out of signal' : ''}`}</p>
            <div className="mt-4 grid grid-cols-3 text-center"><Mini label="Distance" value={dist(d.distM, units)} /><Mini label="Time" value={hms(d.secs)} /><Mini label="Altitude" value={d.alt ? `${d.alt} m` : '--'} /></div>
            <a href={mapsLink(d.lat, d.lng)} target="_blank" rel="noreferrer" className="grad mt-4 flex h-12 items-center justify-center rounded-2xl font-bold text-white">Open last location in Maps</a>
          </>}
      </div>
    </div>
  )
}

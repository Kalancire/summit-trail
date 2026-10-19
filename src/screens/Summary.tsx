import { useEffect, useRef, useState } from 'react'
import { Flame, Mountain, Share2, Trash2, Play } from 'lucide-react'
import MapView from '../components/MapView'
import { Back, Btn, Mini } from '../components/ui'
import { Elevation } from '../components/charts'
import { dateLine, dist, hms, kcal, pace, title, trimEnds, type Rec } from '../lib/core'
import { delRec, useSettings } from '../lib/store'
import { renderVideo, saveVideo } from '../lib/video'

export default function Summary({ rec, onBack }: { rec: Rec; onBack: () => void }) {
  const { units, hideEnds } = useSettings()
  const route = trimEnds(rec.route, hideEnds)
  const n = route.length
  const [a, setA] = useState(0), [b, setB] = useState(n - 1), [ci, setCi] = useState<number | null>(null)
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState('')
  const raf = useRef(0)
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const play = () => {
    cancelAnimationFrame(raf.current)
    const t0 = performance.now()
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 7000)
      setCi(a + Math.round((b - a) * k))
      if (k < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
  }
  const exportVideo = async () => {
    setBusy(true); setMsg('')
    try {
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
      const { blob, ext } = await renderVideo(route.slice(a, b + 1), accent, `${title(rec)} · ${dateLine(rec)}`)
      await saveVideo(blob, `summit-trail-${rec.id}.${ext}`)
      setMsg(`Replay saved (${ext.toUpperCase()}).`)
    } catch (e) { setMsg((e as Error).message) }
    setBusy(false)
  }

  return (
    <div className="h-dvh overflow-y-auto">
      <div className="mx-auto max-w-md px-5 pb-10 safe-top">
        <div className="flex items-center gap-3"><Back onClick={onBack} /><h1 className="text-xl font-bold">Summary</h1></div>

        <div className="card mt-5 rounded-2xl px-5 py-4">
          <div className="flex items-center justify-between">
            <span>{title(rec)}</span>
            <span className="flex items-center gap-1.5 text-sm"><b>{kcal(rec.distM, rec.gain)}</b><Flame className="glow size-5 fill-accent text-accent" /></span>
          </div>
          <div className="mt-2 flex justify-between text-sm"><b>{dist(rec.distM, units)}</b><b>{hms(rec.secs)}</b><b>{Math.round(rec.gain)} m</b></div>
        </div>

        <div className="card relative mt-4 rounded-[2rem] p-1.5">
          <MapView inline route={route} cursor={ci === null ? null : route[Math.min(ci, n - 1)]} className="h-[48dvh] overflow-hidden rounded-[1.7rem]" />
          <div className="card absolute inset-x-5 bottom-5 rounded-2xl p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 font-bold"><Mountain className="size-5 text-accent" /> Hiking</span>
              <span className="text-xs">{dateLine(rec)}</span>
            </div>
            <div className="mt-2 flex justify-between text-sm"><span>{dist(rec.distM, units)}</span><span>{hms(rec.secs)}</span></div>
            <div className="mt-3 border-t border-white/80 pt-2 text-sm">Pace {pace(rec.distM, rec.secs, units)} /{units}</div>
          </div>
        </div>

        <div className="card mt-5 rounded-2xl p-5">
          <div className="mb-2 flex justify-between"><Mini label="Climb" value={`${Math.round(rec.gain)} m`} /><Mini label="Calories" value={`${kcal(rec.distM, rec.gain)} kcal`} /></div>
          <Elevation route={route} />
        </div>

        <div className="card mt-5 rounded-2xl p-5">
          <b>Route replay</b>
          <p className="mb-3 text-xs text-mute">Pick the start and end points, then play or export a video.</p>
          <label className="text-xs text-mute">Start</label>
          <input type="range" min={0} max={n - 1} value={a} className="w-full" onChange={e => { const v = Math.min(+e.target.value, b - 1); setA(v); setCi(v) }} />
          <label className="text-xs text-mute">End</label>
          <input type="range" min={0} max={n - 1} value={b} className="w-full" onChange={e => { const v = Math.max(+e.target.value, a + 1); setB(v); setCi(v) }} />
          <div className="mt-3 flex gap-3">
            <Btn outline onClick={play} className="flex-1"><Play className="size-4" /> Play</Btn>
            <Btn onClick={exportVideo} disabled={busy} className="flex-1"><Share2 className="size-4" /> {busy ? 'Rendering…' : 'Save video'}</Btn>
          </div>
          {msg && <p className="mt-3 text-center text-sm text-mute">{msg}</p>}
        </div>

        <button onClick={() => { if (confirm('Delete this activity?')) { delRec(rec.id); onBack() } }}
          className="mx-auto mt-6 flex items-center gap-2 text-sm text-red-400"><Trash2 className="size-4" /> Delete activity</button>
      </div>
    </div>
  )
}

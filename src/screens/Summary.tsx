import { useEffect, useMemo, useRef, useState } from 'react'
import { Flame, Mountain, Pause, Route as RouteIcon, Share2, Trash2, Play } from 'lucide-react'
import MapView from '../components/MapView'
import { Back, Btn, Mini } from '../components/ui'
import { Elevation } from '../components/charts'
import { KIND_LABEL, WP_EMOJI, calc, dateLine, dist, hav, hms, kcal, pace, splits, title, trimEnds, type Cp, type Kind, type Rec } from '../lib/core'
import { cumDist, peakOf } from '../lib/trail'
import { delRec, updateRec, useSettings } from '../lib/store'
import { renderVideo, saveVideo } from '../lib/video'
import { renderCard } from '../lib/card'
import { exportGpx } from '../lib/gpx'

export default function Summary({ rec, onBack, onSaveTrail }: { rec: Rec; onBack: () => void; onSaveTrail: (r: Rec) => void }) {
  const { units, hideEnds } = useSettings()
  const route = trimEnds(rec.route, hideEnds)
  const n = route.length
  const [a, setA] = useState(0), [b, setB] = useState(n - 1), [ci, setCi] = useState<number | null>(null)
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState('')
  const [playing, setPlaying] = useState(false), [speed, setSpeed] = useState(1)
  const pos = useRef(0)
  const [meta, setMeta] = useState({ name: rec.name ?? '', type: (rec.type ?? 'hike') as Kind, note: rec.note ?? '', gear: rec.gear ?? '' })
  const latest = useRef(rec)   // newest copy of this hike, so editing details and journal notes never overwrite each other
  const patch = (p: Partial<Rec>) => { latest.current = { ...latest.current, ...p }; updateRec(latest.current) }
  const saveMeta = (m = meta) => patch({ ...m, name: m.name.trim() || undefined })
  const [cps, setCps] = useState<Cp[]>(rec.cps ?? [])
  const peak = rec.peak ?? peakOf(rec.route)
  const cum = useMemo(() => cumDist(rec.route), [rec.route])
  const atKm = (c: Cp) => { let bi = 0, bd = Infinity; rec.route.forEach((p, i) => { const d = hav(p, { ...p, lat: c.lat, lng: c.lng }); if (d < bd) { bd = d; bi = i } }); return cum[bi] ?? 0 }
  const sp = useMemo(() => splits(route, units), [route, units])
  const fast = sp.filter(x => x.m > 500 && x.secs > 0).map(x => x.secs / x.m)
  const best = fast.length ? Math.min(...fast) : 0
  useEffect(() => {
    if (!playing) return
    let last = performance.now(), id = 0
    const step = (t: number) => {
      pos.current += ((b - a) * (t - last) * speed) / 14000; last = t
      if (pos.current >= b) { setCi(b); setPlaying(false); return }
      setCi(Math.round(pos.current)); id = requestAnimationFrame(step)
    }
    id = requestAnimationFrame(step)
    return () => cancelAnimationFrame(id)
  }, [playing, speed, a, b])
  const toggle = () => {
    if (!playing) pos.current = ci === null || ci < a || ci >= b - 1 ? a : ci
    setPlaying(p => !p)
  }
  const at = ci === null ? null : Math.min(ci, n - 1)
  const seen = useMemo(() => (at === null ? null : { d: calc(route.slice(0, at + 1)).d, s: Math.round((route[at].t - route[0].t) / 1000) }), [at, route])
  const shareCard = async () => {
    try { const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(); await saveVideo(await renderCard(rec, units, accent, hideEnds), `summit-trail-${rec.id}.png`, 'My Summit Trail hike') } catch (e) { setMsg((e as Error).message) }
  }
  const exportVideo = async () => {
    setBusy(true); setMsg('')
    try {
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
      const { blob, ext } = await renderVideo(route.slice(a, b + 1), accent, `${title(rec)} · ${dateLine(rec)}`, cps, units)
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
            <span>{title({ ...rec, name: meta.name || undefined, type: meta.type })}</span>
            <span className="flex items-center gap-1.5 text-sm"><b>{kcal(rec.distM, rec.gain)}</b><Flame className="glow size-5 fill-accent text-accent" /></span>
          </div>
          <div className="mt-2 flex justify-between text-sm"><b>{dist(rec.distM, units)}</b><b>{hms(rec.secs)}</b><b>{Math.round(rec.gain)} m</b></div>
        </div>

        {peak && (
          <div className="card mt-4 flex items-center gap-4 rounded-2xl p-4">
            <span className="grid size-12 -rotate-6 place-items-center rounded-full border-4 border-dashed border-accent/70 text-accent"><Mountain className="size-5" /></span>
            <span className="flex-1 text-sm"><b className="block">Peak logged{peak.name ? `: ${peak.name}` : ''}</b><span className="text-xs text-mute">Highest point {peak.alt} m · see it in your Peak passport</span></span>
          </div>
        )}

        {n > 1 && <>
        <div className="card relative mt-4 rounded-[2rem] p-1.5">
          <MapView inline route={route} cps={rec.cps} cursor={ci === null ? null : route[Math.min(ci, n - 1)]} className="h-[48dvh] overflow-hidden rounded-[1.7rem]" />
          <div className="card absolute inset-x-5 bottom-5 rounded-2xl p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 font-bold"><Mountain className="size-5 text-accent" /> {KIND_LABEL[meta.type]}</span>
              <span className="text-xs">{dateLine(rec)}</span>
            </div>
            <div className="mt-2 flex justify-between text-sm"><span>{dist(rec.distM, units)}</span><span>{hms(rec.secs)}</span></div>
            <div className="mt-3 border-t border-white/80 pt-2 text-sm">Pace {pace(rec.distM, rec.secs, units)} /{units}</div>
          </div>
        </div>

        <div className="card mt-5 rounded-2xl p-5">
          <div className="mb-2 flex flex-wrap justify-between gap-3"><Mini label="Climb" value={`${Math.round(rec.gain)} m`} /><Mini label="Calories" value={`${kcal(rec.distM, rec.gain)} kcal`} /><Mini label="Steps (est.)" value={Math.round(rec.distM / 0.75).toLocaleString()} />{rec.hrAvg ? <Mini label="Heart rate" value={`${rec.hrAvg} avg · ${rec.hrMax} max`} /> : null}</div>
          <Elevation route={route} />
        </div>
        </>}

        <div className="card mt-5 rounded-2xl p-5">
          <b>Details</b>
          <input value={meta.name} placeholder="Rename activity" onChange={e => setMeta({ ...meta, name: e.target.value })} onBlur={() => saveMeta()} className="inset mt-3 w-full rounded-xl bg-transparent p-2 text-sm" />
          <select value={meta.type} onChange={e => { const m = { ...meta, type: e.target.value as Kind }; setMeta(m); saveMeta(m) }} className="inset mt-2 w-full rounded-xl bg-transparent p-2 text-sm">{Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <input value={meta.gear} placeholder="Gear / shoes" onChange={e => setMeta({ ...meta, gear: e.target.value })} onBlur={() => saveMeta()} className="inset mt-2 w-full rounded-xl bg-transparent p-2 text-sm" />
          <textarea value={meta.note} placeholder="Notes" rows={3} onChange={e => setMeta({ ...meta, note: e.target.value })} onBlur={() => saveMeta()} className="inset mt-2 w-full rounded-xl bg-transparent p-2 text-sm" />
        </div>

        {sp.length > 0 && (
          <div className="card mt-5 rounded-2xl p-5">
            <b>Splits</b>
            {sp.map(x => (
              <div key={x.n} className="mt-2 flex items-center gap-3 text-xs">
                <span className="w-6 text-mute">{x.n}</span>
                <span className="w-12">{pace(x.m, x.secs, units)}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/10"><span className={`block h-full ${x.secs / x.m === best ? 'grad' : 'bg-accent/50'}`} style={{ width: (best && x.secs ? Math.max(8, (best / (x.secs / x.m)) * 100) : 100) + '%' }} /></span>
              </div>
            ))}
          </div>
        )}

        {cps.length > 0 && (
          <div className="card mt-5 rounded-2xl p-5">
            <b>Trail journal</b>
            <p className="mb-1 text-xs text-mute">Your checkpoints in order, so the hike reads like a story.</p>
            {[...cps].sort((x, y) => x.t - y.t).map((c, i) => (
              <div key={c.t} className="mt-4 border-l-2 border-accent/60 pl-4">
                <p className="text-xs text-mute">{c.kind ? WP_EMOJI[c.kind] + ' ' : ''}Checkpoint {i + 1} · {new Date(c.t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · {dist(atKm(c), units)}</p>
                {c.photo && <img src={c.photo} alt="" className="mt-2 max-h-56 w-full rounded-xl object-cover" />}
                <textarea value={c.note ?? ''} rows={2} placeholder="Add a note"
                  onChange={e => setCps(a => a.map(x => (x.t === c.t ? { ...x, note: e.target.value } : x)))}
                  onBlur={() => patch({ cps })} className="inset mt-2 w-full rounded-xl bg-transparent p-2 text-sm" />
              </div>
            ))}
          </div>
        )}

        {n > 1 && <div className="card mt-5 rounded-2xl p-5">
          <b>Route replay</b>
          <p className="mb-3 text-xs text-mute">Pick the start and end points, then play or export a video.</p>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm">{seen ? <><b className="text-accent">{dist(seen.d, units)}</b> · {hms(Math.max(0, seen.s))}</> : <span className="text-mute">Press play to replay the hike</span>}</span>
            <div className="inset flex rounded-full p-1">
              {[1, 2, 4].map(x => <button key={x} onClick={() => setSpeed(x)} className={`rounded-full px-3 py-0.5 text-xs font-bold ${speed === x ? 'grad text-white' : 'text-mute'}`}>{x}×</button>)}
            </div>
          </div>
          <label className="text-xs text-mute">Start</label>
          <input type="range" min={0} max={n - 1} value={a} className="w-full" onChange={e => { const v = Math.min(+e.target.value, b - 1); setA(v); setCi(v) }} />
          <label className="text-xs text-mute">End</label>
          <input type="range" min={0} max={n - 1} value={b} className="w-full" onChange={e => { const v = Math.max(+e.target.value, a + 1); setB(v); setCi(v) }} />
          <div className="mt-3 flex gap-3">
            <Btn outline onClick={toggle} className="flex-1">{playing ? <Pause className="size-4" /> : <Play className="size-4" />} {playing ? 'Pause' : 'Play'}</Btn>
            <Btn onClick={exportVideo} disabled={busy} className="flex-1"><Share2 className="size-4" /> {busy ? 'Rendering…' : 'Save video'}</Btn>
          </div>
          {msg && <p className="mt-3 text-center text-sm text-mute">{msg}</p>}
        </div>}

        {n > 20 && <Btn outline onClick={() => onSaveTrail(rec)} className="mt-4 w-full"><RouteIcon className="size-4" /> Save as trail</Btn>}
        {n > 1 && <Btn outline onClick={shareCard} className="mt-3 w-full"><Share2 className="size-4" /> Share card (image)</Btn>}
        <Btn outline onClick={() => exportGpx(rec).catch(() => alert('Could not export GPX'))} className="mt-3 w-full"><Share2 className="size-4" /> Export GPX</Btn>

        <button onClick={() => { if (confirm('Delete this activity?')) { delRec(rec.id); onBack() } }}
          className="mx-auto mt-6 flex items-center gap-2 text-sm text-red-400"><Trash2 className="size-4" /> Delete activity</button>
      </div>
    </div>
  )
}

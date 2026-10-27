import { useMemo, useRef, useState } from 'react'
import Awards from './Awards'
import { parseGpx } from '../lib/gpx'
import { makeTrail } from '../lib/trail'
import { Download, Upload, Mountain, PencilLine, Route as RouteIcon } from 'lucide-react'
import TrailPreview from '../components/TrailPreview'
import { Tabs } from '../components/ui'
import { DIFF_COLOR, peakOf } from '../lib/trail'
import { dist, hav, type Peak, type Rec, type Trail } from '../lib/core'
import { updateRec, useSettings } from '../lib/store'
import { addTrail, importTrail } from '../lib/trailstore'

type Summit = { alt: number; lat: number; lng: number; name?: string; visits: { ts: number; id: number }[] }

// groups hikes that reached the same summit (within 200 m) into one passport stamp
function summits(recs: Rec[]): Summit[] {
  const out: Summit[] = []
  for (const r of [...recs].sort((a, b) => a.ts - b.ts)) {
    const p = r.peak ?? peakOf(r.route); if (!p) continue
    const s = out.find(x => hav({ ...x, alt: 0, t: 0 }, { ...p, alt: 0, t: 0 }) < 200)
    if (s) { s.visits.push({ ts: r.ts, id: r.id }); s.alt = Math.max(s.alt, p.alt); s.name ||= p.name }
    else out.push({ ...p, visits: [{ ts: r.ts, id: r.id }] })
  }
  return out.sort((a, b) => b.visits[b.visits.length - 1].ts - a.visits[a.visits.length - 1].ts)
}

export default function Trails({ recs, trails, onOpen, onOpenRec, onDraw, onChange }: {
  recs: Rec[]; trails: Trail[]; onOpen: (t: Trail) => void; onOpenRec: (r: Rec) => void; onDraw: () => void; onChange: () => void
}) {
  const gpx = useRef<HTMLInputElement>(null)
  const importGpx = async (f?: File) => {
    if (!f) return
    try { const g = parseGpx(await f.text()); const t = makeTrail({ name: g.name, route: g.route, wps: g.wps }); addTrail(t); onChange(); onOpen(t) } catch (e) { alert((e as Error).message) }
  }
  const { units } = useSettings()
  const [tab, setTab] = useState(0), [imp, setImp] = useState(false), [code, setCode] = useState(''), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false)
  const peaks = useMemo(() => summits(recs), [recs])
  const rename = (s: Summit) => {
    const name = prompt('Name this peak', s.name ?? '')?.trim(); if (name === undefined) return
    const ids = new Set(s.visits.map(v => v.id))
    recs.filter(r => ids.has(r.id)).forEach(r => { const p = (r.peak ?? peakOf(r.route)) as Peak; updateRec({ ...r, peak: { ...p, name: name || undefined } }) })
    onChange()
  }
  const doImport = async () => {
    setBusy(true); setMsg('')
    try { const t = await importTrail(code); setImp(false); setCode(''); onChange(); onOpen(t) } catch (e) { setMsg((e as Error).message) }
    setBusy(false)
  }
  return (
    <div className="mx-auto max-w-md px-5 pb-36 safe-top">
      <h1 className="mb-4 text-3xl font-bold">{tab === 0 ? 'My Trails' : tab === 1 ? 'Peak passport' : 'Awards'}</h1>
      <Tabs items={['Trails', 'Peaks', 'Awards']} on={tab} set={setTab} />

      {tab === 0 ? <>
        <div className="mt-4 flex gap-3">
          <button onClick={onDraw} className="grad flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 font-bold text-white"><PencilLine className="size-5" /> Draw a trail</button>
          <input ref={gpx} type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml,*/*" hidden onChange={e => { importGpx(e.target.files?.[0]); e.target.value = '' }} />
          <button onClick={() => gpx.current?.click()} aria-label="Import GPX" className="card flex items-center gap-2 rounded-2xl px-4 py-3 font-bold text-accent"><Upload className="size-5" /> GPX</button>
          <button onClick={() => setImp(!imp)} className="card flex items-center gap-2 rounded-2xl px-4 py-3 font-bold text-accent"><Download className="size-5" /> Import</button>
        </div>
        {imp && (
          <div className="card mt-3 rounded-2xl p-4">
            <p className="text-xs text-mute">Paste a trail code or link someone shared with you.</p>
            <div className="mt-2 flex gap-2">
              <input value={code} onChange={e => setCode(e.target.value)} placeholder="Code or link" autoCapitalize="characters" className="inset h-11 flex-1 rounded-xl bg-transparent px-3 text-sm" />
              <button onClick={doImport} disabled={busy || !code.trim()} className="grad rounded-xl px-4 text-sm font-bold text-white disabled:opacity-50">{busy ? '…' : 'Add'}</button>
            </div>
            {msg && <p className="mt-2 text-xs text-red-400">{msg}</p>}
          </div>
        )}
        {trails.length === 0 ? (
          <div className="card mt-4 flex flex-col items-center gap-2 rounded-2xl p-8 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-accent/15 text-accent"><RouteIcon className="size-7" /></span>
            <b>No trails yet</b>
            <p className="text-sm text-mute">Turn on “Save this as a trail” before you start a hike, or tap Draw a trail to plan one on the map.</p>
          </div>
        ) : trails.map(t => (
          <button key={t.id} onClick={() => onOpen(t)} className="card mt-4 block w-full rounded-[1.7rem] p-2 text-left">
            <TrailPreview route={t.route} wps={t.wps} className="h-32 w-full rounded-[1.3rem]" />
            <div className="flex items-center gap-3 p-3">
              {t.cover ? <img src={t.cover} alt="" className="size-12 rounded-full object-cover" /> : <span className="grad grid size-12 place-items-center rounded-full text-white"><Mountain className="size-5" /></span>}
              <span className="min-w-0 flex-1">
                <b className="block truncate">{t.name}</b>
                <span className="text-xs text-mute">{dist(t.distM, units)} · {Math.round(t.gain)} m climb{t.maxAlt ? ` · ${Math.round(t.maxAlt)} m high` : ''}</span>
              </span>
              <span style={{ background: DIFF_COLOR[t.diff] }} className="rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize text-white">{t.diff}</span>
            </div>
          </button>
        ))}
      </> : tab === 2 ? <Awards recs={recs} onOpen={onOpenRec} /> : <>
        <div className="card mt-4 flex justify-around rounded-2xl p-4 text-center">
          <span><b className="block text-2xl text-accent">{peaks.length}</b><small className="text-xs text-mute">Peaks logged</small></span>
          <span><b className="block text-2xl text-accent">{peaks.length ? Math.max(...peaks.map(p => p.alt)) : 0} m</b><small className="text-xs text-mute">Highest</small></span>
          <span><b className="block text-2xl text-accent">{peaks.reduce((n, p) => n + p.visits.length, 0)}</b><small className="text-xs text-mute">Summits</small></span>
        </div>
        {peaks.length === 0 ? (
          <div className="card mt-4 flex flex-col items-center gap-2 rounded-2xl p-8 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-accent/15 text-accent"><Mountain className="size-7" /></span>
            <b>No peaks yet</b>
            <p className="text-sm text-mute">Climb at least 40 m on a hike and its highest point is stamped here.</p>
          </div>
        ) : <div className="mt-4 grid grid-cols-2 gap-4">{peaks.map((p, i) => (
          <button key={i} onClick={() => rename(p)} className="card flex flex-col items-center rounded-3xl p-4 text-center">
            <span className="grid size-20 -rotate-6 place-items-center rounded-full border-4 border-dashed border-accent/70 text-accent">
              <span><Mountain className="mx-auto size-6" /><b className="block text-sm leading-tight">{p.alt} m</b></span>
            </span>
            <b className="mt-3 text-sm">{p.name || 'Unnamed peak'}</b>
            <span className="mt-1 text-[11px] text-mute">{p.visits.slice(-3).reverse().map(v => new Date(v.ts).toLocaleDateString([], { day: 'numeric', month: 'short', year: '2-digit' })).join(' · ')}{p.visits.length > 3 ? ` +${p.visits.length - 3}` : ''}</span>
            {!p.name && <span className="mt-1 text-[10px] text-accent">Tap to name</span>}
          </button>
        ))}</div>}
      </>}
    </div>
  )
}

import { useState } from 'react'
import { KIND_LABEL, dist, hms, pace, type Kind, type Rec } from '../lib/core'
import { addRec, setSettings, useSettings } from '../lib/store'

export function Totals({ recs }: { recs: Rec[] }) {
  const { units, goalKm = 20, goalOn = true } = useSettings()
  const now = new Date(), wk = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime()
  const sum = (from: number) => recs.filter(r => r.ts >= from).reduce((a, r) => a + r.distM, 0)
  const week = sum(wk), month = sum(new Date(now.getFullYear(), now.getMonth(), 1).getTime()), year = sum(new Date(now.getFullYear(), 0, 1).getTime())
  const longest = Math.max(0, ...recs.map(r => r.distM)), climb = Math.max(0, ...recs.map(r => r.gain))
  const fast = recs.filter(r => r.distM > 1000).sort((a, b) => a.secs / a.distM - b.secs / b.distM)[0]
  const pct = Math.min(100, (week / 1000 / goalKm) * 100)
  return (
    <div className="card mb-5 rounded-2xl p-4">
      <div className="flex justify-between text-center text-xs text-mute">
        {[['Week', week], ['Month', month], ['Year', year]].map(([l, v]) => <span key={l as string}><b className="block text-base text-white">{dist(v as number, units)}</b>{l}</span>)}
      </div>
      {goalOn && <button onClick={() => { const v = parseFloat(prompt('Weekly goal (km)', String(goalKm)) || ''); if (v > 0) setSettings({ goalKm: v }) }} className="mt-3 block w-full text-left">
        <span className="flex justify-between text-xs"><span>Weekly goal</span><span>{(week / 1000).toFixed(1)} / {goalKm} km</span></span>
        <span className="mt-1 block h-2 overflow-hidden rounded-full bg-white/10"><span className="grad block h-full" style={{ width: pct + '%' }} /></span>
      </button>}
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs text-mute">
        <span><b className="block text-sm text-accent">{dist(longest, units)}</b>Longest</span>
        <span><b className="block text-sm text-accent">{Math.round(climb)} m</b>Top climb</span>
        <span><b className="block text-sm text-accent">{fast ? pace(fast.distM, fast.secs, units) : '--'}</b>Best pace</span>
      </div>
    </div>
  )
}

export function ManualAdd() {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ date: new Date().toISOString().slice(0, 10), km: '', min: '', gain: '', type: 'hike' as Kind })
  const save = () => {
    const km = parseFloat(f.km), min = parseFloat(f.min)
    if (!(km > 0) || !(min > 0)) { alert('Enter distance and time.'); return }
    const ts = new Date(f.date + 'T08:00:00').getTime()
    if (isNaN(ts)) { alert('Pick a date.'); return }
    addRec({ id: Date.now(), ts, distM: km * 1000, secs: Math.round(min * 60), gain: parseFloat(f.gain) || 0, route: [], type: f.type })
    setOpen(false); setF({ ...f, km: '', min: '', gain: '' })
  }
  const inp = 'inset w-full rounded-xl bg-transparent p-2 text-sm'
  return (
    <div className="mb-5">
      <button onClick={() => setOpen(!open)} className="card w-full rounded-2xl p-3 text-sm font-bold text-accent">{open ? 'Cancel' : '+ Add activity manually'}</button>
      {open && (
        <div className="card mt-2 grid grid-cols-2 gap-2 rounded-2xl p-4">
          <input className={inp} type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} />
          <select className={inp} value={f.type} onChange={e => setF({ ...f, type: e.target.value as Kind })}>{Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <input className={inp} placeholder="Distance (km)" inputMode="decimal" value={f.km} onChange={e => setF({ ...f, km: e.target.value })} />
          <input className={inp} placeholder="Time (minutes)" inputMode="decimal" value={f.min} onChange={e => setF({ ...f, min: e.target.value })} />
          <input className={inp + ' col-span-2'} placeholder="Climb (m, optional)" inputMode="decimal" value={f.gain} onChange={e => setF({ ...f, gain: e.target.value })} />
          <button onClick={save} className="grad col-span-2 rounded-xl p-2 font-bold text-white">Save</button>
        </div>
      )}
    </div>
  )
}
export const hmsShort = hms

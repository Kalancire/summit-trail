import { useState } from 'react'
import { Download, Flame, Mountain, Route, Timer, TrendingUp } from 'lucide-react'
import { dateLine, hms, kcal, sameDay, title, type Rec } from '../lib/core'
import { getUser, useSettings } from '../lib/store'
import { useOnline } from '../lib/net'
import { downloadOffline, lastOffline } from '../lib/offline'
import { CheckRow, Header, Mini, Tabs, Tile } from '../components/ui'
import { Ruler, WeekBars } from '../components/charts'

export default function Home({ name, recs, onOpen, onProfile }: {
  name: string; recs: Rec[]; onOpen: (r: Rec) => void; onProfile: () => void
}) {
  const { units } = useSettings()
  const online = useOnline()
  const per = units === 'km' ? 1000 : 1609.344
  const now = new Date()
  const week = (off: number) => Array.from({ length: 7 }, (_, i) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + i + off).getTime())
  const days = week(0), before = week(-7)
  const [sel, setSel] = useState(now.getTime())
  const [tab, setTab] = useState(0)
  const [dl, setDl] = useState(''), [saved, setSaved] = useState(lastOffline())
  const download = () => downloadOffline((d, t) => setDl(`Downloading ${Math.round((d / t) * 100)}%`)).then(() => { setSaved(lastOffline()); setDl('') }).catch(() => setDl('Needs GPS and internet'))

  const metric = (r: Rec) => (tab === 0 ? r.distM / per : tab === 1 ? r.secs / 60 : r.gain)
  const perDay = (d: number) => recs.filter(r => sameDay(r.ts, d)).reduce((s, r) => s + metric(r), 0)
  const cur = days.map(perDay), prev = before.map(perDay)
  const tc = cur.reduce((a, b) => a + b, 0), tp = prev.reduce((a, b) => a + b, 0)
  const fmt = (x: number) => (tab === 0 ? `${x.toFixed(1)} ${units}` : tab === 1 ? `${Math.round(x)} min` : `${Math.round(x)} m`)
  const change = tp > 0 ? `${tc >= tp ? '+' : ''}${Math.round(((tc - tp) / tp) * 100)}%` : '—'

  const weekRecs = recs.filter(r => days.some(d => sameDay(r.ts, d)))
  const sum = (f: (r: Rec) => number) => weekRecs.reduce((s, r) => s + f(r), 0)
  const wDist = sum(r => r.distM) / per, wSecs = sum(r => r.secs), wGain = sum(r => r.gain), wKcal = sum(r => kcal(r.distM, r.gain))
  const dayRecs = recs.filter(r => sameDay(r.ts, sel))

  return (
    <div className="mx-auto max-w-md px-5 pb-36 safe-top">
      <Header name={name} photo={getUser()?.photo} time={`${Math.floor(wSecs / 3600)} h ${Math.floor((wSecs % 3600) / 60)} m`} onMenu={onProfile} />
      {!online && <p className="mt-3 rounded-xl bg-accent/15 px-3 py-2 text-center text-xs text-accent">Offline: hikes save on your phone and sync when you are back online.</p>}

      <button onClick={download} disabled={!online || dl.startsWith('Downloading')} className="card mt-4 flex w-full items-center gap-3 rounded-2xl p-3 text-left disabled:opacity-50">
        <Download className="size-5 text-accent" /><span className="flex-1 text-sm"><b>Download offline maps</b><span className="block text-xs text-mute">{dl || (saved ? `Area saved ${new Date(saved.at).toLocaleDateString()}` : 'Saves the map around you (about 8 km)')}</span></span>
      </button>

      <div className="mt-6"><Ruler value={wDist} unit={units} /></div>
      <div className="mx-auto mt-2 h-0 w-0 border-x-[9px] border-b-[13px] border-x-transparent border-b-accent" />

      <div className="mt-5 grid grid-cols-2 gap-4">
        <Tile icon={<Route />} label="Distance" value={`${wDist.toFixed(1)} ${units}`} />
        <Tile icon={<Timer />} label="Time" value={`${Math.round(wSecs / 60)} min`} />
        <Tile icon={<TrendingUp />} label="Climb" value={`${Math.round(wGain)} m`} />
        <Tile icon={<Flame />} label="Calories" value={`${wKcal} kcal`} />
      </div>

      <div className="card mt-6 rounded-2xl p-4">
        <Tabs items={['Distance', 'Time', 'Climb']} on={tab} set={setTab} />
        <div className="mt-5"><WeekBars vals={cur} prev={prev} sel={days.findIndex(d => sameDay(d, sel))} onSel={i => setSel(days[i])} /></div>
        <div className="mt-4 flex justify-between">
          <Mini label="This week" value={fmt(tc)} />
          <Mini label="Last week" value={fmt(tp)} />
          <Mini label="Change" value={change} />
        </div>
      </div>

      <p className="mt-6 text-sm text-mute">{new Date(sel).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      <h2 className="mb-3 text-2xl font-bold">Recent Activity</h2>
      {dayRecs.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 rounded-2xl p-8 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-accent/15 text-accent"><Mountain className="size-7" /></span>
          <b>No activity on this day</b>
          <p className="text-sm text-mute">Tap the orange play button to record a hike.</p>
        </div>
      ) : dayRecs.map(r => (
        <CheckRow key={r.id} icon={<Mountain className="size-5" />} label={title(r)} sub={`${dateLine(r)} · ${hms(r.secs)}`} onClick={() => onOpen(r)} />
      ))}
    </div>
  )
}

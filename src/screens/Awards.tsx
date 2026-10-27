import { dist, hms, pace, title, type Rec } from '../lib/core'
import { badges, gearMileage, records, streaks } from '../lib/awards'
import { setSettings, useSettings } from '../lib/store'

const Bar = ({ p }: { p: number }) => <span className="mt-1 block h-2 overflow-hidden rounded-full bg-white/10"><span className="grad block h-full" style={{ width: Math.min(100, p) + '%' }} /></span>

export default function Awards({ recs, onOpen }: { recs: Rec[]; onOpen: (r: Rec) => void }) {
  const { units, monthKm = 50 } = useSettings()
  const now = new Date(), from = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const month = recs.filter(r => r.ts >= from).reduce((s, r) => s + r.distM, 0) / 1000
  const st = streaks(recs), b = badges(recs), rc = records(recs), gear = gearMileage(recs)
  const row = (label: string, r: Rec | undefined, v: string) => r && (
    <button key={label} onClick={() => onOpen(r)} className="flex w-full items-center justify-between py-2 text-left text-sm">
      <span><b className="block">{label}</b><span className="text-xs text-mute">{title(r)} · {new Date(r.ts).toLocaleDateString()}</span></span><b className="text-accent">{v}</b>
    </button>
  )
  return (
    <div className="mt-4 space-y-4">
      <div className="card rounded-2xl p-4">
        <button onClick={() => { const v = parseFloat(prompt('Monthly challenge (km)', String(monthKm)) || ''); if (v > 0) setSettings({ monthKm: v }) }} className="block w-full text-left">
          <span className="flex justify-between text-sm"><b>{now.toLocaleDateString([], { month: 'long' })} challenge</b><span>{month.toFixed(1)} / {monthKm} km</span></span>
          <Bar p={(month / monthKm) * 100} />
          <span className="mt-1 block text-xs text-mute">{month >= monthKm ? 'Challenge complete! 🎉' : `${(monthKm - month).toFixed(1)} km to go · tap to change the goal`}</span>
        </button>
      </div>
      <div className="card flex justify-around rounded-2xl p-4 text-center">
        <span><b className="block text-2xl text-accent">🔥 {st.cur}</b><small className="text-xs text-mute">Day streak</small></span>
        <span><b className="block text-2xl text-accent">{st.best}</b><small className="text-xs text-mute">Best streak</small></span>
        <span><b className="block text-2xl text-accent">{b.filter(x => x.val >= x.goal).length}/{b.length}</b><small className="text-xs text-mute">Badges</small></span>
      </div>
      {recs.length > 0 && (
        <div className="card divide-y divide-white/5 rounded-2xl px-4 py-2">
          <b className="block py-2">Personal records</b>
          {row('Longest', rc.longest, rc.longest ? dist(rc.longest.distM, units) : '')}
          {row('Longest time', rc.time, rc.time ? hms(rc.time.secs) : '')}
          {row('Biggest climb', rc.climb, rc.climb ? `${Math.round(rc.climb.gain)} m` : '')}
          {row('Fastest pace', rc.fastest, rc.fastest ? `${pace(rc.fastest.distM, rc.fastest.secs, units)} /${units}` : '')}
        </div>
      )}
      <div className="card rounded-2xl p-4">
        <b>Badges</b>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {b.map(x => (
            <div key={x.id} className={`inset rounded-2xl p-3 ${x.val >= x.goal ? '' : 'opacity-60'}`}>
              <span className={`text-2xl ${x.val >= x.goal ? '' : 'grayscale'}`}>{x.emoji}</span>
              <b className="block text-sm">{x.name}</b><span className="text-[11px] text-mute">{x.desc}</span>
              {x.val < x.goal && <Bar p={(x.val / x.goal) * 100} />}
            </div>
          ))}
        </div>
      </div>
      {gear.length > 0 && (
        <div className="card rounded-2xl p-4">
          <b>Gear mileage</b>
          {gear.map(g => <div key={g.name} className="mt-2 flex justify-between text-sm"><span>{g.name} <span className="text-xs text-mute">· {g.n} activities</span></span><b className="text-accent">{dist(g.m, units)}</b></div>)}
        </div>
      )}
    </div>
  )
}

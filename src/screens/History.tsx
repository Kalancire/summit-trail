import { useState } from 'react'
import { motion } from 'motion/react'
import { ChevronLeft, ChevronRight, Play } from 'lucide-react'
import { dateLine, dist, hms, pace, sameDay, title, trimEnds, type Rec } from '../lib/core'
import { useSettings } from '../lib/store'
import { RoutePreview } from '../components/charts'

export default function History({ recs, onOpen }: { recs: Rec[]; onOpen: (r: Rec) => void }) {
  const { units, hideEnds } = useSettings()
  const [m, setM] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1) })
  const [sel, setSel] = useState<number | null>(null)
  const pad = m.getDay(), n = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate()
  const cells = Array.from({ length: pad + n }, (_, i) => (i < pad ? null : new Date(m.getFullYear(), m.getMonth(), i - pad + 1).getTime()))
  const list = recs.filter(r => (sel ? sameDay(r.ts, sel) : new Date(r.ts).getMonth() === m.getMonth() && new Date(r.ts).getFullYear() === m.getFullYear()))
  const step = (d: number) => { setM(new Date(m.getFullYear(), m.getMonth() + d, 1)); setSel(null) }

  return (
    <div className="mx-auto max-w-md px-5 pb-36 safe-top">
      <h1 className="mb-4 text-3xl font-bold">History</h1>
      <div className="card rounded-[2rem] p-5">
        <div className="mb-3 flex items-center justify-between">
          <button onClick={() => step(-1)}><ChevronLeft /></button>
          <b>{m.toLocaleDateString([], { month: 'long', year: 'numeric' })}</b>
          <button onClick={() => step(1)}><ChevronRight /></button>
        </div>
        <div className="grid grid-cols-7 gap-y-1 text-center text-xs text-mute">{'SMTWTFS'.split('').map((c, i) => <span key={i}>{c}</span>)}</div>
        <div className="mt-1 grid grid-cols-7 gap-y-1">
          {cells.map((d, i) => {
            if (!d) return <span key={i} />
            const has = recs.some(r => sameDay(r.ts, d)), on = sel !== null && sameDay(d, sel)
            return (
              <button key={i} onClick={() => setSel(on ? null : d)}
                className={`mx-auto grid size-9 place-items-center rounded-full text-sm ${on ? 'grad font-bold text-white' : has ? 'bg-accent/20 font-bold text-accent' : ''}`}>
                {new Date(d).getDate()}
              </button>
            )
          })}
        </div>
      </div>
      <div className="mt-5">
        {list.length === 0 && <p className="py-8 text-center text-mute">No activities here yet.</p>}
        {list.map(r => (
          <motion.button key={r.id} whileTap={{ scale: 0.98 }} onClick={() => onOpen(r)} className="card mb-3 flex w-full items-center gap-4 rounded-2xl p-3 text-left">
            <span className="inset h-16 w-20 shrink-0 rounded-xl p-1.5"><RoutePreview route={trimEnds(r.route, hideEnds)} /></span>
            <span className="min-w-0 flex-1">
              <b className="block text-sm">{title(r)}</b>
              <span className="block text-xs text-mute">{dateLine(r)}</span>
              <span className="mt-1 block text-xs"><b className="text-accent">{dist(r.distM, units)}</b> · {hms(r.secs)} · {pace(r.distM, r.secs, units)}/{units}</span>
            </span>
            <span className="grid size-10 place-items-center rounded-full bg-accent/15 text-accent"><Play className="size-4 fill-accent" /></span>
          </motion.button>
        ))}
      </div>
    </div>
  )
}

import type { Pt } from '../lib/core'

export function WeekBars({ vals, prev, sel, onSel }: { vals: number[]; prev: number[]; sel: number; onSel: (i: number) => void }) {
  const mx = Math.max(...vals, ...prev, 0.1)
  const h = (v: number) => 5 + 78 * (v / mx)
  return (
    <div className="flex h-32 items-end justify-around">
      {vals.map((v, i) => (
        <button key={i} onClick={() => onSel(i)} className="flex h-full w-8 flex-col items-center justify-end gap-2">
          <div className="flex items-end gap-[3px]">
            <i className={`w-[3px] rounded-full transition-all duration-500 ${prev[i] > 0 ? 'bg-accent/40' : 'bg-mute/25'}`} style={{ height: h(prev[i]) }} />
            <i className={`w-[3px] rounded-full transition-all duration-500 ${v > 0 ? 'bg-accent' : 'bg-mute/25'}`} style={{ height: h(v) }} />
          </div>
          <span className={`text-[11px] font-bold ${i === sel ? 'text-accent' : 'text-ink'}`}>{'SMTWTFS'[i]}</span>
        </button>
      ))}
    </div>
  )
}

export function Ruler({ value, unit }: { value: number; unit: string }) {
  const S = 52 // px per unit
  const ks = Array.from({ length: 41 }, (_, i) => Math.floor(value * 2) - 20 + i).filter(k => k >= 0)
  return (
    <div className="inset rounded-2xl px-4 pt-4 pb-3 text-center">
      <p className="text-xs text-mute">This week</p>
      <p className="flex items-baseline justify-center gap-1"><b className="text-5xl text-accent">{value.toFixed(1)}</b><span className="text-sm font-bold">{unit}</span></p>
      <div className="relative mt-3 h-12 overflow-hidden" style={{ maskImage: 'linear-gradient(90deg, transparent, #000 18%, #000 82%, transparent)' }}>
        {ks.map(k => {
          const v = k / 2, whole = k % 2 === 0
          return (
            <div key={k} className="absolute top-0 flex -translate-x-1/2 flex-col items-center gap-1 transition-all duration-500" style={{ left: `calc(50% + ${(v - value) * S}px)` }}>
              {whole && <span className="text-[11px] font-bold">{v}</span>}
              <i className={`w-px bg-mute ${whole ? 'h-5' : 'h-3'} ${whole ? '' : 'mt-[17px]'}`} />
            </div>
          )
        })}
        <i className="absolute bottom-0 left-1/2 h-7 w-0.5 -translate-x-1/2 rounded bg-accent" />
      </div>
    </div>
  )
}

export function Elevation({ route }: { route: Pt[] }) {
  const step = Math.max(1, Math.floor(route.length / 120))
  const a = route.filter((_, i) => i % step === 0).map(p => p.alt)
  const lo = Math.min(...a), hi = Math.max(...a)
  if (a.length < 2 || hi - lo < 1) return null
  const pts = a.map((v, i) => `${(i / (a.length - 1)) * 300},${90 - ((v - lo) / (hi - lo)) * 70}`)
  return (
    <svg viewBox="0 0 300 100" className="h-28 w-full">
      <defs><linearGradient id="eg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="var(--accent)" stopOpacity=".35" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
      </linearGradient></defs>
      <polygon points={`0,100 ${pts.join(' ')} 300,100`} fill="url(#eg)" />
      <polyline points={pts.join(' ')} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  )
}

export function RoutePreview({ route }: { route: Pt[] }) {
  if (route.length < 2) return null
  const k = Math.cos((route[0].lat * Math.PI) / 180)
  const xs = route.map(p => p.lng * k), ys = route.map(p => -p.lat)
  const minX = Math.min(...xs), minY = Math.min(...ys)
  const w = Math.max(...xs) - minX || 1e-6, h = Math.max(...ys) - minY || 1e-6
  const s = Math.min(180 / w, 80 / h), ox = (200 - w * s) / 2, oy = (100 - h * s) / 2
  const d = route.map((_, i) => `${i ? 'L' : 'M'}${(ox + (xs[i] - minX) * s).toFixed(1)} ${(oy + (ys[i] - minY) * s).toFixed(1)}`).join('')
  return (
    <svg viewBox="0 0 200 100" className="h-full w-full">
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

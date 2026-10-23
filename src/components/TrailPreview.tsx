import type { Pt, Wp } from '../lib/core'
import { WP_EMOJI } from '../lib/core'

// light "map preview": the trail's shape drawn from its points (no map tiles, so a long list stays fast and works offline)
export default function TrailPreview({ route, wps = [], className = '' }: { route: Pt[]; wps?: Wp[]; className?: string }) {
  if (route.length < 2) return <div className={`inset ${className}`} />
  const all = [...route.map(p => [p.lng, p.lat]), ...wps.map(w => [w.lng, w.lat])]
  const kx = Math.cos((route[0].lat * Math.PI) / 180)
  const xs = all.map(a => a[0] * kx), ys = all.map(a => -a[1])
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
  const W = 200, H = 130, pad = 14, s = Math.min((W - 2 * pad) / (x1 - x0 || 1e-9), (H - 2 * pad) / (y1 - y0 || 1e-9))
  const ox = (W - (x1 - x0) * s) / 2, oy = (H - (y1 - y0) * s) / 2
  const P = (lng: number, lat: number) => [ox + (lng * kx - x0) * s, oy + (-lat - y0) * s]
  const step = Math.max(1, Math.floor(route.length / 150))
  const d = route.filter((_, i) => i % step === 0 || i === route.length - 1).map((p, i) => P(p.lng, p.lat).map(n => n.toFixed(1)).join(i ? ' ' : ' ')).map((s2, i) => (i ? 'L' : 'M') + s2).join('')
  const a = P(route[0].lng, route[0].lat), b = P(route[route.length - 1].lng, route[route.length - 1].lat)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`inset ${className}`} preserveAspectRatio="xMidYMid meet">
      <path d={d} fill="none" stroke="#000" strokeOpacity=".5" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={a[0]} cy={a[1]} r="5" fill="#18b87a" stroke="#fff" strokeWidth="2" />
      <circle cx={b[0]} cy={b[1]} r="5" fill="#ef4444" stroke="#fff" strokeWidth="2" />
      {wps.map((w, i) => { const q = P(w.lng, w.lat); return <text key={i} x={q[0]} y={q[1] + 4} fontSize="11" textAnchor="middle">{WP_EMOJI[w.kind]}</text> })}
    </svg>
  )
}

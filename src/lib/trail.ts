import { calc, hav, type Diff, type Peak, type Pt, type Trail, type Wp } from './core'

// ---- geometry ----
const R = Math.PI / 180
export const cumDist = (r: Pt[]) => { const c = [0]; for (let i = 1; i < r.length; i++) c.push(c[i - 1] + hav(r[i - 1], r[i])); return c }
export function bearing(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const y = Math.sin((b.lng - a.lng) * R) * Math.cos(b.lat * R)
  const x = Math.cos(a.lat * R) * Math.sin(b.lat * R) - Math.sin(a.lat * R) * Math.cos(b.lat * R) * Math.cos((b.lng - a.lng) * R)
  return ((Math.atan2(y, x) / R) + 360) % 360
}
export const compass = (deg: number) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8]

/** Closest point of a path to p: distance off the path, and how far along it. Search can be limited to a window around a hint. */
export function nearestOn(route: Pt[], cum: number[], p: { lat: number; lng: number }, hint = -1, win = 80) {
  const from = hint < 0 ? 0 : Math.max(0, hint - win), to = hint < 0 ? route.length - 2 : Math.min(route.length - 2, hint + win)
  let best = { off: Infinity, idx: 0, along: 0 }
  const kx = Math.cos(p.lat * R) * 111320, ky = 110540
  for (let i = from; i <= to; i++) {
    const a = route[i], b = route[i + 1]
    const ax = (a.lng - p.lng) * kx, ay = (a.lat - p.lat) * ky, bx = (b.lng - p.lng) * kx, by = (b.lat - p.lat) * ky
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy
    const u = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0
    const off = Math.hypot(ax + u * dx, ay + u * dy)
    if (off < best.off) best = { off, idx: u > 0.5 ? i + 1 : i, along: cum[i] + u * (cum[i + 1] - cum[i]) }
  }
  return best
}

/** Keep roughly one point every `step` metres (and always the last one). */
export function thin(r: Pt[], step = 8): Pt[] {
  if (r.length < 3) return r
  const out = [r[0]]
  for (let i = 1; i < r.length - 1; i++) if (hav(out[out.length - 1], r[i]) >= step) out.push(r[i])
  out.push(r[r.length - 1]); return out
}
/** Add points along straight lines so a drawn trail has a point about every `step` metres. */
export function densify(r: Pt[], step = 60): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < r.length - 1; i++) {
    const a = r[i], b = r[i + 1], n = Math.max(1, Math.round(hav(a, b) / step))
    for (let k = 0; k < n; k++) { const f = k / n; out.push({ lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f, alt: a.alt + (b.alt - a.alt) * f, t: a.t }) }
  }
  if (r.length) out.push(r[r.length - 1]); return out
}
/** Ground elevation for drawn points (free Open-Meteo elevation service, 100 points per request). Returns null if offline. */
export async function withElevation(r: Pt[]): Promise<Pt[] | null> {
  try {
    const out: Pt[] = []
    for (let i = 0; i < r.length; i += 100) {
      const c = r.slice(i, i + 100)
      const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${c.map(p => p.lat.toFixed(5)).join(',')}&longitude=${c.map(p => p.lng.toFixed(5)).join(',')}`)
      if (!res.ok) return null
      const { elevation } = (await res.json()) as { elevation: number[] }
      c.forEach((p, k) => out.push({ ...p, alt: elevation[k] ?? 0 }))
    }
    return out
  } catch { return null }
}

// ---- stats ----
// Naismith's rule: 5 km/h on the flat plus 1 hour for every 600 m climbed
export const estimate = (distM: number, gain: number) => Math.round((distM / 5000 + gain / 600) * 3600)
const smooth = (r: Pt[]) => r.map((_, i) => { const w = r.slice(Math.max(0, i - 2), i + 3); return w.reduce((s, p) => s + p.alt, 0) / w.length })
export function trailStats(route: Pt[]) {
  const { d, g } = calc(route), alts = smooth(route.filter(p => p.alt !== 0))
  return { distM: d, gain: g, maxAlt: alts.length ? Math.max(...alts) : 0, estSecs: estimate(d, g) }
}
export const suggestDiff = (distM: number, gain: number): Diff => {
  const score = distM / 1000 + gain / 100
  return score < 6 ? 'easy' : score < 12 ? 'moderate' : 'hard'
}
export const DIFF_COLOR: Record<Diff, string> = { easy: '#18b87a', moderate: '#e8912d', hard: '#ef4444' }

/** Highest point of a hike, if the hike actually climbed (so a flat walk is not logged as a peak). */
export function peakOf(route: Pt[]): Peak | undefined {
  const pts = route.filter(p => p.alt !== 0)
  if (pts.length < 10) return
  const a = smooth(pts), hi = Math.max(...a), lo = Math.min(...a)
  if (hi - lo < 40) return
  const p = pts[a.indexOf(hi)]
  return { alt: Math.round(hi), lat: p.lat, lng: p.lng }
}

export function makeTrail(p: { name: string; route: Pt[]; wps: Wp[]; drawn?: boolean; cover?: string; desc?: string }): Trail {
  const route = p.drawn ? p.route : thin(p.route), s = trailStats(route)
  return { id: Date.now(), ts: Date.now(), name: p.name, diff: suggestDiff(s.distM, s.gain), desc: p.desc, cover: p.cover, route, wps: p.wps, drawn: p.drawn, ...s }
}

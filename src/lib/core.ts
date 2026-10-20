export type Pt = { lat: number; lng: number; alt: number; t: number }
export type Kind = 'hike' | 'run' | 'ride' | 'walk'
export const KIND_LABEL: Record<Kind, string> = { hike: 'Hike', run: 'Run', ride: 'Ride', walk: 'Walk' }
export type Cp = { lat: number; lng: number; t: number; photo?: string }
export type Rec = { id: number; ts: number; distM: number; secs: number; gain: number; route: Pt[]; cps?: Cp[]; type?: Kind; name?: string; note?: string; gear?: string }
export type Units = 'km' | 'mi'
export type Settings = { accent: number; units: Units; hideEnds: boolean; goalKm?: number; voice?: boolean; autoPause?: boolean }
export type Screen = 'home' | 'live' | 'summary' | 'history' | 'profile'

export const ACCENTS = ['#ff7a1a', '#4d7cff', '#18b87a', '#9b5cf6', '#ec4899']

export const hav = (a: Pt, b: Pt) => {
  const r = Math.PI / 180
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(x))
}
export function calc(p: Pt[]) {
  let d = 0, g = 0, base = p[0]?.alt ?? 0
  for (let i = 1; i < p.length; i++) {
    d += hav(p[i - 1], p[i])
    if (p[i].alt - base >= 3) { g += p[i].alt - base; base = p[i].alt }
    else if (p[i].alt < base) base = p[i].alt
  }
  return { d, g }
}
const per = (u: Units) => (u === 'km' ? 1000 : 1609.344)
export const dist = (m: number, u: Units) => `${(m / per(u)).toFixed(2)} ${u}`
export const hms = (s: number) =>
  [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map(n => String(n).padStart(2, '0')).join(':')
export function pace(m: number, s: number, u: Units) {
  if (m < 10) return '--:--'
  const t = Math.round(s / (m / per(u)))
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}
export const kcal = (m: number, g: number) => Math.round((m / 1000) * 65 + g * 0.6)
export const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString()
export function trimEnds(route: Pt[], on: boolean, cut = 150) {
  if (!on || route.length < 4) return route
  let d = 0, i = 0
  while (i < route.length - 1 && d < cut) { d += hav(route[i], route[i + 1]); i++ }
  let e = route.length - 1
  d = 0
  while (e > i && d < cut) { d += hav(route[e], route[e - 1]); e-- }
  return e > i ? route.slice(i, e + 1) : route
}
export const title = (r: Rec) => {
  if (r.name) return r.name
  const h = new Date(r.ts).getHours()
  return (h < 5 ? 'Night' : h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : h < 21 ? 'Evening' : 'Night') + ' ' + KIND_LABEL[r.type ?? 'hike']
}
export function splits(p: Pt[], u: Units) {
  const U = per(u), out: { n: number; secs: number; m: number }[] = []
  let d = 0, t0 = p[0]?.t ?? 0, next = U
  for (let i = 1; i < p.length; i++) {
    d += hav(p[i - 1], p[i])
    while (d >= next) { out.push({ n: out.length + 1, secs: Math.round((p[i].t - t0) / 1000), m: U }); t0 = p[i].t; next += U }
  }
  const rest = d - (next - U)
  if (rest > 50 && p.length > 1) out.push({ n: out.length + 1, secs: Math.round((p[p.length - 1].t - t0) / 1000), m: rest })
  return out
}
export const dateLine = (r: Rec) =>
  new Date(r.ts).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

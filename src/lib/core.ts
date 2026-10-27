export type Pt = { lat: number; lng: number; alt: number; t: number }
export type Kind = 'hike' | 'run' | 'ride' | 'walk'
export const KIND_LABEL: Record<Kind, string> = { hike: 'Hike', run: 'Run', ride: 'Ride', walk: 'Walk' }
export type WpKind = 'water' | 'view' | 'camp' | 'hazard'
export const WP_LABEL: Record<WpKind, string> = { water: 'Water', view: 'Viewpoint', camp: 'Campsite', hazard: 'Hazard' }
export const WP_EMOJI: Record<WpKind, string> = { water: '💧', view: '🌄', camp: '⛺', hazard: '⚠️' }
// a checkpoint is also a journal entry: a note, a photo and (optionally) a kind that turns it into a trail waypoint
export type Cp = { lat: number; lng: number; t: number; photo?: string; note?: string; kind?: WpKind }
export type Peak = { alt: number; lat: number; lng: number; name?: string }
export type Rec = { id: number; ts: number; distM: number; secs: number; gain: number; route: Pt[]; cps?: Cp[]; type?: Kind; name?: string; note?: string; gear?: string; peak?: Peak; trailId?: number; hrAvg?: number; hrMax?: number }
export type Diff = 'easy' | 'moderate' | 'hard'
export type Wp = { lat: number; lng: number; kind: WpKind; note?: string; photo?: string }
// a reusable trail: recorded from a hike or drawn on the map
export type Trail = { id: number; ts: number; name: string; diff: Diff; desc?: string; cover?: string; route: Pt[]; wps: Wp[]; distM: number; gain: number; maxAlt: number; estSecs: number; drawn?: boolean; code?: string }
export type Units = 'km' | 'mi'
export type Settings = { accent: number; units: Units; hideEnds: boolean; goalKm?: number; voice?: boolean; goalOn?: boolean; emName?: string; emPhone?: string; monthKm?: number; autoPause?: boolean; safety?: boolean; maxHr?: number }
export type Screen = 'home' | 'live' | 'summary' | 'history' | 'profile' | 'trails' | 'trail' | 'trailedit' | 'draw'

export const ACCENTS = ['#ff7a1a', '#4d7cff', '#18b87a', '#9b5cf6', '#ec4899']

export const hav = (a: Pt, b: Pt) => {
  const r = Math.PI / 180
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(x))
}
export function calc(p: Pt[]) {
  let d = 0, g = 0, base: number | null = null // alt 0 means "no altitude from GPS": skip it, or it looks like a huge climb
  for (let i = 0; i < p.length; i++) {
    if (i) d += hav(p[i - 1], p[i])
    const a = p[i].alt
    if (!a) continue
    if (base === null) base = a
    else if (a - base >= 3) { g += a - base; base = a }
    else if (a < base) base = a
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

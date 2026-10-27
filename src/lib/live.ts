import { calc, type Pt } from './core'
import { cloudOn, getLive, putLive } from './cloud'

// Live location sharing: the hiker writes one small document, anyone with the unguessable code can read it.
export type LiveDoc = { name: string; trail: string; lat: number; lng: number; alt: number; at: number; exp: number; distM: number; secs: number; done: boolean; r: number[] }
const ALPHA = 'abcdefghjkmnpqrstuvwxyz23456789'
let sess: { code: string; name: string; trail: string; last: number; lat: number; lng: number; doc?: LiveDoc } | null = null

export const liveOn = () => !!sess
export const startLive = (name: string, trail = '') => {
  const code = Array.from(crypto.getRandomValues(new Uint8Array(10)), b => ALPHA[b % ALPHA.length]).join('')
  sess = { code, name, trail, last: 0, lat: 0, lng: 0 }; return code
}
export const liveLink = (c: string) => `summittrail://live/${c}`
export const liveWeb = (c: string) => { const b = import.meta.env.VITE_WEB_URL as string | undefined; return b ? `${b.replace(/\/?$/, '/')}#live=${c}` : '' }

const flat = (r: Pt[]) => {
  const step = Math.max(1, Math.ceil(r.length / 300)), o: number[] = []
  r.forEach((p, i) => { if (i % step === 0 || i === r.length - 1) o.push(+p.lat.toFixed(5), +p.lng.toFixed(5)) })
  return o
}
export const livePts = (d: LiveDoc): Pt[] => Array.from({ length: Math.floor(d.r.length / 2) }, (_, i) => ({ lat: d.r[i * 2], lng: d.r[i * 2 + 1], alt: 0, t: 0 }))

/** called on every GPS fix; writes at most every 15 s while moving, 60 s while still */
export function pushLive(lat: number, lng: number, alt: number | null | undefined, more: () => { route: Pt[]; secs: number }) {
  const s = sess; if (!s || !cloudOn) return
  const now = Date.now(), moved = Math.hypot(lat - s.lat, lng - s.lng) > 0.00008
  if (now - s.last < (moved ? 15000 : 60000)) return
  s.last = now; s.lat = lat; s.lng = lng
  const { route, secs } = more()
  s.doc = { name: s.name, trail: s.trail, lat, lng, alt: Math.round(alt ?? 0), at: now, exp: now + 24 * 36e5, distM: Math.round(calc(route).d), secs, done: false, r: flat(route) }
  putLive(s.code, s.doc as unknown as Record<string, unknown>).catch(() => {})
}
export async function stopLive() {
  const s = sess; sess = null
  if (s?.doc && cloudOn) await putLive(s.code, { ...s.doc, done: true, at: Date.now(), exp: Date.now() + 36e5 }).catch(() => {})
}
export async function getLiveDoc(code: string): Promise<LiveDoc | null> {
  const d = (await getLive(code.toLowerCase())) as LiveDoc | null
  return d && d.exp > Date.now() ? d : null
}

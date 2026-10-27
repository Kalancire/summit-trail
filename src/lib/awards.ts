import type { Rec } from './core'
import { peakOf } from './trail'

export type Badge = { id: string; emoji: string; name: string; desc: string; val: number; goal: number }
const day = (t: number) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() }
const before = (t: number) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1).getTime() }

export function streaks(recs: Rec[]) {
  const days = [...new Set(recs.map(r => day(r.ts)))].sort((a, b) => a - b), set = new Set(days)
  let best = 0, run = 0, prev = 0
  for (const d of days) { run = prev && before(d) === prev ? run + 1 : 1; best = Math.max(best, run); prev = d }
  let cur = 0, t = day(Date.now()); if (!set.has(t)) t = before(t)
  while (set.has(t)) { cur++; t = before(t) }
  return { cur, best }
}
export function peakCount(recs: Rec[]) {
  const s = new Set<string>()
  recs.forEach(r => { const p = r.peak ?? peakOf(r.route); if (p) s.add(`${p.lat.toFixed(3)},${p.lng.toFixed(3)}`) })
  return s.size
}
export function badges(recs: Rec[]): Badge[] {
  const km = recs.reduce((s, r) => s + r.distM, 0) / 1000, up = recs.reduce((s, r) => s + r.gain, 0)
  const longest = Math.max(0, ...recs.map(r => r.distM)) / 1000, best = streaks(recs).best, pk = peakCount(recs)
  const photos = recs.reduce((s, r) => s + (r.cps?.filter(c => c.photo).length ?? 0), 0), trails = recs.filter(r => r.trailId).length
  const B = (id: string, emoji: string, name: string, desc: string, val: number, goal: number): Badge => ({ id, emoji, name, desc, val: Math.min(val, goal), goal })
  return [
    B('first', '👟', 'First steps', 'Record your first activity', recs.length, 1),
    B('d10', '🥾', '10 km club', '10 km in total', km, 10), B('d50', '🏃', '50 km club', '50 km in total', km, 50),
    B('d100', '🚶', '100 km club', '100 km in total', km, 100), B('d250', '🧭', '250 km club', '250 km in total', km, 250),
    B('l10', '🌄', 'Long day', 'One hike of 10 km or more', longest, 10), B('l21', '🏅', 'Half marathon', 'One hike of 21 km or more', longest, 21),
    B('c1', '⛰️', '1,000 m climbed', 'Total climb', up, 1000), B('c3', '🏔️', '3,000 m climbed', 'Total climb', up, 3000), B('c8', '🗻', 'Everest climb', '8,848 m climbed in total', up, 8848),
    B('p1', '🚩', 'Summiteer', 'Log your first peak', pk, 1), B('p5', '🏴', 'Peak collector', 'Log 5 different peaks', pk, 5),
    B('s3', '🔥', '3-day streak', 'Active 3 days in a row', best, 3), B('s7', '⚡', '7-day streak', 'Active 7 days in a row', best, 7), B('s14', '💎', '14-day streak', 'Active 14 days in a row', best, 14),
    B('t1', '🗺️', 'Trailblazer', 'Hike a saved trail', trails, 1), B('ph', '📷', 'Photographer', '10 checkpoint photos', photos, 10),
  ]
}
export function records(recs: Rec[]) {
  const top = (f: (r: Rec) => number, ok: (r: Rec) => boolean = () => true, min = false) =>
    recs.filter(ok).reduce<Rec | undefined>((a, r) => (!a || (min ? f(r) < f(a) : f(r) > f(a)) ? r : a), undefined)
  return {
    longest: top(r => r.distM), time: top(r => r.secs), climb: top(r => r.gain, r => r.gain > 0),
    fastest: top(r => r.secs / r.distM, r => r.distM > 1000 && r.secs > 0, true),
  }
}
export function gearMileage(recs: Rec[]) {
  const m = new Map<string, { name: string; m: number; n: number }>()
  recs.forEach(r => { const k = r.gear?.trim(); if (!k) return; const e = m.get(k.toLowerCase()) ?? { name: k, m: 0, n: 0 }; e.m += r.distM; e.n++; m.set(k.toLowerCase(), e) })
  return [...m.values()].sort((a, b) => b.m - a.m)
}

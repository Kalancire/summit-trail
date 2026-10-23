import type { Trail } from './core'
import { delTrailCloud, getSharedTrail, listTrailsCloud, putTrailCloud, shareTrailCloud } from './cloud'

const KEY = 'st.trails'
let cache: Trail[] | null = null
export const getTrails = () => (cache ??= (() => { try { return JSON.parse(localStorage.getItem(KEY) || '[]') as Trail[] } catch { return [] } })())
function save(list: Trail[]) {
  const all = [...list]; cache = all
  while (all.length) { try { localStorage.setItem(KEY, JSON.stringify(all)); return } catch { all.pop() } }
  localStorage.removeItem(KEY)
}
export const getTrail = (id: number) => getTrails().find(t => t.id === id)
export function addTrail(t: Trail) { save([t, ...getTrails()]); putTrailCloud(t).catch(console.warn) }
export function updateTrail(t: Trail) { save(getTrails().map(x => (x.id === t.id ? t : x))); putTrailCloud(t).catch(console.warn) }
export function delTrail(id: number) { save(getTrails().filter(t => t.id !== id)); delTrailCloud(id).catch(console.warn) }
export const resetTrails = () => { cache = [] }

/** Merge trails between this phone and the cloud account (called from the main sync). */
export async function syncTrails() {
  const remote = await listTrailsCloud(), local = getTrails()
  const haveR = new Set(remote.map(t => t.id)), haveL = new Map(local.map(t => [t.id, t]))
  // keep the phone's copy (it still has the photos); add trails that only exist in the cloud
  const merged = [...local, ...remote.filter(t => !haveL.has(t.id))].sort((a, b) => b.ts - a.ts)
  save(merged)
  await Promise.all(local.filter(t => !haveR.has(t.id)).map(putTrailCloud))
}

/** Publishes a copy of the trail and returns the link people can open. */
export async function shareLink(t: Trail) {
  const code = await shareTrailCloud(t)
  if (t.code !== code) updateTrail({ ...t, code })
  return { code, link: `summittrail://trail/${code}` }
}
export async function importTrail(code: string) {
  const c = code.trim().replace(/^.*trail\//i, '').toUpperCase()
  if (!/^[A-Z0-9]{8}$/.test(c)) throw new Error('That does not look like a trail code')
  const t = await getSharedTrail(c)
  if (!t) throw new Error('No trail found for that code')
  const mine: Trail = { ...t, id: Date.now(), ts: Date.now(), code: undefined }
  addTrail(mine); return mine
}

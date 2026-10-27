import { initializeApp } from 'firebase/app'
import { browserLocalPersistence, indexedDBLocalPersistence, initializeAuth, type Auth } from 'firebase/auth'
import { collection, deleteDoc, doc, getDoc, getDocs, initializeFirestore, query, setDoc, where, type Firestore, writeBatch } from 'firebase/firestore'
import type { Rec, Trail } from './core'

// accepts plain JSON or the JS-style block Firebase shows (unquoted keys, "const x =", trailing ;)
function parseCfg(raw?: string) {
  if (!raw) return null
  const m = raw.match(/\{[\s\S]*\}/); if (!m) return null
  const t = m[0].replace(/[\u201c\u201d]/g, '"').replace(/,\s*}/g, '}')
  try { return JSON.parse(t) } catch { /* try JS-style */ }
  try { return JSON.parse(t.replace(/'/g, '"').replace(/([{,]\s*)([A-Za-z_]\w*)\s*:/g, '$1"$2":')) } catch { return null }
}
let _auth: Auth | null = null, db: Firestore | null = null
try {
  const cfg = parseCfg(import.meta.env.VITE_FIREBASE_CONFIG as string | undefined)
  if (cfg) {
    const app = initializeApp(cfg)
    _auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] }) // safe in Android WebView
    db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true })
  }
} catch (e) { console.warn('Cloud sync disabled:', e); _auth = null; db = null }
export const auth = _auth
export const cloudOn = !!(_auth && db)

const uid = () => auth?.currentUser?.uid
// Firestore docs max 1 MB: store the route as a JSON string and thin it if huge
function pack(r: Rec) {
  let route = r.route, s = JSON.stringify(route)
  while (s.length > 850_000 && route.length > 2) { route = route.filter((_, i) => i % 2 === 0); s = JSON.stringify(route) }
  return { id: r.id, ts: r.ts, distM: r.distM, secs: r.secs, gain: r.gain, route: s, cps: JSON.stringify((r.cps ?? []).map(({ photo: _p, ...c }) => c)), meta: JSON.stringify({ type: r.type, name: r.name, note: r.note, gear: r.gear }) }
}
export async function putRec(r: Rec) { const u = uid(); if (u && db) await setDoc(doc(db, 'users', u, 'recs', String(r.id)), pack(r)) }
export async function delRecCloud(id: number) { const u = uid(); if (u && db) await deleteDoc(doc(db, 'users', u, 'recs', String(id))) }
export async function clearCloud() {
  const u = uid(); if (!u || !db) return
  const snap = await getDocs(collection(db, 'users', u, 'recs'))
  const b = writeBatch(db); snap.forEach(d => b.delete(d.ref)); await b.commit()
}
export async function deleteProfileCloud() { const u = uid(); if (u && db) await deleteDoc(doc(db, 'users', u)) }
export async function listRecs(): Promise<Rec[]> {
  const u = uid(); if (!u || !db) return []
  const snap = await getDocs(collection(db, 'users', u, 'recs'))
  return snap.docs.map(d => { const x = d.data(); return { id: x.id, ts: x.ts, distM: x.distM, secs: x.secs, gain: x.gain, route: JSON.parse(x.route), cps: x.cps ? JSON.parse(x.cps) : [], ...(x.meta ? JSON.parse(x.meta) : {}) } as Rec })
}
export async function getProfile() {
  const u = uid(); if (!u || !db) return null
  return (await getDoc(doc(db, 'users', u))).data() as { name?: string; email?: string; photo?: string } | undefined ?? null
}
export async function setProfile(p: Record<string, unknown>) { const u = uid(); if (u && db) await setDoc(doc(db, 'users', u), p, { merge: true }) }

// ---- trails (saved routes) ----
// photos stay on the phone, except the cover (small) so a trail looks right on another device
function packTrail(t: Trail) {
  let route = t.route, s = JSON.stringify(route)
  while (s.length > 700_000 && route.length > 2) { route = route.filter((_, i) => i % 2 === 0); s = JSON.stringify(route) }
  const { cover, route: _r, wps, ...rest } = t
  return { ...rest, route: s, wps: JSON.stringify(wps.map(({ photo: _p, ...w }) => w)), ...(cover && cover.length < 120_000 ? { cover } : {}) }
}
function unpackTrail(x: Record<string, unknown>): Trail {
  return { ...(x as unknown as Trail), route: JSON.parse(x.route as string), wps: x.wps ? JSON.parse(x.wps as string) : [] }
}
export async function putTrailCloud(t: Trail) { const u = uid(); if (u && db) await setDoc(doc(db, 'users', u, 'trails', String(t.id)), packTrail(t)) }
export async function delTrailCloud(id: number) { const u = uid(); if (u && db) await deleteDoc(doc(db, 'users', u, 'trails', String(id))) }
export async function listTrailsCloud(): Promise<Trail[]> {
  const u = uid(); if (!u || !db) return []
  return (await getDocs(collection(db, 'users', u, 'trails'))).docs.map(d => unpackTrail(d.data()))
}
// removes this person's trails and any trail links they shared (used when deleting the account)
export async function clearTrailsCloud() {
  const u = uid(); if (!u || !db) return
  const mine = await getDocs(collection(db, 'users', u, 'trails'))
  const shared = await getDocs(query(collection(db, 'sharedTrails'), where('owner', '==', u)))
  const b = writeBatch(db); mine.forEach(d => b.delete(d.ref)); shared.forEach(d => b.delete(d.ref)); await b.commit()
}
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export async function shareTrailCloud(t: Trail) {
  const u = uid(); if (!u || !db) throw new Error('Sign in with internet to share a link')
  const code = t.code ?? Array.from(crypto.getRandomValues(new Uint8Array(8)), n => ALPHA[n % ALPHA.length]).join('')
  await setDoc(doc(db, 'sharedTrails', code), { ...packTrail(t), owner: u, code })
  return code
}
export async function getSharedTrail(code: string): Promise<Trail | null> {
  if (!db) throw new Error('Cloud is not set up in this build')
  const d = await getDoc(doc(db, 'sharedTrails', code.trim().toUpperCase()))
  return d.exists() ? unpackTrail(d.data()) : null
}

// live location sharing: one small public-by-code document (see LIVE-SHARING.md for the Firestore rule)
export async function putLive(code: string, data: Record<string, unknown>) { const u = uid(); if (u && db) await setDoc(doc(db, 'live', code), { ...data, owner: u }) }
export async function getLive(code: string) { if (!db) return null; const s = await getDoc(doc(db, 'live', code)); return s.exists() ? s.data() : null }

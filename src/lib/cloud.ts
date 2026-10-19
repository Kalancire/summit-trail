import { initializeApp } from 'firebase/app'
import { browserLocalPersistence, indexedDBLocalPersistence, initializeAuth, type Auth } from 'firebase/auth'
import { collection, deleteDoc, doc, getDoc, getDocs, initializeFirestore, setDoc, type Firestore, writeBatch } from 'firebase/firestore'
import type { Rec } from './core'

let _auth: Auth | null = null, db: Firestore | null = null
try {
  const cfg = JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG || 'null')
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
  return { id: r.id, ts: r.ts, distM: r.distM, secs: r.secs, gain: r.gain, route: s }
}
export async function putRec(r: Rec) { const u = uid(); if (u && db) await setDoc(doc(db, 'users', u, 'recs', String(r.id)), pack(r)) }
export async function delRecCloud(id: number) { const u = uid(); if (u && db) await deleteDoc(doc(db, 'users', u, 'recs', String(id))) }
export async function clearCloud() {
  const u = uid(); if (!u || !db) return
  const snap = await getDocs(collection(db, 'users', u, 'recs'))
  const b = writeBatch(db); snap.forEach(d => b.delete(d.ref)); await b.commit()
}
export async function listRecs(): Promise<Rec[]> {
  const u = uid(); if (!u || !db) return []
  const snap = await getDocs(collection(db, 'users', u, 'recs'))
  return snap.docs.map(d => { const x = d.data(); return { id: x.id, ts: x.ts, distM: x.distM, secs: x.secs, gain: x.gain, route: JSON.parse(x.route) } as Rec })
}
export async function getProfile() {
  const u = uid(); if (!u || !db) return null
  return (await getDoc(doc(db, 'users', u))).data() as { name?: string; email?: string; photo?: string } | undefined ?? null
}
export async function setProfile(p: Record<string, unknown>) { const u = uid(); if (u && db) await setDoc(doc(db, 'users', u), p, { merge: true }) }

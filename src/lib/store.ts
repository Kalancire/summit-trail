import { useSyncExternalStore } from 'react'
import { EmailAuthProvider, createUserWithEmailAndPassword, deleteUser, reauthenticateWithCredential, signInWithEmailAndPassword, signOut as fbOut } from 'firebase/auth'
import { ACCENTS, type Rec, type Settings } from './core'
import { auth, clearCloud, clearTrailsCloud, cloudOn, delRecCloud, deleteProfileCloud, getProfile, listRecs, putRec, setProfile } from './cloud'
import { clearTiles } from './tilecache'
import { resetTrails, syncTrails } from './trailstore'

function read<T>(k: string, d: T): T {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d } catch { return d }
}
const write = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v))

// ---- settings ----
const listeners = new Set<() => void>()
let settings: Settings = { accent: 0, units: 'km', hideEnds: false, ...read<Partial<Settings>>('st.settings', {}) }
export const getSettings = () => settings
export const applyTheme = () =>
  document.documentElement.style.setProperty('--accent', ACCENTS[settings.accent] ?? ACCENTS[0])
export function setSettings(p: Partial<Settings>) {
  settings = { ...settings, ...p }
  write('st.settings', settings); applyTheme(); listeners.forEach(f => f())
}
export const useSettings = () =>
  useSyncExternalStore(cb => { listeners.add(cb); return () => { listeners.delete(cb) } }, getSettings)

// ---- activities (up to 100, on this phone) ----
// in-memory cache so screens don't re-parse localStorage on every render
let recCache: Rec[] | null = null
export const getRecs = () => (recCache ??= read<Rec[]>('st.recs', []))
function saveRecs(list: Rec[]) {
  const all = list.slice(0, 100)
  recCache = all
  while (all.length) { try { write('st.recs', all); return } catch { all.pop() } }
  localStorage.removeItem('st.recs')
}
// ask the OS not to evict our storage, and re-sync unsent hikes as soon as internet is back
navigator.storage?.persist?.().catch(() => {})
window.addEventListener('online', () => { syncAll().catch(() => {}) })
// draft of the recording in progress (survives the app being killed in the background)
export type Draft = { pts: unknown[]; cps: unknown[]; acc: number; at: number; due?: number; trailId?: number; asTrail?: boolean }
export const getDraft = () => { const d = read<Draft | null>('st.draft', null); return d && Date.now() - d.at < 864e5 ? d : null }
export const saveDraft = (d: Draft) => { try { write('st.draft', d) } catch { /* storage full */ } }
export const clearDraft = () => localStorage.removeItem('st.draft')
export function addRec(r: Rec) { saveRecs([r, ...getRecs()]); putRec(r).catch(console.warn) }
export function updateRec(r: Rec) { saveRecs(getRecs().map(x => (x.id === r.id ? r : x))); putRec(r).catch(console.warn) }
export function delRec(id: number) { saveRecs(getRecs().filter(r => r.id !== id)); delRecCloud(id).catch(console.warn) }
export function clearRecs() { recCache = []; localStorage.removeItem('st.recs'); clearCloud().catch(console.warn) }

// ---- local account ----
type User = { name: string; email: string; hash: string; photo?: string; verified?: boolean }
const sha = async (s: string) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('st:' + s)))]
    .map(b => b.toString(16).padStart(2, '0')).join('')
export const getUser = () => read<User | null>('st.user', null)
export const signedIn = () => localStorage.getItem('st.session') === '1' && !!getUser()
type Pending = { name: string; email: string; code: string; exp: number; tries: number; sent: number }
const env = import.meta.env
async function mail(to: string, name: string, otp: string) {
  if (!env.VITE_EMAILJS_SERVICE || !env.VITE_EMAILJS_TEMPLATE || !env.VITE_EMAILJS_KEY) {
    if (env.DEV) { console.info('OTP (dev only):', otp); return }
    throw new Error('Email service is not set up in this build')
  }
  // several aliases so EmailJS gallery templates ({{email}}, {{passcode}}, ...) work without editing
  const template_params = { to_email: to, email: to, user_email: to, reply_to: to, name, user_name: name, otp, passcode: otp, code: otp, time: '10 minutes' }
  let r: Response
  try {
    r = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service_id: env.VITE_EMAILJS_SERVICE, template_id: env.VITE_EMAILJS_TEMPLATE, user_id: env.VITE_EMAILJS_KEY, template_params }),
    })
  } catch { throw new Error('No internet connection. Try again.') }
  if (!r.ok) throw new Error(`Email failed (${r.status}): ${(await r.text()).slice(0, 140)}`)
}
const pending = () => read<Pending | null>('st.pending', null)
export async function sendOtp(name: string, email: string) {
  const e = email.trim().toLowerCase()
  if (!name.trim()) throw new Error('Enter your name first')
  if (!/^\S+@\S+\.\S+$/.test(e)) throw new Error('Enter a valid email')
  const p = pending()
  if (p && p.email === e && Date.now() - p.sent < 60000) throw new Error('Wait a minute before asking for another code')
  const otp = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0')
  await mail(e, name.trim(), otp)
  write('st.pending', { name: name.trim(), email: e, code: await sha(otp), exp: Date.now() + 10 * 60000, tries: 0, sent: Date.now() } satisfies Pending)
}
export async function register(name: string, email: string, pw: string, code: string) {
  const e = email.trim().toLowerCase()
  if (!name.trim()) throw new Error('Enter your name')
  if (!/^\S+@\S+\.\S+$/.test(e)) throw new Error('Enter a valid email')
  if (pw.length < 6) throw new Error('Password needs at least 6 characters')
  const p = pending()
  if (!p || p.email !== e) throw new Error('Tap "Send code" to verify this email first')
  if (Date.now() > p.exp) throw new Error('Code expired. Tap "Resend"')
  if (p.tries >= 5) throw new Error('Too many wrong codes. Tap "Resend"')
  if ((await sha(code.trim())) !== p.code) { write('st.pending', { ...p, tries: p.tries + 1 }); throw new Error('Wrong code') }
  if (cloudOn && auth) {
    try { await createUserWithEmailAndPassword(auth, e, pw) } catch (x) { throw new Error(fbErr(x)) }
    await setProfile({ name: name.trim(), email: e }).catch(console.warn)
  }
  write('st.user', { name: name.trim(), email: e, hash: await sha(pw), verified: true })
  localStorage.removeItem('st.pending'); localStorage.setItem('st.session', '1')
}
export function setPhoto(photo: string) {
  const u = getUser(); if (u) write('st.user', { ...u, photo })
  setProfile({ photo }).catch(console.warn)
}
const fbErr = (e: unknown) => {
  const c = (e as { code?: string }).code ?? ''
  if (c === 'auth/email-already-in-use') return 'This email already has an account. Sign in instead.'
  if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'].includes(c)) return 'Wrong email or password'
  if (c === 'auth/network-request-failed') return 'No internet connection'
  if (c === 'auth/operation-not-allowed') return 'Turn on Email/Password in Firebase Authentication'
  if (c === 'auth/too-many-requests') return 'Too many tries. Wait a bit and try again.'
  return (e as Error).message
}
// two-way merge between this phone and the cloud account
export async function syncAll() {
  if (!cloudOn || !auth) return
  await auth.authStateReady()
  if (!auth.currentUser) return
  const [remote, prof] = await Promise.all([listRecs(), getProfile()])
  const local = getRecs(), have = new Set(remote.map(r => r.id)), missing = local.filter(r => !have.has(r.id))
  saveRecs([...remote, ...missing].sort((x, y) => y.ts - x.ts))
  await Promise.all(missing.map(putRec))
  await syncTrails().catch(console.warn)
  const u = getUser()
  if (u) write('st.user', { ...u, name: prof?.name || u.name, photo: prof?.photo || u.photo })
  if (u?.photo && !prof?.photo) await setProfile({ photo: u.photo })
}
export async function signIn(email: string, pw: string) {
  const e = email.trim().toLowerCase()
  if (cloudOn && auth) {
    try { await signInWithEmailAndPassword(auth, e, pw) } catch (x) {
      if ((x as { code?: string }).code === 'auth/network-request-failed') {
        const lu = getUser()
        if (lu && lu.email === e && lu.hash && lu.hash === (await sha(pw))) { localStorage.setItem('st.session', '1'); return } // offline sign-in on a known phone
        throw new Error('You are offline. Connect to the internet once to sign in on this phone.')
      }
      throw new Error(fbErr(x))
    }
    const u = getUser(), hash = await sha(pw)
    if (!u || u.email !== e) { localStorage.removeItem('st.recs'); localStorage.removeItem('st.trails'); resetTrails() }
    write('st.user', u && u.email === e ? { ...u, hash } : { name: e.split('@')[0], email: e, hash, verified: true })
    localStorage.setItem('st.session', '1')
    await syncAll().catch(console.warn)
    return
  }
  const u = getUser()
  if (!u || u.email !== e || u.hash !== (await sha(pw))) throw new Error('Wrong email or password')
  localStorage.setItem('st.session', '1')
}
export async function signOut() {
  if (cloudOn && auth && navigator.onLine) {
    await syncAll().catch(console.warn) // push anything unsaved before clearing this phone
    await fbOut(auth).catch(() => {})
    localStorage.removeItem('st.recs'); localStorage.removeItem('st.user'); localStorage.removeItem('st.trails'); resetTrails()
  }
  localStorage.removeItem('st.session')
}

// Permanently deletes the account: cloud activities, cloud profile, the sign-in itself, and everything saved on this phone.
// Apple requires this option inside any app that has sign-in.
export async function deleteAccount(pw: string) {
  const u = getUser(); if (!u) return
  if (cloudOn && auth) {
    if (!navigator.onLine) throw new Error('Connect to the internet to delete your account.')
    await auth.authStateReady()
    const cu = auth.currentUser
    if (cu) {
      try { await reauthenticateWithCredential(cu, EmailAuthProvider.credential(u.email, pw)) } catch (x) { throw new Error(fbErr(x)) }
      await clearCloud().catch(console.warn)
      await clearTrailsCloud().catch(console.warn)
      await deleteProfileCloud().catch(console.warn)
      try { await deleteUser(cu) } catch (x) { throw new Error(fbErr(x)) }
    } else if (u.hash !== (await sha(pw))) throw new Error('Wrong email or password')
  } else if (u.hash !== (await sha(pw))) throw new Error('Wrong email or password')
  recCache = []; resetTrails()
  Object.keys(localStorage).filter(k => k.startsWith('st.')).forEach(k => localStorage.removeItem(k))
  await clearTiles().catch(() => {})
}

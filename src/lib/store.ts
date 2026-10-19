import { useSyncExternalStore } from 'react'
import { ACCENTS, type Rec, type Settings } from './core'

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
export const getRecs = () => read<Rec[]>('st.recs', [])
export function addRec(r: Rec) {
  const all = [r, ...getRecs()].slice(0, 100)
  while (all.length) { try { write('st.recs', all); return } catch { all.pop() } }
}
export const delRec = (id: number) => write('st.recs', getRecs().filter(r => r.id !== id))
export const clearRecs = () => localStorage.removeItem('st.recs')

// ---- local account ----
type User = { name: string; email: string; hash: string; photo?: string; verified?: boolean }
const sha = async (s: string) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('st:' + s)))]
    .map(b => b.toString(16).padStart(2, '0')).join('')
export const getUser = () => read<User | null>('st.user', null)
export const signedIn = () => localStorage.getItem('st.session') === '1' && !!getUser()
type Pending = { name: string; email: string; hash: string; code: string; exp: number; tries: number; sent: number }
const env = import.meta.env
async function mail(to: string, name: string, otp: string) {
  if (!env.VITE_EMAILJS_SERVICE || !env.VITE_EMAILJS_TEMPLATE || !env.VITE_EMAILJS_KEY) {
    if (env.DEV) { console.info('OTP (dev only):', otp); return }
    throw new Error('Email service is not set up')
  }
  const r = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ service_id: env.VITE_EMAILJS_SERVICE, template_id: env.VITE_EMAILJS_TEMPLATE, user_id: env.VITE_EMAILJS_KEY, template_params: { to_email: to, name, otp } }),
  })
  if (!r.ok) throw new Error('Could not send the code. Check the email address.')
}
async function issue(p: { name: string; email: string; hash: string }) {
  const otp = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0')
  await mail(p.email, p.name, otp)
  write('st.pending', { name: p.name, email: p.email, hash: p.hash, code: await sha(otp), exp: Date.now() + 10 * 60000, tries: 0, sent: Date.now() } satisfies Pending)
}
const pending = () => read<Pending | null>('st.pending', null)
export const pendingEmail = () => pending()?.email ?? null
export const cancelSignUp = () => localStorage.removeItem('st.pending')
export async function signUp(name: string, email: string, pw: string) {
  if (!name.trim()) throw new Error('Enter your name')
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) throw new Error('Enter a valid email')
  if (pw.length < 6) throw new Error('Password needs at least 6 characters')
  await issue({ name: name.trim(), email: email.trim().toLowerCase(), hash: await sha(pw) })
}
export async function resendOtp() {
  const p = pending()
  if (!p) throw new Error('Start sign-up again')
  if (Date.now() - p.sent < 60000) throw new Error('Wait a minute before asking for another code')
  await issue(p)
}
export async function verifyOtp(code: string) {
  const p = pending()
  if (!p) throw new Error('Start sign-up again')
  if (Date.now() > p.exp) throw new Error('Code expired. Request a new one')
  if (p.tries >= 5) throw new Error('Too many attempts. Request a new code')
  if ((await sha(code.trim())) !== p.code) { write('st.pending', { ...p, tries: p.tries + 1 }); throw new Error('Wrong code') }
  write('st.user', { name: p.name, email: p.email, hash: p.hash, verified: true })
  localStorage.removeItem('st.pending'); localStorage.setItem('st.session', '1')
}
export function setPhoto(photo: string) { const u = getUser(); if (u) write('st.user', { ...u, photo }) }
export async function signIn(email: string, pw: string) {
  const u = getUser()
  if (!u || u.email !== email.trim().toLowerCase() || u.hash !== (await sha(pw))) throw new Error('Wrong email or password')
  localStorage.setItem('st.session', '1')
}
export const signOut = () => localStorage.removeItem('st.session')

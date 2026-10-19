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

// ---- activities (last 30, on this phone) ----
export const getRecs = () => read<Rec[]>('st.recs', [])
export const addRec = (r: Rec) => write('st.recs', [r, ...getRecs()].slice(0, 30))
export const delRec = (id: number) => write('st.recs', getRecs().filter(r => r.id !== id))
export const clearRecs = () => localStorage.removeItem('st.recs')

// ---- local account ----
type User = { name: string; email: string; hash: string }
const sha = async (s: string) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('st:' + s)))]
    .map(b => b.toString(16).padStart(2, '0')).join('')
export const getUser = () => read<User | null>('st.user', null)
export const signedIn = () => localStorage.getItem('st.session') === '1' && !!getUser()
export async function signUp(name: string, email: string, pw: string) {
  if (!name.trim()) throw new Error('Enter your name')
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) throw new Error('Enter a valid email')
  if (pw.length < 6) throw new Error('Password needs at least 6 characters')
  write('st.user', { name: name.trim(), email: email.trim().toLowerCase(), hash: await sha(pw) })
  localStorage.setItem('st.session', '1')
}
export async function signIn(email: string, pw: string) {
  const u = getUser()
  if (!u || u.email !== email.trim().toLowerCase() || u.hash !== (await sha(pw))) throw new Error('Wrong email or password')
  localStorage.setItem('st.session', '1')
}
export const signOut = () => localStorage.removeItem('st.session')

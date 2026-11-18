import { useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { toAvatar } from '../lib/image'
import { Legal } from './Auth'
import { ACCENTS } from '../lib/core'
import { clearRecs, deleteAccount, getUser, pendingCount, setPhoto, setSettings, syncAll, syncInfo, useSettings } from '../lib/store'
import { cloudOn } from '../lib/cloud'
import { Btn } from '../components/ui'

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between py-3"><span>{label}</span>{children}</div>
)

const Sw = ({ on, set }: { on: boolean; set: (v: boolean) => void }) => (
  <button onClick={() => set(!on)} className={`inset flex h-8 w-14 items-center rounded-full p-1 ${on ? 'justify-end' : ''}`}><span className={`size-6 rounded-full ${on ? 'grad' : 'bg-mute'}`} /></button>
)

export default function Profile({ onSignOut, onCleared, onLive }: { onSignOut: () => void; onCleared: () => void; onLive: (code: string) => void }) {
  const s = useSettings(), u = getUser()
  const [terms, setTerms] = useState(false), [bk, setBk] = useState(''), [, bump] = useState(0), [err, setErr] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const [del, setDel] = useState(false), [pw, setPw] = useState(''), [busy, setBusy] = useState(false), [delErr, setDelErr] = useState('')
  const closeDel = () => { if (!busy) { setDel(false); setPw(''); setDelErr('') } }
  const confirmDel = async () => {
    setBusy(true); setDelErr('')
    try { await deleteAccount(pw); onSignOut() } catch (e) { setDelErr((e as Error).message) } finally { setBusy(false) }
  }
  const pick = async (f?: File) => {
    if (!f) return
    try { setPhoto(await toAvatar(f)); setErr(''); bump(n => n + 1) } catch (e) { setErr((e as Error).message) }
  }
  return (
    <div>
      <div className="flex flex-col items-center gap-1 py-4">
        <button onClick={() => file.current?.click()} className="relative">
          {u?.photo ? <img src={u.photo} alt="" className="size-24 rounded-full object-cover ring-2 ring-accent/60" />
            : <span className="grad grid size-24 place-items-center rounded-full text-4xl font-bold text-white">{u?.name[0]?.toUpperCase()}</span>}
          <span className="card absolute bottom-0 right-0 grid size-8 place-items-center rounded-full"><Camera className="size-4 text-accent" /></span>
        </button>
        <input ref={file} type="file" accept="image/*" hidden onChange={e => { pick(e.target.files?.[0]); e.target.value = '' }} />
        {err && <p className="text-xs text-red-400">{err}</p>}
        <h1 className="mt-2 text-2xl font-bold">{u?.name}</h1><p className="text-sm text-mute">{u?.email}</p>
      </div>
      <div className="card divide-y divide-white/5 rounded-[2rem] px-5">
        <div className="py-3">
          <span>Emergency contact</span>
          <p className="text-xs text-mute">Gets your SOS and check-in messages (you tap Send in your messages app)</p>
          <input value={s.emName ?? ''} onChange={e => setSettings({ emName: e.target.value })} placeholder="Name" className="inset mt-2 h-11 w-full rounded-xl bg-transparent px-3 text-sm" />
          <input value={s.emPhone ?? ''} onChange={e => setSettings({ emPhone: e.target.value })} placeholder="Phone number" type="tel" inputMode="tel" autoComplete="off" className="inset mt-2 h-11 w-full rounded-xl bg-transparent px-3 text-sm" />
        </div>
        <button onClick={() => { const c = prompt("Enter the live code or link your friend shared")?.trim().match(/([a-z0-9]{10})\s*$/i); if (c) onLive(c[1].toLowerCase()) }} className="w-full py-3 text-left">Follow a hiker live</button>
      </div>
      {cloudOn && (
        <div className="card mt-6 rounded-2xl p-4">
          <b>Cloud backup</b>
          <p className="mt-1 text-xs text-mute">
            {syncInfo.last ? `Last backup ${new Date(syncInfo.last).toLocaleString()}` : 'Not backed up yet'}
            {pendingCount() ? ` · ${pendingCount()} waiting to upload` : ' · everything is saved'}
            {syncInfo.err ? ` · ${syncInfo.err}` : ''}
          </p>
          <p className="mt-1 text-xs text-mute">Activities, trails, photos, settings and your emergency contact come back when you sign in on a new phone or after a reinstall. Videos stay on the phone.</p>
          <Btn outline className="mt-3 w-full" onClick={() => { setBk('Backing up…'); syncAll().then(() => { setBk('Backed up ✓'); onCleared() }).catch(e => setBk(`Could not back up: ${(e as Error).message}`)) }}>Back up now</Btn>
          {bk && <p className="mt-2 text-center text-xs text-accent">{bk}</p>}
        </div>
      )}
      <div className="mt-6 space-y-3">
        <Btn outline onClick={onSignOut} className="w-full">Sign out</Btn>
        <button className="w-full py-2 text-sm text-red-400" onClick={() => { if (confirm('Delete all saved activities? This also removes them from your cloud account.')) { clearRecs(); onCleared() } }}>
          Delete all activities
        </button>
        <button className="w-full py-2 text-sm text-red-400" onClick={() => setDel(true)}>Delete my account</button>
      </div>
      {terms && <Legal onClose={() => setTerms(false)} />}
      {del && (
        <div onClick={closeDel} className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5">
          <div onClick={e => e.stopPropagation()} className="card w-full max-w-md rounded-3xl p-6">
            <h2 className="text-xl font-bold">Delete your account?</h2>
            <p className="mt-2 text-sm text-mute">This permanently deletes your account, your saved activities and your profile, on this phone and in the cloud. It cannot be undone.</p>
            <input type="password" autoComplete="current-password" placeholder="Enter your password to confirm" value={pw} onChange={e => setPw(e.target.value)}
              className="inset mt-4 h-12 w-full rounded-2xl px-4 outline-none" />
            {delErr && <p className="mt-2 text-xs text-red-400">{delErr}</p>}
            <div className="mt-5 flex gap-3">
              <Btn outline onClick={closeDel} disabled={busy} className="flex-1">Cancel</Btn>
              <Btn onClick={confirmDel} disabled={busy || !pw} className="flex-1">{busy ? 'Deleting…' : 'Delete'}</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

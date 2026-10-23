import { useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { toAvatar } from '../lib/image'
import { Legal } from './Auth'
import { ACCENTS } from '../lib/core'
import { clearRecs, deleteAccount, getUser, setPhoto, setSettings, useSettings } from '../lib/store'
import { Btn } from '../components/ui'

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between py-3"><span>{label}</span>{children}</div>
)

const Sw = ({ on, set }: { on: boolean; set: (v: boolean) => void }) => (
  <button onClick={() => set(!on)} className={`inset flex h-8 w-14 items-center rounded-full p-1 ${on ? 'justify-end' : ''}`}><span className={`size-6 rounded-full ${on ? 'grad' : 'bg-mute'}`} /></button>
)

export default function Profile({ onSignOut, onCleared }: { onSignOut: () => void; onCleared: () => void }) {
  const s = useSettings(), u = getUser()
  const [terms, setTerms] = useState(false), [, bump] = useState(0), [err, setErr] = useState('')
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
    <div className="mx-auto max-w-md px-5 pb-36 safe-top">
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
        <Row label="Accent">
          <div className="flex gap-2">
            {ACCENTS.map((c, i) => (
              <button key={c} onClick={() => setSettings({ accent: i })} style={{ background: c }}
                className={`size-8 rounded-full ${s.accent === i ? 'ring-2 ring-white ring-offset-2 ring-offset-surf' : ''}`} />
            ))}
          </div>
        </Row>
        <Row label="Units">
          <div className="inset flex rounded-full p-1">
            {(['km', 'mi'] as const).map(x => (
              <button key={x} onClick={() => setSettings({ units: x })}
                className={`rounded-full px-4 py-1 text-sm font-bold ${s.units === x ? 'grad text-white' : 'text-mute'}`}>{x}</button>
            ))}
          </div>
        </Row>
        <Row label="Hide start & end of routes">
          <button onClick={() => setSettings({ hideEnds: !s.hideEnds })} className={`inset flex h-8 w-14 items-center rounded-full p-1 ${s.hideEnds ? 'justify-end' : ''}`}>
            <span className={`size-6 rounded-full ${s.hideEnds ? 'grad' : 'bg-mute'}`} />
          </button>
        </Row>
        <Row label="Voice announcements"><Sw on={s.voice !== false} set={v => setSettings({ voice: v })} /></Row>
        <Row label="Weekly goal"><Sw on={s.goalOn !== false} set={v => setSettings({ goalOn: v })} /></Row>
        <div className="py-3">
          <span>Emergency contact</span>
          <p className="text-xs text-mute">Gets your SOS and check-in messages (you tap Send in your messages app)</p>
          <input value={s.emName ?? ''} onChange={e => setSettings({ emName: e.target.value })} placeholder="Name" className="inset mt-2 h-11 w-full rounded-xl bg-transparent px-3 text-sm" />
          <input value={s.emPhone ?? ''} onChange={e => setSettings({ emPhone: e.target.value })} placeholder="Phone number" type="tel" inputMode="tel" autoComplete="off" className="inset mt-2 h-11 w-full rounded-xl bg-transparent px-3 text-sm" />
        </div>
        <button onClick={() => setTerms(true)} className="w-full py-3 text-left">Terms &amp; Copyright</button>
      </div>
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

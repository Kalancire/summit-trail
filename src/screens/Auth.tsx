import { useState } from 'react'
import { motion } from 'motion/react'
import { Mountain } from 'lucide-react'
import legal from '../../LEGAL.md?raw'
import { signIn, signUp } from '../lib/store'
import { Btn, Field } from '../components/ui'

export function Legal({ onClose }: { onClose: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5">
      <div onClick={e => e.stopPropagation()} className="card max-h-[80dvh] w-full max-w-md overflow-y-auto rounded-3xl p-6">
        <h2 className="text-xl font-bold">Terms &amp; Copyright</h2>
        <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-mute">{legal}</pre>
        <Btn onClick={onClose} className="mt-5 w-full">Close</Btn>
      </div>
    </motion.div>
  )
}

export default function Auth({ onDone }: { onDone: () => void }) {
  const [up, setUp] = useState(true)
  const [name, setName] = useState(''), [email, setEmail] = useState(''), [pw, setPw] = useState('')
  const [ok, setOk] = useState(false), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [terms, setTerms] = useState(false)

  const go = async () => {
    setErr('')
    if (up && !ok) { setErr('Please accept the Terms to continue'); return }
    setBusy(true)
    try { up ? await signUp(name, email, pw) : await signIn(email, pw); onDone() }
    catch (e) { setErr((e as Error).message) }
    setBusy(false)
  }
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6 py-10">
      <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mb-2 text-center">
        <span className="grad mx-auto grid size-20 place-items-center rounded-3xl text-white shadow-[0_10px_30px_-8px_var(--accent)]"><Mountain className="size-10" /></span>
        <h1 className="mt-4 text-3xl font-bold">Summit Trail</h1>
        <p className="text-mute">{up ? 'Create your account' : 'Welcome back'}</p>
      </motion.div>
      {up && <Field label="Name" value={name} onChange={e => setName(e.target.value)} />}
      <Field label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
      <Field label="Password" type="password" value={pw} onChange={e => setPw(e.target.value)} />
      {up && (
        <label className="flex items-start gap-3 text-sm text-mute">
          <input type="checkbox" checked={ok} onChange={e => setOk(e.target.checked)} className="mt-1 size-4" />
          <span>I accept the <button type="button" onClick={() => setTerms(true)} className="font-bold text-accent">Terms &amp; Copyright</button></span>
        </label>
      )}
      {err && <p className="text-center text-sm text-red-400">{err}</p>}
      <Btn onClick={go} disabled={busy}>{up ? 'Sign up' : 'Sign in'}</Btn>
      <button onClick={() => { setUp(!up); setErr('') }} className="text-sm text-mute">
        {up ? 'Already have an account? ' : 'New here? '}<b className="text-accent">{up ? 'Sign in' : 'Sign up'}</b>
      </button>
      {terms && <Legal onClose={() => setTerms(false)} />}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { App as Cap } from '@capacitor/app'
import { AnimatePresence, motion } from 'motion/react'
import { title, type Rec, type Screen, type Trail } from './lib/core'
import { getRecs, getUser, signOut, signedIn, syncAll } from './lib/store'
import Nav from './components/Nav'
import Auth from './screens/Auth'
import Home from './screens/Home'
import Live from './screens/Live'
import History from './screens/History'
import Profile from './screens/Profile'
import Summary from './screens/Summary'
import Trails from './screens/Trails'
import TrailDetail from './screens/TrailDetail'
import TrailEditor from './screens/TrailEditor'
import DrawTrail from './screens/DrawTrail'
import { addTrail, delTrail, getTrails, importTrail, updateTrail } from './lib/trailstore'
import { makeTrail } from './lib/trail'

export default function App() {
  const [auth, setAuth] = useState(signedIn())
  const [screen, setScreen] = useState<Screen>('home')
  const [sel, setSel] = useState<Rec | null>(null)
  const [ver, setVer] = useState(0)
  const [trail, setTrail] = useState<Trail | null>(null)           // trail being viewed
  const [follow, setFollow] = useState<Trail | null>(null)         // trail being hiked
  const [draft, setDraft] = useState<{ t: Trail; isNew: boolean } | null>(null)
  const cur = useRef(screen); cur.current = screen

  useEffect(() => {
    const h = Cap.addListener('backButton', () => {
      const c = cur.current
      if (c === 'home') Cap.exitApp()
      else setScreen(c === 'trail' || c === 'trailedit' || c === 'draw' ? 'trails' : 'home')
    })
    // summittrail://trail/CODE opens a shared trail
    const u = Cap.addListener('appUrlOpen', ({ url }) => {
      const m = url.match(/trail\/([A-Za-z0-9]{8})/); if (!m) return
      importTrail(m[1]).then(t => { setVer(v => v + 1); setTrail(t); setScreen('trail') }).catch(e => alert((e as Error).message))
    })
    return () => { h.then(x => x.remove()); u.then(x => x.remove()) }
  }, [])

  useEffect(() => {
    if (!auth) return
    const run = () => syncAll().then(() => setVer(v => v + 1)).catch(console.warn)
    run(); addEventListener('online', run)
    return () => removeEventListener('online', run)
  }, [auth])

  if (!auth) return <Auth onDone={() => setAuth(true)} />
  const recs = getRecs(), name = getUser()?.name ?? ''
  const open = (r: Rec) => { setSel(r); setScreen('summary') }
  const edit = (t: Trail, isNew: boolean) => { setDraft({ t, isNew }); setScreen('trailedit') }
  const bump = () => setVer(v => v + 1)

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div key={screen} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
          className={['live', 'summary', 'trail', 'trailedit', 'draw'].includes(screen) ? '' : 'h-dvh overflow-y-auto'}>
          {screen === 'home' && <Home key={ver} name={name} recs={recs} onOpen={open} onProfile={() => setScreen('profile')} />}
          {screen === 'history' && <History recs={recs} onOpen={open} />}
          {screen === 'profile' && <Profile onSignOut={async () => { await signOut(); setAuth(false); setScreen('home') }} onCleared={() => setVer(v => v + 1)} />}
          {screen === 'live' && <Live trail={follow ?? undefined} onExit={(r, t) => { bump(); setFollow(null); if (r) setSel(r); if (t) edit(t, true); else r ? open(r) : setScreen('home') }} />}
          {screen === 'summary' && sel && <Summary rec={getRecs().find(r => r.id === sel.id) ?? sel} onBack={() => { bump(); setScreen('home') }} onSaveTrail={r => edit(makeTrail({ name: title(r), route: r.route, wps: (r.cps ?? []).map(c => ({ lat: c.lat, lng: c.lng, kind: c.kind ?? 'view', note: c.note, photo: c.photo })) }), true)} />}
          {screen === 'trails' && <Trails recs={recs} trails={getTrails()} onOpen={t => { setTrail(t); setScreen('trail') }} onDraw={() => setScreen('draw')} onChange={bump} />}
          {screen === 'trail' && trail && <TrailDetail trail={trail} onBack={() => setScreen('trails')} onFollow={t => { setFollow(t); setScreen('live') }} onEdit={t => edit(t, false)} onDelete={t => { delTrail(t.id); bump(); setScreen('trails') }} />}
          {screen === 'trailedit' && draft && <TrailEditor draft={draft.t} isNew={draft.isNew} onCancel={() => setScreen(!draft.isNew ? 'trail' : draft.t.drawn ? 'trails' : 'summary')}
            onSave={t => { if (draft.isNew) addTrail(t); else updateTrail(t); bump(); setTrail(t); setDraft(null); setScreen('trail') }} />}
          {screen === 'draw' && <DrawTrail onBack={() => setScreen('trails')} onDone={t => edit(t, true)} />}
        </motion.div>
      </AnimatePresence>
      {(screen === 'home' || screen === 'history' || screen === 'trails' || screen === 'profile') && <Nav tab={screen} go={s => { if (s === 'live') setFollow(null); setScreen(s) }} />}
    </>
  )
}

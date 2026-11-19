import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { App as Cap } from '@capacitor/app'
import { AnimatePresence, motion } from 'motion/react'
import { title, type Rec, type Screen, type Trail } from './lib/core'
import { getRecs, getUser, signOut, signedIn, syncAll } from './lib/store'
import Nav from './components/Nav'
import Auth from './screens/Auth'
import Home from './screens/Home'
import History from './screens/History'
import Settings from './screens/Settings'
import Trails from './screens/Trails'
import { addTrail, delTrail, getTrails, importTrail, updateTrail } from './lib/trailstore'
import { makeTrail } from './lib/trail'

const Live = lazy(() => import('./screens/Live'))
const Summary = lazy(() => import('./screens/Summary'))
const TrailDetail = lazy(() => import('./screens/TrailDetail'))
const TrailEditor = lazy(() => import('./screens/TrailEditor'))
const DrawTrail = lazy(() => import('./screens/DrawTrail'))
const LiveView = lazy(() => import('./screens/LiveView'))

export default function App() {
  const [auth, setAuth] = useState(signedIn())
  const [screen, setScreen] = useState<Screen>('home')
  const [sel, setSel] = useState<Rec | null>(null)
  const [ver, setVer] = useState(0)
  const [trail, setTrail] = useState<Trail | null>(null)           // trail being viewed
  const [follow, setFollow] = useState<Trail | null>(null)         // trail being hiked
  const [draft, setDraft] = useState<{ t: Trail; isNew: boolean } | null>(null)
  const [liveCode, setLiveCode] = useState(() => location.hash.match(/live=([a-z0-9]{10})/i)?.[1].toLowerCase() ?? '')
  const [sTab, setSTab] = useState(0)
  useEffect(() => {   // after the first screen is up, quietly load the map screens so opening them is instant
    const go = () => { import('./screens/Live'); import('./screens/Summary'); import('./screens/TrailDetail') }
    const id = 'requestIdleCallback' in window ? requestIdleCallback(go, { timeout: 4000 }) : (setTimeout(go, 2500) as unknown as number)
    return () => { if ('cancelIdleCallback' in window) cancelIdleCallback(id) }
  }, [])
  const cur = useRef(screen); cur.current = screen

  useEffect(() => {
    const h = Cap.addListener('backButton', () => {
      const c = cur.current
      if (c === 'home') Cap.exitApp()
      else setScreen(c === 'trail' || c === 'trailedit' || c === 'draw' ? 'trails' : 'home')
    })
    // summittrail://trail/CODE opens a shared trail
    const u = Cap.addListener('appUrlOpen', ({ url }) => {
      const l = url.match(/live\/([A-Za-z0-9]{10})/); if (l) { setLiveCode(l[1].toLowerCase()); return }
      const m = url.match(/trail\/([A-Za-z0-9]{8})/); if (!m) return
      importTrail(m[1]).then(t => { setVer(v => v + 1); setTrail(t); setScreen('trail') }).catch(e => alert((e as Error).message))
    })
    return () => { h.then(x => x.remove()); u.then(x => x.remove()) }
  }, [])

  useEffect(() => {
    if (!auth) return
    const run = () => syncAll().then(() => setVer(v => v + 1)).catch(console.warn)
    const vis = () => { if (document.visibilityState === 'visible') run() }
    run(); addEventListener('online', run); document.addEventListener('visibilitychange', vis)
    const t = setInterval(run, 120000)   // keeps the cloud backup fresh
    return () => { removeEventListener('online', run); document.removeEventListener('visibilitychange', vis); clearInterval(t) }
  }, [auth])

  if (liveCode) return <Suspense fallback={null}><LiveView code={liveCode} onClose={() => { setLiveCode(''); history.replaceState(null, '', location.pathname) }} /></Suspense>
  if (!auth) return <Auth onDone={() => setAuth(true)} />
  const recs = getRecs(), name = getUser()?.name ?? ''
  const open = (r: Rec) => { setSel(r); setScreen('summary') }
  const edit = (t: Trail, isNew: boolean) => { setDraft({ t, isNew }); setScreen('trailedit') }
  const bump = () => setVer(v => v + 1)

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div key={screen} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
          className={['live', 'summary', 'trail', 'trailedit', 'draw'].includes(screen) ? '' : 'h-dvh overflow-y-auto'}>
          <Suspense fallback={null}>
          {screen === 'home' && <Home key={ver} name={name} recs={recs} onOpen={open} onProfile={() => { setSTab(0); setScreen('profile') }} />}
          {screen === 'history' && <History recs={recs} onOpen={open} />}
          {screen === 'profile' && <Settings key={sTab} tab={sTab} onLive={setLiveCode} onSignOut={async () => {
            try { await signOut() } catch (e) { if (!confirm(`${(e as Error).message}\n\nSign out anyway?`)) return; await signOut(true) }
            setAuth(false); setScreen('home')
          }} onCleared={() => setVer(v => v + 1)} />}
          {screen === 'live' && <Live trail={follow ?? undefined} onExit={(r, t) => { bump(); setFollow(null); if (r) setSel(r); if (t) edit(t, true); else r ? open(r) : setScreen('home') }} />}
          {screen === 'summary' && sel && <Summary rec={getRecs().find(r => r.id === sel.id) ?? sel} onBack={() => { bump(); setScreen('home') }} onSaveTrail={r => edit(makeTrail({ name: title(r), route: r.route, wps: (r.cps ?? []).map(c => ({ lat: c.lat, lng: c.lng, kind: c.kind ?? 'view', note: c.note, photo: c.photo })) }), true)} />}
          {screen === 'trails' && <Trails recs={recs} trails={getTrails()} onOpen={t => { setTrail(t); setScreen('trail') }} onOpenRec={open} onDraw={() => setScreen('draw')} onChange={bump} />}
          {screen === 'trail' && trail && <TrailDetail trail={trail} onBack={() => setScreen('trails')} onFollow={t => { setFollow(t); setScreen('live') }} onEdit={t => edit(t, false)} onDelete={t => { delTrail(t.id); bump(); setScreen('trails') }} />}
          {screen === 'trailedit' && draft && <TrailEditor draft={draft.t} isNew={draft.isNew} onCancel={() => setScreen(!draft.isNew ? 'trail' : draft.t.drawn ? 'trails' : 'summary')}
            onSave={t => { if (draft.isNew) addTrail(t); else updateTrail(t); bump(); setTrail(t); setDraft(null); setScreen('trail') }} />}
          {screen === 'draw' && <DrawTrail onBack={() => setScreen('trails')} onDone={t => edit(t, true)} />}
        </Suspense>
        </motion.div>
      </AnimatePresence>
      {(screen === 'home' || screen === 'history' || screen === 'trails' || screen === 'profile') && <Nav tab={screen} go={s => { if (s === 'live') setFollow(null); if (s === 'profile') setSTab(1); setScreen(s) }} />}
    </>
  )
}

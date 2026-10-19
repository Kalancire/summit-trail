import { useEffect, useRef, useState } from 'react'
import { App as Cap } from '@capacitor/app'
import { AnimatePresence, motion } from 'motion/react'
import type { Rec, Screen } from './lib/core'
import { getRecs, getUser, signOut, signedIn, syncAll } from './lib/store'
import Nav from './components/Nav'
import Auth from './screens/Auth'
import Home from './screens/Home'
import Live from './screens/Live'
import History from './screens/History'
import Profile from './screens/Profile'
import Summary from './screens/Summary'

export default function App() {
  const [auth, setAuth] = useState(signedIn())
  const [screen, setScreen] = useState<Screen>('home')
  const [sel, setSel] = useState<Rec | null>(null)
  const [ver, setVer] = useState(0)
  const cur = useRef(screen); cur.current = screen

  useEffect(() => {
    const h = Cap.addListener('backButton', () => (cur.current === 'home' ? Cap.exitApp() : setScreen('home')))
    return () => { h.then(x => x.remove()) }
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

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div key={screen} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
          className={screen === 'live' || screen === 'summary' ? '' : 'h-dvh overflow-y-auto'}>
          {screen === 'home' && <Home key={ver} name={name} recs={recs} onOpen={open} onProfile={() => setScreen('profile')} />}
          {screen === 'history' && <History recs={recs} onOpen={open} />}
          {screen === 'profile' && <Profile onSignOut={async () => { await signOut(); setAuth(false); setScreen('home') }} onCleared={() => setVer(v => v + 1)} />}
          {screen === 'live' && <Live onExit={r => { setVer(v => v + 1); r ? open(r) : setScreen('home') }} />}
          {screen === 'summary' && sel && <Summary rec={sel} onBack={() => { setVer(v => v + 1); setScreen('home') }} />}
        </motion.div>
      </AnimatePresence>
      {(screen === 'home' || screen === 'history' || screen === 'profile') && <Nav tab={screen} go={setScreen} />}
    </>
  )
}

import { useState } from 'react'
import { Tabs } from '../components/ui'
import General from './General'
import Profile from './Profile'

export default function Settings({ tab: t0, ...p }: { tab: number; onSignOut: () => void; onCleared: () => void; onLive: (code: string) => void }) {
  const [tab, setTab] = useState(t0)
  return (
    <div className="mx-auto max-w-md px-5 pb-36 safe-top">
      <h1 className="mb-4 text-3xl font-bold">Settings</h1>
      <Tabs items={['General', 'User']} on={tab} set={setTab} />
      <div className="mt-5">{tab === 0 ? <General /> : <Profile {...p} />}</div>
    </div>
  )
}

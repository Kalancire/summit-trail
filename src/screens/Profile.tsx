import { useState } from 'react'
import { Legal } from './Auth'
import { ACCENTS } from '../lib/core'
import { clearRecs, getUser, setSettings, useSettings } from '../lib/store'
import { Btn } from '../components/ui'

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between py-3"><span>{label}</span>{children}</div>
)

export default function Profile({ onSignOut, onCleared }: { onSignOut: () => void; onCleared: () => void }) {
  const s = useSettings(), u = getUser()
  const [terms, setTerms] = useState(false)
  return (
    <div className="mx-auto max-w-md px-5 pb-36 safe-top">
      <div className="flex flex-col items-center gap-1 py-4">
        <span className="grad grid size-20 place-items-center rounded-full text-3xl font-bold text-white">{u?.name[0]?.toUpperCase()}</span>
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
        <button onClick={() => setTerms(true)} className="w-full py-3 text-left">Terms &amp; Copyright</button>
      </div>
      <div className="mt-6 space-y-3">
        <Btn outline onClick={onSignOut} className="w-full">Sign out</Btn>
        <button className="w-full py-2 text-sm text-red-400" onClick={() => { if (confirm('Delete all saved activities from this phone?')) { clearRecs(); onCleared() } }}>
          Delete all activities
        </button>
      </div>
      {terms && <Legal onClose={() => setTerms(false)} />}
    </div>
  )
}

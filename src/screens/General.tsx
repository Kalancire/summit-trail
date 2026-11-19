import { useState } from 'react'
import { Legal } from './Auth'
import { DEFAULT_CUSTOM, THEMES, themeOf, type Custom, type Theme } from '../lib/themes'
import { setSettings, useSettings } from '../lib/store'

const Row = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-3 py-3"><span>{label}{hint && <small className="block text-xs text-mute">{hint}</small>}</span>{children}</div>
)
const Sw = ({ on, set }: { on: boolean; set: (v: boolean) => void }) => (
  <button onClick={() => set(!on)} className={`inset flex h-8 w-14 shrink-0 items-center rounded-full p-1 ${on ? 'justify-end' : ''}`}><span className={`size-6 rounded-full ${on ? 'grad' : 'bg-white/40'}`} /></button>
)
const Slide = ({ label, v, min, max, step, set, fmt }: { label: string; v: number; min: number; max: number; step: number; set: (n: number) => void; fmt: (n: number) => string }) => (
  <div className="py-3"><div className="flex justify-between text-sm"><span>{label}</span><b className="text-accent">{fmt(v)}</b></div>
    <input type="range" min={min} max={max} step={step} value={v} onChange={e => set(+e.target.value)} className="mt-2 w-full" /></div>
)
const spots = [[-8, 38], [26, -16], [52, 34]]
const Swatch = ({ t, on, pick }: { t: Theme; on: boolean; pick: () => void }) => (
  <button onClick={pick} style={{ background: t.base }} className={`relative h-20 overflow-hidden rounded-2xl text-left ${on ? 'ring-2 ring-white' : 'ring-1 ring-white/20'}`}>
    {t.blobs.slice(0, 3).map((c, i) => <span key={i} className="absolute size-14 rounded-full" style={{ left: `${spots[i][0]}%`, top: `${spots[i][1]}%`, background: `radial-gradient(circle, ${c}, transparent 70%)` }} />)}
    <span className="absolute inset-x-0 bottom-0 bg-black/40 px-2 py-1 text-[11px] font-bold backdrop-blur-sm">{t.emoji} {t.name}</span>
  </button>
)

export default function General() {
  const s = useSettings(), cur = themeOf(s), custom = s.custom ?? DEFAULT_CUSTOM
  const [terms, setTerms] = useState(false)
  const setC = (p: Partial<Custom>) => setSettings({ theme: 'custom', custom: { ...custom, ...p } })
  return (
    <div className="space-y-5">
      <div className="card rounded-[2rem] p-5">
        <b className="text-lg">Theme</b>
        <p className="mb-3 text-xs text-mute">Pick a look. The background is soft drifting glows in the theme colours.</p>
        <div className="grid grid-cols-3 gap-2.5">
          {THEMES.map(t => <Swatch key={t.id} t={t} on={cur.id === t.id} pick={() => setSettings({ theme: t.id })} />)}
          <Swatch t={{ ...themeOf({ theme: 'custom', custom }), name: 'Custom' }} on={cur.id === 'custom'} pick={() => setSettings({ theme: 'custom', custom })} />
        </div>
        {cur.id === 'custom' && (
          <div className="inset mt-4 grid grid-cols-4 gap-3 rounded-2xl p-3 text-center text-[11px] text-mute">
            {([['accent', 'Accent'], ['base', 'Dark base'], ['c1', 'Blob 1'], ['c2', 'Blob 2']] as const).map(([k, l]) => (
              <label key={k} className="block"><input type="color" value={custom[k]} onChange={e => setC({ [k]: e.target.value })} className="mx-auto block size-11 cursor-pointer rounded-full" />{l}</label>
            ))}
          </div>
        )}
      </div>

      <div className="card divide-y divide-white/10 rounded-[2rem] px-5 py-2">
        <b className="block py-3 text-lg">Appearance</b>
        <Row label="Moving background" hint="Pauses by itself while you record a hike to save battery"><Sw on={s.anim !== false} set={v => setSettings({ anim: v })} /></Row>
        <Slide label="Background speed" v={s.speed ?? 1} min={0.3} max={2.5} step={0.1} set={n => setSettings({ speed: n })} fmt={n => `${n.toFixed(1)}x`} />
        <Slide label="Glass blur (nav bar)" v={s.blur ?? 18} min={0} max={40} step={1} set={n => setSettings({ blur: n })} fmt={n => `${n}px`} />
        <Slide label="Glass strength" v={s.glass ?? 10} min={4} max={30} step={1} set={n => setSettings({ glass: n })} fmt={n => `${n}%`} />
        <button onClick={() => setSettings({ theme: 'aurora', anim: true, speed: 1, blur: 18, glass: 10 })} className="w-full py-3 text-left text-sm text-accent">Reset appearance</button>
      </div>

      <div className="card divide-y divide-white/10 rounded-[2rem] px-5 py-2">
        <b className="block py-3 text-lg">Preferences</b>
        <Row label="Units">
          <div className="inset flex rounded-full p-1">
            {(['km', 'mi'] as const).map(x => (
              <button key={x} onClick={() => setSettings({ units: x })} className={`rounded-full px-4 py-1 text-sm font-bold ${s.units === x ? 'grad text-white' : 'text-mute'}`}>{x}</button>
            ))}
          </div>
        </Row>
        <Row label="Hide start and end of routes" hint="Privacy for maps, replays and share cards"><Sw on={!!s.hideEnds} set={v => setSettings({ hideEnds: v })} /></Row>
        <Row label="Voice announcements"><Sw on={s.voice !== false} set={v => setSettings({ voice: v })} /></Row>
        <Row label="Weekly goal"><Sw on={s.goalOn !== false} set={v => setSettings({ goalOn: v })} /></Row>
        <Row label="Auto-pause when you stop"><Sw on={s.autoPause !== false} set={v => setSettings({ autoPause: v })} /></Row>
        <Row label="No-movement and fall alert"><Sw on={s.safety !== false} set={v => setSettings({ safety: v })} /></Row>
        <Row label="Max heart rate (bpm)">
          <input type="number" inputMode="numeric" value={s.maxHr ?? 190} onChange={e => setSettings({ maxHr: Math.min(230, Math.max(120, +e.target.value || 190)) })} className="inset h-9 w-20 rounded-xl bg-transparent px-3 text-center text-sm" />
        </Row>
        <button onClick={() => setTerms(true)} className="w-full py-3 text-left">Terms &amp; Copyright</button>
      </div>
      {terms && <Legal onClose={() => setTerms(false)} />}
    </div>
  )
}

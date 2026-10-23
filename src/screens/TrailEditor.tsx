import { useRef, useState } from 'react'
import { Camera, Trash2 } from 'lucide-react'
import MapView from '../components/MapView'
import { Back, Btn, Mini } from '../components/ui'
import { DIFF_COLOR } from '../lib/trail'
import { WP_EMOJI, WP_LABEL, dist, hms, type Diff, type Trail, type WpKind } from '../lib/core'
import { toAvatar } from '../lib/image'
import { useSettings } from '../lib/store'

const KINDS = Object.keys(WP_LABEL) as WpKind[]
const inp = 'inset w-full rounded-xl bg-transparent p-3 text-sm'

// Trail details: name, difficulty, description, cover photo and waypoints. Distance, climb, highest point and time are calculated.
export default function TrailEditor({ draft, isNew, onSave, onCancel }: { draft: Trail; isNew: boolean; onSave: (t: Trail) => void; onCancel: () => void }) {
  const { units } = useSettings()
  const [t, setT] = useState(draft), cover = useRef<HTMLInputElement>(null), wpPhoto = useRef<HTMLInputElement>(null), which = useRef(0)
  const setWp = (i: number, p: Partial<Trail['wps'][0]>) => setT({ ...t, wps: t.wps.map((w, k) => (k === i ? { ...w, ...p } : w)) })
  return (
    <div className="h-dvh overflow-y-auto">
      <div className="mx-auto max-w-md px-5 pb-10 safe-top">
        <div className="flex items-center gap-3"><Back onClick={onCancel} /><h1 className="text-xl font-bold">{isNew ? 'New trail' : 'Edit trail'}</h1></div>

        <div className="card mt-5 rounded-[2rem] p-1.5">
          <MapView inline route={t.route} wps={t.wps} controls={false} className="h-48 overflow-hidden rounded-[1.7rem]" />
        </div>

        <div className="card mt-4 grid grid-cols-4 gap-2 rounded-2xl p-4 text-center">
          <Mini label="Distance" value={dist(t.distM, units)} />
          <Mini label="Climb" value={`${Math.round(t.gain)} m`} />
          <Mini label="Highest" value={t.maxAlt ? `${Math.round(t.maxAlt)} m` : '--'} />
          <Mini label="Est. time" value={hms(t.estSecs).slice(0, 5)} />
        </div>

        <div className="card mt-4 rounded-2xl p-5">
          <input ref={cover} type="file" accept="image/*" hidden onChange={async e => { const f = e.target.files?.[0]; if (f) { const c = await toAvatar(f, 480).catch(() => undefined); if (c) setT(x => ({ ...x, cover: c })) } e.target.value = '' }} />
          <button onClick={() => cover.current?.click()} className="inset grid h-36 w-full place-items-center overflow-hidden rounded-2xl text-sm text-mute">
            {t.cover ? <img src={t.cover} alt="" className="size-full object-cover" /> : <span className="flex items-center gap-2"><Camera className="size-5 text-accent" /> Add cover photo</span>}
          </button>
          <input value={t.name} onChange={e => setT({ ...t, name: e.target.value })} placeholder="Trail name" className={inp + ' mt-3 font-bold'} />
          <div className="mt-3 flex gap-2">
            {(['easy', 'moderate', 'hard'] as Diff[]).map(d => (
              <button key={d} onClick={() => setT({ ...t, diff: d })} style={t.diff === d ? { background: DIFF_COLOR[d] } : undefined}
                className={`flex-1 rounded-full py-1.5 text-sm font-bold capitalize ${t.diff === d ? 'text-white' : 'card text-mute'}`}>{d}</button>
            ))}
          </div>
          <textarea value={t.desc ?? ''} onChange={e => setT({ ...t, desc: e.target.value })} rows={3} placeholder="Describe the trail: what to expect, tips, best season" className={inp + ' mt-3'} />
        </div>

        {t.wps.length > 0 && (
          <div className="card mt-4 rounded-2xl p-5">
            <b>Waypoints</b>
            <input ref={wpPhoto} type="file" accept="image/*" capture="environment" hidden onChange={async e => { const f = e.target.files?.[0]; if (f) { const p = await toAvatar(f, 480).catch(() => undefined); if (p) setWp(which.current, { photo: p }) } e.target.value = '' }} />
            {t.wps.map((w, i) => (
              <div key={i} className="mt-3 border-t border-white/5 pt-3">
                <div className="flex items-center gap-2">
                  <div className="flex flex-1 flex-wrap gap-1.5">
                    {KINDS.map(k => <button key={k} onClick={() => setWp(i, { kind: k })} aria-label={WP_LABEL[k]} className={`size-9 rounded-full text-lg ${w.kind === k ? 'grad' : 'card'}`}>{WP_EMOJI[k]}</button>)}
                  </div>
                  <button onClick={() => { which.current = i; wpPhoto.current?.click() }} aria-label="Photo" className="card grid size-9 place-items-center rounded-full text-accent"><Camera className="size-4" /></button>
                  <button onClick={() => setT({ ...t, wps: t.wps.filter((_, k) => k !== i) })} aria-label="Delete waypoint" className="grid size-9 place-items-center text-red-400"><Trash2 className="size-4" /></button>
                </div>
                <div className="mt-2 flex gap-2">
                  {w.photo && <img src={w.photo} alt="" className="size-12 rounded-xl object-cover" />}
                  <input value={w.note ?? ''} onChange={e => setWp(i, { note: e.target.value })} placeholder={`Note about this ${WP_LABEL[w.kind].toLowerCase()}`} className={inp + ' !p-2'} />
                </div>
              </div>
            ))}
          </div>
        )}

        <Btn onClick={() => onSave({ ...t, name: t.name.trim() || 'My trail' })} className="mt-5 w-full">{isNew ? 'Save trail' : 'Save changes'}</Btn>
      </div>
    </div>
  )
}

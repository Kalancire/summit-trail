import { useRef, useState } from 'react'
import { Camera, X } from 'lucide-react'
import { WP_EMOJI, WP_LABEL, type Cp, type WpKind } from '../lib/core'
import { toAvatar } from '../lib/image'
import { Btn } from './ui'

// Journal entry for a checkpoint: a note, a photo, and an optional waypoint kind (water, viewpoint, campsite, hazard)
export default function CheckpointSheet({ cp, forTrail, onSave, onCancel }: { cp: Cp; forTrail: boolean; onSave: (c: Cp) => void; onCancel: () => void }) {
  const [c, setC] = useState<Cp>(cp), cam = useRef<HTMLInputElement>(null)
  const kinds = Object.keys(WP_LABEL) as WpKind[]
  return (
    <div className="absolute inset-0 z-30 flex items-end bg-black/60" onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} className="card w-full rounded-t-[2rem] p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
        <div className="flex items-center justify-between"><b className="text-lg">Checkpoint</b><button onClick={onCancel} aria-label="Cancel"><X className="size-5 text-mute" /></button></div>
        <div className="mt-3 flex flex-wrap gap-2">
          {kinds.map(k => (
            <button key={k} onClick={() => setC({ ...c, kind: c.kind === k ? undefined : k })}
              className={`rounded-full px-3 py-1 text-sm font-bold ${c.kind === k ? 'grad text-white' : 'card text-mute'}`}>{WP_EMOJI[k]} {WP_LABEL[k]}</button>
          ))}
        </div>
        {forTrail && !c.kind && <p className="mt-2 text-xs text-mute">Pick a kind to show an icon on the trail. With none, it is saved as a viewpoint.</p>}
        <textarea value={c.note ?? ''} onChange={e => setC({ ...c, note: e.target.value })} rows={3} placeholder="What do you see? Write a note for your journal"
          className="inset mt-3 w-full rounded-xl bg-transparent p-3 text-sm" />
        <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={async e => { const f = e.target.files?.[0]; if (f) { const photo = await toAvatar(f, 480).catch(() => undefined); if (photo) setC(x => ({ ...x, photo })) } e.target.value = '' }} />
        <div className="mt-3 flex items-center gap-3">
          <button onClick={() => cam.current?.click()} className="card flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-accent"><Camera className="size-5" /> {c.photo ? 'Retake' : 'Add photo'}</button>
          {c.photo && <img src={c.photo} alt="" className="size-14 rounded-xl object-cover" />}
        </div>
        <Btn onClick={() => onSave({ ...c, note: c.note?.trim() || undefined })} className="mt-4 w-full">Save checkpoint</Btn>
      </div>
    </div>
  )
}

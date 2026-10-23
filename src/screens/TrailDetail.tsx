import { useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'
import { Navigation, Pencil, Share2, Trash2 } from 'lucide-react'
import MapView from '../components/MapView'
import { Elevation } from '../components/charts'
import { Back, Btn, Mini } from '../components/ui'
import { DIFF_COLOR } from '../lib/trail'
import { WP_EMOJI, WP_LABEL, dist, hms, type Trail } from '../lib/core'
import { exportTrailGpx } from '../lib/gpx'
import { shareLink } from '../lib/trailstore'
import { useSettings } from '../lib/store'

export default function TrailDetail({ trail: t, onBack, onFollow, onEdit, onDelete }: {
  trail: Trail; onBack: () => void; onFollow: (t: Trail) => void; onEdit: (t: Trail) => void; onDelete: (t: Trail) => void
}) {
  const { units } = useSettings()
  const [msg, setMsg] = useState(''), [busy, setBusy] = useState(false)
  const share = async () => {
    setBusy(true); setMsg('')
    try {
      const { code, link } = await shareLink(t)
      const text = `Hike "${t.name}" on Summit Trail.\nOpen: ${link}\nOr paste the code ${code} in My Trails > Import.`
      if (Capacitor.isNativePlatform()) await Share.share({ title: t.name, text })
      else if (navigator.share) await navigator.share({ title: t.name, text })
      else { await navigator.clipboard.writeText(text); setMsg('Link copied') }
    } catch (e) { if ((e as Error).name !== 'AbortError') setMsg((e as Error).message || 'Could not share') }
    setBusy(false)
  }
  return (
    <div className="h-dvh overflow-y-auto">
      <div className="mx-auto max-w-md px-5 pb-10 safe-top">
        <div className="flex items-center gap-3">
          <Back onClick={onBack} /><h1 className="flex-1 truncate text-xl font-bold">{t.name}</h1>
          <span style={{ background: DIFF_COLOR[t.diff] }} className="rounded-full px-3 py-1 text-xs font-bold capitalize text-white">{t.diff}</span>
        </div>

        {t.cover && <img src={t.cover} alt="" className="mt-5 h-44 w-full rounded-[2rem] object-cover" />}
        <div className="card mt-4 rounded-[2rem] p-1.5">
          <MapView inline route={t.route} wps={t.wps} className="h-[40dvh] overflow-hidden rounded-[1.7rem]" />
        </div>

        <div className="card mt-4 grid grid-cols-4 gap-2 rounded-2xl p-4 text-center">
          <Mini label="Distance" value={dist(t.distM, units)} />
          <Mini label="Climb" value={`${Math.round(t.gain)} m`} />
          <Mini label="Highest" value={t.maxAlt ? `${Math.round(t.maxAlt)} m` : '--'} />
          <Mini label="Est. time" value={hms(t.estSecs).slice(0, 5)} />
        </div>
        {t.desc && <p className="card mt-4 rounded-2xl p-4 text-sm">{t.desc}</p>}
        {t.route.some(p => p.alt) && <div className="card mt-4 rounded-2xl p-5"><Elevation route={t.route} /></div>}

        {t.wps.length > 0 && (
          <div className="card mt-4 rounded-2xl p-5">
            <b>Waypoints</b>
            {t.wps.map((w, i) => (
              <div key={i} className="mt-3 flex items-center gap-3 text-sm">
                <span className="card grid size-10 shrink-0 place-items-center rounded-full text-lg">{WP_EMOJI[w.kind]}</span>
                <span className="flex-1"><b className="block">{WP_LABEL[w.kind]}</b><span className="text-xs text-mute">{w.note || 'No note'}</span></span>
                {w.photo && <img src={w.photo} alt="" className="size-12 rounded-xl object-cover" />}
              </div>
            ))}
          </div>
        )}

        <Btn onClick={() => onFollow(t)} className="mt-5 w-full"><Navigation className="size-5" /> Follow this trail</Btn>
        <div className="mt-3 flex gap-3">
          <Btn outline onClick={() => exportTrailGpx(t).catch(() => setMsg('Could not export GPX'))} className="flex-1"><Share2 className="size-4" /> GPX</Btn>
          <Btn outline onClick={share} disabled={busy} className="flex-1"><Share2 className="size-4" /> {busy ? 'Sharing…' : 'Share link'}</Btn>
          <Btn outline onClick={() => onEdit(t)} className="!px-4" ><Pencil className="size-4" /></Btn>
        </div>
        {msg && <p className="mt-3 text-center text-sm text-mute">{msg}</p>}
        <button onClick={() => { if (confirm('Delete this trail?')) onDelete(t) }} className="mx-auto mt-6 flex items-center gap-2 text-sm text-red-400"><Trash2 className="size-4" /> Delete trail</button>
      </div>
    </div>
  )
}

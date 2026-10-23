import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { WP_LABEL, title, type Pt, type Rec, type Trail } from './core'

const esc = (s: string) => s.replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!)
type W = { lat: number; lng: number; t?: number; name: string; desc?: string; type?: string }

function gpx(name: string, route: Pt[], wpts: W[], withTime: boolean) {
  const pts = route.map(p => `<trkpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}"><ele>${p.alt.toFixed(1)}</ele>${withTime ? `<time>${new Date(p.t).toISOString()}</time>` : ''}</trkpt>`).join('')
  const w = wpts.map(c => `<wpt lat="${c.lat.toFixed(6)}" lon="${c.lng.toFixed(6)}">${c.t ? `<time>${new Date(c.t).toISOString()}</time>` : ''}<name>${esc(c.name)}</name>${c.desc ? `<desc>${esc(c.desc)}</desc>` : ''}${c.type ? `<type>${esc(c.type)}</type>` : ''}</wpt>`).join('')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Summit Trail" xmlns="http://www.topografix.com/GPX/1/1">${w}<trk><name>${esc(name)}</name><trkseg>${pts}</trkseg></trk></gpx>`
}

export const toGpx = (r: Rec) =>
  gpx(title(r), r.route, (r.cps ?? []).map((c, i) => ({ lat: c.lat, lng: c.lng, t: c.t, name: c.kind ? WP_LABEL[c.kind] : `Checkpoint ${i + 1}`, desc: c.note, type: c.kind })), true)
export const toTrailGpx = (t: Trail) =>
  gpx(t.name, t.route, t.wps.map(w => ({ lat: w.lat, lng: w.lng, name: WP_LABEL[w.kind], desc: w.note, type: w.kind })), !t.drawn)

async function save(name: string, xml: string) {
  if (Capacitor.isNativePlatform()) {
    const f = await Filesystem.writeFile({ path: name, data: btoa(unescape(encodeURIComponent(xml))), directory: Directory.Cache })
    await Share.share({ title: 'Summit Trail GPX', files: [f.uri] })
  } else {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([xml], { type: 'application/gpx+xml' })); a.download = name; a.click()
  }
}
export const exportGpx = (r: Rec) => save(`summit-trail-${new Date(r.ts).toISOString().slice(0, 10)}-${r.id}.gpx`, toGpx(r))
export const exportTrailGpx = (t: Trail) => save(`${t.name.replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '') || 'trail'}-${t.id}.gpx`, toTrailGpx(t))

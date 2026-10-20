import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { title, type Rec } from './core'

const esc = (s: string) => s.replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!)

export function toGpx(r: Rec) {
  const pts = r.route.map(p => `<trkpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}"><ele>${p.alt.toFixed(1)}</ele><time>${new Date(p.t).toISOString()}</time></trkpt>`).join('')
  const wpts = (r.cps ?? []).map((c, i) => `<wpt lat="${c.lat.toFixed(6)}" lon="${c.lng.toFixed(6)}"><time>${new Date(c.t).toISOString()}</time><name>Checkpoint ${i + 1}</name></wpt>`).join('')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Summit Trail" xmlns="http://www.topografix.com/GPX/1/1">${wpts}<trk><name>${esc(title(r))}</name><trkseg>${pts}</trkseg></trk></gpx>`
}

export async function exportGpx(r: Rec) {
  const name = `summit-trail-${new Date(r.ts).toISOString().slice(0, 10)}-${r.id}.gpx`, xml = toGpx(r)
  if (Capacitor.isNativePlatform()) {
    const f = await Filesystem.writeFile({ path: name, data: btoa(unescape(encodeURIComponent(xml))), directory: Directory.Cache })
    await Share.share({ title: 'Summit Trail GPX', files: [f.uri] })
  } else {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([xml], { type: 'application/gpx+xml' })); a.download = name; a.click()
  }
}

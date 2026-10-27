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

// ---- GPX import (AllTrails, Strava, Garmin, Komoot and others) ----
import { calc, hav, type Cp, type Wp, type WpKind } from './core'
import { peakOf, thin } from './trail'

export function parseGpx(xml: string): { name: string; route: Pt[]; wps: Wp[] } {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('That file is not a valid GPX')
  const pts = [...doc.querySelectorAll('trkpt')], src = pts.length ? pts : [...doc.querySelectorAll('rtept')]
  const route: Pt[] = src.map(e => {
    const t = Date.parse(e.querySelector('time')?.textContent ?? '')
    return { lat: parseFloat(e.getAttribute('lat') ?? ''), lng: parseFloat(e.getAttribute('lon') ?? ''), alt: parseFloat(e.querySelector('ele')?.textContent ?? '') || 0, t: isNaN(t) ? 0 : t }
  }).filter(p => isFinite(p.lat) && isFinite(p.lng))
  if (route.length < 2) throw new Error('No track found in that GPX file')
  const kind = (s: string): WpKind => (/water|spring|river|stream/i.test(s) ? 'water' : /camp|tent|shelter/i.test(s) ? 'camp' : /danger|hazard|warning|cliff/i.test(s) ? 'hazard' : 'view')
  const wps: Wp[] = [...doc.querySelectorAll('wpt')].map(e => {
    const n = e.querySelector('name')?.textContent?.trim()
    return { lat: parseFloat(e.getAttribute('lat') ?? ''), lng: parseFloat(e.getAttribute('lon') ?? ''), kind: kind(`${n ?? ''} ${e.querySelector('type')?.textContent ?? ''}`), note: n || undefined }
  }).filter(w => isFinite(w.lat) && isFinite(w.lng))
  const name = doc.querySelector('trk > name, rte > name, metadata > name')?.textContent?.trim() || 'Imported track'
  return { name, route, wps }
}

/** turns an imported track into an activity; files without timestamps get an estimated walking pace */
export function recFromGpx(g: { name: string; route: Pt[]; wps: Wp[] }): Rec {
  let route = thin(g.route, 8)
  const timed = route.every(p => p.t > 0) && route[route.length - 1].t > route[0].t, { d, g: gain } = calc(route)
  if (!timed) {
    const t0 = Date.now() - Math.round(d / 1.1) * 1000; let acc = 0
    route = route.map((p, i, a) => { if (i) acc += hav(a[i - 1], p); return { ...p, t: t0 + Math.round(acc / 1.1) * 1000 } })
  }
  const secs = Math.max(1, Math.round((route[route.length - 1].t - route[0].t) / 1000)), pk = peakOf(route)
  const cps: Cp[] = g.wps.map(w => ({ lat: w.lat, lng: w.lng, t: route[0].t, kind: w.kind, note: w.note }))
  return { id: Date.now(), ts: route[0].t, distM: d, secs, gain, route, name: g.name, type: 'hike', ...(cps.length ? { cps } : {}), ...(pk ? { peak: pk } : {}) }
}

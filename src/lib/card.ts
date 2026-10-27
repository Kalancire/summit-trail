import logo from '../assets/logo.png'
import { dateLine, hms, pace, title, trimEnds, type Rec, type Units } from './core'

/** 1080x1350 share image: route shape, distance and stats (no map tiles, so it always works offline). */
export async function renderCard(rec: Rec, units: Units, accent: string, hide: boolean): Promise<Blob> {
  const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H
  const g = c.getContext('2d')!
  g.fillStyle = '#2b2b2b'; g.fillRect(0, 0, W, H)
  const r = trimEnds(rec.route, hide)
  if (r.length > 1) {
    const k = Math.cos((r[0].lat * Math.PI) / 180), xs = r.map(p => p.lng * k), ys = r.map(p => -p.lat)
    const x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0 || 1e-9, h = Math.max(...ys) - y0 || 1e-9
    const s = Math.min(860 / w, 560 / h), ox = (W - w * s) / 2, oy = 330 + (560 - h * s) / 2
    const P = r.map((_, i) => [ox + (xs[i] - x0) * s, oy + (ys[i] - y0) * s] as const)
    g.lineCap = 'round'; g.lineJoin = 'round'
    for (const [col, wd] of [['rgba(0,0,0,.55)', 22], [accent, 12]] as const) {
      g.strokeStyle = col; g.lineWidth = wd; g.beginPath(); P.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke()
    }
    for (const [p, col] of [[P[0], '#18b87a'], [P[P.length - 1], '#ef4444']] as const) { g.fillStyle = '#fff'; g.beginPath(); g.arc(p[0], p[1], 20, 0, 7); g.fill(); g.fillStyle = col; g.beginPath(); g.arc(p[0], p[1], 12, 0, 7); g.fill() }
  }
  g.textAlign = 'center'; g.fillStyle = '#ededed'; g.font = 'bold 64px sans-serif'; g.fillText(title(rec), W / 2, 190)
  g.fillStyle = '#8e8e8e'; g.font = '34px sans-serif'; g.fillText(dateLine(rec), W / 2, 245)
  g.fillStyle = accent; g.font = 'bold 150px sans-serif'; g.fillText(`${(rec.distM / (units === 'km' ? 1000 : 1609.344)).toFixed(2)} ${units}`, W / 2, 1030)
  g.fillStyle = '#ededed'; g.font = 'bold 54px sans-serif'
  ;[[hms(rec.secs), 'Time'], [pace(rec.distM, rec.secs, units), `Pace /${units}`], [`${Math.round(rec.gain)} m`, 'Climb']].forEach(([v, l], i) => {
    g.fillStyle = '#ededed'; g.font = 'bold 54px sans-serif'; g.fillText(v, 220 + i * 320, 1150)
    g.fillStyle = '#8e8e8e'; g.font = '30px sans-serif'; g.fillText(l, 220 + i * 320, 1195)
  })
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = logo })
    const hh = 70; g.drawImage(img, W / 2 - (img.width / img.height) * hh / 2, 1245, (img.width / img.height) * hh, hh)
  } catch { g.fillStyle = '#8e8e8e'; g.font = '32px sans-serif'; g.fillText('Summit Trail', W / 2, 1290) }
  return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('Could not make the image'))), 'image/png'))
}

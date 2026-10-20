import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import logoUrl from '../assets/logo.png'
import { hav, type Cp, type Pt } from './core'

/** Draws the route replay on a canvas and records it (MP4 where the device supports it, else WebM). */
export async function renderVideo(route: Pt[], accent: string, label: string, cps: Cp[] = []) {
  const W = 720, H = 1280
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const g = c.getContext('2d')!
  const mx = (lng: number) => (lng + 180) / 360
  const my = (lat: number) => 0.5 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / (2 * Math.PI)
  const X = route.map(p => mx(p.lng)), Y = route.map(p => my(p.lat))
  const x0 = Math.min(...X), x1 = Math.max(...X), y0 = Math.min(...Y), y1 = Math.max(...Y)
  const zf = Math.min(17, Math.log2(Math.min(540 / ((x1 - x0) * 256 || 1e-9), 600 / ((y1 - y0) * 256 || 1e-9))))
  const S = 256 * 2 ** zf, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, CY = 640
  const P = route.map((_, i) => [(X[i] - cx) * S + W / 2, (Y[i] - cy) * S + CY] as const)
  // map tiles behind the route (Esri dark base + labels); falls back to plain dark if offline
  const bg = document.createElement('canvas'); bg.width = W; bg.height = H
  const bgc = bg.getContext('2d')!; bgc.fillStyle = '#2b2b2b'; bgc.fillRect(0, 0, W, H)
  const z = Math.max(1, Math.min(16, Math.floor(zf))), n2 = 2 ** z, ts = S / n2
  const ESRI = 'https://services.arcgisonline.com/ArcGIS/rest/services'
  const load = (u: string) => new Promise<HTMLImageElement | null>(res => {
    const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null)
    setTimeout(() => res(null), 8000); im.src = u
  })
  const tx0 = Math.floor((cx * S - W / 2) / ts), tx1 = Math.floor((cx * S + W / 2) / ts)
  const ty0 = Math.floor((cy * S - CY) / ts), ty1 = Math.floor((cy * S + (H - CY)) / ts)
  const jobs: Promise<void>[] = []
  for (const layer of ['Canvas/World_Dark_Gray_Base', 'Canvas/World_Dark_Gray_Reference'])
    for (let tx = tx0; tx <= tx1; tx++) for (let ty = ty0; ty <= ty1; ty++) {
      if (tx < 0 || ty < 0 || tx >= n2 || ty >= n2) continue
      jobs.push(load(`${ESRI}/${layer}/MapServer/tile/${z}/${ty}/${tx}`).then(im => {
        if (im) bgc.drawImage(im, tx * ts - (cx * S - W / 2), ty * ts - (cy * S - CY), ts + 0.6, ts + 0.6)
      }))
    }
  await Promise.all(jobs)
  const logo = await load(logoUrl)
  const nearest = (c: Cp) => { let bi = 0, bd = Infinity; route.forEach((p, i) => { const d = hav(p, { ...p, lat: c.lat, lng: c.lng }); if (d < bd) { bd = d; bi = i } }); return bi }
  const marks = cps.map(c => ({ i: nearest(c) })).filter(m => m.i < route.length)
  const cum = [0]; for (let i = 1; i < route.length; i++) cum.push(cum[i - 1] + hav(route[i - 1], route[i]))
  const total = cum[cum.length - 1] || 1

  const draw = (t: number) => {
    const n = Math.max(1, Math.round(t * (P.length - 1)))
    g.drawImage(bg, 0, 0)
    const hg = g.createLinearGradient(0, 0, 0, 290); hg.addColorStop(0, 'rgba(18,18,18,.96)'); hg.addColorStop(1, 'rgba(18,18,18,0)')
    g.fillStyle = hg; g.fillRect(0, 0, W, 290)
    const fg = g.createLinearGradient(0, 1000, 0, H); fg.addColorStop(0, 'rgba(18,18,18,0)'); fg.addColorStop(0.35, 'rgba(18,18,18,.96)')
    g.fillStyle = fg; g.fillRect(0, 1000, W, H - 1000)
    g.lineCap = 'round'; g.lineJoin = 'round'
    g.lineWidth = 8; g.strokeStyle = 'rgba(255,255,255,.35)'
    g.beginPath(); P.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke()
    g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 18
    g.beginPath(); P.slice(0, n + 1).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke()
    g.strokeStyle = accent; g.lineWidth = 11
    g.beginPath(); P.slice(0, n + 1).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke()
    marks.forEach((m, k) => {
      if (m.i > n) return
      const [x, y] = P[m.i]
      g.fillStyle = '#e8912d'; g.strokeStyle = '#fff'; g.lineWidth = 4
      g.beginPath(); g.arc(x, y - 28, 20, 0, 7); g.fill(); g.stroke()
      g.beginPath(); g.moveTo(x - 10, y - 14); g.lineTo(x, y); g.lineTo(x + 10, y - 14); g.fill()
      g.fillStyle = '#fff'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.fillText(String(k + 1), x, y - 20)
    })
    const [dx, dy] = P[n]
    g.fillStyle = '#fff'; g.beginPath(); g.arc(dx, dy, 14, 0, 7); g.fill()
    g.fillStyle = accent; g.beginPath(); g.arc(dx, dy, 8, 0, 7); g.fill()
    g.fillStyle = '#ededed'; g.font = 'bold 54px sans-serif'; g.textAlign = 'center'
    if (logo) g.drawImage(logo, W / 2 - 60, 30, 120, 120 * logo.height / logo.width); else g.fillText('Summit Trail', W / 2, 110)
    g.fillStyle = '#d0d0d0'; g.font = '32px sans-serif'; g.fillText(label, W / 2, 230)
    g.fillStyle = accent; g.font = 'bold 110px sans-serif'
    g.fillText(`${(cum[n] / 1000).toFixed(2)} km`, W / 2, 1120)
    g.fillStyle = '#8e8e8e'; g.font = '30px sans-serif'; g.fillText(`of ${(total / 1000).toFixed(2)} km`, W / 2, 1175)
  }

  const mime = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find(t => MediaRecorder.isTypeSupported(t))
  if (!mime) throw new Error('Video recording is not supported on this device')
  const rec = new MediaRecorder(c.captureStream(30), { mimeType: mime, videoBitsPerSecond: 4_000_000 })
  const chunks: Blob[] = []
  rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }
  const done = new Promise<Blob>(res => { rec.onstop = () => res(new Blob(chunks, { type: mime.split(';')[0] })) })
  draw(0); rec.start()
  const t0 = performance.now()
  await new Promise<void>(res => {
    const f = (t: number) => { const p = Math.min(1, (t - t0) / 8000); draw(p); p < 1 ? requestAnimationFrame(f) : res() }
    requestAnimationFrame(f)
  })
  await new Promise(r => setTimeout(r, 200)); rec.stop()
  return { blob: await done, ext: mime.includes('mp4') ? 'mp4' : 'webm' }
}

export async function saveVideo(blob: Blob, name: string) {
  if (Capacitor.isNativePlatform()) {
    const data = await new Promise<string>((res, rej) => {
      const r = new FileReader()
      r.onload = () => res(String(r.result).split(',')[1]); r.onerror = () => rej(r.error)
      r.readAsDataURL(blob)
    })
    const f = await Filesystem.writeFile({ path: name, data, directory: Directory.Cache })
    await Share.share({ title: 'Summit Trail replay', files: [f.uri] })
  } else {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click()
  }
}

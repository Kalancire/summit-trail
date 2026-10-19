import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { hav, type Pt } from './core'

/** Draws the route replay on a canvas and records it (MP4 where the device supports it, else WebM). */
export async function renderVideo(route: Pt[], accent: string, label: string) {
  const W = 720, H = 1280
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const g = c.getContext('2d')!
  const lat0 = route.reduce((s, p) => s + p.lat, 0) / route.length, k = Math.cos((lat0 * Math.PI) / 180)
  const xs = route.map(p => p.lng * k), ys = route.map(p => -p.lat)
  const minX = Math.min(...xs), minY = Math.min(...ys)
  const sc = Math.min(560 / (Math.max(...xs) - minX || 1e-6), 640 / (Math.max(...ys) - minY || 1e-6))
  const offX = (W - (Math.max(...xs) - minX) * sc) / 2, offY = 330 + (640 - (Math.max(...ys) - minY) * sc) / 2
  const P = route.map((_, i) => [offX + (xs[i] - minX) * sc, offY + (ys[i] - minY) * sc] as const)
  const cum = [0]; for (let i = 1; i < route.length; i++) cum.push(cum[i - 1] + hav(route[i - 1], route[i]))
  const total = cum[cum.length - 1] || 1

  const draw = (t: number) => {
    const n = Math.max(1, Math.round(t * (P.length - 1)))
    g.fillStyle = '#2b2b2b'; g.fillRect(0, 0, W, H)
    g.lineCap = 'round'; g.lineJoin = 'round'
    g.lineWidth = 10; g.strokeStyle = '#3d3d3d'
    g.beginPath(); P.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke()
    g.strokeStyle = accent; g.lineWidth = 12
    g.beginPath(); P.slice(0, n + 1).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke()
    const [dx, dy] = P[n]
    g.fillStyle = '#fff'; g.beginPath(); g.arc(dx, dy, 14, 0, 7); g.fill()
    g.fillStyle = accent; g.beginPath(); g.arc(dx, dy, 8, 0, 7); g.fill()
    g.fillStyle = '#ededed'; g.font = 'bold 54px sans-serif'; g.textAlign = 'center'
    g.fillText('Summit Trail', W / 2, 150)
    g.fillStyle = '#8e8e8e'; g.font = '32px sans-serif'; g.fillText(label, W / 2, 205)
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

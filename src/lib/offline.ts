import { Geolocation } from '@capacitor/geolocation'

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services'
const LAYERS = [
  `${ESRI}/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
  `${ESRI}/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`,
  'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
]
export const lastOffline = () => { try { return JSON.parse(localStorage.getItem('st.offline') || 'null') as { n: number; at: number } | null } catch { return null } }

// downloads map tiles around the user's position (about 8 km); the service worker keeps them for offline use
export async function downloadOffline(onProgress: (done: number, total: number) => void) {
  const { coords } = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 15000 })
  const dLat = 8 / 111, dLng = 8 / (111 * Math.cos((coords.latitude * Math.PI) / 180)), urls: string[] = []
  for (let z = 10; z <= 15; z++) {
    const n = 2 ** z, tx = (g: number) => Math.floor(((g + 180) / 360) * n)
    const ty = (a: number) => Math.floor((0.5 - Math.log(Math.tan(Math.PI / 4 + (a * Math.PI) / 360)) / (2 * Math.PI)) * n)
    for (let x = tx(coords.longitude - dLng); x <= tx(coords.longitude + dLng); x++)
      for (let y = ty(coords.latitude + dLat); y <= ty(coords.latitude - dLat); y++)
        for (const L of LAYERS) urls.push(L.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y)))
  }
  const list = urls.slice(0, 1500); let i = 0, done = 0
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (i < list.length) { await fetch(list[i++]).catch(() => 0); onProgress(++done, list.length) }
  }))
  localStorage.setItem('st.offline', JSON.stringify({ n: list.length, at: Date.now() }))
  return list.length
}

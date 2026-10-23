import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { addProtocol } from 'maplibre-gl'

// Offline map tiles for the native apps (iOS and Android).
// iOS WKWebView cannot run service workers, so on a phone we store tiles as files with @capacitor/filesystem
// and hand them to MapLibre through a custom "stc://" protocol. On the web the old service worker still does the job.

const native = Capacitor.isNativePlatform()
const PREFIX = 'stc://'
const DIR = 'tiles'
// Google tiles are never cached (their terms); only these hosts are stored
const HOSTS = ['tile.openstreetmap.org', 'server.arcgisonline.com', 'services.arcgisonline.com', 's3.amazonaws.com']
const MAX_FILES = 8000

const cacheable = (u: string) => { try { return HOSTS.some(h => new URL(u).hostname.endsWith(h)) } catch { return false } }

/** Wrap a tile URL template so MapLibre loads it through the cache (no-op on the web and for Google tiles). */
export const viaCache = (u: string) => (native && cacheable(u) ? PREFIX + u : u)

// short stable file name for a URL
function key(url: string) {
  let a = 5381, b = 52711
  for (let i = 0; i < url.length; i++) { const c = url.charCodeAt(i); a = (a * 33) ^ c; b = (b * 31 + c) | 0 }
  return `${(a >>> 0).toString(36)}${(b >>> 0).toString(36)}${url.length.toString(36)}`
}
const b64ToBuf = (s: string) => {
  const bin = atob(s), out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out.buffer
}
const bufToB64 = (buf: ArrayBuffer) => {
  const u = new Uint8Array(buf); let s = ''
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000))
  return btoa(s)
}

let ready: Promise<unknown> | null = null
const ensureDir = () => (ready ??= Filesystem.mkdir({ path: DIR, directory: Directory.Data, recursive: true }).catch(() => {}))

async function read(url: string): Promise<ArrayBuffer | null> {
  try {
    const r = await Filesystem.readFile({ path: `${DIR}/${key(url)}`, directory: Directory.Data })
    return b64ToBuf(r.data as string)
  } catch { return null }
}
async function write(url: string, buf: ArrayBuffer) {
  await ensureDir()
  await Filesystem.writeFile({ path: `${DIR}/${key(url)}`, data: bufToB64(buf), directory: Directory.Data }).catch(() => {})
}
async function has(url: string) {
  try { await Filesystem.stat({ path: `${DIR}/${key(url)}`, directory: Directory.Data }); return true } catch { return false }
}

async function trim() {
  try {
    const { files } = await Filesystem.readdir({ path: DIR, directory: Directory.Data })
    if (files.length <= MAX_FILES) return
    const old = [...files].sort((x, y) => (x.mtime ?? 0) - (y.mtime ?? 0)).slice(0, 500)
    await Promise.all(old.map(f => Filesystem.deleteFile({ path: `${DIR}/${f.name}`, directory: Directory.Data }).catch(() => {})))
  } catch { /* nothing cached yet */ }
}

let registered = false
/** Call once, before the first map is created. */
export function registerTileProtocol() {
  if (!native || registered) return
  registered = true
  let writes = 0
  addProtocol('stc', async (params, abort) => {
    const url = params.url.slice(PREFIX.length)
    const hit = await read(url)
    if (hit) return { data: hit }
    const res = await fetch(url, { signal: abort.signal })
    if (!res.ok) throw new Error(`Tile ${res.status}`)
    const data = await res.arrayBuffer()
    write(url, data.slice(0)).then(() => { if (++writes % 400 === 0) trim() })
    return { data }
  })
}

/** Download a list of tile URLs into the cache (native). On the web it just fetches them so the service worker keeps them. */
export async function prefetchTiles(urls: string[], onProgress?: (done: number, total: number) => void) {
  let i = 0, done = 0
  const total = urls.length
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (i < total) {
      const u = urls[i++]
      try {
        if (native && cacheable(u)) {
          if (!(await has(u))) {
            const r = await fetch(u)
            if (r.ok) await write(u, await r.arrayBuffer())
          }
        } else await fetch(u)
      } catch { /* skip a failed tile */ }
      onProgress?.(++done, total)
    }
  }))
  if (native) trim()
  return total
}

/** Remove every saved tile (native). */
export async function clearTiles() {
  if (!native) return
  await Filesystem.rmdir({ path: DIR, directory: Directory.Data, recursive: true }).catch(() => {})
  ready = null
}

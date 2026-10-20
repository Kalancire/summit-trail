const C = 'tiles-v2'
const HOSTS = ['tile.openstreetmap.org', 'server.arcgisonline.com', 's3.amazonaws.com'] // Google tiles are not cached (their terms)
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== C) await caches.delete(k)
  await self.clients.claim()
})()))
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url)
  if (e.request.method !== 'GET' || !HOSTS.some(h => u.hostname.endsWith(h))) return
  e.respondWith((async () => {
    const c = await caches.open(C)
    const hit = await c.match(e.request)
    if (hit) return hit
    try {
      const r = await fetch(e.request)
      if (r.ok) { c.put(e.request, r.clone()); trim(c) }
      return r
    } catch { return Response.error() }
  })())
})
async function trim(c) {
  const ks = await c.keys()
  if (ks.length > 8000) for (const k of ks.slice(0, 300)) await c.delete(k)
}

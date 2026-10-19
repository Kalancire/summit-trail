import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Layers } from 'lucide-react'
import type { Pt } from '../lib/core'
import { GKEY, gTiles } from '../lib/gmaps'

const SRC: Record<string, { tiles: string[]; attr: string }> = {
  dark: { tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', 'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'], attr: '© OpenStreetMap © CARTO' },
  street: { tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], attr: '© OpenStreetMap' },
  sat: { tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], attr: 'Esri' },
}
const KINDS = GKEY ? ['gdark', 'groad', 'gsat', 'dark'] : ['dark', 'street', 'sat']
const tilesFor = (k: string) => (k.startsWith('g') ? gTiles(k) : Promise.resolve(SRC[k]))
const styleFor = (t: { tiles: string[]; attr: string }): maplibregl.StyleSpecification => ({
  version: 8,
  sources: { b: { type: 'raster', tiles: t.tiles, tileSize: 256, attribution: t.attr } },
  layers: [{ id: 'b', type: 'raster', source: 'b' }],
})
const FALLBACK: Record<string, string> = { gdark: 'dark', groad: 'street', gsat: 'sat', dark: 'street', street: 'sat' }
const line = (r: Pt[]) => ({
  type: 'Feature' as const, properties: {},
  geometry: { type: 'LineString' as const, coordinates: r.map(p => [p.lng, p.lat]) },
})
function fit(m: maplibregl.Map, r: Pt[]) {
  if (!r.length) return
  const b = new maplibregl.LngLatBounds([r[0].lng, r[0].lat], [r[0].lng, r[0].lat])
  r.forEach(p => b.extend([p.lng, p.lat]))
  m.fitBounds(b, { padding: 50, duration: 0, maxZoom: 17 })
}

export default function MapView({ route, follow, cursor, controls = true, inline, className = '' }: {
  inline?: boolean;
  route: Pt[]; follow?: boolean; cursor?: Pt | null; controls?: boolean; className?: string
}) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const dot = useRef<maplibregl.Marker | null>(null)
  const live = useRef({ route, follow })
  live.current = { route, follow }
  const first = useRef(true)
  const [kind, setKind] = useState('dark')
  const [d3, setD3] = useState(false), [err, setErr] = useState('')
  const kindRef = useRef(kind); kindRef.current = kind
  const loaded = useRef(0), errs = useRef(0)

  useEffect(() => {
    const m = new maplibregl.Map({ container: el.current!, style: styleFor(SRC.dark), center: [120.9, 14.9], zoom: 11, attributionControl: false })
    map.current = m
    m.on('data', e => { if ((e as unknown as { tile?: unknown }).tile) { loaded.current++; setErr('') } })
    m.on('error', e => {
      errs.current++
      if (loaded.current > 0 || errs.current < 3) return
      if (!navigator.onLine) { setErr('Offline: map tiles unavailable. Your route is still being recorded.'); return }
      const next = FALLBACK[kindRef.current]
      if (next) setKind(next)
      else setErr(((e.error as Error | undefined)?.message || 'Map tiles failed to load').slice(0, 90))
    })
    m.on('style.load', () => {
      if (m.getSource('r')) return
      m.addSource('r', { type: 'geojson', data: line(live.current.route) })
      m.addLayer({
        id: 'r', type: 'line', source: 'r', layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#ff7a1a', 'line-width': 5 },
      })
      if (!live.current.follow) fit(m, live.current.route)
    })
    return () => { m.remove(); map.current = null }
  }, [])

  useEffect(() => {
    const m = map.current
    if (!m) return
    ;(m.getSource('r') as maplibregl.GeoJSONSource | undefined)?.setData(line(route))
    const last = route[route.length - 1]
    if (follow && last) m.easeTo({ center: [last.lng, last.lat], zoom: Math.max(m.getZoom(), 16), duration: 800 })
    else if (!follow && m.isStyleLoaded()) fit(m, route)
  }, [route, follow])

  useEffect(() => {
    const m = map.current
    if (!m) return
    if (!cursor) { dot.current?.remove(); dot.current = null; return }
    if (!dot.current) {
      const e = document.createElement('div')
      e.style.cssText = 'width:18px;height:18px;border-radius:50%;background:var(--accent);border:3px solid #fff;box-shadow:0 0 12px var(--accent)'
      dot.current = new maplibregl.Marker({ element: e }).setLngLat([cursor.lng, cursor.lat]).addTo(m)
    } else dot.current.setLngLat([cursor.lng, cursor.lat])
  }, [cursor])

  useEffect(() => {
    if (first.current) { first.current = false; return }
    loaded.current = 0; errs.current = 0
    tilesFor(kind).then(t => map.current?.setStyle(styleFor(t))).catch(() => setKind('dark'))
  }, [kind])

  useEffect(() => { if (GKEY) setKind('gdark') }, [])

  useEffect(() => {
    const r = live.current.route
    map.current?.easeTo({ pitch: d3 ? 60 : 0, bearing: d3 && r.length > 1 ? (Math.atan2(r[r.length - 1].lng - r[0].lng, r[r.length - 1].lat - r[0].lat) * 180) / Math.PI : 0, duration: 700 })
  }, [d3])

  return (
    <div className={`${/\b(absolute|fixed)\b/.test(className) ? '' : 'relative'} ${className}`}>
      <div ref={el} style={{ position: 'absolute', inset: 0 }} />
      {err && <div className="card absolute inset-x-6 top-1/3 z-10 rounded-2xl p-4 text-center text-sm">{navigator.onLine ? 'Map could not load. Check your internet connection.' : 'No map tiles offline.'}<span className="mt-1 block text-xs text-mute">{err}</span></div>}
      {controls && (
        <div className={`card absolute right-3 z-10 ${inline ? 'top-3' : 'top-[max(env(safe-area-inset-top),1rem)]'} flex flex-col gap-2 rounded-2xl p-1.5`}>
          <button onClick={() => setD3(v => !v)} className="grid size-10 place-items-center rounded-full bg-accent/15 text-sm font-bold text-accent">{d3 ? '3D' : '2D'}</button>
          <button onClick={() => setKind(KINDS[(KINDS.indexOf(kind) + 1) % KINDS.length])} className="grid size-10 place-items-center rounded-full bg-accent/15 text-accent"><Layers className="size-5" /></button>
        </div>
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Download, Layers } from 'lucide-react'
import { WP_EMOJI, WP_LABEL, type Cp, type Pt, type Wp } from '../lib/core'
import { GKEY, gTiles } from '../lib/gmaps'
import { prefetchTiles, registerTileProtocol, viaCache } from '../lib/tilecache'

registerTileProtocol()

type Src = { tiles: string[]; attr: string; ref?: string[]; maxzoom?: number; earth?: boolean }
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services'
// free sources that need no API key (CARTO now requires one)
const SRC: Record<string, Src> = {
  dark: { tiles: [`${ESRI}/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`], ref: [`${ESRI}/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`], attr: 'Tiles © Esri', maxzoom: 16 },
  street: { tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], attr: '© OpenStreetMap' },
  sat: { tiles: [`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`], attr: 'Esri' },
  // Google-Earth-style: satellite + free 3D terrain (AWS Terrarium) + globe
  earth: { tiles: [`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`], ref: [`${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`], attr: 'Esri · Terrain: AWS/Mapzen', earth: true },
}
const KINDS = GKEY ? ['gdark', 'groad', 'gsat', 'earth', 'dark'] : ['dark', 'street', 'sat', 'earth']
const tilesFor = (k: string) => (k.startsWith('g') ? gTiles(k) : Promise.resolve(SRC[k]))
const styleFor = (t: Src): maplibregl.StyleSpecification => ({
  version: 8,
  sources: {
    b: { type: 'raster', tiles: t.tiles.map(viaCache), tileSize: 256, attribution: t.attr, maxzoom: t.maxzoom ?? 19 },
    ...(t.ref ? { l: { type: 'raster' as const, tiles: t.ref.map(viaCache), tileSize: 256, maxzoom: t.maxzoom ?? 19 } } : {}),
    ...(t.earth ? { dem: { type: 'raster-dem' as const, tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'].map(viaCache), tileSize: 256, maxzoom: 14, encoding: 'terrarium' as const } } : {}),
  },
  ...(t.earth ? { terrain: { source: 'dem', exaggeration: 2 }, projection: { type: 'globe' as const } } : {}),
  layers: [{ id: 'b', type: 'raster', source: 'b' }, ...(t.ref ? [{ id: 'l', type: 'raster' as const, source: 'l' }] : [])],
})
// real 3D terrain on any map style (free AWS Terrarium elevation tiles)
const applyTerrain = (m: maplibregl.Map, on: boolean) => {
  try {
    if (on) {
      if (!m.getSource('dem')) m.addSource('dem', { type: 'raster-dem', tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'].map(viaCache), tileSize: 256, maxzoom: 14, encoding: 'terrarium' })
      m.setTerrain({ source: 'dem', exaggeration: 2 })
    } else m.setTerrain(null)
  } catch (e) { console.warn('terrain', e) }
}
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

const PIN = (n: number | string, c: string) => `<svg width="34" height="44" viewBox="0 0 34 44" style="filter:drop-shadow(0 3px 3px rgba(0,0,0,.5))"><path d="M17 1C8 1 1 8 1 17c0 12 16 26 16 26s16-14 16-26C33 8 26 1 17 1z" fill="${c}" stroke="#fff" stroke-width="2"/><text x="17" y="22" text-anchor="middle" font-size="14" font-weight="700" fill="#fff" font-family="sans-serif">${n}</text></svg>`
const feats = (r: Pt[]) => ({ type: 'FeatureCollection' as const, features: r.map(p => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] } })) })
const dotEl = (bg: string, pulse = false) => {
  const e = document.createElement('div')
  e.style.cssText = `width:16px;height:16px;border-radius:50%;background:${bg};border:3px solid #fff;box-shadow:0 0 0 0 ${bg};${pulse ? 'animation:st-pulse 1.8s infinite;' : ''}`
  return e
}

export default function MapView({ route, follow, cursor, me, cps = [], controls = true, inline, className = '', ghost = [], guide = [], wps = [], showPts, noFit, center, onTap, onWp }: {
  inline?: boolean;
  route: Pt[]; follow?: boolean; cursor?: Pt | null; me?: { lat: number; lng: number } | null; cps?: Cp[]; controls?: boolean; className?: string
  ghost?: Pt[]      // a trail being followed (dashed)
  guide?: Pt[]      // the way back (backtrack mode)
  wps?: Wp[]        // trail waypoints (water, viewpoint, campsite, hazard)
  showPts?: boolean // dots on every tapped point (draw mode)
  noFit?: boolean   // do not re-centre when the route changes (draw mode)
  center?: [number, number]
  onTap?: (lng: number, lat: number) => void
  onWp?: (i: number) => void
}) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const dot = useRef<maplibregl.Marker | null>(null)
  const live = useRef({ route, follow, ghost, guide, showPts, noFit })
  live.current = { route, follow, ghost, guide, showPts, noFit }
  const tapRef = useRef(onTap); tapRef.current = onTap
  const wpRef = useRef(onWp); wpRef.current = onWp
  const wpPins = useRef<maplibregl.Marker[]>([])
  const first = useRef(true)
  const meDot = useRef<maplibregl.Marker | null>(null)
  const ends = useRef<maplibregl.Marker[]>([])
  const pins = useRef<maplibregl.Marker[]>([])
  const [kind, setKind] = useState('dark')
  const [d3, setD3] = useState(false), [err, setErr] = useState(''), [toast, setToast] = useState('')
  const saveOffline = async () => {
    const m = map.current; if (!m) return
    if (kind.startsWith('g')) { setToast('Google maps cannot be saved offline. Switch to another layer first.'); setTimeout(() => setToast(''), 3000); return }
    const t = (await tilesFor(kind)) as Src, b = m.getBounds(), z0 = Math.floor(m.getZoom()), urls: string[] = []
    for (let z = Math.max(10, z0 - 1); z <= Math.min(16, z0 + 2); z++) {
      const n = 2 ** z, tx = (g: number) => Math.floor(((g + 180) / 360) * n)
      const ty = (a: number) => Math.floor((0.5 - Math.log(Math.tan(Math.PI / 4 + (a * Math.PI) / 360)) / (2 * Math.PI)) * n)
      for (let x = tx(b.getWest()); x <= tx(b.getEast()); x++) for (let y = ty(b.getNorth()); y <= ty(b.getSouth()); y++)
        urls.push(t.tiles[0].replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y)))
    }
    const list = urls.slice(0, 600)
    setToast(`Saving ${list.length} map tiles…`)
    await prefetchTiles(list)
    setToast('Area saved for offline use'); setTimeout(() => setToast(''), 2500)
  }
  const kindRef = useRef(kind); kindRef.current = kind
  const d3Ref = useRef(d3); d3Ref.current = d3
  const loaded = useRef(0), errs = useRef(0)

  useEffect(() => {
    const m = new maplibregl.Map({ container: el.current!, style: styleFor(SRC.dark), center: center ?? [120.9, 14.9], zoom: center ? 15 : 11, attributionControl: false })
    map.current = m
    m.on('click', e => tapRef.current?.(e.lngLat.lng, e.lngLat.lat))
    m.on('data', e => { if ((e as unknown as { tile?: unknown }).tile) { loaded.current++; setErr('') } })
    m.on('error', e => {
      errs.current++
      if (loaded.current > 0 || errs.current < 3) return
      if (!navigator.onLine) { setErr('Offline: map tiles unavailable. Your route is still being recorded.'); return }
      const next = FALLBACK[kindRef.current]
      if (next) setKind(next)
      else setErr(((e.error as Error | undefined)?.message || 'Map tiles failed to load').slice(0, 90))
    })
    const ensure = () => {
      if (m.getSource('r')) return
      m.addSource('g', { type: 'geojson', data: line(live.current.ghost) })
      m.addLayer({ id: 'gc', type: 'line', source: 'g', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#fff', 'line-width': 5, 'line-opacity': 0.75, 'line-dasharray': [1.5, 1.5] } })
      m.addSource('r', { type: 'geojson', data: line(live.current.route) })
      m.addLayer({ id: 'rc', type: 'line', source: 'r', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#000', 'line-opacity': 0.55, 'line-width': 9 } })
      m.addLayer({
        id: 'r', type: 'line', source: 'r', layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#ff7a1a', 'line-width': 5.5 },
      })
      m.addSource('bk', { type: 'geojson', data: line(live.current.guide) })
      m.addLayer({ id: 'bk', type: 'line', source: 'bk', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#3b82f6', 'line-width': 6, 'line-dasharray': [0.5, 1.5] } })
      m.addSource('pts', { type: 'geojson', data: feats(live.current.showPts ? live.current.route : []) })
      m.addLayer({ id: 'pts', type: 'circle', source: 'pts', paint: { 'circle-radius': 6, 'circle-color': '#fff', 'circle-stroke-width': 3, 'circle-stroke-color': '#ef4444' } })
      if (!live.current.follow && !live.current.noFit) fit(m, live.current.route.length ? live.current.route : live.current.ghost)
    }
    m.on('style.load', () => { applyTerrain(m, d3Ref.current); ensure() })
    m.on('styledata', () => { if (!m.getSource('r') && m.isStyleLoaded()) ensure() })
    return () => { m.remove(); map.current = null }
  }, [])

  useEffect(() => {
    const m = map.current
    if (!m) return
    ;(m.getSource('r') as maplibregl.GeoJSONSource | undefined)?.setData(line(route))
    const last = me ?? route[route.length - 1]
    if (follow && last) m.easeTo({ center: [last.lng, last.lat], zoom: Math.max(m.getZoom(), 16), duration: 800 })
    else if (!follow && !noFit && m.isStyleLoaded()) fit(m, route.length ? route : ghost)
    ends.current.forEach(x => x.remove()); ends.current = []
    if (route.length > 1) {
      const s = route[0], e = route[route.length - 1]
      ends.current = [dotEl('#18b87a'), ...(follow ? [] : [dotEl('#ef4444')])].map((el, i) => new maplibregl.Marker({ element: el }).setLngLat(i ? [e.lng, e.lat] : [s.lng, s.lat]).addTo(m))
    }
    ;(m.getSource('pts') as maplibregl.GeoJSONSource | undefined)?.setData(feats(showPts ? route : []))
  }, [route, follow, me, showPts, noFit])

  useEffect(() => { (map.current?.getSource('g') as maplibregl.GeoJSONSource | undefined)?.setData(line(ghost)) }, [ghost])
  useEffect(() => { (map.current?.getSource('bk') as maplibregl.GeoJSONSource | undefined)?.setData(line(guide)) }, [guide])
  useEffect(() => { if (center) map.current?.easeTo({ center, zoom: Math.max(map.current.getZoom(), 15), duration: 600 }) }, [center?.[0], center?.[1]])
  useEffect(() => {
    const m = map.current
    if (!m) return
    wpPins.current.forEach(x => x.remove())
    wpPins.current = wps.map((w, i) => {
      const el = document.createElement('div')
      el.title = WP_LABEL[w.kind]
      el.style.cssText = 'width:34px;height:34px;border-radius:50%;background:#2b2b2b;border:3px solid #e8912d;display:grid;place-items:center;font-size:17px;box-shadow:0 3px 6px rgba(0,0,0,.5);cursor:pointer'
      el.textContent = WP_EMOJI[w.kind]
      el.onclick = ev => { ev.stopPropagation(); wpRef.current?.(i) }
      return new maplibregl.Marker({ element: el }).setLngLat([w.lng, w.lat]).addTo(m)
    })
  }, [wps])

  useEffect(() => {
    const m = map.current
    if (!m) return
    if (!me) { meDot.current?.remove(); meDot.current = null; return }
    if (!meDot.current) meDot.current = new maplibregl.Marker({ element: dotEl('#3b82f6', true) }).setLngLat([me.lng, me.lat]).addTo(m)
    else meDot.current.setLngLat([me.lng, me.lat])
  }, [me])

  useEffect(() => {
    const m = map.current
    if (!m) return
    pins.current.forEach(x => x.remove())
    pins.current = cps.map((c, i) => {
      const el = document.createElement('div'); el.innerHTML = PIN(c.kind ? WP_EMOJI[c.kind] : i + 1, '#e8912d')
      return new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([c.lng, c.lat]).addTo(m)
    })
  }, [cps])

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
    tilesFor(kind).then(t => { map.current?.setStyle(styleFor(t as Src), { diff: false }); if ((t as Src).earth) setD3(true) }).catch(() => setKind('dark'))
  }, [kind])

  useEffect(() => { if (GKEY) setKind('gdark') }, [])

  useEffect(() => {
    const r = live.current.route
    if (map.current) applyTerrain(map.current, d3)
    map.current?.easeTo({ pitch: d3 ? 65 : 0, bearing: d3 && r.length > 1 ? (Math.atan2(r[r.length - 1].lng - r[0].lng, r[r.length - 1].lat - r[0].lat) * 180) / Math.PI : 0, duration: 700 })
  }, [d3])

  return (
    <div className={`${/\b(absolute|fixed)\b/.test(className) ? '' : 'relative'} ${className}`}>
      <div ref={el} style={{ position: 'absolute', inset: 0 }} />
      {toast && <div className="card absolute inset-x-6 top-24 z-10 rounded-2xl p-3 text-center text-sm">{toast}</div>}
      {err && <div className="card absolute inset-x-6 top-1/3 z-10 rounded-2xl p-4 text-center text-sm">{navigator.onLine ? 'Map could not load. Check your internet connection.' : 'No map tiles offline.'}<span className="mt-1 block text-xs text-mute">{err}</span></div>}
      {controls && (
        <div className={`card absolute right-3 z-10 ${inline ? 'top-3' : 'top-[max(env(safe-area-inset-top),1rem)]'} flex flex-col gap-2 rounded-2xl p-1.5`}>
          <button onClick={saveOffline} className="grid size-10 place-items-center rounded-full bg-accent/15 text-accent"><Download className="size-5" /></button>
          <button onClick={() => setD3(v => !v)} className="grid size-10 place-items-center rounded-full bg-accent/15 text-sm font-bold text-accent">{d3 ? '3D' : '2D'}</button>
          <button onClick={() => setKind(KINDS[(KINDS.indexOf(kind) + 1) % KINDS.length])} className="grid size-10 place-items-center rounded-full bg-accent/15 text-accent"><Layers className="size-5" /></button>
        </div>
      )}
    </div>
  )
}

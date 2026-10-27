import { getSettings } from './store'
import type { Peak } from './core'

// ---- messages ----
const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
export const smsHref = (phone: string, body: string) => `sms:${phone.replace(/[^\d+]/g, '')}${ios ? '&' : '?'}body=${encodeURIComponent(body)}`
export const mapsLink = (lat: number, lng: number) => `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`
export const say = (text: string) => {
  if (getSettings().voice === false || !('speechSynthesis' in window)) return
  try { speechSynthesis.speak(new SpeechSynthesisUtterance(text)) } catch { /* no speech */ }
}
export const buzz = () => navigator.vibrate?.([200, 100, 200])

// ---- sunset (NOAA method, works offline) ----
function setAt(lat: number, lng: number, base: number) {
  const R = Math.PI / 180, b = new Date(base), day = Math.floor((Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()) - Date.UTC(b.getUTCFullYear(), 0, 0)) / 864e5)
  const lh = lng / 15, t = day + (18 - lh) / 24, M = 0.9856 * t - 3.289
  const L = (((M + 1.916 * Math.sin(M * R) + 0.02 * Math.sin(2 * M * R) + 282.634) % 360) + 360) % 360
  let RA = (((Math.atan(0.91764 * Math.tan(L * R)) / R) % 360) + 360) % 360
  RA = (RA + (Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90)) / 15
  const sd = 0.39782 * Math.sin(L * R), cd = Math.cos(Math.asin(sd))
  const ch = (Math.cos(90.833 * R) - sd * Math.sin(lat * R)) / (cd * Math.cos(lat * R))
  if (ch > 1 || ch < -1) return null
  const H = Math.acos(ch) / R / 15, T = H + RA - 0.06571 * t - 6.622
  return Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()) + ((((T - lh) % 24) + 24) % 24) * 3600000
}
/** The next sunset (ms) at this place, or null in polar day/night. */
export function nextSunset(lat: number, lng: number, now = Date.now()) {
  const c = [-1, 0, 1].map(d => setAt(lat, lng, now + d * 864e5)).filter((x): x is number => x !== null && x >= now - 60000)
  return c.length ? Math.min(...c) : null
}

// ---- battery (not available in iOS WebView) ----
type Bat = { level: number; charging: boolean; addEventListener: (e: string, f: () => void) => void; removeEventListener: (e: string, f: () => void) => void }
export function watchBattery(cb: (level: number, charging: boolean) => void) {
  const nav = navigator as unknown as { getBattery?: () => Promise<Bat> }
  if (!nav.getBattery) return () => {}
  let b: Bat | null = null, dead = false
  const f = () => b && cb(b.level, b.charging)
  nav.getBattery().then(x => { if (dead) return; b = x; x.addEventListener('levelchange', f); x.addEventListener('chargingchange', f); f() }).catch(() => {})
  return () => { dead = true; b?.removeEventListener('levelchange', f); b?.removeEventListener('chargingchange', f) }
}

// ---- weather (Open-Meteo, free, no key) ----
export type Wx = { at: number; temp: number; code: number; wind: number; raining: boolean; gust?: number; storm?: string; rainChance: number; rainHour: string; lat: number; lng: number }
const WMO: [number, string, string][] = [[0, '☀️', 'Clear'], [2, '⛅', 'Partly cloudy'], [3, '☁️', 'Cloudy'], [48, '🌫️', 'Fog'], [57, '🌦️', 'Drizzle'], [67, '🌧️', 'Rain'], [77, '❄️', 'Snow'], [82, '🌧️', 'Showers'], [86, '❄️', 'Snow showers'], [99, '⛈️', 'Thunderstorm']]
export const wxLook = (code: number) => WMO.find(w => code <= w[0]) ?? WMO[WMO.length - 1]
export async function fetchWeather(lat: number, lng: number): Promise<Wx> {
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}&current=temperature_2m,weather_code,precipitation,wind_speed_10m,wind_gusts_10m&hourly=precipitation_probability,weather_code&forecast_days=2&timezone=auto`)
  if (!r.ok) throw new Error('Weather unavailable')
  const j = await r.json() as { current: { time: string; temperature_2m: number; weather_code: number; precipitation: number; wind_speed_10m: number; wind_gusts_10m?: number }; hourly: { time: string[]; precipitation_probability: number[]; weather_code?: number[] } }
  const hr = j.current.time.slice(0, 13), i0 = Math.max(0, j.hourly.time.findIndex(t => t.slice(0, 13) >= hr))
  let rainChance = 0, rainHour = ''
  for (let i = i0; i < i0 + 4 && i < j.hourly.time.length; i++) if (j.hourly.precipitation_probability[i] > rainChance) { rainChance = j.hourly.precipitation_probability[i]; rainHour = j.hourly.time[i].slice(11, 16) }
  let storm = ''
  for (let i = i0; i < i0 + 6 && i < j.hourly.time.length; i++) if ((j.hourly.weather_code?.[i] ?? 0) >= 95) { storm = j.hourly.time[i].slice(11, 16); break }
  const wx: Wx = { gust: Math.round(j.current.wind_gusts_10m ?? 0), storm, at: Date.now(), temp: Math.round(j.current.temperature_2m), code: j.current.weather_code, wind: Math.round(j.current.wind_speed_10m), raining: j.current.precipitation > 0.1, rainChance, rainHour, lat, lng }
  try { localStorage.setItem('st.wx', JSON.stringify(wx)) } catch { /* storage full */ }
  return wx
}
export const lastWeather = (): Wx | null => { try { const w = JSON.parse(localStorage.getItem('st.wx') || 'null') as Wx | null; return w && Date.now() - w.at < 6 * 36e5 ? w : null } catch { return null } }
export const rainWarning = (w: Wx | null) => !w ? '' : (w.gust ?? 0) >= 90 ? `Typhoon-strength gusts (${w.gust} km/h). Do not hike. Get to shelter.` : w.storm || w.code >= 95 ? `Thunderstorm ${w.storm ? 'expected around ' + w.storm : 'at your location'}. Stay off ridges and summits.` : (w.gust ?? 0) >= 50 ? `Strong gusts up to ${w.gust} km/h. Take care on exposed ridges.` : w.raining ? 'It is raining at your location.' : w.rainChance >= 60 ? `Rain likely around ${w.rainHour} (${w.rainChance}%).` : ''

// ---- SOS ----
export const sosText = (lat: number, lng: number, alt?: number, peak?: Peak) =>
  `SOS from Summit Trail. I need help.\nLocation: ${mapsLink(lat, lng)}\nCoordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}${alt ? `\nAltitude: ${Math.round(alt)} m` : peak ? `\nAltitude: ${peak.alt} m` : ''}\nTime: ${new Date().toLocaleTimeString()}`

import { useEffect, useState } from 'react'
import { Geolocation } from '@capacitor/geolocation'
import { CloudRain, RefreshCw } from 'lucide-react'
import { fetchWeather, lastWeather, rainWarning, wxLook, type Wx } from '../lib/safety'
import { useOnline } from '../lib/net'

// Weather at your location (Open-Meteo, free) with a rain warning for the next few hours
export default function Weather() {
  const online = useOnline()
  const [wx, setWx] = useState<Wx | null>(lastWeather()), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false)
  const load = async (ask: boolean) => {
    setBusy(true); setMsg('')
    try {
      const perm = await Geolocation.checkPermissions().catch(() => null)
      if (perm?.location !== 'granted' && !ask) { setMsg('Tap to show weather at your location'); return }
      if (ask) await Geolocation.requestPermissions().catch(() => {})
      const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 })
      setWx(await fetchWeather(p.coords.latitude, p.coords.longitude))
    } catch { setMsg(online ? 'Could not get weather here' : 'Offline: showing the last weather') }
    finally { setBusy(false) }
  }
  useEffect(() => { if (online && (!wx || Date.now() - wx.at > 30 * 60000)) load(false) }, [online])
  const warn = rainWarning(wx), look = wx ? wxLook(wx.code) : null
  return (
    <div className="card mt-4 rounded-2xl p-3">
      <button onClick={() => load(true)} disabled={busy || !online} className="flex w-full items-center gap-3 text-left disabled:opacity-60">
        <span className="text-3xl">{look?.[1] ?? '🌤️'}</span>
        <span className="flex-1 text-sm">
          {wx && look ? <><b>{wx.temp}°C · {look[2]}</b><span className="block text-xs text-mute">Wind {wx.wind} km/h · updated {new Date(wx.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span></>
            : <><b>Weather</b><span className="block text-xs text-mute">{msg || 'Checking…'}</span></>}
        </span>
        <RefreshCw className={`size-4 text-mute ${busy ? 'animate-spin' : ''}`} />
      </button>
      {warn && <p className="mt-2 flex items-center gap-2 rounded-xl bg-blue-500/15 px-3 py-2 text-xs text-blue-300"><CloudRain className="size-4 shrink-0" /> {warn}</p>}
      {msg && wx && <p className="mt-1 text-xs text-mute">{msg}</p>}
    </div>
  )
}

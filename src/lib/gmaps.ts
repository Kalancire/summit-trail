export const GKEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined
type T = { tiles: string[]; attr: string }
const DARK = [{ stylers: [{ invert_lightness: true }, { saturation: -70 }, { lightness: -8 }] }]
const cache: Record<string, Promise<T>> = {}

export function gTiles(kind: string): Promise<T> {
  return (cache[kind] ??= (async () => {
    const body = kind === 'gsat' ? { mapType: 'satellite' } : { mapType: 'roadmap', ...(kind === 'gdark' ? { styles: DARK } : {}) }
    const r = await fetch(`https://tile.googleapis.com/v1/createSession?key=${GKEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, language: 'en-US', region: 'PH' }),
    })
    if (!r.ok) { delete cache[kind]; throw new Error('Google Maps key rejected') }
    const { session } = await r.json()
    return { tiles: [`https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=${session}&key=${GKEY}`], attr: 'Map data © Google' }
  })())
}

// Lava-lamp background: soft colour blobs that rise, drift and swell. Pure CSS (only transforms are animated), so it is cheap on phones.
const BLOBS = [
  { s: 78, l: -14, t: 52, k: 'lava2', d: 27, c: 1 }, { s: 66, l: 42, t: 58, k: 'lava1', d: 33, c: 2 },
  { s: 60, l: 6, t: 4, k: 'lava3', d: 30, c: 3 }, { s: 54, l: 52, t: 18, k: 'lava4', d: 36, c: 4 }, { s: 46, l: 26, t: 36, k: 'lava1', d: 24, c: 5 },
]
export default function Background() {
  return (
    <div className="bg-lava" aria-hidden="true">
      {BLOBS.map((b, i) => (
        <span key={i} className="blob" style={{
          width: `${b.s}vw`, height: `${b.s}vw`, left: `${b.l}%`, top: `${b.t}%`,
          background: `radial-gradient(circle at 35% 35%, var(--b${b.c}) 0%, color-mix(in srgb, var(--b${b.c}) 55%, transparent) 40%, transparent 70%)`,
          animationName: b.k, animationDuration: `calc(${b.d}s / var(--spd))`, animationDelay: `-${i * 6}s`,
        }} />
      ))}
    </div>
  )
}

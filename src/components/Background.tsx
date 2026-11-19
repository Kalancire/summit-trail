import { useEffect, useRef, useState } from 'react'
import { useSettings } from '../lib/store'
import { themeOf } from '../lib/themes'

// Soft "aurora" light clouds: big blurred colour glows that drift, overlap and breathe on a dark base (like a mesh gradient).
// Drawn by a tiny WebGL shader at half resolution, 30 fps, and paused while recording or when the app is hidden.
const VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'
const FS = `precision mediump float;
uniform vec2 uRes; uniform vec4 uB[7]; uniform vec3 uBC[7]; uniform vec3 uBase;
void main(){
  vec2 uv = gl_FragCoord.xy / uRes; float asp = uRes.x / uRes.y; vec2 p = vec2(uv.x * asp, uv.y);
  vec3 col = uBase;
  for (int i = 0; i < 7; i++) { vec2 d = (p - uB[i].xy) / uB[i].zw; col += uBC[i] * exp(-dot(d, d)) * 0.85; }
  col = 1.0 - exp(-col * 1.3);                                   // soft tone-map: overlaps blend instead of burning out
  col *= mix(0.72, 1.0, smoothstep(1.3, 0.2, length(uv - 0.5) * 1.2));
  col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 120.0;   // grain: no colour banding
  gl_FragColor = vec4(col, 1.0);
}`
// [x range, y range, x speed, y speed, x phase, y phase, width, height, colour]  (tall, soft clouds)
const BLOBS = [
  [0.38, 0.26, 0.10, 0.14, 0.0, 1.0, 0.40, 0.80, 0], [0.30, 0.30, 0.12, 0.09, 2.0, 0.0, 0.52, 0.46, 1], [0.26, 0.32, 0.14, 0.10, 4.0, 2.0, 0.32, 0.58, 2],
  [0.32, 0.28, 0.09, 0.12, 1.0, 5.0, 0.44, 0.84, 3], [0.30, 0.30, 0.11, 0.08, 3.0, 3.0, 0.36, 0.62, 4], [0.42, 0.36, 0.07, 0.10, 5.0, 4.0, 0.30, 0.52, 0],
  [0.36, 0.30, 0.08, 0.13, 2.0, 6.0, 0.32, 0.54, 3],
] as const
const rgb = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255)

function CssBlobs() {   // fallback for phones without WebGL
  const K = ['lava1', 'lava2', 'lava3', 'lava4', 'lava1']
  return (
    <div className="bg-lava" aria-hidden="true">
      {K.map((k, i) => <span key={i} className="blob" style={{ width: '60vw', height: '60vw', left: `${[-10, 45, 8, 55, 28][i]}%`, top: `${[52, 58, 4, 18, 36][i]}%`, background: `radial-gradient(circle at 35% 35%, var(--b${i + 1}), transparent 70%)`, animationName: k, animationDuration: `calc(${26 + i * 3}s / var(--spd))`, animationDelay: `-${i * 6}s` }} />)}
    </div>
  )
}

export default function Background() {
  const s = useSettings(), cv = useRef<HTMLCanvasElement>(null), st = useRef(s), redraw = useRef<() => void>(() => {}), [fb, setFb] = useState(false)
  st.current = s
  useEffect(() => {
    const el = cv.current; if (!el) return
    const gl = el.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' })
    if (!gl) { setFb(true); return }
    const mk = (type: number, src: string) => { const sh = gl.createShader(type)!; gl.shaderSource(sh, src); gl.compileShader(sh); return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null }
    const vs = mk(gl.VERTEX_SHADER, VS), fs = mk(gl.FRAGMENT_SHADER, FS), prog = gl.createProgram()!
    if (!vs || !fs) { setFb(true); return }
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { setFb(true); return }
    gl.useProgram(prog)
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const U = (n: string) => gl.getUniformLocation(prog, n)
    const uRes = U('uRes'), uB = U('uB[0]'), uBC = U('uBC[0]'), uBase = U('uBase')
    const size = () => { el.width = Math.max(2, Math.round(innerWidth * 0.5)); el.height = Math.max(2, Math.round(innerHeight * 0.5)); gl.viewport(0, 0, el.width, el.height) }
    size(); addEventListener('resize', size)
    let t = 30
    const draw = () => {
      const T = themeOf(st.current), asp = el.width / el.height, k = Math.min(1, asp * 1.1), B = new Float32Array(28), C = new Float32Array(21), cols = T.blobs.map(rgb)
      BLOBS.forEach((b, i) => {
        const w = b[6] * k * (1 + 0.12 * Math.sin(t * 0.5 + i)), h = b[7] * (1 + 0.1 * Math.cos(t * 0.4 + i * 2))
        B.set([asp * (0.5 + b[0] * Math.sin(t * b[2] + b[4])), 0.5 + b[1] * Math.sin(t * b[3] + b[5]), w, h], i * 4); C.set(cols[b[8]], i * 3)
      })
      gl.uniform2f(uRes, el.width, el.height); gl.uniform4fv(uB, B); gl.uniform3fv(uBC, C); gl.uniform3fv(uBase, rgb(T.base))
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
    redraw.current = draw; draw()
    const reduce = matchMedia('(prefers-reduced-motion: reduce)')
    let raf = 0, last = performance.now()
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      if (now - last < 32) return
      const dt = Math.min(0.1, (now - last) / 1000); last = now
      if (document.hidden || st.current.anim === false || document.documentElement.classList.contains('rec') || reduce.matches) return
      t += dt * (st.current.speed ?? 1) * 1.8; draw()
    }
    raf = requestAnimationFrame(frame)
    const lost = (e: Event) => { e.preventDefault(); setFb(true) }
    el.addEventListener('webglcontextlost', lost)
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', size); el.removeEventListener('webglcontextlost', lost) }
  }, [fb])
  useEffect(() => { redraw.current() }, [s.theme, s.custom, s.accent])   // repaint at once when the theme changes (also when the animation is off)
  return fb ? <CssBlobs /> : <canvas ref={cv} className="bg-gl" aria-hidden="true" />
}

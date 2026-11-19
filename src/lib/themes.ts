export type Theme = { id: string; name: string; emoji: string; base: string; accent: string; blobs: [string, string, string, string, string] }
export type Custom = { accent: string; base: string; c1: string; c2: string }

export const THEMES: Theme[] = [
  { id: 'lava', name: 'Lava', emoji: '🌋', base: '#1a0a08', accent: '#ff5a1f', blobs: ['#ff3d00', '#ff9100', '#d50000', '#ff6f00', '#b71c1c'] },
  { id: 'aurora', name: 'Aurora', emoji: '🌌', base: '#050818', accent: '#4f8bff', blobs: ['#0e9fb4', '#14b87a', '#b02468', '#6d4fe0', '#2f5bd8'] },
  { id: 'ocean', name: 'Ocean', emoji: '🌊', base: '#031325', accent: '#29b6f6', blobs: ['#0077b6', '#00b4d8', '#48cae4', '#023e8a', '#0096c7'] },
  { id: 'sunset', name: 'Sunset', emoji: '🌇', base: '#1d0f1f', accent: '#ff7a59', blobs: ['#ff5e62', '#ff9966', '#ffb347', '#c471ed', '#f64f59'] },
  { id: 'forest', name: 'Forest', emoji: '🌲', base: '#06150d', accent: '#4ade80', blobs: ['#1b5e20', '#43a047', '#00c853', '#2e7d32', '#76ff03'] },
  { id: 'galaxy', name: 'Galaxy', emoji: '🪐', base: '#0a0820', accent: '#a78bfa', blobs: ['#5e35b1', '#304ffe', '#d500f9', '#6a1b9a', '#00b0ff'] },
  { id: 'sakura', name: 'Sakura', emoji: '🌸', base: '#1f0d17', accent: '#f472b6', blobs: ['#ff80ab', '#f48fb1', '#ce93d8', '#ff4081', '#f8bbd0'] },
  { id: 'neon', name: 'Neon', emoji: '⚡', base: '#07070f', accent: '#22d3ee', blobs: ['#ff00e5', '#00f0ff', '#7000ff', '#00ff9d', '#ff0080'] },
  { id: 'candy', name: 'Candy', emoji: '🍬', base: '#1a0e22', accent: '#ff6bd6', blobs: ['#ff6bd6', '#6bf0ff', '#ffe66b', '#a06bff', '#6bffb0'] },
  { id: 'desert', name: 'Desert', emoji: '🏜️', base: '#1c1308', accent: '#f5b942', blobs: ['#d97706', '#f59e0b', '#b45309', '#fbbf24', '#92400e'] },
  { id: 'ember', name: 'Ember', emoji: '🔥', base: '#150606', accent: '#ef4444', blobs: ['#7f1d1d', '#dc2626', '#f97316', '#991b1b', '#fb923c'] },
  { id: 'midnight', name: 'Midnight', emoji: '🌙', base: '#0b0b10', accent: '#94a3b8', blobs: ['#334155', '#475569', '#1e293b', '#64748b', '#0f172a'] },
]
export const customTheme = (c: Custom): Theme => ({ id: 'custom', name: 'Custom', emoji: '🎨', base: c.base, accent: c.accent, blobs: [c.c1, c.c2, c.c1, c.c2, c.accent] })
export const DEFAULT_CUSTOM: Custom = { accent: '#ff4fd8', base: '#10081c', c1: '#7c3aed', c2: '#06b6d4' }
const LEGACY = ['aurora', 'ocean', 'forest', 'galaxy', 'sakura']   // old accent-colour setting

export function themeOf(s: { theme?: string; custom?: Custom; accent?: number }): Theme {
  if (s.theme === 'custom') return customTheme(s.custom ?? DEFAULT_CUSTOM)
  const id = s.theme ?? LEGACY[s.accent ?? 0] ?? 'aurora'
  return THEMES.find(t => t.id === id) ?? THEMES[0]
}

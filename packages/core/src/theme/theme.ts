export interface Palette {
  id: string
  label: string
  bg: string
  text: string
  muted: string
  border: string
}

export interface ThemeFont {
  id: string
  label: string
  stack: string
}

export type Density = 'tight' | 'normal' | 'roomy'

export interface Theme {
  palette: string
  accent: string
  font: string
  /** Köşe yuvarlaklığı, piksel. */
  radius: number
  density: Density
}

/** Sitenin zemini; accent'i kullanıcı ayrı seçer, o yüzden palet nötr kalır. */
export const PALETTES: Palette[] = [
  {
    id: 'paper',
    label: 'Paper',
    bg: '#faf9f5',
    text: '#1c1a17',
    muted: '#6b6558',
    border: '#e4e0d5',
  },
  {
    id: 'plain',
    label: 'Plain',
    bg: '#ffffff',
    text: '#18181b',
    muted: '#71717a',
    border: '#e4e4e7',
  },
  { id: 'ink', label: 'Ink', bg: '#141414', text: '#f4f4f5', muted: '#a1a1aa', border: '#2a2a2a' },
  {
    id: 'sand',
    label: 'Sand',
    bg: '#f5f1e8',
    text: '#2b2620',
    muted: '#7a7060',
    border: '#ddd5c4',
  },
  { id: 'sky', label: 'Sky', bg: '#f7fafc', text: '#111b26', muted: '#5d7183', border: '#dbe6ef' },
]

export const THEME_FONTS: ThemeFont[] = [
  {
    id: 'sans',
    label: 'Sans',
    stack: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
  { id: 'serif', label: 'Serif', stack: 'ui-serif, Georgia, "Times New Roman", serif' },
  { id: 'mono', label: 'Mono', stack: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
  {
    id: 'humanist',
    label: 'Humanist',
    stack: '"Optima", "Gill Sans", "Trebuchet MS", ui-sans-serif, sans-serif',
  },
]

const DENSITY_SCALE: Record<Density, { gap: string; page: string; lead: string }> = {
  tight: { gap: '0.5rem', page: '2rem', lead: '1.5' },
  normal: { gap: '0.75rem', page: '3rem', lead: '1.65' },
  roomy: { gap: '1.15rem', page: '4.5rem', lead: '1.8' },
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i
const MAX_RADIUS = 24

export function defaultTheme(): Theme {
  return { palette: 'paper', accent: '#b8860b', font: 'sans', radius: 8, density: 'normal' }
}

function pick<T extends { id: string }>(list: T[], id: unknown, fallback: string): string {
  return typeof id === 'string' && list.some((x) => x.id === id) ? id : fallback
}

/** Elle düzenlenmiş bir _theme.json'un siteyi bozmaması için her alan doğrulanır. */
export function parseTheme(input: unknown): Theme {
  const base = defaultTheme()
  if (typeof input !== 'object' || input === null) return base
  const raw = input as Record<string, unknown>

  const radius = typeof raw.radius === 'number' ? raw.radius : base.radius
  const density = raw.density
  return {
    palette: pick(PALETTES, raw.palette, base.palette),
    accent: typeof raw.accent === 'string' && HEX.test(raw.accent) ? raw.accent : base.accent,
    font: pick(THEME_FONTS, raw.font, base.font),
    radius: Math.min(MAX_RADIUS, Math.max(0, Math.round(radius))),
    density:
      density === 'tight' || density === 'normal' || density === 'roomy' ? density : base.density,
  }
}

export function paletteOf(theme: Theme): Palette {
  return PALETTES.find((p) => p.id === theme.palette) ?? (PALETTES[0] as Palette)
}

export function fontOf(theme: Theme): ThemeFont {
  return THEME_FONTS.find((f) => f.id === theme.font) ?? (THEME_FONTS[0] as ThemeFont)
}

/** Üretilen sitenin tek stil kaynağı: bir :root bloğu dolusu değişken. */
export function themeCss(theme: Theme): string {
  const palette = paletteOf(theme)
  const font = fontOf(theme)
  const scale = DENSITY_SCALE[theme.density]

  return [
    ':root {',
    `  --jj-bg: ${palette.bg};`,
    `  --jj-text: ${palette.text};`,
    `  --jj-muted: ${palette.muted};`,
    `  --jj-border: ${palette.border};`,
    `  --jj-accent: ${theme.accent};`,
    `  --jj-font: ${font.stack};`,
    `  --jj-radius: ${theme.radius}px;`,
    `  --jj-gap: ${scale.gap};`,
    `  --jj-page: ${scale.page};`,
    `  --jj-lead: ${scale.lead};`,
    '}',
  ].join('\n')
}

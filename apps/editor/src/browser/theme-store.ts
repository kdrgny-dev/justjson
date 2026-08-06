// Theme registry for Studio: bundled (ship-with-Studio) themes + user-imported
// premium ThemeBundles (localStorage), plus the per-project selected theme.
// Backend-free — see docs/theme-asset-architecture.md.
import { activeProject } from './project'
import type { ThemeBundle } from './theme-bundle'

// Bundled themes are whatever src/themes holds at build time. The free ones are
// in this repo; the commercial ones are pulled in by a paid build
// (scripts/fetch-premium-themes.mjs), so nothing here may import a premium
// bundle by name — a free build simply has fewer files, and still compiles.
const files = import.meta.glob<{ default: unknown }>('../themes/*.json', { eager: true })

// Display order for the themes we publish; anything else follows, by id.
const ORDER = ['default', 'bold', 'editorial', 'larder']
const rank = (id: string) => {
  const i = ORDER.indexOf(id)
  return i === -1 ? ORDER.length : i
}

export const BUNDLED_THEMES: ThemeBundle[] = Object.values(files)
  .map((m) => m.default)
  .filter(isBundle)
  .sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id))

const fallback = BUNDLED_THEMES.find((t) => t.id === 'default') ?? BUNDLED_THEMES[0]
if (!fallback) throw new Error('No theme bundles found in src/themes — broken build.')
const DEFAULT: ThemeBundle = fallback

const IMPORTED_KEY = 'jj_imported_themes'
const selKey = (projectId: string) => `jj_selected_theme_${projectId}`

function isBundle(v: unknown): v is ThemeBundle {
  if (!v || typeof v !== 'object') return false
  const b = v as Record<string, unknown>
  const tpl = b.templates as Record<string, unknown> | undefined
  return (
    typeof b.id === 'string' &&
    typeof b.name === 'string' &&
    typeof b.css === 'string' &&
    !!tpl &&
    typeof tpl.index === 'string' &&
    typeof tpl.entry === 'string'
  )
}

export function listImportedThemes(): ThemeBundle[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = JSON.parse(localStorage.getItem(IMPORTED_KEY) || '[]')
    return Array.isArray(raw) ? raw.filter(isBundle) : []
  } catch {
    return []
  }
}

function writeImported(list: ThemeBundle[]): void {
  localStorage.setItem(IMPORTED_KEY, JSON.stringify(list))
}

// Validate + persist a purchased theme file. Throws a clear error on bad input.
export function importTheme(json: unknown): ThemeBundle {
  if (!isBundle(json)) {
    throw new Error('Not a valid theme file: needs id, name, css and templates.index/entry.')
  }
  const bundle: ThemeBundle = {
    ...json,
    version: typeof json.version === 'string' ? json.version : '1.0.0',
    license: json.license === 'free' ? 'free' : 'commercial',
  }
  writeImported([...listImportedThemes().filter((t) => t.id !== bundle.id), bundle])
  return bundle
}

export function removeImportedTheme(id: string): void {
  if (typeof localStorage === 'undefined') return
  writeImported(listImportedThemes().filter((t) => t.id !== id))
}

export function allThemes(): ThemeBundle[] {
  return [...BUNDLED_THEMES, ...listImportedThemes()]
}

export function getSelectedThemeId(): string {
  if (typeof localStorage === 'undefined') return 'default'
  return localStorage.getItem(selKey(activeProject().id)) || 'default'
}

export function setSelectedThemeId(id: string): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(selKey(activeProject().id), id)
}

export function getSelectedBundle(): ThemeBundle {
  const id = getSelectedThemeId()
  return allThemes().find((t) => t.id === id) ?? DEFAULT
}

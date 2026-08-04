// Theme registry for Studio: bundled (ship-with-Studio) themes + user-imported
// premium ThemeBundles (localStorage), plus the per-project selected theme.
// Backend-free — see docs/theme-asset-architecture.md.
import atelier from '../themes/atelier.json'
import beacon from '../themes/beacon.json'
import bold from '../themes/bold.json'
import defaultTheme from '../themes/default.json'
import editorial from '../themes/editorial.json'
import signal from '../themes/signal.json'
import { activeProject } from './project'
import type { ThemeBundle } from './theme-bundle'

const DEFAULT = defaultTheme as ThemeBundle

// add bundled themes here — one import line + one array entry each.
export const BUNDLED_THEMES: ThemeBundle[] = [
  DEFAULT,
  bold as ThemeBundle,
  editorial as ThemeBundle,
  signal as ThemeBundle,
  atelier as ThemeBundle,
  beacon as ThemeBundle,
]

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

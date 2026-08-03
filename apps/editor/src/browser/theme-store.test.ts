import { beforeEach, describe, expect, it } from 'vitest'
import type { ThemeBundle } from './theme-bundle'
import {
  allThemes,
  getSelectedBundle,
  getSelectedThemeId,
  importTheme,
  listImportedThemes,
  removeImportedTheme,
  setSelectedThemeId,
} from './theme-store'

// Minimal localStorage for node — theme-store + project.ts read/write it.
class MemStorage {
  private m = new Map<string, string>()
  getItem(k: string) {
    return this.m.has(k) ? (this.m.get(k) as string) : null
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v))
  }
  removeItem(k: string) {
    this.m.delete(k)
  }
  clear() {
    this.m.clear()
  }
}

beforeEach(() => {
  ;(globalThis as { localStorage: unknown }).localStorage = new MemStorage()
})

const valid: ThemeBundle = {
  id: 'custom-import',
  name: 'Editorial',
  version: '2.0.0',
  license: 'commercial',
  css: '.x{}',
  templates: { index: '<main>{{siteName}}</main>', entry: '<article>{{title}}</article>' },
}

describe('importTheme', () => {
  it('accepts a valid bundle and persists it', () => {
    const b = importTheme(valid)
    expect(b.id).toBe('custom-import')
    expect(listImportedThemes().map((t) => t.id)).toContain('custom-import')
    const ids = allThemes().map((t) => t.id)
    expect(ids).toContain('default')
    expect(ids).toContain('custom-import')
  })

  it('rejects a bad payload', () => {
    expect(() => importTheme({ id: 'x', name: 'x', css: 'x' })).toThrow()
    expect(() => importTheme(null)).toThrow()
    expect(() => importTheme({ ...valid, templates: { index: 5 } })).toThrow()
    expect(listImportedThemes()).toHaveLength(0)
  })

  it('defaults missing version/license and replaces same id', () => {
    const b = importTheme({ ...valid, version: undefined, license: 'bogus' })
    expect(b.version).toBe('1.0.0')
    expect(b.license).toBe('commercial')
    importTheme(valid)
    expect(listImportedThemes()).toHaveLength(1)
  })
})

describe('selection', () => {
  it('defaults to the free default bundle', () => {
    expect(getSelectedThemeId()).toBe('default')
    expect(getSelectedBundle().id).toBe('default')
  })

  it('roundtrips select/get and resolves the bundle', () => {
    importTheme(valid)
    setSelectedThemeId('custom-import')
    expect(getSelectedThemeId()).toBe('custom-import')
    expect(getSelectedBundle().id).toBe('custom-import')
  })

  it('falls back to default when the selected theme is removed', () => {
    importTheme(valid)
    setSelectedThemeId('custom-import')
    removeImportedTheme('custom-import')
    expect(getSelectedBundle().id).toBe('default')
  })
})

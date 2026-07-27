import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { readVersion } from './version'

describe('readVersion', () => {
  it('package.json sürümünü döndürür, 0.0.0 değil', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      version: string
    }
    expect(readVersion()).toBe(pkg.version)
    expect(readVersion()).not.toBe('0.0.0')
    expect(readVersion()).toMatch(/^\d+\.\d+\.\d+/)
  })
})

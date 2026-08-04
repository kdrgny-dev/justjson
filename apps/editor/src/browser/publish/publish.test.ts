import { describe, expect, it } from 'vitest'
import { toBase64 } from './github'
import { PROVIDERS, getProvider } from './index'

describe('publish providers', () => {
  it('registers the browser-capable hosts, not Cloudflare (CORS-blocked)', () => {
    const ids = PROVIDERS.map((p) => p.id)
    expect(ids).toEqual(['netlify', 'vercel', 'github'])
    expect(ids).not.toContain('cloudflare')
  })

  it('falls back to netlify for an unknown provider id', () => {
    expect(getProvider('nope').id).toBe('netlify')
  })
})

describe('toBase64', () => {
  it('encodes ascii and UTF-8 losslessly, including large content', () => {
    expect(toBase64('hi')).toBe('aGk=')
    // round-trips through the browser's atob → UTF-8 decode
    const s = 'Ücret — çığ ☕ 世界'
    const back = new TextDecoder().decode(
      Uint8Array.from(atob(toBase64(s)), (c) => c.charCodeAt(0)),
    )
    expect(back).toBe(s)
    expect(() => toBase64('x'.repeat(100_000))).not.toThrow()
  })
})

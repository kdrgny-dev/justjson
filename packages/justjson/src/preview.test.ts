import { describe, expect, it } from 'vitest'
import { cleanUrl, detectDevScript } from './preview'

describe('detectDevScript', () => {
  it('scripts.dev varsa komutu verir', () => {
    expect(detectDevScript({ scripts: { dev: 'astro dev' } })).toEqual({
      command: 'npm',
      args: ['run', 'dev'],
    })
  })

  it('dev script yoksa null döner', () => {
    expect(detectDevScript({ scripts: { build: 'astro build' } })).toBeNull()
    expect(detectDevScript({})).toBeNull()
    expect(detectDevScript(null)).toBeNull()
  })
})

describe('cleanUrl', () => {
  it('düz bir URL yakalar', () => {
    expect(cleanUrl('  Local  http://localhost:4322/')).toBe('http://localhost:4322')
  })

  it('URL içindeki ANSI renk kodlarını temizler', () => {
    // Astro çıktısı renk escape'leri içerir; iframe'e girmeden sıyrılmalı.
    expect(cleanUrl('http://localhost:4322/\u001b[39m')).toBe('http://localhost:4322')
  })

  it('port ve yolu korur', () => {
    expect(cleanUrl('➜ http://localhost:3000/blog')).toBe('http://localhost:3000/blog')
  })

  it('URL yoksa null döner', () => {
    expect(cleanUrl('starting dev server…')).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import { PALETTES, THEME_FONTS, defaultTheme, parseTheme, themeCss } from './theme'

describe('defaultTheme', () => {
  it('geçerli bir tema döndürür', () => {
    const theme = defaultTheme()
    expect(theme.palette).toBeTruthy()
    expect(theme.accent).toMatch(/^#[0-9a-f]{6}$/i)
    expect(theme.radius).toBeGreaterThanOrEqual(0)
  })
})

describe('parseTheme', () => {
  it('eksik alanları varsayılanla tamamlar', () => {
    const theme = parseTheme({ accent: '#ff0000' })
    expect(theme.accent).toBe('#ff0000')
    expect(theme.font).toBe(defaultTheme().font)
  })

  it('bilinmeyen palet ve fontu varsayılana düşürür', () => {
    const theme = parseTheme({ palette: 'yok', font: 'yok' })
    expect(theme.palette).toBe(defaultTheme().palette)
    expect(theme.font).toBe(defaultTheme().font)
  })

  it('geçersiz rengi varsayılana düşürür', () => {
    expect(parseTheme({ accent: 'kırmızı' }).accent).toBe(defaultTheme().accent)
    expect(parseTheme({ accent: '#abc' }).accent).toBe('#abc')
  })

  it('köşe yarıçapını sınırlar içinde tutar', () => {
    expect(parseTheme({ radius: 999 }).radius).toBeLessThanOrEqual(24)
    expect(parseTheme({ radius: -5 }).radius).toBe(0)
  })

  it('nesne olmayan girdide varsayılanı verir', () => {
    expect(parseTheme(null)).toEqual(defaultTheme())
    expect(parseTheme('x')).toEqual(defaultTheme())
  })
})

describe('themeCss', () => {
  it('CSS değişkenleri üretir', () => {
    const css = themeCss(parseTheme({ accent: '#ff0000', radius: 12 }))
    expect(css).toContain('--jj-accent: #ff0000')
    expect(css).toContain('--jj-radius: 12px')
  })

  it('paletin arka plan ve metin renklerini yazar', () => {
    const css = themeCss(parseTheme({ palette: 'paper' }))
    expect(css).toContain('--jj-bg:')
    expect(css).toContain('--jj-text:')
  })

  it('seçilen yazı tipi ailesini yazar', () => {
    const css = themeCss(parseTheme({ font: 'serif' }))
    expect(css).toContain('--jj-font:')
    expect(css.toLowerCase()).toContain('serif')
  })

  it('geniş yoğunlukta ölçek büyür', () => {
    const tight = themeCss(parseTheme({ density: 'tight' }))
    const roomy = themeCss(parseTheme({ density: 'roomy' }))
    expect(tight).not.toBe(roomy)
  })

  it('koyu tema için de değişken üretir', () => {
    const css = themeCss(parseTheme({ palette: 'ink' }))
    expect(css).toContain('--jj-bg:')
  })
})

describe('katalog', () => {
  it('en az üç palet sunar ve hepsinin adı vardır', () => {
    expect(PALETTES.length).toBeGreaterThanOrEqual(3)
    for (const p of PALETTES) {
      expect(p.id).toBeTruthy()
      expect(p.label).toBeTruthy()
      expect(p.bg).toMatch(/^#/)
    }
  })

  it('yazı tipi seçenekleri sunar', () => {
    expect(THEME_FONTS.length).toBeGreaterThanOrEqual(3)
    expect(THEME_FONTS.every((f) => f.id && f.stack)).toBe(true)
  })
})

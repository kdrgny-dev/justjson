import { describe, expect, it } from 'vitest'
import { astroSiteFiles } from './scaffold'
import { siteTemplateFiles, siteTemplateIds } from './site-templates'

describe('siteTemplates', () => {
  it('portfolio/cv/event presetlerini tanır', () => {
    const ids = siteTemplateIds()
    expect(ids).toContain('portfolio')
    expect(ids).toContain('cv')
    expect(ids).toContain('event')
  })

  it('bilinmeyen preset için null döner', () => {
    expect(siteTemplateFiles('blog', 'x')).toBeNull()
  })

  it('portfolio içerik-sürücülü, imzalı bir index üretir', () => {
    const files = siteTemplateFiles('portfolio', 'x')
    expect(files).not.toBeNull()
    const index = files?.['src/pages/index.astro'] as string
    expect(index).toContain("getCollection('projects')")
    expect(index).toContain("getEntry('about', 'about')")
    expect(index).toContain('class="giant"')
    expect(files?.['content/_theme.json']).toBeTruthy()
  })

  it('cv, experience koleksiyonunu okur', () => {
    const index = siteTemplateFiles('cv', 'x')?.['src/pages/index.astro'] as string
    expect(index).toContain("getCollection('experience')")
    expect(index).toContain("getEntry('profile', 'profile')")
  })

  it('event, sessions koleksiyonunu okur ve marquee içerir', () => {
    const index = siteTemplateFiles('event', 'x')?.['src/pages/index.astro'] as string
    expect(index).toContain("getCollection('sessions')")
    expect(index).toContain('marquee')
  })

  it('her styled index badge taşır ve JSON literalini kaçırır', () => {
    for (const id of ['portfolio', 'cv', 'event']) {
      const index = siteTemplateFiles(id, 'x')?.['src/pages/index.astro'] as string
      expect(index).toContain('justjson.dev')
      expect(index).not.toContain('{JSON}')
    }
  })
})

describe('astroSiteFiles preset entegrasyonu', () => {
  const portfolioSchema = {
    version: 1 as const,
    collections: [
      {
        name: 'projects',
        label: 'Projects',
        path: 'projects',
        fields: [{ key: 'title', label: 'Title', type: 'text' as const, required: true }],
      },
    ],
    singletons: [
      {
        name: 'about',
        label: 'About',
        path: 'about.json',
        fields: [{ key: 'name', label: 'Name', type: 'text' as const, required: true }],
      },
    ],
  }

  it('styled preset verilince jenerik index/Base/detay üretmez', () => {
    const files = astroSiteFiles(portfolioSchema, 'x', 'portfolio')
    expect(files['src/pages/index.astro']).toContain('class="giant"')
    expect(files['src/layouts/Base.astro']).toBeUndefined()
    expect(Object.keys(files).some((f) => f.includes('[slug]'))).toBe(false)
    // ortak dosyalar yine üretilir
    expect(files['package.json']).toBeTruthy()
    expect(files['src/content.config.ts']).toBeTruthy()
  })

  it('preset yoksa jenerik davranış korunur', () => {
    const files = astroSiteFiles(portfolioSchema, 'x')
    expect(files['src/layouts/Base.astro']).toBeTruthy()
    expect(files['src/pages/index.astro']).not.toContain('class="giant"')
  })
})

import { describe, expect, it } from 'vitest'
import { parseSchema } from '../schema/schema'
import { buildExportManifest } from './bundle'

const schema = parseSchema({
  version: 1,
  collections: [{ name: 'posts', path: 'posts', fields: [{ key: 'title', type: 'text' }] }],
  singletons: [{ name: 'settings', path: 'settings.json', fields: [{ key: 'site', type: 'text' }] }],
})

describe('buildExportManifest', () => {
  const manifest = buildExportManifest({
    schema,
    entries: {
      posts: [
        { slug: 'merhaba', title: 'Merhaba' },
        { title: 'Slugsuz' },
      ],
    },
    singletons: { settings: { site: 'X' } },
    media: { 'content/media/a.webp': new Uint8Array([1, 2, 3]) },
  })

  it('şema dosyasını içerir', () => {
    expect(manifest['content/_schema.json']).toContain('"posts"')
  })

  it('slug alanı olan entry slug adıyla yazılır', () => {
    expect(manifest['content/posts/merhaba.json']).toContain('Merhaba')
  })

  it('slug olmayan entry sıra numarasıyla yazılır', () => {
    expect(manifest['content/posts/1.json']).toContain('Slugsuz')
  })

  it('singleton dosyasını içerir', () => {
    expect(manifest['content/settings.json']).toContain('"site"')
  })

  it('types.ts üretir', () => {
    expect(manifest['types.ts']).toContain('export interface Posts')
  })

  it('medya dosyalarını aynen taşır', () => {
    expect(manifest['content/media/a.webp']).toBeInstanceOf(Uint8Array)
  })
})

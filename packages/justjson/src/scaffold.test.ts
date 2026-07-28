import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Schema } from '@justjson/core'
import { describe, expect, it } from 'vitest'
import { astroSiteFiles, writeAstroSite } from './scaffold'

const schema: Schema = {
  version: 1,
  collections: [
    {
      name: 'posts',
      label: 'Posts',
      path: 'posts',
      fields: [
        { key: 'title', label: 'Title', type: 'text', required: true },
        { key: 'date', label: 'Date', type: 'date' },
        { key: 'cover', label: 'Cover', type: 'image' },
        { key: 'body', label: 'Body', type: 'richtext' },
      ],
    },
    {
      name: 'blog-tags',
      label: 'Tags',
      path: 'blog-tags',
      fields: [{ key: 'name', type: 'text' }],
    },
  ],
  singletons: [
    {
      name: 'settings',
      label: 'Settings',
      path: 'settings.json',
      fields: [{ key: 'title', label: 'Site name', type: 'text' }],
    },
  ],
}

describe('astroSiteFiles', () => {
  it('çalışan bir Astro projesinin dosyalarını üretir', () => {
    const files = astroSiteFiles(schema, 'my-site')
    expect(Object.keys(files).sort()).toEqual(
      [
        '.gitignore',
        'astro.config.mjs',
        'package.json',
        'src/content.config.ts',
        'src/pages/blog-tags/[slug].astro',
        'src/pages/index.astro',
        'src/pages/posts/[slug].astro',
        'tsconfig.json',
      ].sort(),
    )
  })

  it('package.json astro ve loader bağımlılıklarını içerir', () => {
    const pkg = JSON.parse(astroSiteFiles(schema, 'my-site')['package.json'] as string) as {
      name: string
      dependencies: Record<string, string>
    }
    expect(pkg.name).toBe('my-site')
    expect(pkg.dependencies.astro).toBeTruthy()
    expect(pkg.dependencies['@kdrgny/justjson-astro']).toBeTruthy()
  })

  it('content.config.ts tek satırlık kurulumu kullanır', () => {
    const config = astroSiteFiles(schema, 'x')['src/content.config.ts'] as string
    expect(config).toContain("from '@kdrgny/justjson-astro'")
    expect(config).toContain('justjsonCollections()')
  })

  it('her koleksiyon için bir detay sayfası üretir', () => {
    const page = astroSiteFiles(schema, 'x')['src/pages/posts/[slug].astro'] as string
    expect(page).toContain("getCollection('posts')")
    expect(page).toContain('getStaticPaths')
    expect(page).toContain('entry.id')
  })

  it('ana sayfa her koleksiyonu listeler ve tekili başlık yapar', () => {
    const index = astroSiteFiles(schema, 'x')['src/pages/index.astro'] as string
    expect(index).toContain("getCollection('posts')")
    expect(index).toContain("getCollection('blog-tags')")
    expect(index).toContain("getEntry('settings', 'settings')")
  })

  it('görsel ve richtext alanlarını uygun şekilde işler', () => {
    const page = astroSiteFiles(schema, 'x')['src/pages/posts/[slug].astro'] as string
    expect(page).toContain('<img')
    expect(page).toContain('data.body')
  })

  it('tekil yoksa proje adını başlık yapar', () => {
    const bare: Schema = { version: 1, collections: schema.collections, singletons: [] }
    const index = astroSiteFiles(bare, 'bare-site')['src/pages/index.astro'] as string
    expect(index).not.toContain('getEntry(')
    expect(index).toContain('bare-site')
  })

  it('boş şemada bile geçerli bir proje üretir', () => {
    const empty: Schema = { version: 1, collections: [], singletons: [] }
    const files = astroSiteFiles(empty, 'x')
    expect(files['package.json']).toBeTruthy()
    expect(files['src/pages/index.astro']).toBeTruthy()
    expect(Object.keys(files).some((f) => f.includes('[slug]'))).toBe(false)
  })

  it('proje adını npm için güvenli hale getirir', () => {
    const pkg = JSON.parse(astroSiteFiles(schema, 'My Site!')['package.json'] as string) as {
      name: string
    }
    expect(pkg.name).toBe('my-site')
  })
})

describe('writeAstroSite', () => {
  it('dosyaları diske yazar', async () => {
    const root = await mkdtemp(join(tmpdir(), 'jj-scaffold-'))
    const written = await writeAstroSite(root, schema, 'my-site')
    expect(written.written).toContain('src/pages/index.astro')
    expect(JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))).toMatchObject({
      name: 'my-site',
    })
    await rm(root, { recursive: true, force: true })
  })

  it('var olan dosyanın üzerine yazmaz, atladığını bildirir', async () => {
    const root = await mkdtemp(join(tmpdir(), 'jj-scaffold-'))
    await writeFile(join(root, 'package.json'), '{"name":"mine"}')

    const result = await writeAstroSite(root, schema, 'my-site')
    expect(result.skipped).toContain('package.json')
    expect(result.written).not.toContain('package.json')
    expect(JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))).toMatchObject({
      name: 'mine',
    })
    await rm(root, { recursive: true, force: true })
  })
})

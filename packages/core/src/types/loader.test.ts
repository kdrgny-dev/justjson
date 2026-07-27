import { describe, expect, it } from 'vitest'
import { parseSchema } from '../schema/schema'
import type { Schema } from '../schema/types'
import { generateLoader } from './loader'

const schema: Schema = parseSchema({
  version: 1,
  collections: [
    { name: 'posts', path: 'posts', fields: [{ key: 'title', type: 'text' }] },
    { name: 'blog-tags', path: 'blog-tags', fields: [{ key: 'title', type: 'text' }] },
  ],
  singletons: [
    { name: 'settings', path: 'settings.json', fields: [{ key: 'siteName', type: 'text' }] },
  ],
})

describe('generateLoader', () => {
  const out = generateLoader(schema, 'content')

  it("tiplerini ./types'tan import eder", () => {
    expect(out).toContain("from './types'")
    expect(out).toContain('Posts')
    expect(out).toContain('BlogTags')
    expect(out).toContain('Settings')
  })

  it('koleksiyon için tipli loader üretir (pascalCase isim, path ile okur)', () => {
    expect(out).toContain('export const loadPosts')
    expect(out).toContain('export const loadBlogTags')
    expect(out).toContain("readCollection<Posts>('posts')")
    expect(out).toContain("readCollection<BlogTags>('blog-tags')")
  })

  it('singleton için nullable loader üretir', () => {
    expect(out).toContain('export const loadSettings')
    expect(out).toContain("readSingleton<Settings>('settings.json')")
    expect(out).toContain('Settings | null')
  })

  it('slug enjekte eden WithSlug tipi içerir', () => {
    expect(out).toContain('WithSlug')
    expect(out).toContain('slug: string')
  })

  it('sıfır runtime bağımlılık — sadece node: builtinleri', () => {
    const imports = out.match(/from '([^']+)'/g) ?? []
    for (const imp of imports) {
      expect(imp === "from './types'" || imp.includes("from 'node:")).toBe(true)
    }
  })

  it('embed edilen içerik dizinini kullanır', () => {
    expect(generateLoader(schema, 'icerik')).toContain('icerik')
  })
})

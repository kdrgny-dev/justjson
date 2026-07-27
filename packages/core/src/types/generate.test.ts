import { describe, expect, it } from 'vitest'
import { parseSchema } from '../schema/schema'
import { generateTypes } from './generate'

const schema = parseSchema({
  version: 1,
  collections: [
    {
      name: 'blog_posts',
      path: 'posts',
      fields: [
        { key: 'title', type: 'text', required: true },
        { key: 'body', type: 'richtext' },
        { key: 'status', type: 'select', options: ['draft', 'published'], required: true },
        { key: 'views', type: 'number' },
        { key: 'tags', type: 'relation', to: 'blog_posts' },
      ],
    },
  ],
  singletons: [
    { name: 'settings', path: 'settings.json', fields: [{ key: 'site', type: 'text' }] },
  ],
})

describe('generateTypes', () => {
  const out = generateTypes(schema)

  it('koleksiyon için PascalCase interface üretir', () => {
    expect(out).toContain('export interface BlogPosts {')
  })

  it('required alan zorunlu, diğerleri opsiyonel', () => {
    expect(out).toContain('title: string')
    expect(out).toContain('body?: string')
    expect(out).toContain('views?: number')
  })

  it('select alanı birleşim tipine dönüşür', () => {
    expect(out).toContain("status: 'draft' | 'published'")
  })

  it('relation alanı string dizisine dönüşür', () => {
    expect(out).toContain('tags?: string[]')
  })

  it('koleksiyon dizi tipi üretir', () => {
    expect(out).toContain('export type BlogPostsCollection = BlogPosts[]')
  })

  it('singleton için interface üretir', () => {
    expect(out).toContain('export interface Settings {')
    expect(out).toContain('site?: string')
  })
})

describe('generateTypes yeni tipler', () => {
  const out = generateTypes(
    parseSchema({
      version: 1,
      collections: [
        {
          name: 'c',
          path: 'c',
          fields: [
            { key: 'site', type: 'url' },
            { key: 'mail', type: 'email' },
            { key: 'renk', type: 'color' },
            { key: 'etiketler', type: 'list' },
            {
              key: 'adres',
              type: 'group',
              fields: [
                { key: 'sokak', type: 'text' },
                { key: 'sehir', type: 'text', required: true },
                { key: 'no', type: 'number' },
              ],
            },
          ],
        },
      ],
      singletons: [],
    }),
  )

  it('url/email/color → string', () => {
    expect(out).toContain('site?: string')
    expect(out).toContain('mail?: string')
    expect(out).toContain('renk?: string')
  })

  it('list → string[]', () => {
    expect(out).toContain('etiketler?: string[]')
  })

  it('group → iç içe nesne tipi (özyinelemeli, required yansır)', () => {
    expect(out).toContain('adres?: { sokak?: string; sehir: string; no?: number }')
  })
})

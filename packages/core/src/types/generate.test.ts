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

  it('koleksiyon dizi tipi üretir', () => {
    expect(out).toContain('export type BlogPostsCollection = BlogPosts[]')
  })

  it('singleton için interface üretir', () => {
    expect(out).toContain('export interface Settings {')
    expect(out).toContain('site?: string')
  })
})

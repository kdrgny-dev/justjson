import { describe, expect, it } from 'vitest'
import { parseSchema } from '../schema/schema'
import type { Schema } from '../schema/types'
import { type ProjectContent, validateProject } from './project'

const schema: Schema = parseSchema({
  version: 1,
  collections: [
    {
      name: 'posts',
      path: 'posts',
      fields: [
        { key: 'title', type: 'text', required: true },
        { key: 'cover', type: 'image' },
        { key: 'tags', type: 'relation', to: 'tags' },
      ],
    },
    { name: 'tags', path: 'tags', fields: [{ key: 'title', type: 'text' }] },
  ],
  singletons: [
    {
      name: 'settings',
      path: 'settings.json',
      fields: [{ key: 'siteName', type: 'text', required: true }],
    },
  ],
})

function content(over: Partial<ProjectContent> = {}): ProjectContent {
  return {
    collections: {
      posts: [{ slug: 'hello', data: { title: 'Hello', tags: ['js'] } }],
      tags: [{ slug: 'js', data: { title: 'JS' } }],
    },
    singletons: { settings: { siteName: 'Site' } },
    ...over,
  }
}

describe('validateProject', () => {
  it('temiz proje → sorun yok', () => {
    expect(validateProject(schema, content())).toEqual([])
  })

  it('entry-içi hataları koleksiyon+slug+alan ile raporlar', () => {
    const issues = validateProject(schema, {
      collections: {
        posts: [{ slug: 'bad', data: { title: 123 } }],
        tags: [],
      },
      singletons: { settings: { siteName: 'S' } },
    })
    const typeIssue = issues.find((i) => i.kind === 'type')
    expect(typeIssue).toMatchObject({
      collection: 'posts',
      slug: 'bad',
      field: 'title',
      level: 'error',
    })
  })

  it('singleton zorunlu boş → warning, singleton adı ile', () => {
    const issues = validateProject(schema, content({ singletons: { settings: {} } }))
    expect(issues).toContainEqual(
      expect.objectContaining({
        singleton: 'settings',
        field: 'siteName',
        kind: 'required',
        level: 'warning',
      }),
    )
  })

  it('kırık relation → error', () => {
    const issues = validateProject(schema, {
      collections: {
        posts: [{ slug: 'hello', data: { title: 'H', tags: ['yok'] } }],
        tags: [{ slug: 'js', data: { title: 'JS' } }],
      },
      singletons: { settings: { siteName: 'S' } },
    })
    expect(issues).toContainEqual(
      expect.objectContaining({
        kind: 'broken-relation',
        collection: 'posts',
        slug: 'hello',
        field: 'tags',
        level: 'error',
      }),
    )
  })

  it('duplicate slug → error', () => {
    const issues = validateProject(schema, {
      collections: {
        posts: [
          { slug: 'dup', data: { title: 'A' } },
          { slug: 'dup', data: { title: 'B' } },
        ],
        tags: [],
      },
      singletons: { settings: { siteName: 'S' } },
    })
    expect(
      issues.some(
        (i) => i.kind === 'duplicate-slug' && i.collection === 'posts' && i.slug === 'dup',
      ),
    ).toBe(true)
  })

  it('eksik medya → error (media listesi verildiğinde)', () => {
    const issues = validateProject(schema, {
      collections: {
        posts: [{ slug: 'hello', data: { title: 'H', cover: 'content/media/yok.webp' } }],
        tags: [],
      },
      singletons: { settings: { siteName: 'S' } },
      media: ['content/media/var.webp'],
    })
    expect(issues).toContainEqual(
      expect.objectContaining({
        kind: 'missing-media',
        collection: 'posts',
        slug: 'hello',
        field: 'cover',
        level: 'error',
      }),
    )
  })

  it('var olan medya → sorun yok', () => {
    const issues = validateProject(schema, {
      collections: {
        posts: [{ slug: 'hello', data: { title: 'H', cover: 'content/media/var.webp' } }],
        tags: [],
      },
      singletons: { settings: { siteName: 'S' } },
      media: ['content/media/var.webp'],
    })
    expect(issues.some((i) => i.kind === 'missing-media')).toBe(false)
  })

  it('şemada olmayan koleksiyon klasörü → warning', () => {
    const issues = validateProject(schema, {
      collections: {
        posts: [],
        tags: [],
        eskiler: [{ slug: 'x', data: {} }],
      },
      singletons: { settings: { siteName: 'S' } },
    })
    expect(issues).toContainEqual(
      expect.objectContaining({
        kind: 'schema-content-mismatch',
        collection: 'eskiler',
        level: 'warning',
      }),
    )
  })
})

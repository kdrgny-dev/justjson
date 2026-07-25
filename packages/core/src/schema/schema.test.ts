import { describe, expect, it } from 'vitest'
import { parseSchema, serializeSchema } from './schema'

const valid = {
  version: 1,
  collections: [
    {
      name: 'posts',
      label: 'Yazılar',
      path: 'posts',
      fields: [
        { key: 'title', type: 'text', required: true },
        { key: 'body', type: 'richtext' },
        { key: 'status', type: 'select', options: ['draft', 'published'] },
        { key: 'tags', type: 'relation', to: 'tags' },
      ],
    },
  ],
  singletons: [{ name: 'settings', path: 'settings.json', fields: [] }],
}

describe('parseSchema', () => {
  it('geçerli şemayı ayrıştırır', () => {
    const schema = parseSchema(valid)
    expect(schema.collections[0]?.name).toBe('posts')
    expect(schema.collections[0]?.fields).toHaveLength(4)
  })

  it('select alanı options olmadan reddedilir', () => {
    const bad = JSON.parse(JSON.stringify(valid))
    bad.collections[0].fields[2] = { key: 'status', type: 'select' } as never
    expect(() => parseSchema(bad)).toThrow()
  })

  it('relation alanı "to" olmadan reddedilir', () => {
    const bad = JSON.parse(JSON.stringify(valid))
    bad.collections[0].fields[3] = { key: 'tags', type: 'relation' } as never
    expect(() => parseSchema(bad)).toThrow()
  })

  it('bilinmeyen alan tipi reddedilir', () => {
    const bad = JSON.parse(JSON.stringify(valid))
    bad.collections[0].fields[0] = { key: 'x', type: 'wysiwyg' } as never
    expect(() => parseSchema(bad)).toThrow()
  })
})

describe('serializeSchema', () => {
  it('round-trip: serialize sonrası parse aynı şemayı verir', () => {
    const schema = parseSchema(valid)
    const text = serializeSchema(schema)
    expect(text.endsWith('\n')).toBe(true)
    expect(parseSchema(JSON.parse(text))).toEqual(schema)
  })
})

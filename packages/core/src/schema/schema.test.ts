import { describe, expect, it } from 'vitest'
import { parseSchema, serializeSchema } from './schema'

const valid = {
  version: 1,
  collections: [
    {
      name: 'tags',
      path: 'tags',
      fields: [{ key: 'name', type: 'text' }],
    },
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
    expect(schema.collections[1]?.name).toBe('posts')
    expect(schema.collections[1]?.fields).toHaveLength(4)
  })

  it('select alanı options olmadan reddedilir', () => {
    const bad = JSON.parse(JSON.stringify(valid))
    bad.collections[1].fields[2] = { key: 'status', type: 'select' } as never
    expect(() => parseSchema(bad)).toThrow()
  })

  it('relation alanı "to" olmadan reddedilir', () => {
    const bad = JSON.parse(JSON.stringify(valid))
    bad.collections[1].fields[3] = { key: 'tags', type: 'relation' } as never
    expect(() => parseSchema(bad)).toThrow()
  })

  it('bilinmeyen alan tipi reddedilir', () => {
    const bad = JSON.parse(JSON.stringify(valid))
    bad.collections[1].fields[0] = { key: 'x', type: 'wysiwyg' } as never
    expect(() => parseSchema(bad)).toThrow()
  })

  it('yeni skaler tipleri kabul eder (url/email/list/color)', () => {
    const ok = {
      version: 1,
      collections: [
        {
          name: 'c',
          path: 'c',
          fields: [
            { key: 'site', type: 'url' },
            { key: 'mail', type: 'email' },
            { key: 'tags', type: 'list' },
            { key: 'renk', type: 'color' },
          ],
        },
      ],
      singletons: [],
    }
    expect(() => parseSchema(ok)).not.toThrow()
  })

  it('group alanı alt alanlarıyla kabul edilir (özyinelemeli)', () => {
    const ok = {
      version: 1,
      collections: [
        {
          name: 'c',
          path: 'c',
          fields: [
            {
              key: 'adres',
              type: 'group',
              fields: [
                { key: 'sokak', type: 'text' },
                { key: 'sehir', type: 'text', required: true },
              ],
            },
          ],
        },
      ],
      singletons: [],
    }
    const schema = parseSchema(ok)
    expect(schema.collections[0]?.fields[0]?.fields?.[1]?.key).toBe('sehir')
  })

  it('group alanı fields olmadan reddedilir', () => {
    const bad = {
      version: 1,
      collections: [{ name: 'c', path: 'c', fields: [{ key: 'g', type: 'group' }] }],
      singletons: [],
    }
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

describe('parseSchema bütünlük', () => {
  const base = {
    version: 1,
    collections: [{ name: 'posts', path: 'posts', fields: [{ key: 'title', type: 'text' }] }],
    singletons: [],
  }

  it('benzersiz olmayan koleksiyon adını reddeder', () => {
    const bad = {
      ...base,
      collections: [base.collections[0], { name: 'posts', path: 'p2', fields: [] }],
    }
    expect(() => parseSchema(bad)).toThrow()
  })

  it('benzersiz olmayan path reddeder', () => {
    const bad = {
      ...base,
      collections: [base.collections[0], { name: 'other', path: 'posts', fields: [] }],
    }
    expect(() => parseSchema(bad)).toThrow()
  })

  it('koleksiyon içi tekrar eden field key reddeder', () => {
    const bad = {
      ...base,
      collections: [
        {
          name: 'posts',
          path: 'posts',
          fields: [
            { key: 'title', type: 'text' },
            { key: 'title', type: 'text' },
          ],
        },
      ],
    }
    expect(() => parseSchema(bad)).toThrow()
  })

  it('var olmayan koleksiyona relation reddeder', () => {
    const bad = {
      ...base,
      collections: [
        { name: 'posts', path: 'posts', fields: [{ key: 'rel', type: 'relation', to: 'yok' }] },
      ],
    }
    expect(() => parseSchema(bad)).toThrow()
  })

  it('geçerli relation kabul edilir', () => {
    const ok = {
      version: 1,
      collections: [
        { name: 'tags', path: 'tags', fields: [{ key: 'name', type: 'text' }] },
        { name: 'posts', path: 'posts', fields: [{ key: 'tag', type: 'relation', to: 'tags' }] },
      ],
      singletons: [],
    }
    expect(() => parseSchema(ok)).not.toThrow()
  })
})

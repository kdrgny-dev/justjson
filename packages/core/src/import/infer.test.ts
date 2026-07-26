import { describe, expect, it } from 'vitest'
import { parseSchema } from '../schema/schema'
import { inferProject } from './infer'

describe('inferProject', () => {
  it('nesne dizisini koleksiyona, nesneyi tekile çevirir (CV yapısı)', () => {
    const data = {
      home: {
        name: 'Kadir Günay',
        title: 'UI/UX/Frontend Developer',
        photo: 'https://x/y.jpg',
        urls: [{ label: 'Github', url: 'https://github.com/x' }],
        summary: '<div>As a seasoned <strong>Senior</strong> dev</div>',
      },
      experience: [
        { title: 'Balina', date: '2023 – Present', content: '<ul><li>Did things</li></ul>' },
        { title: 'Acme', date: '2020 – 2023', content: 'plain text' },
      ],
    }

    const { schema, entries, singletons } = inferProject(data)

    // şema geçerli olmalı
    expect(() => parseSchema(schema)).not.toThrow()

    // experience → koleksiyon
    const exp = schema.collections.find((c) => c.name === 'experience')
    expect(exp).toBeTruthy()
    expect(exp?.fields.map((f) => f.key)).toEqual(
      expect.arrayContaining(['slug', 'title', 'date', 'content']),
    )
    // content bir satırda HTML → richtext'e yükselir
    expect(exp?.fields.find((f) => f.key === 'content')?.type).toBe('richtext')
    expect(entries.experience).toHaveLength(2)
    expect(entries.experience[0]?.slug).toBe('balina')

    // home → tekil; summary richtext, name/title text
    const home = schema.singletons.find((s) => s.name === 'home')
    expect(home?.fields.find((f) => f.key === 'summary')?.type).toBe('richtext')
    expect(home?.fields.find((f) => f.key === 'name')?.type).toBe('text')

    // iç içe liste (home.urls) sade adıyla üst seviye koleksiyona çıkar
    const urls = schema.collections.find((c) => c.name === 'urls')
    expect(urls).toBeTruthy()
    expect(entries.urls).toHaveLength(1)

    // tekil veride şemaya girmeyen anahtar kalmaz (yoksa "şemada yok" uyarısı çıkar)
    expect(singletons.home.urls).toBeUndefined()
    const homeKeys = new Set(home?.fields.map((f) => f.key))
    for (const k of Object.keys(singletons.home)) expect(homeKeys.has(k)).toBe(true)
  })

  it('koleksiyon satırlarında şema dışı anahtar bırakmaz', () => {
    const { schema, entries } = inferProject({
      projects: [{ title: 'A', tags: [{ name: 'x' }], meta: { deep: 1 } }, { title: 'B' }],
    })
    const col = schema.collections.find((c) => c.name === 'projects')
    const keys = new Set(col?.fields.map((f) => f.key))
    for (const row of entries.projects) {
      for (const k of Object.keys(row)) expect(keys.has(k)).toBe(true)
    }
  })

  it('nesne olmayan girdide hata verir', () => {
    expect(() => inferProject([1, 2, 3])).toThrow()
    expect(() => inferProject('x')).toThrow()
  })

  it('slug çakışmalarını benzersizleştirir', () => {
    const { entries } = inferProject({
      items: [{ title: 'Aynı' }, { title: 'Aynı' }],
    })
    const slugs = entries.items.map((r) => r.slug)
    expect(new Set(slugs).size).toBe(2)
  })

  it('sayı ve boolean tiplerini tanır', () => {
    const { schema } = inferProject({ settings: { count: 3, active: true, note: 'hi' } })
    const s = schema.singletons.find((x) => x.name === 'settings')
    expect(s?.fields.find((f) => f.key === 'count')?.type).toBe('number')
    expect(s?.fields.find((f) => f.key === 'active')?.type).toBe('boolean')
  })
})

import type { Field } from '@justjson/core'
import { describe, expect, it } from 'vitest'
import { fieldsToZod } from './zod-schema'

describe('fieldsToZod', () => {
  it('zorunlu metin alanını ister, eksikse hata verir', () => {
    const schema = fieldsToZod([{ key: 'title', type: 'text', required: true }])
    expect(schema.parse({ title: 'Merhaba' })).toEqual({ title: 'Merhaba' })
    expect(schema.safeParse({}).success).toBe(false)
  })

  it('zorunlu olmayan alan eksik olabilir', () => {
    const schema = fieldsToZod([{ key: 'subtitle', type: 'text' }])
    expect(schema.safeParse({}).success).toBe(true)
  })

  it('number ve boolean tiplerini korur', () => {
    const schema = fieldsToZod([
      { key: 'count', type: 'number', required: true },
      { key: 'active', type: 'boolean', required: true },
    ])
    expect(schema.parse({ count: 3, active: true })).toEqual({ count: 3, active: true })
    expect(schema.safeParse({ count: '3', active: true }).success).toBe(false)
  })

  it('select alanını enum yapar', () => {
    const schema = fieldsToZod([
      { key: 'kind', type: 'select', options: ['a', 'b'], required: true },
    ])
    expect(schema.safeParse({ kind: 'a' }).success).toBe(true)
    expect(schema.safeParse({ kind: 'c' }).success).toBe(false)
  })

  it('options olmayan select serbest metindir', () => {
    const schema = fieldsToZod([{ key: 'kind', type: 'select', required: true }])
    expect(schema.safeParse({ kind: 'anything' }).success).toBe(true)
  })

  it('relation ve list alanlarını string dizisi yapar', () => {
    const schema = fieldsToZod([
      { key: 'tags', type: 'relation', to: 'tags', required: true },
      { key: 'labels', type: 'list', required: true },
    ])
    expect(schema.parse({ tags: ['x'], labels: ['y'] })).toEqual({ tags: ['x'], labels: ['y'] })
    expect(schema.safeParse({ tags: 'x', labels: ['y'] }).success).toBe(false)
  })

  it('group alanını iç içe nesneye çevirir', () => {
    const fields: Field[] = [
      {
        key: 'address',
        type: 'group',
        required: true,
        fields: [
          { key: 'city', type: 'text', required: true },
          { key: 'no', type: 'number' },
        ],
      },
    ]
    const schema = fieldsToZod(fields)
    expect(schema.parse({ address: { city: 'İstanbul' } })).toEqual({
      address: { city: 'İstanbul' },
    })
    expect(schema.safeParse({ address: { no: 5 } }).success).toBe(false)
  })

  it('_status alanını korur, şema dışı anahtarları atar', () => {
    const schema = fieldsToZod([{ key: 'title', type: 'text', required: true }])
    expect(schema.parse({ title: 'x', _status: 'draft', bilinmeyen: 1 })).toEqual({
      title: 'x',
      _status: 'draft',
    })
  })
})

import { describe, expect, it } from 'vitest'
import type { Field } from '../schema/types'
import { entryTitle } from './title'

const fields: Field[] = [
  { key: 'slug', type: 'text' },
  { key: 'title', type: 'text' },
  { key: 'body', type: 'richtext' },
]

describe('entryTitle', () => {
  it('başlık anahtarını tercih eder', () => {
    expect(entryTitle(fields, { slug: 'a', title: 'Merhaba', body: 'x' })).toBe('Merhaba')
  })

  it('başlık yoksa ilk dolu metin alanını kullanır', () => {
    expect(entryTitle(fields, { slug: 'ilk', body: 'içerik' })).toBe('ilk')
  })

  it('boş/eksik veride null', () => {
    expect(entryTitle(fields, {})).toBeNull()
    expect(entryTitle(fields, { title: '   ' })).toBeNull()
  })

  it('uzun metni kırpar', () => {
    const long = 'x'.repeat(200)
    expect(entryTitle([{ key: 'body', type: 'text' }], { body: long })?.length).toBe(120)
  })
})

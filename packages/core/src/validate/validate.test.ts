import { describe, expect, it } from 'vitest'
import type { Field } from '../schema/types'
import { validateEntry } from './validate'

const fields: Field[] = [
  { key: 'title', type: 'text', required: true },
  { key: 'age', type: 'number' },
  { key: 'live', type: 'boolean' },
  { key: 'status', type: 'select', options: ['a', 'b'] },
  { key: 'tags', type: 'relation', to: 'tags' },
]

describe('validateEntry', () => {
  it('geçerli veri: ok, sorun yok', () => {
    const r = validateEntry(fields, { title: 'X', age: 3, live: true, status: 'a' })
    expect(r.ok).toBe(true)
    expect(r.issues).toEqual([])
  })

  it('eksik required → warning, ok kalır', () => {
    const r = validateEntry(fields, { age: 1 })
    expect(r.ok).toBe(true)
    expect(r.issues).toContainEqual({
      key: 'title',
      level: 'warning',
      kind: 'required',
      message: expect.stringContaining('required'),
    })
  })

  it('issue kind alanı taşır (required/type/unknown-key)', () => {
    const r = validateEntry(fields, { age: 'üç', ekstra: 1 })
    expect(r.issues.find((i) => i.key === 'title')?.kind).toBe('required')
    expect(r.issues.find((i) => i.key === 'age')?.kind).toBe('type')
    expect(r.issues.find((i) => i.key === 'ekstra')?.kind).toBe('unknown-key')
  })

  it('yanlış tip → error, ok false', () => {
    const r = validateEntry(fields, { title: 'X', age: 'üç' })
    expect(r.ok).toBe(false)
    expect(r.issues.some((i) => i.key === 'age' && i.level === 'error')).toBe(true)
  })

  it('_ ile başlayan reserved anahtar (ör. _status) uyarı vermez', () => {
    const r = validateEntry(fields, { title: 'X', _status: 'draft' })
    expect(r.ok).toBe(true)
    expect(r.issues.some((i) => i.key === '_status')).toBe(false)
  })

  it('bilinmeyen anahtar → warning, ok kalır', () => {
    const r = validateEntry(fields, { title: 'X', ekstra: 1 })
    expect(r.ok).toBe(true)
    expect(r.issues).toContainEqual({
      key: 'ekstra',
      level: 'warning',
      kind: 'unknown-key',
      message: expect.stringContaining('not in the schema'),
    })
  })

  it('select değeri seçenek dışı → error', () => {
    const r = validateEntry(fields, { title: 'X', status: 'z' })
    expect(r.ok).toBe(false)
    expect(r.issues.some((i) => i.key === 'status' && i.level === 'error')).toBe(true)
  })

  it('relation slug dizisi kabul edilir', () => {
    const r = validateEntry(fields, { title: 'X', tags: ['a', 'b'] })
    expect(r.ok).toBe(true)
  })

  it('relation tekil string → error (dizi bekleniyor)', () => {
    const r = validateEntry(fields, { title: 'X', tags: 'a' })
    expect(r.ok).toBe(false)
    expect(r.issues.some((i) => i.key === 'tags' && i.level === 'error')).toBe(true)
  })

  it('relation dizideki string olmayan öğe → error', () => {
    const r = validateEntry(fields, { title: 'X', tags: ['a', 1] })
    expect(r.ok).toBe(false)
    expect(r.issues.some((i) => i.key === 'tags' && i.level === 'error')).toBe(true)
  })
})

describe('validateEntry yeni tipler', () => {
  const fields: Field[] = [
    { key: 'site', type: 'url' },
    { key: 'mail', type: 'email' },
    { key: 'renk', type: 'color' },
    { key: 'etiketler', type: 'list' },
    { key: 'adres', type: 'group', fields: [{ key: 'sehir', type: 'text' }] },
  ]

  it('geçerli değerler → ok', () => {
    const r = validateEntry(fields, {
      site: 'https://ornek.com',
      mail: 'a@b.com',
      renk: '#ff0000',
      etiketler: ['x', 'y'],
      adres: { sehir: 'İstanbul' },
    })
    expect(r.ok).toBe(true)
  })

  it('geçersiz url → error', () => {
    expect(validateEntry(fields, { site: 'url-değil' }).ok).toBe(false)
  })

  it('geçersiz email → error', () => {
    expect(validateEntry(fields, { mail: 'hatalı' }).ok).toBe(false)
  })

  it('geçersiz color (hex değil) → error', () => {
    expect(validateEntry(fields, { renk: 'kırmızı' }).ok).toBe(false)
    expect(validateEntry(fields, { renk: '#fff' }).ok).toBe(true)
  })

  it('list string dizisi değilse → error', () => {
    expect(validateEntry(fields, { etiketler: 'x' }).ok).toBe(false)
    expect(validateEntry(fields, { etiketler: [1] }).ok).toBe(false)
  })

  it('group nesne değilse → error', () => {
    expect(validateEntry(fields, { adres: 'metin' }).ok).toBe(false)
    expect(validateEntry(fields, { adres: ['a'] }).ok).toBe(false)
  })
})

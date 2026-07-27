import { describe, expect, it } from 'vitest'
import { STATUS_KEY, entryStatus, isPublished } from './status'

describe('entryStatus', () => {
  it('_status yoksa published (geriye uyumlu)', () => {
    expect(entryStatus({})).toBe('published')
    expect(entryStatus({ title: 'X' })).toBe('published')
  })

  it('_status draft ise draft', () => {
    expect(entryStatus({ _status: 'draft' })).toBe('draft')
  })

  it('_status published ise published', () => {
    expect(entryStatus({ _status: 'published' })).toBe('published')
  })

  it('bilinmeyen değer → published (güvenli varsayılan)', () => {
    expect(entryStatus({ _status: 'garip' })).toBe('published')
  })

  it('isPublished', () => {
    expect(isPublished({ _status: 'draft' })).toBe(false)
    expect(isPublished({})).toBe(true)
  })

  it('STATUS_KEY _status', () => {
    expect(STATUS_KEY).toBe('_status')
  })
})

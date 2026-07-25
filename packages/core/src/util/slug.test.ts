import { describe, expect, it } from 'vitest'
import { slugify } from './slug'

describe('slugify', () => {
  it('boşlukları tire yapar, küçük harfe çevirir', () => {
    expect(slugify('Merhaba Dünya')).toBe('merhaba-dunya')
  })
  it('Türkçe karakterleri eşler', () => {
    expect(slugify('İçğüşçı ÇĞÜŞÇI')).toBe('icgusci-cgusci')
  })
  it('yol karakterlerini temizler (path traversal)', () => {
    expect(slugify('../../etc/passwd')).toBe('etc-passwd')
    expect(slugify('a/b')).toBe('a-b')
  })
  it('tekrar eden ve baştaki/sondaki tireleri sadeleştirir', () => {
    expect(slugify('  --a---b--  ')).toBe('a-b')
  })
  it('boş girdi için varsayılan verir', () => {
    expect(slugify('!!!')).toBe('icerik')
    expect(slugify('')).toBe('icerik')
  })
})

import { describe, expect, it } from 'vitest'
import { MemoryAdapter } from './memory'

describe('MemoryAdapter', () => {
  it('yazar ve okur', async () => {
    const a = new MemoryAdapter()
    await a.write('content/posts/a.json', '{"x":1}')
    expect(await a.read('content/posts/a.json')).toBe('{"x":1}')
  })

  it('olmayan dosya için null döner', async () => {
    const a = new MemoryAdapter()
    expect(await a.read('yok.json')).toBeNull()
  })

  it('exists doğru çalışır', async () => {
    const a = new MemoryAdapter({ 'a.json': '1' })
    expect(await a.exists('a.json')).toBe(true)
    expect(await a.exists('b.json')).toBe(false)
  })

  it('list yalnızca doğrudan alt dosyaların basename listesini verir', async () => {
    const a = new MemoryAdapter({
      'content/posts/a.json': '1',
      'content/posts/b.json': '2',
      'content/posts/nested/c.json': '3',
      'content/other/d.json': '4',
    })
    expect((await a.list('content/posts')).sort()).toEqual(['a.json', 'b.json'])
  })

  it('list olmayan dizin için boş dizi verir', async () => {
    const a = new MemoryAdapter()
    expect(await a.list('content/x')).toEqual([])
  })

  it('delete dosyayı kaldırır', async () => {
    const a = new MemoryAdapter({ 'a.json': '1' })
    await a.delete('a.json')
    expect(await a.exists('a.json')).toBe(false)
  })

  it('snapshot yazılan tüm dosyaları verir', async () => {
    const a = new MemoryAdapter()
    await a.write('a.json', '1')
    expect(a.snapshot()).toEqual({ 'a.json': '1' })
  })
})

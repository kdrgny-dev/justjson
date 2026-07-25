import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FsAdapter } from './fs-adapter'

let root: string
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'justjson-'))
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('FsAdapter', () => {
  it('ara dizinleri oluşturarak yazar ve okur', async () => {
    const a = new FsAdapter(root)
    await a.write('content/posts/a.json', '{"x":1}')
    expect(await a.read('content/posts/a.json')).toBe('{"x":1}')
  })

  it('olmayan dosya null döner', async () => {
    const a = new FsAdapter(root)
    expect(await a.read('yok.json')).toBeNull()
  })

  it('exists doğru çalışır', async () => {
    const a = new FsAdapter(root)
    expect(await a.exists('x.json')).toBe(false)
    await a.write('x.json', '1')
    expect(await a.exists('x.json')).toBe(true)
  })

  it('list yalnızca doğrudan alt dosyaları verir', async () => {
    const a = new FsAdapter(root)
    await a.write('content/posts/a.json', '1')
    await a.write('content/posts/b.json', '2')
    await a.write('content/posts/nested/c.json', '3')
    expect((await a.list('content/posts')).sort()).toEqual(['a.json', 'b.json'])
  })

  it('list olmayan dizin için boş dizi', async () => {
    const a = new FsAdapter(root)
    expect(await a.list('content/x')).toEqual([])
  })

  it('delete dosyayı kaldırır, yoksa hata vermez', async () => {
    const a = new FsAdapter(root)
    await a.write('x.json', '1')
    await a.delete('x.json')
    await a.delete('x.json')
    expect(await a.exists('x.json')).toBe(false)
  })
})

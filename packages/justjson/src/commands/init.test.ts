import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resolveContentDir } from '../config'
import { initProject, listTemplates } from './init'

let root: string
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'justjson-'))
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('resolveContentDir', () => {
  it('config yoksa content', async () => {
    expect(await resolveContentDir(root)).toBe('content')
  })
  it('config varsa onu okur', async () => {
    await writeFile(join(root, 'justjson.config.json'), JSON.stringify({ contentDir: 'data' }))
    expect(await resolveContentDir(root)).toBe('data')
  })
})

describe('initProject', () => {
  it('blog template en az bir koleksiyon içerir', () => {
    expect(listTemplates()).toContain('blog')
  })

  it('şemayı ve örnek kaydı yazar', async () => {
    await initProject(root, 'blog')
    const schema = JSON.parse(await readFile(join(root, 'content/_schema.json'), 'utf8'))
    expect(schema.collections[0].name).toBe('posts')
    const entry = JSON.parse(await readFile(join(root, 'content/posts/ilk-yazi.json'), 'utf8'))
    expect(entry.title).toBe('İlk yazı')
  })

  it('şema zaten varsa hata verir', async () => {
    await initProject(root, 'blog')
    await expect(initProject(root, 'blog')).rejects.toThrow()
  })

  it('bilinmeyen template hata verir', async () => {
    await expect(initProject(root, 'yok')).rejects.toThrow()
  })
})

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { initProject } from './init'
import { generateTypesFile } from './types'

let root: string
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'justjson-'))
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('generateTypesFile', () => {
  it('şemadan types.ts yazar', async () => {
    await initProject(root, 'blog')
    const out = await generateTypesFile(root)
    expect(out).toBe(join(root, 'types.ts'))
    const content = await readFile(out, 'utf8')
    expect(content).toContain('export interface Posts')
  })

  it('types.ts ile birlikte tipli content.ts loader yazar', async () => {
    await initProject(root, 'blog')
    await generateTypesFile(root)
    const loader = await readFile(join(root, 'content.ts'), 'utf8')
    expect(loader).toContain("from './types'")
    expect(loader).toContain('export const loadPosts')
  })

  it('üretilen loader gerçekten içeriği slug ile yükler, draft filtreler', async () => {
    await initProject(root, 'blog')
    // Bir taslak ekle
    await writeFile(
      join(root, 'content', 'posts', 'taslak.json'),
      JSON.stringify({ title: 'Taslak', _status: 'draft' }),
    )
    await generateTypesFile(root)
    const mod = (await import(/* @vite-ignore */ join(root, 'content.ts'))) as {
      loadPosts: (opts?: { drafts?: boolean }) => Promise<Array<{ slug: string }>>
    }
    const published = await mod.loadPosts()
    expect(published.length).toBeGreaterThan(0)
    expect(typeof published[0]?.slug).toBe('string')
    expect(published.some((p) => p.slug === 'taslak')).toBe(false)

    const all = await mod.loadPosts({ drafts: true })
    expect(all.some((p) => p.slug === 'taslak')).toBe(true)
  })

  it('şema yoksa hata verir', async () => {
    await expect(generateTypesFile(root)).rejects.toThrow()
  })
})

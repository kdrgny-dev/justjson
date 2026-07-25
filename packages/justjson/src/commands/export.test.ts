import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { unzipSync } from 'fflate'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { exportZip } from './export'
import { initProject } from './init'

let root: string
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'justjson-'))
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('exportZip', () => {
  it('şema, içerik ve types içeren zip üretir', async () => {
    await initProject(root, 'blog')
    const out = await exportZip(root)
    expect(out).toBe(join(root, 'justjson-export.zip'))
    const buf = await readFile(out)
    const files = unzipSync(new Uint8Array(buf))
    const names = Object.keys(files)
    expect(names).toContain('content/_schema.json')
    expect(names).toContain('content/posts/ilk-yazi.json')
    expect(names).toContain('types.ts')
  })

  it('şema yoksa hata verir', async () => {
    await expect(exportZip(root)).rejects.toThrow()
  })
})

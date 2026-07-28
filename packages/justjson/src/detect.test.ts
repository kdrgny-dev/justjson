import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { detectFramework } from './detect'

let root: string

async function pkg(deps: Record<string, string>, dev: Record<string, string> = {}) {
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({ name: 'x', dependencies: deps, devDependencies: dev }),
  )
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'jj-detect-'))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('detectFramework', () => {
  it('astro bağımlılığını tanır', async () => {
    await pkg({ astro: '^5.0.0' })
    expect(await detectFramework(root)).toBe('astro')
  })

  it('devDependencies içindekini de tanır', async () => {
    await pkg({}, { astro: '^5.0.0' })
    expect(await detectFramework(root)).toBe('astro')
  })

  it('next, nuxt ve sveltekit tanır', async () => {
    await pkg({ next: '^15.0.0' })
    expect(await detectFramework(root)).toBe('next')
    await pkg({ nuxt: '^3.0.0' })
    expect(await detectFramework(root)).toBe('nuxt')
    await pkg({ '@sveltejs/kit': '^2.0.0' })
    expect(await detectFramework(root)).toBe('sveltekit')
  })

  it('framework yoksa ama vite varsa vite döner', async () => {
    await pkg({}, { vite: '^6.0.0' })
    expect(await detectFramework(root)).toBe('vite')
  })

  it('astro ve vite birlikteyse astro kazanır', async () => {
    await pkg({ astro: '^5.0.0' }, { vite: '^6.0.0' })
    expect(await detectFramework(root)).toBe('astro')
  })

  it('package.json varsa ama tanınan bir şey yoksa node döner', async () => {
    await pkg({ express: '^4.0.0' })
    expect(await detectFramework(root)).toBe('node')
  })

  it('package.json yoksa unknown döner', async () => {
    expect(await detectFramework(root)).toBe('unknown')
  })

  it('bozuk package.json patlamaz', async () => {
    await writeFile(join(root, 'package.json'), '{ bozuk')
    expect(await detectFramework(root)).toBe('unknown')
  })
})

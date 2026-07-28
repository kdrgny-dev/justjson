import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Loader } from 'astro/loaders'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { CollectionDefinition } from './collections'
import { justjsonCollections } from './collections'

// defineCollection'ın dönüş tipi bir union; testte loader dalına daraltıyoruz.
const withLoader = (c: CollectionDefinition | undefined) => c as { loader: Loader } | undefined

const SCHEMA = {
  version: 1,
  collections: [
    { name: 'posts', path: 'posts', fields: [{ key: 'title', type: 'text', required: true }] },
    { name: 'blog-tags', path: 'blog-tags', fields: [{ key: 'name', type: 'text' }] },
  ],
  singletons: [
    { name: 'settings', path: 'settings.json', fields: [{ key: 'title', type: 'text' }] },
  ],
}

let root: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'jj-astro-col-'))
  await mkdir(join(root, 'content'), { recursive: true })
  await writeFile(join(root, 'content/_schema.json'), JSON.stringify(SCHEMA))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('justjsonCollections', () => {
  it('şemadaki her koleksiyon ve tekil için bir giriş üretir', async () => {
    const collections = await justjsonCollections({ root })
    expect(Object.keys(collections).sort()).toEqual(['blog-tags', 'posts', 'settings'])
  })

  it('her girişte bir loader bulunur', async () => {
    const collections = await justjsonCollections({ root })
    expect(withLoader(collections.posts)?.loader.name).toBe('@kdrgny/justjson-astro')
    expect(typeof withLoader(collections.posts)?.loader.load).toBe('function')
  })

  it('Content Layer koleksiyonu olarak işaretlenir', async () => {
    // defineCollection bunu ekler; eksikse Astro legacy moda düşüp koleksiyonu boş görür.
    const collections = await justjsonCollections({ root })
    expect(collections.posts?.type).toBe('content_layer')
    expect(collections.settings?.type).toBe('content_layer')
  })

  it('şema yoksa boş nesne döner, build kırılmaz', async () => {
    await rm(join(root, 'content/_schema.json'))
    await expect(justjsonCollections({ root })).resolves.toEqual({})
  })
})

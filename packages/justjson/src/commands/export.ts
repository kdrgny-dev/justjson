import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ContentStore, buildExportManifest, loadSchema } from '@justjson/core'
import type { StorageAdapter } from '@justjson/core'
import { zipSync } from 'fflate'
import { resolveContentDir } from '../config'
import { FsAdapter } from '../fs-adapter'

export async function collectExportZip(
  adapter: StorageAdapter,
  contentDir: string,
): Promise<Uint8Array> {
  const schema = await loadSchema(adapter, contentDir)
  if (!schema) throw new Error('Şema bulunamadı. Önce `justjson init` çalıştırın.')

  const store = new ContentStore(adapter, schema, contentDir)
  const entries: Record<string, Record<string, unknown>[]> = {}
  for (const col of schema.collections) {
    const slugs = await store.listEntries(col.name)
    const rows: Record<string, unknown>[] = []
    for (const slug of slugs) {
      const data = await store.readEntry(col.name, slug)
      if (data) rows.push({ slug, ...data })
    }
    entries[col.name] = rows
  }

  const singletons: Record<string, Record<string, unknown>> = {}
  for (const s of schema.singletons) {
    const data = await store.readSingleton(s.name)
    if (data) singletons[s.name] = data
  }

  const manifest = buildExportManifest({ schema, entries, singletons })
  const encoder = new TextEncoder()
  const zipInput: Record<string, Uint8Array> = {}
  for (const [path, content] of Object.entries(manifest)) {
    zipInput[path] = typeof content === 'string' ? encoder.encode(content) : content
  }
  return zipSync(zipInput)
}

export async function exportZip(root: string, outFile = 'justjson-export.zip'): Promise<string> {
  const adapter = new FsAdapter(root)
  const contentDir = await resolveContentDir(root)
  const zipped = await collectExportZip(adapter, contentDir)
  const outAbs = join(root, outFile)
  await writeFile(outAbs, zipped)
  return outAbs
}

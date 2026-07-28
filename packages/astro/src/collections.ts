import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { parseSchema } from '@justjson/core'
import { defineCollection } from 'astro/content/config'
import { justjson } from './loader'

export interface JustJsonCollectionsOptions {
  /** Proje kökü (varsayılan: process.cwd() — `astro dev`/`build` buradan çalışır). */
  root?: string | URL
  /** İçerik klasörü, köke göreli (varsayılan: "content"). */
  contentDir?: string
  /** true ise taslak kayıtlar da yüklenir. */
  drafts?: boolean
}

/** Astro'nun `collections` export'unun beklediği şekil. */
export type CollectionDefinition = ReturnType<typeof defineCollection>

/**
 * `content/_schema.json`'daki her koleksiyon ve tekil kayıt için bir Astro
 * koleksiyonu üretir — content.config.ts'te tek satır yeter.
 *
 * Şema yoksa boş nesne döner: JustJSON'u henüz çalıştırmamış bir projede
 * `astro build` kırılmaz.
 */
export async function justjsonCollections(
  options: JustJsonCollectionsOptions = {},
): Promise<Record<string, CollectionDefinition>> {
  const contentDir = options.contentDir ?? 'content'
  const rootValue = options.root ?? process.cwd()
  const root = (typeof rootValue === 'string' ? rootValue : fileURLToPath(rootValue)).replace(
    /\/$/,
    '',
  )

  let raw: string
  try {
    raw = await readFile(`${root}/${contentDir}/_schema.json`, 'utf8')
  } catch {
    return {}
  }

  const schema = parseSchema(JSON.parse(raw))
  const shared = { root, contentDir, drafts: options.drafts }
  const out: Record<string, CollectionDefinition> = {}

  // defineCollection, Content Layer koleksiyonlarını işaretler; düz nesne
  // verirsek Astro legacy moda düşüp koleksiyonu boş görür.
  for (const collection of schema.collections) {
    out[collection.name] = defineCollection({
      loader: justjson({ ...shared, collection: collection.name }),
    })
  }
  for (const singleton of schema.singletons) {
    out[singleton.name] = defineCollection({
      loader: justjson({ ...shared, singleton: singleton.name }),
    })
  }
  return out
}

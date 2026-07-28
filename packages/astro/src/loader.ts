import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { type Schema, entryStatus, parseSchema } from '@justjson/core'
import type { Loader, LoaderContext } from 'astro/loaders'
import { fieldsToZod } from './zod-schema'

export interface JustJsonLoaderOptions {
  /** Yüklenecek koleksiyonun şemadaki adı. `singleton` ile birlikte kullanılmaz. */
  collection?: string
  /** Yüklenecek tekil kaydın şemadaki adı. Tek entry'li bir koleksiyon olarak gelir. */
  singleton?: string
  /** Proje kökü. Verilmezse Astro'nun `config.root`'u kullanılır. */
  root?: string | URL
  /** İçerik klasörü, köke göreli (varsayılan: "content"). */
  contentDir?: string
  /** true ise `_status: 'draft'` kayıtlar da yüklenir. */
  drafts?: boolean
}

function toPath(value: string | URL): string {
  return (typeof value === 'string' ? value : fileURLToPath(value)).replace(/\/$/, '')
}

async function readSchema(root: string, contentDir: string): Promise<Schema> {
  let raw: string
  try {
    raw = await readFile(`${root}/${contentDir}/_schema.json`, 'utf8')
  } catch {
    throw new Error(
      `justjson: no schema found at ${contentDir}/_schema.json — run \`npx @kdrgny/justjson\` in this folder first.`,
    )
  }
  return parseSchema(JSON.parse(raw))
}

/**
 * Astro içerik koleksiyonlarını JustJSON'un `content/` klasöründen besler.
 * Şemadaki alanlardan zod şeması üretir, böylece `entry.data` tam tipli gelir.
 */
export function justjson(options: JustJsonLoaderOptions): Loader {
  const contentDir = options.contentDir ?? 'content'
  const name = options.collection ?? options.singleton
  if (!name) throw new Error('justjson: pass either `collection` or `singleton`.')

  return {
    name: '@kdrgny/justjson-astro',

    schema: async () => {
      // schema() Astro'dan context almaz; root verilmemişse cwd'ye güveniriz
      // (`astro dev`/`build` proje kökünden çalışır). Okunamazsa tip zorlanmaz.
      const root = options.root ? toPath(options.root) : process.cwd()
      try {
        const schema = await readSchema(root, contentDir)
        const container = options.singleton
          ? schema.singletons.find((s) => s.name === name)
          : schema.collections.find((c) => c.name === name)
        return fieldsToZod(container?.fields ?? [])
      } catch {
        return fieldsToZod([])
      }
    },

    load: async (ctx: LoaderContext) => {
      const root = toPath(options.root ?? ctx.config.root)
      const schema = await readSchema(root, contentDir)
      ctx.store.clear()

      /** Tek bir JSON dosyasını okuyup store'a yazar; taslaksa kaydı düşürür. */
      const sync = async (id: string, absolute: string, relative: string): Promise<void> => {
        let raw: string
        try {
          raw = await readFile(absolute, 'utf8')
        } catch {
          ctx.store.delete(id)
          return
        }
        const data = JSON.parse(raw) as Record<string, unknown>
        if (!options.drafts && entryStatus(data) === 'draft') {
          ctx.store.delete(id)
          return
        }
        ctx.store.set({
          id,
          data: await ctx.parseData({ id, data, filePath: relative }),
          digest: ctx.generateDigest(data),
          filePath: relative,
        })
      }

      if (options.singleton) {
        const single = schema.singletons.find((s) => s.name === name)
        if (!single) throw new Error(`justjson: singleton "${name}" is not in the schema.`)

        const absolute = `${root}/${contentDir}/${single.path}`
        await sync(name, absolute, `${contentDir}/${single.path}`)
        watch(ctx, absolute, (changed, event) => {
          if (changed !== absolute) return
          if (event === 'unlink') return void ctx.store.delete(name)
          return sync(name, absolute, `${contentDir}/${single.path}`)
        })
        return
      }

      const collection = schema.collections.find((c) => c.name === name)
      if (!collection) throw new Error(`justjson: collection "${name}" is not in the schema.`)

      const dir = `${root}/${contentDir}/${collection.path}`
      const idFor = (absolute: string) => absolute.slice(dir.length + 1, -'.json'.length)
      const relativeFor = (absolute: string) =>
        `${contentDir}/${collection.path}/${absolute.slice(dir.length + 1)}`

      let files: string[]
      try {
        files = (await readdir(dir)).filter((f) => f.endsWith('.json'))
      } catch {
        ctx.logger.warn(
          `justjson: ${contentDir}/${collection.path}/ does not exist yet — collection is empty.`,
        )
        files = []
      }

      for (const file of files.sort()) {
        await sync(file.slice(0, -'.json'.length), `${dir}/${file}`, relativeFor(`${dir}/${file}`))
      }

      // Editörden gelen kayıt anında siteye yansısın.
      watch(ctx, dir, (changed, event) => {
        if (!changed.startsWith(`${dir}/`) || !changed.endsWith('.json')) return
        if (event === 'unlink') return void ctx.store.delete(idFor(changed))
        return sync(idFor(changed), changed, relativeFor(changed))
      })
    },
  }
}

/**
 * Dev sunucusunda dosya değişimlerini dinler. Astro'nun HMR'ı store
 * güncellendiğinde tetiklenir, bu yüzden değişimi tek tek işlemek gerekir.
 */
type WatchEvent = 'change' | 'add' | 'unlink'

function watch(
  ctx: LoaderContext,
  target: string,
  onEvent: (path: string, event: WatchEvent) => Promise<void> | void,
): void {
  if (!ctx.watcher) return
  ctx.watcher.add(target)
  for (const event of ['change', 'add', 'unlink'] as const) {
    ctx.watcher.on(event, (path: string) => onEvent(path, event))
  }
}

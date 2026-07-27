import type { Schema } from '../schema/types'

function pascalCase(name: string): string {
  return name
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

const IMPORTS = `import { readFile, readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'`

const READERS = `export type WithSlug<T> = T & { slug: string }

async function readCollection<T>(dir: string): Promise<WithSlug<T>[]> {
  let files: string[]
  try {
    files = (await readdir(join(contentDir, dir))).filter((f) => f.endsWith('.json'))
  } catch {
    return []
  }
  const out: WithSlug<T>[] = []
  for (const file of files.sort()) {
    const raw = await readFile(join(contentDir, dir, file), 'utf8')
    out.push({ ...(JSON.parse(raw) as T), slug: file.slice(0, -'.json'.length) })
  }
  return out
}

async function readSingleton<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(join(contentDir, file), 'utf8')) as T
  } catch {
    return null
  }
}`

/**
 * types.ts'in yanına yazılacak, sıfır-bağımlılıklı tipli içerik yükleyicisi üretir.
 * Üretilen dosya proje kökünde types.ts ile birlikte yaşar ve içeriği fs'ten okur.
 */
export function generateLoader(schema: Schema, contentDir: string): string {
  const typeNames = [
    ...schema.collections.map((c) => pascalCase(c.name)),
    ...schema.singletons.map((s) => pascalCase(s.name)),
  ]

  const header = [
    '// JustJSON tarafından üretildi — elle düzenlemeyin.',
    IMPORTS,
    `import type { ${typeNames.join(', ')} } from './types'`,
  ].join('\n')

  const q = (s: string): string => `'${s.replace(/'/g, "\\'")}'`
  const contentDirLine = `const contentDir = join(dirname(fileURLToPath(import.meta.url)), ${q(contentDir)})`

  const loaders: string[] = []
  for (const col of schema.collections) {
    const name = pascalCase(col.name)
    loaders.push(
      `export const load${name} = (): Promise<WithSlug<${name}>[]> => readCollection<${name}>(${q(col.path)})`,
    )
  }
  for (const s of schema.singletons) {
    const name = pascalCase(s.name)
    loaders.push(
      `export const load${name} = (): Promise<${name} | null> => readSingleton<${name}>(${q(s.path)})`,
    )
  }

  return `${[header, contentDirLine, READERS, loaders.join('\n')].join('\n\n')}\n`
}

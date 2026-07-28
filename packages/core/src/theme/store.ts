import type { StorageAdapter } from '../storage/adapter'
import { type Theme, parseTheme } from './theme'

function themePath(contentDir: string): string {
  return `${contentDir}/_theme.json`
}

/** Tema dosyası her zaman okunabilir sayılır: yoksa ya da bozuksa varsayılana düşer. */
export async function loadTheme(adapter: StorageAdapter, contentDir = 'content'): Promise<Theme> {
  const raw = await adapter.read(themePath(contentDir))
  if (raw === null) return parseTheme(null)
  try {
    return parseTheme(JSON.parse(raw))
  } catch {
    return parseTheme(null)
  }
}

export async function saveTheme(
  adapter: StorageAdapter,
  theme: Theme,
  contentDir = 'content',
): Promise<void> {
  await adapter.write(themePath(contentDir), `${JSON.stringify(parseTheme(theme), null, 2)}\n`)
}

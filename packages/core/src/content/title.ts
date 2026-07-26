import type { Field } from '../schema/types'

const TITLE_KEYS = ['title', 'name', 'baslik', 'başlık', 'ad', 'label', 'heading', 'isim']

/**
 * İçerikten insanca bir başlık çıkarır: önce başlık gibi görünen bir alan,
 * yoksa ilk dolu metin alanı. Hiçbiri yoksa null.
 */
export function entryTitle(fields: Field[], data: Record<string, unknown>): string | null {
  for (const key of TITLE_KEYS) {
    const field = fields.find((f) => f.key.toLowerCase() === key)
    const value = field ? data[field.key] : undefined
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  for (const f of fields) {
    if (f.type !== 'text' && f.type !== 'richtext') continue
    const value = data[f.key]
    if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 120)
  }
  return null
}

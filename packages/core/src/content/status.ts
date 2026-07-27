export type EntryStatus = 'draft' | 'published'

export const STATUS_KEY = '_status'

/** Bir entry'nin yayın durumu. _status yoksa 'published' (geriye uyumlu). */
export function entryStatus(data: Record<string, unknown>): EntryStatus {
  return data[STATUS_KEY] === 'draft' ? 'draft' : 'published'
}

export function isPublished(data: Record<string, unknown>): boolean {
  return entryStatus(data) === 'published'
}

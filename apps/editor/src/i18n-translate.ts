// Schema-farkında çeviri: bir kaydın çevrilebilir metin alanlarını toplar,
// sunucuya gönderir, dönen çevirilerle kardeş dil kaydını yazar.
// Kimlik alanları (locale/group/slug) ve metin olmayan tipler çevrilmez.
import * as api from './api'
import { hostedTranslate } from './browser/hosted'

export interface Field {
  key: string
  type: string
  fields?: Field[]
}

const SKIP = new Set(['locale', 'group', 'slug'])
const TEXT = new Set(['text', 'richtext', 'textarea', 'markdown', 'string'])

function collect(fields: Field[], data: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of fields) {
    if (SKIP.has(f.key)) continue
    const value = data?.[f.key]
    const key = prefix ? `${prefix}.${f.key}` : f.key
    if (TEXT.has(f.type)) {
      if (typeof value === 'string' && value.trim()) out[key] = value
    } else if (f.type === 'list' && Array.isArray(value)) {
      value.forEach((item, i) => {
        if (typeof item === 'string' && item.trim()) out[`${key}.${i}`] = item
      })
    } else if (f.type === 'repeater' && Array.isArray(value) && f.fields) {
      value.forEach((row, i) => {
        Object.assign(out, collect(f.fields as Field[], row as Record<string, unknown>, `${key}.${i}`))
      })
    }
  }
  return out
}

function setPath(obj: Record<string, unknown>, path: string, value: string): void {
  const parts = path.split('.')
  let node: unknown = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i] as string
    const key: string | number = /^\d+$/.test(part) ? Number(part) : part
    node = (node as Record<string | number, unknown>)?.[key]
    if (node == null) return
  }
  const last = parts[parts.length - 1] as string
  const lk: string | number = /^\d+$/.test(last) ? Number(last) : last
  ;(node as Record<string | number, unknown>)[lk] = value
}

export interface TranslateResult {
  written: string[]
  skipped: string[]
}

export async function translateEntry(opts: {
  collection: { name: string; fields: Field[] }
  data: Record<string, unknown>
  source: string
  targets: string[]
  overwrite: boolean
}): Promise<TranslateResult> {
  const hasGroup = opts.collection.fields.some((f) => f.key === 'group')
  const existing = new Set(await api.listEntries(opts.collection.name))
  const written: string[] = []
  const skipped: string[] = []

  for (const target of opts.targets) {
    const siblingId = hasGroup ? `${String(opts.data.group)}-${target}` : target
    if (existing.has(siblingId) && !opts.overwrite) {
      skipped.push(target)
      continue
    }
    const fields = collect(opts.collection.fields, opts.data)
    const translated = await hostedTranslate(fields, opts.source, target)
    const next = structuredClone(opts.data) as Record<string, unknown>
    next.locale = target
    for (const [path, value] of Object.entries(translated)) setPath(next, path, value)
    await api.putEntry(opts.collection.name, siblingId, next)
    written.push(target)
  }
  return { written, skipped }
}

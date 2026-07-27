import type { Field } from '../schema/types'

export type IssueKind = 'required' | 'type' | 'unknown-key'

export interface ValidationIssue {
  key: string
  level: 'error' | 'warning'
  kind: IssueKind
  message: string
}

export interface ValidationResult {
  ok: boolean
  issues: ValidationIssue[]
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === ''
}

const URL_RE = /^[a-z][a-z0-9+.-]*:\/\/.+/i
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

function typeError(field: Field, value: unknown): string | null {
  switch (field.type) {
    case 'text':
    case 'richtext':
    case 'date':
    case 'image':
      return typeof value === 'string' ? null : 'metin bekleniyor'
    case 'url':
      if (typeof value !== 'string') return 'metin bekleniyor'
      return URL_RE.test(value) ? null : 'geçerli bir URL bekleniyor'
    case 'email':
      if (typeof value !== 'string') return 'metin bekleniyor'
      return EMAIL_RE.test(value) ? null : 'geçerli bir e-posta bekleniyor'
    case 'color':
      if (typeof value !== 'string') return 'metin bekleniyor'
      return COLOR_RE.test(value) ? null : 'hex renk bekleniyor (ör. #ff0000)'
    case 'list':
      if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
        return 'metin dizisi bekleniyor'
      }
      return null
    case 'relation':
      if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
        return 'slug dizisi bekleniyor'
      }
      return null
    case 'group':
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return 'nesne bekleniyor'
      }
      return null
    case 'number':
      return typeof value === 'number' ? null : 'sayı bekleniyor'
    case 'boolean':
      return typeof value === 'boolean' ? null : 'boolean bekleniyor'
    case 'select':
      if (typeof value !== 'string') return 'metin bekleniyor'
      return field.options?.includes(value) ? null : 'seçenek dışı değer'
  }
}

export function validateEntry(fields: Field[], data: Record<string, unknown>): ValidationResult {
  const issues: ValidationIssue[] = []
  const known = new Set(fields.map((f) => f.key))

  for (const field of fields) {
    const value = data[field.key]
    if (isEmpty(value)) {
      if (field.required) {
        issues.push({
          key: field.key,
          level: 'warning',
          kind: 'required',
          message: 'zorunlu alan boş',
        })
      }
      continue
    }
    const err = typeError(field, value)
    if (err) issues.push({ key: field.key, level: 'error', kind: 'type', message: err })
  }

  for (const key of Object.keys(data)) {
    // _ ile başlayan anahtarlar reserved (ör. _status) — şema dışı sayılmaz.
    if (key.startsWith('_')) continue
    if (!known.has(key)) {
      issues.push({ key, level: 'warning', kind: 'unknown-key', message: 'anahtar şemada yok' })
    }
  }

  return { ok: issues.every((i) => i.level !== 'error'), issues }
}

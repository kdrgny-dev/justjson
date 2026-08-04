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
      return typeof value === 'string' ? null : 'expected text'
    case 'url':
      if (typeof value !== 'string') return 'expected text'
      return URL_RE.test(value) ? null : 'expected a valid URL'
    case 'email':
      if (typeof value !== 'string') return 'expected text'
      return EMAIL_RE.test(value) ? null : 'expected a valid email address'
    case 'color':
      if (typeof value !== 'string') return 'expected text'
      return COLOR_RE.test(value) ? null : 'expected a hex color (e.g. #ff0000)'
    case 'list':
      if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
        return 'expected a list of text'
      }
      return null
    case 'relation':
      if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
        return 'expected a list of slugs'
      }
      return null
    case 'group':
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return 'expected an object'
      }
      return null
    case 'repeater':
      return Array.isArray(value) ? null : 'expected a list of rows'
    case 'number':
      return typeof value === 'number' ? null : 'expected a number'
    case 'boolean':
      return typeof value === 'boolean' ? null : 'expected true or false'
    case 'select':
      if (typeof value !== 'string') return 'expected text'
      return field.options?.includes(value) ? null : 'not one of the options'
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
          message: 'required field is empty',
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
      issues.push({
        key,
        level: 'warning',
        kind: 'unknown-key',
        message: 'key is not in the schema',
      })
    }
  }

  return { ok: issues.every((i) => i.level !== 'error'), issues }
}

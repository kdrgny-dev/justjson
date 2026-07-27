import type { Field, Schema } from '../schema/types'
import { type IssueKind, validateEntry } from './validate'

export type ProjectIssueKind =
  | IssueKind
  | 'broken-relation'
  | 'duplicate-slug'
  | 'missing-media'
  | 'schema-content-mismatch'

export interface ProjectIssue {
  level: 'error' | 'warning'
  kind: ProjectIssueKind
  message: string
  collection?: string
  singleton?: string
  slug?: string
  field?: string
}

export interface ProjectEntry {
  slug: string
  data: Record<string, unknown>
}

export interface ProjectContent {
  collections: Record<string, ProjectEntry[]>
  singletons: Record<string, Record<string, unknown> | null>
  /** Diskte var olan medya yolları (verilirse image alanları bunlara karşı kontrol edilir). */
  media?: string[]
}

function basename(path: string): string {
  return path.split(/[/\\]/).pop() ?? path
}

function imageFields(fields: Field[]): Field[] {
  return fields.filter((f) => f.type === 'image')
}

function relationFields(fields: Field[]): Field[] {
  return fields.filter((f) => f.type === 'relation')
}

export function validateProject(schema: Schema, content: ProjectContent): ProjectIssue[] {
  const issues: ProjectIssue[] = []
  const mediaNames = content.media ? new Set(content.media.map(basename)) : null

  // Şemada olmayan koleksiyon klasörleri
  const schemaCollectionNames = new Set(schema.collections.map((c) => c.name))
  for (const name of Object.keys(content.collections)) {
    if (!schemaCollectionNames.has(name)) {
      issues.push({
        level: 'warning',
        kind: 'schema-content-mismatch',
        collection: name,
        message: `Koleksiyon klasörü '${name}' şemada yok`,
      })
    }
  }

  // Hedef koleksiyon → slug kümesi (kırık relation kontrolü için)
  const slugsByCollection: Record<string, Set<string>> = {}
  for (const [name, entries] of Object.entries(content.collections)) {
    slugsByCollection[name] = new Set(entries.map((e) => e.slug))
  }

  for (const col of schema.collections) {
    const entries = content.collections[col.name] ?? []

    // Duplicate slug
    const seen = new Set<string>()
    const reported = new Set<string>()
    for (const { slug } of entries) {
      if (seen.has(slug) && !reported.has(slug)) {
        reported.add(slug)
        issues.push({
          level: 'error',
          kind: 'duplicate-slug',
          collection: col.name,
          slug,
          message: `'${col.name}' içinde yinelenen slug: ${slug}`,
        })
      }
      seen.add(slug)
    }

    const rels = relationFields(col.fields)
    const imgs = imageFields(col.fields)

    for (const { slug, data } of entries) {
      // Entry-içi doğrulama
      for (const issue of validateEntry(col.fields, data).issues) {
        issues.push({
          level: issue.level,
          kind: issue.kind,
          collection: col.name,
          slug,
          field: issue.key,
          message: issue.message,
        })
      }

      // Kırık relation
      for (const field of rels) {
        const value = data[field.key]
        if (!Array.isArray(value)) continue
        const target = field.to ? slugsByCollection[field.to] : undefined
        for (const ref of value) {
          if (typeof ref !== 'string') continue
          if (!target || !target.has(ref)) {
            issues.push({
              level: 'error',
              kind: 'broken-relation',
              collection: col.name,
              slug,
              field: field.key,
              message: field.to
                ? `Kırık bağlantı: '${field.to}' içinde '${ref}' yok`
                : `Relation alanı '${field.key}' için hedef koleksiyon tanımsız`,
            })
          }
        }
      }

      // Eksik medya
      if (mediaNames) {
        for (const field of imgs) {
          const value = data[field.key]
          if (typeof value !== 'string' || value === '') continue
          if (!mediaNames.has(basename(value))) {
            issues.push({
              level: 'error',
              kind: 'missing-media',
              collection: col.name,
              slug,
              field: field.key,
              message: `Eksik medya: ${value}`,
            })
          }
        }
      }
    }
  }

  for (const s of schema.singletons) {
    const data = content.singletons[s.name] ?? {}
    for (const issue of validateEntry(s.fields, data).issues) {
      issues.push({
        level: issue.level,
        kind: issue.kind,
        singleton: s.name,
        field: issue.key,
        message: issue.message,
      })
    }
    if (mediaNames) {
      for (const field of imageFields(s.fields)) {
        const value = data[field.key]
        if (typeof value !== 'string' || value === '') continue
        if (!mediaNames.has(basename(value))) {
          issues.push({
            level: 'error',
            kind: 'missing-media',
            singleton: s.name,
            field: field.key,
            message: `Eksik medya: ${value}`,
          })
        }
      }
    }
  }

  return issues
}

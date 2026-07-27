import type { Collection, Field, FieldType, Schema, Singleton } from '../schema/types'
import { slugify } from '../util/slug'

type Row = Record<string, unknown>

const HTML = /<[a-z!/][\s\S]*>/i

function inferType(value: unknown): FieldType | null {
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'string') return HTML.test(value) ? 'richtext' : 'text'
  return null
}

function isPlainObject(v: unknown): v is Row {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// alanları satırların birleşiminden çıkar; herhangi bir satır HTML içeriyorsa text→richtext yükselt
function fieldsFromRows(rows: Row[]): Field[] {
  const order: string[] = []
  const types = new Map<string, FieldType>()
  for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      const t = inferType(value)
      if (t === null) continue
      if (!types.has(key)) {
        types.set(key, t)
        order.push(key)
      } else if (types.get(key) === 'text' && t === 'richtext') {
        types.set(key, 'richtext')
      }
    }
  }
  return order.map((key) => ({ key, label: key, type: types.get(key) as FieldType }))
}

export interface InferredProject {
  schema: Schema
  entries: Record<string, Row[]>
  singletons: Record<string, Row>
}

/**
 * Rastgele bir içerik JSON'undan şema + veri çıkarır:
 * nesne dizisi → koleksiyon, nesne → tekil, HTML string → richtext.
 * Şemaya girmeyen karmaşık alanlar (iç içe dizi/nesne) veride korunur.
 */
export function inferProject(data: unknown): InferredProject {
  if (!isPlainObject(data)) throw new Error('The imported JSON must be an object.')

  const collections: Collection[] = []
  const singletons: Singleton[] = []
  const entries: Record<string, Row[]> = {}
  const singletonData: Record<string, Row> = {}
  const generalFields: Field[] = []
  const generalData: Row = {}
  const usedNames = new Set<string>()

  const uniqueName = (base: string): string => {
    let name = base || 'field'
    let n = 2
    while (usedNames.has(name)) name = `${base}-${n++}`
    usedNames.add(name)
    return name
  }

  const isRowList = (v: unknown): v is Row[] =>
    Array.isArray(v) && v.length > 0 && v.every(isPlainObject)

  // Bir nesne dizisini koleksiyona çevirir; slug'ları benzersizleştirir.
  const addCollection = (key: string, list: Row[], label = key): void => {
    const name = uniqueName(slugify(key))
    const seen = new Set<string>()
    const rows = list.map((row, i) => {
      // slug kaynağı: bilinen adlar, yoksa ilk metin alanı
      const firstText = Object.values(row).find((v) => typeof v === 'string' && v.trim() !== '')
      const base =
        slugify(
          String(row.slug ?? row.title ?? row.name ?? row.label ?? firstText ?? `${name}-${i + 1}`),
        ) || `${name}-${i + 1}`
      let slug = base
      let n = 2
      while (seen.has(slug)) slug = `${base}-${n++}`
      seen.add(slug)
      return { slug, ...row }
    })
    const fields = fieldsFromRows(rows)
    const keys = new Set(fields.map((f) => f.key))
    collections.push({ name, label, path: name, fields })
    entries[name] = rows.map((row) =>
      Object.fromEntries(Object.entries(row).filter(([k]) => keys.has(k))),
    )
  }

  for (const [key, value] of Object.entries(data)) {
    if (isRowList(value)) {
      addCollection(key, value)
    } else if (isPlainObject(value)) {
      const name = uniqueName(slugify(key))
      // İç içe listeleri ayrı koleksiyonlara çıkar; tekilde sadece basit alanlar kalsın
      // (aksi halde şemaya girmeyen anahtarlar "şemada yok" uyarısı üretir).
      const flat: Row = {}
      for (const [k, v] of Object.entries(value)) {
        // İç içe listeyi sade adıyla al (home.experience → experience); çakışırsa öneklen.
        if (isRowList(v)) addCollection(usedNames.has(slugify(k)) ? `${key}-${k}` : k, v, k)
        else if (inferType(v) !== null) flat[k] = v
      }
      singletons.push({ name, label: key, path: `${name}.json`, fields: fieldsFromRows([flat]) })
      singletonData[name] = flat
    } else {
      const t = inferType(value)
      if (t) {
        generalFields.push({ key, label: key, type: t })
        generalData[key] = value
      }
    }
  }

  if (generalFields.length > 0) {
    const name = uniqueName('general')
    singletons.push({ name, label: 'General', path: `${name}.json`, fields: generalFields })
    singletonData[name] = generalData
  }

  return { schema: { version: 1, collections, singletons }, entries, singletons: singletonData }
}

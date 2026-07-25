import { serializeSchema } from '../schema/schema'
import type { Schema } from '../schema/types'
import { generateTypes } from '../types/generate'

export interface ExportInput {
  schema: Schema
  entries: Record<string, Record<string, unknown>[]>
  singletons: Record<string, Record<string, unknown>>
  media?: Record<string, Uint8Array>
}

function json(data: unknown): string {
  return `${JSON.stringify(data, null, 2)}\n`
}

export function buildExportManifest(input: ExportInput): Record<string, string | Uint8Array> {
  const out: Record<string, string | Uint8Array> = {}
  out['content/_schema.json'] = serializeSchema(input.schema)

  for (const col of input.schema.collections) {
    const rows = input.entries[col.name] ?? []
    rows.forEach((row, index) => {
      const slug = typeof row.slug === 'string' && row.slug ? row.slug : String(index)
      out[`content/${col.path}/${slug}.json`] = json(row)
    })
  }

  for (const s of input.schema.singletons) {
    const data = input.singletons[s.name]
    if (data) out[`content/${s.path}`] = json(data)
  }

  out['types.ts'] = generateTypes(input.schema)

  for (const [path, bytes] of Object.entries(input.media ?? {})) {
    out[path] = bytes
  }

  return out
}

export const VERSION = '0.0.0'

export type {
  Field,
  FieldType,
  Collection,
  Singleton,
  Schema,
} from './schema/types'
export { parseSchema, serializeSchema } from './schema/schema'
export { slugify } from './util/slug'

export type { StorageAdapter } from './storage/adapter'
export { MemoryAdapter } from './storage/memory'

export type { EntryRow } from './content/store'
export { ContentStore, loadSchema, saveSchema } from './content/store'
export { entryTitle } from './content/title'

export type { ValidationIssue, ValidationResult } from './validate/validate'
export { validateEntry } from './validate/validate'

export { generateTypes } from './types/generate'

export type { ExportInput } from './export/bundle'
export { buildExportManifest } from './export/bundle'

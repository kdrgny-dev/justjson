export type FieldType =
  | 'text'
  | 'richtext'
  | 'number'
  | 'boolean'
  | 'date'
  | 'select'
  | 'relation'
  | 'image'

export interface Field {
  key: string
  label?: string
  type: FieldType
  required?: boolean
  /** type === 'select' için seçenekler */
  options?: string[]
  /** type === 'relation' için hedef koleksiyon adı */
  to?: string
}

export interface Collection {
  name: string
  label?: string
  /** content dizinine göreli dizin, ör. "posts" */
  path: string
  fields: Field[]
}

export interface Singleton {
  name: string
  label?: string
  /** content dizinine göreli dosya, ör. "settings.json" */
  path: string
  fields: Field[]
}

export interface Schema {
  version: 1
  collections: Collection[]
  singletons: Singleton[]
}

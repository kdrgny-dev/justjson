import type { Field, Schema } from '../schema/types'

function pascalCase(name: string): string {
  return name
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

function fieldTsType(field: Field): string {
  switch (field.type) {
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'select':
      return (field.options ?? []).map((o) => `'${o}'`).join(' | ') || 'string'
    default:
      return 'string'
  }
}

function emitInterface(name: string, fields: Field[]): string {
  const lines = fields.map((f) => {
    const optional = f.required ? '' : '?'
    return `  ${f.key}${optional}: ${fieldTsType(f)}`
  })
  return `export interface ${name} {\n${lines.join('\n')}\n}`
}

export function generateTypes(schema: Schema): string {
  const blocks: string[] = ['// JustJSON tarafından üretildi — elle düzenlemeyin.']

  for (const col of schema.collections) {
    const name = pascalCase(col.name)
    blocks.push(emitInterface(name, col.fields))
    blocks.push(`export type ${name}Collection = ${name}[]`)
  }

  for (const s of schema.singletons) {
    blocks.push(emitInterface(pascalCase(s.name), s.fields))
  }

  return `${blocks.join('\n\n')}\n`
}

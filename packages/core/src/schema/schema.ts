import { z } from 'zod'
import { SchemaError } from '../errors'
import type { Field, Schema } from './types'

const fieldTypes = [
  'text',
  'richtext',
  'number',
  'boolean',
  'date',
  'select',
  'relation',
  'image',
  'url',
  'email',
  'list',
  'color',
  'group',
] as const

const zField: z.ZodType<Field> = z.lazy(() =>
  z
    .object({
      key: z.string().min(1),
      label: z.string().optional(),
      type: z.enum(fieldTypes),
      required: z.boolean().optional(),
      options: z.array(z.string()).optional(),
      to: z.string().optional(),
      fields: z.array(zField).optional(),
    })
    .superRefine((field, ctx) => {
      if (field.type === 'select' && (!field.options || field.options.length === 0)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'a select field requires options' })
      }
      if (field.type === 'relation' && !field.to) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'a relation field requires "to"' })
      }
      if (field.type === 'group' && (!field.fields || field.fields.length === 0)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'a group field requires fields' })
      }
    }),
)

const zCollection = z.object({
  name: z.string().min(1),
  label: z.string().optional(),
  path: z.string().min(1),
  fields: z.array(zField),
})

const zSingleton = z.object({
  name: z.string().min(1),
  label: z.string().optional(),
  path: z.string().min(1),
  fields: z.array(zField),
})

const zSchema = z
  .object({
    version: z.literal(1),
    collections: z.array(zCollection),
    singletons: z.array(zSingleton),
  })
  .superRefine((schema, ctx) => {
    const names = new Set<string>()
    const paths = new Set<string>()
    const collectionNames = new Set(schema.collections.map((c) => c.name))
    const containers = [...schema.collections, ...schema.singletons]

    for (const c of containers) {
      if (names.has(c.name)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate name: ${c.name}` })
      }
      names.add(c.name)
      if (c.path.includes('..') || c.path.startsWith('/') || c.path.includes('\\')) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `unsafe path: ${c.path}` })
      }
      if (paths.has(c.path)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate path: ${c.path}` })
      }
      paths.add(c.path)

      const keys = new Set<string>()
      for (const f of c.fields) {
        if (keys.has(f.key)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate field key: ${f.key}` })
        }
        keys.add(f.key)
        if (f.type === 'relation' && f.to && !collectionNames.has(f.to)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `relation target does not exist: ${f.to}`,
          })
        }
      }
    }
  })

export function parseSchema(input: unknown): Schema {
  const result = zSchema.safeParse(input)
  if (result.success) return result.data as Schema
  // Zod'un ham JSON'u kullanıcıya gösterilemez; konumlu satırlara çeviriyoruz.
  const lines = result.error.issues.map((i) =>
    i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message,
  )
  throw new SchemaError(lines.join('\n'))
}

export function serializeSchema(schema: Schema): string {
  return `${JSON.stringify(schema, null, 2)}\n`
}

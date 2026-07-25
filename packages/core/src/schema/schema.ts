import { z } from 'zod'
import type { Schema } from './types'

const fieldTypes = [
  'text',
  'richtext',
  'number',
  'boolean',
  'date',
  'select',
  'relation',
  'image',
] as const

const zField = z
  .object({
    key: z.string().min(1),
    label: z.string().optional(),
    type: z.enum(fieldTypes),
    required: z.boolean().optional(),
    options: z.array(z.string()).optional(),
    to: z.string().optional(),
  })
  .superRefine((field, ctx) => {
    if (field.type === 'select' && (!field.options || field.options.length === 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'select alanı options gerektirir' })
    }
    if (field.type === 'relation' && !field.to) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'relation alanı "to" gerektirir' })
    }
  })

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

const zSchema = z.object({
  version: z.literal(1),
  collections: z.array(zCollection),
  singletons: z.array(zSingleton),
})

export function parseSchema(input: unknown): Schema {
  return zSchema.parse(input) as Schema
}

export function serializeSchema(schema: Schema): string {
  return `${JSON.stringify(schema, null, 2)}\n`
}

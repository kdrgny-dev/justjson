import { type Field, STATUS_KEY } from '@justjson/core'
import { z } from 'zod'

function base(field: Field): z.ZodTypeAny {
  switch (field.type) {
    case 'number':
      return z.number()
    case 'boolean':
      return z.boolean()
    case 'relation':
    case 'list':
      return z.array(z.string())
    case 'group':
      return fieldsToZod(field.fields ?? [])
    case 'select': {
      const options = field.options ?? []
      // Seçenekler literal union verir; boş bırakılmışsa serbest metne düşer.
      return options.length > 0 ? z.enum(options as [string, ...string[]]) : z.string()
    }
    default:
      // text, richtext, date, image, url, email, color — hepsi düz metin.
      // Biçim doğrulaması bilerek yapılmaz: onu `justjson validate` üstlenir,
      // burada sıkı olmak kullanıcının build'ini beklenmedik yerde kırar.
      return z.string()
  }
}

/** JustJSON alanlarını Astro'nun kullanacağı bir zod nesnesine çevirir. */
export function fieldsToZod(fields: Field[]): z.ZodObject<z.ZodRawShape> {
  const shape: z.ZodRawShape = {
    [STATUS_KEY]: z.enum(['draft', 'published']).optional(),
  }
  for (const field of fields) {
    const type = base(field)
    shape[field.key] = field.required ? type : type.optional()
  }
  return z.object(shape)
}

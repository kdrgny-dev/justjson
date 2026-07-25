# JustJSON Core Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `@justjson/core` paketini — şema tipleri, ayrıştırma, depolama soyutlaması, içerik okuma/yazma, doğrulama, tip üretimi ve export — saf ve tümüyle test edilmiş bir kütüphane olarak inşa etmek.

**Architecture:** Core, I/O'dan bağımsız saf mantıktır. Dosya erişimi `StorageAdapter` arayüzü arkasına saklanır; `MemoryAdapter` hem testler hem tarayıcı demosu için core içinde yaşar (saf, Node bağımlılığı yok). Disk erişimi (`FsAdapter`) sonraki planda CLI paketinde gelir. Bu plan tamamlandığında elde: `pnpm --filter @justjson/core test` yeşil, `pnpm --filter @justjson/core build` çıktı üretir.

**Tech Stack:** TypeScript (ESM), zod, tsup (build), vitest (test).

## Global Constraints

- Node `>=20`; paket yöneticisi `pnpm@10.13.1`.
- ESM (`"type": "module"`); `verbatimModuleSyntax` açık → tip importları `import type` ile.
- Core saf kalır: `node:*` veya başka I/O API'si **import edilmez**. `MemoryAdapter` yalnızca bellek kullanır.
- Richtext içerik **markdown string** olarak saklanır (ayrı biçim yok).
- Şema alanı silme politikası **lazy**: içerik anahtarları core tarafından asla otomatik silinmez.
- Doğrulama **gevşek**: eksik `required` ve bilinmeyen anahtar → `warning`; yalnızca tip uyuşmazlığı → `error`. `ValidationResult.ok` sadece `error` yokluğunu yansıtır.
- Alan tipleri (v1): `text`, `richtext`, `number`, `boolean`, `date`, `select`, `relation`, `image`.
- Biome ile format/lint: tek tırnak, gereksiz noktalı virgül yok, girinti 2 boşluk, satır 100.

---

### Task 1: Şema tipleri ve ayrıştırma

**Files:**
- Create: `packages/core/src/schema/types.ts`
- Create: `packages/core/src/schema/schema.ts`
- Create: `packages/core/vitest.config.ts`
- Test: `packages/core/src/schema/schema.test.ts`
- Modify: `packages/core/package.json` (zaten iskelette mevcut; bağımlılık kurulumu)

**Interfaces:**
- Consumes: —
- Produces:
  - Tipler: `FieldType`, `Field`, `Collection`, `Singleton`, `Schema`.
  - `parseSchema(input: unknown): Schema` — geçersizse `throw ZodError`.
  - `serializeSchema(schema: Schema): string` — 2 boşluk girintili JSON + son satır.

- [ ] **Step 1: Bağımlılıkları kur**

Run:
```bash
cd /Users/kdrgny/Desktop/Devs/justjson && pnpm install
```
Expected: kurulum başarılı, kök `pnpm-lock.yaml` oluşur.

- [ ] **Step 2: Vitest yapılandırması**

Create `packages/core/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 3: Tipleri yaz**

Create `packages/core/src/schema/types.ts`:
```ts
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
```

- [ ] **Step 4: Başarısız testi yaz**

Create `packages/core/src/schema/schema.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { parseSchema, serializeSchema } from './schema'

const valid = {
  version: 1,
  collections: [
    {
      name: 'posts',
      label: 'Yazılar',
      path: 'posts',
      fields: [
        { key: 'title', type: 'text', required: true },
        { key: 'body', type: 'richtext' },
        { key: 'status', type: 'select', options: ['draft', 'published'] },
        { key: 'tags', type: 'relation', to: 'tags' },
      ],
    },
  ],
  singletons: [{ name: 'settings', path: 'settings.json', fields: [] }],
}

describe('parseSchema', () => {
  it('geçerli şemayı ayrıştırır', () => {
    const schema = parseSchema(valid)
    expect(schema.collections[0]?.name).toBe('posts')
    expect(schema.collections[0]?.fields).toHaveLength(4)
  })

  it('select alanı options olmadan reddedilir', () => {
    const bad = structuredClone(valid)
    bad.collections[0].fields[2] = { key: 'status', type: 'select' } as never
    expect(() => parseSchema(bad)).toThrow()
  })

  it('relation alanı "to" olmadan reddedilir', () => {
    const bad = structuredClone(valid)
    bad.collections[0].fields[3] = { key: 'tags', type: 'relation' } as never
    expect(() => parseSchema(bad)).toThrow()
  })

  it('bilinmeyen alan tipi reddedilir', () => {
    const bad = structuredClone(valid)
    bad.collections[0].fields[0] = { key: 'x', type: 'wysiwyg' } as never
    expect(() => parseSchema(bad)).toThrow()
  })
})

describe('serializeSchema', () => {
  it('round-trip: serialize sonrası parse aynı şemayı verir', () => {
    const schema = parseSchema(valid)
    const text = serializeSchema(schema)
    expect(text.endsWith('\n')).toBe(true)
    expect(parseSchema(JSON.parse(text))).toEqual(schema)
  })
})
```

- [ ] **Step 5: Testin başarısız olduğunu doğrula**

Run:
```bash
cd /Users/kdrgny/Desktop/Devs/justjson && pnpm --filter @justjson/core test
```
Expected: FAIL — `Cannot find module './schema'`.

- [ ] **Step 6: Ayrıştırmayı yaz**

Create `packages/core/src/schema/schema.ts`:
```ts
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
```

- [ ] **Step 7: Testin geçtiğini doğrula**

Run:
```bash
cd /Users/kdrgny/Desktop/Devs/justjson && pnpm --filter @justjson/core test
```
Expected: PASS — tüm testler yeşil.

- [ ] **Step 8: Commit**

```bash
cd /Users/kdrgny/Desktop/Devs/justjson && git add -A && git commit -m "feat(core): schema types and parsing"
```

---

### Task 2: StorageAdapter arayüzü ve MemoryAdapter

**Files:**
- Create: `packages/core/src/storage/adapter.ts`
- Create: `packages/core/src/storage/memory.ts`
- Test: `packages/core/src/storage/memory.test.ts`

**Interfaces:**
- Consumes: —
- Produces:
  - `interface StorageAdapter { read(path): Promise<string|null>; write(path, content): Promise<void>; delete(path): Promise<void>; list(dir): Promise<string[]>; exists(path): Promise<boolean> }`
  - `class MemoryAdapter implements StorageAdapter` — kurucu `new MemoryAdapter(initial?: Record<string,string>)`; ek `snapshot(): Record<string,string>`.
  - `list(dir)` **doğrudan alt dosyaların basename'lerini** döndürür (özyineleme yok), dizin yoksa `[]`.

- [ ] **Step 1: Arayüzü yaz**

Create `packages/core/src/storage/adapter.ts`:
```ts
export interface StorageAdapter {
  /** Dosya içeriğini döndürür; yoksa null. */
  read(path: string): Promise<string | null>
  /** Dosyayı yazar; ara dizinler örtük varsayılır. */
  write(path: string, content: string): Promise<void>
  /** Dosyayı siler; yoksa sessiz geçer. */
  delete(path: string): Promise<void>
  /** dir altındaki doğrudan dosyaların basename listesi; dizin yoksa []. */
  list(dir: string): Promise<string[]>
  exists(path: string): Promise<boolean>
}
```

- [ ] **Step 2: Başarısız testi yaz**

Create `packages/core/src/storage/memory.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { MemoryAdapter } from './memory'

describe('MemoryAdapter', () => {
  it('yazar ve okur', async () => {
    const a = new MemoryAdapter()
    await a.write('content/posts/a.json', '{"x":1}')
    expect(await a.read('content/posts/a.json')).toBe('{"x":1}')
  })

  it('olmayan dosya için null döner', async () => {
    const a = new MemoryAdapter()
    expect(await a.read('yok.json')).toBeNull()
  })

  it('exists doğru çalışır', async () => {
    const a = new MemoryAdapter({ 'a.json': '1' })
    expect(await a.exists('a.json')).toBe(true)
    expect(await a.exists('b.json')).toBe(false)
  })

  it('list yalnızca doğrudan alt dosyaların basename listesini verir', async () => {
    const a = new MemoryAdapter({
      'content/posts/a.json': '1',
      'content/posts/b.json': '2',
      'content/posts/nested/c.json': '3',
      'content/other/d.json': '4',
    })
    expect((await a.list('content/posts')).sort()).toEqual(['a.json', 'b.json'])
  })

  it('list olmayan dizin için boş dizi verir', async () => {
    const a = new MemoryAdapter()
    expect(await a.list('content/x')).toEqual([])
  })

  it('delete dosyayı kaldırır', async () => {
    const a = new MemoryAdapter({ 'a.json': '1' })
    await a.delete('a.json')
    expect(await a.exists('a.json')).toBe(false)
  })

  it('snapshot yazılan tüm dosyaları verir', async () => {
    const a = new MemoryAdapter()
    await a.write('a.json', '1')
    expect(a.snapshot()).toEqual({ 'a.json': '1' })
  })
})
```

- [ ] **Step 3: Testin başarısız olduğunu doğrula**

Run:
```bash
cd /Users/kdrgny/Desktop/Devs/justjson && pnpm --filter @justjson/core test
```
Expected: FAIL — `Cannot find module './memory'`.

- [ ] **Step 4: MemoryAdapter'ı yaz**

Create `packages/core/src/storage/memory.ts`:
```ts
import type { StorageAdapter } from './adapter'

export class MemoryAdapter implements StorageAdapter {
  private files: Map<string, string>

  constructor(initial: Record<string, string> = {}) {
    this.files = new Map(Object.entries(initial))
  }

  async read(path: string): Promise<string | null> {
    return this.files.get(path) ?? null
  }

  async write(path: string, content: string): Promise<void> {
    this.files.set(path, content)
  }

  async delete(path: string): Promise<void> {
    this.files.delete(path)
  }

  async list(dir: string): Promise<string[]> {
    const prefix = `${dir}/`
    const out: string[] = []
    for (const key of this.files.keys()) {
      if (!key.startsWith(prefix)) continue
      const rest = key.slice(prefix.length)
      if (!rest.includes('/')) out.push(rest)
    }
    return out
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path)
  }

  snapshot(): Record<string, string> {
    return Object.fromEntries(this.files)
  }
}
```

- [ ] **Step 5: Testin geçtiğini doğrula**

Run:
```bash
cd /Users/kdrgny/Desktop/Devs/justjson && pnpm --filter @justjson/core test
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/kdrgny/Desktop/Devs/justjson && git add -A && git commit -m "feat(core): StorageAdapter interface and MemoryAdapter"
```

---

### Task 3: ContentStore — şema ve içerik okuma/yazma

**Files:**
- Create: `packages/core/src/content/store.ts`
- Test: `packages/core/src/content/store.test.ts`

**Interfaces:**
- Consumes: `StorageAdapter` (Task 2), `Schema`/`Collection`/`Singleton` (Task 1), `parseSchema`/`serializeSchema` (Task 1).
- Produces:
  - `loadSchema(adapter, contentDir='content'): Promise<Schema | null>` — `content/_schema.json` yoksa null.
  - `saveSchema(adapter, schema, contentDir='content'): Promise<void>`.
  - `class ContentStore` — kurucu `new ContentStore(adapter, schema, contentDir='content')`; metotlar:
    - `listEntries(collection: string): Promise<string[]>` (slug listesi)
    - `readEntry(collection, slug): Promise<Record<string, unknown> | null>`
    - `writeEntry(collection, slug, data): Promise<void>`
    - `deleteEntry(collection, slug): Promise<void>`
    - `readSingleton(name): Promise<Record<string, unknown> | null>`
    - `writeSingleton(name, data): Promise<void>`
  - Bilinmeyen koleksiyon/singleton adında metotlar `throw Error`.

- [ ] **Step 1: Başarısız testi yaz**

Create `packages/core/src/content/store.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { parseSchema } from '../schema/schema'
import { MemoryAdapter } from '../storage/memory'
import { ContentStore, loadSchema, saveSchema } from './store'

const schema = parseSchema({
  version: 1,
  collections: [{ name: 'posts', path: 'posts', fields: [{ key: 'title', type: 'text' }] }],
  singletons: [{ name: 'settings', path: 'settings.json', fields: [] }],
})

describe('loadSchema / saveSchema', () => {
  it('şema yoksa null', async () => {
    expect(await loadSchema(new MemoryAdapter())).toBeNull()
  })

  it('kaydedilen şema geri yüklenir', async () => {
    const a = new MemoryAdapter()
    await saveSchema(a, schema)
    expect(await a.exists('content/_schema.json')).toBe(true)
    expect(await loadSchema(a)).toEqual(schema)
  })
})

describe('ContentStore koleksiyon', () => {
  it('yazar, listeler, okur', async () => {
    const a = new MemoryAdapter()
    const store = new ContentStore(a, schema)
    await store.writeEntry('posts', 'merhaba', { title: 'Merhaba' })
    expect(await store.listEntries('posts')).toEqual(['merhaba'])
    expect(await store.readEntry('posts', 'merhaba')).toEqual({ title: 'Merhaba' })
    expect(await a.exists('content/posts/merhaba.json')).toBe(true)
  })

  it('siler', async () => {
    const a = new MemoryAdapter()
    const store = new ContentStore(a, schema)
    await store.writeEntry('posts', 'x', { title: 'X' })
    await store.deleteEntry('posts', 'x')
    expect(await store.listEntries('posts')).toEqual([])
  })

  it('olmayan kayıt null', async () => {
    const store = new ContentStore(new MemoryAdapter(), schema)
    expect(await store.readEntry('posts', 'yok')).toBeNull()
  })

  it('bilinmeyen koleksiyon hata verir', async () => {
    const store = new ContentStore(new MemoryAdapter(), schema)
    await expect(store.listEntries('bilinmeyen')).rejects.toThrow()
  })
})

describe('ContentStore singleton', () => {
  it('yazar ve okur', async () => {
    const a = new MemoryAdapter()
    const store = new ContentStore(a, schema)
    await store.writeSingleton('settings', { title: 'Site' })
    expect(await store.readSingleton('settings')).toEqual({ title: 'Site' })
    expect(await a.exists('content/settings.json')).toBe(true)
  })
})
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run:
```bash
cd /Users/kdrgny/Desktop/Devs/justjson && pnpm --filter @justjson/core test
```
Expected: FAIL — `Cannot find module './store'`.

- [ ] **Step 3: ContentStore'u yaz**

Create `packages/core/src/content/store.ts`:
```ts
import { parseSchema, serializeSchema } from '../schema/schema'
import type { Collection, Schema, Singleton } from '../schema/types'
import type { StorageAdapter } from '../storage/adapter'

const SCHEMA_FILE = '_schema.json'

function schemaPath(contentDir: string): string {
  return `${contentDir}/${SCHEMA_FILE}`
}

export async function loadSchema(
  adapter: StorageAdapter,
  contentDir = 'content',
): Promise<Schema | null> {
  const raw = await adapter.read(schemaPath(contentDir))
  if (raw === null) return null
  return parseSchema(JSON.parse(raw))
}

export async function saveSchema(
  adapter: StorageAdapter,
  schema: Schema,
  contentDir = 'content',
): Promise<void> {
  await adapter.write(schemaPath(contentDir), serializeSchema(schema))
}

export class ContentStore {
  constructor(
    private readonly adapter: StorageAdapter,
    private readonly schema: Schema,
    private readonly contentDir = 'content',
  ) {}

  private collection(name: string): Collection {
    const col = this.schema.collections.find((c) => c.name === name)
    if (!col) throw new Error(`Bilinmeyen koleksiyon: ${name}`)
    return col
  }

  private singleton(name: string): Singleton {
    const s = this.schema.singletons.find((x) => x.name === name)
    if (!s) throw new Error(`Bilinmeyen singleton: ${name}`)
    return s
  }

  private entryPath(col: Collection, slug: string): string {
    return `${this.contentDir}/${col.path}/${slug}.json`
  }

  async listEntries(collection: string): Promise<string[]> {
    const col = this.collection(collection)
    const files = await this.adapter.list(`${this.contentDir}/${col.path}`)
    return files.filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -'.json'.length))
  }

  async readEntry(collection: string, slug: string): Promise<Record<string, unknown> | null> {
    const col = this.collection(collection)
    const raw = await this.adapter.read(this.entryPath(col, slug))
    return raw === null ? null : (JSON.parse(raw) as Record<string, unknown>)
  }

  async writeEntry(
    collection: string,
    slug: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const col = this.collection(collection)
    await this.adapter.write(this.entryPath(col, slug), `${JSON.stringify(data, null, 2)}\n`)
  }

  async deleteEntry(collection: string, slug: string): Promise<void> {
    const col = this.collection(collection)
    await this.adapter.delete(this.entryPath(col, slug))
  }

  async readSingleton(name: string): Promise<Record<string, unknown> | null> {
    const s = this.singleton(name)
    const raw = await this.adapter.read(`${this.contentDir}/${s.path}`)
    return raw === null ? null : (JSON.parse(raw) as Record<string, unknown>)
  }

  async writeSingleton(name: string, data: Record<string, unknown>): Promise<void> {
    const s = this.singleton(name)
    await this.adapter.write(`${this.contentDir}/${s.path}`, `${JSON.stringify(data, null, 2)}\n`)
  }
}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Run:
```bash
cd /Users/kdrgny/Desktop/Devs/justjson && pnpm --filter @justjson/core test
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/kdrgny/Desktop/Devs/justjson && git add -A && git commit -m "feat(core): ContentStore with schema load/save"
```

---

### Task 4: İçerik doğrulama (gevşek politika)

**Files:**
- Create: `packages/core/src/validate/validate.ts`
- Test: `packages/core/src/validate/validate.test.ts`

**Interfaces:**
- Consumes: `Field` (Task 1).
- Produces:
  - `interface ValidationIssue { key: string; level: 'error' | 'warning'; message: string }`
  - `interface ValidationResult { ok: boolean; issues: ValidationIssue[] }`
  - `validateEntry(fields: Field[], data: Record<string, unknown>): ValidationResult`
  - Politika: eksik `required` → `warning`; `fields`'ta olmayan veri anahtarı → `warning`; tanımlı alanın değeri yanlış tipte → `error`. `ok = issues.every(i => i.level !== 'error')`.

- [ ] **Step 1: Başarısız testi yaz**

Create `packages/core/src/validate/validate.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { Field } from '../schema/types'
import { validateEntry } from './validate'

const fields: Field[] = [
  { key: 'title', type: 'text', required: true },
  { key: 'age', type: 'number' },
  { key: 'live', type: 'boolean' },
  { key: 'status', type: 'select', options: ['a', 'b'] },
]

describe('validateEntry', () => {
  it('geçerli veri: ok, sorun yok', () => {
    const r = validateEntry(fields, { title: 'X', age: 3, live: true, status: 'a' })
    expect(r.ok).toBe(true)
    expect(r.issues).toEqual([])
  })

  it('eksik required → warning, ok kalır', () => {
    const r = validateEntry(fields, { age: 1 })
    expect(r.ok).toBe(true)
    expect(r.issues).toContainEqual({
      key: 'title',
      level: 'warning',
      message: expect.stringContaining('zorunlu'),
    })
  })

  it('yanlış tip → error, ok false', () => {
    const r = validateEntry(fields, { title: 'X', age: 'üç' })
    expect(r.ok).toBe(false)
    expect(r.issues.some((i) => i.key === 'age' && i.level === 'error')).toBe(true)
  })

  it('bilinmeyen anahtar → warning, ok kalır', () => {
    const r = validateEntry(fields, { title: 'X', ekstra: 1 })
    expect(r.ok).toBe(true)
    expect(r.issues).toContainEqual({
      key: 'ekstra',
      level: 'warning',
      message: expect.stringContaining('şemada yok'),
    })
  })

  it('select değeri seçenek dışı → error', () => {
    const r = validateEntry(fields, { title: 'X', status: 'z' })
    expect(r.ok).toBe(false)
    expect(r.issues.some((i) => i.key === 'status' && i.level === 'error')).toBe(true)
  })
})
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run:
```bash
cd /Users/kdrgny/Desktop/Devs/justjson && pnpm --filter @justjson/core test
```
Expected: FAIL — `Cannot find module './validate'`.

- [ ] **Step 3: Doğrulamayı yaz**

Create `packages/core/src/validate/validate.ts`:
```ts
import type { Field } from '../schema/types'

export interface ValidationIssue {
  key: string
  level: 'error' | 'warning'
  message: string
}

export interface ValidationResult {
  ok: boolean
  issues: ValidationIssue[]
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === ''
}

function typeError(field: Field, value: unknown): string | null {
  switch (field.type) {
    case 'text':
    case 'richtext':
    case 'date':
    case 'relation':
    case 'image':
      return typeof value === 'string' ? null : 'metin bekleniyor'
    case 'number':
      return typeof value === 'number' ? null : 'sayı bekleniyor'
    case 'boolean':
      return typeof value === 'boolean' ? null : 'boolean bekleniyor'
    case 'select':
      if (typeof value !== 'string') return 'metin bekleniyor'
      return field.options?.includes(value) ? null : 'seçenek dışı değer'
  }
}

export function validateEntry(
  fields: Field[],
  data: Record<string, unknown>,
): ValidationResult {
  const issues: ValidationIssue[] = []
  const known = new Set(fields.map((f) => f.key))

  for (const field of fields) {
    const value = data[field.key]
    if (isEmpty(value)) {
      if (field.required) {
        issues.push({ key: field.key, level: 'warning', message: 'zorunlu alan boş' })
      }
      continue
    }
    const err = typeError(field, value)
    if (err) issues.push({ key: field.key, level: 'error', message: err })
  }

  for (const key of Object.keys(data)) {
    if (!known.has(key)) {
      issues.push({ key, level: 'warning', message: 'anahtar şemada yok' })
    }
  }

  return { ok: issues.every((i) => i.level !== 'error'), issues }
}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Run:
```bash
cd /Users/kdrgny/Desktop/Devs/justjson && pnpm --filter @justjson/core test
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/kdrgny/Desktop/Devs/justjson && git add -A && git commit -m "feat(core): loose entry validation"
```

---

### Task 5: Şemadan TypeScript tip üretimi

**Files:**
- Create: `packages/core/src/types/generate.ts`
- Test: `packages/core/src/types/generate.test.ts`

**Interfaces:**
- Consumes: `Schema`, `Collection`, `Singleton`, `Field` (Task 1).
- Produces:
  - `generateTypes(schema: Schema): string` — her koleksiyon ve singleton için PascalCase adlı `export interface` üretir; koleksiyonlar için ayrıca `export type <Name>Collection = <Name>[]`.
  - Tip eşlemesi: `text|richtext|date|image|relation → string`, `number → number`, `boolean → boolean`, `select → seçeneklerin birleşim tipi ('a' | 'b')`. `required` değilse alan opsiyonel (`?`).

- [ ] **Step 1: Başarısız testi yaz**

Create `packages/core/src/types/generate.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { parseSchema } from '../schema/schema'
import { generateTypes } from './generate'

const schema = parseSchema({
  version: 1,
  collections: [
    {
      name: 'blog_posts',
      path: 'posts',
      fields: [
        { key: 'title', type: 'text', required: true },
        { key: 'body', type: 'richtext' },
        { key: 'status', type: 'select', options: ['draft', 'published'], required: true },
        { key: 'views', type: 'number' },
      ],
    },
  ],
  singletons: [{ name: 'settings', path: 'settings.json', fields: [{ key: 'site', type: 'text' }] }],
})

describe('generateTypes', () => {
  const out = generateTypes(schema)

  it('koleksiyon için PascalCase interface üretir', () => {
    expect(out).toContain('export interface BlogPosts {')
  })

  it('required alan zorunlu, diğerleri opsiyonel', () => {
    expect(out).toContain('title: string')
    expect(out).toContain('body?: string')
    expect(out).toContain('views?: number')
  })

  it('select alanı birleşim tipine dönüşür', () => {
    expect(out).toContain("status: 'draft' | 'published'")
  })

  it('koleksiyon dizi tipi üretir', () => {
    expect(out).toContain('export type BlogPostsCollection = BlogPosts[]')
  })

  it('singleton için interface üretir', () => {
    expect(out).toContain('export interface Settings {')
    expect(out).toContain('site?: string')
  })
})
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run:
```bash
cd /Users/kdrgny/Desktop/Devs/justjson && pnpm --filter @justjson/core test
```
Expected: FAIL — `Cannot find module './generate'`.

- [ ] **Step 3: Tip üreticisini yaz**

Create `packages/core/src/types/generate.ts`:
```ts
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
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Run:
```bash
cd /Users/kdrgny/Desktop/Devs/justjson && pnpm --filter @justjson/core test
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/kdrgny/Desktop/Devs/justjson && git add -A && git commit -m "feat(core): TypeScript type generation from schema"
```

---

### Task 6: Export manifesti

**Files:**
- Create: `packages/core/src/export/bundle.ts`
- Test: `packages/core/src/export/bundle.test.ts`

**Interfaces:**
- Consumes: `Schema` (Task 1), `serializeSchema` (Task 1), `generateTypes` (Task 5).
- Produces:
  - `interface ExportInput { schema: Schema; entries: Record<string, Record<string, unknown>[]>; singletons: Record<string, Record<string, unknown>>; media?: Record<string, Uint8Array> }`
  - `buildExportManifest(input: ExportInput): Record<string, string | Uint8Array>`
  - Çıktı dosya haritası: `content/_schema.json`, her koleksiyon için `content/<path>/<index>.json` yerine **entry içindeki `slug` alanı varsa onu, yoksa sıra numarasını** dosya adı yapar; `content/<singleton.path>`; `types.ts`; ve verilen `media/*` dosyaları aynen. (Not: ZIP'e yazma CLI planında yapılır; bu fonksiyon yalnızca haritayı üretir.)

- [ ] **Step 1: Başarısız testi yaz**

Create `packages/core/src/export/bundle.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { parseSchema } from '../schema/schema'
import { buildExportManifest } from './bundle'

const schema = parseSchema({
  version: 1,
  collections: [{ name: 'posts', path: 'posts', fields: [{ key: 'title', type: 'text' }] }],
  singletons: [{ name: 'settings', path: 'settings.json', fields: [{ key: 'site', type: 'text' }] }],
})

describe('buildExportManifest', () => {
  const manifest = buildExportManifest({
    schema,
    entries: {
      posts: [
        { slug: 'merhaba', title: 'Merhaba' },
        { title: 'Slugsuz' },
      ],
    },
    singletons: { settings: { site: 'X' } },
    media: { 'content/media/a.webp': new Uint8Array([1, 2, 3]) },
  })

  it('şema dosyasını içerir', () => {
    expect(manifest['content/_schema.json']).toContain('"posts"')
  })

  it('slug alanı olan entry slug adıyla yazılır', () => {
    expect(manifest['content/posts/merhaba.json']).toContain('Merhaba')
  })

  it('slug olmayan entry sıra numarasıyla yazılır', () => {
    expect(manifest['content/posts/1.json']).toContain('Slugsuz')
  })

  it('singleton dosyasını içerir', () => {
    expect(manifest['content/settings.json']).toContain('"site"')
  })

  it('types.ts üretir', () => {
    expect(manifest['types.ts']).toContain('export interface Posts')
  })

  it('medya dosyalarını aynen taşır', () => {
    expect(manifest['content/media/a.webp']).toBeInstanceOf(Uint8Array)
  })
})
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run:
```bash
cd /Users/kdrgny/Desktop/Devs/justjson && pnpm --filter @justjson/core test
```
Expected: FAIL — `Cannot find module './bundle'`.

- [ ] **Step 3: Export'u yaz**

Create `packages/core/src/export/bundle.ts`:
```ts
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

export function buildExportManifest(
  input: ExportInput,
): Record<string, string | Uint8Array> {
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
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Run:
```bash
cd /Users/kdrgny/Desktop/Devs/justjson && pnpm --filter @justjson/core test
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/kdrgny/Desktop/Devs/justjson && git add -A && git commit -m "feat(core): export manifest builder"
```

---

### Task 7: Genel API ve build doğrulaması

**Files:**
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/index.test.ts`

**Interfaces:**
- Consumes: Önceki tüm modüller.
- Produces: Paketin genel yüzeyi tek `index.ts`'ten dışa aktarılır.

- [ ] **Step 1: Başarısız testi yaz**

Create `packages/core/src/index.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import * as api from './index'

describe('genel API', () => {
  it('beklenen sembolleri dışa aktarır', () => {
    expect(typeof api.parseSchema).toBe('function')
    expect(typeof api.serializeSchema).toBe('function')
    expect(typeof api.MemoryAdapter).toBe('function')
    expect(typeof api.ContentStore).toBe('function')
    expect(typeof api.loadSchema).toBe('function')
    expect(typeof api.saveSchema).toBe('function')
    expect(typeof api.validateEntry).toBe('function')
    expect(typeof api.generateTypes).toBe('function')
    expect(typeof api.buildExportManifest).toBe('function')
  })
})
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run:
```bash
cd /Users/kdrgny/Desktop/Devs/justjson && pnpm --filter @justjson/core test
```
Expected: FAIL — `api.parseSchema is not a function` (index henüz yalnızca VERSION verir).

- [ ] **Step 3: index.ts'i yaz**

Replace `packages/core/src/index.ts` with:
```ts
export const VERSION = '0.0.0'

export type {
  Field,
  FieldType,
  Collection,
  Singleton,
  Schema,
} from './schema/types'
export { parseSchema, serializeSchema } from './schema/schema'

export type { StorageAdapter } from './storage/adapter'
export { MemoryAdapter } from './storage/memory'

export { ContentStore, loadSchema, saveSchema } from './content/store'

export type { ValidationIssue, ValidationResult } from './validate/validate'
export { validateEntry } from './validate/validate'

export { generateTypes } from './types/generate'

export type { ExportInput } from './export/bundle'
export { buildExportManifest } from './export/bundle'
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Run:
```bash
cd /Users/kdrgny/Desktop/Devs/justjson && pnpm --filter @justjson/core test
```
Expected: PASS.

- [ ] **Step 5: Build ve typecheck doğrulaması**

Run:
```bash
cd /Users/kdrgny/Desktop/Devs/justjson && pnpm --filter @justjson/core build && pnpm --filter @justjson/core typecheck
```
Expected: `dist/index.js` ve `dist/index.d.ts` üretilir; typecheck hatasız.

- [ ] **Step 6: Lint**

Run:
```bash
cd /Users/kdrgny/Desktop/Devs/justjson && pnpm lint
```
Expected: Biome temiz (gerekirse `pnpm format` çalıştırıp yeniden commit).

- [ ] **Step 7: Commit**

```bash
cd /Users/kdrgny/Desktop/Devs/justjson && git add -A && git commit -m "feat(core): public API surface and build"
```

---

## Sonraki Planlar (bu planın kapsamı dışında)

Bu plan yalnızca `@justjson/core`'u üretir. v1'in kalanı ayrı planlarda:

- **Plan 2 — CLI + lokal sunucu:** `FsAdapter` (disk), Hono lokal API, `justjson` komutları (`serve`/`init`/`types`/`export`), template'ler (CV, blog, portfolyo…), atomik dosya yazımı, ZIP export (fflate).
- **Plan 3 — Editör SPA:** Vite + React arayüz, şemadan form üretimi, alan tipleri (text/richtext/number/boolean/date/select/relation/image), medya yükleme (canvas resize + WebP), şema sihirbazı, "kullanılmayan alanları temizle".
- **Plan 4 — Demo playground:** `MemoryAdapter` ile tarayıcıda sunucusuz mod; GitHub Pages'te canlı demo.

## Self-Review Notu

Spec kapsamı bu planda karşılanan bölümler: şema modeli (§5), şema evrimi doğrulama politikası (§6, gevşek doğrulama), export/types (§8), StorageAdapter + MemoryAdapter (§3), demo için gereken saf çekirdek (§10). Medya, CLI, UI ve endpoint dokümantasyonu sonraki planlara bırakıldı — her biri kendi başına çalışan-test edilebilir yazılım üretir.

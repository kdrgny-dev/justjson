# JustJSON CLI & Local Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `npx justjson` çalışan bir lokal araca dönüştürmek: diske okuyup yazan `FsAdapter`, şema bütünlük doğrulaması ve slug güvenliği (core), ve CLI komutları (`init`, `types`, `export`, `serve` — lokal HTTP API).

**Architecture:** Saf mantık `@justjson/core`'da kalır (bu planda: şema integrity superRefine + `slugify`). Disk erişimi ve HTTP, node bağımlılığı gerektirdiğinden `justjson` paketindedir: `FsAdapter` (atomik yazım), komut modülleri, ve Hono tabanlı lokal sunucu. Sunucu içerik API'sini `ContentStore` + `FsAdapter` üzerinden sunar; editör UI'ının bu API'ye bağlanması Plan 3'e aittir.

**Tech Stack:** TypeScript (ESM), Hono + @hono/node-server, commander, fflate (zip), vitest. Core: zod.

## Global Constraints

- Node `>=20`; pnpm workspace; ESM (`"type": "module"`); `verbatimModuleSyntax` → `import type`.
- `@justjson/core` saf kalır: `node:*` import etmez. `FsAdapter`, sunucu, komutlar yalnızca `justjson` paketinde.
- Biome: tek tırnak, gereksiz noktalı virgül yok, 2 boşluk, satır 100. Her görevden önce commit öncesi `pnpm exec biome check --write <paket>/src`.
- Dosya yazımı **atomik**: geçici dosyaya yaz + `rename` (kısmi yazım yok).
- Slug'lar güvenli olmalı: `/`, `..`, boşluk içermez; yalnızca `[a-z0-9-]`.
- Şema bütünlüğü `parseSchema`'da zorunlu: benzersiz collection/singleton adı, benzersiz path, koleksiyon içi benzersiz field key, `relation.to` var olan koleksiyona işaret etmeli.
- `relation` v1'de **tekil** (string slug) modellenir — çoklu relation Plan 3'te değerlendirilecek; bu planda değişmez.
- Test komutları: core `pnpm --filter @justjson/core test`, CLI `pnpm --filter justjson test`.

---

### Task 1: Core — slugify + şema bütünlük doğrulaması

**Files:**
- Create: `packages/core/src/util/slug.ts`
- Create: `packages/core/src/util/slug.test.ts`
- Modify: `packages/core/src/schema/schema.ts` (parseSchema'ya integrity superRefine ekle)
- Modify: `packages/core/src/schema/schema.test.ts` (integrity testleri ekle)
- Modify: `packages/core/src/index.ts` (`slugify` export et)
- Test: yukarıdaki iki test dosyası

**Interfaces:**
- Consumes: mevcut `parseSchema`, `Schema` tipi.
- Produces:
  - `slugify(input: string): string` — küçük harf, Türkçe karakter eşlemesi, `[a-z0-9]` dışını `-`, tekrar eden `-` sadeleştir, baş/son `-` kırp; boşsa `'icerik'`. Asla `/` veya `..` içermez.
  - `parseSchema` artık bütünlük ihlallerinde `throw` eder (ZodError).

- [ ] **Step 1: slug testini yaz**

Create `packages/core/src/util/slug.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { slugify } from './slug'

describe('slugify', () => {
  it('boşlukları tire yapar, küçük harfe çevirir', () => {
    expect(slugify('Merhaba Dünya')).toBe('merhaba-dunya')
  })
  it('Türkçe karakterleri eşler', () => {
    expect(slugify('İçğüşöı ÇĞÜŞÖI')).toBe('icgusci-cgusci')
  })
  it('yol karakterlerini temizler (path traversal)', () => {
    expect(slugify('../../etc/passwd')).toBe('etc-passwd')
    expect(slugify('a/b')).toBe('a-b')
  })
  it('tekrar eden ve baştaki/sondaki tireleri sadeleştirir', () => {
    expect(slugify('  --a---b--  ')).toBe('a-b')
  })
  it('boş girdi için varsayılan verir', () => {
    expect(slugify('!!!')).toBe('icerik')
    expect(slugify('')).toBe('icerik')
  })
})
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `pnpm --filter @justjson/core test`
Expected: FAIL — `Cannot find module './slug'`.

- [ ] **Step 3: slugify'ı yaz**

Create `packages/core/src/util/slug.ts`:
```ts
const TR: Record<string, string> = {
  ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u',
  Ç: 'c', Ğ: 'g', İ: 'i', Ö: 'o', Ş: 's', Ü: 'u', I: 'i',
}

export function slugify(input: string): string {
  const mapped = input.replace(/[çğıöşüÇĞİÖŞÜI]/g, (c) => TR[c] ?? c)
  const slug = mapped
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || 'icerik'
}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Run: `pnpm --filter @justjson/core test`
Expected: PASS (slug testleri).

- [ ] **Step 5: Bütünlük testini yaz**

Add to `packages/core/src/schema/schema.test.ts` (dosyanın sonuna yeni describe bloğu):
```ts
describe('parseSchema bütünlük', () => {
  const base = {
    version: 1,
    collections: [{ name: 'posts', path: 'posts', fields: [{ key: 'title', type: 'text' }] }],
    singletons: [],
  }

  it('benzersiz olmayan koleksiyon adını reddeder', () => {
    const bad = {
      ...base,
      collections: [base.collections[0], { name: 'posts', path: 'p2', fields: [] }],
    }
    expect(() => parseSchema(bad)).toThrow()
  })

  it('benzersiz olmayan path reddeder', () => {
    const bad = {
      ...base,
      collections: [base.collections[0], { name: 'other', path: 'posts', fields: [] }],
    }
    expect(() => parseSchema(bad)).toThrow()
  })

  it('koleksiyon içi tekrar eden field key reddeder', () => {
    const bad = {
      ...base,
      collections: [
        { name: 'posts', path: 'posts', fields: [{ key: 'title', type: 'text' }, { key: 'title', type: 'text' }] },
      ],
    }
    expect(() => parseSchema(bad)).toThrow()
  })

  it('var olmayan koleksiyona relation reddeder', () => {
    const bad = {
      ...base,
      collections: [
        { name: 'posts', path: 'posts', fields: [{ key: 'rel', type: 'relation', to: 'yok' }] },
      ],
    }
    expect(() => parseSchema(bad)).toThrow()
  })

  it('geçerli relation kabul edilir', () => {
    const ok = {
      version: 1,
      collections: [
        { name: 'tags', path: 'tags', fields: [{ key: 'name', type: 'text' }] },
        { name: 'posts', path: 'posts', fields: [{ key: 'tag', type: 'relation', to: 'tags' }] },
      ],
      singletons: [],
    }
    expect(() => parseSchema(ok)).not.toThrow()
  })
})
```

- [ ] **Step 6: Testin başarısız olduğunu doğrula**

Run: `pnpm --filter @justjson/core test`
Expected: FAIL — bütünlük testleri (parseSchema henüz throw etmiyor).

- [ ] **Step 7: parseSchema'ya integrity superRefine ekle**

In `packages/core/src/schema/schema.ts`, replace the `zSchema` definition and `parseSchema` with:
```ts
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
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `tekrar eden ad: ${c.name}` })
      }
      names.add(c.name)
      if (paths.has(c.path)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `tekrar eden path: ${c.path}` })
      }
      paths.add(c.path)

      const keys = new Set<string>()
      for (const f of c.fields) {
        if (keys.has(f.key)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `tekrar eden field key: ${f.key}` })
        }
        keys.add(f.key)
        if (f.type === 'relation' && f.to && !collectionNames.has(f.to)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `relation hedefi yok: ${f.to}` })
        }
      }
    }
  })

export function parseSchema(input: unknown): Schema {
  return zSchema.parse(input) as Schema
}
```

- [ ] **Step 8: slugify'ı dışa aktar**

In `packages/core/src/index.ts`, add after the schema exports:
```ts
export { slugify } from './util/slug'
```

- [ ] **Step 9: Tüm testler + typecheck + lint**

Run:
```bash
pnpm exec biome check --write packages/core/src
pnpm --filter @justjson/core test && pnpm --filter @justjson/core typecheck && pnpm lint
```
Expected: hepsi yeşil.

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "feat(core): slugify util and schema integrity validation"
```

---

### Task 2: FsAdapter (disk depolama)

**Files:**
- Create: `packages/justjson/src/fs-adapter.ts`
- Create: `packages/justjson/src/fs-adapter.test.ts`
- Create: `packages/justjson/vitest.config.ts`

**Interfaces:**
- Consumes: `StorageAdapter` tipi (`@justjson/core`).
- Produces: `class FsAdapter implements StorageAdapter` — kurucu `new FsAdapter(root: string)`; tüm yollar `root`'a göre çözülür. Atomik yazım (temp + rename). `read`/`list`/`exists` yoksa `null`/`[]`/`false`.

- [ ] **Step 1: Vitest config**

Create `packages/justjson/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
})
```

- [ ] **Step 2: Başarısız testi yaz**

Create `packages/justjson/src/fs-adapter.test.ts`:
```ts
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FsAdapter } from './fs-adapter'

let root: string
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'justjson-'))
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('FsAdapter', () => {
  it('ara dizinleri oluşturarak yazar ve okur', async () => {
    const a = new FsAdapter(root)
    await a.write('content/posts/a.json', '{"x":1}')
    expect(await a.read('content/posts/a.json')).toBe('{"x":1}')
  })

  it('olmayan dosya null döner', async () => {
    const a = new FsAdapter(root)
    expect(await a.read('yok.json')).toBeNull()
  })

  it('exists doğru çalışır', async () => {
    const a = new FsAdapter(root)
    expect(await a.exists('x.json')).toBe(false)
    await a.write('x.json', '1')
    expect(await a.exists('x.json')).toBe(true)
  })

  it('list yalnızca doğrudan alt dosyaları verir', async () => {
    const a = new FsAdapter(root)
    await a.write('content/posts/a.json', '1')
    await a.write('content/posts/b.json', '2')
    await a.write('content/posts/nested/c.json', '3')
    expect((await a.list('content/posts')).sort()).toEqual(['a.json', 'b.json'])
  })

  it('list olmayan dizin için boş dizi', async () => {
    const a = new FsAdapter(root)
    expect(await a.list('content/x')).toEqual([])
  })

  it('delete dosyayı kaldırır, yoksa hata vermez', async () => {
    const a = new FsAdapter(root)
    await a.write('x.json', '1')
    await a.delete('x.json')
    await a.delete('x.json')
    expect(await a.exists('x.json')).toBe(false)
  })
})
```

- [ ] **Step 3: Testin başarısız olduğunu doğrula**

Run: `pnpm --filter justjson test`
Expected: FAIL — `Cannot find module './fs-adapter'`.

- [ ] **Step 4: FsAdapter'ı yaz**

Create `packages/justjson/src/fs-adapter.ts`:
```ts
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { StorageAdapter } from '@justjson/core'

export class FsAdapter implements StorageAdapter {
  constructor(private readonly root: string) {}

  private abs(path: string): string {
    return join(this.root, path)
  }

  async read(path: string): Promise<string | null> {
    try {
      return await readFile(this.abs(path), 'utf8')
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw err
    }
  }

  async write(path: string, content: string): Promise<void> {
    const full = this.abs(path)
    await mkdir(dirname(full), { recursive: true })
    const tmp = `${full}.${process.pid}.tmp`
    await writeFile(tmp, content, 'utf8')
    await rename(tmp, full)
  }

  async delete(path: string): Promise<void> {
    await rm(this.abs(path), { force: true })
  }

  async list(dir: string): Promise<string[]> {
    try {
      const entries = await readdir(this.abs(dir), { withFileTypes: true })
      return entries.filter((e) => e.isFile()).map((e) => e.name)
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw err
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      await stat(this.abs(path))
      return true
    } catch {
      return false
    }
  }
}
```

- [ ] **Step 5: node tiplerini ekle**

FsAdapter `node:*` ve `NodeJS.ErrnoException` kullanır. `packages/justjson/package.json` devDependencies'e `@types/node` ekle (`"@types/node": "^22.10.2"`), ve `packages/justjson/tsconfig.json`'da `"types": ["node"]` olduğundan emin ol (iskelette zaten var). Sonra `pnpm install`.

- [ ] **Step 6: Test + typecheck + lint**

Run:
```bash
pnpm install
pnpm exec biome check --write packages/justjson/src
pnpm --filter justjson test && pnpm --filter justjson typecheck && pnpm lint
```
Expected: yeşil.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(cli): FsAdapter with atomic writes"
```

---

### Task 3: Konfigürasyon çözümü + `justjson init` (template'ler)

**Files:**
- Create: `packages/justjson/src/config.ts`
- Create: `packages/justjson/src/templates/blog.json`
- Create: `packages/justjson/src/templates/cv.json`
- Create: `packages/justjson/src/commands/init.ts`
- Create: `packages/justjson/src/commands/init.test.ts`

**Interfaces:**
- Consumes: `FsAdapter` (Task 2), `parseSchema`, `saveSchema`, `ContentStore`, `slugify` (core).
- Produces:
  - `resolveContentDir(root: string): Promise<string>` — `justjson.config.json` varsa `contentDir`'i, yoksa `'content'`.
  - `type Template = { schema: unknown; samples: Record<string, Record<string, unknown>[]> }`
  - `listTemplates(): string[]` — mevcut template adları.
  - `initProject(root: string, templateName: string): Promise<void>` — şemayı `content/_schema.json`'a yazar, her koleksiyona örnek kayıtları slug bazlı yazar. Şema zaten varsa `throw`.

- [ ] **Step 1: Template dosyalarını yaz**

Create `packages/justjson/src/templates/blog.json`:
```json
{
  "schema": {
    "version": 1,
    "collections": [
      {
        "name": "posts",
        "label": "Yazılar",
        "path": "posts",
        "fields": [
          { "key": "title", "label": "Başlık", "type": "text", "required": true },
          { "key": "slug", "label": "Slug", "type": "text", "required": true },
          { "key": "date", "label": "Tarih", "type": "date" },
          { "key": "body", "label": "İçerik", "type": "richtext" }
        ]
      }
    ],
    "singletons": [
      {
        "name": "settings",
        "label": "Ayarlar",
        "path": "settings.json",
        "fields": [{ "key": "title", "label": "Site adı", "type": "text" }]
      }
    ]
  },
  "samples": {
    "posts": [{ "title": "İlk yazı", "slug": "ilk-yazi", "body": "Merhaba." }]
  }
}
```

Create `packages/justjson/src/templates/cv.json`:
```json
{
  "schema": {
    "version": 1,
    "collections": [
      {
        "name": "experience",
        "label": "Deneyim",
        "path": "experience",
        "fields": [
          { "key": "role", "label": "Pozisyon", "type": "text", "required": true },
          { "key": "company", "label": "Şirket", "type": "text", "required": true },
          { "key": "summary", "label": "Özet", "type": "richtext" }
        ]
      }
    ],
    "singletons": [
      {
        "name": "profile",
        "label": "Profil",
        "path": "profile.json",
        "fields": [
          { "key": "name", "label": "Ad", "type": "text", "required": true },
          { "key": "headline", "label": "Başlık", "type": "text" }
        ]
      }
    ]
  },
  "samples": {
    "experience": [{ "role": "Yazılımcı", "company": "Örnek A.Ş.", "summary": "..." }]
  }
}
```

- [ ] **Step 2: config testini yaz**

Create `packages/justjson/src/commands/init.test.ts`:
```ts
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resolveContentDir } from '../config'
import { initProject, listTemplates } from './init'

let root: string
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'justjson-'))
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('resolveContentDir', () => {
  it('config yoksa content', async () => {
    expect(await resolveContentDir(root)).toBe('content')
  })
  it('config varsa onu okur', async () => {
    await writeFile(join(root, 'justjson.config.json'), JSON.stringify({ contentDir: 'data' }))
    expect(await resolveContentDir(root)).toBe('data')
  })
})

describe('initProject', () => {
  it('blog template en az bir koleksiyon içerir', () => {
    expect(listTemplates()).toContain('blog')
  })

  it('şemayı ve örnek kaydı yazar', async () => {
    await initProject(root, 'blog')
    const schema = JSON.parse(await readFile(join(root, 'content/_schema.json'), 'utf8'))
    expect(schema.collections[0].name).toBe('posts')
    const entry = JSON.parse(await readFile(join(root, 'content/posts/ilk-yazi.json'), 'utf8'))
    expect(entry.title).toBe('İlk yazı')
  })

  it('şema zaten varsa hata verir', async () => {
    await initProject(root, 'blog')
    await expect(initProject(root, 'blog')).rejects.toThrow()
  })

  it('bilinmeyen template hata verir', async () => {
    await expect(initProject(root, 'yok')).rejects.toThrow()
  })
})
```

- [ ] **Step 3: Testin başarısız olduğunu doğrula**

Run: `pnpm --filter justjson test`
Expected: FAIL — `Cannot find module '../config'`.

- [ ] **Step 4: config.ts'i yaz**

Create `packages/justjson/src/config.ts`:
```ts
import { FsAdapter } from './fs-adapter'

export async function resolveContentDir(root: string): Promise<string> {
  const raw = await new FsAdapter(root).read('justjson.config.json')
  if (raw === null) return 'content'
  const cfg = JSON.parse(raw) as { contentDir?: string }
  return cfg.contentDir ?? 'content'
}
```

- [ ] **Step 5: init.ts'i yaz**

Create `packages/justjson/src/commands/init.ts`:
```ts
import { ContentStore, loadSchema, parseSchema, saveSchema, slugify } from '@justjson/core'
import { FsAdapter } from '../fs-adapter'
import { resolveContentDir } from '../config'
import blog from '../templates/blog.json'
import cv from '../templates/cv.json'

export interface Template {
  schema: unknown
  samples: Record<string, Record<string, unknown>[]>
}

const templates: Record<string, Template> = {
  blog: blog as Template,
  cv: cv as Template,
}

export function listTemplates(): string[] {
  return Object.keys(templates)
}

export async function initProject(root: string, templateName: string): Promise<void> {
  const template = templates[templateName]
  if (!template) throw new Error(`Bilinmeyen template: ${templateName}`)

  const adapter = new FsAdapter(root)
  const contentDir = await resolveContentDir(root)
  if (await loadSchema(adapter, contentDir)) {
    throw new Error('Bu klasörde zaten bir şema var (content/_schema.json).')
  }

  const schema = parseSchema(template.schema)
  await saveSchema(adapter, schema, contentDir)

  const store = new ContentStore(adapter, schema, contentDir)
  for (const [collection, rows] of Object.entries(template.samples)) {
    for (const row of rows) {
      const slug = slugify(typeof row.slug === 'string' ? row.slug : String(row.title ?? 'icerik'))
      await store.writeEntry(collection, slug, row)
    }
  }
}
```

- [ ] **Step 6: Test + typecheck + lint**

Run:
```bash
pnpm exec biome check --write packages/justjson/src
pnpm --filter justjson test && pnpm --filter justjson typecheck && pnpm lint
```
Expected: yeşil. (Not: JSON import'u `resolveJsonModule` ile çalışır — tsconfig.base'de açık. tsup bundle sırasında JSON gömülür; `justjson build` çıktısında `dist` içine dahil olur.)

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(cli): init command with blog and cv templates"
```

---

### Task 4: `justjson types` komutu

**Files:**
- Create: `packages/justjson/src/commands/types.ts`
- Create: `packages/justjson/src/commands/types.test.ts`

**Interfaces:**
- Consumes: `FsAdapter`, `loadSchema`, `generateTypes` (core), `resolveContentDir` (Task 3).
- Produces: `generateTypesFile(root: string, outPath?: string): Promise<string>` — şemayı yükler, `types.ts` üretir, `root`'a göre `outPath` (varsayılan `'types.ts'`) konumuna yazar; yazılan yolu döndürür. Şema yoksa `throw`.

- [ ] **Step 1: Başarısız testi yaz**

Create `packages/justjson/src/commands/types.test.ts`:
```ts
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { initProject } from './init'
import { generateTypesFile } from './types'

let root: string
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'justjson-'))
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('generateTypesFile', () => {
  it('şemadan types.ts yazar', async () => {
    await initProject(root, 'blog')
    const out = await generateTypesFile(root)
    expect(out).toBe(join(root, 'types.ts'))
    const content = await readFile(out, 'utf8')
    expect(content).toContain('export interface Posts')
  })

  it('şema yoksa hata verir', async () => {
    await expect(generateTypesFile(root)).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `pnpm --filter justjson test`
Expected: FAIL — `Cannot find module './types'`.

- [ ] **Step 3: types.ts'i yaz**

Create `packages/justjson/src/commands/types.ts`:
```ts
import { join } from 'node:path'
import { generateTypes, loadSchema } from '@justjson/core'
import { resolveContentDir } from '../config'
import { FsAdapter } from '../fs-adapter'

export async function generateTypesFile(root: string, outPath = 'types.ts'): Promise<string> {
  const adapter = new FsAdapter(root)
  const contentDir = await resolveContentDir(root)
  const schema = await loadSchema(adapter, contentDir)
  if (!schema) throw new Error('Şema bulunamadı. Önce `justjson init` çalıştırın.')
  await adapter.write(outPath, generateTypes(schema))
  return join(root, outPath)
}
```

- [ ] **Step 4: Test + typecheck + lint**

Run:
```bash
pnpm exec biome check --write packages/justjson/src
pnpm --filter justjson test && pnpm --filter justjson typecheck && pnpm lint
```
Expected: yeşil.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(cli): types command"
```

---

### Task 5: `justjson export` komutu (ZIP)

**Files:**
- Create: `packages/justjson/src/commands/export.ts`
- Create: `packages/justjson/src/commands/export.test.ts`
- Modify: `packages/justjson/package.json` (fflate bağımlılığı)

**Interfaces:**
- Consumes: `FsAdapter`, `loadSchema`, `ContentStore`, `buildExportManifest` (core), `resolveContentDir`.
- Produces: `exportZip(root: string, outFile?: string): Promise<string>` — tüm koleksiyon/singleton içeriğini okur, `buildExportManifest` ile dosya haritası kurar, `fflate.zipSync` ile zip'ler, `root`'a göre `outFile` (varsayılan `'justjson-export.zip'`) yazar; yazılan yolu döndürür.

- [ ] **Step 1: fflate ekle**

`packages/justjson/package.json` dependencies'e ekle: `"fflate": "^0.8.2"`. Sonra `pnpm install`.

- [ ] **Step 2: Başarısız testi yaz**

Create `packages/justjson/src/commands/export.test.ts`:
```ts
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { unzipSync } from 'fflate'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { exportZip } from './export'
import { initProject } from './init'

let root: string
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'justjson-'))
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('exportZip', () => {
  it('şema, içerik ve types içeren zip üretir', async () => {
    await initProject(root, 'blog')
    const out = await exportZip(root)
    expect(out).toBe(join(root, 'justjson-export.zip'))
    const buf = await readFile(out)
    const files = unzipSync(new Uint8Array(buf))
    const names = Object.keys(files)
    expect(names).toContain('content/_schema.json')
    expect(names).toContain('content/posts/ilk-yazi.json')
    expect(names).toContain('types.ts')
  })

  it('şema yoksa hata verir', async () => {
    await expect(exportZip(root)).rejects.toThrow()
  })
})
```

- [ ] **Step 3: Testin başarısız olduğunu doğrula**

Run: `pnpm --filter justjson test`
Expected: FAIL — `Cannot find module './export'`.

- [ ] **Step 4: export.ts'i yaz**

Create `packages/justjson/src/commands/export.ts`. Not: zip **binary** olduğundan `FsAdapter.write` (utf8 string) ile yazılamaz — bu tek dosya doğrudan `node:fs/promises.writeFile` ile Uint8Array olarak yazılır:
```ts
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildExportManifest, ContentStore, loadSchema } from '@justjson/core'
import { zipSync } from 'fflate'
import { resolveContentDir } from '../config'
import { FsAdapter } from '../fs-adapter'

export async function exportZip(root: string, outFile = 'justjson-export.zip'): Promise<string> {
  const adapter = new FsAdapter(root)
  const contentDir = await resolveContentDir(root)
  const schema = await loadSchema(adapter, contentDir)
  if (!schema) throw new Error('Şema bulunamadı. Önce `justjson init` çalıştırın.')

  const store = new ContentStore(adapter, schema, contentDir)
  const entries: Record<string, Record<string, unknown>[]> = {}
  for (const col of schema.collections) {
    const slugs = await store.listEntries(col.name)
    const rows: Record<string, unknown>[] = []
    for (const slug of slugs) {
      const data = await store.readEntry(col.name, slug)
      if (data) rows.push({ slug, ...data })
    }
    entries[col.name] = rows
  }

  const singletons: Record<string, Record<string, unknown>> = {}
  for (const s of schema.singletons) {
    const data = await store.readSingleton(s.name)
    if (data) singletons[s.name] = data
  }

  const manifest = buildExportManifest({ schema, entries, singletons })
  const encoder = new TextEncoder()
  const zipInput: Record<string, Uint8Array> = {}
  for (const [path, content] of Object.entries(manifest)) {
    zipInput[path] = typeof content === 'string' ? encoder.encode(content) : content
  }

  const zipped = zipSync(zipInput)
  const outAbs = join(root, outFile)
  await writeFile(outAbs, zipped)
  return outAbs
}
```

- [ ] **Step 5: Test + typecheck + lint**

Run:
```bash
pnpm install
pnpm exec biome check --write packages/justjson/src
pnpm --filter justjson test && pnpm --filter justjson typecheck && pnpm lint
```
Expected: yeşil.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(cli): export command producing a zip snapshot"
```

---

### Task 6: Lokal sunucu + CLI bağlama (`serve`, komut kaydı)

**Files:**
- Create: `packages/justjson/src/server.ts`
- Create: `packages/justjson/src/server.test.ts`
- Modify: `packages/justjson/src/cli.ts` (komutları kaydet)

**Interfaces:**
- Consumes: `FsAdapter`, `loadSchema`, `ContentStore`, `slugify` (core), `resolveContentDir`.
- Produces:
  - `createServer(root: string): Promise<Hono>` — şemayı yükler (yoksa `throw`), aşağıdaki rotaları kuran Hono uygulaması döndürür. `.request()` ile test edilebilir.
    - `GET /api/_schema` → şema JSON
    - `GET /api/:collection` → `{ slugs: string[] }`
    - `GET /api/:collection/:slug` → entry JSON (yoksa 404)
    - `PUT /api/:collection/:slug` → gövdeyi kaydeder, `{ ok: true }` (slug `slugify`'dan geçirilir)
    - `DELETE /api/:collection/:slug` → siler, `{ ok: true }`
  - `startServer(root: string, port: number): Promise<void>` — `createServer` + `@hono/node-server` ile dinler (yalnızca `serve` komutundan çağrılır; teste tabi değil).
- `cli.ts`: `init`, `types`, `export`, `serve` komutları commander'a kaydedilir; `serve` varsayılan komuttur.

- [ ] **Step 1: Başarısız testi yaz**

Create `packages/justjson/src/server.test.ts`:
```ts
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { initProject } from './commands/init'
import { createServer } from './server'

let root: string
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'justjson-'))
  await initProject(root, 'blog')
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('createServer', () => {
  it('şema döndürür', async () => {
    const app = await createServer(root)
    const res = await app.request('/api/_schema')
    expect(res.status).toBe(200)
    const schema = await res.json()
    expect(schema.collections[0].name).toBe('posts')
  })

  it('koleksiyon slug listesini verir', async () => {
    const app = await createServer(root)
    const res = await app.request('/api/posts')
    expect((await res.json()).slugs).toContain('ilk-yazi')
  })

  it('tek kaydı verir, olmayanda 404', async () => {
    const app = await createServer(root)
    expect((await app.request('/api/posts/ilk-yazi')).status).toBe(200)
    expect((await app.request('/api/posts/yok')).status).toBe(404)
  })

  it('PUT yazar ve slugify eder', async () => {
    const app = await createServer(root)
    const res = await app.request('/api/posts/Yeni Yazı', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Yeni Yazı' }),
    })
    expect(res.status).toBe(200)
    const list = await (await app.request('/api/posts')).json()
    expect(list.slugs).toContain('yeni-yazi')
  })

  it('DELETE siler', async () => {
    const app = await createServer(root)
    await app.request('/api/posts/ilk-yazi', { method: 'DELETE' })
    const list = await (await app.request('/api/posts')).json()
    expect(list.slugs).not.toContain('ilk-yazi')
  })
})
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `pnpm --filter justjson test`
Expected: FAIL — `Cannot find module './server'`.

- [ ] **Step 3: server.ts'i yaz**

Create `packages/justjson/src/server.ts`:
```ts
import { serve } from '@hono/node-server'
import { ContentStore, loadSchema, slugify } from '@justjson/core'
import { Hono } from 'hono'
import { resolveContentDir } from './config'
import { FsAdapter } from './fs-adapter'

export async function createServer(root: string): Promise<Hono> {
  const adapter = new FsAdapter(root)
  const contentDir = await resolveContentDir(root)
  const schema = await loadSchema(adapter, contentDir)
  if (!schema) throw new Error('Şema bulunamadı. Önce `justjson init` çalıştırın.')
  const store = new ContentStore(adapter, schema, contentDir)

  const app = new Hono()

  app.get('/api/_schema', (c) => c.json(schema))

  app.get('/api/:collection', async (c) => {
    const slugs = await store.listEntries(c.req.param('collection'))
    return c.json({ slugs })
  })

  app.get('/api/:collection/:slug', async (c) => {
    const data = await store.readEntry(c.req.param('collection'), c.req.param('slug'))
    return data ? c.json(data) : c.json({ error: 'bulunamadı' }, 404)
  })

  app.put('/api/:collection/:slug', async (c) => {
    const slug = slugify(c.req.param('slug'))
    const body = (await c.req.json()) as Record<string, unknown>
    await store.writeEntry(c.req.param('collection'), slug, body)
    return c.json({ ok: true, slug })
  })

  app.delete('/api/:collection/:slug', async (c) => {
    await store.deleteEntry(c.req.param('collection'), c.req.param('slug'))
    return c.json({ ok: true })
  })

  return app
}

export async function startServer(root: string, port: number): Promise<void> {
  const app = await createServer(root)
  serve({ fetch: app.fetch, port })
  console.log(`JustJSON çalışıyor: http://localhost:${port}`)
}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Run: `pnpm --filter justjson test`
Expected: PASS (server testleri; unknown-collection hataları try/catch gerektirmez çünkü test yalnızca tanımlı koleksiyonları çağırır).

- [ ] **Step 5: cli.ts'e komutları bağla**

Replace `packages/justjson/src/cli.ts` with:
```ts
#!/usr/bin/env node
import { Command } from 'commander'
import { exportZip } from './commands/export'
import { initProject, listTemplates } from './commands/init'
import { generateTypesFile } from './commands/types'
import { startServer } from './server'

const program = new Command()
const root = process.cwd()

program.name('justjson').description('Lokalde çalışan, JSON üreten mini CMS').version('0.0.0')

program
  .command('init')
  .description('Bir template ile projeyi başlatır')
  .argument('[template]', `template adı (${listTemplates().join(', ')})`, 'blog')
  .action(async (template: string) => {
    await initProject(root, template)
    console.log(`'${template}' template'i ile başlatıldı.`)
  })

program
  .command('types')
  .description('Şemadan types.ts üretir')
  .action(async () => {
    const out = await generateTypesFile(root)
    console.log(`Yazıldı: ${out}`)
  })

program
  .command('export')
  .description('İçeriği ZIP olarak dışa aktarır')
  .action(async () => {
    const out = await exportZip(root)
    console.log(`Yazıldı: ${out}`)
  })

program
  .command('serve', { isDefault: true })
  .description('Lokal editör sunucusunu başlatır')
  .option('-p, --port <port>', 'port', '5180')
  .action(async (opts: { port: string }) => {
    await startServer(root, Number(opts.port))
  })

program.parseAsync()
```

- [ ] **Step 6: Test + typecheck + lint + build**

Run:
```bash
pnpm exec biome check --write packages/justjson/src
pnpm --filter justjson test && pnpm --filter justjson typecheck && pnpm --filter justjson build && pnpm lint
```
Expected: hepsi yeşil; `dist/cli.js` üretilir.

- [ ] **Step 7: Manuel duman testi (opsiyonel ama önerilir)**

Run:
```bash
cd "$(mktemp -d)" && node /Users/kdrgny/Desktop/Devs/justjson/packages/justjson/dist/cli.js init blog && ls content/posts
```
Expected: `ilk-yazi.json` listelenir.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat(cli): local Hono server and command wiring"
```

---

## Self-Review Notu

Spec kapsamı bu planda: `npx justjson` lokal araç (§1), `init`+template (§2), `types` ve `export` (§8 çıkış yolları — endpoint kullanıcının kendi deploy'u olduğundan sunucu yalnızca lokal düzenleme API'si), medya bu planda yok (§9 Plan 3'e), demo playground zaten var. Final review'ın iki Important takibi (parseSchema integrity, slug sanitizasyonu) Task 1'de karşılandı; export slug'ları da PUT'ta `slugify`'dan geçiyor.

Kapsam dışı (sonraki planlar): editör UI'ının bu API'ye bağlanması ve medya yükleme (Plan 3), relation kardinalite kararı (kullanıcı).

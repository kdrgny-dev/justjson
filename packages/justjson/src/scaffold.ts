import { access, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { type Collection, type Field, type Schema, slugify } from '@justjson/core'

/** Üretilen sitenin sabitlediği sürümler; kullanıcı sonra kendi günceller. */
const ASTRO_VERSION = '^5.18.0'
const LOADER_VERSION = '^1.6.0'

const STYLE = `  <style is:global>
    :root { color-scheme: light dark; }
    body {
      margin: 0 auto;
      max-width: 44rem;
      padding: 3rem 1.25rem 6rem;
      font: 16px/1.65 ui-sans-serif, system-ui, sans-serif;
    }
    h1 { font-size: 1.9rem; line-height: 1.2; margin: 0 0 0.35rem; }
    h2 { font-size: 1.05rem; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.6; margin: 2.75rem 0 0.75rem; }
    ul { list-style: none; margin: 0; padding: 0; }
    li + li { margin-top: 0.6rem; }
    a { color: inherit; }
    time { opacity: 0.6; font-size: 0.9rem; }
    img { max-width: 100%; height: auto; border-radius: 8px; }
    .body { white-space: pre-wrap; }
  </style>`

function titleFieldOf(fields: Field[]): string {
  const preferred = fields.find((f) =>
    ['title', 'name', 'label', 'role', 'version'].includes(f.key),
  )
  return (preferred ?? fields.find((f) => f.type === 'text'))?.key ?? 'title'
}

function safePackageName(name: string): string {
  return slugify(name) || 'my-site'
}

function detailPage(collection: Collection): string {
  const titleKey = titleFieldOf(collection.fields)
  const image = collection.fields.find((f) => f.type === 'image')
  const rich = collection.fields.find((f) => f.type === 'richtext')
  const date = collection.fields.find((f) => f.type === 'date')

  const parts = [
    `<h1>{entry.data.${titleKey} ?? entry.id}</h1>`,
    date && `{entry.data.${date.key} && <time>{entry.data.${date.key}}</time>}`,
    image &&
      `{entry.data.${image.key} && <img src={\`/media/\${entry.data.${image.key}.split('/').pop()}\`} alt="" />}`,
    rich && `{entry.data.${rich.key} && <div class="body">{entry.data.${rich.key}}</div>}`,
  ].filter(Boolean) as string[]

  return `---
import { getCollection } from 'astro:content'

export async function getStaticPaths() {
  const entries = await getCollection('${collection.name}')
  return entries.map((entry) => ({ params: { slug: entry.id }, props: { entry } }))
}

const { entry } = Astro.props
---
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{entry.data.${titleKey} ?? entry.id}</title>
${STYLE}
  </head>
  <body>
    <p><a href="/">&larr; Back</a></p>
${parts.map((p) => `    ${p}`).join('\n')}
  </body>
</html>
`
}

function indexPage(schema: Schema, projectName: string): string {
  const singleton = schema.singletons[0]
  const imports = ['getCollection', singleton && 'getEntry'].filter(Boolean).join(', ')

  const loads = schema.collections.map(
    (c) => `const ${varFor(c.name)} = await getCollection('${c.name}')`,
  )
  if (singleton) {
    loads.unshift(`const site = await getEntry('${singleton.name}', '${singleton.name}')`)
  }

  const heading = singleton
    ? `{site?.data.${titleFieldOf(singleton.fields)} ?? '${projectName}'}`
    : `${projectName}`

  const sections = schema.collections.map((c) => {
    const titleKey = titleFieldOf(c.fields)
    return `    <h2>${c.label ?? c.name}</h2>
    <ul>
      {${varFor(c.name)}.map((entry) => (
        <li>
          <a href={\`/${c.name}/\${entry.id}\`}>{entry.data.${titleKey} ?? entry.id}</a>
        </li>
      ))}
    </ul>`
  })

  const empty = `    <p>No content yet — run <code>npx @kdrgny/justjson</code> and add some.</p>`

  return `---
import { ${imports} } from 'astro:content'

${loads.join('\n')}
---
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${singleton ? `{site?.data.${titleFieldOf(singleton.fields)} ?? '${projectName}'}` : projectName}</title>
${STYLE}
  </head>
  <body>
    <h1>${heading}</h1>
${sections.length ? sections.join('\n') : empty}
  </body>
</html>
`
}

/** Koleksiyon adı JS değişkeni olamayabilir (blog-tags); güvenli bir ada çeviririz. */
function varFor(name: string): string {
  const camel = name.replace(/[^a-zA-Z0-9]+(.)/g, (_, c: string) => c.toUpperCase())
  return /^[a-zA-Z_$]/.test(camel) ? camel : `c${camel}`
}

/**
 * Şemadan çalışan, minimal bir Astro sitesi üretir: ana sayfa koleksiyonları
 * listeler, her koleksiyon için bir detay sayfası açılır. Kullanıcı buradan
 * kendi tasarımına devam eder.
 */
export function astroSiteFiles(schema: Schema, projectName: string): Record<string, string> {
  const files: Record<string, string> = {
    'package.json': `${JSON.stringify(
      {
        name: safePackageName(projectName),
        type: 'module',
        version: '0.0.1',
        private: true,
        scripts: { dev: 'astro dev', build: 'astro build', preview: 'astro preview' },
        dependencies: {
          '@kdrgny/justjson-astro': LOADER_VERSION,
          astro: ASTRO_VERSION,
        },
      },
      null,
      2,
    )}\n`,

    'astro.config.mjs': `import { defineConfig } from 'astro/config'

export default defineConfig({})
`,

    'tsconfig.json': `${JSON.stringify({ extends: 'astro/tsconfigs/strict' }, null, 2)}\n`,

    '.gitignore': `node_modules
dist
.astro
`,

    'src/content.config.ts': `import { justjsonCollections } from '@kdrgny/justjson-astro'

// Every collection and singleton in content/_schema.json, typed from your fields.
export const collections = await justjsonCollections()
`,

    'src/pages/index.astro': indexPage(schema, projectName),
  }

  for (const collection of schema.collections) {
    files[`src/pages/${collection.name}/[slug].astro`] = detailPage(collection)
  }

  return files
}

export interface ScaffoldResult {
  written: string[]
  skipped: string[]
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

/**
 * Üretilen siteyi diske yazar. Var olan hiçbir dosyanın üzerine yazmaz —
 * kullanıcının kendi package.json'ı ya da sayfaları kaybolmasın.
 */
export async function writeAstroSite(
  root: string,
  schema: Schema,
  projectName: string,
): Promise<ScaffoldResult> {
  const files = astroSiteFiles(schema, projectName)
  const result: ScaffoldResult = { written: [], skipped: [] }

  for (const [relative, contents] of Object.entries(files)) {
    const target = join(root, relative)
    if (await exists(target)) {
      result.skipped.push(relative)
      continue
    }
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, contents, 'utf8')
    result.written.push(relative)
  }
  return result
}

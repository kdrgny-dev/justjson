import { access, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { type Collection, type Field, type Schema, defaultTheme, slugify } from '@justjson/core'
import { siteTemplateFiles } from './site-templates'

/** Üretilen sitenin sabitlediği sürümler; kullanıcı sonra kendi günceller. */
const ASTRO_VERSION = '^5.18.0'
const LOADER_VERSION = '^1.8.0'

const LAYOUT = `---
import { parseTheme, themeCss } from '@kdrgny/justjson-astro/theme'
import theme from '../../content/_theme.json'

// Görünüm content/_theme.json'dan gelir — JustJSON'da değiştirince burası da değişir.
const css = themeCss(parseTheme(theme))
const { title } = Astro.props
---
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <style is:global set:html={css} />
    <style is:global>
      body {
        margin: 0 auto;
        max-width: 44rem;
        padding: var(--jj-page) 1.25rem calc(var(--jj-page) * 2);
        background: var(--jj-bg);
        color: var(--jj-text);
        font-family: var(--jj-font);
        font-size: 16px;
        line-height: var(--jj-lead);
      }
      h1 { font-size: 1.9rem; line-height: 1.2; margin: 0 0 0.35rem; }
      h2 {
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--jj-muted);
        margin: calc(var(--jj-page) * 0.8) 0 var(--jj-gap);
      }
      ul { list-style: none; margin: 0; padding: 0; }
      li + li { margin-top: var(--jj-gap); }
      a { color: var(--jj-accent); text-decoration: none; }
      a:hover { text-decoration: underline; }
      time { color: var(--jj-muted); font-size: 0.9rem; }
      img { max-width: 100%; height: auto; border-radius: var(--jj-radius); }
      code { background: color-mix(in oklab, var(--jj-text) 8%, transparent); padding: 0.1em 0.35em; border-radius: calc(var(--jj-radius) / 2); }
      .body { white-space: pre-wrap; }
      .back { color: var(--jj-muted); font-size: 0.9rem; }
      .jj-badge { margin-top: calc(var(--jj-page) * 1.5); padding-top: var(--jj-gap); border-top: 1px solid color-mix(in oklab, var(--jj-text) 10%, transparent); color: var(--jj-muted); font-size: 0.85rem; }
    </style>
  </head>
  <body>
    <slot />
    <footer class="jj-badge">Made with <a href="https://justjson.vercel.app">Just{JSON}</a></footer>
  </body>
</html>
`

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
import Layout from '../../layouts/Base.astro'

export async function getStaticPaths() {
  const entries = await getCollection('${collection.name}')
  return entries.map((entry) => ({ params: { slug: entry.id }, props: { entry } }))
}

const { entry } = Astro.props
---
<Layout title={entry.data.${titleKey} ?? entry.id}>
  <p class="back"><a href="/">&larr; Back</a></p>
${parts.map((p) => `  ${p}`).join('\n')}
</Layout>
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

  const empty = '    <p>No content yet — run <code>npx @kdrgny/justjson</code> and add some.</p>'

  const pageTitle = singleton
    ? `{site?.data.${titleFieldOf(singleton.fields)} ?? '${projectName}'}`
    : `"${projectName}"`

  return `---
import { ${imports} } from 'astro:content'
import Layout from '../layouts/Base.astro'

${loads.join('\n')}
---
<Layout title={${pageTitle.startsWith('{') ? pageTitle.slice(1, -1) : pageTitle}}>
  <h1>${heading}</h1>
${(sections.length ? sections.join('\n') : empty).replace(/^ {4}/gm, '  ')}
</Layout>
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
export function astroSiteFiles(
  schema: Schema,
  projectName: string,
  preset?: string,
): Record<string, string> {
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
  }

  // Preset'e özel styled tasarım varsa onu kullan; tek sayfa, kendi CSS'i,
  // içerik-sürücülü. Base/detay/jenerik index üretmeyiz.
  const styled = preset ? siteTemplateFiles(preset, projectName) : null
  if (styled) {
    Object.assign(files, styled)
    return files
  }

  files['content/_theme.json'] = `${JSON.stringify(defaultTheme(), null, 2)}\n`
  files['src/layouts/Base.astro'] = LAYOUT
  files['src/pages/index.astro'] = indexPage(schema, projectName)

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
  preset?: string,
): Promise<ScaffoldResult> {
  const files = astroSiteFiles(schema, projectName, preset)
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

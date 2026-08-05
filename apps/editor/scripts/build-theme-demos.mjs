#!/usr/bin/env node
// Builds the public theme demos: each premium theme rendered with its paired
// template's sample content, through the REAL renderer, as static multi-page
// sites under landing/public/themes/<themeId>/.
//
//   node scripts/build-theme-demos.mjs
//
// The renderer is browser TypeScript, so it is bundled on the fly with esbuild
// (already a devDependency) — no runner to install. Its only browser-bound
// import, the theme store, is stubbed: demos pass their bundle in explicitly.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, posix, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
// the product's own slugifier — Turkish-aware, same slugs Studio would produce
import { slugify } from '@justjson/core'
import * as esbuild from 'esbuild'

const here = dirname(fileURLToPath(import.meta.url))
const editorRoot = join(here, '..')
const repoRoot = join(editorRoot, '..', '..')
const outRoot = join(repoRoot, 'landing', 'public', 'themes')

// Theme ↔ template pairing. A demo only sells the theme if the content fits it.
// Add one row per premium theme as it ships: { theme, template, accent?, lang }.
// (Premium themes were reset 2026-08-05 — see themes-src/CLAUDE.md §7.)
const DEMOS = []

const die = (msg) => {
  console.error(`\ndemos: ${msg}\n`)
  process.exit(1)
}

const readJson = (p, what) => {
  if (!existsSync(p)) {
    die(
      `${what} not found: ${relative(repoRoot, p)}
Premium themes live in the private justjson-themes repo (checked out at
apps/editor/themes-src). Compile the bundle first:
  node scripts/theme-compile.mjs <id>`,
    )
  }
  return JSON.parse(readFileSync(p, 'utf8'))
}

// The theme's own default accent, taken from `var(--jj-accent, #xxxxxx)` in its
// source — so a demo never invents a colour the designer didn't choose.
function themeAccent(themeId) {
  const css = join(editorRoot, 'themes-src', themeId, 'styles.css')
  if (!existsSync(css)) return null
  const m = readFileSync(css, 'utf8').match(/--jj-accent,\s*(#[0-9a-fA-F]{3,8})/)
  return m ? m[1] : null
}

async function loadRenderer() {
  const stubThemeStore = {
    name: 'stub-theme-store',
    setup(build) {
      build.onResolve({ filter: /\.\/theme-store$/ }, () => ({
        path: 'theme-store',
        namespace: 'stub',
      }))
      build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
        contents:
          'export function getSelectedBundle(){throw new Error("demos: pass a bundle explicitly")}',
        loader: 'js',
      }))
    },
  }
  const out = join(tmpdir(), `jj-demo-render-${process.pid}.mjs`)
  await esbuild.build({
    entryPoints: [join(editorRoot, 'src', 'browser', 'render.ts')],
    outfile: out,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    logLevel: 'warning',
    plugins: [stubThemeStore],
  })
  try {
    return await import(pathToFileURL(out).href)
  } finally {
    rmSync(out, { force: true })
  }
}

function projectFrom(template, accent, lang) {
  const samples = template.samples ?? {}
  const schema = template.schema
  const entries = {}
  for (const col of schema.collections ?? []) {
    const rows = samples[col.name]
    if (!Array.isArray(rows)) continue
    // Sample rows rarely carry a slug, and a sector template's title field can be
    // named anything (baslik, soru…) — mirror the renderer's slot convention:
    // title/name, else the first text field in the schema.
    const titleKey =
      col.fields.find((f) => f.key === 'title' || f.key === 'name')?.key ??
      col.fields.find((f) => f.type === 'text')?.key
    entries[col.name] = rows.map((data, i) => ({
      slug: data.slug || slugify(data[titleKey]) || `${col.name}-${i + 1}`,
      data,
    }))
  }
  const singletons = {}
  for (const sg of schema.singletons ?? []) {
    if (samples[sg.name]) singletons[sg.name] = samples[sg.name]
  }
  const first = (schema.singletons ?? []).find((sg) => singletons[sg.name])
  const firstData = first ? singletons[first.name] : null
  const siteName = firstData?.siteName || firstData?.title || firstData?.name || template.title
  return {
    schema,
    entries,
    singletons,
    theme: { palette: 'paper', accent, font: 'sans', radius: 14, density: 'normal' },
    siteName,
    lang,
  }
}

// Every internal link must resolve to a file that exists, or the demo is broken
// at the subpath it is served from (/themes/<id>/…).
function checkLinks(files) {
  let checked = 0
  const dangling = []
  for (const [path, html] of Object.entries(files)) {
    const dir = posix.dirname(path)
    for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const raw = m[1].replace(/&#x2F;/g, '/').replace(/&amp;/g, '&')
      // any scheme (http, mailto, tel, data…), protocol-relative or in-page anchor
      if (/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(raw)) continue
      const target = posix.normalize(posix.join(dir, raw.split(/[?#]/)[0]))
      checked++
      if (!files[target]) dangling.push(`${path} -> ${raw}`)
    }
  }
  return { checked, dangling }
}

const { renderWithBundle } = await loadRenderer()

mkdirSync(outRoot, { recursive: true })
writeFileSync(
  join(outRoot, 'NOTICE.txt'),
  [
    'The files under landing/public/themes/ are generated marketing demos of',
    "JustJSON's commercial themes (Beacon, Atelier, Signal, Psikolog).",
    '',
    'They are NOT covered by the MIT license of this repository and may not be',
    'redistributed, resold or republished. The theme sources are kept in a private',
    'repository and are licensed separately; a demo page contains only minified,',
    'class-mangled output.',
    '',
    'Regenerate with: pnpm --filter @justjson/editor demos',
    '',
  ].join('\n'),
)

let totalPages = 0
for (const demo of DEMOS) {
  const template = readJson(
    join(editorRoot, 'src', 'templates', `${demo.template}.json`),
    `template "${demo.template}"`,
  )
  const bundle = readJson(
    join(editorRoot, 'src', 'themes', `${demo.theme}.json`),
    `theme bundle "${demo.theme}"`,
  )
  const accent = demo.accent ?? template.theme?.accent ?? themeAccent(demo.theme)
  if (!accent) die(`no accent for "${demo.theme}" — add one to the demo matrix`)

  const files = renderWithBundle(projectFrom(template, accent, demo.lang), bundle)
  const paths = Object.keys(files)
  if (paths.length === 0) die(`"${demo.theme}" rendered no pages`)

  const { checked, dangling } = checkLinks(files)
  if (dangling.length) die(`"${demo.theme}" has dangling links:\n  ${dangling.join('\n  ')}`)

  const dir = join(outRoot, demo.theme)
  rmSync(dir, { recursive: true, force: true })
  let bytes = 0
  for (const [path, html] of Object.entries(files)) {
    const file = resolve(dir, `.${path}`)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, html)
    bytes += Buffer.byteLength(html)
  }
  totalPages += paths.length
  console.log(
    `${demo.theme.padEnd(9)} ${String(paths.length).padStart(2)} pages  ` +
      `${String(Math.round(bytes / 1024)).padStart(4)} KB  ` +
      `${String(checked).padStart(3)} links ok  accent ${accent}  (${demo.template})`,
  )
}
console.log(`\n${totalPages} pages -> ${relative(repoRoot, outRoot)}/`)

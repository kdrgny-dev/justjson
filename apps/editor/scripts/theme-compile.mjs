#!/usr/bin/env node
// Theme compiler: readable SOURCE (semantic CSS + Mustache HTML) -> shipped
// ThemeBundle JSON with MANGLED class names + minified CSS. A stolen copy is
// then a frozen, working-but-uneditable artifact.
//
//   node scripts/theme-compile.mjs <id>
//
// Reads   apps/editor/themes-src/<id>/{meta.json,index.html,entry.html,styles.css}
//         or apps/editor/themes-free/<id>/ for a free (MIT) theme
// Writes  apps/editor/src/themes/<id>.json
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as esbuild from 'esbuild'

// Classes the renderer emits with FIXED names (render.ts contract). Themes
// style them but must never rename them, or field HTML loses its styling.
const RESERVED = new Set([
  'fld',
  'fld-label',
  'rt',
  'img',
  'swatch',
  'group',
  'jj-table',
  'jj-table-wrap',
])

// Sentinel used to mask url()/strings while scanning CSS for class names. A NUL
// char never appears in real CSS, so it can't collide with values like ` 0 `.
const SENT = String.fromCharCode(0)
const sentRe = new RegExp(`${SENT}(\\d+)${SENT}`, 'g')

const here = dirname(fileURLToPath(import.meta.url))
const editorRoot = join(here, '..')

const id = process.argv[2]
if (!id) {
  console.error('usage: node scripts/theme-compile.mjs <id>')
  process.exit(1)
}

// Commercial sources live in the private repo at themes-src/; free (MIT) themes
// live in themes-free/, which IS committed here. Mangling a free theme buys
// nothing — its source is public — so free compiles keep readable class names.
const premiumDir = join(editorRoot, 'themes-src', id)
const freeDir = join(editorRoot, 'themes-free', id)
const isFree = !existsSync(premiumDir) && existsSync(freeDir)
const srcDir = isFree ? freeDir : premiumDir
const read = (f) => readFileSync(join(srcDir, f), 'utf8')

const meta = JSON.parse(read('meta.json'))
let css = read('styles.css')

// index + entry are required; list + page are optional (renderer falls back).
const REQUIRED = ['index', 'entry']
const OPTIONAL = ['list', 'page']
const src = {}
for (const t of REQUIRED) src[t] = read(`${t}.html`)
for (const t of OPTIONAL) {
  try {
    src[t] = read(`${t}.html`)
  } catch {
    /* optional template not authored */
  }
}
const templateNames = Object.keys(src)

// 1. Tailwind: if the source uses @tailwind/@apply, resolve it to plain CSS via
//    the tailwind CLI (scanning the templates for content) before mangling.
//    ponytail: only @apply-in-styles is supported; utility classes in the HTML
//    are not (they'd be un-mangleable utility soup). Author with @apply.
if (/@tailwind\b|@apply\b/.test(css)) {
  css = compileTailwind(css, Object.values(src))
}

// 2. Collect mangle-able class names: union of template class tokens + CSS
//    class selectors, minus RESERVED. url()/strings are masked so filenames
//    like foo.png are never mistaken for a `.png` class.
const [maskedCss, restoreCss] = maskCss(css)

const names = new Set()
for (const html of Object.values(src)) for (const tok of templateClassTokens(html)) names.add(tok)
for (const m of maskedCss.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) names.add(m[1])
for (const r of RESERVED) names.delete(r)

// 3. Deterministic map original -> .hN (sorted for stable output). A free theme
//    maps nothing, so every rewrite below is an identity pass.
const sorted = isFree ? [] : [...names].sort()
const map = new Map(sorted.map((name, i) => [name, `h${i}`]))

// 4. Rewrite CSS selectors + template class attrs from the SAME map (kept in
//    sync). Word-boundary-safe: `.foo` never touches `.foobar`.
const outCss = restoreCss(rewriteCssClasses(maskedCss, map))
const out = {}
for (const t of templateNames) out[t] = rewriteTemplateClasses(src[t], map)

// 5. Minify (esbuild, build-time only, not shipped).
const minCss = esbuild.transformSync(outCss, { loader: 'css', minify: true }).code.trim()

// Safety net: no original semantic name may leak as a class token.
assertNoLeak(minCss, out, sorted)

const templates = {}
for (const t of templateNames) templates[t] = collapse(out[t])

const bundle = {
  id: meta.id,
  name: meta.name,
  version: meta.version,
  license: meta.license ?? 'commercial',
  thumb: meta.thumb ?? '',
  css: minCss,
  templates,
}

const json = `${JSON.stringify(bundle, null, 2)}\n`
const outPath = join(editorRoot, 'src', 'themes', `${id}.json`)
writeFileSync(outPath, json)
// Second copy next to the source, in themes-src/dist. For a commercial theme
// that directory is the private themes repo, and dist/ is what a paid Studio
// build pulls in (scripts/fetch-premium-themes.mjs) — so commit it there. A free
// theme ships its bundle from src/themes/ directly; it has no dist.
if (!isFree) {
  const distDir = join(editorRoot, 'themes-src', 'dist')
  mkdirSync(distDir, { recursive: true })
  writeFileSync(join(distDir, `${id}.json`), json)
}
console.log(
  isFree
    ? `compiled ${id} (free, unmangled) -> src/themes/${id}.json`
    : `compiled ${id}: ${sorted.length} classes mangled -> src/themes/${id}.json + themes-src/dist/`,
)

// ---------- helpers ----------

// Tokens inside class="..."/class='...' attributes, minus Mustache-tainted ones.
function templateClassTokens(html) {
  const out = []
  for (const m of html.matchAll(/\bclass\s*=\s*(["'])([\s\S]*?)\1/g)) {
    for (const tok of m[2].trim().split(/\s+/)) {
      if (tok && !tok.includes('{') && !tok.includes('}')) out.push(tok)
    }
  }
  return out
}

function rewriteTemplateClasses(html, map) {
  return html.replace(/(\bclass\s*=\s*)(["'])([\s\S]*?)\2/g, (_full, pre, q, val) => {
    const rewritten = val
      .split(/(\s+)/)
      .map((t) => (map.has(t) ? map.get(t) : t))
      .join('')
    return `${pre}${q}${rewritten}${q}`
  })
}

function rewriteCssClasses(source, map) {
  let out = source
  for (const [name, hashed] of map) {
    const re = new RegExp(`\\.${escapeRe(name)}(?![\\w-])`, 'g')
    out = out.replace(re, `.${hashed}`)
  }
  return out
}

// Replace comments/url()/quoted strings with SENT-delimited indices so class
// scanning and rewriting can't corrupt filenames or string content.
// Returns [masked, restore].
function maskCss(source) {
  const store = []
  // Comments go FIRST: an apostrophe in prose ("the product's own metaphor")
  // would otherwise open a bogus string literal and swallow the CSS after it —
  // those rules then escape mangling and leak their original class names.
  // Quoted url() is matched before bare url() so inner ')' (e.g. an SVG
  // data-URI's filter='url(#n)') can't truncate the match and leak the rest.
  const urlOrString =
    /\/\*[\s\S]*?\*\/|url\(\s*"[^"]*"\s*\)|url\(\s*'[^']*'\s*\)|url\([^)]*\)|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g
  const masked = source.replace(urlOrString, (m) => {
    store.push(m)
    return `${SENT}${store.length - 1}${SENT}`
  })
  const restore = (s) => s.replace(sentRe, (_m, i) => store[Number(i)])
  return [masked, restore]
}

function compileTailwind(source, contents) {
  const dir = mkdtempSync(join(tmpdir(), 'jj-tw-'))
  try {
    const input = join(dir, 'in.css')
    const output = join(dir, 'out.css')
    writeFileSync(input, source)
    contents.forEach((c, i) => writeFileSync(join(dir, `content${i}.html`), c))
    // tailwind CLI reads the editor's tailwind install; content auto-detected in dir.
    execFileSync('pnpm', ['exec', 'tailwindcss', '-i', input, '-o', output], {
      cwd: editorRoot,
      stdio: 'inherit',
    })
    return readFileSync(output, 'utf8')
  } catch (e) {
    console.error(
      'Tailwind directives found but tailwind CLI failed. Install @tailwindcss/cli, ' +
        'or author styles.css as plain CSS / @apply-only semantic classes.',
    )
    throw e
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// Collapse inter-tag whitespace in templates (Mustache-safe: only between > and <).
function collapse(html) {
  return html.replace(/>\s+</g, '><').trim()
}

function assertNoLeak(minCss, outTemplates, originals) {
  for (const name of originals) {
    const cssRe = new RegExp(`\\.${escapeRe(name)}(?![\\w-])`)
    if (cssRe.test(minCss)) throw new Error(`leak: original class .${name} still in css`)
    const clsRe = new RegExp(`class\\s*=\\s*["'][^"']*\\b${escapeRe(name)}\\b`)
    for (const [t, html] of Object.entries(outTemplates)) {
      if (clsRe.test(html)) throw new Error(`leak: original class ${name} still in ${t} template`)
    }
  }
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

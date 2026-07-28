<div align="center">

# JustJSON

**A tiny local-first CMS. Build your schema in a visual UI, edit content in a clean editor — everything stays on disk as plain JSON.**

No database · no account · no lock-in.

[**Website**](https://justjson.vercel.app)

[![npm](https://img.shields.io/npm/v/@kdrgny/justjson?color=e0a72e&label=npm)](https://www.npmjs.com/package/@kdrgny/justjson)
&nbsp;·&nbsp;
[![npm downloads](https://img.shields.io/npm/dm/@kdrgny/justjson?color=e0a72e&label=downloads)](https://www.npmjs.com/package/@kdrgny/justjson)
&nbsp;·&nbsp;
[![GitHub stars](https://img.shields.io/github/stars/kdrgny-dev/justjson?color=e0a72e)](https://github.com/kdrgny-dev/justjson/stargazers)
&nbsp;·&nbsp;
[![GitHub forks](https://img.shields.io/github/forks/kdrgny-dev/justjson?color=e0a72e)](https://github.com/kdrgny-dev/justjson/network/members)
&nbsp;·&nbsp;
[![License: MIT](https://img.shields.io/badge/License-MIT-e0a72e.svg)](LICENSE)

```bash
npx @kdrgny/justjson
```

**No install?** [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/kdrgny-dev/justjson/tree/main/examples/playground) — runs the editor in your browser.

<br>

<img src=".github/media/demo.gif" alt="JustJSON in action — edit a post, save it to disk, then restyle the generated site with a live preview" width="860">

</div>

---

JustJSON is the cleanest way to manage structured content **without writing config**. Design collections and fields by clicking, fill them in a real editor, and get plain JSON files you own — in your own repo, ready for your build.

It runs entirely on your machine. Nothing is uploaded anywhere; your content is just files on disk.

| Build the schema by clicking | Style it, preview it live |
|:---:|:---:|
| <img src=".github/media/editor-schema.png" alt="Visual schema builder — collections, fields and required flags" width="420"> | <img src=".github/media/editor-design.png" alt="Theme editor with a live preview of the generated site" width="420"> |

## Quick start

```bash
cd my-project/
npx @kdrgny/justjson           # opens the editor in your browser
```

On an empty folder the editor greets you with a picker: start from a **template**, from **scratch**, or **import your own JSON** — an existing `_schema.json`, or plain content (say, an export from another tool) whose structure JustJSON figures out for you.

Design your schema, enter content, upload images. Everything is written to `content/*.json` in your folder. Commit it, deploy it, import it in your build — your flow.

## What you get

| | |
|---|---|
| **Start from a template** | Blog, CV, portfolio, docs, changelog, recipe box, event schedule or product catalog — each card previews the collections and fields it creates. |
| **Bring your own JSON** | Paste any content JSON and JustJSON infers the structure: lists become collections, objects become singletons, HTML becomes rich text. |
| **Visual schema builder** | Define collections and fields in the UI. Pick a field type from icon cards — no config file to hand-write. |
| **Searchable content table** | Entries listed by title, slug and date. Search and edit instantly — content, not a pile of slugs. |
| **Rich-text editor** | Headings, bold, lists, quotes — WYSIWYG, saved to disk as clean, diffable Markdown. |
| **Image uploads** | Drop an image; it's resized to WebP in the browser and written under `content/media/`. |
| **Type-safe output** | Generates `types.ts` **and** a zero-dependency `content.ts` loader from your schema — `loadPosts()`, `loadSettings()` — so your content is fully typed in your build, no glue code. |
| **Validate in CI** | `justjson validate` checks content against the schema — broken relations, duplicate slugs, missing media, type errors. Exits non-zero on failure. |
| **Draft / published** | Toggle an entry's status; the generated loader returns published entries by default. |
| **Ship it** | A last step that closes the loop: generate a working site, or get the setup snippet for the framework you already use, then commit and push — all from the editor. |
| **One-click site** | No site in the folder yet? JustJSON generates a small Astro site wired to your content — home page, a page per entry, nothing you already have overwritten. |
| **Design** | Pick a palette, accent, font, corners and density; a live sample shows exactly how the generated site will look. Saved to `content/_theme.json`. |
| **Preview** | Run your site inside the editor and watch content and theme changes appear as you make them. |
| **Put it online** | Hand the repo to Vercel or Netlify from the editor. After that, publishing is one button — they rebuild on every push. |
| **English or Turkish** | The editor ships in English; switch to Turkish from the project menu any time. |
| **Export any time** | One click downloads schema + content + types as a ZIP. Nothing is ever locked in. |
| **The endpoint is yours** | Wherever you put the JSON becomes your API — repo raw, jsDelivr, your build. |

Field types: `text` · `richtext` · `number` · `boolean` · `date` · `select` · `relation` (multi) · `image` · `url` · `email` · `list` · `color` · `group` (nested).

## Commands

| Command | What it does |
|---|---|
| `npx @kdrgny/justjson` (or `serve`) | Starts the local editor and opens it in your browser |
| `npx @kdrgny/justjson init [template]` | Scaffolds a schema from a template (`blog`, `cv`, `portfolio`, `docs`, `changelog`, `recipe`, `event`, `catalog`). Add `--astro` to generate a working site too |
| `npx @kdrgny/justjson types` | Generates `types.ts` + a typed `content.ts` loader from your schema |
| `npx @kdrgny/justjson export` | Exports a ZIP snapshot (schema + content + types) |
| `npx @kdrgny/justjson validate` | Checks your content against the schema (great for CI) |

### Validating content in CI

`validate` walks your `content/` and reports anything that would break your
build: missing required fields, type mismatches, **broken relations**, duplicate
slugs, and images pointing at missing media. It exits non-zero on errors, so you
can gate a deploy on it:

```bash
npx @kdrgny/justjson validate            # human-readable report
npx @kdrgny/justjson validate --json     # machine-readable, for CI annotations
npx @kdrgny/justjson validate --strict   # warnings fail too (e.g. keys not in schema)
```

### Using your content in a build

`types` writes a `content.ts` next to `types.ts` — a **zero-dependency** typed
loader. No glue code to read files, no `import` boilerplate:

```ts
import { loadPosts, loadSettings } from './content'

const posts = await loadPosts()          // Array<Posts & { slug: string }>
const settings = await loadSettings()    // Settings | null

for (const post of posts) {
  console.log(post.slug, post.title)     // fully typed, slug included
}
```

Each collection entry comes back with its `slug` (the filename) merged in, ready
for routing. It reads straight from disk, so it works in any Node-based build —
including **Astro** and **Next.js** server code.

### Astro content collections

For Astro there is a dedicated loader — your content becomes real content
collections, typed from your schema:

```bash
npm install @kdrgny/justjson-astro
```

```ts
// src/content.config.ts
import { justjsonCollections } from '@kdrgny/justjson-astro'

export const collections = await justjsonCollections()
```

That's the whole setup. Every collection and singleton in your schema shows up in
`getCollection()` / `getEntry()`, drafts are skipped, and saving in the editor
updates the dev server without a restart. See
[the package README](packages/astro/README.md) for details.

## How it works

Your project holds a `content/` folder. JustJSON reads and writes it — that's all.

```
content/
  _schema.json          ← your schema (built from the UI)
  posts/
    hello-world.json    ← one file per entry
  settings.json         ← singletons
  media/                ← uploaded images (WebP)
```

The editor is served locally by the CLI; it talks only to your disk. Delete `node_modules`, keep the JSON — your content is never trapped in a tool.

## After you write content

The **Ship it** tab closes the loop.

If there is no site in the folder yet, it offers to generate one:

```bash
npx @kdrgny/justjson init blog --astro
npm install && npm run dev
```

You get a working Astro site built from your schema — a home page listing every
collection and a page per entry — already wired to `content/`. It is a starting
point to design over, not a finished theme. Nothing you already have is
overwritten.

If you already have a project, it detects the framework from `package.json` and
shows exactly what to paste — the Astro loader for Astro projects, the generated
`content.ts` loader everywhere else.

Then it takes you the rest of the way: commit your content, push it to GitHub,
and hand the repository to Vercel or Netlify. Those hosts run their own import
flow, so JustJSON never asks for an access token and never talks to them on your
behalf. Once a host is connected, publishing is a single button — it commits,
pushes, and the host rebuilds.

From the same screen you can commit just your `content/` folder and push it. It
shells out to the `git` and `gh` you already have, so there is no OAuth app, no
access token stored anywhere, and nothing leaves your machine that you did not
push yourself.

## Why local & file-based

- **Yours, not rented.** Content never touches anyone's servers. The files are already in your repo.
- **Zero infrastructure.** No server to run, no account, no token. Start it, use it, close it.
- **Git-friendly.** Plain JSON (and Markdown for rich text) diffs and versions cleanly.

JustJSON is deliberately small. It does one thing — turn a schema into editable JSON content — and tries to do it well. It is not a hosted, multiplayer, enterprise CMS, and doesn't try to be.

## Development

Monorepo (pnpm + Turborepo):

```
packages/core       @justjson/core — pure logic (schema, validation, types, export)
packages/justjson   the `justjson` CLI + local server (Hono)
apps/editor         the editor UI (Vite + React + Tailwind)
```

```bash
pnpm install
pnpm build     # builds core, bundles the editor into the CLI
pnpm test
```

## Roadmap

Small, need-driven improvements shipped as releases.

Landed in `1.8.0`:

- **Design** — a small theme editor (palette, accent, font, corners, density)
  with a live sample; the generated site reads it from `content/_theme.json`.
- **Preview** — the editor runs your dev server and shows the real site in a pane.

Landed in `1.7.0`:

- **Put it online** — deploy links for Vercel and Netlify, plus one-button
  publishing once a host is connected.

Landed in `1.6.0`:

- **One-click site** — `--astro`, or a button in the editor, generates a working
  Astro site around your content.

Landed in `1.5.0`:

- **Astro content collections** — `@kdrgny/justjson-astro` turns `content/` into
  typed Astro collections in one line, drafts filtered, live in dev.
- **Ship it** — the editor detects your framework, shows the setup snippet,
  commits your content and pushes it to GitHub (via `git`/`gh`, no tokens stored).

Landed in `1.4.0`:

- **English-first editor** — the UI is English by default, with Turkish one click
  away in the project menu. Your choice is remembered per browser.

Landed in `1.3.0`:

- **`justjson validate`** — check content against the schema in CI (broken
  relations, duplicate slugs, missing media, type errors).
- **Typed `content.ts` loader** — zero-dependency `loadPosts()` / `loadSettings()`
  generated alongside `types.ts`.
- **Draft / published status** — per-entry `_status`; the loader returns published
  entries by default.
- **More field types** — `url`, `email`, `list`, `color`, and nested `group`.

Ideas and issues welcome.

## Star history

<a href="https://star-history.com/#kdrgny-dev/justjson&Date">
  <img src="https://api.star-history.com/svg?repos=kdrgny-dev/justjson&type=Date" alt="Star history chart" width="600" />
</a>

## License

[MIT](LICENSE) © Kadir Günay

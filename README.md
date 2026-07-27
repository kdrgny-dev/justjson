<div align="center">

# JustJSON

**A tiny local-first CMS. Build your schema in a visual UI, edit content in a clean editor — everything stays on disk as plain JSON.**

No database · no account · no lock-in.

[**Website**](https://justjson-site.vercel.app)
&nbsp;·&nbsp;
[![npm](https://img.shields.io/npm/v/@kdrgny/justjson?color=4f46e5&label=npm)](https://www.npmjs.com/package/@kdrgny/justjson)
&nbsp;·&nbsp;
[![License: MIT](https://img.shields.io/badge/License-MIT-4f46e5.svg)](LICENSE)

```bash
npx @kdrgny/justjson
```

</div>

---

JustJSON is the cleanest way to manage structured content **without writing config**. Design collections and fields by clicking, fill them in a real editor, and get plain JSON files you own — in your own repo, ready for your build.

It runs entirely on your machine. Nothing is uploaded anywhere; your content is just files on disk.

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
| **Type-safe output** | Generates `types.ts` from your schema, so your content is fully typed in your project. |
| **Export any time** | One click downloads schema + content + types as a ZIP. Nothing is ever locked in. |
| **The endpoint is yours** | Wherever you put the JSON becomes your API — repo raw, jsDelivr, your build. |

Field types: `text` · `richtext` · `number` · `boolean` · `date` · `select` · `relation` (multi) · `image`.

## Commands

| Command | What it does |
|---|---|
| `npx @kdrgny/justjson` (or `serve`) | Starts the local editor and opens it in your browser |
| `npx @kdrgny/justjson init [template]` | Scaffolds a schema from a template (`blog`, `cv`, `portfolio`, `docs`, `changelog`, `recipe`, `event`, `catalog`) |
| `npx @kdrgny/justjson types` | Generates `types.ts` from your schema |
| `npx @kdrgny/justjson export` | Exports a ZIP snapshot (schema + content + types) |

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

Small, need-driven improvements shipped as releases:

- Faster setup with more ready-made schema templates
- Prompt-assisted schema & content scaffolding
- Draft / published status

Ideas and issues welcome.

## License

[MIT](LICENSE) © Kadir Günay

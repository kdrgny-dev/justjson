<div align="center">

# JustJSON

**A tiny local-first CMS. Build your schema in a visual UI, edit content in a clean editor — everything stays on disk as plain JSON.**

No database · no account · no lock-in.

[Website](https://justjson-site.vercel.app) ·
[GitHub](https://github.com/kdrgny-dev/justjson) ·
MIT

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
| **Start from a template** | Blog, CV, portfolio, docs or changelog — each card previews the collections and fields it creates. |
| **Bring your own JSON** | Paste any content JSON and JustJSON infers the structure: lists become collections, objects become singletons, HTML becomes rich text. |
| **Visual schema builder** | Define collections and fields in the UI. Pick a field type from icon cards — no config file to hand-write. |
| **Searchable content table** | Entries listed by title, slug and date. Search and edit instantly — content, not a pile of slugs. |
| **Rich-text editor** | Headings, bold, lists, quotes — WYSIWYG, saved to disk as clean, diffable Markdown. |
| **Image uploads** | Drop an image; it's resized to WebP in the browser and written under `content/media/`. |
| **Type-safe output** | Generates `types.ts` **and** a zero-dependency `content.ts` loader — `loadPosts()`, `loadSettings()` — so your content is typed in your build. |
| **Validate in CI** | `justjson validate` checks content against the schema — broken relations, duplicate slugs, missing media, type errors. Exits non-zero on failure. |
| **Draft / published** | Toggle an entry's status; the generated loader returns published entries by default. |
| **One-click site** | No site yet? `init --astro` (or a button in the editor) generates a working Astro site around your content. |
| **Ship it** | Setup snippet for your framework, one-click content commit, push to GitHub, then deploy links for Vercel and Netlify — using the `git`/`gh` already on your machine. No tokens stored. |
| **Astro collections** | [`@kdrgny/justjson-astro`](https://www.npmjs.com/package/@kdrgny/justjson-astro) turns your content into typed Astro content collections in one line. |
| **English or Turkish** | The editor ships in English; switch to Turkish from the project menu any time. |
| **Export any time** | One click downloads schema + content + types as a ZIP. Nothing is ever locked in. |
| **The endpoint is yours** | Wherever you put the JSON becomes your API — repo raw, jsDelivr, your build. |

Field types: `text` · `richtext` · `number` · `boolean` · `date` · `select` · `relation` (multi) · `image` · `url` · `email` · `list` · `color` · `group` (nested).

## Commands

| Command | What it does |
|---|---|
| `npx @kdrgny/justjson` (or `serve`) | Starts the local editor and opens it in your browser |
| `npx @kdrgny/justjson init [template]` | Scaffolds a schema from a template. `--astro` also generates a working site |
| `npx @kdrgny/justjson types` | Generates `types.ts` + a typed `content.ts` loader from your schema |
| `npx @kdrgny/justjson validate` | Checks content against the schema (`--json`, `--strict`) — great for CI |
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

JustJSON is deliberately small. It does one thing — turn a schema into editable JSON content — and tries to do it well.

## License

[MIT](https://github.com/kdrgny-dev/justjson/blob/main/LICENSE) © Kadir Günay

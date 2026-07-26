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
npx @kdrgny/justjson init      # start from a template (blog, cv) — or scratch
npx @kdrgny/justjson           # opens the editor in your browser
```

Design your schema, enter content, upload images. Everything is written to `content/*.json` in your folder. Commit it, deploy it, import it in your build — your flow.

## What you get

| | |
|---|---|
| **Visual schema builder** | Define collections and fields in the UI. Pick a field type from icon cards — no config file to hand-write. |
| **Searchable content table** | Entries listed by title, slug and date. Search and edit instantly — content, not a pile of slugs. |
| **Rich-text editor** | Headings, bold, lists, quotes — WYSIWYG, saved to disk as clean, diffable Markdown. |
| **Image uploads** | Drop an image; it's resized to WebP in the browser and written under `content/media/`. |
| **Type-safe output** | Generates `types.ts` from your schema, so your content is fully typed in your project. |
| **The endpoint is yours** | Wherever you put the JSON becomes your API — repo raw, jsDelivr, your build. Or export a ZIP. |

Field types: `text` · `richtext` · `number` · `boolean` · `date` · `select` · `relation` (multi) · `image`.

## Commands

| Command | What it does |
|---|---|
| `npx @kdrgny/justjson` (or `serve`) | Starts the local editor and opens it in your browser |
| `npx @kdrgny/justjson init [template]` | Scaffolds a schema from a template (`blog`, `cv`) |
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

JustJSON is deliberately small. It does one thing — turn a schema into editable JSON content — and tries to do it well.

## License

[MIT](https://github.com/kdrgny-dev/justjson/blob/main/LICENSE) © Kadir Günay

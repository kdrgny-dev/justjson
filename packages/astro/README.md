<div align="center">

# @kdrgny/justjson-astro

**Astro content loader for [JustJSON](https://github.com/kdrgny-dev/justjson).**

Your `content/` folder becomes typed Astro content collections — no glue code.

</div>

---

## Install

```bash
npm install @kdrgny/justjson-astro
```

## Use

One line in `src/content.config.ts`:

```ts
import { justjsonCollections } from '@kdrgny/justjson-astro'

export const collections = await justjsonCollections()
```

Every collection and singleton in your JustJSON schema becomes an Astro
collection, with a Zod schema derived from your field definitions:

```astro
---
import { getCollection, getEntry } from 'astro:content'

const posts = await getCollection('posts')
const settings = await getEntry('settings', 'settings')
---
<h1>{settings?.data.title}</h1>
{posts.map((post) => <a href={`/posts/${post.id}`}>{post.data.title}</a>)}
```

`post.data` is fully typed. A field marked required in the editor is required in
the type; everything else is optional:

```ts
{ title: string; slug: string; date?: string; body?: string; _status?: 'draft' | 'published' }
```

## What you get

| | |
|---|---|
| **Typed content** | Field types and required flags come straight from `_schema.json`. |
| **Drafts skipped** | Entries marked draft in the editor never reach your build. |
| **Live updates** | Save in the JustJSON editor and the dev server updates — no restart. |
| **Singletons** | A singleton becomes a one-entry collection; read it with `getEntry`. |
| **Safe when empty** | No schema yet? The build still succeeds with no collections. |

Entry `id` is the filename without `.json` — ready for `[slug].astro` routes.

## Options

`justjsonCollections()` takes an optional config:

```ts
export const collections = await justjsonCollections({
  drafts: true,        // include draft entries (default: false)
  contentDir: 'data',  // content folder, relative to the project root
  root: process.cwd(), // project root
})
```

For a single collection, use the loader directly:

```ts
import { defineCollection } from 'astro:content'
import { justjson } from '@kdrgny/justjson-astro'

export const collections = {
  posts: defineCollection({ loader: justjson({ collection: 'posts' }) }),
  settings: defineCollection({ loader: justjson({ singleton: 'settings' }) }),
}
```

## Field type mapping

| JustJSON | Astro / Zod |
|---|---|
| `text` · `richtext` · `date` · `image` · `url` · `email` · `color` | `string` |
| `number` | `number` |
| `boolean` | `boolean` |
| `select` | `enum` of your options (or `string` if none) |
| `relation` · `list` | `string[]` |
| `group` | nested object |

Format checks (is this a real URL?) are left to `justjson validate` on purpose,
so a typo in one entry never breaks your build in a surprising place.

## License

[MIT](https://github.com/kdrgny-dev/justjson/blob/main/LICENSE) © Kadir Günay

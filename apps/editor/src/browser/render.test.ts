import type { Schema } from '@justjson/core'
import { describe, expect, it } from 'vitest'
import { type ProjectData, renderSite, renderWithBundle } from './render'
import type { ThemeBundle } from './theme-bundle'

const schema: Schema = {
  version: 1,
  collections: [
    {
      name: 'posts',
      label: 'Posts',
      path: 'posts',
      fields: [
        { key: 'title', type: 'text' },
        { key: 'body', type: 'richtext' },
      ],
    },
  ],
  singletons: [
    {
      name: 'settings',
      label: 'Settings',
      path: 'settings.json',
      fields: [{ key: 'siteName', type: 'text' }],
    },
  ],
}

const data: ProjectData = {
  schema,
  entries: {
    posts: [{ slug: 'hello', data: { title: 'Hello World', body: '# Hi\n\nSome **bold** text.' } }],
  },
  singletons: { settings: { siteName: 'My Blog' } },
  theme: { palette: 'paper', accent: '#d69a1f', font: 'sans', radius: 6, density: 'normal' },
  siteName: 'My Blog',
}

describe('renderSite', () => {
  const files = renderSite(data)

  it('emits an index page with the site name and a card link', () => {
    const idx = files['/index.html']
    expect(idx).toContain('My Blog')
    expect(idx).toContain('./posts/hello.html')
    expect(idx).toContain('Hello World')
  })

  it('emits an entry page with richtext rendered to HTML', () => {
    const entry = files['/posts/hello.html']
    expect(entry).toBeDefined()
    expect(entry).toContain('<h1>Hi</h1>')
    expect(entry).toContain('<strong>bold</strong>')
  })

  it('escapes the title and does not leak the raw markdown into <title>', () => {
    expect(files['/posts/hello.html']).toContain('<title>Hello World</title>')
  })

  it('injects the core themeCss --jj-* block before the bundle css', () => {
    const idx = files['/index.html'] as string
    const jjIdx = idx.indexOf('--jj-accent')
    const bundleIdx = idx.indexOf('.wrap{max-width:880px')
    expect(jjIdx).toBeGreaterThan(-1)
    expect(bundleIdx).toBeGreaterThan(jjIdx)
  })

  it("does not execute a <script> in a text field — it's escaped", () => {
    const evilSchema: Schema = {
      version: 1,
      collections: [
        {
          name: 'posts',
          label: 'Posts',
          path: 'posts',
          fields: [
            { key: 'title', type: 'text' },
            { key: 'note', type: 'text' },
          ],
        },
      ],
      singletons: [],
    }
    const evil: ProjectData = {
      ...data,
      schema: evilSchema,
      entries: {
        posts: [{ slug: 'xss', data: { title: 'Safe', note: '<script>alert(1)</script>' } }],
      },
      singletons: {},
    }
    const out = renderSite(evil)['/posts/xss.html'] as string
    expect(out).toContain('&lt;script&gt;')
    expect(out).not.toContain('<script>alert(1)</script>')
  })

  it("renders a custom ThemeBundle's templates and css", () => {
    const bundle: ThemeBundle = {
      id: 'custom',
      name: 'Custom',
      version: '1.0.0',
      license: 'commercial',
      css: '.brandmark{color:hotpink}',
      templates: {
        index: '<main class="brandmark">SITE:{{siteName}}</main>',
        entry: '<main class="brandmark">{{title}}</main>',
      },
    }
    const out = renderWithBundle(data, bundle)
    expect(out['/index.html']).toContain('.brandmark{color:hotpink}')
    expect(out['/index.html']).toContain('<main class="brandmark">SITE:My Blog</main>')
    expect(out['/posts/hello.html']).toContain('<main class="brandmark">Hello World</main>')
  })
})

describe('multi-page contract', () => {
  const schema: Schema = {
    version: 1,
    collections: [
      {
        name: 'posts',
        label: 'Posts',
        path: 'posts',
        fields: [
          { key: 'title', type: 'text' },
          { key: 'body', type: 'richtext' },
        ],
      },
      {
        name: 'pages',
        label: 'Pages',
        path: 'pages',
        fields: [
          { key: 'title', type: 'text' },
          { key: 'body', type: 'richtext' },
        ],
      },
    ],
    singletons: [
      {
        name: 'site',
        label: 'Site',
        path: 'site.json',
        fields: [
          { key: 'name', type: 'text' },
          { key: 'tagline', type: 'text' },
        ],
      },
    ],
  }
  const data: ProjectData = {
    schema,
    entries: {
      posts: [{ slug: 'hello', data: { title: 'Hello', body: '# Hi' } }],
      pages: [{ slug: 'about', data: { title: 'About us', body: '**about** body' } }],
    },
    singletons: { site: { name: 'Acme', tagline: 'We build' } },
    theme: { palette: 'paper', accent: '#000', font: 'sans', radius: 6, density: 'normal' },
    siteName: 'Acme',
  }
  const bundle: ThemeBundle = {
    id: 't',
    name: 'T',
    version: '1.0.0',
    license: 'commercial',
    css: '',
    templates: {
      index:
        'HERO:{{hero.title}}|{{hero.lead}} NAV:{{#nav}}[{{label}}>{{url}}]{{/nav}} SEC:{{#sections}}{{label}}({{#items}}{{_url}}{{/items}}){{/sections}}',
      entry: 'ENTRY:{{slots.title}}|{{{slots.body}}}|back={{collection.url}}',
      list: 'LIST:{{collection.label}}:{{#items}}{{_title}}@{{_url}}{{/items}}',
      page: 'PAGE:{{slots.title}}|{{{slots.body}}}',
    },
  }
  // Mustache HTML-escapes `/` to `&#x2F;` in {{url}} — harmless in href
  // attributes (the browser decodes it); decode here to assert on real paths.
  const dec = (k: string) => (out[k] ?? '').replace(/&#x2F;/g, '/')
  const out = renderWithBundle(data, bundle)

  it('emits a standalone page from the pages collection', () => {
    expect(out['/about.html']).toContain('PAGE:About us|')
    expect(out['/about.html']).toContain('<strong>about</strong>')
    expect(out['/posts/pages/about.html']).toBeUndefined() // pages is not a listed collection
  })

  it('emits a collection list page but not one for pages', () => {
    expect(dec('/posts/index.html')).toContain('LIST:Posts:Hello@../posts/hello.html')
    expect(out['/pages/index.html']).toBeUndefined()
  })

  it('builds nav (Home + pages + listed collections) and skips pages as a section', () => {
    const idx = dec('/index.html')
    expect(idx).toContain('[Home>index.html]')
    expect(idx).toContain('[About us>about.html]')
    expect(idx).toContain('[Posts>posts/index.html]')
    expect(idx).toContain('SEC:Posts(posts/hello.html)') // only posts, not pages
  })

  it('derives hero slots from the first singleton', () => {
    expect(out['/index.html']).toContain('HERO:Acme|We build')
  })

  it('links entry back to its list with depth-correct base', () => {
    expect(dec('/posts/hello.html')).toContain('back=../posts/index.html')
  })
})

describe('repeater field', () => {
  const schema: Schema = {
    version: 1,
    collections: [
      {
        name: 'pages',
        label: 'Pages',
        path: 'pages',
        fields: [
          { key: 'title', type: 'text' },
          {
            key: 'pricing',
            type: 'repeater',
            fields: [
              { key: 'plan', type: 'text' },
              { key: 'price', type: 'text' },
            ],
          },
        ],
      },
    ],
    singletons: [],
  }
  const data: ProjectData = {
    schema,
    entries: {
      pages: [
        {
          slug: 'plans',
          data: {
            title: 'Plans',
            pricing: [
              { plan: 'Basic', price: '$9' },
              { plan: 'Pro', price: '$29' },
            ],
          },
        },
      ],
    },
    singletons: {},
    theme: { palette: 'paper', accent: '#000', font: 'sans', radius: 6, density: 'normal' },
    siteName: 'Acme',
  }
  const bundle: ThemeBundle = {
    id: 'r',
    name: 'R',
    version: '1.0.0',
    license: 'commercial',
    css: '',
    templates: { index: 'x', entry: 'x', page: 'PAGE:{{slots.title}}{{{slots.extras}}}' },
  }

  it('renders a repeater as a jj-table with the row values (slot theme)', () => {
    const out = renderWithBundle(data, bundle)['/plans.html'] as string
    expect(out).toContain('class="jj-table"')
    expect(out).toContain('<th>plan</th>')
    expect(out).toContain('Basic')
    expect(out).toContain('$29')
  })

  it('exposes repeater rows by key for bespoke themes', () => {
    const b: ThemeBundle = {
      id: 'r2',
      name: 'R2',
      version: '1.0.0',
      license: 'commercial',
      css: '',
      templates: {
        index: 'x',
        entry: 'x',
        page: '{{#this.pricing}}[{{plan}}={{price}}]{{/this.pricing}}',
      },
    }
    const out = renderWithBundle(data, b)['/plans.html'] as string
    expect(out).toContain('[Basic=$9]')
    expect(out).toContain('[Pro=$29]')
  })
})

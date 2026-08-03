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
    { name: 'settings', label: 'Settings', path: 'settings.json', fields: [{ key: 'siteName', type: 'text' }] },
  ],
}

const data: ProjectData = {
  schema,
  entries: { posts: [{ slug: 'hello', data: { title: 'Hello World', body: '# Hi\n\nSome **bold** text.' } }] },
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
      entries: { posts: [{ slug: 'xss', data: { title: 'Safe', note: '<script>alert(1)</script>' } }] },
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

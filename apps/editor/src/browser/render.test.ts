import type { Schema } from '@justjson/core'
import { describe, expect, it } from 'vitest'
import { type ProjectData, renderSite } from './render'

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
})

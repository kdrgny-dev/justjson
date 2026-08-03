import type { Schema } from '@justjson/core'
import { describe, expect, it } from 'vitest'
import { type ProjectData, renderWithBundle } from '../browser/render'
import type { ThemeBundle } from '../browser/theme-bundle'
import boldJson from './bold.json'
import editorialJson from './editorial.json'

const schema: Schema = {
  version: 1,
  collections: [
    {
      name: 'projects',
      label: 'Projects',
      path: 'projects',
      fields: [
        { key: 'title', type: 'text' },
        { key: 'summary', type: 'richtext' },
      ],
    },
  ],
  singletons: [
    { name: 'about', label: 'About', path: 'about.json', fields: [{ key: 'bio', type: 'richtext' }] },
  ],
}

const data: ProjectData = {
  schema,
  entries: {
    projects: [{ slug: 'aurora', data: { title: 'Aurora', summary: '# Overview\n\nA **realtime** canvas.' } }],
  },
  singletons: { about: { bio: 'Ten years of shipping.' } },
  theme: { palette: 'ink', accent: '#FF2E88', font: 'sans', radius: 4, density: 'normal' },
  siteName: 'Studio Nova',
}

const bundles: [string, ThemeBundle][] = [
  ['bold', boldJson as ThemeBundle],
  ['editorial', editorialJson as ThemeBundle],
]

describe.each(bundles)('theme bundle: %s', (_id, bundle) => {
  it('validates: non-empty css + templates', () => {
    expect(bundle.css.trim().length).toBeGreaterThan(0)
    expect(bundle.templates.index.trim().length).toBeGreaterThan(0)
    expect(bundle.templates.entry.trim().length).toBeGreaterThan(0)
    expect(bundle.license).toBe('commercial')
  })

  it('renders an index page with the site name and an entry link', () => {
    const files = renderWithBundle(data, bundle)
    const idx = files['/index.html'] as string
    expect(idx).toContain('Studio Nova')
    expect(idx).toContain('./projects/aurora.html')
    expect(idx).toContain('Aurora')
    expect(idx).toContain(bundle.css.slice(0, 40))
  })

  it('renders an entry page with the title and richtext HTML', () => {
    const entry = renderWithBundle(data, bundle)['/projects/aurora.html'] as string
    expect(entry).toBeDefined()
    expect(entry).toContain('Aurora')
    expect(entry).toContain('<strong>realtime</strong>')
  })
})

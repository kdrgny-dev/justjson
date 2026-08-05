import type { Schema } from '@justjson/core'
import { describe, expect, it } from 'vitest'
import { type ProjectData, renderWithBundle } from '../browser/render'
import type { ThemeBundle } from '../browser/theme-bundle'
import boldJson from './bold.json'
import editorialJson from './editorial.json'

// Commercial bundles ship only in a paid build (see scripts/fetch-premium-themes.mjs),
// so they are looked up, never imported by name — their suites skip when absent.
const present = import.meta.glob<{ default: ThemeBundle }>('./*.json', { eager: true })
const bundleById = (id: string): ThemeBundle | undefined =>
  Object.entries(present).find(([path]) => path.endsWith(`/${id}.json`))?.[1].default as
    | ThemeBundle
    | undefined
const signalJson = bundleById('signal')
const atelierJson = bundleById('atelier')

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
    {
      name: 'about',
      label: 'About',
      path: 'about.json',
      fields: [{ key: 'bio', type: 'richtext' }],
    },
  ],
}

const data: ProjectData = {
  schema,
  entries: {
    projects: [
      {
        slug: 'aurora',
        data: { title: 'Aurora', summary: '# Overview\n\nA **realtime** canvas.' },
      },
    ],
  },
  singletons: { about: { bio: 'Ten years of shipping.' } },
  theme: { palette: 'ink', accent: '#FF2E88', font: 'sans', radius: 4, density: 'normal' },
  siteName: 'Studio Nova',
}

const bundles: [string, ThemeBundle][] = [
  ['bold', boldJson as ThemeBundle],
  ['editorial', editorialJson as ThemeBundle],
  ...(signalJson ? ([['signal', signalJson]] as [string, ThemeBundle][]) : []),
]

describe.each(bundles)('theme bundle: %s', (_id, bundle) => {
  it('validates: non-empty css + templates', () => {
    expect(bundle.css.trim().length).toBeGreaterThan(0)
    expect(bundle.templates.index.trim().length).toBeGreaterThan(0)
    expect(bundle.templates.entry.trim().length).toBeGreaterThan(0)
    expect(['free', 'commercial']).toContain(bundle.license)
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

// The compiled "signal" bundle proves the theme compiler: semantic class names
// are mangled to .hN, the renderer-contract classes survive, css is minified,
// and it still renders correctly.
describe.skipIf(!signalJson)('compiled theme: signal (mangled)', () => {
  const bundle = signalJson as ThemeBundle
  // Original semantic names authored in themes-src/signal — none may leak.
  const semantic = [
    'shell',
    'topbar',
    'brand',
    'brand-dot',
    'hero',
    'hero-title',
    'card-grid',
    'card',
    'article',
    'article-body',
  ]

  it('mangles semantic classes to .hN in both css and templates', () => {
    expect(bundle.css).toMatch(/\.h\d+\{/)
    expect(bundle.templates.index).toMatch(/class="h\d+/)
    expect(bundle.templates.entry).toMatch(/class="h\d+/)
  })

  it('keeps the renderer-contract classes intact', () => {
    for (const reserved of ['.fld{', '.fld-label{', '.rt{', '.img{', '.swatch{', '.group{']) {
      expect(bundle.css).toContain(reserved)
    }
  })

  it('does not leak any original semantic class name', () => {
    for (const name of semantic) {
      // css: no `.name` selector survives (element tags like `article` are fine)
      expect(bundle.css).not.toMatch(new RegExp(`\\.${name}(?![\\w-])`))
      // templates: no class attribute contains the semantic token
      const tokenRe = new RegExp(`class="[^"]*\\b${name}\\b`)
      expect(bundle.templates.index).not.toMatch(tokenRe)
      expect(bundle.templates.entry).not.toMatch(tokenRe)
    }
  })

  it('is minified: no comments, no double spaces', () => {
    expect(bundle.css).not.toContain('/*')
    expect(bundle.css).not.toContain('  ')
    expect(bundle.css).not.toContain('\n')
  })

  it('keeps --jj-accent so the accent picker still works', () => {
    expect(bundle.css).toContain('var(--jj-accent)')
  })

  it('renders /index.html with the site name and a mangled class, no semantic names', () => {
    const idx = renderWithBundle(data, bundle)['/index.html'] as string
    expect(idx).toContain('Studio Nova')
    expect(idx).toMatch(/class="h\d+/)
    for (const name of semantic) {
      // a whole class token like class="...shell..." must not appear
      expect(idx).not.toMatch(new RegExp(`class="[^"]*\\b${name}\\b`))
    }
  })
})

// The flagship "atelier" bundle proves the multi-page slot contract end to end:
// a generic theme (four templates, bound to slots/nav — never sector fields)
// renders home/list/entry across any schema, mangled, with animations intact.
describe.skipIf(!atelierJson)('compiled theme: atelier (generic slot theme, multi-page)', () => {
  const bundle = atelierJson as ThemeBundle
  const semantic = [
    'site-head',
    'brand',
    'nav-link',
    'hero',
    'hero-title',
    'block',
    'cards',
    'card',
    'card-title',
    'article',
    'article-title',
    'foot',
  ]
  // A describe body still runs under skipIf — don't render when the bundle is
  // absent (free build).
  const files: Record<string, string> = atelierJson ? renderWithBundle(data, bundle) : {}
  const dec = (k: string) => (files[k] ?? '').replace(/&#x2F;/g, '/')

  it('provides all four templates', () => {
    for (const t of ['index', 'entry', 'list', 'page'] as const) {
      expect((bundle.templates as Record<string, string>)[t]?.length ?? 0).toBeGreaterThan(0)
    }
  })

  it('mangles semantic classes, keeps renderer-contract classes, leaks none', () => {
    expect(bundle.css).toMatch(/\.h\d+\{/)
    for (const reserved of ['.fld{', '.rt{', '.img{', '.swatch{', '.group{']) {
      expect(bundle.css).toContain(reserved)
    }
    for (const name of semantic) {
      expect(bundle.css).not.toMatch(new RegExp(`\\.${name}(?![\\w-])`))
    }
  })

  it('preserves data-attr reveal hooks and the observer script', () => {
    expect(bundle.css).toContain('[data-js] [data-reveal]')
    expect(bundle.templates.index).toMatch(/class="h\d+" data-reveal/)
    expect(bundle.templates.index).toContain('IntersectionObserver')
  })

  it('composes the home from slots (site name, entry card link, no semantic leak)', () => {
    const idx = dec('/index.html')
    expect(idx).toContain('Studio Nova')
    expect(idx).toContain('Aurora')
    expect(idx).toContain('projects/aurora.html')
    for (const name of semantic) {
      expect(idx).not.toMatch(new RegExp(`class="[^"]*\\b${name}\\b`))
    }
  })

  it('emits a collection list page', () => {
    expect(dec('/projects/index.html')).toContain('Aurora')
  })

  it('renders an entry from slots with richtext HTML', () => {
    const entry = files['/projects/aurora.html'] as string
    expect(entry).toContain('Aurora')
    expect(entry).toContain('<strong>realtime</strong>')
  })
})

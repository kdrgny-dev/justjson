import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import { PALETTES, type Schema, type Theme as SiteTheme, THEME_FONTS } from '@justjson/core'
import { Check, Loader2, Save, Upload, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import * as api from './api'
import { gatherProject } from './browser/gather'
import { renderWithBundle } from './browser/render'
import type { ThemeBundle } from './browser/theme-bundle'
import {
  BUNDLED_THEMES,
  allThemes,
  getSelectedThemeId,
  importTheme,
  removeImportedTheme,
  setSelectedThemeId,
} from './browser/theme-store'
import { PageBody, PageHeader, PageShell } from './components/PageShell'
import { t } from './i18n'

const ALL_TOKENS = ['palette', 'accent', 'font', 'radius', 'density']
const DEFAULT_BUNDLE = BUNDLED_THEMES[0] as ThemeBundle

// Which Design knobs a theme honors. Declared themes win; otherwise the default
// theme is fully token-driven, and every other (premium) theme ships a finished
// look tweakable only via accent.
function tokensFor(bundle: ThemeBundle | undefined): Set<string> {
  if (bundle?.tokens) return new Set(bundle.tokens)
  return new Set(bundle?.id === 'default' ? ALL_TOKENS : ['accent'])
}

const HEX = /^#[0-9a-f]{6}$/i

const DENSITIES: { id: SiteTheme['density']; label: string }[] = [
  { id: 'tight', label: 'Tight' },
  { id: 'normal', label: 'Cozy' },
  { id: 'roomy', label: 'Roomy' },
]

// Real preview: the user's own content rendered through the SELECTED bundle with
// the CURRENT (unsaved) theme tokens — the same renderer as publishing. Switching
// theme or tweaking a knob updates it. Debounced; whole-project re-gather is fine
// (projects are small).
function DesignPreview({
  schema,
  theme,
  bundleId,
}: {
  schema: Schema
  theme: SiteTheme
  bundleId: string
}) {
  const [html, setHtml] = useState<string | null>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    let cancelled = false
    const id = setTimeout(async () => {
      const project = await gatherProject(schema)
      project.theme = theme
      const bundle = allThemes().find((b) => b.id === bundleId) ?? DEFAULT_BUNDLE
      const files = renderWithBundle(project, bundle)
      if (!cancelled) setHtml(files['/index.html'] ?? '')
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [schema, theme, bundleId])

  const onLoad = () => {
    const doc = frameRef.current?.contentDocument
    if (!doc) return
    doc.documentElement.removeAttribute('data-js')
    for (const el of doc.querySelectorAll('[data-reveal]')) el.setAttribute('data-shown', '')
  }

  if (html === null)
    return (
      <div className="flex h-[74vh] items-center justify-center rounded-xl border bg-card">
        <Loader2 className="size-5 animate-spin text-primary" />
      </div>
    )
  return (
    <iframe
      ref={frameRef}
      srcDoc={html}
      onLoad={onLoad}
      title={t('Live preview')}
      className="h-[74vh] w-full rounded-xl border bg-white shadow-sm"
    />
  )
}

function sameTheme(a: SiteTheme, b: SiteTheme): boolean {
  return (
    a.palette === b.palette &&
    a.accent === b.accent &&
    a.font === b.font &&
    a.radius === b.radius &&
    a.density === b.density
  )
}

// App.tsx'teki ColorInput dışa açık değil; buranın küçük yerel sürümü.
function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const valid = HEX.test(value)
  return (
    <div className="flex items-center gap-2">
      <label className="relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-lg border shadow-sm">
        <span className="block size-full" style={{ backgroundColor: valid ? value : '#ffffff' }} />
        <input
          type="color"
          value={valid ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label={t('Pick an accent color')}
        />
      </label>
      <Input
        className="w-[140px] font-mono"
        placeholder="#000000"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!valid}
      />
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

const BUNDLED_IDS = new Set(BUNDLED_THEMES.map((t) => t.id))

function ThemePicker({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  const [themes, setThemes] = useState<ThemeBundle[]>(() => allThemes())
  const fileRef = useRef<HTMLInputElement>(null)

  const select = onSelect

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const bundle = importTheme(JSON.parse(await file.text()))
      setThemes(allThemes())
      select(bundle.id)
      toast.success(t('Theme "{name}" imported.', { name: bundle.name }))
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const remove = (id: string) => {
    removeImportedTheme(id)
    setThemes(allThemes())
    if (selected === id) select('default')
  }

  return (
    <Field label={t('Theme')}>
      <div className="grid grid-cols-2 gap-2">
        {themes.map((th) => {
          const active = th.id === selected
          return (
            <div key={th.id} className="relative">
              <button
                type="button"
                onClick={() => select(th.id)}
                aria-pressed={active}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
                  active
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-border text-muted-foreground hover:bg-muted',
                )}
              >
                <span className="truncate">{th.name}</span>
                {th.license === 'commercial' ? (
                  <Badge variant="secondary" className="shrink-0">
                    {t('Premium')}
                  </Badge>
                ) : active ? (
                  <Check className="size-3.5 shrink-0 text-primary" />
                ) : null}
              </button>
              {!BUNDLED_IDS.has(th.id) && (
                <button
                  type="button"
                  onClick={() => remove(th.id)}
                  aria-label={t('Remove theme')}
                  className="absolute -top-1.5 -right-1.5 rounded-full border bg-background p-0.5 text-muted-foreground shadow-sm hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload className="size-3.5" /> {t('Import theme')}
        </Button>
        <a
          href="https://justjson.dev/themes"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {t('Browse premium themes →')}
        </a>
      </div>
      <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={onFile} />
    </Field>
  )
}

export function Theme({ schema }: { schema: Schema }): JSX.Element {
  const [theme, setTheme] = useState<SiteTheme | null>(null)
  const [saved, setSaved] = useState<SiteTheme | null>(null)
  const [saving, setSaving] = useState(false)
  const [selectedId, setSelectedId] = useState<string>(() => getSelectedThemeId())

  useEffect(() => {
    let alive = true
    api
      .getTheme()
      .then((loaded) => {
        if (!alive) return
        setTheme(loaded)
        setSaved(loaded)
      })
      .catch((e) => toast.error((e as Error).message))
    return () => {
      alive = false
    }
  }, [])

  const patch = useCallback((next: Partial<SiteTheme>) => {
    setTheme((prev) => (prev ? { ...prev, ...next } : prev))
  }, [])

  const selectTheme = useCallback((id: string) => {
    setSelectedThemeId(id)
    setSelectedId(id)
  }, [])

  const tokens = useMemo(
    () => tokensFor(allThemes().find((b) => b.id === selectedId)),
    [selectedId],
  )
  const dirty = theme !== null && saved !== null && !sameTheme(theme, saved)

  const save = async () => {
    if (!theme) return
    setSaving(true)
    try {
      const stored = await api.putTheme(theme)
      setSaved(stored)
      setTheme(stored)
      toast.success(t('Theme saved.'))
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageShell>
      <PageHeader
        title={t('Theme')}
        subtitle={t('Style your generated site. Changes preview live and save to _theme.json.')}
        actions={
          <div className="flex items-center gap-3">
            {dirty && <span className="text-xs text-muted-foreground">{t('Unsaved changes')}</span>}
            <Button onClick={save} disabled={!theme || saving || !dirty}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />}
              {t('Save theme')}
            </Button>
          </div>
        }
      />
      <PageBody>
        {theme === null ? (
          <div className="flex h-full items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : (
          <div className="grid gap-6 px-4 py-6 sm:px-8 lg:grid-cols-[380px_minmax(0,1fr)]">
            <div className="space-y-6">
              <ThemePicker selected={selectedId} onSelect={selectTheme} />

              {!tokens.has('palette') && !tokens.has('font') && (
                <p className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  {t('This theme ships a finished design — tune the accent to match your brand.')}
                </p>
              )}

              {tokens.has('palette') && (
                <Field label={t('Palette')}>
                  <div className="grid grid-cols-5 gap-2">
                    {PALETTES.map((p) => {
                      const active = p.id === theme.palette
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => patch({ palette: p.id })}
                          aria-pressed={active}
                          title={p.label}
                          className={cn(
                            'flex flex-col items-stretch overflow-hidden rounded-lg border text-left outline-none transition-shadow focus-visible:ring-3 focus-visible:ring-ring/50',
                            active
                              ? 'ring-2 ring-ring ring-offset-2 ring-offset-background'
                              : 'hover:border-foreground/30',
                          )}
                          style={{ borderColor: p.border }}
                        >
                          <span
                            className="flex h-11 items-center justify-center text-sm font-semibold"
                            style={{ backgroundColor: p.bg, color: p.text }}
                          >
                            Aa
                          </span>
                          <span
                            className="border-t px-1 py-1 text-center text-[10px] text-muted-foreground"
                            style={{ borderColor: p.border, backgroundColor: p.bg, color: p.muted }}
                          >
                            {p.label}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </Field>
              )}

              {tokens.has('accent') && (
                <Field label={t('Accent')}>
                  <ColorInput value={theme.accent} onChange={(accent) => patch({ accent })} />
                </Field>
              )}

              {tokens.has('font') && (
                <Field label={t('Font')}>
                  <div className="grid grid-cols-2 gap-2">
                    {THEME_FONTS.map((f) => {
                      const active = f.id === theme.font
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => patch({ font: f.id })}
                          aria-pressed={active}
                          style={{ fontFamily: f.stack }}
                          className={cn(
                            'flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
                            active
                              ? 'border-primary bg-primary/5 text-foreground'
                              : 'border-border text-muted-foreground hover:bg-muted',
                          )}
                        >
                          <span>{f.label}</span>
                          {active && <Check className="size-3.5 shrink-0 text-primary" />}
                        </button>
                      )
                    })}
                  </div>
                </Field>
              )}

              {tokens.has('radius') && (
                <Field label={t('Corners: {n}px', { n: theme.radius })}>
                  <Slider
                    min={0}
                    max={24}
                    step={1}
                    value={[theme.radius]}
                    onValueChange={([v]) => patch({ radius: v })}
                    aria-label={t('Corner radius in pixels')}
                    className="w-full"
                  />
                </Field>
              )}

              {tokens.has('density') && (
                <Field label={t('Density')}>
                  <div className="grid grid-cols-3 gap-2">
                    {DENSITIES.map((d) => {
                      const active = d.id === theme.density
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => patch({ density: d.id })}
                          aria-pressed={active}
                          className={cn(
                            'rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
                            active
                              ? 'border-primary bg-primary/5 text-foreground'
                              : 'border-border text-muted-foreground hover:bg-muted',
                          )}
                        >
                          {t(d.label)}
                        </button>
                      )
                    })}
                  </div>
                </Field>
              )}
            </div>

            <div className="min-w-0 lg:sticky lg:top-6 lg:self-start">
              <p className="mb-2 text-xs font-medium text-muted-foreground">{t('Live preview')}</p>
              <DesignPreview schema={schema} theme={theme} bundleId={selectedId} />
            </div>
          </div>
        )}
      </PageBody>
    </PageShell>
  )
}

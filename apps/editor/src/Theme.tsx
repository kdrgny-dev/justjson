import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { PALETTES, type Theme as SiteTheme, THEME_FONTS, themeCss } from '@justjson/core'
import { Check, Loader2, Save } from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { toast } from 'sonner'
import * as api from './api'
import { PageBody, PageHeader, PageShell } from './components/PageShell'
import { t } from './i18n'

const HEX = /^#[0-9a-f]{6}$/i
const PREVIEW_CLASS = 'jj-preview'

const DENSITIES: { id: SiteTheme['density']; label: string }[] = [
  { id: 'tight', label: 'Tight' },
  { id: 'normal', label: 'Cozy' },
  { id: 'roomy', label: 'Roomy' },
]

function sameTheme(a: SiteTheme, b: SiteTheme): boolean {
  return (
    a.palette === b.palette &&
    a.accent === b.accent &&
    a.font === b.font &&
    a.radius === b.radius &&
    a.density === b.density
  )
}

// themeCss yazdığı :root bloğu editörün kendisini boyamasın diye önizleme
// kapsayıcısının sınıfına daraltılır.
function scopedThemeCss(theme: SiteTheme): string {
  return themeCss(theme).replace(':root {', `.${PREVIEW_CLASS} {`)
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

function PreviewSample() {
  return (
    <>
      <h1>{t('The Quiet Ledger')}</h1>
      <p className="lead">
        {t(
          'A small journal of things worth keeping. This is exactly how your generated site renders — same colors, type, spacing and corners.',
        )}
      </p>

      <h2>{t('Recent entries')}</h2>
      <ul>
        <li>
          <a href="#preview">{t('On keeping notes in plain files')}</a>
          <div>
            <time>2026-03-04</time>
          </div>
        </li>
        <li>
          <a href="#preview">{t('A field guide to small tools')}</a>
          <div>
            <time>2026-02-19</time>
          </div>
        </li>
        <li>
          <a href="#preview">{t('Why JSON, and nothing more')}</a>
          <div>
            <time>2026-01-28</time>
          </div>
        </li>
      </ul>

      <p>
        {t('Built from')} <code>content/_theme.json</code>.{' '}
        <a href="#preview">{t('Read the latest')}</a>
      </p>

      <span className="btn">{t('Subscribe')}</span>
    </>
  )
}

export function Theme(): JSX.Element {
  const [theme, setTheme] = useState<SiteTheme | null>(null)
  const [saved, setSaved] = useState<SiteTheme | null>(null)
  const [saving, setSaving] = useState(false)
  const styleId = useId()

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

  const css = useMemo(() => (theme ? scopedThemeCss(theme) : ''), [theme])
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
          <div className="grid gap-6 px-8 py-6 lg:grid-cols-[380px_minmax(0,1fr)]">
            <div className="space-y-6">
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

              <Field label={t('Accent')}>
                <ColorInput value={theme.accent} onChange={(accent) => patch({ accent })} />
              </Field>

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

              <Field label={t('Corners: {n}px', { n: theme.radius })}>
                <input
                  type="range"
                  min={0}
                  max={24}
                  step={1}
                  value={theme.radius}
                  onChange={(e) => patch({ radius: Number(e.target.value) })}
                  aria-label={t('Corner radius in pixels')}
                  className="w-full accent-primary"
                />
              </Field>

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
            </div>

            <div className="min-w-0">
              <p className="mb-2 text-xs font-medium text-muted-foreground">{t('Live preview')}</p>
              <style id={styleId}>{`${css}\n${PREVIEW_STYLES}`}</style>
              <div className="overflow-hidden rounded-xl border shadow-sm">
                <div className={cn(PREVIEW_CLASS, 'overflow-x-auto')}>
                  <div className="jj-page">
                    <PreviewSample />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </PageBody>
    </PageShell>
  )
}

// Üretilen sitenin (scaffold) eleman stilleri, önizleme sınıfına kapsanmış hali.
const PREVIEW_STYLES = `
.${PREVIEW_CLASS} {
  background: var(--jj-bg);
  color: var(--jj-text);
  font-family: var(--jj-font);
  line-height: var(--jj-lead);
}
.${PREVIEW_CLASS} .jj-page {
  max-width: 44rem;
  margin: 0 auto;
  padding: var(--jj-page) 1.25rem;
  font-size: 16px;
}
.${PREVIEW_CLASS} h1 { font-size: 1.9rem; line-height: 1.2; margin: 0 0 0.35rem; }
.${PREVIEW_CLASS} h2 {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--jj-muted);
  margin: calc(var(--jj-page) * 0.8) 0 var(--jj-gap);
}
.${PREVIEW_CLASS} p { margin: 0 0 var(--jj-gap); }
.${PREVIEW_CLASS} .lead { margin-bottom: var(--jj-page); }
.${PREVIEW_CLASS} ul { list-style: none; margin: 0 0 var(--jj-gap); padding: 0; }
.${PREVIEW_CLASS} li + li { margin-top: var(--jj-gap); }
.${PREVIEW_CLASS} a { color: var(--jj-accent); text-decoration: none; }
.${PREVIEW_CLASS} a:hover { text-decoration: underline; }
.${PREVIEW_CLASS} time { color: var(--jj-muted); font-size: 0.9rem; }
.${PREVIEW_CLASS} code {
  background: color-mix(in oklab, var(--jj-text) 8%, transparent);
  padding: 0.1em 0.35em;
  border-radius: calc(var(--jj-radius) / 2);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.${PREVIEW_CLASS} .btn {
  display: inline-block;
  margin-top: var(--jj-gap);
  padding: 0.5em 1em;
  background: var(--jj-accent);
  color: var(--jj-bg);
  border-radius: var(--jj-radius);
  font-size: 0.9rem;
  font-weight: 600;
}
@media (prefers-reduced-motion: reduce) {
  .${PREVIEW_CLASS} * { transition: none !important; }
}
`

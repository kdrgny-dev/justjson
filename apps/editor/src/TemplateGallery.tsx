import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { AlertCircle, Braces, Loader2, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAiSettings } from './ai/AiSettingsContext'
import * as api from './api'
import type { TemplateMeta } from './api'
import { StartOptions } from './components/StartOptions'
import { TemplateCarousel } from './components/TemplateCarousel'
import { getLang, t } from './i18n'

const LABEL_LANGUAGE: Record<string, string> = { en: 'English', tr: 'Turkish' }

function schemaSystemPrompt(): string {
  return [
    'You are designing a content schema for a headless CMS.',
    'Return ONLY valid JSON — no explanation, markdown code fence or other text.',
    'Follow this shape exactly:',
    '{"version":1,"collections":[{"name":"plural-id","label":"Display name","path":"same-id","fields":[{"key":"field_key","label":"Display name","type":"text|richtext|number|boolean|date|select|relation|image|url|email|list|color","required":true}]}],"singletons":[{"name":"id","label":"Display name","path":"name.json","fields":[...]}]}',
    'Pick field types sensibly from what the user describes: richtext for long or formatted text, date for dates, select for a fixed set of options (add an "options" array), image for pictures, url for links, email for addresses, list for free-text tags, color for colors, and relation for a link to another collection (put the target collection\'s name in "to").',
    'Produce at least one collection. Give every collection an identifying field like title or slug.',
    `Keep name and key values in English, kebab/snake-case and short. Write label values in ${LABEL_LANGUAGE[getLang()] ?? 'English'}.`,
  ].join(' ')
}

function stripCodeFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim()
}

function AiScaffoldPanel({ onApplied, disabled }: { onApplied: () => void; disabled: boolean }) {
  const { config, openSettings } = useAiSettings()
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = async () => {
    if (!config) {
      openSettings()
      return
    }
    if (!prompt.trim()) return
    setError(null)
    setBusy(true)
    try {
      const raw = await api.aiGenerate(config, schemaSystemPrompt(), prompt.trim())
      let schema: unknown
      try {
        schema = JSON.parse(stripCodeFence(raw))
      } catch {
        throw new Error(t('The AI did not return valid JSON — try again.'))
      }
      await api.importProject(schema)
      onApplied()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="mb-8 rounded-2xl border border-primary/30 bg-accent/40 p-6 sm:p-8">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <Sparkles className="size-4" /> {t('Generate with AI')}
        </div>
        <button
          type="button"
          onClick={openSettings}
          className="text-xs text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
        >
          {config ? t('AI settings') : t('Connect a provider')}
        </button>
      </div>
      <h2 className="mt-2 font-heading text-lg font-semibold text-foreground sm:text-xl">
        {t('Describe what you want to manage and let it design the schema')}
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {t(
          'Runs on your own API key — entirely optional, nothing reaches us. It only creates collections and fields; the content is yours to write.',
        )}
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start">
        <Textarea
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value)
            if (error) setError(null)
          }}
          disabled={busy || disabled}
          rows={2}
          placeholder={t(
            'e.g. "a blog where I share recipes, with category, difficulty and cooking time"',
          )}
          className="min-h-0 flex-1 resize-none bg-card"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void generate()
          }}
        />
        <Button
          onClick={generate}
          disabled={busy || disabled || !prompt.trim()}
          className="shrink-0 sm:mt-0"
        >
          {busy ? (
            <>
              <Loader2 className="animate-spin" /> {t('Generating…')}
            </>
          ) : (
            <>
              <Sparkles /> {t('Generate schema')}
            </>
          )}
        </Button>
      </div>

      {!config && (
        <p className="mt-3 text-xs text-muted-foreground">
          {t('No AI provider connected yet — the settings open when you press the button.')}
        </p>
      )}

      {error && (
        <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}
    </div>
  )
}

const FRAMEWORK_LABEL: Record<string, string> = {
  astro: 'Astro',
  next: 'Next.js',
  nuxt: 'Nuxt',
  sveltekit: 'SvelteKit',
  vite: 'Vite',
}

function DetectedLine() {
  const [detected, setDetected] = useState<{ project: string; framework: string } | null>(null)

  useEffect(() => {
    Promise.all([api.getProject(), api.getShip()])
      .then(([project, ship]) =>
        setDetected({ project: project.name, framework: FRAMEWORK_LABEL[ship.framework] ?? '' }),
      )
      .catch(() => setDetected(null))
  }, [])

  if (!detected) return null
  return (
    <p className="mb-5 text-sm text-muted-foreground">
      {detected.framework
        ? t('{framework} project detected', { framework: detected.framework })
        : t('Project')}
      {' · '}
      <span className="font-mono text-foreground/80">{detected.project}</span>
    </p>
  )
}

export function TemplateGallery({
  onApplied,
  onScratch,
}: {
  onApplied: () => void
  onScratch: () => void
}) {
  const [templates, setTemplates] = useState<TemplateMeta[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [applying, setApplying] = useState<string | null>(null)

  useEffect(() => {
    api
      .listTemplates()
      .then(setTemplates)
      .catch(() => setError(t('Could not load the template list.')))
  }, [])

  const apply = async (id: string) => {
    setError(null)
    setApplying(id)
    try {
      await api.applyTemplate(id)
      onApplied()
    } catch (e) {
      setError((e as Error).message)
      setApplying(null)
    }
  }

  const busy = applying !== null

  return (
    <div className="h-full overflow-y-auto bg-muted/30">
      <div className="mx-auto max-w-5xl px-6 py-12 sm:px-8">
        <header className="mb-8 max-w-2xl">
          <div className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Braces className="size-3.5" />
            </span>
            JustJSON
          </div>
          <DetectedLine />
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {t('Pick a template')}
          </h1>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            {t(
              'Edit your content visually; everything stays in your folder as plain JSON — no server, no account.',
            )}
          </p>
        </header>

        {error && (
          <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <TemplateCarousel templates={templates} applying={applying} onPick={apply} />

        <StartOptions onImported={onApplied} onScratch={onScratch} disabled={busy} />
      </div>
    </div>
  )
}

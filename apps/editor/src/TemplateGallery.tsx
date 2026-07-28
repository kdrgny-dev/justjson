import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  AlertCircle,
  BookOpen,
  Braces,
  CalendarDays,
  ChefHat,
  FileJson,
  FileStack,
  FileText,
  History,
  LayoutGrid,
  Loader2,
  Newspaper,
  PenLine,
  Rows3,
  ShoppingBag,
  Sparkles,
  Upload,
  User,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAiSettings } from './ai/AiSettingsContext'
import * as api from './api'
import type { TemplateMeta } from './api'
import { getLang, t, tp } from './i18n'

const ICONS: Record<string, LucideIcon> = {
  blog: Newspaper,
  cv: User,
  portfolio: LayoutGrid,
  docs: BookOpen,
  changelog: History,
  recipe: ChefHat,
  event: CalendarDays,
  catalog: ShoppingBag,
}

function structureSummary(tpl: TemplateMeta) {
  const parts: string[] = []
  if (tpl.collections.length)
    parts.push(tp(tpl.collections.length, '{n} collection', '{n} collections'))
  if (tpl.singletons.length)
    parts.push(tp(tpl.singletons.length, '{n} singleton', '{n} singletons'))
  return parts.join(' · ')
}

function SkeletonCard() {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="size-10 shrink-0 animate-pulse rounded-lg bg-muted" />
          <div className="h-4 w-28 animate-pulse rounded bg-muted" />
        </div>
        <div className="mt-2 h-3 w-full animate-pulse rounded bg-muted" />
        <div className="mt-1.5 h-3 w-2/3 animate-pulse rounded bg-muted" />
      </CardHeader>
      <CardContent className="flex-1 space-y-1.5">
        <div className="h-8 animate-pulse rounded-md bg-muted" />
        <div className="h-8 animate-pulse rounded-md bg-muted" />
      </CardContent>
      <CardFooter>
        <div className="h-9 w-full animate-pulse rounded-lg bg-muted" />
      </CardFooter>
    </Card>
  )
}

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

function ImportCard({ onApplied, disabled }: { onApplied: () => void; disabled: boolean }) {
  const [open, setOpen] = useState(false)
  const [raw, setRaw] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    try {
      setRaw(await file.text())
    } catch {
      setError(t('Could not read the file.'))
    }
  }

  const runImport = async () => {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      setError(t('Invalid JSON'))
      return
    }
    const schema =
      parsed && typeof parsed === 'object' && 'schema' in parsed
        ? (parsed as { schema: unknown }).schema
        : parsed
    setError(null)
    setImporting(true)
    try {
      await api.importProject(schema)
      setOpen(false)
      onApplied()
    } catch (e) {
      setError((e as Error).message)
      setImporting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next && !importing) {
          setRaw('')
          setError(null)
        }
      }}
    >
      <Card
        className="h-full border border-dashed border-border bg-transparent ring-0 transition-colors hover:border-foreground/25 data-[busy=true]:opacity-60"
        data-busy={disabled}
      >
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <FileJson className="size-5" />
            </span>
            <CardTitle className="text-base">{t('Import — your own JSON')}</CardTitle>
          </div>
          <CardDescription className="mt-2 leading-relaxed">
            {t(
              'Bring the JSON you already have; JustJSON infers the structure and sets your project up.',
            )}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex-1">
          <div className="flex h-full items-center rounded-md border border-dashed border-border/70 px-3 py-4 text-sm text-muted-foreground">
            {t('Your content JSON, or an existing')}
            <code className="mx-1 font-mono text-xs text-foreground">_schema.json</code>
            {t('— the structure is inferred automatically.')}
          </div>
        </CardContent>

        <CardFooter>
          <DialogTrigger asChild>
            <Button variant="outline" className="h-9 w-full" disabled={disabled}>
              {t('Import your own JSON')}
            </Button>
          </DialogTrigger>
        </CardFooter>
      </Card>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('Import your own JSON')}</DialogTitle>
          <DialogDescription>
            {t('Paste or pick your content JSON, or an existing')}{' '}
            <code className="font-mono text-xs">_schema.json</code>{' '}
            {t('— JustJSON works out the collections and singletons for you.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-foreground">JSON</span>
            <label
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'cursor-pointer',
                importing && 'pointer-events-none opacity-50',
              )}
            >
              <Upload />
              {t('Choose a file')}
              <input
                type="file"
                accept=".json,application/json"
                className="sr-only"
                disabled={importing}
                onChange={handleFile}
              />
            </label>
          </div>

          <Textarea
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value)
              if (error) setError(null)
            }}
            disabled={importing}
            spellCheck={false}
            rows={10}
            placeholder='{ "collections": { ... }, "singletons": { ... } }'
            className="max-h-72 resize-y font-mono text-xs leading-relaxed"
          />

          {error && (
            <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span className="break-words">{error}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" disabled={importing}>
              {t('Cancel')}
            </Button>
          </DialogClose>
          <Button disabled={importing || !raw.trim()} onClick={runImport}>
            {importing ? (
              <>
                <Loader2 className="animate-spin" />
                {t('Importing…')}
              </>
            ) : (
              t('Import')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
        <header className="mb-9 max-w-2xl">
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
          <p className="mt-1.5 text-sm text-muted-foreground">
            {t(
              'The template you pick creates your schema and content files — you can change all of it later.',
            )}
          </p>
        </header>

        {error && (
          <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <AiScaffoldPanel onApplied={onApplied} disabled={busy} />

        <div className="mb-5 flex items-center gap-3 text-xs font-medium text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          {t('or start from a template')}
          <span className="h-px flex-1 bg-border" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates === null && !error && [0, 1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}

          {templates?.map((tpl) => {
            const Icon = ICONS[tpl.id] ?? FileStack
            const active = applying === tpl.id
            return (
              <Card
                key={tpl.id}
                className="h-full transition-shadow hover:shadow-md data-[busy=true]:opacity-60"
                data-busy={busy && !active}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                      <Icon className="size-5" />
                    </span>
                    <CardTitle className="text-base">{tpl.title}</CardTitle>
                  </div>
                  <CardDescription className="mt-2 leading-relaxed">
                    {tpl.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex-1">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      {t('What it creates')}
                    </span>
                    <span className="text-xs text-muted-foreground/80">
                      {structureSummary(tpl)}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {tpl.collections.map((c) => (
                      <div
                        key={c.label}
                        className="flex items-center gap-2 rounded-md bg-muted/60 px-2.5 py-1.5"
                      >
                        <Rows3 className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate text-sm font-medium text-foreground">
                          {c.label}
                        </span>
                        <Badge variant="secondary" className="ml-auto shrink-0 font-normal">
                          {tp(c.fields, '{n} field', '{n} fields')}
                        </Badge>
                      </div>
                    ))}
                    {tpl.singletons.map((s) => (
                      <div
                        key={s.label}
                        className="flex items-center gap-2 rounded-md bg-muted/60 px-2.5 py-1.5"
                      >
                        <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate text-sm font-medium text-foreground">
                          {s.label}
                        </span>
                        <Badge variant="outline" className="ml-auto shrink-0 font-normal">
                          {t('singleton')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>

                <CardFooter>
                  <Button className="h-9 w-full" disabled={busy} onClick={() => apply(tpl.id)}>
                    {active ? (
                      <>
                        <Loader2 className="animate-spin" />
                        {t('Applying…')}
                      </>
                    ) : (
                      t('Use this template')
                    )}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}

          <Card
            className="h-full border border-dashed border-border bg-transparent ring-0 transition-colors hover:border-foreground/25 data-[busy=true]:opacity-60"
            data-busy={busy}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <PenLine className="size-5" />
                </span>
                <CardTitle className="text-base">{t('Start from scratch')}</CardTitle>
              </div>
              <CardDescription className="mt-2 leading-relaxed">
                {t('Begin with an empty schema and define your own collections and fields.')}
              </CardDescription>
            </CardHeader>

            <CardContent className="flex-1">
              <div className="flex h-full items-center rounded-md border border-dashed border-border/70 px-3 py-4 text-sm text-muted-foreground">
                {t('Nothing here yet — you build the structure from the ground up.')}
              </div>
            </CardContent>

            <CardFooter>
              <Button variant="outline" className="h-9 w-full" disabled={busy} onClick={onScratch}>
                {t('Continue with an empty project')}
              </Button>
            </CardFooter>
          </Card>

          <ImportCard onApplied={onApplied} disabled={busy} />
        </div>
      </div>
    </div>
  )
}

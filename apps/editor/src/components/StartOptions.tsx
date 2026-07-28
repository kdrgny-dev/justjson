import { Button, buttonVariants } from '@/components/ui/button'
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
import { AlertCircle, ArrowRight, Loader2, Upload } from 'lucide-react'
import { useState } from 'react'
import * as api from '../api'
import { t } from '../i18n'

function isJsonFile(file: File): boolean {
  return file.type === 'application/json' || file.name.toLowerCase().endsWith('.json')
}

function ScratchOption({ onScratch, disabled }: { onScratch: () => void; disabled: boolean }) {
  return (
    <div
      data-busy={disabled}
      className="flex flex-col items-start justify-center gap-2 border-l border-border py-2 pl-5 data-[busy=true]:opacity-60"
    >
      <h3 className="font-heading text-sm font-semibold text-foreground">
        {t('Start from scratch')}
      </h3>
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        {t('Begin with an empty schema and define your own collections and fields.')}
      </p>
      <Button
        variant="link"
        size="sm"
        disabled={disabled}
        onClick={onScratch}
        className="h-auto px-0"
      >
        {t('Continue with an empty project')}
        <ArrowRight />
      </Button>
    </div>
  )
}

function ImportOption({ onImported, disabled }: { onImported: () => void; disabled: boolean }) {
  const [open, setOpen] = useState(false)
  const [raw, setRaw] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [dropError, setDropError] = useState<string | null>(null)

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

  // A dropped file only pre-fills the dialog; the user still confirms the import.
  const previewDroppedFile = async (file: File) => {
    if (!isJsonFile(file)) {
      setDropError(t('That file is not JSON — drop a .json file instead.'))
      return
    }
    setDropError(null)
    try {
      const text = await file.text()
      setRaw(text)
      setError(null)
      setOpen(true)
    } catch {
      setDropError(t('Could not read the file.'))
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
      onImported()
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
      <div
        data-busy={disabled}
        data-dragging={dragging}
        onDragOver={(e) => {
          if (disabled) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
          setDragging(true)
        }}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
          setDragging(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (disabled) return
          const file = e.dataTransfer.files.item(0)
          if (file) void previewDroppedFile(file)
        }}
        className={cn(
          'group flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/40 px-5 py-7 text-center',
          'transition-colors motion-reduce:transition-none',
          'data-[dragging=true]:border-primary data-[dragging=true]:bg-accent',
          'data-[busy=true]:opacity-60',
        )}
      >
        <span className="flex size-11 items-center justify-center rounded-full border border-dashed border-border bg-card text-muted-foreground transition-colors motion-reduce:transition-none group-data-[dragging=true]:border-primary group-data-[dragging=true]:text-primary">
          <Upload className="size-5" />
        </span>

        <div className="flex flex-col items-center gap-1">
          <h3 className="font-heading text-sm font-semibold text-foreground">
            {t('Import your own JSON')}
          </h3>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            {dragging ? t('Release to read this file') : t('Drop a JSON file here, or')}
          </p>
        </div>

        <DialogTrigger asChild>
          <Button variant="outline" size="lg" disabled={disabled}>
            {t('Browse files')}
          </Button>
        </DialogTrigger>

        {dropError && <output className="text-xs text-destructive">{dropError}</output>}
      </div>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('Import your own JSON')}</DialogTitle>
          <DialogDescription>
            {t(
              'Paste your content JSON or choose a file, and JustJSON works out the collections and singletons for you.',
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {t('An exported schema file works too:')}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
              _schema.json
            </code>
          </p>

          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-foreground">JSON</span>
            <label
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'cursor-pointer focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50',
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

export function StartOptions({
  onImported,
  onScratch,
  disabled,
}: {
  onImported: () => void
  onScratch: () => void
  disabled: boolean
}) {
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="font-heading text-xs font-medium tracking-wide text-muted-foreground">
          {t('Or start on your own')}
        </h2>
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-[1.25fr_1fr]">
        <ImportOption onImported={onImported} disabled={disabled} />
        <ScratchOption onScratch={onScratch} disabled={disabled} />
      </div>
    </section>
  )
}

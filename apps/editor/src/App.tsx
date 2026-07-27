import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Toaster } from '@/components/ui/sonner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { slugify, validateEntry } from '@justjson/core'
import type { Collection, Field, Schema, Singleton } from '@justjson/core'
import {
  AlertTriangle,
  Boxes,
  Braces,
  ChevronRight,
  ChevronsUpDown,
  Copy,
  Download,
  FileCog,
  FolderGit2,
  Image as ImageIcon,
  Link2,
  PencilRuler,
  Plus,
  RotateCcw,
  Search,
  SearchX,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { RichText } from './RichText'
import { SchemaBuilder } from './SchemaBuilder'
import { TemplateGallery } from './TemplateGallery'
import { AIAssist } from './ai/AIAssist'
import { AiSettingsProvider, useAiSettings } from './ai/AiSettingsContext'
import * as api from './api'
import {
  PageBody,
  PageHeader,
  PagePane,
  PageShell,
  PathChip,
  Surface,
  SurfaceEmpty,
} from './components/PageShell'
import { SKELETON_KEYS, Skeleton } from './components/Skeleton'
import { FIELD_META } from './field-types'

type Selection =
  | { kind: 'schema' }
  | { kind: 'json' }
  | { kind: 'collection'; name: string }
  | { kind: 'entry'; collection: string; slug: string }
  | { kind: 'newEntry'; collection: string }
  | { kind: 'singleton'; name: string }

export function App() {
  return (
    <TooltipProvider delayDuration={300}>
      <AiSettingsProvider>
        <AppShell />
      </AiSettingsProvider>
      <Toaster position="bottom-right" />
    </TooltipProvider>
  )
}

function AppShell() {
  const [schema, setSchema] = useState<Schema | null>(null)
  const [project, setProject] = useState<api.ProjectInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [gallery, setGallery] = useState(false)
  const [addSeq, setAddSeq] = useState(0)
  const [addKind, setAddKind] = useState<'collection' | 'singleton' | null>(null)

  const reload = useCallback(async () => {
    const s = await api.getSchema()
    setSchema(s)
    return s
  }, [])

  const openSchema = useCallback((add?: 'collection' | 'singleton') => {
    if (add) {
      setAddKind(add)
      setAddSeq((n) => n + 1)
    }
    setSelection({ kind: 'schema' })
  }, [])

  useEffect(() => {
    api
      .getSchema()
      .then((s) => {
        setSchema(s)
        if (s.collections.length === 0 && s.singletons.length === 0) {
          setGallery(true)
        }
      })
      .catch(() => setError('Şema yüklenemedi. `justjson serve` çalışıyor mu?'))
  }, [])

  useEffect(() => {
    api
      .getProject()
      .then(setProject)
      .catch(() => {})
  }, [])

  if (error) return <Centered>{error}</Centered>
  if (!schema) return <Centered>Yükleniyor…</Centered>

  if (gallery) {
    return (
      <TemplateGallery
        onApplied={async () => {
          const s = await reload()
          setGallery(false)
          setSelection(
            s.collections[0]
              ? { kind: 'collection', name: s.collections[0].name }
              : { kind: 'schema' },
          )
        }}
        onScratch={() => {
          setGallery(false)
          setSelection({ kind: 'schema' })
        }}
      />
    )
  }

  const schemaEmpty = schema.collections.length === 0 && schema.singletons.length === 0

  const exportProject = () => {
    api.downloadExport()
    toast.success('Dışa aktarma indiriliyor')
  }

  const resetSchema = async () => {
    await api.putSchema({ version: 1, collections: [], singletons: [] })
    await reload()
    setSelection(null)
    setGallery(true)
    toast.success('Şema sıfırlandı')
  }

  return (
    <div className="flex h-full bg-background">
      <Sidebar
        project={project}
        schema={schema}
        selection={selection}
        onSelect={setSelection}
        onOpenSchema={openSchema}
        onExport={exportProject}
        onReset={resetSchema}
      />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-muted/30">
        <ContextBar project={project} crumbs={crumbsFor(schema, selection, setSelection)} />
        <div className="min-h-0 flex-1 overflow-hidden">
          <MainArea
            schema={schema}
            selection={selection}
            onSelect={setSelection}
            onReload={reload}
            onOpenSchema={openSchema}
            addSeq={addSeq}
            addKind={addKind}
            onBrowseTemplates={schemaEmpty ? () => setGallery(true) : undefined}
          />
        </div>
      </main>
    </div>
  )
}

type Crumb = { label: string; tag?: string; onClick?: () => void }

function crumbsFor(
  schema: Schema,
  selection: Selection | null,
  onSelect: (s: Selection) => void,
): Crumb[] {
  if (!selection) return []
  if (selection.kind === 'schema') return [{ label: 'Şema' }]
  if (selection.kind === 'json') return [{ label: 'Ham JSON' }]
  if (selection.kind === 'collection') {
    const col = schema.collections.find((c) => c.name === selection.name)
    return [{ label: col?.label ?? selection.name }]
  }
  if (selection.kind === 'entry' || selection.kind === 'newEntry') {
    const col = schema.collections.find((c) => c.name === selection.collection)
    return [
      {
        label: col?.label ?? selection.collection,
        onClick: () => onSelect({ kind: 'collection', name: selection.collection }),
      },
      selection.kind === 'entry' ? { label: selection.slug } : { label: 'Yeni kayıt' },
    ]
  }
  const s = schema.singletons.find((x) => x.name === selection.name)
  return [{ label: s?.label ?? selection.name, tag: 'tekil' }]
}

function ContextBar({ project, crumbs }: { project: api.ProjectInfo | null; crumbs: Crumb[] }) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-1 overflow-x-auto border-b bg-card px-8 text-xs">
      <span
        title={project?.path}
        className="inline-flex shrink-0 items-center gap-1.5 text-muted-foreground"
      >
        <FolderGit2 className="h-3.5 w-3.5 text-muted-foreground/70" />
        {project?.name ?? '…'}
      </span>
      {crumbs.map((c) => (
        <span key={c.label} className="inline-flex shrink-0 items-center gap-1">
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
          {c.onClick ? (
            <button
              type="button"
              onClick={c.onClick}
              className="rounded text-muted-foreground transition-colors hover:text-primary"
            >
              {c.label}
            </button>
          ) : (
            <span className="font-medium text-foreground/80">{c.label}</span>
          )}
          {c.tag && (
            <Badge variant="secondary" className="ml-0.5 font-normal">
              {c.tag}
            </Badge>
          )}
        </span>
      ))}
    </header>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}

function Sidebar({
  project,
  schema,
  selection,
  onSelect,
  onOpenSchema,
  onExport,
  onReset,
}: {
  project: api.ProjectInfo | null
  schema: Schema
  selection: Selection | null
  onSelect: (s: Selection) => void
  onOpenSchema: (add?: 'collection' | 'singleton') => void
  onExport: () => void
  onReset: () => Promise<void>
}) {
  const collectionActive = (name: string): boolean => {
    if (!selection) return false
    if (selection.kind === 'collection') return selection.name === name
    if (selection.kind === 'entry' || selection.kind === 'newEntry')
      return selection.collection === name
    return false
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r bg-card">
      <div className="flex h-12 shrink-0 items-center border-b px-5">
        <div className="font-mono text-[15px] font-bold tracking-tight text-foreground">
          Just<span className="text-primary">JSON</span>
        </div>
      </div>
      {project && (
        <div className="px-3 pt-3">
          <ProjectMenu project={project} onExport={onExport} onReset={onReset} />
        </div>
      )}

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pt-3 pb-4">
        <SchemaNavItem active={selection?.kind === 'schema'} onClick={() => onOpenSchema()} />
        <NavItem
          icon={<Braces className="h-4 w-4" />}
          active={selection?.kind === 'json'}
          onClick={() => onSelect({ kind: 'json' })}
        >
          Ham JSON
        </NavItem>

        <NavSection label="Koleksiyonlar" onAdd={() => onOpenSchema('collection')}>
          {schema.collections.length === 0 ? (
            <EmptyNavHint onClick={() => onOpenSchema('collection')}>Koleksiyon ekle</EmptyNavHint>
          ) : (
            schema.collections.map((c) => (
              <NavItem
                key={c.name}
                icon={<Boxes className="h-4 w-4" />}
                active={collectionActive(c.name)}
                onClick={() => onSelect({ kind: 'collection', name: c.name })}
              >
                {c.label ?? c.name}
              </NavItem>
            ))
          )}
        </NavSection>

        <NavSection label="Tekil" onAdd={() => onOpenSchema('singleton')}>
          {schema.singletons.length === 0 ? (
            <EmptyNavHint onClick={() => onOpenSchema('singleton')}>Tekil ekle</EmptyNavHint>
          ) : (
            schema.singletons.map((s) => (
              <NavItem
                key={s.name}
                icon={<FileCog className="h-4 w-4" />}
                active={selection?.kind === 'singleton' && selection.name === s.name}
                onClick={() => onSelect({ kind: 'singleton', name: s.name })}
              >
                {s.label ?? s.name}
              </NavItem>
            ))
          )}
        </NavSection>
      </nav>
    </aside>
  )
}

function ProjectMenu({
  project,
  onExport,
  onReset,
}: {
  project: api.ProjectInfo
  onExport: () => void
  onReset: () => Promise<void>
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const { config: aiConfig, openSettings: openAiSettings } = useAiSettings()

  const confirmReset = async () => {
    setResetting(true)
    try {
      await onReset()
      setConfirmOpen(false)
    } finally {
      setResetting(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title={project.path}
            className="flex w-full max-w-full items-center gap-1.5 rounded-lg border bg-muted/50 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <FolderGit2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
            <span className="truncate">{project.name}</span>
            <ChevronsUpDown className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="truncate">{project.name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onExport}>
            <Download />
            Dışa aktar (.zip)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={openAiSettings}>
            <Sparkles />
            AI ayarları
            {aiConfig && (
              <Badge variant="secondary" className="ml-auto font-normal">
                bağlı
              </Badge>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
            <RotateCcw />
            Baştan başla (sıfırla)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Şemayı sıfırla?</DialogTitle>
            <DialogDescription>
              İçerik dosyaların diskte kalır ama şema temizlenir, baştan şablon/JSON seçebilirsin.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Vazgeç</Button>
            </DialogClose>
            <Button variant="destructive" onClick={confirmReset} disabled={resetting}>
              {resetting ? 'Sıfırlanıyor…' : 'Sıfırla'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function SchemaNavItem({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors',
        active ? 'bg-accent text-primary' : 'text-muted-foreground hover:bg-accent/60',
      )}
    >
      <PencilRuler className="h-4 w-4 shrink-0" />
      <span className="min-w-0">
        <span className="block text-sm font-medium leading-tight">Şema</span>
        <span
          className={cn(
            'block text-xs leading-tight',
            active ? 'text-primary/70' : 'text-muted-foreground/70',
          )}
        >
          İçerik yapısı
        </span>
      </span>
    </button>
  )
}

function NavSection({
  label,
  onAdd,
  children,
}: {
  label: string
  onAdd: () => void
  children: React.ReactNode
}) {
  return (
    <div className="pt-4">
      <div className="flex items-center justify-between px-3 pb-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
          {label}
        </p>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onAdd}
              className="text-muted-foreground hover:text-primary"
            >
              <Plus />
              <span className="sr-only">{label} ekle</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{label} ekle</TooltipContent>
        </Tooltip>
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function EmptyNavHint({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground/70 transition-colors hover:bg-accent/60 hover:text-primary"
    >
      <Plus className="h-4 w-4" /> {children}
    </button>
  )
}

function NavItem({
  children,
  icon,
  active,
  onClick,
}: {
  children: React.ReactNode
  icon?: React.ReactNode
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
        active
          ? 'bg-accent font-medium text-primary'
          : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
      )}
    >
      {icon && <span className={active ? 'text-primary' : 'text-muted-foreground/70'}>{icon}</span>}
      <span className="truncate">{children}</span>
    </button>
  )
}

function MainArea({
  schema,
  selection,
  onSelect,
  onReload,
  onOpenSchema,
  addSeq,
  addKind,
  onBrowseTemplates,
}: {
  schema: Schema
  selection: Selection | null
  onSelect: (s: Selection) => void
  onReload: () => Promise<Schema>
  onOpenSchema: (add?: 'collection' | 'singleton') => void
  addSeq: number
  addKind: 'collection' | 'singleton' | null
  onBrowseTemplates?: () => void
}) {
  if (!selection)
    return (
      <EmptyState
        icon={<Boxes className="h-6 w-6" />}
        title="Soldan başla"
        hint="Bir koleksiyon ya da tekil kayıt seçerek düzenlemeye başla. Yapıyı değiştirmek istersen Şema'ya git."
        action={
          <Button onClick={() => onOpenSchema()}>
            <PencilRuler /> Şemayı aç
          </Button>
        }
      />
    )

  if (selection.kind === 'schema') {
    return (
      <SchemaBuilder
        key={addSeq}
        schema={schema}
        initialAdd={addKind ?? undefined}
        onSaved={() => void onReload()}
        onBrowseTemplates={onBrowseTemplates}
      />
    )
  }

  if (selection.kind === 'json') {
    return <ProjectJsonView schema={schema} />
  }

  if (selection.kind === 'collection') {
    const col = schema.collections.find((c) => c.name === selection.name)
    if (!col) return <Centered>Bu koleksiyon bulunamadı.</Centered>
    return (
      <CollectionView
        collection={col}
        onOpen={(slug) => onSelect({ kind: 'entry', collection: col.name, slug })}
        onNew={() => onSelect({ kind: 'newEntry', collection: col.name })}
      />
    )
  }

  if (selection.kind === 'entry' || selection.kind === 'newEntry') {
    const col = schema.collections.find((c) => c.name === selection.collection)
    if (!col) return <Centered>Bu koleksiyon bulunamadı.</Centered>
    const slug = selection.kind === 'entry' ? selection.slug : null
    return (
      <EntryEditor
        key={`${col.name}/${slug ?? 'new'}`}
        collection={col}
        slug={slug}
        onSaved={(s) => onSelect({ kind: 'entry', collection: col.name, slug: s })}
        onDeleted={() => onSelect({ kind: 'collection', name: col.name })}
      />
    )
  }

  const s = schema.singletons.find((x) => x.name === selection.name)
  if (!s) return <Centered>Bu tekil kayıt bulunamadı.</Centered>
  return <SingletonEditor key={s.name} singleton={s} />
}

function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: React.ReactNode
  title: string
  hint?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border bg-card text-muted-foreground shadow-sm">
          {icon}
        </div>
      )}
      <p className="text-base font-semibold text-foreground">{title}</p>
      {hint && <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

function FormCard({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border bg-card p-6 shadow-sm">{children}</div>
}

function highlightJson(json: string): string {
  const esc = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return esc.replace(
    /("(?:\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (m) => {
      let cls = 'jk-num'
      if (/^"/.test(m)) cls = /:\s*$/.test(m) ? 'jk-key' : 'jk-str'
      else if (m === 'true' || m === 'false') cls = 'jk-bool'
      else if (m === 'null') cls = 'jk-null'
      return `<span class="${cls}">${m}</span>`
    },
  )
}

function JsonPreview({ path, data }: { path: string; data: Record<string, unknown> }) {
  const json = useMemo(() => JSON.stringify(data, null, 2), [data])
  const empty = json === '{}'

  const copy = () => {
    if (navigator.clipboard) navigator.clipboard.writeText(json)
    toast.success('JSON kopyalandı')
  }

  return (
    <div className="overflow-hidden rounded-xl border shadow-sm">
      <div className="flex items-center gap-2 border-b bg-muted/60 px-3 py-2">
        <Braces className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="truncate font-mono text-xs text-muted-foreground">{path}</span>
        <Button
          variant="ghost"
          size="xs"
          onClick={copy}
          disabled={empty}
          className="ml-auto text-muted-foreground hover:text-primary"
        >
          <Copy /> Kopyala
        </Button>
      </div>
      {empty ? (
        <p className="jk-pre text-muted-foreground/70">Henüz alan doldurulmadı.</p>
      ) : (
        <pre className="jk-pre overflow-x-auto">
          {/* biome-ignore lint/security/noDangerouslySetInnerHtml: içerik JSON.stringify çıktısı, HTML kaçışından geçiriliyor */}
          <code dangerouslySetInnerHTML={{ __html: highlightJson(json) }} />
        </pre>
      )}
    </div>
  )
}

function EditorLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageBody>
      <div className="mx-auto max-w-3xl space-y-5 px-8 py-6">{children}</div>
    </PageBody>
  )
}

function JsonFile({
  path,
  data,
  defaultOpen,
}: {
  path: string
  data: Record<string, unknown>
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  const json = useMemo(() => JSON.stringify(data, null, 2), [data])
  return (
    <div className="overflow-hidden rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 bg-muted/50 px-3 py-2 text-left transition-colors hover:bg-muted"
      >
        <ChevronRight
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-90',
          )}
        />
        <Braces className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="truncate font-mono text-xs text-foreground/80">{path}</span>
      </button>
      {open && (
        <pre className="jk-pre overflow-x-auto border-t">
          {/* biome-ignore lint/security/noDangerouslySetInnerHtml: içerik JSON.stringify çıktısı, HTML kaçışından geçiriliyor */}
          <code dangerouslySetInnerHTML={{ __html: highlightJson(json) }} />
        </pre>
      )}
    </div>
  )
}

function ProjectJsonView({ schema }: { schema: Schema }) {
  const [files, setFiles] = useState<{ path: string; data: Record<string, unknown> }[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const out: { path: string; data: Record<string, unknown> }[] = [
          { path: '_schema.json', data: schema as unknown as Record<string, unknown> },
        ]
        for (const col of schema.collections) {
          const rows = await api.listRows(col.name)
          const entries = await Promise.all(
            rows.map((r) => api.getEntry(col.name, r.slug).then((d) => ({ slug: r.slug, d }))),
          )
          for (const e of entries) {
            if (e.d) out.push({ path: `${col.name}/${e.slug}.json`, data: e.d })
          }
        }
        for (const s of schema.singletons) {
          const d = await api.getSingleton(s.name)
          out.push({ path: `${s.name}.json`, data: d })
        }
        if (!cancelled) setFiles(out)
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [schema])

  return (
    <PageShell>
      <PageHeader
        title="Ham JSON"
        subtitle={
          files
            ? `content/ • ${files.length} dosya`
            : 'content/ klasöründeki her dosya, diske yazıldığı hâliyle'
        }
      />
      <PageBody>
        <div className="mx-auto max-w-3xl space-y-2 px-8 py-6">
          {error && <AlertPanel title="Yüklenemedi">{error}</AlertPanel>}
          {files === null && !error && (
            <p className="px-1 text-sm text-muted-foreground">Yükleniyor…</p>
          )}
          {files?.map((f, i) => (
            <JsonFile key={f.path} path={f.path} data={f.data} defaultOpen={i === 0} />
          ))}
        </div>
      </PageBody>
    </PageShell>
  )
}

function FormSkeleton() {
  return (
    <FormCard>
      <div className="space-y-6">
        {SKELETON_KEYS.slice(0, 4).map((id) => (
          <div key={id} className="space-y-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
      </div>
    </FormCard>
  )
}

function LoadFailed({ onRetry, onBack }: { onRetry: () => void; onBack?: () => void }) {
  return (
    <FormCard>
      <div className="flex flex-col items-center py-8 text-center">
        <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <AlertTriangle className="size-5" />
        </div>
        <p className="font-medium text-foreground">Kayıt yüklenemedi</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Dosya okunamadı ya da silinmiş olabilir. Boş bir formla üzerine yazmamak için düzenleme
          kapatıldı.
        </p>
        <div className="mt-4 flex items-center gap-2">
          <Button onClick={onRetry}>Tekrar dene</Button>
          {onBack && (
            <Button variant="outline" onClick={onBack}>
              Listeye dön
            </Button>
          )}
        </div>
      </div>
    </FormCard>
  )
}

function formatDate(ms: number | null): string {
  if (!ms) return '—'
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(ms))
}

function CollectionView({
  collection,
  onOpen,
  onNew,
}: {
  collection: Collection
  onOpen: (slug: string) => void
  onNew: () => void
}) {
  const [rows, setRows] = useState<api.EntryRow[] | null>(null)
  const [q, setQ] = useState('')
  useEffect(() => {
    api.listRows(collection.name).then(setRows)
  }, [collection.name])

  const query = q.trim().toLowerCase()
  const filtered = rows?.filter(
    (r) => r.title.toLowerCase().includes(query) || r.slug.includes(query),
  )
  const hasRows = !!rows && rows.length > 0

  return (
    <PageShell>
      <PageHeader
        title={collection.label ?? collection.name}
        subtitle={rows ? `${rows.length} kayıt` : 'Kayıtlar yükleniyor…'}
        actions={
          <Button onClick={onNew}>
            <Plus /> Yeni kayıt
          </Button>
        }
        toolbar={
          hasRows ? (
            <div className="flex items-center gap-3">
              <div className="relative w-full max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Başlık veya slug ara…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
                {query ? `${filtered?.length ?? 0} sonuç` : null}
              </span>
            </div>
          ) : undefined
        }
      />

      <PagePane>
        <Surface className="flex h-full flex-col [&>[data-slot=table-container]]:min-h-0 [&>[data-slot=table-container]]:flex-1">
          {rows === null && <EntryTable rows={null} onOpen={onOpen} />}

          {rows !== null && rows.length === 0 && (
            <SurfaceEmpty
              icon={<Boxes className="h-6 w-6" />}
              title="Henüz kayıt yok"
              hint="Bu koleksiyona ilk içeriği ekleyerek başla."
              action={
                <Button onClick={onNew} variant="outline">
                  <Plus /> İlk kaydı oluştur
                </Button>
              }
            />
          )}

          {hasRows && filtered?.length === 0 && (
            <SurfaceEmpty
              icon={<SearchX className="h-6 w-6" />}
              title="Eşleşen kayıt yok"
              hint={`“${q.trim()}” için sonuç bulunamadı. Aramayı değiştir ya da temizle.`}
              action={
                <Button variant="outline" onClick={() => setQ('')}>
                  Aramayı temizle
                </Button>
              }
            />
          )}

          {hasRows && filtered && filtered.length > 0 && (
            <EntryTable rows={filtered} onOpen={onOpen} />
          )}
        </Surface>
      </PagePane>
    </PageShell>
  )
}

const COL_HEAD =
  'h-9 bg-muted/50 px-4 text-xs font-medium uppercase tracking-wide text-muted-foreground'

function EntryTable({
  rows,
  onOpen,
}: { rows: api.EntryRow[] | null; onOpen: (slug: string) => void }) {
  return (
    <Table>
      <TableHeader className="sticky top-0 z-10">
        <TableRow className="hover:bg-transparent">
          <TableHead className={cn(COL_HEAD, 'w-full')}>Başlık</TableHead>
          <TableHead className={COL_HEAD}>Dosya</TableHead>
          <TableHead className={cn(COL_HEAD, 'text-right')}>Güncellendi</TableHead>
          <TableHead className={cn(COL_HEAD, 'w-10 pl-0')}>
            <span className="sr-only">Aç</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows === null
          ? SKELETON_KEYS.map((id) => (
              <TableRow key={id} className="hover:bg-transparent">
                <TableCell className="px-4 py-3">
                  <Skeleton className="h-3.5 w-48" />
                </TableCell>
                <TableCell className="px-4 py-3">
                  <Skeleton className="h-3 w-24" />
                </TableCell>
                <TableCell className="px-4 py-3">
                  <Skeleton className="ml-auto h-3 w-20" />
                </TableCell>
                <TableCell className="w-10 py-3 pl-0" />
              </TableRow>
            ))
          : rows.map((row) => (
              <TableRow
                key={row.slug}
                tabIndex={0}
                onClick={() => onOpen(row.slug)}
                onKeyDown={(e) => e.key === 'Enter' && onOpen(row.slug)}
                className="group/row cursor-pointer hover:bg-muted/40 focus:bg-accent focus:outline-none"
              >
                <TableCell className="px-4 py-3 font-medium text-foreground">{row.title}</TableCell>
                <TableCell className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {row.slug}
                </TableCell>
                <TableCell className="px-4 py-3 text-right text-xs tabular-nums text-muted-foreground">
                  {formatDate(row.updatedAt)}
                </TableCell>
                <TableCell className="w-10 py-3 pr-4 pl-0 text-right">
                  <ChevronRight className="ml-auto h-4 w-4 text-transparent transition-colors group-hover/row:text-muted-foreground/70 group-focus/row:text-muted-foreground/70" />
                  <span className="sr-only">aç</span>
                </TableCell>
              </TableRow>
            ))}
      </TableBody>
    </Table>
  )
}

// expected: kayıt diskte var olmalı. Yükleme boş/hatalı dönerse formu boş açmak
// yerine hata gösteririz — aksi halde Kaydet dosyanın üstüne boş veri yazar.
function useEntryData(load: () => Promise<api.Entry | null>, expected: boolean) {
  const [data, setData] = useState<api.Entry>({})
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const seq = useRef(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: load kimliği her renderda değişebilir; yeniden bağlanma key prop'u ve attempt ile kontrol ediliyor
  useEffect(() => {
    const mine = ++seq.current
    setLoading(true)
    setFailed(false)
    load()
      .then((d) => {
        if (mine !== seq.current) return // son istek kazanır
        if (d === null && expected) setFailed(true)
        else setData(d ?? {})
        setLoading(false)
      })
      .catch(() => {
        if (mine !== seq.current) return
        setFailed(true)
        setLoading(false)
      })
  }, [attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  return { data, setData, loading, failed, retry }
}

function EntryEditor({
  collection,
  slug,
  onSaved,
  onDeleted,
}: {
  collection: Collection
  slug: string | null
  onSaved: (slug: string) => void
  onDeleted: () => void
}) {
  const isNew = slug === null
  const load = useCallback(
    () => (isNew ? Promise.resolve<api.Entry>({}) : api.getEntry(collection.name, slug as string)),
    [collection.name, slug, isNew],
  )
  const { data, setData, loading, failed, retry } = useEntryData(load, !isNew)
  const [newSlug, setNewSlug] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showJson, setShowJson] = useState(false)

  const setField = (key: string, value: unknown) =>
    setData((prev) => {
      const next = { ...prev }
      if (value === '' || value === undefined) delete next[key]
      else next[key] = value
      return next
    })

  const result = useMemo(() => validateEntry(collection.fields, data), [data, collection.fields])
  const effectiveSlug = isNew
    ? slugify(newSlug || String(data.title ?? 'icerik'))
    : (slug as string)

  const save = async () => {
    setSaveError(null)
    setSaving(true)
    try {
      if (isNew && (await api.getEntry(collection.name, effectiveSlug))) {
        const msg = `"${effectiveSlug}" zaten var — farklı bir slug seç.`
        setSaveError(msg)
        toast.error(msg)
        return
      }
      const saved = await api.putEntry(collection.name, effectiveSlug, data)
      toast.success(`"${saved}" kaydedildi`)
      onSaved(saved)
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (isNew) return
    await api.deleteEntry(collection.name, slug as string)
    toast.success(`"${slug}" silindi`)
    onDeleted()
  }

  const title = collection.label ?? collection.name

  if (loading)
    return (
      <PageShell>
        <PageHeader title={title} subtitle={<PathChip>{`${collection.name}/…`}</PathChip>} />
        <EditorLayout>
          <FormSkeleton />
        </EditorLayout>
      </PageShell>
    )

  if (failed)
    return (
      <PageShell>
        <PageHeader
          title={title}
          subtitle={<PathChip>{`${collection.name}/${slug}.json`}</PathChip>}
        />
        <EditorLayout>
          <LoadFailed onRetry={retry} onBack={onDeleted} />
        </EditorLayout>
      </PageShell>
    )

  return (
    <PageShell>
      <PageHeader
        title={title}
        badge={
          isNew ? (
            <Badge variant="secondary" className="font-normal">
              yeni
            </Badge>
          ) : undefined
        }
        subtitle={<PathChip>{`${collection.name}/${effectiveSlug}.json`}</PathChip>}
        actions={
          <>
            <Button
              variant={showJson ? 'secondary' : 'outline'}
              onClick={() => setShowJson((v) => !v)}
            >
              <Braces /> JSON
            </Button>
            {!isNew && (
              <Button variant="destructive" onClick={remove}>
                <Trash2 /> Sil
              </Button>
            )}
            <Button onClick={save} disabled={saving || !result.ok}>
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
          </>
        }
      />
      <EditorLayout>
        {saveError && <AlertPanel title="Kaydedilemedi">{saveError}</AlertPanel>}
        {showJson && <JsonPreview path={`${collection.name}/${effectiveSlug}.json`} data={data} />}
        <FormCard>
          {isNew && (
            <div className="mb-6 rounded-lg border bg-muted/40 p-4">
              <FieldShell label="Dosya adı" hint={`${effectiveSlug}.json`}>
                <Input
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  placeholder="otomatik"
                  className="bg-card font-mono"
                />
              </FieldShell>
              <p className="mt-2 text-xs text-muted-foreground">
                Boş bırakırsan başlıktan üretilir. Kaydettikten sonra değişmez.
              </p>
            </div>
          )}
          <div className="space-y-6">
            {collection.fields.map((field) => (
              <FieldEditor
                key={field.key}
                field={field}
                value={data[field.key]}
                onChange={setField}
                context={collection.label ?? collection.name}
              />
            ))}
          </div>
        </FormCard>
        <Issues result={result} />
      </EditorLayout>
    </PageShell>
  )
}

function SingletonEditor({ singleton }: { singleton: Singleton }) {
  const load = useCallback(() => api.getSingleton(singleton.name), [singleton.name])
  // tekil dosyası henüz yoksa boş form doğrudur; sadece istek hatasında uyarırız
  const { data, setData, loading, failed, retry } = useEntryData(load, false)
  const [saving, setSaving] = useState(false)
  const [showJson, setShowJson] = useState(false)

  const setField = (key: string, value: unknown) =>
    setData((prev) => {
      const next = { ...prev }
      if (value === '' || value === undefined) delete next[key]
      else next[key] = value
      return next
    })

  const result = useMemo(() => validateEntry(singleton.fields, data), [data, singleton.fields])

  const save = async () => {
    setSaving(true)
    try {
      await api.putSingleton(singleton.name, data)
      toast.success(`${singleton.label ?? singleton.name} kaydedildi`)
    } finally {
      setSaving(false)
    }
  }

  const title = singleton.label ?? singleton.name
  const badge = (
    <Badge variant="secondary" className="font-normal">
      tekil
    </Badge>
  )

  if (loading)
    return (
      <PageShell>
        <PageHeader title={title} badge={badge} />
        <EditorLayout>
          <FormSkeleton />
        </EditorLayout>
      </PageShell>
    )

  if (failed)
    return (
      <PageShell>
        <PageHeader title={title} badge={badge} />
        <EditorLayout>
          <LoadFailed onRetry={retry} />
        </EditorLayout>
      </PageShell>
    )

  return (
    <PageShell>
      <PageHeader
        title={title}
        badge={badge}
        subtitle={<PathChip>{`${singleton.name}.json`}</PathChip>}
        actions={
          <>
            <Button
              variant={showJson ? 'secondary' : 'outline'}
              onClick={() => setShowJson((v) => !v)}
            >
              <Braces /> JSON
            </Button>
            <Button onClick={save} disabled={saving || !result.ok}>
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
          </>
        }
      />
      <EditorLayout>
        {showJson && <JsonPreview path={`${singleton.name}.json`} data={data} />}
        <FormCard>
          <div className="space-y-6">
            {singleton.fields.map((field) => (
              <FieldEditor
                key={field.key}
                field={field}
                value={data[field.key]}
                onChange={setField}
                context={singleton.label ?? singleton.name}
              />
            ))}
          </div>
        </FormCard>
        <Issues result={result} />
      </EditorLayout>
    </PageShell>
  )
}

function AlertPanel({
  title,
  tone = 'error',
  children,
}: { title: string; tone?: 'error' | 'warning'; children: React.ReactNode }) {
  const isError = tone === 'error'
  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        isError ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-muted/40',
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2 text-sm font-medium',
          isError ? 'text-destructive' : 'text-foreground',
        )}
      >
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {title}
      </div>
      <div className="mt-2.5 text-sm text-muted-foreground">{children}</div>
    </div>
  )
}

function Issues({ result }: { result: ReturnType<typeof validateEntry> }) {
  if (result.issues.length === 0) return null
  const hasError = result.issues.some((i) => i.level === 'error')
  return (
    <AlertPanel
      tone={hasError ? 'error' : 'warning'}
      title={hasError ? 'Kaydetmeden önce düzeltilecekler' : 'Uyarılar'}
    >
      <ul className="space-y-2">
        {result.issues.map((i) => (
          <li key={`${i.key}-${i.message}`} className="flex items-start gap-2.5">
            <span
              aria-hidden
              className={cn(
                'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                i.level === 'error' ? 'bg-destructive' : 'bg-muted-foreground/50',
              )}
            />
            <span className="rounded bg-background px-1.5 py-0.5 font-mono text-xs text-foreground">
              {i.key}
            </span>
            <span className="min-w-0">{i.message}</span>
          </li>
        ))}
      </ul>
    </AlertPanel>
  )
}

function FieldShell({
  label,
  required,
  type,
  hint,
  actions,
  children,
}: {
  label: string
  required?: boolean
  type?: string
  hint?: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  const Icon = type ? FIELD_META[type as keyof typeof FIELD_META]?.icon : null
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />}
        <Label className="text-sm font-medium text-foreground">{label}</Label>
        {required && (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        )}
        {hint && <span className="ml-auto truncate font-mono text-xs text-primary">{hint}</span>}
        {actions && <span className={hint ? '' : 'ml-auto'}>{actions}</span>}
      </div>
      {children}
    </div>
  )
}

const AI_ELIGIBLE_TYPES = new Set(['text', 'richtext'])

function FieldEditor({
  field,
  value,
  onChange,
  context,
}: {
  field: Field
  value: unknown
  onChange: (key: string, value: unknown) => void
  context: string
}) {
  const [aiRev, setAiRev] = useState(0)
  const handleAiResult = (text: string) => {
    onChange(field.key, text)
    if (field.type === 'richtext') setAiRev((r) => r + 1)
  }
  return (
    <FieldShell
      label={field.label || field.key}
      required={field.required}
      type={field.type}
      actions={
        AI_ELIGIBLE_TYPES.has(field.type) ? (
          <AIAssist
            context={context}
            fieldLabel={field.label || field.key}
            currentValue={typeof value === 'string' ? value : ''}
            richtext={field.type === 'richtext'}
            onResult={handleAiResult}
          />
        ) : undefined
      }
    >
      <FieldInput field={field} value={value} onChange={onChange} richtextKey={aiRev} />
    </FieldShell>
  )
}

function FieldInput({
  field,
  value,
  onChange,
  richtextKey,
}: {
  field: Field
  value: unknown
  onChange: (key: string, value: unknown) => void
  richtextKey?: number
}) {
  const k = field.key
  switch (field.type) {
    case 'richtext':
      return (
        <RichText
          key={richtextKey}
          value={(value as string) ?? ''}
          onChange={(md) => onChange(k, md)}
        />
      )
    case 'number':
      return (
        <Input
          type="number"
          value={value === undefined ? '' : String(value)}
          onChange={(e) => onChange(k, e.target.value === '' ? '' : Number(e.target.value))}
        />
      )
    case 'boolean':
      return (
        <Button
          type="button"
          variant={value ? 'default' : 'outline'}
          role="switch"
          aria-checked={!!value}
          onClick={() => onChange(k, !value)}
          className="min-w-20"
        >
          {value ? 'Evet' : 'Hayır'}
        </Button>
      )
    case 'date':
      return (
        <Input
          type="date"
          className="w-[240px]"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(k, e.target.value)}
        />
      )
    case 'select':
      return (
        <div className="flex items-center gap-2">
          <Select value={(value as string) || undefined} onValueChange={(v) => onChange(k, v)}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Seç…" />
            </SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {value ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onChange(k, '')}
              className="text-muted-foreground"
            >
              <X />
              <span className="sr-only">Temizle</span>
            </Button>
          ) : null}
        </div>
      )
    case 'relation':
      return <RelationInput field={field} value={value} onChange={onChange} />
    case 'image':
      return <ImageInput value={value} onChange={(v) => onChange(k, v)} />
    default:
      return <Input value={(value as string) ?? ''} onChange={(e) => onChange(k, e.target.value)} />
  }
}

function RelationInput({
  field,
  value,
  onChange,
}: {
  field: Field
  value: unknown
  onChange: (key: string, value: unknown) => void
}) {
  const [options, setOptions] = useState<string[]>([])
  const selected = Array.isArray(value) ? (value as string[]) : []

  useEffect(() => {
    if (field.to)
      api
        .listEntries(field.to)
        .then(setOptions)
        .catch(() => setOptions([]))
  }, [field.to])

  const setSelected = (next: string[]) => onChange(field.key, next.length ? next : '')

  const toggle = (slug: string) => {
    setSelected(selected.includes(slug) ? selected.filter((s) => s !== slug) : [...selected, slug])
  }

  if (options.length === 0)
    return (
      <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
        “{field.to}” içinde kayıt yok.
      </p>
    )

  return (
    <div className="space-y-2.5">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((slug) => (
            <Badge key={slug} variant="secondary" className="gap-1 pr-1 font-mono">
              {slug}
              <button
                type="button"
                onClick={() => toggle(slug)}
                className="rounded-full text-muted-foreground transition-colors hover:text-destructive"
                aria-label={`${slug} bağlantısını kaldır`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <Link2 /> Bağlantı ekle
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-72 w-56 overflow-y-auto">
          <DropdownMenuLabel>“{field.to}” kayıtları</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {options.map((slug) => (
            <DropdownMenuCheckboxItem
              key={slug}
              checked={selected.includes(slug)}
              onCheckedChange={() => toggle(slug)}
              onSelect={(e) => e.preventDefault()}
              className="font-mono text-xs"
            >
              {slug}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

async function fileToWebpBase64(file: File, maxW = 1600): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxW / bitmap.width)
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas yok')
  ctx.drawImage(bitmap, 0, 0, w, h)
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/webp', 0.85))
  if (!blob) throw new Error('dönüştürülemedi')
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function ImageInput({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const [busy, setBusy] = useState(false)
  const path = typeof value === 'string' ? value : ''
  const src = path ? `/media/${path.split('/').pop()}` : null

  const upload = async (file: File) => {
    setBusy(true)
    try {
      onChange(await api.uploadMedia(await fileToWebpBase64(file), file.name))
      toast.success('Görsel yüklendi')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-4 rounded-lg border bg-muted/30 p-3">
      <div
        className={cn(
          'flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-card',
          !src && 'border-dashed',
        )}
      >
        {src ? (
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <ImageIcon className="h-6 w-6 text-muted-foreground/60" />
        )}
      </div>
      <div className="min-w-0 space-y-2">
        <label className={cn(buttonVariants({ variant: 'outline' }), 'cursor-pointer bg-card')}>
          <Upload />
          {busy ? 'Yükleniyor…' : 'Görsel yükle'}
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void upload(f)
            }}
          />
        </label>
        {path && (
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate font-mono text-xs text-muted-foreground">{path}</span>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => onChange('')}
              className="text-muted-foreground hover:text-destructive"
            >
              kaldır
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

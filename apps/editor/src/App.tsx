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
  Boxes,
  ChevronRight,
  ChevronsUpDown,
  Download,
  FileCog,
  FolderGit2,
  Image as ImageIcon,
  Link2,
  PencilRuler,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { RichText } from './RichText'
import { SchemaBuilder } from './SchemaBuilder'
import { TemplateGallery } from './TemplateGallery'
import * as api from './api'
import { FIELD_META } from './field-types'

type Selection =
  | { kind: 'schema' }
  | { kind: 'collection'; name: string }
  | { kind: 'entry'; collection: string; slug: string }
  | { kind: 'newEntry'; collection: string }
  | { kind: 'singleton'; name: string }

export function App() {
  return (
    <TooltipProvider delayDuration={300}>
      <AppShell />
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
    <header className="flex h-12 shrink-0 items-center gap-1 overflow-x-auto border-b bg-card px-6 text-sm">
      <span
        title={project?.path}
        className="inline-flex shrink-0 items-center gap-1.5 font-medium text-muted-foreground"
      >
        <FolderGit2 className="h-4 w-4 text-muted-foreground/70" />
        {project?.name ?? '…'}
      </span>
      {crumbs.map((c) => (
        <span key={c.label} className="inline-flex shrink-0 items-center gap-1">
          <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
          {c.onClick ? (
            <button
              type="button"
              onClick={c.onClick}
              className="rounded text-muted-foreground transition-colors hover:text-primary"
            >
              {c.label}
            </button>
          ) : (
            <span className="font-medium text-foreground">{c.label}</span>
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
      <div className="px-5 pt-4 pb-3">
        <div className="text-lg font-bold tracking-tight text-foreground">
          Just<span className="text-primary">JSON</span>
        </div>
        {project && <ProjectMenu project={project} onExport={onExport} onReset={onReset} />}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        <SchemaNavItem active={selection?.kind === 'schema'} onClick={() => onOpenSchema()} />

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
            className="mt-1.5 flex w-full max-w-full items-center gap-1.5 rounded-md border bg-muted/50 px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

function Page({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto h-full max-w-3xl overflow-y-auto px-8 py-7">{children}</div>
}

function PageHead({
  title,
  crumb,
  actions,
}: { title: string; crumb?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        {title}
        {crumb && <span className="ml-2 font-normal text-muted-foreground">/ {crumb}</span>}
      </h1>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
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

  return (
    <Page>
      <PageHead
        title={collection.label ?? collection.name}
        actions={
          <Button onClick={onNew}>
            <Plus /> Yeni kayıt
          </Button>
        }
      />

      {rows && rows.length > 0 && (
        <div className="mb-4 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Başlık veya slug ara…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {filtered?.length ?? 0} kayıt
          </span>
        </div>
      )}

      {rows === null && <p className="text-sm text-muted-foreground">Yükleniyor…</p>}
      {rows?.length === 0 && (
        <div className="flex flex-col items-center rounded-xl border border-dashed bg-card px-6 py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Boxes className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-foreground">Henüz kayıt yok</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Bu koleksiyona ilk içeriği ekleyerek başla.
          </p>
          <Button onClick={onNew} variant="outline" className="mt-4">
            <Plus /> İlk kaydı oluştur
          </Button>
        </div>
      )}

      {filtered && rows && rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Başlık</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="text-right">Güncellendi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow
                  key={row.slug}
                  tabIndex={0}
                  onClick={() => onOpen(row.slug)}
                  onKeyDown={(e) => e.key === 'Enter' && onOpen(row.slug)}
                  className="cursor-pointer focus:bg-accent focus:outline-none"
                >
                  <TableCell className="font-medium text-foreground">{row.title}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {row.slug}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {formatDate(row.updatedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Page>
  )
}

function useEntryData(load: () => Promise<api.Entry | null>) {
  const [data, setData] = useState<api.Entry>({})
  const [loading, setLoading] = useState(true)
  // biome-ignore lint/correctness/useExhaustiveDependencies: sadece mount'ta yükle; yeniden bağlanma key prop'u ile kontrol ediliyor
  useEffect(() => {
    let alive = true
    load().then((d) => {
      if (alive) {
        setData(d ?? {})
        setLoading(false)
      }
    })
    return () => {
      alive = false
    }
  }, [])
  return { data, setData, loading }
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
  const { data, setData, loading } = useEntryData(load)
  const [newSlug, setNewSlug] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

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

  if (loading) return <Centered>Yükleniyor…</Centered>

  return (
    <Page>
      <PageHead
        title={collection.label ?? collection.name}
        crumb={isNew ? 'yeni' : (slug as string)}
        actions={
          <>
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
      {saveError && (
        <p className="mb-5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {saveError}
        </p>
      )}
      {isNew && (
        <div className="mb-5">
          <FieldShell label="dosya adı (slug)" hint={effectiveSlug}>
            <Input
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              placeholder="otomatik"
              className="font-mono"
            />
          </FieldShell>
        </div>
      )}
      <div className="space-y-6">
        {collection.fields.map((field) => (
          <FieldEditor key={field.key} field={field} value={data[field.key]} onChange={setField} />
        ))}
      </div>
      <Issues result={result} />
    </Page>
  )
}

function SingletonEditor({ singleton }: { singleton: Singleton }) {
  const load = useCallback(() => api.getSingleton(singleton.name), [singleton.name])
  const { data, setData, loading } = useEntryData(load)
  const [saving, setSaving] = useState(false)

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

  if (loading) return <Centered>Yükleniyor…</Centered>

  return (
    <Page>
      <PageHead
        title={singleton.label ?? singleton.name}
        actions={
          <Button onClick={save} disabled={saving || !result.ok}>
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        }
      />
      <div className="space-y-6">
        {singleton.fields.map((field) => (
          <FieldEditor key={field.key} field={field} value={data[field.key]} onChange={setField} />
        ))}
      </div>
      <Issues result={result} />
    </Page>
  )
}

function Issues({ result }: { result: ReturnType<typeof validateEntry> }) {
  if (result.issues.length === 0) return null
  return (
    <div className="mt-6 space-y-2">
      {result.issues.map((i) => (
        <div
          key={`${i.key}-${i.message}`}
          className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm"
        >
          <span className="font-mono text-foreground">{i.key}</span>
          <Badge variant={i.level === 'error' ? 'destructive' : 'secondary'}>
            {i.level === 'error' ? 'hata' : 'uyarı'}
          </Badge>
          <span className="text-muted-foreground">{i.message}</span>
        </div>
      ))}
    </div>
  )
}

function FieldShell({
  label,
  required,
  type,
  hint,
  children,
}: {
  label: string
  required?: boolean
  type?: string
  hint?: string
  children: React.ReactNode
}) {
  const Icon = type ? FIELD_META[type as keyof typeof FIELD_META]?.icon : null
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />}
        <Label className="text-sm font-medium text-muted-foreground">{label}</Label>
        {required && (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        )}
        {hint && <span className="ml-auto font-mono text-xs text-primary">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function FieldEditor({
  field,
  value,
  onChange,
}: {
  field: Field
  value: unknown
  onChange: (key: string, value: unknown) => void
}) {
  return (
    <FieldShell label={field.label || field.key} required={field.required} type={field.type}>
      <FieldInput field={field} value={value} onChange={onChange} />
    </FieldShell>
  )
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: Field
  value: unknown
  onChange: (key: string, value: unknown) => void
}) {
  const k = field.key
  switch (field.type) {
    case 'richtext':
      return <RichText value={(value as string) ?? ''} onChange={(md) => onChange(k, md)} />
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
          size="sm"
          role="switch"
          aria-checked={!!value}
          onClick={() => onChange(k, !value)}
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
    return <p className="text-sm text-muted-foreground">“{field.to}” içinde kayıt yok.</p>

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
          <Button variant="outline" size="sm">
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
    <div className="flex items-center gap-4">
      <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/50">
        {src ? (
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <ImageIcon className="h-6 w-6 text-muted-foreground/60" />
        )}
      </div>
      <div className="space-y-2">
        <label className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'cursor-pointer')}>
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
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{path}</span>
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

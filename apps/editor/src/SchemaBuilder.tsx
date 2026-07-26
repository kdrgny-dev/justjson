import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { slugify } from '@justjson/core'
import type { Collection, Field, FieldType, Schema, Singleton } from '@justjson/core'
import { ArrowDown, ArrowUp, Boxes, Check, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import * as api from './api'
import { FIELD_META, FIELD_TYPES } from './field-types'

type Container = Collection | Singleton
type PickerTarget = { kind: 'collection' | 'singleton'; ci: number; fi: number | null }

function clone(s: Schema): Schema {
  return JSON.parse(JSON.stringify(s)) as Schema
}

function uniqueName(base: string, taken: string[]): string {
  let n = 1
  while (taken.includes(`${base}${n}`)) n += 1
  return `${base}${n}`
}

function move<T>(arr: T[], idx: number, dir: -1 | 1): void {
  const to = idx + dir
  if (to < 0 || to >= arr.length) return
  const [item] = arr.splice(idx, 1)
  arr.splice(to, 0, item as T)
}

function newCollection(d: Schema): void {
  const name = uniqueName(
    'koleksiyon',
    d.collections.map((c) => c.name),
  )
  d.collections.push({ name, label: 'Yeni koleksiyon', path: name, fields: [] })
}

function newSingleton(d: Schema): void {
  const name = uniqueName(
    'tekil',
    d.singletons.map((s) => s.name),
  )
  d.singletons.push({ name, label: 'Yeni tekil', path: `${name}.json`, fields: [] })
}

export function SchemaBuilder({
  schema,
  onSaved,
  onBrowseTemplates,
  initialAdd,
}: {
  schema: Schema
  onSaved: () => void
  onBrowseTemplates?: () => void
  initialAdd?: 'collection' | 'singleton'
}) {
  const [draft, setDraft] = useState<Schema>(() => {
    const d = clone(schema)
    if (initialAdd === 'collection') newCollection(d)
    else if (initialAdd === 'singleton') newSingleton(d)
    return d
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [picker, setPicker] = useState<PickerTarget | null>(null)

  const collectionNames = draft.collections.map((c) => c.name)
  const update = (fn: (d: Schema) => void) =>
    setDraft((prev) => {
      const d = clone(prev)
      fn(d)
      return d
    })

  const isEmpty = draft.collections.length === 0 && draft.singletons.length === 0

  const applyType = (type: FieldType) => {
    if (!picker) return
    update((d) => {
      const list = picker.kind === 'collection' ? d.collections : d.singletons
      const container = list[picker.ci]
      if (!container) return
      if (picker.fi === null) {
        const key = uniqueName(
          'alan',
          container.fields.map((f) => f.key),
        )
        container.fields.push({ key, label: '', type })
      } else {
        const f = container.fields[picker.fi]
        if (!f) return
        f.type = type
        if (type !== 'select') f.options = undefined
        if (type !== 'relation') f.to = undefined
      }
    })
    setPicker(null)
  }

  const save = async () => {
    setError(null)
    setSaving(true)
    try {
      await api.putSchema(draft)
      onSaved()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b bg-background px-8 py-4">
        <div>
          <h1 className="font-heading text-lg font-semibold text-foreground">Şema</h1>
          <p className="text-sm text-muted-foreground">Koleksiyonlarını ve alanlarını tasarla.</p>
        </div>
        <Button type="button" onClick={save} disabled={saving}>
          <Check />
          {saving ? 'Kaydediliyor…' : 'Şemayı kaydet'}
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {error && (
          <p className="mb-5 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        {isEmpty ? (
          <SchemaEmpty
            onAddCollection={() => update(newCollection)}
            onAddSingleton={() => update(newSingleton)}
            onBrowseTemplates={onBrowseTemplates}
          />
        ) : (
          <div className="mx-auto max-w-3xl space-y-10">
            <Section
              title="Koleksiyonlar"
              hint="Çok kayıtlı içerik (yazılar, ürünler…)"
              onAdd={() => update(newCollection)}
            >
              {draft.collections.map((col, ci) => (
                <ContainerCard
                  // biome-ignore lint/suspicious/noArrayIndexKey: kontrollü kart; ad düzenlenebilir, stabil index gerekli
                  key={ci}
                  container={col}
                  kind="collection"
                  collectionNames={collectionNames}
                  onChange={(fn) => update((d) => fn(d.collections[ci] as Container))}
                  onRemove={() => update((d) => d.collections.splice(ci, 1))}
                  onMove={(dir) => update((d) => move(d.collections, ci, dir))}
                  onAddField={() => setPicker({ kind: 'collection', ci, fi: null })}
                  onChangeType={(fi) => setPicker({ kind: 'collection', ci, fi })}
                />
              ))}
            </Section>

            <Section
              title="Tekil"
              hint="Tek kayıt (site ayarları, profil…)"
              onAdd={() => update(newSingleton)}
            >
              {draft.singletons.map((s, ci) => (
                <ContainerCard
                  // biome-ignore lint/suspicious/noArrayIndexKey: kontrollü kart; ad düzenlenebilir, stabil index gerekli
                  key={ci}
                  container={s}
                  kind="singleton"
                  collectionNames={collectionNames}
                  onChange={(fn) => update((d) => fn(d.singletons[ci] as Container))}
                  onRemove={() => update((d) => d.singletons.splice(ci, 1))}
                  onMove={(dir) => update((d) => move(d.singletons, ci, dir))}
                  onAddField={() => setPicker({ kind: 'singleton', ci, fi: null })}
                  onChangeType={(fi) => setPicker({ kind: 'singleton', ci, fi })}
                />
              ))}
            </Section>
          </div>
        )}
      </div>

      <TypePicker open={picker !== null} onPick={applyType} onClose={() => setPicker(null)} />
    </div>
  )
}

function Section({
  title,
  hint,
  onAdd,
  children,
}: {
  title: string
  hint: string
  onAdd: () => void
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </h2>
          <p className="text-xs text-muted-foreground/70">{hint}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          <Plus /> Ekle
        </Button>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function SchemaEmpty({
  onAddCollection,
  onAddSingleton,
  onBrowseTemplates,
}: {
  onAddCollection: () => void
  onAddSingleton: () => void
  onBrowseTemplates?: () => void
}) {
  return (
    <Card className="mx-auto max-w-md">
      <CardContent className="flex flex-col items-center px-8 py-10 text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Boxes className="size-7" />
        </div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Şeman boş</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Koleksiyon, içeriğinin bir tipini tanımlar — yazılar, ürünler, projeler. İlkini ekleyerek
          başla.
        </p>
        <Button type="button" size="lg" onClick={onAddCollection} className="mt-6">
          <Plus /> Koleksiyon ekle
        </Button>
        <div className="mt-3 flex items-center gap-3 text-sm">
          <Button
            type="button"
            variant="link"
            onClick={onAddSingleton}
            className="h-auto p-0 text-muted-foreground hover:text-foreground"
          >
            Tekil kayıt ekle
          </Button>
          {onBrowseTemplates && (
            <>
              <span className="text-border">·</span>
              <Button
                type="button"
                variant="link"
                onClick={onBrowseTemplates}
                className="h-auto p-0"
              >
                veya bir template’den başla
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function ContainerCard({
  container,
  kind,
  collectionNames,
  onChange,
  onRemove,
  onMove,
  onAddField,
  onChangeType,
}: {
  container: Container
  kind: 'collection' | 'singleton'
  collectionNames: string[]
  onChange: (fn: (c: Container) => void) => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
  onAddField: () => void
  onChangeType: (fi: number) => void
}) {
  const setName = (value: string) => {
    const name = slugify(value)
    onChange((c) => {
      c.name = name
      c.path = kind === 'collection' ? name : `${name}.json`
    })
  }

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="flex flex-row items-center gap-2 bg-muted/40 px-3 py-2.5">
        <Input
          className="h-8 flex-1 border-transparent bg-transparent font-medium shadow-none focus-visible:border-input focus-visible:bg-background"
          value={container.label ?? ''}
          placeholder={kind === 'collection' ? 'Koleksiyon adı' : 'Tekil ad'}
          onChange={(e) =>
            onChange((c) => {
              c.label = e.target.value
            })
          }
        />
        <Input
          className="h-8 w-40 border-transparent bg-transparent font-mono text-xs text-primary hover:border-input focus-visible:bg-background"
          value={container.name}
          placeholder="api-adi"
          onChange={(e) => setName(e.target.value)}
        />
        <IconButton label="Yukarı taşı" onClick={() => onMove(-1)}>
          <ArrowUp />
        </IconButton>
        <IconButton label="Aşağı taşı" onClick={() => onMove(1)}>
          <ArrowDown />
        </IconButton>
        <IconButton label="Sil" danger onClick={onRemove}>
          <Trash2 />
        </IconButton>
      </CardHeader>

      <CardContent className="border-t px-0">
        {container.fields.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">Henüz alan yok.</p>
        )}
        <div className="divide-y divide-border/60">
          {container.fields.map((field, fi) => (
            <FieldRow
              // biome-ignore lint/suspicious/noArrayIndexKey: kontrollü satır; anahtar düzenlenebilir, stabil index gerekli
              key={fi}
              field={field}
              collectionNames={collectionNames}
              onChange={(fn) => onChange((c) => fn(c.fields[fi] as Field))}
              onRemove={() => onChange((c) => c.fields.splice(fi, 1))}
              onMove={(dir) => onChange((c) => move(c.fields, fi, dir))}
              onChangeType={() => onChangeType(fi)}
            />
          ))}
        </div>
      </CardContent>

      <Button
        type="button"
        variant="ghost"
        onClick={onAddField}
        className="h-10 w-full justify-center gap-1.5 rounded-none border-t text-primary hover:bg-primary/5 hover:text-primary"
      >
        <Plus /> Alan ekle
      </Button>
    </Card>
  )
}

function FieldRow({
  field,
  collectionNames,
  onChange,
  onRemove,
  onMove,
  onChangeType,
}: {
  field: Field
  collectionNames: string[]
  onChange: (fn: (f: Field) => void) => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
  onChangeType: () => void
}) {
  const meta = FIELD_META[field.type]
  const Icon = meta.icon

  return (
    <div className="group px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onChangeType}
              aria-label="Tipi değiştir"
              className="shrink-0 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
            >
              <Icon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{meta.label} · tipi değiştir</TooltipContent>
        </Tooltip>
        <Input
          className="h-8 flex-1 border-transparent bg-transparent font-medium shadow-none focus-visible:border-input focus-visible:bg-background"
          value={field.label ?? ''}
          placeholder="Alan adı"
          onChange={(e) =>
            onChange((f) => {
              f.label = e.target.value
            })
          }
        />
        <Input
          className="h-8 w-32 border-transparent bg-transparent font-mono text-xs text-muted-foreground hover:border-input focus-visible:bg-background focus-visible:text-foreground"
          value={field.key}
          placeholder="anahtar"
          onChange={(e) =>
            onChange((f) => {
              f.key = slugify(e.target.value)
            })
          }
        />
        <Button
          type="button"
          size="xs"
          variant={field.required ? 'default' : 'outline'}
          aria-pressed={field.required}
          onClick={() =>
            onChange((f) => {
              f.required = !f.required
            })
          }
          className={cn('rounded-full', !field.required && 'text-muted-foreground')}
        >
          Zorunlu
        </Button>
        <div className="flex items-center gap-0.5 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">
          <IconButton label="Yukarı taşı" onClick={() => onMove(-1)}>
            <ArrowUp />
          </IconButton>
          <IconButton label="Aşağı taşı" onClick={() => onMove(1)}>
            <ArrowDown />
          </IconButton>
          <IconButton label="Sil" danger onClick={onRemove}>
            <X />
          </IconButton>
        </div>
      </div>

      {field.type === 'select' && (
        <Input
          className="mt-2 ml-10 w-[calc(100%-2.5rem)]"
          value={(field.options ?? []).join(', ')}
          placeholder="seçenekler (virgülle ayır)"
          onChange={(e) =>
            onChange((f) => {
              f.options = e.target.value
                .split(',')
                .map((o) => o.trim())
                .filter(Boolean)
            })
          }
        />
      )}
      {field.type === 'relation' && (
        <div className="mt-2 ml-10">
          <Select
            value={field.to || undefined}
            onValueChange={(v) =>
              onChange((f) => {
                f.to = v
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="hedef koleksiyon seç…" />
            </SelectTrigger>
            <SelectContent>
              {collectionNames.map((n) => (
                <SelectItem key={n} value={n}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}

function TypePicker({
  open,
  onPick,
  onClose,
}: {
  open: boolean
  onPick: (t: FieldType) => void
  onClose: () => void
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Alan tipi seç</DialogTitle>
          <DialogDescription>Bu alanın hangi türde veri tutacağını belirle.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2.5">
          {FIELD_TYPES.map(({ type, label, desc, icon: Icon }) => (
            <button
              type="button"
              key={type}
              onClick={() => onPick(type)}
              className="flex items-start gap-3 rounded-xl border p-3 text-left outline-none transition-colors hover:border-primary hover:bg-primary/5 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-4" />
              </span>
              <span>
                <span className="block text-sm font-medium text-foreground">{label}</span>
                <span className="block text-xs text-muted-foreground">{desc}</span>
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function IconButton({
  children,
  label,
  danger,
  onClick,
}: {
  children: React.ReactNode
  label: string
  danger?: boolean
  onClick: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onClick}
          aria-label={label}
          className={cn(
            'text-muted-foreground',
            danger && 'hover:bg-destructive/10 hover:text-destructive',
          )}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

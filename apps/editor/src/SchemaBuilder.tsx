import { DragHandle, SortableList } from '@/components/sortable-list'
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
import { arrayMove, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { slugify } from '@justjson/core'
import type { Collection, Field, FieldType, Schema, Singleton } from '@justjson/core'
import {
  Boxes,
  Check,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  GripVertical,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { useState } from 'react'
import * as api from './api'
import { FIELD_META, FIELD_TYPES } from './field-types'
import { t, tp } from './i18n'

type Container = Collection | Singleton
type Kind = 'collection' | 'singleton'
type PickerTarget = { kind: Kind; ci: number; fi: number | null }

/** Ad ve anahtar düzenlenebilir olduğu için kimlikler veriden türetilemez; yapıya paralel tutulur. */
type ContainerIds = { id: string; fields: string[] }
type IdModel = { collections: ContainerIds[]; singletons: ContainerIds[] }
type Model = { schema: Schema; ids: IdModel }

let idSeq = 0
function uid(prefix: string): string {
  idSeq += 1
  return `${prefix}${idSeq}`
}

function clone(s: Schema): Schema {
  return JSON.parse(JSON.stringify(s)) as Schema
}

function makeIds(s: Schema): IdModel {
  const forList = (items: Container[], p: string) =>
    items.map((item) => ({ id: uid(p), fields: item.fields.map(() => uid('f')) }))
  return { collections: forList(s.collections, 'c'), singletons: forList(s.singletons, 's') }
}

function cloneIds(m: IdModel): IdModel {
  const forList = (l: ContainerIds[]) => l.map((c) => ({ id: c.id, fields: [...c.fields] }))
  return { collections: forList(m.collections), singletons: forList(m.singletons) }
}

/** Yapısal mutasyonlardan sonra kimlik listesini şemayla hizalar (eksikse üretir, fazlaysa atar). */
function reconcile(s: Schema, m: IdModel): IdModel {
  const forList = (items: Container[], ids: ContainerIds[], p: string) =>
    items.map((item, i) => {
      const cur = ids[i]
      return {
        id: cur?.id ?? uid(p),
        fields: item.fields.map((_, fi) => cur?.fields[fi] ?? uid('f')),
      }
    })
  return {
    collections: forList(s.collections, m.collections, 'c'),
    singletons: forList(s.singletons, m.singletons, 's'),
  }
}

function groupSeed(): { fields: Field[] } {
  return { fields: [{ key: 'field1', label: '', type: 'text' }] }
}

// group + repeater both hold sub-fields (repeater = an array of group rows).
function hasSubfields(type: Field['type']): boolean {
  return type === 'group' || type === 'repeater'
}

function uniqueName(base: string, taken: string[]): string {
  let n = 1
  while (taken.includes(`${base}${n}`)) n += 1
  return `${base}${n}`
}

function newCollection(d: Schema, m: IdModel): void {
  const name = uniqueName(
    'collection',
    d.collections.map((c) => c.name),
  )
  d.collections.push({ name, label: t('New collection'), path: name, fields: [] })
  m.collections.push({ id: uid('c'), fields: [] })
}

function newSingleton(d: Schema, m: IdModel): void {
  const name = uniqueName(
    'singleton',
    d.singletons.map((s) => s.name),
  )
  d.singletons.push({ name, label: t('New singleton'), path: `${name}.json`, fields: [] })
  m.singletons.push({ id: uid('s'), fields: [] })
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
  const [model, setModel] = useState<Model>(() => {
    const next = clone(schema)
    const ids = makeIds(next)
    if (initialAdd === 'collection') newCollection(next, ids)
    else if (initialAdd === 'singleton') newSingleton(next, ids)
    return { schema: next, ids }
  })
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    const all = [...model.ids.collections, ...model.ids.singletons]
    if (all.length <= 5) return {}
    return Object.fromEntries(all.map((c) => [c.id, true]))
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [picker, setPicker] = useState<PickerTarget | null>(null)

  const draft = model.schema
  const ids = model.ids
  const collectionNames = draft.collections.map((c) => c.name)

  /** Yalnızca değer düzenlemeleri: yapı ve kimlikler değişmez. */
  const update = (fn: (d: Schema) => void) =>
    setModel((prev) => {
      const next = clone(prev.schema)
      fn(next)
      return { schema: next, ids: prev.ids }
    })

  /** Ekleme, silme, sıralama: şema ve kimlikler birlikte taşınır. */
  const structural = (fn: (d: Schema, m: IdModel) => void) =>
    setModel((prev) => {
      const next = clone(prev.schema)
      const nextIds = cloneIds(prev.ids)
      fn(next, nextIds)
      return { schema: next, ids: reconcile(next, nextIds) }
    })

  const setCollapse = (id: string, value: boolean) =>
    setCollapsed((prev) => ({ ...prev, [id]: value }))

  const collapseAll = (list: ContainerIds[], value: boolean) =>
    setCollapsed((prev) => {
      const next = { ...prev }
      for (const c of list) next[c.id] = value
      return next
    })

  const isEmpty = draft.collections.length === 0 && draft.singletons.length === 0

  const applyType = (type: FieldType) => {
    if (!picker) return
    structural((d, m) => {
      const list = picker.kind === 'collection' ? d.collections : d.singletons
      const idList = picker.kind === 'collection' ? m.collections : m.singletons
      const container = list[picker.ci]
      if (!container) return
      if (picker.fi === null) {
        const key = uniqueName(
          'field',
          container.fields.map((f) => f.key),
        )
        // group/repeater şema düzeyinde en az bir alt alan ister; boş eklenirse kaydedilemez.
        container.fields.push({ key, label: '', type, ...(hasSubfields(type) ? groupSeed() : {}) })
        idList[picker.ci]?.fields.push(uid('f'))
      } else {
        const f = container.fields[picker.fi]
        if (!f) return
        f.type = type
        if (type !== 'select') f.options = undefined
        if (type !== 'relation') f.to = undefined
        if (!hasSubfields(type)) f.fields = undefined
        else if (!f.fields || f.fields.length === 0) f.fields = groupSeed().fields
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

  const renderList = (kind: Kind) => {
    const containers: Container[] = kind === 'collection' ? draft.collections : draft.singletons
    const idList = kind === 'collection' ? ids.collections : ids.singletons

    return (
      <SortableList
        ids={idList.map((c) => c.id)}
        onReorder={(from, to) =>
          structural((d, m) => {
            if (kind === 'collection') {
              d.collections = arrayMove(d.collections, from, to)
              m.collections = arrayMove(m.collections, from, to)
            } else {
              d.singletons = arrayMove(d.singletons, from, to)
              m.singletons = arrayMove(m.singletons, from, to)
            }
          })
        }
        renderOverlay={(id) => {
          const ci = idList.findIndex((c) => c.id === id)
          const container = containers[ci]
          return container ? <ContainerPreview container={container} /> : null
        }}
      >
        {containers.map((container, ci) => {
          const entry = idList[ci]
          if (!entry) return null
          return (
            <SortableContainerCard
              key={entry.id}
              id={entry.id}
              container={container}
              kind={kind}
              collectionNames={collectionNames}
              fieldIds={entry.fields}
              collapsed={collapsed[entry.id] ?? false}
              onToggleCollapse={() => setCollapse(entry.id, !collapsed[entry.id])}
              onChange={(fn) =>
                update((d) => {
                  const list = kind === 'collection' ? d.collections : d.singletons
                  const c = list[ci]
                  if (c) fn(c)
                })
              }
              onRemove={() =>
                structural((d, m) => {
                  if (kind === 'collection') {
                    d.collections.splice(ci, 1)
                    m.collections.splice(ci, 1)
                  } else {
                    d.singletons.splice(ci, 1)
                    m.singletons.splice(ci, 1)
                  }
                })
              }
              onRemoveField={(fi) =>
                structural((d, m) => {
                  const list = kind === 'collection' ? d.collections : d.singletons
                  const idsFor = kind === 'collection' ? m.collections : m.singletons
                  list[ci]?.fields.splice(fi, 1)
                  idsFor[ci]?.fields.splice(fi, 1)
                })
              }
              onReorderFields={(from, to) =>
                structural((d, m) => {
                  const list = kind === 'collection' ? d.collections : d.singletons
                  const idsFor = kind === 'collection' ? m.collections : m.singletons
                  const c = list[ci]
                  const e = idsFor[ci]
                  if (!c || !e) return
                  c.fields = arrayMove(c.fields, from, to)
                  e.fields = arrayMove(e.fields, from, to)
                })
              }
              onAddField={() => setPicker({ kind, ci, fi: null })}
              onChangeType={(fi) => setPicker({ kind, ci, fi })}
            />
          )
        })}
      </SortableList>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-10 shrink-0 border-b bg-card px-4 py-4 sm:px-8">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between">
          <div>
            <h1 className="font-heading text-lg font-semibold text-foreground">{t('Schema')}</h1>
            <p className="text-sm text-muted-foreground">
              {t('Design your collections and fields.')}
            </p>
          </div>
          <Button type="button" onClick={save} disabled={saving}>
            <Check />
            {saving ? t('Saving…') : t('Save schema')}
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto w-full max-w-4xl">
          {error && (
            <p className="mb-5 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          )}

          {isEmpty ? (
            <SchemaEmpty
              onAddCollection={() => structural(newCollection)}
              onAddSingleton={() => structural(newSingleton)}
              onBrowseTemplates={onBrowseTemplates}
            />
          ) : (
            <div className="space-y-10">
              <Section
                title={t('Collections')}
                hint={t('Content with many entries (posts, products…)')}
                onAdd={() => structural(newCollection)}
                allCollapsed={
                  ids.collections.length > 0 && ids.collections.every((c) => collapsed[c.id])
                }
                onToggleAll={
                  ids.collections.length > 1
                    ? (value) => collapseAll(ids.collections, value)
                    : undefined
                }
              >
                {renderList('collection')}
              </Section>

              <Section
                title={t('Singletons')}
                hint={t('A single record (site settings, profile…)')}
                onAdd={() => structural(newSingleton)}
                allCollapsed={
                  ids.singletons.length > 0 && ids.singletons.every((c) => collapsed[c.id])
                }
                onToggleAll={
                  ids.singletons.length > 1
                    ? (value) => collapseAll(ids.singletons, value)
                    : undefined
                }
              >
                {renderList('singleton')}
              </Section>
            </div>
          )}
        </div>
      </div>

      <TypePicker open={picker !== null} onPick={applyType} onClose={() => setPicker(null)} />
    </div>
  )
}

function Section({
  title,
  hint,
  onAdd,
  allCollapsed,
  onToggleAll,
  children,
}: {
  title: string
  hint: string
  onAdd: () => void
  allCollapsed?: boolean
  onToggleAll?: (value: boolean) => void
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </h2>
          <p className="text-xs text-muted-foreground/70">{hint}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {onToggleAll && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onToggleAll(!allCollapsed)}
              className="text-muted-foreground"
            >
              {allCollapsed ? <ChevronsUpDown /> : <ChevronsDownUp />}
              {allCollapsed ? t('Expand all') : t('Collapse all')}
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={onAdd}>
            <Plus /> {t('Add')}
          </Button>
        </div>
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
      <CardContent className="flex flex-col items-center px-4 py-10 sm:px-8 text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Boxes className="size-7" />
        </div>
        <h2 className="font-heading text-lg font-semibold text-foreground">
          {t('Your schema is empty')}
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {t(
            'A collection describes one type of your content — posts, products, projects. Start by adding the first one.',
          )}
        </p>
        <Button type="button" size="lg" onClick={onAddCollection} className="mt-6">
          <Plus /> {t('Add collection')}
        </Button>
        <div className="mt-3 flex items-center gap-3 text-sm">
          <Button
            type="button"
            variant="link"
            onClick={onAddSingleton}
            className="h-auto p-0 text-muted-foreground hover:text-foreground"
          >
            {t('Add a singleton')}
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
                {t('or start from a template')}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

interface ContainerCardProps {
  container: Container
  kind: Kind
  collectionNames: string[]
  fieldIds: string[]
  collapsed: boolean
  onToggleCollapse: () => void
  onChange: (fn: (c: Container) => void) => void
  onRemove: () => void
  onRemoveField: (fi: number) => void
  onReorderFields: (from: number, to: number) => void
  onAddField: () => void
  onChangeType: (fi: number) => void
}

function SortableContainerCard({ id, ...props }: ContainerCardProps & { id: string }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(isDragging && 'opacity-40')}
    >
      <ContainerCard
        {...props}
        dragHandle={
          <DragHandle
            ref={setActivatorNodeRef}
            label={t('Drag to reorder')}
            {...attributes}
            {...listeners}
          />
        }
      />
    </div>
  )
}

function ContainerCard({
  container,
  kind,
  collectionNames,
  fieldIds,
  collapsed,
  onToggleCollapse,
  onChange,
  onRemove,
  onRemoveField,
  onReorderFields,
  onAddField,
  onChangeType,
  dragHandle,
}: ContainerCardProps & { dragHandle: React.ReactNode }) {
  const setName = (value: string) => {
    const name = slugify(value)
    onChange((c) => {
      c.name = name
      c.path = kind === 'collection' ? name : `${name}.json`
    })
  }

  const count = container.fields.length

  return (
    <Card className="gap-0 overflow-hidden py-0 shadow-sm">
      <CardHeader
        className={cn(
          'relative grid grid-cols-[1.5rem_1.75rem_minmax(0,1fr)_auto_1.75rem] items-center gap-2 bg-muted/40 px-4 py-3',
          !collapsed && 'border-b',
        )}
      >
        {/* Başlık boşluğuna tıklamak da daraltır; asıl erişilebilir kontrol chevron düğmesi. */}
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          onClick={onToggleCollapse}
          className="absolute inset-0 cursor-pointer"
        />
        <div className="relative opacity-0 transition group-focus-within/card:opacity-100 group-hover/card:opacity-100 focus-within:opacity-100">
          {dragHandle}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          aria-label={collapsed ? t('Expand') : t('Collapse')}
          className="relative text-muted-foreground"
        >
          <ChevronDown className={cn('transition-transform', collapsed && '-rotate-90')} />
        </Button>
        <Input
          className="relative h-8 border-transparent bg-transparent font-medium shadow-none focus-visible:border-input focus-visible:bg-background"
          value={container.label ?? ''}
          placeholder={kind === 'collection' ? t('Collection name') : t('Singleton name')}
          onChange={(e) =>
            onChange((c) => {
              c.label = e.target.value
            })
          }
        />
        <div className="relative flex items-center gap-2">
          {collapsed && (
            <span className="whitespace-nowrap rounded-full bg-foreground/5 px-2 py-0.5 text-xs text-muted-foreground">
              {tp(count, '{n} field', '{n} fields')}
            </span>
          )}
          <Input
            className="h-8 w-40 border-transparent bg-transparent font-mono text-xs text-primary hover:border-input focus-visible:bg-background"
            value={container.name}
            placeholder="api-name"
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <IconButton label={t('Delete')} danger onClick={onRemove} className="relative">
          <Trash2 />
        </IconButton>
      </CardHeader>

      {!collapsed && (
        <>
          <CardContent className="px-0">
            {count === 0 && (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                {t('No fields yet. Add the first one below.')}
              </p>
            )}
            <SortableList
              ids={fieldIds}
              onReorder={onReorderFields}
              renderOverlay={(id) => {
                const fi = fieldIds.indexOf(id)
                const field = container.fields[fi]
                return field ? <FieldPreview field={field} /> : null
              }}
            >
              <div className="divide-y divide-border/60">
                {container.fields.map((field, fi) => {
                  const fieldId = fieldIds[fi]
                  if (!fieldId) return null
                  return (
                    <SortableFieldRow
                      key={fieldId}
                      id={fieldId}
                      field={field}
                      collectionNames={collectionNames}
                      onChange={(fn) => onChange((c) => fn(c.fields[fi] as Field))}
                      onRemove={() => onRemoveField(fi)}
                      onChangeType={() => onChangeType(fi)}
                    />
                  )
                })}
              </div>
            </SortableList>
          </CardContent>

          <Button
            type="button"
            variant="ghost"
            onClick={onAddField}
            className="h-11 w-full justify-center gap-1.5 rounded-none border-t text-primary hover:bg-primary/5 hover:text-primary"
          >
            <Plus /> {t('Add field')}
          </Button>
        </>
      )}
    </Card>
  )
}

function ContainerPreview({ container }: { container: Container }) {
  return (
    <div className="flex scale-[1.01] items-center gap-2 rounded-xl bg-card px-4 py-3 shadow-lg ring-2 ring-primary/40">
      <GripVertical className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate text-sm font-medium text-foreground">
        {container.label || container.name}
      </span>
      <span className="truncate font-mono text-xs text-primary">{container.name}</span>
      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
        {tp(container.fields.length, '{n} field', '{n} fields')}
      </span>
    </div>
  )
}

interface FieldRowProps {
  field: Field
  collectionNames: string[]
  onChange: (fn: (f: Field) => void) => void
  onRemove: () => void
  onChangeType: () => void
}

function SortableFieldRow({ id, ...props }: FieldRowProps & { id: string }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  return (
    <FieldRow
      {...props}
      rowRef={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      dragging={isDragging}
      dragHandle={
        <DragHandle
          ref={setActivatorNodeRef}
          label={t('Drag to reorder')}
          {...attributes}
          {...listeners}
        />
      }
    />
  )
}

function FieldRow({
  field,
  collectionNames,
  onChange,
  onRemove,
  onChangeType,
  rowRef,
  style,
  dragging,
  dragHandle,
}: FieldRowProps & {
  rowRef: (el: HTMLElement | null) => void
  style: React.CSSProperties
  dragging: boolean
  dragHandle: React.ReactNode
}) {
  const meta = FIELD_META[field.type]
  const Icon = meta.icon
  const reveal =
    'opacity-0 transition group-focus-within/row:opacity-100 group-hover/row:opacity-100 focus-within:opacity-100'

  return (
    <div
      ref={rowRef}
      style={style}
      className={cn(
        'group/row grid grid-cols-[1.5rem_2rem_minmax(0,1fr)_7rem_4.5rem_1.75rem] items-center gap-2 bg-card px-4 py-2.5 md:grid-cols-[1.5rem_2rem_minmax(0,1fr)_10rem_4.5rem_1.75rem]',
        dragging && 'opacity-40',
      )}
    >
      <div className={reveal}>{dragHandle}</div>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onChangeType}
            aria-label={t('Change type')}
            className="bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
          >
            <Icon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {t(meta.label)} · {t('change type')}
        </TooltipContent>
      </Tooltip>

      <Input
        className="h-8 border-transparent bg-transparent font-medium shadow-none focus-visible:border-input focus-visible:bg-background"
        value={field.label ?? ''}
        placeholder={t('Field name')}
        onChange={(e) =>
          onChange((f) => {
            f.label = e.target.value
          })
        }
      />
      <Input
        className="h-8 border-transparent bg-transparent font-mono text-xs text-muted-foreground hover:border-input focus-visible:bg-background focus-visible:text-foreground"
        value={field.key}
        placeholder={t('key')}
        onChange={(e) =>
          onChange((f) => {
            f.key = slugify(e.target.value)
          })
        }
      />

      <Button
        type="button"
        size="xs"
        variant={field.required ? 'default' : 'ghost'}
        aria-pressed={field.required ?? false}
        title={field.required ? t('Required field') : t('Make it required')}
        onClick={() =>
          onChange((f) => {
            f.required = !f.required
          })
        }
        className={cn(
          'w-full rounded-full',
          !field.required && `border-dashed border-border text-muted-foreground ${reveal}`,
        )}
      >
        {t('Required')}
      </Button>

      <IconButton label={t('Delete')} danger onClick={onRemove} className={reveal}>
        <X />
      </IconButton>

      {field.type === 'select' && (
        <Input
          className="col-start-3 col-end-[-1] row-start-2 mt-1"
          value={(field.options ?? []).join(', ')}
          placeholder={t('options (comma separated)')}
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
        <div className="col-start-3 col-end-[-1] row-start-2 mt-1">
          <Select
            value={field.to || undefined}
            onValueChange={(v) =>
              onChange((f) => {
                f.to = v
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('pick a target collection…')} />
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
      {(field.type === 'group' || field.type === 'repeater') && (
        <div className="col-start-3 col-end-[-1] row-start-2 mt-1">
          <GroupFieldsEditor field={field} onChange={onChange} />
        </div>
      )}
    </div>
  )
}

// tek seviye iç içe; alt-alanlar container (group/repeater) olamaz.
const SUB_FIELD_TYPES = FIELD_TYPES.filter((f) => f.type !== 'group' && f.type !== 'repeater')

function GroupFieldsEditor({
  field,
  onChange,
}: {
  field: Field
  onChange: (fn: (f: Field) => void) => void
}) {
  const subs = field.fields ?? []
  return (
    <div className="space-y-1.5 rounded-lg border border-dashed bg-muted/20 p-2.5">
      {subs.map((sub, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: alt alanlar konuma göre kimliklenir; key düzenlenirken remount/focus kaybını önler
        <div key={i} className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Select
              value={sub.type}
              onValueChange={(v) =>
                onChange((f) => {
                  const s = f.fields?.[i]
                  if (s) {
                    s.type = v as FieldType
                    if (v !== 'select') s.options = undefined
                  }
                })
              }
            >
              <SelectTrigger className="h-8 w-[7.5rem] shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUB_FIELD_TYPES.map(({ type, label }) => (
                  <SelectItem key={type} value={type}>
                    {t(label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="h-8 flex-1 font-mono text-xs"
              value={sub.key}
              placeholder={t('key')}
              onChange={(e) =>
                onChange((f) => {
                  const s = f.fields?.[i]
                  if (s) s.key = slugify(e.target.value)
                })
              }
            />
            <Input
              className="h-8 flex-1"
              value={sub.label ?? ''}
              placeholder={t('Display name')}
              onChange={(e) =>
                onChange((f) => {
                  const s = f.fields?.[i]
                  if (s) s.label = e.target.value
                })
              }
            />
            <IconButton
              label={t('Delete sub-field')}
              danger
              onClick={() =>
                onChange((f) => {
                  if (f.fields) f.fields = f.fields.filter((_, idx) => idx !== i)
                })
              }
            >
              <X />
            </IconButton>
          </div>
          {sub.type === 'select' && (
            <Input
              className="ml-[8rem] h-8 text-xs"
              value={(sub.options ?? []).join(', ')}
              placeholder={t('options (comma separated)')}
              onChange={(e) =>
                onChange((f) => {
                  const s = f.fields?.[i]
                  if (s)
                    s.options = e.target.value
                      .split(',')
                      .map((o) => o.trim())
                      .filter(Boolean)
                })
              }
            />
          )}
        </div>
      ))}
      <Button
        type="button"
        size="xs"
        variant="ghost"
        className="text-muted-foreground"
        onClick={() =>
          onChange((f) => {
            const existing = (f.fields ?? []).map((s) => s.key)
            f.fields = [
              ...(f.fields ?? []),
              { key: uniqueName('field', existing), label: '', type: 'text' },
            ]
          })
        }
      >
        <Plus /> {t('Add sub-field')}
      </Button>
    </div>
  )
}

function FieldPreview({ field }: { field: Field }) {
  const meta = FIELD_META[field.type]
  const Icon = meta.icon
  return (
    <div className="flex items-center gap-2 rounded-lg bg-card px-4 py-2.5 shadow-lg ring-2 ring-primary/40">
      <GripVertical className="size-4 shrink-0 text-muted-foreground" />
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <span className="truncate text-sm font-medium text-foreground">
        {field.label || t(meta.label)}
      </span>
      <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">{field.key}</span>
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
          <DialogTitle>{t('Pick a field type')}</DialogTitle>
          <DialogDescription>{t('Choose what kind of data this field holds.')}</DialogDescription>
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
                <span className="block text-sm font-medium text-foreground">{t(label)}</span>
                <span className="block text-xs text-muted-foreground">{t(desc)}</span>
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
  className,
}: {
  children: React.ReactNode
  label: string
  danger?: boolean
  onClick: () => void
  className?: string
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
            className,
          )}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

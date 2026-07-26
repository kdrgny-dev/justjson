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
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Şema</h1>
          <p className="text-sm text-slate-500">Koleksiyonlarını ve alanlarını tasarla.</p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          {saving ? 'Kaydediliyor…' : 'Şemayı kaydet'}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {error && (
          <p className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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

      {picker && <TypePicker onPick={applyType} onClose={() => setPicker(null)} />}
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
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
          <p className="text-xs text-slate-400">{hint}</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-indigo-300 hover:text-indigo-600"
        >
          <Plus className="h-4 w-4" /> Ekle
        </button>
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
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
        <Boxes className="h-7 w-7" />
      </div>
      <h2 className="text-lg font-semibold text-slate-900">Şeman boş</h2>
      <p className="mt-1.5 text-sm text-slate-500">
        Koleksiyon, içeriğinin bir tipini tanımlar — yazılar, ürünler, projeler. İlkini ekleyerek
        başla.
      </p>
      <button
        type="button"
        onClick={onAddCollection}
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
      >
        <Plus className="h-4 w-4" /> Koleksiyon ekle
      </button>
      <div className="mt-3 flex items-center gap-3 text-sm">
        <button
          type="button"
          onClick={onAddSingleton}
          className="font-medium text-slate-500 transition hover:text-slate-700"
        >
          Tekil kayıt ekle
        </button>
        {onBrowseTemplates && (
          <>
            <span className="text-slate-300">·</span>
            <button
              type="button"
              onClick={onBrowseTemplates}
              className="font-medium text-indigo-600 transition hover:text-indigo-700"
            >
              veya bir template’den başla
            </button>
          </>
        )}
      </div>
    </div>
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
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
        <input
          className="flex-1 rounded-md bg-transparent px-1 py-0.5 text-base font-semibold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100"
          value={container.label ?? ''}
          placeholder="Koleksiyon adı"
          onChange={(e) =>
            onChange((c) => {
              c.label = e.target.value
            })
          }
        />
        <input
          className="w-40 rounded-md border border-transparent px-2 py-1 font-mono text-xs text-indigo-600 outline-none hover:border-slate-200 focus:border-indigo-300 focus:bg-white"
          value={container.name}
          placeholder="api-adi"
          onChange={(e) => setName(e.target.value)}
        />
        <IconButton title="Yukarı" onClick={() => onMove(-1)}>
          <ArrowUp className="h-4 w-4" />
        </IconButton>
        <IconButton title="Aşağı" onClick={() => onMove(1)}>
          <ArrowDown className="h-4 w-4" />
        </IconButton>
        <IconButton title="Sil" danger onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </IconButton>
      </div>

      <div className="divide-y divide-slate-100">
        {container.fields.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-slate-400">Henüz alan yok.</p>
        )}
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

      <button
        type="button"
        onClick={onAddField}
        className="flex w-full items-center justify-center gap-1.5 border-t border-slate-100 px-4 py-2.5 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50"
      >
        <Plus className="h-4 w-4" /> Alan ekle
      </button>
    </div>
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
    <div className="group px-4 py-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onChangeType}
          title="Tipi değiştir"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 transition hover:bg-indigo-100"
        >
          <Icon className="h-4 w-4" />
        </button>
        <input
          className="flex-1 rounded-md px-1 py-0.5 text-sm font-medium text-slate-800 outline-none focus:bg-slate-50 focus:ring-2 focus:ring-indigo-100"
          value={field.label ?? ''}
          placeholder="Alan adı"
          onChange={(e) =>
            onChange((f) => {
              f.label = e.target.value
            })
          }
        />
        <input
          className="w-32 rounded-md border border-transparent px-2 py-1 font-mono text-xs text-slate-400 outline-none hover:border-slate-200 focus:border-indigo-300 focus:text-slate-700"
          value={field.key}
          placeholder="anahtar"
          onChange={(e) =>
            onChange((f) => {
              f.key = slugify(e.target.value)
            })
          }
        />
        <button
          type="button"
          onClick={() =>
            onChange((f) => {
              f.required = !f.required
            })
          }
          className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
            field.required
              ? 'bg-amber-100 text-amber-700'
              : 'bg-slate-100 text-slate-400 hover:text-slate-600'
          }`}
        >
          zorunlu
        </button>
        <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
          <IconButton title="Yukarı" onClick={() => onMove(-1)}>
            <ArrowUp className="h-4 w-4" />
          </IconButton>
          <IconButton title="Aşağı" onClick={() => onMove(1)}>
            <ArrowDown className="h-4 w-4" />
          </IconButton>
          <IconButton title="Sil" danger onClick={onRemove}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      {field.type === 'select' && (
        <input
          className="mt-2 ml-12 block w-[calc(100%-3rem)] rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
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
        <select
          className="mt-2 ml-12 block w-[calc(100%-3rem)] rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          value={field.to ?? ''}
          onChange={(e) =>
            onChange((f) => {
              f.to = e.target.value
            })
          }
        >
          <option value="">hedef koleksiyon seç…</option>
          {collectionNames.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}

function TypePicker({ onPick, onClose }: { onPick: (t: FieldType) => void; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      role="presentation"
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="presentation"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Alan tipi seç</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {FIELD_TYPES.map(({ type, label, desc, icon: Icon }) => (
            <button
              type="button"
              key={type}
              onClick={() => onPick(type)}
              className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-indigo-400 hover:bg-indigo-50"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Icon className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-sm font-medium text-slate-800">{label}</span>
                <span className="block text-xs text-slate-400">{desc}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function IconButton({
  children,
  title,
  danger,
  onClick,
}: {
  children: React.ReactNode
  title: string
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 ${
        danger ? 'hover:text-red-600' : 'hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  )
}

import { slugify, validateEntry } from '@justjson/core'
import type { Collection, Field, Schema, Singleton } from '@justjson/core'
import { FileCog, Image as ImageIcon, Plus, Search, Settings2, Trash2, Upload } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { RichText } from './RichText'
import { SchemaBuilder } from './SchemaBuilder'
import * as api from './api'
import { FIELD_META } from './field-types'

type Selection =
  | { kind: 'schema' }
  | { kind: 'collection'; name: string }
  | { kind: 'entry'; collection: string; slug: string }
  | { kind: 'newEntry'; collection: string }
  | { kind: 'singleton'; name: string }

export function App() {
  const [schema, setSchema] = useState<Schema | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)

  const reload = useCallback(async () => {
    const s = await api.getSchema()
    setSchema(s)
    return s
  }, [])

  useEffect(() => {
    api
      .getSchema()
      .then((s) => {
        setSchema(s)
        if (s.collections.length === 0 && s.singletons.length === 0) {
          setSelection({ kind: 'schema' })
        }
      })
      .catch(() => setError('Şema yüklenemedi. `justjson serve` çalışıyor mu?'))
  }, [])

  if (error) return <Centered>{error}</Centered>
  if (!schema) return <Centered>Yükleniyor…</Centered>

  return (
    <div className="flex h-full">
      <Sidebar schema={schema} selection={selection} onSelect={setSelection} />
      <main className="flex-1 overflow-hidden bg-slate-50">
        <MainArea schema={schema} selection={selection} onSelect={setSelection} onReload={reload} />
      </main>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-slate-500">{children}</div>
  )
}

function Sidebar({
  schema,
  selection,
  onSelect,
}: {
  schema: Schema
  selection: Selection | null
  onSelect: (s: Selection) => void
}) {
  const collectionActive = (name: string): boolean => {
    if (!selection) return false
    if (selection.kind === 'collection') return selection.name === name
    if (selection.kind === 'entry' || selection.kind === 'newEntry')
      return selection.collection === name
    return false
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="px-5 py-4 text-lg font-bold tracking-tight text-slate-900">
        Just<span className="text-indigo-600">JSON</span>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        <NavItem
          icon={<Settings2 className="h-4 w-4" />}
          active={selection?.kind === 'schema'}
          onClick={() => onSelect({ kind: 'schema' })}
        >
          Şema
        </NavItem>

        {schema.collections.length > 0 && <NavLabel>Koleksiyonlar</NavLabel>}
        {schema.collections.map((c) => (
          <NavItem
            key={c.name}
            active={collectionActive(c.name)}
            onClick={() => onSelect({ kind: 'collection', name: c.name })}
          >
            {c.label ?? c.name}
          </NavItem>
        ))}

        {schema.singletons.length > 0 && <NavLabel>Tekil</NavLabel>}
        {schema.singletons.map((s) => (
          <NavItem
            key={s.name}
            icon={<FileCog className="h-4 w-4" />}
            active={selection?.kind === 'singleton' && selection.name === s.name}
            onClick={() => onSelect({ kind: 'singleton', name: s.name })}
          >
            {s.label ?? s.name}
          </NavItem>
        ))}
      </nav>
    </aside>
  )
}

function NavLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pt-4 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
      {children}
    </p>
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
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
        active ? 'bg-indigo-50 font-medium text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {icon}
      <span className="truncate">{children}</span>
    </button>
  )
}

function MainArea({
  schema,
  selection,
  onSelect,
  onReload,
}: {
  schema: Schema
  selection: Selection | null
  onSelect: (s: Selection) => void
  onReload: () => Promise<Schema>
}) {
  if (!selection) return <Centered>Soldan bir koleksiyon seç.</Centered>

  if (selection.kind === 'schema') {
    return <SchemaBuilder schema={schema} onSaved={() => void onReload()} />
  }

  if (selection.kind === 'collection') {
    const col = schema.collections.find((c) => c.name === selection.name)
    if (!col) return <Centered>Koleksiyon yok.</Centered>
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
    if (!col) return <Centered>Koleksiyon yok.</Centered>
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
  if (!s) return <Centered>Tekil yok.</Centered>
  return <SingletonEditor key={s.name} singleton={s} />
}

function Page({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto h-full max-w-3xl overflow-y-auto px-8 py-6">{children}</div>
}

function PageHead({
  title,
  crumb,
  actions,
}: { title: string; crumb?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <h1 className="text-xl font-semibold text-slate-900">
        {title}
        {crumb && <span className="ml-2 font-normal text-slate-400">/ {crumb}</span>}
      </h1>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
    >
      {children}
    </button>
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
          <PrimaryButton onClick={onNew}>
            <Plus className="h-4 w-4" /> Yeni kayıt
          </PrimaryButton>
        }
      />

      {rows && rows.length > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            placeholder="Ara…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <span className="text-xs text-slate-400">{filtered?.length ?? 0} kayıt</span>
        </div>
      )}

      {rows === null && <p className="text-sm text-slate-400">Yükleniyor…</p>}
      {rows?.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <p className="text-sm text-slate-500">Henüz kayıt yok.</p>
          <button
            type="button"
            onClick={onNew}
            className="mt-3 text-sm font-medium text-indigo-600 hover:underline"
          >
            İlk kaydı oluştur →
          </button>
        </div>
      )}

      {filtered && rows && rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2.5 font-medium">Başlık</th>
                <th className="px-4 py-2.5 font-medium">Slug</th>
                <th className="px-4 py-2.5 text-right font-medium">Güncellendi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((row) => (
                <tr
                  key={row.slug}
                  tabIndex={0}
                  onClick={() => onOpen(row.slug)}
                  onKeyDown={(e) => e.key === 'Enter' && onOpen(row.slug)}
                  className="cursor-pointer transition hover:bg-indigo-50/40 focus:bg-indigo-50 focus:outline-none"
                >
                  <td className="px-4 py-3 font-medium text-slate-800">{row.title}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{row.slug}</td>
                  <td className="px-4 py-3 text-right text-xs text-slate-400">
                    {formatDate(row.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
        setSaveError(`"${effectiveSlug}" zaten var — farklı bir slug seç.`)
        return
      }
      onSaved(await api.putEntry(collection.name, effectiveSlug, data))
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (isNew) return
    await api.deleteEntry(collection.name, slug as string)
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
              <button
                type="button"
                onClick={remove}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" /> Sil
              </button>
            )}
            <PrimaryButton onClick={save} disabled={saving || !result.ok}>
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </PrimaryButton>
          </>
        }
      />
      {saveError && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {saveError}
        </p>
      )}
      {isNew && (
        <FieldShell label="dosya adı (slug)" hint={effectiveSlug}>
          <TextInput value={newSlug} onChange={(v) => setNewSlug(v)} placeholder="otomatik" />
        </FieldShell>
      )}
      <div className="space-y-5">
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
          <PrimaryButton onClick={save} disabled={saving || !result.ok}>
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </PrimaryButton>
        }
      />
      <div className="space-y-5">
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
          className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        >
          <span className="font-mono text-slate-700">{i.key}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              i.level === 'error' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'
            }`}
          >
            {i.level === 'error' ? 'hata' : 'uyarı'}
          </span>
          <span className="text-slate-500">{i.message}</span>
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
    <div>
      <div className="mb-1.5 flex items-center gap-2 text-sm">
        {Icon && <Icon className="h-3.5 w-3.5 text-slate-400" />}
        <span className="font-medium text-slate-700">{label}</span>
        {required && <span className="text-red-500">*</span>}
        {hint && <span className="ml-auto font-mono text-xs text-indigo-500">{hint}</span>}
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
    <FieldShell label={field.label ?? field.key} required={field.required} type={field.type}>
      <FieldInput field={field} value={value} onChange={onChange} />
    </FieldShell>
  )
}

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100'

function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <input
      type={type}
      className={inputClass}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
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
        <input
          type="number"
          className={inputClass}
          value={value === undefined ? '' : String(value)}
          onChange={(e) => onChange(k, e.target.value === '' ? '' : Number(e.target.value))}
        />
      )
    case 'boolean':
      return (
        <button
          type="button"
          onClick={() => onChange(k, !value)}
          className={`relative h-6 w-11 rounded-full transition ${value ? 'bg-indigo-600' : 'bg-slate-300'}`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${value ? 'left-[22px]' : 'left-0.5'}`}
          />
        </button>
      )
    case 'date':
      return (
        <input
          type="date"
          className={inputClass}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(k, e.target.value)}
        />
      )
    case 'select':
      return (
        <select
          className={inputClass}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(k, e.target.value)}
        >
          <option value="">—</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      )
    case 'relation':
      return <RelationInput field={field} value={value} onChange={onChange} />
    case 'image':
      return <ImageInput value={value} onChange={(v) => onChange(k, v)} />
    default:
      return <TextInput value={(value as string) ?? ''} onChange={(v) => onChange(k, v)} />
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

  const toggle = (slug: string) => {
    const next = selected.includes(slug) ? selected.filter((s) => s !== slug) : [...selected, slug]
    onChange(field.key, next.length ? next : '')
  }

  if (options.length === 0)
    return <p className="text-sm text-slate-400">“{field.to}” içinde kayıt yok.</p>

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((slug) => {
        const on = selected.includes(slug)
        return (
          <button
            type="button"
            key={slug}
            onClick={() => toggle(slug)}
            className={`rounded-full px-3 py-1 font-mono text-xs transition ${
              on
                ? 'bg-indigo-600 text-white'
                : 'border border-slate-200 bg-white text-slate-500 hover:border-indigo-300'
            }`}
          >
            {slug}
          </button>
        )
      })}
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
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        {src ? (
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <ImageIcon className="h-6 w-6 text-slate-300" />
        )}
      </div>
      <div className="space-y-1.5">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-indigo-300">
          <Upload className="h-4 w-4" />
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
            <span className="font-mono text-xs text-slate-400">{path}</span>
            <button
              type="button"
              onClick={() => onChange('')}
              className="text-xs text-slate-400 hover:text-red-600"
            >
              kaldır
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

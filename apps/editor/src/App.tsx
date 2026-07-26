import { slugify, validateEntry } from '@justjson/core'
import type { Collection, Field, Schema, Singleton } from '@justjson/core'
import { useCallback, useEffect, useMemo, useState } from 'react'
import * as api from './api'

type Selection =
  | { kind: 'collection'; name: string }
  | { kind: 'entry'; collection: string; slug: string }
  | { kind: 'newEntry'; collection: string }
  | { kind: 'singleton'; name: string }

export function App() {
  const [schema, setSchema] = useState<Schema | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)

  useEffect(() => {
    api
      .getSchema()
      .then(setSchema)
      .catch(() => setError('Şema yüklenemedi. `justjson serve` çalışıyor mu?'))
  }, [])

  if (error) return <div className="app center">{error}</div>
  if (!schema) return <div className="app center">Yükleniyor…</div>

  return (
    <div className="editor">
      <Sidebar schema={schema} selection={selection} onSelect={setSelection} />
      <MainArea schema={schema} selection={selection} onSelect={setSelection} />
    </div>
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
    <aside className="sidebar">
      <div className="brand">
        Just<span>JSON</span>
      </div>
      {schema.collections.length > 0 && <p className="nav-label">Koleksiyonlar</p>}
      {schema.collections.map((c) => (
        <button
          type="button"
          key={c.name}
          className={`nav-item ${collectionActive(c.name) ? 'active' : ''}`}
          onClick={() => onSelect({ kind: 'collection', name: c.name })}
        >
          {c.label ?? c.name}
        </button>
      ))}
      {schema.singletons.length > 0 && <p className="nav-label">Tekil</p>}
      {schema.singletons.map((s) => (
        <button
          type="button"
          key={s.name}
          className={`nav-item ${selection?.kind === 'singleton' && selection.name === s.name ? 'active' : ''}`}
          onClick={() => onSelect({ kind: 'singleton', name: s.name })}
        >
          {s.label ?? s.name}
        </button>
      ))}
    </aside>
  )
}

function MainArea({
  schema,
  selection,
  onSelect,
}: {
  schema: Schema
  selection: Selection | null
  onSelect: (s: Selection) => void
}) {
  if (!selection) return <main className="main center muted">Soldan bir koleksiyon seç.</main>

  if (selection.kind === 'collection') {
    const col = schema.collections.find((c) => c.name === selection.name)
    if (!col) return <main className="main center">Koleksiyon yok.</main>
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
    if (!col) return <main className="main center">Koleksiyon yok.</main>
    const slug = selection.kind === 'entry' ? selection.slug : null
    return (
      <EntryEditor
        key={`${col.name}/${slug ?? 'new'}`}
        schema={schema}
        collection={col}
        slug={slug}
        onSaved={(s) => onSelect({ kind: 'entry', collection: col.name, slug: s })}
        onDeleted={() => onSelect({ kind: 'collection', name: col.name })}
      />
    )
  }

  const s = schema.singletons.find((x) => x.name === selection.name)
  if (!s) return <main className="main center">Tekil yok.</main>
  return <SingletonEditor key={s.name} schema={schema} singleton={s} />
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
  const [slugs, setSlugs] = useState<string[] | null>(null)

  useEffect(() => {
    api.listEntries(collection.name).then(setSlugs)
  }, [collection.name])

  return (
    <main className="main">
      <div className="head">
        <h1>{collection.label ?? collection.name}</h1>
        <button type="button" className="primary" onClick={onNew}>
          + Yeni kayıt
        </button>
      </div>
      {slugs === null && <p className="muted">Yükleniyor…</p>}
      {slugs?.length === 0 && <p className="muted">Henüz kayıt yok.</p>}
      <ul className="entry-list">
        {slugs?.map((slug) => (
          <li key={slug}>
            <button type="button" onClick={() => onOpen(slug)}>
              {slug}
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}

function useEntryData(load: () => Promise<api.Entry | null>, initial: api.Entry) {
  const [data, setData] = useState<api.Entry>(initial)
  const [loading, setLoading] = useState(true)
  // biome-ignore lint/correctness/useExhaustiveDependencies: sadece mount'ta yükle; yeniden bağlanma key prop'u ile kontrol ediliyor
  useEffect(() => {
    let alive = true
    load().then((d) => {
      if (alive) {
        setData(d ?? initial)
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
  schema,
  collection,
  slug,
  onSaved,
  onDeleted,
}: {
  schema: Schema
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
  const { data, setData, loading } = useEntryData(load, {})
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
      const saved = await api.putEntry(collection.name, effectiveSlug, data)
      onSaved(saved)
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (isNew) return
    await api.deleteEntry(collection.name, slug as string)
    onDeleted()
  }

  if (loading) return <main className="main center muted">Yükleniyor…</main>

  return (
    <main className="main">
      <div className="head">
        <h1>
          {collection.label ?? collection.name}
          <span className="crumb">/ {isNew ? 'yeni' : slug}</span>
        </h1>
        <div className="actions">
          {!isNew && (
            <button type="button" className="danger" onClick={remove}>
              Sil
            </button>
          )}
          <button type="button" className="primary" onClick={save} disabled={saving || !result.ok}>
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </div>

      {saveError && <p className="save-error">{saveError}</p>}

      {isNew && (
        <label className="row">
          <span className="label">
            dosya adı (slug)<code>→ {effectiveSlug}</code>
          </span>
          <input
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value)}
            placeholder="otomatik"
          />
        </label>
      )}

      <FormFields schema={schema} fields={collection.fields} data={data} setField={setField} />
      <Issues result={result} />
    </main>
  )
}

function SingletonEditor({ schema, singleton }: { schema: Schema; singleton: Singleton }) {
  const load = useCallback(() => api.getSingleton(singleton.name), [singleton.name])
  const { data, setData, loading } = useEntryData(load, {})
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

  if (loading) return <main className="main center muted">Yükleniyor…</main>

  return (
    <main className="main">
      <div className="head">
        <h1>{singleton.label ?? singleton.name}</h1>
        <button type="button" className="primary" onClick={save} disabled={saving || !result.ok}>
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
      <FormFields schema={schema} fields={singleton.fields} data={data} setField={setField} />
      <Issues result={result} />
    </main>
  )
}

function Issues({ result }: { result: ReturnType<typeof validateEntry> }) {
  if (result.issues.length === 0) return null
  return (
    <div className="issues">
      {result.issues.map((i) => (
        <div key={`${i.key}-${i.message}`} className={`issue ${i.level}`}>
          <span className="k">{i.key}</span>
          <span className="lvl">{i.level === 'error' ? 'hata' : 'uyarı'}</span>
          <span className="msg">{i.message}</span>
        </div>
      ))}
    </div>
  )
}

function FormFields({
  schema,
  fields,
  data,
  setField,
}: {
  schema: Schema
  fields: Field[]
  data: api.Entry
  setField: (key: string, value: unknown) => void
}) {
  return (
    <form>
      {fields.map((field) => (
        // biome-ignore lint/a11y/noLabelWithoutControl: kontrol FieldInput içinde render ediliyor
        <label className="row" key={field.key}>
          <span className="label">
            {field.label ?? field.key}
            {field.required && <i>*</i>}
            <code>{field.type}</code>
          </span>
          <FieldInput schema={schema} field={field} value={data[field.key]} onChange={setField} />
        </label>
      ))}
    </form>
  )
}

function FieldInput({
  schema,
  field,
  value,
  onChange,
}: {
  schema: Schema
  field: Field
  value: unknown
  onChange: (key: string, value: unknown) => void
}) {
  const k = field.key
  switch (field.type) {
    case 'richtext':
      return (
        <textarea
          rows={5}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(k, e.target.value)}
          placeholder="markdown…"
        />
      )
    case 'number':
      return (
        <input
          type="number"
          value={value === undefined ? '' : String(value)}
          onChange={(e) => onChange(k, e.target.value === '' ? '' : Number(e.target.value))}
        />
      )
    case 'boolean':
      return (
        <span className="switch">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(k, e.target.checked)}
          />
          <em>{value ? 'true' : 'false'}</em>
        </span>
      )
    case 'date':
      return (
        <input
          type="date"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(k, e.target.value)}
        />
      )
    case 'select':
      return (
        <select value={(value as string) ?? ''} onChange={(e) => onChange(k, e.target.value)}>
          <option value="">—</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      )
    case 'relation':
      return <RelationInput schema={schema} field={field} value={value} onChange={onChange} />
    case 'image':
      return (
        <input
          type="url"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(k, e.target.value)}
          placeholder="content/media/…"
        />
      )
    default:
      return (
        <input
          type="text"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(k, e.target.value)}
        />
      )
  }
}

function RelationInput({
  field,
  value,
  onChange,
}: {
  schema: Schema
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

  return (
    <div className="relation">
      {options.length === 0 && <span className="muted small">"{field.to}" içinde kayıt yok</span>}
      {options.map((slug) => (
        <button
          type="button"
          key={slug}
          className={`chip ${selected.includes(slug) ? 'on' : ''}`}
          onClick={() => toggle(slug)}
        >
          {slug}
        </button>
      ))}
    </div>
  )
}

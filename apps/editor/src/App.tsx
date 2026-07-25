import { generateTypes, parseSchema, validateEntry } from '@justjson/core'
import type { Field } from '@justjson/core'
import { useMemo, useState } from 'react'

const schema = parseSchema({
  version: 1,
  collections: [
    {
      name: 'posts',
      label: 'Yazılar',
      path: 'posts',
      fields: [
        { key: 'title', label: 'Başlık', type: 'text', required: true },
        { key: 'slug', label: 'Slug', type: 'text', required: true },
        { key: 'excerpt', label: 'Özet', type: 'text' },
        { key: 'body', label: 'İçerik', type: 'richtext' },
        { key: 'cover', label: 'Kapak görseli', type: 'image' },
        { key: 'readingMinutes', label: 'Okuma süresi (dk)', type: 'number' },
        { key: 'published', label: 'Yayında', type: 'boolean' },
        { key: 'publishedAt', label: 'Yayın tarihi', type: 'date' },
        {
          key: 'status',
          label: 'Durum',
          type: 'select',
          options: ['draft', 'review', 'published'],
          required: true,
        },
      ],
    },
  ],
  singletons: [],
})

const collection = schema.collections[0]

const initialEntry: Record<string, unknown> = {
  title: 'Merhaba JustJSON',
  slug: 'merhaba-justjson',
  status: 'draft',
  published: false,
}

type Tab = 'json' | 'types' | 'issues'

export function App() {
  const [entry, setEntry] = useState<Record<string, unknown>>(initialEntry)
  const [tab, setTab] = useState<Tab>('json')

  const set = (key: string, value: unknown) =>
    setEntry((prev) => {
      const next = { ...prev }
      if (value === '' || value === undefined) delete next[key]
      else next[key] = value
      return next
    })

  const result = useMemo(() => validateEntry(collection.fields, entry), [entry])
  const types = useMemo(() => generateTypes(schema), [])
  const json = JSON.stringify(entry, null, 2)
  const errorCount = result.issues.filter((i) => i.level === 'error').length
  const warnCount = result.issues.filter((i) => i.level === 'warning').length

  return (
    <div className="app">
      <header>
        <div className="brand">
          Just<span>JSON</span>
        </div>
        <p>
          Şemadan üretilen form → canlı JSON. Aşağıdaki her şey <code>@justjson/core</code> ile
          hesaplanıyor.
        </p>
      </header>

      <main>
        <section className="panel">
          <div className="panel-head">
            <h2>{collection.label}</h2>
            <span className={`badge ${result.ok ? 'ok' : 'bad'}`}>
              {result.ok ? 'geçerli' : `${errorCount} hata`}
            </span>
          </div>
          <form>
            {collection.fields.map((field) => (
              <FieldRow key={field.key} field={field} value={entry[field.key]} onChange={set} />
            ))}
          </form>
        </section>

        <section className="panel">
          <div className="tabs">
            <button
              type="button"
              className={tab === 'json' ? 'active' : ''}
              onClick={() => setTab('json')}
            >
              JSON
            </button>
            <button
              type="button"
              className={tab === 'types' ? 'active' : ''}
              onClick={() => setTab('types')}
            >
              types.ts
            </button>
            <button
              type="button"
              className={tab === 'issues' ? 'active' : ''}
              onClick={() => setTab('issues')}
            >
              Doğrulama {result.issues.length > 0 && <em>{result.issues.length}</em>}
            </button>
          </div>

          {tab === 'json' && <pre className="code">{json}</pre>}
          {tab === 'types' && <pre className="code">{types}</pre>}
          {tab === 'issues' && (
            <div className="issues">
              {result.issues.length === 0 && (
                <p className="empty">Sorun yok — içerik şemaya uygun.</p>
              )}
              {result.issues.map((issue) => (
                <div key={`${issue.key}-${issue.message}`} className={`issue ${issue.level}`}>
                  <span className="k">{issue.key}</span>
                  <span className="lvl">{issue.level === 'error' ? 'hata' : 'uyarı'}</span>
                  <span className="msg">{issue.message}</span>
                </div>
              ))}
              {result.issues.length > 0 && (
                <p className="hint">
                  {warnCount} uyarı, {errorCount} hata — uyarılar kaydetmeyi engellemez (gevşek
                  doğrulama).
                </p>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function FieldRow({
  field,
  value,
  onChange,
}: {
  field: Field
  value: unknown
  onChange: (key: string, value: unknown) => void
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: kontrol FieldInput içinde render ediliyor
    <label className="row">
      <span className="label">
        {field.label ?? field.key}
        {field.required && <i>*</i>}
        <code>{field.type}</code>
      </span>
      <FieldInput field={field} value={value} onChange={onChange} />
    </label>
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
      return (
        <textarea
          rows={4}
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

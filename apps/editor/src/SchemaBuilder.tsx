import { slugify } from '@justjson/core'
import type { Collection, Field, FieldType, Schema, Singleton } from '@justjson/core'
import { useState } from 'react'
import * as api from './api'

const TYPES: FieldType[] = [
  'text',
  'richtext',
  'number',
  'boolean',
  'date',
  'select',
  'relation',
  'image',
]

type Container = Collection | Singleton

function clone(s: Schema): Schema {
  return JSON.parse(JSON.stringify(s)) as Schema
}

function uniqueName(base: string, taken: string[]): string {
  let n = 1
  let name = `${base}${n}`
  while (taken.includes(name)) {
    n += 1
    name = `${base}${n}`
  }
  return name
}

function move<T>(arr: T[], idx: number, dir: -1 | 1): void {
  const to = idx + dir
  if (to < 0 || to >= arr.length) return
  const [item] = arr.splice(idx, 1)
  arr.splice(to, 0, item as T)
}

export function SchemaBuilder({ schema, onSaved }: { schema: Schema; onSaved: () => void }) {
  const [draft, setDraft] = useState<Schema>(() => clone(schema))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const collectionNames = draft.collections.map((c) => c.name)
  const update = (fn: (d: Schema) => void) =>
    setDraft((prev) => {
      const d = clone(prev)
      fn(d)
      return d
    })

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
    <main className="main schema">
      <div className="head">
        <h1>Şema</h1>
        <button type="button" className="primary" onClick={save} disabled={saving}>
          {saving ? 'Kaydediliyor…' : 'Şemayı kaydet'}
        </button>
      </div>
      {error && <p className="save-error">{error}</p>}

      <section>
        <div className="section-head">
          <h2>Koleksiyonlar</h2>
          <button
            type="button"
            className="ghost"
            onClick={() =>
              update((d) => {
                const name = uniqueName(
                  'koleksiyon',
                  d.collections.map((c) => c.name),
                )
                d.collections.push({ name, label: 'Yeni koleksiyon', path: name, fields: [] })
              })
            }
          >
            + Koleksiyon
          </button>
        </div>
        {draft.collections.map((col, i) => (
          <ContainerCard
            // biome-ignore lint/suspicious/noArrayIndexKey: kart kontrollü; ad düzenlenebilir olduğu için stabil index gerekli (focus korunur)
            key={i}
            container={col}
            kind="collection"
            collectionNames={collectionNames}
            onChange={(fn) => update((d) => fn(d.collections[i] as Container))}
            onRemove={() => update((d) => d.collections.splice(i, 1))}
            onMove={(dir) => update((d) => move(d.collections, i, dir))}
          />
        ))}
      </section>

      <section>
        <div className="section-head">
          <h2>Tekil</h2>
          <button
            type="button"
            className="ghost"
            onClick={() =>
              update((d) => {
                const name = uniqueName(
                  'tekil',
                  d.singletons.map((s) => s.name),
                )
                d.singletons.push({ name, label: 'Yeni tekil', path: `${name}.json`, fields: [] })
              })
            }
          >
            + Tekil
          </button>
        </div>
        {draft.singletons.map((s, i) => (
          <ContainerCard
            // biome-ignore lint/suspicious/noArrayIndexKey: kart kontrollü; ad düzenlenebilir olduğu için stabil index gerekli (focus korunur)
            key={i}
            container={s}
            kind="singleton"
            collectionNames={collectionNames}
            onChange={(fn) => update((d) => fn(d.singletons[i] as Container))}
            onRemove={() => update((d) => d.singletons.splice(i, 1))}
            onMove={(dir) => update((d) => move(d.singletons, i, dir))}
          />
        ))}
      </section>
    </main>
  )
}

function ContainerCard({
  container,
  kind,
  collectionNames,
  onChange,
  onRemove,
  onMove,
}: {
  container: Container
  kind: 'collection' | 'singleton'
  collectionNames: string[]
  onChange: (fn: (c: Container) => void) => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
}) {
  const setName = (value: string) => {
    const name = slugify(value)
    onChange((c) => {
      c.name = name
      c.path = kind === 'collection' ? name : `${name}.json`
    })
  }

  return (
    <div className="card">
      <div className="card-head">
        <input
          className="title-input"
          value={container.label ?? ''}
          placeholder="Etiket"
          onChange={(e) =>
            onChange((c) => {
              c.label = e.target.value
            })
          }
        />
        <input
          className="name-input"
          value={container.name}
          placeholder="ad"
          onChange={(e) => setName(e.target.value)}
        />
        <div className="card-actions">
          <button type="button" className="icon" onClick={() => onMove(-1)}>
            ↑
          </button>
          <button type="button" className="icon" onClick={() => onMove(1)}>
            ↓
          </button>
          <button type="button" className="icon danger" onClick={onRemove}>
            ✕
          </button>
        </div>
      </div>

      {container.fields.map((field, i) => (
        <FieldRow
          // biome-ignore lint/suspicious/noArrayIndexKey: satır kontrollü; anahtar düzenlenebilir olduğu için stabil index gerekli (focus korunur)
          key={i}
          field={field}
          collectionNames={collectionNames}
          onChange={(fn) => onChange((c) => fn(c.fields[i] as Field))}
          onRemove={() => onChange((c) => c.fields.splice(i, 1))}
          onMove={(dir) => onChange((c) => move(c.fields, i, dir))}
        />
      ))}

      <button
        type="button"
        className="ghost small"
        onClick={() =>
          onChange((c) => {
            const key = uniqueName(
              'alan',
              c.fields.map((f) => f.key),
            )
            c.fields.push({ key, label: '', type: 'text' })
          })
        }
      >
        + Alan
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
}: {
  field: Field
  collectionNames: string[]
  onChange: (fn: (f: Field) => void) => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
}) {
  return (
    <div className="field-row">
      <input
        className="key-input"
        value={field.key}
        placeholder="anahtar"
        onChange={(e) =>
          onChange((f) => {
            f.key = slugify(e.target.value)
          })
        }
      />
      <input
        className="flabel-input"
        value={field.label ?? ''}
        placeholder="etiket"
        onChange={(e) =>
          onChange((f) => {
            f.label = e.target.value
          })
        }
      />
      <select
        value={field.type}
        onChange={(e) =>
          onChange((f) => {
            f.type = e.target.value as FieldType
            if (f.type !== 'select') f.options = undefined
            if (f.type !== 'relation') f.to = undefined
          })
        }
      >
        {TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <label className="req">
        <input
          type="checkbox"
          checked={Boolean(field.required)}
          onChange={(e) =>
            onChange((f) => {
              f.required = e.target.checked
            })
          }
        />
        zorunlu
      </label>
      <div className="card-actions">
        <button type="button" className="icon" onClick={() => onMove(-1)}>
          ↑
        </button>
        <button type="button" className="icon" onClick={() => onMove(1)}>
          ↓
        </button>
        <button type="button" className="icon danger" onClick={onRemove}>
          ✕
        </button>
      </div>

      {field.type === 'select' && (
        <input
          className="opts-input"
          value={(field.options ?? []).join(', ')}
          placeholder="seçenekler (virgülle)"
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
          className="opts-input"
          value={field.to ?? ''}
          onChange={(e) =>
            onChange((f) => {
              f.to = e.target.value
            })
          }
        >
          <option value="">hedef koleksiyon…</option>
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

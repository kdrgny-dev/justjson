import { BookOpen, FileStack, History, LayoutGrid, Newspaper, PenLine, User } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import * as api from './api'
import type { TemplateMeta } from './api'

const ICONS: Record<string, LucideIcon> = {
  blog: Newspaper,
  cv: User,
  portfolio: LayoutGrid,
  docs: BookOpen,
  changelog: History,
}

export function TemplateGallery({
  onApplied,
  onScratch,
}: {
  onApplied: () => void
  onScratch: () => void
}) {
  const [templates, setTemplates] = useState<TemplateMeta[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [applying, setApplying] = useState<string | null>(null)

  useEffect(() => {
    api
      .listTemplates()
      .then(setTemplates)
      .catch(() => setError('Template listesi yüklenemedi.'))
  }, [])

  const apply = async (id: string) => {
    setError(null)
    setApplying(id)
    try {
      await api.applyTemplate(id)
      onApplied()
    } catch (e) {
      setError((e as Error).message)
      setApplying(null)
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-4xl px-8 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Bir template seç</h1>
          <p className="mt-1 text-sm text-slate-500">
            Hazır bir şemayla hızlı başla — dilediğin gibi düzenlersin. Ya da sıfırdan kur.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {templates?.map((t) => {
            const Icon = ICONS[t.id] ?? FileStack
            const busy = applying === t.id
            return (
              <button
                key={t.id}
                type="button"
                disabled={applying !== null}
                onClick={() => apply(t.id)}
                className="group flex flex-col rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md disabled:opacity-60"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 transition group-hover:bg-indigo-100">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-base font-semibold text-slate-900">{t.title}</span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-500">{t.description}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {t.collections.map((c) => (
                    <span
                      key={c.label}
                      className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
                    >
                      {c.label} · {c.fields} alan
                    </span>
                  ))}
                  {t.singletons.map((s) => (
                    <span
                      key={s.label}
                      className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
                    >
                      {s.label}
                    </span>
                  ))}
                </div>
                <span className="mt-4 text-sm font-medium text-indigo-600">
                  {busy ? 'Uygulanıyor…' : 'Bu template’i kullan →'}
                </span>
              </button>
            )
          })}

          {!templates && !error && <p className="text-sm text-slate-400">Yükleniyor…</p>}
        </div>

        <button
          type="button"
          onClick={onScratch}
          disabled={applying !== null}
          className="mt-6 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
        >
          <PenLine className="h-4 w-4" />
          Sıfırdan başla
        </button>
      </div>
    </div>
  )
}

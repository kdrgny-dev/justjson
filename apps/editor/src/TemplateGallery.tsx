import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  AlertCircle,
  BookOpen,
  Braces,
  FileStack,
  FileText,
  History,
  LayoutGrid,
  Loader2,
  Newspaper,
  PenLine,
  Rows3,
  User,
} from 'lucide-react'
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

function structureSummary(t: TemplateMeta) {
  const parts: string[] = []
  if (t.collections.length) parts.push(`${t.collections.length} koleksiyon`)
  if (t.singletons.length) parts.push(`${t.singletons.length} tekil`)
  return parts.join(' · ')
}

function SkeletonCard() {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="size-10 shrink-0 animate-pulse rounded-lg bg-muted" />
          <div className="h-4 w-28 animate-pulse rounded bg-muted" />
        </div>
        <div className="mt-2 h-3 w-full animate-pulse rounded bg-muted" />
        <div className="mt-1.5 h-3 w-2/3 animate-pulse rounded bg-muted" />
      </CardHeader>
      <CardContent className="flex-1 space-y-1.5">
        <div className="h-8 animate-pulse rounded-md bg-muted" />
        <div className="h-8 animate-pulse rounded-md bg-muted" />
      </CardContent>
      <CardFooter>
        <div className="h-9 w-full animate-pulse rounded-lg bg-muted" />
      </CardFooter>
    </Card>
  )
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
      .catch(() => setError('Şablon listesi yüklenemedi.'))
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

  const busy = applying !== null

  return (
    <div className="h-full overflow-y-auto bg-muted/30">
      <div className="mx-auto max-w-5xl px-6 py-12 sm:px-8">
        <header className="mb-9 max-w-2xl">
          <div className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Braces className="size-3.5" />
            </span>
            JustJSON
          </div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Bir şablon seç
          </h1>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            İçeriğini görsel olarak düzenle; her şey klasöründe düz JSON olarak kalır — sunucu yok,
            hesap yok.
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Seçtiğin şablon, içerik dosyalarını ve şemanı senin için oluşturur — hepsini sonra
            değiştirebilirsin.
          </p>
        </header>

        {error && (
          <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates === null && !error && [0, 1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}

          {templates?.map((t) => {
            const Icon = ICONS[t.id] ?? FileStack
            const active = applying === t.id
            return (
              <Card
                key={t.id}
                className="h-full transition-shadow hover:shadow-md data-[busy=true]:opacity-60"
                data-busy={busy && !active}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                      <Icon className="size-5" />
                    </span>
                    <CardTitle className="text-base">{t.title}</CardTitle>
                  </div>
                  <CardDescription className="mt-2 leading-relaxed">
                    {t.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex-1">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Oluşturulacak yapı
                    </span>
                    <span className="text-xs text-muted-foreground/80">{structureSummary(t)}</span>
                  </div>
                  <div className="space-y-1.5">
                    {t.collections.map((c) => (
                      <div
                        key={c.label}
                        className="flex items-center gap-2 rounded-md bg-muted/60 px-2.5 py-1.5"
                      >
                        <Rows3 className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate text-sm font-medium text-foreground">
                          {c.label}
                        </span>
                        <Badge variant="secondary" className="ml-auto shrink-0 font-normal">
                          {c.fields} alan
                        </Badge>
                      </div>
                    ))}
                    {t.singletons.map((s) => (
                      <div
                        key={s.label}
                        className="flex items-center gap-2 rounded-md bg-muted/60 px-2.5 py-1.5"
                      >
                        <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate text-sm font-medium text-foreground">
                          {s.label}
                        </span>
                        <Badge variant="outline" className="ml-auto shrink-0 font-normal">
                          tekil
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>

                <CardFooter>
                  <Button className="h-9 w-full" disabled={busy} onClick={() => apply(t.id)}>
                    {active ? (
                      <>
                        <Loader2 className="animate-spin" />
                        Uygulanıyor…
                      </>
                    ) : (
                      'Bu şablonu kullan'
                    )}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}

          <Card
            className="h-full border border-dashed border-border bg-transparent ring-0 transition-colors hover:border-foreground/25 data-[busy=true]:opacity-60"
            data-busy={busy}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <PenLine className="size-5" />
                </span>
                <CardTitle className="text-base">Sıfırdan başla</CardTitle>
              </div>
              <CardDescription className="mt-2 leading-relaxed">
                Boş bir şemayla başla, koleksiyonlarını ve alanlarını kendin tanımla.
              </CardDescription>
            </CardHeader>

            <CardContent className="flex-1">
              <div className="flex h-full items-center rounded-md border border-dashed border-border/70 px-3 py-4 text-sm text-muted-foreground">
                Henüz içerik yok — yapıyı baştan sen kurarsın.
              </div>
            </CardContent>

            <CardFooter>
              <Button variant="outline" className="h-9 w-full" disabled={busy} onClick={onScratch}>
                Boş projeyle devam et
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}

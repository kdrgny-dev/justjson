import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  AlertCircle,
  BookOpen,
  Braces,
  CalendarDays,
  ChefHat,
  FileJson,
  FileStack,
  FileText,
  History,
  LayoutGrid,
  Loader2,
  Newspaper,
  PenLine,
  Rows3,
  ShoppingBag,
  Sparkles,
  Upload,
  User,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAiSettings } from './ai/AiSettingsContext'
import * as api from './api'
import type { TemplateMeta } from './api'

const ICONS: Record<string, LucideIcon> = {
  blog: Newspaper,
  cv: User,
  portfolio: LayoutGrid,
  docs: BookOpen,
  changelog: History,
  recipe: ChefHat,
  event: CalendarDays,
  catalog: ShoppingBag,
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

const SCHEMA_SYSTEM_PROMPT = [
  'Bir headless CMS için içerik şeması tasarlıyorsun.',
  'SADECE geçerli JSON döndür — açıklama, markdown kod bloğu ya da başka metin ekleme.',
  'Tam olarak şu şekle uy:',
  '{"version":1,"collections":[{"name":"ingilizce-cogul-kimlik","label":"Görünen ad","path":"ayni-kimlik","fields":[{"key":"alan_adi","label":"Görünen ad","type":"text|richtext|number|boolean|date|select|relation|image","required":true}]}],"singletons":[{"name":"ingilizce-kimlik","label":"Görünen ad","path":"isim.json","fields":[...]}]}',
  'Kullanıcının anlattığı içeriğe göre alan tiplerini akıllıca seç: uzun/biçimli metin için richtext, tarih için date, sabit seçenekli alan için select (bir de "options" dizisi ekle), görsel için image, başka bir koleksiyona bağlantı için relation (bir de hedef koleksiyonun name\'ini "to" alanına yaz).',
  "En az bir koleksiyon üret. Her koleksiyonda title/slug'a benzer bir kimlik alanı olsun.",
  'name ve key değerleri İngilizce, kebap/snake-case, kısa olsun. label değerleri kullanıcının dilinde olsun.',
].join(' ')

function stripCodeFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim()
}

function AiScaffoldPanel({ onApplied, disabled }: { onApplied: () => void; disabled: boolean }) {
  const { config, openSettings } = useAiSettings()
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = async () => {
    if (!config) {
      openSettings()
      return
    }
    if (!prompt.trim()) return
    setError(null)
    setBusy(true)
    try {
      const raw = await api.aiGenerate(config, SCHEMA_SYSTEM_PROMPT, prompt.trim())
      let schema: unknown
      try {
        schema = JSON.parse(stripCodeFence(raw))
      } catch {
        throw new Error('AI geçerli bir JSON döndürmedi, tekrar dene.')
      }
      await api.importProject(schema)
      onApplied()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="mb-8 rounded-2xl border border-primary/30 bg-accent/40 p-6 sm:p-8">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <Sparkles className="size-4" /> AI ile oluştur
        </div>
        <button
          type="button"
          onClick={openSettings}
          className="text-xs text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
        >
          {config ? 'AI ayarları' : 'Sağlayıcı bağla'}
        </button>
      </div>
      <h2 className="mt-2 font-heading text-lg font-semibold text-foreground sm:text-xl">
        Ne yöneteceğini anlat, şemayı senin için tasarlasın
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Kendi API key'inle çalışır — tamamen opsiyonel, hiçbir şey bize gitmez. Sadece koleksiyon ve
        alanları üretir; içeriği sen girersin.
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start">
        <Textarea
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value)
            if (error) setError(null)
          }}
          disabled={busy || disabled}
          rows={2}
          placeholder='Örn. "Tarif paylaştığım bir blog; kategori, zorluk seviyesi ve pişirme süresi olsun"'
          className="min-h-0 flex-1 resize-none bg-card"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void generate()
          }}
        />
        <Button
          onClick={generate}
          disabled={busy || disabled || !prompt.trim()}
          className="shrink-0 sm:mt-0"
        >
          {busy ? (
            <>
              <Loader2 className="animate-spin" /> Oluşturuluyor…
            </>
          ) : (
            <>
              <Sparkles /> Şema oluştur
            </>
          )}
        </Button>
      </div>

      {!config && (
        <p className="mt-3 text-xs text-muted-foreground">
          Henüz bir AI sağlayıcı bağlamadın — butona basınca ayarlar açılacak.
        </p>
      )}

      {error && (
        <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}
    </div>
  )
}

function ImportCard({ onApplied, disabled }: { onApplied: () => void; disabled: boolean }) {
  const [open, setOpen] = useState(false)
  const [raw, setRaw] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    try {
      setRaw(await file.text())
    } catch {
      setError('Dosya okunamadı.')
    }
  }

  const runImport = async () => {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      setError('Geçersiz JSON')
      return
    }
    const schema =
      parsed && typeof parsed === 'object' && 'schema' in parsed
        ? (parsed as { schema: unknown }).schema
        : parsed
    setError(null)
    setImporting(true)
    try {
      await api.importProject(schema)
      setOpen(false)
      onApplied()
    } catch (e) {
      setError((e as Error).message)
      setImporting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next && !importing) {
          setRaw('')
          setError(null)
        }
      }}
    >
      <Card
        className="h-full border border-dashed border-border bg-transparent ring-0 transition-colors hover:border-foreground/25 data-[busy=true]:opacity-60"
        data-busy={disabled}
      >
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <FileJson className="size-5" />
            </span>
            <CardTitle className="text-base">İçe aktar — kendi JSON'un</CardTitle>
          </div>
          <CardDescription className="mt-2 leading-relaxed">
            Elindeki JSON'u getir; JustJSON yapıyı çıkarıp projeni kurar.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex-1">
          <div className="flex h-full items-center rounded-md border border-dashed border-border/70 px-3 py-4 text-sm text-muted-foreground">
            İçerik JSON'un ya da hazır bir{' '}
            <code className="mx-1 font-mono text-xs text-foreground">_schema.json</code> — yapı
            otomatik çıkarılır.
          </div>
        </CardContent>

        <CardFooter>
          <DialogTrigger asChild>
            <Button variant="outline" className="h-9 w-full" disabled={disabled}>
              Kendi JSON'unu içe aktar
            </Button>
          </DialogTrigger>
        </CardFooter>
      </Card>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Kendi JSON'unu içe aktar</DialogTitle>
          <DialogDescription>
            İçerik JSON'unu (ör. bir JustFields dışa aktarımı) ya da hazır bir{' '}
            <code className="font-mono text-xs">_schema.json</code>'u yapıştır/seç — JustJSON
            koleksiyon ve tekil yapısını otomatik çıkarır.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-foreground">JSON</span>
            <label
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'cursor-pointer',
                importing && 'pointer-events-none opacity-50',
              )}
            >
              <Upload />
              Dosya seç
              <input
                type="file"
                accept=".json,application/json"
                className="sr-only"
                disabled={importing}
                onChange={handleFile}
              />
            </label>
          </div>

          <Textarea
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value)
              if (error) setError(null)
            }}
            disabled={importing}
            spellCheck={false}
            rows={10}
            placeholder='{ "collections": { ... }, "singletons": { ... } }'
            className="max-h-72 resize-y font-mono text-xs leading-relaxed"
          />

          {error && (
            <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span className="break-words">{error}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" disabled={importing}>
              Vazgeç
            </Button>
          </DialogClose>
          <Button disabled={importing || !raw.trim()} onClick={runImport}>
            {importing ? (
              <>
                <Loader2 className="animate-spin" />
                İçe aktarılıyor…
              </>
            ) : (
              'İçe aktar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

        <AiScaffoldPanel onApplied={onApplied} disabled={busy} />

        <div className="mb-5 flex items-center gap-3 text-xs font-medium text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          ya da bir şablonla başla
          <span className="h-px flex-1 bg-border" />
        </div>

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

          <ImportCard onApplied={onApplied} disabled={busy} />
        </div>
      </div>
    </div>
  )
}

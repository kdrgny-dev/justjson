// Hosted modda entry editöründe "Yapay Zeka Çeviri" modalı.
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { t } from './i18n'
import { Check, Globe, Languages, Loader2, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getHostedConfig, type HostedI18n } from './browser/hosted'
import { translateEntry, type Field } from './i18n-translate'

const NAMES: Record<string, { label: string; flag: string }> = {
  tr: { label: 'Türkçe', flag: '🇹🇷' },
  en: { label: 'English', flag: '🇬🇧' },
  de: { label: 'Deutsch', flag: '🇩🇪' },
  es: { label: 'Español', flag: '🇪🇸' },
  fr: { label: 'Français', flag: '🇫🇷' },
  it: { label: 'Italiano', flag: '🇮🇹' },
  ru: { label: 'Русский', flag: '🇷🇺' },
  ar: { label: 'العربية', flag: '🇸🇦' },
  fa: { label: 'فارسی', flag: '🇮🇷' },
  zh: { label: '中文', flag: '🇨🇳' },
  ja: { label: '日本語', flag: '🇯🇵' },
  pt: { label: 'Português', flag: '🇵🇹' },
  nl: { label: 'Nederlands', flag: '🇳🇱' },
}

export function TranslateButton({
  collection,
  data,
  disabled,
}: {
  collection: { name: string; fields: Field[] }
  data: Record<string, unknown>
  disabled?: boolean
}) {
  const [i18n, setI18n] = useState<HostedI18n | null>(null)
  const [open, setOpen] = useState(false)
  const [targets, setTargets] = useState<Set<string>>(new Set())
  const [overwrite, setOverwrite] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getHostedConfig().then((config) => setI18n(config?.i18n ?? null))
  }, [])

  const source = typeof data.locale === 'string' ? data.locale : ''
  const hasLocaleField = collection.fields.some((f) => f.key === 'locale')
  if (!i18n || !hasLocaleField) return null

  const candidates = i18n.locales.filter((code) => code !== source)

  const toggle = (code: string) =>
    setTargets((prev) => {
      const next = new Set(prev)
      next.has(code) ? next.delete(code) : next.add(code)
      return next
    })

  const selectAll = () => setTargets(new Set(candidates))
  const clearAll = () => setTargets(new Set())

  async function run() {
    if (!source) return toast.error(t('Please select the source language of this entry first.'))
    if (targets.size === 0) return
    setBusy(true)
    try {
      const result = await translateEntry({
        collection,
        data,
        source,
        targets: [...targets],
        overwrite,
      })
      const parts: string[] = []
      if (result.written.length) {
        parts.push(
          `${result.written.map((c) => NAMES[c]?.label ?? c).join(', ')} başarıyla oluşturuldu`,
        )
      }
      if (result.skipped.length) {
        parts.push(
          `${result.skipped.map((c) => NAMES[c]?.label ?? c).join(', ')} atlandı (zaten mevcut)`,
        )
      }
      toast.success(parts.join(' · ') || 'Çeviri tamamlandı')
      if (result.written.length) toast.info(t('Remember to publish your changes.'))
      setOpen(false)
      setTargets(new Set())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const sourceMeta = NAMES[source] ?? { label: source, flag: '🌐' }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled} className="gap-1.5 shadow-xs">
          <Languages className="h-4 w-4 text-primary" />
          <span>{t('AI Translation')}</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>{t('AI Translation')}</DialogTitle>
              <DialogDescription>{t('Translate into other languages')}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Source language badge */}
          <div className="flex items-center justify-between rounded-xl border border-border/80 bg-muted/30 p-3 text-xs">
            <span className="text-muted-foreground">{t('Source language')}</span>
            <Badge variant="secondary" className="gap-1 font-medium">
              <span>{sourceMeta.flag}</span>
              <span>{sourceMeta.label}</span>
            </Badge>
          </div>

          {/* Target language selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">{t('Target languages')}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  {t('Select all')}
                </button>
                <span className="text-muted-foreground/40">·</span>
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  {t('Clear selection')}
                </button>
              </div>
            </div>

            {candidates.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                {t('No other language available in project configuration.')}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {candidates.map((code) => {
                  const meta = NAMES[code] ?? { label: code, flag: '🌐' }
                  const isSelected = targets.has(code)
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => toggle(code)}
                      className={cn(
                        'flex items-center justify-between rounded-xl border p-2.5 text-left text-xs font-medium transition-all',
                        isSelected
                          ? 'border-primary/40 bg-primary/5 text-foreground ring-1 ring-primary/20 shadow-xs'
                          : 'border-border/80 bg-card text-muted-foreground hover:border-border hover:bg-muted/30 hover:text-foreground',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{meta.flag}</span>
                        <span>{meta.label}</span>
                      </div>
                      <div
                        className={cn(
                          'flex h-4 w-4 items-center justify-center rounded-full border transition-colors',
                          isSelected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-muted-foreground/30 bg-transparent',
                        )}
                      >
                        {isSelected && <Check className="h-2.5 w-2.5" />}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Overwrite option */}
          <div className="flex items-center justify-between rounded-xl border border-border/80 bg-muted/20 p-3">
            <span className="text-xs text-muted-foreground">
              {t('Overwrite existing translation')}
            </span>
            <Switch checked={overwrite} onCheckedChange={setOverwrite} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={busy}>
            {t('Cancel')}
          </Button>
          <Button
            size="sm"
            onClick={run}
            disabled={busy || targets.size === 0}
            className="gap-1.5 shadow-xs"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {busy ? t('Translating…') : t('Translate & Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

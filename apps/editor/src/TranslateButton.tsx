// Hosted modda entry editöründe "Çevir" düğmesi. Kaydın mevcut dilinden seçilen
// hedef dillere kardeş kayıtları otomatik üretir. Yalnızca site kendi çeviri
// ucunu sunuyorsa (studio-config.i18n) ve kayıtta locale varsa görünür.
import { Button } from '@/components/ui/button'
import { Languages, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { getHostedConfig, type HostedI18n } from './browser/hosted'
import { translateEntry, type Field } from './i18n-translate'

const NAMES: Record<string, string> = {
  tr: 'Türkçe',
  en: 'English',
  de: 'Deutsch',
  es: 'Español',
  ru: 'Русский',
  ar: 'العربية',
  fa: 'فارسی',
  zh: '中文',
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
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getHostedConfig().then((config) => setI18n(config?.i18n ?? null))
  }, [])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

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

  async function run() {
    if (!source) return toast.error('Önce kaydın dilini seç.')
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
      if (result.written.length)
        parts.push(`${result.written.map((c) => NAMES[c] ?? c).join(', ')} yazıldı`)
      if (result.skipped.length)
        parts.push(`${result.skipped.map((c) => NAMES[c] ?? c).join(', ')} atlandı (zaten var)`)
      toast.success(parts.join(' · ') || 'Bir şey yapılmadı')
      if (result.written.length) toast.info('Yayınla’ya basmayı unutma.')
      setOpen(false)
      setTargets(new Set())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <Button variant="outline" disabled={disabled} onClick={() => setOpen((v) => !v)}>
        <Languages /> Çevir
      </Button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 rounded-lg border bg-popover p-3 shadow-lg">
          <p className="mb-2 text-sm font-medium">Hedef diller</p>
          {candidates.length === 0 && (
            <p className="text-xs text-muted-foreground">Çevrilecek başka dil yok.</p>
          )}
          <div className="grid gap-1.5">
            {candidates.map((code) => (
              <label key={code} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={targets.has(code)} onChange={() => toggle(code)} />
                {NAMES[code] ?? code}
              </label>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
            Var olan çevirinin üzerine yaz
          </label>
          <Button className="mt-3 w-full" onClick={run} disabled={busy || targets.size === 0}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
            Çevir ve oluştur
          </Button>
        </div>
      )}
    </div>
  )
}

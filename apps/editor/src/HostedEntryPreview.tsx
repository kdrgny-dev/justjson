// Hosted modda bir kaydın yanındaki önizleme = o kaydın YAYINDAKI sayfası.
// Custom Astro teması tarayıcıda render edilemez; gerçek v2'yi göstermenin yolu
// canlı sayfayı iframe'lemek. Yayınlanmamış düzenlemeleri göstermez (draft değil).
import { Button } from '@/components/ui/button'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getHostedConfig, hostedEntryUrl } from './browser/hosted'

export function HostedEntryPreview({
  collection,
  locale,
  slug,
}: {
  collection: string
  locale?: string
  slug?: string
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    getHostedConfig().then((c) => setUrl(hostedEntryUrl(c, collection, locale, slug)))
  }, [collection, locale, slug])

  if (!url) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Bu kayıt için ayrı bir sayfa yok.
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2 text-xs text-muted-foreground">
        <span>Yayındaki sayfa — kaydet &amp; Yayınla sonrası güncellenir</span>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setNonce((n) => n + 1)}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => window.open(url, '_blank', 'noopener')}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <iframe key={nonce} src={url} title="preview" className="min-h-0 w-full flex-1 bg-white" />
    </div>
  )
}

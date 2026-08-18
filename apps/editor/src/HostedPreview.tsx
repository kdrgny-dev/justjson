// Hosted modda önizleme = YAYINDAKI site. Custom Astro teması tarayıcıda birebir
// render edilemez; bu yüzden gerçek siteyi iframe'de gösterir. Yayınla'dan sonra
// içerik burada güncellenir.
import { Button } from '@/components/ui/button'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getHostedConfig } from './browser/hosted'
import { PageBody, PageHeader, PageShell } from './components/PageShell'

export function HostedPreview() {
  const [site, setSite] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    getHostedConfig().then((c) => setSite(c?.site ?? null))
  }, [])

  return (
    <PageShell>
      <PageHeader
        title="Önizleme"
        subtitle="Yayındaki siten. Yayınla’ya bastıktan sonra değişiklikler burada görünür."
        actions={
          site ? (
            <>
              <Button variant="outline" onClick={() => setNonce((n) => n + 1)}>
                <RefreshCw className="h-4 w-4" />
                Yenile
              </Button>
              <Button onClick={() => window.open(site, '_blank', 'noopener')}>
                <ExternalLink className="h-4 w-4" />
                Yeni sekmede aç
              </Button>
            </>
          ) : undefined
        }
      />
      <PageBody>
        {site ? (
          <iframe
            key={nonce}
            src={site}
            title="site"
            className="h-[78vh] w-full rounded-lg border bg-white"
          />
        ) : (
          <p className="p-5 text-sm text-muted-foreground">Site adresi tanımlı değil.</p>
        )}
      </PageBody>
    </PageShell>
  )
}

import { Button } from '@/components/ui/button'
import { AlertTriangle, ExternalLink, Loader2, Play, RefreshCw, Square } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import * as api from './api'
import { PageBody, PageHeader, PageShell } from './components/PageShell'
import { t } from './i18n'

export function Preview() {
  const [state, setState] = useState<api.PreviewState>({ status: 'idle' })
  const [nonce, setNonce] = useState(0)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const pollRef = useRef<number | null>(null)

  const stopPolling = () => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  const refresh = useCallback(async () => {
    try {
      setState(await api.getPreview())
    } catch {
      /* sunucu kapanıyorsa yok say */
    }
  }, [])

  useEffect(() => {
    void refresh()
    return stopPolling
  }, [refresh])

  // Dev sunucusu ayağa kalkana kadar durumu izleriz; URL gelince dururuz.
  useEffect(() => {
    if (state.status === 'starting' && pollRef.current === null) {
      pollRef.current = window.setInterval(refresh, 1000)
    }
    if (state.status !== 'starting') stopPolling()
  }, [state.status, refresh])

  const start = async () => {
    setState({ status: 'starting' })
    setState(await api.startPreview())
  }

  const stop = async () => {
    setState(await api.stopPreview())
  }

  const reload = () => setNonce((n) => n + 1)

  return (
    <PageShell>
      <PageHeader
        title={t('Preview')}
        subtitle={t('Your site, running live. Edit content and refresh to see it change.')}
        actions={
          state.status === 'running' ? (
            <>
              <Button variant="outline" onClick={reload}>
                <RefreshCw /> {t('Refresh')}
              </Button>
              <a
                href={state.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                <ExternalLink className="size-4" /> {t('Open in a tab')}
              </a>
              <Button variant="outline" onClick={stop}>
                <Square /> {t('Stop')}
              </Button>
            </>
          ) : undefined
        }
      />
      <PageBody>
        {state.status === 'running' ? (
          <iframe
            ref={frameRef}
            key={nonce}
            src={state.url}
            title={t('Site preview')}
            className="h-full w-full border-0 bg-white"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-8">
            <div className="max-w-sm text-center">
              {state.status === 'starting' ? (
                <>
                  <Loader2 className="mx-auto mb-4 size-7 animate-spin text-primary" />
                  <p className="font-medium text-foreground">{t('Starting your dev server…')}</p>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {t('The first start can take a moment while it warms up.')}
                  </p>
                </>
              ) : state.status === 'error' ? (
                <>
                  <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                    <AlertTriangle className="size-5" />
                  </div>
                  <p className="font-medium text-foreground">{t('Could not start the preview')}</p>
                  <p className="mt-1.5 text-sm text-muted-foreground">{state.message}</p>
                  <Button className="mt-5" onClick={start}>
                    <Play /> {t('Try again')}
                  </Button>
                </>
              ) : (
                <>
                  <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                    <Play className="size-5" />
                  </div>
                  <p className="font-medium text-foreground">
                    {t('See your site as you build it')}
                  </p>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {t(
                      'Runs the site in this folder and shows it here. Content and theme changes appear as you make them.',
                    )}
                  </p>
                  <Button className="mt-5" onClick={start}>
                    <Play /> {t('Start preview')}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </PageBody>
    </PageShell>
  )
}

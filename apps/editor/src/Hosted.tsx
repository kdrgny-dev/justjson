// Markalı Hosted Yönetim Paneli: Parolalı güvenli giriş & tek tıkla siteye yayınlama.
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  CheckCircle2,
  CloudUpload,
  ExternalLink,
  KeyRound,
  Layers,
  Loader2,
  LogIn,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { PageBody, PageHeader, PageShell, Surface } from './components/PageShell'
import * as api from './api'
import {
  type BrandConfig,
  getHostedConfig,
  hostedLogin,
  hostedPublish,
  hostedSession,
  hostedSetPassword,
} from './browser/hosted'
import { t } from './i18n'
import { cn } from './lib/utils'

type Phase = 'loading' | 'login' | 'setpw' | 'ready'

export function Hosted({ onChanged }: { onChanged?: () => void }) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [brand, setBrand] = useState<BrandConfig | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [pulling, setPulling] = useState(false)
  const [publishStep, setPublishStep] = useState<number | null>(null)
  const [lastPublished, setLastPublished] = useState<Date | null>(null)

  useEffect(() => {
    getHostedConfig().then((cfg) => {
      if (cfg?.brand) setBrand(cfg.brand)
      else if (cfg?.name || cfg?.title || cfg?.logo) {
        setBrand({
          name: cfg.name,
          title: cfg.title,
          logo: cfg.logo,
        })
      }
    })
  }, [])

  async function loadFromSite(force: boolean) {
    const schema = await api.getSchema().catch(() => null)
    const hasContent = Boolean(schema && (schema.collections.length || schema.singletons.length))
    if (hasContent && !force) return
    setPulling(true)
    try {
      const res = await api.pullFromHosted()
      onChanged?.()
      if (force) toast.success(`${res.pulled} ${t('files loaded from the site.')}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setPulling(false)
    }
  }

  useEffect(() => {
    let alive = true
    hostedSession().then(async (s) => {
      if (!alive) return
      if (s.authed) await loadFromSite(false)
      if (!alive) return
      setPhase(s.authed ? (s.hasPassword ? 'ready' : 'setpw') : 'login')
    })
    return () => {
      alive = false
    }
  }, [])

  async function onLogin() {
    if (!password.trim()) return
    setBusy(true)
    try {
      const { mustSetPassword } = await hostedLogin(password)
      setPassword('')
      if (!mustSetPassword) await loadFromSite(false)
      setPhase(mustSetPassword ? 'setpw' : 'ready')
      toast.success(t('Giriş başarılı'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function onSetPassword() {
    if (password.length < 8) return toast.error(t('weak-password') || 'Parola en az 8 karakter olmalı.')
    if (password !== confirm) return toast.error('Parolalar eşleşmiyor.')
    setBusy(true)
    try {
      await hostedSetPassword(password)
      setPassword('')
      setConfirm('')
      await loadFromSite(false)
      setPhase('ready')
      toast.success('Parola belirlendi.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function onPublish() {
    setBusy(true)
    setPublishStep(1)
    try {
      // Step 1: Hazırlanıyor
      await new Promise((r) => setTimeout(r, 400))
      setPublishStep(2)
      // Step 2: Gönderiliyor
      const result = await hostedPublish()
      setPublishStep(3)
      await new Promise((r) => setTimeout(r, 400))
      if (result.changed === 0 && result.removed === 0) {
        toast.info(t('Nothing to publish.'))
        return
      }
      setLastPublished(new Date())
      toast.success(t('Published. The site updates in about a minute.'))
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      if (message.includes('Oturum yok')) setPhase('login')
      toast.error(message)
    } finally {
      setBusy(false)
      setPublishStep(null)
    }
  }

  const siteDisplayName = brand?.name || 'Studio'
  const welcomeText = brand?.welcomeMessage || brand?.tagline || t('İçerik yönetim paneline hoş geldiniz.')

  return (
    <PageShell>
      <PageHeader
        title={t('Publish to site')}
        subtitle={
          phase === 'ready'
            ? t('Edit your content on the left, then press Publish.')
            : t('Devam etmek için giriş yapın.')
        }
        actions={
          phase === 'ready' ? (
            <Button onClick={onPublish} disabled={busy} className="gap-2 shadow-xs">
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CloudUpload className="h-4 w-4" />
              )}
              {t('Publish to site')}
            </Button>
          ) : undefined
        }
      />
      <PageBody>
        <div className="mx-auto max-w-lg px-4 py-8 sm:px-6">
          {/* Brand Welcome Header */}
          <div className="mb-6 flex flex-col items-center text-center">
            {brand?.logo ? (
              <img
                src={brand.logo}
                alt={siteDisplayName}
                className="mb-3 h-12 w-auto max-w-[180px] object-contain"
              />
            ) : (
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-border/80 bg-card text-primary shadow-xs">
                <ShieldCheck className="h-6 w-6" />
              </div>
            )}
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              {siteDisplayName}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">{welcomeText}</p>
          </div>

          <Surface className="p-6">
            {phase === 'loading' && (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}

            {phase === 'login' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pw" className="text-xs font-medium">
                    {t('Parola')}
                  </Label>
                  <Input
                    id="pw"
                    type="password"
                    value={password}
                    autoFocus
                    placeholder={t('Parola ya da davet kodu')}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && onLogin()}
                    className="h-10"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {t(
                      'İlk girişte size iletilen davet kodunu yazın; ardından kendi parolanızı belirleyebilirsiniz.',
                    )}
                  </p>
                </div>
                <Button onClick={onLogin} disabled={busy} className="w-full gap-2 shadow-xs">
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogIn className="h-4 w-4" />
                  )}
                  {t('Giriş Yap')}
                </Button>
              </div>
            )}

            {phase === 'setpw' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="npw" className="text-xs font-medium">
                    {t('Yeni Parola')}
                  </Label>
                  <Input
                    id="npw"
                    type="password"
                    value={password}
                    autoFocus
                    placeholder={t('En az 8 karakter')}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cpw" className="text-xs font-medium">
                    {t('Parola (Tekrar)')}
                  </Label>
                  <Input
                    id="cpw"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && onSetPassword()}
                    className="h-10"
                  />
                </div>
                <Button onClick={onSetPassword} disabled={busy} className="w-full gap-2 shadow-xs">
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <KeyRound className="h-4 w-4" />
                  )}
                  {t('Parolayı Kaydet')}
                </Button>
              </div>
            )}

            {phase === 'ready' && (
              <div className="space-y-5">
                {/* Publishing Progress Stepper */}
                {publishStep !== null && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <p className="mb-2 text-xs font-semibold text-primary">
                      {t('Publishing in progress')}
                    </p>
                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        {publishStep >= 1 ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <span className="h-3.5 w-3.5 rounded-full border border-border" />
                        )}
                        <span>{t('Step 1: Gathering changes…')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {publishStep >= 2 ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <span className="h-3.5 w-3.5 rounded-full border border-border" />
                        )}
                        <span>{t('Step 2: Packaging content…')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {publishStep >= 3 ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <span className="h-3.5 w-3.5 rounded-full border border-border" />
                        )}
                        <span>{t('Step 3: Deploying to site…')}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-border/80 bg-muted/30 p-4 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{t('Durum')}</span>
                    <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      {t('Bağlı ve hazır')}
                    </span>
                  </div>
                  {lastPublished && (
                    <p className="text-muted-foreground text-[11px]">
                      {t('Son yayınlama:')} {lastPublished.toLocaleTimeString()}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pulling}
                    onClick={() => {
                      if (
                        window.confirm(
                          t(
                            'Sitedeki güncel içerik alınacak. Yayınlanmamış yerel değişiklikleriniz sıfırlanabilir. Devam edilsin mi?',
                          ),
                        )
                      ) {
                        void loadFromSite(true)
                      }
                    }}
                    className="gap-1.5 text-xs shadow-xs"
                  >
                    {pulling ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    {t('Sync content')}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPhase('setpw')}
                    className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    {t('Parolayı Değiştir')}
                  </Button>
                </div>
              </div>
            )}
          </Surface>
        </div>
      </PageBody>
    </PageShell>
  )
}

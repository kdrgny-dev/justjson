import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { KeyRound, Loader2, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { createContext, useContext, useMemo, useState } from 'react'
import { toast } from 'sonner'
import * as api from '../api'
import type { AiModel } from '../api'
import {
  AI_PROVIDERS,
  AI_PROVIDER_MAP,
  type AiConfig,
  type AiProvider,
  clearAiConfig,
  loadAiConfig,
  saveAiConfig,
} from './config'

interface AiSettingsValue {
  config: AiConfig | null
  openSettings: () => void
}

const AiSettingsCtx = createContext<AiSettingsValue | null>(null)

export function useAiSettings(): AiSettingsValue {
  const ctx = useContext(AiSettingsCtx)
  if (!ctx) throw new Error('useAiSettings, AiSettingsProvider içinde kullanılmalı')
  return ctx
}

export function AiSettingsProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AiConfig | null>(() => loadAiConfig())
  const [open, setOpen] = useState(false)

  const [provider, setProvider] = useState<AiProvider>(config?.provider ?? 'gemini')
  const [model, setModel] = useState(config?.model ?? '')
  const [apiKey, setApiKey] = useState(config?.apiKey ?? '')
  const [baseUrl, setBaseUrl] = useState(config?.baseUrl ?? '')

  const [models, setModels] = useState<AiModel[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [manualModel, setManualModel] = useState(false)

  const meta = useMemo(() => AI_PROVIDER_MAP[provider], [provider])

  const openSettings = () => {
    setProvider(config?.provider ?? 'gemini')
    setModel(config?.model ?? '')
    setApiKey(config?.apiKey ?? '')
    setBaseUrl(config?.baseUrl ?? '')
    setModels([])
    setManualModel(false)
    setOpen(true)
  }

  const changeProvider = (p: AiProvider) => {
    setProvider(p)
    setModel('')
    setModels([])
    setManualModel(false)
  }

  const loadModels = async () => {
    const m = AI_PROVIDER_MAP[provider]
    if (!m.needsBaseUrl && !apiKey.trim()) {
      toast.error('Önce API key gir')
      return
    }
    if (m.needsBaseUrl && !baseUrl.trim()) {
      toast.error('Önce taban URL gir')
      return
    }
    setLoadingModels(true)
    try {
      const list = await api.aiListModels({
        provider,
        apiKey: apiKey.trim(),
        ...(m.needsBaseUrl ? { baseUrl: baseUrl.trim() } : {}),
      })
      if (list.length === 0) {
        setManualModel(true)
        toast.error('Model bulunamadı — elle girebilirsin')
        return
      }
      setModels(list)
      setManualModel(false)
      if (!list.some((x) => x.id === model)) setModel(list[0]?.id ?? '')
    } catch (e) {
      setManualModel(true)
      toast.error((e as Error).message)
    } finally {
      setLoadingModels(false)
    }
  }

  const save = () => {
    if (!model.trim()) {
      toast.error('Model adı gerekli')
      return
    }
    if (meta.needsBaseUrl && !baseUrl.trim()) {
      toast.error('Taban URL gerekli')
      return
    }
    if (!meta.needsBaseUrl && !apiKey.trim()) {
      toast.error('API key gerekli')
      return
    }
    const next: AiConfig = {
      provider,
      model: model.trim(),
      apiKey: apiKey.trim(),
      ...(meta.needsBaseUrl ? { baseUrl: baseUrl.trim() } : {}),
    }
    saveAiConfig(next)
    setConfig(next)
    setOpen(false)
    toast.success('AI ayarları kaydedildi')
  }

  const disconnect = () => {
    clearAiConfig()
    setConfig(null)
    setApiKey('')
    setModel('')
    toast.success('AI bağlantısı kaldırıldı')
  }

  return (
    <AiSettingsCtx.Provider value={{ config, openSettings }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" /> AI ayarları
            </DialogTitle>
            <DialogDescription>
              Tamamen opsiyonel. Girdiğin key yalnızca bu tarayıcıda saklanır ve doğrudan
              sağlayıcıya gider — bize hiçbir şey ulaşmaz.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Sağlayıcı</Label>
              <Select value={provider} onValueChange={(v) => changeProvider(v as AiProvider)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AI_PROVIDERS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{meta.hint}</p>
            </div>

            {meta.needsBaseUrl && (
              <div className="space-y-2">
                <Label>Taban URL</Label>
                <Input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="http://localhost:11434/v1"
                  className="font-mono"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>
                API key
                {meta.needsBaseUrl && (
                  <span className="ml-1 font-normal text-muted-foreground">(opsiyonel)</span>
                )}
              </Label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="••••••••••••"
                className="font-mono"
              />
              {meta.keyUrl && (
                <a
                  href={meta.keyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block text-xs text-primary hover:underline"
                >
                  Ücretsiz key al →
                </a>
              )}
            </div>

            <div className="space-y-2">
              <Label>Model</Label>
              {manualModel ? (
                <Input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={meta.modelPlaceholder}
                  className="font-mono"
                />
              ) : models.length === 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={loadModels}
                  disabled={loadingModels}
                >
                  {loadingModels ? (
                    <>
                      <Loader2 className="animate-spin" /> Modeller yükleniyor…
                    </>
                  ) : (
                    'Modelleri yükle'
                  )}
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger className="w-full font-mono">
                      <SelectValue placeholder="Model seç…" />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map((m) => (
                        <SelectItem key={m.id} value={m.id} className="font-mono">
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={loadModels}
                    disabled={loadingModels}
                    title="Modelleri yenile"
                    className="text-muted-foreground"
                  >
                    {loadingModels ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                    <span className="sr-only">Modelleri yenile</span>
                  </Button>
                </div>
              )}
              {!manualModel && models.length > 0 && (
                <button
                  type="button"
                  onClick={() => setManualModel(true)}
                  className="text-xs text-muted-foreground hover:text-primary"
                >
                  Modeli elle gir
                </button>
              )}
            </div>
          </div>

          <DialogFooter className="sm:justify-between">
            {config ? (
              <Button variant="ghost" onClick={disconnect} className="text-muted-foreground">
                Bağlantıyı kaldır
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button variant="outline">Vazgeç</Button>
              </DialogClose>
              <Button onClick={save}>Kaydet</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AiSettingsCtx.Provider>
  )
}

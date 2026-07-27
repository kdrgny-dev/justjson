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
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import * as api from '../api'
import { useAiSettings } from './AiSettingsContext'

export function AIAssist({
  context,
  fieldLabel,
  currentValue,
  richtext,
  onResult,
}: {
  context: string
  fieldLabel: string
  currentValue: string
  richtext?: boolean
  onResult: (text: string) => void
}) {
  const { config, openSettings } = useAiSettings()
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)

  const trigger = () => {
    if (!config) {
      openSettings()
      return
    }
    setPrompt('')
    setOpen(true)
  }

  const generate = async () => {
    if (!config) return
    setBusy(true)
    try {
      const system = [
        `"${context}" içindeki "${fieldLabel}" alanını dolduruyorsun.`,
        richtext
          ? 'Yanıtı Markdown olarak yaz.'
          : 'Yanıtı düz metin olarak, tek satır tercih ederek yaz.',
        'Sadece alanın değerini döndür — açıklama, tırnak ya da ön ek ekleme.',
      ].join(' ')
      const userPrompt = [
        prompt.trim() || `${fieldLabel} için uygun bir içerik üret.`,
        currentValue.trim() ? `\n\nMevcut metin (bunu geliştir/temel al):\n${currentValue}` : '',
      ].join('')
      const text = await api.aiGenerate(config, system, userPrompt)
      onResult(text.trim())
      setOpen(false)
      toast.success('İçerik üretildi')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        onClick={trigger}
        className="text-muted-foreground hover:text-primary"
        title="AI ile doldur"
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span className="sr-only">AI ile doldur</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> {fieldLabel}
            </DialogTitle>
            <DialogDescription>
              Ne istediğini kısaca yaz, model {context} bağlamına göre dolduracak.
              {currentValue.trim() ? ' Mevcut metin bağlam olarak gönderilecek.' : ''}
            </DialogDescription>
          </DialogHeader>

          <Textarea
            autoFocus
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={`Örn. "${fieldLabel} için kısa ve samimi bir metin yaz"`}
            className="min-h-24"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void generate()
            }}
          />

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Vazgeç</Button>
            </DialogClose>
            <Button onClick={generate} disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Üretiliyor…
                </>
              ) : (
                'Oluştur'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

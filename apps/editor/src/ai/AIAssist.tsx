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
import { getLang, t } from '../i18n'
import { useAiSettings } from './AiSettingsContext'

const LANG_INSTRUCTION: Record<string, string> = {
  en: 'Write in English.',
  tr: 'Write in Turkish.',
}

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
        `You are filling in the "${fieldLabel}" field of "${context}".`,
        richtext
          ? 'Write the answer in Markdown.'
          : 'Write the answer as plain text, preferring a single line.',
        'Return only the field value — no explanation, quotes or prefix.',
        LANG_INSTRUCTION[getLang()],
      ].join(' ')
      const userPrompt = [
        prompt.trim() || `Write suitable content for ${fieldLabel}.`,
        currentValue.trim()
          ? `\n\nCurrent text (improve on it / use as a base):\n${currentValue}`
          : '',
      ].join('')
      const text = await api.aiGenerate(config, system, userPrompt)
      onResult(text.trim())
      setOpen(false)
      toast.success(t('Content generated'))
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
        title={t('Fill with AI')}
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span className="sr-only">{t('Fill with AI')}</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> {fieldLabel}
            </DialogTitle>
            <DialogDescription>
              {t(
                'Say what you want in a sentence; the model fills it in using {context} as context.',
                { context },
              )}
              {currentValue.trim() ? ` ${t('The current text is sent along as context.')}` : ''}
            </DialogDescription>
          </DialogHeader>

          <Textarea
            autoFocus
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t('e.g. "write a short, friendly {field}"', { field: fieldLabel })}
            className="min-h-24"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void generate()
            }}
          />

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t('Cancel')}</Button>
            </DialogClose>
            <Button onClick={generate} disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> {t('Generating…')}
                </>
              ) : (
                t('Generate')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

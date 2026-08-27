import { useState, useRef, type DragEvent } from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import * as api from '@/api'
import { fileToWebpBase64 } from '@/lib/media'
import { toast } from 'sonner'
import {
  UploadCloud,
  Image as ImageIcon,
  Trash2,
  Maximize2,
  Link as LinkIcon,
  Loader2,
  RefreshCw,
  X,
  FileImage,
} from 'lucide-react'

interface MediaCardInputProps {
  value: unknown
  onChange: (v: unknown) => void
  disabled?: boolean
}

export function MediaCardInput({ value, onChange, disabled }: MediaCardInputProps) {
  const [busy, setBusy] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [zoomOpen, setZoomOpen] = useState(false)
  const [manualUrlOpen, setManualUrlOpen] = useState(false)
  const [urlDraft, setUrlDraft] = useState('')

  const path = typeof value === 'string' ? value : ''
  const filename = path ? path.split('/').pop() || path : ''
  const isHttpUrl = path.startsWith('http://') || path.startsWith('https://')
  const src = path ? (isHttpUrl ? path : `/media/${filename}`) : null

  const fileInputRef = useRef<HTMLInputElement>(null)

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error(t('That file is not an image.'))
      return
    }
    setBusy(true)
    try {
      const base64 = await fileToWebpBase64(file)
      const uploadedPath = await api.uploadMedia(base64, file.name)
      onChange(uploadedPath)
      toast.success(t('Image uploaded'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled && !busy) setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (disabled || busy) return
    const file = e.dataTransfer.files?.[0]
    if (file) void processFile(file)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void processFile(file)
    e.target.value = ''
  }

  const handleUrlSubmit = () => {
    const trimmed = urlDraft.trim()
    if (trimmed) {
      onChange(trimmed)
      setUrlDraft('')
      setManualUrlOpen(false)
      toast.success(t('Image URL updated'))
    }
  }

  return (
    <div className="space-y-3">
      {path ? (
        <div className="group relative overflow-hidden rounded-xl border border-border/80 bg-card p-3 shadow-xs transition-all hover:border-primary/30">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Visual thumbnail with aspect frame */}
            <div
              onClick={() => setZoomOpen(true)}
              className="relative flex h-28 w-28 shrink-0 cursor-zoom-in items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-muted/40 transition-transform group-hover:scale-[1.01]"
              title={t('Zoom preview')}
            >
              {src ? (
                <img
                  src={src}
                  alt={filename}
                  className="h-full w-full object-cover transition-opacity duration-300"
                  onError={(e) => {
                    // Fallback in case thumbnail cannot be rendered
                    ;(e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              ) : (
                <FileImage className="h-8 w-8 text-muted-foreground/50" />
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 backdrop-blur-xs transition-opacity group-hover:opacity-100">
                <Maximize2 className="h-5 w-5 text-white drop-shadow-md" />
              </div>
            </div>

            {/* Media metadata and action controls */}
            <div className="flex min-w-0 flex-1 flex-col justify-between gap-2.5">
              <div>
                <div className="flex items-center gap-1.5">
                  <FileImage className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate font-medium text-sm text-foreground" title={path}>
                    {filename}
                  </span>
                </div>
                <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground/80">
                  {path}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy || disabled}
                  onClick={() => fileInputRef.current?.click()}
                  className="h-8 gap-1.5 text-xs shadow-xs"
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  {t('Replace image')}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setZoomOpen(true)}
                  className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                  {t('Zoom preview')}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled || busy}
                  onClick={() => onChange('')}
                  className="h-8 gap-1 text-xs text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t('Remove image')}
                </Button>
              </div>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleFileSelect}
          />
        </div>
      ) : (
        /* Empty State Dropzone */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'group relative flex flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center transition-all duration-200',
            isDragging
              ? 'border-primary bg-primary/5 ring-2 ring-primary/20 scale-[0.99]'
              : 'border-border/80 bg-muted/20 hover:border-border hover:bg-muted/35',
            disabled && 'pointer-events-none opacity-60',
          )}
        >
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-border/60 bg-card text-muted-foreground shadow-xs transition-transform group-hover:scale-105">
            {busy ? (
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            ) : (
              <UploadCloud className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
            )}
          </div>

          <p className="text-sm font-medium text-foreground">
            {isDragging ? t('Release to read this file') : t('Upload or drop image')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground/80">
            {t('PNG, JPG, WebP or SVG')}
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <label
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'cursor-pointer shadow-xs gap-1.5 text-xs',
              )}
            >
              <UploadCloud className="h-3.5 w-3.5 text-muted-foreground" />
              {busy ? t('Uploading…') : t('Upload file')}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                disabled={busy || disabled}
                onChange={handleFileSelect}
              />
            </label>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setManualUrlOpen(true)}
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <LinkIcon className="h-3.5 w-3.5" />
              {t('Enter URL')}
            </Button>
          </div>
        </div>
      )}

      {/* Manual URL input modal */}
      <Dialog open={manualUrlOpen} onOpenChange={setManualUrlOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('Enter URL')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              autoFocus
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder="https://example.com/image.jpg veya /media/foto.webp"
              onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setManualUrlOpen(false)}>
                {t('Cancel')}
              </Button>
              <Button size="sm" onClick={handleUrlSubmit} disabled={!urlDraft.trim()}>
                {t('Save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lightbox / Zoom Dialog */}
      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="max-w-4xl p-2 bg-black/90 text-white border-white/10">
          <div className="relative flex max-h-[80vh] items-center justify-center overflow-hidden rounded-lg">
            {src && (
              <img
                src={src}
                alt={filename}
                className="max-h-[75vh] w-auto max-w-full rounded-md object-contain shadow-2xl"
              />
            )}
          </div>
          <div className="flex items-center justify-between px-3 py-2 text-xs text-white/70">
            <span className="truncate">{filename}</span>
            <span className="font-mono">{path}</span>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

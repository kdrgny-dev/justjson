import Image from '@tiptap/extension-image'
import type { Editor } from '@tiptap/react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Loader2,
  Maximize2,
  Minimize2,
  Quote,
  Redo2,
  Undo2,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Markdown } from 'tiptap-markdown'
import { t } from './i18n'
import { fileToDataUrl } from './lib/media'
import { cn } from './lib/utils'

export function RichText({ value, onChange }: { value: string; onChange: (md: string) => void }) {
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [imgBusy, setImgBusy] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const linkInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (linkOpen) linkInputRef.current?.focus()
  }, [linkOpen])

  const editor = useEditor({
    extensions: [StarterKit, Markdown, Image.configure({ allowBase64: true })],
    content: value || '',
    onUpdate: ({ editor }) => {
      const md = editor.storage as unknown as { markdown: { getMarkdown: () => string } }
      onChange(md.markdown.getMarkdown())
    },
    editorProps: {
      attributes: {
        class:
          'tiptap min-h-[140px] px-4 py-3.5 text-sm text-foreground outline-none [&_img]:my-2 [&_img]:max-w-full [&_img]:rounded-lg',
      },
    },
  })

  // Word count & reading stats
  const stats = useMemo(() => {
    const text = value ? value.replace(/[#*`_~[\]()]/g, '').trim() : ''
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0
    const minutes = Math.ceil(words / 200)
    return { words, minutes }
  }, [value])

  if (!editor) return null

  const toggleLink = () => {
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run()
      return
    }
    setLinkUrl(editor.getAttributes('link').href || '')
    setLinkOpen(true)
  }

  const applyLink = () => {
    const url = linkUrl.trim()
    if (url) editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    else editor.chain().focus().unsetLink().run()
    setLinkOpen(false)
    setLinkUrl('')
  }

  const insertImage = async (file: File) => {
    setImgBusy(true)
    try {
      const src = await fileToDataUrl(file)
      editor.chain().focus().setImage({ src }).run()
    } finally {
      setImgBusy(false)
    }
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-input bg-card shadow-xs transition-all focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10',
        fullscreen &&
          'fixed inset-4 z-50 flex flex-col rounded-2xl border-border bg-background shadow-2xl backdrop-blur-xl sm:inset-10',
      )}
    >
      {/* Sticky/Header Toolbar */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-1 border-b border-border/80 bg-muted/40 px-2 py-1.5 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-0.5">
          <Btn editor={editor} on="bold" cmd={(e) => e.toggleBold()} title={t('Bold')}>
            <Bold className="h-4 w-4" />
          </Btn>
          <Btn editor={editor} on="italic" cmd={(e) => e.toggleItalic()} title={t('Italic')}>
            <Italic className="h-4 w-4" />
          </Btn>
          <Sep />
          <Btn
            editor={editor}
            on="heading"
            attrs={{ level: 2 }}
            cmd={(e) => e.toggleHeading({ level: 2 })}
            title={t('Heading 2')}
          >
            <Heading2 className="h-4 w-4" />
          </Btn>
          <Btn
            editor={editor}
            on="heading"
            attrs={{ level: 3 }}
            cmd={(e) => e.toggleHeading({ level: 3 })}
            title={t('Heading 3')}
          >
            <Heading3 className="h-4 w-4" />
          </Btn>
          <Sep />
          <Btn
            editor={editor}
            on="bulletList"
            cmd={(e) => e.toggleBulletList()}
            title={t('Bullet list')}
          >
            <List className="h-4 w-4" />
          </Btn>
          <Btn
            editor={editor}
            on="orderedList"
            cmd={(e) => e.toggleOrderedList()}
            title={t('Ordered list')}
          >
            <ListOrdered className="h-4 w-4" />
          </Btn>
          <Btn editor={editor} on="blockquote" cmd={(e) => e.toggleBlockquote()} title={t('Quote')}>
            <Quote className="h-4 w-4" />
          </Btn>
          <Btn editor={editor} on="codeBlock" cmd={(e) => e.toggleCodeBlock()} title={t('Code')}>
            <Code className="h-4 w-4" />
          </Btn>
          <button
            type="button"
            title={t('Link')}
            onClick={toggleLink}
            className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
              editor.isActive('link')
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-card hover:text-foreground'
            }`}
          >
            <LinkIcon className="h-3.5 w-3.5" />
          </button>
          <label
            title={t('Insert image')}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition hover:bg-card hover:text-foreground"
          >
            {imgBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ImagePlus className="h-3.5 w-3.5" />
            )}
            <input
              type="file"
              accept="image/*"
              hidden
              disabled={imgBusy}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void insertImage(f)
                e.target.value = ''
              }}
            />
          </label>
          <Sep />
          <Btn editor={editor} cmd={(e) => e.undo()} title={t('Undo')}>
            <Undo2 className="h-3.5 w-3.5" />
          </Btn>
          <Btn editor={editor} cmd={(e) => e.redo()} title={t('Redo')}>
            <Redo2 className="h-3.5 w-3.5" />
          </Btn>
        </div>

        {/* Right side fullscreen button */}
        <button
          type="button"
          onClick={() => setFullscreen((v) => !v)}
          title={fullscreen ? t('Exit Focus Mode') : t('Focus Mode')}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-card hover:text-foreground"
        >
          {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Link popup input */}
      {linkOpen && (
        <div className="flex items-center gap-2 border-b border-border/80 bg-card px-3 py-2 text-xs">
          <LinkIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            ref={linkInputRef}
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                applyLink()
              }
              if (e.key === 'Escape') setLinkOpen(false)
            }}
            placeholder="https://…"
            className="h-7 flex-1 rounded-md border border-input bg-muted/30 px-2.5 text-xs outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={applyLink}
            className="h-7 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow-xs"
          >
            {t('Add')}
          </button>
          <button
            type="button"
            onClick={() => setLinkOpen(false)}
            className="h-7 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted"
          >
            {t('Cancel')}
          </button>
        </div>
      )}

      {/* Editor Content Area */}
      <div className={cn('min-h-0 flex-1 overflow-y-auto', fullscreen && 'p-4 sm:p-8 max-w-3xl mx-auto w-full')}>
        <EditorContent editor={editor} />
      </div>

      {/* Stats footer bar */}
      <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-3 py-1.5 text-[11px] text-muted-foreground/70">
        <div className="flex items-center gap-3">
          <span>
            {stats.words} {t('Words')}
          </span>
          <span>·</span>
          <span>
            {stats.minutes} {t('min read')}
          </span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/50">Markdown</span>
      </div>
    </div>
  )
}

type Chain = ReturnType<Editor['chain']>['focus'] extends () => infer R ? R : never

function Btn({
  editor,
  on,
  attrs,
  cmd,
  title,
  children,
}: {
  editor: Editor
  on?: string
  attrs?: Record<string, unknown>
  cmd: (chain: Chain) => Chain
  title: string
  children: React.ReactNode
}) {
  const active = on ? editor.isActive(on, attrs) : false
  return (
    <button
      type="button"
      title={title}
      onClick={() => cmd(editor.chain().focus()).run()}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-md text-xs transition-colors',
        active
          ? 'bg-primary text-primary-foreground shadow-xs'
          : 'text-muted-foreground hover:bg-card hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function Sep() {
  return <span className="mx-1 h-4 w-px bg-border/80" />
}


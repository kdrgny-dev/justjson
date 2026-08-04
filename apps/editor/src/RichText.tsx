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
  Quote,
  Redo2,
  Undo2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Markdown } from 'tiptap-markdown'
import { t } from './i18n'
import { fileToDataUrl } from './lib/media'

export function RichText({ value, onChange }: { value: string; onChange: (md: string) => void }) {
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [imgBusy, setImgBusy] = useState(false)
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
          'tiptap min-h-40 px-4 py-3 text-sm text-foreground outline-none [&_img]:my-2 [&_img]:max-w-full [&_img]:rounded-lg',
      },
    },
  })

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
    <div className="overflow-hidden rounded-lg border border-input bg-card shadow-sm focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/50 px-2 py-1.5">
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
          className={`flex h-8 w-8 items-center justify-center rounded-md transition ${
            editor.isActive('link')
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:bg-accent/60'
          }`}
        >
          <LinkIcon className="h-4 w-4" />
        </button>
        <label
          title={t('Insert image')}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent/60"
        >
          {imgBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ImagePlus className="h-4 w-4" />
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
          <Undo2 className="h-4 w-4" />
        </Btn>
        <Btn editor={editor} cmd={(e) => e.redo()} title={t('Redo')}>
          <Redo2 className="h-4 w-4" />
        </Btn>
      </div>
      {linkOpen && (
        <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-2 py-1.5">
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
            className="h-7 flex-1 rounded-md border border-input bg-card px-2 text-sm outline-none focus:border-ring"
          />
          <button
            type="button"
            onClick={applyLink}
            className="h-7 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground"
          >
            {t('Add')}
          </button>
          <button
            type="button"
            onClick={() => setLinkOpen(false)}
            className="h-7 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent/60"
          >
            {t('Cancel')}
          </button>
        </div>
      )}
      <EditorContent editor={editor} />
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
      className={`flex h-8 w-8 items-center justify-center rounded-md transition ${
        active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/60'
      }`}
    >
      {children}
    </button>
  )
}

function Sep() {
  return <span className="mx-1 h-5 w-px bg-border" />
}

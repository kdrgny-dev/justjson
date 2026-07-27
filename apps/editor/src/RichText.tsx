import type { Editor } from '@tiptap/react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Undo2,
} from 'lucide-react'
import { Markdown } from 'tiptap-markdown'
import { t } from './i18n'

export function RichText({ value, onChange }: { value: string; onChange: (md: string) => void }) {
  const editor = useEditor({
    extensions: [StarterKit, Markdown],
    content: value || '',
    onUpdate: ({ editor }) => {
      const md = editor.storage as unknown as { markdown: { getMarkdown: () => string } }
      onChange(md.markdown.getMarkdown())
    },
    editorProps: {
      attributes: {
        class: 'tiptap min-h-40 px-4 py-3 text-sm text-foreground outline-none',
      },
    },
  })

  if (!editor) return null

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
        <Sep />
        <Btn editor={editor} cmd={(e) => e.undo()} title={t('Undo')}>
          <Undo2 className="h-4 w-4" />
        </Btn>
        <Btn editor={editor} cmd={(e) => e.redo()} title={t('Redo')}>
          <Redo2 className="h-4 w-4" />
        </Btn>
      </div>
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

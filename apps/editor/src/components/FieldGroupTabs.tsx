import { useMemo, useState } from 'react'
import type { Field } from '@justjson/core'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import {
  Layers,
  FileText,
  Image as ImageIcon,
  Sparkles,
  Globe,
  Settings,
  ListFilter,
} from 'lucide-react'

export type FieldGroupId = 'all' | 'general' | 'content' | 'media' | 'seo' | 'other'

export interface FieldGroup {
  id: FieldGroupId
  label: string
  icon: React.ComponentType<{ className?: string }>
  fields: Field[]
}

const SEO_PATTERNS = /^(seo|meta|og_|twitter_|canonical|locale)/i
const MEDIA_PATTERNS = /^(image|photo|picture|avatar|thumbnail|cover|gallery|banner|icon|logo|media|poster)/i
const CONTENT_PATTERNS = /^(body|content|description|bio|text|markdown|richtext|summary|story|article|details)/i

export function categorizeField(field: Field): FieldGroupId {
  const key = field.key.toLowerCase()
  const type = field.type

  if (SEO_PATTERNS.test(key)) return 'seo'
  if (type === 'image' || MEDIA_PATTERNS.test(key)) return 'media'
  if (type === 'richtext' || CONTENT_PATTERNS.test(key)) return 'content'
  if (
    type === 'text' ||
    type === 'number' ||
    type === 'date' ||
    type === 'select' ||
    type === 'boolean' ||
    type === 'relation'
  ) {
    return 'general'
  }
  return 'other'
}

export function useFieldGroups(fields: Field[]): {
  groups: FieldGroup[]
  activeTab: FieldGroupId
  setActiveTab: (id: FieldGroupId) => void
  visibleFields: Field[]
  hasMultipleGroups: boolean
} {
  const [activeTab, setActiveTab] = useState<FieldGroupId>('all')

  const groups = useMemo(() => {
    const map: Record<FieldGroupId, Field[]> = {
      all: fields,
      general: [],
      content: [],
      media: [],
      seo: [],
      other: [],
    }

    for (const f of fields) {
      const cat = categorizeField(f)
      map[cat].push(f)
    }

    const groupList: FieldGroup[] = [
      {
        id: 'all',
        label: t('All Fields'),
        icon: Layers,
        fields: map.all,
      },
    ]

    if (map.general.length > 0) {
      groupList.push({
        id: 'general',
        label: t('General'),
        icon: Settings,
        fields: map.general,
      })
    }

    if (map.content.length > 0) {
      groupList.push({
        id: 'content',
        label: t('Content_tab'),
        icon: FileText,
        fields: map.content,
      })
    }

    if (map.media.length > 0) {
      groupList.push({
        id: 'media',
        label: t('Media'),
        icon: ImageIcon,
        fields: map.media,
      })
    }

    if (map.seo.length > 0) {
      groupList.push({
        id: 'seo',
        label: t('SEO / Meta'),
        icon: Globe,
        fields: map.seo,
      })
    }

    if (map.other.length > 0) {
      groupList.push({
        id: 'other',
        label: t('Other'),
        icon: Sparkles,
        fields: map.other,
      })
    }

    return groupList
  }, [fields])

  // If there's only 1 category present besides 'all', don't split
  const categoryCount = groups.filter((g) => g.id !== 'all' && g.fields.length > 0).length
  const hasMultipleGroups = fields.length >= 5 && categoryCount > 1

  const visibleFields = useMemo(() => {
    if (!hasMultipleGroups || activeTab === 'all') return fields
    const current = groups.find((g) => g.id === activeTab)
    return current ? current.fields : fields
  }, [fields, groups, activeTab, hasMultipleGroups])

  return {
    groups,
    activeTab,
    setActiveTab,
    visibleFields,
    hasMultipleGroups,
  }
}

export function FieldGroupTabBar({
  groups,
  activeTab,
  onSelectTab,
}: {
  groups: FieldGroup[]
  activeTab: FieldGroupId
  onSelectTab: (id: FieldGroupId) => void
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-border/80 bg-muted/40 p-1 text-xs shadow-xs">
      {groups.map((g) => {
        const Icon = g.icon
        const isActive = activeTab === g.id
        return (
          <button
            key={g.id}
            type="button"
            onClick={() => onSelectTab(g.id)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-all duration-150',
              isActive
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-card/50 hover:text-foreground',
            )}
          >
            <Icon className={cn('h-3.5 w-3.5', isActive ? 'text-primary' : 'text-muted-foreground/70')} />
            <span>{g.label}</span>
            <span
              className={cn(
                'ml-0.5 rounded-full px-1.5 py-0.2 text-[10px]',
                isActive ? 'bg-muted text-foreground' : 'text-muted-foreground/60',
              )}
            >
              {g.fields.length}
            </span>
          </button>
        )
      })}
    </div>
  )
}

import type { FieldType } from '@justjson/core'
import type { LucideIcon } from 'lucide-react'
import {
  AtSign,
  Boxes,
  Calendar,
  FileText,
  Hash,
  Image,
  Link,
  Link2,
  List,
  Palette,
  Tags,
  ToggleLeft,
  Type,
} from 'lucide-react'

export interface FieldTypeMeta {
  type: FieldType
  label: string
  desc: string
  icon: LucideIcon
}

export const FIELD_TYPES: FieldTypeMeta[] = [
  { type: 'text', label: 'Text', desc: 'Single line of text', icon: Type },
  { type: 'richtext', label: 'Rich text', desc: 'Markdown content', icon: FileText },
  { type: 'number', label: 'Number', desc: 'Numeric value', icon: Hash },
  { type: 'boolean', label: 'Yes / No', desc: 'True or false', icon: ToggleLeft },
  { type: 'date', label: 'Date', desc: 'Calendar date', icon: Calendar },
  { type: 'select', label: 'Select', desc: 'A fixed list of options', icon: List },
  { type: 'relation', label: 'Relation', desc: 'Link to another collection', icon: Link2 },
  { type: 'image', label: 'Image', desc: 'Image URL or path', icon: Image },
  { type: 'url', label: 'URL', desc: 'Web address', icon: Link },
  { type: 'email', label: 'Email', desc: 'Email address', icon: AtSign },
  { type: 'list', label: 'List', desc: 'Free-text tags', icon: Tags },
  { type: 'color', label: 'Color', desc: 'Hex color picker', icon: Palette },
  { type: 'group', label: 'Group', desc: 'Nested fields', icon: Boxes },
]

export const FIELD_META = Object.fromEntries(FIELD_TYPES.map((f) => [f.type, f])) as Record<
  FieldType,
  FieldTypeMeta
>

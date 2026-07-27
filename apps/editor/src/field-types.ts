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
  { type: 'text', label: 'Metin', desc: 'Tek satır metin', icon: Type },
  { type: 'richtext', label: 'Zengin metin', desc: 'Markdown içerik', icon: FileText },
  { type: 'number', label: 'Sayı', desc: 'Sayısal değer', icon: Hash },
  { type: 'boolean', label: 'Evet / Hayır', desc: 'Doğru veya yanlış', icon: ToggleLeft },
  { type: 'date', label: 'Tarih', desc: 'Takvim tarihi', icon: Calendar },
  { type: 'select', label: 'Seçim', desc: 'Sabit seçenekler listesi', icon: List },
  { type: 'relation', label: 'İlişki', desc: 'Başka koleksiyona bağla', icon: Link2 },
  { type: 'image', label: 'Görsel', desc: 'Resim URL veya yolu', icon: Image },
  { type: 'url', label: 'URL', desc: 'Web adresi', icon: Link },
  { type: 'email', label: 'E-posta', desc: 'E-posta adresi', icon: AtSign },
  { type: 'list', label: 'Liste', desc: 'Serbest metin etiketleri', icon: Tags },
  { type: 'color', label: 'Renk', desc: 'Hex renk seçici', icon: Palette },
  { type: 'group', label: 'Grup', desc: 'İç içe alanlar', icon: Boxes },
]

export const FIELD_META = Object.fromEntries(FIELD_TYPES.map((f) => [f.type, f])) as Record<
  FieldType,
  FieldTypeMeta
>

import { useSyncExternalStore } from 'react'
import { tr } from './locales/tr'

export type Lang = 'en' | 'tr'
export const LANGS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'tr', label: 'Türkçe' },
]

const STORAGE_KEY = 'justjson.lang'

function isLang(value: unknown): value is Lang {
  return value === 'en' || value === 'tr'
}

function initial(): Lang {
  if (typeof localStorage === 'undefined') return 'en'
  const saved = localStorage.getItem(STORAGE_KEY)
  return isLang(saved) ? saved : 'en'
}

let current: Lang = initial()
const subscribers = new Set<() => void>()

if (typeof document !== 'undefined') document.documentElement.lang = current

export function getLang(): Lang {
  return current
}

export function setLang(lang: Lang): void {
  current = lang
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, lang)
  // <html lang> metin dönüşümünü etkiler: tr'de "title" → "TİTLE" olur.
  if (typeof document !== 'undefined') document.documentElement.lang = lang
  for (const notify of subscribers) notify()
}

export function subscribeLang(notify: () => void): () => void {
  subscribers.add(notify)
  return () => {
    subscribers.delete(notify)
  }
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribeLang, getLang, getLang)
}

type Vars = Record<string, string | number>

// Anahtar = İngilizce kaynak metin; çeviri yoksa anahtarın kendisi görünür.
export function t(key: string, vars?: Vars): string {
  const raw = current === 'tr' ? (tr[key] ?? key) : key
  if (!vars) return raw
  return raw.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  )
}

// Türkçe sayıdan sonra çoğul eki almaz; iki anahtar da aynı çeviriye düşer.
export function tp(n: number, one: string, many: string, vars?: Vars): string {
  return t(n === 1 ? one : many, { n, ...vars })
}

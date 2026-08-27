// Hosted publish adaptörü. Site kendi `/api/*` uçlarını sunuyorsa (studio-config
// bunu bildirir), editör GitHub'a doğrudan gitmez: Ömer bir parolayla giriş
// yapar, içerik sunucu üstünden yayınlanır. Token tarayıcıya hiç inmez.
import { collectLocalContent } from '../api'

export interface BrandConfig {
  name?: string
  title?: string
  logo?: string
  favicon?: string
  welcomeMessage?: string
  tagline?: string
  accentColor?: string
}

export interface HostedI18n {
  locales: string[]
  localeField?: string
  groupField?: string
  defaultLocale?: string
}

export interface HostedPreviewConfig {
  /** koleksiyon adı -> site yolu şablonu; ':slug' kayıt slug'ıyla değişir. */
  routes?: Record<string, string>
}

export interface HostedConfig {
  publish: 'hosted'
  i18n?: HostedI18n
  site?: string
  preview?: HostedPreviewConfig
  brand?: BrandConfig
  name?: string
  title?: string
  logo?: string
}

/** Bir kaydın YAYINDAKI sayfa URL'i (varsa). Draft değil; son yayınlanan hâl. */
export function hostedEntryUrl(
  config: HostedConfig | null,
  collection: string,
  locale: string | undefined,
  slug: string | undefined,
): string | null {
  if (!config?.site) return null
  const tpl = config.preview?.routes?.[collection]
  if (tpl === undefined) return null
  const def = config.i18n?.defaultLocale ?? 'tr'
  const loc = locale || def
  const prefix = loc && loc !== def ? `/${loc}` : ''
  const rel = tpl.replace(':slug', slug ?? '').replace(/\/$/, '')
  const path = rel === '/' ? '' : rel
  return `${config.site}${prefix}${path}` || config.site
}

let cache: HostedConfig | null | undefined

export async function getHostedConfig(): Promise<HostedConfig | null> {
  if (cache !== undefined) return cache
  try {
    const res = await fetch('/studio-config.json', { cache: 'no-store' })
    if (!res.ok) return (cache = null)
    const json = (await res.json()) as Partial<HostedConfig>
    cache = json?.publish === 'hosted' ? (json as HostedConfig) : null
  } catch {
    cache = null
  }
  return cache
}

const MESSAGES: Record<string, string> = {
  'bad-credentials': 'Parola ya da davet kodu yanlış.',
  'weak-password': 'Parola en az 8 karakter olmalı.',
  'no-session': 'Oturum yok. Yeniden giriş yapın.',
  'no-password': 'Parola girin.',
  config: 'Sunucu ayarları eksik. Site sahibine bildirin.',
  'tree-truncated': 'İçerik çok büyük, tek seferde okunamadı.',
}

function messageFor(code: string | undefined): string {
  if (!code) return 'Bir hata oldu.'
  if (MESSAGES[code]) return MESSAGES[code]
  if (code.startsWith('git-')) return 'GitHub şu an yanıt vermiyor. Birkaç dakika sonra tekrar deneyin.'
  return 'Bir hata oldu.'
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
    credentials: 'same-origin',
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(messageFor((json as { error?: string }).error))
  return json as T
}

export async function hostedSession(): Promise<{ authed: boolean; hasPassword: boolean }> {
  try {
    const res = await fetch('/api/session', { cache: 'no-store', credentials: 'same-origin' })
    if (!res.ok) return { authed: false, hasPassword: true }
    return (await res.json()) as { authed: boolean; hasPassword: boolean }
  } catch {
    return { authed: false, hasPassword: true }
  }
}

export function hostedLogin(password: string) {
  return post<{ ok: true; mustSetPassword: boolean }>('/api/login', { password })
}

export function hostedSetPassword(password: string) {
  return post<{ ok: true }>('/api/set-password', { password })
}

export async function hostedPublish(): Promise<{ changed: number; removed: number; commitUrl?: string }> {
  const files = await collectLocalContent()
  return post('/api/publish', { files })
}

export async function hostedTranslate(
  fields: Record<string, string>,
  source: string,
  target: string,
): Promise<Record<string, string>> {
  const json = await post<{ ok: true; translated: Record<string, string> }>('/api/translate', {
    fields,
    source,
    target,
  })
  return json.translated
}

export async function hostedPull(): Promise<{ path: string; text: string }[]> {
  const res = await fetch('/api/content', { cache: 'no-store', credentials: 'same-origin' })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(messageFor((json as { error?: string }).error))
  return (json as { files: { path: string; text: string }[] }).files
}

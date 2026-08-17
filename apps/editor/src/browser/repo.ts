// Repo içerik senkronu — studio'yu var olan bir GitHub repo'sunun `content/`
// klasörüne bağlar. Publish adaptörlerinden farkı: burada site render EDİLMEZ.
// Yalnızca içerik JSON'ları okunur ve geri yazılır; repo'nun kodu, teması,
// yapılandırması olduğu gibi kalır (yeni ağaç `base_tree` üstüne kurulur).
//
// Kullanım senaryosu: site elle yazılmış bir Astro/Next projesi, içeriği
// JustJSON formatında; sahibi tarayıcıdan yazı girip yayınlamak istiyor.

const GH = 'https://api.github.com'

export interface RepoLink {
  owner: string
  repo: string
  branch: string
  /** Repo kökünden göreli içerik klasörü, sonunda eğik çizgi yok. */
  contentDir: string
}

export interface RepoFile {
  path: string
  text: string
}

export interface PushResult {
  commitSha: string
  commitUrl: string
  changed: number
  removed: number
}

export class RepoError extends Error {}

const linkKey = (projectId: string) => `jj.repo.${projectId}`
const tokenKey = (projectId: string) => `jj.repo.token.${projectId}`
const syncKey = (projectId: string) => `jj.repo.sync.${projectId}`

/**
 * En son çekilen İÇERİĞİN parmak izi. Publish bunu kontrol eder: hiç
 * çekilmemişse ya da o günden beri içerik başka yerden değişmişse yazmayı
 * reddeder — aksi hâlde tarayıcıdaki eski proje sitenin içeriğini eziyor.
 *
 * Commit sha'sı yerine içerik izi tutulur: siteye kod commit'i atılması
 * içeriği değiştirmez, kullanıcıyı gereksiz yere durdurmamalı.
 */
export function fingerprint(files: RepoFile[]): string {
  const body = [...files]
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((file) => `${file.path}\u0000${file.text}`)
    .join('\u0001')
  // Kısa, çakışması pratikte önemsiz bir özet — kriptografik amaç yok.
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < body.length; i++) {
    const code = body.charCodeAt(i)
    h1 = Math.imul(h1 ^ code, 0x01000193)
    h2 = Math.imul(h2 + code, 0x85ebca6b)
  }
  return `${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}:${files.length}`
}

export function getSyncedCommit(projectId: string, link: RepoLink): string | null {
  const raw = localStorage.getItem(syncKey(projectId))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { key?: string; sha?: string }
    return parsed.key === syncIdentity(link) ? (parsed.sha ?? null) : null
  } catch {
    return null
  }
}

export function setSyncedCommit(projectId: string, link: RepoLink, sha: string): void {
  localStorage.setItem(syncKey(projectId), JSON.stringify({ key: syncIdentity(link), sha }))
}

function syncIdentity(link: RepoLink): string {
  return `${link.owner}/${link.repo}@${link.branch}:${link.contentDir}`
}

export class NotSyncedError extends RepoError {}
export class StaleError extends RepoError {}

export function getRepoLink(projectId: string): RepoLink | null {
  const raw = localStorage.getItem(linkKey(projectId))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<RepoLink>
    if (!parsed.owner || !parsed.repo) return null
    return {
      owner: parsed.owner,
      repo: parsed.repo,
      branch: parsed.branch || 'main',
      contentDir: (parsed.contentDir || 'content').replace(/\/+$/, ''),
    }
  } catch {
    return null
  }
}

export function setRepoLink(projectId: string, link: RepoLink | null): void {
  if (!link) {
    localStorage.removeItem(linkKey(projectId))
    return
  }
  localStorage.setItem(linkKey(projectId), JSON.stringify(link))
}

/** Token oturum boyunca tutulur — publish adaptörleriyle aynı davranış. */
export const getRepoToken = (projectId: string) => sessionStorage.getItem(tokenKey(projectId)) || ''
export const setRepoToken = (projectId: string, token: string) =>
  sessionStorage.setItem(tokenKey(projectId), token.trim())

/** `owner/repo` ya da tam GitHub adresi kabul eder. */
export function parseRepoInput(input: string): { owner: string; repo: string } | null {
  const trimmed = input.trim().replace(/\.git$/, '')
  const fromUrl = trimmed.match(/github\.com[/:]([^/]+)\/([^/]+)/)
  const pair = fromUrl ? [fromUrl[1], fromUrl[2]] : trimmed.split('/')
  if (pair.length !== 2 || !pair[0] || !pair[1]) return null
  return { owner: pair[0], repo: pair[1] }
}

export function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export function decodeBase64(value: string): string {
  const binary = atob(value.replace(/\s/g, ''))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

async function call(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<Record<string, unknown>> {
  // Public repo okuması token istemez; yazma için zaten token şart.
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  }
  if (token.trim()) headers.Authorization = `Bearer ${token.trim()}`
  const res = await fetch(`${GH}${path}`, { ...init, headers })
  if (!res.ok) {
    const detail = await res.text()
    // 403 hem yetkisizlik hem kota aşımı demek olabiliyor; ikisini ayır,
    // yoksa kota dolunca kullanıcı boşuna token'ıyla uğraşıyor.
    if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') {
      const reset = Number(res.headers.get('x-ratelimit-reset') ?? 0)
      const minutes = reset ? Math.max(1, Math.ceil((reset * 1000 - Date.now()) / 60000)) : 0
      throw new RepoError(
        minutes
          ? `GitHub istek kotası doldu — ${minutes} dakika sonra tekrar deneyin.`
          : 'GitHub istek kotası doldu.',
      )
    }
    if (res.status === 401 || res.status === 403) {
      throw new RepoError(
        token.trim()
          ? 'Token geçersiz ya da bu repo için yetkisiz.'
          : 'Depo herkese açık değil — bir token gerekiyor.',
      )
    }
    if (res.status === 404) {
      throw new RepoError('Repo, dal ya da klasör bulunamadı.')
    }
    throw new RepoError(`GitHub ${res.status}: ${detail.slice(0, 160)}`)
  }
  return (await res.json()) as Record<string, unknown>
}

/** Bağlantıyı doğrular ve dalın son commit'ini döndürür. */
export async function checkRepo(
  link: RepoLink,
  token: string,
): Promise<{ commitSha: string; treeSha: string }> {
  const ref = (await call(
    token,
    `/repos/${link.owner}/${link.repo}/git/ref/heads/${link.branch}`,
  )) as {
    object: { sha: string }
  }
  const commit = (await call(
    token,
    `/repos/${link.owner}/${link.repo}/git/commits/${ref.object.sha}`,
  )) as { tree: { sha: string } }
  return { commitSha: ref.object.sha, treeSha: commit.tree.sha }
}

/**
 * Repo'daki içerik klasörünü okur. Dönen anahtarlar repo yollarıdır
 * (`content/articles/x.json`) — studio'nun kendi depolama düzeniyle aynı.
 */
export async function pullContent(link: RepoLink, token: string): Promise<RepoFile[]> {
  const { commitSha } = await checkRepo(link, token)
  const tree = (await call(
    token,
    `/repos/${link.owner}/${link.repo}/git/trees/${commitSha}?recursive=1`,
  )) as { tree?: { path: string; type: string; sha: string }[]; truncated?: boolean }

  if (tree.truncated) {
    throw new RepoError('Repo ağacı çok büyük; içerik klasörü tek seferde okunamadı.')
  }

  const prefix = `${link.contentDir}/`
  const wanted = (tree.tree ?? []).filter(
    (node) => node.type === 'blob' && node.path.startsWith(prefix) && node.path.endsWith('.json'),
  )
  if (wanted.length === 0) {
    throw new RepoError(`${link.contentDir}/ altında JSON bulunamadı.`)
  }

  const files: RepoFile[] = []
  for (const node of wanted) {
    const blob = (await call(token, `/repos/${link.owner}/${link.repo}/git/blobs/${node.sha}`)) as {
      content: string
      encoding: string
    }
    files.push({
      path: node.path,
      text: blob.encoding === 'base64' ? decodeBase64(blob.content) : blob.content,
    })
  }
  return files
}

/**
 * İçerik dosyalarını dala yazar. `base_tree` kullanıldığı için repo'nun geri
 * kalanına dokunulmaz; `removed` yollar ağaçtan düşürülür.
 */
export async function pushContent(
  link: RepoLink,
  token: string,
  files: RepoFile[],
  removed: string[],
  message: string,
): Promise<PushResult> {
  const { commitSha, treeSha } = await checkRepo(link, token)

  const entries: Record<string, unknown>[] = []
  for (const file of files) {
    const blob = (await call(token, `/repos/${link.owner}/${link.repo}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content: encodeBase64(file.text), encoding: 'base64' }),
    })) as { sha: string }
    entries.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha })
  }
  // sha: null bir yolu ağaçtan siler — editörde silinen kayıt repo'da da gitsin.
  for (const path of removed) entries.push({ path, mode: '100644', type: 'blob', sha: null })

  if (entries.length === 0) {
    return { commitSha, commitUrl: '', changed: 0, removed: 0 }
  }

  const tree = (await call(token, `/repos/${link.owner}/${link.repo}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: treeSha, tree: entries }),
  })) as { sha: string }

  const commit = (await call(token, `/repos/${link.owner}/${link.repo}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message, tree: tree.sha, parents: [commitSha] }),
  })) as { sha: string; html_url?: string }

  await call(token, `/repos/${link.owner}/${link.repo}/git/refs/heads/${link.branch}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha }),
  })

  return {
    commitSha: commit.sha,
    commitUrl:
      commit.html_url ?? `https://github.com/${link.owner}/${link.repo}/commit/${commit.sha}`,
    changed: files.length,
    removed: removed.length,
  }
}

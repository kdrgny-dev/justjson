// Netlify adapter — implicit OAuth in a popup (no secret), then a multi-file
// deploy via the Netlify digest API. Runs on the user's own account.
import { NameTakenError, type Provider, type PublishResult } from './index'

const CLIENT_ID = 'Knha7tY8sVFmH9fHvOhz5mRjhfNh7nDEl4DwLnOGhUs'
const NF = 'https://api.netlify.com/api/v1'
const TOKEN_KEY = 'nf_token'

async function sha1(str: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(str))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Popup OAuth: the redirect lands on /studio, which (in main.tsx) posts the
// token back to this opener and closes. No full-page redirect of the editor.
export function connectNetlify(): Promise<string> {
  const cached = sessionStorage.getItem(TOKEN_KEY)
  if (cached) return Promise.resolve(cached)
  const redirect = `${location.origin}/studio`
  const url =
    `https://app.netlify.com/authorize?client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&response_type=token&redirect_uri=${encodeURIComponent(redirect)}`
  return new Promise((resolve, reject) => {
    const popup = window.open(url, 'netlify-oauth', 'width=680,height=760')
    if (!popup) return reject(new Error('Popup engellendi — tarayıcıda izin ver.'))
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== location.origin) return
      const t = (e.data as { nfToken?: string })?.nfToken
      if (!t) return
      window.removeEventListener('message', onMsg)
      clearInterval(iv)
      sessionStorage.setItem(TOKEN_KEY, t)
      resolve(t)
    }
    window.addEventListener('message', onMsg)
    const iv = setInterval(() => {
      if (popup.closed) {
        clearInterval(iv)
        window.removeEventListener('message', onMsg)
        reject(new Error('Netlify penceresi kapatıldı.'))
      }
    }, 500)
  })
}

export function clearNetlifyToken() {
  sessionStorage.removeItem(TOKEN_KEY)
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}`, 'User-Agent': 'justjson-studio' }
}

async function createSite(token: string, name: string): Promise<{ id: string; url: string }> {
  const res = await fetch(`${NF}/sites`, {
    method: 'POST',
    headers: { ...auth(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (res.ok) {
    const s = await res.json()
    return { id: s.id, url: s.ssl_url || s.url || `https://${s.name}.netlify.app` }
  }
  if (res.status === 422 || res.status === 400) throw new NameTakenError(name)
  throw new Error(`Site oluşturulamadı: ${res.status} ${await res.text()}`)
}

async function getSiteUrl(token: string, id: string): Promise<string> {
  const res = await fetch(`${NF}/sites/${id}`, { headers: auth(token) })
  if (!res.ok) throw new Error(`Site bulunamadı: ${res.status}`)
  const s = await res.json()
  return s.ssl_url || s.url || `https://${s.name}.netlify.app`
}

async function publish(
  files: Record<string, string>,
  siteName: string,
  token: string,
  existingSiteId?: string,
): Promise<PublishResult> {
  const site = existingSiteId
    ? { id: existingSiteId, url: await getSiteUrl(token, existingSiteId) }
    : await createSite(token, siteName)

  const digests: Record<string, string> = {}
  const bySha: Record<string, string> = {}
  for (const [path, content] of Object.entries(files)) {
    const d = await sha1(content)
    digests[path] = d
    bySha[d] = path
  }

  const depRes = await fetch(`${NF}/sites/${site.id}/deploys`, {
    method: 'POST',
    headers: { ...auth(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: digests }),
  })
  if (!depRes.ok) throw new Error(`Deploy başlatılamadı: ${depRes.status} ${await depRes.text()}`)
  const dep = await depRes.json()

  for (const need of (dep.required as string[]) || []) {
    const path = bySha[need]
    if (!path) continue
    const up = await fetch(`${NF}/deploys/${dep.id}/files${path}`, {
      method: 'PUT',
      headers: { ...auth(token), 'Content-Type': 'application/octet-stream' },
      body: files[path],
    })
    if (!up.ok) throw new Error(`Yükleme başarısız (${path}): ${up.status}`)
  }
  return { url: site.url, siteId: site.id }
}

export const netlify: Provider = {
  id: 'netlify',
  name: 'Netlify',
  suffix: '.netlify.app',
  auth: { kind: 'oauth', connect: connectNetlify },
  publish,
}

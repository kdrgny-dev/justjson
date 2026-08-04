// Vercel adapter — token-paste (no browser OAuth exists). Deploys inline files
// to a production deployment on the user's account via the REST API. api.vercel.com
// allows browser CORS (verified), so this needs no backend.
import type { Provider, PublishResult } from './index'

const V = 'https://api.vercel.com'

async function publish(
  files: Record<string, string>,
  siteName: string,
  token: string,
  existingSiteId?: string,
): Promise<PublishResult> {
  const name = existingSiteId || siteName
  const payload: Record<string, unknown> = {
    name,
    // Bind to the SAME project on republish (existingSiteId is its id) so
    // Vercel updates the original site instead of spawning a new one; on the
    // first publish it creates a project named after the address.
    ...(existingSiteId ? { project: existingSiteId } : {}),
    files: Object.entries(files).map(([path, data]) => ({ file: path.replace(/^\//, ''), data })),
    projectSettings: { framework: null },
    target: 'production',
  }
  const res = await fetch(`${V}/v13/deployments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = await res.text()
    if (res.status === 401 || res.status === 403)
      throw new Error('Vercel token geçersiz veya yetkisiz.')
    throw new Error(`Vercel deploy başarısız: ${res.status} ${body}`)
  }
  const d = await res.json()
  const alias: string[] = Array.isArray(d.alias) ? d.alias : []
  const host = alias[0] || d.url || `${siteName}.vercel.app`
  return { url: `https://${host}`, siteId: d.projectId || name }
}

export const vercel: Provider = {
  id: 'vercel',
  name: 'Vercel',
  suffix: '.vercel.app',
  auth: {
    kind: 'token',
    tokenUrl: 'https://vercel.com/account/tokens',
    help: 'Vercel → Settings → Tokens → Create. Kapsam: hesabın tümü. Token’ı buraya yapıştır.',
  },
  publish,
}

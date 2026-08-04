// GitHub Pages adapter — token-paste (no secret-less OAuth). api.github.com is
// CORS-friendly, so we push the whole site to a repo via the Git Data API and
// enable Pages, browser-only. Project pages serve under /{repo}/; the renderer
// emits depth-relative links, so the subpath is fine.
import type { Provider, PublishResult } from './index'

const GH = 'https://api.github.com'

export function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(bin)
}

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  }
}

async function gh(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`${GH}${path}`, { ...init, headers: headers(token) })
  return res
}

async function ensureRepo(token: string, owner: string, repo: string): Promise<string> {
  const existing = await gh(token, `/repos/${owner}/${repo}`)
  if (existing.ok) return (await existing.json()).default_branch || 'main'
  if (existing.status !== 404) throw new Error(`Repo okunamadı: ${existing.status}`)
  const created = await gh(token, '/user/repos', {
    method: 'POST',
    body: JSON.stringify({
      name: repo,
      auto_init: true,
      description: 'Built with JustJSON Studio',
    }),
  })
  if (!created.ok) throw new Error(`Repo oluşturulamadı: ${created.status} ${await created.text()}`)
  return (await created.json()).default_branch || 'main'
}

async function refSha(token: string, owner: string, repo: string, branch: string): Promise<string> {
  // A freshly auto-init'd repo may lag; retry the ref a couple times.
  for (let i = 0; i < 4; i++) {
    const res = await gh(token, `/repos/${owner}/${repo}/git/ref/heads/${branch}`)
    if (res.ok) return (await res.json()).object.sha
    if (res.status !== 404 && res.status !== 409) throw new Error(`Ref alınamadı: ${res.status}`)
    await new Promise((r) => setTimeout(r, 800))
  }
  throw new Error('Repo hazır değil — birkaç saniye sonra tekrar dene.')
}

async function publish(
  files: Record<string, string>,
  siteName: string,
  token: string,
  existingSiteId?: string,
): Promise<PublishResult> {
  const me = await gh(token, '/user')
  if (!me.ok) throw new Error('GitHub token geçersiz veya yetkisiz.')
  const owner = (await me.json()).login as string
  const repo = (existingSiteId?.includes('/') ? existingSiteId.split('/')[1] : siteName) || siteName

  const branch = await ensureRepo(token, owner, repo)
  const head = await refSha(token, owner, repo, branch)

  // Blobs → tree (full replacement, no base_tree) → commit → move ref.
  const tree: Array<{ path: string; mode: string; type: string; sha: string }> = []
  const all = { ...files, '/.nojekyll': '' }
  for (const [path, content] of Object.entries(all)) {
    const res = await gh(token, `/repos/${owner}/${repo}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content: toBase64(content), encoding: 'base64' }),
    })
    if (!res.ok) throw new Error(`Dosya yüklenemedi (${path}): ${res.status}`)
    tree.push({
      path: path.replace(/^\//, ''),
      mode: '100644',
      type: 'blob',
      sha: (await res.json()).sha,
    })
  }

  const treeRes = await gh(token, `/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ tree }),
  })
  if (!treeRes.ok) throw new Error(`Ağaç oluşturulamadı: ${treeRes.status}`)
  const treeSha = (await treeRes.json()).sha

  const commitRes = await gh(token, `/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({
      message: 'Publish from JustJSON Studio',
      tree: treeSha,
      parents: [head],
    }),
  })
  if (!commitRes.ok) throw new Error(`Commit oluşturulamadı: ${commitRes.status}`)
  const commitSha = (await commitRes.json()).sha

  const patch = await gh(token, `/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commitSha, force: true }),
  })
  if (!patch.ok) throw new Error(`Dal güncellenemedi: ${patch.status}`)

  // Enable Pages if not already on (ignore "already exists").
  const pages = await gh(token, `/repos/${owner}/${repo}/pages`)
  if (pages.status === 404) {
    await gh(token, `/repos/${owner}/${repo}/pages`, {
      method: 'POST',
      body: JSON.stringify({ source: { branch, path: '/' } }),
    })
  }

  return { url: `https://${owner}.github.io/${repo}/`, siteId: `${owner}/${repo}` }
}

export const github: Provider = {
  id: 'github',
  name: 'GitHub Pages',
  auth: {
    kind: 'token',
    tokenUrl: 'https://github.com/settings/tokens/new?scopes=repo&description=JustJSON%20Studio',
    help: 'GitHub → Settings → Developer settings → Tokens (classic) → `repo` kapsamı. İlk yayında Pages derlemesi ~1 dk sürer.',
  },
  publish,
}

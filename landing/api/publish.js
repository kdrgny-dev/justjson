// JustJSON /admin — self-hosted publish endpoint (MVP).
// Commits edited content JSON to the site's own GitHub repo via the Contents
// API; the push triggers the host's auto-deploy. Runs on the site owner's
// infra — JustJSON runs no server. Auth is a shared password (MVP); magic-link
// + Ed25519 license verification come next.

const ALLOW_PREFIX = 'landing/content/'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })

  const { path, content, password } = req.body || {}

  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  if (typeof path !== 'string' || typeof content !== 'string') {
    return res.status(400).json({ error: 'path and content required' })
  }
  // Trust boundary: only content JSON, never code or config.
  if (!path.startsWith(ALLOW_PREFIX) || path.includes('..') || !path.endsWith('.json')) {
    return res.status(400).json({ error: 'path not allowed' })
  }
  try {
    JSON.parse(content)
  } catch {
    return res.status(400).json({ error: 'content is not valid JSON' })
  }

  const repo = process.env.GITHUB_REPO // e.g. "kdrgny-dev/justjson"
  const token = process.env.GITHUB_TOKEN
  const branch = process.env.GITHUB_BRANCH || 'main'
  if (!repo || !token) return res.status(500).json({ error: 'server not configured' })

  const api = `https://api.github.com/repos/${repo}/contents/${path}`
  const gh = (url, opts = {}) =>
    fetch(url, {
      ...opts,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'justjson-admin',
        ...(opts.headers || {}),
      },
    })

  // Need the current blob sha to update an existing file.
  let sha
  const cur = await gh(`${api}?ref=${encodeURIComponent(branch)}`)
  if (cur.status === 200) sha = (await cur.json()).sha
  else if (cur.status !== 404) {
    return res.status(502).json({ error: 'could not read current file', status: cur.status })
  }

  const put = await gh(api, {
    method: 'PUT',
    body: JSON.stringify({
      message: `content(admin): update ${path.slice(ALLOW_PREFIX.length)}`,
      content: Buffer.from(content).toString('base64'),
      sha,
      branch,
    }),
  })
  if (!put.ok) {
    return res.status(502).json({ error: 'commit failed', detail: await put.text() })
  }
  const out = await put.json()
  return res.status(200).json({ ok: true, commit: out.commit?.sha, url: out.commit?.html_url })
}

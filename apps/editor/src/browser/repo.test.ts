import { describe, expect, it } from 'vitest'
import { decodeBase64, encodeBase64, parseRepoInput } from './repo'

describe('parseRepoInput', () => {
  it('owner/repo kabul eder', () => {
    expect(parseRepoInput('kdrgny-dev/omerguzey.com')).toEqual({
      owner: 'kdrgny-dev',
      repo: 'omerguzey.com',
    })
  })

  it('tam adresten ayıklar ve .git ekini atar', () => {
    expect(parseRepoInput('https://github.com/kdrgny-dev/omerguzey.com.git')).toEqual({
      owner: 'kdrgny-dev',
      repo: 'omerguzey.com',
    })
  })

  it('ssh adresini de çözer', () => {
    expect(parseRepoInput('git@github.com:kdrgny-dev/justjson.git')).toEqual({
      owner: 'kdrgny-dev',
      repo: 'justjson',
    })
  })

  it('eksik girdiye null döner', () => {
    expect(parseRepoInput('sadece-repo')).toBeNull()
    expect(parseRepoInput('')).toBeNull()
  })
})

describe('base64', () => {
  it('Türkçe karakterleri kayıpsız çevirir', () => {
    const text = 'Göcek’te öğleden sonra rüzgâr — ışık, şeftali, İstanbul'
    expect(decodeBase64(encodeBase64(text))).toBe(text)
  })

  it('GitHub blob yanıtındaki satır sonlarını yok sayar', () => {
    const encoded = encodeBase64('{"title":"Köyceğiz"}')
    const wrapped = `${encoded.slice(0, 4)}\n${encoded.slice(4)}`
    expect(decodeBase64(wrapped)).toBe('{"title":"Köyceğiz"}')
  })

  it('büyük metinde chunk sınırını aşar', () => {
    const text = 'ş'.repeat(50_000)
    expect(decodeBase64(encodeBase64(text))).toBe(text)
  })
})

// ─── Uçtan uca akış (sahte fetch) ───────────────────────────────────────────
// Canlı GitHub çağrısı test edilmiyor: private repo token ister, anonim kota
// 60/saat. Burada istek sırası ve gövdeleri doğrulanıyor — asıl kırılgan yer o.

import { afterEach, beforeEach, vi } from 'vitest'
import { checkRepo, getSyncedCommit, pullContent, pushContent, setSyncedCommit } from './repo'

const LINK = { owner: 'kdrgny-dev', repo: 'site', branch: 'main', contentDir: 'content' }

interface Call {
  url: string
  method: string
  body: Record<string, unknown> | null
}

function mockGithub(routes: Record<string, unknown>): Call[] {
  const calls: Call[] = []
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    calls.push({
      url,
      method,
      body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null,
    })
    const key = `${method} ${url.replace('https://api.github.com', '')}`
    const match = routes[key] ?? routes[key.split('?')[0] ?? key]
    if (match === undefined) {
      return new Response('yok', { status: 404, headers: new Headers() })
    }
    return new Response(JSON.stringify(match), { status: 200, headers: new Headers() })
  })
  return calls
}

beforeEach(() => vi.unstubAllGlobals())
afterEach(() => vi.unstubAllGlobals())

describe('pullContent', () => {
  it('yalnızca içerik klasöründeki JSON dosyalarını okur', async () => {
    mockGithub({
      'GET /repos/kdrgny-dev/site/git/ref/heads/main': { object: { sha: 'commit1' } },
      'GET /repos/kdrgny-dev/site/git/commits/commit1': { tree: { sha: 'tree1' } },
      'GET /repos/kdrgny-dev/site/git/trees/commit1': {
        tree: [
          { path: 'content/articles/a.json', type: 'blob', sha: 'blobA' },
          { path: 'content/_schema.json', type: 'blob', sha: 'blobS' },
          { path: 'src/pages/index.astro', type: 'blob', sha: 'blobX' },
          { path: 'content/img/cover.webp', type: 'blob', sha: 'blobI' },
        ],
      },
      'GET /repos/kdrgny-dev/site/git/blobs/blobA': {
        content: encodeBase64('{"title":"Göcek"}'),
        encoding: 'base64',
      },
      'GET /repos/kdrgny-dev/site/git/blobs/blobS': {
        content: encodeBase64('{"version":1}'),
        encoding: 'base64',
      },
    })

    const files = await pullContent(LINK, '')
    expect(files.map((f) => f.path)).toEqual(['content/articles/a.json', 'content/_schema.json'])
    expect(JSON.parse(files[0]?.text ?? '{}').title).toBe('Göcek')
  })

  it('ağaç kırpıldıysa sessizce eksik veri döndürmez', async () => {
    mockGithub({
      'GET /repos/kdrgny-dev/site/git/ref/heads/main': { object: { sha: 'commit1' } },
      'GET /repos/kdrgny-dev/site/git/commits/commit1': { tree: { sha: 'tree1' } },
      'GET /repos/kdrgny-dev/site/git/trees/commit1': { tree: [], truncated: true },
    })
    await expect(pullContent(LINK, '')).rejects.toThrow(/çok büyük/)
  })
})

describe('pushContent', () => {
  it('repo kodunu korur: yeni ağaç base_tree üstüne kurulur', async () => {
    const calls = mockGithub({
      'GET /repos/kdrgny-dev/site/git/ref/heads/main': { object: { sha: 'commit1' } },
      'GET /repos/kdrgny-dev/site/git/commits/commit1': { tree: { sha: 'tree1' } },
      'POST /repos/kdrgny-dev/site/git/blobs': { sha: 'newBlob' },
      'POST /repos/kdrgny-dev/site/git/trees': { sha: 'newTree' },
      'POST /repos/kdrgny-dev/site/git/commits': { sha: 'commit2', html_url: 'https://x/commit2' },
      'PATCH /repos/kdrgny-dev/site/git/refs/heads/main': { ref: 'refs/heads/main' },
    })

    const result = await pushContent(
      LINK,
      'tok',
      [{ path: 'content/articles/a.json', text: '{"title":"Köyceğiz"}' }],
      ['content/articles/eski.json'],
      'content: güncelleme',
    )

    const treeCall = calls.find((c) => c.method === 'POST' && c.url.endsWith('/git/trees'))
    expect(treeCall?.body?.base_tree).toBe('tree1')

    const entries = treeCall?.body?.tree as { path: string; sha: string | null }[]
    expect(entries).toEqual([
      { path: 'content/articles/a.json', mode: '100644', type: 'blob', sha: 'newBlob' },
      { path: 'content/articles/eski.json', mode: '100644', type: 'blob', sha: null },
    ])

    const commitCall = calls.find((c) => c.method === 'POST' && c.url.endsWith('/git/commits'))
    expect(commitCall?.body?.parents).toEqual(['commit1'])

    const refCall = calls.find((c) => c.method === 'PATCH')
    expect(refCall?.body?.sha).toBe('commit2')
    expect(result.commitUrl).toBe('https://x/commit2')
    expect(result.changed).toBe(1)
    expect(result.removed).toBe(1)
  })

  it('değişiklik yoksa commit atmaz', async () => {
    const calls = mockGithub({
      'GET /repos/kdrgny-dev/site/git/ref/heads/main': { object: { sha: 'commit1' } },
      'GET /repos/kdrgny-dev/site/git/commits/commit1': { tree: { sha: 'tree1' } },
    })
    const result = await pushContent(LINK, 'tok', [], [], 'bos')
    expect(result.changed).toBe(0)
    expect(calls.some((c) => c.method === 'POST')).toBe(false)
  })
})

describe('senkron damgası', () => {
  const project = 'p1'

  // Testler node ortamında koşuyor; damga localStorage'da tutuluyor.
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
    })
  })

  it('aynı repo için çekilen commit hatırlanır', () => {
    setSyncedCommit(project, LINK, 'abc')
    expect(getSyncedCommit(project, LINK)).toBe('abc')
  })

  it('farklı dal ya da klasör aynı damgayı kullanmaz', () => {
    setSyncedCommit(project, LINK, 'abc')
    expect(getSyncedCommit(project, { ...LINK, branch: 'draft' })).toBeNull()
    expect(getSyncedCommit(project, { ...LINK, contentDir: 'icerik' })).toBeNull()
  })

  it('hiç çekilmemişse null döner', () => {
    expect(getSyncedCommit(project, LINK)).toBeNull()
  })
})

describe('geçici hatalar', () => {
  it('503 sonrası tekrar dener ve başarılı olur', async () => {
    let attempts = 0
    vi.stubGlobal('fetch', async (url: string) => {
      if (url.endsWith('/git/ref/heads/main')) {
        attempts++
        if (attempts < 3) return new Response('busy', { status: 503, headers: new Headers() })
        return new Response(JSON.stringify({ object: { sha: 'c1' } }), {
          status: 200,
          headers: new Headers(),
        })
      }
      return new Response(JSON.stringify({ tree: { sha: 't1' } }), {
        status: 200,
        headers: new Headers(),
      })
    })
    const head = await checkRepo(LINK, 'tok')
    expect(head.commitSha).toBe('c1')
    expect(attempts).toBe(3)
  })

  it('ısrarlı 5xx anlaşılır mesajla biter', async () => {
    vi.stubGlobal(
      'fetch',
      async () => new Response('down', { status: 503, headers: new Headers() }),
    )
    await expect(checkRepo(LINK, 'tok')).rejects.toThrow(/yanıt vermiyor/)
  })
})

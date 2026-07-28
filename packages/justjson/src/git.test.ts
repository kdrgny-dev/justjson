import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { commitContent, gitStatus, remoteWebUrl } from './git'

const run = promisify(execFile)

let root: string

async function initRepo(): Promise<void> {
  await run('git', ['init', '-b', 'main'], { cwd: root })
  await run('git', ['config', 'user.email', 'test@example.com'], { cwd: root })
  await run('git', ['config', 'user.name', 'Test'], { cwd: root })
}

async function writeEntry(name: string): Promise<void> {
  await mkdir(join(root, 'content/posts'), { recursive: true })
  await writeFile(join(root, 'content/posts', `${name}.json`), JSON.stringify({ title: name }))
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'jj-git-'))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('gitStatus', () => {
  it('git deposu olmayan klasörü bildirir', async () => {
    const status = await gitStatus(root, 'content')
    expect(status.isRepo).toBe(false)
    expect(status.hasRemote).toBe(false)
  })

  it('depo varsa dalı ve uzak sunucu durumunu verir', async () => {
    await initRepo()
    const status = await gitStatus(root, 'content')
    expect(status.isRepo).toBe(true)
    expect(status.branch).toBe('main')
    expect(status.hasRemote).toBe(false)
  })

  it('uzak sunucu tanımlıysa bildirir', async () => {
    await initRepo()
    await run('git', ['remote', 'add', 'origin', 'https://example.com/x.git'], { cwd: root })
    const status = await gitStatus(root, 'content')
    expect(status.hasRemote).toBe(true)
    expect(status.remoteUrl).toContain('example.com')
  })

  it('content klasöründeki bekleyen değişiklikleri sayar', async () => {
    await initRepo()
    await writeEntry('a')
    await writeEntry('b')
    const status = await gitStatus(root, 'content')
    expect(status.pendingFiles).toBe(2)
  })

  it('content dışındaki değişiklikleri saymaz', async () => {
    await initRepo()
    await writeFile(join(root, 'README.md'), '# x')
    const status = await gitStatus(root, 'content')
    expect(status.pendingFiles).toBe(0)
  })
})

describe('commitContent', () => {
  it('yalnızca content klasörünü commit eder', async () => {
    await initRepo()
    await writeEntry('a')
    await writeFile(join(root, 'other.txt'), 'x')

    const result = await commitContent(root, 'content', 'content: add a')
    expect(result.committed).toBe(true)

    const { stdout } = await run('git', ['show', '--name-only', '--format=', 'HEAD'], { cwd: root })
    expect(stdout).toContain('content/posts/a.json')
    expect(stdout).not.toContain('other.txt')
  })

  it('bekleyen değişiklik yoksa commit atmaz', async () => {
    await initRepo()
    await writeEntry('a')
    await commitContent(root, 'content', 'first')

    const result = await commitContent(root, 'content', 'second')
    expect(result.committed).toBe(false)
  })

  it('git deposu yoksa anlaşılır hata verir', async () => {
    await expect(commitContent(root, 'content', 'x')).rejects.toThrow(/not a git repository/i)
  })
})

describe('remoteWebUrl', () => {
  it('SSH remote adresini web adresine çevirir', () => {
    expect(remoteWebUrl('git@github.com:kdrgny/my-site.git')).toBe(
      'https://github.com/kdrgny/my-site',
    )
  })

  it('HTTPS remote adresinden .git ekini atar', () => {
    expect(remoteWebUrl('https://github.com/kdrgny/my-site.git')).toBe(
      'https://github.com/kdrgny/my-site',
    )
  })

  it('zaten temiz olan adresi olduğu gibi bırakır', () => {
    expect(remoteWebUrl('https://github.com/kdrgny/my-site')).toBe(
      'https://github.com/kdrgny/my-site',
    )
  })

  it('GitHub dışı sağlayıcıları da çevirir', () => {
    expect(remoteWebUrl('git@gitlab.com:team/site.git')).toBe('https://gitlab.com/team/site')
  })

  it('adres yoksa null döner', () => {
    expect(remoteWebUrl(null)).toBeNull()
    expect(remoteWebUrl('')).toBeNull()
  })
})

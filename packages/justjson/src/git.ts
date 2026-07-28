import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

/**
 * Uzak sunucu adresini tarayıcıda açılabilir bir adrese çevirir — Vercel ve
 * Netlify'ın "deploy" bağlantıları repo'nun web adresini ister.
 */
export function remoteWebUrl(remote: string | null): string | null {
  if (!remote) return null
  const ssh = remote.match(/^(?:ssh:\/\/)?git@([^:/]+)[:/](.+?)(?:\.git)?$/)
  if (ssh) return `https://${ssh[1]}/${ssh[2]}`
  const https = remote.match(/^https?:\/\/(?:[^@]+@)?(.+?)(?:\.git)?$/)
  if (https) return `https://${https[1]}`
  return null
}

export interface GitStatus {
  isRepo: boolean
  branch: string | null
  hasRemote: boolean
  remoteUrl: string | null
  /** content klasöründe commit bekleyen dosya sayısı. */
  pendingFiles: number
  /** Uzak sunucunun tarayıcıda açılabilir adresi (deploy bağlantıları için). */
  remoteWebUrl: string | null
  /** GitHub CLI kurulu mu — repo oluşturma yalnızca varsa sunulur. */
  hasGh: boolean
}

async function git(root: string, args: string[]): Promise<string> {
  const { stdout } = await run('git', args, { cwd: root })
  return stdout.trim()
}

async function tryGit(root: string, args: string[]): Promise<string | null> {
  try {
    return await git(root, args)
  } catch {
    return null
  }
}

async function hasGh(): Promise<boolean> {
  try {
    await run('gh', ['--version'])
    return true
  } catch {
    return false
  }
}

export async function gitStatus(root: string, contentDir: string): Promise<GitStatus> {
  const inside = await tryGit(root, ['rev-parse', '--is-inside-work-tree'])
  if (inside !== 'true') {
    return {
      isRepo: false,
      branch: null,
      hasRemote: false,
      remoteUrl: null,
      remoteWebUrl: null,
      pendingFiles: 0,
      hasGh: await hasGh(),
    }
  }

  const branch = await tryGit(root, ['branch', '--show-current'])
  const remoteUrl = await tryGit(root, ['remote', 'get-url', 'origin'])
  const porcelain = (await tryGit(root, ['status', '--porcelain', '-uall', '--', contentDir])) ?? ''

  return {
    isRepo: true,
    branch: branch || null,
    hasRemote: remoteUrl !== null,
    remoteUrl,
    remoteWebUrl: remoteWebUrl(remoteUrl),
    pendingFiles: porcelain ? porcelain.split('\n').filter(Boolean).length : 0,
    hasGh: await hasGh(),
  }
}

export interface CommitResult {
  committed: boolean
  /** Commit edilen dosya sayısı — mesajı editör kendi dilinde kurar. */
  count: number
}

/** Yalnızca içerik klasörünü sahneleyip commit eder — kullanıcının diğer çalışmasına dokunmaz. */
export async function commitContent(
  root: string,
  contentDir: string,
  message: string,
): Promise<CommitResult> {
  const inside = await tryGit(root, ['rev-parse', '--is-inside-work-tree'])
  if (inside !== 'true') throw new Error('Not a git repository — run `git init` first.')

  await git(root, ['add', '--', contentDir])
  const staged = await tryGit(root, ['diff', '--cached', '--name-only', '--', contentDir])
  if (!staged) return { committed: false, count: 0 }

  await git(root, ['commit', '-m', message, '--', contentDir])
  return { committed: true, count: staged.split('\n').filter(Boolean).length }
}

export async function pushContent(root: string): Promise<{ branch: string }> {
  const branch = await tryGit(root, ['branch', '--show-current'])
  if (!branch || branch === 'HEAD') throw new Error('No branch to push — commit something first.')
  const hasUpstream = await tryGit(root, ['rev-parse', '--abbrev-ref', `${branch}@{upstream}`])
  const args = hasUpstream ? ['push'] : ['push', '-u', 'origin', branch]
  await git(root, args)
  return { branch }
}

export interface CreateRepoOptions {
  name: string
  private: boolean
}

/**
 * GitHub deposunu `gh` ile oluşturur ve iter. OAuth uygulaması ya da token
 * saklamaya gerek yok: kullanıcının makinesindeki kimlik kullanılır.
 */
export async function createGitHubRepo(
  root: string,
  options: CreateRepoOptions,
): Promise<{ name: string }> {
  if (!(await hasGh())) {
    throw new Error('GitHub CLI (gh) not found — install it, or add a remote yourself.')
  }
  const inside = await tryGit(root, ['rev-parse', '--is-inside-work-tree'])
  if (inside !== 'true') {
    await git(root, ['init', '-b', 'main'])
  }
  await run(
    'gh',
    [
      'repo',
      'create',
      options.name,
      options.private ? '--private' : '--public',
      '--source',
      '.',
      '--push',
    ],
    {
      cwd: root,
    },
  )
  return { name: options.name }
}

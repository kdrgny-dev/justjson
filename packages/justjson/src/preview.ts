import { type ChildProcess, spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

interface PackageJson {
  scripts?: Record<string, string>
}

export interface DevCommand {
  command: string
  args: string[]
}

/** Projede bir dev betiği var mı — preview yalnızca varsa sunulur. */
export function detectDevScript(pkg: unknown): DevCommand | null {
  if (typeof pkg !== 'object' || pkg === null) return null
  const scripts = (pkg as PackageJson).scripts
  if (!scripts?.dev) return null
  return { command: 'npm', args: ['run', 'dev'] }
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape stripping is intentional
const ANSI = /\u001b\[[0-9;]*m/g
// biome-ignore lint/suspicious/noControlCharactersInRegex: excludes ANSI escape from URL match
const URL_RE = /(https?:\/\/localhost:\d+[^\s\u001b]*)/i

/** Astro/Vite çıktısındaki renk kodlarını sıyırıp temiz bir URL döndürür. */
export function cleanUrl(line: string): string | null {
  const match = line.replace(ANSI, '').match(URL_RE)
  if (!match?.[1]) return null
  return match[1].replace(/\/$/, '')
}

export type PreviewState =
  | { status: 'idle' }
  | { status: 'starting' }
  | { status: 'running'; url: string }
  | { status: 'error'; message: string }

/**
 * Kullanıcının kendi dev sunucusunu (astro/next/vite dev) başlatır ve çıktısından
 * URL'ini yakalar; editör bunu bir iframe'de gösterir. Kendimiz bir sunucu
 * uydurmuyoruz — projenin gerçek dev sunucusunu çalıştırıyoruz.
 */
export class PreviewProcess {
  private child: ChildProcess | null = null
  private state: PreviewState = { status: 'idle' }
  private log: string[] = []

  constructor(private readonly root: string) {}

  getState(): PreviewState {
    return this.state
  }

  recentLog(): string {
    return this.log.slice(-40).join('\n')
  }

  async start(): Promise<PreviewState> {
    if (this.state.status === 'running' || this.state.status === 'starting') return this.state

    let pkg: unknown
    try {
      pkg = JSON.parse(await readFile(join(this.root, 'package.json'), 'utf8'))
    } catch {
      this.state = {
        status: 'error',
        message: 'No package.json — this folder has no site to preview.',
      }
      return this.state
    }

    const dev = detectDevScript(pkg)
    if (!dev) {
      this.state = {
        status: 'error',
        message: 'No "dev" script — generate a site first (Ship it).',
      }
      return this.state
    }

    this.log = []
    this.state = { status: 'starting' }
    const child = spawn(dev.command, dev.args, {
      cwd: this.root,
      env: { ...process.env, FORCE_COLOR: '0', BROWSER: 'none' },
      shell: process.platform === 'win32',
    })
    this.child = child

    const capture = (buf: Buffer) => {
      const text = buf.toString()
      this.log.push(text)
      const url = cleanUrl(text)
      if (url && this.state.status !== 'running') {
        this.state = { status: 'running', url }
      }
    }
    child.stdout?.on('data', capture)
    child.stderr?.on('data', capture)

    child.on('exit', (code) => {
      this.child = null
      if (this.state.status !== 'error') {
        this.state =
          code === 0 || code === null
            ? { status: 'idle' }
            : { status: 'error', message: `Dev server stopped (exit ${code}).` }
      }
    })

    return this.state
  }

  stop(): void {
    this.child?.kill()
    this.child = null
    this.state = { status: 'idle' }
  }
}

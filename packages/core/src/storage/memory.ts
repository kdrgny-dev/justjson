import type { StorageAdapter } from './adapter'

export class MemoryAdapter implements StorageAdapter {
  private files: Map<string, string>

  constructor(initial: Record<string, string> = {}) {
    this.files = new Map(Object.entries(initial))
  }

  async read(path: string): Promise<string | null> {
    return this.files.get(path) ?? null
  }

  async write(path: string, content: string): Promise<void> {
    this.files.set(path, content)
  }

  async delete(path: string): Promise<void> {
    this.files.delete(path)
  }

  async list(dir: string): Promise<string[]> {
    const prefix = `${dir}/`
    const out: string[] = []
    for (const key of this.files.keys()) {
      if (!key.startsWith(prefix)) continue
      const rest = key.slice(prefix.length)
      if (!rest.includes('/')) out.push(rest)
    }
    return out
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path)
  }

  async mtime(path: string): Promise<number | null> {
    return this.files.has(path) ? 0 : null
  }

  snapshot(): Record<string, string> {
    return Object.fromEntries(this.files)
  }
}

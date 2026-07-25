import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { StorageAdapter } from '@justjson/core'

export class FsAdapter implements StorageAdapter {
  constructor(private readonly root: string) {}

  private abs(path: string): string {
    return join(this.root, path)
  }

  async read(path: string): Promise<string | null> {
    try {
      return await readFile(this.abs(path), 'utf8')
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw err
    }
  }

  async write(path: string, content: string): Promise<void> {
    const full = this.abs(path)
    await mkdir(dirname(full), { recursive: true })
    const tmp = `${full}.${process.pid}.tmp`
    await writeFile(tmp, content, 'utf8')
    await rename(tmp, full)
  }

  async delete(path: string): Promise<void> {
    await rm(this.abs(path), { force: true })
  }

  async list(dir: string): Promise<string[]> {
    try {
      const entries = await readdir(this.abs(dir), { withFileTypes: true })
      return entries.filter((e) => e.isFile()).map((e) => e.name)
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw err
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      await stat(this.abs(path))
      return true
    } catch {
      return false
    }
  }
}

import type { StorageAdapter } from '@justjson/core'

// IndexedDB-backed StorageAdapter — the browser equivalent of the CLI's
// FsAdapter. Lets the whole core engine (ContentStore, schema, theme) run with
// no server: the user's project lives in their own browser. One object store,
// keyed by file path → { content, mtime }.

const DB = 'justjson'
const STORE = 'files'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const req = fn(t.objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

interface FileRec {
  content: string
  mtime: number
}

export class IdbAdapter implements StorageAdapter {
  async read(path: string): Promise<string | null> {
    const rec = await tx<FileRec | undefined>('readonly', (s) => s.get(path))
    return rec ? rec.content : null
  }

  async write(path: string, content: string): Promise<void> {
    await tx('readwrite', (s) => s.put({ content, mtime: Date.now() } as FileRec, path))
  }

  async delete(path: string): Promise<void> {
    await tx('readwrite', (s) => s.delete(path))
  }

  async list(dir: string): Promise<string[]> {
    const prefix = `${dir}/`
    const keys = (await tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys())) as string[]
    const out: string[] = []
    for (const key of keys) {
      if (!key.startsWith(prefix)) continue
      const rest = key.slice(prefix.length)
      if (!rest.includes('/')) out.push(rest)
    }
    return out
  }

  async exists(path: string): Promise<boolean> {
    const rec = await tx<FileRec | undefined>('readonly', (s) => s.get(path))
    return rec !== undefined
  }

  async mtime(path: string): Promise<number | null> {
    const rec = await tx<FileRec | undefined>('readonly', (s) => s.get(path))
    return rec ? rec.mtime : null
  }
}

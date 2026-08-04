// Multi-project registry (localStorage). Each project is an isolated namespace
// in IndexedDB (see idb.ts). The 'default' project keeps the original flat keys
// so existing data is preserved; new projects are prefixed p/<id>/.
export interface ProjectMeta {
  id: string
  name: string
  siteId?: string
  siteUrl?: string
  provider?: string
  createdAt: number
}

const PKEY = 'jj_projects'
const AKEY = 'jj_active'

function read(): ProjectMeta[] {
  try {
    return JSON.parse(localStorage.getItem(PKEY) || '[]') as ProjectMeta[]
  } catch {
    return []
  }
}
function write(list: ProjectMeta[]): void {
  localStorage.setItem(PKEY, JSON.stringify(list))
}
function ensure(): ProjectMeta[] {
  let list = read()
  if (list.length === 0) {
    list = [{ id: 'default', name: 'My site', createdAt: Date.now() }]
    write(list)
    localStorage.setItem(AKEY, 'default')
  }
  return list
}

export function activeId(): string {
  const list = ensure()
  const id = localStorage.getItem(AKEY)
  return id && list.some((p) => p.id === id) ? id : (list[0]?.id ?? 'default')
}
export function listProjects(): ProjectMeta[] {
  return ensure()
}
export function activeProject(): ProjectMeta {
  const id = activeId()
  return ensure().find((p) => p.id === id) as ProjectMeta
}
export function createProject(name: string): string {
  const id = `p${Math.random().toString(36).slice(2, 9)}`
  const list = ensure()
  list.push({ id, name: name.trim() || 'Untitled', createdAt: Date.now() })
  write(list)
  localStorage.setItem(AKEY, id)
  return id
}
export function switchProject(id: string): void {
  if (ensure().some((p) => p.id === id)) localStorage.setItem(AKEY, id)
}
export function renameProject(id: string, name: string): void {
  write(ensure().map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p)))
}
export function setSite(id: string, siteId: string, siteUrl: string, provider?: string): void {
  write(ensure().map((p) => (p.id === id ? { ...p, siteId, siteUrl, provider } : p)))
}
export function getSite(id: string): { siteId?: string; siteUrl?: string; provider?: string } {
  const p = ensure().find((x) => x.id === id)
  return p ? { siteId: p.siteId, siteUrl: p.siteUrl, provider: p.provider } : {}
}
export function removeProject(id: string): void {
  let list = ensure().filter((p) => p.id !== id)
  if (list.length === 0) list = [{ id: 'default', name: 'My site', createdAt: Date.now() }]
  write(list)
  if (activeId() === id) localStorage.setItem(AKEY, list[0]?.id ?? 'default')
}

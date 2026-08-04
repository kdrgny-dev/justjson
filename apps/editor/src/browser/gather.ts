import type { Schema } from '@justjson/core'
import * as api from '../api'
import { activeProject } from './project'
import type { ProjectData } from './render'

function pickName(singletons: Record<string, Record<string, unknown>>, fallback: string): string {
  for (const data of Object.values(singletons)) {
    for (const key of ['siteName', 'title', 'name']) {
      const v = data[key]
      if (typeof v === 'string' && v.trim()) return v
    }
  }
  return fallback
}

// Read the whole active project out of the browser store into a renderable shape.
export async function gatherProject(schema: Schema): Promise<ProjectData> {
  const theme = await api.getTheme()
  const entries: ProjectData['entries'] = {}
  for (const c of schema.collections) {
    const rows = await api.listRows(c.name)
    const list: { slug: string; data: Record<string, unknown> }[] = []
    for (const r of rows)
      list.push({ slug: r.slug, data: (await api.getEntry(c.name, r.slug)) ?? {} })
    entries[c.name] = list
  }
  const singletons: ProjectData['singletons'] = {}
  for (const s of schema.singletons) singletons[s.name] = await api.getSingleton(s.name)
  return {
    schema,
    entries,
    singletons,
    theme,
    siteName: pickName(singletons, activeProject().name),
  }
}

import { FsAdapter } from './fs-adapter'

export async function resolveContentDir(root: string): Promise<string> {
  const raw = await new FsAdapter(root).read('justjson.config.json')
  if (raw === null) return 'content'
  const cfg = JSON.parse(raw) as { contentDir?: string }
  return cfg.contentDir ?? 'content'
}

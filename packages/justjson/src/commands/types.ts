import { join } from 'node:path'
import { generateTypes, loadSchema } from '@justjson/core'
import { resolveContentDir } from '../config'
import { FsAdapter } from '../fs-adapter'

export async function generateTypesFile(root: string, outPath = 'types.ts'): Promise<string> {
  const adapter = new FsAdapter(root)
  const contentDir = await resolveContentDir(root)
  const schema = await loadSchema(adapter, contentDir)
  if (!schema) throw new Error('Şema bulunamadı. Önce `justjson init` çalıştırın.')
  await adapter.write(outPath, generateTypes(schema))
  return join(root, outPath)
}

import { cp, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const src = join(here, '../../../apps/editor/dist')
const dest = join(here, '../dist/editor')

await rm(dest, { recursive: true, force: true })
await cp(src, dest, { recursive: true })
console.log(`editör paketlendi → ${dest}`)

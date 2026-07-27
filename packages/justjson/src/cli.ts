#!/usr/bin/env node
import { Command } from 'commander'
import { exportZip } from './commands/export'
import { initProject, listTemplates } from './commands/init'
import { generateTypesFile } from './commands/types'
import { startServer } from './server'
import { readVersion } from './version'

const program = new Command()
const root = process.cwd()

program.name('justjson').description('Lokalde çalışan, JSON üreten mini CMS').version(readVersion())

program
  .command('init')
  .description('Bir template ile projeyi başlatır')
  .argument('[template]', `template adı (${listTemplates().join(', ')})`, 'blog')
  .action(async (template: string) => {
    await initProject(root, template)
    console.log(`'${template}' template'i ile başlatıldı.`)
  })

program
  .command('types')
  .description('Şemadan types.ts üretir')
  .action(async () => {
    const out = await generateTypesFile(root)
    console.log(`Yazıldı: ${out}`)
  })

program
  .command('export')
  .description('İçeriği ZIP olarak dışa aktarır')
  .action(async () => {
    const out = await exportZip(root)
    console.log(`Yazıldı: ${out}`)
  })

program
  .command('serve', { isDefault: true })
  .description('Lokal editör sunucusunu başlatır')
  .option('-p, --port <port>', 'port', '5180')
  .action(async (opts: { port: string }) => {
    await startServer(root, Number(opts.port))
  })

program.parseAsync()

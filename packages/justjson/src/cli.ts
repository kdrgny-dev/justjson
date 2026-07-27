#!/usr/bin/env node
import { Command } from 'commander'
import { exportZip } from './commands/export'
import { initProject, listTemplates } from './commands/init'
import { generateTypesFile } from './commands/types'
import { formatJson, formatText, shouldFail, validateProjectAt } from './commands/validate'
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
  .command('validate')
  .description('İçeriği şemaya karşı doğrular (CI için)')
  .option('--json', 'makine-okur JSON çıktı')
  .option('--strict', 'uyarıları da hata say')
  .action(async (opts: { json?: boolean; strict?: boolean }) => {
    const issues = await validateProjectAt(root)
    if (issues === null) {
      console.error('Şema bulunamadı. Önce `justjson init` çalıştırın.')
      process.exitCode = 1
      return
    }
    console.log(opts.json ? formatJson(issues) : formatText(issues))
    if (shouldFail(issues, Boolean(opts.strict))) process.exitCode = 1
  })

program
  .command('serve', { isDefault: true })
  .description('Lokal editör sunucusunu başlatır')
  .option('-p, --port <port>', 'port', '5180')
  .action(async (opts: { port: string }) => {
    await startServer(root, Number(opts.port))
  })

program.parseAsync()

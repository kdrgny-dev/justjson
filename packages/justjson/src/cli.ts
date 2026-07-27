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

program
  .name('justjson')
  .description('A tiny local-first CMS that keeps your content as plain JSON')
  .version(readVersion())

program
  .command('init')
  .description('Scaffold a project from a template')
  .argument('[template]', `template name (${listTemplates().join(', ')})`, 'blog')
  .action(async (template: string) => {
    await initProject(root, template)
    console.log(`Scaffolded from the '${template}' template.`)
  })

program
  .command('types')
  .description('Generate types.ts and a typed content.ts loader from your schema')
  .action(async () => {
    const out = await generateTypesFile(root)
    console.log(`Wrote: ${out}`)
  })

program
  .command('export')
  .description('Export schema, content and types as a ZIP')
  .action(async () => {
    const out = await exportZip(root)
    console.log(`Wrote: ${out}`)
  })

program
  .command('validate')
  .description('Check your content against the schema (great for CI)')
  .option('--json', 'machine-readable JSON output')
  .option('--strict', 'treat warnings as errors too')
  .action(async (opts: { json?: boolean; strict?: boolean }) => {
    const issues = await validateProjectAt(root)
    if (issues === null) {
      console.error('No schema found. Run `justjson init` first.')
      process.exitCode = 1
      return
    }
    console.log(opts.json ? formatJson(issues) : formatText(issues))
    if (shouldFail(issues, Boolean(opts.strict))) process.exitCode = 1
  })

program
  .command('serve', { isDefault: true })
  .description('Start the local editor server')
  .option('-p, --port <port>', 'port', '5180')
  .action(async (opts: { port: string }) => {
    await startServer(root, Number(opts.port))
  })

program.parseAsync()

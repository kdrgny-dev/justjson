#!/usr/bin/env node
// Captures a card thumbnail for each generated theme demo:
//   landing/public/themes/<id>/thumb.jpg
//
//   node scripts/build-theme-thumbs.mjs [id …]
//
// Uses the Chrome already installed on the machine (headless screenshot) and
// sips for the resize/encode — no image toolchain to install. Run after
// `pnpm demos`.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..', '..')
const themesDir = join(repoRoot, 'landing', 'public', 'themes')

const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
].find((p) => existsSync(p))
if (!CHROME) {
  console.error('thumbs: no Chrome/Chromium/Edge found — install one or capture thumbs by hand')
  process.exit(1)
}

const ids = process.argv.slice(2)
const targets = (
  ids.length
    ? ids
    : readdirSync(themesDir).filter((n) => statSync(join(themesDir, n)).isDirectory())
).filter((id) => existsSync(join(themesDir, id, 'index.html')))

if (targets.length === 0) {
  console.error('thumbs: no demos found — run `pnpm demos` first')
  process.exit(1)
}

for (const id of targets) {
  const work = mkdtempSync(join(tmpdir(), `jj-thumb-${id}-`))
  const shot = join(work, 'shot.png')
  try {
    execFileSync(
      CHROME,
      [
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        '--force-device-scale-factor=2',
        '--window-size=1280,800',
        // let webfonts land and the hero animation settle before the capture
        '--virtual-time-budget=7000',
        `--screenshot=${shot}`,
        `file://${join(themesDir, id, 'index.html')}`,
      ],
      { stdio: 'ignore' },
    )
    const out = join(themesDir, id, 'thumb.jpg')
    execFileSync(
      'sips',
      ['-s', 'format', 'jpeg', '-s', 'formatOptions', '78', '-Z', '1600', shot, '--out', out],
      {
        stdio: 'ignore',
      },
    )
    const kb = Math.round(statSync(out).size / 1024)
    console.log(`${id.padEnd(9)} ${String(kb).padStart(4)} KB  ${relative(repoRoot, out)}`)
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

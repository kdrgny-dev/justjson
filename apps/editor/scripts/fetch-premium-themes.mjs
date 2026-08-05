#!/usr/bin/env node
// Pulls the commercial theme bundles into src/themes/ before a Studio build.
//
// They are not in this repo (MIT) — they live in the private justjson-themes
// repo under dist/. A build with JJ_THEMES_TOKEN set ships them; a build
// without one ships the free themes only and says so. Never silent: if a token
// IS present, any failure is fatal, so a paid build can't quietly lose them.
//
//   JJ_THEMES_TOKEN  PAT (or GitHub App token) with read access to the repo
//   JJ_THEMES_REPO   owner/name       (default kdrgny-dev/justjson-themes)
//   JJ_THEMES_REF    branch or tag    (default main)
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const token = process.env.JJ_THEMES_TOKEN
if (!token) {
  console.log('premium themes: no JJ_THEMES_TOKEN — building with the free themes only')
  process.exit(0)
}

const repo = process.env.JJ_THEMES_REPO || 'kdrgny-dev/justjson-themes'
const ref = process.env.JJ_THEMES_REF || 'main'
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'themes')

async function get(path, raw) {
  const url = `https://api.github.com/repos/${repo}/contents/${path}?ref=${ref}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: raw ? 'application/vnd.github.raw' : 'application/vnd.github+json',
      'User-Agent': 'justjson-build',
    },
  })
  if (!res.ok) throw new Error(`${repo}/${path}: ${res.status} ${res.statusText}`)
  return raw ? res.text() : res.json()
}

const entries = await get('dist')
const names = entries
  .filter((e) => e.type === 'file' && e.name.endsWith('.json'))
  .map((e) => e.name)
if (names.length === 0) throw new Error(`${repo}/dist has no theme bundles`)

mkdirSync(outDir, { recursive: true })
for (const name of names) {
  const body = await get(`dist/${name}`, true)
  JSON.parse(body) // reject a truncated or HTML response before it reaches the build
  writeFileSync(join(outDir, name), body)
}
console.log(`premium themes: ${names.length} bundles from ${repo}@${ref} -> src/themes/`)

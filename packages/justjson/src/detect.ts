import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export type Framework = 'astro' | 'next' | 'nuxt' | 'sveltekit' | 'vite' | 'node' | 'unknown'

/** Öncelik sırası önemli: Astro/Next kendi içinde Vite kullanır, önce onlar bakılır. */
const SIGNATURES: [Framework, string][] = [
  ['astro', 'astro'],
  ['next', 'next'],
  ['nuxt', 'nuxt'],
  ['sveltekit', '@sveltejs/kit'],
  ['vite', 'vite'],
]

interface PackageJson {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

/** Projenin hangi framework'ü kullandığını package.json'dan çıkarır — kullanıcıya sormaya gerek yok. */
export async function detectFramework(root: string): Promise<Framework> {
  let pkg: PackageJson
  try {
    pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as PackageJson
  } catch {
    return 'unknown'
  }
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  for (const [framework, dependency] of SIGNATURES) {
    if (deps[dependency]) return framework
  }
  return 'node'
}

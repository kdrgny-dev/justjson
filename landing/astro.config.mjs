import { defineConfig } from 'astro/config'

// Static marketing site. All prose content is sourced from the JustJSON
// project in ./content (schema + content/*.json), imported at build time.
export default defineConfig({
  site: 'https://justjson.vercel.app',
})

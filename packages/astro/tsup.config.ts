import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  // @justjson/core npm'de yayınlanmıyor; CLI'da olduğu gibi burada da gömülür.
  noExternal: ['@justjson/core'],
  external: ['astro', 'zod'],
})

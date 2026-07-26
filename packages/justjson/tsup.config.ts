import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  clean: true,
  // @justjson/core (ve onun zod bağımlılığı) CLI'ya gömülür ki paket
  // tek başına npm'de yayınlanabilsin — @justjson/core'u ayrıca yayınlamaya gerek kalmaz.
  noExternal: ['@justjson/core'],
})

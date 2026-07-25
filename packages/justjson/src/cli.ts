#!/usr/bin/env node
// justjson CLI giriş noktası.
// Alt komutlar uygulama planında doldurulacak: (default serve), init, types, export
import { Command } from 'commander'

const program = new Command()

program
  .name('justjson')
  .description('Lokalde çalışan, JSON üreten mini CMS')
  .version('0.0.0')

program.parse()

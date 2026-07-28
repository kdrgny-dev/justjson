import { describe, expect, it } from 'vitest'
import { MemoryAdapter } from '../storage/memory'
import { loadTheme, saveTheme } from './store'
import { defaultTheme } from './theme'

describe('tema deposu', () => {
  it('dosya yoksa varsayılan temayı verir', async () => {
    expect(await loadTheme(new MemoryAdapter())).toEqual(defaultTheme())
  })

  it('kaydedip geri okur', async () => {
    const adapter = new MemoryAdapter()
    await saveTheme(adapter, { ...defaultTheme(), accent: '#ff0000', density: 'roomy' })
    const theme = await loadTheme(adapter)
    expect(theme.accent).toBe('#ff0000')
    expect(theme.density).toBe('roomy')
  })

  it('bozuk dosyada varsayılana düşer, patlamaz', async () => {
    const adapter = new MemoryAdapter()
    await adapter.write('content/_theme.json', '{ bozuk')
    expect(await loadTheme(adapter)).toEqual(defaultTheme())
  })

  it('elle yazılmış geçersiz değeri düzeltir', async () => {
    const adapter = new MemoryAdapter()
    await adapter.write('content/_theme.json', JSON.stringify({ accent: 'mavi', radius: 500 }))
    const theme = await loadTheme(adapter)
    expect(theme.accent).toBe(defaultTheme().accent)
    expect(theme.radius).toBeLessThanOrEqual(24)
  })

  it('içerik klasörünü dikkate alır', async () => {
    const adapter = new MemoryAdapter()
    await saveTheme(adapter, { ...defaultTheme(), accent: '#123456' }, 'data')
    expect(await adapter.read('data/_theme.json')).toBeTruthy()
    expect((await loadTheme(adapter, 'data')).accent).toBe('#123456')
  })
})

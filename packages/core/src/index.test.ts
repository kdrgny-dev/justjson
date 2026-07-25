import { describe, expect, it } from 'vitest'
import * as api from './index'

describe('genel API', () => {
  it('beklenen sembolleri dışa aktarır', () => {
    expect(typeof api.parseSchema).toBe('function')
    expect(typeof api.serializeSchema).toBe('function')
    expect(typeof api.MemoryAdapter).toBe('function')
    expect(typeof api.ContentStore).toBe('function')
    expect(typeof api.loadSchema).toBe('function')
    expect(typeof api.saveSchema).toBe('function')
    expect(typeof api.validateEntry).toBe('function')
    expect(typeof api.generateTypes).toBe('function')
    expect(typeof api.buildExportManifest).toBe('function')
  })
})

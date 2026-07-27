import { afterEach, describe, expect, it, vi } from 'vitest'
import { getLang, setLang, subscribeLang, t, tp } from './i18n'

afterEach(() => {
  setLang('en')
  vi.unstubAllGlobals()
})

describe('i18n', () => {
  it('varsayılan dil İngilizce ve anahtar aynen döner', () => {
    expect(getLang()).toBe('en')
    expect(t('Save')).toBe('Save')
  })

  it('Türkçe seçilince sözlükten çevirir', () => {
    setLang('tr')
    expect(t('Save')).toBe('Kaydet')
  })

  it('sözlükte olmayan anahtar İngilizce kalır', () => {
    setLang('tr')
    expect(t('A string nobody translated')).toBe('A string nobody translated')
  })

  it('{değişken} yer tutucularını doldurur', () => {
    expect(t('{n} entries', { n: 3 })).toBe('3 entries')
    setLang('tr')
    expect(t('{n} entries', { n: 3 })).toBe('3 kayıt')
  })

  it('tp tekil/çoğul anahtarı sayıya göre seçer', () => {
    expect(tp(1, '{n} entry', '{n} entries')).toBe('1 entry')
    expect(tp(3, '{n} entry', '{n} entries')).toBe('3 entries')
    expect(tp(0, '{n} entry', '{n} entries')).toBe('0 entries')
    setLang('tr')
    expect(tp(1, '{n} entry', '{n} entries')).toBe('1 kayıt')
    expect(tp(3, '{n} entry', '{n} entries')).toBe('3 kayıt')
  })

  it('bilinmeyen yer tutucuyu olduğu gibi bırakır', () => {
    expect(t('{a} and {b}', { a: 'x' })).toBe('x and {b}')
  })

  it('dil değişince aboneleri uyarır', () => {
    const seen: string[] = []
    const off = subscribeLang(() => seen.push(getLang()))
    setLang('tr')
    setLang('en')
    off()
    setLang('tr')
    expect(seen).toEqual(['tr', 'en'])
  })

  it('seçilen dili localStorage içine yazar', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
    })
    setLang('tr')
    expect(store.get('justjson.lang')).toBe('tr')
  })
})

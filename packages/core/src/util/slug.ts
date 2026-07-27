const TR: Record<string, string> = {
  ç: 'c',
  ğ: 'g',
  ı: 'i',
  ö: 'o',
  ş: 's',
  ü: 'u',
  Ç: 'c',
  Ğ: 'g',
  İ: 'i',
  Ö: 'o',
  Ş: 's',
  Ü: 'u',
  I: 'i',
}

export function slugify(input: string): string {
  const mapped = input.replace(/[çğıöşüÇĞİÖŞÜI]/g, (c) => TR[c] ?? c)
  const slug = mapped
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || 'content'
}

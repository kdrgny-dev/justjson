export class JustJsonError extends Error {
  constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}

/** İstenen koleksiyon/singleton/kayıt yok. */
export class NotFoundError extends JustJsonError {}

/** Slug path traversal veya geçersiz karakter içeriyor. */
export class UnsafeSlugError extends JustJsonError {}

/** Bir yol kök dizinin dışına çıkıyor. */
export class PathEscapeError extends JustJsonError {}

/** Şema doğrulamadan geçmedi; mesaj konumlu satırlar içerir. */
export class SchemaError extends JustJsonError {}

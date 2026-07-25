export interface StorageAdapter {
  /** Dosya içeriğini döndürür; yoksa null. */
  read(path: string): Promise<string | null>
  /** Dosyayı yazar; ara dizinler örtük varsayılır. */
  write(path: string, content: string): Promise<void>
  /** Dosyayı siler; yoksa sessiz geçer. */
  delete(path: string): Promise<void>
  /** dir altındaki doğrudan dosyaların basename listesi; dizin yoksa []. */
  list(dir: string): Promise<string[]>
  exists(path: string): Promise<boolean>
}

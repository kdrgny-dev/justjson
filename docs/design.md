# JustJSON — Tasarım Dokümanı

> **Durum:** Taslak, kullanıcı gözden geçirmesi bekleniyor
> **Tarih:** 2026-07-25
> **İsim:** `JustJSON` (geçici placeholder)

## 1. Özet

JustJSON, **lokalde çalışan, JSON üreten bir mini CMS**'tir. Kullanıcı kendi proje klasöründe `npx justjson` çalıştırır; araç `localhost`'ta temiz bir editör açar, şemadan otomatik form üretir, ve düzenlemeleri **doğrudan diskteki JSON dosyalarına** yazar.

**Çekirdek ilke:** Bizde hiçbir şey durmaz. Ne veritabanı, ne içerik, ne token, ne sunucu isteği. Araç kullanıcının makinesinde çalışır, kullanıcının dosyalarını okur/yazar. İçerik %100 kullanıcınındır ve zaten kendi repo'sundadır.

**Ne değildir:** hosting değil, site builder değil, backend servisi değil. Sadece dosyaları düzenleyen bir editör.

**Endpoint kimin?** Kullanıcının. Ürettiği JSON'ları nereye koyarsa (repo raw, jsDelivr, kendi sitesinin build'i) endpoint odur. JustJSON servis etmez, yalnızca dosyaları düzenler.

**Bağlam:** Portfolyo / open-source projesi. Para hedefi yok; teknik olarak temiz, sıfır-altyapı, kendi kendine yeten bir araç hedefleniyor.

## 2. Kapsam (v1)

**Dahil:**
- `npx justjson` — proje klasöründe lokal editör sunucusu
- `npx justjson init` — hazır template ile başlatma (CV, blog, portfolyo, ürün kataloğu, landing + "sıfırdan")
- Şema kurma sihirbazı (UI'dan koleksiyon + alan tanımlama, `_schema.json`'a yazar)
- Koleksiyon (çoklu kayıt) ve singleton (tekil kayıt) CRUD
- Alan tipleri: text, richtext (markdown), number, boolean, date, select, relation, image
- Şemadan otomatik üretilen temiz form editörü
- Medya: `content/media/` altına yazma (tarayıcıda resize + WebP)
- `npx justjson types` — şemadan `types.ts` üretimi
- `npx justjson export` — anlık ZIP snapshot (şema + içerik + medya + types)
- Tarayıcıda çalışan **demo playground** (in-memory adapter; portfolyo için canlı demo)

**Hariç (sonraki sürümler):**
- v2: Statik web app + File System Access API (Chromium'da sunucusuz mod)
- v2: Canlı önizleme
- v3: MCP server (core üstünde ince katman; şema/içeriği sohbetle yönetme)

## 3. Mimari

```
packages/core       — framework & I/O bağımsız çekirdek (saf mantık)
packages/justjson   — `justjson` bin: lokal sunucu (Node) + fs adapter + paketlenmiş UI
apps/editor         — Vite + React SPA (editör arayüzü)
```

**Akış:**
```
kullanıcı → `npx justjson` → Node lokal sunucu (Hono)
                                 ├── content/ dizinini fs ile okur/yazar
                                 └── paketlenmiş SPA'yı servis eder → localhost:xxxx
tarayıcı (SPA) → localhost API → fs → diskteki JSON dosyaları
```

`packages/core` sorumlulukları (hepsi saf, I/O yok):

| Modül | İş |
|---|---|
| `schema` | Şema tipleri, zod doğrulaması, serialize/deserialize |
| `validate` | İçerik ↔ şema doğrulaması, uyuşmazlık raporu |
| `export` | ZIP serialize, medya yolu yeniden yazımı |
| `types` | Şemadan `types.ts` üretimi |

**Kritik soyutlama — `StorageAdapter`:** core ve UI, dosyaların nasıl saklandığını bilmez; bir adapter arayüzüne konuşur (`read`, `write`, `list`, `delete`).
- `FsAdapter` → lokal disk (varsayılan, `npx justjson`).
- `MemoryAdapter` → in-memory; hem testler hem tarayıcıdaki demo playground için.

Bu soyutlama üç şeyi bedavaya getirir: (1) tüm mantık saf fonksiyon olarak test edilir, (2) portfolyo için sunucusuz "tarayıcıda dene" demosu aynı UI ile çıkar, (3) v2'deki File System Access API modu sadece yeni bir adapter olur.

## 4. Tech Stack

```
TypeScript
Turborepo + pnpm workspace
Vite + React            — editör SPA (Next gerekmez; hosting/SSR yok)
Tailwind + shadcn/ui
Hono                    — lokal Node sunucusu (hafif, hızlı)
zod                     — şema → runtime doğrulama + form üretimi
Tiptap → markdown       — richtext (markdown olarak saklanır)
commander               — CLI (`init`, `types`, `export`, varsayılan serve)
Vitest (core) + Playwright (E2E)
```

**Ne yok:** veritabanı yok, Supabase yok, auth yok, token yok, OAuth yok, Next.js yok, harici storage yok. Sıfır altyapı.

**Neden richtext = markdown:** Git diff'i okunabilir kalır, içerik başka araca taşınabilir.

## 5. Dosya Layout'u (Kullanıcının Repo'sunda)

```
content/
  _schema.json          ← UI'ın yazdığı şema
  posts/
    hello-world.json    ← koleksiyon: item başına bir dosya
    ikinci-yazi.json
  settings.json         ← singleton: tek dosya
  media/
    kapak.webp
justjson.config.json    ← opsiyonel: content dizini yolu vb. (yoksa ./content varsayılır)
```

**Koleksiyon = dizin, item = dosya.** Alternatifi (koleksiyon başına tek büyük dizi) her düzenlemede tüm dosyayı çakıştırır ve diff'i okunmaz yapar. Item başına dosyada iki farklı kaydı düzenlemek çakışmaz, diff temiz kalır.

`_schema.json` örneği:
```json
{
  "version": 1,
  "collections": [{
    "name": "posts", "label": "Yazılar", "path": "posts",
    "fields": [
      { "key": "title", "type": "text", "required": true },
      { "key": "body",  "type": "richtext" },
      { "key": "cover", "type": "image" },
      { "key": "tags",  "type": "relation", "to": "tags" }
    ]
  }],
  "singletons": [{ "name": "settings", "path": "settings.json", "fields": [] }]
}
```

## 6. Şema Evrimi (Migration'sız Politika)

- **Alan ekleme** → serbest. Mevcut kayıtlarda boş görünür; `required` ise "eksik" rozeti.
- **Alan silme** → `_schema.json`'dan çıkar, ama içerik dosyalarındaki anahtar **kalır** (tek satırlık şema commit'i). Alan geri eklenince içerik geri gelir.
- **Rename** → `key` sabit, sadece `label` değişir. Gerçek key rename v1'de yok (sil + ekle).
- **Doğrulama gevşek** → içerik şemayla uyuşmuyorsa UI uyarır, engellemez.

Biriken ölü anahtarlar için şema ekranında ayrı, bilinçli bir **"kullanılmayan alanları temizle"** eylemi bulunur.

> Not: Bu yalnızca *şema alanı* silmeyi kapsar. **İçerik (entry) silme serbesttir** — kullanıcı bir kaydı silince dosya diskten silinir.

## 7. Endpoint / Kullanım (Kullanıcının Tarafında)

JustJSON endpoint sağlamaz; dosyalar zaten kullanıcının. Dokümantasyonda önerilen tüketim kalıpları:
- Build sırasında JSON'u doğrudan import etmek (statik siteler).
- Repo üzerinden CDN: `https://cdn.jsdelivr.net/gh/user/repo@branch/content/posts/hello-world.json`.
- Kendi sitesinin `public/` altına koyup kendi domaininden servis etmek.

`npx justjson types` ile üretilen `types.ts`, bu tüketimi tip-güvenli yapar.

## 8. Medya

- `content/media/` altına yazılır; diğer her şey gibi repo'da durur.
- Yüklemeden önce **tarayıcıda resize + WebP** (canvas): 4 MB fotoğraf ~200 KB olur.
- **Sert boyut limiti** (~4 MB). JSON'daki alan, medya dosyasına göreli yol tutar (`content/media/kapak.webp`).
- Harici storage yok; git binary'yi büyütmemek için `media/` ayrı dizinde ve boyut sınırlı.

## 9. Hata Yönetimi

- **Diskte elle değişiklik** → sunucu dosyayı yeniden okur; UI'da açık kayıt bayatladıysa "dosya diskte değişti, yeniden yükle" uyarısı.
- **Bozuk/elle düzenlenmiş JSON** → parse hatası kayıt bazında yakalanır, diğer kayıtları etkilemez; UI'da "bu dosya okunamadı" gösterimi.
- **Şema/içerik uyuşmazlığı** → engellemez, uyarı rozeti.
- **Yazma hatası (izin/dolu disk)** → net hata mesajı, kısmi yazma yok (önce temp'e yaz, sonra atomik rename).

## 10. Demo Playground (Portfolyo İçin)

`MemoryAdapter` sayesinde editör UI'ı, lokal sunucu olmadan tarayıcıda tek başına çalışabilir. Proje landing sayfasına gömülür: ziyaretçi template seçer, alan ekler, içerik girer, üretilen JSON'u ve `types.ts`'i görür — hiçbir şey diske/sunucuya yazılmadan. Lokal bir aracın "canlı demo" eksikliğini kapatır.

## 11. Test Stratejisi

- `packages/core` → saf fonksiyonlar (şema→zod, doğrulama, export, tip üretimi) → Vitest.
- `packages/justjson` fs işlemleri → geçici dizine karşı integration testleri (atomik yazma, okuma, listeleme).
- E2E → Playwright: geçici repo'da `npx justjson` ayağa kaldır → template seç → alan ekle → içerik gir → diskteki dosyayı doğrula (tam döngü).

## 12. Sürüm Yol Haritası

- **v1:** Bu doküman — `npx justjson` lokal editör + core + demo playground.
- **v2:** File System Access API ile sunucusuz tarayıcı modu + canlı önizleme.
- **v3:** MCP server (core üstünde ince katman).

## 13. Açık Konular

- Kesin isim + (isteğe bağlı) domain — JustJSON geçici.
- `justjson.config.json` alanlarının kesin şeması (content yolu, çıktı biçimi tercihleri).
- Relation alanının UI'da nasıl çözüleceği (slug bazlı referans + seçici).

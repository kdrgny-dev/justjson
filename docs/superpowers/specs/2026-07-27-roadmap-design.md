# JustJSON Roadmap Tasarımı — 2026-07-27

Bu doküman bir beyin fırtınası oturumunda netleşen dört işin tasarım kararlarını
dondurur. Her iş ayrı bir sürüm ve kendi implementation plan'ını hak ediyor;
bu doküman ortak referans.

Konumlandırma merceği: *"içerik senin, sadece JSON, git-friendly, senin
build'ine hazır."* Her karar bu teze hizmet ettiği için seçildi.

## Sürüm sırası

1. **#1 Teknik borç** (v1.2.1 — hızlı) — zemini temizler.
2. **#2 validate + loader** (v1.3 — stratejik) — build halkasını kapatır.
3. **#3 Draft/Published + yeni field tipleri** (v1.4 — beklenen).
4. **#4 UI i18n** (v1.5 — adoption). En son, çünkü diğer işler de string ekler;
   önce yapmak boşa iş olur.

İçerik i18n (kullanıcının kendi içeriğinin çok dilli olması) bilinçli olarak
kapsam dışı; ayrı bir proje (#5) olarak kuyruğa alındı.

---

## #1 — Teknik borç (v1.2.1)

Tasarlanacak yeni davranış yok; sağlamlaştırma.

1. **CLI sürümü.** `packages/justjson/src/cli.ts:11` `.version('0.0.0')`
   hardcoded; gerçek sürüm 1.2.0. `package.json`'dan okunacak (build-time import
   veya runtime read).
2. **Typed error handling.** `packages/justjson/src/server.ts` `onError`, Türkçe
   mesaj prefix'iyle (`startsWith('Güvensiz')`, `'Yol'`, `'Bilinmeyen'`) HTTP
   status seçiyor — mesaj değişince kırılır. Core'da tipli hata sınıfları
   (`UnsafeSlugError`, `NotFoundError`, `PathEscapeError`) tanımlanıp status'a map
   edildi. Bu aynı zamanda #4 i18n'in önkoşulu: status mesaja bağlıysa mesaj
   çevrilemez.
3. ~~**Commit'lenmiş artefaktlar.**~~ İnceleme sırasında düzeltildi: `dist/` ve
   `.turbo/` zaten `.gitignore`'da ve tree'de tracked değil. Sorun yoktu.
4. ~~**AI iddiası düzeltmesi.**~~ İnceleme sırasında düzeltildi: `AiScaffoldPanel`
   (`apps/editor/src/TemplateGallery.tsx`) prompt'tan komple şema üretip import
   ediyor — yani "AI drafts the schema" iddiası **gerçek**. README/landing doğru,
   değişiklik gerekmedi. (Explore agent bu dosyayı okumadığı için eksik raporladı.)

Ek düzeltme: `packages/core/src/index.ts`'teki kullanılmayan ve stale
`VERSION = '0.0.0'` export'u kaldırıldı (core'un IO-bağımsızlığını bozmadan
dinamik yapılamıyordu; ölü API olduğu için silmek en temizi).

---

## #2 — validate + loader (v1.3)

Ürünün "senin build'ine hazır" vaadinin eksik yarısını tamamlar.

### `justjson validate` komutu

**Kapsam: entry-içi + çapraz kontroller.**

- Entry-içi: mevcut `validateEntry(fields, data)` (required eksik, tip
  uyuşmazlığı, şemada olmayan anahtar) tüm `content/`'te gezdirilir.
- Çapraz kontroller:
  - **Kırık relation** — bir entry, hedef collection'da var olmayan slug'a
    referans veriyor.
  - **Duplicate slug** — aynı collection'da iki entry aynı slug.
  - **Eksik medya** — `image` alanı `content/media/`'da olmayan dosyaya işaret
    ediyor.
  - **Şema-içerik uyumu** — diskte şemada olmayan collection klasörü, ya da tersi.

**CI ergonomisi:**
- Varsayılan çıktı: insan-okur, `dosya:alan` bazında hata listesi + özet
  (`3 errors, 1 warning`).
- `--json`: makine-okur çıktı (CI annotation'ları için).
- Exit kodu: hata varsa `1`, temizse `0`.
- Warning politikası: **varsayılan geçir, `--strict` kırsın.** Hatalar her zaman
  exit 1; warning'ler (ör. bilinmeyen anahtar = şemadan silinen alanın verisi)
  varsayılan exit 0, `--strict` bunları hataya yükseltir (eslint/tsc konvansiyonu).

### Typed content loader

**Mimari: generated typed loader (üretilen kod) + Astro adapter.**

- `justjson types` bugün `types.ts` üretiyor; ek olarak (veya yanında) **tam
  tipli** `loadPosts()`, `loadSettings()` gibi helper'lar üretilecek. Collection
  adı → tip eşlemesi üretim anında zaten biliniyor, yani otomatik tipli.
- **Sıfır runtime bağımlılık** — kullanıcı kodu dahil hiçbir şey kiralanmıyor,
  "dosyalar senin" tezine birebir uyar.
- **Portability:** üretilen loader `content/`'i resolve edilebilir bir dizinden
  `fs` ile okur (Node build'ler için portable). Astro tarafı adapter ile çözülür.
- **Draft filtreleme:** loader varsayılan olarak yalnızca `_status: "published"`
  entry'leri döner (bkz. #3); draft'ları dahil etmek opsiyonel olacak.
- **Astro adapter:** çekirdeğin üstüne ince bir sarmalayıcı; Astro'nun `loader`
  API'siyle content collections'a bağlanır. Landing (zaten Astro) ile dogfood
  edilir.

`@justjson/core` bilinçli olarak IO-bağımsız kalır; fs okuyan loader oraya
girmez — üretilen dosya kullanıcının projesinde yaşar.

---

## #3 — Draft/Published + yeni field tipleri (v1.4)

### Draft / Published

**Model: her collection'a otomatik, `draft`/`published`.**

- Her entry bir **reserved meta anahtar** alır: entry JSON'ında
  `_status: "draft" | "published"`. `_` prefix'i kullanıcı alanlarıyla çakışmayı
  önler; diskte görünür, git-diff'lenir, loader/validate okuyabilir.
- Varsayılan `published` (geriye uyumlu; mevcut içerik olduğu gibi yayınlı kalır).
- Singleton'larda statü yok.
- Loader varsayılan sadece `published` döner (yukarıda).
- validate draft'ları da doğrular (statü, doğrulamayı atlatmaz).

Ayrı index dosyası yerine gömülü meta anahtar seçildi — senkron sorunlarından
kaçınmak ve dosya-tabanlı teze sadık kalmak için.

### Yeni field tipleri

Bu turda **beşi de** ekleniyor. Her tip dört yere dokunur: UI kartı
(`apps/editor/src/field-types.ts`), validasyon (`packages/core/src/validate`),
`types.ts` üretim eşlemesi (`packages/core/src/types/generate.ts`), loader
tiplemesi.

- **url** — validasyonlu string; `types.ts`'te `string`, format kontrolü.
- **email** — validasyonlu string; `types.ts`'te `string`, format kontrolü.
- **list** — serbest string dizisi (etiketler, maddeler); `relation`'dan farkı
  serbest metin olması; `types.ts`'te `string[]`.
- **group / nested object** — alt alanları olan iç içe nesne. **En pahalısı:**
  özyinelemeli UI (SchemaBuilder + form) ve özyinelemeli tip üretimi gerektirir.
  Kapsamı tek başına büyütebilir; plan aşamasında dikkatle ele alınacak.
- **color** — hex renk seçici; `types.ts`'te `string`.

---

## #4 — UI i18n (v1.5)

**Kapsam: sadece UI i18n, İngilizce varsayılan.** İçerik i18n kapsam dışı.

- Editör + CLI çıktı string'leri bir `t()` katmanına taşınır; şu an her yerde
  hardcoded Türkçe.
- **İngilizce varsayılan** (landing İngilizce kitle çekiyor; editör açılınca
  İngilizce görünür). **Türkçe** ikinci dil olarak korunur.
- Dil seçme mekanizması (spec önerisi, review'da netleşecek):
  - Editörde ayarlardan dil anahtarı, `localStorage`'da kalıcı.
  - CLI çıktısı `--lang` bayrağı / `JUSTJSON_LANG` env'ini dikkate alır.
- Önkoşul: #1'deki typed error handling (status mesaja bağlı olmamalı ki mesajlar
  çevrilebilsin).

---

## Kapsam dışı (bilinçli)

- **İçerik i18n** — kullanıcının kendi içeriğinin çok dilli olması. Ayrı proje (#5).
- **Medya yaşam döngüsü** (orphan cleanup, resim-dışı dosya, alt-text) — validate'in
  "eksik medya" kontrolü dışında; genişletme ileride.
- **3. statü (scheduled)** — build-zamanı vs okuma-zamanı karmaşıklığı; şimdilik yok.

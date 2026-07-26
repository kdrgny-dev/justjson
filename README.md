# JustJSON

> Lokalde çalışan, JSON üreten mini CMS. Bizde hiçbir şey durmaz — içerik senin.

JustJSON, kendi proje klasöründe çalıştırdığın bir editördür. Şemanı kurar (ya da hazır template seçersin), içeriğini temiz bir arayüzden girersin, ve düzenlemeler **doğrudan diskteki JSON dosyalarına** yazılır. Veritabanı yok, sunucu yok, token yok, hesap yok.

```bash
npx justjson
```

## Neden?

- **İçerik %100 senin** — dosyalar zaten senin repo'nda; JustJSON sadece onları düzenler.
- **Sıfır altyapı** — lokalde çalışır, hiçbir yere veri göndermez.
- **Endpoint senin** — JSON'u nereye deploy edersen o senin API'n olur (repo raw, jsDelivr, kendi siten).
- **Tip güvenli** — şemadan `types.ts` üretir.

## Hızlı başlangıç

```bash
cd projem/
npx justjson init blog   # şema + örnek içerik oluşturur
npx justjson             # editörü tarayıcıda açar (localhost)
```

Editörde koleksiyon/tekil kayıtlarını düzenlersin; her kayıt `content/` altına JSON olarak yazılır. Bitince `git commit` senin.

## Komutlar

| Komut | İş |
|---|---|
| `npx justjson` (veya `serve`) | Lokal editörü başlatır ve tarayıcıda açar |
| `npx justjson init [template]` | Template ile başlatır (`blog`, `cv`) |
| `npx justjson types` | Şemadan `types.ts` üretir |
| `npx justjson export` | ZIP snapshot (şema + içerik + types) |

## Durum

v1 çalışır durumda: şema kurma, koleksiyon/tekil CRUD, tüm alan tipleri (text, richtext, number, boolean, date, select, relation, image), çoklu relation, canlı doğrulama, tip üretimi ve ZIP export. Tasarım: [`docs/design.md`](docs/design.md).

Mimari: `@justjson/core` (saf mantık) · `justjson` (CLI + lokal Hono sunucu) · `@justjson/editor` (React SPA, sunucudan servis edilir).

## Geliştirme

```bash
pnpm install
pnpm build
pnpm test
```

## Lisans

[MIT](LICENSE) © Kadir Günay

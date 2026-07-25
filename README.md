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

## Durum

Erken geliştirme. Tasarım dokümanı: [`docs/design.md`](docs/design.md).

## Komutlar (planlanan)

| Komut | İş |
|---|---|
| `npx justjson` | Proje klasöründe lokal editörü açar |
| `npx justjson init` | Hazır template ile başlatır (CV, blog, portfolyo…) |
| `npx justjson types` | Şemadan `types.ts` üretir |
| `npx justjson export` | ZIP snapshot (şema + içerik + medya + types) |

## Geliştirme

```bash
pnpm install
pnpm build
pnpm test
```

## Lisans

[MIT](LICENSE) © Kadir Günay

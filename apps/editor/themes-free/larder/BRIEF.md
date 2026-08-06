# Larder — yapım brief'i

**id:** `larder` · **lisans:** `free` (MIT repoda ship olur) · **sektör:** restoran / kafe · **dil:** demo TR + EN

## 0. Tek cümle

Menüsünü, saatini ve adresini bir masaya bırakılmış kâğıt üzerinde gösteren; görsel
yüklemeyen küçük bir işletmede bile eksik görünmeyen restoran teması.

## 1. Sözleşme (tekrar etme, uy)

Slot binding, CSS contract, reserved class'lar, referans etiği ve derleme akışı:
`apps/editor/themes-src/CLAUDE.md`. Çelişki olursa o doküman kazanır. Bu brief
sadece Larder'a özel olanı tanımlar.

**Free tema farkı (CLAUDE.md §5 premium barı burada geçerli değil):**
WebGL zorunlu değil, 4 template zorunlu değil. Ama şunlar aynen geçerli: tema
hiçbir metin/görsel barındırmaz, slot binding, reserved class'lar, harici JS yok,
JS kapalıyken içerik okunur, `prefers-reduced-motion` tek kare, 375px'te taşma yok.

**Bu sektörde slot tuzağı:** menü bölümleri bir *collection*'dır, `{{#sections}}`
ile gelir; yemek kalemleri o kaydın *repeater*'ıdır, `{{{extras}}}` ile
`<table class="jj-table">` olarak gelir. Şablonda `{{menu}}`, `{{fiyat}}`,
`{{yemekler}}` gibi bir kelime **geçemez**.

## 2. Dosyalar

```
apps/editor/themes-free/larder/
  meta.json     { id:"larder", name:"Larder", version:"1.0.0", license:"free", thumb:"" }
  styles.css    tek stylesheet
  index.html    ana sayfa — masa: kimlik, saat/adres, menü, bölümler
  entry.html    tek kayıt — bir menü bölümü ya da bir yazı
  list.html     collection dizini — kapsam dışıydı, eklendi (aşağıdaki not)
```

`page.html` **yazılmaz**; `pages` kayıtları renderer'ın çıplak fallback'ine düşer
ve tema onu `.wrap` üzerinden biçimler.

**Kapsam sapması (inşa sırasında, gerekçeli):** kapsam "sadece index + entry"
seçilmişti. Ama `{{#nav}}` her collection'ın dizin sayfasına link veriyor ve o
sayfa fallback'te ne şerit ne footer taşıyor — ziyaretçi geri dönüş linki olmayan
bir sayfada kalıyordu. `list.html` bu çıkmazı kapatmak için eklendi (band +
kart ızgarası, index'in bileşenlerini yeniden kullanır, yeni CSS gerektirmez).

### Altyapı değişikliği (temadan önce yapılır)

Free tema kaynağı public MIT repoda okunabilir kalmalı, `themes-src/` ise private
ve gitignore'lu. O yüzden:

1. **`scripts/theme-compile.mjs`** — kaynak dizinini bul: önce
   `themes-src/<id>/`, yoksa `themes-free/<id>/`. Bulunan yol `srcDir` olur.
   (~8 satır; mevcut premium akışı hiç değişmez.)
2. Aynı dosyada `--no-mangle` bayrağı: `themes-free/` altından derlenen tema
   **mangle edilmez** (kaynak zaten public, mangle koruma sağlamaz; okunabilir
   çıktı MIT repo için doğrusu). Minify açık kalır.
3. **`.gitignore`** — premium whitelist bloğuna bir satır:
   `!apps/editor/src/themes/larder.json`
4. `apps/editor/themes-free/` gitignore'lu **değildir**; commit'lenir.

Bu üç değişiklik temadan önce yapılır ve `node scripts/theme-compile.mjs apogee`
ile premium yolun bozulmadığı doğrulanır.

## 3. Yapı — sayfa akışı

Zemin metaforu: **koyu yeşil masa** (sayfa tabanı) üzerinde **krem bir kâğıt
levha** (içerik). Levha `index`te hero'nun hemen altında başlar, sayfa boyunca
tek parça sürer, footer'da biter.

### index.html

1. **Şerit** — `{{siteName}}` (display serif, küçük), `{{#nav}}` linkleri, ve
   `{{#contact}}` içinden **ilk telefon + ilk adres satırı** sağda. Mobilde
   CSS-only `:checked` menü; şeritte telefon her zaman görünür kalır.
   Şerit masanın üstünde durur, kâğıdın değil.
2. **Hero** — `{{hero.title}}` display serif clamp'lı, `{{hero.lead}}` sans,
   `{{hero.cover}}` **bantlı** (bkz. §4). Cover yoksa §4'teki tipografik plaka.
3. **Saat rayı** — `{{#hero.meta}}` chip'leri yatay bir ray olarak, kâğıdın üst
   kenarına oturur. `{{#href}}<a>{{/href}}{{^href}}<span>{{/href}}` ikilisi
   zorunlu (mail/url tıklanır, saat düz metin).
4. **Gövde** — `{{{hero.body}}}` `.rt` içinde, ölçü `max-width: 68ch`.
5. **Menü** — `{{{hero.extras}}}`. Tema burada karar verir: masaüstünde noktalı
   leader'lı satır, mobilde `data-label` kartı (§5).
6. **Bölümler** — `{{#sections}}`: her collection bir başlık + kart ızgarası
   (`{{_title}} {{_lead}} {{_cover}} {{_url}}`). Izgaradaki **ilk kart** bantlı,
   diğerleri düz. Bölüm başlığı `{{label}}`, tümünü gör linki `{{url}}`.
7. **Footer** — `{{#contact}}` tamamı (saat, adres, telefon, mail), sonra
   "Built with JustJSON". Uydurma hiçbir string yok.

### entry.html

1. Aynı şerit (kod tekrarlanır — paylaşılan script/partial yok).
2. **Yarım yükseklikte band** — `{{collection.label}}` eyebrow (mono/caps değil,
   §11'deki `lang` tuzağı), `{{slots.title}}`, `{{slots.lead}}`. Tam ekran boş
   başlık **yok**.
3. `{{slots.cover}}` bantlı, band'ın altına yarım taşar (kâğıdın üstüne konmuş
   fotoğraf hissi).
4. `{{#slots.meta}}` chip rayı.
5. `{{{slots.body}}}` `.rt`.
6. `{{{slots.extras}}}` — menü tablosu, index ile birebir aynı stil.
7. `{{collection.url}}` ile geri dönüş + footer.

## 4. İmza

**Kâğıt + bant** — içerik krem bir levhada durur; kapak görselleri masaya
bantlanmış gibi hafifçe eğridir, hover/focus'ta düzelip yükselir.

Kurallar (abartma yasağı, cevaplardan):
- Eğim **≤ 1.5°**, ve **her görselde değil**: yalnız `cover` slot'u ve
  `{{#sections}}` ızgarasının ilk kartı. `.rt` içindeki gömülü görseller **düz**.
- Eğim rastgele değil, **deterministik**: `:nth-child(4n+1..4n)` üzerinden
  `--tilt: -1.4deg | -0.7deg | 0.9deg | 1.3deg`. Aynı sayfa her zaman aynı görünür.
- **Bant**: `::before` + `::after`, 64–88px genişlik, üst iki köşede, çapraz
  ~8°, kenarları 1px yumuşak. Yırtık kenar/scrapbook dokusu **yok**.
  Rengi yüzeye göre değişir (uygulamada bulundu): masada açık bant
  `rgba(244,239,227,.62)`, kâğıt üstünde koyu bant `rgba(90,84,60,.18)` — tek
  değer iki zeminden birinde görünmez kalıyor.
- Hover/focus-visible: `rotate: 0deg`, `translateY(-4px)`, gölge büyür, 240ms
  `cubic-bezier(.2,.7,.3,1)`. Dokunmatik cihazda hover yok — `@media (hover:hover)`.

**Görselsiz fallback (zorunlu):** `{{^cover}}` dalında **tipografik plaka** —
başlığın ilk harfi 1 display serif glif, krem levha üzerinde, ince pirinç
çerçeve, bant yok. Görsel yüklemeyen işletmede sayfa eksik görünmez.

Sessizlik: paralaks yok, imleç takibi yok, sayfa geçiş animasyonu yok, ikinci imza
yok.

## 5. Menü tablosu (`jj-table`) — birinci sınıf

Restoranda en çok kullanılacak alan bu; renderer'ın çıktısını yeniden biçimle.

- **≥ 720px:** `thead` gizli değil ama sessiz. Her satır: ad solda, açıklama
  ikinci satırda `--ink` %70 opaklıkta, fiyat sağda. Ad ile fiyat arasında
  **noktalı leader** — `flex` + araya `border-bottom: 1px dotted` alan bir
  `::after`/boş span değil, `background-image: radial-gradient(...)` ile çizilen
  1px'lik nokta dizisi (yazdırmada da düzgün çıkar).
- **< 720px:** `thead { display: none }`, her `td` blok,
  `td::before { content: attr(data-label) }` etiket olarak üstte. Fiyat sütunu
  sağa yaslı kalır.
- `jj-table-wrap` yatay kaydırma **görünür** olsun (kaybolan sütun yok).
- Kolon sayısı bilinmez — `table-layout: auto`, hiçbir sütuna sabit genişlik verme.

## 6. Motion — hafif Canvas 2D

Tek `<canvas data-paper>`, `position: fixed; inset: 0; z-index: 0`, kâğıdın
**altında**. Her template'te inline `<script>` olarak tekrarlanır (paylaşılan
dosya yok). Bütçe: template başına **≤ 3KB** minify öncesi.

Ne çizer:
1. **Kâğıt lifi** — 256×256'lık tek bir gürültü karosu **bir kez** offscreen
   canvas'a üretilir, sonra `createPattern` ile döşenir. Her karede yeniden
   gürültü üretme.
2. **Işık kayması** — tek büyük radial gradient, lissajous yörüngede
   (`ax=0.017Hz, ay=0.011Hz`), amber→şeffaf. Masanın üstünde gezen tek lamba.

Kurallar:
- **≤ 30fps** (`rAF` içinde zaman kapısı), `document.hidden` iken durur.
- `devicePixelRatio` cap: `min(dpr, 1.5)`, `<760px` altında `1.15`; genlik yarıya.
- `prefers-reduced-motion: reduce` → **tek kare çiz, döngüye girme**.
- Canvas başarısız olursa (context yok): `styles.css` içindeki statik
  `background-image` fallback görünür kalır. Boş siyah alan asla.
- Reveal: `IntersectionObserver` ile `[data-reveal]`, `once`, 12px yükselme +
  opaklık, 420ms. `[data-js]` yoksa her şey görünür durumda başlar.

## 7. Ayarlanabilir knob'lar

`styles.css` en üstünde tek blok — dosyaya serpiştirilmiş sihirli sayı bırakma:

```css
:root {
  --table:  #16241C;  /* masa — sayfa tabanı, koyu şişe yeşili */
  --paper:  #F4EFE3;  /* kâğıt levha */
  --ink:    #1B2A20;  /* kâğıt üstü metin */
  --olive:  #4A5D3A;  /* ikincil metin, hairline */
  --brass:  var(--jj-accent, #C9A227); /* vurgu — pirinç */

  --tilt-max:    1.5deg;  /* bant eğiminin tavanı; 0 = düz */
  --tape-w:      76px;    /* bant genişliği */
  --lift:        4px;     /* hover'da yükselme */
  --paper-inset: clamp(16px, 4vw, 72px); /* levhanın kenar boşluğu */

  --disp-min: 32px;  --disp-max: 76px;  /* display serif clamp uçları */
  --measure:  68ch;                     /* .rt ölçüsü */
  --rhythm:   clamp(56px, 9vh, 128px);  /* bölüm arası dikey ritim */
}
```

```js
const CONFIG = {
  fps: 30,          // canvas kare tavanı; düşürmek pili korur
  grain: 0.055,     // lif yoğunluğu; artırınca kâğıt kabalaşır
  lightR: 0.62,     // ışık havuzu yarıçapı (viewport'un kısa kenarına oran)
  lightA: 0.10,     // ışık opaklığı; 0 = düz kâğıt
  driftX: 0.017,    // ışığın yatay hızı (Hz)
  driftY: 0.011,    // dikey hız — X ile eşit olmasın, yörünge kapanır
  dprCap: 1.5,      // <760px'te 1.15'e iner
};
```

## 8. Görsel yön

- **Palet:** yukarıdaki blok. `--jj-accent` fallback `#C9A227`; Design panelinden
  değiştirilince bant, leader noktaları ve link altı çizgisi onunla döner —
  kâğıt ve masa **dönmez** (temanın kimliği o ikisi).
- **Tipografi:** display **Gambarino** (Fontshare), gövde **Switzer** (Fontshare).
  Tek `@import`, URL 200 doğrulanacak. Meridian'ın Fraunces'ından ayrışır.
  Başlık `clamp(var(--disp-min), 6.4vw, var(--disp-max))`, `line-height: 1.02`,
  `letter-spacing: -0.012em`. Gövde 16px / 1.6.
- **Ritim:** levha `max-width: 1180px`, iç boşluk `--paper-inset`, bölümler arası
  `--rhythm`. Kırılmalar: 480 / 720 / 1024.
- **Yasak görünüşler:** krem+serif+terracotta üçlüsü — burada taban **koyu yeşil**,
  vurgu **metalik pirinç**, serif **modern/wonky**; bu üçü ayrımı taşır, terracotta
  ailesinden hiçbir ton kullanma. Ayrıca near-black+tek asit vurgu ve gazete
  hairline'ı yasak. Mevcut temaların imzaları (lens, yatay sahne, deck, sıvı ışık)
  tekrar edilmez.

## 9. Referans

Harici referans **yok** — yön içeriden türetildi: basılı menü kartı + masaya
bırakılmış fotoğraf. Bir siteye bakarak yapı transferi yapılmayacak.

## 10. İçerik ve demo

Tema hiçbir metin/görsel barındırmaz. Demo içeriği iki dilde yazılır:

- `apps/editor/src/templates/restaurant.json` (TR)
- `apps/editor/src/templates/restaurant-en.json` (EN)

Şema (ikisinde de aynı, sadece dil farklı):
- **singleton `home`** — ad, tagline, kapak, gövde (richtext), ve meta olarak
  saat / adres / telefon / rezervasyon maili. Şeridin ve footer'ın beslendiği yer.
- **collection `menu`** — **6+ kayıt** (kahvaltı, başlangıçlar, ana yemekler,
  tatlılar, şaraplar, kahveler). Her kayıt: kapak, kısa lead, richtext not, ve
  **repeater `items`** → ad / açıklama / fiyat. Bu repeater menü tablosunu besler.
- **collection `notes`** — **6+ kayıt**, mutfaktan kısa yazılar (tedarikçi,
  mevsim, teknik). Uzun okuma yolunu ve kartların kapaksız halini test eder.

Kurallar: uydurma istatistik yok, gerçek restoran adı/markası yok — kurgusal ama
inandırıcı bir işletme. Görseller Unsplash, her URL 200 doğrulanmış. Kopya
`marketing-skills:copywriting` ile yazılıp `copy-editing` ile sıkılaştırılır.

**Kasıtlı test:** `notes` kayıtlarının **en az ikisi kapaksız** olsun — §4'teki
tipografik plaka demo'da gerçekten görünsün.

### Demo matrisi

`scripts/build-theme-demos.mjs` çıktı dizinini `demo.theme` ile üretiyor; aynı
temayı iki dilde render etmek çakışır. Matrise **opsiyonel `out`** alanı ekle
(`const dir = join(outRoot, demo.out ?? demo.theme)`, ~1 satır) ve satırları yaz:

```js
{ theme: 'larder', template: 'restaurant',    lang: 'tr' },
{ theme: 'larder', template: 'restaurant-en', lang: 'en', out: 'larder-en' },
```

## 11. Dil tuzağı

Demo TR olduğu için: içerikten türeyen hiçbir metinde
`text-transform: uppercase` **kullanma** (TR `lang` altında `i` → `İ` bozulur).
Caps sadece temanın kendi sabit chrome'unda (eyebrow etiketleri) ve orada da
`lang="en"` demo ile ortak olacaksa Latin harfli sabit stringlerde. Emin
değilsen caps kullanma.

## 12. Kapsam dışı

- `list.html` ve `page.html` yazılmaz.
- WebGL / GLSL yok, shader yok.
- Paralaks, imleç takibi, sayfa geçiş animasyonu, sticky deck yok.
- Rezervasyon formu, harita gömme, sipariş akışı, dil değiştirici yok.
- Dark/light toggle yok — tek bir ışık var.
- Scrapbook dokusu (yırtık kenar, kırışık kâğıt görseli, washi deseni) yok.
- Hiçbir metin, ikon seti, logo ya da görsel temaya gömülmez.

## 13. Olmazsa olmazlar

- Slot binding: hiçbir template'te sektör alan adı geçmez.
- Reserved class'lar korunur: `fld`, `fld-label`, `rt`, `img`, `swatch`, `group`,
  `jj-table`, `jj-table-wrap`.
- Harici JS/CDN yok; webfont dışında harici CSS yok.
- JS kapalıyken tüm içerik okunur; `prefers-reduced-motion: reduce` altında tek kare.
- 375px'te yatay taşma yok, çalışan mobil menü, dokunma hedefi ≥44px.
- `:focus-visible` görünür (pirinç 2px outline + 2px offset), başlık sırası doğru,
  alt metni title slot'undan.
- **Saat + adres + telefon** şeritte ve footer'da; footer'a gömülüp kaybolmaz.
- **Menü tablosu** birinci sınıf: masaüstü leader, mobil `data-label` kart.
- **Kapak görseli olmadan** sayfa eksik görünmez (tipografik plaka).
- **Bant sakin:** ≤1.5°, sadece cover ve ilk kart.

## 14. Doğrulama

1. `node scripts/theme-compile.mjs apogee` — altyapı değişikliği premium yolu
   bozmadı.
2. `node scripts/theme-compile.mjs larder` — `themes-free/` kaynağından derledi,
   çıktı **mangle edilmemiş**, minify edilmiş, `var(--jj-accent)` duruyor.
3. `pnpm test` — `themes.test.ts` yeşil; larder'ı bundle listesine ekle
   (free tema, `bold`/`editorial` gibi doğrudan import edilir).
4. `pnpm demos` + `pnpm thumbs` — `larder/` ve `larder-en/` dizinleri, kırık link yok.
5. **İkinci şema testi:** `portfolio.json` ve `cv.json` ile render et — kırılmıyor,
   menü tablosu olmayan şemada boş kutu bırakmıyor, hâlâ mantıklı okunuyor.
6. Tarayıcı: home + entry, **375 · 768 · 1280**, reduced-motion yolu, JS kapalı hâli.
7. **Kanıt:** bant hover'ı düzelirken çekilmiş bir kare + oturmuş kare; menü
   tablosunun 375px ve 1280px hâlleri; kapaksız bir kaydın tipografik plakası.

## 15. Teslim

`themes-free/larder/` kaynağı + derlenmiş `src/themes/larder.json` + iki template
+ derleyici/gitignore/DEMOS değişiklikleri. `landing/public` yerelde sunulur, URL
verilir ve **durulur** — public repo push'u üretim deploy'u tetiklediği için
onaysız push yok.

# İmaj CAD

Telefon, tablet ve bilgisayarda tarayıcıda çalışan, kurulabilir (PWA) 3D CAD uygulaması.
Hedef: makinenin başında ölçü alarak parçaları çizmek, montajlamak ve üretim çıktılarını
(STEP, sac açınımı DXF, profil kesim listesi, teknik resim) almak.

**Canlı sürüm:** https://aliyldz01.github.io/imaj-cad/

## v0.6 — Kaynaklı yapı (profil) modülü

Ayrıntılı özellik listesi ve sonraki adımlar: [docs/YOL_HARITASI.md](docs/YOL_HARITASI.md)

- **Parça belgesi:** Orijin, Ön / Üst / Sağ düzlem, FeatureManager ağacı (eskizler özelliğin altında), düzenle / bastır / sil, geri sarma çubuğu (araya özellik ekleme), çoklu gövde, global değişkenler ve denklemler, STEP içe aktarma
- **Eskiz:** çizgi, merkez çizgisi, köşe / merkez / 3 noktalı dikdörtgen, paralelkenar, daire, çevre dairesi, merkez / teğet / 3 noktalı yay, kanal, çokgen, nokta, eskiz radyüsü ve pahı, kırp, uzat, ötele, aynala, doğrusal / dairesel çoğaltma, taşı / kopyala / döndür, varlıkları dönüştür, kesişim eğrisi, ölçekle, merkez noktalı / yay kanal, elips, kısmi elips, parabol, spline, metin, yapı geometrisi
- **İlişkiler:** otomatik (yatay, dikey, çakışık, üzerinde, orta nokta, teğet) ve elle (paralel, dik, eşit, doğrudaş, eş merkezli, simetrik, sabit)
- **Akıllı ölçü:** uzunluk, yatay / dikey / hizalı mesafe, çap, yarıçap, açı, nokta–çizgi; referans (sürülen) ölçü, denklemli ölçü, tam tanımla, tanımlılık renkleri (mavi / siyah / kırmızı) ve serbestlik derecesi
- **Katı özellikler:** ekstrüzyon ve kesme (kör, tümünden geçen, sonrakine kadar, düz / eğri yüzeye kadar, yüzeyden ötele, orta düzlem, iki yön, koniklik, burulma, ince özellik), döndürme, süpürme, loft (merkez çizgili; hepsinin kesme türü), delik sihirbazı (ISO M3–M24, boru dişi G, inç UNC, kozmetik diş), radyüs (sabit, değişken, tam yuvarlak), pah (eşit, mesafe–mesafe, mesafe–açı), kabuk, koniklik, kaburga, kubbe, sarma (kabartma / oyma), ölçekle, doğrusal ve dairesel çoğaltma, ayna, referans düzlem / eksen / nokta / koordinat sistemi
- **Sac metal:** taban flanş (kapalı eskizden levha, açık eskizden bükümlü profil), kenar flanş (büküm açısı, dış/iç sanal keskin veya teğet uzunluk, malzeme içte/dışta/bükümün dışı, kenar kısaltma, birlikte seçilen kenarlarda köşe gönyesi, büküm boşaltma), açık/kapalı kenet, çizgiden büküm; sac kalınlığı, iç büküm yarıçapı ve K faktörü
- **Açınım:** düzleştir görünümü, levha ölçüsü, alan, ağırlık, büküm tablosu (yön, açı, yarıçap); sonradan açılan delik ve kesimler açınıma yansır; DXF çıktısı (KESIM, BUKUM_YUKARI, BUKUM_ASAGI, NOTLAR katmanları)
- **Kaynaklı yapı:** iskelet eskiz çizgileri ve yayları boyunca yapı elemanı; EN profil kütüphanesi (kare/dikdörtgen kutu, boru, eşit kollu L, UPN, IPE, HEA, HEB, lama, yuvarlak ve kare dolu çubuk); delme noktası, döndürme, aynalama; gönye ve alın köşe işlemleri; kırp/uzat (düz kesim veya profile göre koplama); uç kapağı; köşe takviyesi
- **Kesim listesi:** aynı profil, boy ve açılar gruplanır; adet, kesim boyu, uç açıları, ağırlık, profil başına toplam boy; CSV (Excel) çıktısı ve her kalem için ayrı STEP
- **Henüz yok:** loft kılavuz eğrileri; esnet (Flex) — kullandığımız çekirdek derlemesi desteklemediği için yerine Ölçekle eklendi
- **Değerlendir:** ölçme (uzunluk, çap, alan, mesafe, açı), kütle özellikleri ve malzeme, kesit görünüşü
- Düzlemsel yüze eskiz, STEP / STL dışa aktarma, `.icad` kaydet / aç, otomatik kayıt, çevrimdışı çalışma
- Kalem / fare çizer ve seçer; parmak döndürür, kaydırır ve yakınlaştırır

## Teknoloji (tamamı ücretsiz)

| Bileşen | Görev | Lisans |
|---|---|---|
| [Open CASCADE Technology](https://dev.opencascade.org) (WebAssembly) | Geometri çekirdeği | LGPL 2.1 + OCCT istisnası |
| [replicad](https://replicad.xyz) | OCCT için JavaScript arayüzü | MIT |
| [FreeCAD PlaneGCS](https://github.com/Salusoft89/planegcs) (WebAssembly) | Eskiz kısıt çözücüsü | LGPL |
| [three.js](https://threejs.org) | 3D görüntüleme | MIT |
| Vite + TypeScript | Derleme | MIT / Apache 2.0 |

OCCT ve PlaneGCS, uygulama koduna gömülmeden ayrı `.wasm` dosyaları olarak yüklenir.

## Geliştirme

```bash
npm install
npm run dev      # yerel geliştirme sunucusu
npm run build    # dist/ klasörüne üretim derlemesi
```

Yayın: `dist/` içeriği `gh-pages` dalına gönderilir ve GitHub Pages'te sunulur.

## Kod yapısı

- `src/main.ts` — uygulama: FeatureManager ağacı, komut sekmeleri, özellik panelleri, modlar
- `src/doc/` — belge modeli (`types.ts`), vektör/düzlem yardımcıları, özellikleri çekirdeğe derleme
- `src/sketch/` — eskiz düzenleyici, kısıt çözücü bağlantısı, eskiz verisi işlemleri, profil çıkarma
- `src/viewer.ts`, `src/nav.ts` — Three.js görüntüleme, seçim, gezinme
- `src/kernel.worker.ts` — OpenCascade çekirdeği (ayrı iş parçacığında)
- `public/sw.js` — çevrimdışı çalışma

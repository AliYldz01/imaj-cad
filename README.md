# İmaj CAD

Telefon, tablet ve bilgisayarda tarayıcıda çalışan, kurulabilir (PWA) 3D CAD uygulaması.
Hedef: makinenin başında ölçü alarak parçaları çizmek, montajlamak ve üretim çıktılarını
(STEP, sac açınımı DXF, profil kesim listesi, teknik resim) almak.

**Canlı sürüm:** https://aliyldz01.github.io/imaj-cad/

## v0.3 — SolidWorks mantığında eskiz ve parça

Ayrıntılı özellik listesi ve sonraki adımlar: [docs/YOL_HARITASI.md](docs/YOL_HARITASI.md)

- **Parça belgesi:** Orijin, Ön / Üst / Sağ düzlem, FeatureManager ağacı (eskizler özelliğin altında), düzenle / bastır / sil, geri sarma
- **Eskiz:** çizgi, merkez çizgisi, köşe / merkez / 3 noktalı dikdörtgen, paralelkenar, daire, çevre dairesi, merkez / teğet / 3 noktalı yay, kanal, çokgen, nokta, eskiz radyüsü ve pahı, kırp, uzat, ötele, aynala, doğrusal / dairesel çoğaltma, taşı / kopyala / döndür, varlıkları dönüştür, yapı geometrisi
- **İlişkiler:** otomatik (yatay, dikey, çakışık, üzerinde, orta nokta, teğet) ve elle (paralel, dik, eşit, doğrudaş, eş merkezli, simetrik, sabit)
- **Akıllı ölçü:** uzunluk, yatay / dikey / hizalı mesafe, çap, yarıçap, açı, nokta–çizgi; tanımlılık renkleri (mavi / siyah / kırmızı) ve serbestlik derecesi
- **Katı özellikler:** ekstrüzyon ve kesme (kör, tümünden geçen, yüzeye kadar, yüzeyden ötele, orta düzlem, iki yön, koniklik), döndürme, süpürme, loft (hepsinin kesme türü), delik sihirbazı (M3–M24), radyüs, pah, kabuk, koniklik, doğrusal ve dairesel çoğaltma, ayna, referans düzlem
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

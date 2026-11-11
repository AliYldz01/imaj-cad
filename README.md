# İmaj CAD

Telefon, tablet ve bilgisayarda tarayıcıda çalışan, kurulabilir (PWA) 3D CAD uygulaması.
Hedef: makinenin başında ölçü alarak parçaları çizmek, montajlamak ve üretim çıktılarını
(STEP, sac açınımı DXF, profil kesim listesi, teknik resim) almak.

**Canlı sürüm:** https://aliyldz01.github.io/imaj-cad/

## v0.1 — deneme sürümü

- Dikdörtgen, daire ve çokgen eskizi (dokunmatik ve fare)
- Ölçü girişi (virgül ve `100/2` gibi işlemler desteklenir)
- Katı oluşturma (extrude), ekleme ve çıkarma (delik / cep)
- Katının üst yüzeyine dokunarak o yüzeye çizme
- Düzenlenebilir özellik ağacı (parametrik geçmiş), geri al / yinele
- STEP ve STL dışa aktarma
- Model tarayıcıda otomatik saklanır; internet olmadan da çalışır

## Teknoloji (tamamı ücretsiz)

| Bileşen | Görev | Lisans |
|---|---|---|
| [Open CASCADE Technology](https://dev.opencascade.org) (WebAssembly) | Geometri çekirdeği | LGPL 2.1 + OCCT istisnası |
| [replicad](https://replicad.xyz) | OCCT için JavaScript arayüzü | MIT |
| [three.js](https://threejs.org) | 3D görüntüleme | MIT |
| Vite + TypeScript | Derleme | MIT / Apache 2.0 |

OCCT, uygulama koduna gömülmeden ayrı bir `.wasm` dosyası olarak yüklenir.

## Geliştirme

```bash
npm install
npm run dev      # yerel geliştirme sunucusu
npm run build    # dist/ klasörüne üretim derlemesi
```

Yayın: `dist/` içeriği `gh-pages` dalına gönderilir ve GitHub Pages'te sunulur.

## Kod yapısı

- `src/main.ts` — arayüz, özellik listesi, geri al / yinele, dışa aktarma
- `src/viewer.ts` — Three.js sahnesi, kamera, görünüşler
- `src/sketch.ts` — 2D eskiz araçları
- `src/kernel.worker.ts` — OpenCascade çekirdeği (ayrı iş parçacığında)
- `src/kernel.ts` — çekirdekle mesajlaşma
- `src/types.ts` — paylaşılan veri tipleri
- `public/sw.js` — çevrimdışı çalışma

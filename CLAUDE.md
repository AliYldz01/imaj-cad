# İmaj CAD — devam kılavuzu (yeni sohbet buradan başlar)

Bu dosya, projeyi sıfırdan açılan bir sohbette kaldığı yerden sürdürmek için gereken her şeyi içerir.
Ayrıntılı özellik listesi: `docs/YOL_HARITASI.md` · Kullanıcı özeti: `README.md`.

## 1. Amaç

Ücretsiz (lisans ücreti olmayan), telefon / tablet / bilgisayarda çalışan bir **PWA CAD** uygulaması.
- Kullanım senaryosu: **makinenin başında parçayı ölçüp modellemek**, parçaları birleştirmek (montaj).
- Çıktılar: STEP, STL, sac metal açınımı (DXF), profil kesim listesi (CSV), imalat resimleri (A4 SVG/PDF), levha DXF.
- **Bilgisayarda tamamen SolidWorks gibi** çalışmalı (fare, kısayollar, çıkarım, seçim — v0.9'da yapıldı).
- **Telefonda** kalem veya parmakla rahat kullanılmalı (v0.10–v0.11'de yapıldı).

Canlı: https://aliyldz01.github.io/imaj-cad/ · Depo: GitHub `AliYldz01/imaj-cad` (dal `main`; yayın dalı `gh-pages`).

## 2. Çalışma düzeni ve kullanıcı tercihleri (ÖNEMLİ)

- Kullanıcı (Ali) **Türkçe** konuşur; tüm yanıtlar, arayüz metinleri, commit mesajları **Türkçe**. Genelde **telefondan** (mobil uygulama) yazar.
- Kullanıcı anlatır, **kodun tamamını asistan yazar**, test eder, **commit + push + GitHub Pages yayını kendisi yapar**.
- "Her turda daha fazla iş yap." / "**Bir özelliğin tüm fonksiyonlarını tamamlamadan başka özelliğe geçme.**"
- **Token tasarrufu iste**: dosyaları gereksiz okuma, kısa yanıt ver, hedefli `grep`/`sed -n` kullan.
- Uygulama telefonda bile kalemle kullanılıyor; kullanıcının şu an kalemi **yanında değil** (bkz. §8 bekleyenler).
- Yanıtı bitirirken: ne yapıldı (kısa), canlı sürüm, sıradaki adım.
- **KAYIT KURALI (her değişiklikte zorunlu):** Kod değişikliğiyle aynı commit'te kayıt dosyalarını güncelle:
  - `CLAUDE.md` → §3 dosya haritası (yeni dosya/modül), §4 durum (yeni sürüm satırı), §5 sıradaki işler (biten işi çıkar, yeni işleri ekle), §8 bekleyenler, `sw.js`/sürüm numaraları.
  - `docs/YOL_HARITASI.md` → sürüm tablosu (özellik + ✅/⬜).
  - `README.md` → kısa sürüm notu.
  - Yeni testleri `tests/e2e/` içine koy ve §6'ya ekle.

## 3. Teknoloji ve mimari

- **Vite + TypeScript** PWA. `public/sw.js` önbellek adı (`imajcad-vNN`) **her yayında artırılır** (şu an `imajcad-v12`). `index.html` yardım penceresindeki başlık sürümü (şu an **v0.11**).
- **Geometri çekirdeği:** OpenCascade WASM — `replicad` (MIT) + `replicad-opencascadejs` (LGPL), **Web Worker**'da (`src/kernel.worker.ts`). Ham OCC `getOC()` ile.
- **Eskiz çözücü:** PlaneGCS (`@salusoft89/planegcs`, LGPL) ana iş parçacığında (`src/sketch/solver.ts`).
- **Görüntü:** three.js ortografik kamera, özel `NavControls` (`src/nav.ts`), kalın çizgiler LineSegments2.
- **Belge modeli:** parametrik özellik listesi (`doc.features`) → `src/doc/compile.ts` KFeature'a derler → worker her seferinde baştan kurar. Referanslar geometrik: `EdgeRef {m,d}`, `FaceRef {c,n,r?}`, `MemberRef {f,i}`. Çok gövde: `bodies[]`, kaynaklar ayrı `welds[]`.

### Dosya haritası
| Dosya | İçerik |
|---|---|
| `src/main.ts` (~4300 satır) | Uygulama kabuğu: modlar (`part`/`sketch`/`pm`/`pickSketchPlane`/`measure`/`section`/`flat`), ağaç, özellik paneli (PM), komut çubukları, dosya menüsü, klavye kısayolları, sağ tık menü / fare hareketleri, dokunmatik ekran çubuğu, dairesel menü, görünüm küpü, giriş ayarları, şekil sihirbazı ve başlangıç rehberi pencereleri. `window.__app` test kancası. |
| `src/viewer.ts` | Sahne, seçim (pick), görünümler (`viewStd`, `setView`, `viewNormal`, `fit`, görünüm geçmişi), **giriş yönlendirme** (fare/kalem/parmak, avuç reddi, uzun basma, parmakla çizim, dokunmatik fare, büyüteç). |
| `src/nav.ts` | SolidWorks fare gezinmesi (orta tuş), tekerlek, parmak döndür/kaydır/yakınlaştır/çevir. |
| `src/input/prefs.ts` | Kalem profilleri (auto/hover/active/capacitive/finger/mouse), algılama, kullanıcı tercihleri (localStorage `imajcad.input`). |
| `src/sketch/editor.ts` (~3500) | Eskiz düzenleyici: tüm araçlar, **çıkarım motoru `infer()`** (nokta/orta/kesişim/çeyrek/üzerinde, sarı ilişki ve mavi hizalama çizgileri, uyandırma, Ctrl ile kapatma), çizgi→yay geçişi, pencere/kesişen seçim, ölçüler, Değiştir kutusu, sayıyla giriş (`numericEntry`), `straighten`, kaldırınca yerleştir. |
| `src/sketch/model.ts`, `solver.ts`, `profile.ts`, `ops.ts`, `geom.ts`, `picture.ts` | Eskiz verisi, çözücü eşlemesi, kapalı bölge çıkarma, ötele/ayna/çoğalt, 2B geometri, eskiz resmi. |
| `src/kernel.worker.ts` (~ büyük) | Tüm katı işlemleri: ekstrüzyon, döndürme, süpürme, loft, radyüs, pah, kabuk, delik, çoğaltmalar, diş, esnet, sac metal, kaynaklı yapı, kesim listesi, resim (HLR), girişim. |
| `src/kernel.ts` | Worker istemcisi. |
| `src/doc/` | `types.ts` (tüm tipler), `compile.ts`, `math.ts`, `standards.ts` (delik/diş/malzeme). |
| `src/sheet/` | Sac: `sheet.ts`, `unfold.ts` (açınım), `dxf.ts`. |
| `src/weld/` | Profiller (`profiles.ts`, EN tabloları, özel kütüphane `imajcad.profiles`), `drawing.ts` (A4 imalat resmi, levha DXF). |
| `src/ui/` | `icons.ts`, `dom.ts` (form yardımcıları), `wizards.ts` (şekil sihirbazları). |
| `tests/e2e/` | Playwright testleri (aşağıda). |

### Replicad / OCC tuzakları
- `makeCompound` girdileri siler → önce `clone()`. `face.outerWire()` yüzü siler → `face.clone().outerWire()`. `wire.offset2D`, `rotate`, `translate` orijinali tüketebilir.
- Liste sınıfı `NCollection_List_TopoDS_Shape` (TopTools_ListOfShape değil). Aşırı yüklü metotlar doğrudan çağrılır.
- Yok: BRepBuilderAPI_GTransform, NurbsConvert, BRepClass3d_SolidClassifier. Var: BRepAdaptor_Surface, BRepAlgoAPI_Section, BRepOffsetAPI_MakePipeShell, makeHelix, makeOffset, loft, HLR, ShapeFix_Solid.
- Diş: helisel boru-süpürme booleanlarda başarısız → "bükülmüş çekirdek" yöntemi kullanılıyor (yavaş, ~17 sn / M20×30).

## 4. Durum — tamamlanan sürümler

- **v0.1–v0.5:** Parça modelleme (eskiz, ilişkiler, ölçüler, ekstrüzyon/kesme, döndürme, süpürme, loft, radyüs, pah, kabuk, koniklik, delik sihirbazı, çoğaltmalar, ayna, referans düzlem/eksen, ölçüm, kütle özellikleri, kesit, STEP/STL içe-dışa aktarma, denklemler).
- **v0.5–v0.8 sac metal:** taban flanş, kenar flanşı, kıvırma, eskizli büküm, kademe, gönye flanş, köşe kapatma, katıdan saca, açınım + DXF.
- **v0.6–v0.7 kaynaklı yapı:** 3B eskiz, profil elemanları (EN kütüphanesi + özel), köşe işlemleri, kırp/uzat, uç kapağı, köşe takviyesi, kaynak dikişi, kesim listesi, imalat resimleri.
- **v0.8:** eskiz/katı/sac eksikleri tamamlandı.
- **v0.9 SolidWorks masaüstü eşleşmesi:** fare (orta tuş gezinme, tekerlek yönü, sağ tık menü, sağ sürükle 4 yönlü hareketler), kısayollar (Ctrl+1…8, Boşluk, F, Z, oklar, S çubuğu, Enter tekrar, A çizgi↔yay, Ctrl+B/Q/S/O/N/Z/Y/A/C/V), çıkarım motoru, çizgi→yay otomatik geçişi, pencere/kesişen seçim, Ctrl çoklu seçim, ölçüde çift tık + tekerlek artımı.
- **v0.10 telefon/tablet:** kalem profilleri + algılama, kaldırınca yerleştir, büyüteç, parmakla çizimde imleç kayması, avuç reddi, kalem yan tuşu = sağ tuş, uzun basma menüsü, 2/3 parmak dokunuşu geri/ileri al, iki parmakla yuvarlama, ekran çubuğu (✓ ✕ A 123 Ctrl ↶ ↷ ☰ ⤢), dairesel araç menüsü, küçültülebilir alt panel, giriş ayarları penceresi.
- **v0.10.1:** **Görünüm küpü tüm cihazlarda** (yüz = dik, kenar = 45°, köşe = izometrik, sürükle = döndür); eski Önden/Üstten/Sağdan/İzometrik düğmeleri gizlendi.
- **v0.11 kalemsiz kullanım:** şekil sihirbazı (plaka, flanş, burç, kademeli mil, L braket, kutu profil, blok), sayıyla çizim (rakama bas / 123), dokunmatik fare modu, eskizden çıkınca Ekstrüzyon/Kesme/Döndürme önerisi, seçim filtresi (Tümü/Yüz/Kenar), kaba çizimi düzelt, ilk açılış rehberi.

## 5. Sıradaki işler (öncelik sırasıyla)

1. **MONTAJ MODÜLÜ** (sıradaki büyük iş): bileşen ekleme (parça dosyaları / mevcut parça), sabitleme, eşleşmeler (çakışık, paralel, dik, eş merkezli, mesafe, açı, teğet), serbestlik göstergesi, bileşeni sürükleyerek taşıma/döndürme, girişim kontrolü, patlatılmış görünüm, montaj ağacı, BOM (malzeme listesi), STEP montaj dışa aktarma. SolidWorks davranışına uygun olmalı; telefon kontrolleriyle de çalışmalı.
2. **Teknik resim modülü:** görünüşler, kesit, ölçülendirme, antet, PDF (kaynaklı imalat resimleri altyapısı `src/weld/drawing.ts` kullanılabilir).
3. Kalemsiz kullanım ekleri: model üzerinde sürüklenen derinlik oku, üst üste adaylar arasında dokunarak geçiş, sihirbaz eskizlerine tam ölçülendirme, fotoğraftan kenar izleme, sesle ölçü girişi.
4. Saha özellikleri: fotoğraf ekleme, Bluetooth kumpas.

## 6. Test altyapısı

- Testler: `tests/e2e/*.py` (Playwright, Python, Chrome `/usr/bin/google-chrome`, swiftshader). Önce yapı: `npx vite build`, sonra `sh tests/e2e/srv.sh` (4173'te `vite preview` başlatır; sunucu turlar arasında ölür, her seferinde çalıştır). Testleri `tests/e2e` içinden çalıştır (`from h import ...`).
- Önemli testler: `sw1` (SW fare/klavye), `sw3` (çıkarım), `sw4` (yay geçişi, seçim), `mob1` (telefon: CDP ile gerçek parmak/kalem olayları), `tp1` (dokunmatik fare), `wz1` (sihirbaz, sayıyla çizim, öneri), `cube1` (görünüm küpü), `v2`, `t3`–`t10`, `sk1`–`sk5`, `k1`–`k6`, `s1`–`s2`, `w1`–`w8`, `m2`.
- Kalıplar: kenar tıklama `viewer.toScreen(mesh.edges[i].m)`; eskiz koordinatı → ekran: `sc(x,y)` yardımcıları testlerde var; `window.__app` (mode, viewer, kernel, setDoc…).
- Mouse ile seçimde artık **tık seçimi değiştirir**, çoklu seçim için Ctrl basılı tutulmalı (testlerde `keyboard.down("Control")`).
- `navigator.webdriver` iken başlangıç rehberi açılmaz.

## 7. Yayın prosedürü

```sh
npx tsc --noEmit -p . && npx vite build
git add -A && git commit -m "<Türkçe mesaj>

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: <oturum bağlantısı varsa>"
git fetch -q origin && git rebase -q origin/main && git push -q origin HEAD:main
# GitHub Pages
URL=$(git remote get-url origin); rm -rf /tmp/pages && mkdir /tmp/pages && cp -r dist/. /tmp/pages/ && touch /tmp/pages/.nojekyll
cd /tmp/pages && git init -q -b gh-pages && git add -A && git commit -qm "Deploy vX" && git remote add origin "$URL" && git push -qf origin gh-pages
# ~75 sn bekle, doğrula:
curl -s https://aliyldz01.github.io/imaj-cad/sw.js | grep -o "imajcad-v[0-9]*"
```
Her yayında `public/sw.js` önbellek adını ve `index.html` yardım başlığındaki sürümü artır; `docs/YOL_HARITASI.md` ve `README.md`'ye sürüm notu ekle. Yeni oturumda depo yoksa: `add_repo` ile `AliYldz01/imaj-cad` ekle, `git clone`, `npm install`.

## 8. Bekleyen / unutulmaması gerekenler

- **Gerçek kalemle saha testi** (kullanıcının kalemi gelince): kontrol listesi `docs/YOL_HARITASI.md` → "Bekleyen: gerçek kalemle saha testi". Sonuca göre `src/input/prefs.ts` `DEFAULTS` güncellenecek.
- Tarayıcı sekmesinde Ctrl+1…8 / Ctrl+N tarayıcıya ayrılmış; PWA olarak kurulunca çalışır (kullanıcıya söylendi).
- Bilinen eksikler: eskizde model köşe noktalarına doğrudan yakalama yok (Varlıkları Dönüştür ile yapılıyor); ölçü Değiştir kutusunda anlık yeniden oluştur yok; sihirbaz eskizlerinde yalnız çap ölçüleri var.

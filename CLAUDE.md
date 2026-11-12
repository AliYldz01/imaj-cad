# İmaj CAD — devam kılavuzu (yeni sohbet buradan başlar)

Bu dosya, projeyi sıfırdan açılan bir sohbette kaldığı yerden sürdürmek için gereken her şeyi içerir.
Ayrıntılı özellik listesi: `docs/YOL_HARITASI.md` · Kullanıcı özeti: `README.md` · **SolidWorks fark raporu ve düzeltme planı: `docs/SOLIDWORKS_FARK_RAPORU.md`** (maddeler E/F/S/W/G numaralı; düzeltildikçe ✅ işaretle) · **SolidWorks özellik başvuru listesi (seçenek seviyesinde, ✅/🟡/⬜ durumlu): `docs/SOLIDWORKS_OZELLIKLERI.md`** — yeni özellik yazarken buradaki seçenekleri esas al, bitince durumunu güncelle.

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

- **Vite + TypeScript** PWA. `public/sw.js` önbellek adı (`imajcad-vNN`) **her yayında artırılır** (şu an `imajcad-v33`). `index.html` yardım penceresindeki başlık sürümü (şu an **v0.26**).
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
| `src/sketch/sketch3d.ts` | **3B eskiz çizgi aracı** `Sketch3DTool` (etkin düzlem XY/YZ/ZX + Tab, uzay tutamacı, lastik bant, eksen çıkarımı, yakalama, zincir/çift tık/Esc, sayıyla uzunluk), `setLineLength`. main.ts `partInput` sketch3d PM'de olayları buna verir (`s3tool`, `__app.s3`). |
| `src/sketch/solver3d.ts` | **3B kısıt çözücü** (Levenberg–Marquardt, sayısal Jacobian): `solve3d(f, hold)`, `dofOf`, `dimValue`, `REL3_NAMES/REL3_TAG`. Kısıtlar: çizgi `ax`, `cons3` (coinc/fix/par/perp/equal/mid/on/collin/parXY/parYZ/parZX), `dims3` (len/dist/ang). |
| `src/sketch/model.ts`, `solver.ts`, `profile.ts`, `ops.ts`, `geom.ts`, `picture.ts` | Eskiz verisi, çözücü eşlemesi, kapalı bölge çıkarma, ötele/ayna/çoğalt, 2B geometri, eskiz resmi. |
| `src/kernel.worker.ts` (~ büyük) | Tüm katı işlemleri: ekstrüzyon, döndürme, süpürme, loft, radyüs, pah, kabuk, delik, çoğaltmalar, diş, esnet, sac metal, kaynaklı yapı, kesim listesi, resim (HLR), girişim. |
| `src/kernel.ts` | Worker istemcisi. |
| `src/doc/` | `types.ts` (tüm tipler), `compile.ts`, `math.ts`, `standards.ts` (delik/diş/malzeme). |
| `src/sheet/` | Sac: `sheet.ts` (parametreler, effK, kalınlık tablosu), `unfold.ts` (açınım), `dxf.ts`, `loftflat.ts` (geçiş parçası açınımı). |
| `src/weld/` | Profiller (`profiles.ts`, EN tabloları, özel kütüphane `imajcad.profiles`), `drawing.ts` (A4 imalat resmi, levha DXF). |
| `src/asm/` | **Montaj**: `assembly.ts` (AsmDoc, bileşen/eşleşme tipleri, sıralı konum çözücü `solve`, serbestlik `dofOf`, BOM, parça kütüphanesi `imajcad.lib`), `asmui.ts` (AsmUI: Montaj sekmesi, bileşen ağları (kernel.build ile, önbellekli), seçim/sürükleme, eşleşme paneli, ağaç, girişim, patlatma, STEP; montaj localStorage `imajcad.asm`, dosya `.icasm`). Worker: `asmOp` (bileşenleri dörtlük+öteleme ile yerleştir; STEP / girişim). |
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

- **v0.12 arayüz ve eskiz:** komut çubuğu **gruplara** ayrıldı (ilk grup hep görünür + grup düğmeleri; telefonda ayrı satır), **tam ekran** düğmesi (⛶) + manifest `fullscreen`, **imleç geri bildirimi** (çizim kalemi, yakalamada sarı nokta, seçilebilir öğede el), eskiz açılan **model yüzünün kenarlarına yakalama** (köşe / kenar ortası / merkez → sabit nokta), Akıllı Ölçü ve Seç ile **model kenarına tıklama** (sabit yapı çizgisine dönüşür), **uyandırma** artık çizgi orta noktaları, daire merkezleri (çevresine gelince) ve model noktalarını da kapsar (iki kenar ortasından hizalama ile kare merkezi bulunur).
- **v0.12.1:** **dikdörtgen/paralelkenar merkezine doğrudan yakalama** (yapı köşegeni + orta nokta ilişkisi otomatik), **model kenarı üzerinde yakalama** (sabit yapı çizgisi + üzerinde ilişkisi).
- **v0.12.2:** **Akıllı Ölçü'de tüm noktalar seçilebilir**: çizgi ortası, daire/yay çeyrekleri, yay ortası, kesişim, dikdörtgen merkezi, model köşe/kenar ortası/merkez/kenar üzeri (`virtualPt` → seçilince gerçek nokta + ilişki oluşur); Seç aracında Ctrl+tık ile de aynı noktalar seçilip ilişki verilebilir. Ortaya/çeyreğe tıklayıp boşluğa tıklanırsa çizginin/dairenin kendisi ölçülür (sanal nokta silinir).
- **v0.12.3:** yakalama **yazısı kaldırıldı**; yakalanan yerin türü **imleç simgesiyle** gösterilir (uç kare, orta üçgen, merkez daire, çeyrek, kesişim X, üzerinde, yatay/dikey, dik, teğet, model köşesi mavi kare, orijin) — `setCursor`/`snapKind`. Kutuda yalnız canlı ölçü (L, R) kalır. Testler etiket için `editor.st.inf.label` / `editor.curKind` okur.
- **v0.13 (Paket A):** seçili konturlar (`contours`, `contourRegions/selectContours` compile.ts), paylaşılan eskiz (kullanılmış eskizden yeni özellik), ekstrüzyon: başlangıç yüz/köşe, köşeye kadar, gövdeye kadar, kenar yönünde, kesme tarafını çevir; referans düzlem türleri (`planeFrame`: açılı, orta, 3 nokta, kenara dik, noktadan paralel, ekrana paralel); Değiştir kutusunda canlı güncelleme ⟳ ve ±; ağaçta sürükle/▲▼ sıralama, F2 ad, ebeveyn/çocuk; parça modunda kutu seçimi, diğerini seç (aynı yere tekrar tık / Alt / sağ tık), seçim yanında bağlam mini çubuğu.
- **v0.14 (Paket B kısmi):** süpürmede dairesel profil (çap / iç çap) ve profil yönelimi (yolu izle / normali sabit), çoğaltmada örnek atla (`skip`), dışa kabuk (`out`), radyüste çoklu yarıçap (`radii`), görüntü stilleri (`viewer.setStyle`: kenarlı gölgeli, gölgeli, gizli çizgi kaldır/görünür, tel kafes, saydam), Instant3D (seçili ekstrüzyonda yeşil okla derinlik sürükleme), eskizde birleştir ilişkisi, hızlı yakalama filtresi (`snapOff`, sağ tık), güç kırpma (sürükleyerek), ötelemede çift yön / tabanı yapı geometrisi yap.
- **v0.15 (Paket C kısmi):** sac büküm hesabı K / büküm payı / büküm düşümü (`effK`, `GAUGE_TABLE` sheet.ts), kalınlık tablosu; **sac geçiş parçası (loft büküm, huni)**: loft + `sheetT` ince cidar, `src/sheet/loftflat.ts` üçgenlemeli açınım ve DXF; köşe kır (R/pah) komutları; yapı elemanında delme noktası ötelemesi (`poff`).
- **v0.16 (Paket D — montaj ilk sürüm):** Montaj sekmesi; bileşen ekle (geçerli parça / kütüphane / .icad), ilk bileşen sabit, sabitle/serbest, gizle; standart eşleşmeler çakışık, paralel, dik, mesafe, açı, eş merkezli, kilit (hizalı/ters); yüz seçimi (düz / silindir ekseni); sıralı çözücü; serbestlik göstergesi (f)/(-); sürükleyerek taşıma; Δ öteleme ve 90° döndürme; girişim tespiti; patlatma; malzeme listesi (CSV); STEP montaj; montaj kaydet/aç (.icasm); parça kütüphanesi.
- **v0.17 (Paket D devam):** teğet (düz↔silindir) ve limit mesafe eşleşmesi (`vmax`), Ctrl ile iki yüz → eşleşme mini çubuğu (`showMateBar`, `.asm-matebar`), sürüklerken çarpışma algılama (`collide`, `collides`, `worldBox`; adımlı kutu testi), doğrusal 2 yön / dairesel bileşen çoğaltma (`openPattern`).
- **v0.18 3B eskiz + profil yönü:** rapor `docs/3B_ESKIZ_RAPORU.md`. 3B eskiz grafik alanda çizilir (`src/sketch/sketch3d.ts`); yapı elemanı profil Y ekseni = eskiz normali / dünya yukarısı (`profileX` worker, `sketch3dNormal` compile; yeni elemanlarda `ori: 2`, eski belgeler eski yönde); yapı elemanında segment grafik seçimi (`memberSegAt/memberSegPick`), seçili segment vurgusu.
- **v0.19:** yapı elemanı grupları (`MemberFeature.groups`, `MemberItem.g`, KFeature `gl`; worker `memberTool` grupları `memberCore`'a böler; PM `d._g`, `memGroup`, `memTake`), Alignment (`alignAx`/`alignTo` → compile'da öğe `n`), profili konumlandır (`openPierceDialog`, `sampleLoop` dışa açık), 3B eskiz nokta sürükleme + `enforceAlong`, Ctrl+yüz eksen hizalama (`Sketch3DTool.alignTo/axes`).
- **v0.19.1:** profili konumlandır penceresi duyarlı (`.pierce-dialog`, SVG viewBox 1000, %100 genişlik), büyük dokunma alanı (görünmez r=62), çakışan noktalar elenir, geçerli delme noktası turuncu.
- **v0.20 akıllı profil birleşimleri** (yalnız `ori: 2` elemanlar): worker `orientChains` (bağlı segmentleri uç uca aynı yöne çevirir → L/U kanatları köşede ters dönmez), `memberCore` artık gövdeleri döndürür, `memberTool` → `resolveJoints` (T birleşimi: serbest uç başka elemanın iç kısmına değerse o elemanın yüzünde kırpılır; gruplar arası köşe ve 3+ elemanlı köşe: aynı doğrultudaki çift > grup içi köşe çifti > en düşey eleman sürekli sayılır, gerekirse uzatılır, diğerleri `profileSupport` ile yüzünde kırpılır), sonra `applyTool`.
- **v0.21:** 3B eskiz 2B gibi: `Sketch3DTool.mode` (line/rect/point/select/dim), `sel`, `addRel`, `relOptions`, `addDim`/`editDim`, `deleteSel`, ekran etiketleri `renderLabels` (`.s3-labels`, `.s3-dim` tıkla-düzenle, `.s3-rel`), `solver3d.ts`; PM: Araç seçici, tanım durumu, İlişki Ekle düğmeleri, İlişkiler/Ölçüler listeleri. Worker: `autoRotate` (köşeye gelen tekil elemanı `profileBias` ile 90° adımlarla döndürür; grup `auto` = rot/mirror/alignTo yoksa), X kesişim (`resolveJoints` sonu: sürekli elemanın dış kontur prizmasıyla kesilir, `xSplits` → kesim listesinde `key/2`).
- **v0.26:** 3B otomatik ilişkiler: `commit` model/orijin yakalamasında `fix`, hizalama kılavuzuyla konan noktada `eqX/eqY/eqZ` (solver3d yeni ilişki: iki noktanın aynı koordinatı; Cand `alQ/alK`), dikdörtgen orijinden başlarsa ilk köşe `fix` (`rectFix`).
- **v0.25:** kırpma: `geom.lineCircle/circleCircle` geometrik ve göreli toleranslı (teğet → tek nokta), `editor.intersections` aynı noktaları tekler, `trimAt` tek kesişimli daireyi silmez, ortadan kırpılan çizgide `collinear` (yatay/dikey yoksa) + teğet ilişkisi yakın parçaya taşınır, bölünen yaylara `equal`.
- **v0.24:** editor çizgi aracı: geometri yatay/dikeyse (noktaya kapanırken de) `horizontal/vertical` ilişkisi; yeni nokta başka noktayla x/y hizalıysa nokta-nokta hizalama ilişkisi (aynı iki nokta arasında çizgi ilişkisi gelince eskisi silinir). 3B: `commands()` sketch3d açıkken 3B araçları döndürür; `Sketch3DTool.showRelBar` (`.s3-relbar`: ilişkiler + boy/yarıçap/mesafe/açı ölçüsü + Sil); eksen çıkarımında diğer noktaların aynı koordinatına yakalanma + mavi kılavuz (`guide`).
- **v0.23:** `beginSketchCommand(tool)` eskiz dışında araç çalıştırmaz (Cmd `disabled`, `.cmd.disabled`); `offsetEnts` yapı geometrisini atlar; `viewer.snapIcon` + `.snap-badge` (editor `setCursor` dokunmatik/kalem için simge rozeti); `Sketch3DTool.locate` çizgi/yay üzerinde yakalama (`kind: "on"`, `cons3 on`; eksen çıkarımı öncelikli, <4 px ise üzerinde); worker `filletHist`: sabit yarıçaplı radyüs başarısız olursa önceki radyüsten önceki gövdeye dönüp önce yeni kenarları sonra öncekileri radyüsler.
- **v0.22.1:** worker `planarize`: aynı gruptaki bağlı düzlemsel zincirde tüm segmentlerin profil Y ekseni = zincir düzlemi normali (2B eskiz gibi), ters U çerçevede köşeler eşleşir.
- **v0.22:** 3B yay `arcs3 {a,b,m}` (`solver3d` `circum/arcPts`, `tan` ilişkisi, `rad` ölçüsü; compile'da yapı elemanı yay öğesi), araçlar `arc/trim/extend` (`Sketch3DTool.addArc/trim/extend/splits`), `fillet(pid,R)`, `mirror(ax)`; denklem anahtarı `<id>.dims3[i].v` (`applyEquations` → `solve3d`); grup `prio` (MemberGroup/MemberFeature `prio`, worker `resolveJoints` ve X kesişimde önce öncelik).

## 5. Sıradaki işler (öncelik sırasıyla)

0. **SolidWorks fark raporundaki düzeltmeler** (`docs/SOLIDWORKS_FARK_RAPORU.md` §7 paket sırası A→E; montaj = Paket D) — Paket A ✅ (v0.13); Paket B kısmi (v0.14) — kalan B: F3 burulma/kılavuz, F4 loft teğetlik, F5 setback/konik, F18 pah, F19 eksen/nokta seçimi, E4 sanal köşe, E5, E8, E9, E10, E16, E17; Paket C kısmi (v0.15) — kalan C: S2 flanş profili, S5 DXF büküm notları, S6 aç/katla, W1 köşe başına işlem, W3 kesim listesi özellikleri, W4 3B eskiz ilişkileri; Paket D ilk sürüm (v0.16) — kalan D (v0.17 sonrası): gelişmiş/mekanik eşleşmeler (simetrik, açı limiti, genişlik, menteşe, dişli, vida…), gerçek geometriyle çarpışma, ayna bileşen, alt montaj, bağlam içi düzenleme; ardından **Paket E** ve kalan B/C maddeleri. **3B eskiz**: rapordaki maddeler tamamlandı (v0.22; spline/öteleme SolidWorks'te de 3B eskizde yok).
1. **MONTAJ MODÜLÜ** (fark raporu M1–M10) — ilk sürüm v0.16'da; kalanlar Paket D notunda: bileşen ekleme (parça dosyaları / mevcut parça), sabitleme, eşleşmeler (çakışık, paralel, dik, eş merkezli, mesafe, açı, teğet), serbestlik göstergesi, bileşeni sürükleyerek taşıma/döndürme, girişim kontrolü, patlatılmış görünüm, montaj ağacı, BOM (malzeme listesi), STEP montaj dışa aktarma. SolidWorks davranışına uygun olmalı; telefon kontrolleriyle de çalışmalı.
2. **Teknik resim modülü:** görünüşler, kesit, ölçülendirme, antet, PDF (kaynaklı imalat resimleri altyapısı `src/weld/drawing.ts` kullanılabilir).
3. Kalemsiz kullanım ekleri: model üzerinde sürüklenen derinlik oku, üst üste adaylar arasında dokunarak geçiş, sihirbaz eskizlerine tam ölçülendirme, fotoğraftan kenar izleme, sesle ölçü girişi.
4. Saha özellikleri: fotoğraf ekleme, Bluetooth kumpas.

## 6. Test altyapısı

- Testler: `tests/e2e/*.py` (Playwright, Python, Chrome `/usr/bin/google-chrome`, swiftshader). Önce yapı: `npx vite build`, sonra `sh tests/e2e/srv.sh` (4173'te `vite preview` başlatır; sunucu turlar arasında ölür, her seferinde çalıştır). Testleri `tests/e2e` içinden çalıştır (`from h import ...`).
- Testler `import cmdpatch` ile başlar (komut grubu düğmesini otomatik açar; uygulamada `__app.showCmd(başlık)`). `ui1` (gruplar, model kenarı yakalama, imleç), `rc1` (dikdörtgen merkezi, model kenarı üzerinde), `dm1` (Akıllı Ölçü sanal noktalar), `fx1` (ekstrüzyon seçenekleri, konturlar), `pl1` (düzlem türleri), `pa1` (mini çubuk, diğerini seç, kutu seçim), `pb1` (dışa kabuk, dairesel süpürme, örnek atla), `pb2` (Instant3D, görüntü stilleri), `lb1` (huni geçiş parçası + açınım DXF), `as1` (montaj: bileşen, eşleşme çözücü, seçim, girişim, STEP, BOM), `as2` (teğet, limit, mini çubuk, çarpışma, bileşen çoğaltma), `s3d1` (3B eskiz tıklayarak çizim, Tab, eksen çıkarımı, uzunluk; profil yönü; segment grafik seçimi), `s3d2` (gruplar, Alignment, profili konumlandır, nokta sürükleme/Along, Ctrl eksen), `pp1` (profili konumlandır penceresi telefon/masaüstü boyutları), `pj0` (köşe tanısı: gönye yüzü kayması, girişim; `CORNERS=miter,butt1`), `pj1` (akıllı birleşimler: karışık yön + T, masa çerçevesi + ayak, gruplar arası köşe; L/U/IPE/kutu/boru/lama, "SONUC: TAMAM" beklenir; X kesişim ve ayak otomatik dönüşü dahil), `s3d3` (3B dikdörtgen, seç, ilişkiler, Akıllı Ölçü, çözücü, tam tanımlı, çelişki reddi, silme), `s3d4` (3B yay, eskiz radyüsü, kırp, uzat, ayna, ölçü denklemi, yay boyunca eleman, kırpma önceliği), `of1` (eskiz dışı araç engeli, merkez dikdörtgen ötelemesi), `fl1` (küp: üst kenar radyüsü sonra düşey kenar radyüsü, farklı yarıçaplar), `sq1` (2B kare otomatik ilişkiler + 2 ölçü → tam tanımlı), `s3d5` (3B üst çubuk araçları, ilişki çubuğu, hizalama çıkarımı, eşit + ölçü), `tr1` (iki daire + teğet çizgiler: taşan uçları kırp, dairelerden kayış şekli; kesen çizgi), `s3d6` (3B orijinden kare: eksen ilişkileri, orijin sabit, hizalama ilişkisi, 2 ölçü → tam tanımlı, sürükleme ile kıpırdamaz). `cmdpatch` `:has-text('X')` seçicisini de destekler.
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
- Bilinen eksikler: sihirbaz eskizlerinde yalnız çap ölçüleri var.

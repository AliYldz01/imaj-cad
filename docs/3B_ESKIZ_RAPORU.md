# 3B Eskiz ve Profil (Yapı Elemanı) — SolidWorks Karşılaştırma Raporu

Tarih: 2026-11-12 · Sürüm: v0.18 · Kapsam: `3B Eskiz` özelliği ve `Yapı Elemanı` (kaynaklı yapı profili)

## 1. SolidWorks nasıl çalışıyor (araştırma özeti)

### 1.1 3B eskiz
| Konu | SolidWorks davranışı |
|---|---|
| Başlatma | 3B Eskiz komutu → Çizgi aracı. Görünüm izometriğe döner. |
| Çizim düzlemi | Varsayılan **XY**. Araç açıkken **Tab** ile XY → YZ → ZX arasında geçilir; imlecin yanında etkin düzlemin adı yazar. |
| Ctrl + düzlem/yüz | Ctrl basılıyken bir düzlem, düz yüz veya koordinat sistemi seçilirse 3B eskiz eksen takımı ona hizalanır. |
| Uzay tutamacı (space handle) | Her tıklamada son noktada etkin düzlemin eksenleri çizilir; kullanıcı hangi eksen boyunca çizdiğini görür. |
| Çizim mantığı | Ekranda **boşluğa tıklanır**; nokta etkin düzlem üzerinde oluşur. Her tık zinciri sürdürür (çizgi-çizgi-çizgi). |
| Eksen çıkarımı | İmleç global X / Y / Z yönüne yaklaşınca çizgi o eksene kilitlenir ve **Along X / Along Y / Along Z** ilişkisi otomatik eklenir. |
| Yakalama | Mevcut noktalar, model köşeleri, kenar ortaları, orijin. |
| Bitirme | Çift tık / Esc zinciri bitirir; mevcut noktaya tıklamak zinciri kapatır. |
| Ölçü | Çizgiler yaklaşık çizilir, sonra Akıllı Ölçü ile gerçek uzunluk verilir; bağlı geometri çözücüyle güncellenir. |
| İlişkiler | Along X/Y/Z, ParallelYZ/ZX, On Plane, çakışık, orta nokta, eşit, dik, paralel… |

### 1.2 Yapı elemanı (profil)
| Konu | SolidWorks davranışı |
|---|---|
| Seçim | Standart → Tür → Ölçü seçilir, ardından **grafik alanda iskelet segmentlerine tıklanır**. |
| Gruplar | Segmentler gruplara ayrılır; her grubun kendi döndürme, aynalama, delme noktası ve köşe işlemi vardır. |
| Profil yönü | Profil eskizinin orijini delme noktasıdır. Profilin **yatay (X) ve dikey (Y) ekseni** segmente göre yerleşir: 2B eskizde dikey eksen eskiz düzleminin normali boyunca olur (üst düzlemde çizilen bir I profil dik durur). Alignment seçeneği ile profilin bir ekseni seçilen bir kenara/çizgiye hizalanabilir; dönüş açısı ve aynalama (yatay/dikey eksen) ek ayarlardır. |
| Delme noktası | Profildeki herhangi bir köşe / eskiz noktası; seçilince profil kayar. |
| Köşe işlemi | Yalnız ardışık (contiguous) gruplarda, iki elemanın buluştuğu köşede: gönye, alın 1, alın 2. T birleşimleri ayrı Kırp/Uzat komutuyla. |

## 2. Bizim uygulamamız nasıl çalışıyordu — yanlış mantıklar

| # | Sorun | Neden yanlış | Etki |
|---|---|---|---|
| H1 | **3B eskiz bir çizim aracı değildi, bir form idi.** Noktalar yalnız PM'deki ±X/±Y/±Z düğmeleri, Δ veya mutlak koordinatla ekleniyordu. | SolidWorks'te 3B eskiz grafik alanda tıklayarak çizilir. | Kullanıcı çizim yapamıyor sanıyordu. |
| H2 | Grafik alanda tıklama **yalnız model yüzü/kenarı/düzlemine** değince nokta ekliyordu; boşluğa tıklama hiçbir şey yapmıyordu. | Seçim filtresi (`pick`) bir isabet bekliyordu; etkin düzlem kavramı yoktu. | Boş bir parçada (en yaygın durum: iskelet çizmek) tıklama çalışmıyordu. |
| H3 | Etkin düzlem (XY/YZ/ZX), **Tab**, uzay tutamacı yoktu. | SolidWorks'ün temel 3B eskiz mantığı. | Hangi yönde çizildiği belirsizdi. |
| H4 | Lastik bant önizleme, canlı uzunluk ve **eksen çıkarımı (Along X/Y/Z)** yoktu. | — | Eksene paralel çizgi çizmek imkânsızdı. |
| H5 | Zincir mantığı yanlıştı: her yeni nokta "etkin noktaya" bağlanıyordu, zinciri bitirmenin yolu yoktu (çift tık/Esc). | SolidWorks'te çift tık/Esc zinciri bitirir; var olan noktaya tıklamak kapatır. | Ayrık çizgiler (ör. çerçevenin iki ayağı) çizilemiyordu. |
| H6 | Çizgi uzunluğu değiştirilemiyordu; yalnız nokta koordinatları elle düzeltiliyordu. | SolidWorks'te ölçü verilir, bağlı geometri kayar. | Ölçüyle çizim zor. |
| H7 | **Profil yönü yanlıştı.** Profilin yatay ekseni eskiz normaline (`x = −n`) konmuştu; bu yüzden dikey eksen düzlemin içinde kalıyordu. Üst düzlemde çizilen 100×50 dikdörtgen kutu **yan yatıyordu** (100 mm yatayda). 3B eskizde de dikey eksen aşağı (−Y) bakıyordu: "üst" delme noktası profili ters yöne kaydırıyordu. | SolidWorks'te profilin dikey ekseni eskiz normali / yukarı yönüdür. | L, U, I, dikdörtgen kutu profiller 90° dönük veya ters çıkıyordu; kullanıcı her eleman için döndürme açısı girmek zorundaydı. |
| H8 | Bükümlü 3B zincirde yay normalinin işareti dönüş yönüne göre değişiyordu (profil zincirden zincire ters dönebiliyordu). | — | Bükümlü borularda tutarsız yön. |
| H9 | Yapı elemanında segmentler **yalnız onay kutusu listesinden** seçiliyordu; grafik alanda tıklanamıyordu. Üstelik kullanılmış iskelet eskizi düzenleme sırasında gizleniyordu. | SolidWorks'te segmente tıklanır, seçilenler vurgulanır. | Hangi çizginin hangi satır olduğu anlaşılmıyordu. |

## 3. Yapılan düzeltmeler (v0.18)

| # | Çözüm | Dosya |
|---|---|---|
| H1–H5 | Yeni **3B çizgi aracı** (`Sketch3DTool`): etkin düzlem XY/YZ/ZX (Tab / Shift+Tab, PM'de seçici); boşluğa tıklayınca nokta çapadan (yoksa orijinden) geçen etkin düzlemde oluşur; çapa yokken model yüzüne tıklamak yüzeydeki noktayı alır; **uzay tutamacı** (renkli eksenler + düzlem karesi); turuncu **lastik bant** önizleme ve imleç yanında `XY · L 150 · boyunca Z`; imleç ekranda bir eksene 7° yaklaşınca çizgi o eksene kilitlenir ve çizgiye `ax` (Along X/Y/Z) ilişkisi yazılır; mevcut noktalara, model köşe/kenar ortası/merkezlerine, diğer eskiz noktalarına ve orijine 12 px yakalama; her tık zinciri sürdürür, **çift tık / Esc** bitirir, mevcut noktaya tıklamak kapatır; tıkla-sürükle-bırak da çizgi çizer; **rakama basınca uzunluk kutusu** (önizleme yönünde), telefonda "Uzunluk gir…" düğmesi. | `src/sketch/sketch3d.ts` (yeni), `src/main.ts` |
| H6 | Çizgi listesinde her çizginin **L (uzunluk) alanı**: değiştirilince bitiş ucu ve o taraftaki bağlı noktalar birlikte kayar (kapalı çevrimde yalnız uç). | `setLineLength` |
| H7 | Profil yönü SolidWorks'e göre: **profil Y ekseni = eskiz düzlemi normali** (2B), **dünya yukarısı (Y)** (3B; düşey çizgide +Z); X = Y × yol. Delme noktası "üst" artık profili çizginin altına koyar. Eski belgeler bozulmasın diye yeni elemanlara `ori: 2` yazılır; bu bayrağı olmayan eski elemanlar eski yönde kalır (kaynak/köşe takviyesi yüz referansları korunur). | `kernel.worker.ts` `profileX`, `compile.ts` `sketch3dNormal` |
| H8 | Yay normali işareti sabitlendi (yukarı bakar); zincirin yönü ilk düz çizgiden alınır. | `compile.ts`, `kernel.worker.ts` |
| H9 | Yapı elemanı panelinde **grafik alanda segmente tıklayınca seçilir / seçimden çıkar** (10 px); iskelet eskizleri düzenleme sırasında görünür, seçili segmentler kalın mavi çizilir. | `memberSegAt`, `memberSegPick`, `drawSketches` |

Test: `tests/e2e/s3d1.py` — tıklayarak çizim, X/Z/Y eksen çıkarımı, Tab, sayıyla uzunluk, çift tık, Esc, uzunluk düzenleme, segment seçimi; X/Z/düşey çizgilerde ve üst düzlem 2B eskizde 100×50 kutunun yönü (100 mm dikey), üst delme noktası. Eski testler `w1`–`w8` değişmeden geçti.

## 4. v0.19 ile tamamlananlar (eski "kalan farklar")

| # | Konu | Durum |
|---|---|---|
| K1 | **Gruplar**: tek yapı elemanında birden çok grup (`groups`); her grubun delme noktası, öteleme, döndürme, aynalama, hizalama ve köşe işlemi ayrı; köşe işlemi grup içinde uygulanır. PM'de "Grup 1/2/… · + Yeni grup · Grubu sil"; grafik alanda tıklanan segment etkin gruba geçer (etkin grup mavi, diğer gruplar mor). | ✅ |
| K2 | **Alignment**: profilin yatay / dikey eksenini global X/Y/Z'ye veya seçilen model kenarına / eskiz çizgisine paralel yapma (`alignAx`, `alignTo`). | ✅ |
| K3 | **Profili konumlandır**: profil resminde köşe, yay başı, daire merkezi/çeyrekleri ve sınır kutusunun 9 noktasından birine dokunarak delme noktası seçimi. | ✅ |
| K4 | **Along X/Y/Z korunur**: nokta sürüklenince veya koordinatı değişince eksen ilişkili çizgilerin diğer uçları zincir boyunca hizalanır (`enforceAlong`). Tam kısıt çözücü (eşit, dik, ölçü sürüş) yok. | 🟡 |
| K5 | **Ctrl + düz yüz / düzlem**: 3B eskiz eksen takımı yüze hizalanır (XY = yüz); Ctrl + boşluk global eksenlere döner. 3B yay/spline yok (köşe yarıçapı ile bükümlü zincir var). | 🟡 |
| K6 | **Nokta sürükleme**: 3B eskizde noktaya basıp sürükleyince nokta etkin düzlemde taşınır, bağlı Along ilişkileri korunur. | ✅ |

Test: `tests/e2e/s3d2.py`.

## 5. Hâlâ kalan
- 3B eskizde tam kısıt çözücü (eşit, dik, paralel, sürücü ölçüler) ve 3B yay / spline.
- Gruplar arası kırpma sırası (SolidWorks "trim order"); şimdilik gruplar arası birleşim için Kırp/Uzat kullanılır.

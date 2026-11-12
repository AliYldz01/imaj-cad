# İmaj CAD — Yol Haritası

Çalışma mantığı SolidWorks'e göre kurulur: **düzlem/yüz seç → eskiz çiz → ilişki ve ölçüyle tam tanımla → özellik oluştur**.
Model, FeatureManager ağacındaki özelliklerden her seferinde yeniden hesaplanır (parametrik geçmiş).

Durum: ✅ yapıldı · 🟡 kısmen · ⬜ planlandı

---

## 1. Genel çalışma mantığı

| Özellik | SolidWorks karşılığı | Durum |
|---|---|---|
| Parça belgesi, Orijin, Ön / Üst / Sağ düzlem | Part, Origin, Front/Top/Right Plane | ✅ |
| Özellik ağacı (eskizler özelliğin altında) | FeatureManager Design Tree | ✅ |
| Özellik / eskiz düzenleme, silme | Edit Feature / Edit Sketch | ✅ |
| Eskizi düzenlerken model o adıma geri sarılır | Rollback | ✅ |
| Geri sarma çubuğu (ağaçta sürüklenebilir) | Rollback Bar | ✅ |
| Özellik özellik paneli + ✓ / ✕ onay köşesi | PropertyManager, Confirmation Corner | ✅ |
| Komut sekmeleri (Özellikler / Eskiz) | CommandManager | ✅ |
| Görünüşler: Ön, Üst, Sağ, İzometrik, Normal, Sığdır | View Orientation | ✅ |
| Kesit görünüşü | Section View | ✅ |
| Global değişkenler ve denklemler | Equations | ✅ |
| Malzeme, kütle özellikleri | Material, Mass Properties | ✅ |
| Ölçüm aracı | Measure | ✅ |
| Özellik yeniden adlandırma | Rename | ✅ |
| Yüze çizilen eskiz, model değişince yüzü takip eder | Sketch on face | ✅ |
| Çoklu gövde | Multibody | ✅ |
| Dosya kaydet / aç (.icad) | Save / Open | ✅ |
| STEP / STL dışa aktarma | Export | ✅ |
| STEP içe aktarma | Import | ✅ |

## 2. Eskiz (2D)

### Eskiz varlıkları
| Araç | Durum |
|---|---|
| Çizgi (zincirleme, tıkla-tıkla ve sürükle) | ✅ |
| Merkez çizgisi (yapı geometrisi) | ✅ |
| Köşe dikdörtgen | ✅ |
| Merkez dikdörtgen | ✅ |
| 3 noktalı köşe dikdörtgen (açılı) | ✅ |
| Paralelkenar | ✅ |
| Daire (merkez) | ✅ |
| Çevre dairesi (3 nokta) | ✅ |
| Merkez noktalı yay | ✅ |
| Teğet yay | ✅ |
| 3 noktalı yay | ✅ |
| Düz kanal (slot) | ✅ |
| Merkez noktalı kanal / yay kanal | ✅ |
| Çokgen (çember içine) | ✅ |
| Nokta | ✅ |
| Elips, kısmi elips, parabol | ✅ |
| Spline | ✅ |
| Metin | ✅ |

### Eskiz araçları
| Araç | Durum |
|---|---|
| Eskiz radyüsü (köşe yuvarlatma) | ✅ |
| Eskiz pahı | ✅ |
| Kırp (parçaya dokunarak) | ✅ |
| Uzat | ✅ |
| Varlıkları ötele (offset) | ✅ |
| Varlıkları dönüştür (kenarı eskize al: çizgi, daire, yay) | ✅ |
| Kesişim eğrisi | ✅ |
| Varlıkları aynala | ✅ |
| Doğrusal / dairesel eskiz çoğaltma | ✅ |
| Taşı / kopyala / döndür | ✅ |
| Ölçekle | ✅ |
| Yapı geometrisine çevir | ✅ |
| Sürükleyerek düzenleme (çözücü ile) | ✅ |

### İlişkiler (Relations)
| İlişki | Otomatik | Elle | Durum |
|---|---|---|---|
| Yatay, Dikey | ✅ | ✅ | ✅ |
| Çakışık (birleştirme) | ✅ | ✅ | ✅ |
| Üzerinde (nokta eğri üstünde) | ✅ | ✅ | ✅ |
| Paralel, Dik | | ✅ | ✅ |
| Eşit (uzunluk / yarıçap) | | ✅ | ✅ |
| Teğet | ✅ (teğet yay) | ✅ | ✅ |
| Eş merkezli | | ✅ | ✅ |
| Orta nokta | | ✅ | ✅ |
| Simetrik (merkez çizgisine göre) | | ✅ | ✅ |
| Sabitle | | ✅ | ✅ |
| Doğrudaş | | ✅ | ✅ |
| İlişkileri göster / sil | | | ✅ |

### Ölçüler ve tanımlılık
| Özellik | Durum |
|---|---|
| Akıllı ölçü: uzunluk, yatay, dikey, hizalı mesafe | ✅ |
| Çap, yarıçap | ✅ |
| Açı (iki çizgi) | ✅ |
| Nokta–çizgi, paralel çizgi mesafesi | ✅ |
| Ölçü değerine işlem yazma (`100/2`) | ✅ |
| Tanımlılık renkleri: mavi (eksik), siyah (tam), kırmızı (aşırı) | ✅ |
| Serbestlik derecesi (DOF) göstergesi | ✅ |
| Referans (sürülen) ölçü | ✅ |
| Tam tanımla (otomatik) | ✅ |

## 3. Katı özellikler (Part)

| Özellik | Seçenekler | Durum |
|---|---|---|
| Ekstrüzyon (Boss/Base) | Kör, Orta düzlem, Tümünden geçen, Yön 2, Ters çevir | ✅ |
| Ekstrüzyon kesme | Kör, Tümünden geçen, Orta düzlem, Yön 2 | ✅ |
| Ekstrüzyon: Yüzeye kadar, Yüzeyden ötele (paralel düz yüz) | | ✅ |
| Ekstrüzyon: Sonrakine kadar, eğri yüzeye kadar | | ✅ |
| Ekstrüzyon: Koniklik (tek konturlu profil) | | ✅ |
| Ekstrüzyon: İnce özellik | | ✅ |
| Döndürme (Revolve) / Döndürerek kesme | Açı, Orta düzlem, Ters | ✅ |
| Süpürme (Sweep) / Süpürerek kesme | Profil + yol eskizi | ✅ |
| Loft / Loft kesme | Tek konturlu profiller, düz yüzeyli seçenek | ✅ |
| Loft: kılavuz eğriler (ara kesitlerle) | | ✅ |
| Radyüs (Fillet) | Sabit yarıçap, kenar seçimi | ✅ |
| Radyüs / Pah: yüz seçimi (yüzün tüm kenarları) | | ✅ |
| Radyüs: değişken, tam yuvarlak | | ✅ |
| Pah (Chamfer) | Mesafe | ✅ |
| Pah: mesafe–açı, mesafe–mesafe | | ✅ |
| Kabuk (Shell) | Kalınlık, kaldırılacak yüzler | ✅ |
| Doğrusal çoğaltma | Yön (X/Y/Z), aralık, adet | ✅ |
| Dairesel çoğaltma | Eksen (X/Y/Z), adet, açı | ✅ |
| Ayna | Ön / Üst / Sağ düzlem | ✅ |
| Ayna: yüze veya referans düzleme göre | | ✅ |
| Delik sihirbazı | Düz, havşalı, konik havşalı, kılavuz; M3–M24 ISO tabloları | ✅ |
| Delik: kozmetik diş, boru dişi, inç ölçüler | | ✅ |
| Koniklik (Draft) | Nötr düzlem, yüz seçimi | ✅ |
| Kaburga (Rib) | | ✅ |
| Kubbe, Sarma, Ölçekle (Eğme yerine) | | ✅ |
| Referans düzlem (ötelenmiş) | | ✅ |
| Referans eksen, nokta, koordinat sistemi | | ✅ |

## 4. Sonraki modüller

| Modül | İçerik | Durum |
|---|---|---|
| Sac metal (v0.5) | Taban flanş (kapalı/açık profil), kenar flanş (açı, uzunluk referansı, konum, kısaltma, köşe gönyesi, büküm boşaltma), kenet (açık/kapalı), çizgiden büküm, K faktörü, düzleştir, büküm tablosu, DXF | ✅ |
| Sac metal ekleri (v0.8) | Kademe (jog), gönye flanş (otomatik taban bükümüyle), köşe kapatma (alın / bindirme), katıdan saca dönüştür (büküm + yarık + köşe boşaltma) | ✅ |
| Kaynaklı yapı / profil (v0.6) | İskelet eskizden yapı elemanı, EN profil kütüphanesi (kutu, boru, L, UPN, IPE, HEA, HEB, lama, dolu çubuk), delme noktası / döndürme / aynalama, gönye ve alın köşe işlemleri, kırp/uzat (düz veya profile göre), uç kapağı, köşe takviyesi, bükümlü boru, kesim listesi (gruplama, boy, açı, ağırlık, CSV, tekil STEP) | ✅ |
| Kaynaklı (v0.7) | 3B eskiz (yön+uzunluk, Δ, mutlak koordinat, yakalama, köşe büküm yarıçapı), bükümlü zincir elemanlar, kaynak dikişi (köşe / boru çevresi / kesikli) ve kaynak tablosu, özel profil kütüphanesi (eskizden, cihaz kütüphanesi, içe/dışa aktarma), yüze göre kırpma, UPN eğimli flanş, eleman / levha imalat resimleri (A4, PDF, SVG, levha DXF) | ✅ |
| Montaj (v0.16) | Bileşen ekleme, eşleşmeler, patlatma, girişim, BOM, STEP | 🟡 |
| Montaj ekleri (v0.17) | Teğet, limit mesafe, eşleşme mini çubuğu, çarpışma algılama, bileşen çoğaltma | ✅ |
| Teknik resim | Görünüşler, kesit, ölçülendirme, antet, PDF | ⬜ |
| Saha özellikleri | Fotoğraf ekleme, Bluetooth kumpas | ⬜ |

## 5. Platform farkları

- **Kalem / fare:** seçim, çizim ve ölçü işlemleri. Tıkla-tıkla ve tıkla-sürükle çizim birlikte desteklenir.
- **Parmak:** tek parmak döndürür (3D) veya kaydırır (eskiz); iki parmak kaydırır ve yakınlaştırır; parmakla dokunmak da seçim yapar.
- **Fare (v0.9, SolidWorks ile aynı):** orta tuş döndürür, Ctrl+orta kaydırır, Shift+orta yakınlaştırır, Alt+orta yuvarlar, orta çift tık sığdırır; tekerlek imleçte yakınlaştırır (ileri = uzaklaş, ayardan ters çevrilebilir); sağ tık bağlam menüsü, sağ sürükle fare hareketleri.
- **Telefon:** ağaç ve özellik paneli alttan açılan sayfa olarak gelir. **Tablet / bilgisayar:** solda sabit panel.

## v0.8 ile eklenenler

| Bölüm | Özellik | Durum |
|---|---|---|
| Eskiz | Çizdikten sonra hızlı ölçü girişi, dinamik ayna, eskiz resmi (fotoğraf + iki noktayla ölçekleme), orta nokta çizgisi, 3N merkez dikdörtgen, konik, denklem eğrisi, ayır, kademe çizgisi, koordinat ölçüsü, yay uzunluğu ölçüsü, daire kenarı ölçüsü, eş yarıçaplı, eskizi onar, blok kütüphanesi, kapalı bölge gölgesi | ✅ |
| Katı | Birleştir (ekle/çıkar/ortak), gövde böl, gövde taşı/kopyala, gövde sil, girinti, eskiz/tablo/eğri/doldurma çoğaltma, helisel diş, esnet (bük/bur/daralt/uzat), köşe pahı, ekstrüzyon başlangıç ötelemesi, girişim kontrolü, kılavuz eğrili loft | ✅ |
| Sac metal | Kademe, gönye flanş, köşe kapatma, saca dönüştür | ✅ |

## v0.9 — Bilgisayarda SolidWorks ile aynı kullanım

| Bölüm | Özellik | Durum |
|---|---|---|
| Fare | Orta tuş döndür / Ctrl kaydır / Shift yakınlaştır / Alt yuvarla, orta çift tık sığdır, SolidWorks tekerlek yönü (ayarlanabilir), sağ tık bağlam menüsü, sağ sürükle 4 yönlü fare hareketleri (eskiz: ↑ Akıllı Ölçü, → Daire, ↓ Dikdörtgen, ← Çizgi; parça: görünüm yönleri) | ✅ |
| Klavye | Ctrl+1…8 görünümler, Boşluk görünüm penceresi, F sığdır, Z/Shift+Z, oklar 15°/Shift 90°, Alt+ok yuvarla, Ctrl+ok kaydır, Ctrl+Shift+Z önceki görünüm, S kısayol çubuğu, Enter son komut, Ctrl+B/Q yeniden oluştur, Ctrl+S/O/N, Ctrl+Z/Y, Ctrl+A/C/V, Delete, Esc, A çizgi↔yay | ✅ |
| Çıkarım | Uç / orta / merkez / çeyrek / kesişim / üzerinde yakalama; uyandırılan noktalardan mavi hizalama çizgileri; sarı ilişki çizgileri (yatay, dikey, dik, doğrusal, teğet) ve imleç yanında ilişki simgesi; Ctrl ile çıkarımı kapatma; ızgara yakalama varsayılan kapalı | ✅ |
| Çizim | Uç noktaya geri dönüp çıkınca çizgi→teğet/normal yay geçişi, A tuşu, tıkla-tıkla ve tıkla-sürükle | ✅ |
| Seçim | Soldan sağa pencere, sağdan sola kesişen seçim; tık seçimi değiştirir, Ctrl/Shift ekler; ölçüde tek tık seç, çift tık Değiştir kutusu (tekerlek / ↑↓ artım, Shift ×10, Alt ×0,1) | ✅ |
| Telefon kontrolleri | v0.10'da tamamlandı (aşağıda) | ✅ |

## v0.10 — Telefon ve tablet kontrolleri

| Bölüm | Özellik | Durum |
|---|---|---|
| Kalem profilleri | Otomatik algılama; aktif kalem (havada imleç + yan tuş), aktif kalem (imleçsiz), basit kapasitif kalem, yalnız parmak, fare — Dosya › Kalem ve dokunmatik ayarları | ✅ |
| Çizim | Dokun–ayarla–kaldırınca yerleştir, büyüteç (2–4×, yakalama etiketiyle), parmakla çizimde imleç kayması, ayarlanabilir yakalama yarıçapı, yakalamada titreşim | ✅ |
| Hareketler | Avuç reddi, kalem yan tuşu = sağ tuş (menü / fare hareketleri), uzun basma bağlam menüsü, iki parmak geri al / üç parmak ileri al, iki parmakla çevirerek yuvarlama, çizerken ikinci parmak gelince gezinmeye geçiş | ✅ |
| Görünüm küpü | Tüm cihazlarda (bilgisayar dahil): yüz = dik görünüm, kenar = 45°, köşe = izometrik; sürükleyerek döndürme; eski Önden/Üstten/Sağdan/İzometrik düğmelerinin yerini aldı | ✅ |
| Ekran | Sağ kenarda ekran çubuğu (✓ ✕ A Ctrl ↶ ↷ ☰ ⤢), dairesel araç menüsü, görünüm küpü (dokun / sürükle), çizerken alt paneli küçültme, ölçü kutusunda − / + düğmeleri, solak düzeni | ✅ |
| Montaj | Bileşen ekleme, eşleşmeler, patlatma | ⬜ sıradaki |

## ⏳ Bekleyen: gerçek kalemle saha testi (unutma!)

Kullanıcının kalemi şu an yanında değil; v0.10 kalem profilleri yalnız tarayıcı taklidiyle test edildi. Kalem gelince şunlar denenecek ve ayarlar buna göre verilecek:

- [ ] Otomatik algılama hangi profili seçiyor? (Dosya › Kalem ve dokunmatik ayarları › "Algılanan")
- [ ] Havada imleç (hover) önizlemesi çalışıyor mu?
- [ ] Yan tuş: kısa basınca bağlam menüsü, basılı sürükleyince fare hareketleri
- [ ] Avuç reddi: kalemle çizerken avuç modeli döndürüyor mu?
- [ ] Kaldırınca yerleştir + büyüteç hassasiyeti, yakalama yarıçapı varsayılanı
- [ ] Uzun basma süresi (600 ms) ve titreşim uygun mu?
- [ ] Sonuca göre varsayılan ayarları güncelle

## v0.11 — Kalemsiz kullanım

| Bölüm | Özellik | Durum |
|---|---|---|
| Şekil sihirbazı | Delikli plaka, flanş, burç/boru, kademeli mil, L braket, kutu profil, blok — ölçü yaz, parça oluşsun (Dosya menüsü ve ✚) | ✅ |
| Sayıyla çizim | Çizgi (X,Y / uzunluk, açı), dikdörtgen (G×Y), daire (Ø); rakama basınca veya 123 düğmesiyle; ölçü ve yatay/dikey ilişki otomatik | ✅ |
| Dokunmatik fare | Parmak imleci göreli ve yavaş kaydırır, kısa dokunuş tıklar | ✅ |
| Parmakla katı | Eskizden çıkınca Ekstrüzyon / Kesme / Döndürme önerisi, seçim filtresi (Tümü / Yüz / Kenar) | ✅ |
| Kaba çiz, düzelt | Neredeyse yatay/dikey çizgilere tek dokunuşla ilişki | ✅ |
| Başlangıç rehberi | İlk açılışta kullanım şekli seçimi ve 5 adımlık ilk parça | ✅ |
| Sonra | Model üzerinde sürüklenen derinlik oku, üst üste adaylar arasında dokunarak geçiş, fotoğraftan kenar izleme, sesle ölçü | ⬜ |

## v0.12 — Arayüz düzeni ve eskiz referansları

| Bölüm | Özellik | Durum |
|---|---|---|
| Komut çubuğu | Gruplar (Katı/Detay/Gelişmiş/Gövde/Çoğalt/Referans; eskizde Çiz/Düzenle/Özel çizim/Araçlar), telefonda grup satırı | ✅ |
| Tam ekran | ⛶ düğmesi, kurulu PWA tam ekran açılır | ✅ |
| İmleç | Çizim, yakalama, seçilebilir öğe için farklı imleç | ✅ |
| Model yüzünde eskiz | Yüz kenarlarının köşe/orta/merkezine yakalama (sabit), kenara ölçü ve ilişki | ✅ |
| Uyandırma | Çizgi ortaları, daire merkezleri, model noktaları → hizalama çizgileri (kare merkezi) | ✅ |
| Eskiz (v0.12.1) | Dikdörtgen merkezine doğrudan yakalama, model kenarı üzerinde yakalama | ✅ |
| Akıllı Ölçü (v0.12.2) | Çizgi ortası, çeyrek, yay ortası, kesişim, dikdörtgen merkezi, model noktaları seçilebilir; Seç + Ctrl ile ilişki | ✅ |
| İmleç (v0.12.3) | Yakalama türüne göre SolidWorks tarzı imleç simgeleri, yazı etiketi kaldırıldı | ✅ |

## v0.13 — Paket A (SolidWorks farkları)

| Bölüm | Özellik | Durum |
|---|---|---|
| Eskiz | Seçili konturlar, paylaşılan eskiz, canlı ölçü güncelleme (⟳, ±) | ✅ |
| Ekstrüzyon | Başlangıç yüz/köşe, köşeye/gövdeye kadar, kenar yönü, kesme tarafını çevir | ✅ |
| Referans düzlem | Açılı, orta, 3 nokta, kenara dik, noktadan paralel, ekrana paralel | ✅ |
| Ağaç | Sürükle / ▲▼ sırala, F2, ebeveyn-çocuk | ✅ |
| Seçim | Kutu seçim (parça), diğerini seç, bağlam mini çubuğu | ✅ |

## v0.14 — Paket B (kısmi)

| Bölüm | Özellik | Durum |
|---|---|---|
| Süpürme | Dairesel profil (boru), profil yönelimi | ✅ |
| Çoğaltma / kabuk / radyüs | Örnek atla, dışa kabuk, çoklu yarıçap | ✅ |
| Görünüm | Görüntü stilleri, saydam, Instant3D derinlik oku | ✅ |
| Eskiz | Birleştir ilişkisi, hızlı yakalama filtresi, güç kırpma, çift yönlü öteleme | ✅ |

## v0.15 — Paket C (kısmi)

| Bölüm | Özellik | Durum |
|---|---|---|
| Sac | Büküm payı / düşümü, kalınlık tablosu, geçiş parçası (huni) + açınım DXF, köşe kır | ✅ |
| Kaynaklı | Delme noktası ötelemesi | ✅ |

## v0.16 — Montaj (Paket D ilk sürüm)

| Bölüm | Özellik | Durum |
|---|---|---|
| Bileşen | Ekle (geçerli parça / kütüphane / dosya), sabitle, gizle, sil, kütüphaneden güncelle | ✅ |
| Eşleşme | Çakışık, paralel, dik, mesafe, açı, eş merkezli, kilit; hizalama çevir; serbestlik göstergesi | ✅ |
| Hareket | Sürükleyerek taşı, Δ öteleme, 90° döndür | ✅ |
| Değerlendirme | Girişim, patlatma, malzeme listesi (CSV), STEP montaj | ✅ |
| Sonra | Teğet, gelişmiş ve mekanik eşleşmeler, çarpışma, bileşen çoğaltma, alt montaj | ⬜ |

## v0.17 — Montaj ekleri (Paket D devam)

| Özellik | Durum |
|---|---|
| Teğet eşleşme (düz yüz ↔ silindir) | ✅ |
| Limit mesafe eşleşmesi (en az / en çok) | ✅ |
| Eşleşme açılır mini çubuğu (Ctrl ile iki yüz) | ✅ |
| Sürüklerken çarpışma algılama (adımlı kutu testi) | ✅ |
| Doğrusal (2 yön) / dairesel bileşen çoğaltma | ✅ |
| Simetrik, genişlik, mekanik eşleşmeler, alt montaj, bağlam içi düzenleme | ⬜ |

## v0.18 — 3B eskiz ve profil yönü (SolidWorks)

| Özellik | Durum |
|---|---|
| 3B eskizde grafik alanda tıklayarak çizim (boşluk → etkin düzlem, yüz → yüzey noktası) | ✅ |
| Tab ile XY / YZ / ZX, uzay tutamacı, lastik bant, canlı uzunluk | ✅ |
| X / Y / Z eksen çıkarımı (Along X/Y/Z kaydı) | ✅ |
| Rakamla uzunluk, çift tık / Esc zinciri bitir, noktaya tıklayınca kapat | ✅ |
| Çizgi uzunluğu düzenleme (bağlı noktalar kayar) | ✅ |
| Profil yönü: dikey eksen = eskiz normali / dünya yukarısı (`ori: 2`, eski belgeler korunur) | ✅ |
| Yapı elemanında segmentleri grafik alanda seçme + vurgulama | ✅ |
| Gruplar, Alignment, profil üzerinde delme noktası seçimi, 3B çözücü, nokta sürükleme | ⬜ |

## v0.19 — Yapı elemanı grupları, Alignment, 3B sürükleme

| Özellik | Durum |
|---|---|
| Yapı elemanı grupları (ayrı konum/döndürme/köşe işlemi) | ✅ |
| Alignment (yatay/dikey eksen → X/Y/Z veya kenar) | ✅ |
| Profili konumlandır (delme noktasını profil resminde seç) | ✅ |
| 3B eskiz nokta sürükleme, Along X/Y/Z korunumu | ✅ |
| Ctrl + yüz ile 3B eksen takımı hizalama | ✅ |
| 3B tam çözücü, 3B yay/spline, gruplar arası kırpma sırası | ⬜ |

## v0.19.1

| Özellik | Durum |
|---|---|
| Profili konumlandır penceresi duyarlı boyut (telefon/masaüstü), büyük dokunma alanları, geçerli nokta vurgusu | ✅ |

## v0.20 — Akıllı profil birleşimleri

| Özellik | Durum |
|---|---|
| Bağlı segmentleri aynı yöne çevirme (L/U kanatları köşede ters dönmez, gönye eşleşir) | ✅ |
| T birleşimi otomatik kırpma (serbest uç başka elemanın ortasına değince) | ✅ |
| Gruplar arası köşe ve 3+ elemanlı köşe: sürekli eleman uzar, diğerleri yüzünde biter | ✅ |
| Bölünmüş düz kiriş (aynı doğrultuda iki parça) sürekli sayılır | ✅ |
| Köşede ayakların profil yönünü otomatik döndürme, kesişen (X) elemanlar | ⬜ |

## v0.21 — 3B eskizde ilişki/ölçü/çözücü, profil otomasyonu

| Özellik | Durum |
|---|---|
| 3B araçlar: Dikdörtgen, Nokta, Seç, Akıllı Ölçü | ✅ |
| 3B ilişkiler (X/Y/Z boyunca, düzleme paralel, paralel, dik, eşit, doğrusal, sabitle, çakışık, orta nokta, üzerinde) | ✅ |
| 3B ölçüler (boy, mesafe, açı) + etiketle düzenleme | ✅ |
| 3B kısıt çözücü + tam tanımlı göstergesi | ✅ |
| Ayakların profil yönünü otomatik döndürme | ✅ |
| X kesişen elemanlar (biri sürekli, diğeri iki parça) | ✅ |
| 3B yay/daire/spline, 3B kırp/ayna/öteleme, 3B ölçü–denklem bağı | ⬜ |

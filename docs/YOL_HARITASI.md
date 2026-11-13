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

## v0.22 — 3B eskiz eksikleri

| Özellik | Durum |
|---|---|
| 3 noktalı yay, yapı elemanı yay boyunca | ✅ |
| Eskiz radyüsü (teğet + R otomatik) | ✅ |
| Teğet ilişkisi, yarıçap ölçüsü | ✅ |
| Kırp / Uzat | ✅ |
| Ayna (XY/YZ/ZX, noktadan geçen) | ✅ |
| 3B ölçü–denklem bağı | ✅ |
| Gruplar arası kırpma önceliği | ✅ |

## v0.22.1

| Özellik | Durum |
|---|---|
| Düzlemsel zincirde ortak profil yönü (ters U çerçeve köşeleri) | ✅ |

## v0.23

| Özellik | Durum |
|---|---|
| Çizim araçları yalnız eskiz modunda (SolidWorks gibi) | ✅ |
| Merkez dikdörtgen ötelemesi (yapı çizgileri ötelenmez) | ✅ |
| Dokunmatik/kalemde yakalama simgesi rozeti | ✅ |
| 3B eskizde çizgi/yay üzerine yakalama + Üzerinde ilişkisi | ✅ |
| Radyüse değen kenara sonradan radyüs (sıra değiştirerek yeniden deneme) | ✅ |

## v0.24

| Özellik | Durum |
|---|---|
| 2B otomatik yatay/dikey (kapanan çizgi dahil) + nokta hizalama ilişkisi | ✅ |
| 3B araçlar üst çubukta | ✅ |
| 3B seçim yanında ilişki/ölçü çubuğu | ✅ |
| 3B hizalama çıkarımı (eksen boyunca diğer noktanın hizası) | ✅ |

## v0.25 — Kırpma düzeltmeleri

| Özellik | Durum |
|---|---|
| Teğet çizgi/daire kesişimi toleranslı (geometrik çözüm) | ✅ |
| Çakışan kesişimlerin teklenmesi | ✅ |
| Tek kesişimli daire silinmez | ✅ |
| Ortadan kırpmada doğrusal + teğet ilişkisinin taşınması, bölünen yaylarda eşit | ✅ |

## v0.26

| Özellik | Durum |
|---|---|
| 3B: orijin/model köşesine yakalanan nokta sabit | ✅ |
| 3B: hizalama ile konan noktaya nokta hizalama ilişkisi (eqX/eqY/eqZ) | ✅ |
| 3B: orijinden kare + 2 ölçü → tam tanımlı | ✅ |

## v0.27 — Eskiz radyüsü

| Özellik | Durum |
|---|---|
| Çift noktalı / çakışık ilişkili köşeyi birleştirip radyüsleme | ✅ |
| Çizgi–yay ve yay–yay köşesine radyüs | ✅ |
| Yapı çizgileri köşe sayımına katılmaz | ✅ |

## v0.28

| Özellik | Durum |
|---|---|
| Açınımda bitişik büküm çizgilerinin büküm bölgesine kırpılması | ✅ |

## v0.29

| Özellik | Durum |
|---|---|
| Bitişik flanşlarda dikdörtgen köşe boşaltması (tüm flanş konumları) | ✅ |
| Açınımda sıfır alanlı küçük döngülerin atlanması | ✅ |
| Köşe boşaltma türü seçimi (dairesel / yırtma) | ⬜ |

## v0.30 — Bilgisayar arayüzü (SolidWorks gibi)
| Özellik | Durum |
|---|---|
| Menü çubuğu (Dosya, Düzen, Görünüm, Ekle, Araçlar, Yardım; alt menüler, kısayol gösterimi) | ✅ |
| Komut arama kutusu (tüm komutlar, ok tuşları + Enter) | ✅ |
| CommandManager: büyük simgeli şerit, tüm gruplar yan yana, sekmeler şeridin altında, tekerlekle yatay kaydırma | ✅ |
| Heads-up görünüm çubuğu (sığdır, bölgeye yakınlaştır, önceki görünüm, kesit, görünüm yönü, stil, düzlemler) | ✅ |
| Yönetici sekmeleri (Ağaç / Özellik) + özellik açıkken grafik alanda açılır ağaç | ✅ |
| Durum çubuğu (mod, seçim, filtre, birim, kilit, özelleştir) | ✅ |
| Tam ekran Esc kilidi (Keyboard Lock API; Chrome/Edge) | ✅ |
| Özelleştir: klavye kısayolları (tüm komutlar, çakışma uyarısı, varsayılana dön), fare hareketleri 4/8 yön, yazdırılabilir liste | ✅ |
| Yeni kısayollar: G büyüteç, F5 seçim filtresi, F9 ağaç, F11 tam ekran, Ctrl+Boşluk, F1 yardım | ✅ |
| Telefon/tablet düzeni değişmedi (≤820 px) | ✅ |
| Seçim kırıntıları (breadcrumbs), görev bölmesi (sağ panel) | ⬜ |

## v0.30.1
| Özellik | Durum |
|---|---|
| Sağ tık > Dik: grafik alanda düzlem / düz yüz, ağaçta düzlem; eskiz ve özellik panelinde imleç altındaki yüz | ✅ |
| İkinci Dik basışında ters taraftan bakma (SolidWorks gibi) | ✅ |
| Sağ tık imleç altındaki düzlemi / yüzü seçer | ✅ |

## v0.30.2
| Özellik | Durum |
|---|---|
| 3B eskiz ilişki çubuğu: başlık + İlişki ekle / Aynala / Ölçü bölümleri, metinler üst üste binmez | ✅ |
| Çubuk imlecin üstünde açılır (Ctrl ile ikinci öğe seçimini örtmez) | ✅ |
| 3B eskiz panelinde Araç seçici satırlara sarar, ilişki/ölçü listesinde küçük ✕ | ✅ |

## v0.30.3
| Özellik | Durum |
|---|---|
| Profili konumlandır: kutu/boru profilde 17 nokta (merkez, dış 8, iç 8) | ✅ |
| İnce cidarda nokta ve dokunma alanı otomatik küçülür, ipucu (Dış/İç) | ✅ |

## v0.31 — Yapı elemanı: grup başına profil ve özellikler arası birleşim
| Özellik | Durum |
|---|---|
| Her grubun kendi profili (standart / ölçü / özel / eskizden); "Grup 1 ile aynı profil" | ✅ |
| Farklı profilli gruplar arasında T, köşe, X birleşimleri ve kırpma önceliği | ✅ |
| Kesim listesinde her grup kendi profil adıyla | ✅ |
| Özellikler arası: yeni elemanın ucu önceki elemana değerse onun yüzünde biter (T) | ✅ |
| Özellikler arası: önceki elemanın ucu yeni elemanın ortasına değerse önceki kırpılır (ters T) | ✅ |
| Özellikler arası tek elemanlı köşe: önceki eleman uzar, yeni eleman yüzünde biter; gönyeli köşede uzatma yok | ✅ |
| "Önceki yapı elemanlarına göre kırp / uzat" seçeneği (varsayılan açık) | ✅ |
| Özellikler arası gönye köşe seçeneği | ⬜ |

## v0.32 — Montaj (SolidWorks mantığı) — ayrıntı: docs/MONTAJ_RAPORU.md
| Özellik | Durum |
|---|---|
| Eşzamanlı eşleşme çözücüsü, serbestlik (Jacobian sıfır uzayı), aşırı tanım reddi | ✅ |
| Eşleşmelere uyarak sürükleme ve döndürme, Taşı/Döndür paneli (Delta XYZ, XYZ konumu) | ✅ |
| Eşleşme paneli: seçim kutuları, Standart/Gelişmiş/Mekanik, hizalama, canlı önizleme, düzenle | ✅ |
| Gelişmiş: simetrik, genişlik, limit mesafe/açı, doğrusal bağlayıcı | ✅ |
| Mekanik: menteşe, dişli, kremayer–pinyon, vida | ✅ |
| Kenar / dairesel kenar / köşe seçimi, SmartMates (Alt+sürükle) | ✅ |
| Bileşen aynala (kopya / ters el), saydam | ✅ |
| Patlatma adımları + animasyon, kütle özellikleri | ✅ |
| Alt montaj, bağlam içi düzenleme, yol/kam/yuva/üniversal mafsal, hareket etüdü | ⬜ |

## v0.32.1 — 3B eskiz Akıllı Ölçü
| Özellik | Durum |
|---|---|
| Ölçü çizgisi, uzatma çizgileri, oklar (dar ölçüde dıştan), açı yayı + ışın uzatma, yarıçap/çap kılavuzu | ✅ |
| Seçim tamamlanınca ölçü imleci izler, tıklanan yere yerleşir (öteleme kaydedilir), etiket sürüklenebilir | ✅ |
| Yeni ölçüler: nokta–çizgi, çizgi–çizgi (paralel), nokta–yay merkezi, çap (D ile yarıçap↔çap) | ✅ |
| Açı: yerleştirildiği bölgeye göre dar / geniş (SolidWorks gibi), sürükleyince değer güncellenir | ✅ |
| Çelişen veya fazlalık ölçü → sürülen (referans) ölçü; sürücü ↔ sürülen | ✅ |
| Ölçü: tek tık seç + bağlam çubuğu, çift tık düzenle, Delete sil | ✅ |

## v0.33 — Montaj ekleri
| Özellik | Durum |
|---|---|
| Montaj ve bileşen ana düzlemleri / orijin ile eşleşme (ağaçtan seçim) | ✅ |
| Alt montaj: seçilenlerden oluştur, .icasm ekle, rijit / esnek, dağıt, kaydet | ✅ |
| Bileşen değiştir (konum + eşleşmeler korunur), eşleşmeleriyle kopyala | ✅ |
| Bağlam içinde parça düzenle → "Montaja dön" ile bileşen güncellenir | ✅ |
| Bağlantı elemanları: ISO 4017 cıvata, ISO 4032 somun, ISO 7089 pul (M4–M20) | ✅ |
| Profil merkezi, üniversal mafsal eşleşmeleri | ✅ |
| MateXpert (sağlanamayan eşleşme + bastırma önerisi), boşluk doğrulama, montaj kesiti | ✅ |
| Hareket etüdü: döner / doğrusal motor, eşleşmelerle birlikte hareket | ✅ |
| Yol, kam, yuva eşleşmeleri; montaj kesme/delik özellikleri | ⬜ |

## v0.33.1 — Montaj güvenilirliği ve ön seçim vurgusu
| Özellik | Durum |
|---|---|
| Döndürülmüş / büyük parçalarda çakışık vb. eşleşmeler (çözücü ölçeklemesi) | ✅ |
| Eşleşme matrisi testi: 27 varlık çifti × tüm türler × rastgele başlangıç, serbestlik SolidWorks ile aynı | ✅ |
| Eş merkezli / paralel hizalı–ters hizalı, dairesel kenar–düz yüz çakışık, nokta–dairesel kenar çakışık, mesafede mevcut taraf, içten teğet | ✅ |
| Ön seçim vurgusu: montajda yüz (turuncu + sınır), kenar, köşe; parça modunda turuncu + sınır | ✅ |

## v0.34 — Serbest Çizim (elle çizimi şekle dönüştürme)
| Özellik | Durum |
|---|---|
| Eskiz şeridinde Çizgi'nin solunda "Serbest Çizim" aracı (fare, kalem, parmak) | ✅ |
| Basılı tutup kaba çizim, bırakmadan beklemeyle (0,55 sn) tanıma + mavi önizleme; çizmeye devam edince tanıma iptal | ✅ |
| Tanınan şekiller: çizgi, yay, daire, açık/kapalı çokgen (kare, üçgen…), serbest eğri (spline) | ✅ |
| Uçlar birleşir (kapalı şekil), uç noktalar mevcut noktalara / orijine yakalanır | ✅ |
| Yatay / dikey (±8°) ve eğik dik köşelerde dik ilişkisi; tek adımda geri al | ✅ |
| Elips / dikdörtgen yuvarlatma tanıma | ✅ (v0.35) |

## v0.35 — Daha güçlü şekil tanıma ve çıkış onayı
| Özellik | Durum |
|---|---|
| Kapalı çizimde aday yarışı: daire, elips, dikdörtgen/kare, yuvarlatılmış dikdörtgen, çokgen — en iyi uyan seçilir | ✅ |
| Bozuk / kapanmamış / taşan kare-dikdörtgen tanıma (uçlar uzatılıp köşede buluşur, dik açıya yakın dörtgen = dikdörtgen) | ✅ |
| Kare → eşit ilişkisi; eğik dikdörtgen → paralel + dik; yuvarlatılmış → 4 yay + teğet + eşit | ✅ |
| Elips (eğik de olabilir; eksene yakınsa yatay/dikey) | ✅ |
| Eskizde / özellik panelinde Esc, ✕ ve telefon geri tuşu: değişiklik varsa "Çıkmak istediğinize emin misiniz?" (Kaydet ve çık / Kaydetmeden çık / Vazgeç) | ✅ |
| Sayfa kapatılırken uyarı (açık işlemde değişiklik varsa) | ✅ |

## v0.36 — Kalıcı referanslar
| Özellik | Durum |
|---|---|
| Önceki ölçü değişince radyüs, pah, kabuk, koniklik, kenar flanşı, diş vb. kenar/yüzünü bulmaya devam eder (imzayla eşleme + belgeye onarım) | ✅ |
| Eskizde Esc eskizden çıkmaz (SolidWorks gibi); ✕ ve geri tuşu sormaya devam eder | ✅ |
| Bulunamayan referans için "yeniden seç" penceresi | ⬜ |
| Delik sihirbazı konumlarını kenara ölçülendirme | ⬜ |

## v0.37 — Montaj–parça bağı
| Özellik | Durum |
|---|---|
| Parça dosyası değişince montajdaki örnekleri güncellenir (Montaj sekmesine dönünce) | ✅ |
| Parçayı düzenle → aynı parçanın tüm örnekleri | ✅ |
| Eşleşmeler yeni geometriyi izler; kaybolan referans ⚠ | ✅ |
| Çarpışma algılama gerçek geometriyle (mil–delik yanlış alarm vermez) | ✅ |
| Silindir eşleşme ekseni doğru (yarım yüz merkezi değil) | ✅ |
| Bağlam içi düzenlemede sayfa yenilenirse ana parça korunur | ✅ |

## v0.38 — Montaj kesme / delik ve delik hizalama
| Özellik | Durum |
|---|---|
| Montaj deliği / dikdörtgen montaj kesmesi (tümünü geç / kör), seçili bileşenlere uygulanır, parça dosyası değişmez | ✅ |
| Montaj özelliğini bastır / sil (ağaç, sağ tık) | ✅ |
| Delik hizalama raporu (hizasız delikler ve sapma) | ✅ |

## v0.39 — Teknik resim
| Özellik | Durum |
|---|---|
| Parça resmi: ön / üst / sol (ilk açı, ISO E), izometrik, kesit A-A (taralı) | ✅ |
| Otomatik ölçüler: toplam boyutlar, delik çapları (n× Ø), delik konumları | ✅ |
| Antet (parça, malzeme, ölçek, çizen, tarih, resim no), A4 / A3, otomatik / seçili ölçek | ✅ |
| PDF (yazdır), SVG, DXF (katmanlı) | ✅ |
| Montaj resmi: izometrik + balonlar + malzeme listesi | ✅ |
| Detay görünüşü, ölçü düzenleme, çok sayfa | ⬜ |

## v0.40 — Hız ve dosya
| Özellik | Durum |
|---|---|
| Artımlı yeniden oluşturma (değişmeyen özellikler önbellekten) | ✅ |
| Delik konumlarını eskizle ölçülendirme (konum eskizi) | ✅ |
| Aynı dosyaya kaydet (masaüstü Chrome/Edge), Farklı kaydet, Son belgeler | ✅ |
| Diş özelliğinin kendisini hızlandırma | ⬜ |

## v0.41 — Modelleme ekleri
| Özellik | Durum |
|---|---|
| Helis / yay (silindirik, konik, sol el) süpürme yolu | ✅ |
| Loft başlangıç / bitiş kısıtı: profile dik + teğet uzunluğu | ✅ |
| Referans eksen: silindir yüzü, iki düzlem, iki nokta | ✅ |
| Yapılandırmalar + tasarım tablosu (değişken değerleri, bastırma) | ✅ |
| Süpürmede burulma / kılavuz eğri, sac aç/katla, flanş profili, köşe başına kaynak işlemi | ⬜ |

## v0.42 — DXF içe aktarma
| Özellik | Durum |
|---|---|
| Eskize DXF içe aktar (çizgi, daire, yay, çoklu çizgi, nokta; uçlar birleşir) | ✅ |

## v0.43 — Görünüm renkleri ve STL içe aktarma
| Özellik | Durum |
|---|---|
| Parça rengi ve yüz rengi (sağ tık; ölçü değişince korunur) | ✅ |
| STL içe aktarma (ikili / ASCII → katı) | ✅ |
| Perspektif, birim sistemi, yüzey modelleme, doğrudan düzenleme, analiz | ⬜ |

## v0.44 — Süpürme burulma / kılavuz, eksik referans penceresi
| Özellik | Durum |
|---|---|
| Süpürmede burulma açısı | ✅ |
| Süpürmede kılavuz eğri (profil ölçeklenir) | ✅ |
| Eksik referans: "Yeniden seç" penceresi | ✅ |

## v0.45 — Büküm tablosu ve doğrudan düzenleme
| Özellik | Durum |
|---|---|
| Sac büküm tablosu (açıya göre büküm payı, ara açılar doğrusal) | ✅ |
| Yüz taşı (düz yüz ±mesafe) — içe aktarılan STEP'te de | ✅ |
| Yüz sil (silindirik deliği doldur) | ✅ |

## v0.46 — Yüzey modelleme
| Özellik | Durum |
|---|---|
| Yüzey ekstrüzyon (açık / kapalı eskiz), düzlemsel yüzey | ✅ |
| Kalınlaştır (yüzey → katı), Yüzeyle kes | ✅ |
| Yüzey loft / sınır / doldurma, dikiş, kırp | ⬜ |

## v0.47 — Köşe başına işlem ve birim sistemi
| Özellik | Durum |
|---|---|
| Kaynaklı yapı: köşe başına işlem (gönye / alın 1 / alın 2 / yok + köşeye özel boşluk) | ✅ |
| Birim sistemi mm ↔ inç (görüntü ve giriş) | ✅ |

## v0.48 — Perspektif görünüm
| Özellik | Durum |
|---|---|
| Perspektif / ortografik görünüm (seçim ve yakalama perspektifte de doğru) | ✅ |

| v0.49 | Basit mukavemet analizi (kiriş: σ, sehim, güvenlik katsayısı) | ✅ |

| v0.50 | Flanş profili (yamuk), aç/katla ile kesme (bükümü geçen kontur dahil) | ✅ |

| v0.51 | Diş hızlandırma (yapıştırmalı birleştirme), kozmetik diş | ✅ |

| v0.52 | Yüzey loft, sınır doldurma yüzeyi; kalınlaştırma yön düzeltmesi | ✅ |

| v0.53 | Yüzey kırp (düzlem / yüzey), yüzey dik (kapalıysa katı) | ✅ |

| v0.54 | Teknik resim: ölçü sürükleme, detay görünüşü, 2. sayfa, montajda patlatılmış görünüş | ✅ |

| v0.55 | Çeyrek noktasından ölçü: çap değişince nokta kaymıyor | ✅ |

| v0.56 | Gereksiz (fazla) ölçü uyarısı, sürülen ölçü önerisi | ✅ |

| v0.57 | Montaj modu: paneller ✕/Esc ile kapanır, montaj geri al, Delete, sağ tık bileşen menüsü, telefon ✕ ve ekran çubuğu | ✅ |

| v0.58 | Montaj: telefonda parmakla sürükleme, Girişim paneli, düzlem satırları kapalı, telefonda alçak panel, dikiş noktası seçilmez, kütlede parça malzemesi | ✅ |

| v0.59 | Montaj: bileşen yapılandırmaları, yol / kam / yuva eşleşmeleri, fiziksel dinamik, hareket videosu kaydı | ✅ |

| v0.60 | Orta tuşla döndürme: imleç altındaki köşe / yüz noktası etrafında, orta tıkla seçilen kenar / eksen etrafında (SolidWorks) | ✅ |

| v0.61 | Teknik resim: ölçü ekle / düzenle / sil, tolerans, pürüzlülük, geometrik tolerans, referans, görünüş taşıma, kaynaklı yapı kesim listesi + balon + kaynak listesi | ✅ |

| v0.62 | Eskiz: sanal sivri köşe, yay koşulu, ayrı Taşı/Kopyala/Döndür/Ölçekle/Esnet, yüz döngüsü + silüet dönüştürme, delme ilişkisi, çoğaltmada örnek atla, SketchXpert | ✅ |

| v0.63 | Eskiz: kanal ölçü tipi, zincir ölçü, ızgara / açı yakalama ayarı, eğrilik tarağı, metin yazı tipi, eskiz düzlemini değiştir, türetilmiş eskiz | ✅ |

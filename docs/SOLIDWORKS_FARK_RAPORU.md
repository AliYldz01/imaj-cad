# SolidWorks karşılaştırma raporu (v0.12.3)

Kaynak: kodun (özellik tipleri, seçenek alanları, araç listeleri) incelenmesi + şimdiye kadarki testler.
Önem: **K** = kritik (günlük işi engeller) · **Ö** = önemli · **İ** = iyileştirme / ileri seviye.
Durum: ⬜ yapılmadı · ✅ düzeltildi (düzeltmeler yapıldıkça işaretlenir).

## 1. 2B eskiz

| # | Önem | Sorun / eksik | SolidWorks'te | Öneri |
|---|---|---|---|---|
| E1 | K | Ekstrüzyon/döndürme eskizdeki **tüm kapalı bölgeleri** kullanıyor; bölge seçilemiyor | "Seçili konturlar" ile tek bölge / iç içe bölgeler seçilir | PM'de "Konturlar" seçimi (bölgeye dokun) |
| E2 | K | Bir eskiz yalnız **bir özellik** tarafından kullanılabiliyor | Paylaşılan eskiz (aynı eskizden birden çok özellik) | Eskiz tüketimini paylaşılabilir yap, ağaçta paylaşıldı simgesi |
| E3 | Ö | Ölçü Değiştir kutusunda **anlık yeniden oluştur** (⟳) ve yön ters çevirme yok | ✓ ✗ ⟳ ±, tekerlekle canlı güncelleme | Değer değiştikçe çöz + önizle |
| E4 | Ö | Eskiz radyüsü/pahında **sanal köşe** yok, köşeye verilmiş ölçüler kayboluyor | Sanal sivri köşe korunur, ölçüler ona bağlanır | Köşe noktasını yapı noktası olarak sakla |
| E5 | Ö | Yay/daire ölçüsünde **min/maks/merkez** koşulu yok (yalnız kenar ölçüsü ayarı var) | Shift ile min/maks, ölçü özelliklerinden "yay koşulu" | Ölçü özellik paneline yay koşulu |
| E6 | Ö | Eksik ilişkiler: **eş yarıçap (coradial), birleştir (merge), eşit eğri uzunluğu, delme (pierce), iki nokta arası yatay/dikey** | Var | Çözücüye ekle; delme süpürme için gerekli |
| E7 | Ö | **Hızlı yakalama filtresi** yok (yalnız orta noktaya / yalnız merkeze yakala) | Quick Snaps araç çubuğu | Sağ tık menüsüne yakalama filtresi |
| E8 | Ö | **Varlıkları Esnet (Stretch)**, **Döndür** ve **Ölçekle** ayrı komut değil (Taşı/Kopyala içinde) | Ayrı komutlar | Ayrı komut + sürükleme tutamakları |
| E9 | Ö | Spline: **teğet/eğrilik tutamakları**, eğrilik tarağı, eğim kontrolü yok | Var | Spline tutamakları + tarak |
| E10 | Ö | Yüzün **silüet kenarlarını** (silindir kenarı) dönüştürme yok | Silüet varlıkları | HLR'den silüet çıkar |
| E11 | İ | Metin: yazı tipi/kalınlık seçimi yok, eğri üzerinde metin yok | Var | Yazı tipi seçimi |
| E12 | İ | Bloklar: blok içi ilişkiler, blok hareketi, blok düzenleme yok | Var | Blok düzenleme modu |
| E13 | İ | İlişki silme/sorun giderme sihirbazı (SketchXpert) yok | Var | Aşırı tanımda "çözüm önerileri" penceresi |
| E14 | İ | Izgara görünümü ayarları, eskiz yönelimi (eskiz düzlemini döndür) yok | Var | Eskiz panelinde |

## 2. 3B katı özellikleri

| # | Önem | Sorun / eksik | SolidWorks'te | Öneri |
|---|---|---|---|---|
| F1 | K | **Referans düzlem** yalnız "öteleme" ile oluşuyor | Açılı, 3 noktadan, eğriye dik, orta düzlem, teğet, noktadan paralel | Düzlem PM'ini SW gibi 3 referanslı yap |
| F2 | K | Ekstrüzyonda **ince özellik (thin)**, **köşeye kadar**, **gövdeye kadar**, **yön vektörü (kenar)** yok; başlangıç koşulu yalnız öteleme | Var | Bitiş koşulları + ince özellik + başlangıç: yüzey/köşe |
| F3 | K | Süpürme yalnız profil+yol: **kılavuz eğri, burulma, profil yönelimi, dairesel profil, ince, teğetlik** yok | Var | Süpürme PM'ini genişlet (OCC MakePipeShell destekliyor) |
| F4 | Ö | Loft: **başlangıç/bitiş teğetliği**, kapalı loft, ince, bağlayıcılar yok | Var | Loft seçenekleri |
| F5 | Ö | Radyüs: **değişken yarıçap, tam yuvarlak, yüz radyüsü (tutma çizgisi), teğet yayılımı aç/kapat, setback** yok | Var | FilletExpert tarzı seçenekler |
| F6 | Ö | Çoğaltmalarda **atlanacak örnekler**, **eskizi değiştir (vary)**, gövde çoğaltma ayrımı yok | Var | Örneğe dokunarak atla |
| F7 | Ö | Kabuk: **farklı kalınlıklı yüzler**, dışa kabuk yok | Var | Yüz başına kalınlık |
| F8 | Ö | Koniklik: yalnız nötr düzlem; **ayırma çizgisi / basamaklı** yok | Var | Ek türler |
| F9 | Ö | **Özellik bastırma (suppress)**, özellik **sıra değiştirme (sürükle)**, **klasörler**, F2 ile ad değiştirme eksik/kısıtlı | Var | Ağaç işlemleri |
| F10 | Ö | **Instant3D** (modelde ok tutamağıyla derinlik sürükleme) yok | Var | Yeşil ok tutamakları (telefon için de faydalı) |
| F11 | Ö | **Görünüm modları**: tel kafes, gizli çizgi, kenarlı gölgeli, perspektif, gövde gizle/göster, saydamlık yok | Var | Görünüm çubuğuna ekle |
| F12 | Ö | **Doğrudan düzenleme**: yüz taşı, yüz sil, yüz değiştir yok (içe aktarılan STEP'i düzenlemek için gerekli) | Var | OCC ile yüz taşı/sil |
| F13 | Ö | **Yüzey modelleme** tamamen yok (öteleme yüzeyi, dikiş, kalınlaştır, yüzeyle kes) | Var | Temel yüzey araçları |
| F14 | İ | **Konfigürasyonlar / tasarım tablosu** yok | Var | Ölçü varyantları |
| F15 | İ | Yüz/özellik **renk ve görünüm** atama yok | Var | Renk atama |
| F16 | İ | Delik sihirbazında **yuva (slot) delik**, delik serisi, kozmetik diş gösterimi kısıtlı | Var | Delik türleri |
| F17 | İ | Her değişiklikte **tüm model baştan kuruluyor** (büyük parçada yavaş); diş özelliği ~17 sn | Artımlı yeniden oluşturma | Özellik bazlı önbellek (değişmeyen özellikleri yeniden kurma) |

## 3. Sac metal

| # | Önem | Sorun / eksik | SolidWorks'te | Öneri |
|---|---|---|---|---|
| S1 | K | Büküm hesabı yalnız **K-faktörü**; **büküm payı / büküm düşümü / büküm tablosu**, **kalınlık tablosu (gauge)** yok | Var | Sac parametrelerine yöntem seçimi + tablo |
| S2 | Ö | Kenar flanşında **profil eskizini düzenleme** (özel flanş şekli) yok | Var | Flanş profil eskizi |
| S3 | Ö | **Köşe kırma** (köşe radyüs/pah), **kaynaklı köşe** yok | Var | Köşe işlemleri |
| S4 | Ö | **Loft büküm (geçiş parçası / huni)**, **çapraz kırma**, **havalandırma**, **şekillendirme aletleri (louver, kabartma)**, **tırnak–yuva** yok | Var | Önce loft büküm (silo/huni imalatında çok kullanılır) |
| S5 | Ö | Açınım DXF'inde **büküm çizgisi katmanı, büküm notları (açı/yön/iç yarıçap)** ayrımı sınırlı | Var | DXF katmanları + not |
| S6 | Ö | **Aç/Katla (Unfold/Fold)** ara özellikleri yok (bükümün üzerinden kesik açmak için) | Var | Aç → kes → katla |
| S7 | İ | Büküm boşaltma türleri (dikdörtgen/oval/yırtma) ve köşe boşaltma seçenekleri kısıtlı | Var | Seçenek ekle |
| S8 | İ | Sac köşe takviyesi (gusset) yok | Var | Ekle |

## 4. Kaynaklı yapı ve 3B eskiz

| # | Önem | Sorun / eksik | SolidWorks'te | Öneri |
|---|---|---|---|---|
| W1 | Ö | Yapı elemanında **gruplar** ve **köşe başına işlem** (her köşeye ayrı gönye/alın, kırpma sırası) yok | Var | Köşeye dokunarak işlem |
| W2 | Ö | Delme noktası yalnız hazır noktalar; **profil üzerinde özel nokta** seçimi yok | "Profili konumlandır" | Profil eskizinden nokta seç |
| W3 | Ö | Kesim listesi **özellikleri düzenlenemiyor** (açıklama, malzeme, özel alan) | Var | Kesim listesi özellik penceresi |
| W4 | Ö | 3B eskizde **ilişkiler (X/Y/Z boyunca, çakışık) ve akıllı ölçü** SW kadar değil; sayısal giriş ağırlıklı | Var | 3B eskize ilişki/ölçü |
| W5 | İ | 3B spline, 3B eskizde düzlem, kenar dönüştürme yok | Var | Ekle |
| W6 | İ | Kaynak dikişi yalnız görsel/tablo; **kaynak sembolü** (resimde) yok | Var | Teknik resim modülüyle |

## 5. Genel arayüz ve dosya

| # | Önem | Sorun / eksik | SolidWorks'te | Öneri |
|---|---|---|---|---|
| G1 | K | **Tek belge**: aynı anda birden çok parça açılamıyor, parça kütüphanesi yok (montaj için şart) | Çoklu belge | Proje / dosya yöneticisi (montajla birlikte) |
| G2 | Ö | 3B'de (parça modunda) **pencere seçimi** ve **"diğerini seç"** (arkadaki yüz) yok | Var | Kutu seçim + Alt/uzun bas ile sıradaki aday |
| G3 | Ö | **Hata açıklaması** ("Ne yanlış?") ağaçta kısa; düzeltme önerisi yok | Var | Hata penceresi |
| G4 | Ö | **Birim / belge ayarları** (mm/inç, ondalık, standart) yok | Var | Belge özellikleri |
| G5 | İ | Dışa aktarma: yüz/eskiz **DXF**, **PDF**, IGES yok | Var | Eskiz/yüz DXF önce |
| G6 | İ | Özellik düzenlerken **sarı önizleme** bazı özelliklerde yok (radyüs, pah, kabuk…) | Var | Önizlemeyi tüm özelliklere yay |

## 6. Önerilen düzeltme sırası

1. **Paket A (kritik, günlük kullanım):** E1 seçili konturlar, E2 paylaşılan eskiz, F1 referans düzlem, F2 ekstrüzyon seçenekleri, E3 canlı ölçü, F9 bastır/sırala, G2 3B seçim.
2. **Paket B (modelleme gücü):** F3 süpürme, F4 loft, F5 radyüs, F6 çoğaltma atlama, F7 kabuk, F10 Instant3D, F11 görünüm modları, E4–E8.
3. **Paket C (sac + kaynak):** S1 büküm tabloları, S4 loft büküm, S2, S3, S5, S6, W1–W4.
4. **Paket D (ileri):** F12 doğrudan düzenleme, F13 yüzeyler, F14 konfigürasyonlar, F17 artımlı yeniden oluşturma, kalan İ maddeleri.

Montaj modülü G1 (çoklu belge) ile birlikte başlamalı.

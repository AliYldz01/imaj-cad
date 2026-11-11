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
| Geri sarma çubuğu (ağaçta sürüklenebilir) | Rollback Bar | ⬜ |
| Özellik özellik paneli + ✓ / ✕ onay köşesi | PropertyManager, Confirmation Corner | ✅ |
| Komut sekmeleri (Özellikler / Eskiz) | CommandManager | ✅ |
| Görünüşler: Ön, Üst, Sağ, İzometrik, Normal, Sığdır | View Orientation | ✅ |
| Kesit görünüşü | Section View | ⬜ |
| Global değişkenler ve denklemler | Equations | ⬜ |
| Malzeme, kütle özellikleri | Material, Mass Properties | ⬜ |
| Ölçüm aracı | Measure | ⬜ |
| Çoklu gövde | Multibody | ⬜ |
| Dosya kaydet / aç (.icad) | Save / Open | ✅ |
| STEP / STL dışa aktarma | Export | ✅ |
| STEP içe aktarma | Import | ⬜ |

## 2. Eskiz (2D)

### Eskiz varlıkları
| Araç | Durum |
|---|---|
| Çizgi (zincirleme, tıkla-tıkla ve sürükle) | ✅ |
| Merkez çizgisi (yapı geometrisi) | ✅ |
| Köşe dikdörtgen | ✅ |
| Merkez dikdörtgen | ✅ |
| 3 noktalı köşe / merkez dikdörtgen (açılı) | ⬜ |
| Paralelkenar | ⬜ |
| Daire (merkez) | ✅ |
| Çevre dairesi (3 nokta) | ⬜ |
| Merkez noktalı yay | ✅ |
| Teğet yay | ✅ |
| 3 noktalı yay | ✅ |
| Düz kanal (slot) | ✅ |
| Merkez noktalı kanal / yay kanal | ⬜ |
| Çokgen (çember içine) | ✅ |
| Nokta | ✅ |
| Elips, kısmi elips, parabol | ⬜ |
| Spline | ⬜ |
| Metin | ⬜ |

### Eskiz araçları
| Araç | Durum |
|---|---|
| Eskiz radyüsü (köşe yuvarlatma) | ✅ |
| Eskiz pahı | ⬜ |
| Kırp (parçaya dokunarak) | ✅ |
| Uzat | ⬜ |
| Varlıkları ötele (offset) | ⬜ |
| Varlıkları dönüştür (kenarı eskize al) | ⬜ |
| Kesişim eğrisi | ⬜ |
| Varlıkları aynala | ⬜ |
| Doğrusal / dairesel eskiz çoğaltma | ⬜ |
| Taşı / kopyala / döndür / ölçekle | ⬜ |
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
| Referans (sürülen) ölçü | ⬜ |
| Tam tanımla (otomatik) | ⬜ |

## 3. Katı özellikler (Part)

| Özellik | Seçenekler | Durum |
|---|---|---|
| Ekstrüzyon (Boss/Base) | Kör, Orta düzlem, Tümünden geçen, Yön 2, Ters çevir | ✅ |
| Ekstrüzyon kesme | Kör, Tümünden geçen, Orta düzlem, Yön 2 | ✅ |
| Ekstrüzyon: Sonrakine kadar, Yüzeye kadar, Ötele | | ⬜ |
| Ekstrüzyon: Koniklik (draft), İnce özellik | | ⬜ |
| Döndürme (Revolve) / Döndürerek kesme | Açı, Orta düzlem, Ters | ✅ |
| Süpürme (Sweep) / Süpürerek kesme | | ⬜ |
| Loft / Loft kesme | | ⬜ |
| Radyüs (Fillet) | Sabit yarıçap, kenar seçimi | ✅ |
| Radyüs: değişken, yüz, tam yuvarlak | | ⬜ |
| Pah (Chamfer) | Mesafe | ✅ |
| Pah: mesafe–açı, mesafe–mesafe | | ⬜ |
| Kabuk (Shell) | Kalınlık, kaldırılacak yüzler | ✅ |
| Doğrusal çoğaltma | Yön (X/Y/Z), aralık, adet | ✅ |
| Dairesel çoğaltma | Eksen (X/Y/Z), adet, açı | ✅ |
| Ayna | Ön / Üst / Sağ düzlem | ✅ |
| Ayna: yüze veya referans düzleme göre | | ✅ |
| Delik sihirbazı (havşa, cıvata, kılavuz) | | ⬜ |
| Koniklik (Draft) | | ⬜ |
| Kaburga (Rib) | | ⬜ |
| Kubbe, Sarma, Eğme | | ⬜ |
| Referans düzlem (ötelenmiş) | | ✅ |
| Referans eksen, nokta, koordinat sistemi | | ⬜ |

## 4. Sonraki modüller

| Modül | İçerik | Durum |
|---|---|---|
| Sac metal | Taban flanş, kenar flanş, büküm, K-faktörü, açınım, DXF | ⬜ |
| Kaynaklı yapı / profil | İskelet eskiz, profil kütüphanesi, köşe işlemleri, kesim listesi | ⬜ |
| Montaj | Bileşen ekleme, çakışık/eş merkezli/mesafe eşleşmeleri, patlatma | ⬜ |
| Teknik resim | Görünüşler, kesit, ölçülendirme, antet, PDF | ⬜ |
| Saha özellikleri | Fotoğraf ekleme, Bluetooth kumpas | ⬜ |

## 5. Platform farkları

- **Kalem / fare:** seçim, çizim ve ölçü işlemleri. Tıkla-tıkla ve tıkla-sürükle çizim birlikte desteklenir.
- **Parmak:** tek parmak döndürür (3D) veya kaydırır (eskiz); iki parmak kaydırır ve yakınlaştırır; parmakla dokunmak da seçim yapar.
- **Fare:** orta tuş döndürür, sağ tuş kaydırır, tekerlek yakınlaştırır (SolidWorks'teki gibi).
- **Telefon:** ağaç ve özellik paneli alttan açılan sayfa olarak gelir. **Tablet / bilgisayar:** solda sabit panel.

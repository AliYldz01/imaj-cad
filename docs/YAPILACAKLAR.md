# Yapılacaklar — ana liste (v0.60'tan itibaren)

Kullanıcı isteği (2026-11-13): listedeki tüm işler sırayla uygulanacak. Her grup bitince yayınlanır, burada ✅ işaretlenir.
Yeni sohbette buradan devam et: ilk ⬜ maddeden başla.

## 1. Teknik resim
- ✅ v0.61 1.1 Ölçü ekleme (iki nokta / kenar), silme, değerini düzenleme (metin geçersiz kılma)
- ✅ v0.61 1.2 Ölçü toleransı (±, sınır, ISO uyum H7 vb.)
- ✅ v0.61 1.3 Yüzey pürüzlülüğü sembolü (Ra), geometrik tolerans çerçevesi (GD&T) + referans (datum)
- ✅ v0.61 1.4 Kesit görünüşünü taşıma (sürükle-bırak, kalıcı)
- ✅ v0.61 1.5 Kaynaklı yapı resmi: kesim listesi tablosu + balon + kaynak sembolü
- ✅ v0.61 1.6 Sac açınım resmi / DXF: büküm notları (açı, yön, iç yarıçap), büküm çizgisi katmanları (yukarı / aşağı)

## 2. Eskiz
- ✅ v0.62 2.1 Radyüs / pah sonrası sanal sivri köşe (köşe ölçüsü korunur)
- ✅ v0.62 2.2 Yay / daire ölçüsünde merkez / en yakın / en uzak
- 🟡 v0.62 2.3 İlişkiler: eş yarıçaplı ✅ (zaten vardı), delme ✅; eşit eğrilik ⬜ (spline modeli eğrilik kısıtı desteklemiyor)
- ✅ v0.62 2.4 Ayrı Taşı / Kopyala / Döndür / Ölçekle komutları, Esnet
- ⬜ 2.5 Spline tutamakları, eğrilik tarağı
- ✅ v0.62 2.6 Silüet kenarı dönüştürme, döngü / iç döngü seç
- 🟡 v0.62 2.7 Eskiz çoğaltmada örnek atla ✅; kanal ölçü tipi ⬜; zincir ölçü ⬜ (koordinat ölçüsü mevcut)
- ⬜ 2.8 Metin: yazı tipi, eğri üzerinde metin
- 🟡 v0.62 2.9 SketchXpert ✅; blok düzenleme modu ⬜
- ⬜ 2.10 Eskiz düzlemini değiştir; türetilmiş eskiz; ızgara + açı yakalama ayarları

## 3. Parça özellikleri
- ⬜ 3.1 Değişken radyüs, tam yuvarlak radyüs, yüz radyüsü
- ⬜ 3.2 Pah: öteleme yüzü, yüz–yüz
- ⬜ 3.3 Kabukta yüz başına kalınlık
- ⬜ 3.4 Koniklik: ayırma çizgisi, basamaklı, koniklik analizi
- ⬜ 3.5 Çoğaltma: referansa kadar, eskizi değiştir
- ⬜ 3.6 Katı gövdeyle süpürme
- ⬜ 3.7 Loft: bağlayıcılar, komşu yüze teğet
- ⬜ 3.8 Delik sihirbazı: yuva delik, havşa seçenekleri
- ⬜ 3.9 Referans noktası türleri
- ⬜ 3.10 Ağaçta klasörler
- ⬜ 3.11 "Ne yanlış?" penceresi, geometri kontrolü
- ⬜ 3.12 Radyüs / pah / kabuk sarı önizleme

## 4. Sac metal
- ⬜ 4.1 Flanş profilini serbest eskizle düzenleme
- ⬜ 4.2 Kaynaklı köşe, 3 bükümlü köşe boşaltması, boşaltma türü (yırtma / oval)
- ⬜ 4.3 Çapraz kırma, havalandırma, şekillendirme araçları, sac köşe takviyesi

## 5. Kaynaklı yapı
- ⬜ 5.1 Kesim listesi özellik penceresi
- ⬜ 5.2 Yapı sistemi (birincil / ikincil)
- ⬜ 5.3 3B eskiz: spline, kesişim eğrisi, helis, kompozit eğri
- ⬜ 5.4 Özellikler arası gönye köşe

## 6. Genel / arayüz
- ⬜ 6.1 Çoklu belge sekmeleri, proje / dosya yöneticisi
- ⬜ 6.2 Belge özellikleri (ondalık, standart, özel özellikler)
- ⬜ 6.3 Dışa aktarma: eskiz / yüz DXF, PDF, 3MF
- ⬜ 6.4 Panel pimi
- ⬜ 6.5 Seçim kırıntıları, sağ görev bölmesi, şerit özelleştirme

## 7. Montaj
- ⬜ 7.1 Desen güdümlü bileşen çoğaltma
- ⬜ 7.2 Bileşen bastırma (durumu doğrula)

## 8. Telefon / kalemsiz
- ⬜ 8.1 Model üzerinde derinlik oku
- ⬜ 8.2 Üst üste adaylar arasında dokunarak geçiş
- ⬜ 8.3 Sihirbaz eskizlerinde tam ölçülendirme
- ⬜ 8.4 Fotoğraftan kenar izleme
- ⬜ 8.5 Sesle ölçü girişi

## 9. Saha
- ⬜ 9.1 Modele fotoğraf ekleme
- ⬜ 9.2 Bluetooth kumpas (cihaz modeli gerekir)

## 10. İleri
- ⬜ 10.1 Sonlu eleman analizi

## 11. Bakım
- ⬜ 11.1 `sk1` testini onar
- ⬜ 11.2 Fazla ölçüde "sürücü olarak bırak"
- ⬜ 11.3 Eskimiş plan belgelerini temizle
- ⬜ (kullanıcı) Gerçek kalemle saha testi

Yapılamaz: IGES içe aktarma (OCC derlemesinde okuyucu yok).

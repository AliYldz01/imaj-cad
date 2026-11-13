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
- ✅ v0.64 2.3 İlişkiler: eş yarıçaplı, delme (v0.62), eşit eğrilik (spline ucu ↔ yay; tek seferlik, çözücü kısıtı değil)
- ✅ v0.62 2.4 Ayrı Taşı / Kopyala / Döndür / Ölçekle komutları, Esnet
- ✅ v0.64 2.5 Eğrilik tarağı (v0.63), spline tutamakları (sürükle, açı / ağırlık, sıfırla)
- ✅ v0.62 2.6 Silüet kenarı dönüştürme, döngü / iç döngü seç
- ✅ v0.63 2.7 Eskiz çoğaltmada örnek atla, kanal ölçü tipi (merkez–merkez / toplam), zincir ölçü
- ✅ v0.64 2.8 Metin: yazı tipi (v0.63), eğri üzerinde metin (harf aralığı, yön çevir)
- ✅ v0.64 2.9 SketchXpert (v0.62), blok düzenleme modu (tüm örnekler güncellenir), bloğu dağıt
- ✅ v0.63 2.10 Eskiz düzlemini değiştir; türetilmiş eskiz (kopya); ızgara adımı + açı yakalama ayarları

## 3. Parça özellikleri
- ✅ v0.65 3.1 Değişken radyüs, tam yuvarlak radyüs (önceden), yüz radyüsü (iki yüz grubu)
- ✅ v0.65 3.2 Pah: yüz seçimi (öteleme yüzü), yüz–yüz, köşe pahı (üç mesafe, çok köşe)
- ✅ v0.65 3.3 Kabukta yüz başına kalınlık (düz yüzler, içe kabuk)
- ✅ v0.65 3.4 Koniklik: ayırma çizgisi (yüz başına menteşe → basamaklı da), koniklik analizi (renkli)
- ✅ v0.66 3.5 Çoğaltma: referansa kadar (adet / aralık sabit, öteleme), eskizi değiştir (sabit geometriye bağlı ölçüler uyar)
- ✅ v0.66 3.6 Katı gövdeyle süpürme (silindirik takım: düz / küresel uç, doğru / yay / eğri yol)
- ✅ v0.67 3.7 Loft: bağlayıcılar (profil başına başlangıç köşesi + ters), komşu yüzlere teğet (başlangıç / bitiş)
- ✅ v0.67 3.8 Delik sihirbazı: yuva delik (boy, açı), yakın / uzak taraf havşası
- ✅ v0.68 3.9 Referans noktası türleri (yay merkezi, yüz merkezi, köşe, kesişim, izdüşüm, eğri boyunca mesafe / yüzde / çoklu)
- ✅ v0.68 3.10 Ağaçta klasörler (ekle / çıkar, aç / kapat, adlandır, bastır, kaldır)
- ✅ v0.68 3.11 "Ne yanlış?" penceresi (hatalar + eskiz uyarıları, düzenle / bastır), geometri kontrolü
- ✅ v0.68 3.12 Radyüs / pah / kabuk / koniklik / yüz taşı sarı önizleme

## 4. Sac metal
- ✅ v0.69 4.1 Flanş profilini serbest eskizle düzenleme (yerel x kenar / y flanş; dikdörtgen eskiz oluştur)
- ✅ v0.69 4.2 Kaynaklı köşe (açınımda bastırılır), köşe boşaltma türü (dikdörtgen / dairesel; 2–3 büküm köşesi), büküm boşaltma türü (dikdörtgen / oval / yırtma)
- ✅ v0.70 4.3 Çapraz kırma (kozmetik), havalandırma (sınır + kaburga / kiriş), şekillendirme araçları (yuvarlak / dikdörtgen kabartma, panjur; açınımda bastırılır), sac köşe takviyesi

## 5. Kaynaklı yapı
- ✅ v0.71 5.1 Kesim listesi özellik penceresi (tanım, kalem malzemesi, özel özellikler; tablo + CSV + imalat resmi)
- ✅ v0.71 5.2 Yapı sistemi: birincil (eskiz segmenti / nokta-uzunluk), ikincil (iki birincil arası % konumda)
- ✅ v0.71 5.3 3B eskiz: spline aracı, helis, kesişim eğrisi (iki yüz), birleşik eğri (3B eskiz süpürme yolu)
- ✅ v0.71 5.4 Özellikler arası gönye köşe (önceki yapı elemanıyla açıortayda)

## 6. Genel / arayüz
- ✅ v0.72 6.1 Çoklu belge sekmeleri (geri al yığını sekme başına), dosya yöneticisi (açık / son belgeler, proje klasörü)
- ✅ v0.72 6.2 Belge özellikleri (ölçü ondalığı, ISO / ANSI üçüncü açı resim, yazar, özel özellikler antette)
- ✅ v0.72 6.3 Dışa aktarma: eskiz DXF, düz yüz DXF, görünüm PDF, 3MF
- ✅ v0.72 6.4 Panel iğnesi (✓ sonrası komut açık kalır)
- ✅ v0.72 6.5 Seçim kırıntıları (belge › gövde › özellik › yüz/kenar), sağ görev bölmesi (kütüphane / dosyalar), şerit özelleştirme

## 7. Montaj
- ✅ v0.73 7.1 Desen güdümlü bileşen çoğaltma (doğrusal / dairesel parça çoğaltmasını izler, adet / konum değişince güncellenir, sil / dağıt)
- ✅ v0.73 7.2 Bileşen bastırma (çizim, çözücü, malzeme listesi, girişim, kütle, STEP dışı; desen örnekleri tohumu izler)

## 8. Telefon / kalemsiz
- ✅ v0.74 8.1 Model üzerinde derinlik oku (ekstrüzyon panelinde de, 1 mm adım, Shift 0,1)
- ✅ v0.74 8.2 Üst üste adaylar arasında dokunarak geçiş (aday çubuğu)
- ✅ v0.74 8.3 Sihirbaz eskizlerinde tam ölçülendirme
- ✅ v0.74 8.4 Fotoğraftan kenar izleme
- ✅ v0.74 8.5 Sesle ölçü girişi

## 9. Saha
- ✅ v0.75 9.1 Modele fotoğraf ekleme (modele dokunarak bağla, not, galeri, işaretler)
- ✅ v0.75 9.2 Kumpas: Bluetooth (Sylvac / Nordic UART / HM-10 köprü, metin ya da µm) + klavye (HID) kumpası; gerçek cihazla deneme kullanıcıda

## 10. İleri
- ✅ v0.76 10.1 Sonlu eleman analizi (doğrusal statik, voksel ağ, sabitleme / kuvvet / basınç / öz ağırlık, von Mises + yer değiştirme renkleri, abartılı şekil)

## 11. Bakım
- ✅ v0.77 11.1 `sk1` testini onar (sk2–sk5, t3–t10, m2 de varsayılan adresle çalışır; eskimiş `e2e.py` kaldırıldı)
- ✅ v0.77 11.2 Fazla ölçüde "sürücü olarak bırak" (Sürülen yap / Sürücü olarak bırak / Vazgeç penceresi)
- ✅ v0.77 11.3 Eskimiş plan belgelerini temizle (tamamlanan raporlar `docs/arsiv/`, başvuru listesi durumları güncel)
- ⬜ (kullanıcı) Gerçek kalemle saha testi

## 12. SolidWorks başvuru listesinde kalanlar (`docs/SOLIDWORKS_OZELLIKLERI.md` ⬜)
- ✅ v0.78 12.1 Eskiz ilişkileri: eş yarıçaplı, eşit eğri uzunluğu, eşit kanallar, çift mesafe; ölçüyü sürükleyerek çap ↔ yarıçap
- ⬜ 12.2 İnce özellik: iki yön farklı kalınlık, köşeleri yuvarla, uçları kapat; sacda normal kesim; ekstrüzyonda sağ tıkla bitiş koşulu
- ⬜ 12.3 Loft kapalı / ince; radyüs değişken / tam yuvarlak / setback / konik; pah öteleme yüzü; delik serisi; teğet düzlem
- ⬜ 12.4 Sac tırnak ve yuva; plastik kenarlık / kilit

Yapılamaz: IGES içe aktarma (OCC derlemesinde okuyucu yok).

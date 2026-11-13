# Montaj modülü denetimi — v0.56 (2026-11-13)

Yöntem: masaüstü (1400×900) ve telefon (390×844, dokunma) boyutunda gerçek tıklama / dokunma ile Playwright betikleri (`/tmp/aud/a1–a5, m1–m2`), mevcut testler `as1`–`as7` ve çözücü matris testi.

## Sonuç özeti
- Çalışanlar: `as1`–`as7` hatasız, çözücü matrisi 0 başarısız; Bileşen Ekle penceresi, fareyle sürükleme, eşleşme seçimi / önizleme / ✓, MateXpert, Kütle, Malzeme Listesi, Delik Hizalama, Patlatma ve Hareket Etüdü panelleri; parçaya dönüp gelince ve sayfa yenilenince montaj korunuyor.
- Kök neden (çoğu arayüz hatası): montaj açıkken uygulama modu `part` kalıyor. ✕, Esc, Geri al, sağ tık, uzun basma ve ekran çubuğu bu moda göre davranıyor; montaj panellerini ve montajı tanımıyor.

## A. Kritik
| # | Sorun | Kanıt / neden |
|---|---|---|
| A1 ✅ v0.57 | Montaj panelleri ✕, Esc ya da komut düğmesine yeniden basınca **kapanmıyor**: Eşleşme, Bileşen Aynala, Montaj Kesme/Delik, Patlatılmış Görünüm, Bağlantı Elemanı, Hareket Etüdü, Montaj Kesiti (Taşı / Döndür / Çoğalt da aynı yolu kullanıyor). Eşleşme'de seçim bitmeden ✓ de kapatmıyor → kullanıcı sıkışıyor. | `#pm-cancel` → `guardedCancel` yalnız `mode.k === "pm"/"sketch"` iken çalışır (v0.35); montajda `mode.k === "part"`. Esc → `escAction` aynı. |
| A2 ✅ v0.57 | Telefonda panelin ✕ düğmesi sağdaki yuvarlak ☰ düğmesinin altında kalıyor, dokunulamıyor. | `elementFromPoint` ✕ yerine ☰ döndürüyor. |
| A3 ✅ v0.57 | Montajda Geri al (Ctrl+Z, ↶) montajı değil **arkadaki parça belgesini** geri alıyor; testte parça 2 özellikten 0'a indi, ekranda görünmeden. Montajın kendi geri al / ileri al'ı yok. | `undo()` `mode.k === "part"` olduğu için parça yığınını kullanıyor. |

## B. Önemli
| # | Sorun |
|---|---|
| B1 ✅ v0.57 | Delete tuşu seçili bileşeni / eşleşmeyi silmiyor (yalnız ağaç panelindeki Sil). |
| B2 ✅ v0.57 | Grafik alanda sağ tık ve telefonda uzun basma **parça menüsünü** açıyor (Ekstrüzyon, Ekstrüzyon kesme…). Bileşen menüsü (Gizle, Sabitle, Taşı, Parçayı düzenle, Sil…) yalnız ağaçta. |
| B3 ✅ v0.58 | Telefonda bileşen parmakla sürüklenemiyor; parmak görünümü döndürüyor. Taşıma yalnız Taşı paneliyle. |
| B4 ✅ v0.57 | Telefon ekran çubuğu montajda parça düğmelerini gösteriyor: seçim filtresi, ✚ şekil sihirbazı, ↶ ↷ (A3'teki parça geri alma). |
| B5 ✅ v0.57 | Bileşeni Taşı / Döndür / Bileşen Çoğalt seçim yoksa panel açmıyor, yalnız uyarı veriyor (SolidWorks paneli açıp seçim bekler). |
| B6 ✅ v0.57 | Eşleşme ✓ sonrası panel kapanıyor; SolidWorks'te açık kalır ve sıradaki eşleşmeye geçilir. |
| B7 ✅ v0.58 | Girişim sonucu yalnız birkaç saniyelik bildirim; liste, girişim hacmi vurgusu, "çakışanları göster" yok. |
| B8 ✅ v0.58 | Masaüstünde eşleşme sırasında açılan ağaç paneli her bileşenin düzlemlerini listeleyip grafik alanın büyük kısmını kapatıyor. |
| B9 ✅ v0.58 | Telefonda ipucu balonu ve yarım ekran eşleşme paneli modeli kapatıyor; seçim yapılacak yüzler görünmüyor. |
| B10 ✅ v0.58 | Silindirin kenarına yakın dokunuşta yüz yerine köşe (dikiş noktası) seçilebiliyor ("Pim · Köşe"). |
| B11 ✅ v0.58 | Kütle özellikleri parça malzemesini değil sabit çeliği kullanıyor. |
| B12 ✅ v0.57 | Esc montajda montaj seçimini değil parça seçimini temizliyor. |

## C. SolidWorks'e göre eksik (bilinen)
- Bileşen yapılandırmaları, yol / kam / yuva eşleşmeleri, fiziksel dinamik ve animasyon kaydı (`docs/MONTAJ_RAPORU.md` ⬜).
- Montaj geri al / ileri al (A3), bileşen bağlam menüsü (B2), Girişim paneli (B7).

## Önerilen düzeltme sırası
1. Montaj modunu tanıt (`asmUI.on` iken ✕ / Esc / ↶ / ↷ / Delete / sağ tık / uzun basma / ekran çubuğu montaja yönlensin) → A1, A3, B1, B2, B4, B12.
2. Montaj geri al / ileri al yığını (bileşen konumu, eşleşme, ekle / sil).
3. Telefon: ✕ düğmesinin örtülmesi (A2), parmakla bileşen sürükleme (B3), panel / ipucu yerleşimi (B9).
4. Panelleri seçimsiz açma (B5), eşleşme panelinin açık kalması (B6), Girişim paneli (B7), ağaç paneli (B8), köşe seçimi (B10), malzeme (B11).
5. Yeni test: `as8` (tüm montaj panelleri ✕ / Esc / tekrar basma ile kapanır, Ctrl+Z montajı geri alır ve parçayı değiştirmez, Delete, sağ tık menüsü, telefon ✕).

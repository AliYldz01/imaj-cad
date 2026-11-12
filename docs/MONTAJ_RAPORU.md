# Montaj — SolidWorks eşleştirme listesi ve durum

SolidWorks montaj mantığı: bileşenler 6 serbestlikle başlar (ilk bileşen sabit), eşleşmeler serbestliği kaldırır, tüm eşleşmeler
**birlikte** çözülür; az tanımlı bileşen sürüklenince yalnız kalan serbestlik yönünde hareket eder; çelişen eşleşme reddedilir.
İmaj CAD v0.32'de bu mantık `src/asm/solver.ts` (eşzamanlı Levenberg–Marquardt, Jacobian sıfır uzayından serbestlik) ile kuruldu.

| Grup | Özellik | Durum |
|---|---|---|
| Bileşen | Bileşen ekle (geçerli parça / kütüphane / .icad), ilk bileşen sabit, sabitle / serbest bırak | ✅ |
| Bileşen | Gizle / göster, saydam | ✅ |
| Bileşen | Bileşeni taşı: serbest sürükle (eşleşmelere uyarak), Delta XYZ, XYZ konumuna | ✅ |
| Bileşen | Bileşeni döndür: serbest sürükle (eşleşmelere uyarak), Delta XYZ (açı) | ✅ |
| Bileşen | Çarpışma algılama (sürüklerken dur) | ✅ (sınır kutusu) |
| Bileşen | Doğrusal / dairesel bileşen çoğaltma | ✅ |
| Bileşen | Bileşenleri aynala: kopya / ters el (aynalı parça) | ✅ |
| Bileşen | Alt montaj, bileşen değiştir (replace), eşleşmelerle kopyala, yapılandırmalar | ⬜ |
| Bileşen | Bağlam içinde parça düzenleme (in-context), montaj özellikleri (montaj kesmesi / deliği) | ⬜ |
| Bileşen | Akıllı bağlantı elemanları (Toolbox cıvata/somun) | ⬜ |
| Seçim | Düz yüz, silindir, doğrusal kenar, dairesel kenar, köşe | ✅ |
| Seçim | Bileşen ana düzlemleri / orijin, eksen / referans geometri | ⬜ |
| Standart | Çakışık, paralel, dik, teğet, eş merkezli, kilit, mesafe, açı; hizalı / ters hizalı; ölçüyü ters çevir | ✅ |
| Gelişmiş | Simetrik, genişlik, limit mesafe, limit açı, doğrusal bağlayıcı | ✅ |
| Gelişmiş | Yol eşleşmesi, profil merkezi | ⬜ |
| Mekanik | Menteşe, dişli, kremayer–pinyon, vida | ✅ |
| Mekanik | Kam, yuva (slot), üniversal mafsal | ⬜ |
| Eşleşme yönetimi | Eşleşme paneli (seçim kutuları, Standart/Gelişmiş/Mekanik), canlı önizleme | ✅ |
| Eşleşme yönetimi | Düzenle (çift tık), bastır / etkinleştir, hizalamayı çevir, sil; hatalı eşleşme ⚠ | ✅ |
| Eşleşme yönetimi | Aşırı tanım / çelişki reddi, (f)/(-) serbestlik göstergesi | ✅ |
| Eşleşme yönetimi | Ctrl ile iki varlık → eşleşme açılır çubuğu; SmartMates (Alt + sürükle) | ✅ |
| Eşleşme yönetimi | MateXpert (hata analizi), eşleşme klasörleri | ⬜ |
| Patlatma | Patlatma adımları (bileşen + yön + mesafe), otomatik adımlar, patlat / daralt animasyonu, patlatma çizgileri | ✅ |
| Değerlendirme | Girişim tespiti (gerçek geometri), kütle özellikleri, malzeme listesi (CSV), STEP montaj | ✅ |
| Değerlendirme | Boşluk doğrulama, delik hizalama, montaj kesit görünümü | ⬜ |
| Hareket | Hareket etüdü / animasyon (motor), fiziksel dinamik | ⬜ |

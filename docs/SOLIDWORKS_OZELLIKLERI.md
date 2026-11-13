# SolidWorks'ün özellikleri — İmaj CAD için başvuru listesi

Amaç: SolidWorks'ün uygulamamızda olması gereken özelliklerini **seçenek seviyesine kadar** listelemek ve her birinin İmaj CAD'deki durumunu işaretlemek.
Kaynak: SolidWorks resmî yardım sitesi (help.solidworks.com, 2012–2025 sürümleri) ve uzman blogları — en altta kaynak listesi. Metin kendi sözlerimizle özetlenmiştir.

Durum: ✅ var · 🟡 kısmi · ⬜ yok. Fark raporu numarası (E/F/S/W/G) varsa yanında verilir → `docs/arsiv/SOLIDWORKS_FARK_RAPORU.md`.

---

## 1. Eskiz (2B)

### 1.1 Çizim araçları
| Araç | SolidWorks seçenekleri | Durum |
|---|---|---|
| Çizgi / Merkez çizgisi / Orta nokta çizgisi | Yönlendirme: olduğu gibi, yatay, dikey, açılı; sonsuz uzunluk; yapı geometrisi; zincir; A ile teğet yaya geçiş | ✅ |
| Dikdörtgen | Köşe, merkez, 3 nokta köşe, 3 nokta merkez, paralelkenar; merkezden yapı çizgileri | ✅ |
| Kanal (slot) | Düz, merkez noktalı düz, 3 nokta yay, merkez noktalı yay; ölçü tipi: merkezden merkeze / toplam boy | 🟡 (ölçü tipi seçimi yok) |
| Çokgen | Kenar sayısı, iç/dış teğet daire | ✅ |
| Daire | Merkez + yarıçap, çevre (3 nokta) | ✅ |
| Yay | Merkez, teğet, 3 nokta | ✅ |
| Elips, kısmi elips, parabol, konik | — | ✅ |
| Spline | Stil (B-spline / tanımlı), teğet ve eğrilik tutamakları, eğrilik tarağı, kontrol çokgeni, basitleştir, uydur | 🟡 E9 |
| Denklem eğrisi | Açık / parametrik | ✅ |
| Nokta, metin | Metin: yazı tipi, eğri üzerinde, yükseklik, aralık | 🟡 E11 |
| Varlıkları dönüştür | Kenar / yüz / döngü / silüet; "iç döngüleri seç" | 🟡 E10 (silüet yok) |
| Kesişim eğrisi | Yüzey–düzlem | ✅ |
| Öteleme (offset) | Çift yön, uçları kapat (yay/çizgi), yapı geometrisi yap (taban/öteleme), zincir seç | 🟡 |
| Yüzeye öteleme, eskiz resmi, blok | — | 🟡 E12 |

### 1.2 Düzenleme araçları
| Araç | Seçenekler | Durum |
|---|---|---|
| Kırp | Güç kırpma (sürükleyerek), köşe, içte kırp, dışta kırp, en yakına kırp | 🟡 (güç kırpma yok) |
| Uzat, Ayır (split), Kademe | — | ✅ |
| Eskiz radyüsü / pahı | Sanal sivri köşeyi koru, ölçülü köşeleri koru, eşit ölçüler | 🟡 E4 |
| Aynala, dinamik ayna | Kopya / kopyasız | ✅ |
| Doğrusal / dairesel eskiz çoğaltma | Örnek atla, aralık ölçüsünü göster, eşit aralık | 🟡 |
| Taşı / Kopyala / Döndür / Ölçekle / **Esnet** | Ayrı komutlar, nokta→nokta, X/Y değeri | 🟡 E8 (esnet yok, ayrı komut değil) |
| Yapı geometrisi aç/kapat | — | ✅ |

### 1.3 İlişkiler (SolidWorks'teki tam liste)
| İlişki | Seçilen | Durum |
|---|---|---|
| Yatay / Dikey (çizgi veya iki nokta) | çizgi, noktalar | 🟡 (iki nokta arası yatay/dikey E6) |
| Doğrusal (collinear), Paralel, Dik | çizgiler | ✅ |
| Eşit (uzunluk / yarıçap) | çizgiler, yaylar | ✅ |
| **Eş yarıçaplı (coradial)** — aynı merkez ve yarıçap | yaylar | ✅ v0.14 |
| Eş merkezli, Teğet, Çakışık, Orta nokta, Kesişim, Simetrik | — | ✅ |
| Sabit (fix), Sabit kanal | — | 🟡 (sabit kanal yok) |
| **Birleştir (merge points)** — iki nokta tek noktaya | noktalar | ✅ v0.14 |
| **Delme (pierce)** — nokta, eğrinin eskiz düzlemini deldiği yerde (süpürme kılavuzu için) | nokta + eğri | ✅ v0.62 |
| **Eşit eğri uzunluğu** | iki eğri | ✅ v0.78 |
| **Eşit eğrilik**, düzgünlük (G2/G3) | spline | 🟡 G2 v0.64 |
| Eşit kanallar, Kenar üzerinde (dönüştürmeden), Çift mesafe | — | ✅ v0.78 (kenar üzerinde v0.12.1) |
| 3B'de: X/Y/Z boyunca, düzleme paralel (ParallelYZ/ZX), normal | 3B eskiz | 🟡 W4 |

### 1.4 Ölçülendirme
| Özellik | Durum |
|---|---|
| Akıllı ölçü (uzunluk, nokta-nokta, nokta-çizgi, açı, çap/yarıçap, yay uzunluğu) | ✅ |
| Yatay / dikey / koordinat (ordinate) ölçü, zincir ölçü | 🟡 (zincir yok) |
| Yay koşulu: merkez / min / maks (Shift ile) | ✅ v0.62 |
| Ölçünün ok tarafına sürükleyerek çap ↔ yarıçap | ✅ v0.78 (D tuşu / panel düğmesi) |
| Sürülen (referans) ölçü, aşırı tanım uyarısı | ✅ |
| Değiştir kutusu: ✓ ✗ **⟳ yeniden oluştur**, ± ters, tekerlek artımı, denklem girişi (=), "Çizimler için işaretle" | 🟡 E3 |
| Tam tanımla (otomatik ölçü + ilişki, taban noktası seçimi) | ✅ |
| SketchXpert (aşırı tanım çözüm önerileri), İlişkileri göster/sil | 🟡 E13 |

### 1.5 Çıkarım ve imleç
| Özellik | Durum |
|---|---|
| Uç / orta / merkez / çeyrek / kesişim / üzerinde yakalama, imleç simgeleri | ✅ |
| Uyandırma ve mavi/sarı hizalama çizgileri | ✅ |
| Ctrl ile çıkarımı kapatma | ✅ |
| **Hızlı yakalama (Quick Snaps) filtresi** (yalnız uç, yalnız orta, ızgaraya, açıya…) | ✅ v0.14 |
| Izgara, ızgaraya yakalama, açı yakalama (15° adım) | 🟡 |

### 1.6 Eskiz durumu
Renkler (mavi tanımsız / siyah tam / kırmızı aşırı) ✅ · açık uç gösterimi ✅ · **seçili konturlar** ✅ (v0.13) · **paylaşılan eskiz** ✅ (v0.13) · eskiz düzlemini değiştir 🟡 · türetilmiş eskiz ✅ v0.63.

---

## 2. Katı özellikler

### 2.1 Ekstrüzyon (çıkıntı / kesme / yüzey)
- **Başlangıç (From):** eskiz düzlemi · yüzey/yüz/düzlem · köşe · öteleme. İmaj: ✅ (v0.13; düzlemsel olmayan yüz hariç)
- **Bitiş koşulları:** kör, tümünü geç, tümünü geç–iki yön, sonrakine kadar, **köşeye kadar**, yüzeye kadar, yüzeyden ötele (yüzeyi taşı seçeneği), **gövdeye kadar**, orta düzlem. İmaj: hepsi ✅ (v0.13)
- **Ekstrüzyon yönü** (kenar seçerek eğik ekstrüzyon) ✅ (v0.13)
- **Koniklik** aç/kapat, dışa doğru ✅
- **Yön 2** (ayrı bitiş koşulu) ✅
- **İnce özellik:** tek yön / orta / ters ✅ · iki yön farklı kalınlık, köşeleri otomatik yuvarla, uçları kapat ✅ v0.79
- **Seçili konturlar** ✅ (v0.13) · **Özellik kapsamı** (çok gövdede hangi gövdeler etkilenir) 🟡
- Kesme: **kesme tarafını çevir** ✅ (v0.13), sacda **normal kesim** ✅ v0.79
- Çıkıntı: **sonucu birleştir** aç/kapat ✅
- Bitiş koşulunu modelde sağ tıkla değiştirme, sürükleme tutamağı (Instant3D) ✅ v0.14 / v0.74 (sağ tıkla bitiş koşulu ✅ v0.79)

### 2.2 Döndürme
Eksen, açı, iki yön, orta düzlem, ince özellik, seçili konturlar. İmaj: ✅ (seçili kontur ✅ v0.13)

### 2.3 Süpürme
- Profil: eskiz profili · **dairesel profil** (yalnız çap ver, boru/çubuk) · **katı profil** (takım gövdesiyle kesme) — İmaj: yalnız eskiz 🟡 F3
- Yol: eskiz, 3B eskiz, kenarlar, eğri; **iki yönlü süpürme**
- **Profil yönelimi:** yolu izle / normali sabit tut; **profil burulması:** yok, en az burulma (3B yol), yolu ve 1. kılavuzu izle, 1. ve 2. kılavuzu izle, **burulma açısı** (derece/radyan/tur), **teğet komşu yüzeyler**, yol hizalama türü
- **Kılavuz eğriler** (sıra değiştirme, kesitleri göster)
- **Başlangıç/bitiş teğetliği**, düzgün yüzleri birleştir, ince özellik
- İmaj durumu: profil + yol ✅, burulma / kılavuz ✅ v0.44, takım gövdesi ✅ v0.66

### 2.4 Loft
Profiller (sıra), **başlangıç/bitiş kısıtı** (yok, yön vektörü, profile normal, komşu yüzlere teğet/eğrilik), kılavuz eğriler (etki türü), merkez çizgisi, **bağlayıcılar** (eşleme), kapalı loft, düzgün yüzleri birleştir, ince özellik. İmaj: profiller + kılavuz + merkez + ruled ✅ · teğetlik ✅ v0.41 / v0.67, bağlayıcı ✅ v0.67, kapalı / ince ✅ v0.80

### 2.5 Radyüs (fillet)
- **Türler:** sabit boyut · **değişken boyut** (kontrol noktaları, düz/yumuşak geçiş) · **yüz radyüsü** (tutma çizgisi, sabit genişlik, yardım noktası) · **tam yuvarlak** (üç yüz takımı)
- Sabit: çoklu yarıçap (kenar başına), **yuvarlak köşeler**, **setback** (köşe noktasından geri çekme)
- **Simetrik / asimetrik**; profil: dairesel, **konik rho / konik yarıçap, eğrilik sürekli**
- Seçenekler: **teğet yayılımı**, yüzlerden seç, kenarı/yüzeyi koru, özellikleri koru, tam önizleme
- FilletXpert (ekle/değiştir/köşe yönetimi)
- İmaj: sabit ✅, asimetrik/r2 🟡, yüz radyüsü 🟡, çoklu yarıçap ✅ v0.14, yüz radyüsü ✅ v0.65; değişken / tam yuvarlak ✅ (kind var / full), konik 🟡 v0.80 (düz kenar, 32 parçalı yaklaşım), setback ⬜ (OCC radyüs motorunda yok)

### 2.6 Pah
Açı–mesafe, mesafe–mesafe (eşit/farklı), köşe (vertex), **öteleme yüzü**, yüz–yüz; teğet yayılımı, özellikleri koru. İmaj: ✅ (yüz–yüz ✅ v0.65, köşe ✅ v0.65, öteleme yüzü ✅ v0.80)

### 2.7 Delik sihirbazı
Türler: havşa başlı (counterbore), havşa (countersink), delik, kılavuz, boru dişi, **eski stil**, **yuva (slot) delik**; standartlar (ISO, DIN, ANSI…), bitiş koşulu, yakın/uzak taraf havşa, **kozmetik diş**, delik serisi (montajda). Konum sekmesi: yüze noktalarla. İmaj: temel türler ✅, yuva delik ✅ v0.67, yakın / uzak havşa ✅ v0.67, delik serisi ✅ v0.38 (montaj deliği birden çok parçada)

### 2.8 Diğer özellikler
| Özellik | Seçenekler | Durum |
|---|---|---|
| Kabuk | Kaldırılan yüzler, kalınlık, **dışa kabuk**, **çoklu kalınlık (yüz başına)** | 🟡 F7 |
| Koniklik | Nötr düzlem, **ayırma çizgisi**, **basamaklı**; DraftXpert | 🟡 F8 |
| Kaburga, Kubbe, Sarma, Ölçekle, Esnet (flex), Girinti, Diş | — | ✅ |
| Birleştir / Böl / Taşı-Kopyala / Sil gövde | — | ✅ |
| **Yüz taşı / yüz sil / yüz değiştir** (doğrudan düzenleme) | — | ✅ v0.45 |
| Kenarlık / delik / vent / kilit (plastik) | — | ✅ v0.81 dudak / yiv, mandal; havalandırma v0.70 |

### 2.9 Çoğaltma ve ayna
- Doğrusal: iki yön, aralık veya **kadar** (up to reference), **örnekleri atla**, **eskizi değiştir (vary sketch)**, özellik / gövde / yüz çoğaltma, geometri çoğaltma, görsel özellikleri yay
- Dairesel: eksen, eşit aralık, toplam açı, iki yön, örnek atla
- Eskiz / tablo / eğri / doldurma / **değişken (variable) çoğaltma**
- Ayna: özellik, yüz, gövde
- İmaj: türler ✅, örnek atla ✅ v0.14, eskizi değiştir / referansa kadar ✅ v0.66

### 2.10 Referans geometri
- **Düzlem:** 3 referanslı sihirbaz — çakışık, paralel, dik, **açılı** (adet), öteleme (adet), **orta düzlem**, **teğet** (silindire), **ekrana paralel**, 3 noktadan, çizgi+nokta, eğriye dik (eğri üzerinde nokta). İmaj: öteleme, açılı, orta, 3 nokta, kenara dik, noktadan paralel, ekrana paralel ✅ (v0.13); teğet ✅ v0.80 (açılı / orta / 3 nokta / ekrana paralel ✅ v0.13)
- Eksen: çizgi/kenar, iki düzlem, iki nokta, silindir yüzü, nokta+yüz. İmaj 🟡
- Nokta (yay merkezi, yüz merkezi, kesişim, projeksiyon, eğri boyunca), Koordinat sistemi, Kütle merkezi. İmaj 🟡

### 2.11 Yüzey modelleme (✅ v0.46–v0.53: ekstrüzyon, düzlemsel, loft, sınır doldur, kalınlaştır, yüzeyle kes, kırp, dik)
Ekstrüzyon/döndürme/süpürme/loft yüzeyi, sınır yüzeyi, dolgu, düzlemsel yüzey, öteleme yüzeyi, **dikiş (knit)**, **kalınlaştır**, yüzeyle kes, kırp/uzat yüzey, yüzeyi sil/değiştir, cetvel yüzeyi.

### 2.12 Parça seviyesinde diğer
Malzeme ✅ · kütle özellikleri ✅ · ölçüm ✅ · kesit görünüşü ✅ · girişim (gövdeler) ✅ · **konfigürasyonlar / tasarım tablosu** ✅ v0.41 · denklemler ve global değişkenler ✅ · **görünüm (renk/doku)** ✅ v0.43 (renk) · özellik bastır ✅ · sürükleyerek sırala ✅ · ebeveyn/çocuk ✅ · geri alma çubuğu ✅ · klasör ✅ v0.68 · ebeveyn–çocuk ✅ v0.13 · "Ne yanlış?" hata penceresi 🟡 G3.

---

## 3. Sac metal

### 3.1 Sac parametreleri
Kalınlık, büküm yarıçapı, **kalınlık tablosu (gauge table)**, **büküm payı yöntemi**: büküm tablosu, K-faktörü, büküm payı, büküm düşümü, büküm hesabı (tablo); **otomatik boşaltma**: dikdörtgen / yırtma / oval, boşaltma oranı. İmaj: K-faktörü ✅, büküm payı / düşümü / kalınlık tablosu ✅ v0.15, büküm tablosu ✅ v0.45

### 3.2 Sac özellikleri
| Özellik | Önemli seçenekler | Durum |
|---|---|---|
| Taban flanş / sekme | Açık veya kapalı eskiz, sekme (aynı kalınlıkta yüz ekleme) | ✅ |
| **Kenar flanş** | Çoklu kenar, **flanş profilini düzenle** (eskiz; delik eklenebilir, kenardan uzun flanş), açı, boy: kör / köşeye kadar / **kenara kadar ve birleştir**, boy referansı (dış sanal sivri / iç sanal sivri / teğet büküm), konum: malzeme içte / dışta / büküm dışta / sanal sivri köşeden büküm / **büküme teğet**, **yan bükümleri kırp**, öteleme, özel büküm payı, özel boşaltma, **çok uzunluklu flanş** | 🟡 S2 (profil düzenleme, kenara kadar, çok uzunluk yok) |
| Gönye flanş | Profil eskizi, kenar zinciri, boşluk, başlangıç/bitiş ötelemesi | ✅ |
| Kenet (hem) | Kapalı, açık, gözyaşı, haddelenmiş; boy, boşluk, iç yarıçap | ✅ |
| Çizgiden büküm (sketched bend) | Büküm konumu, açı | ✅ |
| Kademe (jog) | — | ✅ |
| **Loft büküm** (geçiş: kare→yuvarlak huni) | Bükülmüş / şekillendirilmiş, yüz sayısı | ✅ v0.15 |
| **Çapraz kırma**, **havalandırma (vent)**, **şekillendirme aletleri** (louver, kabartma, kılavuz) | — | ✅ v0.70 |
| **Tırnak ve yuva** | — | ✅ v0.81 |
| Köşe kapat, **köşe kırma/kesme** (radyüs/pah), **kaynaklı köşe**, köşe boşaltma | — | 🟡 S3 |
| **Aç / Katla (unfold/fold)**, düzleştir, **normal kesim** | — | 🟡 S6 |
| Sac köşe takviyesi (gusset), ayırma (rip), katıdan saca, kalıp sacı | — | 🟡 S8 |
| Düz desen | Büküm çizgileri, sınır kutusu, **büküm notları**, DXF/DWG dışa aktarma seçenekleri (katmanlar, büküm çizgisi yukarı/aşağı) | 🟡 S5 |

---

## 4. Kaynaklı yapılar (weldments)

| Özellik | Önemli seçenekler | Durum |
|---|---|---|
| **Yapı elemanı** | Standart / tip / boyut, profil kütüphanesi (indirilebilir), **gruplar** (paralel veya bitişik segmentler), **köşe işlemi**: uç gönye, uç alın 1, uç alın 2; **gönye kırpılmış gövdeleri birleştir**, **kaynak boşlukları**, **ayna profil** (yatay/dikey eksen), **döndürme açısı**, **profili konumlandır (delme noktası)**, **yay segmentlerini birleştir**, malzemeyi profilden aktar | 🟡 W1/W2 |
| **Köşe işlemini köşe başına değiştirme** (köşeye tıkla → grup, işlem, kırpma sırası, köşeye özel boşluk) | — | ✅ v0.47 |
| Yapı sistemi (2018+): birincil/ikincil eleman, köşe yönetimi (otomatik/manuel, benzer köşeleri grupla) | — | ✅ v0.71 |
| Kırp/uzat | Uç kırpma, gövde ile / düzlemle kırp, **kırpma sınırı**, kaynak boşluğu | ✅ |
| Uç kapağı | Kalınlık, ofset, iç/dış, köşe pahı | ✅ |
| Köşe takviyesi | Üçgen / çokgen profil, kalınlık konumu, pah | ✅ |
| Kaynak dikişi | Boyut, aralıklı, her yerde, teğet yayılımı, kaynak sembolü | 🟡 W6 |
| **Kesim listesi** | Otomatik güncelleme, özellikler (UZUNLUK, AÇI1/2, MİKTAR, TOPLAM UZUNLUK, açıklama, malzeme), **özellik düzenleme**, sınır kutusu | 🟡 W3 |
| Alt kaynaklı yapı, kaynaklı yapı resmi, kesim listesi tablosu, balon | — | ✅ v0.61 |

## 5. 3B eskiz
Çizgi, spline, nokta, **düzlem içinde çizim (Tab ile XY/YZ/ZX)**, 3B ilişkiler (X/Y/Z boyunca, ParallelYZ/ZX, çakışık), 3B akıllı ölçü, dönüştür/kesişim eğrisi, helis/spiral eğrisi, kompozit eğri, noktalardan eğri. İmaj: sayısal giriş + yakalama + köşe yarıçapı ✅, ilişki/ölçü/spline 🟡 W4/W5.

---

## 6. Montaj (sıradaki modül için başvuru)

- **Bileşen:** ekle (dosyadan / açık belgelerden), ilk bileşen sabit, sabitle/serbest bırak, gizle/göster, saydamlık, bastır, çoğalt (doğrusal/dairesel/desen güdümlü/eskiz güdümlü/zincir), ayna bileşen, alt montaj (rijit/esnek).
- **Standart eşleşmeler:** çakışık, paralel, dik, teğet, eş merkezli, mesafe, açı, kilit; **hizalı / ters hizalı** seçimi; açı için referans varlık.
- **Gelişmiş eşleşmeler:** **limit** (mesafe/açı aralığı), doğrusal/doğrusal kuplör, yol (path), profil merkezi, simetrik, genişlik.
- **Mekanik eşleşmeler:** kam–izleyici, dişli, menteşe, kremayer–pinyon, vida, kanal (slot), üniversal mafsal.
- **Eşleşme arayüzü:** açılır mini araç çubuğu (seçimden uygun eşleşmeyi öner), Alt ile hizalamayı çevir, çoklu eşleşme, akıllı eşleşme (Alt ile sürükle), eşleşme klasörü, hatalı eşleşme uyarısı.
- **Hareket:** sürükle-döndür, bileşeni taşı/döndür (serbest, delta XYZ, eksen boyunca), **çarpışma algılama**, fiziksel dinamik.
- **Değerlendirme:** girişim tespiti (hacim listesi), açıklık doğrulama, delik hizalama, kütle özellikleri.
- **Patlatılmış görünüm:** adımlar, radyal patlatma, patlatma çizgileri, animasyon.
- **BOM** (malzeme listesi), montaj özellikleri (montaj kesmesi, kaynak dikişi), bağlam içi parça tasarımı (montajda parça düzenleme), **STEP montaj** dışa aktarma.

## 7. Teknik resim (ileride)
Standart 3 görünüş, model görünüşü, izdüşüm, yardımcı, **kesit** (yarım, ofset, hizalı), **detay**, kesik, kırık görünüş; model öğelerini içe aktar, akıllı ölçü, koordinat ölçü, **delik açıklaması**, merkez işareti/çizgisi, **yüzey pürüzlülüğü**, **geometrik tolerans**, kaynak sembolü, not, **antet** (özellik bağlantılı), BOM ve kesim listesi tablosu, balon, **büküm tablosu**, PDF/DXF/DWG.

## 8. Arayüz ve genel
- **CommandManager** (sekmeli komutlar), **S kısayol çubuğu**, **fare hareketleri**, bağlam araç çubukları (seçimde açılan mini menü), FeatureManager ağacı (filtre, klasör, geri alma çubuğu, ebeveyn/çocuk), **PropertyManager** (sabitleme pimi), **Heads-up görünüm çubuğu** (yönelim, görüntü stili: kenarlı gölgeli / gölgeli / gizli çizgi kaldır / gizli çizgi görünür / tel kafes; kesit; görünüm ayarları: perspektif, gölgeler), **görünüm küpü / yönelim penceresi**. İmaj: büyük kısmı ✅ (v0.9–v0.12); görüntü stilleri ✅ v0.14, bağlam mini araç çubuğu ✅ v0.13.
- **Seçim:** kutu / kement / kesişen, **diğerini seç** (arka yüz), seçim filtresi, döngü seç, teğet seç. İmaj 🟡 G2.
- **Belge:** birim sistemi, ondalık, çizim standardı, malzeme/görünüm, özel özellikler (dosya özellikleri), çoklu belge ve pencereler. İmaj ✅ v0.47 (birim) / v0.72 (ondalık, standart, özel özellikler, sekmeler).
- **Dışa/İçe aktarma:** STEP, IGES, Parasolid, STL, 3MF, DXF/DWG, PDF/3D PDF, eDrawings. İmaj: STEP/STL ✅, sac DXF ✅, 3MF / PDF / eskiz ve yüz DXF ✅ v0.72; IGES / Parasolid / DWG yapılamaz (çekirdekte okuyucu-yazıcı yok).

---

## Kaynaklar
- Extrude PropertyManager — help.solidworks.com (2012, 2014, 2017, 2024)
- Sweep / Swept Cut / Surface Sweep PropertyManager — help.solidworks.com (2012–2018), Hawk Ridge Systems "Advanced Sweep Feature Techniques"
- Fillet PropertyManager, Variable Size Fillets, Fillet Overview — help.solidworks.com (2012–2025); dezignstuff.com "SolidWorks Fillets"
- Plane PropertyManager, Creating Planes, Planes Parallel to Screen — help.solidworks.com (2012–2021)
- Description of Sketch Relations, Sketch Relations Icons, Equal Curve Length — help.solidworks.com (2012–2021); GoEngineer "Sketch Relations Guide"
- Edge-Flange PropertyManager, Edge Flanges, Profile Sketches — help.solidworks.com (2012–2025)
- Structural Member PropertyManager, Changing Corner Treatments, Corner Management — help.solidworks.com (2013–2025)
- Types of Mates, Standard/Advanced Mates, Mate PropertyManager — help.solidworks.com (2011–2022); GoEngineer "Introduction to SOLIDWORKS Mates"

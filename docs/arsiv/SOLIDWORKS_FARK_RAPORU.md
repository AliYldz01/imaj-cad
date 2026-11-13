# SolidWorks fark raporu ve düzeltme planı (v0.12.3 — ayrıntılı sürüm)
> **Arşiv (v0.77):** raporun tüm maddeleri tamamlandı; güncel durum `docs/YOL_HARITASI.md` ve `docs/YAPILACAKLAR.md`.

Dayanak: `docs/SOLIDWORKS_OZELLIKLERI.md` (SolidWorks yardım sitesinden seçenek seviyesinde liste) + kod incelemesi.
Önem: **K** kritik (günlük işi engeller) · **Ö** önemli · **İ** iyileştirme. Durum: ⬜ yapılmadı · 🟡 kısmi · ✅ düzeltildi.
Kural: bir madde bitince ✅ işaretle, `SOLIDWORKS_OZELLIKLERI.md`'deki durumu da güncelle.

---

## 1. 2B eskiz (E)

| # | Önem | Eksik / hatalı | Yapılacak (SolidWorks davranışı) | Durum |
|---|---|---|---|---|
| E1 | K | **Seçili konturlar** yok: ekstrüzyon/döndürme tüm kapalı bölgeleri alıyor | PM'de "Seçili konturlar" kutusu; bölgeye/kontura dokunarak seçim; iç içe bölgelerde yalnız seçilen; model kenarları da kontur olabilir | ✅ v0.13 |
| E2 | K | **Paylaşılan eskiz** yok (bir eskiz = bir özellik) | Aynı eskiz birden çok özellikte (farklı konturlarla) kullanılabilsin; ağaçta paylaşım simgesi | ✅ v0.13 |
| E3 | Ö | Değiştir kutusu eksik | **⟳ yeniden oluştur** (kutu açıkken model güncellenir), **± yönü ters çevir**, "çizimler için işaretle", denklem (=) ✅, tekerlek artımı ✅ | ✅ v0.13 |
| E4 | Ö | Eskiz radyüs/pahında köşe ölçüsü kayboluyor | **Sanal sivri köşe** korunur; ölçülü köşeyi koru seçeneği; eşit ölçüler | ✅ v0.62 |
| E5 | Ö | Yay ölçüsünde koşul yok | Daire/yay ölçüsünde **merkez / min / maks** (Shift ile veya ölçü özelliğinden) | 🟡 |
| E6 | Ö | Eksik ilişkiler | E6.1 **eş yarıçaplı (coradial)** · E6.2 **noktaları birleştir (merge)** · E6.3 **delme (pierce)** · E6.4 **eşit eğri uzunluğu** · E6.5 **iki nokta arası yatay/dikey** · E6.6 eşit eğrilik (spline) · E6.7 eşit kanallar · E6.8 sabit kanal | 🟡 v0.14: eş yarıçaplı, birleştir, nokta yatay/dikey; delme/eşit eğri uzunluğu yok |
| E7 | Ö | **Hızlı yakalama filtresi** yok | Sağ tık menüsü + çubuk: yalnız uç / orta / merkez / çeyrek / kesişim / teğet / dik / paralel / yatay-dikey / ızgara / açı (15°) | ✅ v0.14 |
| E8 | Ö | Taşı/Kopyala tek komut, **Esnet** yok | E8.1 ayrı **Taşı**, **Kopyala**, **Döndür**, **Ölçekle** (nokta→nokta veya X/Y) · E8.2 **Varlıkları esnet** | 🟡 |
| E9 | Ö | Spline kontrolü zayıf | Teğet ve eğrilik **tutamakları**, **eğrilik tarağı**, kontrol çokgeni, basitleştir, stil (B-spline / tanımlı) | ✅ v0.63–v0.64 |
| E10 | Ö | Dönüştürmede **silüet** ve **döngü/iç döngü seç** yok | Silindir silüet kenarı; yüz seçince dış döngü, "iç döngüleri seç" | 🟡 |
| E11 | İ | Metin kısıtlı | Yazı tipi/kalınlık seçimi, eğri üzerinde metin, aralık | 🟡 |
| E12 | İ | Bloklar kısıtlı | Blok düzenleme modu, blok içi ilişkiler, blok hareketi | 🟡 |
| E13 | İ | **SketchXpert** yok | Aşırı tanımda çakışan ilişkileri listeleyip "çözüm öner"; İlişkileri göster/sil ✅ | 🟡 |
| E14 | Ö | Kırpmada **güç kırpma** (fareyle üzerinden sürükleyerek) ve köşe/içte/dışta kırp yok | Kırp seçenekleri: güç, köşe, içte, dışta, en yakına ✅ | ✅ v0.14 güç kırpma |
| E15 | Ö | Öteleme seçenekleri | **Çift yön**, **uçları kapat** (yay/çizgi), taban/öteleme yapı geometrisi yap, zincir seç | 🟡 v0.14: çift yön, taban yapı geometrisi; uçları kapat yok |
| E16 | Ö | Eskiz çoğaltmada **örnek atla** ve aralık ölçüsü göster yok | Örneğe tıklayarak atla | 🟡 |
| E17 | Ö | **Kanal ölçü tipi** (merkez-merkez / toplam boy) yok | Kanal PM'inde seçim | ✅ v0.63 |
| E18 | İ | **Zincir ölçü**, ölçüyü sürükleyerek çap↔yarıçap yok | Ekle | ✅ v0.63 |
| E19 | İ | Eskiz düzlemini değiştir, türetilmiş eskiz yok | Ekle | 🟡 |
| E20 | İ | Izgara ayarları, açı yakalama (15°) yok | Eskiz ayarları paneli | 🟡 |

## 2. 3B katı özellikler (F)

| # | Önem | Eksik / hatalı | Yapılacak | Durum |
|---|---|---|---|---|
| F1 | K | **Referans düzlem** yalnız öteleme | 3 referanslı düzlem: F1.1 çakışık · F1.2 paralel (nokta/köşeden) · F1.3 dik (eğriye/kenara noktada) · F1.4 **açılı** (kenar+yüz, adet) · F1.5 öteleme (adet) ✅ · F1.6 **orta düzlem** · F1.7 **teğet** (silindire) · F1.8 **3 noktadan** · F1.9 **ekrana paralel** | 🟡 v0.13: teğet hariç hepsi |
| F2 | K | Ekstrüzyon seçenekleri eksik | F2.1 **Başlangıç**: yüzey/yüz/düzlem, köşe (öteleme ✅) · F2.2 bitiş **köşeye kadar** · F2.3 **gövdeye kadar** · F2.4 yüzeyden ötele: **yüzeyi taşı** · F2.5 **ekstrüzyon yönü** (kenar/eksen) · F2.6 **ince özellik** (tek yön / orta / iki yön farklı kalınlık, köşeleri otomatik yuvarla, **uçları kapat**) — açık eskizde zorunlu · F2.7 **kesme tarafını çevir** · F2.8 özellik kapsamı (çok gövde) · F2.9 tümünü geç–iki yön | ✅ v0.13 (özellik kapsamı hariç) |
| F3 | K | Süpürme yalnız profil+yol | F3.1 **dairesel profil** (yalnız çap) · F3.2 **katı profil** (takım gövdesiyle kesme) · F3.3 **profil yönelimi**: yolu izle / normali sabit tut · F3.4 **burulma**: yok / en az / 1. kılavuz / 1.-2. kılavuz / **açı** (derece-radyan-tur) · F3.5 **kılavuz eğriler** · F3.6 **iki yönlü** · F3.7 başlangıç/bitiş teğetliği · F3.8 ince özellik · F3.9 düzgün yüzleri birleştir | 🟡 v0.14: dairesel profil (iç çaplı boru), yönelim; burulma/kılavuz/iki yön yok |
| F4 | Ö | Loft seçenekleri | F4.1 **başlangıç/bitiş kısıtı** (yok / yön vektörü / profile normal / komşu yüzlere teğet) · F4.2 **bağlayıcılar** · F4.3 **kapalı loft** · F4.4 ince özellik · F4.5 kılavuz etki türü (kılavuz ✅, merkez çizgisi ✅) | 🟡 |
| F5 | Ö | Radyüs türleri | F5.1 **değişken boyut** (kontrol noktaları, düz/yumuşak geçiş) · F5.2 **tam yuvarlak** · F5.3 **yüz radyüsü** (tutma çizgisi, sabit genişlik) · F5.4 **çoklu yarıçap** (kenar başına) · F5.5 **yuvarlak köşeler** · F5.6 **setback** · F5.7 profil: **konik rho**, eğrilik sürekli · F5.8 **teğet yayılımı** aç/kapat · F5.9 özellikleri koru · asimetrik ✅ | 🟡 v0.14: çoklu yarıçap; değişken (2 değer), tam yuvarlak var; setback/konik yok |
| F6 | Ö | Çoğaltma | F6.1 **örnekleri atla** (örneğe dokun) · F6.2 **kadar** (aralık yerine referansa kadar) · F6.3 **eskizi değiştir (vary)** · F6.4 **değişken çoğaltma** · F6.5 gövde / yüz çoğaltma ayrımı · F6.6 geometri çoğaltma | 🟡 v0.14: örnek atla |
| F7 | Ö | Kabuk | F7.1 **dışa kabuk** · F7.2 **yüz başına farklı kalınlık** | 🟡 v0.14: dışa kabuk; yüz başına kalınlık yok |
| F8 | Ö | Koniklik | F8.1 **ayırma çizgisi** · F8.2 **basamaklı** · F8.3 DraftXpert (analiz) | 🟡 |
| F9 | Ö | Ağaç işlemleri | F9.1 **bastır / bastırmayı kaldır** · F9.2 **sürükleyerek sırala** · F9.3 **klasör** · F9.4 **F2 ile ad değiştir** · F9.5 **ebeveyn/çocuk** göster · F9.6 geri alma çubuğunu sürükleme (rollback ✅) | 🟡 v0.13: sürükle/▲▼ sırala, F2, ebeveyn-çocuk; klasör yok |
| F10 | Ö | **Instant3D** yok | Seçili özellikte yeşil ok tutamağı ile derinlik sürükleme, cetvel; sağ tıkla bitiş koşulu değiştirme | ✅ v0.14 |
| F11 | Ö | Görüntü stilleri | **Kenarlı gölgeli, gölgeli, gizli çizgi kaldır, gizli çizgi görünür, tel kafes**, perspektif, gövde gizle/göster, saydamlık | ✅ v0.14 (perspektif yok) |
| F12 | Ö | Doğrudan düzenleme | **Yüz taşı**, **yüz sil** (onar/doldur), **yüz değiştir** — içe aktarılan STEP için | ✅ v0.45 |
| F13 | Ö | Yüzey modelleme | Ekstrüzyon/döndürme/süpürme/loft yüzeyi, düzlemsel yüzey, **dikiş**, **kalınlaştır**, **yüzeyle kes**, öteleme/dolgu/sınır yüzeyi, kırp/uzat | ✅ v0.46–v0.53 |
| F14 | İ | Konfigürasyon / tasarım tablosu | Ölçü varyantları, özellik bastırma varyantları | ✅ v0.41 |
| F15 | İ | Görünüm (renk) | Yüz / özellik / gövde rengi | ✅ v0.43 |
| F16 | İ | Delik sihirbazı | **Yuva (slot) delik**, eski stil delik, yakın/uzak taraf havşa, kozmetik diş görünümü | 🟡 |
| F17 | İ | Hız | Artımlı yeniden oluşturma (değişmeyen özellikleri önbellekten al); diş özelliği hızlandırma | ✅ v0.40 / v0.51 |
| F18 | Ö | Pah eksikleri | **Öteleme yüzü** pahı, **yüz–yüz** pahı, teğet yayılımı | 🟡 |
| F19 | Ö | Referans eksen/nokta | Eksen: iki düzlem, iki nokta, silindir yüzü, nokta+yüz · Nokta: yay merkezi, yüz merkezi, kesişim, projeksiyon, eğri boyunca adetli | 🟡 |
| F20 | İ | Değerlendirme | "Ne yanlış?" hata penceresi, ebeveyn/çocuk, geometri kontrolü | 🟡 |

## 3. Sac metal (S)

| # | Önem | Eksik / hatalı | Yapılacak | Durum |
|---|---|---|---|---|
| S1 | K | Büküm hesabı yalnız K-faktörü | S1.1 **büküm payı** · S1.2 **büküm düşümü** · S1.3 **büküm tablosu** (kalınlık×yarıçap×açı) · S1.4 **kalınlık tablosu (gauge)** · S1.5 özellik başına özel büküm payı | 🟡 v0.15: K / büküm payı / büküm düşümü (90°), kalınlık tablosu; açıya göre tablo yok |
| S2 | Ö | Kenar flanş eksikleri | S2.1 **flanş profilini düzenle** (eskiz: delik, kenardan uzun flanş) · S2.2 boy: **kenara kadar ve birleştir**, köşeye kadar (dik/paralel) · S2.3 **büküme teğet** konumu · S2.4 **yan bükümleri kırp** · S2.5 **çok uzunluklu flanş** · S2.6 özel boşaltma türü | 🟡 |
| S3 | Ö | Köşe işlemleri | S3.1 **köşe kırma/kesme** (radyüs/pah) · S3.2 **kaynaklı köşe** · S3.3 köşe boşaltma (2/3 büküm) | 🟡 v0.15: köşe kır (R/pah) komutları; kaynaklı köşe yok |
| S4 | Ö | Eksik sac özellikleri | S4.1 **loft büküm** (kare→yuvarlak geçiş, huni) · S4.2 **çapraz kırma** · S4.3 **havalandırma** · S4.4 **şekillendirme aletleri** (louver, kabartma, kılavuz) · S4.5 **tırnak–yuva** | 🟡 v0.15: loft büküm (geçiş/huni) + üçgenlemeli açınım DXF; diğerleri yok |
| S5 | Ö | Düz desen çıktısı | Büküm çizgileri ayrı katman (yukarı/aşağı), **büküm notları** (açı, yön, iç yarıçap), sınır kutusu, DXF seçenekleri | 🟡 |
| S6 | Ö | **Aç / Katla** ara özellikleri | Bükümü aç → kes → tekrar katla; sacda **normal kesim** | ✅ v0.50 |
| S7 | İ | Otomatik boşaltma | Dikdörtgen / yırtma / oval, boşaltma oranı | 🟡 |
| S8 | İ | Sac köşe takviyesi (gusset) | Ekle | ✅ v0.70 |

## 4. Kaynaklı yapı ve 3B eskiz (W)

| # | Önem | Eksik / hatalı | Yapılacak | Durum |
|---|---|---|---|---|
| W1 | Ö | Köşe işlemi tek tip | W1.1 **gruplar** (paralel/bitişik segment) · W1.2 **köşeye tıklayıp köşe başına işlem**: uç gönye / uç alın 1 / uç alın 2, **kırpma sırası**, köşeye özel **kaynak boşluğu** · W1.3 **gönye kırpılmış gövdeleri birleştir** · W1.4 **yay segmentlerini birleştir** | 🟡 v0.20 gruplar + otomatik T / gruplar arası / 3+ elemanlı köşe çözümü; köşeye tıklayıp köşe başına işlem yok |
| W2 | Ö | Delme noktası kısıtlı | **Profili konumlandır**: profil eskizinde herhangi bir noktayı delme noktası seç | ✅ v0.15 delme noktası X/Y öteleme |
| W3 | Ö | Kesim listesi özellikleri | Özellik penceresi (açıklama, malzeme, UZUNLUK, AÇI1/2, MİKTAR, TOPLAM UZUNLUK, özel alan), malzemeyi profilden aktar | 🟡 |
| W4 | Ö | 3B eskiz ilişki/ölçü | **X/Y/Z boyunca**, ParallelYZ/ZX, çakışık, **3B akıllı ölçü**, **Tab ile düzlem değiştirerek çizim** | ✅ v0.21 X/Y/Z boyunca, ParallelYZ/ZX/XY, paralel, dik, eşit, çakışık, orta nokta, üzerinde, 3B akıllı ölçü (boy/mesafe/açı), 3B çözücü, Tab ile düzlem (bkz. `docs/arsiv/3B_ESKIZ_RAPORU.md`) |
| W5 | İ | 3B eskiz araçları | 3B spline, kenar dönüştürme, kesişim eğrisi, helis/spiral, kompozit eğri | ✅ v0.71 |
| W6 | İ | Kaynak dikişi | Kaynak sembolü, teğet yayılımı, resimde gösterim | 🟡 |
| W7 | İ | Yapı sistemi | Birincil/ikincil eleman, köşe yönetimi (otomatik/manuel) | ✅ v0.71 |
| W8 | İ | Alt kaynaklı yapı, kesim listesi tablosu, balon | Teknik resim modülüyle | ✅ v0.61 |

## 5. Genel arayüz ve dosya (G)

| # | Önem | Eksik / hatalı | Yapılacak | Durum |
|---|---|---|---|---|
| G1 | K | **Tek belge** | Çoklu belge (parça/montaj sekmeleri), proje / dosya yöneticisi, parça kütüphanesi — montaj için şart | 🟡 v0.16: parça kütüphanesi + montaj belgesi |
| G2 | Ö | 3B seçim | Parça modunda **kutu/kesişen seçim**, **diğerini seç** (arka yüz), **döngü seç**, **teğet seç** | 🟡 v0.13: kutu seçim, diğerini seç; döngü/teğet seç yok |
| G3 | Ö | Hata açıklaması | "Ne yanlış?" penceresi, düzeltme önerisi | 🟡 |
| G4 | Ö | **Belge özellikleri** | Birim (mm/inç), ondalık, standart, özel dosya özellikleri | ✅ v0.72 |
| G5 | İ | Dışa aktarma | Eskiz/yüz **DXF**, **PDF**, IGES, 3MF | 🟡 |
| G6 | İ | Önizleme | Radyüs, pah, kabuk vb. için sarı önizleme | 🟡 |
| G7 | Ö | **Bağlam mini araç çubuğu** | Seçince imleç yanında uygun komutlar (eskiz, ekstrüzyon, normal görünüm, ilişki) | ✅ v0.13 |
| G8 | İ | PropertyManager **pimi** | Aynı komutu tekrar tekrar kullanmak için PM'i açık tut | ✅ v0.72 |

## 6. Montaj (M) — sıradaki modülün kapsamı

| # | Önem | Yapılacak | Durum |
|---|---|---|---|
| M1 | K | Bileşen ekle (dosya / açık belge), ilk bileşen sabit, sabitle/serbest, gizle/göster, saydam, bastır | 🟡 v0.16 (bastır yok) |
| M2 | K | **Standart eşleşmeler**: çakışık, paralel, dik, teğet, eş merkezli, mesafe, açı, kilit; **hizalı / ters hizalı** | ✅ v0.17 (teğet: düz yüz ↔ silindir) |
| M3 | K | Eşleşme arayüzü: seçime göre öneren mini çubuk, Alt ile hizalama çevir, eşleşme klasörü, hatalı eşleşme uyarısı, serbestlik göstergesi | 🟡 v0.17 açılır mini çubuk (Ctrl+iki yüz), serbestlik, hizalama çevir; hatalı eşleşme uyarısı kısmi |
| M4 | Ö | Bileşeni sürükle-döndür, delta XYZ, **çarpışma algılama** | ✅ v0.17 sürükle + Δ + 90° + çarpışma algılama (kutu, adımlı) |
| M5 | Ö | **Gelişmiş**: limit (mesafe/açı aralığı), simetrik, genişlik, profil merkezi, yol, doğrusal kuplör | 🟡 v0.17 limit mesafe |
| M6 | İ | **Mekanik**: menteşe, dişli, kremayer–pinyon, vida, kanal, kam, üniversal mafsal | ✅ v0.32–v0.59 |
| M7 | Ö | Girişim tespiti, açıklık, kütle özellikleri | 🟡 v0.16 girişim |
| M8 | Ö | **Patlatılmış görünüm** (adımlar, radyal, patlatma çizgileri) | 🟡 v0.16 otomatik patlatma |
| M9 | Ö | **BOM**, bileşen çoğaltma (doğrusal/dairesel/desen güdümlü), ayna bileşen, alt montaj | 🟡 v0.17 BOM, doğrusal (2 yön) / dairesel bileşen çoğaltma; ayna, alt montaj yok |
| M10 | Ö | **STEP montaj** dışa aktarma, bağlam içi parça düzenleme | 🟡 v0.16 STEP montaj |
---

## 7. Uygulama sırası (paketler)

1. **Paket A — kritik (önce bunlar):** E1, E2, F1, F2, E3, F9, G2, G7
2. **Paket B — modelleme gücü:** F3, F4, F5, F6, F7, F18, F19, F10, F11, E4–E10, E14–E17
3. **Paket C — sac ve kaynak:** S1, S2, S3, S4.1 (loft büküm), S5, S6, W1–W4
4. **Paket D — montaj:** G1 + M1–M10
5. **Paket E — ileri:** F12, F13, F14, F15, F17, S4.2–S4.5, W5–W8, E11–E13, E18–E20, G3–G6, G8

Her paket bitince: testler (`tests/e2e/`), sürüm yayını, bu tabloda ✅, `SOLIDWORKS_OZELLIKLERI.md` durum güncellemesi, `CLAUDE.md` §4–§5.

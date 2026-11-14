# İmaj CAD — İkinci tam denetim v0.85 (2026-11-14)

İlk denetim (`docs/DENETIM_v0.82.md`), kullanıcının sonradan bulduğu bir veri kaybı hatasını kaçırmıştı (E-35). Hata şuydu: eskiz düzenlenip ölçü değiştirilince değişiklik ✓ sonrası kayboluyordu. İlk denetimdeki ajanlar çoğu işlemi programla yapmış, bu zinciri gerçek tıklamayla hiç denememişti.

Bu ikinci denetimde **10 ajan** çalıştı, aynı anda en fazla 3 ajan. Uyulan kurallar:
- **Gerçek kullanım:** Her komut şeritten, menüden, kısayoldan ya da telefonda dokunarak gerçek olaylarla çalıştırıldı. Durumu programla değiştirmek yasaktı.
- **Yaşam döngüsü:** Her komut için şu adımlar denendi: oluştur → yeniden aç ve değiştir → ebeveyn eskizini düzenle → geri al / ileri al → kaydet ve sayfayı yenile → ✕ ile vazgeç → sil / bastır.
- **Kapsam matrisi:** Envanterdeki 268 komutun ve menü öğesinin her biri, ayrıca panel seçenekleri tabloda ayrı satır. Satırı olmayan komut yok.
- **Telefon:** Her alanda telefon görünümünde (390×844) CDP dokunma olaylarıyla deneme yapıldı.
- **Kalıcı test:** Deneme betikleri `tests/e2e/denetim2/` altında kalıcı test olarak duruyor (112 dosya). Bulgu içeren kontroller bilerek `SONUC: HATA` basıyor. Düzeltilen her bulgunun kontrolü TAMAM'a dönmeli.

Kodda değişiklik yapılmadı.

## 1. Özet

| Alan (ajan) | Kritik | Yüksek | Orta | Düşük | Toplam |
|---|---|---|---|---|---|
| D1 Eskiz çizim araçları | 0 | 3 | 7 | 9 | 19 |
| D2 Eskiz düzenleme | 2 | 3 | 4 | 9 | 18 |
| D3 İlişkiler, ölçüler, 3B eskiz | 2 | 3 | 10 | 10 | 25 |
| D4 Temel özellikler | 1 | 2 | 4 | 5 | 12 |
| D5 Detay özellikleri | 3 | 3 | 5 | 6 | 17 |
| D6 Sac metal | 2 | 3 | 3 | 8 | 16 |
| D7 Yüzeyler ve gelişmiş | 2 | 6 | 9 | 5 | 22 |
| D8 Kaynaklı yapı ve analiz | 1 | 2 | 7 | 8 | 18 |
| D9 Montaj ve teknik resim | 6 | 4 | 6 | 12 | 28 |
| D10 Arayüz, dosya, telefon | 3 | 3 | 7 | 12 | 25 |
| **Toplam** | **22** | **32** | **62** | **84** | **200** |

**Ajanlar arasında yinelenen bulgular** (her biri bir kez sayılmalı; tekil toplam ≈ 195):
- Geri alma yığınından adım silinmesi dört ajanda çıktı: D1-1 = D2-1 = D3-3 = D10-4.
- Tırnak-yuva yüzü seçilemiyor: D6-5 = D7-11.
- Yalnız 3B eskiz varken Süpürme açılmıyor: D3-13 = D4-5.

İlk denetimden hâlâ geçerli olanlar her bölümde ayrıca listelendi; ilk denetimdeki kimlikleriyle anılıyor.

**Kapsam:** Her ajan kendi alanındaki komutların %100'üne satır açtı. Bazı hücreler "denenmedi (⧗)" ya da "Doğrulanmadı" diye işaretli; bunlar ilgili bölümde gerekçesiyle yazılı.

## 2. Doğrulama (ana oturum)

Tüm **Kritik** bulgular, ajanlar dururken ilgili betikler tek başına yeniden çalıştırılarak üretildi. Hiçbiri sahte değil.

| Bulgu | Yeniden üretilen sonuç |
|---|---|
| D1-1 / D2-1 / D3-3 / D10-4 geri alma | Kodda doğrulandı: `exitSketch(false)` içinde koşulsuz `undoStack.pop()` var. d10_dosya2 ile de görüldü. |
| D2-2 blok güncelleme | 2. örnek (20,0) → (12,5;0) |
| D3-1 açık Değiştir kutusu | Eskizden çıkınca kutu kalıyor. `dispose` yalnız `.quick` kutusunu siliyor. |
| D3-2 çözülemeyen değişken | Kullanıcı uyarılmıyor |
| D4-1 ince + kapak + yüzden başla | 108 480 (beklenen 107 264) |
| D5-2 sarma oyma | 50,56 / 101,19 (beklenen ≈ 101 / 202) |
| D5-3 mandal | y max 35 (beklenen 45); d7 MN'de de 45 (beklenen 55) |
| D5-4 yüze bağlı düzlemler | Yüz düzlemi, 3 noktalı düzlem, teğet düzlem eski yerde |
| D6-1 sac geçiş parçası | 701 523,74 mm³ dolu katı (2 mm cidar ≈ 57 000) |
| D6-2 saca dönüştür kalınlık | 2 bükümlü yanlış açınım, hata yok |
| D7-1 kalınlaştır | Kapalı boru 3 182 / 3 224 (beklenen ≈ 5 280 / 5 900) |
| D7-2 `=L` sızması | ✕ sonrası derinlik 20 → 50 |
| D8-1 SEA sonucu | Boy 150 olunca eski δ 0,0717 ve "Güvenli" kalıyor (doğrusu ≈ 0,241) |
| D9-1 Instant3D montajda | Masaüstü 10 → 36, telefon 10 → 56; parça değişiyor, bileşen eski |
| D9-2 / D9-3 / D9-5 parça değişikliği | Pim öbür deliğe atlıyor (55); kayıtta eski konum; kalınlık artınca pim gömülü kalıyor |
| D9-4 kimliksiz parça | Yenileme sonrası bağ kopuyor (`doc uid: None`) |
| D9-6 resim kullanıcı ölçüsü | Parça 120 olunca "100" kalıyor |
| D10-1 Farklı kaydet | uid aynı kalıyor; Kutu açılınca Kutu2 geliyor |
| D10-2 açmayı geri al + Ctrl+S | A.icad boş "Parça1" ile eziliyor |
| D10-3 depolama dolu | Yenileme sonrası d1 = 20 (beklenen 44), uyarı yok. `saveDoc` hatayı yutuyor. |

Yüksek önemdeki bulguların bir kısmı aynı betik koşularında yeniden görüldü: D5-1 kaburga 1000 mm levha, D5-7 eksen modları, D6-3 bindirme boşluğu, D8-3 SEA yüzleri, D9-7 resim açıklaması Ctrl+Z, D10-5 PM sekme geçişi. Diğer Yüksek ve aşağı önemdeki bulgular ajan raporlarındaki adımlarla verildi; düzeltme sırasında betikleriyle yeniden denenmeli.

## 3. Ortak kök nedenler (düzeltme planını belirler)

1. **Sabit koordinatla saklanan referanslar:** Model değişince eski yerde kalıyorlar. Etkilenenler:
   - mandal noktası (D5-3), köşe pahı (D5-5), yüze bağlı düzlemler (D5-4), referans eksen / köşeye kadar (P-9);
   - SEA sabitleme ve yük yüzleri (D8-3);
   - teknik resim kullanıcı ölçüsü ve açıklamaları (D9-6);
   - montaj eşleşme yeniden eşlemesi (D9-2, D9-5);
   - model kenarına verilen eskiz ölçüsü ve dönüştürülen kenar (E-5, D3-6).

   Kalıcı referans (imza + `heals`) mekanizması yalnız kenar ve yüz listeleri için var. Bu türlerin hepsine genişletilmeli.
2. **Sessiz başarısızlık:** OCC işlemi ya da çözücü başarısız olunca hata verilmiyor, yanlış katı ya da eski sonuç gösteriliyor. Etkilenenler: P-1 kabuk, D4-3, D5-1, D5-2, D6-1, D6-2, D7-1, D7-4, D3-2, D8-1, D10-3. Ortak çözüm: geometri doğrulama (hacim / kabuk / beklenen yüz sayısı) ve özelliğe bağlı hata.
3. **Geri alma ve kayıt tutarlılığı:** D1-1 (×4), D3-4, D7-2, D9-3, D9-7, D9-9, D10-2, D10-5, D10-13, ayrıca P-6 / A-20.
4. **Dosya kimliği ve depolama:** D9-4, D10-1, D10-2, D10-3, D10-6.
5. **Telefonda dokunma ofseti ve sürükleme:** Araç 70 px yukarıyı işliyor (D2-5), eskizde sürükleme yok (D3-5), hızlı ölçü kutusu parmağın altında açılıyor (D1-3), çakışan çubuklar (D10-9, D10-10).

### Paket 2 notları (v0.87)

- **Geometri doğrulama altyapısı:** çekirdek her özellikten sonra yeni / değişen gövdeleri denetler (yüz sayısı > 0, hacim > 0, gövdeler tümüyle yok olmamış). Tutmazsa hata o özelliğe yazılır ve model bir önceki hâliyle devam eder (D7-4, P-1'in ortak kökü). Ne yanlış? artık hiçbir özelliğe bağlanmayan hataları da "Model" satırıyla gösterir.
- **P-1:** kabuk kalınlığı parçanın en küçük boyutunun yarısına ulaşırsa ve kabuk hacmi değiştirmezse / ters yönde değiştirirse / BRepCheck geçersizse hata. Radyüslü kutuda kabuk artık sessizce atlanmıyor, hata veriyor (OCC kabuğunun bu durumda başarısız olması sürüyor).
- **D5-2 teşhis düzeltmesi:** oyma doğruydu. Betikteki kare (z −5…5) silindirin (z 0…40) yalnız yarısının üstündeydi; kabartma ise silindirin ucundan dışarı taşıp havada malzeme ekliyordu. Sarma artık seçilen silindir yüzünün eksen boyundaki aralığıyla sınırlı. Betik kareyi silindirin tam üstüne alacak şekilde düzeltildi (orta düzlem silindir).
- **D7-1 madde 3 teşhis düzeltmesi:** `d7_yuzey2` K1'deki "duvar" Ön düzlemde y = 0 doğrusu; Ön düzleme dik çekilince taban ile aynı düzlemde kalıyor (L değil, 40×50 düz levha). 4000 doğru sonuç; betik beklentisi düzeltildi. Gerçek L ve kapalı boru durumları (madde 1–2) yüz başına levha + yuvarlak köşe dolgusuyla doğru (2720 / 2862,8; 5280 / 5851,3 / 5582,8).

### Paket 3 notları (v0.88)

- **Yüze bağlı düzlem referansları** (ayna düzlemi, referans düzlem tabanı / ikinci tabanı, bölme düzlemi…): derleyici özellikten önce bir `probe` adımı ekler; çekirdek yüzü o anki modelde kalıcı referansla (konum, olmazsa imza) bulur, yeni çerçeveyi bildirir; ana iş parçacığı belgeye yazar ve bir kez daha kurar. Teğet düzlemin silindiri ve referans eksenin kaynağı (silindir yüzü / kenar) da aynı yolla izlenir.
- **Köşe referansları** (köşeye kadar, köşeden başla, köşe pahı, Köşe Pahı, referansa kadar, 3 noktalı düzlem, referans noktası): köşe imzası (çıkan kenar yönleri + göreli konum) `doc.vsig`'de saklanır; köşe yer değiştirince imzayla bulunur ve belgedeki nokta güncellenir. Model köşesi olmayan noktalar eskisi gibi kullanılır.
- **Mandal** noktası yüzün güncel düzlemine izdüşürülür.
- **SEA** sabitleme / yük yüzleri ve **dönüştürülmüş eskiz öğeleri** (E-5, `SketchData.links`) aynı mekanizmayla izlenir; dönüştürülen çizginin uçları / dairenin merkezi ve çapı model kenarıyla güncellenir.
- **Montaj (D9-2 / D9-5):** eşleşme varlığı, bileşenin derlenmiş özelliklerindeki çapalarla izlenir (delik / daire merkezleri = eksen, ekstrüzyon uç düzlemleri); delik taşınınca pim aynı deliğe gider, plaka kalınlaşınca pim yeni üst yüze çıkar. Göreli sınır kutusu yedeği daha seçici (belirsizse ⚠). Kütüphaneden güncelle eski ağı korur.
- **Teknik resim (D9-6):** kullanıcı ölçüleri, açıklamalar ve Detay B merkezi görünüş kutusuna göre göreli konumu da saklar; model değişince en yakın yakalama noktasına / daireye yeniden oturur, değer yeniden ölçülür.
- **Betik düzeltmeleri:** `d5_ref` N4 (çözücü dikdörtgeni simetrik büyütmüyor; köşe gerçek yeni köşeyi izlemeli) ve `d5_pah` V4 / K5b (köşe izlendiği için "Eksik referans" penceresi artık çıkmamalı).
- Hâlâ açık (başka bulgular): teğet düzlem oluşturma (P14), iki düzlem / silindir eksen PM'i (X2 / X6), eşleşme çevirme (E4).

### Paket 4 notları (v0.89)

- Seçerek çalışan eskiz araçlarında (Seç, Akıllı Ölçü, Kırp, Uzat, Radyüs, Pah, Ayır, Dönüştür, Delme, Kesişim, Ötele / Aynala / Çoğalt / Taşı…) parmak imleç kayması ve "kaldırınca yerleştir" yok: dokunulan öğe işlenir (D2-5). Çizim araçlarında kayma sürüyor.
- Seç ve Akıllı Ölçü'de nokta / öğe gerçek uzaklığa göre seçilir (D2-6); ilişki simgeleri başka bir araç etkinken dokunuşu yutmaz (telefonda kırparken araç Seç'e dönüyordu).
- Seç aracında parmak altında nokta / öğe varsa sürüklenir (D3-5, `touchGrab`).
- Hızlı ölçü / Değiştir kutusu parmağın altına açılmaz, açıldıktan sonraki 300 ms içindeki tıklama yutulur (D1-3).
- Çok parmak dokunuşu parmakların hangi yola gittiğinden bağımsız sayılır (3 parmak = ileri al) (D1-8); yarım spline ✓ / Esc ile tamamlanır (D1-5).
- Bildirim dokunuşları yutmaz ve tepsinin üstünde (D1-9); Dosya menüsü kaydırılabilir (D10-8); belge sekmeleri açıkken görünüm çubuğu / küp / kırıntılar aşağı kayar (D10-9); bağlam mini çubuğu 5 sn sonra ya da başka yere dokununca kapanır, ekran çubuğunu örtmez (D10-10).
- Telefonda ekran çubuğu sekmelerin altından başlar, sığmayan düğmeler sola yeni sütuna geçer; görünüm çubuğu ekran çubuğunun solunda, kırıntılar küpün altında (A-3). İki parmakla kaydırmada istenmeyen yuvarlanma yok (A-2).
- Betik düzeltmeleri: `d2_mobile`, `d1_mobil`, `d1_akis`, `d1_lib`, `d3_telefon` seçim araçlarında artık kaymasız dokunur; dar ekranda ekran çubuğu / görünüm çubuğu altına düşen noktalar yerine tuvaldeki noktalar kullanılır; iki parmak testi son işlemin (sürükleme) geri alındığını denetler.
- Hâlâ açık (başka bulgular): A-1 görüntü stili telefonda menüde yok, küpün "Üst" hücresi 3B izdüşümde kutu merkezine denk gelmiyor (betik yapıtı).

### Paket 5 notları (v0.90)

- Eskiz: bloğun her örneği kendi ekleme noktasında kalır (D2-2); eskiz kendi alt özelliğinin yüzüne taşınamaz, ağaçtaki düzleme tıklanabilir (D2-3, E-15); döndürmede yatay / dikey ilişki ve ölçüler 90°'de yer değiştirir, diğer açılarda hizalı ölçüye çevrilir (D2-4); hızlı ölçü kutusu odak almaz, rakam yazınca odaklanır, öğenin ortasına konur, zincir bitince kalkar (D1-2); sayıyla girişte ölçü + var olan noktaya bağlanma, kapanınca gereksiz ölçü atılır (D1-4, D1-6); yay ucundan başlayan çizgide teğet (D1-7); yay kanal merkezi çıkarımı (D1-10).
- Dönüştür yüzü tek adım, var olan kenar yinelenmez (D2-7); ayna ekseni sürüklemede yerinde kalır (D2-8); eskiz pahı iki mesafe ölçüsüyle ve sanal köşeyle gelir (D2-9); model kenarına ölçü, delme ve model köşesine yakalanan noktalar modeli izler (`links` p / k, D3-6).
- Gereksiz ölçü / ilişki: eskiz "Aşırı tanımlı (gereksiz)" ve kırmızı (D3-7), gereksiz ilişki 2B / 3B reddedilir ve sunulmaz (D3-8, E-2), sürülen → sürücü sorulur (D3-9), mavi kılavuz ilişki eklemez (D3-10), Değiştir kutusu tam değeri / ifadeyi korur (D3-11, D7-8), 3B kutu ifade okur (D3-12), SketchXpert çözülemeyen eskizde de öneri verir (D3-14), ilişki simgesi tek seçim (D3-15).
- Özellikler: 3B eskiz süpürme yolu (D3-13, D4-5), 3B yolda burulma alanı gizli (D4-6), kare dışa koniklik (D4-2), kaynak eskiz değişince bölge seçimi sıfırlanır (D4-4), sığdırma ölçü etiketlerini ve paneli hesaba katar (D4-7, D1-12, D6-7), ref. eksen iki düzlem / silindir yüzü (D5-7), koniklik analizi eğri yüz (D5-8), ✓ bekleyen önizlemeyi bekler (D5-10), "Eksik referans" bastırma / özellik hatasında açılmaz (D5-11, D7-17), düzlem türü değişince öteleme 0 (D5-12), nötr düzlem modelden (D5-14).
- Sac: bindirmede boşluk uygulanır (D6-3 kısmi: bindirmeli köşe hâlâ düzleştirilemiyor), R ≠ t saca dönüştürme açılıyor (D6-4, doğrulandı), tırnak yüzü kenardan seçilir ve yanlış yüz uyarılır (D6-5, D7-11), malzeme içte / dışta 90° dışı geri çekme (D6-6), profil eskizi ✕ ile silinir ve ad çakışmaz (D6-8).
- Yüzey / genel: Sınır Doldur önizleme + kapalı sınır denetimi + yüzeyde kalıcı referans (D7-5, D7-9), Yüzey Kırp araç listesi + referans düzlemi (D7-6, D7-16), delikli düzlemsel yüzey (D7-7), tüm sayısal alanlara denklem anahtarı (D7-12), tasarım tablosu geri alınır (D7-13), yapılandırmada değişkene bağlı ölçü için kapsam sorulur (D7-14), silmede geri sarma çubuğu (D7-15), silme / bastırma bağımlıları sorar ve birlikte bastırır (D7-17, D10-12).
- Kaynaklı / SEA: panel malzeme ve geri al sonrası yenilenir, küçültülebilir (D8-2, D8-4, D8-12), çok aşan eleman kırpılır (D8-5), alın köşeleri gelen / giden düzeninde (D8-6), kesim listesi malzemesi kütlede, özellikler boy değişince taşınır (D8-7, D8-8), nokta seçimi ekran uzaklığıyla (D8-10).
- Montaj / resim / dosya: parça geri alması resim açıklamalarını silmez (D9-7), hizalamayı çevir (D9-8), ilk işlem geri alınır (D9-9), bağlam içi düzenleme ve kütüphane malzeme / değişken / yapılandırmayı korur (D9-10, D9-16), tüm sekmelerde otomatik hizalama + SmartMate (D9-11), eşleşmesiz montaj ağacı (D9-12), patlatma ✕ (D9-13), bileşen çoğaltma düzenlenebilir desen (D9-14), rijit alt montaj kaymaz (D9-15), iki pencere: bu pencerede kaydedilmemiş değişiklik yoksa öbür pencerenin sürümü sessizce alınır, varsa uyarı (D10-6), yenilemede sekmeler (D10-7), sağ tık özellik işlemleri (D10-11), onaylanmamış eskiz kayda girmez (D10-13).
- Betik düzeltmeleri: `d1_duzlem` (tık noktası 100 mm düzlemin içinde), `d1_cizgi` / `d1_araclar` (merkez çizgisi zinciri sürer), `d1_mobil` (yeni eskiz orijini görünür bandın ortasında), `d2_block_io` (yeni dairenin kenar noktası orijine yakalanmasın), `d10_akis` / `d10_dosya` / `d10_dosya2` / `d10_diger` / `d10_gezinme` / `d10_menu` (yeni pencereler, kaydırılabilir liste, küp dikişi tıkı), `d2_misc` (eskiz düzlemi ağaçtan), `d2_fillet_convert` (pah artık sanal köşe noktasıyla), `d3_olcu3` / `d3_iliski2` (kutu H/V ilişkili — önce genişlik değişince yamuğa dönüyordu), `d3_yakala` (çözücü toleransı 1e-4), `d3_tanim` (çelişen ilişki sunulmaz), `d1_serbest_sayi` (gereksiz sayısal ölçü atılır), `d4_supur3b` (3B yolda burulma gizli), `d7_yuzey2` (bağımlı Dik de bastırılır).

### Paket 6 notları (v0.90)

- Düzeltilen düşük bulgular: D1-11…D1-18, D2-10…D2-18, D3-16…D3-23, D3-25, D4-8…D4-11, D4-12 (kısmi: süpürme / loft "Sonucu birleştir"), D5-6, D5-9, D5-13, D5-15, D5-17, D6-9, D6-12…D6-17, D7-18, D7-20…D7-22, D8-9, D8-11, D8-13…D8-18, D9-17…D9-22, D9-25, D9-28, D10-14…D10-25; ilk rapordan P-4 (tüm tüketilen eskizler ağaçta çocuk), P-5 (dairesel çoğaltmada referans eksen).
- Doğrulama sırasında bulunup düzeltilenler: ölçü etiketi ilişki simgesinin üstünde (çift tık engellenmiyordu), Delme dik bakışta uç uca görünen kenarlarda düzlemi kesen kenarı seçer, sekme kapatmada dosyaya kaydedilmemiş belge de sorulur (D10-19), Dosya listesi masaüstünde de ekranın altına taşmaz (D10-8).
- Açıklamayla kapanan: D5-16 (OCC radyüs motoru teğet zinciri her zaman yayar — panelde belirtildi), D6-10 (bilgi).
- Açık kalan: D3-24 (kısa dokunuşta kaydırmasız yerleştirme denendi; basma / bırakma konumu tutarsız kaldığı için geri alındı), D7-19 (yüzey gövdesinde yüz rengi), D9-23 (montaj resminde ölçü araçları), D9-24 (sac resminde açınım görünüşü), D9-26 (simetrik eşleşmede gereksiz dönme), D9-27 (kam eşleşmesi %5). (D6-3, D6-11 ve D4-12 kalanı ajan B ile ✅.)

## 4. Önerilen düzeltme sırası

1. ✅ **Paket 1, veri kaybı ve sessiz yanlış** (v0.86):
   - D1-1 (×4), D3-1, D3-2, D3-4, D7-2;
   - D9-1, D9-3, D9-4, D10-1, D10-2, D10-3, D10-5;
   - P-2 / D7-3 çekirdek kilidi.
2. ✅ **Paket 2, sessiz yanlış geometri** (v0.87): P-1, D4-1, D4-3, D5-1, D5-2, D6-1, D6-2, D7-1, D7-4, D8-1, geometri doğrulama altyapısı.
3. ✅ **Paket 3, kalıcı referansların genişletilmesi** (v0.88): D5-3, D5-4, D5-5, P-9, D8-3, D9-2, D9-5, D9-6, E-5.
4. ✅ **Paket 4, telefon** (v0.89): D2-5, D2-6, D3-5, D1-3, D1-8, D1-9, D10-8, D10-9, D10-10, A-2, A-3.
5. **Paket 5:** Kalan Yüksek ve Orta bulgular, alan alan.
6. **Paket 6:** Düşük bulgular.

Her paketten sonra ilgili `tests/e2e/denetim2/*.py` betikleri çalıştırılır. Düzeltilen kontroller TAMAM'a dönmeli, diğerleri bozulmamalı.

---

## Denetim 2 — d1: ESKİZ ÇİZİM ARAÇLARI (v0.85, localhost:4173)

Yöntem: PROTOKOL.md'ye uygun. Bütün adımlar şeritten / menüden / kısayoldan gerçek fare-klavye olaylarıyla yapıldı. Telefonda (390×844, is_mobile, has_touch) CDP dokunma olayları kullanıldı. `__app` yalnız sonucu okumak için kullanıldı (öğe / ilişki / ölçü / serbestlik, hacim, kayıt). Başlangıç durumu her bölümde "boş belge" (localStorage temizlenip sayfa yenilendi). A1'de Dosya > Kaydet indirme yolunu denemek için `window.showSaveFilePicker` silindi (dosya erişim API'si olmayan tarayıcıyı taklit eder, "hazır ortam").

Betikler (`tests/e2e/denetim2/`, tek başına çalışır, sonunda `SONUC: TAMAM/HATA`):

| Betik | Konu | Denetim sayısı |
|---|---|---|
| `d1_lib.py` | Ortak yardımcılar: eskiz koordinatı → ekran, gerçek tık / dokunma, Akıllı Ölçü, çift tık ölçü düzenleme, `life()` yaşam döngüsü (✓ → ekstrüzyon → Eskizi düzenle → ölçü çift tık → ✓ → Ctrl+Z / Ctrl+Y → yenile → ✕ Kaydetmeden çık) | — |
| `d1_cizgi.py` | Çizgi zinciri, çift tık / Esc / sağ tık ile bitirme, A tuşu, otomatik çizgi→yay geçişi, merkez çizgisi, orta noktalı çizgi, yapı geometrisi, kapalı çizgi profili yaşam döngüsü | 42 |
| `d1_dikd.py` | Köşe / merkez / 3N / 3N merkez dikdörtgen, paralelkenar, hızlı ölçü kutusu, yaşam döngüsü (4 tür) | 49 |
| `d1_daire_yay.py` | Daire, çevre dairesi, merkez yay (iki yönde), teğet yay, 3N yay, yaşam döngüsü (5 tür) | 56 |
| `d1_kanal.py` | Kanal (ölçü seçenekleri), merkez kanal, yay kanal, yaşam döngüsü | 29 |
| `d1_egri.py` | Elips, kısmi elips, parabol, konik, çokgen (kenar sayısı), spline açık / kapalı / panel, nokta, metin (panel, yazı tipi, eğri üzerinde), denklem eğrisi | 57 |
| `d1_serbest_sayi.py` | Serbest çizim (dikdörtgen, daire), sayıyla giriş (rakam tuşu, panel düğmesi), şekil sihirbazı | 30 |
| `d1_duzlem.py` | Eskiz düzlemi seçimi (grafik düzlem, model yüzü, ağaç, önceden seçim), çıkış yolları (✓, şerit, menü, sağ tık, ✕ üç seçenek, Esc, boş eskiz), geri alma yığını | 30 |
| `d1_araclar.py` | 23 çizim aracının her biri: çiz → eskizde Ctrl+Z / Ctrl+Y → Seç + Delete → Ctrl+Z → ✓ → yenile → kayıt; açık profil hatası | 137 |
| `d1_mobil.py` | Telefonda 15 araç (çizgi, dikdörtgen, merkez dikd., daire, merkez yay, 3N yay, kanal, çokgen, elips, spline, nokta, serbest çizim, 123, metin, 3N dikd. + paralelkenar), 4 tam yaşam döngüsü, ekran çubuğu A / ✓, 2/3 parmak | 56 |
| `d1_akis.py` | 8 iş akışı (6 masaüstü + 2 telefon) | 33 |

### Özet

| Önem | Sayı | Bulgular |
|---|---|---|
| Kritik | 0 | — |
| Yüksek | 3 | D1-1, D1-2, D1-3 |
| Orta | 7 | D1-4 … D1-10 |
| Düşük | 9 | D1-11 … D1-19 |
| **Toplam yeni** | **19** | |
| İlk rapordan hâlâ var | 6 | E-11, E-15, E-16, E-26, E-27, E-28 |

Değişikliğin modele / kayda geçmemesi (E-35 türü) **bulunmadı**: 23 aracın hepsinde ✓ + yenileme sonrası kayıt doğru. 13 tam yaşam döngüsünde (masaüstü 9, telefon 4) eskiz ölçüsü çift tıkla değiştirildi → ✓ → model, Ctrl+Z / Ctrl+Y, sayfa yenileme ve "✕ Kaydetmeden çık" hepsi doğru çalıştı. Hiçbir betikte konsol hatası ya da `pageerror` yok. Son tam koşuda betiklerdeki toplam ~520 denetimin başarısız olanlarının hepsi aşağıdaki bulgulara karşılık geliyor.

En önemli sorunlar:
- **Geri alma yığını bozuluyor (D1-1):** var olan bir eskizi açıp ✕ ile çıkınca, parçanın geri alma kaydı bir adım siliniyor.
- **Hızlı ölçü kutusu klavyeyi alıyor (D1-2):** A, Esc ve kısayollar zincirde çalışmıyor.
- **Telefonda hayalet tıklama (D1-3):** dokunma, ölçü kutusunun 🎤 düğmesine gidiyor.

### Kapsam matrisi

Sütunlar: a = oluştur + sayısal doğrulama · b = ölçü ekle / çift tıkla değiştir · c = ✓ → ekstrüzyon → Eskizi düzenle → değiştir / sürükle / sil → model · d = Ctrl+Z / Ctrl+Y (eskizde ve parçada) · e = kayıt + yenileme · f = ✕ / Esc vazgeç · g = sil · T = telefonda denendi.
✓ geçti · ✗ hata (bulgu) · – uygulanamaz (neden).

#### Envanterdeki komutlar (Eskiz sekmesi + menüler)

| # | Komut | a | b | c | d | e | f | g | T | Not |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Eskiz (şerit) | ✓ | – | – | ✓ | ✓ | ✓ | – | ✓ | Düzlem / yüz / önceden seçim ✓. Ağaç ✗ (E-15). |
| 2 | Seç | ✓ | ✓ | ✓ | ✓ | – | – | ✓ | ✓ | Metin harflerinden seçim ✓. Parabol gövdesi ✗ D1-15. |
| 3 | Akıllı Ölçü | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ | ✓ | Çizgi, nokta–çizgi, sanal orta nokta, daire, yay, yapı çizgisi. Elips küçük ekseni ✗ (E-16). |
| 4 | Serbest Çizim | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ | ✓ | Dikdörtgen + daire tanıma, tam yaşam döngüsü. Telefonda parmak ✓. |
| 5 | Çizgi | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Çift tık / Esc / sağ tık ✓. A tuşu ✗ D1-2. |
| 6 | Merkez Çiz. | ✓ | – | ✓ | ✓ | ✓ | – | ✓ | – | Döndürme ekseni (A4) ✓. Tek parçada bitiyor (D1-13). |
| 7 | Dikdörtgen | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 2Y + 2D, orijin, hızlı kutu 45×25. |
| 8 | Merkez Dikd. | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Orta nokta + yapı köşegenleri. Var olan noktaya yakalama ✓. |
| 9 | Daire | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Hızlı kutu Çap. Ø40 → 50. |
| 10 | Merkez Yay | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Çeyrek daire R30 → 25. Saat yönünde 90° ✓. |
| 11 | Teğet Yay | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | – | Boşlukta başlamaz ✓. Sonraki çizgide teğet yok ✗ D1-7. |
| 12 | 3N Yay | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Uçlar var olan noktalara bağlanır. |
| 13 | Kanal | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Ölçü seçeneği "toplam" → cc 52 + Ø12 ✓. |
| 14 | Çokgen | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 6 / 8 kenar. Ø40 → 50 hacim doğru. |
| 15 | Nokta | ✓ | – | – | ✓ | ✓ | – | ✓ | ✓ | Çizgi ortasında orta nokta ilişkisi ✓. |
| 16 | 3N Dikdörtgen | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Açılıda Y/D yok, 3 serbestlik ✓. |
| 17 | Paralelkenar | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 2 paralel + yatay, 3 serbestlik. |
| 18 | Çevre Dairesi | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | 3 köşeden "üzerinde" ×3 ✓. |
| 19 | Merkez Kanal | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | Merkez orijine bağlı değil ✗ (E-11 hâlâ var). |
| 20 | Yay Kanal | ✓ | – | ✗ | ✓ | ✓ | – | ✓ | – | Merkez orijine bağlanmıyor ✗ D1-10. Uç sürüklemesi etkisiz ✗ (E-26). |
| 21 | Elips | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Büyük eksen 40 → 50 ✓. Küçük eksen ölçüsü yok (E-16). |
| 22 | Kısmi Elips | ✓ | – | ✓ | ✓ | ✓ | – | ✓ | – | Yarım elips + çizgi, hacim π·30·15/2·10 ✓. |
| 23 | Parabol | ✓ | – | ✓ | ✓ | ✓ | – | ✓ | – | Gövde sürüklemesi biçimi değiştirmiyor ✗ D1-15. |
| 24 | Spline | ✓ | – | ✓ | ✓ | ✓ | ✓ | – | ✓ | Açık / kapalı, panel teğet alanları, sürükleme. Telefonda ✓ ile kayboluyor ✗ D1-5. |
| 25 | Metin | ✓ | – | ✓ | ✓ | ✓ | – | ✓ | ✓ | Panelde metin / boy, yazı tipi kalın, eğri üzerinde, oyma (A5). |
| 26 | Orta N. Çizgi | ✓ | – | – | ✓ | ✓ | – | ✓ | – | Simetrik 60..100. Orijinde orta nokta ilişkisi ✓. |
| 27 | 3N Merkez Dikd. | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ | – | 2. noktada yatay ilişkisi yok ✗ D1-11. |
| 28 | Konik | ✓ | – | ✓ | ✓ | ✓ | – | – | – | Rho paneli, kapalı profil ekstrüzyonu ✓. |
| 29 | Denklem Eğrisi | ✓ | – | – | ✓ | – | – | – | – | 25 nokta, tam tanımlı (sabit). |
| 30 | Yapı Geom. | ✓ | – | – | ✓ | – | – | – | – | Seçili çizgi yapı olur, Ctrl+Z / Y ✓. |
| 31 | Dosya > Şekil sihirbazı… | ✓ | ✓ | ✓ | – | ✓ | – | – | – | Plaka tam tanımlı. Delikler kenarı izlemiyor (D1-17). |
| 32 | Araçlar > Eskizden çık / şerit "Eskizden Çık" | ✓ | – | – | – | ✓ | – | – | – | Sağ tık > Eskizden çık da ✓. |

**Kapsama: 32 / 32 komut** (Eskiz sekmesinin "Eskiz", "Çiz" ve "Özel çizim" gruplarından alanıma giren komutlar, Yapı Geom., 2 menü komutu).

Alan dışı bırakılanlar (eskiz düzenleme / ilişki ajanlarının alanı): "Eskiz (eskiz açıkken)" bölümü aynı komutların tekrarı. Ayır, Kademe, Koord. Ölçü, Blok Ekle, Düzenle grubu ve Araçlar grubu (Yapı Geom. dışında).

#### Alandaki PM seçenekleri ve davranışlar (ek satırlar)

| Seçenek / davranış | Sonuç | Not |
|---|---|---|
| Zinciri çift tıkla bitirme | ✓ | |
| Zinciri Esc ile bitirme (araç kalır), ikinci Esc → Seç | ✓ | |
| Sağ tık > Zinciri bitir | ✓ (çizgi) / ✗ (spline) | Spline'da D1-5 |
| A tuşu çizgi ↔ teğet yay | ✗ | D1-2 (hızlı kutu odaklıyken). Kutu kapatılınca ✓ |
| Otomatik çizgi → yay geçişi (uca geri dön) | ✓ | |
| Hızlı ölçü kutusu (Genişlik / Yükseklik / Çap / Yarıçap / Kanal / Çevre dairesi) | ✓ | Masaüstünde odak sorunu D1-2. Telefonda hayalet tık D1-3 |
| Kanal ölçü seçeneği (yok / merkez / toplam) | ✓ | |
| Çokgen kenar sayısı | ✓ | |
| Metin: metin / yükseklik / açı / yazı tipi / eğri üzerinde (panel) | ✓ | |
| Spline: kapalı (ilk noktaya dön), panel teğet / ağırlık alanları | ✓ | |
| Sayıyla giriş: rakama bas (çizgi) | ✗ | D1-4, D1-6 |
| Sayıyla giriş: panel "Sayıyla gir (123)" (daire, dikdörtgen) | ✓ / ✗ | Dikdörtgen ölçüsüz (E-27) |
| Sayıyla giriş: telefonda ekran çubuğu 123 | ✓ | |
| Düzlem seçimi: grafik alanda ana düzlem | ✓ | |
| Düzlem seçimi: model yüzü (Eskiz → yüze tık) | ✓ | |
| Düzlem seçimi: önceden seçili yüz → Eskiz | ✓ | |
| Düzlem seçimi: ağaçtan (düzlem seçme modunda) | ✗ | E-15 hâlâ var |
| Düzlem seçimi: Esc ile vazgeç | ✓ | |
| Çıkış: ✓, şerit, Araçlar menüsü, sağ tık | ✓ | |
| Çıkış: ✕ → Vazgeç / Kaydet ve çık / Kaydetmeden çık | ✓ | |
| Çıkış: Esc eskizden çıkmaz; boş eskiz ✓ → ağaca eklenmez | ✓ | |
| Çıkış: zincir sürerken ✓ (yetim nokta yok) | ✓ | |
| Çıkıştan sonra Ekstrüzyon / Kesme / Döndürme önerisi | ✓ | Eskiz düzenlenirken de görünüyor (D1-18) |
| Var olan eskizi düzenle → ✕ → parça Ctrl+Z | ✗ | D1-1 |
| Telefon: ekran çubuğu A / ✓ / 123, 2 parmak geri al | ✓ | |
| Telefon: 3 parmak ileri al | ✗ | D1-8 |
| Telefon: alt tepsi dokunuşu bildirim açıkken | ✗ | D1-9 |

### İş akışları

| # | Ortam | Senaryo | Adımlar | Sonuç |
|---|---|---|---|---|
| A1 | Masaüstü | Delikli plaka | Dikdörtgen + hızlı kutu 100×60 → daire Ø20 → merkezden sağ ve üst kenara 30 / 30 → tam tanımlı → ✓ → ekstrüzyon 10 → Eskizi düzenle → 100 → 140 → delik sağ kenardan 30'da (x = 110) → Dosya > Kaydet indirme içeriği 140 → yenile | ✓ |
| A2 | Masaüstü | L profil | 6 çizgilik zincir → 4 ölçü → tam tanımlı → ekstrüzyon 20 (18000) → 40 → 50, 60 → 80 → eskizde Ctrl+Z (80 geri) → ✓ → 20000 | ✓ |
| A3 | Masaüstü | Yüzde kanal | Merkez dikd. 80×50 → ekstrüzyon 20 → üst yüzde eskiz → kanal Ø10 / 40 → Ekst. Kesme → kutu derinliği 30 → kanal yeni üst yüzde, hata yok | ✓ |
| A4 | Masaüstü | Döndürme | Merkez çizgisi + 20×40 dikdörtgen → Döndürme π·20²·40 → R 20 → 25 → Ctrl+Z | ✓ |
| A5 | Masaüstü | Metin oyma | Kutu → üst yüzde metin "AB" → kesme → Eskizi düzenle → metne tıkla → "ABCDE" → daha çok oyma | ✓ |
| A6 | Masaüstü | Kapalı spline | 4 nokta + kapat → ekstrüzyon → nokta sürükle + eskizde Ctrl+Z + ✓ → hacim aynı. Sürükle + ✓ → hacim artar | ✓ |
| M1 | Telefon | Delikli plaka | Dokunarak dikdörtgen 60×40 (hızlı kutu) → daire Ø10 → ekstrüzyon 5 → Eskizi düzenle → ölçüye dokun → Ø16 → ✓ → yenile | ✓ (hayalet tık D1-3 ve bildirim D1-9 yüzünden dikkatli dokunmak gerekti) |
| M2 | Telefon | Serbest çizim | Parmakla kaba dikdörtgen → 4 çizgi Y/D, orijin → Akıllı Ölçü 60 / 40 → ekstrüzyon 24000 → ↶ / ↷ | ✓ |

Telefon yaşam döngüleri (`d1_mobil.py`): çizgi zinciri, dikdörtgen, daire, kanal. Her birinde ✓ → ekstrüzyon → Eskizi düzenle → ölçüye dokun → değiştir → ✓ → ↶ / ↷ → yenile → ✕ Kaydetmeden çık hepsi ✓.

### Bulgular

#### ✅ D1-1 — Var olan eskizi düzenleyip ✕ ile çıkınca parçanın geri alma kaydı bir adım siliniyor
- **Önem:** Yüksek · **Tür:** Hata (geri alma tutarsızlığı)
- **SolidWorks'te:** Eskizi açıp değiştirmeden ya da "değişiklikleri at" ile çıkmak geri alma geçmişini değiştirmez. Sonraki Ctrl+Z son özelliği geri alır.
- **Bizde (`d1_duzlem.py` §7):**
  1. Ön düzlemde 40×30 dikdörtgen → ✓ → Ekstrüzyon 10 (12000 mm³).
  2. Ağaçta Ekstrüzyon1 → "Eskizi düzenle". Hiçbir şey değiştirmeden ✕.
  3. Ctrl+Z → **eskiz ve ekstrüzyon birlikte siliniyor** (`features = []`). Beklenen: yalnız ekstrüzyon silinir.
  4. Ctrl+Y ile ikisi geri geliyor.
  5. Aynı şey değişiklik yapıp "Kaydetmeden çık" seçilince de oluyor. Yığında tek kayıt kaldıysa sonraki Ctrl+Z hiçbir şey yapmıyor; ekstrüzyon geri alınamıyor.
- **Kod:** `src/main.ts:1709-1712` `exitSketch(keep=false)`: `undoStack.pop()` koşulsuz çağrılıyor. Yeni eskizde `startSketch` (`:1648`) önce `undoStack.push` yaptığı için doğru. Ama var olan eskiz `editFeature` → `openSketch(f, false)` (`:2265`) ile açılırken yığına **hiç kayıt eklenmiyor**. Bu yüzden ilgisiz önceki kayıt atılıyor.
- **Öneri:** `if (!keep) { if (isNew) { removeNew(); undoStack.pop(); } else f.data = JSON.parse(orig); }`. Yani var olan eskizde pop yapma.

#### ✅ D1-2 — Çizimden sonra açılan hızlı ölçü kutusu klavye odağını alıyor: A, Esc ve kısayollar zincirde çalışmıyor
- **Önem:** Yüksek · **Tür:** Hata / SolidWorks'ten farklı
- **SolidWorks'te:** Çizgi zincirinde A tuşu teğet yaya geçer. Esc zinciri bitirir. "Ekran üzerinde sayısal giriş" açık olsa bile değer kutusu kısayolları engellemez.
- **Bizde (`d1_cizgi.py` §4):** "Çizdikten sonra ölçü gir" varsayılan açık (E-28). Çizgiden sonra fare ile `.dim-prompt.quick` kutusu açılıyor ve `input` odaklanıyor. A'ya basınca yay moduna geçilmiyor (`st.arc = false`). Kutudaki değer "a" oluyor (seçili metnin yerine yazılıyor). Kutu ✕ ile kapatılınca A çalışıyor. Esc de önce yalnız kutuyu kapatıyor, ikinci Esc gerekiyor. Ctrl+Z, Delete, F gibi kısayollar da bu sırada kutuya gidiyor (`keydown` → `stopPropagation`).
- **Kod:** `src/sketch/editor.ts:1718` `if (e.pointerType === "mouse") inputs[0].focus();` ve `:1668-1676` keydown `ev.stopPropagation()`.
- **Öneri:** Kutuyu odaklamadan göster. Kullanıcı rakam yazmaya başlayınca (ilk rakam tuşu) odağı ver. Ya da odaklıyken A / Esc / Ctrl+Z'yi kutu dışına geçir (A → kutuyu kapat + `toggleLineArc`). SolidWorks'teki gibi varsayılanı masaüstünde kapalı yapmak da çözer (E-28).

#### ✅ D1-3 — Telefonda dokunma hayalet tıklaması ölçü kutusunun 🎤 (ya da ✓ / ✕) düğmesine gidiyor
- **Önem:** Yüksek · **Tür:** Hata (telefon)
- **SolidWorks'te:** — (telefon yok). Beklenen: bir noktaya dokunmak yalnız o noktayı koyar.
- **Bizde (`d1_mobil.py`, `/tmp` deneme `pm10`):**
  1. Telefonda Dikdörtgen.
  2. (0,0)'a, sonra ekranın sağ yarısındaki (50,30)'a dokun.
  3. Hızlı ölçü kutusu `clientX+18`'e konmak isteniyor. Ama 390 px ekranda sağ kenara sıkıştırılınca (genişlik 300 px) **parmağın altına geliyor**.
  4. Dokunmanın ardından gelen `click` olayı kutudaki 🎤 düğmesine gidiyor: `clicks = ['CANVAS', 'mic:🎤@301,414']`. Sonuç: "Mikrofon izni verilmedi" bildirimi; gerçek telefonda mikrofon izni sorulur ya da dinleme başlar.
  5. Düğme altta ✓ ya da ✕ olsaydı, kutu kullanıcı yazmadan uygulanır / kapanırdı.
- **Kod:** `src/sketch/editor.ts:1715-1717` (kutu konumu), `src/main.ts:7994-8004` (🎤 düğmesi tüm `.dim-prompt` kutularına ekleniyor). Dokunma `up` olayında çizim yapılıyor, tarayıcının ardından gönderdiği `click` aynı noktaya düşüyor.
- **Öneri:** Kutuyu parmağın altına koyma (dokunma noktasının üstüne / altına en az 60 px uzağa konumla). Ya da kutu oluştuktan sonraki ~350 ms içinde gelen `click`'leri yut (`pointer-events: none` + `setTimeout`).

#### ✅ D1-4 — Sayıyla girişte yatay / dikey çizgilere uzunluk ölçüsü eklenmiyor
- **Önem:** Orta · **Tür:** Hata
- **SolidWorks'te:** Sayısal girişle çizilen çizgiler girilen uzunlukla ölçülendirilir.
- **Bizde (`d1_serbest_sayi.py`):**
  1. Çizgi aracında "0" → X 0, Y 0.
  2. "5" → Uzunluk 50 / Açı 0, "3" → 30 / 90, "5" → 50 / 180, "3" → 30 / 270.
  3. Sonuç: 4 çizgi, **`dims = []`**.
  4. Aynı akışta 30°'lik çizgiye ölçü ekleniyor (`["dist", 20]`). Sorun yalnız 0 / 90 / 180 / 270°'de.
- **Kod:** `src/sketch/editor.ts:527-532` `numericEntry` → `op(() => { addRel(horizontal|vertical); dims.push(...) })`. Çizgi aracı (`:2203-2210`) zaten aynı yatay / dikey ilişkiyi ekliyor. İkinci kez eklenen ilişki gereksiz (`redundant`) sayılıyor ve `op()` (`:395-403`) **işlemin tamamını, ölçüyle birlikte** geri alıyor.
- **Öneri:** İlişkiyi yalnız çizgide yoksa ekle (`relationsOf(sk, l.id).some(r => r.t === tp)`). Ya da ilişkiyi ve ölçüyü ayrı `op` çağrılarında ekle.

#### ✅ D1-5 — Telefonda spline çizerken ekran çubuğundaki ✓ ("Bitir") spline'ı oluşturmak yerine siliyor
- **Önem:** Orta · **Tür:** Hata (çizim kaybı)
- **SolidWorks'te:** Spline çift tık ya da sağ tık > "Spline'ı bitir" ile tamamlanır. Girilen noktalar korunur.
- **Bizde (`d1_mobil.py` §10):** Telefonda Spline ile 4 noktaya dokunuldu (`st.infs = 4`). Ekran çubuğunda ✓ (çizerken "Bitir") → **hiç öğe yok**, noktalar kayboldu. Aynı yol masaüstünde sağ tık > "Zinciri bitir" ve Esc için de geçerli (Esc sonrası 3 noktalı spline kayboldu). Telefonda spline yalnız çok hızlı çift dokunmayla (< 400 ms) ya da küçültülmüş alt paneldeki "Spline'ı bitir" düğmesiyle bitirilebiliyor.
- **Kod:** `src/main.ts:7874` (`ed.isDrawing() ? ed.finishChain()`) ve `:7549`. `src/sketch/editor.ts:673` `finishChain()` yalnız `this.st = {}` yapıyor. `finishSpline` çağrılmıyor.
- **Öneri:** `finishChain()` içinde `tool === "spline" && st.infs?.length >= 2` ise `finishSpline(false)`. Benzer biçimde çok tıklamalı araçlarda yarım kalan çizimi "Bitir"de anlamlıysa tamamla.

#### ✅ D1-6 — Sayıyla giriş var olan noktalara bağlanmıyor: başlangıç orijine çakışık değil, kapanan zincir kapanmıyor
- **Önem:** Orta · **Tür:** Hata / SolidWorks'ten farklı
- **SolidWorks'te:** Sayısal girişle konan nokta var olan bir noktaya denk gelirse (orijin, zincirin ilk noktası) çakışık olur ve zincir kapanır.
- **Bizde (`d1_serbest_sayi.py`):** X 0 / Y 0 ile başlayan, 50 / 30 / 50 / 30'luk dört kenarla başlangıca dönen kare:
  - `npts = 5`: başlangıç orijin değil, ayrı bir nokta.
  - Son nokta ilk noktayla birleşmiyor.
  - `drawing = True`: zincir kapanmadı, araç çizmeye devam ediyor.
  - Serbestlik 4 (fareyle aynı çizim 2).
  - Ekstrüzyon geometrik olarak kapandığı için hacim doğru, ama köşe sürüklenince profil açılabilir.
- **Kod:** `src/sketch/editor.ts:503-508` `at()` → `this.noInfer = true` (çıkarım tamamen kapalı, `ptId` hiç bulunmuyor).
- **Öneri:** Sayıyla girişte yalnız yön / hizalama çıkarımını kapat. Tam aynı konumdaki (1e-6) var olan noktayı `ptId` olarak kullan.

#### ✅ D1-7 — Yayın ucundan başlayan çizgide teğet çıkarımı / ilişkisi yok
- **Önem:** Orta · **Tür:** SolidWorks'ten farklı
- **SolidWorks'te:** Bir yayın ucundan yeni çizgi başlatılıp teğet doğrultuda çekilince sarı "Teğet" çıkarımı gösterilir ve teğet ilişkisi eklenir.
- **Bizde (`d1_daire_yay.py` "D şekli"):**
  1. Çizgi (0,0)–(30,0) → Teğet Yay (30,0)→(30,20).
  2. Yeni Çizgi (30,20)→(0,20)→(0,0).
  3. Üst çizgiye teğet yerine **yatay** ilişkisi geliyor (`rels: horizontal, tangent, horizontal, vertical`).
  4. Alt kenar ve yükseklik ölçülendiği hâlde 1 serbestlik kalıyor (yay yarıçapı serbest).
  5. Taban 30 → 40 yapılınca yay biçimi değişip hacim 9570,8 yerine 10804,8 çıkıyor.
- E-18 (daireye teğet **biten** çizgi) ile ilgili ama ayrı durum: zincir yeni başlarken `infer()` önceki öğeyi yalnız `st.lastEnt` üzerinden arıyor.
- **Kod:** `src/sketch/editor.ts:886-897` (`prev` yalnız aynı zincirin `st.lastEnt`'i).
- **Öneri:** Zincirin ilk noktası bir yayın / çizginin ucuna (`ptId`) yakalandıysa o öğeyi `prev` say ve Teğet / Doğrusal / Dik adaylarını üret. Teğet ile yatay çakışırsa ikisinden yalnız birini ekle.

#### ✅ D1-8 — Telefonda üç parmak dokunuşu "ileri al" yerine "geri al" yapıyor
- **Önem:** Orta · **Tür:** Hata (telefon)
- **Beklenen (v0.10 notu):** 2 parmak = geri al, 3 parmak = ileri al.
- **Bizde (`d1_mobil.py`, deneme `pm7`):** Eskizde 2 çizgi → 2 parmak dokunuşu → 1 çizgi (✓). 3 parmak dokunuşu → **0 çizgi** (bir adım daha geri aldı). `onFingerTap` 3 parmakta `n = 2` ile çağrılıyor (`__ft = [2, 2]`).
- **Kod:** `src/viewer.ts:226-245`. İlk parmak çizim parmağı (`drawTouch`) olarak `touches`'tan çıkarılıyor. İkinci parmak gelince geri ekleniyor ama `if (!touches.size) gesture = …` koşulu atlanıyor. `gesture.max` sayımı bu yüzden bir eksik kalıyor. `src/main.ts:7771`. Kök tam doğrulanmadı.
- **Öneri:** `drawTouch` dönüştürülürken `gesture`'ı (yoksa) `max: 1` ile başlat. `max`'ı `touches.size` yerine o hareketteki farklı `pointerId` sayısıyla hesapla.

#### ✅ D1-9 — Telefonda bildirim (#toast) alttaki komut tepsisini örtüp dokunuşları yutuyor
- **Önem:** Orta · **Tür:** Hata (telefon arayüzü)
- **Bizde (`d1_akis.py` M1, deneme `pm9`):** Herhangi bir bildirimden sonra 2,6–5 sn boyunca tepsideki "Daire" düğmesine dokunmak işe yaramıyor. `elementFromPoint` → `<div id="toast">`. Araç Dikdörtgen'de kalıyor. Kullanıcının sonraki dokunuşu yanlış araçla çizim yapıyor (M1'de daire yerine dikdörtgen başlangıcı oluştu).
- **Kod:** `src/style.css:172` `#toast { bottom: calc(24px + …); z-index: 60 }`. `pointer-events: none` yok, konum telefon tepsisinin (`#tray`) üstünde.
- **Öneri:** `#toast { pointer-events: none }` ve telefonda `bottom: calc(var(--tray-h) + …)`.

#### ✅ D1-10 — Yay kanalın merkezi orijine (ya da tıklanan noktaya) bağlanmıyor
- **Önem:** Orta · **Tür:** Hata
- **SolidWorks'te:** Yay kanalda ilk tıklama (yay merkezi) orijin ya da var olan bir noktaysa çakışık olur.
- **Bizde (`d1_kanal.py`):** Yay Kanal → orijine tık → (30,0) → (0,30) → (0,36). Yapı yayının merkezi yeni nokta `p1`, orijinle çakışık ilişkisi yok. Serbestlik 6. Uçtan sürükleyince şekil değişmiyor (E-26 hâlâ var).
- **Kod:** `src/sketch/editor.ts:3063` `buildArcSlot` → `const c = addPt(sk, g.c)`. `clickInner` `case "aslot"` (`:2505`) çıkarım sonucunu (`st.infs[0]`) kullanmıyor (`ci` tanımlanıp `void` ediliyor, `:2520-2521`).
- **Öneri:** Merkez için `this.makePoint(st.infs[0])` kullan. Başlangıç / bitiş tıklamalarındaki `ptId`'leri de çakışık yap.

#### ✅ D1-11 — 3 noktalı merkez dikdörtgende ikinci nokta yatay / dikey çıkarımla konsa da ilişki eklenmiyor
- **Önem:** Düşük · **Tür:** SolidWorks'ten farklı / tutarsızlık
- **Bizde (`d1_dikd.py`):**
  - 3N Merkez Dikd.: orijin → (30,0) (yatay çıkarım) → (30,20).
  - Sonuç: `perpendicular, parallel ×2, midpoint` → **3 serbestlik** (dönme serbest). İki ölçüden sonra hâlâ 1 serbestlik.
  - 3N Dikdörtgen (köşe) aynı durumda yatay ilişkisi ekliyor (2 serbestlik).
- **Kod:** `src/sketch/editor.ts:2000` `st.bPos = this.infer(p, st.aPos).p` (çıkarımın `hv` bilgisi atılıyor). `rect3` / `para` `binf.hv` kullanıyor (`:2477`).
- **Öneri:** `st.binf` sakla. `hv` varsa ilgili kenara (ya da yapı çizgisine) yatay / dikey ilişkisi ekle.

#### ✅ D1-12 — Eskizi düzenle sığdırması ölçü etiketlerini hesaba katmıyor: etiketler ekran dışında kalıyor
- **Önem:** Düşük · **Tür:** Arayüz
- **Bizde (`d1_daire_yay.py`, ekran görüntüsü `/tmp/c3.png`):**
  1. Çevre dairesi Ø30 → ✓ → ekstrüzyon → Eskizi düzenle.
  2. Görünüm daireye sığdırılıyor.
  3. Ø etiketi (lp = 30,30) grafik alanın üstünde, şeridin altında kalıyor. Çift tıklanamıyor (Playwright: `#cmdbar ... intercepts pointer events`).
  4. Ölçüyü değiştirmek için önce uzaklaştırmak gerekiyor.
- **Kod:** `src/main.ts:1691` `if (!isNew && f.data.ents.length) setTimeout(fitAll, 50)`.
- **Öneri:** Sığdırma kutusuna `dims[].lp` noktalarını da kat. Ya da SolidWorks gibi düzenlemede görünümü değiştirme / yalnız dik bak.

#### ✅ D1-13 — Merkez çizgisi tek parça çizince bitiyor (SolidWorks'te zincir sürer)
- **Önem:** Düşük · **Tür:** SolidWorks'ten farklı
- **Bizde:** Merkez Çiz. ile iki tık → yapı çizgisi oluşuyor, zincir bitiyor (`finishChain`).
- **SolidWorks'te:** Merkez çizgisi aracı çizgi gibi zincirleme çalışır, çift tık / Esc ile biter.
- **Kod:** `src/sketch/editor.ts:2231` `if (closed || cons) this.finishChain();`.

#### ✅ D1-14 — Ağaçta zaten seçili özelliğe tıklamak seçimi kaldırıyor
- **Önem:** Düşük · **Tür:** SolidWorks'ten farklı (alan dışı, karşılaşıldı)
- **Bizde:** Ekstrüzyon ✓ sonrası ağaçta Ekstrüzyon1 seçili geliyor. Kullanıcı "Eskizi düzenle" için ona tıklayınca seçim kalkıyor ve `#tree-actions` boşalıyor. İkinci tık gerekiyor.
- **SolidWorks'te:** Seçili öğeye tıklamak seçili bırakır.
- **Öneri:** Ctrl'süz tık her zaman seç (yalnız Ctrl+tık değiştirsin).

#### ✅ D1-15 — Parabol gövdesinden sürükleme bütün parabolü taşıyor, biçim değişmiyor
- **Önem:** Düşük · **Tür:** SolidWorks'ten farklı
- **Bizde (`d1_egri.py`, deneme `pr6`):** (−20,0)–(20,0) uçlu, tepesi (0,20) parabolün tepesinden 10 mm yukarı sürüklendi. Uçlar da `(±20, 10)`'a kaydı. Kontrol noktası `k` (0,40 → 0,50) birlikte taşındı. Hacim aynı kaldı. Kapanış çizgisi de kaydı.
- **SolidWorks'te:** Parabol sürüklenince uçlar yerinde kalıp tepe / odak değişir.
- **Öneri:** Eğri gövdesinden sürüklemede uç noktaları geçici sabitle (E-34'teki yay önerisiyle aynı).

#### ✅ D1-16 — Elle çizilen her spline "denklem eğrisi" (`eq: true`) olarak işaretleniyor
- **Önem:** Düşük · **Tür:** Hata (görsel)
- **Bizde:** `finishSpline` her spline'a `eq: true` yazıyor (`{"t":"spline","pts":[…],"eq":true}`). `renderRels` bu bayrakta spline noktalarındaki **Sabitle** simgelerini gizliyor. Elle çizilen spline'ın bir noktası sabitlenirse ⚓ görünmez.
- **Kod:** `src/sketch/editor.ts:3092` (ayrıca `:1452`), `:4651`.
- **Öneri:** `eq: true` yalnız `createEquationCurve`'de (`:1747`) kalsın.

#### ✅ D1-17 — Şekil sihirbazı plakasında delikler kenar mesafesiyle değil merkezden ölçülü
- **Önem:** Düşük · **Tür:** SolidWorks'ten farklı (beklenti)
- **Bizde (`d1_serbest_sayi.py`):** Plaka 200×120, "Kenar mesafesi 20" → delikler x = ±80. Eskizde genişlik 200 → 260 yapılınca delikler ±80'de kaldı. Kenar mesafesi 20'den 50'ye çıktı.
- **Öneri:** Delik konumlarını kenar çizgilerine ölçülendir (`pldist`, kenar mesafesi). Böylece sihirbazdaki "Kenar mesafesi" anlamı korunur.

#### ✅ D1-18 — Ekstrüzyon / Kesme / Döndürme önerisi eskiz düzenlenirken de ekranda kalıyor
- **Önem:** Düşük · **Tür:** Arayüz
- **Bizde (deneme `ps1`, ekran görüntüsü `/tmp/c3.png`):** Eskizden çıkınca 9 sn görünen `.suggest` çubuğu, hemen "Eskizi düzenle" ile girilen eskizde de duruyor. Çubuktaki "Ekstrüzyon"a basınca eskiz sessizce kapanıp ekstrüzyon paneli açılıyor.
- **Öneri:** `openSketch` başında `.suggest`'i kaldır.

#### ✅ D1-19 — Telefonda ekran çubuğunun ✓ düğmesi görünüm çubuğunun sağ düğmesinin üstüne biniyor
- **Önem:** Düşük · **Tür:** Görsel (telefon)
- **Bizde (390×844, `/tmp/m1.png`):** Yeşil ✓ (ekran çubuğu) `#viewbar`'daki son düğmenin ("Normal") üstünde. O düğmeye dokunulamıyor.
- **Öneri:** Telefonda ekran çubuğunu görünüm çubuğunun altından başlat ya da görünüm çubuğunu sola kaydır.

#### İlk rapordan hâlâ geçerli olanlar (kısaca)
- **E-11:** Merkez kanalda merkez noktası / orta nokta ilişkisi yok. Orijine tıklansa da 2 serbestlik (`d1_kanal.py`).
- **E-15:** Düzlem seçme modunda ağaçta düzleme tıklama çalışmıyor (mod `pickSketchPlane` kalıyor, `d1_duzlem.py`).
- **E-16:** Elipsin küçük ekseni ölçülemiyor (yalnız panelde "Küçük yarıçap", `d1_egri.py`).
- **E-26:** Yay kanalın ucundan sürükleme etkisiz (açı 90° kaldı, `d1_kanal.py`).
- **E-27:** Sayıyla girişte dikdörtgen ölçüsüz. Merkez yayda (ve yay / kanal / çokgende) sayıyla giriş yok (`d1_serbest_sayi.py`).
- **E-28:** "Çizdikten sonra ölçü gir" masaüstünde varsayılan açık. D1-2'nin tetikleyicisi.

#### Denendi — sorun yok (öne çıkanlar)
- 23 çizim aracının hepsinde: eskizde Ctrl+Z / Ctrl+Y, Seç + Delete + Ctrl+Z, ✓ + sayfa yenileme → kayıtta aynı sayıda öğe.
- Ölçü çift tık → ✓ → model → Ctrl+Z / Ctrl+Y → yenileme → ✕ Kaydetmeden çık zinciri 13 kez. Değişiklik kaybı (E-35 türü) yok.
- Otomatik ilişkiler: çizgide Y / D, orijine çakışma, dikdörtgen 2Y2D, merkez dikdörtgen orta nokta, kanal 4 teğet + eşit, çokgen 6 üzerinde + 5 eşit, çevre dairesi köşelerde 3 üzerinde, nokta çizgi ortasında orta nokta.
- Açık profile dönen eskiz ağaçta hata gösteriyor (sessiz değil). Ctrl+Z ile model geri geliyor.
- Model yüzündeki eskiz, ebeveyn özellik derinliği 20 → 30 olunca yeni yüze taşınıyor (A3).
- Dosya > Kaydet (indirme) içeriği güncel. Sayfa yenilemede model aynı.
- Konsol / sayfa hatası: 0.

---

## Denetim 2 — Ajan d2: ESKİZ DÜZENLEME ARAÇLARI (v0.85, localhost:4173)

Tüm kullanıcı adımları gerçek fare / klavye (masaüstü 1400×900) ya da CDP dokunma (telefon 390×844, is_mobile, has_touch) ile yapıldı. `setDoc` yalnız **hazır model** kurmak için (her senaryonun başı) kullanıldı; `__app` yalnız sonucu okumak için (hacim `kernel.props()`, bbox, `doc`, editör verisi, `localStorage`). Eskiz her zaman ağaçtan özellik seçilip **"Eskizi düzenle"** düğmesiyle açıldı; ölçüler etikete çift tıklanıp Değiştir kutusuna yazıldı; ✓ / ✕ / "Kaydetmeden çık" / Ctrl+Z / Ctrl+Y / Delete gerçek basıldı; sayfa gerçekten yenilendi.

Betikler: `/home/claude/imaj-cad/tests/e2e/denetim2/d2_*.py` (ortak yardımcı `d2h.py`). Hepsi tek başına çalışır, sonda `SONUC: TAMAM/HATA` basar.

| Betik | Kapsam | Sonuç |
|---|---|---|
| `d2_trim.py` | Kırp (tık + güç kırpma), Uzat, eskiz/parça geri al, yenile, ✕ | TAMAM |
| `d2_undo.py` | ✕ / Kaydetmeden çık / değişikliksiz ✓ sonrası parça geri alma yığını | HATA (D2-1, D2-13) |
| `d2_offset_mirror.py` | Ötele (tek / çift yön / taban yapı / ölçü değişince / daire), Aynala, Dinamik ayna | HATA (E-4 hâlâ, D2-8) |
| `d2_pattern_move.py` | Doğrusal / dairesel çoğaltma + örnek atla, Taşı, Kopyala, Döndür, Ölçekle, Esnet | HATA (E-23 hâlâ, D2-4) |
| `d2_fillet_convert.py` | Eskiz radyüsü / pahı (sanal köşe, R ölçüsü), Dönüştür (kenar / yüz / silüet), Kesişim Eğrisi, Delme | HATA (D2-7, E-5 hâlâ, D2-10) |
| `d2_block_io.py` | Blok kaydet / ekle / düzenle / dağıt, DXF içe aktar, Eskiz Resmi + Kenarları izle | HATA (D2-2) |
| `d2_misc.py` | Yapı geom., Sil, seçim (pencere/kesişen/Ctrl/Ctrl+A), Ctrl+C/V/X, eskizler arası yapıştır, Ayır, Eskizi Onar, Tam Tanımla, İlişkiler, Eskiz düzlemini değiştir, Türetilmiş eskiz | HATA (D2-3, D2-12) |
| `d2_modelref.py` | 3B radyüs / pah / kabuk eskiz araçlarından sonra doğru kenarda mı (4 senaryo) | TAMAM |
| `d2_mobile.py` | Telefonda 10 araç: Kırp, Radyüs, Pah, Ayır, Seç, Yapı Geom., Aynala, Doğrusal Çoğ., Taşı, Ötele, Sil + ↶ ↷ ✓ ✕ yenile | HATA (D2-5, D2-6) |

### Özet

| Önem | Sayı |
|---|---|
| Kritik | 2 |
| Yüksek | 3 |
| Orta | 4 |
| Düşük | 9 |
| **Toplam yeni** | **18** |

İlk denetimden hâlâ geçerli olanlar (yeniden doğrulandı, yeni bulgu sayılmadı): **E-4** (öteleme ilişkisel değil — bu turda ek etki: ölçü değişince model sessizce bozuk), **E-5** (Dönüştür / Kesişim eğrisi / Delme sabit kopya), **E-21** (pahta ölçü yok — ek etki D2-9), **E-23** (çoğaltma örnekleri tohumu izlemiyor), **E-24** (Döndür merkezi seçilemiyor), **E-22** (ötelemede "uçları kapat" yok).

Kapsam: alandaki 32 komutun 32'sinin matriste satırı var (**%100**); ek 22 seçenek satırı.

### Kapsam matrisi

Sütunlar: a oluştur + sayısal doğrulama · b aracın ürettiği ilişki/ölçüyü değiştir → ✓ → model · c ✓ → ekstrüzyon / model · d Ctrl+Z / Ctrl+Y (E = eskiz içi, P = parça) · e kayıt + sayfa yenile · f ✕ / Kaydetmeden çık · g telefon (CDP). ✓ geçti, ✗ hata (bulgu), – uygulanamaz, ⧗ denenmedi.

#### Şerit: Eskiz > Düzenle

| Komut | a | b | c | d | e | f | g | Not |
|---|---|---|---|---|---|---|---|---|
| Eskiz Radyüs | ✓ R10 yay + R ölçüsü, serbestlik değişmedi | ✓ sanal köşeye bağlı 60→70, R10→15 modele geçti | ✓ 47785,4 / 55517,1 | ✓ E, ✓ P | ✓ | ✓ | ✗ D2-5 (doğrudan dokunma ıskalar), kaymayla ✓ | d2_fillet_convert, d2_mobile |
| Eskiz Pahı | ✓ 5 çizgi, hacim −180 | ✗ D2-9 (genişlik 80→90 → pah sessizce büyüdü; E-21) | ✓ | ⧗ | ⧗ | ⧗ | ✓ (kaymayla) | |
| Kırp — en yakına (tık) | ✓ taşan uçlar, bölge kırpma → 60×60 | ✓ uç `onLine` | ✓ 36000 | ✓ E, ✓ P | ✓ | ✓ | ✗ D2-5, kaymayla ✓ | d2_trim |
| Kırp — güç kırpma (sürükle) | ✓ tek sürüklemede 3 parça | – | ✓ | D2-15 (her parça ayrı adım) | – | – | ✗ telefonda sürükleme “kaldırınca yerleştir”e gider (D2-5) | |
| Kırp — köşe / içeriyi / dışarıyı kırp | ✗ D2-16 seçenek yok | – | – | – | – | – | – | |
| Uzat | ✓ y 10→30, `onLine` | ✓ üst kenar sürüklenince uç kenarda kaldı | ✓ (iki bölge → hata iletisi D2-18) | ✓ E | ✓ kayıtta | ⧗ | ⧗ | |
| Ötele (tek yön) | ✓ 8 çizgi, dışa 5 | ✗ E-4 hâlâ: taban 80→100 → model 69000 (beklenen 17000), hata yok | ✓ 15000 | ✓ P | ✓ | ✓ | ✓ (daire) | d2_offset_mirror |
| Ötele — çift yön + taban yapı | ✓ 12 çizgi, 4 yapı | – | ✓ 28000 | ✓ P | ⧗ | – | ⧗ | |
| Ötele — daire | ✓ eş merkezli | ✗ E-4 hâlâ: ölçü / ilişki yok, değiştirilecek ölçü yok | ✓ | ⧗ | ⧗ | ⧗ | ✓ | |
| Ötele — uçları kapat | ✗ yok (E-22 hâlâ) | – | – | – | – | – | – | |
| Dönüştür — kenar | ✓ 1 çizgi + 2 fix | ✗ E-5 hâlâ (taban 80→100, dönüştürülen 80 kaldı → 84000) | ✓ | ✓ E | ⧗ | ✓ | ⧗ | |
| Dönüştür — yüz | ✗ D2-7 (önceki kenarı yineler → ✓ engellenir) | ✗ E-5 | ✓ 72000 (yinelenmeden) | ✗ D2-7 (4 ayrı adım) | ⧗ | ⧗ | ⧗ | |
| Dönüştür — silüet | ✓ Ø20 → 2 çizgi | – | ⧗ | ⧗ | ⧗ | ✓ | ⧗ | |
| Delme | ✗ D2-10 (önceden seçilen nokta yok sayılır); araç içinde nokta + kenar ✓ (−30,10) fix | E-5 (sabit) | ✓ | ⧗ | ✓ kayıtta | ⧗ | ⧗ | |
| Kesişim Eğr. | ✓ 4 çizgi (grafik alana dokununca, D2-17) | E-5 | ✓ kaydedildi | ✓ P | ⧗ | ⧗ | ⧗ | |

#### Şerit: Eskiz > Özel çizim (alanımdakiler)

| Komut | a | b | c | d | e | f | g | Not |
|---|---|---|---|---|---|---|---|---|
| Ayır | ✓ kenar ikiye + doğrusal | ✓ parça sürüklemede doğrusal kaldı | ✓ 48000 | ✓ E | ⧗ | ⧗ | ✓ (kaymayla) | |
| Blok Ekle | ✓ 2. örnek (20,0) | ✗ D2-2 (Bloğu düzenle diğer örneği kaydırıyor) | ✓ 2 delik | ✓ dağıt E | ✓ | ✓ | ⧗ | d2_block_io |
| Blok olarak kaydet (Seç paneli) | ✓ | – | – | ✗ D2-11 | ✓ | – | ⧗ | |
| Bloğu düzenle / güncelle | ✗ D2-2 | ✗ | ✓ (yanlış konumla) | ⧗ | ⧗ | ⧗ | ⧗ | |
| Bloğu dağıt | ✓ | – | – | ✓ E | ⧗ | ✓ | ⧗ | |

#### Şerit: Eskiz > Araçlar

| Komut | a | b | c | d | e | f | g | Not |
|---|---|---|---|---|---|---|---|---|
| Eskizi Onar | ✓ tekrarlı kenar silindi | – | ✓ hata kalktı, 48000 | ⧗ | ⧗ | ⧗ | ⧗ | |
| DXF İçe Aktar | ✓ daire + çizgi (gerçek dosya seçici) | – | ✓ Ø20 delik 44858,4 | ✓ tek adım E | ✓ | ✓ | ⧗ | |
| Eskiz Resmi + Kenarları izle | ✓ 4 çizgi + daire | ✓ genişlik 120 alanı | ✓ ±1,1 % | ✓ tek adım E | ✓ (resim belgede) | ⧗ | ⧗ | |
| Aynala | ✓ simetrik + eşit | ✗ D2-8 (kaynak sürüklenince eksen döndü); yarıçap ✓ eşit | ✓ 43978,8 / 37298 | ✓ P | ✓ | ⧗ | ✓ | |
| Dinamik ayna | ✓ daire + U zinciri kapalı cep | – | ✓ 42018,6 | ⧗ | ⧗ | ⧗ | ⧗ | |
| Doğrusal Çoğ. | ✓ 3×2 | ✗ E-23 hâlâ | ✓ 6 delik | ✓ P | ✓ | ✓ | ✓ | |
| Doğrusal Çoğ. — örnek atla | ✓ "2" → 2 daire | – | ✓ | ✓ P | ✓ | – | – | |
| Dairesel Çoğ. (+ atla, seçili köşe merkez) | ✓ 5 / R20, köşe merkez ✓ | ✗ E-23 | ✓ 5 delik | ⧗ | ⧗ | ✓ | ⧗ | |
| Taşı/Kopyala/Döndür (birleşik) | ⧗ (aynı `runOp` motoru; ayrı komutlarla denendi) | | | | | | | |
| Taşı | ✓ (25,10) | – | ✓ hacim aynı, kayıtta | ✓ E | ✓ | ⧗ | ✓ (D2-6 ilk denemede) | |
| Kopyala | ✓ 2 daire | – | ✓ | ⧗ | ⧗ | ⧗ | ⧗ | |
| Döndür | ✓ ölçüsüzde 60×80; ✗ D2-4 ölçülüde paralelkenar | – | ✗ D2-4 | ⧗ | ⧗ | ⧗ | ⧗ | |
| Ölçekle | ✓ 0,5 → 40×30 | D2-14 (ölçüler sessizce silinir) | ✓ | ⧗ | ⧗ | ⧗ | ⧗ | |
| Esnet | ✓ 100×60 | D2-14 (ölçülüde sessizce etkisiz) | ✓ | ⧗ | ⧗ | ⧗ | ⧗ | |
| Tam Tanımla | ✓ serbestlik 0 (8 ölçü) | – | ✓ | ⧗ | ⧗ | ✓ | ⧗ | E-32 hâlâ |
| Yapı Geom. | ✓ | – | ✓ tek delik | ✓ E | ✓ | – | ✓ | |
| İlişkiler (göster/gizle) | ✓ `showRels` değişiyor | – | – | – | – | – | ⧗ | |
| Sil (şerit + Delete) | ✓ | ✓ ölçülü kenar silinince çözülür | ⧗ | ✓ E | ⧗ | ✓ | ✓ (D2-6) | |

#### Menü Düzen / kısayollar (eskizde)

| Komut | a | d | g | Not |
|---|---|---|---|---|
| Kopyala Ctrl+C / Yapıştır Ctrl+V | ✓ imleç konumuna | ✓ E | ⧗ | ✗ D2-12 eskizler arası yapıştırılamıyor |
| Kes Ctrl+X | ✗ D2-12 (yok) | – | – | |
| Sil Delete | ✓ | ✓ | – | |
| Tümünü seç Ctrl+A | ✓ | – | – | |

#### Seçim araçları

| Komut | Sonuç |
|---|---|
| Pencere (soldan sağa) | ✓ yalnız tam içerideki daire |
| Kesişen (sağdan sola) | ✓ daire + sol kenar |
| Ctrl+tık ekle / çıkar | ✓ |
| Telefon dokunuşu | ✗ D2-6 (küçük dairede merkez noktası / ilişki simgesi seçiliyor) |

#### Ağaç eylemleri

| Komut | a | d | Not |
|---|---|---|---|
| Eskiz düzlemini değiştir | ✗ D2-3 (kendi alt özelliğinin yüzü kabul ediliyor) | ✓ P | E-15 hâlâ (ağaçtaki düzlem tıklanamıyor → grafik alanda ilk yakalanan model yüzü) |
| Türetilmiş eskiz | ✓ eklendi (üst yüz) | ✓ P | E-12 hâlâ (bağlı değil, denenmedi) |

#### Modeldeki özellikler eskiz düzenlemeden sonra (`d2_modelref.py`)

| Senaryo | Sonuç |
|---|---|
| S1 düşey kenarda 3B R5 + eskizde karşı köşeye eskiz radyüsü R10 | ✓ 47731,75 (3B radyüs yerinde) |
| S1b 3B radyüslü köşenin kendisine eskiz radyüsü | ✓ radyüs hata + "Yeniden seç" penceresi (sessiz kayma yok) |
| S2 üst ön kenarda pah 2 + eskizde Taşı (X +10) | ✓ pah hâlâ z=30 üst kenarda, 47840; Ctrl+Z ✓ |
| S3 üstü açık kabuk 2 mm + Esnet (+20) | ✓ 16992 (= 100×60 kabuk); yenile ✓ |
| S4 çizgi çiz + Kırp ile köşe kesildi, karşı köşede 3B R3 | ✓ 47000,69 |

### İş akışları

1. **Taşan çizgiyi kırparak plaka daraltma (masaüstü):** hazır model 80×60 + taşan dikey çizgi (açık kontur hatası) → Eskizi düzenle → Kırp ile 2 taşan uç + sağ bölge 3 parça → eskizde Ctrl+Z/Y → ✓ → 36000 → parça Ctrl+Z/Y → yenile → ✓ / ✕ ile vazgeç ✓. Güç kırpma ✓.
2. **Çerçeve:** plaka → pencere seçimi → Ötele 5 → ✓ (15000) → yenile → taban 80→100 → model 69000 ✗ (E-4).
3. **Aynalı delikler:** delikli plaka → daire + merkez çizgisi Ctrl ile → Aynala → ✓ (2 delik) → kaynak daire sürükle (eksen döndü D2-8) / yarıçap sürükle (eşit ✓) → ✓ → Ctrl+Z → yenile ✓; Dinamik ayna ile daire ve U cep ✓.
4. **Delik dizisi:** tek delik → Doğrusal 3×2 → ✓ (6 delik) → tohumu büyüt → örnekler izlemez (E-23) → Kaydetmeden çık ✓; örnek atla "2" → ✓ → Ctrl+Z/Y → yenile ✓; dairesel 6 / atla 3 → 5 delik ✓.
5. **Radyüslü plaka:** Eskiz Radyüs R10 → sanal köşe ölçüsü 60→70 → R 10→15 → her biri ✓ ile modele geçti → Ctrl+Z/Y → yenile → yeni radyüs + Kaydetmeden çık → değişmedi ✓.
6. **Üst yüzden yeni gövde:** üst yüze tıkla → Eskiz → Dönüştür (kenar + yüz) → yinelenen kenar ✗ D2-7 → geri al → yüz → ✓ → öneri çubuğundan Ekstrüzyon 5 → 72000 ✓ → taban 80→100 → üst gövde 80'de kaldı (E-5).
7. **Blok:** daire → Blok olarak kaydet → Blok Ekle (20,0) → ✓ (2 delik) → yenile → Bloğu düzenle (+R3 daire) → Bloğu güncelle → diğer örneğin deliği 7,5 mm kaydı ✗ D2-2 → dağıt / geri al ✓.
8. **DXF + fotoğraf:** DXF (daire + çizgi) gerçek dosya seçiciyle → fazla çizgiyi Delete → ✓ delik → yenile ✓; Eskiz Resmi (PNG) → genişlik 120 → Kenarları izle → ✓ → Ekstrüzyon 10 → hacim ±1,1 % → yenile ✓.
9. **Geri alma yığını:** hazır model → ağaçta e2 Bastır → Eskizi düzenle → ✕ → Ctrl+Z → **tüm model kayboldu** ✗ D2-1.
10. **Düzlem değiştir:** Eskiz1 → Eskiz düzlemini değiştir → grafik alanda tıkla (ilk yakalanan e1'in üst yüzü) → model sessizce y 10…20'ye kaydı ✗ D2-3.
11. **Telefon (CDP):** eskizi düzenle → Kırp (doğrudan dokunma ıskaladı D2-5; 70 px aşağıdan ✓) → ↶ ↷ → Radyüs → Pah → Ayır → Seç (küçük dairede merkez seçildi D2-6) → Yapı Geom. + ↶ → Aynala → Doğrusal Çoğ. → Taşı → Ötele → Sil → kırp → ✓ → 60 genişlik → yenile ✓ → ✕ Kaydetmeden çık ✓.
12. **3B özellikler eskiz araçlarından sonra:** S1–S4 yukarıda ✓.

### Bulgular

##### ✅ D2-1 — Var olan eskizi ✕ ile kapatmak parça geri alma yığınından ilgisiz bir adımı siliyor; sonraki Ctrl+Z iki adım geri gidiyor (burada tüm model kayboldu)
- **Önem:** Kritik · **Tür:** Hata (sessiz veri / adım kaybı)
- **SolidWorks:** Eskizi düzenleyip değişiklik yapmadan (ya da atarak) çıkmak geri alma geçmişini değiştirmez. Ctrl+Z son kullanıcı adımını geri alır.
- **Bizde:** hazır model (plaka + silindir e2, 54283,19 mm³) → ağaçta e2 → **Bastır** (48000) → e1 → **Eskizi düzenle** → hiçbir şey yapmadan **✕** → Ctrl+Z → beklenen 54283,19 (bastırma geri alınır); ölçülen: **özellik sayısı 0, hacim yok** (Ctrl+Z bastırmadan önceki adımı da geri aldı). Ölçü 80→100 yapıp "Kaydetmeden çık" ile de aynı. Gerçek kullanımda: kullanıcı A ve B adımlarını yapar, eskize bakıp ✕ ile çıkar, B'yi geri almak için Ctrl+Z basar → A da geri alınır; yeni bir değişiklik yaparsa ileri alma yığını silinir ve A kalıcı kaybolur.
- **Betik:** `d2_undo.py` (1. ve 2. bölüm)
- **Kod:** `src/main.ts:1709-1712` `exitSketch(false)` → `if (isNew) removeNew(); else f.data = JSON.parse(orig); undoStack.pop();` — `undoStack.pop()` yalnız yeni eskizde (startSketch `:1648` push yapar) doğru; var olan eskiz açılırken (`openSketch(f,false)` / `editFeature :2265`) push yapılmıyor.
- **Öneri:** `undoStack.pop()` yalnız `isNew` dalında yapılsın (ya da `openSketch` var olan eskizde de bir giriş push etsin ve ✓'de o kullanılsın).

##### ✅ D2-2 — "Bloğu düzenle → Bloğu güncelle" diğer örneklerin yerini değiştiriyor (delik sessizce kayıyor)
- **Önem:** Kritik · **Tür:** Hata (sessiz yanlış geometri)
- **SolidWorks:** Blok tanımı değişince her örnek kendi ekleme noktasında kalır; örnekteki mevcut öğeler yerinden oynamaz.
- **Bizde:** plaka + R5 daire (−20,0) → Seç → **Blok olarak kaydet** ("Delik") → **Blok Ekle** → (20,0)'a dokun → ✓ (2 delik, 46429,2) → yenile → 1. örneği seç → **Bloğu düzenle** → Daire aracıyla (−5,0) R3 çiz → **Bloğu güncelle**. Beklenen 2. örnek: R5 (20,0), R3 (35,0). Ölçülen: **R5 (12,5; 0)**, R3 (27,5; 0) → 2. örneğin mevcut deliği 7,5 mm sola kaydı; ✓ sonrası model bu yanlış konumla kuruldu, uyarı yok.
- **Betik:** `d2_block_io.py`
- **Kod:** `src/sketch/editor.ts:1830` `blockDef` (noktalar öğelerin ağırlık merkezine göre) + `:1891-1912` `finishBlockEdit` (eski örneğin ağırlık merkezi `c` alınıp yeni tanım (yeni ağırlık merkezli) oraya yerleştiriliyor; tanımın ağırlık merkezi değişince örnek kayar).
- **Öneri:** Blok örneğine kalıcı ekleme noktası / dönüşüm sakla (`blk` etiketinde ya da ayrı alan); tanım ekleme noktasına göre tutulsun; güncellemede örnek = ekleme noktası + tanım.

##### ✅ D2-3 — "Eskiz düzlemini değiştir" eskizin kendi alt özelliğinin yüzünü kabul ediyor (döngüsel referans); model sessizce kayıyor
- **Önem:** Yüksek · **Tür:** Hata
- **SolidWorks:** Eskiz, kendisinden türeyen bir özelliğin yüzüne taşınamaz ("döngüsel referans" uyarısı).
- **Bizde:** plaka (Üst düzlem, y 0…10) → ağaçta Eskiz1 → **Eskiz düzlemini değiştir** → grafik alanda (düzlem karesine ya da modele) tıkla → plakanın üst yüzü yakalandı, "Eskiz düzlemi değiştirildi". Sonuç: bbox **y 10…20** (plaka 10 mm yukarı kaydı), ağaçta hata yok; yenileme ve sonraki ölçü değişiklikleri bu döngüsel durumla devam ediyor. (E-15 hâlâ var: ağaçtaki "Ön Düzlem"e tıklanamadığı için kullanıcı grafik alanda tıklamak zorunda; ilk yakalanan da model yüzü.)
- **Betik:** `d2_misc.py` (Eskiz düzlemini değiştir bölümü)
- **Kod:** `src/main.ts:1475-1478` (`replanFor`: `planeRefFromHit` sonucu denetimsiz `commitDoc`).
- **Öneri:** Seçilen yüzün sahibi (`kernel.faceOwner`) eskizden sonraki ve ona bağımlı bir özellikse reddet; ya da `face` referansını eskizden önceki özelliklerle sınırla.

##### ✅ D2-4 — Döndür, ilişkili / ölçülü öğelerde H/V ilişkilerini siliyor ama yatay/dikey ölçüleri bırakıyor → şekil paralelkenara bozuluyor, uyarı yok
- **Önem:** Yüksek · **Tür:** Hata
- **SolidWorks:** Döndürmede "ilişkileri koru" seçeneği vardır; döndürmeyle çelişen yatay/dikey ilişki ve ölçüler kaldırılır ya da işlem uyarıyla reddedilir; şekil bozulmaz.
- **Bizde:** plaka 80×60 (H/V ilişkileri + yatay 80 / dikey 60 ölçüleri) → Eskizi düzenle → pencere seçimi (4 kenar) → **Döndür** → açı 90 → Uygula → ✓. Beklenen 60×80 (ya da uyarı). Ölçülen: H/V ilişkileri silindi, `dist:80 (sub h)` ve `dist:60 (sub v)` kaldı → çözücü 90° dönmüş dikdörtgeni yatay 80 / dikey 60'a zorladı → model bbox **85,74 × 114,26** (eğik paralelkenar), toast yok. Ölçüsüz dikdörtgende 60×80 doğru.
- **Betik:** `d2_pattern_move.py` (Döndür bölümü)
- **Kod:** `src/sketch/ops.ts:177` (yalnız H/V ilişkileri süzülüyor; `dist` ölçülerinin `sub: "h"/"v"` kısmı ya da açıya bağlı ölçüler dokunulmuyor).
- **Öneri:** Döndürmede seçili öğelerin noktalarını kullanan yatay/dikey `dist` ölçülerini ya hizalı (`sub: "a"`) ölçüye çevir (90°/270°'de h↔v değiş), ya sil ve bildir; "İlişkileri koru" seçeneği ekle.

##### ✅ D2-5 — Telefonda Kırp / Radyüs / Pah / Uzat / Ayır / Delme gibi seçim araçlarında dokunulan yer değil 70 px yukarısı işleniyor
- **Önem:** Yüksek · **Tür:** Hata (telefon kullanımı)
- **SolidWorks (mobil karşılığı yok):** Seçerek çalışan araçlarda (kırp, radyüs, pah…) parmağın dokunduğu öğe işlenmeli. İmleç kayması yalnız yeni nokta çizen araçlarda anlamlı.
- **Bizde (390×844, CDP dokunma, profil otomatik → parmak):** eskiz → **Kırp** → taşan çizgi ucuna doğrudan dokun → hiçbir şey olmadı (çizgi `[20,-45]-[20,45]` aynı). Aynı yerin **70 px altına** dokununca kırpıldı. Radyüs: köşeye doğrudan dokunma → değişiklik yok; 70 px altı → yay. Kısa dokunuşta imleç görünmediği için kullanıcı nereye işlendiğini bilemez; dokunulan yerin 70 px üstünde başka bir öğe varsa **yanlış öğe kırpılır / radyüslenir**. Ayrıca güç kırpma (sürükleyerek) telefonda "kaldırınca yerleştir"e gittiği için çalışmıyor.
- **Betik:** `d2_mobile.py` ("doğrudan dokunmak …" denetimleri)
- **Kod:** `src/main.ts:7764-7765` `sketchDrawing = tool !== "select"` → `src/viewer.ts:264-283` `activeDy = touchOffset()` her araç için; `src/sketch/editor.ts:1189` `liftMode` (trim / fillet de dahil).
- **Öneri:** `touchDrawOk` / `liftMode`'u yalnız çizim araçlarında (line, rect, circle, arc, spline, point…) aç; trim, extend, fillet, schamfer, split, convert, pierce, isect, OP_TOOLS için dokunma doğrudan (kayma yok) olsun; güç kırpmayı dokunmada da sürüklemeyle etkinleştir.

##### ✅ D2-6 — Seçimde nokta önceliği: telefonda küçük daire (ve yakın merkezli daire) çevresine dokununca merkez noktası seçiliyor; sonraki Taşı / Aynala / Sil sessizce etkisiz
- **Önem:** Orta · **Tür:** Hata / SolidWorks'ten farklı
- **SolidWorks:** İmlece en yakın öğe seçilir; çevreye dokunmak daireyi seçer.
- **Bizde:** telefonda Seç → R3 dairenin çevresine (3,18) dokun → seçim `['p15']` (merkez noktası). R10 dairenin çevresine, yakında başka bir dairenin merkezi (5 mm) varken dokun → o dairenin merkezi `p33` seçildi; bir denemede ilişki simgesi `r25` seçildi. Ardından Taşı → "Taşınacak öğeleri seçin" (model değişmedi), Aynala / Sil de etkisiz.
- **Betik:** `d2_mobile.py`
- **Kod:** `src/sketch/editor.ts:685-701` `hitTest` (tolerans içindeki herhangi bir nokta, öğeden daha yakın olmasa da önce döner; dokunmada tolerans 20 px, `:1176`).
- **Öneri:** Nokta ile öğe arasında gerçek uzaklığa göre seç (noktaya küçük bir öncelik payı verilebilir); dokunmada aday çubuğu (`offerCandidates` parça modunda var) eskizde de göster.

##### ✅ D2-7 — Dönüştür (yüz) daha önce dönüştürülmüş kenarı yineliyor; her kenar ayrı geri alma adımı
- **Önem:** Orta · **Tür:** Hata
- **SolidWorks:** Zaten eskizde olan kenar yeniden eklenmez; yüz dönüştürme tek geri alma adımıdır.
- **Bizde:** üst yüzde yeni eskiz → Dönüştür → ön üst kenar (1 çizgi) → aynı yüze dokun → **5 çizgi** (ön kenar iki kez). ✓ → Ekstrüzyon PM'i ✓ basılınca "Eskizde bir noktada ikiden fazla çizgi birleşiyor" ve PM kapanmıyor. Yüz dönüştürmeyi geri almak için 4, kenarla birlikte 5 Ctrl+Z gerekti.
- **Betik:** `d2_fillet_convert.py`
- **Kod:** `src/sketch/editor.ts:3448-3449` (`for (const e of take) this.convertEdge(e)`), `:3456-3470` `convertEdge` (uç noktalar `exact` ile birleşiyor ama aynı iki nokta arasındaki çizgi denetlenmiyor; her kenar ayrı `this.op`).
- **Öneri:** Aynı uçlara sahip çizgi / aynı merkez-yarıçaplı yay varsa ekleme; yüzdeki tüm kenarları tek `op` içinde ekle.

##### ✅ D2-8 — Aynala sonrası kaynak öğe sürüklenince serbest merkez çizgisi (ayna ekseni) dönüyor / kayıyor
- **Önem:** Orta · **Tür:** SolidWorks'ten farklı
- **SolidWorks:** Kaynak sürüklenince aynalanan öğe eksene göre hareket eder; eksen (merkez çizgisi) yerinde kalır (sürüklenen öğe dışındakiler en az hareket eder).
- **Bizde:** plaka + R8 daire (20,0) + dikey merkez çizgisi (0,−40)-(0,40) → Aynala → kaynak dairenin merkezini (25,10)'a sürükle → aynalanan daire (−22,25; 6,2), merkez çizgisi **(5,22; −39,8)-(−1,19; 39,96)** oldu (eğildi). Simetri eğik eksene göre sağlanıyor; ✓ sonrası iki delik plakaya göre simetrik değil, uyarı yok.
- **Betik:** `d2_offset_mirror.py`
- **Kod:** `src/sketch/ops.ts:109-121` `mirrorEnts` (yalnız `symmetric` ilişkisi; eksen serbest), sürükleme çözümü `editor.ts` `dragTo` (sürüklenmeyen noktalara ağırlık / sabitleme yok).
- **Öneri:** Sürüklemede seçili olmayan öğeleri geçici "tercihen sabit" (yüksek ağırlık) çöz; ya da aynalamada merkez çizgisi serbestse uyar.

##### ✅ D2-9 — Eskiz pahı serbestliği 2 artırıyor; komşu ölçü değişince pah boyutu sessizce değişiyor (E-21'in sonucu)
- **Önem:** Orta · **Tür:** Hata (sessiz geometri değişimi)
- **SolidWorks:** Pah ölçüyle gelir; komşu ölçü değişince pah boyutu korunur.
- **Bizde:** plaka 80×60 (serbestlik 2) → Eskiz Pahı 6 → serbestlik **4**, ölçü eklenmedi → ✓ (47820) → genişlik 80→90 → hacim **53604,85** (pah 6 kalsaydı 53820) → pah ~8,9 mm'ye büyüdü, uyarı yok.
- **Betik:** `d2_fillet_convert.py`
- **Kod:** `src/sketch/editor.ts:3267` `chamferAt` (ölçü / eşit mesafe ilişkisi yok). E-21 ile aynı kök; yeni olan model düzeyindeki sessiz etki.
- **Öneri:** Pahta iki kenar uzunluğu (ya da mesafe + açı) ölçüsü ekle, sanal köşeyi radyüsteki gibi koru.

##### ✅ D2-10 — Delme aracı önceden seçilen noktayı yok sayıyor; ipucu yanıltıcı
- **Önem:** Düşük · **Tür:** Hata
- **SolidWorks:** Nokta ve kenar herhangi bir sırayla seçilip Delme ilişkisi verilir.
- **Bizde:** Seç ile noktayı seç → **Delme** → kenara dokun → hiçbir şey olmuyor (araç değişince seçim temizlendi). İpucu "Önce eskiz noktasını seçin, sonra … kenarına dokunun" diyor; çalışan yol: Delme aracı açıkken noktaya, sonra kenara dokunmak. Ayrıca eskiz dik bakışta açıldığından düzlemi delen kenar uçtan nokta gibi görünür; görünümü döndürmeden seçilemez.
- **Betik:** `d2_fillet_convert.py`
- **Kod:** `src/sketch/editor.ts:443` (`setTool`: `pierce` OP_TOOLS'ta değil → `sel.clear()`), ipucu `:121`.
- **Öneri:** `pierce` için seçimi koru; kenar seçimi için dokunulan yerin yakınında, düzlemi delen kenar noktasını (kenarın izdüşümü) aday olarak göster.

##### ✅ D2-11 — "Blok olarak kaydet" geri alınamıyor
- **Önem:** Düşük · **Tür:** Hata
- **Bizde:** Seç → daire → Blok olarak kaydet → Ctrl+Z → daire hâlâ `Delik#b11` etiketli (Ctrl+Z varsa önceki adımı geri alır).
- **Kod:** `src/sketch/editor.ts:1855-1866` `saveBlock` (`e.blk = tag` doğrudan, `op` / `snapshot` yok).
- **Öneri:** `this.op(() => …)` içinde yap.

##### ✅ D2-12 — Ctrl+X (Kes) yok; Kopyala / Yapıştır eskizler arasında çalışmıyor
- **Önem:** Düşük · **Tür:** Eksik
- **SolidWorks:** Ctrl+X / Ctrl+C / Ctrl+V eskiz öğelerinde ve eskizler arasında çalışır.
- **Bizde:** Ctrl+X → hiçbir şey (3 daire kaldı). Eskiz1'de Ctrl+C → ✓ → Eskiz2'yi Düzenle → Ctrl+V → yapıştırılmadı (pano editör örneğinde, yeni editörde boş).
- **Kod:** `src/sketch/editor.ts:636-668` (`private clip` editör örneğine bağlı), `src/main.ts:8615-8616` (Kes kaydı yok).
- **Öneri:** Panoyu modül düzeyinde tut; `e.cut` = kopyala + sil.

##### ✅ D2-13 — Değişikliksiz ✓ boş bir geri alma adımı ekliyor
- **Önem:** Düşük · **Tür:** Hata
- **Bizde:** e2 Bastır → Eskizi düzenle → hiçbir şey yapmadan ✓ → Ctrl+Z → model değişmedi (48000; boş adım) — bastırmayı geri almak için ikinci Ctrl+Z gerekiyor.
- **Kod:** `src/main.ts:1716-1717` (`!isNew` ise `orig` ile karşılaştırmadan push).
- **Öneri:** `JSON.stringify(f.data) === orig` ise push etme.

##### ✅ D2-14 — Ölçekle ölçüleri sessizce siliyor; Esnet ölçüye takılınca sessizce etkisiz
- **Önem:** Düşük · **Tür:** SolidWorks'ten farklı (geri bildirim yok)
- **Bizde:** ölçülü 80×60 → pencere seçimi → Ölçekle 0,5 → 40×30 ama 80/60 ölçüleri silindi (eskiz tanımsız), bildirim yok. Ölçülü dikdörtgende sağ kenar → Esnet X 20 → Uygula → genişlik 80 kaldı, bildirim yok.
- **Kod:** `src/sketch/ops.ts:150-160` (ölçek ≠ 1'de ölçü süzme), `editor.ts:3555-3561` esnet (çözücü geri çekince sessiz).
- **Öneri:** Ölçekte ölçü değerlerini de ölçekle (SolidWorks'te ölçüler güncellenir) ya da bildir; esnet ölçüyle çelişirse "Ölçü engelliyor" uyarısı.

##### ✅ D2-15 — Güç kırpmada her kırpılan parça ayrı geri alma adımı
- **Önem:** Düşük · **Tür:** SolidWorks'ten farklı (Doğrulanmadı)
- **Bizde:** tek sürüklemede 3 parça kırpıldı → 3 geri alma adımı (`undoStack` +3).
- **Kod:** `src/sketch/editor.ts:1212-1220` (her yeni öğede `click` → `trimAt` → ayrı `op`).
- **Öneri:** Sürükleme başında tek `snapshot`, sürüklemede `op` anlık görüntüsüz.

##### ✅ D2-16 — Kırp aracında SolidWorks seçenekleri yok (köşe, içeriyi / dışarıyı kırp)
- **Önem:** Düşük · **Tür:** Eksik
- **Bizde:** Kırp PM'inde yalnız ipucu; tık = en yakına kırp, sürükle = güç kırpma. Köşe kırp (iki öğeyi seçip köşeye kadar uzat/kırp), Sınırlar içini / dışını kırp yok.
- **Kod:** `src/sketch/editor.ts:3590` `trimAt`, panel `:4800-4860` (trim için seçenek yok).

##### ✅ D2-17 — Kesişim Eğrisi komutu grafik alana dokunmayı bekliyor; yüz / düzlem seçimi yok
- **Önem:** Düşük · **Tür:** SolidWorks'ten farklı
- **Bizde:** Kesişim Eğr. → hiçbir şey olmuyor; grafik alanda herhangi bir yere dokununca eskiz düzleminin tüm katıyla kesişimi eklenir (4 çizgi). SolidWorks'te kesişecek yüzler/gövdeler seçilip ✓ ile uygulanır.
- **Kod:** `src/sketch/editor.ts:2599-2600`, `:3098` `intersectionCurve`.

##### ✅ D2-18 — Bölgeyi ikiye ayıran (uçları kenarda) çizgide hata iletisi "açık kontur" diyor
- **Önem:** Düşük · **Tür:** İleti
- **Bizde:** dikdörtgen + uçları üst/alt kenarda duran dikey çizgi (Uzat sonrası) → ekstrüzyon hatası "Eskiz açık kontur içeriyor. Uç noktaları birleştirin…". Açık uç yok; sorun paylaşılan kenar / iki bölge. SolidWorks "Seçili konturlar"ı önerir.
- **Betik:** `d2_trim.py` (BILGI satırı)
- **Öneri:** Bu durumda "Eskizde birden çok bölge var — Seçili konturlar ile bölge seçin" de.

#### Hâlâ var (ilk denetim)
- **E-4:** Ötele → taban ölçüsü 80→100 → model 69000 mm³ (beklenen 17000), ağaçta hata yok; dairede öteleme ölçüsü / ilişkisi hiç yok (`d2_offset_mirror.py`).
- **E-5:** Dönüştürülen kenarlar (taban 80→100 sonrası üst gövde 80'de kaldı, 84000), Delme ve Kesişim eğrisi `fix` ile sabit.
- **E-21:** pahta ölçü yok (etki D2-9).
- **E-23:** tohum yarıçapı değişince doğrusal örnekler R5'te kaldı.
- **E-15:** düzlem seçme modunda ağaçtaki düzleme tıklama (D2-3'ün kolaylaştırıcısı).

#### Denendi — sorun yok
Kırp (tık / güç), Uzat (+ kenar sürüklenince uç kenarda), Ötele çift yön + taban yapı, Aynala + yarıçap eşitliği, Dinamik ayna (daire + kapalı U cep), doğrusal / dairesel çoğaltma + örnek atla + seçili köşe merkez, Taşı / Kopyala / ölçüsüz Döndür / Ölçekle / Esnet, eskiz radyüsü sanal köşe + R ölçüsü + modele geçiş, Dönüştür silüet, DXF içe aktarma (tek geri alma adımı), Eskiz resmi + kenar izleme (tek geri alma adımı, belgeyle kaydediliyor), Yapı geom., Sil, pencere / kesişen / Ctrl / Ctrl+A seçimi, Ayır, Eskizi Onar, Tam Tanımla, Türetilmiş eskiz ekle / geri al; her araçtan sonra ✓ modele, kayda ve sayfa yenilemeye geçti (E-35 türü kayıp **görülmedi**); 3B radyüs / pah / kabuk eskiz araçlarından sonra doğru kenarda/yüzde kaldı, kenar yok olunca "Yeniden seç" penceresi açıldı. Konsol hatası yok.

---

## Denetim 2 — d3: İlişkiler, ölçüler, yakalama, seçim / sürükleme, 3B eskiz

Sürüm: v0.85 derlemesi (`imajcad-v97`, localhost:4173). Tarih: 2026-11-13. Ajan: d3.
Yöntem: PROTOKOL.md. Bütün kullanıcı adımları şeritten (`#cmds button[title]`), panelden, menüden, kısayoldan, gerçek fare / klavye ve telefonda CDP dokunmasıyla yapıldı. `__app` yalnız sonucu okumak ve "hazır model" kurmak için kullanıldı. Hazır model kullanılan yerler betiklerin başında yazılı.

Betikler (`/home/claude/imaj-cad/tests/e2e/denetim2/`): `d3_ortak.py` (yardımcı), `d3_iliskiler.py`, `d3_iliski2.py`, `d3_iliski_model.py`, `d3_tanim.py`, `d3_olcu.py`, `d3_olcu2.py`, `d3_olcu3.py`, `d3_yakala.py`, `d3_secim.py`, `d3_gerial.py`, `d3_3b.py`, `d3_3b_araclar.py`, `d3_3b_yol.py`, `d3_telefon.py`. Her betik tek başına çalışır ve sonunda `SONUC: TAMAM/HATA` basar. Son tam koşuda 14 betik koşuldu: 1'i TAMAM (`d3_iliski_model`), 13'ü HATA (aşağıdaki bulgular). 206 denetim geçti.

### Özet

| Önem | Sayı |
|---|---|
| Kritik | 2 |
| Yüksek | 3 |
| Orta | 10 |
| Düşük | 10 |
| **Toplam yeni bulgu** | **25** |

İlk denetimden hâlâ geçerli olanlar (yeni bulgu sayılmadı): **E-1** (Seç'te Ctrl+tık çizgi ortasına nokta + ilişki ekliyor), **E-2** (yatay çizgiye "Dikey" sunuluyor), **E-3** (3B eskizde Ctrl+Z çalışmıyor), **E-7** (ölçü etiketi fareyle sürüklenmiyor: 80 px sürüklemede 5 px), **E-30** (3B eskizde Esc çıkış penceresi açıyor; duruma bağlı: zincir bitince 2. Esc, ölçüden sonra Seç'te Esc).

En önemli 5:
1. **D3-1 (Kritik)** Eskizden çıkınca açık kalan Değiştir kutusunda Enter eskiz kaydını değiştiriyor, model yeniden oluşturulmuyor.
2. **D3-2 (Kritik)** Global değişkenle sürülen ölçü çözülemeyen değere gelince ölçü 100, geometri ve model 50 kalıyor. Uyarı yok.
3. **D3-3 (Yüksek)** "Eskizi düzenle" ✕ (vazgeç) önceki geri alma adımını siliyor. Ctrl+Z iki adım geri gidiyor.
4. **D3-4 (Yüksek)** Geri al → eskiz düzenle ✓ → İleri al: eskiz değişikliği sessizce siliniyor.
5. **D3-5 (Yüksek)** Telefonda (parmak) eskizde nokta, çizgi ve ölçü etiketi sürüklenemiyor. Tek parmak görünümü kaydırıyor.

### Kapsam matrisi

Sütunlar: a oluştur · b düzenle · c ebeveyn / eskizi yeniden aç-düzenle · d geri al / ileri al · e kayıt + sayfa yenile · f ✕ / Esc · g sil / bastır. ✓ geçti · ✗ hata (bulgu) · – uygulanamaz (neden).
Envanterde alanıma düşen komutlar (10): Seç, Akıllı Ölçü, Delme, Koord. Ölçü, Tam Tanımla, Yapı Geom., İlişkiler, Sil (Eskiz sekmesi), 3B Eskiz (Kaynaklı), Hızlı yakalama… (Araçlar menüsü / sağ tık). Hepsinin satırı aşağıda. Kapsama **10 / 10 (%100)**. Alt seçenekler (ilişki türleri, ölçü türleri, kutu seçenekleri, yakalama türleri, 3B araçlar) ayrı satır.

#### Envanter komutları
| Komut | a | b | c | d | e | f | g | Betik / not |
|---|---|---|---|---|---|---|---|---|
| Seç (tık, Ctrl+tık, pencere, kesişen) | ✓ | – | ✓ | ✓ | ✓ | ✓ boşluk / Esc temizler | ✓ Delete | d3_secim, d3_iliskiler (E-1 hâlâ, D3-15) |
| Akıllı Ölçü | ✓ | ✓ çift tık | ✓ | ✓ | ✓ | ✓ | ✓ Delete / Sil | d3_olcu, d3_olcu2, d3_olcu3 (D3-1, D3-11, D3-6) |
| Delme | ✓ | – | ✗ D3-6 | – | ✓ | – | – | d3_iliski2 (D3-23) |
| Koord. Ölçü | ✓ | – | – | – | – | – | – | d3_iliski2 (orijinden 30 / 70) |
| Tam Tanımla | ✓ | – | ✓ yeniden açınca tam | ✓ tek adım | ✓ | – | – | d3_tanim |
| Yapı Geom. | ✓ aç | ✓ kapat | – | – | – | – | – | d3_iliski2 |
| İlişkiler (göster / gizle) | ✓ | ✓ | – | – | – | – | ✓ simge + Delete (D3-15) | d3_iliskiler |
| Sil (şerit) | ✓ ölçü | – | – | ✓ | – | – | ✓ | d3_olcu3 |
| 3B Eskiz | ✓ | ✓ | ✓ | ✗ E-3 | ✓ | ✗ E-30 / ✓ Kaydetmeden çık | ✓ Delete | d3_3b, d3_3b_araclar, d3_3b_yol |
| Hızlı yakalama… (sağ tık) | ✓ Orta nokta kapat | ✓ Tümünü aç | – | – | – (oturumluk) | ✓ | – | d3_yakala |

#### İlişkiler (İlişki Ekle paneli, gerçek seçim + düğme)
Her satırda geometri koşulu ve serbestlik düşüşü sayısal olarak doğrulandı. 16 ilişkili eskiz ✓ ile kaydedildi, yeniden açıldı, iki ilişki silindi, ✓, Ctrl+Z / Ctrl+Y ve sayfa yenileme yapıldı (d3_iliskiler).
| İlişki | a | b/c | d | e | f | g | Not |
|---|---|---|---|---|---|---|---|
| Yatay (çizgi) | ✓ −1 | ✓ | ✓ | ✓ | – | ✓ panel ✕ | E-2 hâlâ: yatay çizgiye Dikey sunuluyor. Tam tanımlıda reddediliyor. |
| Dikey (çizgi) | ✓ −1 | ✓ | ✓ | ✓ | – | ✓ simge + Delete | |
| Çakışık | ✓ −2 | – | – | ✓ | – | – | |
| Birleştir (tek nokta) | ✓ −2, nokta −1 | – | – | – | – | – | |
| Orta nokta | ✓ −2 | – | – | ✓ | – | – | |
| Eşit (çizgi) | ✓ −1 | – | – | ✓ | – | – | |
| Paralel | ✓ −1 | – | – | ✓ | – | – | Çelişende reddediliyor ✓. Gereksizde eklenebiliyor (D3-8). |
| Dik | ✓ −1 | – | – | ✓ | – | – | |
| Eş doğrusal (Doğrudaş) | ✓ −2 | – | – | ✓ | – | – | |
| Teğet (çizgi–daire) | ✓ −1 | – | – | ✓ | – | – | |
| Eş merkezli | ✓ −2 | – | – | ✓ | – | – | |
| Eş yarıçaplı | ✓ −3 | – | – | ✓ | – | – | |
| Simetrik (2 nokta + merkez çizgisi) | ✓ −2 | – | – | ✓ | – | – | |
| Sabit | ✓ −2, sürüklenmez | – | – | ✓ | – | – | |
| Üzerinde (nokta–daire / nokta–çizgi) | ✓ −1 / ✓ −1 | – | – | ✓ | – | – | |
| Eşit eğri uzunluğu (çizgi–yay) | ✓ −1 | – | – | ✓ | – | – | |
| Eşit eğrilik (spline ucu–yay) | ✓ tutamak | ✗ D3-22 | – | – | – | – | Tek seferlik, ilişki değil. |
| Eşit kanallar | ✓ | – | – | – | – | – | Çözüm büyük sıçrama yapıyor (D3-16). |
| Delme | ✓ (0,20,30) | ✗ D3-6 | – | ✓ | – | – | |
| İlişkiyi sil (Mevcut ilişkiler ✕) | ✓ | – | ✓ ✓ sonrası | ✓ | ✓ | – | |
| İlişki simgesi seç + Delete | ✗ D3-15 | – | – | – | – | – | Seçime ekliyor, geometriyi de siliyor |
| Otomatik ilişkiler (çizim) | ✓ dikdörtgen H/V, ✗ D3-10 | – | – | – | – | – | |
| İlişki modelde (ekstrüzyonlu eskiz: Yatay → ✓ → sil + sürükle → ✓ → Ctrl+Z / Y → yenile → ✕ / Kaydet ve çık) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | d3_iliski_model (hepsi TAMAM) |
| Bağlam çubuğu (2B) | ✗ D3-17 | | | | | | 2B'de yok. Sağ tık menüsünde ilişki yok. |
| SketchXpert | ✗ D3-14 | | | | | | Çözülemez eskizde öneri yok. |
| Tam / eksik / aşırı durum ve renkler | ✓ eksik mavi / tam siyah, ✗ D3-7 | | | | | | Gereksizde "Tam tanımlı" yazıyor. |

#### Ölçüler
| Öğe | Sonuç | Not |
|---|---|---|
| Doğrusal hizalı / yatay / dikey (etiket konumuna göre) | ✓ 60 / 40 / 15 | |
| Açı | ✓ 30° | E-8 tekrar denenmedi |
| Çap / yarıçap, D tuşu, geri al | ✓ Ø25 → R12,5 → Ctrl+Z | |
| Yay R | ✓ R8 | |
| Nokta–çizgi | ✓ 6 | |
| Daire–daire merkez (etiket üstte → yatay) | ✓ 25 | |
| Yay koşulu En uzak | ✓ değer + 10, geometri aynı | |
| Çift mesafe (merkez çizgisinin öbür yanı) | ✓ Ø30 → 15 | |
| Zincir ölçü (farklı y) | ✓ 15 / 20 | E-9 tekrar denenmedi |
| Sanal nokta (çizgi ortası, çeyrek) | ✓ (tasarım gereği eskize nokta + ilişki ekliyor) | E-1 benzeri, yeni bulgu sayılmadı |
| Sürülen ↔ sürücü | ✓ sürülen, ✗ D3-9 | |
| Gereksiz ölçü penceresi (3 seçenek) | ✓ açılıyor, ✗ D3-7 (durum yanlış) | |
| Değiştir kutusu: çift tık / tekerlek +3 canlı / ✕ / Esc / Enter / 10*3 / ± / ⟳ | ✓ hepsi | d3_olcu |
| Değiştir kutusu: değiştirmeden Enter | ✗ D3-11 | 33,3333 → 33,333; inç 80 → 80,01 mm |
| Değiştir kutusu açıkken ✓ | ✗ D3-1 | |
| Değişken (=d1), Denklemler'de değiştir → model, geri al, yenile | ✓ 30 → 45 | |
| Çözülemez değişken | ✗ D3-2 | |
| Birim inç (etiket 3,1496", 4 in → 101,6 mm) | ✓, ✗ D3-11 | |
| Etiket sürükleme | ✗ E-7 hâlâ | |
| Model kenarına ölçü | ✓ oluşur, ✗ D3-6 | |
| Ölçü sil (Delete, şerit Sil) + Ctrl+Z | ✓ | |
| Ölçü değişikliği → model / kayıt / Ctrl+Z / Ctrl+Y / yenile | ✓ 80 → 100 | d3_olcu2 |

#### Çıkarım / yakalama
| Tür | Sonuç |
|---|---|
| Uç nokta (aynı nokta kimliği) | ✓ |
| Çizgi ortası | ✓ orta nokta, ✗ D3-10 (fazladan nokta–nokta ilişkileri) |
| Daire merkezi | ✓ |
| Çeyrek | ✓ çember üzerinde + yatay, ✗ D3-10 (aynı yatay iki kez, gereksiz) |
| Kesişim | ✓ iki "üzerinde", ✗ D3-10 (fazladan yatay) |
| Eğri üzerinde (çizgi / daire) | ✓ |
| Yatay / dikey çıkarım | ✓ |
| Dik (zincirde) | ✓ |
| Uyandırma (mavi hizalama) | ✓ (imleç titrerken) |
| Ctrl ile kapalı | ✓ (ilişki yok) |
| Hızlı yakalama filtresi | ✓ |
| Açı yakalama 15° | ✓ 32° → 30° |
| Izgara (10) | ✓ 61,7 → 60, ✗ D3-10 (ilgisiz noktalara dikey ilişki) |
| Model köşesi (üst yüzde) | ✓ sabit nokta, ✗ D3-6 (modeli izlemez) |
| Teğet çıkarımı | – E-18 (ilk denetim) |

#### Seçim ve sürükleme
| Öğe | Sonuç |
|---|---|
| Tanımsız köşe / kenar / daire kenarı / merkez sürükle | ✓ |
| Tam tanımlı sürüklenmez | ✓, ✗ D3-18 (boş geri alma adımı) |
| Sürükleme Ctrl+Z / Ctrl+Y | ✓ |
| Pencere (soldan sağa) / kesişen (sağdan sola) | ✓ |
| Ctrl ekle / çıkar, boşluk temizler, Delete + geri al | ✓ |
| Telefonda sürükleme | ✗ D3-5 |

#### 3B eskiz
| Öğe | a | b | c | d | e | f | g |
|---|---|---|---|---|---|---|---|
| Çizgi zinciri + eksen (x,z) | ✓ | ✓ | ✓ | ✗ E-3 | ✓ | ✗ E-30 | ✓ |
| Dikdörtgen / Yay (3N) / Spline (çift tık) / Nokta | ✓ / ✓ / ✓ / ✓ | – | – | ✗ E-3 | ✓ | – | – |
| Kırp | ✓ | – | – | ✗ E-3 | ✓ | – | – |
| Uzat | – (denenmedi) | | | | | | |
| İlişki: Eşit / çelişen Paralel reddi / Sabitle | ✓ / ✓ / ✓ | – | – | ✗ E-3 | ✓ | – | – |
| Gereksiz ilişki | ✗ D3-8 (3B'de de) | | | | | | |
| 3B Akıllı Ölçü boy + çift tık düzenle | ✓ 250 → 300 | ✓ | ✓ 400 | ✓ (parça) | ✓ | ✓ Kaydetmeden çık | – |
| 3B ölçü kutusu ifade | ✗ D3-12 | | | | | | |
| 3B gereksiz ölçü | ✗ D3-20 (confirm) | | | | | | |
| Yapı elemanı (3B'den) → ölçü 400 → eleman +100 → Ctrl+Z → yenile | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – |
| Süpürme yolu (dairesel profil) → ölçü 300 → +100 → Ctrl+Z → yenile | ✗ D3-13 açılış / ✓ | ✓ | ✓ | ✓ | ✓ | – | – |
| Telefonda 3B (dokunarak çizgi, bağlam çubuğu) | ✓ | – | – | – | – | – | – |

#### Telefon (390×844, CDP dokunma) — 12 öğe
| Öğe | Sonuç |
|---|---|
| Parmakla çizgi (70 px imleç kayması) | ✓ |
| Dokunarak çizgi seçimi | ✓ |
| Panelden Yatay | ✓ |
| Boşluğa dokunuş seçimi temizler, iki dokunuş iki çizgi | ✓ |
| Paralel | ✓ |
| Mevcut ilişki ✕ dokunuşu | ✓ |
| Akıllı Ölçü dokunarak + değer + ✓ | ✓ 50 |
| Ölçü etiketine dokunuş → Değiştir kutusu + + → 52 | ✓ |
| Noktayı parmakla sürükleme | ✗ D3-5 |
| İki parmak dokunuşu geri al | ✓ |
| ✓ → kayıt (ölçü + ilişkiler) | ✓ |
| 3B eskiz dokunarak 2 çizgi + bağlam çubuğu | ✓ (D3-24) |

### İş akışları
| # | Senaryo (cihaz) | Adımlar | Sonuç |
|---|---|---|---|
| W1 | Ekstrüzyonlu dörtgende ilişki (masaüstü) | Hazır model: üstü eğik dörtgen + 20 mm → Eskizi düzenle → üst kenara tık → Yatay → ✓ → model düz → yeniden aç → Yatay ✕ → köşeyi 70'e sürükle → ✓ → Ctrl+Z / Ctrl+Y → yenile → sürükle + ✕ Kaydetmeden çık → sürükle + ✕ Kaydet ve çık | ✓ hepsi (d3_iliski_model) |
| W2 | Ölçüyle levha (masaüstü) | 80×50 + 20 → D1 100 → model → Ctrl+Z / Y → 100/3 → değiştirmeden Enter → inç → açık kutuyla ✓ → Denklemler d1=30 → D2 "=d1" → Σ → d1=45 → Ctrl+Z → yenile | ✗ D3-11, D3-1. Değişken zinciri ✓ (d3_olcu2) |
| W3 | Değişkenle üçgen (masaüstü) | 30-40-=d2 üçgen → d2=100 → uyarı? → eskizi aç → SketchXpert | ✗ D3-2, D3-14 |
| W4 | 3B eskiz → yapı elemanı (masaüstü) | Zincir → Ctrl+Z → Esc → 3. çizgi → Eşit / gereksiz / çelişen Paralel → Sabitle → Akıllı Ölçü 250 → çift tık 300 → ifade → gereksiz ölçü → ✓ → Yapı Elemanı → 3B ölçü 400 → eleman uzar → Ctrl+Z / Y → yenile → ✕ Kaydetmeden çık | ✗ E-3, E-30, D3-8, D3-12, D3-20. Model zinciri ✓ (d3_3b) |
| W5 | 3B yol boyunca boru (masaüstü) | Hazır 3B eskiz → Süpürme (yalnız 3B ile) → dairesel profil + 3B yol → ✓ → 3B ölçü 300 → boru uzar → Ctrl+Z / Y → yenile | ✗ D3-13 (ilk açılış), kalan ✓ (d3_3b_yol) |
| W6 | Kutunun üst yüzünde delik konumu (masaüstü) | Üst yüze tık → Eskiz → daire → Akıllı Ölçü: merkez + model kenarı 12 → ✓ → taban genişliği 80 → 100 → eskizi aç | ✗ D3-6. Ölçü sil / Sil / Ctrl+Z ✓ (d3_olcu3) |
| W7 | Delme (masaüstü) | Kutu → Sağ düzlemde nokta → Delme → nokta → üst ön kenar → (0,20,30) → ✓ → kutu 60 → 80 | ✗ D3-6, D3-23 (d3_iliski2) |
| W8 | Geri alma geçmişi (masaüstü) | Derinlik 35 → Eskizi düzenle → ✕ → Ctrl+Z. Derinlik 35 → Ctrl+Z → eskiz 120 ✓ → Ctrl+Y. Değişikliksiz eskiz ✓ → Ctrl+Z | ✗ D3-3, D3-4, D3-19 (d3_gerial) |
| W9 | Telefonda eskiz | Parmakla 2 çizgi → dokun → Yatay → iki dokunuş → Paralel → ilişki ✕ → Akıllı Ölçü 50 → etiket + + → sürükle → iki parmak geri al → ✓ → 3B eskiz dokunarak | ✗ D3-5, kalan ✓ (d3_telefon) |
| W10 | 16 ilişkili eskiz (masaüstü) | 16 ilişki → İlişkiler gizle / göster → ✓ → yeniden aç → ✕ ile sil → simge + Delete → sürükle → ✓ → Ctrl+Z / Y → yenile | ✗ D3-15, kalan ✓ (d3_iliskiler) |
| W11 | Tanım durumları (masaüstü) | Orijinden dikdörtgen → 2 ölçü → tam → 3. ölçü "Sürücü olarak bırak" → durum → sürülen → sürücü yap → çelişen / gereksiz Paralel → Tam Tanımla (daire + çizgi) → Ctrl+Z / Y → ✓ → yenile → yeniden aç | ✗ D3-7, D3-8, D3-9, E-2 (d3_tanim) |
| W12 | Yakalama turu + model köşesi (masaüstü) | 9 yakalama türü → dik → uyandırma → Ctrl → filtre → 15° → ızgara → üst yüzde model köşesi | ✗ D3-10 (d3_yakala) |

### Bulgular

##### ✅ D3-1 — Eskizden çıkınca Değiştir kutusu açık kalıyor. Enter eskiz kaydını değiştiriyor, model yeniden oluşturulmuyor
- **Önem:** Kritik (model ile kayıt sessizce farklı) · **Tür:** Hata (E-35 türü)
- **SolidWorks'te:** Eskizden çıkınca (✓ / Eskizden çık) Değiştir kutusu kapanır. Değer ya uygulanır ya atılır. Eskiz dışında eskiz verisini değiştiren bir kutu kalmaz.
- **Bizde:** Hazır model 80×50 + 20 mm. Eskizi düzenle → D2 ölçüsüne çift tık → `70` yazılır (canlı önizleme), Enter'a basılmaz → panel ✓. Model 70 (canlı değer alındı). `.dim-prompt` ekranda kalıyor. Bu kutuya `20` yazılıp Enter'a basılınca belgede ve localStorage'da `D2 = 20`, `p4.y = 20` oluyor. Model 70'te kalıyor (yeniden oluşturma yok) ve geri alma yığınına girmiyor. Ctrl+Z 50'ye atlıyor. Sayfa yenilenince model 50 (`x9` denemesi, `d3_olcu2.py` "açık Değiştir kutusu eskizden çıkınca kapanır" HATA).
- **Betik:** `d3_olcu2.py` (bölüm 4)
- **Kod:** `src/sketch/editor.ts:247-256` `dispose()` yalnız `.dim-prompt.quick` kaldırıyor, `editDim` → `promptValue` kutusu (`.dim-prompt`, `:3962`) kalıyor. `done` geri çağrısı eskiz kapandıktan sonra `this.op` → `putData` ile `f.data`'yı (aynı nesne) değiştiriyor, `host.changed` yalnız `saveDocSoon`.
- **Öneri:** `dispose()` içinde `document.querySelectorAll(".dim-prompt, .s3-len").forEach(e => e.remove())`. Kutu açıksa ✓'de önce `apply()` ya da `cancel()` çağırın (SolidWorks: ✓ = değeri kabul et).

##### ✅ D3-2 — Global değişkenle sürülen ölçü çözülemeyen değere gelince ölçü ile geometri ayrışıyor, uyarı yok
- **Önem:** Kritik (yanlış geometri sessizce) · **Tür:** Hata
- **SolidWorks'te:** Denklem değişince eskiz çözülemiyorsa yeniden oluşturma hatası verir. Eskiz ağaçta kırmızı / "aşırı tanımlı" görünür, "Ne yanlış?" açılır.
- **Bizde:** Hazır model: üçgen (0,0)-(40,0)-(40,30), ölçüler 40, 30 ve 3. kenar `=d2` (d2 = 50). Değerlendir → Denklemler → d2 = 100 → Uygula. Kayıtta `E3.v = 100`, geometri hâlâ 50. Toast boş, ağaçta hata yok, durum "Hazır". Eskiz açılınca "Aşırı tanımlı" görünüyor ve `ok:false, conflicts:[]`.
- **Betik:** `d3_olcu2.py` (bölüm 6)
- **Kod:** `src/main.ts:343-360` `applyEquations` → `solveSketch(f.data)` dönüşü yok sayılıyor. Hata `errs`'e eklenmiyor.
- **Öneri:** `const r = solveSketch(f.data); if (!r.ok || r.conflicts.length) errs.push(\`${f.name}: ölçüler çözülemiyor\`)`. Özelliği hatalı işaretleyin (ağaçta kırmızı) ve değişikliği geri almayı önerin.

##### ✅ D3-3 — "Eskizi düzenle" ✕ (vazgeç) önceki geri alma adımını siliyor
- **Önem:** Yüksek · **Tür:** Hata
- **SolidWorks'te:** Değişiklik yapmadan çıkılan eskiz geri alma geçmişini etkilemez. Ctrl+Z bir önceki işlemi geri alır.
- **Bizde:** Hazır model 80×50 + 20. e1 → Düzenle → derinlik 35 → ✓. e1 → Eskizi düzenle → ✕ (değişiklik yok, ya da değişiklik + Kaydetmeden çık). Ctrl+Z derinliği 20'ye döndürmüyor. Bir adım daha geri gidiyor. Testte model tamamen boşaldı (`bbox = None`, hazır model öncesi durum).
- **Betik:** `d3_gerial.py` (A, A2)
- **Kod:** `src/main.ts:1708-1712` `exitSketch(false)` → `undoStack.pop()` var olan eskizde de çalışıyor. Var olan eskiz açılırken (`openSketch(f,false)`, `:2265`) yığına bir şey konmuyor.
- **Öneri:** `pop()`'u yalnız `isNew` için yapın (yeni eskiz `startSketch`'te yığına giriyor).

##### ✅ D3-4 — Geri al → eskiz düzenle ✓ → İleri al: eskiz değişikliği siliniyor
- **Önem:** Yüksek (veri kaybı, kayda da yazılıyor) · **Tür:** Hata
- **SolidWorks'te:** Yeni bir işlem yapılınca İleri al geçmişi temizlenir.
- **Bizde:** Derinlik 35 ✓ → Ctrl+Z (20) → Eskizi düzenle → genişlik 120 → ✓ (model 120) → Ctrl+Y → genişlik 80, derinlik 35. Eskiz değişikliği kayboldu (localStorage'a da yazılıyor). Ancak Ctrl+Z ile fark edilirse geri getirilebiliyor.
- **Betik:** `d3_gerial.py` (B)
- **Kod:** `src/main.ts:1716-1717` `undoStack.push(...)` sonrası `redoStack.length = 0` yok (`startSketch :1649` temizliyor).
- **Öneri:** Var olan eskiz ✓ ile kapanırken (değişiklik varsa) `redoStack.length = 0`.

##### ✅ D3-5 — Telefonda (parmak) eskizde nokta / çizgi / ölçü etiketi sürüklenemiyor
- **Önem:** Yüksek (telefonda "tanımsız geometri sürüklenir" işlevi yok) · **Tür:** Hata / eksik
- **SolidWorks'te:** (Masaüstü) Seç durumunda tanımsız geometri sürüklenir. Telefon hedefi için montajdaki B3'e (`touchGrab`) karşılık gelen davranış beklenir.
- **Bizde:** 390×844, parmak profili. Seç aracında serbest çizgi ucundan 40×30 px parmakla sürükleme yapıldı. Nokta yerinde kaldı, kamera kaydı (konum (-20.9, 15.7) → (-41.9, 31.4)). Noktanın 70 px altından sürükleme de aynı sonucu verdi. Dokunarak seçim çalışıyor.
- **Betik:** `d3_telefon.py` (adım 7)
- **Kod:** `src/main.ts:7764-7766` `touchDrawOk = sketchDrawing()` (Seç'te false), `touchGrab` yalnız montajda. `src/viewer.ts:251-264`.
- **Öneri:** Eskizde `viewer.touchGrab = (x,y) => mode.k==="sketch" && editor.tool==="select" && editor.hitAt(x,y)` gibi. Parmak altında nokta / öğe / ölçü etiketi varsa olayları düzenleyiciye verin (ikinci parmak gezinmeye dönsün).

##### ✅ D3-6 — Model kenarına verilen ölçü, Delme ve model köşesine yakalama modeli izlemiyor
- **Önem:** Orta (model değişince eskiz sessizce eski yerde) · **Tür:** SolidWorks'ten farklı. E-5 kökünün yeni yüzleri.
- **SolidWorks'te:** Model kenarına ölçü, Delme (Pierce) ve model köşesine çakışık ilişkileri modele bağlıdır. Model değişince eskiz güncellenir.
- **Bizde:** (a) Kutu üst yüzünde daire. Akıllı Ölçü ile merkez + sağ model kenarı (x=40) → 12 → merkez x=28. Taban genişliği 80 → 100 yapıldı. Daire x=28'de kaldı (beklenen 38). (b) Sağ düzlemde nokta → Delme → üst ön kenar → (0,20,30) ✓. Kutu 60 → 80 yapıldı. Nokta (−30, 20)'de kaldı (beklenen ±40). (c) Model köşesine yakalanan nokta `fix` alıyor (aynı sorun).
- **Betik:** `d3_olcu3.py`, `d3_iliski2.py` (bölüm 5), `d3_yakala.py` (son adım)
- **Kod:** `src/sketch/editor.ts:1111-1145` `ensureModelLine` / `modelLineAt` (sabit yapı çizgisi), `:3381-3385` `pierceAt` → `addRel(fix)`, `makePoint` `fixAt`.
- **Öneri:** E-5 ile birlikte: kalıcı kenar referansı (`EdgeRef {m,d,s}`) ile "kenar üzerinde" / "delme" ilişkisi saklayın, her yeniden oluşturmada izdüşümü güncelleyin.

##### ✅ D3-7 — Gereksiz (fazla) kısıtlı eskiz "Tam tanımlı" gösteriliyor. Renk ve durum değişmiyor
- **Önem:** Orta · **Tür:** SolidWorks'ten farklı
- **SolidWorks'te:** Gereksiz sürücü ölçü ya da ilişki varsa eskiz "Aşırı Tanımlı" olur. İlgili ölçü / öğeler kırmızı / sarı, durum çubuğu "Aşırı Tanımlı" gösterir.
- **Bizde:** Orijinden 50×30 dikdörtgen tam tanımlı. Üst kenara ölçü → pencere → "Sürücü olarak bırak (aşırı tanımlı)". Toast "aşırı tanımlı" diyor ama `result {ok:true, dof:0, red:['d23']}`, durum çubuğu "Eskiz1: Tam tanımlı", panel "Eskiz tam tanımlı", çizgi rengi siyah `0x111418`.
- **Betik:** `d3_tanim.py` (C)
- **Kod:** `src/sketch/editor.ts:426-433` `resolve()`, `:4079` `entColor`, `renderPanel` sonu (`pm-status`). Hepsi yalnız `conflicts` / `ok`'a bakıyor, `redundant` yok sayılıyor.
- **Öneri:** `redundant.length` > 0 ise durum "Aşırı tanımlı (gereksiz)" yazsın. Gereksiz ölçü / ilişki ve bağlı öğeler sarı / kırmızı olsun. SketchXpert gösterilsin.

##### ✅ D3-8 — Gereksiz ilişki sessizce ekleniyor (2B ve 3B)
- **Önem:** Orta · **Tür:** Hata
- **SolidWorks'te:** Zaten belirli bir ilişki eklenirse eskiz aşırı tanımlı olur ve uyarı verilir. SolidWorks gereksiz ilişkiyi sunmaz da.
- **Bizde:** 2B: iki yatay kenar seçilip Paralel → ilişki eklendi, `red:['r27']`, durum "Tam tanımlı". 3B: iki x-eksenli çizgiye Paralel → eklendi (bağlam çubuğu Paralel'i sunuyor). Zaten sabit orijin noktasına ikinci "Sabitle" eklendi (`cons3: fix, …, fix`).
- **Betik:** `d3_tanim.py` (G), `d3_3b.py`
- **Kod:** `src/sketch/editor.ts:365-412` `op()` gereksizlik denetimini yalnız yeni ölçülerde yapıyor (`:383-386`). `src/sketch/sketch3d.ts:599-640` `addRel` yalnız `resolve()` başarısını denetliyor (`dofOf` karşılaştırması yok).
- **Öneri:** İlişki eklemede de `r.redundant` artıyorsa ya da serbestlik düşmüyorsa reddedin / uyarın. `applicableRelations` / `relOptions` zaten sağlanan ilişkiyi sunmasın (E-2 ile birlikte).

##### ✅ D3-9 — Gereksiz sürülen ölçü "Sürücü ölçü yap" ile uyarısız sürücü yapılıyor
- **Önem:** Orta · **Tür:** Hata
- **SolidWorks'te:** Sürülen ölçüyü sürücü yapmak eskizi aşırı tanımlayacaksa uyarı verir ve reddeder (ya da aşırı tanımlı gösterir).
- **Bizde:** Tam tanımlı dikdörtgende üst kenar sürülen (50) eklendi → etiket seçildi → panel "Sürücü ölçü yap". Ölçü sürücü oldu, `red:['d26']`, durum "Tam tanımlı". Pencere ya da uyarı yok.
- **Betik:** `d3_tanim.py` (D)
- **Kod:** `src/sketch/editor.ts:3262-3269` `toggleRefDim` → `op`. `op` yalnız yeni kimlikli ölçüleri denetliyor (`:383`).
- **Öneri:** `toggleRefDim`'de `dimRedundant` ile denetleyin. Gereksizse `askRedundant` penceresini gösterin.

##### ✅ D3-10 — Otomatik hizalama ilişkileri yalnız koordinat eşitliğine göre ekleniyor (kılavuz yokken, Ctrl basılıyken, ızgarada). Fazla / gereksiz ilişkiler oluşuyor
- **Önem:** Orta · **Tür:** Hata / SolidWorks'ten farklı
- **SolidWorks'te:** Yatay / dikey nokta ilişkisi yalnız ekranda çıkarım çizgisi (uyandırılmış nokta) gösterilirken eklenir. Ctrl ile çıkarım kapalıyken hiç eklenmez.
- **Bizde:**
  - Çizgi ucu, A çizgisinin (y=−20, yatay ilişkisi yok) orta noktasına yakalandı → `midpoint` ile birlikte `horizontal(A.p1, yeni)` ve uzak bir noktayla `vertical(B.p1, yeni)` eklendi. A çizgisi gizlice yatay kısıtlandı.
  - Kesişime yakalamada da `horizontal(A.p1, yeni)` eklendi.
  - Çeyrek noktasında `horizontal(p21,p8)` ve `horizontal(p8,p21)` iki kez eklendi → çözücüde gereksiz (`red: ['r16','r25']`) ama durum "Tanımlanmamış".
  - Izgara (10) açıkken iki ilgisiz çizginin uçları x=60'a düştü → `vertical(p67,p71)` eklendi.
  - Ctrl basılı tutularak çizilen çizginin ucu başka noktayla aynı x'e düşünce `vertical` eklendi (`x5` denemesi).
- **Betik:** `d3_yakala.py`
- **Kod:** `src/sketch/editor.ts:2214-2222` (yeni noktada tüm noktalarla `|Δx|<1e-6` → ilişki; `noInfer` / kılavuz denetimi yok), `makePoint` çeyrek dalı `:1164` + aynı döngü (çift ekleme).
- **Öneri:** Hizalama ilişkisini yalnız `inf.guides` içinde gerçekten kullanılan (uyandırılmış) noktayla kurun. `noInfer` (Ctrl) iken hiç kurmayın. Eklemeden önce aynı (sırasız) ilişki var mı bakın.

##### ✅ D3-11 — Değiştir kutusu değeri 3 ondalığa yuvarlıyor. Değiştirmeden Enter geometriyi değiştiriyor (inçte 0,01 mm)
- **Önem:** Orta · **Tür:** Hata
- **SolidWorks'te:** Kutu belge hassasiyetinde gösterilir. Değer değiştirilmeden onaylanınca asıl değer korunur.
- **Bizde:** D1 = `100/3` (33,3333…) → tekrar çift tık → kutuda "33,333" → Enter → `33.333`. Dosya > Birim inç → 80 mm ölçü kutuda "3,15" → Enter → `80.00999999999999` mm.
- **Betik:** `d3_olcu2.py` (bölüm 2-3)
- **Kod:** `src/sketch/editor.ts:3965` `inp.value = fmtNum(cur, 3)` (inçte `cur/25.4` → 3 ondalık).
- **Öneri:** Başlangıç metnini sakla. `apply` anında metin değişmemişse `done(origValue)` ya da `cancel` çağrılsın. İnçte en az 4–5 ondalık gösterilsin.

##### ✅ D3-12 — 3B ölçü kutusu ifadeyi sessizce yanlış okuyor ("100*3+20" → 100)
- **Önem:** Orta · **Tür:** Hata
- **SolidWorks'te:** Değiştir kutusu (2B / 3B) aritmetik ve `=değişken` kabul eder.
- **Bizde:** 3B ölçüye çift tık → `100*3+20` → Enter → çizgi 100 mm oldu (beklenen 320). Uyarı yok. 2B kutusunda `10*3` doğru çalışıyor. 3B kutusunda ±, tekerlek, ⟳ ve ✕ da yok. Odak kaybında (blur) değer uygulanıyor.
- **Betik:** `d3_3b.py`
- **Kod:** `src/sketch/sketch3d.ts:922-940` `askValue` ve `:1463` `parseFloat(box.value…)`.
- **Öneri:** 2B `promptValue` / `evalNum` kullanın (ifade + değişken + inç). Geçersiz girişte kırmızı gösterin, uygulamayın.

##### ✅ D3-13 — Yalnız 3B eskiz varken Süpürme açılmıyor ("yol eskizi gerekir")
- **Önem:** Orta · **Tür:** Hata
- **SolidWorks'te:** 3B eskiz tek başına süpürme yolu olabilir (dairesel profil ile profil eskizi gerekmez).
- **Bizde:** Belgede yalnız 3B Eskiz1 (L yolu) varken ağaçta seçilip Özellikler → Süpürme → toast "Süpürme için bir yol eskizi gerekir", PM açılmıyor. Bir 2B eskiz eklenince yol listesinde 3B eskiz çıkıyor. Varsayılan yol 2B eskiz seçiliyor. Seçilince boru doğru oluşuyor ve 3B ölçü değişince güncelleniyor.
- **Betik:** `d3_3b_yol.py`
- **Kod:** `src/main.ts:1944-1946` `free = doc.features.filter(f => f.type === "sketch" …)` (sketch3d yok).
- **Öneri:** `free`'ye `sketch3d` ekleyin. Seçili 3B eskiz varsa onu yol yapın ve `circ: 20` ile başlayın.

##### ✅ D3-14 — SketchXpert çözülemeyen eskizde hiçbir öneri vermiyor
- **Önem:** Orta · **Tür:** Hata / eksik
- **SolidWorks'te:** SketchXpert "Tanıla" ile çelişen kısıtları bulur ve silinebilecek kümeleri önerir.
- **Bizde:** D3-2 senaryosundaki eskiz açılınca panelde SketchXpert var ama "Tek bir öğeyi silmek yetmiyor" diyor ve öneri yok. Çözücü `ok:false, conflicts:[], redundant:[]` döndürüyor. Oysa üçüncü ölçünün silinmesi eskizi çözer.
- **Betik:** `d3_olcu2.py` (bölüm 6)
- **Kod:** `src/sketch/editor.ts:5135-5137` `xpertSolutions`: adaylar yalnız `conflicts + redundant`.
- **Öneri:** Aday listesi boşsa tüm ölçü ve ilişkileri tek tek kaldırıp deneyin (önce ifadeli / son eklenen ölçüler). Kırmızı göstermek için çözücüde PlaneGCS "partial redundancy / conflicting" tanılamasını açın.

##### ✅ D3-15 — İlişki simgesine tık mevcut seçime ekliyor. Ardından Delete geometriyi de siliyor
- **Önem:** Orta (beklenmedik geometri silme) · **Tür:** SolidWorks'ten farklı
- **SolidWorks'te:** İlişki simgesine (Ctrl'siz) tık yalnız o ilişkiyi seçer. Delete yalnız ilişkiyi siler.
- **Bizde:** Çizgi l3 seçiliyken başka çizginin "Dikey" simgesine tıklandı → seçim `['l3','r8']`. Delete → l3 çizgisi (ve ilişkileri) ile r8 silindi.
- **Betik:** `d3_iliskiler.py`, `x4` denemesi
- **Kod:** `src/sketch/editor.ts:4660-4668` (`renderRels` tık işleyicisi `sel.add/delete`, `ctrlKey` bakmıyor).
- **Öneri:** Fare ve Ctrl / Shift yoksa önce `sel.clear()`.

##### ✅ D3-16 — "Eşit kanallar" çözümü kanalları büyük ölçüde değiştiriyor
- **Önem:** Düşük · **Tür:** SolidWorks'ten farklı (Doğrulanmadı: kök çözücü davranışı)
- **SolidWorks'te:** Çözücü en az yer değiştirmeyle sonuçlanır (bir kanal diğerine eşitlenir).
- **Bizde:** R6 (40 mm) ve R4 (25 mm) iki yatay kanal → Eşit kanallar → ikisinin yarıçapı 13,34, merkezler 36,7. Alt kanal yaklaşık 17° döndü (görüntü `/tmp/d3/s2.png`).
- **Betik:** `d3_iliski2.py`, `x16` denemesi
- **Kod:** `src/sketch/model.ts:441-460` (yay eşit + merkez çizgisi eşit), PlaneGCS çözümü.
- **Öneri:** İlişki eklerken ikinci kanalın değerlerini önce birinciye kopyalayıp sonra çözün (başlangıç tahmini). Ya da `drag` hedefleriyle ilk kanalı yerinde tutun.

##### ✅ D3-17 — 2B eskizde seçim bağlam çubuğu yok. Sağ tık menüsünde ilişki yok
- **Önem:** Düşük · **Tür:** Eksik (SolidWorks'ten farklı)
- **SolidWorks'te:** Öğe seçilince imlecin yanında ilişki düğmeleri olan bağlam araç çubuğu çıkar. Sağ tık menüsünde de ilişkiler vardır. 3B eskizde bizde var (`.s3-relbar`).
- **Bizde:** 2B'de ilişki eklemek için yalnız panel var. Sağ tık menüsü: Seç / Yapı geometrisi / Sil / Akıllı Ölçü / Hızlı yakalama / Dik / Sığdır / Eskizden çık.
- **Kod:** `src/main.ts:7546-7562` `openContextMenu` (sketch dalı). Parça `showMiniBar` yalnız `part`.
- **Öneri:** `applicableRelations` düğmelerini 3B `showRelBar` biçiminde seçimin yanında gösterin.

##### ✅ D3-18 — Kıpırdamayan sürükleme / tıklama geri alma yığınına boş adım ekliyor
- **Önem:** Düşük · **Tür:** Hata
- **Bizde:** Tam tanımlı eskizde köşe ve daire kenarı sürüklendi (hiçbir şey değişmedi). `undoStack` 7 → 9. Ardından Ctrl+Z görünürde hiçbir şey yapmıyor (Tam Tanımla geri alınmıyor, iki kez daha basmak gerekiyor).
- **Betik:** `d3_secim.py` (bölüm 5)
- **Kod:** `src/sketch/editor.ts:2820-2824` `beginDrag` her basışta `snapshot()`. `endDrag :2862` veri değişmediyse geri almıyor.
- **Öneri:** `endDrag`'de veri anlık görüntüyle aynıysa `undoStack.pop()`.

##### ✅ D3-19 — Değişiklik yapılmadan açılıp ✓ ile kapatılan eskiz parça geri alma yığınına boş adım ekliyor
- **Önem:** Düşük · **Tür:** Hata
- **Bizde:** Derinlik 35 → Eskizi düzenle → hemen ✓ → Ctrl+Z → derinlik 35 kaldı (boş adım geri alındı).
- **Betik:** `d3_gerial.py` (C)
- **Kod:** `src/main.ts:1715-1717` (`!isNew` iken koşulsuz `undoStack.push`).
- **Öneri:** `JSON.stringify(f.data) !== orig` ise ekleyin.

##### ✅ D3-20 — 3B gereksiz ölçüde tarayıcı `confirm()` penceresi (2B'deki 3 seçenekli pencere yok)
- **Önem:** Düşük · **Tür:** Tutarsızlık
- **Bizde:** Eşit ilişkili çizgiye 3B boy ölçüsü → yerel `confirm("Bu ölçü eskizi aşırı tanımlıyor…")`. "Sürücü olarak bırak" seçeneği yok. Telefonda da yerel pencere.
- **Betik:** `d3_3b.py`
- **Kod:** `src/sketch/sketch3d.ts:577`
- **Öneri:** 2B `askRedundant` penceresini ortak kullanın.

##### ✅ D3-21 — 3B bağlam çubuğu uygunsuz seçenekler sunuyor
- **Önem:** Düşük · **Tür:** SolidWorks'ten farklı
- **Bizde:** İki x-eksenli (paralel) çizgi seçilince "Paralel" ve "Açı ölçüsü" (0°) sunuluyor. Zaten sabit noktaya "Sabitle" sunuluyor ve ikinci kez ekleniyor.
- **Betik:** `d3_3b.py`
- **Kod:** `src/sketch/sketch3d.ts:693-707` `relOptions`, `:680-683`.
- **Öneri:** Mevcut eksen / ilişkiyle sağlanan seçenekleri süzün.

##### ✅ D3-22 — Eşit eğrilik tek seferlik tutamak ayarı. İlişki olarak kalmıyor
- **Önem:** Düşük · **Tür:** SolidWorks'ten farklı
- **SolidWorks'te:** "Eşit eğrilik" kalıcı bir ilişkidir. Yay değişince spline uyar.
- **Bizde:** Spline ucu + R20 yay → "≈ Eşit eğrilik" → tutamak 2,58 mm. `rels` içinde ilişki yok. Yay R 31,8'e sürüklendi, tutamak aynı kaldı (eğrilik artık eşit değil).
- **Betik:** `d3_iliski2.py`
- **Kod:** `src/sketch/editor.ts:2783-2808` `equalCurvature`.
- **Öneri:** `eqcurv` ilişki türü ekleyin. Her çözümden sonra tutamağı yeniden hesaplayın (ya da çözücüye kısıt olarak verin).

##### ✅ D3-23 — Delme aracına geçince seçim temizleniyor. "Önce noktayı seçin" ipucu yanıltıcı
- **Önem:** Düşük · **Tür:** Arayüz
- **Bizde:** Nokta seçilip şeritten Delme'ye basılınca seçim `[]` oluyor. Kenara tıklayınca "Önce bir eskiz noktası seçin" diyor. Araç içinde noktaya yeniden dokunmak gerekiyor.
- **Betik:** `d3_iliski2.py`
- **Kod:** `src/sketch/editor.ts:436` `setTool` (seçimi temizliyor), ipucu `:121`.
- **Öneri:** `pierce` aracına geçerken nokta seçimini koruyun ya da ipucunu "noktaya, sonra kenara dokunun" yapın.

##### D3-24 — Telefonda 2B çizimde dokunuş 70 px yukarıya, 3B eskizde parmağın altına yerleşiyor
- **Önem:** Düşük · **Tür:** Tutarsızlık
- **Bizde:** 2B Çizgi / Akıllı Ölçü: kısa dokunuş noktayı parmağın 70 px üstüne koyuyor. Seç'te dokunuş parmağın altındakini seçiyor. 3B eskizde Çizgi dokunuşu parmağın altına yerleşiyor.
- **Betik:** `d3_telefon.py`, `x14` / `x15` denemeleri
- **Kod:** `src/viewer.ts:264-283` (`touchDrawOk` yalnız 2B çizim araçları), 3B PM yolu ayrı.
- **Öneri:** Kısa dokunuşta (sürüklemesiz) kaydırma uygulanmasın ya da iki eskizde aynı kural kullanılsın. Büyüteç zaten konumu gösteriyor.

##### ✅ D3-25 — Telefonda eskiz açıkken orijin ve yeni geometri alt panelin arkasında kalıyor
- **Önem:** Düşük · **Tür:** Arayüz (Doğrulanmadı: arayüz ajanının alanına da girer)
- **Bizde:** 390×844'te yeni eskiz açılınca orijin ekran y≈407'de, PM alt paneli y≈430'dan başlıyor, ekran çubuğu (`.actbar`) y≈420 civarını kapatıyor. Orijin altına (eskiz y<−15) yapılan dokunuşlar panele / çubuğa gidiyor. Görünüm görünür alana göre ortalanmıyor.
- **Betik:** `x13` denemesi (`d3_telefon.py` koordinatları bu yüzden yukarıda)
- **Öneri:** `viewNormal` / `fit` telefonda alt panelin yüksekliğini düşüp görünür alanın ortasına hizalasın.

### Denendi – sorun yok (özet)
- 16 ilişki türü (yukarıdaki tablo), çelişen ilişki reddi (2B ve 3B, toast ile), Mevcut ilişkiler ✕, İlişkiler göster / gizle, Tam Tanımla (geometri kıpırdamaz, tek adım geri alınır, kayıt / yenileme).
- Akıllı Ölçü türleri, D tuşu, yay koşulu, çift mesafe, zincir (farklı y), Değiştir kutusu (tekerlek, ±, ⟳, ✕, Esc, ifade), değişken (=d1) zinciri, inç gösterimi.
- Ölçü / ilişki değişikliğinin modele, kayda, Ctrl+Z / Ctrl+Y'ye ve sayfa yenilemeye geçmesi (E-35 türü kayıp **bulunmadı**: d3_olcu2, d3_iliski_model, d3_3b, d3_3b_yol). Tek istisna D3-1 (açık kalan kutu).
- Yakalama türleri, hızlı yakalama filtresi, açı ve ızgara yakalama, model köşesine yakalama.
- Seçim: tık, Ctrl, pencere, kesişen, Delete + geri al. Tanımsız sürükleme, tanımlı sürüklenmez.
- 3B: araçlar, ölçü → yapı elemanı / süpürme güncellemesi, kayıt / yenileme, ✕ Kaydetmeden çık.
- Konsol hatası: hiçbir betikte yok.

---

## Denetim 2 — d4: Temel özellikler (ekstrüzyon, ekstrüzyon kesme, döndürme, döndürerek kesme, süpürme (+ kesme), loft (+ kesme))

Sürüm: v0.85 derlemesi (`imajcad-v97`, localhost:4173). Tarih: 2026-11-13/14. Ajan: d4.
Yöntem: PROTOKOL.md. Özellikler şeritten (`#cmds button[title]`), ağaçtan (Düzenle / Eskizi düzenle / Bastır / Sil), sağ tık / uzun basma menüsünden, PM alanlarına `fill` + Tab, segment / onay kutusu / seçim kutusu tıklamasıyla, ✓ / ✕ / Ctrl+Z / Ctrl+Y / ↶ ↷ düğmeleri gerçek basılarak yapıldı. Hedef yüz / köşe / kenar / gövde seçimleri modelde gerçek fare tıklamasıyla (telefonda Playwright tap = CDP dokunma). `__app` yalnız sonucu okumak (hacim, sınır kutusu, belge, mod) için kullanıldı. **Hazır model:** yalnız eskizler, referans düzlemleri ve gerektiğinde taban blok / sac (setDoc); bu adımlar betiklerde "hazır model" diye belirtildi. Ebeveyn eskiz değişiklikleri hep "Eskizi düzenle → ölçüye çift tık (telefonda dokunuş) → değer → Enter → ✓" ile yapıldı.

Betikler (`/home/claude/imaj-cad/tests/e2e/denetim2/`): `d4h.py` (yardımcı; d2h'den türetildi), `d4_ekst.py` (ekstrüzyon seçenekleri + tam yaşam döngüsü), `d4_ekst_ref.py` (referanslı uç / başlangıç koşulları, referans izleme, bitiş koşulu penceresi, Instant3D), `d4_kesme.py`, `d4_dondur.py`, `d4_supur.py`, `d4_supur3b.py`, `d4_loft.py`, `d4_ek.py` (seçenek birleşimleri), `d4_akis.py` (8 iş akışı), `d4_mobil.py` (telefon), `d4_sekme.py` (Sac Metal / Kaynaklı sekmelerindeki Ekst. Kesme). Hepsi tek başına çalışır, sonunda `SONUC:` basar; `ONLY=E5d,E10` gibi ortam değişkeniyle tek durum çalıştırılabilir. Bulgu içeren durumlar bilerek `HATA` verir.

### Özet

| Önem | Sayı |
|---|---|
| Kritik | 1 |
| Yüksek | 2 |
| Orta | 4 |
| Düşük | 5 |
| **Toplam yeni bulgu** | **12** |

İlk denetimden hâlâ geçerli (yeni sayılmadı): **P-7** (ebeveyn bastırılınca kesme / döndürerek kesme hata veriyor: "Kesilecek bir katı yok", "Sonrakine kadar için önce bir katı gerekir"), **P-9** (Köşeye kadar köşesi statik: blok 10→20 yapılınca silindir hâlâ y=40'ta, beklenen 50), **P-10** (dışa koniklik 80×60: 14 yüz, 100 977,8 / beklenen 100 981,0), **P-11** (Yön 2 yalnız Kör / Tümünden geçen; koniklik Orta düzlem / Tümünden / Sonrakine'de gizli), **P-19** (Ekst. Kesme varsayılanı Tümünden geçen), **P-21** (eksen profili kesince ve eksenden taşan ince döndürmede "Geometri işlemi başarısız (OpenCascade hatası)"; 40° iç koniklikte İngilizce "Trying to sketch an empty drawing"), **P-35** (döndürme ekseni yalnız eskiz çizgileri), **P-38** (alt düzlemdeki eskizden kör kesme ve "yönü ters çevir"li kör 8 kesme sessizce malzeme tarafına çevriliyor).

**E-35 düzeltmesi bu alanda sağlam:** "Eskizi düzenle → ölçüye çift tık → ✓" zinciri ekstrüzyon, kesme, döndürme, döndürerek kesme, süpürme (profil ve çocuk satırdan yol), loft (çocuk satırdan profil), sac normal kesim ve telefonda doğrulandı; model, localStorage, Ctrl+S dosyası ve sayfa yenileme hep yeni değerde.

En önemli 5:
1. **D4-1 (Kritik)** İnce ekstrüzyonda "Uçları kapat" + "Başla: Yüzey / yüz" (ya da Köşe): kapaklar seçilen yüzde değil, eskiz düzleminde oluşuyor. Yanlış geometri, uyarı yok.
2. **D4-2 (Yüksek)** Dışa koniklik kare profilde (60×60, 40×40, 100×100) hep OCC hatası. Var olan ekstrüzyonun eskizi kareye çevrilince model kayboluyor.
3. **D4-3 (Yüksek)** İnce özellik kalınlığı profili aşınca (20×20, içe 15) hata yok; iç döngü tersine dönüyor, 6 000 mm³'lük anlamsız gövde "Hazır" diye oluşuyor.
4. **D4-4 (Orta)** Düzenlemede kaynak eskiz değiştirilince eski "Seçili konturlar" seçimi kalıyor. Yeni eskiz tek bölgeliyse seçimi kaldıracak kutu yok: "Seçili kontur bulunamadı", ✓ yapılamıyor.
5. **D4-5 / D4-6 (Orta)** Süpürme: yalnız 3B eskiz varken komut açılmıyor. Profil + 3B yolda varsayılan yol yanlış seçiliyor. 3B yolda "Burulma açısı" alanı gösteriliyor ama sessizce yok sayılıyor.

### Kapsam matrisi

Sütunlar: a oluştur (+ sayısal doğrulama) · b ağaçtan Düzenle → parametre → ✓ · c ebeveyn eskizi düzenle (çift tık ölçü → ✓) / referans değişince izleme · d Ctrl+Z / Ctrl+Y · e localStorage + sayfa yenile · f PM ✕ (Kaydetmeden çık / Kaydet ve çık) · g bastır / sil. ✓ geçti · ✗ hata (bulgu) · – uygulanamaz / denenmedi (neden).

Envanterde alanıma düşen komutlar: Özellikler sekmesi: Ekstrüzyon, Ekst. Kesme, Döndürme, Dönd. Kesme, Süpürme, Loft. Sac Metal sekmesi: Ekst. Kesme. Kaynaklı sekmesi: Ekst. Kesme. Toplam 8; **8 / 8 satır var**. Yüzey Ekstrüzyon / Yüzey Loft yüzey ajanının alanı, burada yok.

#### Envanter komutları
| Komut | a | b | c | d | e | f | g | Betik / not |
|---|---|---|---|---|---|---|---|---|
| Ekstrüzyon (Özellikler) | ✓ 72 000, önizleme değerle güncel | ✓ 25 → 120 000 | ✓ 80→100 → 150 000 | ✓ 4 adım | ✓ | ✓ Kaydetmeden çık; ✓ Kaydet ve çık (180 000) | ✓ bastır / etkinleştir / sil + geri al | d4_ekst E1 |
| Ekst. Kesme (Özellikler) | ✓ 89 716,81 | ✓ kör 5 | ✓ Ø20→Ø30 | ✓ | ✓ | ✓ (önizleme 12 idi, değişmedi) | ✓ bastır; eskiziyle sil; ebeveyn bastırılınca P-7 | d4_kesme K1 |
| Ekst. Kesme (Sac Metal sekmesi) | ✓ aynı komut, delik | – (aynı PM) | – | – | – | – | – | d4_sekme |
| Ekst. Kesme (Kaynaklı sekmesi) | ✓ aynı komut, delik | – | – | – | – | – | – | d4_sekme |
| Döndürme | ✓ 28 274,33 | ✓ 90° → 7 068,58 | ✓ genişlik 10→15 → 12 370,02 | ✓ | ✓ | ✓ | ✓ | d4_dondur D1 |
| Dönd. Kesme | ✓ π·100·5 | ✓ 180° | ✓ R10→R15 → 1 767,15 | ✓ | ✓ | ✓ | ✓ bastır / eskiziyle sil | d4_dondur DK |
| Süpürme (+ Kes) | ✓ 3 926,99 | ✓ dairesel ↔ eskiz profili | ✓ profil Ø10→16, yol 50→80 (çocuk satırından) | ✓ | ✓ | ✓ | ✓ bastır; sil (eskizleriyle) + geri al | d4_supur S1, S8 (ad ✗ D4-8) |
| Loft (+ Kes) | ✓ 28 000 | ✓ düz yüzeyli | ✓ Profil2 (çocuk) 20→30 → 32 000 | ✓ | ✓ | ✓ | ✓ bastır; sil (eskizler kalır) | d4_loft L1, L10 (ad ✗ D4-8) |

#### Ekstrüzyon / Ekst. Kesme — PM seçenekleri
| Seçenek | a | b | c / izleme | d | e | f | Not |
|---|---|---|---|---|---|---|---|
| Kör | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | E1, K1 |
| Yönü ters çevir | ✓ y −20..0 (önizleme de) | ✓ kaldır | – | – | – | – | E2; kesmede P-38 (K12) |
| Orta düzlem | ✓ 30 → y ±15 | – | ✓ 60→40 | – | ✓ | – | E3, K2 |
| Tümünden geçen | ✓ (kesme) | ✓ | ✓ | ✓ | ✓ | ✓ | K1; ilk özellikte P-18 |
| Sonrakine kadar | ✓ 57 424,78 | – | ✓ blok yukarı taşınınca 0..40 | – | – | – | R1, K3, W2 |
| Köşeye kadar | ✓ h=40 | – | ✗ P-9 (statik köşe) | – | – | – | R4, K9 |
| Yüzeye kadar | ✓ h=40 | – | ✓ blok 10→20 → h=50; düzlem 30→50 → h=60 | ✓ | ✓ | – | R2, K8 (basamak 10→15 → π·25·15 ✓), X7 koniklikle ✓ |
| Yüzeyden ötele | ✓ 5 → h=35 | ✓ −5 → h=45 (ters öteleme) | ✓ K8b | – | – | – | R3; "Yüzeyi taşı" seçeneği yok (D4-12) |
| Gövdeye kadar | ✓ h=30 | – | ✓ gövde taşınınca h=40 | – | – | – | R5; kesmede K10 |
| Başla: Eskiz düzlemi | ✓ | – | – | – | – | – | varsayılan |
| Başla: Yüzey / yüz | ✓ y 40..50 | – | ✓ blok 20 → y 50..60 | – | ✓ | – | R6, W3 (boru ucu, yol 60→90 → flanş 90..95 ✓); ince + kapak ✗ D4-1; Instant3D oku yanlış yerde D4-10 |
| Başla: Köşe | ✓ y 40..50 | – | – | – | – | – | R7 |
| Başla: Öteleme | ✓ y 10..30 | ✓ −5 | – | – | ✓ | – | E7, X2 |
| Ekstrüzyon yönü (kenar) | ✓ 45° kenar, derinlik normal doğrultuda (hacim A·20) | – | – | – | – | – | R8 (SW'de derinliğin nasıl ölçüldüğü doğrulanmadı) |
| Büküm açısı | ✓ 30° hacim 96 000 | – | – | – | – | – | E6; orta düzlemle X5 ✓ |
| Koniklik iç | ✓ kesik piramit hacmi tam, 6 yüz | ✓ | ✓ | – | – | – | E5; kesmede K5 ✓ |
| Koniklik dış | ✗ P-10 (80×60), ✗ D4-2 (kare) | ✓ | ✗ D4-2 (eskiz kareye → model yok) | – | – | – | E5, E5d; kesmede dış K5b ✓ |
| Yön 2 (kör / tümünden) | ✓ 144 000 | ✓ 5 → 120 000 | – | ✓ | – | – | E4; kesmede K7 (π·25·60 ✓) |
| İnce: tek / ters / orta / iki yön | ✓ 11 520 / 10 880 / 11 200 / 27 600 | – | ✓ | ✓ | ✓ | – | E8; aşırı kalınlık ✗ D4-3 |
| İnce: köşeleri yuvarla | ✓ 11 313,98 | – | – | – | – | – | E8 |
| İnce: uçları kapat | ✓ 30 720 | – | ✓ 80→100 → 37 120 | ✓ | ✓ | – | E8, X2 (ters + öteleme ✓); Başla: yüz ✗ D4-1 |
| İnce: açık kontur | ✓ çizgi 60 × t4 × 20 = 4 800 | – | – | – | – | – | E8b |
| İnce kesme | ✓ halka 2 764,6 | – | – | – | – | – | K6 |
| Seçili konturlar | ✓ 24 000, iki bölge 2 gövde | ✓ Bölge 1'e geç | ✗ D4-4 (eskiz değişince) | – | – | – | E9 (paylaşılan eskiz ✓ 36 000), X8 (ince ile ✓ 5 920) |
| Sonucu birleştir | ✓ kapalı → 2 gövde | ✓ açınca 1 gövde | – | – | – | – | E10 |
| Malzeme ekle ↔ Kes (segment) | ✓ | ✓ | – | – | – | – | E10 (kesmeye çevrilince P-38) |
| Kesme tarafını çevir | ✓ yalnız Ø20×20 kalır | ✓ kaldır | – | – | – | – | K4 |
| Normal kesim (sac) | ✓ π·25·2 | – | ✓ Ø10→Ø20 | – | – | – | K11 |
| Instant3D oku (PM, parça modu, telefon) | ✓ PM 50 mm; ✓ parça modu + geri al; ✓ telefon parmakla 24 mm | – | – | ✓ | – | – | R10, W6 (kesmede ✓), M6 (telefonda üst görünümde ok gizli → İzo'ya basınca çıkıyor, doğru davranış) |
| Bitiş koşulunu değiştir… (sağ tık / uzun basma) | ✓ orta düzlem, derinlik 30 | – | – | ✓ 2 adım geri | – | ✓ Kapat | R9; telefonda menü maddesi var (ekran görüntüsü), M7 betikte kararsız |
| Ondalık virgül / işlem | ✓ "12,5", "100/4" | – | – | – | – | – | X3 |

#### Döndürme / Dönd. Kesme
| Seçenek | a | b | c | d | e | f | g | Not |
|---|---|---|---|---|---|---|---|---|
| Eksen: merkez çizgisi (otomatik) | ✓ | – | ✓ | ✓ | ✓ | ✓ | ✓ | D1 |
| Eksen: başka eskiz çizgisi | ✓ Ø20×30 silindir | – | – | – | – | – | – | D4; model kenarı / ref. eksen yok (P-35) |
| Açı | ✓ 90° | ✓ | – | – | – | – | – | 400° → 360°'ye sınırlanıyor (D6) |
| Orta düzlem | ✓ ±z simetrik | ✓ | – | – | – | – | – | D2 |
| Yönü ters çevir | ✓ | ✓ | – | – | – | – | – | D2 |
| Yön 2 / Köşeye, yüzeye kadar | – | – | – | – | – | – | – | yok (P-35, D4-12) |
| İnce (tek / ters / orta) | ✓ 7 916,81 / 7 162,83 / 7 539,82 | – | ✓ yükseklik 40 | – | – | – | – | D5; kesmede DK2 ✓ (eksenden taşarsa genel hata, P-21) |
| Seçili konturlar | – | – | – | – | – | – | – | grup var, ekstrüzyonla aynı kod (denenmedi) |
| Sonucu birleştir | ✓ | – | – | – | – | – | – | D7 |
| Eksensiz eskiz | ✓ "Döndürme ekseni için eskize bir merkez çizgisi çizin", PM açık kalır | | | | | | | D6 |

#### Süpürme
| Seçenek | a | b | c | d | e | f | Not |
|---|---|---|---|---|---|---|---|
| Eskiz profili + eskiz yolu | ✓ | ✓ | ✓ profil ve yol | ✓ | ✓ | ✓ | S1 |
| Dairesel profil (çap / iç çap) | ✓ 2 513,27 | ✓ | – | – | – | – | S1, W3 boru |
| Profil yönelimi: yolu izle / normali sabit | ✓ 4 112,34 / 3 926,99 | ✓ | – | ✓ | – | – | S2 (R100 30° yay; değerler analitik) |
| Burulma | ✓ 90° → 10 000 | – | ✓ profil 20→30 → 15 000 | – | – | – | S3; 3B yolda ✗ D4-6 |
| Kılavuz eğri | ✓ 9 162,98 (π∫r² = 9 163,0) | – | – | – | – | – | S4; tek kılavuz (D4-12) |
| Helis / yay | ✓ 4 752,39 (π·4·L) | ✓ hatve 15 | ✓ taban Ø40→Ø60 | – | – | – | S5; sol el ✓, konik ✓ |
| Katı gövde (takım) | ✓ 13 570,8 | ✓ küresel uç 12 796,1 | – | – | – | – | S6 |
| 3B eskiz yolu | ✗ D4-5 (yalnız 3B eskizle komut açılmıyor) | – | – | – | ✓ | – | d4_supur3b; profil + 3B yol 20 000 ✓ |
| Kes (süpürmeli kesme) | ✓ 88 000 | – | – | – | – | – | S8 (ad ✗ D4-8) |
| İnce süpürme / teğetlik / birleştir | – | – | – | – | – | – | yok (D4-12) |

#### Loft
| Seçenek | a | b | c | d | e | f | g | Not |
|---|---|---|---|---|---|---|---|---|
| İki profil | ✓ 28 000 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | L1 |
| Üç profil, seçim sırası | ✓ 56 000 düz / 44 800 düzgün | – | – | – | – | – | – | L2 |
| Düz yüzeyli | ✓ | ✓ | – | – | – | – | – | L1, L2 |
| Kapalı loft | ✓ iki profilde anlamlı hata | – | – | – | – | – | – | L3; kendini kesen dizilimde ✗ D4-11 |
| İnce | ✓ 7 056,13, 10 yüz | ✓ t1 → 3 661,4 | – | – | – | – | – | L4, W4 |
| Merkez çizgisi | ✓ 28 000, çocuk satırı | – | – | – | – | – | – | L5 (PM ✗ D4-9) |
| Kılavuz eğriler | ✓ düz 28 000; dışa kırık 50 945,72, x 25,67 | – | – | – | – | – | – | L6 |
| Bağlayıcılar | ✓ köşe 1 → 20 000 | ✓ korunur, kapat → 28 000 | – | – | – | – | – | L7 |
| Başlangıç / bitiş: profile dik + teğet uzunluğu | ✓ değerlere tepki | – | – | – | ✓ | – | – | L8; "Komşu yüzlere teğet" pf5'te |
| Sac geçiş parçası + DXF | ✓ DXF indi, ince katı | – | – | – | – | – | – | L9 |
| Kes (loft kesme) | ✓ 3 500 | ✓ düz yüzeyli | ✓ alt profil 10→4 | ✓ | – | – | – | L10 (ad ✗ D4-8) |

#### Telefon (390×844, dokunmatik) — 7 özellik
| Özellik | Sonuç | Not |
|---|---|---|
| Ekstrüzyon (tepsiden), Düzenle, Eskizi düzenle, ↶ ↷, yenile | ✓ 72 000 → 120 000 → 150 000 | 80 ölçüsü alt panelin arkasında ✗ D4-7 (▾ ile panel küçültülünce dokunulabildi) |
| Ekst. Kesme + Düzenle | ✓ | M2 |
| Döndürme 90° | ✓ | M3 |
| Süpürme + dairesel profil segmenti | ✓ | M4 |
| Loft | ✓ 28 000 | M5; çocuk eskiz ölçüsü panel arkasında (D4-7) |
| Instant3D parmakla | ✓ 24 mm, model eşleşir | M6 |
| Uzun basma → Bitiş koşulunu değiştir… | ✓ menüde görüldü (tanı ekran görüntüsü) | M7 betikte zamanlama kararsız |

### İş akışları

| # | Senaryo (cihaz) | Adımlar | Sonuç |
|---|---|---|---|
| W1 | Plaka + delik (masaüstü) | Ekstrüzyon 10 → üst yüze Ø10 kesme (tümünden) → plaka eskizi 80→120 → kalınlık 25 → Ctrl+S dosyası → geri al ×3 / ileri al ×3 → yenile | ✓ delik her adımda boydan boya (178 036,5), Ctrl+S dosyası d1 = 25 ve genişlik 120, yenileme aynı |
| W2 | Burç + flanş deliği (masaüstü) | Döndürme profili → flanşa Ø6 kesme "Sonrakine kadar" → iç çap ölçüsü → açı 180 → döndürmeyi bastır / etkinleştir | ✓ (bastırınca P-7) |
| W3 | Boru + uç flanşı (masaüstü) | Dairesel profilli süpürme Ø20/16 → flanş ekstrüzyonu "Başla: yüz" (boru ucu) → yol 60→90 | ✓ flanş y 60..65 → 90..95'e gidiyor (başlangıç yüzü referansı izleniyor) |
| W4 | Huni (masaüstü) | Kare → daire ince loft → alt daire Ø20→Ø30 → geri al | ✓ |
| W5 | Kademeli mil + kanal (masaüstü) | Döndürme (eksen = profil kenarı) → döndürerek kesme kanal → 90° → mili bastır → yenile | ✓ 40 840,7 / kanal 703,72 / 175,92 (bastırınca P-7) |
| W6 | Kutu + cep (masaüstü) | Blok → cep kesme kör 12 → blok 20→30 → Instant3D ile cep 18 → geri al | ✓ cep üst yüzle taşınıyor (134 400), Instant3D 129 600, geri al 12 |
| W7 | Kayıt bütünlüğü (masaüstü) | PM açıkken yenile; eskizde değişiklikten sonra ✓'siz yenile | ✓ taslak yazılmıyor; eskiz yerinde değiştiği için yenilemede yeni değer modelle tutarlı (120 000 / 100) |
| W8 | Hata kurtarma (masaüstü) | İç koniklik 40° (profil kapanıyor) → 5°'ye düzelt → ince 15 içe → 2'ye düzelt → ✓ | Koniklik: hata + kilit yok ✓ (mesaj İngilizce, P-21). İnce 15: ✗ D4-3 |
| M1–M7 | Telefon akışları | yukarıdaki tablo | ✓ (D4-7) |

### Bulgular

##### ✅ D4-1 · İnce + "Uçları kapat" + "Başla: Yüzey / yüz" (ya da Köşe): kapaklar eskiz düzleminde oluşuyor
- **Önem:** Kritik (yanlış geometri, sessiz) · **Tür:** Hata
- **SolidWorks:** Başlangıç koşulu Yüzey / Köşe olan ince özellikte kapaklar ince gövdenin iki ucundadır, başlangıç yüzünden ölçülür.
- **Bizde:** Hazır model: 80×60×20 blok "Blok" + Üst düzlemde 40×40 Eskiz2. Ekstrüzyon → Başla = Yüzey / yüz → blok üst yüzüne tık (✓ "Başlangıç yüzü ✓") → "Sonucu birleştir" kapalı → İnce özellik, Ters yön, t 2 → "Uçları kapat" (2) → ✓. Sonuç: **4 gövde, 108 480 mm³**, sınır kutusu y 0..40. Beklenen 96 000 + (40·40·20 − 36·36·16) = 107 264, kapaklar y 20..22 ve 38..40'ta. Duvar 20..40'ta, kapaklar ise eskiz düzlemine göre y 0..2 ve 18..20'de (bloğun içinde) oluşuyor. Hata / uyarı yok. Aynı yöntem "Başla: Öteleme"de doğru çalışıyor (X2: y −10..10 ✓).
- **Betik:** `d4_ek.py` X1.
- **Kod:** `src/doc/compile.ts:343-348`. Kapak özellikleri `startOff: so` ile kuruluyor; `fromFace` / `fromVtx` / `dirVec` / `twist` / `draft` kapaklara aktarılmıyor.
- **Öneri:** Kapak kfeature'larına `fromFace`, `fromVtx` (ve `dirVec`) ekle, öteleme bunlara göre (`so` + `sg·(d1 − cap)`) hesaplansın. Ya da çekirdekte kapakları ana ince gövdenin uç düzlemlerinden üret. Desteklenmeyen birleşimlerde (koniklik, büküm) hata ver.

##### ✅ D4-2 · Dışa koniklik kare profilde hep başarısız; var olan özellik eskiz kareye dönünce model kayboluyor
- **Önem:** Yüksek · **Tür:** Hata (P-10 ile aynı kök, yeni ve daha ağır belirti)
- **SolidWorks:** 60×60 kare, 20 mm, 5° dışa koniklik → kesik piramit (6 düzlemsel yüz, 76 281,1 mm³).
- **Bizde:** Üst düzlemde 60×60 eskiz → Ekstrüzyon → Koniklik 5 → Dışa doğru → durum "Geometri işlemi başarısız (OpenCascade hatası)", ✓ reddediliyor. 40×40 ve 100×100'de de aynı. Dikdörtgende çalışıyor: 80×60 → 100 977,8 (P-10), 60×40 → 51 576,5. Daire dışa → 27 395,7. Kalıcı etki: 80×60 dışa konik ekstrüzyon oluşturulup "Eskizi düzenle" ile 80 → 60 yapılınca ✓ sonrası **model tümüyle kayboluyor** (hacim yok, ağaçta "Geometri işlemi başarısız"). İç koniklik karede doğru (E5d).
- **Betik:** `d4_ekst.py` E5, E5d; tanı `/home/claude/d4tmp/p3.py`.
- **Kod:** `src/kernel.worker.ts:337-341` `profile(f.loops).offset(off, { lineJoinType: "miter" })` + `loftWith(s2, { ruled: true })`. Dışa ötelemede köşelere ek parçalar çıkıyor (P-10: 14 yüz). Karede kenar sayısı / başlangıç köşesi eşleşmesi bozulunca ThruSections başarısız oluyor.
- **Öneri:** Çokgen profilde öteleme köşelerini elle hesapla (kenar doğrularını ötele, kesiştir; segment sayısı aynı kalsın), ya da düz ekstrüzyon + `BRepOffsetAPI_DraftAngle` (nötr düzlem = eskiz düzlemi) kullan. P-10 da birlikte düzelir.

##### ✅ D4-3 · İnce kalınlık profili aşınca hata yok, anlamsız gövde oluşuyor
- **Önem:** Yüksek · **Tür:** Hata (sessiz yanlış geometri)
- **SolidWorks:** 20×20 kapalı profilde içe 15 mm ince özellik reddedilir ("kalınlık çok büyük").
- **Bizde:** 20×20 eskiz → Ekstrüzyon 20 → İnce özellik → Kalınlık 15 → Ters yön (içe). Durum "Hazır · 15 ms", **6 000 mm³**: iç döngü tersine dönüp 10×10 "delik" sayılıyor (400 − 100 = 300 mm² × 20). Uyarı yok, ✓ kabul ediyor. 2'ye düzeltince doğru (2 880).
- **Betik:** `d4_akis.py` W8.
- **Kod:** `src/sketch/profile.ts:298-317` `thinRegion`. İçe `offsetSegs` sonucunun yönü / alanı denetlenmiyor.
- **Öneri:** İç döngünün işaretli alanı dış döngüyle aynı yönde ve daha küçük olmalı; değilse "İnce kalınlık profil için çok büyük" hatası at. Açık konturda da kendini kesme denetimi ekle.

##### ✅ D4-4 · Düzenlemede kaynak eskiz değişince eski "Seçili konturlar" seçimi kalıyor, kaldırılamıyor
- **Önem:** Orta · **Tür:** Hata
- **SolidWorks:** Kaynak eskiz değişince seçili konturlar listesi temizlenir. Yeni eskiz tek bölgeliyse tamamı kullanılır.
- **Bizde:** İki dikdörtgenli Eskiz1 + tek dikdörtgenli Eskiz2 (hazır). Ekstrüzyon → Bölge 2 → ✓. Ağaçta Düzenle → Eskiz = Eskiz2 → durum "Seçili kontur bulunamadı", model yok. PM'de "Seçili konturlar" grubunda yalnız "Eskizde tek bölge var." yazıyor, kaldırılacak kutu yok. ✓ reddediliyor. Kullanıcı ancak eski eskize geri dönüp Bölge 2'yi kaldırıp yeniden Eskiz2'yi seçerek kurtulabiliyor.
- **Betik:** `d4_ek.py` X9.
- **Kod:** `src/main.ts:2277` `sketchSel` onChange (`d.sketch = v`, `d.contours` silinmiyor); `src/main.ts:2297` tek bölgede yalnız ipucu.
- **Öneri:** Eskiz değişince `d.contours = undefined` yap ve PM'i yeniden çiz. Tek bölgede de var olan seçimi "Seçimi temizle" ile göster.

##### ✅ D4-5 · Süpürme: yalnız 3B eskiz yol varken komut açılmıyor; profil + 3B yolda varsayılan yol yanlış
- **Önem:** Orta · **Tür:** Hata / SolidWorks'ten farklı
- **SolidWorks:** 3B eskiz yol olarak seçilebilir. Profil olmadan dairesel profil seçeneğiyle süpürme yapılabilir.
- **Bizde:** Hazır model: yalnız "3B Yol" 3B eskizi. Şerit → Süpürme → toast "Süpürme için bir yol eskizi gerekir", PM açılmıyor. Profil eskizi + 3B yol varken PM açılıyor ama "Yol" = **Profil** (kapalı eskiz) ve "Dairesel profil" seçili geliyor. Kullanıcı yolu 3B eskize, profili "Eskiz profili"ne kendisi çevirmeli; çevirince doğru (20 000 mm³, yenilemede kalıcı). v0.71 (3B yol) yalnız setDoc ile test edilmişti (wl1).
- **Betik:** `d4_supur3b.py` SB1, SB2.
- **Kod:** `src/main.ts:1944-1951` `newFeature("sweep")` yalnız 2B `sketch` özelliklerini sayıyor. `sketch3d` ve `pathSk` seçiminde 3B eskizler yok.
- **Öneri:** Aday yol listesine `sketch3d`'yi kat (açık 2B eskiz yoksa son 3B eskiz). Kapalı tek eskiz varsa onu profil say, yolu boş bırakıp kullanıcıdan iste.

##### ✅ D4-6 · 3B yolda "Burulma açısı" alanı gösteriliyor ama sessizce yok sayılıyor
- **Önem:** Orta · **Tür:** Hata (alan etkisiz)
- **SolidWorks:** 3B yolda da profil burulması (twist) uygulanır.
- **Bizde:** Profil (20×10 dikdörtgen) + 3B yol (iki çizgi). Süpürme → Burulma açısı 90 → önizleme ve ✓ sonrası hacim 20 000 ve sınır kutusu (z ±5) değişmiyor, uyarı yok. Kodda kılavuz eğri de aynı nedenle 3B yolda yok sayılıyor (denenmedi).
- **Betik:** `d4_supur3b.py` SB3.
- **Kod:** `src/doc/compile.ts:367-371`. 3B yol dalı kfeature'a `twist` / `guide` aktarmıyor. `src/main.ts` süpürme PM'inde alanlar yalnız `!d.helix` koşuluyla gösteriliyor.
- **Öneri:** `sweepStations`'ı `path3` teli için de çalıştır, ya da 3B yol seçiliyken burulma / kılavuz alanlarını gizle.

##### ✅ D4-7 · "Eskizi düzenle" görünümü ölçü etiketlerini ve paneli hesaba katmıyor (telefonda etiket alt panelin arkasında)
- **Önem:** Orta · **Tür:** SolidWorks'ten farklı / kullanılabilirlik
- **SolidWorks:** Eskiz düzenlemeye girince görünüm eskiz ve ölçülerini görünür alana sığdırır.
- **Bizde:** Telefonda (390×844) 80×60 plakanın ekstrüzyonunda Eskizi düzenle: 80 ölçüsünün etiketi (y ≈ 537 px) alt PM panelinin arkasında (`elementFromPoint` = panel). Dokunuş panele gidiyor, Değiştir kutusu açılmıyor. ▾ ile panel küçültülünce dokunulabiliyor. Masaüstünde Ø10 profil dairesinin Ø etiketi şerit grubunun altında kalıyor (dokunuş "cmd" düğmesine gidiyor), tekerlekle uzaklaşmak gerekiyor (`/home/claude/d4tmp/s1dim.png`, `/home/claude/d4tmp/m1.png`).
- **Betik:** `d4_mobil.py` M1c; tanı `/home/claude/d4tmp/p5.py`, `/home/claude/d4tmp/p7.py`.
- **Kod:** `src/main.ts:7003-7009` `fitAll`. `editor.bounds()` ölçü etiketi konumlarını (`lp`) içermiyor. `viewer.fitBox` tuvalin tamamına sığdırıyor; telefonda `#side.pm-open` panelinin, masaüstünde üst şeridin örttüğü alan düşülmüyor.
- **Öneri:** Sınır kutusuna ölçü etiketlerini kat. Sığdırmada görünür tuval alanını (alt panel / şerit hariç) kullan.

##### ✅ D4-8 · Süpürmeli / loft kesme "Süpürme1" / "Loft1" adını alıyor; ayrı komut yok
- **Önem:** Düşük · **Tür:** SolidWorks'ten farklı
- **SolidWorks:** "Swept Cut" / "Lofted Cut" ayrı komutlar; ağaçta "Kesme-Süpürme1", "Kesme-Loft1".
- **Bizde:** Şeritte yalnız Süpürme / Loft var. PM'de "Kes" segmentiyle oluşturulan kesme ağaçta "Süpürme1" / "Loft1" adını alıyor. Ekst. Kesme ve Dönd. Kesme "Kesme-…" adı alıyor. `FEAT_NAMES` içinde `cutLoft: "Kesme-Loft"` tanımlı ama kullanılmıyor.
- **Betik:** `d4_supur.py` S8a, `d4_loft.py` L10a.
- **Kod:** `src/main.ts:2242` `nextName(kind)`. PM'in açıldığı komut adı kullanılıyor.
- **Öneri:** `nextName(kindOf(draft))`. Şeride "Süpürmeli Kesme" / "Loft Kesme" komutlarını ekle.

##### ✅ D4-9 · Loft PM'inde merkez çizgisi / kılavuz seçilince "Bağlayıcılar" grubu kalıyor
- **Önem:** Düşük · **Tür:** Hata (arayüz)
- **Bizde:** Loft → Merkez çizgisi = Merkez → "Bağlayıcıları kullan" görünür kalıyor. Kod bu durumda grubu gizlemek istiyor (`!d.center && !d.guides?.length`), ama seçim PM'i yeniden çizmiyor. Önceden açılmış bağlayıcı verisi taslakta kalıyor. Model doğru (28 000).
- **Betik:** `d4_loft.py` L5.
- **Kod:** `src/main.ts:2849` (merkez çizgisi `selectField` → yalnız `upd()`), kılavuz onay kutuları da öyle.
- **Öneri:** `renderFeaturePM(kind)` çağır; merkez / kılavuz varken `d.conn`'u temizle.

##### ✅ D4-10 · Instant3D oku "Başla: Yüzey / yüz" ve "Köşe"de eskiz düzleminden çiziliyor
- **Önem:** Düşük · **Tür:** Hata (görsel)
- **Bizde:** Boru ucundan (y = 60) başlayan flanş ekstrüzyonunda (d = 20) ok y ≈ 20'de, borunun ortasında duruyor. Model y 60..80'de doğru (`/home/claude/d4tmp/w3.png`). Sürükleme derinliği doğru değiştiriyor ama tutamak modelin ucunda değil.
- **Kod:** `src/main.ts:8100` `base` yalnız `startOff` ekliyor; `fromFace` / `fromVtx` dikkate alınmıyor.
- **Öneri:** Başlangıç ötelemesini `extrudeTool` ile aynı formülle (`dot(face.c − o, n)`) hesapla.

##### ✅ D4-11 · Kapalı loft kendini kesen dizilimde hatasız katı üretiyor (Doğrulanmadı)
- **Önem:** Düşük · **Tür:** SolidWorks'ten farklı (SW davranışı doğrulanmadı)
- **Bizde:** Üst üste paralel üç kare profil (y 0 / 30 / 60) → Loft → Kapalı loft → durum "Hazır", hacim 121 785,21 mm³ (açık düzgün loft 44 800). Son profilden ilkine dönüş gövdenin içinden geçiyor. Kendini kesen bir katı, uyarı yok. SW'nin burada "kendini kesen geometri" hatası vermesi beklenir.
- **Betik:** `d4_loft.py` L2 (çıktı satırı "L3 kapalı loft").
- **Öneri:** Kapalı loft sonucunu `BRepCheck_Analyzer` ile doğrula, kesişen kesitlerde hata ver.

##### ✅ D4-12 · Temel özelliklerde eksik SolidWorks seçenekleri
- **Kalanı düzeltildi:** süpürmede ince özellik (açık / kapalı profil, `thinOf`), döndürmede uç koşulu Açı / Köşeye kadar / Yüzeye kadar (ekseni içeren düz yüz) + açısal öteleme (`RevolveFeature.end/vtx/face/offA`); test `d4_ek12.py`.
- **Önem:** Düşük · **Tür:** Eksik
- **SolidWorks'te olup bizde olmayanlar (P-11 / P-35 dışında):**
  - Süpürme ve Loft'ta "Sonucu birleştir" (her zaman birleşiyor).
  - Süpürmede ince özellik, başlangıç / bitiş teğetliği, birden çok kılavuz eğri, burulma "yön vektörü" / "komşu yüzlere teğet".
  - Loft başlangıç / bitiş kısıtında "Yön vektörü".
  - Döndürmede "Köşeye / Yüzeye / Gövdeye kadar" ve "Yüzeyden ötele" uç koşulları.
  - Yüzeyden ötelemede "Yüzeyi taşı". Ters öteleme negatif değerle çalışıyor (R3b ✓) ama onay kutusu yok.
  - Kesmede "Özellik kapsamı" (hangi gövdeler).
  - Başlangıç olarak referans düzlem seçimi (yalnız model yüzü).
- **Kod:** `src/main.ts:2354-2470` (ekstrüzyon / döndürme PM), `2728-2860` (süpürme / loft PM), `src/doc/compile.ts` (sweep / loft kfeature'larında `merge` yok).

#### Denendi, sorun yok (özet)
- Önizleme her sayısal alan ve seçenekte değerle güncelleniyor: derinlik, koniklik, ince kalınlık / mod, Yön 2, bölge, uç koşulu, burulma, yönelim, helis, bağlayıcı, teğet uzunluğu (P-3 bu alanda yok).
- Referans izleme: Yüzeye kadar, Yüzeyden ötele, Gövdeye kadar, Sonrakine kadar, Başla: yüz ve yüz üstündeki eskizler, hedef / başlangıç model değişince (düzenle, eskiz, düzlem ötelemesi) doğru yeniden kuruluyor; yenilemede kalıcı. İstisna: Köşeye kadar (P-9).
- Çekirdek kilitlenmesi görülmedi. Hatalı durumlarda durum "Hazır"a dönüyor (eksen kesen profil, 40° koniklik, kapalı loft 2 profil, ince eksen taşması).
- Ctrl+S (indirme) dosyası ve localStorage her adımda güncel; PM ya da eskiz açıkken yenilemede belge tutarlı.

---

## Denetim 2 — Ajan d5: DETAY ÖZELLİKLERİ (v0.85, localhost:4173)

Kapsam: radyüs, pah, kabuk, koniklik + koniklik analizi, delik sihirbazı, diş, kaburga, kubbe, sarma, esnet, girinti, köşe pahı, ölçekle, yüz taşı / sil, dudak / yiv, mandal, altı çoğaltma türü + ayna, birleştir / gövde böl / taşı / sil, referans düzlem / eksen / nokta / koordinat sistemi.

Yöntem (PROTOKOL'e göre): Başlangıç modeli her senaryoda **hazır model** olarak `setDoc` ile kuruldu (ölçülü 40×30×20 kutu, L braket, silindir, iki gövde vb.). Bundan sonraki her kullanıcı adımı gerçek UI ile yapıldı: şerit komutu (masaüstünde fare tıklaması, telefonda CDP dokunma), modelde **gerçek kenar / yüz / köşe tıklaması** (dünya noktası `viewer.toScreen` ile ekrana çevrilip fareyle tıklandı), PM alanlarına `fill` + Tab, segment / onay / liste denetimleri, ✓ / ✕ (+ çıkış penceresi), ağaçtan Düzenle / Bastır / Etkinleştir / Sil (confirm penceresi), ebeveyn eskizinde **ölçüye çift tık → değer → Enter → ✓**, eskizde nokta sürükleme, Ctrl+Z / Ctrl+Y, telefonda ↶ / ↷, sayfa yenileme, Dosya > Kaydet indirmesi. `__app` yalnız sonucu okumak için kullanıldı (hacim `kernel.props()`, sınır kutusu, yüz / kenar listesi, `doc`, `localStorage`, sarı önizleme ağının hacmi, düzlem ağlarının çerçevesi). Beklenen değerler SolidWorks'te aynı modelin vereceği elle hesaplanmış sonuçlardır (formüller betiklerde).

Betikler (`/home/claude/imaj-cad/tests/e2e/denetim2/`; her biri tek başına çalışır, sonda `SONUC: TAMAM/HATA`; ortak `d5_lib.py`, `d2h.py`'yi genişletir):

| Betik | Kapsam | Sonuç |
|---|---|---|
| `d5_radyus.py` | sabit (tam yaşam döngüsü), değişken, yüz, tam yuvarlak, konik, çoklu yarıçap, teğet yayılımı, R50 hatası | HATA (P-3, P-7, P-16, P-6 hâlâ) |
| `d5_pah.py` | eşit (tam yaşam döngüsü), mesafe-mesafe + ters, mesafe-açı, köşe, öteleme yüzü, yüz–yüz, yüz seçimi, Köşe Pahı komutu | HATA (D5-5, D5-6, P-3) |
| `d5_kabuk_konik.py` | kabuk tek / çoklu / dışa / yüzsüz / çok kalın; koniklik nötr düzlem (+ ters, iki yüz), ayırma çizgisi; koniklik analizi | HATA (D5-8, D5-9, P-1, P-13, P-17) |
| `d5_delik.py` | hızlı ✓, düz / kör (+ uç), havşa, konik (+ açı), kılavuz + kozmetik, boru / inç / özel, yuva (+ açı), yakın + uzak havşa, çoklu / sayısal konum, konum eskizi + nokta sürükleme, kozmetik / gerçek diş | HATA (D5-10) |
| `d5_gelismis.py` | kaburga (paralel / dik / eskiz düzenleme), kubbe, sarma, esnet ×4, ölçekle, yüz taşı, dudak / yiv, mandal | HATA (D5-1, D5-2, D5-3, D5-13, P-4) |
| `d5_sarma_oyma.py` | sarma kabartma / oyma × 1 / 2 mm derinlik | HATA (D5-2) |
| `d5_cogalt.py` | doğrusal (adet, atla, yön 2, tohum ölçüsü, bastır / sil, referansa kadar, eskizi değiştir), dairesel (açı, atla, adet), eskiz, tablo, eğri, doldurma, ayna (özellik / gövde) | HATA (D5-4, D5-11, P-4, P-7, P-9) |
| `d5_govde.py` | birleştir ×3 (+ düzenle, ebeveyn, geri al, yenile, bastır), gövde böl, gövde taşı (öteleme / kopya / döndür / ebeveyn), gövde sil (sil / tut / ebeveyn), girinti (boşluk, aracı koru) | **TAMAM** |
| `d5_ref.py` | düzlem ×8 tür, eksen (kenar / iki düzlem / iki nokta / Z / silindir yüzü / dairesel kenar), nokta (otomatik / yüz / köşe / yay merkezi), koordinat sistemi | HATA (D5-4, D5-7, D5-12, P-5, P-9) |
| `d5_mobil.py` | telefon 390×844: radyüs, pah + aday çubuğu, kabuk, delik, koniklik, kubbe, doğrusal çoğaltma, ref. düzlem + ✕ | **TAMAM** |
| `d5_akis.py` | 8 iş akışı (7 masaüstü + 1 telefon) | HATA (P-1, P-7) |

### Özet

| Önem | Yeni bulgu (D5-) |
|---|---|
| Kritik | 3 — D5-2, D5-3, D5-4 |
| Yüksek | 3 — D5-1, D5-5, D5-7 |
| Orta | 5 — D5-8, D5-10, D5-11, D5-12, D5-14 |
| Düşük | 6 — D5-6, D5-9, D5-13, D5-15, D5-16, D5-17 |
| **Toplam** | **17** |

Hâlâ geçerli eski bulgular (yeniden üretildi): P-1, P-3, P-4, P-5, P-6, P-7, P-9, P-12, P-13, P-16, P-17, P-32, P-33.

En önemliler:
1. **D5-4 (Kritik)** Yüze bağlı düzlem referansları (ayna düzlemi olarak tıklanan yüz, yüzden öteleme düzlemi, teğet düzlem silindiri) model değişince yerinde kalıyor → ayna gövdesi asıl gövdeye gömülüyor, hacim sessizce yanlış (61 733 yerine 72 000), hata yok.
2. **D5-2 (Kritik)** Sarma "Oyma" yalnız yarısını oyuyor (1 mm: 50,56 / 2 mm: 101,19 mm³; kabartma 101,02 / 201,95), hata yok.
3. **D5-3 (Kritik)** Mandal konum noktası mutlak koordinatta: yüz yükselince mandal eski yükseklikte kalıp gövdeye gömülüyor (y max 45 olmalı → 35), hata yok.
4. **D5-1 (Yüksek)** Kaburga "Eskize dik": parçadan 1000 mm dışarı uzanan dev levha (+395 980 mm³, z −980…40), hata yok.
5. **D5-7 (Yüksek)** Ref. Eksen "İki düzlem" modu ve "silindir yüzüne dokun" tıklamayla hiç çalışmıyor (seçim filtresi yalnız kenar) — ✓ sonrası varsayılan eksen (orijin, Y) kaydediliyor.

### Kapsam matrisi

Sütunlar: **a** oluştur + sayısal doğrulama · **b** düzenle (PM'den değer değiştir, ✓; önizleme) · **c** ebeveyn eskiz / ekstrüzyon ölçüsü değişir · **d** Ctrl+Z / Ctrl+Y · **e** kayıt + sayfa yenileme · **f** ✕ (Kaydetmeden çık / Kaydet ve çık) · **g** sil / bastır / bağımlılar · **T** telefonda denendi.
✓ geçti · ✗ hata (bulgu) · – uygulanmadı (neden parantezde).

#### Envanter komutları (Özellikler sekmesi: Detay, Gelişmiş, Gövde, Çoğalt, Referans; Değerlendir: Koniklik Analizi)

| # | Komut | a | b | c | d | e | f | g | T |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Delik Sihirb. | ✓ Ø9 tümünden 1272,3 | ✓ kör 12 (+118° uç); ✗ hızlı ✓ D5-10 | ✓ kutu 20→30: kör delik yeni üst yüzden | ✓ | ✓ | ✓ | ✓ bastır | ✓ |
| 2 | Radyüs | ✓ R3 77,25 eksik | ✓ R5; ✗ önizleme (P-3) | ✓ derinlik 30→40, genişlik 40→60; kenar referansı onarıldı | ✓ | ✓ | ✓ / ✓ | ✓ bastır / sil / geri al; ✗ ebeveyn bastır (P-7) | ✓ |
| 3 | Pah | ✓ 2 mm = 80 | ✓ 4 mm; ✗ önizleme (P-3) | ✓ | ✓ | ✓ | ✓ | ✓ sil / geri al | ✓ (+ aday çubuğu) |
| 4 | Kabuk | ✓ t2 = 7152 | ✓ t3 = 10128; ✓ önizleme | ✓ derinlik 40 → 12348 | ✓ | ✓ | – (radyüs/pahla aynı yol) | ✓ bastır | ✓ |
| 5 | Yüz Taşı / Sil | ✓ +5 → 30000 | – | ✓ genişlik 60 → 45000 | – | – | – | – | – |
| 6 | Koniklik | ✓ 5° ΔV 699,9; ✓ önizleme = sonuç | ✓ 10°, ters | ✓ derinlik 40 | ✓ | – | – | – | ✓ |
| 7 | Kaburga | ✓ 3062,5 (✗ varsayılan taraf D5-13) | ✓ 8 mm tek taraf 4900; ✗ eskize dik D5-1 | ✓ eskiz ucu sürüklendi → büyüdü (✗ "Eskizi düzenle" eylemi yok, P-4) | ✓ | ✓ | – | ✓ bastır | – |
| 8 | Kubbe | ✓ h10 → y30, ΔV 7919 | ✓ h5 | ✓ kutu 30 → y35 | – | – | – | – | ✓ |
| 9 | Dudak / Yiv | ✓ +386,1 | ✓ yiv −386,1 | ✓ genişlik 60 | – | – | – | – | – |
| 10 | Mandal | ✓ +193,5 | – | ✗ D5-3 | – | – | – | – | – |
| 11 | Sarma | ✓ kabartma 101,0 | ✗ oyma D5-2 | – (eskiz ölçüsüz) | – | – | – | – | – |
| 12 | Ölçekle | ✓ ×1,5 = 81000 | ✓ ağırlık merkezi; ✓ 0 kabul edilmez | – | ✓ | – | – | – | – |
| 13 | Diş | ✓ kozmetik (hacim aynı), ✓ gerçek 10 mm (−324) | ✓ kozmetik → gerçek | ✓ Ø20→24 (hata yok) | – | – | – | – | – |
| 14 | Esnet | ✓ bük / bur / daralt / uzat (hacim %0,3 içinde) | ✓ kip değişimi | ✓ çubuk 100→60 | – | – | – | – | – |
| 15 | Girinti | ✓ 31168,6 (≈ 31160) | ✓ aracı koru kapalı, boşluk 0 → 20000 | – | – | – | – | – | – |
| 16 | Köşe Pahı | ✓ 5 mm = 20,83 | ✓ 10 mm = 166,67 | ✗ D5-5 | – | ✓ | – | – | – |
| 17 | Birleştir | ✓ ekle 32000 / çıkar 20000 / ortak 4000 | ✓ ortak → ekle | ✓ A genişliği 60 → 40000 | ✓ | ✓ | – | ✓ bastır → 2 gövde | – |
| 18 | Gövde Böl | ✓ 3 gövde, hacim aynı | – (yüzü bölme düzlemi yapma sonucu belirsiz, doğrulanmadı) | – | – | – | – | – | – |
| 19 | Gövde Taşı | ✓ ΔX 50 | ✓ kopya +12000, Y 90° | ✓ B eskizi 20→10 | – | – | – | – | – |
| 20 | Gövde Sil | ✓ 24000 | ✓ "seçilenleri tut" 12000 | ✓ B derinliği 40 → 16000 | – | – | – | – | – |
| 21 | Doğrusal Çoğ. | ✓ 3 örnek | ✓ adet 4, atla, yön 2 (7 örnek) | ✓ tohum Ø6→Ø4 | ✓ | ✓ | – | ✗ tohum bastır (P-7 + D5-11), ✓ tohum silinince hata gösterir | ✓ |
| 22 | Dairesel Çoğ. | ✓ 4 × 360° | ✓ 45° × 3, atla, adet ≥ 2 | – | – | – | – | ✗ tohum bastır (P-7) | – |
| 23 | Eskiz Çoğ. | ✓ 3 nokta → 4 delik | – | ✗ nokta eskizi ağaçta yok (P-4) | – | – | – | – | – |
| 24 | Tablo Çoğ. | ✓ 2 satır (ΔX 10; ΔX 20 / ΔZ −12) → 3 delik | – | – | – | – | – | – | – |
| 25 | Eğri Çoğ. | ✓ 4 eşit | ✓ aralık 8 | – | – | – | – | – | – |
| 26 | Doldurma Çoğ. | ✓ kare 12 → 6 | – | ✓ kutu 64 → 8 | – | – | – | – | – |
| 27 | Ayna | ✓ özellik x=±15; ✓ gövde (sağ yüz) 48000 | – | ✓ tohum Ø4; ✗ gövde aynası D5-4 | ✓ (W3) | – | – | ✓ düzlem silinince "Ayna düzlemi bulunamadı" | – |
| 28 | Ref. Düzlem | ✓ 8 türün 6'sı (✗ ekrana paralel / teğet D5-12) | ✓ öteleme 10→5 | ✗ yüzden öteleme D5-4, ✗ 3 nokta (P-9) | – | ✓ | ✓ (telefon ✕) | ✓ sil / geri al | ✓ |
| 29 | Ref. Eksen | ✓ kenar, iki nokta, Z, dairesel kenar; ✗ iki düzlem / silindir yüzü D5-7 | – | ✗ kenardan eksen (P-9) | – | – | – | – | – |
| 30 | Ref. Nokta | ✓ otomatik, yüz merkezi, köşe, yay merkezi | – | ✗ köşe noktası (P-9) | – | – | – | – | – |
| 31 | Koord. Sist. | ✓ başlangıç + X kenarı (Y seçilemez, D5-17) | – | – | – | ✓ | – | – | – |
| 32 | Eskiz (Referans grubunda) | – (eskiz ajanlarının alanı) | | | | | | | |
| 33 | Koniklik Analizi | ✓ kutu: Pozitif 1 · Negatif 1 · gerekli 4; ✗ eğri yüz D5-8 | – | ✗ güncellenmiyor D5-9 | – | – | – | – | – |

#### PM seçenekleri (ayrı satırlar)

| Özellik / seçenek | Sonuç (ölçülen / beklenen) | Durum |
|---|---|---|
| Radyüs — değişken R2→R6 | 23848,38 / ≈23851,2 (doğrusal r yaklaşımı); düzenle bitiş 3 → 23945,46; geri al | ✓ |
| Radyüs — yüz (üst ↔ ön) R5 | 23785,40 / 23785,40; derinlik 40 sonrası 31785,40 | ✓ |
| Radyüs — tam yuvarlak (40×10) | 7575,08 / 7570,80; kalınlık 16 → 11712,2 / 11701,2 | ✗ P-16 hâlâ var |
| Radyüs — konik rho 0,5 / 0,414 | 23833,01 / 23833,33; 23784,96 ≈ daire; derinlik 40 sonrası doğru | ✓ |
| Radyüs — çoklu yarıçap (R2 + R4) | 23828,32 / 23828,32 | ✓ |
| Radyüs — teğet yayılımı (R5 düşey kenarlar + bir üst kenar R2) | 23460,4 / 23460,4 (tüm zincir); kapatma seçeneği yok | ✓ (D5-16) |
| Radyüs — R50 (olanaksız) | ✓ ile ağaca hatalı özellik giriyor | ✗ P-6 hâlâ var |
| Radyüs / pah sarı önizleme değer değişince | 23922,06 kalıyor (R10 beklenirdi 23141,6); pahta 23920 (4 mm: 23680) | ✗ P-3 hâlâ var |
| Pah — mesafe-mesafe 2 × 4 + ters çevir | 23840 / 23840; ters → üst yüz izi 4 → 2 | ✓ |
| Pah — mesafe-açı 3 mm 30° | 23896,08 / 23896,08; genişlik 60 → 35844,12 | ✓ |
| Pah — köşe (vtx) 10 | 23833,33 / 23833,33; ebeveyn değişince ✗ | ✗ D5-5, D5-6 |
| Pah — öteleme yüzü 2 | 23920 / 23920 | ✓ |
| Pah — yüz–yüz 2 (+ derinlik 40) | 23920 / 31920 | ✓ |
| Pah — yüz seçimi (4 kenar, 1 mm) | 23931,33 / 23930,67 + köşe payı | ✓ |
| Kabuk — çoklu kalınlık (ön 6) | 9744 / 9744; derinlik 40 → 11264 | ✓ |
| Kabuk — dışa | 8707,91, 23 yüz (keskin: 8912) | ✗ P-13 hâlâ var |
| Kabuk — yüz seçmeden ✓ | PM açık kalıyor, kapalı içi boş gövde yok | ✗ P-17 hâlâ var |
| Kabuk — t16 (yarı genişlikten büyük) | 24000, hata yok | ✗ P-1 hâlâ var |
| Kabuk — radyüslü kutu (W2) | 23739,96 = radyüslü kutu, kabuk yok, hata yok | ✗ P-1 hâlâ var |
| Koniklik — nötr düzlem iki yüz | ΔV 1204,4 | ✓ |
| Koniklik — nötr düzlemi modelde seçme | yüz tıklaması yüz listesine eklenir; düzlem tıklaması yok sayılır | ✗ D5-14 |
| Koniklik — ayırma çizgisi | varsayılan taraf: hata (✓'de ağaçta kırmızı); "Öbür taraftaki yüzler" → +699,9; derinlik 40 izlendi | ✓ (P-6 davranışı) |
| Koniklik — basamaklı (adım) | – (iki yükseklikte ayırma kenarı gerektiren model kurulmadı; pf2 iç API ile kapsıyor) | – |
| Delik — havşa M8 | 21755,02 / 21755,02 | ✓ |
| Delik — konik havşa M8 90° / 120° | 22481,07 / 22481,07; 22585,29 / 22585,29 | ✓ |
| Delik — kılavuz M8 + kozmetik | 23273,66 / 23273,66 | ✓ |
| Delik — boru (G1/4) / inç (1/4-20) / özel Ø10 | 21068,96 / 23273,66 / 22429,20 (boyut "Özel"e döner) | ✓ |
| Delik — yuva 10 mm + 90° | 20927,65 / 20927,65; yön değişti | ✓ |
| Delik — yakın + uzak havşa | 22062,79 / 22062,79 | ✓ |
| Delik — iki konum + "1. X" alanı | 2 delik, x = −12 | ✓ |
| Delik — konum eskizi + nokta sürükleme | eskiz oluştu, nokta 5 mm sürüklendi → delik x −12 → −7 | ✓ |
| Delik — uç koşulları (sonrakine / yüzeye / köşeye kadar) | yalnız tümünden / kör | ✗ P-32 hâlâ var |
| Delik — ayrı "Basit Delik" komutu | yok | D5-17 |
| Delik — hızlı ✓ (dokunur dokunmaz) | "Deliğin açılacağı yüzü seçin", PM açık kalıyor | ✗ D5-10 |
| Kaburga — eskize dik | +395 979,8, sınır z −980…40 | ✗ D5-1 |
| Sarma — oyma 1 / 2 mm | 50,56 / 101,19 (≈ 101 / 202 olmalı) | ✗ D5-2 |
| Doğrusal — referansa kadar (köşe) | son örnek köşede; kutu genişleyince eski köşede | ✓ / ✗ P-9 |
| Doğrusal — eskizi değiştir | 3 örnek, hata yok | ✓ |
| Doğrusal / dairesel — yön / eksen olarak kenar, referans eksen | yalnız X/Y/Z | ✗ P-12, P-5 hâlâ var |
| Ayna — çoğaltmayı aynalama | listede yalnız Ekstrüzyon1 / Kesme1 | ✗ P-33 hâlâ var |
| Ref. düzlem — açılı 45° | n = (0, −0,707, 0,707), kenardan geçer | ✓ |
| Ref. düzlem — orta (yüz ↔ Ön düzlem) | z = 7,5 | ✓ |
| Ref. düzlem — 3 nokta | y = 20 ✓; kutu 30 → y 20'de kaldı | ✓ / ✗ P-9 |
| Ref. düzlem — kenara dik | x = 20 | ✓ |
| Ref. düzlem — noktadan paralel | z = 15 | ✓ |
| Ref. düzlem — ekrana paralel | n = bakış ✓, ama köşeden 20 mm uzakta | ✗ D5-12 |
| Ref. düzlem — teğet (silindir R10) | eksenden 30 mm (teğet değil); Ø30 sonrası değişmiyor | ✗ D5-12, D5-4 |
| Ref. eksen — iki düzlem / silindir yüzü | tıklama seçmiyor, varsayılan eksen kaydediliyor | ✗ D5-7 |

#### Ek sonuçlar
- **Tablo çoğaltma**: ilk koşuda ikinci satıra ΔZ +12 yazıldığı için örnek gövdenin dışına düştü (betik hatası); ΔZ −12 ile yeniden koşuldu → 3 delik ✓.
- Telefonda (d5_mobil, W8): kenara / yüze dokunarak seçim, aday çubuğu ("◼ Yüz (düz)" → seçim kenardan yüze geçer), ✓ / ✕ dokunma, çekmeceden Düzenle, ↶ / ↷ — hepsi çalıştı. İzometrik + sığdır görünümünde ön yüz merkezi ve sağ ön düşey kenar PM panelinin / alt çubuğun altında kaldı (D5-15).

Kapsama oranı: alandaki envanter komutu **33 / 33** satırlı (Eskiz komutu "–" olarak, eskiz ajanlarının alanı); ek olarak **47 seçenek satırı**.

### İş akışları

| # | Senaryo (cihaz) | Adımlar | Sonuç |
|---|---|---|---|
| W1 | Plaka 80×60×10 (masaüstü) | şerit Delik → üst yüze dokun → Havşa → ✓; Radyüs → 3 düşey kenara tıkla → R5 → ✓; Eskizi düzenle → genişlik ölçüsüne çift tık 100 → ✓; Dosya > Kaydet (indirme); sayfayı yenile | ✓ 46230,24 → 58230,24, indirilen dosyada 100 ve `hole`, `fillet`; yenileme sonrası aynı |
| W2 | Kutu → üst yüz radyüsü R3 → ön yüz açık kabuk t2 (masaüstü) | SolidWorks'te en yaygın sıralama | ✗ kabuk uygulanmadı, hacim 23739,96 (radyüslü kutu), hata yok — P-1 |
| W3 | Kesme + doğrusal çoğaltma + ayna → tohum Ø6→4 → 3× Ctrl+Z, 3× Ctrl+Y | | ✓ 3 delik; Ø4 tüm kopyalarda; geri / ileri al ağaç ve hacim tutarlı (P-33: çoğaltma aynalanamıyor) |
| W4 | Delik Sihirb. + dairesel çoğaltma ×6 → tohum bastır | | ✓ 6 delik; ✗ tohum bastırınca çoğaltma hata + "Eksik referans" penceresi (P-7, D5-11) |
| W5 | Koniklik (ön + sağ 3°) → üst yüz radyüs R2 → ekstrüzyon 20→30 | | ✓ hatasız, hacim tutarlı |
| W6 | Ref. düzlem (Sağ + 30) → tüm gövde ayna → düzlem 20 → düzlem sil | | ✓ 48000 iki gövde → yapışık tek gövde x 60; silince "Ayna düzlemi bulunamadı" |
| W7 | İkinci gövde → Gövde Taşı ΔX −15 → Birleştir → yenile | | ✓ tek gövde 24500, yenileme sonrası aynı |
| W8 | Telefon: plaka → delik (dokunma) → köşe R8 → çekmeceden düzenle R12 → ↶ → ↷ | | ✓ 47363,83 → 47226,48 → 47054,80 → ↶ 47226,48 → ↷ 47054,80 |
| (ek) | Telefon: radyüs / pah + aday çubuğu / kabuk / delik / koniklik / kubbe / çoğaltma / düzlem + ✕ (d5_mobil) | | ✓ 8 özellik |

### Bulgular

##### ✅ D5-1 · Kaburga "Eskize dik" parçanın 1000 mm dışına uzanan dev levha üretiyor (hata yok)
- **Önem:** Yüksek · **Tür:** Hata (yanlış geometri)
- **SolidWorks:** "Eskize dik" kaburgada kalın profil eskiz düzlemine dik yönde ilk sınırlayan yüzlere kadar uzar; sınırlanamıyorsa "Kaburga oluşturulamadı" hatası verir.
- **Bizde:** Hazır model L braket (Ön düzlemde L profil 60×60, et 5, derinlik 40) + Ön düzlemden 20 mm düzlemde (5,40)–(40,5) açık çizgi. Şerit Kaburga → (malzeme tarafı ters) → ✓ → 3062,5 ✓. Ağaçtan Düzenle → "Uzama yönü: Eskize dik" → ✓ → hacim **+395 979,8 mm³**, sınır kutusu **z −980 … 40**, ağaçta hata yok.
- **Betik:** `d5_gelismis.py` (R4)
- **Kod:** `src/kernel.worker.ts:853–862` `ribTool` dik dalı: `sk.extrude(sign * big)` sonra `touching(solidsOf(long.cut(a)), …)` — paralel daldaki `bounded()` denetimi yok; uzak uca ulaşan parça da tutuluyor.
- **Öneri:** Dik dalda da parçanın uzak uca (`big`) değmediğini denetle (paralel daldaki `bounded`); değiyorsa "Kaburga bir yüze ulaşmıyor" hatası; ayrıca iki yönde dene, sınırlı olanı al.

##### ✅ D5-2 · Sarma "Oyma" seçili bölgenin yalnız yarısını oyuyor
- **Önem:** Kritik · **Tür:** Hata (sessizce yanlış geometri)
- **SolidWorks:** Oyma derinliği kadar, sarılan eskizin tamamı silindire gömülür (hacim ≈ kabartma).
- **Bizde:** Ø40×40 silindir (Ön düzlem), Sağ düzlemden 20 mm teğet düzlemde 10×10 kare. Şerit Sarma → silindire tıkla → Kabartma 1 mm → **101,02**; 2 mm → **201,95** (beklenen ≈101,0 / 201,9 ✓). Oyma 1 mm → **50,56**, 2 mm → **101,19** (beklenen ≈101,1 / 202,4). Oymada yüz sayısı 7, kabartmada 9 → karenin bir yarısı (silindirin iki yarım yüzünden birinin içindeki kısım) oyulmuyor. Hata / uyarı yok.
- **Betik:** `d5_sarma_oyma.py`, `d5_gelismis.py` (W3)
- **Kod:** `src/kernel.worker.ts:922` `ring = C(cyl.r).cut(C(r − depth))` — oyma halkasının dış silindiri parçanın silindir yüzüyle **çakışık**; OCC kesmesi dikiş çizgisinde (iki yarım yüz) yalnız bir yarıda başarılı.
- **Öneri:** Oymada halkayı dışa taşır: `C(cyl.r + 1).cut(C(cyl.r − depth))` (çakışık yüz kalmaz); sonuç hacmini beklenenle (≈ alan × derinlik) karşılaştırıp uyarı ver.

##### ✅ D5-3 · Mandal konum noktası mutlak: yüz yer değiştirince mandal eski yerinde kalıp gövdeye gömülüyor
- **Önem:** Kritik · **Tür:** Hata (sessizce yanlış geometri)
- **SolidWorks:** Mandal, seçilen yüze ve o yüzdeki konuma bağlıdır; parça uzayınca yüzle birlikte taşınır.
- **Bizde:** 40×30×20 kutu → Mandal → üst yüze dokun → ✓ (+193,5, y max 35 = 20 + 15 ✓). Ağaçtan Ekstrüzyon1 → Derinlik 30 → ✓ → y max **35** (beklenen 45): mandal tabanı y = 20'de kaldı, 10 mm'si gövdenin içinde, hata yok.
- **Betik:** `d5_gelismis.py` (M2)
- **Kod:** `src/main.ts:5305` `d.p = hit.point` (dünya noktası); `src/kernel.worker.ts:1299` `P()` doğrudan `f.p`'yi kullanıyor, yüzden (`pf`) yalnız normal alınıyor.
- **Öneri:** Noktayı yüz düzlemine izdüşür (`p + n·((pf.c − p)·n)`) ya da yüz çerçevesinde yerel (u, v) olarak sakla ve yüz bulununca dünya koordinatına çevir.

##### ✅ D5-4 · Yüze bağlı düzlem referansları statik: ayna düzlemi, yüzden öteleme düzlemi ve teğet düzlem model değişince izlemiyor
- **Önem:** Kritik · **Tür:** Hata (sessizce yanlış geometri) — P-9 ile aynı kök ama P-9 listesinde olmayan, en sık kullanılan durumlar
- **SolidWorks:** Ayna düzlemi / referans düzlem tabanı olarak seçilen model yüzü, yüz taşınınca izlenir.
- **Bizde:**
  1. Ayna: 40×30×20 kutu → Ayna → sağ yüze (x = 20) tıkla → ✓ → 48000 ✓. Eskizi düzenle → genişlik 60 → ✓ → hacim **61 732,81** (beklenen 72 000), sınır x −31,44 … 71,44: ayna düzlemi x = 20'de kaldı, aynalı gövde asıl gövdeyle 11,44 mm örtüşüyor; hata yok.
  2. Ref. düzlem → üst yüze tıkla → mesafe 10 → ✓ (y = 30 ✓) → düzenle 5 (y = 25 ✓) → Ekstrüzyon1 derinlik 30 → düzlem hâlâ **y = 25** (beklenen 35).
  3. Teğet düzlem: silindir Ø20 → Ø30 sonrası düzlem yerinde (`cyl {c, ax, r:10}` saklı).
- **Betik:** `d5_cogalt.py` (A4), `d5_ref.py` (P3, P15)
- **Kod:** `src/main.ts:1283` `planeRefFromHit` yüz için `{k:"face", frame: frameFromNormal(f.c, f.n)}` dondurulmuş çerçeve; `src/doc/compile.ts:57` `resolveFrame` `ref.frame`'i aynen döndürüyor; `src/main.ts:952–957` çerçeve onarımı yalnız `sketch` özelliklerine yapılıyor (`res.frames`).
- **Öneri:** `PlaneRef{k:"face"}` için de çekirdekte `planarFace(face)` ile çerçeveyi yeniden bul (deliklerdeki `kplane` gibi) ve `frames` ile mirror / plane / splitbody / draft taraflarına geri yaz; teğet düzlemde silindiri `FaceRef` (r imzalı) olarak sakla.

##### ✅ D5-5 · Köşe pahı (Pah > "Köşe pahı" ve Köşe Pahı komutu) köşe koordinatını sabit saklıyor; ebeveyn değişince özellik kayboluyor
- **Önem:** Yüksek · **Tür:** Hata
- **SolidWorks:** Köşe (vertex) referansı topolojik; parça boyutu değişince pah yeni köşede kalır.
- **Bizde:** Pah → Pah türü "Köşe pahı" → mesafe 10 → (20,20,15) köşesine tıkla → ✓ (166,67 eksik ✓). Eskizi düzenle → derinlik 40 → ✓ → hacim **32000** (pah yok), ağaçta "Pah1 :: Köşe modelde bulunamadı", "Eksik referans" penceresi. Köşe Pahı komutunda aynı (genişlik 60 → "Köşe-Pahı1 :: Köşe modelde bulunamadı"). Radyüs / kenar pahı aynı değişiklikte doğru izliyor (kalıcı referans var).
- **Betik:** `d5_pah.py` (V3, K5)
- **Kod:** `src/main.ts:5073–5081` (`d.verts.push([...best])` dünya noktası); `src/kernel.worker.ts:1148` ve `:1680` (`Köşe modelde bulunamadı`, yalnız konumla arama, imza yok).
- **Öneri:** Köşeyi kenar referansı + uç (`{m, d, s, end}`) ya da köşe imzası (bağlı kenar yönleri + `u`) olarak sakla; `matchEdges` onarımına kat.

##### ✅ D5-6 · "Yeniden seç" köşe pahında eski köşeyi temizlemiyor
- **Önem:** Düşük · **Tür:** Hata
- **Bizde:** D5-5 sonrası açılan "Eksik referans" → **Yeniden seç** → PM açılır ama `verts` (Pah) / `v` (Köşe Pahı) eski koordinatla dolu kalır; yeni köşeye dokunmak listeye ekler (eski hatalı köşe durur).
- **Betik:** `d5_pah.py` (V5, K5c) · **Kod:** `src/main.ts:905` yalnız `edges` / `faces` / `face` temizleniyor.
- **Öneri:** `verts`, `v`, `edges2`/`faces2` de temizlensin.

##### ✅ D5-7 · Ref. Eksen: "İki düzlem" modu ve silindir yüzü seçimi tıklamayla çalışmıyor
- **Önem:** Yüksek · **Tür:** Hata
- **SolidWorks:** Eksen için iki düzlem / yüz ya da silindirik yüz seçilir.
- **Bizde:** 40×30×20 kutu → Ref. Eksen → "İki düzlem" → üst yüze ve ön yüze tıkla → `_picks` boş kalır, eksen değişmez; ✓ → kaydedilen eksen **p (0,0,0), d (0,1,0)** (varsayılan Y ekseni) — kullanıcıya uyarı yok. Silindir (x = 10) yüzüne tıklayınca da aynı varsayılan eksen kaydediliyor (beklenen x = 10). Dairesel kenara tıklamak çalışıyor (x = 10 ✓). Önceki `md1` testi bu yolu `__app.pmPick` ile geçtiği için görülmemiş.
- **Betik:** `d5_ref.py` (X2, X6)
- **Kod:** `src/main.ts:1445` `pickWant()` → `if (t === "axis") return { edge: true }` → yüz tıklaması hiç `pmPick`'e gelmiyor; oysa `src/main.ts:5320–5345` (2pl) ve `:5371` (silindir yüzü) yüz bekliyor.
- **Öneri:** `axis` için `{ edge: true, face: true }`; ayrıca ✓'de eksen hiç seçilmemişse (varsayılan) uyar.

##### ✅ D5-8 · Koniklik Analizi eğri yüzlü modelde çöküyor
- **Önem:** Orta · **Tür:** Hata
- **Bizde:** Düşey kenarları R5 radyüslü kutu (hazır) → Değerlendir > Koniklik Analizi → sayfa hatası `Cannot read properties of null (reading '1')`, istatistik satırı boş; panel yarım kalır.
- **Betik:** `d5_kabuk_konik.py` (N1)
- **Kod:** `src/main.ts:5553` `cnt[draftClass(f.n)]` — düz olmayan yüzlerde `f.n` `null`; `draftClass` (`:5545`) `n[ax]` okur.
- **Öneri:** Eğri yüzleri köşe normalleriyle sınıflandır (en küçük / en büyük açı → "karışık" sınıfı, SolidWorks'teki "straddle" yüz); en azından `f.n` yoksa atla.

##### ✅ D5-9 · Koniklik Analizi istatistiği model değişince güncellenmiyor
- **Önem:** Düşük · **Tür:** Hata
- **Bizde:** Kutu: "Pozitif 1 · Negatif 1 · Koniklik gerekli 4" ✓. Panel açıkken Koniklik (ön yüz 5°) → ✓ → yazı hâlâ "gerekli 4" (3 olmalı).
- **Betik:** `d5_kabuk_konik.py` (N3) · **Kod:** `applyDraftAnalysis` (`src/main.ts:5548`) yalnız aç / alan değişiminde çağrılıyor; `rebuild` sonunda yok.
- **Öneri:** `rebuild()` sonunda `if (draftAna) applyDraftAnalysis()`.

##### ✅ D5-10 · Yüze dokunup hemen ✓ basınca bayat önizleme hatası onayı engelliyor
- **Önem:** Orta · **Tür:** Hata (zamanlama)
- **SolidWorks:** Seçim yapılır yapılmaz ✓ kabul edilir.
- **Bizde:** Delik Sihirb. → üst yüze tıkla → ~0,3 sn içinde ✓ → kırmızı toast **"Deliğin açılacağı yüzü seçin"**, PM açık kalır (taslakta düzlem ve konum dolu). 3 sn bekleyip ✓ → delik oluşur. Telefonda / ağır modelde önizleme kurulumu uzadıkça pencere büyür.
- **Betik:** `d5_delik.py` (H0)
- **Kod:** `src/main.ts:2236` `if (draftError && …) return toast(draftError)` — `draftError` son tamamlanan yapımdan (`:978`); seçimden sonra `schedulePreview` 220 ms + yapım süresi boyunca eski hata (yüz seçilmemiş) duruyor. Aynı yol radyüs / pah dışındaki tüm "önizlemeli" özelliklerde.
- **Öneri:** ✓'de taslağı eşzamanlı `compile` edip yalnız güncel derleme hatasına bak ya da bekleyen önizlemeyi `await` et; önizleme sürerken ✓'yi kuyruğa al.

##### ✅ D5-11 · Çoğaltma tohumu bastırılınca yanlışlıkla "Eksik referans / Yeniden seç" penceresi açılıyor
- **Önem:** Orta · **Tür:** Hata
- **Bizde:** Kesme1 + Doğrusal çoğaltma → ağaçta Kesme1 → Bastır → (P-7: çoğaltma kırmızı) ve ayrıca modal **"Eksik referans — DoğrusalÇoğaltma1: Çoğaltılacak özellik seçin — Model değiştiği için seçili kenar / yüz bulunamadı"** penceresi; "Yeniden seç" çoğaltmanın kenar / yüzü olmadığı için anlamsız. Dairesel çoğaltma + Delik Sihirb. tohumunda da aynı (W4).
- **Betik:** `d5_cogalt.py` (L8a), `d5_akis.py` (W4b)
- **Kod:** `src/main.ts:973` `/bulunamad|seçin/i.test(msg)` — "Çoğaltılacak özellik seçin" eşleşiyor.
- **Öneri:** Pencereyi yalnız referans eşleme hatalarına (çekirdekten gelen "bulunamadı") bağla; bastırma işleminden sonra hiç açma (P-7 düzeltilince zaten kalkar).

##### ✅ D5-12 · Ref. düzlem türü değişince "Mesafe 20" taşınıyor: ekrana paralel / teğet düzlem noktadan / silindirden 20 mm uzakta
- **Önem:** Orta · **Tür:** SolidWorks'ten farklı
- **SolidWorks:** "Ekrana paralel" ve "teğet" düzlem seçilen noktadan / teğet noktasından geçer (öteleme 0).
- **Bizde:** Ref. Düzlem (öteleme varsayılanı 20) → Tür "Ekrana paralel" → köşeye dokun → ✓ → düzlem normali bakış yönünde ✓ ama köşeden **20 mm** uzakta (o = 32,23 / 30,03 / 27,23). "Teğet (silindire)" → R10 silindire dokun → düzlem eksenden **30 mm** (teğet değil). PM'de "Öteleme 20" görünüyor ama kullanıcı bunu türden gelen bir değer sanmıyor.
- **Betik:** `d5_ref.py` (P13, P14) · **Kod:** `src/main.ts:1942` `offset: 20`; tür değişimi (`:4098–4110`) `pts`/`edge`'i sıfırlıyor, `offset`'i sıfırlamıyor.
- **Öneri:** Tür değişince `offset = 0` (öteleme türü dışında); teğet türünde öteleme varsayılanı 0.

##### ✅ D5-13 · Kaburga (eskize paralel) varsayılan malzeme tarafı kapalı bölgeyi bulmuyor
- **Önem:** Düşük · **Tür:** SolidWorks'ten farklı (SolidWorks'ün varsayılan yönü **Doğrulanmadı**)
- **Bizde:** L braket iç köşesine çapraz çizgi → Kaburga → ✓ → "Kaburga gövdeyle kapalı bir bölge oluşturmuyor; malzeme tarafını ters çevirin", PM açık; ters çevirince 3062,5 ✓. SolidWorks'te önizleme oku genellikle kapalı bölgeye bakar.
- **Betik:** `d5_gelismis.py` (R1b) · **Kod:** `src/kernel.worker.ts:866` `thinRegion(…, f.flip ? "rev" : "one")`.
- **Öneri:** `flip` belirtilmemişse iki tarafı dene, kapalı bölge veren tarafı seç.

##### ✅ D5-14 · Koniklik: nötr düzlem modelde yüz / düzlem tıklanarak seçilemiyor
- **Önem:** Orta · **Tür:** Eksik / SolidWorks'ten farklı
- **SolidWorks:** "Nötr düzlem" kutusu etkinken bir model yüzüne ya da düzleme tıklanır (çoğunlukla parçanın alt yüzü).
- **Bizde:** PM'de nötr düzlem yalnız açılır listeden (Ön / Üst / Sağ / ref. düzlemler); model yüzüne tıklamak onu konik yüz listesine ekler, düzlem tıklaması yok sayılır (`pickWant` yalnız yüz). Bu nedenle tabanı orijinde olmayan parçada (ör. kutu y = 10'dan başlıyorsa) doğru nötr düzlem için önce ref. düzlem kurmak gerekiyor.
- **Kod:** `src/main.ts:5398–5402` (yüz → `faces`), `:1444` `draft → { face: true }`; "Görünümden düzleme / yüze dokunarak seçebilirsiniz" ipucu bu PM'de yanıltıcı (`planeField` `:2330`).
- **Öneri:** Nötr düzlem / yüzler için iki seçim kutusu (ayırma çizgisi PM'indeki gibi segment).

##### ✅ D5-15 · Telefonda özellik paneli açıkken modelin alt kısmı panelin altında kalıyor
- **Önem:** Düşük · **Tür:** Kullanılabilirlik
- **Bizde:** 390×844, izometrik + sığdır → Koniklik paneli açılınca ön yüzün merkezi `.pm-head` altında (dokunma panele gidiyor); W8'de sağ ön düşey kenar alt çubuğun altında. Kullanıcı önce kaydırmak zorunda.
- **Betik:** `d5_mobil.py` (N1 notu), `d5_akis.py` (W8 notu)
- **Öneri:** PM açılınca `fit()` görünür alanı (panel üstü) hesaba katsın.

##### ✅ D5-16 · Radyüste "Teğet yayılımı" kapatılamıyor
- **Önem:** Düşük · **Tür:** Eksik seçenek
- **Bizde:** Teğet zincir her zaman tümüyle radyüslenir (23460,4 = tüm zincir; doğru). SolidWorks'teki onay kutusu (kapatınca yalnız seçilen kenar) yok. `docs/SOLIDWORKS_OZELLIKLERI.md:115` seçeneği listeliyor.

##### ✅ D5-17 · Ayrı "Basit Delik" komutu ve koordinat sisteminde Y / Z yönü seçimi yok
- **Önem:** Düşük · **Tür:** Eksik
- **Bizde:** Basit delik yalnız Delik Sihirb. "Düz" türüyle (yeterli ama SW'de ayrı, yüzden ötele / sonrakine kadar uçlu komut); Koord. Sist.'te yalnız başlangıç + X kenarı seçiliyor, Y ekseni `up` vektöründen otomatik (`src/main.ts:5368–5372`), Y / Z yönü ya da ters çevirme seçilemiyor.

#### Hâlâ geçerli eski bulgular (kısaca)
- **P-1** hâlâ var: t16 kabuk 24000 / radyüslü kutuda kabuk yok (W2), hata yok.
- **P-3** hâlâ var: radyüs / pah önizlemesi değer değişince eski değerde (kabuk düzenlemede ✓).
- **P-4** hâlâ var: kaburgada "Eskizi düzenle" eylemi yok; eskiz çoğaltmanın nokta eskizi ağaçta yok.
- **P-5**, **P-12** hâlâ var: çoğaltma ekseni / yönü yalnız X / Y / Z.
- **P-6** hâlâ var: R50 ✓ ile ağaca hatalı giriyor.
- **P-7** hâlâ var: ekstrüzyon / çoğaltma tohumu bastırılınca çocuklar kırmızı.
- **P-9** hâlâ var: 3 noktalı düzlem, kenardan eksen, köşe noktası, "referansa kadar" köşesi.
- **P-13**, **P-16**, **P-17**, **P-32**, **P-33** hâlâ var (değerler yukarıdaki seçenek tablosunda).

#### Denendi – sorun yok (özet)
Radyüs sabit / değişken / yüz / konik / çoklu / teğet yayılımı; pah tüm türler (köşe hariç ebeveyn değişimi); kabuk tek / çoklu; koniklik nötr + ayırma çizgisi; delik sihirbazının tüm türleri, standartları, yuva ve havşa seçenekleri, konum eskizi; kozmetik / gerçek diş; kubbe; esnet ×4; ölçekle; yüz taşı; dudak / yiv; birleştir / böl / taşı / sil / girinti (d5_govde TAMAM); doğrusal / dairesel / eskiz / eğri / doldurma çoğaltma; ayna (özellik); ref. düzlem 6 türü, eksen (kenar / iki nokta / dairesel kenar / X-Y-Z), nokta 4 türü, koordinat sistemi; kenar referanslarının onarımı (radyüs kenarı derinlik değişiminde yeni kenara taşındı); geri al / ileri al, yenileme, Dosya > Kaydet, ✕ / Kaydet ve çık; telefonda 8 özellik + aday çubuğu.

---

## Denetim 2 — d6 SAC METAL (v0.85, localhost:4173)

Yöntem: PROTOKOL.md'ye göre. Komutlar şeritten (Sac Metal / Özellikler / Değerlendir), PM alanları klavyeyle, ✓ / ✕ / Ctrl+Z / Ctrl+Y / Ctrl+S / Ctrl+2-6-7 gerçek tuşlarla, kenar / yüz seçimleri grafik alanda gerçek tıklama (telefonda CDP dokunma). "Hazır model" = yalnız eskiz verisi (ve Saca Dönüştür için kabuklu kutu, Tırnak-Yuva için iki levha) `setDoc` ile kuruldu. Açınım ölçüsü Düzleştir modunun sonucundan, DXF indirilen dosyanın içeriğinden okundu.

Betikler (`tests/e2e/denetim2/`): `d6h.py` (yardımcılar: Düzleştir, DXF indir + ayrıştır, kenar/yüz tıklama), `d6_taban.py`, `d6_kenar.py`, `d6_bukum.py`, `d6_kose.py`, `d6_sekil.py`, `d6_ebeveyn.py`, `d6_mobil.py`, `d6_akis.py`. Her biri `SONUC: TAMAM/HATA` basar (HATA satırları aşağıdaki bulgulara karşılık gelir). Not: makine paylaşımlı olduğundan betikler `ONLY=K1,K2` ile bölüm bölüm de çalıştırılabilir.

### Özet

| Önem | Sayı |
|---|---|
| Kritik | 2 |
| Yüksek | 3 |
| Orta | 3 |
| Düşük | 8 |
| **Toplam yeni** | **16** (D6-10 yalnız bilgi) |

İlk denetimden hâlâ geçerli: **P-4** (taban flanş, çizgiden büküm, kademe, gönye flanş, havalandırma, aç/katla eskizleri ağaçta yok, "Eskizi düzenle" yok — 6 betikte yeniden doğrulandı), **P-15** (BA/BD 90° → K), **P-30** (kenar flanş / kenet / gönye önizlemesi kapalı başlar: kenar seçilince hacim 12000'de kalıyor), **P-31** (düz desen ağaçta özellik değil).

En kritik 5:
1. **D6-1 (Kritik)** Loft "Sac geçiş parçası" işaretli olsa da sonuç dolu katı (701 523 mm³, 8 yüz; cidar yok) — sessizce yanlış geometri.
2. **D6-2 (Kritik)** Saca Dönüştür: kalınlık ≠ kabuk kalınlığı uyarısız kabul; açınım 4 yerine 2 bükümlü yanlış ölçü; büküm kenarı referansları her yeniden yapıda kayıyor → aynı belge Düzleştir / yenile sonrası farklı hacim (34 569,8 → 33 902,4 → 35 374,6 → 33 952,8).
3. **D6-3 (Yüksek)** Köşe Kapat "Bindirme": boşluk yok sayılıyor, flanşlar kaynaşıyor, Düzleştir / DXF alınamıyor.
4. **D6-4 (Yüksek)** Saca Dönüştür'de büküm yarıçapı ≠ kalınlık → açınım yapılamıyor; R düzenlenince OCC hatası.
5. **D6-5 (Yüksek)** Tırnak ve Yuva: gereken dar uç yüzü karşı levhaya değdiği için grafik alanda seçilemiyor (komut UI'dan kullanılamıyor).

Kapsama: alandaki 21 komutun 21'i matriste (+ 34 seçenek satırı). (c) adımı P-4 yüzünden doğrudan yapılamadığından kullanıcının tek yolu — eskiz ölçülerini önceden `=W` / `=H` global değişkene bağlayıp Değerlendir > Denklemler'den değiştirmek — gerçek tıklamayla denendi (`d6_ebeveyn.py`): kenar flanşları, kenet, şekillendirme, köşe kapat, köşe kır W 100→130→70 / H 60→80 / 50×30 değişimlerinde doğru kenarda kaldı, yenilemede kayma yok. ✔

### Kapsam matrisi

a oluştur + sayısal · b Düzenle · c ebeveyn eskiz değişimi · d geri al / ileri al · e kayıt + yenile · f ✕ · g sil / bastır. ✓ geçti, ✗ bulgu, – uygulanamaz.

| Komut / seçenek | a | b | c | d | e | f | g | Not / betik |
|---|---|---|---|---|---|---|---|---|
| **Taban Flanş** – kapalı levha | ✓ 12000/18000 | ✓ | ✗ P-4 (Denklemler yolu ✓) | ✓ | ✓ | ✓ (önizleme 24000 → geri) | ✓ bastır → bağımlı hata gösterir, sil + geri al | d6_taban T1 |
| ↳ açık profil L / U (derinlik, orta düzlem, malzeme tarafı) | ✓ 76,712 / 80,712 / U 133,425, hacim çeyrek halka | ✓ | – | ✓ | ✓ | – | – | T4, T5 |
| ↳ kalınlık / büküm yarıçapı | ✓ (R5 79,425; t4 84,283) | ✓ | – | ✓ | ✓ | – | – | T4, T6 |
| ↳ K faktörü | ✓ 0,5 → 81,712; 0,3 → 81,084 + bilgi satırı | ✓ | – | – | – | – | – | T2 |
| ↳ büküm payı (90°) | ✓ BA 5 → 82 (90°dışı P-15) | ✓ | – | – | – | – | – | T2 |
| ↳ büküm düşümü (90°) | ✓ BD 4 → 81, DXF 100×81 | ✓ | – | – | – | – | – | T2 |
| ↳ büküm tablosu | ✓ 90°→6 → 83, 45° → 82,343; ✗ D6-12 (K<0 kırpma) | ✓ | – | – | ✓ kayıtta | – | – | T2, T3 |
| ↳ kalınlık tablosu | ✓ "3 mm" → t3 r3 K0,44 → 79,786 | ✓ | – | – | – | – | – | T2 |
| ↳ büküm boşaltma oranı / türü (dikdörtgen / oval / yırtma) | ✓ hacim sırası, oran 0 = yok | – | – | – | – | – | – | d6_kenar K4 |
| ↳ köşe boşaltma türü (dairesel) | ✓ tepside hacim değişir, açınım 4 büküm | ✓ | – | – | – | – | – | K6 |
| **Kenar Flanş** – 90°, dış/iç sanal keskin, teğet × içte/dışta/bükümün dışı | ✓ 5 kombinasyon (81,712 / 83,712 / 85,712 / 83,712 / 85,712) | ✓ | ✓ (Denklemler) | ✓ | ✓ | ✓ (seçim temizle + ✕ korunur) | ✓ sil → 12000 | K1, K2 |
| ↳ açı 45° / 60° / 120° / 135° / 180° | ✓ büküm açıları; ✗ D6-6 (90° dışı konum) | ✓ | – | – | ✓ | – | – | K2, K3, T3 |
| ↳ yönü ters | ✓ y −23..2, açınım aynı | – | – | – | – | – | – | K3 |
| ↳ özel yarıçap | ✓ R5 → 80,425 | – | – | – | – | – | – | K3 |
| ↳ baştan / sondan kısalt | ✓ x 10..80 | – | – | – | – | – | – | K4 |
| ↳ profil daraltma | ✓ 16132,48; aşırı → hata | – | – | – | – | – | – | K4 |
| ↳ serbest profil eskizi (+ "Profil eskizi oluştur") | ✓ = standart, ağaçta, düzenlenir | – | – | – | – | ✗ D6-8 | – | K5 |
| ↳ çoklu kenar, köşe boşluğu, 4 kenar tepsi | ✓ 143,425×103,425, DXF 4 büküm | ✓ | ✓ | – | – | – | – | K6, E1 |
| ↳ önizlemeyi göster | ✓ (varsayılan kapalı: P-30) | – | – | – | – | – | – | K2 |
| ↳ kenarsız ✓ | ✓ reddedilir | | | | | | | K2 |
| **Kenet** – kapalı / açık × içte / bükümün dışı | ✓ 180°, iç tutarlı; ✗ D6-13 (uzunluk yorumu, doğrulanmadı) | ✓ L10→15 +1000 | ✓ (Denklemler) | ✓ | ✓ | ✓ | ✓ sil → karşı flanş yaşar | d6_bukum H1 |
| ↳ yönü ters / flanş ucuna kenet | ✓ | – | – | – | – | – | – | H1 |
| **Çizgiden Büküm** – merkez çizgisi / içte / dışta | ✓ açınım 100×60, DXF çizgi 30 mm | ✓ | ✗ P-4 | ✓ | ✓ | – | – | B1 |
| ↳ bükülen taraf / yön / 45° / R5 / kısa çizgi | ✓ | ✓ | – | ✓ | – | – | – | B1 |
| ↳ çok çizgili eskiz | ✗ D6-14 | | | | | | | B1 |
| **Kademe** – yükseklik / hareket eden taraf / yön | ✓ 2 zıt büküm, izdüşüm 60 korunur | ✓ | ✗ P-4 | ✓ | ✓ | ✓ | – | J1 |
| ↳ çok küçük yükseklik | ✓ ✓ reddedilir ("en az 6.01 mm") | | | | | | | J1 |
| **Gönye Flanş** – 1 / 2 kenar, köşe boşluğu, malzeme ters | ✓ 4 büküm; ✗ D6-15 (konum seçeneği yok) | ✓ | ✗ P-4 | ✓ | ✓ | ✓ | ✓ bastır / etkinleştir | d6_kose G1 |
| ↳ yalnız açık eskiz listelenir, uçta olmayan profil → hata | ✓ | | | | | | | G1 |
| **Köşe Kapat** – alın, boşluk | ✓ | ✓ boşluk 0,2→1 | ✓ flanş 30→40, Denklemler | ✓ | ✓ | ✓ | ✓ flanş silinince hata + pencere (D6-17) | C1 |
| ↳ bindirme | ✗ D6-3 | | | | | | | C1 |
| ↳ kaynaklı köşe | ✓ hacim artar, açınımda bastırılır, sonra geri | ✓ | | ✓ | ✓ | | | C1 |
| **Şekillendirme** – yuvarlak (koniklik, ters, 2 konum) | ✓ +452,39 / ×2 | ✓ | ✓ t2→1 | ✓ 6× geri al | ✓ | ✓ konumlar korunur | – | d6_sekil F1 |
| ↳ dikdörtgen kabartma (açı) / panjur | ✓ +2·736 / panjur > 0 | ✓ | – | – | – | – | – | F1 |
| ↳ açınım + DXF | ✓ açılır; ✗ D6-11 (DXF'te iz yok) | | | | | | | F1 |
| ↳ konumsuz ✓ | ✓ reddedilir | | | | | | | F1 |
| **Tırnak ve Yuva** | ✗ D6-5 (yüz seçilemiyor) | – | – | – | – | – | – | T1 (ilk denetim sm4 setDoc ile ✓) |
| **Havalandırma** – kaburga genişliği | ✓ −3040 / 2880, açınım alanı | ✓ | ✗ P-4 | ✓ | ✓ | – | ✓ bastır | V1 |
| **Çapraz Kırma** – açı, ters | ✓ hacim aynı, kayıt | ✓ | – | ✓ | – | – | – | X1; ✗ D6-11 (DXF) |
| **Sac Takviye** – L, w, konum % | ✓ +147,42 / +446,56 | ✓ | ✓ flanş 30→40, R2→4 | ✓ | ✓ | – | ✓ flanş silinince hata | U1 |
| **Köşe Kır (R)** | ✓ −10,73 / −42,92, açınımda yay | ✓ | ✓ W/H 4 değişim | ✓ | ✓ | – | – | R1, E2 |
| **Köşe Kır (pah)** | ✓ −25 / −100 | ✓ | – | ✓ | ✓ | – | – | R1 |
| ↳ yüz kenarı seçilirse | ✓ hata (P-21 genel mesaj) | | | | | | | R1 |
| **Saca Dönüştür** – t2 R2 K0,5 | ✓ açınım 173,425×133,425 (SW ile aynı) | ✗ D6-4 (R değişimi) | – | ✓ | ✓ | – | – | S1 |
| ↳ R ≠ t | ✗ D6-4 | | | | | | | x8 |
| ↳ t ≠ kabuk kalınlığı | ✗ D6-2 | | | | | | | S1, x9 |
| ↳ sonra kenar flanşı | ✓ | | | | | | | S1 |
| **Aç/Katla Kes** | ✓ Ø10 + bükümü geçen 20×20 → −957,08, açınım alanı, DXF Ø10 | – | ✓ flanş 30→40 / ✗ P-4 eskiz | ✓ | ✓ | – | – | AK1 |
| **Ekst. Kesme** (sacta, normal kesim) | ✓ −π·50, açınımda delik | – | – | ✓ | – | – | – | N1 (+ th3 ilk denetim) |
| **Delik Sihirb.** (sacta) | ✓ M8 Ø9 −127,23, açınımda 2. delik | – | – | – | – | – | – | N1 |
| **Eskiz** (Sac sekmesinden / Üst düzlem) | ✓ gerçek çizim → taban flanş | – | – | – | ✓ | – | – | d6_akis W1 |
| **Düzleştir** | ✓ ölçü / büküm tablosu / çıkınca model aynı (D6-2 hariç) | – | – | – | – | – | – | tüm betikler |
| **Açınım DXF** | ✓ KESIM / BUKUM_* / NOTLAR, büküm konumu = büküm ortası, sınır kutusu notu, t notu | – | – | – | – | – | – | T2, T5, K6, W1, M6 |
| Geçiş parçası (Loft + Sac geçiş) | ✗ D6-1 | – | – | – | ✓ | – | – | W2 |
| Telefon: Taban Flanş, Kenar Flanş (parmak), Kenet, Şekillendirme (2 dokunuş), Çizgiden Büküm, Havalandırma, Düzleştir, DXF | ✓ (✗ D6-7) | ✓ | – | ✓ ↶ ↷ | ✓ | – | – | d6_mobil |

Kapsama oranı: **21 / 21 komut** (+ alandaki 34 seçenek satırı).

### İş akışları

| # | Senaryo | Cihaz | Sonuç |
|---|---|---|---|
| 1 | Üst düzlemde dikdörtgeni gerçekten çiz (Eskiz > Dikdörtgen, 2 tık) → Taban Flanş kalınlık tablosu "1,5 mm" → iki kenarda tek Kenar Flanş L20 → Düzleştir 137,369 × 97,369 (= W/H + 17,369) → Açınım DXF (2 büküm çizgisi, "t=1,5" notu) → Ctrl+S dosyası (sheetbase + edgeflange) → yenile | Masaüstü | ✓ (`d6_akis` W1) |
| 2 | Eskiz ölçüleri =W / =H (Denklemler + Eskizi düzenle çift tık) → Taban → ön / sağ kenar flanşı → arka kenet → kabartma → köşe kapat → W 130 / H 80 / W 70 → açınım +30 / +20 / −30, 2× yenileme kararlı, geri al | Masaüstü | ✓ (`d6_ebeveyn` E1) |
| 3 | İki kenarlı köşe gönyeli flanş + arka köşede Köşe Kır R8 (arkadan bakıp yakınlaştırarak kenar seçimi) → W/H 160×60, 160×120, 50×30 | Masaüstü | ✓ (E2) |
| 4 | İki ayrı kenar flanşı → Köşe Kapat (alın → boşluk → kaynaklı) → açınım → flanş boyu 30→40 → flanş sil → pencere → geri al | Masaüstü | ✓ alın / ✗ bindirme (D6-3) |
| 5 | Kabuklu kutu → Saca Dönüştür (alttan bakıp 4 büküm, izometrik + arkadan 4 yarık) → açınım → R / K düzenle → kenar flanşı ekle | Masaüstü | ✗ (D6-2, D6-4); t=r=2 temel durum ✓ |
| 6 | Levha + flanş → Aç/Katla Kes (delik + bükümü geçen yuva) → Normal kesim → Delik Sihirbazı → açınım alanları → DXF | Masaüstü | ✓ (`d6_sekil` AK1, N1) |
| 7 | Daire Ø100 → Düzlem 80 → 120×80 → Loft + Sac geçiş parçası → Açınım (DXF indir) → Sac > Düzleştir | Masaüstü | ✗ (D6-1); geçiş açınım DXF / alan 286,8 cm² ✓ |
| 8 | Telefonda: taban → ✓ düzenle t3 → ↶ ↷ → Düzleştir; parmakla kenar flanşı → 45° → yenile; kenet; 2 kabartma; çizgiden büküm 60°; havalandırma + DXF | Telefon 390×844 | ✓ (D6-7 dışında) |

### Bulgular

##### ✅ D6-1 · Sac geçiş parçası (Loft + "Sac geçiş parçası") dolu katı üretiyor
- **Önem:** Kritik · **Tür:** Sessizce yanlış geometri
- **SolidWorks:** Lofted-Bend: t kalınlıkta, uçları açık sac cidar; Düzleştir ile açılır.
- **Bizde:** `d6_akis.py` W2 / `/tmp/d6/x12.py`: Üst düzlemde Ø100, 80 mm ofset düzlemde 120×80 → Özellikler > Loft → "Sac geçiş parçası (loft büküm)" işaretle (Sac kalınlığı 2) → ✓. Kayıtta `sheetT: 2`, ama hacim **701 523,74** (işaretlemeden önceki dolu loft ile aynı), yüz sayısı **8**, Kontrol: tek geçerli katı. Beklenen ≈ 28 680 mm² × 2 ≈ 57 000 mm³ ve uçları açık cidar. Hata / uyarı yok. PM'deki "Açınım (DXF indir)" ise doğru açınım veriyor (286,8 cm²) — model ile açınım birbirini tutmuyor. Ayrıca Sac > Düzleştir "Önce bir taban flanş oluşturun" diyor.
- **Kod:** `src/kernel.worker.ts:3659-3667` — `onEnd` ölçütü (`resolvePlane(p.pl)` çerçevesi + 1e-3 / 1e-4 toleranslar) hiçbir uç yüzü eşlemiyor gibi; seçilen yüz yokken `solid.shell(...)` katıyı değiştirmeden döndürüyor. (İlk denetimin lb1 testi yalnız açınımı ölçüyor.)
- **Öneri:** Uç yüzleri loft'un ilk / son yüzü olarak (topolojiden) seç; eşleşen yüz sayısı ≠ profil sayısı ise hata ver; sonra hacim / yüz sayısını doğrula.

##### ✅ D6-2 · Saca Dönüştür: kalınlık uyuşmazlığı uyarısız, açınım yanlış, referanslar her yapıda kayıyor
- **Önem:** Kritik · **Tür:** Sessizce yanlış geometri / kararsız model
- **SolidWorks:** Kalınlık seçilen sabit yüzden yeniden kurulur ya da tutarsız gövdede hata verir; aynı belge her açılışta aynıdır.
- **Bizde:** `d6_kose.py` S1, `/tmp/d6/x9.py`: 100×60×40 kutu, 2 mm kabuk (hazır) → Saca Dönüştür, Kalınlık **3** → alttan (Ctrl+6) 4 alt kenar, izometrik + arkadan 4 köşe kenarı → ✓: hata yok, hacim 34 569,8. Düzleştir: **2 büküm**, 135,498 × 95,498 (4 büküm olmalı). Düzleştir'den çıkınca hacim **33 902,36**; yenile → **35 374,6**; tekrar yenile → **33 952,8**. Kayıttaki büküm kenarı orta noktaları her yapıda değişiyor: `[50,0,-60]` → `[47.6768,0,-60]` → `[52.3232,0,0]` … (kalıcı referans onarımı `heals` yanlış kenarları yazıyor).
- **Kod:** `src/kernel.worker.ts:1862-1935 toSheet`: yarıklar ve köşe boşaltma kutuları (`rt = r + t`) büküm kenarlarını keserek böldükten **sonra** `matchEdges(f.bends)` yapılıyor → orta nokta kayıyor, imza ile eşleşip `heals` yeni konumu belgeye yazıyor; iç kenar araması `perpD ∈ [0.9t, 2.1t]` kalınlık uyuşmayınca köşegendeki yanlış kenarı (2,83 mm) kabul ediyor.
- **Öneri:** Büküm kenarlarını yarık / boşaltma kesiminden önce eşle (hash'leri sakla); kalınlık yüz çiftlerinden ölçülüp `t` ile karşılaştırılsın, uyuşmazsa hata; bu özellik için heals yazma.

##### ✅ D6-3 · Köşe Kapat "Bindirme": boşluk yok sayılıyor, parça açılamıyor
- **Düzeltildi:** bindirmede karşı flanşın düz kısmı uzatmanın tam kesiti ± boşlukla kırpılır, uzatma büküm bölgesinin boşluk kadar üstünden başlar → gövdeler kaynaşmaz, açınım / DXF alınır (iki flanşın toplam hacmi alına yakın kalır; test beklentisi buna göre düzeltildi).
- **Önem:** Yüksek · **Tür:** İşlev çalışmıyor
- **SolidWorks:** Bindirme (overlap) seçili boşlukla kurulur; düz desen alınır.
- **Bizde:** `d6_kose.py` C1, `x7.py`: iki ayrı kenar flanşı (L30) → Köşe Kapat → sağ flanşın uç yüzüne tık → "Bindirme (dış yüze kadar)" → Boşluk 0,2 ve 1: hacim ikisinde de **20 438,27** (alında 20 427,87 / 20 386,27 — boşluk etkili). Düzleştir: **"Açınım dış hattı kapanmıyor (sac geometrisi açılamadı)"**, Açınım DXF de alınamıyor. Kaynaklı seçeneği bindirmede de etkisiz.
- **Kod:** `src/kernel.worker.ts` `closeCorner` (≈ satır 3584 çağrısı) — bindirmede uzatma diğer flanşın dış yüzüne kadar boşluksuz yapılıyor, gövdeler kaynaşıyor.
- **Öneri:** Bindirmede uzatılan flanşı karşı flanşın iç yüzünü geçecek kadar uzatıp karşı flanştan `gap` kadar uzak tut (iki gövde arası ayrık); açınımda boşluk korunmalı.

##### ✅ D6-4 · Saca Dönüştür'de büküm yarıçapı ≠ kalınlık: açınım yok / OCC hatası
- **Önem:** Yüksek · **Tür:** İşlev çalışmıyor
- **Bizde:** `x8.py`: aynı kutu, Kalınlık 2, Büküm yarıçapı **4** (ya da **0,5**) → ✓: model kurulur (34 468,42; silindirler R4/R6) ama Düzleştir: "Bu gövde sabit kalınlıklı bir sac değil ya da sac kalınlığı farklı". R2 ile kurulmuş özelliği Düzenle → R 4 → ✓: "Geometri işlemi başarısız (OpenCascade hatası)". Yalnız R = t çalışıyor.
- **Kod:** `toSheet` köşe boşaltma `rt = f.r + t` kutuları ve dış / iç kenar yuvarlatma (`doFillet(outer, r+t)`, `doFillet(inner, r)`) — R ≠ t'de köşe bölgesinde sabit kalınlık bozuluyor.
- **Öneri:** Köşe boşaltmasını büküm bölgesinin açınım genişliğine (r+t) göre her iki komşu bükümde ayrı kur; hatada hangi köşenin sorun olduğunu söyle.

##### ✅ D6-5 · Tırnak ve Yuva: gereken uç yüzü grafik alanda seçilemiyor
- **Önem:** Yüksek · **Tür:** İşlev UI'dan kullanılamıyor
- **SolidWorks:** Tırnak için kenar / yüz, yuva için karşı yüz ayrı seçilir; çakışık yüzler "Diğerini seç" ile alınır.
- **Bizde:** `d6_sekil.py` T1: dikey levha (y 0..40, z 0..3) yatay levhanın (y −4..0) üstünde (sm4 düzeni) → Sac Metal > Tırnak ve Yuva → dikey levhanın alt dar yüzüne (y = 0) 4 kez tıklandı: her seferinde dikey levhanın ön yüzü (`c [50,20,3] n +z`) seçildi. Yüz, karşı levhanın üst yüzüyle çakışık olduğu için hiçbir yönden görünmüyor; PM'de "diğerini seç" yok. İlk denetimdeki sm4 bu yüzü `setDoc` ile verdiği için kaçırılmıştı.
- **Öneri:** Kenar seçimi (alt kenar) kabul et, ya da yüzey seçiminde aynı yere tekrar tıkla / Alt ile çakışık adayları dolaş; seçilen yüz yanlışsa "dar uç yüzü değil" diye uyar.

##### ✅ D6-6 · 90° dışı kenar flanşında "Malzeme içte" konumu ve açınım SW'den farklı
- **Önem:** Orta · **Tür:** SolidWorks'ten farklı (yarı doğrulandı)
- **Bizde:** `d6_taban.py` T3, `x3.py`: 100×60 levha, ön kenar, L25 dış sanal keskin, 45°, Malzeme içte → taban yine **r+t = 4** mm kısaltılıyor (90° kuralı); flanş dış yüzünün taban alt yüzüyle kesişimi (dış sanal keskin) z = **−2,343** (kenar z = 0 olmalı); tabanın dış ölçüsü 57,66; açınım **81,699** (SW: 60 + 25 − 2·OSSB + BA = **84,042**). 135°'de de aynı 4 mm geri çekme (açınım 84,069).
- **Kod:** `src/kernel.worker.ts` `edgeFlange` konum kaydırması açıdan bağımsız `r + t`.
- **Öneri:** Malzeme içte için geri çekme = dış setback `(r+t)·tan(θ/2)` (θ ≤ 90°); θ > 90°'de SW'nin teğet / sanal keskin tanımı.

##### ✅ D6-7 · Telefonda ⤢ Sığdır özellik panelini hesaba katmıyor
- **Önem:** Orta · **Tür:** Telefon kullanılabilirliği
- **Bizde:** `d6_mobil.py` M2, `x11.py` (390×844): Taban flanş → Kenar Flanş → ekran çubuğu ⤢ → ön kenar ekranda y = 492,6, panel üstü 481,6: seçilecek kenar alt panelin arkasında. Kullanıcı ▾ ile paneli küçültüp tekrar ⤢ yapmak zorunda (betik bunu yaptı, sonra seçim çalıştı). Kenet ve şekillendirme dokunuşlarında da aynı.
- **Öneri:** PM açıkken `fit` görünür alanı (panel üstüne kadar) kullansın; kenar seçimi bekleyen PM açılınca otomatik sığdır.

##### ✅ D6-8 · "Profil eskizi oluştur" ✕ ile geri alınmıyor
- **Önem:** Orta · **Tür:** Veri kirliliği / geri alma tutarsızlığı
- **Bizde:** `d6_kenar.py` K5: Kenar Flanş PM → kenar → "Profil eskizi oluştur (dikdörtgen)" → ✕ → Kaydetmeden çık: belgede **"Eskiz1 (flanş profili)"** kalıyor (ağaçta, kayıtta). Ad ayrıca taban eskizi "Eskiz1" ile çakışıyor. ✓ ile kurulunca profil eskizi ağaçta flanştan **sonra** listeleniyor.
- **Kod:** `src/main.ts` ≈ 3853–3870 (doğrudan `doc.features.splice` + `saveDoc()`).
- **Öneri:** Profil eskizini taslağa bağla; ✕'te sil; `nextName` tüm eskizleri saysın; flanştan önce ekle.

##### ✅ D6-9 · Şekillendirme yüz sınırı dışına taşabiliyor, uyarı yok
- **Önem:** Düşük · **Tür:** Sessiz garip geometri (doğrulanmadı ayrıntısı)
- **Bizde:** `d6_ebeveyn` ilk sürüm: izometrikte ön flanşın arkasında kalan taban noktasına tıklanınca kabartma flanş dış yüzünün üst kenarına konuldu; bbox y 25 → 29, z 0 → 8 (kabartma flanş kenarından taşıyor), hata yok.
- **Öneri:** Konum yüz sınırı + çap/2 içinde değilse uyar.

##### D6-10 · Sac takviye / iç büküm yüzü, uç yüzleri izometrikte görünmüyor (bilgi)
- Seçim için Ctrl+2 / yakınlaştırma gerekti; işlev ✓. (Bulgu sayısına katılmadı.)

##### ✅ D6-11 · Açınım DXF'inde şekillendirme ve çapraz kırma izi yok
- **Düzeltildi:** `unfold` `flatPt` / `flatFace`; açınım DXF'inde `ISARET` katmanı: şekillendirme merkez artısı + dış çap dairesi + not (KABARTMA / PANJUR), çapraz kırma köşegenleri + not.
- **Önem:** Düşük · **Tür:** Eksik (SW davranışı doğrulanmadı)
- **Bizde:** `d6_sekil` F1 / X1: panjurlu / kabartmalı / çapraz kırmalı levhanın DXF'i yalnız 4 KESIM çizgisi + 2 not; kabartma merkezi, panjur kesiği ya da kırma çizgisi yok. SW düz desende şekillendirme aracını (merkez / profil) ve çapraz kırmayı gösterebilir.
- **Öneri:** NOTLAR / ayrı katmanda şekillendirme merkezleri ve panjur kesik çizgileri.

##### ✅ D6-12 · Büküm tablosunda geçersiz BA uyarısız kırpılıyor
- **Önem:** Düşük · **Tür:** Sessiz düzeltme
- **Bizde:** T3: 135° satırına BA 3 (iç yay 4,712'den küçük → K < 0) → açınım 81,712 (K = 0'a kırpılmış), uyarı yok. SW tabloyu olduğu gibi kullanır.
- **Kod:** `src/sheet/sheet.ts` `tableK` (0…1 kırpma). **Öneri:** BA'yı doğrudan kullan (P-15 ile birlikte) ya da uyar.

##### ✅ D6-13 · Kenet uzunluğu düz kısım (teğet) olarak ölçülüyor
- **Önem:** Düşük · **Tür:** SolidWorks'ten farklı (doğrulanmadı)
- **Bizde:** H1: kapalı kenet L10 → katlanan düz bölüm tam 10 (dıştan 12,05); açınım 71,249 (dış katlama kenarından ölçülseydi 69,199). Kapalı kenette 0,1 mm boşluk (iç R 0,05). Kod kendi içinde tutarlı.
- **Öneri:** SW'deki ölçü tanımıyla karşılaştırıp PM'de ölçü referansını belirt.

##### ✅ D6-14 · Çizgiden Büküm tek çizgiyle sınırlı
- **Önem:** Düşük · **Tür:** Eksik seçenek
- **Bizde:** B1: iki çizgili eskiz → ✓ → "Eskizde tek bir büküm çizgisi olmalı" (PM açık kalır). SW aynı eskizdeki birden çok çizgiyle birden çok büküm yapar.

##### ✅ D6-15 · Gönye flanşta flanş konumu seçenekleri yok
- **Önem:** Düşük · **Tür:** Eksik seçenek
- **Bizde:** G1: yalnız "Malzeme tarafını ters çevir" ve köşe boşluğu; SW'deki Malzeme içte / dışta / Bükümün dışı ve baştan/sondan kısaltma yok. Profil çizgisi düşey bacağın iç yüzü ama üst bacağın dış yüzü oluyor (bbox y 22, z 0..15 → açınım 92,425).

##### ✅ D6-16 · Açınım büküm yönü (YUKARI / AŞAĞI) sabit yüze göre değişiyor; sabit yüz seçilemiyor
- **Önem:** Düşük · **Tür:** Tutarlılık
- **Bizde:** Aynı yöne bükülmüş tek kenar flanşı K1'de "Yukarı", iki kenarlı tepside (K6) her ikisi "Aşağı"; kenet "içte" Yukarı, "bükümün dışı" Aşağı. Tek modelde göreli olarak doğru (zıt flanşlar zıt çıkıyor, K3), ama abkant DXF'inde yön etiketi bakış yüzüne bağlı ve kullanıcı sabit yüzü seçemiyor (SW: Düz Desen'de sabit yüz).

##### ✅ D6-17 · "Eksik referans" penceresi geri al sonrası açık kalıyor
- **Önem:** Düşük · **Tür:** Arayüz
- **Bizde:** C1g: Kenar-Flanş2 silinince Köşe-Kapatma1 için "Eksik referans" penceresi açılıyor; Ctrl+Z ile flanş geri gelince pencere kapanmıyor, kalıcı (modal) pencere ağaç / sekme tıklamalarını engelliyor (betikte Esc gerekti).

#### Denendi – sorun yok (özet)
K / BA / BD / tablo / kalınlık tablosu açınım değerleri (90°), U profil açınımı ve büküm çizgisi konumu (büküm ortası), dış/iç/teğet ölçü referansı × içte/dışta/bükümün dışı, özel R, kısaltma + 3 büküm boşaltma türü, profil daraltma ve hata, serbest profil = standart, 4 kenarlı tepsi + dairesel köşe boşaltması, kenet 4 kombinasyon, çizgiden büküm 3 konum (açınım sabit 100×60 — SW ile aynı), kademe (küçük yükseklik reddi), gönye flanş 2 kenar, köşe kapat alın + kaynaklı, köşe kır R / pah, saca dönüştür (t = R = kabuk), aç/katla kes, normal kesim, sacta delik, şekillendirme 3 tür, havalandırma, çapraz kırma, sac takviye, Düzleştir aç / kapa sonrası model aynı (D6-2 hariç), DXF katman / not / sınır kutusu, Ctrl+S dosya içeriği, yenileme, telefonda 6 komut. Ebeveyn eskiz ölçüsü (Denklemler yoluyla) değişince tüm flanş / kenet / köşe kapat / köşe kır / takviye doğru kenarda kaldı.

---

## Denetim 2 — d7: Yüzeyler ve gelişmiş özellikler

Sürüm: v0.85 derlemesi (`imajcad-v97`, localhost:4173). Tarih: 2026-11-14. Ajan: d7.
Yöntem: PROTOKOL.md. Komutlar şeritten (`#cmds button[title]`, sekme `#tabs button[data-tab]`), ağaçtan (Düzenle / Eskizi düzenle / Bastır / Sil / Klasöre ekle / Buraya geri sar), sağ tık / uzun basma menüsünden, Değerlendir pencerelerinden (Denklemler, Yapılandırmalar, Malzeme, Kütle Özell., Ne Yanlış?, Kontrol) gerçek tıklama / klavye / CDP dokunmayla çalıştırıldı. PM alanları `fill` + Tab, segment / onay kutusu / seçim kutusu tıklaması, ✓ / ✕ (Kaydetmeden çık / Kaydet ve çık) / Ctrl+Z / Ctrl+Y / ↶ ↷ gerçek basıldı. Kenar / yüz seçimleri modelde gerçek fare tıklamasıyla (telefonda tap). Ebeveyn eskiz değişikliği hep "Eskizi düzenle → ölçüye çift tık → değer → Enter → ✓". `__app` yalnız sonucu okumak için kullanıldı.
**Hazır model (setDoc):** yalnız eskizler, referans düzlemleri, taban blok / kabuk / levhalar, gerektiğinde başlangıç değişkenleri (`vars`) — betiklerde "hazır model" diye işaretli. Tek simülasyon: işletim sisteminin renk penceresi otomatikleştirilemediği için seçilen renk gizli `<input type=color>`'a yazılıp `change` olayı verildi. Tırnak-yuvanın doğru yüzü arayüzden seçilemediği için (D7-11) yaşam döngüsü b–e hazır özellik üzerinde yapıldı.

Betikler (`/home/claude/imaj-cad/tests/e2e/denetim2/`): `d7h.py` (yardımcı, d4h'den türetildi), `d7_yuzey1.py` (Yüzey Ekstrüzyon açık / kapalı / orta düzlem, Düzlemsel Yüzey, Kalınlaştır taraf 1 / 2 / iki, Yüzeyle Kes, mesafe 0), `d7_yuzey2.py` (Yüzey Loft açık / kapalı, Sınır Doldur, Yüzey Kırp düzlem / yüzey / taraf, Yüzey Dik kabuk / katı, zincir), `d7_detay.py` (Kubbe, Yüz Taşı / Sil, Dudak / Yiv, Mandal, Sarma, Tırnak ve Yuva), `d7_denklem.py` (değişkenler, ölçüde / alanda =ifade, ad değişimi, ✕ sızıntısı, yapılandırmalar + tasarım tablosu), `d7_genel.py` (malzeme + kütle, yüz / parça rengi, klasörler, geri sarma çubuğu, Ne yanlış? / Kontrol), `d7_akis.py` (7 masaüstü iş akışı), `d7_mobil.py` (telefon 390×844, 6 durum). Hepsi tek başına çalışır, `SONUC:` basar; `ONLY=Y1,Y4` ile tek durum. Bulgu içeren durumlar bilerek `HATA` verir. **Not:** `d7_yuzey1.py` Y5 (mesafe 0) çekirdeği kilitler — en sona konuldu.

### Özet

| Önem | Sayı |
|---|---|
| Kritik | 2 |
| Yüksek | 6 |
| Orta | 9 |
| Düşük | 5 |
| **Toplam yeni bulgu** | **22** |

İlk denetimden hâlâ geçerli (yeni sayılmadı): **P-2** (derinlik 0 kilitlenmesi — yüzeyde yeni yol, D7-3), **P-7 / P-8 / P-24** (yüzey bastırılınca / silinince Kalınlaştır, Kırp, Dik hata verir; silmede bağımlılar sorulmaz), **P-9** (statik koordinat — Mandal'da yeni örnek, D7-10), **P-21** (silindir çapı değişince Sarma: "Geometri işlemi başarısız (OpenCascade hatası)"), **P-25** (Kütle Özellikleri'nde Esc → Malzeme penceresi açılıyor — doğrulandı), **P-34** (değişken adı değişince `L*2` güncellenmiyor; toast "Eskiz1: ölçü "L*2" hesaplanamadı", model eski değerde kalıyor — doğrulandı).

**E-35 düzeltmesi bu alanda sağlam:** yüzey eskizleri (Yol, Kontur, Plan, Profil, Kesen) "Eskizi düzenle → çift tık → ✓" ile değiştirildiğinde yüzey ekstrüzyon, loft, kırp, dik, kalınlaştır, yüzeyle kes zinciri doğru yeniden kuruldu; localStorage, Ctrl+S indirmesi ve sayfa yenileme yeni değerde (masaüstü ve telefon).

En önemli 5:
1. **D7-1 (Kritik)** Kalınlaştır, keskin köşeli çok yüzlü yüzeylerde (L yol, kapalı kontur, dikilmiş L kabuk) sessizce yanlış katı üretiyor (L: 2231 / 2267 mm³ — beklenen 2720 / 2863; boru: 3182 / 3224 — beklenen 5280 / ≈5900); Kontrol "geçerli" diyor.
2. **D7-2 (Kritik)** PM alanına `=L` yazıp ✕ "Kaydetmeden çık" → denklem belgeye sızıyor; bir sonraki ilgisiz işlemde derinlik 20 → 50 oluyor. Tersi: bağlı alana sayı yazıp ✕ → bağlantı siliniyor.
3. **D7-4 (Yüksek)** Kapalı boruyu "İki taraf" kalınlaştırma ya da tüm gövdeyi kaldıran Yüzeyle Kes → model tümüyle kayboluyor; ağaçta hatalı özellik yok, Ne yanlış? "✓ Özelliklerde hata yok" diyor.
4. **D7-5 (Yüksek)** Sınır Doldur: PM'de kenarlar tıklanınca ✓ eski "Doldurulacak sınırın kenarlarını seçin" hatasıyla reddediliyor (masaüstü + telefon); yalnız önceden seçili kenarlarla açılırsa çalışıyor. Tersine düzenlemede kenarlar temizlenip ✓ kabul ediliyor.
5. **D7-6 / D7-8 (Yüksek)** Yüzey Kırp'ta önceki yüzey sonraki yüzeyle kırpılamıyor (araç listesi yenilenmiyor, araç = kırpılan). Denkleme bağlı ölçünün Değiştir kutusu sayı gösteriyor; değiştirmeden Enter → bağlantı sessizce siliniyor.

### Kapsam matrisi

Sütunlar: a oluştur (+ sayısal doğrulama) · b ağaçtan Düzenle → parametre → ✓ · c ebeveyn eskiz / taban değişince yeniden kurma · d Ctrl+Z / Ctrl+Y · e localStorage + sayfa yenile (+ Ctrl+S) · f ✕ (Kaydetmeden / Kaydet ve çık) · g bastır / sil → bağımlılar · T telefon. ✓ geçti · ✗ hata (bulgu) · – uygulanamaz / denenmedi (neden).

Envanterde alanıma düşen komutlar: Özellikler > Yüzey (8): Yüzey Ekstrüzyon, Düzlemsel Yüzey, Yüzey Loft, Sınır Doldur, Yüzey Kırp, Yüzey Dik, Kalınlaştır, Yüzeyle Kes; Özellikler > Detay (5): Yüz Taşı / Sil, Kubbe, Dudak / Yiv, Mandal, Sarma; Sac Metal (1): Tırnak ve Yuva; Değerlendir (6): Kütle Özell., Malzeme, Denklemler, Yapılandırmalar, Ne Yanlış?, Kontrol. Toplam 20; **20 / 20 satır var**. Envanter dışı alan öğeleri (sağ tık görünüm / renk, ağaç klasörleri, geri sarma çubuğu) ayrı satırlarda.

#### Envanter komutları
| Komut | a | b | c | d | e | f | g | T | Betik / not |
|---|---|---|---|---|---|---|---|---|---|
| Yüzey Ekstrüzyon | ✓ 1 yüz 60×40, hacim 0 | ✓ 40→50 | ✓ Yol 60→80 | ✓ | ✓ | ✓ | ✗ D7-17 (P-7) | ✓ P1 | yuzey1 Y1, Y2; mesafe 0 ✗ D7-3 |
| Düzlemsel Yüzey | ✓ 1 yüz; delikli ✗ D7-7 | – (yalnız eskiz seçimi) | ✓ 40→50 | ✓ | ✓ | ✓ | – | ✓ P2 | Y3; açık eskiz → Türkçe hata ✓ |
| Yüzey Loft | ✓ açık 60×40; kapalı 4 yüz | ✓ sıra değişimi | ✓ Yol2 60→80 (5600), Ust 20→30 (32000) | ✓ | ✓ | – | ✓ kapak bastır → anlaşılır hata | – | yuzey2 L1, L2; karışık / tek kesit hata ✓ |
| Sınır Doldur | ✗ D7-5 (PM'de seçim ✓ olmaz); önceden seçimle ✓ 24000 | ✗ D7-5 (kenarsız ✓ kabul) | ✗ D7-9 | ✓ | ✓ | – | – | ✗ P3 (D7-5) | yuzey2 F1; 3 kenar (açık sınır) – (D7-5 yüzünden denenemedi) |
| Yüzey Kırp | ✓ Sağ düzlem x≥0; yüzeyle ✓ 400/2000 (sıra koşuluyla) | ✓ taraf / Ön düzlem; ✗ D7-6 | ✓ Plan 40→60 | ✓ | ✓ | ✓ P2 | ✗ D7-17 | ✓ P2 | T1; Üst (eş düzlem) → "Kırpma tüm yüzeyi kaldırdı" ✓; ref. düzlem yok ✗ D7-16 |
| Yüzey Dik | ✓ katı 28000 / 24000; kabuk 2 yüz | ✓ katı ↔ kabuk | ✓ zincir 32000 | ✓ | ✓ | ✓ | ✓ kapak bastır → hata metni | – | L2, K1, F1; açık + katı → Türkçe hata ✓ |
| Kalınlaştır | ✓ düz yüz 7200; ✗ D7-1 (çok yüzlü) | ✓ t, taraf 1 / 2 / iki | ✓ | ✓ | ✓ | ✓ 6 → değişmez / 24000 | ✗ D7-17 | ✓ P1 | Y1, Y2, K1; iki taraf boru ✗ D7-4 |
| Yüzeyle Kes | ✓ 64000 / 128000 | ✓ taraf 2 | ✓ yükseklik 10→15 (96000); =H ile ✓ | ✓ | ✓ | – | ✓ bastır 192000 | – | Y4, A2; tüm gövdeyi kaldırma ✗ D7-4 |
| Yüz Taşı / Sil (taşı) | ✓ +5 → 120000 | ✓ −3 | ✓ genişlik / derinlik (162000) | ✓ | ✓ | – | – | – | detay YT |
| Yüz Taşı / Sil (deliği doldur) | ✓ 96000 | – | ✓ Ø10→16 izler | – | – | – | – | – | YT |
| Kubbe | ✓ h10 → y30 | ✓ h4 | ✓ taban 80→100; dikilmiş katıda ✓ | ✓ | ✓ | ✓ | ✓ | – | KB, A1, A6 (=H ✓) |
| Dudak / Yiv | ✓ +374,3 | ✓ yiv / dış +392 / boşluk 0,5 | ✓ kutu 60→80 | ✓ | ✓ | – | ✓ kabuk bastır → Türkçe hata | – | LP, A3 (yapılandırma) |
| Mandal | ✓ +193,5 | ✓ 90°, boy 25 | ✗ D7-10 | ✓ | ✓ | ✓ | – | – | MN, A5 |
| Sarma | ✓ ≈101 | – | ✓ eskiz 10→20 (×2); silindir Ø40→50 hata (P-21) | ✓ | ✓ | – | – | – | SR |
| Tırnak ve Yuva | ✗ D7-11 (yanlış yüz kabul) | ✓ adet 3 (hazır) | ✓ levha 100→80 | ✓ | ✓ | – | – | – | TS |
| Kütle Özell. | ✓ çelik / alüminyum, 12000 mm³ → 32,4 g | – | ✓ (canlı) | ✓ | ✓ | – | – | – | MK, A7; yalnız yüzey ✗ D7-18; Esc P-25 |
| Malzeme | ✓ | – | – | ✓ çelik ↔ alüminyum | ✓ | ✓ İptal | – | – | MK |
| Denklemler | ✓ L=50, ölçü =L*2, alan =L/2 | ✓ L 50→40 | ✓ model + ölçüler izler | ✓ | ✓ | ✗ D7-2 | ad değişimi P-34 | ✓ P4 | E1–E3; ✗ D7-8, D7-12 |
| Yapılandırmalar | ✓ 2 sütun, L=40, Kesme1 bastır → 48000 | ✓ ad "Kısa" | ✓ geçişte model | ✓ geçiş geri al | ✓ etkin yapılandırma korunur | – | ✗ D7-13, D7-14 | ✓ P4 | C1, A3 |
| Ne Yanlış? | ✓ durum çubuğundan, Radyüs1 listelenir | ✓ Düzenle → PM | – | – | – | – | ✗ D7-20 (Bastır yapılandırmaya yazmaz) | ✓ P6 | NY; D7-4 hatasını göstermez |
| Kontrol | ✓ geçerli, serbest kenar 0 | – | – | – | – | – | – | – | NY; ✗ D7-21; D7-1'i yakalamıyor |

#### PM seçenekleri / envanter dışı
| Öğe | Sonuç | Not |
|---|---|---|
| Yüzey Ekstrüzyon: açık yol | ✓ | Y1 |
| Yüzey Ekstrüzyon: kapalı kontur | ✓ 4 yan yüz, uçlar açık | Y2 |
| Yüzey Ekstrüzyon: orta düzlem | ✓ y ±10 | Y2, Y4 |
| Yüzey Ekstrüzyon: mesafe 0 / −20 | ✗ D7-3 (kilitlenir) | Y5 |
| Kalınlaştır: Taraf 1 / Taraf 2 / İki taraf | ✓ düz yüzde (z 0…3 / −3…0 / ±1,5); ✗ çok yüzlü D7-1, iki taraf boru D7-4 | Y1, Y2 |
| Yüzeyle Kes: Taraf 1'i / 2'yi kaldır | ✓ 64000 + 128000 = 192000 | Y4 |
| Yüzey Kırp: Ön / Üst / Sağ düzlem, yüzey, taraf 1 / 2 | ✓ (Üst eş düzlem → hata ✓); referans düzlem yok ✗ D7-16; yüzey seçimi ✗ D7-6 | T1 |
| Yüzey Dik: Kapalıysa katı oluştur | ✓ / açıkta Türkçe hata ✓ | L2, K1 |
| Yüzey Loft: kesit sırası, açık / kapalı, karışık, tek kesit | ✓ | L1 |
| Yüz Taşı: taşı / deliği doldur | ✓ | YT |
| Dudak / Yiv: dudak / yiv, iç / dış kenar, kenardan boşluk | ✓ | LP |
| Mandal: yön açısı, boy, kalınlık, genişlik, kanca | ✓ (açı, boy denendi) | MN |
| Sarma: kabartma / oyma | ✓ kabartma (oyma d5'te) | SR |
| Tırnak ve Yuva: adet, boy, yükseklik, boşluk | ✓ adet (hazır) | TS |
| Denklem: ölçüde =ifade (Değiştir kutusu) | ✓ oluşturma; ✗ D7-8 yeniden açma | E1 |
| Denklem: PM alanında =ifade (anahtarlı: derinlik, kubbe h) | ✓ / ✗ D7-2 (✕) | E1, E2, A6 |
| Denklem: anahtarsız alanlar (yüzey mesafe, kalınlık) | ✗ D7-12 | E3 |
| Değişken ad değiştir / sil | P-34 hâlâ var; silme – (D7-2 yüzünden bağlantı yoktu) | E2 |
| Tasarım tablosu: değişken hücresi, bastırma, etkin seçimi, ad, ekle | ✓; ✗ D7-13 (tabloda bastır + geri al) | C1 |
| Görünüm: yüz rengi / parça rengi / renkleri sıfırla (sağ tık) | ✓; ölçü (genişlik, derinlik) değişince korunur ✓; geri al / yenile ✓; yüzey yüzünde yok ✗ D7-19 | RN, P5 (uzun basma ✓) |
| Ağaç klasörleri: ekle, tek başlık, adlandır, bastır, aç / kapat, çıkar, yenile | ✓; yapılandırmalı belgede bastır ✗ D7-20 | KL, P6 |
| Geri sarma çubuğu: Buraya geri sar, yeni özellik çubuğun üstüne, yenile, çubuğa dokun = sona sar, geri al | ✓; çubuk üstünde silme ✗ D7-15 | GS, A4, P6 |

### İş akışları

| # | Senaryo | Adımlar | Sonuç |
|---|---|---|---|
| A1 | Kapalı loft → katı → kubbe → kaydet | Yüzey Loft (Alt + Ust) → 2 × Düzlemsel Yüzey → Yüzey Dik (katı) 28000 → Kubbe üst yüze h5 → Ust eskizi 20→30 → Ctrl+S → yenile | ✓ zincir yeniden kuruldu (33973), indirilen dosya güncel, yenileme aynı |
| A2 | Eğik kesen yüzey + değişken | Kesen eskiz yüksekliği `=H` → Yüzey Ekstrüzyon (orta düzlem 100) → Yüzeyle Kes taraf 2 → Denklemler H 10→20 → geri al | ✓ 128000 → 64000 → 128000 |
| A3 | Kabuk + dudak + yapılandırma | Hazır kabuk → Dudak (ağız halkasına tık) → Yapılandırmalar: ekle, Dudak bastır (2. sütun), etkinleştir → yenile → Varsayılan | ✓ 15552 / 16118 geçişleri, yenilemede korunur |
| A4 | Kırpılmış yüzey + klasör + geri sar | Düzlemsel Yüzey → Yüzey Kırp → Kalınlaştır 1200 → iki özellik klasöre → Kalınlaştır'a geri sar (0) → çubuğa dokun (1200) → yenile | ✓ |
| A5 | Yüz taşı + mandal + taban değişimi | Yüz Taşı +5 → Mandal (taşınmış üst yüz) y 40 → Ekstrüzyon derinliği 20→10 | ✗ D7-10: yüz izliyor (y 15) ama mandal y 25…40'ta havada ayrı parça (72193,6) |
| A6 | Kubbe yüksekliği değişkenle | Kubbe yüksekliği `=H` (6) → Denklemler H 12 → yenile | ✓ y 26 → 32 → 32 (ilk koşuda yük altında zamanlama nedeniyle başarısız, tek başına tekrarında geçti) |
| A7 | Yüzeyden levha + malzeme + kütle | Yüzey Ekstrüzyon 50 → Kalınlaştır 4 → Malzeme alüminyum → Kütle Özell. | ✓ 12000 mm³ → 32,4 g |
| E1/C1 | Denklem + yapılandırma tam döngü | (d7_denklem) değişken ekle, ölçü + alan bağla, değiştir, geri al, yenile, yapılandırma ekle / geçiş / ad | ✓ çekirdek akış; ✗ D7-2, D7-8, D7-13, D7-14 |
| P1 (telefon) | Yüzey + kalınlaştır + eskiz düzenle | tepsiden Yüzey Ekstrüzyon → Kalınlaştır iki taraf → Eskizi düzenle, ölçüye çift dokunuş 60→80 → ✓ → ↶ ↷ → yenile | ✓ 7200 → 9600 |
| P4 (telefon) | Denklem + yapılandırma | Denklemler (+ değişken) → Ekstrüzyon `=L` → Yapılandırmalar ekle, L=10, etkinleştir | ✓ pencereler ekrana sığar, 30 → 10 |
| P6 (telefon) | Klasör, geri sar, Ne yanlış? | klasöre ekle → geri sar → çubuğa dokun → derinlik 4 → durum çubuğuna dokun | ✓ Radyüs1 listelenir |
| P2/P3/P5 (telefon) | Kırp, Sınır Doldur, yüz rengi | kırp taraf 2 + ✕; 4 üst kenara dokun + ✓; uzun basma → yüz rengi | ✓ / ✗ D7-5 / ✓ |

### Bulgular

#### ✅ D7-1 · Kalınlaştır keskin köşeli çok yüzlü yüzeylerde sessizce yanlış katı üretiyor
- **Önem:** Kritik · **Tür:** Hata (yanlış geometri, uyarı yok)
- **SolidWorks:** Keskin köşeli (teğet olmayan) bir yüzey / dikilmiş kabuk kalınlaştırılınca köşeler doğru birleşir: L yolu (40 + 30, h 20, t 2) içe 2720, dışa 2880 (yuvarlak köşede 2862,8) mm³; 40×30 kapalı boru h 20 içe 5280, dışa ≈ 5851–5920, ±1 → 5600.
- **Bizde:**
  1. Hazır eskiz: Üst düzlemde L (0,0)→(40,0)→(40,30). Yüzey Ekstrüzyon 20 → ✓ → Kalınlaştır 2 → ✓ → **2231,11**; Düzenle → Taraf 2 → ✓ → **2266,67** (ağdan hesaplanan hacim 2093,3 — OCC hacmiyle de uyuşmuyor; uç yüzlerden biri üçgenimsi, bacak sivriliyor). `d7_yuzey1.py` Y2; görüntü `/home/claude/rapor2/d7_L_kalinlastir.png`.
  2. 40×30 dikdörtgen eskiz → Yüzey Ekstrüzyon 20 (4 yüzlü boru) → Kalınlaştır 2 Taraf 1 → **3182,22** (16 yüz, sınır kutusu değişmedi = içe), Taraf 2 → **3223,70** (44×34 = dışa). Beklenenin ≈ %55–60'ı.
  3. Düzlemsel Yüzey (40×30) + Yüzey Ekstrüzyon (40 çizgi, 20) → Yüzey Dik (kabuk) → Kalınlaştır 2 → her iki tarafta **4000** (beklenen 3840 / 4160 — iki levha birleşmeden üst üste / boşluklu). `d7_yuzey2.py` K1.
  Değerlendir > Kontrol üçü için de "✓ Gövde 1: geçerli · serbest kenar 0" diyor. Tek düz yüzde (7200 / 2400) sonuç doğru.
- **Kod:** `src/kernel.worker.ts:3893–3916` `thick()` → `BRepOffsetAPI_MakeThickSolid.MakeThickSolidBySimple` (basit öteleme köşe birleşimi yapmaz; çok yüzlü kabuklarda kendini kesen / eksik katı üretir), ardından yalnız `volOf < 0` ise `Reversed()`.
- **Öneri:** Çok yüzlü kabukta `MakeThickSolidByJoin` (Intersection = true, GeomAbs_Intersection birleşimi) kullan; sonucu `BRepCheck` + hacim beklentisi (alan × t ± köşe payı) ile doğrula, tutmuyorsa yüz başına ince prizma + birleştirme yedeği ya da Türkçe hata.

#### ✅ D7-2 · PM alanına yazılan =ifade ✕'te geri alınmıyor (denklem sızıntısı / bağlantı kaybı)
- **Önem:** Kritik · **Tür:** Hata (vazgeçilen değişiklik sonra modele geçiyor)
- **SolidWorks:** PM'de ✕ tüm değişiklikleri (alan denklemleri dahil) atar.
- **Bizde:**
  1. Hazır blok (derinlik 20) + değişken L = 50. Ekstrüzyon1 → Düzenle → Derinlik alanına `=L` → ✕ → Kaydetmeden çık. Model 20'de; ama `doc.eqs = {"e1.d1":"L"}` kalmış. Ardından ilgisiz bir işlem (Kesme1 Bastır → Etkinleştir) → derinlik **50** oluyor, model değişiyor.
  2. Tersi: derinlik `=L` bağlıyken (L = 30) Düzenle → 12 yaz → ✕ Kaydetmeden çık → `doc.eqs` boş; sonra L 30→35 → derinlik **30**'da kalıyor (bağlantı sessizce kayboldu).
  Bu değişiklikler geri alma yığınına da girmiyor. `d7_denklem.py` E2.
- **Kod:** `src/ui/dom.ts:38–41` `numField` her `input` olayında `eqHook.set(...)` ile **belgeyi** (`doc.eqs`) doğrudan değiştiriyor; `src/main.ts:315–322` `setEqHook`; `applyEquations` (main.ts:324) PM taslağını yalnız PM açıkken atlıyor.
- **Öneri:** Alan denklemlerini taslakta tut (`draft._eqs`), ✓'de (`commitFeature`) `doc.eqs`'e yaz; ✕'te at.

#### ✅ D7-3 · Yüzey Ekstrüzyon mesafesi 0 çekirdeği kilitliyor (P-2'nin yeni, kolay yolu)
- **Önem:** Yüksek · **Tür:** Hata (uygulama donar)
- **Bizde:** Yol eskizi → Yüzey Ekstrüzyon → Mesafe alanına `0` → (alan kırmızı olmuyor) → ✓ → durum çubuğu "Hesaplanıyor…" 120 sn sonra hâlâ meşgul, sonraki hiçbir kurulum bitmiyor (sayfa yenilenmeli). Katı ekstrüzyonda alan min 0,001 olduğu için P-2 yalnız denklemle oluşuyordu; burada kullanıcı doğrudan 0 yazarak tetikliyor. İki koşuda tekrarlandı. `d7_yuzey1.py` Y5.
- **Kod:** `src/main.ts:2573` "Mesafe" `numField` `min` yok; `src/doc/compile.ts:796` denetimsiz `d`; worker `BRepPrimAPI_MakePrism` sıfır vektör (main.ts / worker zaman aşımı yok — P-2).
- **Öneri:** Alana `min: 0.001` (negatif için "Yönü ters çevir" kutusu), compile'da `d > 0` denetimi; P-2 zaman aşımı.

#### ✅ D7-4 · Gövdeyi yok eden yüzey işlemlerinde model tümüyle kayboluyor, hata hiçbir özelliğe bağlanmıyor
- **Önem:** Yüksek · **Tür:** Hata
- **SolidWorks:** "İki taraf" kalınlaştırma kapalı boruda katı üretir; bir kesme tüm gövdeyi silecekse özellik hata verir, önceki model görünür kalır.
- **Bizde:**
  1. 40×30 kapalı kontur → Yüzey Ekstrüzyon 20 → Kalınlaştır 2 → Düzenle → İki taraf → ✓: ekran boş, hacim yok, durum "1 özellikte hata", ağaçta kırmızı satır yok; Değerlendir > Ne Yanlış? "✓ Özelliklerde hata yok" + "Gövde 1: 0 yüz, 0 kenar, hacim 0". Gizli hata: `featureId: ""`, "Görüntü üretilemedi: Geometri işlemi başarısız (OpenCascade hatası)".
  2. Blok + Yüzeyle Kes (taraf 2), sonra kesen eskiz yüksekliği 35'e (bloğun üstüne) → aynı: model kayboluyor, ağaçta hata yok. `d7_yuzey1.py` Y2, Y4h.
- **Kod:** `src/kernel.worker.ts:4290` mesh hatası `featureId: ""`; `applyTool` (186) kesmede boş sonucu, `thicken` (3909) iki parçanın birleşimini denetlemiyor; `src/main.ts:969–980` boş kimlikli hata sayılıp gösterilmiyor.
- **Öneri:** Her özellikten sonra gövde geçerliliğini (yüz sayısı > 0, hacim > 0) denetleyip hatayı o özelliğe yaz ve önceki gövdeyle devam et; Ne yanlış?'ta kimliksiz hataları da listele.

#### ✅ D7-5 · Sınır Doldur PM'de kenar seçimi ✓'yi açmıyor (önizleme yenilenmiyor)
- **Önem:** Yüksek · **Tür:** Hata (komut arayüzden kullanılamıyor)
- **SolidWorks:** Sınır yüzeyi / Doldurma yüzeyi PM'de kenarlar seçilince önizleme gelir, ✓ oluşturur.
- **Bizde:** Kontur → Yüzey Ekstrüzyon 20 → Sınır Doldur → 4 üst kenara tıkla → PM "4 kenar seçili" → ✓ → toast "Doldurulacak sınırın kenarlarını seçin", PM açık kalıyor (masaüstü F1a, telefonda dokunarak P3). Yalnız kenarlar komuttan **önce** Ctrl+tıkla seçilirse çalışıyor (24000 katı). Tersi: var olan Sınır Doldur'u Düzenle → "Seçimi temizle" → ✓ kabul ediliyor; özellik kenarsız kalıp "Eksik referans" penceresi açılıyor. `d7_yuzey2.py` F1, `d7_mobil.py` P3.
- **Kod:** `src/main.ts:5392–5424` `pmPick` doldurma dalı `d.edges`'i değiştiriyor ama `schedulePreview()` çağrılmıyor (yalnız `GHOST_TYPES` ve mirror/plane); "Seçimi temizle" (2567) de önizleme yapmıyor; `commitFeature` (2234) bayat `draftError`'a bakıyor.
- **Öneri:** Doldurma dalında ve seçim temizlemede `schedulePreview()` / `upd()`; ✓'de `edges.length` doğrudan denetle.

#### ✅ D7-6 · Yüzey Kırp: "Kırpılacak yüzey" değişince araç listesi yenilenmiyor; araç = kırpılan yüzey olabiliyor
- **Önem:** Yüksek · **Tür:** Hata
- **SolidWorks:** Kırpma aracı ve kırpılacak yüzey ayrı seçim kutuları; aynı yüzey iki rolde seçilemez, her sırada oluşturulmuş yüzeyler kullanılabilir.
- **Bizde:** Düzlemsel Yüzey1, sonra Yüzey2 (kesen) → Yüzey Kırp → PM varsayılanı kırpılacak = Yüzey2, araç = Düzlemsel Yüzey1. Kırpılacak'ı Düzlemsel Yüzey1 yap → araç listesi hâlâ `Ön, Üst, Sağ, Düzlemsel Yüzey1` (Yüzey2 yok), taslak `surf = tool`; ✓ → "Kırpma tüm yüzeyi kaldırdı" (yanıltıcı). Önceki yüzeyi sonraki yüzeyle kırpmanın arayüzde yolu yok (düzenlemede de aynı). Yalnız oluşturma sırası ters çevrilirse çalışıyor (400 / 2000 ✓). `d7_yuzey2.py` T1.
- **Kod:** `src/main.ts:2582–2586` `selectField` değişikliğinde `renderFeaturePM` çağrılmıyor; `surf === tool` denetimi yok.
- **Öneri:** "Kırpılacak yüzey" değişince PM'i yeniden çiz, `tool === surf` ise aracı bir sonrakine kaydır; compile'da "araç ve kırpılan aynı olamaz" hatası.

#### ✅ D7-7 · Delikli konturdan Düzlemsel Yüzey oluşturulamıyor (İngilizce iç hata)
- **Önem:** Yüksek · **Tür:** Hata
- **SolidWorks:** İç döngülü kapalı kontur delikli düzlemsel yüzey verir.
- **Bizde:** 40×30 dikdörtgen + ortada Ø10 daire → Düzlemsel Yüzey → durum "Ko(...).sketchOnPlane(...).face is not a function", ✓ kabul edilmiyor. Deliksiz kontur çalışıyor. `d7_yuzey1.py` Y3.
- **Kod:** `src/kernel.worker.ts` `case "surface"` planar dalı `(profile(f.loops).sketchOnPlane(...) as any).face()` — çok döngülü profilde `Sketches` döner, `.face()` yok.
- **Öneri:** Çok döngüde `sketches.faces()` / `makeFace(outer, inners)` kullan.

#### ✅ D7-8 · Denkleme bağlı ölçünün Değiştir kutusu sayıyı gösteriyor; Enter bağlantıyı siliyor
- **Önem:** Yüksek · **Tür:** Hata (sessiz denklem kaybı)
- **SolidWorks:** Bağlı ölçünün Değiştir kutusu `="L"*2` ifadesini gösterir; Enter / ✓ bağlantıyı korur.
- **Bizde:** L = 40, genişlik `=L*2` (etiket "Σ 80"). Eskizi düzenle → etikete çift tık → kutuda **80** → değiştirmeden Enter → ✓ → `expr` silindi; L 40→45 yapılınca genişlik 80'de kaldı (derinlik `=L/2` 22,5'e geçti). `d7_denklem.py` E1.
- **Kod:** `src/sketch/editor.ts:3931` `promptValue(x, y, Math.abs(d.v), …)` ilk değer olarak ifade yerine sayı; 3933–3943 `lastExpr` boşsa `delete dd.expr`.
- **Öneri:** Kutuya `"=" + d.expr` koy; değer değişmediyse ifadeye dokunma; ifade silinecekse SolidWorks gibi sor.

#### ✅ D7-9 · Sınır Doldur kenarları ebeveyn değişince izlenmiyor
- **Önem:** Orta · **Tür:** Hata
- **Bizde:** Kontur → Yüzey Ekstrüzyon 20 → Düzlemsel Yüzey → (önceden seçilmiş 4 kenarla) Sınır Doldur → Yüzey Dik (katı) 24000 → Kontur genişliği 40→50 → "Sınır Doldur1: Sınır kenarlarından bazıları bulunamadı", "Yüzey Dik1: Dikilecek yüzeylerden biri bulunamadı", "Eksik referans" penceresi, hacim 0 (beklenen 30000). `d7_yuzey2.py` F1c.
- **Kod:** `src/kernel.worker.ts` `case "surface"` fill `matchEdges(f.edges)`; seçimde kenar imzası `s` yazılmıyor (`pmPick` `{m, d}`), yüzey kenarları için onarım (heal) oluşmuyor.
- **Öneri:** Kenar referansına seçimde imza ekle; yüzey gövdelerini `matchEdges` imza eşleşmesine kat.

#### ✅ D7-10 · Mandal konumu statik nokta: taban / yüz taşınınca mandal havada kalıyor (P-9 ailesi)
- **Önem:** Orta · **Tür:** Hata (yanlış geometri, uyarı yok)
- **Bizde:** 80×60×20 blok → Mandal üst yüze (y 20) → taban derinliği 20→30 → yüz referansı onarılıyor (`face.c` y 30) ama `p` = [10, 20, 5] kalıyor → mandal y 20…45'te gövdenin içinde (y max 45, beklenen 55). A5: Yüz Taşı +5 + Mandal (y 40) → taban 20→10 → yüz y 15'e iniyor, mandal y 25…40'ta **havada ayrı parça** (hacim 72000 + 193,6). `d7_detay.py` MN, `d7_akis.py` A5.
- **Kod:** `SnapHookFeature.p` (Vec3) — `applyHeals` (main.ts:920) yalnız `{m,d}` / `{c,n}` biçimlerini onarıyor.
- **Öneri:** `p`'yi yüzün yerel (u, v) koordinatı olarak sakla ve onarılmış yüz çerçevesinden yeniden hesapla.

#### ✅ D7-11 · Tırnak ve Yuva: dar uç yüzü tıklanamıyor; yanlış (geniş) yüz uyarısız kabul ediliyor
- **Önem:** Orta · **Tür:** Hata / SolidWorks'ten farklı
- **SolidWorks:** Tırnak gövdesinin kenarı (ve yuva gövdesi) seçilir; yanlış seçim önizlemede görülür.
- **Bizde:** Dikey A levhası (100×40×3) yatay B levhasının üstünde. Sac Metal > Tırnak ve Yuva → PM ipucu "dar uç yüzüne dokunun (karşı levhaya bakan)" — bu yüz B'ye dayalı, görünmüyor. A'nın alt kenarına tıklanınca A'nın ön yüzü (`n = +z`) seçiliyor; ✓ → tırnaklar ön yüzden dışarı çıkıyor, hacim **+3182,5** (doğrusu −42,9), hata / uyarı yok. `d7_detay.py` TS.
- **Kod:** `src/main.ts` tabslot `pmPick` yüz kabulü; worker `faceRectFrame` yüzün dar / karşı gövdeye bakan olup olmadığını denetlemiyor.
- **Öneri:** Kenar seçimi kabul et (kenarın komşu dar yüzü), ya da yüzün kalınlık yönünde dar olduğunu ve normal yönünde başka gövdeye değdiğini denetle; değilse hata.

#### ✅ D7-12 · Denklem anahtarı olmayan alanlar =ifadeyi bağlamıyor
- **Önem:** Orta · **Tür:** Eksik / tutarsızlık
- **Bizde:** T = 3, D = 40. Yüzey Ekstrüzyon "Mesafe" `=D`, Kalınlaştır "Kalınlık" `=T` → 7200 ✓; Denklemler T 5, D 50 → model 7200'de kalıyor (beklenen 15000), `doc.eqs` boş. Alan ifadeyi kabul ettiği için kullanıcı bağlandığını sanıyor. Aynı durum Dudak / Mandal / Tırnak alanlarında (kodda `key` yok). `d7_denklem.py` E3.
- **Kod:** `src/main.ts:2573, 2579, 3977–4000` `numField(...)` çağrılarında `key` yok (Kubbe `key: ${d.id}.h` ile çalışıyor — A6 ✓).
- **Öneri:** Tüm sayısal özellik alanlarına `key: \`${d.id}.<alan>\`` ver.

#### ✅ D7-13 · Tasarım tablosunda bastır + Ctrl+Z tutarsız durum bırakıyor
- **Önem:** Orta · **Tür:** Hata (geri alma tutarsızlığı)
- **Bizde:** Yapılandırmalar → etkin sütunda "Bastır: Kesme1" işaretle → Kapat → Ctrl+Z → Kesme1 etkin (`off` yok) ama yapılandırmanın `off` listesinde hâlâ `e2`; başka yapılandırmaya geçip dönünce Kesme1 kendiliğinden bastırılıyor (96000). `d7_denklem.py` C1.
- **Kod:** `src/main.ts:4300–4310` onay kutusu `c.off`'u `commitDoc` **dışında** değiştiriyor, ardından `setConfig` → `commitDoc` anlık görüntüyü zaten değişmiş tabloyla alıyor; yapılandırma ekleme / ad / silme de geri alma dışı.
- **Öneri:** Tablo değişikliklerini `commitDoc(() => …)` içinde yap.

#### ✅ D7-14 · Bir yapılandırmada ölçüye sayı yazmak tüm yapılandırmaları değiştiriyor
- **Önem:** Orta · **Tür:** SolidWorks'ten farklı
- **SolidWorks:** Ölçü değişince "Bu yapılandırma / Tüm yapılandırmalar / Belirtilen" sorulur.
- **Bizde:** Genişlik `=L` (Varsayılan L 80, Kısa L 40). Kısa etkinken genişliğe 55 → ✓ → ifade silindi; Varsayılan'a dönünce genişlik **55** (80 olmalı). `d7_denklem.py` C1.
- **Öneri:** Yapılandırma varken değer değişikliğinde kapsam sor; "bu yapılandırma" için yapılandırma değişkeni / ölçü geçersiz kılma sakla.

#### ✅ D7-15 · Geri sarma çubuğunun üstünde özellik silinince çubuk kayıyor
- **Önem:** Orta · **Tür:** Hata
- **Bizde:** [Eskiz1, Ekstrüzyon1, Delik, Kesme1, Radyüs1] → Radyüs1'e geri sar (rollback 4) → Kesme1 → Sil (eskiziyle) → özellik sayısı 3, `rollback` hâlâ 4 → Radyüs1 artık çubuğun altında değil, hesaplanıyor; çubuk listenin sonunda. `d7_genel.py` GS.
- **Kod:** `src/main.ts` `deleteFeature` (~6390) `doc.rollback`'i ayarlamıyor (`exitSketch` 1707 ve 2957 ayarlıyor); `moveFeature` de bakılmalı.
- **Öneri:** Silinen her özellik `rollback`'ten önceyse `rollback--`.

#### ✅ D7-16 · Yüzey Kırp aracında referans düzlem / eskiz yok
- **Önem:** Orta · **Tür:** Eksik
- **SolidWorks:** Kırpma aracı düzlem (referans düzlemler dahil), yüzey ya da eskiz olabilir; karşılıklı kırpma seçeneği.
- **Bizde:** Belgede Düzlem1 (Sağ + 10) varken liste yalnız `Ön Düzlem, Üst Düzlem, Sağ Düzlem` + yüzeyler; eskiz ve karşılıklı kırpma yok. `d7_yuzey2.py` T1.
- **Kod:** `src/main.ts:2584`; compile 806 yalnız `std:`.

#### ✅ D7-17 · Yüzey bastırılınca / silinince bağımlılar hata veriyor ve yanıltıcı "Eksik referans" penceresi açılıyor
- **Önem:** Orta · **Tür:** Hata (P-7 / P-24 ailesi; pencere yeni)
- **Bizde:** Yüzey1 → Bastır → Kalınlaştır1 kırmızı "Yüzey bulunamadı (önce yüzey özelliği)" + modal **"Eksik referans — Model değiştiği için seçili kenar / yüz bulunamadı · Yeniden seç / Daha sonra"** (kullanıcı bastırdı, model değişmedi). Yüzey Kırp bastırılınca Kalınlaştır aynı; Düzlemsel kapak bastırılınca Yüzey Dik "Dikilecek yüzeylerden biri bulunamadı" + aynı pencere. Yüzey1 → Sil → yalnız "silinsin mi?" soruluyor, Kalınlaştır1 hatalı kalıyor. `d7_yuzey1.py` Y1g, `d7_yuzey2.py` T1g, L2g.
- **Kod:** `src/main.ts:972` `offerReselect` regex `/bulunamad|seçin/` bastırma kaynaklı hataları da yakalıyor; `deleteFeature` / `parentsOf` `surf` / `surfs` / `tool` alanlarını bilmiyor; `sketchUsers` (compile.ts:963) `surface` türünü kapsamıyor.
- **Öneri:** Bastırma / silmede `surf`, `surfs`, `tool` çocuklarını da bastır / sor; ebeveyni bastırılmış özellikte pencere açma.

#### ✅ D7-18 · Yalnız yüzey varken Kütle Özellikleri 0 g gösteriyor
- **Önem:** Düşük · **Tür:** SolidWorks'ten farklı
- **Bizde:** Yalnız Yüzey1 → Kütle Özell. → "Kütle: 0 g · Hacim: 0 mm³ · Yüzey alanı: 0 mm²". SolidWorks yüzey gövdesinde alan verir / "katı yok" uyarır. Kod: `src/main.ts:5835` (`props` yalnız `bodies`).

#### ✅ D7-19 · Yüzey gövdesinin yüzüne renk verilemiyor
- **Önem:** Düşük · **Tür:** Eksik
- **Bizde:** Yüzey1'e sağ tık → menüde "Görünüm: yüz rengi…" yok (yalnız parça rengi); katı yüzlerde var. `d7_genel.py` RN.

#### ✅ D7-20 · Ne yanlış? ve klasörden Bastır etkin yapılandırmaya yazılmıyor
- **Önem:** Düşük · **Tür:** Tutarsızlık
- **Bizde:** Yapılandırmalı belgede Ne yanlış? → Radyüs1 → Bastır → yapılandırma `off` listeleri boş; klasör → "Klasörü bastır" → aynı. Ağaçtaki Bastır listeyi güncelliyor. Yapılandırma değiştirilip dönülünce özellik yeniden etkinleşir. Kod: `src/main.ts:5501` (ww Bastır), `6328` (klasör bastır).

#### ✅ D7-21 · Kontrol, katı varken yüzey gövdelerini bildirmiyor
- **Önem:** Düşük · **Tür:** Eksik
- **Bizde:** Blok + açık Yüzey1 → Kontrol → yalnız "✓ Gövde 1: geçerli"; `__geomCheck.surfs = 1` ama "1 yüzey gövdesi" yazısı yalnız katı yokken çıkıyor. Kod: `src/main.ts:5524`.

#### ✅ D7-22 · Yüzey özelliklerinin eskizi ağaçta çocuk değil, "Eskizi düzenle" eylemi yok (P-4 ailesi)
- **Önem:** Düşük · **Tür:** SolidWorks'ten farklı
- **Bizde:** Yüzey Ekstrüzyon / Düzlemsel Yüzey / Yüzey Loft sonrası eskizler ayrı satırda kalıyor ve grafik alanda görünür kalıyor; Yüzey1 seçilince eylemlerde "Eskizi düzenle" yok (eskiz kendi satırından düzenlenebiliyor). Kod: `src/main.ts:6234` `kids`, `6366`; `compile.ts:963` `sketchUsers`'ta `surface` yok.

### Notlar
- Ortam: 2 çekirdek, diğer ajanlarla paylaşıldı. A5 / A6 ilk koşuda zamanlama nedeniyle başarısız oldu, tek başına tekrarında A6 geçti, A5 gerçek bulguyu (D7-10) gösterdi. Bir kez önizleme sunucusu kapandı; yeniden başlatıldı.
- Doğrulanmadı: Tırnak-yuvada "Diğerini seç" (Alt / tekrar tık) ile gizli dar yüzün PM'de seçilip seçilemeyeceği; Sarma oyma kipinin yaşam döngüsü (d5 a/b'yi denedi).

---

## Denetim 2 — d8: KAYNAKLI YAPI ve ANALİZ (v0.85, localhost:4173)

Ajan: d8 · Tarih: 2026-11-14 · Yöntem: PROTOKOL.md. Komutlar şeritten / menüden / kısayoldan gerçek fare-klavye (telefonda CDP dokunma) ile çalıştırıldı. Değerler PM alanlarına `fill` + Tab ile yazıldı; ✓ / ✕ / Ctrl+Z / Ctrl+Y / ↶ ↷ gerçekten basıldı. Modeldeki yüz / eleman / köşe seçimleri dünya noktası `viewer.toScreen` ile ekrana çevrilip gerçek tıklamayla yapıldı. İskelet ölçüsü değişiklikleri "3B eskizi ağaçtan Düzenle → ölçü etiketine çift tık → değer → Enter → ✓" ile yapıldı (2B iskelet ağaçta görünmediği için, bkz. P-4). İndirilen CSV / SVG / DXF / STEP / JSON / JPEG dosyaları okunup doğrulandı. `__app` yalnız sonucu okumak (kesim listesi `kernel.cutList`, hacim, sınır kutusu, `doc`, localStorage) ve **hazır model** kurmak (`setDoc`: iskelet eskizleri, başlangıç yapı elemanı, blok / kiriş) için kullanıldı.

Betikler (`/home/claude/imaj-cad/tests/e2e/denetim2/`, her biri tek başına çalışır, sonunda `SONUC:` basar; `ONLY=U1,U3` gibi seçilebilir; bulgu içeren durumlar bilerek `HATA` verir):
`d8h.py` (yardımcılar, d4h üzerine), `d8_uye.py` (yapı elemanı yaşam döngüsü), `d8_uye_sec.py` (PM seçenekleri), `d8_kirp.py` (Kırp/Uzat, Uç Kapağı, Kaynak Dikişi, Köşe Takviyesi), `d8_kesim.py` (kesim listesi, özellikler, CSV, imalat resmi, levha DXF, STEP), `d8_deger.py` (Değerlendir: Ölç, Kütle, Teknik Resim girişi, Mukavemet, Girişim, Ne Yanlış?, Kontrol, Koniklik, Kesit, Denklemler, Yapılandırmalar), `d8_sea.py` (Statik Analiz), `d8_saha.py` (Fotoğraflar, Kumpas), `d8_sekme.py` (Kaynaklı sekmesindeki ortak komutlar), `d8_akis.py` (iş akışları W1, W3), `d8_mobil.py` (telefon).

### Özet

| Önem | Sayı |
|---|---|
| Kritik | 1 |
| Yüksek | 2 |
| Orta | 7 |
| Düşük | 8 |
| **Toplam yeni bulgu** | **18** |

İlk denetimden hâlâ geçerli (yeni sayılmadı): **P-4** (yapı elemanının 2B iskelet eskizi ve "Eskizden profil" eskizi ağaçta hiç görünmüyor, "Eskizi düzenle" yok; çerçeve ölçüsü ancak 3B iskelette değiştirilebiliyor), **P-25** (Kütle Özellikleri penceresinde Esc → Malzeme penceresi açılıyor). d5'ten hâlâ geçerli: **D5-8** (Koniklik Analizi eğri yüzlü modelde çöküyor; boru yapı elemanında da `Cannot read properties of null (reading '1')`).

En önemli 5:
1. **D8-1 (Kritik)** Statik Analiz sonucu model değişince geçersiz sayılmıyor. Ekstrüzyon 100 → 150 sonrası eski σ 32,6 MPa / δ 0,0717 mm / güvenlik katsayısı 7,21 "Güvenli" olarak gösterilmeye devam ediyor (doğrusu δ ≈ 0,241).
2. **D8-3 (Yüksek)** SEA sabitleme / yük yüzleri statik koordinat: model değişince sessizce kayboluyor ("Önce en az bir sabit yüz seçin" / "Yük yüzü ağda bulunamadı"), panel hâlâ "Sabitlemeler (1 yüz)" diyor.
3. **D8-5 (Yüksek)** Kırp / Uzat sınırı ~56 mm'den fazla aşan elemanı kırpamıyor: 100 mm taşan dikme → "Hedef elemanın uçları sınır elemanlara yakın değil".
4. **D8-6 (Orta)** Kapalı çerçevede Alın 1 / Alın 2 tutarsız: 600×400 boru çerçeve 4 farklı boy (642,4 / 597 / 397 / 351,6) → kesim listesinde 4 kalem.
5. **D8-8 / D8-7 (Orta)** Kesim listesi kalem özellikleri (tanım, malzeme, özel özellik) boy değişince kayboluyor. Kalem malzemesi Kütle Özellikleri'ne yansımıyor (6,84 kg ↔ kesim listesi 4,24 kg).

### Kapsam matrisi

Sütunlar: a oluştur / çalıştır + sayısal doğrulama · b Düzenle → parametre → ✓ · c ebeveyn iskelet / model değişince güncellenme · d Ctrl+Z / Ctrl+Y · e localStorage + sayfa yenile · f ✕ (Kaydetmeden / Kaydet ve çık) · g bastır / sil. ✓ geçti · ✗ hata (bulgu) · – uygulanamaz (neden).

Alan: envanter "Kaynaklı" 11 komut + "Değerlendir" 15 komut = **26 komut, 26 / 26 satır var**.

#### Kaynaklı sekmesi
| Komut | a | b | c | d | e | f | g | Betik / not |
|---|---|---|---|---|---|---|---|---|
| 3B Eskiz | ✓ şeritten aç, çiz, ✓ → ağaçta | ✓ (3B ölçü çift tık) | – (iskeletin kendisi) | ✓ | ✓ | ✓ Kaydetmeden çık → 440 kalır | – | d8_sekme T1, d8_uye U3. Sığdır ✗ D8-13 |
| Yapı Elemanı | ✓ 4 gövde 640 / 440, 45°, 1,98 / 1,32 kg | ✓ boru / Alın 1 / boşluk 3 → 0° uçlar, kayıt ✓; ✗ D8-6 | ✓ 3B iskelet 600→800 → 840 (liste + pencere + kayıt); 2B iskelet ✗ P-4 | ✓ 4 adım + 3B ölçü | ✓ | ✓ / ✓ (60.3x3.6) | ✓ bastır / etkinleştir / sil + geri al; ✗ D8-11 (sıra) | d8_uye U1–U7 |
| Kırp / Uzat | ✓ 30 mm taşan → 360; kısa → uzar 360; ✗ D8-5 (100 mm taşan) | ✓ koplama → 372, girişim 0 | ✓ çerçeve 450 → 422 | ✓ | ✓ | ✓ | ✓ bastır / sil → 200 | d8_kirp K1 |
| Uç Kapağı | ✓ +7 845 (≈ kutu dış alanı × 5), üst 505 | ✓ t8 + içeri 2 → 10 258 | ✓ dikme 500→700 → kapak 708 | ✓ | ✓ | – | ✓ bastır | d8_kirp K2, akış W1 (4 ayak), telefon M4 |
| Kaynak Dikişi | ✓ 2 yüz tık → 1 dikiş, a4, boy 28, 0,004 kg, tablo + CSV | ✓ kesikli 10/20 → boy 10 | ✓ çerçeve 800 → alt yüz referansı (400,20,0)'a iyileşti; yükseklik değişince "Eksik referans" penceresi (beklenen) | ✓ | ✓ | – | ✓ sil | d8_kirp K3; D8-15 (7,85 sabit) |
| Köşe Takviyesi | ✓ 29 700 = (100²/2 − 10²/2)·6 | ✓ 150 / pah 0 → 45 000 | ✓ çerçeve 800 / 300 → hatasız | ✓ | ✓ | – | ✓ bastır | d8_kirp K4, telefon M3 |
| Eskiz | ✓ düzlem seçme moduna girer | – | – | – | – | ✓ Esc | – | d8_sekme T2 (işlevi d1–d3) |
| Ref. Düzlem | ✓ PM + ✓ | – | – | ✓ | – | – | – | d8_sekme T3 (işlevi d5) |
| Ekst. Kesme | ✓ eskiz yokken "Önce kapalı bir eskiz çizin" | – | – | – | – | – | – | d8_sekme T4 (işlevi d4_sekme) |
| Delik Sihirb. | ✓ kirişe dokun → Ø9 tümünden geçen; iki kiriş de −381,7 mm³; kesim listesi güncel | – | – | – | – | – | – | d8_sekme T5; D8-18 (kapsam) |
| Kesim Listesi | ✓ pencere satırları, kg, toplam; Dosya > Kesim listesi…; PM açıkken uyarı | ✓ Özellikler (tanım / malzeme / özel) → satır + CSV sütunu | ✓ boy 840 satırı; ✗ D8-8 (özellikler kaybolur); kalem ayrımı delik / yapılandırma ile ✓ | ✗ D8-9 (özellik geri alınamaz); malzeme Ctrl+Z ✓ | ✓ cutProps kalıcı | ✓ Vazgeç | – | d8_kesim C1–C5; ✗ D8-7 |

#### Yapı Elemanı PM seçenekleri
| Seçenek | Sonuç | Durum |
|---|---|---|
| Standart / Ölçü (kutu, dkutu, boru, L, lama) | kesit alanı 4,2 cm², kutu 40x40x3 I = 9,32 cm⁴ (EN 10219 tablo) | ✓ |
| Özel profil (kütüphane): "Bir eskizi kütüphaneye ekle…" | Ø30 → custom, hacim aynı, `imajcad.profiles` + belgeye gömülü, yenile ✓ | ✓ |
| Kütüphaneyi dışa aktar | `imajcad_profiller.json` içinde ad + döngü | ✓ |
| Eskizden profil (bu belgede) | seçenekte yalnız kapalı eskiz; π·15²·2000 = 1 413 717 | ✓; eskiz ağaçta yok ✗ P-4 |
| Gruplar: + Yeni grup, grafik segment tıklama, grup profili (lama 50x10), Grubu sil | 2 profil, girişim 0, yenile ✓, sil → 1, Ctrl+Z → 2 | ✓ |
| Delme noktası (Sol alt köşe) | z 0..40, gönye 45°, Ctrl+Z ✓ | ✓ |
| Delme noktası öteleme Y 10 | z −30..10, yenile ✓ | ✓ |
| Döndürme açısı 90° (dkutu 80x40) | z kalınlığı 80 → 40 | ✓ |
| Profili aynala (L 50x50) | sınır kutusu değişir | ✓ |
| Hizalama: Yatay eksen → Global Z | z 80 → 40 | ✓ |
| Profili konumlandır (pencere) | 17 nokta, köşe → öteleme (−20, −20), ✓ | ✓ |
| Köşe işlemi Gönye / Alın 1 / Alın 2 / Yok, Boşluk | Gönye ✓; Alın ✗ D8-6; Yok → 600 / 400 + 4 girişim (beklenen) | ✗ D8-6 |
| Köşe başına işlem (Köşe 1 → Alın 1 + 3 mm) | 397 / 640, 0° uç, yenile ✓ | ✓ |
| Önceki yapı elemanlarına göre kırp / uzat | açık: girişim 0; kapalı: 2 girişim | ✓ |
| Önceki elemanlarla köşede gönye | 4 × 45°/45°, 640 / 440; kapalıyken 0° | ✓ |
| Yapı sistemi: nokta-uzunluk birincil (Noktayı seç, Yön, Uzunluk) | 250 eleman oluşur; nokta seçimi ✗ D8-10 | ✗ D8-10 |
| Yapı sistemi: ikincil (alt ↔ üst %50 → 360; %25 düzenle) | 360, girişim yok, yenile ✓ | ✓ |
| Kırpma önceliği (gruplu) | – (pj1 / s3d4 mevcut testleri; bu turda denenmedi) | – |

#### Değerlendir sekmesi
| Komut | a | b | c | d | e | f | g | Betik / not |
|---|---|---|---|---|---|---|---|---|
| Ölç | ✓ yüz alanı 4 800, yüz↔kenar 20, kenar 80; 3. tık yeni ölçüm | – | – | – | – | ✓ Esc çıkar | – | d8_deger E1, telefon M4 |
| Kütle Özell. | ✓ 753,6 g, AM Y 10; Malzeme değiştir → 259,2 g | – | ✗ D8-7 (kalem malzemesi) | ✓ Ctrl+Z → çelik | ✓ | ✗ P-25 (Esc) | – | E2, d8_kesim C2 |
| Teknik Resim (giriş) | ✓ pencere açılır (içi d9) | – | – | – | – | ✓ Esc | – | E3 |
| Mukavemet | ✓ σ = FLc/I, δ = FL³/3EI (I = 93 224), basit mesnet σ/4, δ/16 | ✓ mesnet / yük değişimi | ✓ iskelet 1000 → 500: L 500, δ/8 | – | – | ✓ Kapat; Malzeme… | – | E4, akış W3, telefon M5 |
| Statik Analiz | ✓ yayılı 100 N δ 0,0717 ≈ 0,0714 (wL³/8EI), tepki 100 N; basınç 0,1 MPa ve yüze dik 100 N aynı | ✓ ağ, öz ağırlık (+0,7 %), Temizle | ✗ D8-1, D8-3, D8-2 | ✗ D8-4 | ✓ fix / yük / ağ / öz ağırlık kalıcı, yeniden çöz aynı | ✓ Kapat / komut yeniden | ✓ yük ✕ | d8_sea F1–F8; telefon ✗ D8-12 |
| Fotoğraflar | ✓ dosya seçici → üst yüze bağlı JPEG, işaret, not, İndir (JPEG), Konumu değiştir | ✓ not / konum | ✗ D8-16 | ✓ | ✓ | ✓ Esc vazgeç | ✓ sil + geri al, gizle / göster | d8_saha P1 |
| Kumpas | ✓ HID kumpas 33.5 → son seçili Derinlik → model 33,5; rozet; Son okumayı yaz | – | – | – | ✓ HID tercihi | ✓ Kapat | – | d8_saha K1; Bluetooth yokken anlaşılır uyarı ✓ |
| Ne Yanlış? | ✓ hatalı Uç-Kapağı1 listelenir, Bastır → kalkar | – | – | ✓ Ctrl+Z hata geri; ✗ D8-17 (pencere) | – | ✓ Kapat | ✓ Bastır | E6 |
| Kontrol | ✓ 4 gövde "geçerli", serbest kenar yok | – | – | – | – | – | – | E6 |
| Koniklik Analizi | ✓ blok 1 / 1 / 4; ✗ D5-8 (boru elemanı çöker) | ✓ yön / açı | – (D5-9) | – | – | ✓ kapat | – | E7 |
| Kesit | ✓ düzlem / öteleme 10 / ters / Üst, ✓ açık bırakır | ✓ | – | – | – | ✓ ✕ kapatır | – | E8 |
| Malzeme | ✓ kesim listesi kg + kütle | – | – | ✓ | ✓ | ✓ İptal | – | E2, C5, F5 |
| Denklemler | ✓ T = 5 → Uç kapağı Kalınlık "=T" → 505 | ✓ T = 12 → 512 | ✓ | ✓ Ctrl+Z → 505 | ✓ | – | – | E9 |
| Yapılandırmalar | ✓ 2. yapılandırmada kapak bastırılı → kesim listesi 1 kalem az | – | – | – | ✓ etkin yapılandırma kalıcı | – | – | E10 |
| Girişim | ✓ köşe yok → 4 girişim × 2,21 cm³; gönye → yok | – | – | – | – | – | – | E5 |

### İş akışları

| # | Senaryo (cihaz) | Adımlar | Sonuç |
|---|---|---|---|
| W1 | Masa (masaüstü) | 3B çerçeve iskeleti → Yapı Elemanı → ayak iskeleti (hazır) → Yapı Elemanı 2 (önceki elemanlara göre kırp) → arkadan bak → 4 ayak ucuna tıkla → Uç Kapağı t8 → Kesim Listesi + CSV (680×4, 640×2, 440×2, levha×4, 15,99 kg) → iskelet 600→800 → 840, hatasız → Ctrl+S dosyası güncel → yenile | ✓ (d8_akis W1) |
| W2 | T dikme + kırpma + kaynak (masaüstü) | çerçeve + dikme → Kırp/Uzat (tıkla) → koplama → çerçeve 450 → izler → Ctrl+Z/Y → yenile; dikmeye kaynak dikişi → kaynak tablosu + CSV → kesikli → çerçeve 800 → referans iyileşir | ✗ D8-5 (100 mm taşan); geri kalanı ✓ (d8_kirp K1, K3) |
| W3 | Kiriş: Mukavemet ↔ SEA (masaüstü) | kutu 40x40x3 L 500 → Mukavemet konsol yayılı 1000 N (δ 0,798) → Statik Analiz: halka uç yüzüne tık → sabitle | Mukavemet ✓; SEA'da 3 mm et kalınlığındaki uç halkası sığdırılmış görünümde tıklamayla seçilemedi (Doğrulanmadı — yakınlaştırmadan denenmedi) |
| W4 | Kesim listesi kalem özellikleri (masaüstü) | Özellikler → tanım + Alüminyum + Boya → satır + CSV sütunu → yenile → Ctrl+Z → Kütle Özellikleri → iskelet 800 | ✗ D8-9, D8-7, D8-8 (d8_kesim C1–C3) |
| W5 | Denklem → uç kapağı (masaüstü) | Denklemler T = 5 → Uç Kapağı Kalınlık "=T" → T = 12 → 512 → Ctrl+Z → yenile | ✓ (d8_deger E9) |
| W6 | Yapılandırma ↔ kesim listesi (masaüstü) | Yapılandırma ekle → kapak bastır → etkinleştir → kesim listesi → yenile | ✓ (E10) |
| W7 | Saha: fotoğraf + kumpas (masaüstü) | Fotoğraf ekle → yüze bağla → not → konum değiştir → indir → blok genişliği değişir; Kumpas HID → Derinlik alanı → okuma → model | ✗ D8-16; kumpas ✓ (d8_saha) |
| W8 | Telefon (390×844, CDP) | 3B iskelet → Yapı Elemanı (dokun) → Kesim Listesi → Özellikler (tanım) → Köşe Takviyesi (panel ▾ küçült + 2 yüze dokun) → ↶; Uç Kapağı (uç yüze dokun) → Ölç; Mukavemet; Statik Analiz (uç yüze dokun → sabitle; üst yüz panelin altında) | ✓ M1–M4; ✗ D8-12 (M5) (d8_mobil) |
| W9 | SEA tam döngü (masaüstü) | yüz seç → sabitle → yük F / p / Fn → çöz → Ctrl+Z → model 100→150 → malzeme → ağ / öz ağırlık / Temizle / Kapat → yenile | ✗ D8-1, D8-2, D8-3, D8-4 (d8_sea) |

### Bulgular

##### ✅ D8-1 — Statik Analiz sonucu model değişince geçersiz sayılmıyor; eski gerilme / sehim / güvenlik katsayısı "güncel" gibi gösteriliyor
- **Önem:** Kritik (yanlış mühendislik sonucu sessizce) · **Tür:** Hata
- **SolidWorks:** Model değişince etüt "güncel değil" işaretlenir. Sonuç çizimleri gizlenir, yeniden çalıştırma istenir.
- **Bizde:** 10×10 kesit, 100 mm kiriş (hazır). Değerlendir > Statik Analiz → uç yüze tık → Sabitle → üst yüze tık → 100 N −Y → ▶ Çöz: δ 0,0717 mm, σ 32,6 MPa, güvenlik 7,21 ✅. Panel açıkken ağaçtan Kiriş → Düzenle → Derinlik 150 → ✓. Panel hâlâ "En büyük von Mises 32,6 MPa · yer değiştirme 0,0717 mm · ✅ Güvenli" gösteriyor ve yeni modeli eski alanla boyuyor. Gerçek değer δ ≈ 0,241 mm (3,4 kat). Malzeme değiştirmede de aynı durum oluşuyor (D8-2).
- **Betik:** `d8_sea.py` F4.
- **Kod:** `src/main.ts:964` — sonuç yalnız `fea.vf.length !== res.mesh.vertices.length / 3` olunca siliniyor. Aynı topolojide (boy / ölçü değişikliği) köşe sayısı aynı kalıyor, sonuç geçerli sayılıyor. Hemen ardından `fea.vf = undefined` yapıldığı için denetim yalnız bir kez çalışıyor.
- **Öneri:** Her yeniden yapıda (`build` sonrası) `fea.res`, `field` ve `disp` silinip `renderFea()` çağrılmalı. Ya da sonuç, model özetiyle (yapı anahtarı / hacim + bbox) damgalanmalı; uyuşmazsa "Model değişti — yeniden çözün" yazılmalı.

##### ✅ D8-2 — Malzeme değişince Statik Analiz paneli eski malzemeyi ve eski sonucu gösteriyor
- **Önem:** Orta · **Tür:** Hata
- **SolidWorks:** Malzeme değişince etüt güncel değil sayılır.
- **Bizde:** F1 sonucu görünürken Değerlendir > Malzeme → Alüminyum → Tamam. Panel başlığı "Yapı çeliği … E 210000 MPa" ve sonuç δ 0,0717 olarak kalıyor. Yeniden çözünce 0,2177 çıkıyor (doğru oran 210000 / 69000).
- **Betik:** `d8_sea.py` F5.
- **Kod:** `src/main.ts:5863` `chooseMaterial` → `commitDoc` yapıyor ama `renderFea()` / sonuç geçersizleme yok.
- **Öneri:** Malzeme değişiminde (ve genel olarak `commitDoc` sonrasında) FEA paneli açıksa sonucu geçersiz kılıp paneli yeniden çiz.

##### ✅ D8-3 — SEA sabitleme ve yük yüzleri statik koordinatla saklanıyor; model değişince sessizce kayboluyor
- **Önem:** Yüksek · **Tür:** Hata
- **SolidWorks:** Fikstür ve yükler yüz kimliğine bağlıdır, model değişince yüzü izler.
- **Bizde:** F1 etüdü (uç yüz z = 100 sabit, üst yüz yük) → Derinlik 150 → ▶ Çöz → "Önce en az bir sabit yüz seçin". Panel "Sabitlemeler (1 yüz)" diyor. İkinci düzen: sabit yüz yerinde kalan kiriş (ters ekstrüzyon, z = 0 sabit) → 100 → 150 → ▶ Çöz → "Yük yüzü ağda bulunamadı" uyarısıyla eski sonuç yerinde kalıyor (D8-1). Özelliklerdeki kalıcı referans iyileştirmesi (`s` imzası, heals) burada kullanılmıyor.
- **Betik:** `d8_sea.py` F4, `/tmp` denemesi x7 (aynı adımlar F4'te).
- **Kod:** `src/main.ts:5583` `feaFaceIdx`: aynı normal + merkez ≤ 2 mm. `doc.fea.fix / loads.ref` = `{c, n}`.
- **Öneri:** FaceRef'e özelliklerdeki gibi imza (`s`) ekleyip eşleşmeyi `matchFaces` yoluyla yap, bulununca yeni konumu yaz. Bulunamayan referansı panelde ⚠ ile göster.

##### ✅ D8-4 — Statik Analiz paneli Ctrl+Z / Ctrl+Y sonrası yenilenmiyor
- **Önem:** Orta · **Tür:** Hata
- **Bizde:** 1 yük + sonuç varken Ctrl+Z → `doc.fea.loads` 0 oluyor, ama panel hâlâ "Yükler (1) Normal kuvvet 100 N" ve eski sonucu gösteriyor. Temizle → Ctrl+Z → belge geri dönse de panel "Sabitlemeler (0 yüz)" gösteriyor.
- **Betik:** `d8_sea.py` F3, F6.
- **Kod:** `src/main.ts` `undo/redo` → `renderFea` çağrılmıyor. Fikstür / yük ekleme `commitDoc` ile geri alınabiliyor, ama panel durumu (`fea.res`) belgeden bağımsız.
- **Öneri:** `undo/redo` (ve `setDoc`) sonrasında `fea` açıksa `fea.res = undefined; renderFea(); feaPaint()`.

##### ✅ D8-5 — Kırp / Uzat, sınır elemanı ~56 mm'den fazla aşan elemanı kırpamıyor
- **Önem:** Yüksek · **Tür:** Hata
- **SolidWorks:** Kırp/Uzat, sınırı ne kadar aşarsa aşsın hedefi sınırda keser (taşan uç atılır).
- **Bizde:** 600×400 kutu 40x40x3 çerçeve + y −100…500 dikme (kırpma kapalı). Kaynaklı > Kırp / Uzat → dikmeye tık → Sınır → alt ve üst kirişe tık (taslak: 1 hedef, 2 sınır) → ✓ → durum "Hedef elemanın uçları sınır elemanlara yakın değil", özellik eklenmiyor. Aynı dikme −30…430 olunca 360 ✓.
- **Betik:** `d8_kirp.py` K1.
- **Kod:** `src/kernel.worker.ts:~2705` `near` süzgeci: `vdot(centroid(bs) − P, dOut) > −(reg.R + bR)`. Uç, sınırın merkezinden R + bR'den (kutu 40 → ~56 mm) daha ötedeyse aday atılıyor. Ayrıca `dist < 3·(R + bR)`.
- **Öneri:** Uç yerine hedefin ekseninin sınır gövdesini kestiği noktayı (eksen–gövde kesişimi) bul. Taşma miktarına bakmadan uca en yakın kesişimden kırp.

##### ✅ D8-6 — Kapalı çerçevede Alın 1 / Alın 2 köşeleri tutarsız (dört farklı boy)
- **Önem:** Orta · **Tür:** Hata
- **SolidWorks:** Tek gruptaki kapalı dikdörtgende alın köşeler tutarlı çözülür: iki uzun + iki kısa eleman. Doğrulanmadı: SW'nin tam deseni (fırıldak ya da simetrik), ama her iki durumda da yalnız 2 boy çıkar.
- **Bizde:** 600×400 iskelet, boru 42.4x3.2, Alın 1, boşluk 3 → boylar 642,4 / 597 / 397 / 351,6. Alt eleman iki uçta sürekli, sol eleman iki uçta kırpılmış, diğer ikisi karışık. Alın 2: 597 / 551,6 / 442,4 / 397. Kesim listesinde 2 yerine 4 kalem var.
- **Betik:** `d8_uye.py` U2.
- **Kod:** `src/kernel.worker.ts:2423` `const [A, B] = list` (köşedeki eleman sırası = öğe dizini). `2553` `butt1 ? [A, B] : [B, A]`. Kapanış köşesinde (son ↔ ilk segment) A ilk segment olduğu için yön zincire göre değil dizine göre belirleniyor.
- **Öneri:** Köşede A / B'yi zincir yönüne göre (gelen / giden eleman) ata. Ya da SW gibi "uzun kenar sürekli" kuralı uygula; böylece 2 kalem çıkar.

##### ✅ D8-7 — Kesim listesi kalem malzemesi Kütle Özellikleri'ne (ve analizlere) yansımıyor
- **Önem:** Orta · **Tür:** Hata / SolidWorks farkı
- **SolidWorks:** Kesim listesi gövdesine atanan malzeme kütle özelliklerinde kullanılır.
- **Bizde:** Kesim Listesi → 640 kalemi Özellikler → Malzeme Alüminyum → satır 0,68 kg, toplam 4,239 kg (CSV). Değerlendir > Kütle Özell. → 6,84 kg (tüm hacim × 7,85).
- **Betik:** `d8_kesim.py` C2.
- **Kod:** `src/main.ts:5835` `showMassProps` yalnız `doc.material`. Mukavemet (`openAnalysis`) ve SEA (`renderFea`) de öyle.
- **Öneri:** Gövde başına malzeme haritası (`cutProps` → gövde) kurup kütle / ağırlık merkezini gövde toplamıyla hesapla.

##### ✅ D8-8 — Kesim listesi kalem özellikleri boy değişince kayboluyor
- **Önem:** Orta · **Tür:** Hata (veri kaybı, görünür)
- **SolidWorks:** Kesim listesi kalemi özellikleri kalemle (klasörle) birlikte kalır, boy değişse de kaybolmaz.
- **Bizde:** 640 kalemine "Yatay kiriş", Alüminyum, Boya = RAL 7016 verildi → 3B iskelet 600 → 800 → kesim listesinde 840 satırı "Kutu 40x40x3 / Yapı çeliği", özellikler yok. Eski kayıt `cutProps["m|Kutu 40x40x3|6400|45|45"]` belgede sahipsiz kalıyor.
- **Betik:** `d8_kesim.py` C3.
- **Kod:** `src/main.ts:~4689` `ck = m|ad|boy×10|açı1|açı2`. Özellik anahtarı geometriye bağlı.
- **Öneri:** Anahtarı elemanın kaynağına (özellik kimliği + segment / grup) bağla. Ya da eşleşme bulunamazsa en yakın eski kalemden taşı.

##### ✅ D8-9 — Kesim listesi Özellikler değişikliği geri alınamıyor
- **Önem:** Düşük · **Tür:** Hata
- **Bizde:** Özellikler → Tamam → Ctrl+Z → `doc.cutProps` değişmiyor.
- **Betik:** `d8_kesim.py` C1.
- **Kod:** `src/main.ts` `openCutProps` "Tamam" → `saveDoc()` (commitDoc değil).
- **Öneri:** `commitDoc(() => …)` kullan.

##### ✅ D8-10 — Yapı sistemi "Noktayı seç": iskelet köşesine tıklayınca eleman yüzündeki rastgele nokta alınıyor
- **Önem:** Orta · **Tür:** Hata
- **SolidWorks:** Nokta-uzunluk elemanı için eskiz noktası / köşe seçilir.
- **Bizde:** Çerçeve var → Düzenle → "+ Nokta-uzunluk birincil eleman" → iskeletin (600, 0, 0) köşesine (ekranda tam üstüne) tık → nokta (614, 13.9, 20). Eleman havada, profilin dış yüzünden başlıyor.
- **Betik:** `d8_uye_sec.py` S6.
- **Kod:** `src/main.ts:4643` `snapPoint(p)`: 3B uzaklık `≤ worldPerPixel·14`. Tıklanan nokta eleman yüzünde (z = 20), iskelet noktası 28 mm uzakta olduğu için yakalanmıyor.
- **Öneri:** Adayları ekran (piksel) uzaklığıyla seç. İskelet / 2B eskiz noktalarına öncelik ver.

##### ✅ D8-11 — Yapı elemanının iskelet eskiziyle ebeveyn bağı yok: Ebeveyn / çocuk boş, ▲ Yukarı onu eskizinin önüne taşıyor
- **Önem:** Düşük · **Tür:** Hata
- **Bizde:** Ebeveyn / çocuk → "Ebeveyn: — · Çocuk: —". Taban-Ekst, Çerçeve (gizli), Yapı-Elemanı1 düzeninde elemana ▲ Yukarı → sıra `s0, e0, m1, s1` (eleman, kullandığı eskizden önce). Uyarı yok.
- **Betik:** `d8_uye.py` U6, U7.
- **Kod:** `src/main.ts:6255` `parentsOf` yalnız `sketch/path/center/base2/sketches/feats/plane`. `member.segs[].sk`, `groups[].segs`, `std:'sketch'` boyutu yok.
- **Öneri:** `parentsOf`'a yapı elemanı segment ve profil eskizlerini ekle (`sketchUsers` ile aynı küme).

##### ✅ D8-12 — Telefonda Statik Analiz paneli grafik alanın çoğunu örtüyor; yüze dokunulamıyor
- **Önem:** Orta · **Tür:** Telefon kullanılabilirliği
- **Bizde:** 390×844: `.fea-panel` x 110…380, y 159…810 (≈ %70 genişlik × %77 yükseklik). Küçültme düğmesi yok. Kirişin uç yüzü (solda) dokunulup sabitlendi. Üst yüze dokunuş paneldeki `SELECT`e gidiyor → yük eklenemiyor.
- **Betik:** `d8_mobil.py` M5.
- **Öneri:** Telefonda paneli alt sayfa (`#side` gibi) yap, küçültülebilir olsun. Ya da yüz seçerken paneli geçici gizle.

##### ✅ D8-13 — 3B eskiz düzenlerken "Ekrana sığdır" 3B eskizi kapsamıyor
- **Önem:** Düşük · **Tür:** Hata
- **Bizde:** 1000 mm tek çizgilik 3B iskelet → Düzenle → Ekrana sığdır → görünüm değişmiyor (geri sarılmış model boş → varsayılan ±60 kutu). 3B ölçü etiketleri ekran dışında kalıp çift tıklanamıyor.
- **Betik:** `d8_deger.py` E4 (yardımcı `s3_open` bu yüzden önce parça modunda sığdırıyor).
- **Kod:** `src/main.ts:7003` `fitAll`: yalnız 2B eskiz (`mode.k === "sketch"`) için eskiz sınırlarını katıyor.
- **Öneri:** 3B eskiz PM'inde `draft.xyz` sınır kutusunu kat.

##### ✅ D8-14 — İmalat resmi başlığında yazım hatası: "İmalat resmileri"
- **Önem:** Düşük · **Tür:** Metin
- **Bizde:** Kesim Listesi → Tüm imalat resimleri → başlık "İmalat resmileri (3 sayfa)".
- **Betik:** `d8_kesim.py` C4.
- **Kod:** `src/main.ts` `openDrawings`: `İmalat resmi${rows.length > 1 ? "leri …"}`.
- **Öneri:** Tekil / çoğul dizgeyi tam yaz ("İmalat resimleri").

##### ✅ D8-15 — Kaynak tablosunda kaynak metali kütlesi hep çelik yoğunluğuyla
- **Önem:** Düşük · **Tür:** Hata (kod incelemesi; betikle alüminyumla denenmedi — Doğrulanmadı)
- **Kod:** `src/main.ts:4869` ve `4888` `(w.vol * 7.85) / 1e6` sabit.
- **Öneri:** `MATERIALS[doc.material].rho` kullan.

##### ✅ D8-16 — Fotoğraf işareti statik koordinatta; model değişince yüzle gitmiyor
- **Önem:** Düşük · **Tür:** SolidWorks farkı
- **SolidWorks:** Notlar / açıklamalar yüze bağlıdır.
- **Bizde:** 100×60×20 blok, fotoğraf +X yüzüne (x = 50) bağlandı → Eskizi düzenle → genişlik 140 → +X yüz x = 81,44, işaret x = 50'de (modelin içinde) kalıyor.
- **Betik:** `d8_saha.py` P1.
- **Öneri:** Fotoğrafa FaceRef + yüzdeki göreli konum sakla, yapı sonrası yeniden konumla.

##### ✅ D8-17 — Ne Yanlış? ile bastırılan hatalı özellik Ctrl+Z ile geri gelince "Eksik referans" penceresi açılıyor
- **Önem:** Düşük · **Tür:** Hata
- **Bizde:** Hatalı Uç-Kapağı1 → Ne Yanlış? → Bastır → Ctrl+Z → modal "Eksik referans" penceresi açılıyor. Hata yeni değil, ama pencere sonraki tuşları (Ctrl+Z) da yutuyor.
- **Betik:** `d8_deger.py` E6 → E7 başında.
- **Kod:** `src/main.ts:974` `builtOk`: bastırılmış özellik hata vermediği için "hatasız kuruldu" sayılıyor.
- **Öneri:** `builtOk`'a yalnız `!f.off` özellikleri ekle.

##### ✅ D8-18 — Delik / kesme için "Özellik kapsamı" yok: kaynaklı yapıda tümünden geçen delik bütün gövdeleri deliyor
- **Önem:** Düşük · **Tür:** Eksik seçenek
- **SolidWorks:** Çok gövdeli parçada kesme / delik özelliklerinde "Özellik kapsamı" (seçili gövdeler) vardır.
- **Bizde:** Kaynaklı > Delik Sihirb. → üst kirişe dokun → Ø9 tümünden geçen → alt kiriş de delindi (iki 640 kalemi −381,7 mm³). Yalnız üst kirişi delmenin yolu yok (kör derinlik dışında).
- **Betik:** `d8_sekme.py` T5.
- **Öneri:** Delik / Ekst. Kesme PM'ine "Etkilenen gövdeler" seçimi ekle.

#### Denendi — sorun yok (özet)
Yapı elemanı oluştur / düzenle / ✕ / bastır / sil / geri al / yenile; 3B iskelet ölçüsü → kesim listesi; gruplar, delme noktası, öteleme, döndürme, aynala, hizalama, profili konumlandır, köşe başına işlem, önceki elemanlara göre kırp / gönye, ikincil eleman, eskizden ve kütüphaneden özel profil, kütüphane JSON dışa aktarma; uç kapağı / köşe takviyesi / kaynak dikişi sayısal sonuçları ve iskelet değişince izleme (yüz referansı iyileşmesi); kesim listesi CSV (özel sütun, kaynak bölümü), imalat resmi SVG, levha DXF 1:1 (141,4 × 63,6), satır STEP; Ölç, Kütle, Kesit, Denklemler → yapı özelliği, Yapılandırma → kesim listesi, Girişim, Kontrol; Mukavemet analitik eşleşme (konsol / basit mesnet, iskelet değişince yeniden hesap); SEA sayısal doğruluk (F / p / Fn eşdeğer, tepki, öz ağırlık, kalıcılık); fotoğraf ekle / bağla / not / indir / konum / sil / geri al; HID kumpas → alan → model, Bluetooth yokken uyarı; telefonda yapı elemanı, kesim listesi + özellikler, köşe takviyesi (panel küçültülünce), uç kapağı, ölç, mukavemet.

---

## Denetim 2 — d9: MONTAJ ve TEKNİK RESİM (v0.85, localhost:4173)

Ajan: d9 · Tarih: 2026-11-14 · Yöntem: PROTOKOL.md.
- Komutlar şeritten / menüden / ağaç eylem düğmelerinden / kısayoldan gerçek fare-klavye ile çalıştırıldı. Telefonda (390×844, is_mobile, has_touch) CDP dokunma kullanıldı.
- Eşleşme seçimleri gerçek tıklamayla yapıldı: bileşenin yerel noktası dünya koordinatına, oradan `viewer.toScreen` ile ekrana çevrildi. Görünmeyen yüzler için Ctrl+6 (alttan) / Ctrl+2 (arkadan) kullanıldı.
- PM değerleri `fill` + Tab ile girildi. ✓ / ✕ / Ctrl+Z / Ctrl+Y / ↶ gerçekten basıldı.
- Parça değişiklikleri kullanıcı gibi yapıldı: "Eskizi düzenle" → ölçüye çift tıkla → değer → Enter → ✓. Ekstrüzyon için Düzenle → Derinlik → ✓.
- Teknik resimdeki ölçü / açıklama ekleme, ölçü ve görünüş sürükleme iframe içindeki SVG'ye gerçek fare (telefonda dokunma) olaylarıyla yapıldı.
- İndirilen CSV / STEP / SVG / DXF / .icasm / WebM dosyaları okunup doğrulandı (`/home/claude/rapor2/d9_out/`).
- `__app` yalnız iki iş için kullanıldı: sonucu okumak (bileşen konumu, eşleşmeler, ağ sınır kutusu, `_dr`, localStorage) ve **hazır model** kurmak (`setDoc`: Plaka 100×60×10 + Ø10 delik, Pim Ø10×30, yuvalı plaka, delik dizili plaka, çerçeve, sac). Kütüphane parçaları şeritteki "Kütüphaneye Kaydet" ile kaydedildi.

Betikler `/home/claude/imaj-cad/tests/e2e/denetim2/`. Her biri tek başına çalışır ve `SONUC:` basar; `ONLY=P1,P3` gibi bölüm seçilebilir. Bulgu içeren durumlar bilerek `HATA` verir.
- `d9h.py`: yardımcılar (d4h.App üzerine `Asm` sınıfı ve hazır modeller).
- `d9_esles.py`: standart eşleşme yaşam döngüsü + parça değişince montaj.
- `d9_tur.py`: 22 eşleşme türünün hepsi.
- `d9_parca.py`: parça değişikliği yolları P1–P8.
- `d9_arac1.py`: Taşı / Döndür, sürükleme, çarpışma, girişim, boşluk, kesit, patlatma, hareket etüdü, kütle, BOM, STEP.
- `d9_arac2.py`: bileşen menüsü, Ctrl çubuğu, kopyala / değiştir, aynala, çoğaltma, desen güdümlü, montaj deliği, delik hizalama, MateXpert, bağlantı elemanı, alt montaj, dosya işlemleri.
- `d9_ek.py`: SmartMate, fiziksel dinamik, kütüphaneden sil, yenileme sonrası geri alma.
- `d9_i3d.py`: Instant3D oku montajda.
- `d9_resim.py`: parça teknik resmi.
- `d9_resim2.py`: montaj resmi, kaynaklı resim, sac resmi.
- `d9_mobil.py`: telefon.

### Özet

| Önem | Sayı |
|---|---|
| Kritik | 6 |
| Yüksek | 4 |
| Orta | 6 |
| Düşük | 12 |
| **Toplam yeni bulgu** | **28** |

İlk denetimden hâlâ geçerli (yeni sayılmadı):
- **M-1**: Montaj açıkken Ctrl+S montajı değil parçayı (`Plaka.icad`) indiriyor. d9_arac2 B11 ile doğrulandı.
- **M-5**: "Yeni Montaj" `confirm()`, "Montaj Adı" ve Ctrl çubuğunda Mesafe tarayıcı `prompt()` kullanıyor.

En önemli 5:
1. **D9-1 (Kritik)** Parça modunda seçili ekstrüzyonun Instant3D oku montaja geçince ekranda kalıyor. Montajda bu ok sürüklenince parçanın derinliği sessizce değişiyor ve kaydediliyor (10 → 36 mm). Montajdaki bileşen eski kalıyor. Ok, altındaki bileşenin dokunmayla / tıklamayla tutulmasını da engelliyor.
2. **D9-2 (Kritik)** Parçada bir delik taşınınca (Eskizi düzenle 40 → 80) eş merkezli eşleşme sessizce **öbür deliğe** atlıyor (pim x = 55). Tek delikte ise eşleşme kopuyor (⚠). SolidWorks taşınan deliği izler.
3. **D9-3 (Kritik)** Parça değişince yapılan eşitleme (eşleşme referansının ve bileşenin yeni yere taşınması) kayda geçmiyor. Sayfa yenilenince pim artık var olmayan eski deliğe (x = 30) dönüyor, uyarı yok.
4. **D9-4 (Kritik)** Dosya > Aç ile açılan (kimliksiz) parçadan montaj kurulup sayfa yenilenince parça–montaj bağı kopuyor. Parça kalınlığı 10 → 25 yapılınca montaj 10 mm'de kalıyor, uyarı yok.
5. **D9-6 (Kritik)** Teknik resimde kullanıcının iki köşe arasına koyduğu ölçü sabit koordinatlı. Parça genişliği 100 → 120 olunca resimde "100 ±0,1" yazmaya devam ediyor. Ölçü artık köşelere bağlı değil.

### Kapsam matrisi

Sütunlar:
- a: oluştur / çalıştır + sayısal doğrulama
- b: düzenle (değer değiştir / sürükle)
- c: bileşenin parçası değişince (Eskizi düzenle / Düzenle / bağlam içi / kütüphane)
- d: Ctrl+Z / Ctrl+Y
- e: kayıt (imajcad.asm / doc.drawing) + sayfa yenile / .icasm
- f: ✕ / Vazgeç
- g: sil / bastır → bağımlılar

İşaretler: ✓ geçti · ✗ hata (bulgu) · – uygulanamaz (neden).

Alan:
- Montaj sekmesi şeridinde 30 komut (açılmadan 2 + açıldıktan sonra 28).
- Teknik resme giriş: 2 (Değerlendir › Teknik Resim, Dosya › Teknik resim…).
- **Toplam 32 komutun 32'sinin satırı var (%100).**
- Ek olarak alt seçenek satırları: eşleşme türleri (22), bileşen / eşleşme / alt montaj eylemleri, Bileşen Ekle penceresi seçenekleri, teknik resim seçenekleri.

#### Montaj şeridi
| Komut | a | b | c | d | e | f | g | Betik / not |
|---|---|---|---|---|---|---|---|---|
| Montajı Aç | ✓ (masaüstü + telefon tepsisi); ✗ D9-12 (eşleşmesiz montajda yenilemeden sonra ağaç parça ağacı) | – | ✓ eşitleme yapılıyor; ✗ D9-3 (kaydedilmiyor), ✗ D9-1 | – | ✓ | – | – | d9_esles, d9_ek UN |
| Kütüphaneye Kaydet | ✓ | – | ✗ D9-16 (malzeme / yapılandırma kaydedilmiyor) | – | ✓ imajcad.lib | – | ✓ (Bileşen Ekle penceresinde Sil) | to_lib, d9_ek LIB |
| Bileşen Ekle | ✓ geçerli parça / kütüphane / .icad / alt montaj .icasm / bağlantı elemanı; ✗ D9-17 (ipucu kalıyor) | – | ✓ | ✓ (ilk ekleme hariç, D9-9) | ✓ | ✓ Kapat | ✓ | d9_arac2, d9_parca P3 |
| Eşleşme | ✓ 22 tür (aşağıda); ✓ ilk / ikinci seçim, düzlem satırı ağaçtan | ✓ çift tık → Mesafe 25→40, canlı önizleme | ✓ kalınlık 10→15, delik 30→40; ✗ D9-2, D9-3, D9-5 | ✓ | ✓; ✗ D9-3 | ✓ ✕ (değer 40'ta kalır, eşleşme etkin) | ✓ sil / bastır / bileşen silinince eşleşmeleri gider | d9_esles, d9_tur |
| Bileşeni Taşı | ✓ Delta (175,20,0), XYZ konumuna merkez (300,5,−30), sabitte uyarı | ✓ | – | ✓ | ✓ | ✓ ✕ geri koyar | – | d9_arac1 T1, telefon F6 |
| Bileşeni Döndür | ✓ X 90° → eksen Z | – | – | ✓ | ✓ | ✓ | – | T2 |
| Bileşen Çoğalt | ✓ doğrusal 3×40, dairesel 4 eşit R; ✗ D9-14 (özellik değil) | ✗ D9-14 (düzenlenemez) | ✗ D9-14 | ✓ | ✓ | – | – | B5 |
| Desen Güdümlü | ✓ 4 pim, 40 aralık | – | – (as11 API ile) | ✓ | ✓ | – | – (Deseni sil / dağıt denenmedi; as11 kapsıyor) | B6 |
| Bileşen Aynala | ✓ kopya x −265…−165; ters el delik x −195 | – | – | ✓ | ✓ | – | – | B4 |
| Montaj Kesme / Delik | ✓ Ø8 Plaka<2>, parça belgesi değişmez, ağaçta "Montaj özellikleri" | – | – | ✓ / ✓ | ✓ | – | ✓ sağ tık → Bastır (confirm, M-5) | B7 |
| Çarpışma Algıla | ✓ pim plakaya girmez, aç / kapat | – | – | – | – | – | – | T4 |
| Fiziksel Dinamik | ✓ "sabit bileşene dayandı" ipucu, aç / kapat | – | – | – | – | – | – | d9_ek PH |
| Patlatılmış Görünüm | ✓ adım +Y 80 (önizleme), ağaçta "(1 adım)", gerçek konum değişmez | – (adım düzenlenemiyor, yalnız sil / ekle; Düşük, SW'de düzenlenir) | – | – | ✓ yenile kalıcı | ✗ D9-13 | ✓ satırdaki ✕ | T8 |
| Patlat / Daralt | ✓ görüntü değişir (canlandırmalı) | – | – | – | ✓ durum kalıcı | – | – | T8 |
| Bağlantı Elemanı | ✓ M8×40 cıvata, somun, pul; BOM'da | – | – | ✓ ×3 | – | – | – | B9 |
| Hareket Etüdü | ✓ döner motor pimi döndürür, eksen yerinde, Başa al, video .webm 56 KB | – | – | – | – | ✓ ✕ başlangıca döner | – | T9 |
| Girişim | ✓ 2 çift: 14 607,3 = 50·5·60 − π·25·5 ve 392,7 = π·25/2·10; yalnız çakışanlar; ✗ D9-18 (CSV yok) | – | – | – | – | ✓ ✕ kırmızı ağ kalkar | – | T5 |
| Boşluk Doğrula | ✓ Plaka1–Pim 25,000 ✓, girişenler 0 ⚠ (prompt, M-5) | – | – | – | – | – | – | T6 |
| Delik Hizalama | ✓ "Hizasız delik bulunmadı" (as7 hizasız durumu kapsıyor) | – | – | – | – | – | – | B7 |
| Montaj Resmi | ✓ BOM Plaka 2 / Pim 1, balonlar, patlatma → 2 sayfa; bağlam içi değişiklik sonrası yeni geometri; ✗ D9-23 | – | ✓ | – | – | ✓ Kapat | – | d9_resim2 M1 |
| Montaj Kesiti | ✓ Ön (XY) öteleme −30 → 1 kesme düzlemi | – | – | – | – | ✓ ✕ kaldırır | – | T7 |
| MateXpert | ✓ "Sorun yok" | – | – | – | – | – | – | B8 (sorunlu durum as4'te) |
| Kütle Özell. | ✓ 120 783,6 mm³ (tam değer 120 785,4; ağ yaklaşımı); malzeme değişince kütle 0,471 → 0,162 kg | – | ✓ | – | – | ✓ Kapat | – | T10, P6 |
| Malzeme Listesi | ✓ pencere + CSV "No;Parça;Adet / 1;Plaka;2 / 2;Pim;1"; bastırılan sayılmaz | – | – | – | – | – | ✓ | T10, B1 |
| STEP (montaj) | ✓ 3 MANIFOLD_SOLID_BREP; ✗ D9-19 (ürün adları) | – | – | – | – | – | – | T10 |
| Montaj Adı | ✓ prompt → ağaç başlığı "(montaj)" (M-5) | – | – | – | ✓ .icasm adı | – | – | B11 |
| Montajı Kaydet | ✓ "Deneme Montaj.icasm", 5 bileşen | – | ✗ D9-3 (eşitleme sonrası eski konum yazılır) | – | ✓ | – | – | B11 |
| Montaj Dosyası Aç | ✓ 5 bileşen ve ad geri gelir | – | – | – | ✓ | – | – | B11 |
| Yeni Montaj | ✓ onay (confirm, M-5) → boş; geri alınabilir | – | – | ✓ | – | ✓ (onayda İptal) | – | B11 |
| Parçaya Dön | ✓ parça modeli geri | – | – | – | – | – | – | B11 |
| Teknik Resim (Değerlendir) | ✓ | aşağıda | aşağıda | aşağıda | aşağıda | – | – | d9_resim |
| Teknik resim… (Dosya menüsü) | ✓ 4 görünüş grubu | – | – | – | – | – | – | d9_resim R1 |

#### Bileşen ve eşleşme eylemleri (ağaç düğmeleri / sağ tık / uzun basma)
| Eylem | Sonuç | Durum |
|---|---|---|
| Sabitle / Serbest bırak | (f), kayıt, geri al | ✓ |
| Gizle / Göster | ağ görünmez / görünür; telefonda uzun basma menüsünden | ✓ |
| Bastır / Bastırmayı kaldır | ⊘, BOM'dan düşer | ✓ |
| Saydam / Opak | `transparent` | ✓ |
| Taşı / Döndür (menüden) | Bileşeni Taşı ile aynı panel | ✓ |
| Eşleşmelerini göster | "Bu bileşenin eşleşmesi yok" | ✓ |
| Yapılandırma: X | Kalın 30 mm | ✓ (P7); ✗ D9-10 (bağlam içi düzenleme sonrası) |
| Aynala | B4 | ✓ |
| Değiştir… | Pim → Dizili, eşleşme ⚠; geri al | ✓ |
| Eşleşmeleriyle kopyala | kopya + bastırılmış eş merkezli; geri al | ✓ |
| Parçayı düzenle (bağlam içi) | Ø10→Ø8 Montaja dön ✓; Vazgeç ✓; Ctrl+Z ana parçaya dönmüyor ✓ | ✗ D9-10 |
| Kütüphaneden güncelle | 10 → 20 mm | ✗ D9-5 |
| Sil (bileşen) | bağlı eşleşmeler gider; geri al ✓ (yenileme sonrası ✗ D9-9) | ✓ / ✗ |
| Eşleşme: Düzenle / çift tık | ✓ | ✓ |
| Eşleşme: Bastır / Etkinleştir | (−) gösterge doğru | ✓ |
| Eşleşme: Hizalamayı çevir | ⚠, dönmüyor | ✗ D9-8 |
| Eşleşme: Sil | ✓ (yenileme sonrası geri alınamıyor D9-9) | ✓ / ✗ |
| Seçilenlerden alt montaj oluştur | rijit | ✓; ✗ D9-15 |
| Rijit / Esnek yap, Alt montajı dağıt, Alt montajı kaydet | ✓ Alt1.icasm (2 bileşen) | ✓ |
| Alt montaj ekle (.icasm) | +2 bileşen, rijit | ✓; ✗ D9-28 (aynı adlar) |
| Ctrl + iki seçim → eşleşme çubuğu | Mesafe 15 (prompt) | ✓ (M-3 notu geçerli) |
| SmartMate (Alt + sürükle) | eş merkezli | ✓; ✗ D9-11 (pim ters döner) |
| Bileşeni sürükle (fare / parmak) | eşleşmeye uyar, sabit sürüklenmez, Ctrl+Z | ✓ |

#### Eşleşme türleri (hepsi gerçek tıklama; her biri sonra Ctrl+Z ile geri alındı → konumlar başlangıçta ✓)
| Tür | Ölçülen | Durum |
|---|---|---|
| Çakışık | pim alt yüzü y = 10; üst↔üst varsayılan hizalı | ✓; çevir ✗ D9-8 |
| Paralel | ✓ | çevir ✗ D9-8 |
| Dik | 90,0° | ✓ |
| Teğet | öneri "Teğet"; eksen yüze paralel, 5 mm | ✓ |
| Eş merkezli | eksen (30, −30) | ✓; parça değişince ✗ D9-2 |
| Kilit | DOF 0, sürükleyince kıpırdamaz | ✓ |
| Mesafe | 25, düzenle 40, Ctrl+Z/Y; ilk yön ters → "Ölçüyü ters çevir" ile düzeldi | ✓ |
| Açı | 30,0° → düzenle 60,0° | ✓ |
| Profil merkezi | merkezler ~0,5 mm kayık, Plaka2 ters döndü | ✗ D9-11, D9-25 |
| Simetrik | yüz merkezleri simetrik (5,13 / −5,14), ama iki bileşen 90° yatırıldı | ✓ / ✗ D9-26 |
| Genişlik | pim z = −30,000 (orta) | ✓ |
| Yol | pim ekseni üst yüz dış zincirinde (x = 100) | ✓ |
| Limit | mesafe 30 (10…30 aralığında) ama Plaka2 ters döndü | ✓ / ✗ D9-11 |
| Açı limiti | 140° (20…40 tümleri içinde) | ✓ |
| Bağlayıcı | oluştu, hatasız | ✓ (hareket doğrulanmadı) |
| Kam | eksenler arası 10,49 (beklenen 10) | ✗ D9-27 |
| Yuva | %50 → yuva ortası (±0,002) | ✓ |
| Menteşe | (30,10,−30), yalnız dönme serbest | ✓ |
| Dişli | 20:40, hatasız | ✓ (dönme oranı as3'te) |
| Kremayer-pinyon | hatasız | ✓ (hareket doğrulanmadı) |
| Vida | hatve 2, hatasız | ✓ (hareket doğrulanmadı) |
| Üniversal | hatasız | ✓ (hareket doğrulanmadı) |

#### Teknik resim (parça) — d9_resim.py, d9_resim2.py
| Öğe | a | b | c (parça değişir) | d | e (yenile / yeniden aç) | f | g | Not |
|---|---|---|---|---|---|---|---|---|
| Görünüşler ilk açı (ön / üst / sol / izo) | ✓ 4 görünüş | ✓ görünüş sürükle → vOff | ✓ yeniden üretilir | – | ✓ | – | – | R1, R5 |
| Üçüncü açı (ANSI) | ✓ "Üçüncü açı (ANSI)" | – | – | – | ✓ | – | – | R12; ✗ D9-22 (menüde yok) |
| Otomatik ölçüler | ✓ 100 / 60 / 10 / Ø10 / 30 / 30 | ✓ sürükle (fw öteleme) | ✓ 120 | – | ✓ | – | ✓ Gizle / ✗ D9-21 | R1, R5, R6, R10 |
| Kullanıcı ölçüsü (2 nokta, daire → Ø) | ✓ 100, Ø10; telefonda dokunarak ✓ | ✓ tolerans | ✗ D9-6 | ✗ D9-7 | ✓ | – | ✓ Sil düğmesi var | R2, R3, R10, F7 |
| Tolerans (±, sapma, sınır, uyum) | ✓ "100 ±0,1" | – | – | – | ✓ | – | – | R3 (td3 diğerleri) |
| Pürüzlülük / GDT / Referans | ✓ 3,2 / ⏥ 0,05 / A | – | ✗ D9-6 (sabit konum) | ✗ D9-7 | ✓ | – | – | R4 |
| Kesit A-A | ✓ tarama + A-A | – | – | – | – | – | – | R7 |
| Detay B / 2. sayfa | ✓ 2 sayfa | – | ✗ D9-6 (detay merkezi sabit koordinat; Doğrulanmadı ayrıca) | – | – | – | – | R7 |
| İzometrik aç / kapa | ✓ | – | – | – | – | – | – | R7 |
| Kağıt A3 / Ölçek 1:1 / antet (çizen, no, malzeme) | ✓ 420×297, 1:1, Ali Y. / R-001 / S235 | – | – | – | ✓ kâğıt kalıcı | – | – | R7; ✗ D9-20 |
| Belge özellikleri (ondalık, ISO / ANSI) | ✓ (komut arama / ☰) | – | – | – | – | – | – | R12; ✗ D9-22 |
| SVG indir | ✓ içerik güncel (± ve 420) | – | – | – | – | – | – | R8 |
| DXF indir | ✓ GIZLI / GORUNUR / OLCU / EKSEN / YAZI, "100" ve "60" | – | – | – | – | – | – | R8 |
| Yazdır / PDF | – (başsız tarayıcıda yazdırma penceresi doğrulanamaz) | – | – | – | – | – | – | |
| Kaynaklı resim kesim listesi | ✓ KESİM LİSTESİ 640 / 440, balonlar; seçenekle kalkar | – | – (P-4 nedeniyle iskelet düzenlenemiyor) | – | – | – | – | K1 |
| Sac resmi | ✓ 100 / 60 / 30 | – | – | – | – | – | – | SM1; ✗ D9-24 |
| Montaj resmi | ✓ | – | ✓ | – | – | ✓ | – | M1; ✗ D9-23 |

### İş akışları

Masaüstü 1400×900:

| # | Senaryo | Adımlar | Sonuç |
|---|---|---|---|
| W1 | Plaka + pim + üst plaka montajı | 3 bileşen → çakışık (alttan görünüm) → eş merkezli → mesafe 25 (ters çevir) → eş merkezli → paralel → mesafeyi 40 yap → ✕ ile 70 denemesi → Ctrl+Z / Y → çevir → bastır / etkinleştir → aşırı tanım reddi → kalınlık 10→15 → delik 30→70 → eşleşme sil / geri al → pimi sil / geri al → yenile | ✗ D9-8, D9-2 (⚠ tek delik), D9-9; geri kalan ✓ (d9_esles) |
| W2 | İki delikli plakada pim | pim delikte → delik 30→40 (izler ✓) → 40→80 | ✗ D9-2: pim x = 55'teki öbür deliğe atladı (d9_parca P1/P2) |
| W3 | Dosyadan açılan parçayla montaj | Dosya › Aç (.icad) → 2 örnek → yenile → kalınlık 10→25 | ✗ D9-4 (P3) |
| W4 | Bağlam içi düzenleme | Pim Ø10→Ø8 Montaja dön → Ctrl+Z bağlamda → Vazgeç. Ayrıca yapılandırmalı plakada genişlik 100→120 | ✓ / ✗ D9-10 (P4, P7) |
| W5 | Kütüphane parçası güncellenir | Kütüphaneden plaka + pim → plaka 20 mm kaydedilir → Kütüphaneden güncelle | ✗ D9-5 (P5) |
| W6 | Parça teknik resmi | aç → ölçü + tolerans + Ra + GDT + datum → ölçü / görünüş sürükle → gizle / göster → kesit / detay / A3 / antet → SVG + DXF → kapat / aç → yenile → genişlik 100→120 → resim → not ekle → Ctrl+Z → ANSI | ✗ D9-6, D9-7, D9-20, D9-21, D9-22 (d9_resim) |
| W7 | Montaj resmi | montaj → resim → patlatma adımı → 2 sayfa → bağlam içi Plaka<2> 150 → resim → SVG | ✓ (d9_resim2 M1) |
| W8 | Alt montaj ve dosya | 2 bileşenden alt montaj → sürükle (rijit) → kaydet .icasm → esnek → dağıt → .icasm'i alt montaj olarak ekle → ad → Montajı Kaydet → Yeni → geri al → Aç → Ctrl+S | ✗ D9-15, D9-28, M-1 (d9_arac2 B10/B11) |
| W9 | Delik konumu değişir + yenile | pim delikte → delik 30→40 → pim izler → yenile | ✗ D9-3 (d9_parca P8) |

Telefon 390×844 (CDP dokunma):

| # | Senaryo | Adımlar | Sonuç |
|---|---|---|---|
| W10 | Montaj kurma | Montajı Aç (tepsi) → 2 bileşen → eşleşme dokunarak → parmakla eksen boyunca sürükle → ↶ → uzun basma → Gizle → Taşı Delta → teknik resimde dokunarak ölçü | ✓ (d9_mobil F1–F7) |
| W11 | Parça değişikliği | pim delikte → Özellikler → Eskizi düzenle (ölçüye çift dokunma) 30→40 → Montaj (izler ✓) → yenile | ✗ D9-3 (F8) |
| W12 | Parçadan montaja geçiş | ekstrüzyonu düzenle → Montaj | ✗ D9-1: ok kalıyor, dokunmayı engelliyor, sürüklenince parça değişiyor (d9_i3d) |

### Bulgular

#### ✅ D9-1 · Parçanın Instant3D oku montajda kalıyor; montajda sürüklenince parça derinliği sessizce değişiyor
- Önem: **Kritik** · Tür: Hata (sessiz parça değişikliği, giriş engeli)
- SolidWorks'te: Montaj belgesinde parça özelliğinin tutamağı görünmez. Parça yalnız bağlam içi düzenlemede değişir.
- Bizde (`d9_i3d.py`, masaüstü ve telefon):
  1. Plaka hazır model. Ağaçta Ekstrüzyon1 → Düzenle → ✓ (ekstrüzyon seçili kalır).
  2. Montaj sekmesi → Bileşen Ekle → Geçerli parça.
  3. Yeşil ⬆ oku ve "10" etiketi montaj görünümünde duruyor (`.i3d` görünür; masaüstü (1002,481), telefon (280,359)).
  4. Ok 60 px yukarı sürüklenir. Parça belgesinde `features[1].d1` masaüstünde 36, telefonda 56 oluyor ve localStorage'a yazılıyor. Montajdaki bileşen 10 mm kalıyor.
  5. Telefonda ok bileşenin üstündeyse parmakla sürükleme ve uzun basma oka gidiyor (ilk koşuda F3 / F5 bu yüzden başarısızdı).
- Kod: `src/main.ts:8090-8093` `target()`. Yalnız `mode.k !== "part" || !treeSel` denetleniyor; `asmUI.on` denetlenmiyor. `viewer.onRender(place)` montajda da çalışıyor.
- Öneri: `target()` içinde `if (asmUI?.on) return null;` ekle. Montaja girerken `treeSel = null` yap. `hd.hidden = true` ayarla.

#### ✅ D9-2 · Delik taşınınca eş merkezli eşleşme öbür deliğe atlıyor ya da kopuyor (göreli sınır kutusu eşlemesi)
- Önem: **Kritik** · Tür: Hata (eşleşme sessizce yanlış yüze kayıyor)
- SolidWorks'te: Eşleşme yüzün kalıcı kimliğine bağlıdır. Delik nereye taşınırsa pim de oraya gider.
- Bizde (`d9_parca.py` P1/P2, `d9_esles.py` E9):
  1. Plakada iki Ø10 delik var, x = 30 ve x = 55. Pim 1. deliğe çakışık + eş merkezli bağlanır.
  2. Delik1 → Eskizi düzenle → yatay ölçü 30 → 40 → ✓ → Montaj. Pim 40'a gidiyor ✓ ("2 eşleşme referansı yeni geometriye taşındı").
  3. Aynı ölçü 40 → 80 (delikler artık 55 ve 80). Pim **x = 55'e**, yani taşınmayan deliğe gidiyor. Uyarı yok, ağaçta ⚠ yok, bildirim yok.
  4. Tek delikli plakada 30 → 70 yapılınca eşleşme kopuyor: "1 referans bulunamadı (⚠)". Pim eski yerde kalıyor.
- Kod: `src/asm/asmui.ts:194-238` `remapMates`. Aday, eski ağ sınır kutusuna göre göreli konum `U()` ile seçiliyor. Eşik 0,35. En yakın aday kabul ediliyor.
- Öneri: Parça çekirdeğindeki kalıcı referans imzasını (`s`, v0.36) eşleşme varlığına da yaz ve onunla eşle. En azından ikinci aday yakınsa ⚠ ver, sessizce seçme. Yüzü üreten özelliğin kimliği ve döngü indeksiyle eşle.

#### ✅ D9-3 · Parça değişikliğinden sonra montajın eşitlenmiş hâli kaydedilmiyor; yenileyince eski (artık olmayan) geometriye dönüyor
- Önem: **Kritik** · Tür: Hata (kayda geçmeyen değişiklik, sessizce yanlış montaj)
- SolidWorks'te: Parça değişince montaj yeniden kurulur. Bileşen konumları ve eşleşmeler kaydedilir.
- Bizde (`d9_parca.py` P8 masaüstü, `d9_mobil.py` F8 telefon):
  1. Pim deliğe bağlı. Delik 30 → 40 (Eskizi düzenle) → Montaj. Pim x = 40 ✓.
  2. `imajcad.asm` kaydında pim konumu hâlâ x = 30, eş merkezli referansı `b.c = [30,5,-30]`.
  3. Sayfa yenilenir. Pim x = 30'a dönüyor. Orada artık delik yok; pim plakanın içinde duruyor. Ağaçta ⚠ yok.
  4. Montajı Kaydet (.icasm) de bu eski hâli yazar.
- Kod: `src/asm/asmui.ts:139-147` `enter()`. `syncFromPart` sonrası `this.save()` çağrısı `refresh()`'ten (remapMates) ve `solve()`'dan **önce**. Sonra kayıt yok (satır 147 yalnız `solve/draw/renderTree`).
- Öneri: `enter()` sonunda `refresh()` + `solve()` bittikten sonra `save()` çağır. Aynısını `replaceComp`, `setCompConfig`, "Kütüphaneden güncelle" için denetle.

#### ✅ D9-4 · Kimliği kaydedilmemiş parça belgesiyle montaj: yenileyince parça–montaj bağı kopuyor
- Önem: **Kritik** · Tür: Hata (parça değişikliği montaja hiç geçmiyor, uyarısız)
- SolidWorks'te: Montaj parça dosyasına bağlıdır. Parça değişince montaj güncellenir.
- Bizde (`d9_parca.py` P3):
  1. Dosya › Aç… ile eski bir .icad açılır (kimlik alanı `uid` yok).
  2. Montaj → 2 kez Geçerli parça. Bileşen anahtarı `3pfp1u8d`.
  3. Sayfa yenilenir. `doc.uid` artık `None`.
  4. Özellikler › Ekstrüzyon1 → Derinlik 25 → ✓ → Montaj. Bileşenler 10 mm kalıyor. Uyarı yok.
  5. Aynı durum hazır model (`setDoc`) ile kurulan ve sonra hiç değiştirilmeden yenilenen belgede de var (`d9_esles` ilk koşusu).
- Kod: `src/main.ts:107-108` `docUid` kimliği yalnız bellekteki nesneye yazıyor, kaydetmiyor. `src/main.ts:8169` `currentPart()` yalnız kimlik yoksa `saveDoc()` çağırıyor; kimlik `docUid` ile zaten atanmış olduğundan kaydedilmiyor. Yenileyince yeni kimlik üretiliyor.
- Öneri: Kimlik atanan her yerde (`docUid`, `currentPart`) hemen `saveDoc()` çağır. `enter()` içinde parça kimliği tutmazsa ad + özellik özetiyle eşleştir ya da "parça bağı koptu" uyarısı ver.

#### ✅ D9-5 · "Kütüphaneden güncelle" eşleşme referanslarını taşımıyor; pim kalınlaşan plakanın içine gömülü kalıyor
- Önem: **Kritik** · Tür: Hata (sessizce yanlış montaj)
- SolidWorks'te: Bileşen yeni sürümle değişince eşleşmeler yeni yüzlere taşınır, olmuyorsa hata verir.
- Bizde (`d9_parca.py` P5):
  1. Kütüphaneden LPlaka (10 mm) ve Pim. Pim çakışık + eş merkezli, y = 10.
  2. LPlaka 20 mm olarak kütüphaneye yeniden kaydedilir. Bileşen menüsü → Kütüphaneden güncelle.
  3. Plaka 20 mm oluyor. Pim y = 10'da kalıyor, yani 10 mm plakanın içinde. Çakışık eşleşme hâlâ eski `c = [50.27,10,-30]` düzlemine bakıyor. ⚠ yok.
- Kod: `src/asm/asmui.ts:2433-2439` `this.meshes.delete(c.id)` refresh'ten önce çalışıyor. `refresh()` (satır 169) `old` ağı bulamadığı için `remapMates` çağrılmıyor.
- Öneri: Ağı silme; `k_` anahtarını sıfırla (eski ağ `old` olarak kalsın). Ya da `replaceComp(c, lib[...])` kullan.

#### ✅ D9-6 · Teknik resimde kullanıcı ölçüsü ve açıklamalar sabit koordinatlı: parça değişince eski değer yazılıyor
- Önem: **Kritik** · Tür: Hata (sessizce yanlış resim ölçüsü)
- SolidWorks'te: Çizimde eklenen ölçüler model kenarına / köşesine bağlıdır. Model değişince değer ve konum güncellenir. Bağ kopunca ölçü "asılı" (gri) gösterilir.
- Bizde (`d9_resim.py` R2/R3/R10):
  1. 100×60 plaka. Ölçü ekle ile ön görünüşün alt iki köşesine tıklanır → "100", tolerans ± 0,1.
  2. Eskizi düzenle → genişlik 100 → 120 → ✓ → Teknik resim yeniden açılır.
  3. Otomatik ölçü 120 ✓. Kullanıcı ölçüsü hâlâ **"100 ±0,1"**, uçları eski koordinatlarda (−50…50). Köşeler artık ±60'ta.
  4. Pürüzlülük / GDT / referans sembolleri ve Detay B merkezi de görünüş koordinatında sabit; model değişince yanlış yerde kalıyor.
- Kod: `src/drawing/techdraw.ts:51` `UDim {a, b}` (sayı çifti) ve `:364` `val = |a−b|`. `src/main.ts` `addAt` yakalama noktasının koordinatını kopyalıyor, kenar / köşe kimliğini değil.
- Öneri: Yakalanan noktanın kaynağını (görünüş kenarı indeksi / 3B köşe noktası) sakla. Her çizimde yeni görünüşte en yakın eşdeğeri bul; bulunamazsa ölçüyü kırmızı / "asılı" göster. Değeri her çizimde yeniden hesapla.

#### ✅ D9-7 · Parçada Ctrl+Z, resimde sonradan eklenen açıklamaları siliyor
- Önem: **Yüksek** · Tür: Hata (veri kaybı)
- SolidWorks'te: Çizim ayrı belgedir. Modeldeki geri alma çizim açıklamalarını silmez.
- Bizde (`d9_resim.py` R11):
  1. Genişlik 100 → 120 (parçada geri alınabilir adım).
  2. Teknik resim → Referans ekle (4. açıklama) → Kapat.
  3. Ctrl+Z (parça 100'e döner). Resim yeniden açılır: açıklama sayısı 4 → 3. Eklenen referans kayboldu.
- Kod: `src/main.ts:494` `keepDr` `doc.drawing`'i `saveDoc()` ile yazıyor ama geri alma yığınına girmiyor. `undo()` (`:6958`) eski anlık görüntüyü (eski `drawing`) geri yüklüyor.
- Öneri: Geri alırken `doc.drawing`'i koru: anlık görüntüyü geri yükledikten sonra `drawing = mevcut`. Ya da resim değişikliklerini de `commitDoc` ile yığına yaz.

#### ✅ D9-8 · "Hizalamayı çevir" sağlanmış eşleşmede bileşeni döndürmüyor, eşleşme ⚠ oluyor
- Önem: **Yüksek** · Tür: Hata (işlev çalışmıyor)
- SolidWorks'te: Hizalama çevrilince bileşen 180° döner (Flip Mate Alignment).
- Bizde (`d9_esles.py` E4, `d9_tur.py` flipco):
  1. Plaka2 üst ↔ Plaka1 üst çakışık (hizalı, y = 0).
  2. Eşleşme seç → Hizalamayı çevir. Plaka2 hiç dönmüyor (q = [0,0,0,1]). Eşleşme "⚠ Çakışık".
  3. Paralel eşleşmede de aynı: "⚠ Paralel (Plaka<2>, Plaka<1>)".
  4. İkinci çevirme eski hâle döndürüyor.
- Kod: `src/asm/solver.ts:57` `alignU` artığı `B ± A`. Tam ters (180°) başlangıçta gradyan sıfır olduğu için LM eyer noktasında kalıyor. `src/asm/asmui.ts:1338` `mateAct('flip')` ön döndürme yapmıyor.
- Öneri: Çevirmeden önce serbest bileşeni varlık normaline dik bir eksen etrafında 180° döndür (ya da küçük bir pertürbasyon ver), sonra çöz.

#### ✅ D9-9 · Sayfa yüklendikten sonraki ilk montaj işlemi geri alınamıyor
- Önem: **Yüksek** · Tür: Hata (geri alma tutarsızlığı, veri kaybı riski)
- SolidWorks'te: Açılıştan sonraki ilk işlem de geri alınır.
- Bizde (`d9_ek.py` UN, `d9_esles.py` E10 ilk koşu):
  1. Montaj kurulu, sayfa yenilenir, Montaj sekmesi açılır.
  2. Pim seç → Sil. Geri al düğmesi pasif kalıyor; Ctrl+Z hiçbir şey yapmıyor. Bileşen kayboldu.
  3. Aynısı yenilemeden sonra eşleşme silmede de var. Taze oturumda ilk eklenen bileşen de geri alınamıyor.
- Kod: `src/asm/asmui.ts:2616` `private last = ""`. `save()` (`:116`) yalnız `this.last` doluysa geçmişe yazıyor; açılışta `last` hiç atanmıyor.
- Öneri: Kurucuda ve `enter()` / `applyState` / dosya açmada `this.last = this.ser()`.

#### ✅ D9-10 · Bağlam içi "Parçayı düzenle" sonrası bileşenin malzemesi, değişkenleri ve yapılandırmaları siliniyor
- Önem: **Yüksek** · Tür: Hata (veri kaybı)
- SolidWorks'te: Bağlam içi düzenleme parçanın yalnız düzenlenen özelliklerini değiştirir. Malzeme ve yapılandırmalar kalır.
- Bizde (`d9_parca.py` P4/P7):
  1. Plaka (aluminium, T = 10, yapılandırmalar İnce / Kalın) 2 örnek. Plaka<2> → Yapılandırma: Kalın (30 mm ✓).
  2. Plaka<1> → Parçayı düzenle → Eskizi düzenle genişlik 120 → Montaja dön.
  3. Her iki bileşende `material = None`, `configs = 0`, `vars = None`. Plaka<2> 10 mm'ye düştü (Kalın yapılandırması gitti). Kütle çelikle hesaplanır.
  4. Bileşen ana parçanın kendisiyse sekme değiştirip dönünce yeniden eşitleme geri getiriyor. Kütüphane / dosya parçasında kayıp kalıcı (Doğrulanmadı: dosya parçasıyla ayrıca denenmedi).
- Kod: `src/main.ts:8176` düzenleme belgesi yalnız `features/profiles/eqs` ile kuruluyor. `:8188` `np` ad / özellikler / eqs / profiles içeriyor; material / vars / configs / config yok. `src/asm/asmui.ts:2024` `replaceComp` parçayı tümüyle `np` ile değiştiriyor.
- Öneri: Düzenleme belgesine ve `np`'ye `material, vars, configs, config` taşı. `replaceComp(allInstances)` yalnız `features/eqs/profiles` güncellesin.

#### ✅ D9-11 · Otomatik hizalama yalnız Standart sekmede: önce tür seçilince ve SmartMate'te bileşen ters dönüyor
- Önem: Orta · Tür: SolidWorks'ten farklı
- SolidWorks'te: Hizalama, varlıkların mevcut yönüne en yakın seçilir (tür önce de seçilse).
- Bizde (`d9_tur.py` limit / pcenter, `d9_ek.py` SM):
  - Eşleşme → Gelişmiş → Limit, sonra Plaka2 üst + Plaka1 üst seçilir. Plaka2 baş aşağı dönüyor (üst yüz normali −Y).
  - Profil merkezinde de aynı.
  - SmartMate (Alt + pimi deliğe sürükle) eş merkezli kuruyor ama pim ters dönüyor (eksen −Y, p y = 30).
- Kod: `src/asm/asmui.ts:1157` `pickInto` `autoFlip` yalnız `d.tab === "std"` iken. `:803` SmartMate `addMate` çağrısında `flip` / `autoFlip` yok.
- Öneri: Seçim tamamlandığında tüm hizalanabilir türlerde `autoFlip` / `autoSide` uygula. SmartMate'te de `flip: this.autoFlip(...)` ver.

#### ✅ D9-12 · Eşleşmesiz montaj sayfa yenilendikten sonra açılınca ağaç parça ağacını gösteriyor
- Önem: Orta · Tür: Hata (yanlış arayüz durumu)
- Bizde (`d9_ek.py` UN):
  1. 3 bileşen, eşleşme yok. Sayfa yenilenir → Montaj sekmesi (otomatik açılır).
  2. Ağaçta "Ön Düzlem, …, Ekstrüzyon1, Delik1" var, bileşenler yok. Ağaçtan bileşen seçilemiyor. Ancak grafik alanda bir bileşene tıklayınca ağaç düzeliyor.
- Kod: `src/asm/asmui.ts:147` `renderTree()` yalnız `lost.size || mates.length` iken çağrılıyor.
- Öneri: `enter()` sonunda koşulsuz `renderTree()`.

#### ✅ D9-13 · Patlatılmış Görünüm ✕ ile kapatılınca eklenen adımlar kalıyor
- Önem: Orta · Tür: Hata (vazgeç çalışmıyor)
- SolidWorks'te: ✕ yeni adımları iptal eder.
- Bizde (`d9_arac1.py` T8): 1 adımlı montaj → Patlatılmış Görünüm → Plaka2 seç → +X 40 → Adım ekle → ✕. Kayıtta 2 adım var; montaj patlatılmış durumda.
- Kod: `src/asm/asmui.ts:1576-1587` ✓ ve ✕ için aynı `finish` (save) kullanılıyor; `doc.exploded = true` hemen yazılıyor.
- Öneri: Açılışta `steps` ve `exploded` anlık görüntüsü al; ✕'te geri yükle.

#### ✅ D9-14 · Bileşen çoğaltma özellik değil: düzenlenemiyor, parça değişikliğini izlemiyor, ağaçta yok
- Önem: Orta · Tür: SolidWorks'ten farklı
- SolidWorks'te: Doğrusal / dairesel bileşen çoğaltma ağaçta özelliktir; adet / aralık sonradan düzenlenir.
- Bizde (`d9_arac2.py` B5): Pim → Bileşen Çoğalt → 3 × 40 → ✓. Pim<2>, Pim<3> bağımsız, eşleşmesiz serbest bileşen (−). Ağaçta çoğaltma öğesi yok, düzenlenemiyor. Panelde önizleme de yok.
- Kod: `src/asm/asmui.ts:1832-1860` `openPattern` kopyaları doğrudan `comps`'a ekliyor.
- Öneri: Desen güdümlü gibi bir `AsmPattern {seed, kind, ax, n, d}` kaydı tut; `updatePatterns()` ile örnekleri kur; ağaçta düzenle.

#### ✅ D9-15 · Rijit alt montaj sürüklenince bileşenler birbirine göre ~0,7 mm kayıyor
- Önem: Orta · Tür: Hata
- SolidWorks'te: Rijit alt montaj tek gövde gibi hareket eder.
- Bizde (`d9_arac2.py` B10): Pim + Plaka<2> → Seçilenlerden alt montaj (rijit) → Plaka<2> sürüklenir. Plaka2 yer değiştirmesi (10,490 / −4,081 / −6,779), pim (10,497 / −3,594 / −6,261). Göreli kayma 0,71 mm.
- Kod: `src/asm/solver.ts:27` örtük kilit `__rig_` (L: 50, ceza tabanlı) sürüklemede tam sağlanmıyor (Doğrulanmadı: kesin kök).
- Öneri: Rijit alt montajı çözücüde tek değişken grubu (ortak poz) olarak ele al.

#### ✅ D9-16 · "Kütüphaneye Kaydet" malzemeyi, değişkenleri ve yapılandırmaları kaydetmiyor
- Önem: Orta · Tür: Hata (veri kaybı)
- Bizde (`d9_parca.py` P4): malzemesi aluminium olan Pim kütüphaneye kaydedilip eklenir. Bileşende `material = None`; kütle çelikle (varsayılan) hesaplanıyor. Yapılandırmalı parça kütüphaneden eklenince "Yapılandırma: …" seçeneği yok.
- Kod: `src/asm/assembly.ts:313` yalnız `name, features, eqs, profiles`.
- Öneri: `material, vars, configs, config` da kaydet.

#### ✅ D9-17 · "Montaj: 'Bileşen Ekle' ile parça ekleyin" ipucu bileşen eklendikten sonra da kalıyor
- Önem: Düşük · Tür: Görsel
- Bizde (`d9_i3d.py`, telefon ekran görüntüsü): ilk bileşen eklendikten sonra ipucu ortada kalıyor (telefonda modeli örtüyor).
- Kod: `src/asm/asmui.ts:137` ipucu `enter()`'de konuyor; `addComp` (`:1350`) temizlemiyor.
- Öneri: `addComp` / `insertSub` sonunda `ctx.hint("")`.

#### ✅ D9-18 · Girişim Algılama sonuçları dışa aktarılamıyor
- Önem: Düşük · Tür: Eksik
- SolidWorks'te: "Sonuçları kaydet" / rapor.
- Bizde (`d9_arac1.py` T5): panelde yalnız liste, "Yalnız çakışan…" ve "Yeniden hesapla" var; CSV / rapor yok.
- Öneri: Malzeme listesindeki gibi "CSV indir" ekle.

#### ✅ D9-19 · Montaj STEP'inde ürün adları bileşen adı değil, montaj yapısı yok
- Önem: Düşük · Tür: SolidWorks'ten farklı
- Bizde (`d9_arac1.py` T10): `Montaj1.step` 3 katı içeriyor. PRODUCT adları "Open CASCADE STEP translator 8.0 1 / 1.1 / 1.2…"; "Plaka<1>", "Pim<1>" yok. Tek bileşik (compound), montaj ağacı yok.
- Kod: `src/kernel.worker.ts:4555-4560` `makeCompound(...).blobSTEP()`.
- Öneri: XCAF (`STEPCAFControl_Writer`) ile ad + montaj yapısı yaz; olmuyorsa en az ürün adlarını bileşen adlarıyla ver.

#### ✅ D9-20 · Antette malzeme anahtarı ("steel") yazıyor
- Önem: Düşük · Tür: Görsel
- Bizde (`d9_resim.py` R1): malzemesi `steel` olan parçanın resminde antet "steel" yazıyor (Malzeme penceresinde "Yapı çeliği (S235/S355)").
- Kod: `src/main.ts:453` `material: doc.material` (anahtar).
- Öneri: `MATERIALS[doc.material]?.name ?? doc.material`.

#### ✅ D9-21 · Ölçü gizlenince "Gizli ölçüleri göster" düğmesi araç değiştirilene kadar çıkmıyor
- Önem: Düşük · Tür: Hata (arayüz)
- Bizde (`d9_resim.py` R6): ölçüye tıkla → Gizle. Araç çubuğunda düğme yok. "Seç / taşı"ya basınca görünüyor.
- Kod: `src/main.ts:715` Gizle `renderEdit()` + `draw()` çağırıyor, `renderTools()` çağırmıyor.
- Öneri: Gizle sonrası `renderTools()`.

#### ✅ D9-22 · Masaüstü Dosya menüsünde "Belge özellikleri…" yok (ISO / ANSI, ondalık resmi etkiliyor)
- Önem: Düşük · Tür: Eksik (keşfedilebilirlik)
- Bizde (`d9_resim.py` R12): Dosya menüsünde yok; yalnız komut arama ya da ☰ dosya menüsünden açılıyor. Komut tanımlı (`F("f.docprops")`) ama menü listesine eklenmemiş.
- Kod: `src/main.ts:8695` `MENUS` Dosya listesinde `f.docprops` yok.

#### ✅ D9-23 · Montaj resminde ölçü / açıklama araçları ve ayar kalıcılığı yok
- Önem: Düşük · Tür: Eksik
- SolidWorks'te: Montaj çiziminde ölçü, not, balon düzenleme yapılabilir.
- Bizde (`d9_resim2.py` M1): Montaj Resmi penceresinde araç çubuğu ve düzenleme alanı yok. Balon / görünüş sürüklemeleri saklanmıyor (`dr` her açılışta boş).
- Kod: `src/main.ts:809` `if (!asmIn) renderTools()`; `:487` `asmIn ? { off: {}, … }`.

#### ✅ D9-24 · Sac parça resminde açınım (düz desen) görünüşü / büküm notu yok
- Önem: Düşük · Tür: Eksik
- Bizde (`d9_resim2.py` SM1): flanşlı sacın resmi yalnız katlı görünüşler (100 / 60 / 30); açınım görünüşü, büküm çizgileri / notları yok (ayrı "Sac açınımı (DXF)" var).

#### ✅ D9-25 · Profil merkezi eşleşmesi yüz ağırlık merkezini kullanıyor ve varsayılan öteleme 10 mm
- Önem: Düşük · Tür: SolidWorks'ten farklı
- Bizde (`d9_tur.py` pcenter): delikli üst yüzlerde merkezler ~0,5 mm kayık (yüz merkezi delik yüzünden 50,27). Panel varsayılanı "Öteleme 10" olduğundan yüzler 10 mm aralıklı. SolidWorks'te profil merkezi dış sınırın merkezidir, öteleme 0.
- Kod: `src/asm/asmui.ts:1117` (`v: 10` varsayılan), çözücü `profileCenter` artığı `f.c`.

#### ✅ D9-26 · Simetrik eşleşme iki bileşeni gereksiz yere 90° yatırıyor
- Önem: Düşük · Tür: SolidWorks'ten farklı
- Bizde (`d9_tur.py` sym): pim üst yüzü + Plaka2 üst yüzü, simetri = montaj Üst düzlemi. Sonuçta konumlar simetrik (5,13 / −5,14), ama iki bileşenin normali +X'e dönmüş. Beklenen: birinin 180° ters dönmesi.
- Kök: Doğrulanmadı (çözücü ayna normali koşulu).

#### ✅ D9-27 · Kam eşleşmesinde ~%5 hata
- Önem: Düşük · Tür: Hata (doğruluk)
- Bizde (`d9_tur.py` cam): takipçi = Plaka2 Ø10 delik kenarı, kam = pim üst Ø10 çemberi. Eksenler arası beklenen 10; ölçülen 10,49.
- Kök: Doğrulanmadı (çember zincirinin çokgen yaklaşımı / takipçi yarıçapı).

#### ✅ D9-28 · Alt montaj (.icasm) eklenince bileşen adları yinelenir
- Önem: Düşük · Tür: Hata
- Bizde (`d9_arac2.py` B10): Alt1.icasm eklenince ağaçta iki "Pim<1>" ve iki "Plaka<2>" var. Ağaç seçiminde ve BOM dışı raporlarda belirsizlik oluşuyor.
- Kod: `src/asm/asmui.ts:1960-1966` `insertSub` adları olduğu gibi kopyalıyor.
- Öneri: `addComp`'taki gibi `Ad<n>` sayacıyla yeniden adlandır.

### Denendi – sorun yok (özet)

- **Standart eşleşmeler:** Çakışık / Eş merkezli / Mesafe / Paralel / Dik / Teğet / Kilit / Açı gerçek tıklamayla. Panel ✓ sonrası açık kalıyor, seçimsiz ✓ kapatıyor. Aşırı tanım reddediliyor. Önizleme canlı. ✕ değeri koruyor. Ctrl+Z / Y doğru. Yenileme kalıcı (eşitleme dışında).
- **Gelişmiş / mekanik:** Genişlik, Yol, Yuva %50, Menteşe, Açı limiti doğru. Dişli / kremayer / vida / üniversal / bağlayıcı hatasız oluşuyor (hareket oranları as3 / as10'da).
- **Parça değişikliği (kalınlık):** 10 → 15 iki örnekte güncel; pim ve üst plaka yeni yüzlere taşınıyor (aynı oturumda). Küçük delik kayması (30 → 40) izleniyor.
- **Bağlam içi düzenleme:** Ø10 → Ø8, eşleşmeler korunuyor. Vazgeç çalışıyor. Bağlamdayken Ctrl+Z ana parçaya sıçramıyor.
- **Araçlar:** Taşı / Döndür panelleri, sürükleme, sabit bileşen, çarpışma algılama, girişim hacimleri (tam), boşluk 25,000, kesit, patlatma görüntüsü, hareket etüdü + WebM.
- **Kütle ve listeler:** Kütle (malzeme değişince güncelleniyor), BOM penceresi + CSV, bastırılan bileşen BOM'dan düşüyor.
- **Bileşen işlemleri:** STEP 3 katı. Aynala (kopya / ters el). Bileşen çoğaltma (sayısal olarak doğru). Desen güdümlü 4 örnek. Montaj deliği (parça belgesi değişmiyor, geri al, bastır). Delik hizalama, MateXpert, cıvata / somun / pul + BOM.
- **Alt montaj ve dosya:** Alt montaj kaydet / esnek / dağıt / ekle. Montaj adı / kaydet / yeni (geri alınabilir) / aç.
- **Teknik resim:** Görünüşler, otomatik ölçüler 100 / 60 / 10 / Ø10, ölçü + tolerans, Ra / GDT / datum, ölçü ve görünüş sürükleme, gizle / göster, kesit, detay → 2 sayfa, A3, 1:1, antet alanları, SVG ve DXF içerikleri. Kapat / aç ve sayfa yenileme kalıcı. ANSI.
- **Diğer resimler:** Kaynaklı kesim listesi; montaj resmi (BOM, balonlar, patlatılmış 2. sayfa, bağlam içi değişiklik sonrası yeni geometri).
- **Telefon:** Montajı Aç, ekle, dokunarak eşleşme, parmakla eksen boyunca sürükleme, ↶, uzun basma menüsü → Gizle, Taşı Delta, teknik resim pencereye sığıyor, dokunarak ölçü, Eskizi düzenle ile delik 30 → 40 (aynı oturumda izleniyor).

---

## Denetim 2 — d10: ARAYÜZ, DOSYA, GEZİNME ve TELEFON (v0.85, localhost:4173)

Ajan: d10 · Tarih: 2026-11-14 · Yöntem: PROTOKOL.md'ye göre.

Bütün kullanıcı adımları gerçek olaylarla yapıldı:
- **Masaüstü (1400×900):** menü çubuğu, ☰ Dosya listesi, şerit, ağaç, sağ tık, orta tuş, tekerlek, klavye. Fare tıklamaları gerçek.
- **Telefon (390×844) ve tablet (820×1180):** `is_mobile`, `has_touch`, CDP dokunma olayları. Kalem testinde CDP `pointerType: pen` kullanıldı.

**Hazır model:** Başlangıç modeli çoğu bölümde `setDoc` ile kuruldu (80×60×20 blok: Eskiz1 + Ekstrüzyon1). Bu adım raporda "hazır model" diye geçer. İş akışlarında (W1–W8) model sıfırdan, gerçek arayüzle çizildi.

**Hazır ortamlar (gerçek tarayıcıda karşılığı olan dış koşullar):**
- **İndirme yolu:** `showSaveFilePicker` / `showOpenFilePicker` silindi. Bu, dosya erişim API'si olmayan tarayıcıyı taklit eder.
- **Masaüstü Chrome/Edge dosya tutamacı:** Gerçek davranışı denemek için bu iki API sahte tutamaçla değiştirildi (`FS_MOCK`, `d10h.py`). Yazılanlar `window.__fs` içinde okundu.
- **Ses:** `SpeechRecognition` yerine "elli" döndüren sahte nesne kullanıldı.
- **İşletim sistemi renk seçicisi:** Seçilen renk `input[type=color]` alanına yazılıp `change` olayı verildi.
- **Telefonda dokunmatik fare ayarı:** localStorage'a yazıldı. Ayarlar penceresine telefonda ulaşılamıyor, bkz. D10-8.

`__app` yalnız sonuç okumak için kullanıldı: hacim, sınır kutusu, `doc`, kamera, localStorage.

**İndirilen dosyaların içeriği okunup modelle karşılaştırıldı:**
- `.icad`: JSON, özellikler ve d1
- STEP: `CARTESIAN_POINT` sınır kutusu
- STL: ikili, üçgen sayısı ve sınır kutusu
- 3MF: zip içindeki model, köşe sınır kutusu
- PDF: `%PDF-` üst bilgisi
- Eskiz DXF: LINE sayısı
- Yüz DXF: POLYLINE köşeleri

**Betikler:** `tests/e2e/denetim2/d10_*.py` (ortak yardımcılar `d10h.py`). Her betik tek başına çalışır ve sonunda `SONUC:` basar. Bulgu içeren kontroller bilerek `HATA` verir.

| Betik | İçerik |
|---|---|
| `d10_menu.py` | Menü çubuğunun tüm öğeleri, rehber düğmeleri ("Başla") |
| `d10_dosya.py` | Kaydet / Farklı kaydet / Aç / Son belgeler / sekmeler / sekme kapatma / yenileme / PM ve eskiz akıbeti / belge özellikleri / birim / dosya yöneticisi |
| `d10_dosya2.py` | Sahte dosya tutamacıyla yanlış dosyaya yazma, localStorage dolu, bozuk kayıtlar |
| `d10_geri.py` | Geri al / ileri al: eskiz, PM, ağaç, montaj, sekme |
| `d10_secim.py` | Seçim, sağ tık menüleri, ağaç işlemleri |
| `d10_gezinme.py` | Orta tuş, tekerlek, tuşlar, küp, görünüm çubuğu, kesit |
| `d10_kisayol.py` | Özelleştir, Enter, S, fare hareketleri, komut arama, şerit |
| `d10_telefon.py` | Telefon + tablet: ekran çubuğu, tepsi, örtülen düğmeler, hareketler, uzun basma, dosya listesi, sekmeler, ses |
| `d10_telefon2.py` | Dosya listesi alt öğeleri, dokunmatik fare, büyüteç, avuç reddi, aday çubuğu |
| `d10_diger.py` | İlk açılış rehberi, giriş ayarları, PM açıkken dosya komutları, standart araç çubuğu |
| `d10_akis.py` | 10 uçtan uca iş akışı |

**Ekran görüntüleri** (`/home/claude/rapor2/`):
- `d10_tel_parca.png`: mini çubuk ve aday çubuğu ekran çubuğunun üstünde, kırıntı küpün üstünde
- `d10_tel_dosya.png`: Dosya listesi ekrandan taşıyor
- `d10_tel_eskiz.png`: aday çubuğu PM başlığının üstünde, ekran çubuğu görünüm çubuğunun üstünde
- `d10_2tab_tel.png`: sekme çubuğu görünüm çubuğunu ve küpü örtüyor
- `d10_cube.png`

### Özet

| Önem | Sayı |
|---|---|
| Kritik | 3 |
| Yüksek | 3 |
| Orta | 7 |
| Düşük | 12 |
| **Toplam yeni** | **25** |

**İlk denetimden hâlâ geçerli olanlar:**

| Kimlik | Durum |
|---|---|
| A-1 | Görüntü stili düğmesi hâlâ gizli. Telefonda ve tablette Saydam'a erişim yok. |
| A-3 | Telefonda ve tablette ekran çubuğu, görünüm çubuğunun "Düzlemler" düğmesini örtüyor (PM ve eskiz). |
| A-6 | → tuşundan sonra model merkezi ekranda −7, −47 px kayıyor. |
| A-10 | Esc seçimi temizliyor ama "Seçili: …" ipucu kalıyor. |
| A-11 | Kesit ✓ sonrası Esc kesiti kapatmıyor. |
| A-13 | MMGS tıklanamıyor. |

A-20'nin Ctrl+S kısmı düzelmiş görünüyor: PM açık kalıyor. Ama aynı tür kayıp başka dosya komutlarında sürüyor, bkz. D10-5.

**v0.85 orta tuş değişiklikleri doğrulandı:**
- Model merkezi ekranda sabit kalıyor (0 px).
- Yatay sürüklemede yuvarlanma yok: ekranın yukarı yönü dünyada sabit.
- Hızlı ardışık sürüklemeler sığdırma yapmıyor.
- Çift orta tık sığdırıyor.
- Ctrl+orta kaydırma 1:1 (80 / 40 px).

**Kapsam:** Alandaki 139 öğenin (menü 79 + "Başla" 6 + Dosya listesine özgü 12 + alanın diğer 42 satırı) hepsinin matriste satırı var: 139/139. Ayrıntı aşağıda.

**Mevcut testler:**
- ui2, ks1, ex1, gn1, mr1, fs1, nt1, fs2, mb2: TAMAM
- mob1, tp1, ui1, cube1, pa1, pb2: yalnız çıktı basıyor, SONUC satırı yok. Çıktıları hatasız.
- tp1'in koordinatları v0.83 tepsisinin üstüne düştüğü için dokunuş tepsiye gidiyor. Dokunmatik fare `d10_telefon2.py`'de yeniden denendi ve çalışıyor.

### En kritik 5

1. **D10-1 (Kritik):** Farklı kaydet aynı belge kimliğini (uid) koruyor. Orijinal dosyayı açınca kopyanın sekmesine geçiliyor ve kopya gösteriliyor (Kutu.icad d1=20 açıldı, ekranda Kutu2 d1=30). Son belgelerden orijinal düşüyor.
2. **D10-2 (Kritik):** Dosya açma Ctrl+Z ile geri alınabiliyor ve dosya tutamacı kalıyor. Ctrl+S, A.icad'ın üstüne boş "Parça1" belgesini sorgusuz yazıyor.
3. **D10-3 (Kritik):** localStorage dolunca kayıt sessizce başarısız oluyor. 6. fotoğraf ve ondan sonraki her değişiklik sayfa yenilenince kayboluyor, uyarı yok.
4. **D10-4 (Yüksek):** Var olan eskiz ✕ "Kaydetmeden çık" ile kapatılınca geri al yığınından bir adım siliniyor. Sonraki Ctrl+Z iki adım geri gidiyor: ekstrüzyon kayboluyor, hazır modelde belge tamamen boşalıyor.
5. **D10-5 (Yüksek):** Açık PM'deki değişiklik şu komutlarda sorulmadan atılıyor: belge sekmesi değiştirme, Yeni, Aç, STEP/STL dışa aktar, Son belgeler, Belge özellikleri.

---

### Kapsam matrisi

**Sütunlar:**
- a: çalıştır + sonucu doğrula
- b: düzenle / yeniden aç
- c: ebeveyn / bağlam değişince
- d: geri al / ileri al
- e: kayıt / yenileme / kalıcılık
- f: vazgeç (✕ / Esc / İptal)
- g: sil / kapat

**İşaretler:**
- ✓: geçti
- ✗ Dn: hata (bulgu numarası)
- –: uygulanamaz (komut belge değiştirmez ya da adım anlamsız)

Betik kısaltmaları: m = d10_menu, do = d10_dosya, do2 = d10_dosya2, ge = d10_geri, se = d10_secim, gz = d10_gezinme, k = d10_kisayol, t = d10_telefon, t2 = d10_telefon2, di = d10_diger, ak = d10_akis.

#### Menü çubuğu — Dosya (12)

| Öğe | a | b | c | d | e | f | g | Not / betik |
|---|---|---|---|---|---|---|---|---|
| Yeni parça (Ctrl+N) | ✓ boşsa aynı sekme, doluysa yeni sekme | – | – | ✓ yeni sekmede Ctrl+Z diğerine dokunmaz | ✓ yenileme belgeyi korur; ✗ D10-7 sekme çubuğu | ✗ D10-5 açık PM'i siler | – | do, ge, ak W1 |
| Aç… (Ctrl+O) | ✓ dosya seçici, .icad yüklenir; ✗ D10-1 aynı uid'de yanlış belge | – | – | ✗ D10-2 açma geri alınabiliyor | ✓ | ✓ seçici iptal → değişmez | – | do, do2, ak W1/W10 (bozuk dosya: ileti, belge korunur ✓) |
| Son belgeler… | ✓ liste, Aç | – | – | – | ✗ D10-1 orijinal listeden düşer; ✗ D10-22 bozuk kayıtta açılmaz | ✓ Kapat | – | do, do2 |
| Kaydet (Ctrl+S) | ✓ ilk kez ad sorar, sonra sormaz; içerik güncel (d1 30) | – | – | – | ✓ indirme içeriği = model; tutamaçla aynı dosyaya (sahte FS) | ✗ D10-20 ad penceresinde Vazgeç yine indirir | – | do, do2, ak W1/W5/W7 |
| Farklı kaydet… | ✓ ad + indirme; tutamaçla yeni dosya ve sonra Ctrl+S yeni dosyaya | – | – | – | ✗ D10-1 uid aynı | ✗ D10-20 | – | do, do2, ak W1 |
| Şekil sihirbazı… | ✓ pencere, Blok → 240000 | – | – | ✓ ↶ / ↷ (telefon) | ✓ | ✓ Kapat | – | m, ak W2/W7 |
| STEP / STL içe aktar… | ✓ STL / STEP içe aktarma hacmi = kaynak (240000) | – | – | ✓ Ctrl+Z | ✓ yenileme | ✓ seçici iptal | – | m, ak W2 |
| STEP dışa aktar | ✓ ISO-10303-21, sınır kutusu = model, ad = belge adı | – | – | – | – | – | – | m, ak W2/W5; ✗ D10-5 PM açıkken |
| STL dışa aktar | ✓ ikili, 12 üçgen, sınır kutusu = model | – | – | – | – | – | – | m, ak W2 |
| Sac açınımı (DXF) | ✓ sac olmayan parçada uyarı (sac DXF d6 alanı) | – | – | – | – | – | – | m |
| Kesim listesi… | ✓ pencere | – | – | – | – | ✓ | – | m (içerik d8) |
| Teknik resim… | ✓ pencere | – | – | – | ✗ D10-22 bozuk ayarda açılmaz | ✓ | – | m, do2 |

#### Menü çubuğu — Düzen (10)

| Öğe | a | b | c | d | e | f | g | Not / betik |
|---|---|---|---|---|---|---|---|---|
| Geri al (Ctrl+Z) | ✓ 30→20 | – | – | ✗ D10-2, ✗ D10-4 | ✓ yenileme yığını sıfırlar (beklenen) | – | – | m, ge |
| Yinele (Ctrl+Y) | ✓ | – | – | ✓ | – | – | – | m, ge |
| Yeniden oluştur (Ctrl+B) | ✓ | – | – | – | – | – | – | m |
| Ekranı yenile (Ctrl+R) | ✓ (görünür etki yok) | – | – | – | – | – | – | m |
| Kopyala (Ctrl+C) | ✓ eskizde; ✗ D10-14 parça modunda etkisiz | – | – | ✓ eskizde Ctrl+Z | – | – | – | m |
| Yapıştır (Ctrl+V) | ✓ eskizde 4 → 8 öğe; ✗ D10-14 parça | – | – | ✓ | – | – | – | m |
| Sil (Delete) | ✓ ağaçta özellik + onay | – | ✗ D10-12 bağımlılar | ✓ Ctrl+Z | ✓ | ✓ Vazgeç değiştirmez | ✓ | m, se; yüz seçiliyken Delete hiçbir şey silmez ✓ (di) |
| Tümünü seç (Ctrl+A) | ✓ eskiz 4; parça modunda etkisiz (D10-14) | – | – | – | – | – | – | m |
| Yeniden adlandır (F2) | ✓ | – | – | ✓ | ✓ | ✓ prompt iptal | – | m, se, ge |
| Son komutu tekrarla (Enter) | ✓ Radyüs / Pah yeniden | – | – | – | – | – | – | m, k |

#### Menü çubuğu — Görünüm (20 + 5 stil)

| Öğe | a | e kalıcılık | Not |
|---|---|---|---|
| Önden … Alttan (Ctrl+1–6, 6 öğe) | ✓ yönler doğru (menü + klavye) | – | m, gz |
| İzometrik (Ctrl+7) | ✗ D10-15 (1, 0.82, 1) | – | m |
| Normal (dik bak) (Ctrl+8) | ✓ seçili yüz / ikinci basış ters | – | m, se |
| Ekrana sığdır (F) | ✓ | – | m |
| Yakınlaştır (Shift+Z) / Uzaklaştır (Z) | ✓ ×1,25 / ×0,8 | – | m, gz |
| Bölgeye yakınlaştır | ✓ ×8,7 | – | m, gz |
| Önceki görünüm (Ctrl+Shift+Z) | ✓ | – | m, gz |
| Büyüteç (G) | ✓ aç / kapa | – | m, gz |
| Perspektif | ✓ | ✓ | m, gz |
| Görüntü stili › 5 stil | ✓ 5/5 | ✗ D10-17 | m; Saydam yalnız gizli düğmede (A-1) |
| Düzlemleri göster / gizle | ✓ | ✗ D10-17 | m, gz |
| Özellik ağacını göster / gizle (F9) | ✓ | – | m |
| Tam ekran (F11) | ✓ `fullscreenElement` | – | m |
| Tam ekran Esc kilidi | ✓ `imajcad.fslock` | ✓ | m |

#### Menü çubuğu — Ekle (5 alt menü)

| Öğe | a | Not |
|---|---|---|
| Özellikler (46 öğe) | ✓ › Radyüs PM açılır | Öğelerin kendisi d4–d7 alanı |
| Eskiz (56 öğe) | ✓ › Çizgi (parça modunda "Önce Eskiz…" uyarısı) | "Eskiz" komutu bu alt menüde yok (Referans'ta) |
| Sac Metal (18) | ✓ › Taban Flanş (eskiz yoksa uyarı) | |
| Kaynaklı (7) | ✓ › Yapı Elemanı PM | |
| Montaj (2) | ✓ › Montajı Aç | |

#### Menü çubuğu — Araçlar (9 + Değerlendir 15)

| Öğe | a | e | Not |
|---|---|---|---|
| Değerlendir › Ölç, Kütle Özell., Teknik Resim, Mukavemet, Statik Analiz, Fotoğraflar, Kumpas, Ne Yanlış?, Kontrol, Koniklik Analizi, Kesit, Malzeme, Denklemler, Yapılandırmalar, Girişim (15) | ✓ her biri pencere / panel / mod / ileti açar (15/15) | – | m. Eskiz açıkken Kütle Özell. eskizden kaydederek çıkar (k) |
| Eskizden çık | ✓ | – | m, se |
| Hızlı yakalama… | ✓ eskizde menü; parça modunda etkisiz | – | m |
| Kısayol çubuğu (S) | ✓ parça 10, eskiz 12 düğme; düğme çalışır | – | m, k |
| Seçim filtresi (F5) | ✓ tümü / yüz / kenar; kenar filtresinde yüz seçmez | – | m, se |
| Özelleştir… | ✓ Shift+R atama, çakışma onayı, Delete ile kaldır, varsayılanlar | ✓ kısayol ve 8 yön yenilemede kalıcı | k |
| Kısayol listesini yazdır | ✓ açılır pencere, liste | – | m |
| Kalem ve dokunmatik ayarları… | ✓ | ✓ profil kalıcı | m, di; ✗ D10-8 telefonda erişilemez |
| Tekerlek yönünü ters çevir | ✓ | ✓ yenilemede ters | m, gz |

#### Menü çubuğu — Yardım (3) ve Başlangıç rehberi "Başla" (6 düğme)

| Öğe | a | e | Not |
|---|---|---|---|
| Yardım (F1) | ✓ başlık v0.85; Esc kapatır | – | m, di |
| Başlangıç rehberi… | ✓ | ✓ ilk açılışta otomatik (webdriver gizlenerek), ikinci açılışta açılmaz | m, di |
| Kısayol listesini yazdır | ✓ | – | m |
| Başla › 🖱 Fare ve klavye | ✓ profil mouse | ✓ | m, di |
| Başla › ✒ Kalem | ✓ auto | ✓ | m |
| Başla › ☝ Parmak (imleç üstte) | ✓ finger, touchpad false | ✓ | m |
| Başla › ☝ Parmak (dokunmatik fare) | ✓ finger, touchpad true | ✓ | m |
| Başla › Hiç çizmeden: şekil sihirbazı | ✓ | – | m |
| Başla › Başla (kapat) | ✓ `imajcad.welcomed` | ✓ | m |

#### ☰ Dosya listesine özgü öğeler (12)

| Öğe | a | e | Not |
|---|---|---|---|
| Dosya yöneticisi… | ✓ açık belgeler, son belgeler, Aç / İndir / Listeden çıkar / Geç / Kapat | ✓ | do |
| Belge özellikleri… | ✓ ad / yazar / ondalık / özel özellik; ad dosya adına ve STEP adına geçer | ✓ yenilemede kalıcı | do, ak W5; Vazgeç ✓ |
| 3MF olarak dışa aktar | ✓ zip (3 dosya), köşe sınır kutusu = model | – | ak W2 |
| Görünümü PDF olarak kaydet | ✓ %PDF, 47 kB | – | ak W2 |
| Eskizi DXF olarak dışa aktar | ✓ 4 LINE | – | ak W3 |
| Seçili yüzü DXF olarak dışa aktar | ✓ POLYLINE 60×40 | – | ak W3 |
| Birim: mm ↔ inç | ✓ alan 0,7874 in, 1 in → 25,4 mm; inçte eskiz ölçüsü 3 → 76,2 mm | ✓ | do, ak W6; ✗ D10-21 |
| Perspektif / ortografik | ✓ | ✓ | di |
| Tekerlek yönünü ters çevir | ✓ | ✓ | gz |
| Klavye ve fare kısayolları… | ✓ yardım | – | di; ✗ D10-8 |
| Kalem ve dokunmatik ayarları… | ✓ masaüstü | ✓ | ✗ D10-8 telefonda erişilemez |
| Başlangıç rehberi… | ✓ (menü çubuğundan) | – | ✗ D10-8 listede ekran dışında |

#### Alanın diğer öğeleri

| Öğe | a | d | e | f | Not / betik |
|---|---|---|---|---|---|
| Standart araç çubuğu (tam ekran, kilit, ağaç, ↶, ↷, Dosya, Yardım) | ✓ hepsi | ✓ | – | – | di |
| Komut arama | ✓ "pah" + Enter → PM; "zzqq" → Sonuç yok; Esc | – | – | ✓ | k |
| Şerit sekmeleri (6) | ✓ her sekmede komutlar; eskizde sekme değişir, eskiz açık kalır | – | – | – | k |
| Şerit özelleştirme | ✓ Radyüs gizle / varsayılana dön | – | ✓ kalıcı | ✓ Vazgeç | k; ✗ D10-18 menüde yok |
| Kısayol atama kalıcılığı | ✓ | – | ✓ | ✓ çakışmada Vazgeç | k |
| Enter = son komut | ✓ | – | – | – | k, m |
| S kısayol çubuğu | ✓ | – | – | ✓ Esc | k |
| Fare hareketleri 4 / 8 yön | ✓ sağ sürükle ↑ → Üstten | – | ✓ 8 yön kalıcı | – | k |
| Sağ tık: model yüzü | ✓ Dik, Eskiz, parça rengi (+ Ctrl+Z) | ✓ | – | – | se; ✗ D10-11 |
| Sağ tık: ağaç | ✓ Özelliği düzenle | – | – | – | se; ✗ D10-11 |
| Sağ tık: boşluk / eskiz / PM | ✓ İzometrik, Önceki görünüm, Eskizden çık, İptal | – | – | – | se |
| Seçim: tık / Ctrl / Ctrl ile kaldır / kenar | ✓ | – | – | ✓ Esc (A-10 ipucu) | se |
| Seçim: kutu (pencere) | ✓ 6 yüz + 12 kenar (A-15 bilinen) | – | – | – | se |
| Diğerini seç (Alt+tık) | ✓ | – | – | – | se |
| Ön seçim / bağlam mini çubuğu / kırıntılar | ✓ mini çubuk Eskiz → üst yüzde eskiz; kırıntı → ağaç seçimi | – | – | – | se; ✗ D10-10, D10-23 (telefon) |
| Ağaç: adlandır (F2 / Adlandır) | ✓ | ✓ | ✓ | – | se, ge |
| Ağaç: çift tık → düzenle | ✓ | – | – | – | se |
| Ağaç: ▲▼ / sürükle-bırak sırala | ✓ sürükle-bırak; ✗ D10-12 radyüs ebeveyninin üstüne çıkabiliyor | ✓ | – | – | se |
| Ağaç: klasör | ✓ | – | – | – | se |
| Ağaç: bastır / etkinleştir | ✓ 96000 ↔ 95570,8 | ✓ | – | – | se, ge |
| Ağaç: sil + onay | ✓ onay, Vazgeç; ✗ D10-12 | ✓ | – | ✓ | se |
| Ağaç: geri sarma / sona sar | ✓ | ✓ | – | – | se, ge |
| Ağaç: ebeveyn / çocuk | ✗ D10-12 geometrik çocuk yok | – | – | – | se |
| Orta tuş döndür / Ctrl kaydır / Shift yakınlaştır / Alt çevir / çift tık sığdır | ✓ (v0.85: merkez sabit, yuvarlanma yok, ardışık vuruş sığdırmaz) | – | – | – | gz |
| Tekerlek | ✓ imleç noktası sabit, SW yönü, ters ayar kalıcı | – | ✓ | – | gz |
| Ok tuşları / Shift / Alt / Ctrl | ✓ 15° / 90° / yuvarla / kaydır (A-6 merkez) | – | – | – | gz |
| Boşluk yön menüsü | ✓ | – | – | ✓ Esc | gz |
| Görünüm küpü (yüz / kenar / köşe / sürükle / İzo) | ✓; ✗ D10-16 çapraz ölü çizgi | – | – | – | gz |
| Görünüm çubuğu (Normal, Sığdır, Bölge, Önceki, Kesit, Yön, Düzlemler) | ✓; Stil gizli (A-1) | – | ✗ D10-17 | – | gz |
| Kesit | ✓ PM, ✓ → kesme düzlemi, düğmeyle kapanır | – | – | ✗ A-11 Esc | gz |
| Geri al tutarlılığı: eskiz içi / eskiz ✓ / eskiz ✕ / PM / ağaç / montaj ↔ parça / sekmeler | ✓ çoğu; ✗ D10-4 eskiz ✕ | ✓ | – | – | ge, ak W4 |
| Çıkış onayı (PM / eskiz, Esc / ✕ / yenileme) | ✓ beforeunload yalnız değişmişte | – | ✗ D10-13 eskizde "ayrıl" kaydediyor | ✓ | do, ge |
| Belge sekmeleri: geçiş / kapatma / yenileme | ✓ geçiş, eskiz korunur | – | ✗ D10-7 | ✗ D10-5 PM, ✗ D10-19 | do |
| localStorage dolu / bozuk / iki pencere | ✗ D10-3 / D10-22 / D10-6 | – | – | – | do2, ak W9 |
| İlk açılış rehberi / Yardım / tam ekran / giriş ayarları | ✓ | – | ✓ | ✓ | di, m |
| Telefon: tek parmak döndür (100 px = 45,8°), iki parmak ×2 / kaydır, 2 parmak geri / 3 parmak ileri | ✓ telefon + tablet | – | – | – | t |
| Telefon: uzun basma menüsü (yüz / boşluk) → Eskiz | ✓ | – | – | – | t, t2, ak W8; ✗ D10-11 |
| Telefon: ekran çubuğu (✕, Tümü/Yüz/Kenar, ✚, 📷, Ctrl, ↶, ↷, ☰, ⤢, 🎤; eskizde ✓, ✕, A, 123) | ✓ her biri; ✗ D10-10, D10-24, A-3 | ✓ | – | – | t |
| Telefon: alt komut tepsisi | ✓ tepsiden Dikdörtgen / Daire / Montajı Aç; PM'de gizlenir, eskizde kalır | – | – | – | t, ak W8 |
| Telefon: dairesel menü | ✓ 9 öğe, Radyüs → PM | – | – | – | t |
| Telefon: dokunmatik fare / büyüteç / avuç reddi / aday çubuğu | ✓ | – | – | – | t2; ✗ D10-25 |
| Telefon: Dosya listesi / sekmeler / pencere boyutları | ✓ Kaydet (indirme), Yeni, sekmeye dokunma, belge özellikleri sığar | – | ✓ yenileme (W7) | – | t; ✗ D10-8, D10-9 |
| Sesle sayı / kumpas (yazılım) | ✓ "elli" → Derinlik 50; 123 kutusunda 🎤 var; kumpas fs2 TAMAM | – | – | – | t, fs2 |

### İş akışları

| No | Cihaz | Senaryo (tümü gerçek arayüz) | Sonuç |
|---|---|---|---|
| W1 | Masaüstü | Ön düzlem → Eskiz → Dikdörtgen 2 tık → ölçü kutusu 60/40 → ✓ → öneri "Ekstrüzyon" 25 → Ctrl+S (W1.icad, içerik d1=25) → Ctrl+N → sekme 1 → yenile → derinlik 40 → Farklı kaydet W1b → W1.icad'ı aç | ✓ akış tamam (60000 → 96000). Bu sırada W1b ile W1 aynı uid'yi taşıyor (D10-1). Yenilemeden sonra sekme çubuğu yok (D10-7). |
| W2 | Masaüstü | Sihirbaz Blok → STEP dışa (sınır kutusu = model) → STL dışa → Ctrl+N → STEP içe aktar (240000) → Ctrl+N → STL içe aktar (240000) → yenile → 3MF (sınır kutusu = model) → PDF | ✓ (yenilemeden sonra 3 sekme görünmüyor: D10-7) |
| W3 | Masaüstü | Üst düzlemde 60×40 → Ekstrüzyon 10 → ağaçta eskiz → Eskiz DXF (4 LINE) → üst yüze tık → Yüz DXF (60 genişlik) | ✓ |
| W4 | Masaüstü | Çiz → Ekstrüzyon 20 → Düzenle 30 → Eskizi düzenle → ölçü 80 → ✕ Kaydetmeden çık → Ctrl+Z | ✗ D10-4: ağaçta yalnız Eskiz1 kaldı, ekstrüzyon yok oldu (beklenen d1=20) |
| W5 | Masaüstü | Çiz + ekstrüzyon → Belge özellikleri ad "Mil Yatağı" → Ctrl+S → STEP | ✓ "Mil Yatağı.icad", "Mil Yatağı.step" |
| W6 | Masaüstü | 50,8×25,4×10 → birim inç → eskiz ölçüsü 2" → 3 → ✓ → yenile | ✓ 76,2 mm, 19354,8 mm³, kalıcı |
| W7 | Telefon | ✚ sihirbaz Blok → ↶ (boş) → ↷ → Dosya › Kaydet "TelBlok" → Dosya › Yeni → 1. sekmeye dokun → yenile | ✓ |
| W8 | Telefon | Üst yüze uzun basma → Eskiz → alt paneli küçült → tepsi Daire → 2 dokunuş (imleç kayması 70 px) → Ø20 → ✓ → öneri "Ekst. Kesme" → ✓ | ✓ 89716,8 = 96000 − π·100·20 |
| W9 | Masaüstü (2 pencere) | Aynı belge iki pencerede açık → 1. pencerede derinlik 30 → 2. pencerede Adlandır "Gövde" → 1. pencereyi yenile | ✗ D10-6: d1=20, 1. penceredeki değişiklik sessizce kayboldu |
| W10 | Masaüstü | Bozuk JSON .icad aç → eksik referanslı .icad aç | ✓ "Dosya açılamadı" iletisi, belge korunuyor; eksik referanslı dosya yeni sekmede açıldı, hata ağaçta (E) |
| W11 | Masaüstü (sahte FS) | A.icad aç → Ctrl+Z → Ctrl+S | ✗ D10-2: A.icad boş belgeyle ezildi |
| W12 | Masaüstü (sahte FS) | A aç → Ctrl+N → B aç → B'de derinlik 25, Ctrl+S → A'da 35, Ctrl+S → yenile → Ctrl+S (ad sorar) → Farklı kaydet C → Ctrl+S → Yeni → A.icad aç | ✓ doğru dosyalara yazıldı. Son adımda ✗ D10-1: A.icad açılınca C (d1=5) gösterildi, sonraki Ctrl+S C.icad'a yazdı. |
| W13 | Masaüstü | Hazır blok + 6 fotoğraf notu (1280 px) → derinlik 44 → yenile | ✗ D10-3 |

---

### Bulgular

#### ✅ D10-1 · Farklı kaydet belge kimliğini (uid) değiştirmiyor: orijinal dosyayı açınca kopya gösteriliyor, son belgelerden orijinal düşüyor
- **Önem:** Kritik · **Tür:** Hata (yanlış belge, veri karışması)
- **SolidWorks:** "Farklı kaydet" yeni bir belge oluşturur (kimlik dosya yoludur). Orijinal dosya açılınca orijinal içerik gelir. İki dosya ayrı belgelerdir.
- **Bizde:**
  1. Hazır blok (d1=20) → Dosya › Kaydet "Kutu" (Kutu.icad, uid=2tg98dld).
  2. Düzenle → derinlik 30 → ✓ → Dosya › Farklı kaydet "Kutu2" → Kutu2.icad'ın uid'si aynı (2tg98dld).
  3. Dosya › Son belgeler: yalnız "Kutu2" (Kutu listeden düştü).
  4. Dosya › Yeni parça (2. sekme) → Dosya › Aç… → Kutu.icad (d1=20). Uygulama Kutu'yu yüklemiyor: sessizce Kutu2 sekmesine geçiyor. Ekranda ad "Kutu2", hacim 144000 (d1=30). "açıldı" iletisi bile yok.
  5. Sahte dosya tutamacıyla (W12): C.icad'a farklı kaydedilen belge açıkken A.icad'ı açınca C gösterildi. Kullanıcının "A" sandığı belgede yaptığı değişiklik Ctrl+S ile **C.icad'a** yazıldı.
- **Betik:** `d10_dosya.py` (kaydet), `d10_dosya2.py` (tutamac)
- **İlgili kod:**
  - `src/main.ts:7173-7203` `saveFile`: `asNew` iken `uid` yenilenmiyor.
  - `src/main.ts:7160-7161` `openDocText`: aynı uid'li sekme varsa dosya içeriği atılıp `switchTab(ex)` çalışıyor.
  - `src/main.ts:7205-7215` `pushRecent`: uid ile tekilleştiriyor.
  - Montajda `AsmPart.key` da uid'den geldiği için kopya parçalar aynı parça sayılabilir (Doğrulanmadı).
- **Öneri:**
  - Farklı kaydet'te (her iki yolda) `doc.uid` yeni üretilsin ve `docTabs[activeTab].uid` güncellensin.
  - `openDocText` aynı uid'li sekme bulunca içerik farklıysa sorsun ("Açık sürüme geç / Dosyadakini yeni sekmede aç") ya da en azından dosyayı yeni sekmede açsın.
  - Son belgeler (uid + ad) ile tekilleştirilsin.

#### ✅ D10-2 · Dosya açma geri alınabiliyor; Ctrl+Z sonrası Ctrl+S açılan dosyanın üstüne başka belgeyi yazıyor
- **Önem:** Kritik · **Tür:** Hata (diskteki dosyanın sorgusuz ezilmesi)
- **SolidWorks:** Belge açmak geri alma geçmişine girmez. Ctrl+Z açılan belgeyi kapatmaz. Kaydet her zaman o belgenin dosyasına, o belgenin içeriğini yazar.
- **Bizde:** Masaüstü Chrome/Edge (dosya erişim API'si; sahte tutamaçla):
  1. Boş belgede Ctrl+O → A.icad (2 özellik) açıldı.
  2. Ctrl+Z → belge boşaldı (ad "Parça1", 0 özellik). Geri al düğmesi açmadan sonra etkindi.
  3. Ctrl+S → onay sorulmadan `write:A.icad`. Diskteki A.icad artık `{"name":"Parça1","features":[]}`.

  İndirme yolunda da (API yok) Ctrl+Z açılan belgeyi siliyor (özellik 2 → 0).
- **Betik:** `d10_dosya2.py` (tutamac), `d10_dosya.py` (yenidosya)
- **İlgili kod:**
  - `src/main.ts:7163` `openDocText`: boş belgede `commitDoc(() => (doc = d))` geri alınabilir bir adım ekliyor. `fileHandle = handle` ise geri alınmıyor.
  - `src/main.ts:6958-6969` `undo` belgeyi değiştiriyor ama `fileHandle` aynı kalıyor.
  - Yeni parça'nın aynı sekmede çalışan kolu da `commitDoc` kullanıyor (`src/main.ts:7110`).
- **Öneri:**
  - Açma ve aynı sekmede Yeni, `commitDoc` yerine doğrudan atama + `undoStack.length = redoStack.length = 0` ile yapılsın (SolidWorks gibi yeni geçmiş).
  - Ek güvenlik: belge kimliği tutamaçla eşleşmiyorsa Kaydet "Farklı kaydet" gibi sorsun.

#### ✅ D10-3 · localStorage dolunca kayıt sessizce başarısız: sonraki tüm değişiklikler yenilemede kayboluyor
- **Önem:** Kritik · **Tür:** Hata (sessiz veri kaybı)
- **SolidWorks:** Kaydetme başarısızsa açık hata verilir. Çalışılan belge kaybolmaz.
- **Bizde:**
  1. Hazır blok → Değerlendir › Fotoğraflar › Fotoğraf ekle / çek → 1280×960 fotoğraf → boşluğa dokun (konumsuz). Bu 6 kez yapıldı.
  2. Her fotoğraf belgeye yaklaşık 1 MB karakter ekliyor (JPEG data URL). localStorage kullanımı 1,0 → 2,0 → … → 5,03 M karakter.
  3. 6. fotoğrafta `imajcad.doc.v2` yazılamadı: belgede 6 fotoğraf, kayıtta 5. İleti yalnız "Fotoğraf eklendi (konumsuz)".
  4. Ardından Düzenle → derinlik 44 → ✓. Kayıt yine başarısız, uyarı yok.
  5. Sayfayı yenile → d1=20, 5 fotoğraf. **Son fotoğraf ve sonraki her değişiklik kayboldu.**

  Gerçek telefon fotoğrafları daha küçük olabilir, ama birkaç belge (sekmeler `imajcad.tabs` içinde ayrıca saklanıyor) ve son belgeler kopyaları (2 MB'a kadar) aynı kotayı paylaşıyor.
- **Betik:** `d10_dosya2.py` (dolu)
- **İlgili kod:**
  - `src/main.ts:73-79` `saveDoc` hatayı yutuyor (`catch {}`).
  - Aynı biçimde `saveTabs` (`src/main.ts:107-111`) ve `pushRecent` (`src/main.ts:7205-7215`).
  - Fotoğraflar belgenin içinde: `src/ui/field.ts:50-52`, `loadImageFile(f, 1280)`.
- **Öneri:**
  - `saveDoc` başarısızlığı yakalayıp kalıcı bir uyarı göstersin: "Tarayıcı deposu dolu — Dosya › Kaydet ile indirin". Geri al yığınını değil, kullanıcıyı uyarsın.
  - Fotoğraflar ve büyük içe aktarmalar IndexedDB'de tutulsun, belgede yalnız başvuru kalsın.
  - Kota dolunca önce `imajcad.recent` kopyaları kırpılsın.

#### ✅ D10-4 · Var olan eskiz ✕ "Kaydetmeden çık" ile kapatılınca geri al yığınından bir adım siliniyor
- **Önem:** Yüksek · **Tür:** Hata (geri alma tutarsızlığı; Ctrl+Y ile kurtarılabilir, başka işlem yapılırsa kalıcı kayıp)
- **SolidWorks:** Eskiz düzenlemesinden vazgeçmek geçmişi değiştirmez. Ctrl+Z bir önceki işlemi geri alır.
- **Bizde (W4, sıfırdan arayüzle):**
  1. Dikdörtgen çiz → Ekstrüzyon 20 → Düzenle → derinlik 30 → ✓.
  2. Ağaç › Eskiz1 › Eskizi düzenle → ölçüye çift tık → 80 → Enter → ✕ → Kaydetmeden çık.
  3. Ctrl+Z.
  - Beklenen: derinlik 20.
  - Bizde: ağaçta yalnız "Eskiz1", ekstrüzyon yok oldu (iki adım geri).
  - Hazır modelde (`d10_geri.py` eskizx) Ctrl+Z belgeyi tamamen boşalttı (0 özellik).
  - Ctrl+Y d1=30'u geri getiriyor. Ama arada herhangi bir işlem yapılırsa ileri al yığını silinir ve model kalıcı olarak gider.
- **Betik:** `d10_geri.py` (eskizx), `d10_akis.py` (W4)
- **İlgili kod:**
  - `src/main.ts:1709-1712` `exitSketch(false)`: `undoStack.pop()` var olan eskiz için de çalışıyor.
  - `openSketch` (`src/main.ts:1654`) var olan eskizde yığına bir şey koymuyor. Yalnız `startSketch` (yeni eskiz, `src/main.ts:1648`) koyuyor.
- **Öneri:** `undoStack.pop()` yalnız `isNew` iken yapılsın. Var olan eskizde `!keep` kolunda yığına dokunulmasın.

#### ✅ D10-5 · Açık PM'deki değişiklik sekme değiştirme ve dosya komutlarında sorulmadan atılıyor
- **Önem:** Yüksek · **Tür:** Hata (uyarısız kayıp)
- **SolidWorks:** Belgeler arası geçişte açık PropertyManager o belgede açık kalır. Dışa aktarma gibi komutlar PM açıkken ya bekler ya da sorar.
- **Bizde:**
  - Hazır blok → Ekstrüzyon1 › Düzenle → Derinlik 45 (✓ yok) → ikinci belge sekmesine tıkla → geri dön. PM kapanmış, d1=20, hiçbir pencere açılmadı.
  - Aynı durum PM açıkken (Derinlik 33) şunlarla da oluyor: Dosya › Yeni parça, STEP dışa aktar, Son belgeler…, Belge özellikleri. Mod "part", d1=20, soru yok.
  - Ctrl+S artık PM'i kapatmıyor (A-20'nin o kısmı düzelmiş).
- **Betik:** `d10_dosya.py` (sekme), `d10_diger.py` (pmdosya)
- **İlgili kod:**
  - `src/main.ts:127` `switchTab`: `if (mode.k === "pm") cancelFeature();`
  - `src/main.ts:~7106` dosya eylemleri: `if (mode.k === "pm") cancelFeature();`
  - `openInNewTab` / `closeTab` da PM'i hesaba katmıyor.
- **Öneri:** `workDirty()` doğruysa `askExit` ("Uygula ve geç / Atıp geç / Vazgeç") sorulsun. Ya da salt okunur komutlar (dışa aktarma, son belgeler, belge özellikleri) PM'i hiç kapatmasın.

#### ✅ D10-6 · Aynı uygulama iki pencerede açıkken (PWA + tarayıcı sekmesi) bir pencere diğerinin değişikliğini sessizce eziyor
- **Önem:** Yüksek · **Tür:** Hata (sessiz veri kaybı)
- **SolidWorks:** Aynı belge ikinci kez açılırken "salt okunur" uyarısı verir.
- **Bizde (W9):**
  1. Hazır blok iki pencerede açık.
  2. 1. pencerede derinlik 30 → ✓ (kaydedildi).
  3. 2. pencerede ağaç › Ekstrüzyon1 › Adlandır "Gövde".
  4. 1. pencereyi yenile → ad "Gövde", d1=20. Derinlik değişikliği hiçbir uyarı olmadan kayboldu (son yazan kazanır).
- **Betik:** `d10_akis.py` (W9)
- **İlgili kod:** `src/main.ts` içinde `storage` olayı dinlenmiyor (`grep addEventListener("storage"` boş). `saveDoc` koşulsuz üzerine yazıyor.
- **Öneri:**
  - `window.addEventListener("storage")` ile başka pencerenin yazdığı fark edilsin ("Bu belge başka bir pencerede değişti — yeniden yükle / bu pencerenin sürümünü koru").
  - Ya da `BroadcastChannel` + belge başına kilit kullanılsın.

#### ✅ D10-7 · Sayfa yenilendikten sonra belge sekmeleri çubuğu görünmüyor
- **Önem:** Orta · **Tür:** Hata (veri var ama görünmüyor)
- **SolidWorks:** Açık belgeler pencere listesinde her zaman görünür.
- **Bizde:**
  1. Hazır blok "T" → Yeni parça → çubukta 2 sekme.
  2. Yenile → çubuk boş (`#doctabs` içi 0 karakter). Kullanıcı "T" belgesini kaybolmuş sanar.
  3. Dosya yöneticisinde "Açık belgeler (2)" görünüyor. Herhangi bir belge değişikliği ya da yöneticide "Geç" çubuğu yeniden çiziyor.
  - W2'de 3 sekme açıkken de yenilemeden sonra çubuk boştu.
- **Betik:** `d10_dosya.py` (sekme), `d10_akis.py` (W2)
- **İlgili kod:** Başlangıç bloğu (`src/main.ts:8501-8521`) `renderDocTabs()` çağırmıyor. `afterDocChange` çağırıyor ama başlangıçta çalışmıyor.
- **Öneri:** Başlangıçta `renderDocTabs()` çağrılsın.

#### ✅ D10-8 · Telefonda Dosya listesi ekrana sığmıyor ve kaydırılamıyor: Kalem / dokunmatik ayarlarına ulaşılamıyor
- **Önem:** Orta · **Tür:** Hata (telefonda işlev erişilemez)
- **SolidWorks:** – (mobil yok). Beklenen: tüm menü öğeleri dokunulabilir olmalı.
- **Bizde:**
  - 390×844'te ☰ Dosya listesi 66 → 995 px uzanıyor. `overflow` görünür, `max-height` yok, gövde `overflow: hidden`.
  - Şu dört öğe ekran dışında: "Tekerlek…", "Klavye ve fare kısayolları…", "Kalem ve dokunmatik ayarları…", "Başlangıç rehberi…". Parmakla yukarı kaydırma denendi, öğe 913 px'te kaldı.
  - Telefonda menü çubuğu da yok. Bu yüzden **giriş ayarlarına (kalem profili, imleç kayması, dokunmatik fare, sol el, büyüteç) telefonda hiçbir yoldan ulaşılamıyor.** Yardım metni ise kullanıcıyı tam bu öğeye yönlendiriyor.
  - Masaüstü 1400×900'de de son 3 öğe ekran dışında. Masaüstünde menü çubuğunda karşılıkları var.
- **Betik:** `d10_telefon.py`, `d10_telefon2.py` (dosya), `d10_diger.py` (globals). Ekran görüntüsü: `d10_tel_dosya.png`
- **İlgili kod:** `index.html` `#file-menu` + stil (`.popover`), `max-height` / `overflow-y: auto` eksik.
- **Öneri:** `#file-menu { max-height: calc(100dvh - top - 8px); overflow-y: auto }`. Telefonda ayarlar ekran çubuğu ☰ menüsüne de eklensin.

#### ✅ D10-9 · Telefon ve tablette iki belge açıkken sekme çubuğu görünüm çubuğunu ve küpün üstünü örtüyor
- **Önem:** Orta · **Tür:** Arayüz (dokunulamayan düğmeler)
- **SolidWorks:** –
- **Bizde:**
  1. Telefon ya da tablet → Dosya › Yeni → `#doctabs` (y 89–116) görünüm çubuğunun (y 97–133) üstüne biniyor.
  2. "Normal görünüm", "Ekrana sığdır" ve "Düzlemleri göster/gizle" düğmelerinin ortası `doctabs`a düşüyor, dokunulamıyor.
  3. Küpün üst yüzü de sekmelerin altında kalıyor.
  - Masaüstünde (1400×900) çakışma yok.
- **Betik:** `d10_telefon.py` (2 sekme / ağaç açık / montaj durumları). Ekran görüntüsü: `d10_2tab_tel.png`
- **İlgili kod:** `#doctabs` / `#viewbar` / `.vcube` mobil konumları (`style.css`).
- **Öneri:** Sekmeler açıkken görünüm çubuğu ve küp sekme yüksekliği kadar aşağı alınsın. Ya da telefonda sekmeler başlığa / Dosya listesine taşınsın.

#### ✅ D10-10 · Dokunmatikte bağlam mini çubuğu kapanmıyor ve ekran çubuğu düğmesini örtüyor
- **Önem:** Orta · **Tür:** Arayüz
- **SolidWorks:** Bağlam araç çubuğu imleç uzaklaşınca kaybolur (fare).
- **Bizde:**
  - Telefonda modelin ortasındaki yüze dokununca mini çubuk (Eskiz / Normal / Delik / Kabuk / Diğerini seç) çıkıyor. 6 saniye sonra hâlâ açık.
  - Ekran çubuğundaki ✚ (Şekil sihirbazı) düğmesinin ortası mini çubuğa düşüyor. Playwright `tap` "minibar intercepts pointer events" ile 30 saniye boyunca başarısız oldu. Kullanıcı önce boşluğa dokunmak zorunda.
  - Aynı anda aday çubuğu ("Diğer adaylar: Ön Düzlem") ↶ düğmesine değiyor.
- **Betik:** `d10_telefon.py`. Ekran görüntüsü: `d10_tel_parca.png`
- **İlgili kod:** `src/main.ts:1578-1606` `showMiniBar`. Kapanma yalnız `pointermove` uzaklığıyla; dokunmatikte `pointermove` gelmiyor ve zaman aşımı yok. Konum `x+14, y−52` ekran çubuğuyla kesişebiliyor.
- **Öneri:**
  - Dokunmatik girişte 3–4 saniyelik zaman aşımı eklensin.
  - Konum ekran çubuğunun (`.actbar`) ve tepsinin dikdörtgeninden kaçınsın.
  - Ya da dokunmatikte mini çubuk ekran çubuğunun yanına sabitlensin.

#### ✅ D10-11 · Model ve ağaç sağ tık (uzun basma) menüsünde özellik işlemleri yok
- **Önem:** Orta · **Tür:** SolidWorks'ten farklı
- **SolidWorks:** Yüze sağ tık → sahibi özellik için Özelliği Düzenle, Eskizi Düzenle, Bastır, Gizle, Sil, Ebeveyn/Çocuk, Görünüm. Ağaçta sağ tıkta da aynı liste.
- **Bizde:**
  - **Üst yüze sağ tık:** Dik, Eskiz, Ekstrüzyon, Ekstrüzyon kesme, Bitiş koşulunu değiştir…, Yüz rengi, Parça rengi, Sığdır, İzometrik, Önceki görünüm. Sahibi özellik için düzenle / eskizi düzenle / bastır / sil yok.
  - **Ağaçta Ekstrüzyon1'e sağ tık:** Özelliği düzenle, Ekstrüzyon, Ekstrüzyon kesme, Parça rengi, Sığdır, İzometrik, Önceki görünüm. Eskizi düzenle, Bastır, Sil, Adlandır, Klasöre ekle yok. Bunlar yalnız ağacın altındaki düğmelerde.
  - Telefonda tek bağlam yolu uzun basma olduğu için bu işlemlere modelden ulaşılamıyor.
  - İlgili: A-23.
- **Betik:** `d10_secim.py` (sagtik)
- **İlgili kod:** `src/main.ts:7544-7614` `openContextMenu` (parça kolu). `kernel.faceOwner` zaten var (kırıntılar kullanıyor).
- **Öneri:** Yüz sağ tıkında `faceOwner` ile sahibi özellik bulunup `renderTreeActions` eylemleri eklensin. Ağaç sağ tıkı `renderTreeActions` listesini kullansın.

#### ✅ D10-12 · Ağaç işlemleri geometrik bağımlılığı bilmiyor (silme onayı, ebeveyn/çocuk, sıralama)
- **Önem:** Orta · **Tür:** Hata / SolidWorks'ten farklı
- **SolidWorks:**
  - Silerken "Alt özellikleri de sil" listesi gösterilir.
  - Ebeveyn/Çocuk tüm bağımlılıkları gösterir.
  - Bir özellik ebeveyninin üstüne sürüklenemez.
- **Bizde (hazır blok + üst ön kenara gerçek tıklamayla R5 radyüs, 95570,8):**
  - **Sil:** Ekstrüzyon1 › Sil. Onay yalnız "Ekstrüzyon1 silinsin mi?" + "Kullandığı eskiz(ler) de silinsin mi?" diyor. Silince Radyüs1 hatalı (kırmızı) kalıyor ve onaydan haberi olmuyor.
  - **Ebeveyn/çocuk:** Ekstrüzyon1 için "Çocuk: —". Radyüs ondan türediği halde gösterilmiyor.
  - **Sıralama:** KenarR (radyüs) ▲ Yukarı → Ekstrüzyon1'in üstüne taşınabildi (sıra Eskiz1, KenarR, Ekstrüzyon1). KenarR hata verdi. Sürükle-bırak da aynı denetimi kullanıyor.
- **Betik:** `d10_secim.py` (agac)
- **İlgili kod:**
  - `src/main.ts:6256-6264` `parentsOf`: yalnız eskiz / yol / düzlem / feats. Kenar ve yüz referansları (`edges`, `faces`) sayılmıyor.
  - `orderOk` (6266) ve `deleteFeature` (≈6400) bunu kullanıyor.
- **Öneri:** Kenar / yüz referanslı özellikler için ebeveyn = başvurulan geometriyi oluşturan önceki özellikler (en azından "kendinden önceki ilk katı özellik") sayılsın. Silme onayı etkilenecek sonraki özellikleri listelesin.

#### ✅ D10-13 · Onaylanmamış eskiz düzenlemesi, yenileme / sekme kapatma ("Ayrıl") sonrası kalıcı oluyor
- **Önem:** Orta · **Tür:** Tutarsızlık
- **SolidWorks:** Kaydedilmemiş eskiz düzenlemesi, uygulama kapatılınca (kaydetmeden çık seçilirse) kaybolur. ✕ ile aynı sonuç.
- **Bizde:**
  1. Hazır blok → Eskizi düzenle → ölçü 80 → 90 (✓ yok).
  2. Yenile → tarayıcı "kaydedilmemiş değişiklikler" (beforeunload) sorar → Ayrıl.
  3. Açılışta genişlik 90, hacim 108000. Değişiklik onaylanmadan modele girdi.
  - Aynı değişiklik ✕ → Kaydetmeden çık ile atılıyor (80). Uyarı metni de "kaydedilmemiş değişiklikler var" diyordu.
- **Betik:** `d10_geri.py` (eskizyenile)
- **İlgili kod:** `src/main.ts:1667-1669` + `1693-1697`. Düzenleyici `changed` → `saveDocSoon()`. Düzenleyici verisi belge özelliğinin kendisi (`f.data`, v0.84 `putData`) olduğu için 400 ms sonra localStorage'a yazılıyor.
- **Öneri:** Eskiz açıkken kayıtta `f.data` yerine `orig` kullanılsın (ya da ayrı bir "kurtarma" anahtarına yazılıp açılışta "kaydedilmemiş eskiz bulundu — geri yükle?" sorulsun).

#### ✅ D10-14 · Parça modunda Düzen › Kopyala / Yapıştır / Tümünü seç hiçbir şey yapmıyor
- **Önem:** Düşük · **Tür:** Eksik
- **SolidWorks:** Ctrl+C ile seçili eskiz / özellik kopyalanır, bir yüze Ctrl+V ile yapıştırılır.
- **Bizde:** Ağaçta Eskiz1 seçili → Düzen › Kopyala → Düzen › Yapıştır: özellik sayısı 2 → 2, ileti yok. Menü öğeleri etkin görünüyor.
- **Betik:** `d10_menu.py`
- **İlgili kod:** `src/main.ts` `fixedActs()` `e.copy` / `e.paste` / `e.selall` yalnız `sk()?.…`
- **Öneri:** Parça modunda bu öğeler gri gösterilsin ya da en azından "Eskiz içinde çalışır" iletisi verilsin. İleride eskiz kopyala → seçili yüze yapıştır.

#### ✅ D10-15 · "İzometrik" gerçek izometrik değil
- **Önem:** Düşük · **Tür:** SolidWorks'ten farklı
- **SolidWorks:** İzometrik bakış (1, 1, 1) yönüdür: üç eksen eşit kısalır, 35,26° yükselme.
- **Bizde:**
  - Ctrl+7, menü, küp "İzo" ve sağ tık İzometrik hepsi (0,612, 0,502, 0,612) yönünü veriyor (≈30° yükselme).
  - Küpün köşe hücresi ise gerçek (0,577, 0,577, 0,577) yönünü veriyor. Aynı ada iki farklı görünüm çıkıyor.
- **Betik:** `d10_menu.py`, `d10_gezinme.py`
- **İlgili kod:** `src/viewer.ts:612` `iso: [V(1, 0.82, 1), …]`
- **Öneri:** `V(1, 1, 1)`. Önceki görünüm isteniyorsa ayrı bir "Dimetrik" seçeneği olsun.

#### ✅ D10-16 · Görünüm küpünde yüzün ortasından geçen tıklanmayan çapraz çizgi
- **Önem:** Düşük · **Tür:** Arayüz
- **SolidWorks:** –
- **Bizde:**
  - İzometrikte küpün üst bölgesi 2 px aralıklarla tarandı. 13/778 noktada `elementFromPoint` hücre değil kap (`.cube`) döndürüyor. Bu noktalar (324,180)…(352,194) ile çapraz bir çizgi oluşturuyor.
  - Çizgi tam "Üst" yazısının ortasından geçiyor. (349,192)'ye tık görünümü değiştirmedi. Bitişik hücreye tık doğru (0, 1, 0).
- **Betik:** `d10_gezinme.py` (kup)
- **İlgili kod:** `src/main.ts:8218-8250`. 3B dönüşümlü 3×3 hücreler arasında yarım piksel boşluk; tıklama `.cell` öğesine bağlı.
- **Öneri:** Hücrelere 0,5 px taşma / `outline` verilsin. Ya da tıklama `.cube` üzerinde ele alınıp en yakın hücre bulunsun.

#### ✅ D10-17 · Görüntü stili ve düzlem görünürlüğü yenilemede saklanmıyor
- **Önem:** Düşük · **Tür:** Eksik
- **SolidWorks:** Görüntü durumu belgeyle birlikte saklanır.
- **Bizde:**
  - Görünüm › Görüntü stili › Tel kafes → yenile → "Kenarlı gölgeli".
  - Görünüm çubuğu › Düzlemleri gizle → yenile → düzlemler görünür.
  - Perspektif ise saklanıyor (`imajcad.persp`), tutarsız.
- **Betik:** `d10_gezinme.py` (cubuk)
- **İlgili kod:** `viewer.setStyle` / `planesOn` (`src/main.ts:1041`) kaydedilmiyor.
- **Öneri:** `doc.view {style, planes}` ya da `imajcad.view` olarak saklansın.

#### ✅ D10-18 · "Şeridi özelleştir" ve "Görev bölmesi" hiçbir menüde yok; telefonda erişilemez
- **Önem:** Düşük · **Tür:** Eksik
- **SolidWorks:** Araçlar › Özelleştir ve şeride sağ tık (A-14).
- **Bizde:**
  - Araçlar ve Görünüm menülerinde yoklar. Yalnız komut aramada ("şeridi") bulunuyor.
  - "şerit" yazınca sonuç yok: kök "şerid-" ile eşleşmiyor.
  - Telefonda komut arama da gizli olduğundan ikisine de hiç ulaşılamıyor.
- **Betik:** `d10_kisayol.py` (arama)
- **İlgili kod:** `src/main.ts` `MENUS` (Araçlar: `t.custom, t.print, t.input, t.wheel`). `t.ribbon`, `t.taskpane` eklenmemiş.
- **Öneri:** Araçlar menüsüne ve telefonda ☰ listesine eklensin. Komut arama Türkçe kök eşlemesi yapsın (ya da etiket + eş anlamlılar).

#### ✅ D10-19 · Belge sekmesi kapatma: her durumda tarayıcı `confirm` penceresi, "Kaydet" seçeneği yok
- **Önem:** Düşük · **Tür:** SolidWorks'ten farklı
- **SolidWorks:** Kapatırken yalnız değişmiş belgede "Kaydet / Kaydetme / İptal" sorulur.
- **Bizde:**
  - Hiç değişmemiş boş "Parça2" sekmesinde de "(Kaydedilmemiş değişiklikler kaybolur)" yazan `confirm` çıkıyor. Değişmiş belgede kaydetme seçeneği yok.
  - Kapanan, hiç dosyaya kaydedilmemiş belge son belgelere de eklenmiyor, yani geri getirilemiyor.
- **Betik:** `d10_dosya.py` (sekme)
- **İlgili kod:** `src/main.ts:169-195` `closeTab`.
- **Öneri:** `askExit` benzeri 3 seçenekli pencere ("Kaydet ve kapat / Kaydetmeden kapat / Vazgeç"). Belge kayıttan beri değişmemişse sorulmasın. Kapanan belge `pushRecent` ile listeye konsun.

#### ✅ D10-20 · Kaydet / Farklı kaydet ad penceresinde "İptal" yine indiriyor
- **Önem:** Düşük · **Tür:** Hata
- **SolidWorks:** Farklı kaydet penceresinde İptal hiçbir şey yapmaz.
- **Bizde:**
  - Hazır blok → Dosya › Farklı kaydet… → ad penceresinde İptal → yine "T.icad" indirildi.
  - Ayrıca dosyaya iç alan `_named` yazılıyor (`["version","name","uid","_named"]`).
- **Betik:** `d10_dosya.py` (iptal: "Farklı kaydet ad penceresinde İptal → indirme yok" HATA, T.icad indirildi)
- **İlgili kod:** `src/main.ts:7194-7198`: `(prompt(...) || doc.name)`. İptalde `null || doc.name`.
- **Öneri:** `const n = prompt(...); if (n === null) return;`. `_named` dosyaya değil belleğe yazılsın.

#### ✅ D10-21 · Durum çubuğu inç modunda da "MMGS" gösteriyor
- **Önem:** Düşük · **Tür:** Hata (görsel)
- **SolidWorks:** Birim sistemi göstergesi seçili sistemi gösterir (IPS) ve tıklanınca değiştirilir.
- **Bizde:**
  - Dosya › Birim: mm ↔ inç → alanlar inç (0,7874 in), ama `#sb-units` hâlâ "MMGS".
  - Tıklama da etkisiz (A-13 hâlâ var).
- **Betik:** `d10_dosya.py` (ozellik), `d10_diger.py` (globals)
- **İlgili kod:** `index.html` `#sb-units` sabit metin. `setUnits` güncellemiyor.
- **Öneri:** Birim değişince "IPS" / "MMGS" yazılsın. Tıklanınca birim menüsü açılsın.

#### ✅ D10-22 · Bozuk localStorage kayıtları sessizce boş belge açtırıyor ya da menüleri ölü bırakıyor
- **Önem:** Düşük · **Tür:** Hata (sağlamlık)
- **SolidWorks:** –
- **Bizde:**
  - `imajcad.doc.v2` yarıda kesik (bozuk) → sessizce boş belge açılıyor, uyarı yok. Bozuk veri ilk kayıtta üzerine yazılıp kurtarılamaz hale geliyor.
  - `imajcad.recent` bozuk → Dosya › Son belgeler ve Dosya yöneticisi hiç açılmıyor (`pageerror: Expected property name…`). Kaydet de listeyi onarmıyor (`pushRecent` hatayı yutuyor).
  - `imajcad.techdraw` bozuk → Teknik resim açılmıyor.
  - `imajcad.keys` / `input` / `ribbon` / `tabs` bozukken açılış hatasız.
- **Betik:** `d10_dosya2.py` (bozuk)
- **İlgili kod:**
  - `src/main.ts:56-72` `loadDoc` (uyarı yok).
  - `src/main.ts:452`, `6815`, `7207`, `7237`, `7387`: korumasız `JSON.parse(localStorage…)`.
- **Öneri:**
  - Tüm okumalar `try`'a alınsın, bozuk değer silinsin.
  - Bozuk belge `imajcad.doc.bozuk` olarak yedeklenip kullanıcıya "Kayıtlı belge okunamadı — yedek indirildi" denilsin.

#### ✅ D10-23 · Telefon ve tablette yüz seçiliyken kırıntı çubuğu görünüm küpünün "Üst" yüzünü örtüyor
- **Önem:** Düşük · **Tür:** Arayüz
- **SolidWorks:** –
- **Bizde:** Telefonda / tablette bir yüze dokununca `#crumbs` ("T › Ekstrüzyon1 › Yüz (düz)") küpün üst yüzünün ortasının üstüne biniyor. `elementFromPoint` "Üst" hücresinde `crumb` döndürüyor. Diğer 5 yüz hücresi dokunulabilir.
- **Betik:** `d10_telefon.py`. Ekran görüntüsü: `d10_tel_parca.png`
- **İlgili kod:** `#crumbs` ve `.vcube` mobil konumu (`style.css`).
- **Öneri:** Mobilde kırıntılar küpün sağına ya da durum ipucunun yanına alınsın.

#### ✅ D10-24 · Telefonda ekran çubuğu kaydırmalı; ☰ ⤢ 🎤 görünür alanın dışında, kaydırınca ✓ başlığın altına giriyor
- **Önem:** Düşük · **Tür:** Arayüz (A-3 / A-22 ile ilgili, yeni yönü)
- **SolidWorks:** –
- **Bizde:**
  - 390×844'te eskizde `.actbar` y 100–311, `scrollHeight` 307 > `clientHeight` 211.
  - 10 düğmenin son üçü (☰ dairesel menü, ⤢ sığdır, 🎤 ses) görünmüyor ve kaydırma göstergesi yok.
  - Kaydırıldıktan sonra ✓ "Eskizden çık" başlık çubuğunun (`#file-btn`) altına düşüyor (merkez y=34).
  - Ayrıca PM ve eskizde ekran çubuğunun ✓'si görünüm çubuğunun "Düzlemleri göster" düğmesinin üstünde (A-3 hâlâ var; tablette de).
  - Düğme boyutları 46×20 – 46×27 (A-22 hâlâ var).
- **Betik:** `d10_telefon.py`. Ekran görüntüsü: `d10_tel_eskiz.png`
- **İlgili kod:** `renderActBar` (`src/main.ts:~7860`) + `.actbar` stil (`max-height`, `overflow:auto`).
- **Öneri:** Telefonda ekran çubuğu iki sütun ya da yatay alt şerit olsun. Görünüm çubuğu ekran çubuğunun solunda bitsin.

#### ✅ D10-25 · Aday çubuğu mod değişince kalıyor ve eskiz PM başlığının (✓) üstüne biniyor
- **Önem:** Düşük · **Tür:** Arayüz · **Doğrulama:** Kısmen (ekran görüntüsüyle; programla yeniden üretilemedi)
- **SolidWorks:** –
- **Bizde:**
  1. Telefonda modelde düzlemle örtüşen bir yere dokun → "Diğer adaylar: Ön Düzlem" çubuğu çıkar.
  2. 5 saniye içinde ağaçtan düzlem → Eskiz.
  3. Çubuk eskiz PM başlığının (Eskiz1 … ✓ ✕) üstünde kalıyor; ✓ görünmüyor (`d10_tel_eskiz.png`).
  - `d10_telefon2.py` (aday) eskiz açıkken yeni dokunuşta çubuk çıkmadığını doğruladı. Sorun yalnız modu değiştiren dokunuştan önce açılmış çubukta.
- **Betik:** `d10_telefon2.py` (aday). Ekran görüntüsü: `d10_tel_eskiz.png` (modele dokunduktan sonra ağaçtan Üst Düzlem › Eskiz)
- **İlgili kod:** `src/main.ts:1543-1575` `offerCandidates` (5 s zaman aşımı, mod değişiminde kaldırılmıyor).
- **Öneri:** `setMode` / `showPM` / `openSketch` sırasında `.cand-bar` kaldırılsın.

---

### Denendi – sorun yok (özet)

**Dosya ve iş akışı:**
- Kaydet içeriği her zaman günceldi. İlk kayıtta ad soruluyor, sonra sorulmuyor.
- Sahte tutamaçla iki sekmedeki iki dosyaya doğru yazılıyor. Farklı kaydet sonrası Ctrl+S yeni dosyaya yazıyor. Yenilemeden sonra tutamaç yok, Kaydet yeniden soruyor.
- Eskiz değişikliği sekme geçişinde korunuyor.
- PM / eskiz açık ve değişmişken yenilemede beforeunload uyarısı var; değişmemişte uyarı yok.
- Belge özellikleri, birim (inç alanı, 1 in = 25,4 mm, inçte eskiz ölçüsü) ve dosya yöneticisi çalışıyor.
- STEP / STL / 3MF / PDF / eskiz DXF / yüz DXF içerikleri modelle tutarlı. STEP ve STL içe aktarma hacmi kaynakla aynı.
- Bozuk ve eksik referanslı dosya açma güvenli.
- Montaj ile parça arasında geri al yığınları ayrı ve doğru. Sekme başına geri al yığını doğru.

**Gezinme ve kısayollar:**
- Orta tuş (v0.85), tekerlek, Ctrl+1–6, Boşluk menüsü, Shift+Z / Z, Ctrl+Shift+Z, G çalışıyor.
- Görünüm küpü yüz / kenar (45°) / köşe / sürükle çalışıyor.
- Bölgeye yakınlaştır, önceki görünüm, perspektif ve tam ekran (+ kilit) çalışıyor.
- Özelleştir: atama, çakışma onayı, kaldırma, varsayılanlar, 8 yön ve kalıcılık çalışıyor. Enter tekrarı, S çubuğu, komut arama, şerit sekmeleri, şerit gizleme / varsayılan (kalıcı) çalışıyor.

**Seçim ve ağaç:**
- Seçim (tık / Ctrl / kaldır / kenar / pencere / Alt), filtre, mini çubuk (masaüstü), kırıntılar çalışıyor.
- Ağaç: F2, çift tık, bastır / etkinleştir, geri sar / sona sar, klasör, sürükle-bırak, sil onayı ve Vazgeç çalışıyor.

**Rehber ve ayarlar:**
- İlk açılış rehberi (webdriver gizlenince) açılıyor, bir kez gösteriliyor. Profil seçimi ve giriş ayarları kalıcı.

**Telefon ve tablet:**
- Ekran çubuğunun her düğmesi çalışıyor (✕, filtre, ✚, 📷, Ctrl, ↶, ↷, ☰ dairesel menü 9 öğe, ⤢, 🎤 "elli" → 50).
- Tek parmak 100 px = 45,8°, iki parmak ×2,00, iki parmak kaydırma, 2 / 3 parmak geri / ileri al çalışıyor.
- Uzun basma → Eskiz çalışıyor.
- Tepsiden Dikdörtgen / Daire / Montaj; PM açıkken tepsi gizli.
- Dokunmatik fare (imleç görünür, dokunuş nokta koyar), büyüteç, kalem sonrası avuç reddi, aday çubuğu seçimi çalışıyor.
- Tablette Dosya listesi ekrana sığıyor. Pencereler ekrana sığıyor.

---


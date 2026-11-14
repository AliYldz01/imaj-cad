# İmaj CAD

Telefon, tablet ve bilgisayarda tarayıcıda çalışan, kurulabilir (PWA) 3D CAD uygulaması.
Hedef: makinenin başında ölçü alarak parçaları çizmek, montajlamak ve üretim çıktılarını
(STEP, sac açınımı DXF, profil kesim listesi, teknik resim) almak.

**Canlı sürüm:** https://aliyldz01.github.io/imaj-cad/

## v0.12 — Arayüz düzeni ve eskiz referansları

- Gruplu komut çubuğu, tam ekran, imleç geri bildirimi, model yüzü kenarlarına yakalama ve ölçü, orta nokta / merkez uyandırma
- v0.37: **Montaj–parça bağı** — parça değişince montaj ve aynı parçanın tüm örnekleri güncellenir, eşleşmeler yeni deliği/yüzü izler (bulunamazsa ⚠); çarpışma algılama gerçek geometriyle
- v0.38: **Montaj Kesme / Delik** (montajda birlikte delme, parça dosyası değişmez) ve **Delik Hizalama** raporu
- v0.39: **Teknik Resim** — parça resmi (ön/üst/sol, izometrik, kesit A-A, otomatik ölçüler, antet; PDF/SVG/DXF) ve montaj resmi (balonlar + malzeme listesi)
- v0.40: **Hız ve dosya** — yalnız değişen özellikten sonrası yeniden hesaplanır; delik konumları eskizle ölçülendirilebilir; aynı dosyaya kaydet, Farklı kaydet, Son belgeler
- v0.41: **Helis/yay** süpürmesi, loft **profile dik** kısıtı, referans eksen (silindir / iki düzlem / iki nokta), **Yapılandırmalar** (tasarım tablosu)
- v0.42: Eskize **DXF içe aktarma** (elde olan DXF çizimini modele çevirme)
- v0.43: **Parça / yüz rengi** (sağ tık > Görünüm) ve **STL içe aktarma**
- v0.44: Süpürmede **burulma** ve **kılavuz eğri**; kenar/yüz kaybolunca **Yeniden seç** penceresi
- v0.45: Sac **büküm tablosu** (açıya göre) ve **Yüz Taşı / Sil** (doğrudan düzenleme)
- v0.46: **Yüzey modelleme** — yüzey ekstrüzyon, düzlemsel yüzey, kalınlaştır, yüzeyle kes
- v0.47: Kaynaklı yapıda **köşe başına işlem**, **mm ↔ inç** birim seçimi
- v0.48: **Perspektif görünüm** (Görünüm menüsü)
- v0.49: Değerlendir > Mukavemet — kiriş kabulüyle gerilme, sehim, güvenlik katsayısı.
- v0.50: Kenar flanşında yamuk profil; Sac Metal > Aç/Katla Kes (açınım ölçüsüyle çizilen kesim katlı parçaya uygulanır).
- v0.51: Dış diş ~2× hızlı; Diş'te "Kozmetik diş" seçeneği (anında, geometri yok).
- v0.52: Yüzey Loft ve Sınır Doldur (kenarlardan eğri yüzey).
- v0.53: Yüzey Kırp ve Yüzey Dik (kapalı yüzeylerden katı).
- v0.54: Teknik resimde ölçüleri sürükleme, Detay B, 2. sayfa ve montajda patlatılmış görünüş.
- v0.55: Dairenin üst/alt/sol/sağ noktasından verilen ölçüler çap değişince kaymıyor.
- v0.56: Fazla ölçü verince SolidWorks gibi "Gereksiz ölçü" uyarısı; istenirse sürülen ölçü olarak eklenir.
- v0.57: Montajda paneller ✕ / Esc ile kapanıyor; Geri al artık montajı geri alıyor; Delete ve sağ tık bileşen menüsü; telefonda ✕ düğmesi açıkta.
- v0.58: Montajda telefonda bileşen parmakla sürüklenir; Girişim paneli (liste + kırmızı girişim hacmi); kütle hesabı parçanın malzemesiyle; silindir kenarında yanlış köşe seçimi giderildi.
- v0.59: Montajda bileşen başına yapılandırma; Yol, Kam ve Yuva eşleşmeleri; Fiziksel dinamik (sürüklenen bileşen diğerini iter); Hareket etüdü videosu (WebM).
- v0.60: Orta tuşla döndürürken model imlecin altındaki nokta (köşe, yüz) etrafında döner; kenara orta tıklayıp sürükleyince o kenar etrafında döner (SolidWorks gibi).
- v0.61: Teknik resimde ölçü ekleme / düzenleme / silme ve toleranslar; yüzey pürüzlülüğü, geometrik tolerans ve referans sembolleri; görünüşler sürüklenerek taşınır; kaynaklı yapı resminde kesim listesi, balonlar ve kaynak listesi.
- v0.62: Eskizde radyüs/pah sonrası köşe ölçüsü korunur; daire ölçüsünde merkez / en yakın / en uzak; ayrı Taşı, Kopyala, Döndür, Ölçekle, Esnet; yüzden döngü ve silindir silüeti dönüştürme; delme ilişkisi; SketchXpert çözüm önerileri.
- v0.63: kanal ölçüleri, zincir ölçü, açı yakalama, eğrilik tarağı, metin yazı tipleri, eskiz düzlemini değiştir / türetilmiş eskiz.
- v0.64: blok düzenleme modu, eğri üzerinde metin, spline tutamakları, eşit eğrilik (spline–yay); eskiz metni artık konduğu noktada (önceden −x'e kayıyordu).
- v0.65: yüz radyüsü, yüz–yüz ve köşe pahı, kabukta farklı yüz kalınlığı, ayırma çizgisi konikliği, koniklik analizi.
- v0.66: çoğaltma referansa kadar / eskizi değiştir, takımla süpürerek kesme (düz / küresel uç).
- v0.67: loft bağlayıcıları ve komşu yüzlere teğet, yuva delik, yakın / uzak taraf havşası.
- v0.68: referans noktası türleri, ağaçta klasörler, Ne yanlış? penceresi ve geometri kontrolü, radyüs/pah/kabuk sarı önizleme.
- v0.69: flanş profili eskizi, oval / yırtma büküm boşaltması, dairesel köşe boşaltması, kaynaklı köşe.
- v0.70: sac şekillendirme araçları, havalandırma, çapraz kırma, sac köşe takviyesi.
- v0.71: kesim listesi özellikleri, yapı sistemi, 3B spline / helis / kesişim eğrisi ve 3B yol boyunca süpürme, özellikler arası gönye.
- v0.72: belge sekmeleri, dosya yöneticisi, belge özellikleri (ondalık, ANSI üçüncü açı), 3MF / PDF / eskiz ve yüz DXF, panel iğnesi, seçim kırıntıları, görev bölmesi, şerit özelleştirme.
- v0.73: desen güdümlü bileşen çoğaltma, bileşen bastırma.
- v0.74: ekstrüzyon panelinde derinlik oku, dokunuşta üst üste adaylar, sihirbaz eskizleri tam tanımlı, fotoğraftan kenar izleme, sesle ölçü girişi (🎤).
- v0.75: modele fotoğraf notu ekleme (📷), Bluetooth / klavye kumpasından ölçü girişi.
- v0.76: Statik Analiz (sonlu eleman): yüz sabitle, kuvvet / basınç, gerilme ve şekil değiştirme renkleri, güvenlik katsayısı.
- v0.77: gereksiz ölçüde 'Sürücü olarak bırak' seçeneği; eski testler ve belgeler temizlendi.
- v0.78: eşit eğri uzunluğu, eşit kanallar, çap ↔ yarıçap (D), çift mesafe (döndürme profilinde Ø).
- v0.79: ince özellikte iki yön, köşe radyüsü, uçları kapat; sacda normal kesim; modelde sağ tıkla bitiş koşulu.
- v0.80: kapalı ve ince loft, konik radyüs (rho), öteleme yüzü pahı, silindire teğet referans düzlem.
- v0.81: sac tırnak ve yuva, plastik dudak / yiv, mandal (snap hook).
- v0.82: eskiz radyüsünde 'gereksiz ölçü' hatası düzeltildi; yayın R ölçüsüne Akıllı Ölçü ile dokununca değeri düzenlenir.
- v0.83: Yeni arayüz (Kurumsal Şerit): İmaj logosu ve renkleri, gruplu şerit, telefonda komutlar alttaki tepside.
- v0.84: Ekstrüzyondan sonra eskiz düzenlenince değişikliğin kaybolması düzeltildi.
- v0.85: Orta tuşla döndürmede görüntünün kayması ve ekranda dönmesi düzeltildi.
- v0.86: denetim 2 Paket 1 — veri kaybı ve sessiz yanlış hataları düzeltildi (eskiz vazgeç geri alma, Değiştir kutusu, denklemler, sıfır derinlik kilidi, montaj kaydı, Farklı kaydet, depo dolu uyarısı).
- v0.87: denetim 2 Paket 2 — sessizce yanlış geometri üreten durumlar artık hata veriyor ya da doğru sonuç üretiyor (kabuk, ince kapak, kaburga, sarma, sac geçiş, Saca Dönüştür, kalınlaştır, statik analiz güncelliği).
- v0.88: denetim 2 Paket 3 — referanslar model değişince izliyor: ayna / referans düzlemleri, köşeler, mandal, analiz yüzleri, dönüştürülmüş eskiz kenarları, montaj eşleşmeleri ve teknik resim ölçüleri.
- v0.89: denetim 2 Paket 4 — telefonda dokunma: kırp / radyüs / ölçü dokunulan öğeye, eskizde parmakla sürükleme, 3 parmakla ileri al, ekran çubuğu ve görünüm çubuğu çakışmaları giderildi.
- **v0.90:** ikinci denetimin kalan bulguları (Paket 5 + 6) düzeltildi: eskiz blokları, gereksiz ilişki / ölçü, modele bağlı noktalar, 3B yol ile süpürme, denklem alanları, montaj desenleri, sekme / pencere güvenliği.
- **v0.91:** denetimlerin kalan bulguları: 3B eskizde geri al ve Esc, ötele / çoğalt ilişkileri, kabuk ve tam yuvarlak, bindirmeli sac köşesi açınımı, montaj resminde ölçü, sac resminde açınım sayfası, simetrik / kam eşleşmesi.
- **v0.92:** telefon yatay tutulunca yeni düzen: komutlar solda dar kolonda, ağaç ve özellik paneli sol çekmecede, çizim alanı ekranın %80'inden fazlası.
- **v0.93:** kaydırırken görünüm artık kendiliğinden ortalanmıyor; telefonda kısa iki parmak kaydırması geri al sayılmıyor.
- v0.36: **Kalıcı referanslar** — ekstrüzyon derinliği ya da eskiz ölçüsü değişince radyüs, pah, kabuk, kenar flanşı, diş seçtiğiniz kenarı/yüzü kaybetmez; eskizde Esc artık çıkış sormaz
- v0.35: Serbest Çizimde elips, yuvarlatılmış dikdörtgen ve çok daha bozuk çizilmiş kare/dikdörtgen tanınır (kare = eşit kenar); Esc / ✕ / geri tuşunda değişiklik varsa "Çıkmak istediğinize emin misiniz?" sorulur
- v0.34: **Serbest Çizim** — eskizde basılı tutup kabaca çizin, bırakmadan bekleyin: çizim çizgi / yay / daire / çokgen / serbest eğriye dönüşür; uçlar birleşir, yatay-dikey-dik ilişkileri kendiliğinden verilir (fare, kalem, parmak)
- v0.33.1: Montaj çözücüsü gerçek ölçekte ve döndürülmüş parçalarda güvenilir (ölçekli artıklar, öteleme öncelikli sönüm, dönme adım sınırı; 135 eşleşme kombinasyonu × rastgele başlangıç hatasız); eş merkezli/paralel hizalama, dairesel kenar–yüz çakışık, mesafede taraf korunur, içten teğet; ön seçim vurgusu (yüz turuncu + sınır, kenar, köşe) montajda ve parçada
- v0.33: Montaj ekleri: montaj ve bileşen ana düzlemleri/orijin ile eşleşme, alt montaj (rijit/esnek, oluştur, ekle, dağıt, kaydet), bileşen değiştir, eşleşmeleriyle kopyala, bağlam içinde parça düzenleme, bağlantı elemanları (cıvata/somun/pul), profil merkezi ve üniversal mafsal eşleşmeleri, MateXpert, boşluk doğrulama, montaj kesiti, hareket etüdü (döner/doğrusal motor)
- v0.32.1: 3B eskiz Akıllı Ölçü: ölçü çizgileri, uzatma çizgileri, oklar, açı yayı, yarıçap/çap kılavuzu; imleci izleyen önizleme ve yerleştirme; nokta–çizgi, paralel çizgi, nokta–yay merkezi mesafesi, çap (D); açı yerleştirildiği bölgeye göre; fazlalık/çelişen ölçü → sürülen (referans) ölçü; ölçüyü tek tık seç / çift tık düzenle / sürükle / Delete
- v0.32: Montaj SolidWorks mantığıyla yenilendi: eşzamanlı eşleşme çözücüsü, eşleşmelere uyarak sürükleme/döndürme, aşırı tanım reddi, eşleşme paneli (Standart/Gelişmiş/Mekanik, canlı önizleme), düzenle/bastır/çevir; simetrik, genişlik, limit açı, bağlayıcı, menteşe, dişli, kremayer, vida; kenar/köşe seçimi, SmartMates, bileşen aynala, patlatma adımları, kütle özellikleri
- v0.31: Yapı elemanında grup başına profil (tek özellikte çerçeve, ayak, kuşak farklı profillerle; birleşimler otomatik); ayrı yapı elemanı özellikleri arasında otomatik kırp/uzat (T, ters T, köşe)
- v0.30.3: Profili konumlandır: içi boş profillerde 17 delme noktası (merkez + dış sınırın 8 + iç sınırın 8 noktası; iç noktalar yeşil)
- v0.30.2: 3B eskiz ilişki çubuğu düzeltildi (başlıklı, gruplu, okunur düğmeler; imlecin üstünde açılır, ikinci seçimi örtmez); panelde Araç seçici ve ilişki listesi düzenlendi
- v0.30.1: Sağ tık > Dik (Normal To): düzleme / düz yüze (grafik alanda veya ağaçta) karşıdan bakar, ikinci basışta arka taraftan; sağ tık imleç altındaki öğeyi seçer
- v0.30: Bilgisayarda SolidWorks düzeni: menü çubuğu (Dosya/Düzen/Görünüm/Ekle/Araçlar/Yardım), komut arama, altta sekmeli büyük komut şeridi, görünüm araç çubuğu (bölgeye yakınlaştır, önceki görünüm, kesit, yön), özellik yöneticisi açıkken grafik alanda açılır ağaç, durum çubuğu; tam ekran Esc kilidi 🔒; özelleştirilebilir klavye kısayolları ve 4/8 yönlü fare hareketleri (yazdırılabilir liste), G büyüteç, F5/F9/F11
- v0.29: Bitişik kenar flanşlarında otomatik dikdörtgen köşe boşaltması (malzeme içte/dışta/büküm dışı): açınımda bükümler köşede birbirine geçmiyor
- v0.28: Sac açınımında bitişik bükümlerin büküm çizgileri artık kendi büküm bölgesinde (köşedeki gönye sınırında) bitiyor; komşu bükümün alanına taşmıyor
- v0.27: Eskiz radyüsü düzeltmesi: kırpmadan kalan aynı yerdeki ayrı noktalar ve çakışık ilişkili köşeler birleştirilir; çizgi–yay ve yay–yay köşelerine de radyüs verilir; yapı çizgileri köşe sayısına katılmaz; açıklayıcı uyarılar
- v0.26: 3B eskizde 2B gibi otomatik ilişkiler: orijine/model köşesine yakalanan nokta sabitlenir, kapanan çizgi dahil eksen ilişkileri, mavi hizalamayla konan noktaya nokta hizalama ilişkisi (≡X/≡Y/≡Z) → orijinden çizilen kare 2 ölçüyle tam tanımlı
- v0.25: Kırpma düzeltmeleri: teğet noktaları artık her zaman kesişim sayılır (çözücü hatasına dayanıklı), aynı noktadaki kesişimler teklenir, tek kesişimli daire silinmez (uyarı), ortadan kırpılan çizgi parçaları doğrusal kalır ve teğet ilişkisi doğru parçaya geçer, bölünen yaylar eş yarıçaplı kalır
- v0.24: 2B: düz çizilen çizgiler (noktaya kapanan dahil) otomatik yatay/dikey, mavi hizalama ile konan noktaya hizalama ilişkisi → kare 2 ölçüyle tam tanımlı; 3B: üst çubukta 3B araçlar, seçince yanında ilişki/ölçü çubuğu, eksen boyunca hizalama çıkarımı (diğer noktanın hizasına yakalanır)
- v0.23: Çizim araçları yalnız eskiz modunda (eskize Eskiz + düzlem/yüz seçimiyle girilir, araçlar dışarıda soluk); merkez dikdörtgen ötelemesi düzeldi (yapı köşegenleri ötelenmez); telefon/kalemde yakalama türü çizim noktasının yanında simgeyle gösterilir; 3B eskizde çizgi/yay üzerine yakalama ("Üzerinde" ilişkisi); üst kenarlar radyüslendikten sonra düşey kenar radyüsü (eşit/büyük yarıçapta da) çalışır
- v0.22.1: Düzlemsel profil zincirlerinde (ör. ters U çerçeve) tüm elemanların profil yönü zincir düzlemine göre aynı; köşelerde profiller doğru buluşur
- v0.22: 3B eskizde **yay** (3 nokta), **eskiz radyüsü**, **teğet** ilişkisi, **yarıçap** ölçüsü, **kırp / uzat**, **ayna**, 3B ölçülerin **denklemlere** bağlanması; yapı elemanı yay boyunca; gruplar arası **kırpma önceliği**
- v0.21: **3B eskiz 2B gibi**: Dikdörtgen, Nokta, Seç, Akıllı Ölçü (boy, mesafe, açı), ilişkiler (X/Y/Z boyunca, düzleme paralel, paralel, dik, eşit, doğrusal, sabitle, çakışık, orta nokta, üzerinde), 3B kısıt çözücü, tam tanımlı göstergesi, ölçü etiketleri; profillerde **ayakların otomatik dönmesi** ve **X kesişimlerin** otomatik çözümü
- v0.20: **Akıllı profil birleşimleri**: ters yönde çizilmiş çizgilerde L/U kanatları artık köşede ters dönmüyor (gönye yüzleri tam oturur), **T birleşimleri**, **gruplar arası köşeler** ve **3+ elemanlı köşeler** (ayak + çerçeve) otomatik çözülür; tüm profillerde (L, U, IPE/HEA/HEB, kutu, boru, lama) girişimsiz
- v0.19.1: "Profili konumlandır" penceresi telefonda ve bilgisayarda büyük (ekran genişliğine uyar), noktalar büyük ve parmakla dokunulabilir, geçerli delme noktası turuncu
- v0.19: Yapı elemanı **grupları** (her grup ayrı delme noktası/döndürme/köşe işlemi), **Alignment** (profil eksenini X/Y/Z veya kenara hizala), **profili konumlandır** (profil resminde noktaya dokun), 3B eskizde **nokta sürükleme** + X/Y/Z boyunca ilişkisinin korunması, **Ctrl + yüz** ile 3B eksen hizalama
- v0.18: **3B eskiz SolidWorks gibi**: grafik alanda tıklayarak çizim, Tab ile XY/YZ/ZX, uzay tutamacı, X/Y/Z eksen çıkarımı, rakamla uzunluk, çift tık/Esc bitir, çizgi uzunluğu düzenleme; **profil yönü düzeltildi** (dikey eksen yukarı / eskiz normali); yapı elemanında segmentlere grafik alanda tıklayarak seçim. Rapor: `docs/arsiv/3B_ESKIZ_RAPORU.md`
- v0.17: Montaj ekleri — teğet ve limit mesafe eşleşmesi, Ctrl ile iki yüz seçince eşleşme mini çubuğu, sürüklerken çarpışma algılama, doğrusal/dairesel bileşen çoğaltma
- v0.16: **Montaj** — bileşen ekleme, eşleşmeler (çakışık, paralel, dik, mesafe, açı, eş merkezli, kilit), sürükleme, girişim, patlatma, malzeme listesi, STEP montaj, parça kütüphanesi
- v0.15: büküm payı/düşümü, kalınlık tablosu, huni (geçiş parçası) ve açınımı, köşe kır, delme noktası ötelemesi
- v0.14: dairesel süpürme, örnek atla, dışa kabuk, çoklu yarıçap, görüntü stilleri, Instant3D, hızlı yakalama, güç kırpma
- v0.13: Paket A — seçili konturlar, paylaşılan eskiz, ekstrüzyon başlangıç/bitiş/yön seçenekleri, 7 düzlem türü, canlı ölçü, ağaç sıralama, kutu seçim, diğerini seç, mini çubuk
- v0.12.3: yakalama türü imleç simgesiyle gösterilir (yazı yok)
- v0.12.2: Akıllı Ölçü'de orta nokta, çeyrek, merkez ve model noktaları seçilebilir
- v0.12.1: dikdörtgen merkezine ve model kenarı üzerine yakalama
- v0.11: şekil sihirbazı, sayıyla çizim, dokunmatik fare, ekstrüzyon önerisi

## v0.10 — Telefon ve tablet kontrolleri

- **Kalem profilleri:** otomatik algılama; S Pen / Apple Pencil gibi havada imleç gösteren kalemler, imleçsiz aktif kalemler, basit kapasitif kalem ve yalnız parmak için ayrı davranış (Dosya › Kalem ve dokunmatik ayarları)
- **Hassas çizim:** dokun–ayarla–kaldırınca yerleştir, büyüteç, parmakla çizimde imleç kayması, yakalamada titreşim
- **Hareketler:** avuç reddi, kalem yan tuşu = sağ tuş, uzun basma menüsü, iki/üç parmak dokunuşu geri/ileri al, iki parmakla yuvarlama
- **Ekran:** ekran çubuğu, dairesel araç menüsü, görünüm küpü, küçültülebilir alt panel, solak düzeni

## v0.9 — Bilgisayarda SolidWorks ile aynı kullanım

- **Fare ve klavye:** SolidWorks varsayılan fare tuşları, tekerlek yönü, fare hareketleri, bağlam menüsü ve kısayollar (Ctrl+1…8, Boşluk, F, Z, S, Enter, A, Ctrl+B …)
- **Eskiz çıkarımı:** uç/orta/merkez/çeyrek/kesişim yakalama, uyandırılan noktalardan hizalama çizgileri, dik/doğrusal/teğet çıkarımı, Ctrl ile kapatma
- **Çizim ve seçim:** çizgi→yay otomatik geçişi, pencere/kesişen seçim, Ctrl ile çoklu seçim, ölçü Değiştir kutusunda tekerlekle artım

## v0.8 — Eskiz, katı ve sac metal eksikleri tamamlandı

Ayrıntılı özellik listesi ve sonraki adımlar: [docs/YOL_HARITASI.md](docs/YOL_HARITASI.md)

- **Parça belgesi:** Orijin, Ön / Üst / Sağ düzlem, FeatureManager ağacı (eskizler özelliğin altında), düzenle / bastır / sil, geri sarma çubuğu (araya özellik ekleme), çoklu gövde, global değişkenler ve denklemler, STEP içe aktarma
- **Eskiz:** çizgi, merkez çizgisi, köşe / merkez / 3 noktalı dikdörtgen, paralelkenar, daire, çevre dairesi, merkez / teğet / 3 noktalı yay, kanal, çokgen, nokta, eskiz radyüsü ve pahı, kırp, uzat, ötele, aynala, doğrusal / dairesel çoğaltma, taşı / kopyala / döndür, varlıkları dönüştür, kesişim eğrisi, ölçekle, merkez noktalı / yay kanal, elips, kısmi elips, parabol, spline, metin, yapı geometrisi
- **İlişkiler:** otomatik (yatay, dikey, çakışık, üzerinde, orta nokta, teğet) ve elle (paralel, dik, eşit, doğrudaş, eş merkezli, simetrik, sabit)
- **Akıllı ölçü:** uzunluk, yatay / dikey / hizalı mesafe, çap, yarıçap, açı, nokta–çizgi; referans (sürülen) ölçü, denklemli ölçü, tam tanımla, tanımlılık renkleri (mavi / siyah / kırmızı) ve serbestlik derecesi
- **Katı özellikler:** ekstrüzyon ve kesme (kör, tümünden geçen, sonrakine kadar, düz / eğri yüzeye kadar, yüzeyden ötele, orta düzlem, iki yön, koniklik, burulma, ince özellik), döndürme, süpürme, loft (merkez çizgili; hepsinin kesme türü), delik sihirbazı (ISO M3–M24, boru dişi G, inç UNC, kozmetik diş), radyüs (sabit, değişken, tam yuvarlak), pah (eşit, mesafe–mesafe, mesafe–açı), kabuk, koniklik, kaburga, kubbe, sarma (kabartma / oyma), ölçekle, doğrusal ve dairesel çoğaltma, ayna, referans düzlem / eksen / nokta / koordinat sistemi
- **Sac metal:** taban flanş (kapalı eskizden levha, açık eskizden bükümlü profil), kenar flanş (büküm açısı, dış/iç sanal keskin veya teğet uzunluk, malzeme içte/dışta/bükümün dışı, kenar kısaltma, birlikte seçilen kenarlarda köşe gönyesi, büküm boşaltma), açık/kapalı kenet, çizgiden büküm; sac kalınlığı, iç büküm yarıçapı ve K faktörü
- **Açınım:** düzleştir görünümü, levha ölçüsü, alan, ağırlık, büküm tablosu (yön, açı, yarıçap); sonradan açılan delik ve kesimler açınıma yansır; DXF çıktısı (KESIM, BUKUM_YUKARI, BUKUM_ASAGI, NOTLAR katmanları)
- **Kaynaklı yapı:** iskelet eskiz çizgileri ve yayları boyunca yapı elemanı; EN profil kütüphanesi (kare/dikdörtgen kutu, boru, eşit kollu L, UPN, IPE, HEA, HEB, lama, yuvarlak ve kare dolu çubuk); delme noktası, döndürme, aynalama; gönye ve alın köşe işlemleri; kırp/uzat (düz kesim veya profile göre koplama); uç kapağı; köşe takviyesi
- **3B eskiz:** yön düğmesi + uzunluk, göreli (Δ) ve mutlak koordinatla nokta ekleme, köşelere yakalama, köşe büküm yarıçapı (bükümlü boru / profil)
- **Kaynak dikişi:** a ölçüsüyle köşe kaynağı, boru–levha çevresel dikiş, kesikli kaynak; kaynak tablosu
- **Özel profiller:** eskizden profil (parametrik), cihaz kütüphanesi, dosyaya aktarma; kullanılan profil belgeye gömülür
- **İmalat resimleri:** her kalem için A4 sayfa (görünüşler, kesit, boy, uç açıları, delik konumları, antet); yazdır/PDF, SVG, levhalar için 1:1 DXF
- **Kesim listesi:** aynı profil, boy ve açılar gruplanır; adet, kesim boyu, uç açıları, ağırlık, profil başına toplam boy; CSV (Excel) çıktısı ve her kalem için ayrı STEP
- **v0.8 eskiz:** çizdikten sonra hızlı ölçü girişi, dinamik ayna, eskiz resmi (fotoğrafı iki noktayla ölçekleme), orta nokta çizgisi, 3N merkez dikdörtgen, konik, denklem eğrisi, ayır, kademe çizgisi, koordinat / yay uzunluğu / daire kenarı ölçüleri, eş yarıçaplı, eskizi onar, bloklar, kapalı bölge gölgesi
- **v0.8 katı:** birleştir, gövde böl/taşı/sil, girinti, eskiz/tablo/eğri/doldurma çoğaltma, helisel diş, esnet, köşe pahı, ekstrüzyon başlangıç ötelemesi, girişim kontrolü, kılavuz eğrili loft
- **v0.8 sac metal:** kademe, gönye flanş, köşe kapatma, katıdan saca dönüştür
- **Sınırlamalar:** esnet kesiti boyunca sabit gövdelerde çalışır; kılavuz eğrili loft iki profille ve çokgen kesitlerle yapılır; diş metrik 60° profildir
- **Değerlendir:** ölçme (uzunluk, çap, alan, mesafe, açı), kütle özellikleri ve malzeme, kesit görünüşü
- Düzlemsel yüze eskiz, STEP / STL dışa aktarma, `.icad` kaydet / aç, otomatik kayıt, çevrimdışı çalışma
- Kalem / fare çizer ve seçer; parmak döndürür, kaydırır ve yakınlaştırır

## Teknoloji (tamamı ücretsiz)

| Bileşen | Görev | Lisans |
|---|---|---|
| [Open CASCADE Technology](https://dev.opencascade.org) (WebAssembly) | Geometri çekirdeği | LGPL 2.1 + OCCT istisnası |
| [replicad](https://replicad.xyz) | OCCT için JavaScript arayüzü | MIT |
| [FreeCAD PlaneGCS](https://github.com/Salusoft89/planegcs) (WebAssembly) | Eskiz kısıt çözücüsü | LGPL |
| [three.js](https://threejs.org) | 3D görüntüleme | MIT |
| Vite + TypeScript | Derleme | MIT / Apache 2.0 |

OCCT ve PlaneGCS, uygulama koduna gömülmeden ayrı `.wasm` dosyaları olarak yüklenir.

## Geliştirme

```bash
npm install
npm run dev      # yerel geliştirme sunucusu
npm run build    # dist/ klasörüne üretim derlemesi
```

Yayın: `dist/` içeriği `gh-pages` dalına gönderilir ve GitHub Pages'te sunulur.

## Kod yapısı

- `src/main.ts` — uygulama: FeatureManager ağacı, komut sekmeleri, özellik panelleri, modlar
- `src/doc/` — belge modeli (`types.ts`), vektör/düzlem yardımcıları, özellikleri çekirdeğe derleme
- `src/sketch/` — eskiz düzenleyici, kısıt çözücü bağlantısı, eskiz verisi işlemleri, profil çıkarma
- `src/viewer.ts`, `src/nav.ts` — Three.js görüntüleme, seçim, gezinme
- `src/kernel.worker.ts` — OpenCascade çekirdeği (ayrı iş parçacığında)
- `public/sw.js` — çevrimdışı çalışma

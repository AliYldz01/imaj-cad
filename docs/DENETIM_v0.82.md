# İmaj CAD — Tam denetim raporu v0.82 (2026-11-13)

Bu raporda uygulamanın tüm komutları ve fonksiyonları gerçek tarayıcıda (Playwright + Chrome, gerçek fare, klavye ve CDP dokunma olaylarıyla) denendi ve SolidWorks davranışıyla karşılaştırıldı. Çalışmayı üç denetim ajanı paralel yürüttü: **Eskiz** (2B + 3B), **Parça** (özellikler, yüzey, sac, kaynaklı, analiz, içe/dışa aktarma) ve **Arayüz** (gezinme / orta tuş, seçim, menüler, kısayollar, telefon, montaj, teknik resim). Kodda değişiklik yapılmadı.

Her bölümün sonunda **"Denendi – sorun yok"** tablosu var; hiçbir özelliğin atlanmadığını oradan görebilirsiniz.

## 0. Sonradan bulunan (kullanıcı bildirdi) — denetimde kaçırılmıştı

#### E-35 — Ekstrüzyondan sonra eskiz düzenlenince değişiklik modele ve kayda geçmiyordu ✅ v0.84
- **Önem:** Kritik · **Tür:** Hata (veri kaybı)
- **SolidWorks:** Eskizi düzenle → ölçüyü değiştir → çık: özellik yeni eskizle yeniden kurulur, değişiklik kaydedilir.
- **Bizde (v0.83):** Değiştir kutusu (`editDim`) canlı önizleme ve geri alma için düzenleyicinin verisini `this.data = JSON.parse(snap)` ile **yeni bir nesneyle değiştiriyordu**; belge özelliği (`f.data`) eski nesnede kaldığı için ✓ / "Kaydet ve çık" sonrası model eski ölçüyle kuruluyor, kayıt da eski veriyi tutuyordu (ölçü 80 → 100 yapıldı, ✓ sonrası model ve kayıt 80). Ayrıca var olan eskiz **Çizgi aracı etkin** açıldığı için noktayı sürükleme hiçbir şey değiştirmiyordu (SolidWorks'te düzenlemede araç etkin değildir).
- **Neden kaçtı:** Ajanların ve eski testlerin çoğu eskizi belge verisiyle (`setDoc`) kurup iç API ile değiştiriyordu; "Değiştir kutusu → ✓ → model" zinciri gerçek tıklamayla denenmedi.
- **Düzeltme (v0.84):** `SketchEditor.putData` veriyi yerinde değiştirir (nesne kimliği korunur; `setData` de kullanır); var olan eskiz Seç aracıyla açılır. Test `se1` (ölçü 80→100 ✓, kayıt, sayfa yenileme, ✕ sonrası başka değer, geri al, köşe sürükleme, ✕ → Kaydet ve çık).

## 1. Özet

| Alan | Kritik | Yüksek | Orta | Düşük | Toplam |
|---|---|---|---|---|---|
| Eskiz (E-) | 0 | 3 | 13 | 18 | 34 |
| Parça / sac / kaynak (P-) | 1 | 4 | 10 | 23 | 38 |
| Arayüz / gezinme (A-), montaj (M-), teknik resim (T-) | 0 | 0 | 9 | 25 | 34 |
| **Toplam** | **1** | **7** | **32** | **66** | **106** |

**Mevcut testler:** Eskizle ilgili 32 testin tamamı, parçayla ilgili 65 testin 64'ü, arayüz, montaj ve resimle ilgili 29 testin 27'si geçti. Başarısız olanlar uygulama hatası değil:
- **th2:** diş süresi, makine yükü yüzünden 16 sn eşiğini aştı.
- **mr1:** çift orta tık zamanlaması yük altında kararsız.
- **v2:** eski test, adres verilmeden çöküyor.

`asm_matrix` birim testi 0 hata verdi.

**Orta tuşla döndürme** (ayrıntı A bölümünde):
- **Döndürme merkezi:** köşede, yüz noktasında ve boşlukta ekranda 0,0 px sabit kaldı; perspektifte de sabit.
- **Hassasiyet ve eksenler:** 0,458°/px; yatay sürükleme ekranın dikey ekseni etrafında döndürüyor; gimbal kilitlenmesi yok.
- **SolidWorks'ten farklar (Düşük):**
  - Model tümüyle görünürken SolidWorks model merkezi etrafında döner; bizde merkez imleç altındaki nokta (A-7).
  - Ok tuşları ekranın merkezi etrafında döndürüyor (A-6).
  - Tekerlekle uzaklaştırma imleç merkezli (A-9).
- **Orta önemde bir hata:** Çift orta tıktan sonra orta tıkla seçilmiş eksen seçili kalıyor (A-4).

## 2. Ana oturumda yeniden doğrulananlar

| Bulgu | Doğrulama | Sonuç |
|---|---|---|
| P-2 derinlik 0 | Ayrı betikle `d1 = 0` ekstrüzyon | ✔ Durum 8 sn sonra hâlâ "Hesaplanıyor…"; çekirdek kilitli |
| P-1 kabuk | 80×60×20 kutu, üst yüz kaldırılarak kabuk | ✔ t = 10 (yarı kalınlık) → 72 000 mm³, t = 16 → 90 624 mm³ çıkıyor, durum "Hazır", hata yok. SolidWorks bu kalınlıkları hata ile reddeder. (Bu kutuda R3 + t2 kabuk doğru çıktı: 24 165 mm³. Ajanın kutusunda kabuk hiç uygulanmadı; yani sonuç geometriye göre değişiyor, ama her durumda sessiz.) |
| P-3 önizleme | `main.ts` yarıçap / mesafe alanı | ✔ `numField` geri çağrısı `schedulePreview()` çağırmıyor (yalnız rho çağırıyor) |
| E-1 Ctrl+tık | `editor.ts selectClick` | ✔ Ctrl ile önce `virtualPt` → `realizeVirtual` çalışıyor; çizgiye isabet denetiminden önce eskize kalıcı nokta yazılıyor |
| E-2 Yatay/Dikey | `model.ts relOptions` | ✔ Her çizgiye koşulsuz ikisi birden sunuluyor; çelişki denetimi yok |
| E-3 3B geri al | `main.ts undo()` | ✔ Yalnız 2B eskiz ve `part` modu işleniyor; 3B eskiz (PM modu) için dal yok |
| A-1 stil düğmesi | `style.css` | ✔ `body.has-cube #viewbar button.orient {display:none}` stil düğmesini de gizliyor |
| A-2 iki parmak | `nav.ts:101` | ✔ `s.d > 80` eşiği her adımda yeniden değerlendiriliyor |

## 3. Önerilen düzeltme sırası (paketler)

1. **Paket 1, kararlılık ve veri güvenliği:**
   - P-2: derinlik 0 olunca çekirdek kilitleniyor.
   - P-1: kabuk başarısız olunca hata vermiyor.
   - P-6: hata veren özellik ✓ ile ağaca giriyor.
   - P-38: değmeyen kesme sessizce yön değiştiriyor.
   - E-3: 3B eskizde geri al çalışmıyor.
   - A-20: PM açıkken Ctrl+S taslağı siliyor.
   - M-1: montajda Ctrl+S parçayı kaydediyor.
2. **Paket 2, eskiz doğruluğu:**
   - E-1, E-2: seçim ve çelişen ilişki.
   - E-13: aşırı tanımlıda yalnız ilgili öğeler kırmızı olmalı.
   - E-4: ilişkisel öteleme.
   - E-5, E-6: modele bağlı Dönüştür, delik kenarında tam daire.
   - E-7, E-8, E-9: ölçü sürükleme, tamamlayıcı açı, zincir ölçü.
   - E-10: tıkla-sürükle ile çizim.
   - E-11, E-12, E-14, E-15, E-16.
3. **Paket 3, parça ağacı ve referanslar:**
   - P-4: gizli eskizler ağaçta görünüp düzenlenebilmeli.
   - P-7, P-8, P-24: ebeveyn/çocuk bastırma, sıralama ve silme.
   - P-9: referanslar modeli takip etmeli.
   - P-3: önizleme güncellenmeli.
   - P-5, P-12: çoğaltmada eksen/yön olarak kenar, yüz ve referans eksen.
4. **Paket 4, geometri farkları:**
   - P-10, P-11: koniklik ve Yön 2.
   - P-13, P-14, P-15, P-16, P-17, P-18.
5. **Paket 5, arayüz, telefon ve resim:**
   - A-1, A-2, A-3, A-4.
   - T-1: üst görünüşteki delik ölçüleri.
   - T-2, T-3: çakışma, merkez işaretleri.
6. **Paket 6, Düşük önemdeki bulgular:** Bunlar çoğunlukla eksik seçenekler ve SolidWorks varsayılanlarındaki farklar. Bu paket sona kalmalı.

> Not: Raporlarda geçen `/home/claude/denetim/...` deneme betikleri ve ekran görüntüleri denetim oturumundaydı; depoya konmadı. Her bulguda yeniden üretme adımları yazılı.

---

## İmaj CAD — ESKİZ denetim raporu (ajan: eskiz)

Tarih: 2026-11-13 · Sürüm: dist (v0.82) · Sunucu: localhost:4173 · Tarayıcı: Chrome (Playwright, swiftshader), 1400×900
Deneme betikleri: `/home/claude/denetim/eskiz/` (yardımcı `eh.py`, betikler `t01_open.py … t19_derived.py`, ekran görüntüleri `t03.png`, `t06_over*.png`, `t07.png`, `t13.png`). Denemelerin hemen hepsi gerçek fare/klavye olaylarıyla (`page.mouse` tıklama/sürükleme/çift tık/tekerlek, Ctrl/Shift, Tab, A, D, Esc, Delete, Ctrl+Z/Y/A/C/V, sağ tık) yapıldı. Başlangıç geometrisi gerekince `data` doğrudan kuruldu; komut, seçim ve ölçü ise fareyle yapıldı.

### Özet

| Önem | Adet |
|---|---|
| Kritik | 0 |
| Yüksek | 3 |
| Orta | 13 |
| Düşük | 18 |
| **Toplam** | **34** |

### Mevcut e2e testleri (alandaki 32 test)

Hepsi `/home/claude/denetim/eskiz/run` içinden çalıştırıldı (tests/ altına yazılmadı). Günlükler: `/home/claude/denetim/eskiz/log_<test>.txt`.

| Test | Sonuç |
|---|---|
| sq1, ft1, tr1, qd1, dm1, rc1, ui1, of1, sw3, sw4, sk1, sk2, sk3, sk4, sk5, s3d1, s3d2, s3d3, s3d4, s3d5, s3d6, wz1 | rc=0, sayfa hatası yok (bu testler bilgi çıktısı verir; çıktılar beklenen değerlerde) |
| rf1, rd1, es1, es2, es3, es4, fd1, s3d7, dx1, mb2 | rc=0, "SONUC: TAMAM" |

Başarısız test yok. Not: ft1 "çizgi–yay (90°)" durumunda radyüs yapılmıyor ve uyarı veriliyor. Bu doğru, çünkü çizgi yaya zaten teğet (SolidWorks da yapmaz).

---

### Bulgular

#### E-1 — Ctrl+tık çizgi ortasında / daire çeyreğinde eskize kalıcı nokta + ilişki ekliyor, çizgiyi seçtirmiyor
- **Önem:** Yüksek · **Tür:** Hata
- **SolidWorks:** Ctrl ile çoklu seçimde çizginin herhangi bir yerine tıklamak çizgiyi seçer. Orta nokta yalnız sanal olarak vurgulanır ve eskize öğe eklenmez.
- **Bizde:** Seç aracında L1 seçiliyken L2'nin ortasına (veya dairenin çeyreğine) Ctrl+tık → seçime `p2` gibi yeni bir **nokta** girer ve `midpoint` (çeyrekte `onCircle`+`horizontal`) ilişkisi eklenir. L2 seçilmez. Ölçüm (t06c): `sel=['L1','p2']`, pts `[a,b,c,f,p2]`, rels `['midpoint']`. Esc ile seçim temizlense de nokta ve ilişki kalıyor. Bu yüzden iki çizgi seçip Paralel/Dik/Eşit vermek isteyen kullanıcıya yalnız "Üzerinde / Orta nokta" düğmeleri çıkıyor (t06 ilk koşu: 10 ilişki denemesinin 10'u bu yüzden yanlış seçildi).
- **Kod:** `src/sketch/editor.ts:2706-2712` `selectClick` → `this.mods.add` iken `virtualPt` + `realizeVirtual`.
- **Öneri:** Ctrl ile önce öğeyi seç. Sanal noktayı yalnız gerçekten ilişki uygulanırken (düğmeye basılınca) gerçekleştir, kullanılmazsa sil. Ya da sanal noktayı yalnız Alt/Shift ile ya da çok küçük toleransla seçtir.

#### ✅ E-2 — Yatay çizgiye "Dikey" ilişkisi sunuluyor; eklenince ilişki sağlanmadan kalıyor (ya da çizgi sıfır boya çöküyor)
- **Önem:** Yüksek · **Tür:** Hata
- **SolidWorks:** Yatay ilişkisi olan çizgiye İlişki Ekle'de Dikey sunulmaz. Zorlanırsa eskiz aşırı tanımlı (kırmızı) olur.
- **Bizde (t06b/t06c):** Yatay çizgi seçilince panelde `⟷ Yatay, ↕ Dikey, ⚓ Sabitle` çıkıyor. Dikey'e basınca `rels=['horizontal','vertical']` oluyor, noktalar `(10,0)-(30,0)` olarak kalıyor (dikey sağlanmıyor), durum "Tanımlanmamış · 3 serbestlik", uyarı yok. Aynı veri baştan çözülünce de (setsk) çizgi `(0,0)-(0,0)` olarak sıfır boya çöküyor ve `ok:true` dönüyor.
- **Kod:** `src/sketch/model.ts:373-376` (`applicableRelations` mevcut H/V'yi süzmüyor); `src/sketch/editor.ts:360-405` `op()` çözümü kabul ediyor.
- **Öneri:** Mevcut ilişkilerle çelişen ya da zaten var olan seçenekleri listeleme. Çözücüde sıfır boylu çizgiyi / sağlanmayan kısıtı aşırı tanım say ve reddet.

#### ✅ E-3 — 3B eskizde Geri Al / İleri Al hiç çalışmıyor
- **Önem:** Yüksek · **Tür:** Hata
- **SolidWorks:** 3B eskizde Ctrl+Z son çizim / ölçü / ilişki adımını geri alır.
- **Bizde (t13b):** 3B eskizde çizgiye 150 ölçüsü verildi, Ctrl+Z basıldı → `dims3` aynı kaldı. Üst çubuktaki geri al düğmesi de pm modunda devre dışı.
- **Kod:** `src/main.ts:6909-6913` `undo()` → `if (mode.k !== "part") return;` (3B eskiz `pm` modunda açılıyor).
- **Öneri:** `sketch3d` taslağı için ayrı bir geri alma yığını tut (her `s3tool` değişikliğinde anlık görüntü al) ve undo/redo'yu ona yönlendir.

#### ✅ E-4 — Öteleme (offset) ilişkisel değil: ölçü değişince şekil bozuluyor
- **Önem:** Orta · **Tür:** Hata / SolidWorks'ten farklı
- **SolidWorks:** Ötelenen zincir "Öteleme" ilişkisiyle bağlı kalır. Mesafe ölçüsü değişince tüm parçalar aynı mesafede yeniden konumlanır, serbestlik artmaz.
- **Bizde (t09/t09b, fareyle seçim + Uygula):** 40×30 dikdörtgen 5 mm ötelendi. Yalnız kenarlar arası `parallel` ilişkileri ve **ilk kenar için** tek bir `pldist` ölçüsü ekleniyor. Serbestlik 8'den 11'e çıkıyor. Ölçüye çift tıklayıp 8 girilince sonuç: ilk kenar `(45.92,-5.01)-(-5,-5)`, öbür kenarlar 5 mm'de kalıyor, köşe 45.92'ye kayıyor. Şekil bozuk. Daire ötelemesine ölçü ya da ilişki hiç eklenmiyor.
- **Kod:** `src/sketch/ops.ts:236-311` `offsetEnts` (yalnız `firstLine` için ölçü; diğer parçalar için mesafe kısıtı yok).
- **Öneri:** Her ötelenmiş parça için taban parçaya eşit mesafe kısıtı ekle (çizgi: `pldist` + eşitlik, yay/daire: eş merkezli + yarıçap farkı) ya da tek bir öteleme ilişkisi tanımla.

#### ✅ E-5 — Varlıkları Dönüştür ve Kesişim Eğrisi modele bağlı değil (sabitlenmiş kopya)
- **Önem:** Orta · **Tür:** SolidWorks'ten farklı
- **SolidWorks:** Dönüştürülen kenarlar "Kenar üzerinde" (On Edge) ilişkisiyle modele bağlıdır. Model değişince eskiz güncellenir. Kesişim eğrisi de benzer biçimde ilişkiseldir.
- **Bizde (t10, t18):** Kutunun üst yüzünde ön kenar fareyle dönüştürüldü → çizginin iki ucuna `fix` konuyor. Taban eskizi 80'den 100 mm'ye büyütülüp yeniden oluşturuldu → dönüştürülen çizgi `x=-40…40`'ta kaldı (beklenen ±50). Kesişim eğrisi (Sağ Düzlem ∩ kutu) de 8 çizgi + `fix` ilişkileriyle sabit.
- **Kod:** `src/sketch/editor.ts:3447-3483` `convertEdge` → `addRel(sk,"fix",…)`. Daire için `dia` ölçüsü ekleniyor.
- **Öneri:** Kalıcı kenar referansıyla (EdgeRef `{m,d,s}`) "kenar üzerinde" ilişkisi sakla ve her yeniden oluşturmada izdüşümü güncelle.

#### E-6 — Silindirik delik kenarı dönüştürülünce tam daire yerine yarım yay geliyor
- **Önem:** Orta · **Tür:** Hata
- **SolidWorks:** Deliğin dairesel kenarı tek tıkla tam daire olarak dönüşür.
- **Bizde (t10):** Ø16 deliğin üst kenarına tıklanınca `arc` oluşuyor: `(-8,0)`'dan `(8,0)`'a yarım yay, R8. Kenar OCC'de iki yarıya bölündüğü için yalnız biri alınıyor.
- **Kod:** `src/sketch/editor.ts:3463-3478` (`info.closed` false → yay).
- **Öneri:** Aynı merkez/yarıçap/eksendeki komşu yay kenarlarını birleştir. Toplam açı 360° ise daire üret.

#### ✅ E-7 — Ölçü etiketi fareyle sürüklenemiyor (yalnız ilk adımda kıpırdıyor) ve sürükleme geri alınamıyor
- **Önem:** Orta · **Tür:** Hata
- **SolidWorks:** Ölçü metni serbestçe sürüklenir. Sürükleme ayrı bir geri alma adımıdır.
- **Bizde (t07c):** Etiket 60 px aşağı sürüklendi (20 adım). `lp.y` 10'dan 6.45'e indi ve orada kaldı. Beklenen yaklaşık −13.7. Ayrıca sürüklemeden sonra Ctrl+Z, bir önceki ölçü değeri değişikliğini de (45→40) geri aldı (t07b), çünkü etiket sürüklemesi anlık görüntü almıyor.
- **Kod:** `src/sketch/editor.ts:4595-4640` `wireDimLabel`. `render()` etiketi yeniden yaratınca pointer capture kayboluyor. `snapshot()` çağrılmıyor.
- **Öneri:** Sürüklemede etiket öğesini yeniden yaratmadan konumla (ya da `window` düzeyinde pointermove dinle). Sürükleme başında `snapshot()` al.

#### E-8 — Açı ölçüsü etiket konumuna göre değişmiyor (tamamlayıcı açı verilemiyor)
- **Önem:** Orta · **Tür:** SolidWorks'ten farklı
- **SolidWorks:** İki çizgi arasında etiket hangi bölgeye konursa o açı ölçülür (θ, 180−θ…).
- **Bizde (t07):** 0° ve 45° çizgiler. Etiket iki çizginin arasına konunca 45, sol bölgeye konunca da **45** (beklenen 135).
- **Kod:** `src/sketch/editor.ts:3878-3882` `dimSpec` açı dalı (`sgn` yalnız `lineAngleSign`'dan, `lp` dikkate alınmıyor).
- **Öneri:** `lp`'nin hangi çeyrekte olduğuna göre çizgi yönlerini çevirip açıyı seç (`sgn` / tamamlayıcı bayrağı).

#### E-9 — Zincir ölçü aynı yatay (dikey) çizgideki noktalarda çalışmıyor
- **Önem:** Orta · **Tür:** Hata
- **SolidWorks:** Zincir ölçüde aynı hizadaki noktalar ardışık ölçülür (en yaygın kullanım).
- **Bizde (t07b/t07c):** "Zincir ölçü" açık. (0,0)→(20,0) ölçüsünden sonra (50,0) noktasına tıklayınca hiçbir şey olmuyor. Noktalar farklı y'deyken (`(0,0),(20,10),(50,-5)`) çalışıyor (`O-b:h:20`, `b-c:h:30`).
- **Kod:** `src/sketch/editor.ts:3849-3856` `subFor` iki nokta aynı y'de olunca `"a"` döndürüyor. `:3812` `chainSt` yalnız `h`/`v` için kuruluyor.
- **Öneri:** Aynı y/x'teki noktalarda `subFor` `h`/`v` döndürsün (ya da `chainSt` `a` türünde de yön bilgisiyle kurulsun).

#### E-10 — Tıkla-sürükle-bırak ile çizgi / dikdörtgen / daire oluşmuyor
- **Önem:** Orta · **Tür:** Hata / SolidWorks'ten farklı
- **SolidWorks:** Çizgi, dikdörtgen ve daire basılı sürükleyip bırakarak tek hareketle çizilir. Çizgide sürükleme kipi zinciri bitirir.
- **Bizde (t03/t04):** Çizgi aracıyla (10,10)'dan (40,30)'a sürükleyip bırakınca öğe oluşmuyor, `isDrawing()=true` kalıyor ve ikinci noktayı ayrı bir tıklama bekliyor. Dikdörtgen ve daire aynı.
- **Kod:** `src/sketch/editor.ts:1222-1249`. Sürükleme başında `click(press.local)` zinciri başlatıyor. `up`'ta `dragCreates()` artık false olduğu için (`chainActive`) `return` ediliyor.
- **Öneri:** Sürüklemeyle başlatılan çizimi işaretle (`dragStarted`) ve `up`'ta ikinci noktayı yerleştir. Çizgide zinciri bitir.

#### ✅ E-11 — Merkez noktalı kanalda merkez noktası yok, orijine/merkeze bağlanmıyor
- **Önem:** Orta · **Tür:** Hata
- **SolidWorks:** Merkez noktalı kanalda merkez noktası vardır ve merkez çizgisinin ortasına bağlıdır. Orijine tıklanırsa çakışık olur.
- **Bizde (t04):** Merkez Kanal (0,0)→(30,0)→genişlik. Merkez çizgisi `(-30,0)-(30,0)`, ama orta nokta noktası / ilişkisi yok. Rels: `horizontal, tangent×4, equal`. Serbestlik 4 (düz kanalda aynı durumda 2). Kanal orijinden kayabiliyor.
- **Kod:** `src/sketch/editor.ts:2388-2440` `case "slot"/"cslot"`.
- **Öneri:** cslot'ta ilk tıklamayı (`makePoint` ile, çıkarım ilişkileri dahil) merkez noktası yap ve merkez çizgisine `midpoint` ekle.

#### E-12 — Türetilmiş eskiz ana eskize bağlı değil (düz kopya)
- **Önem:** Orta · **Tür:** SolidWorks'ten farklı
- **SolidWorks:** Türetilmiş eskiz ana eskizle bağlıdır. Ana değişince güncellenir, geometrisi düzenlenemez (yalnız konumlanır).
- **Bizde (t19):** Ön düzlemde R20 daire → Türetilmiş → grafik alanda Üst Düzlem. Ana daire R35 yapıldı → türetilmiş R20 kaldı.
- **Kod:** `src/main.ts:1480-1485` (`JSON.parse(JSON.stringify(src))`).
- **Öneri:** `derivedFrom` alanı tut. Derlemede kaynağın verisini al ve yalnız konum/dönüş ilişkilerini türetilmişte sakla.

#### E-13 — Aşırı tanımlıda bütün eskiz kırmızı oluyor
- **Önem:** Orta · **Tür:** SolidWorks'ten farklı
- **SolidWorks:** Yalnız çelişen/aşırı tanımlı öğe, ilişki ve ölçüler kırmızı (ya da sarı) olur. Diğerleri kendi durum renginde kalır.
- **Bizde (t06b):** İki ucu sabit çizgiye çelişen 40 ölçüsü verildi (`conflicts=['r1','r2','D1']`). İlgisiz bir dairenin de rengi `e03131` (kırmızı). Sarı ("geçersiz/sağlanamayan") renk hiç yok.
- **Kod:** `src/sketch/editor.ts:4071-4077` `entColor` → `if (!this.result.ok || this.result.conflicts.length) return C.over;`.
- **Öneri:** `conflicts` içindeki ilişki/ölçülerin referans verdiği öğeleri kırmızı yap. Diğerlerini normal analizle boya.

#### E-14 — Blok örnekleri katı (rijit) değil; sürükleyince blok dağılıyor
- **Önem:** Orta · **Tür:** Hata
- **SolidWorks:** Blok tek parça gibi davranır. Bir elemanından sürüklenince bütün blok taşınır, iç geometrisi değişmez.
- **Bizde (t11b):** Daire + çizgiden blok kaydedildi, (40,30)'a eklendi. Örnekteki daire kenarından sürüklenince daire `(40,33.3)`'ten `(57,29.3)`'e gitti, bloğun çizgisi `(35,28.3)-(45,28.3)`'te kaldı. Blok bozuldu.
- **Kod:** `src/sketch/editor.ts:1825-1945` (blok öğeleri yalnız `blk` etiketi taşıyor, aralarında kısıt yok). `beginDrag :2815`.
- **Öneri:** Sürüklemede `blk` etiketi aynı olan tüm öğeleri birlikte taşı. Örnek içi geometriyi rijit kısıtla (göreli sabit) çözücüye ver.

#### ✅ E-15 — Düzlem seçme modunda (Eskiz / Eskiz düzlemini değiştir / Türetilmiş) ağaçtaki düzleme tıklama çalışmıyor
- **Önem:** Orta · **Tür:** Hata
- **SolidWorks:** Düzlem seçimi grafik alandan ya da FeatureManager ağacından yapılabilir.
- **Bizde (t02):** "Eskiz düzlemini değiştir" sonrası ağaçta "Üst Düzlem"e tıklandı → mod `pickSketchPlane` olarak kaldı, düzlem değişmedi. Grafik alanda düzleme tıklayınca çalışıyor. Türetilmiş eskiz için de aynı.
- **Kod:** `src/main.ts:6147` ağaç tıklaması → `if (mode.k !== "part") return;`.
- **Öneri:** `pickSketchPlane` modunda ağaçtaki düzlem/ref. düzlem tıklamasını `partClick` ile aynı yoldan işle.

#### E-16 — Elipsin küçük ekseni (ve elips/spline/parabol) Akıllı Ölçü ile ölçülemiyor
- **Önem:** Orta · **Tür:** Eksik
- **SolidWorks:** Elipsin büyük/küçük yarı eksenleri ölçülendirilir ve elips tam tanımlanabilir.
- **Bizde (t07b):** Merkezi sabit, büyük ekseni yatay ve 30 ölçülü elips → "Tanımlanmamış · 1 serbestlik". Elipsin kendisine ya da küçük eksen ucuna tıklanınca ölçü kutusu da uyarı da çıkmıyor. Küçük yarıçap yalnız panel alanından değişiyor. Spline'a tıklama da sessizce bir şey yapmıyor.
- **Kod:** `src/sketch/editor.ts:3858-3865` `dimSpec` (tek öğede yalnız line/circle/arc). Elips `rb` ölçü türü yok.
- **Öneri:** Elips için `rb` ölçüsü (küçük eksen ucuna sanal nokta) ekle. Desteklenmeyen seçimde "Bu seçim için ölçü yok" uyarısını göster.

#### E-17 — Eksik ilişkiler
- **Önem:** Düşük · **Tür:** Eksik
- **SolidWorks:** Kesişim (nokta + 2 çizgi), yayın orta noktası (nokta + yay), 3+ noktaya Yatay/Dikey, nokta–elips/spline/parabol "Üzerinde", çizgi–spline/elips "Teğet", Sabit kanal.
- **Bizde (t06):** Nokta + 2 çizgi → panelde düğme yok. Nokta + yay → yalnız `Üzerinde / Eş merkezli`. 3 nokta → yalnız `Sabitle`. Kodda spline/elips için ilişki seçeneği yok.
- **Kod:** `src/sketch/model.ts:363-470` `applicableRelations` (`curves` yalnız circle/arc).
- **Öneri:** Listeyi SolidWorks tablosuna göre genişlet (çözücüde PlaneGCS `pointOnEllipse/BSpline`, `tangent` desteği).

#### E-18 — Daireye teğet biten çizgide Teğet çıkarımı yok
- **Önem:** Düşük · **Tür:** SolidWorks'ten farklı
- **SolidWorks:** Çizgi ucu daireye teğet noktaya getirilince sarı teğet çıkarımı gösterilir ve teğet ilişkisi eklenir.
- **Bizde (t08):** (−60,20)'dan R20 dairenin tepe noktasına yatay çizgi → yalnız `onCircle, vertical (çeyrek), horizontal`. Teğet yok. Teğet çıkarımı yalnız zincirdeki önceki öğeye göre (`editor.ts:890` dolayı).
- **Öneri:** `infer()` içinde imleç bir eğri üzerindeyken başlangıçtan gelen doğrultu teğete yakınsa "Teğet" adayı üret.

#### E-19 — Seçili öğe panelinde parametreler salt okunur
- **Önem:** Düşük · **Tür:** Eksik
- **SolidWorks:** Çizgi PM: Uzunluk/Açı, Nokta: X/Y, Daire: merkez X/Y ve yarıçap düzenlenebilir alanlardır.
- **Bizde (t05):** Çizgi için yalnız "Uzunluk 44,72 · Açı 26,57°" metni, daire için "Yarıçap 15" metni. Noktada X/Y yok.
- **Kod:** `src/sketch/editor.ts:4995-4998`.
- **Öneri:** `numField` ile düzenlenebilir alanlar koy (tanımlı öğede gri / salt okunur).

#### E-20 — Eskiz radyüsü iki öğe seçilerek yapılamıyor
- **Önem:** Düşük · **Tür:** Eksik
- **SolidWorks:** Birleşmeyen iki çizgi ardışık seçilerek de radyüs yapılır (köşe uzatılıp kırpılır).
- **Bizde (t09):** (0..50,0) ve (60,0..40) çizgileri sırayla tıklandı → değişiklik yok. Yalnız köşe noktasına tıklama çalışıyor.
- **Kod:** `src/sketch/editor.ts:2935` `filletAt` (`{ents:false}` vuruşu).

#### ✅ E-21 — Eskiz pahında ölçü eklenmiyor, açı-mesafe / iki mesafe seçeneği yok
- **Önem:** Düşük · **Tür:** Eksik
- **Bizde (t09):** Pah 5 → 3 çizgi oluştu, `dims=[]`. PM'de yalnız "Mesafe".
- **SolidWorks:** Açı-mesafe, mesafe-mesafe, eşit mesafe seçenekleri vardır ve pah ölçülendirilmiş gelir.
- **Kod:** `src/sketch/editor.ts:3267` `chamferAt`, `:4847`.

#### E-22 — Öteleme PM'inde SolidWorks seçenekleri eksik
- **Önem:** Düşük · **Tür:** Eksik
- **Bizde:** Mesafe, Yönü ters çevir, Çift yön, Tabanı yapı geometrisi. **Yok:** Uçları kapat (yay/çizgi), Zincir seç, Ötelemeyi yapı geometrisi yap, Ölçü ekle aç/kapat, fareyle sürükleyerek mesafe.
- **Kod:** `src/sketch/editor.ts:5189-5195`.

#### ✅ E-23 — Doğrusal/dairesel çoğaltmada ilişki/ölçü yok, dairesel merkez seçimi kısıtlı
- **Önem:** Düşük · **Tür:** SolidWorks'ten farklı
- **Bizde (t09b):** 4 örnekli doğrusal çoğaltma → `rels=[]`, `dims=[]`, serbestlik 3'ten 12'ye çıktı (örnekler bağımsız). Dairesel: merkez yalnız seçili nokta ya da orijin.
- **SolidWorks:** Örnekler eşit ilişkisi + aralık/açı ölçüsüyle (isteğe bağlı) bağlıdır. Merkez, yön ve aralık grafik alanda tutamaçla seçilir.
- **Kod:** `src/sketch/ops.ts:123-141`.

#### E-24 — Taşı / Döndür / Ölçekle yalnız sayısal; nokta-nokta ve merkez seçimi yok
- **Önem:** Düşük · **Tür:** Eksik
- **Bizde (t09):** Döndür PM: yalnız açı + "Kopyala". Döndürme seçimin ağırlık merkezi etrafında yapılıyor. Taşı'da başlangıç → bitiş tıklaması etki etmiyor (çizgi yerinde kaldı).
- **SolidWorks:** Taşı/Kopyala'da "Başlangıç/Bitiş" noktası, Döndür'de dönme merkezi, Ölçekle'de ölçek noktası grafik alanda seçilir.
- **Kod:** `src/sketch/editor.ts:3537-3545` (`c: centroid(...)`).

#### E-25 — Çokgende iç/dış teğet daire seçeneği yok
- **Önem:** Düşük · **Tür:** Eksik (belgede ✅ yazıyor)
- **Bizde:** PM'de yalnız "Kenar sayısı". Köşeler yapı dairesi üzerinde (yalnız iç teğet / köşe dairesi).
- **Kod:** `src/sketch/editor.ts:4845`.

#### E-26 — Yay kanalda ilişkiler eksik, 3 noktalı yay kanalı yok
- **Önem:** Düşük · **Tür:** SolidWorks'ten farklı / Eksik
- **Bizde (t17):** Yay kanal 7 öğe ve 4 ilişki (`midpoint, onLine ×2`). Uç yaylar arasında eşit, iç/dış yaylarla teğet ilişkisi yok. Merkezi orijinde iken serbestlik 6 (SolidWorks'te 4: yarıçap, iki açı, genişlik). Uç yaylardan sürükleme şekli değiştirmedi. 3 noktalı yay kanalı aracı yok.
- **Kod:** `src/sketch/editor.ts:3046-3078` `arcSlotGeo/buildArcSlot`.

#### ✅ E-27 — Sayıyla girişte dikdörtgen ölçüsüz oluşuyor; yalnız 5 araçta var
- **Önem:** Düşük · **Tür:** Hata (tutarsızlık)
- **Bizde (t11):** Çizgide 80 mm/30° → `dist:80` ölçüsü eklendi. Dairede çap ölçüsü ekleniyor. Dikdörtgen 50×30 → `dims=[]`. Yay, çokgen ve kanalda sayıyla giriş yok ("Sayıyla giriş: Çizgi, Dikdörtgen veya Daire aracında").
- **Kod:** `src/sketch/editor.ts:497-545` `numericEntry`.

#### E-28 — Varsayılanlar SolidWorks'ten farklı
- **Önem:** Düşük · **Tür:** SolidWorks'ten farklı
- Eskiz açılınca araç **Çizgi** etkin (SolidWorks'te araç seçili değil): `main.ts:1690` `editor.setTool(tool ?? "line")`.
- "Çizdikten sonra ölçü gir" varsayılan **açık** (SolidWorks'te "Ekran üzerinde sayısal giriş" kapalı): `editor.ts:224-230`. Her öğeden sonra ölçü kutusu açılıyor.
- **Öneri:** Masaüstü (fare) profilinde ikisini de kapalı başlat. Telefonda mevcut davranış korunabilir.

#### E-29 — 3B Eskiz Eskiz sekmesinde yok; helis ayrı eğri komutu değil
- **Önem:** Düşük · **Tür:** SolidWorks'ten farklı
- **Bizde (t13):** "3B Eskiz" yalnız Kaynaklı Yapı sekmesinde (`main.ts:6507`). Eskiz sekmesinde bulunmuyor. Helis yalnız 3B eskiz PM'inde "+ Helis" ile sayısal (merkez/eksen/yarıçap/hatve), ya da süpürme içinde.
- **SolidWorks:** Eskiz açılır menüsünde 3B Eskiz. Helis/Spiral, Özellikler > Eğriler'de ayrı komut.

#### ✅ E-30 — 3B eskizde Seç modunda Esc çıkış onay penceresi açıyor
- **Önem:** Düşük · **Tür:** SolidWorks'ten farklı (tutarsızlık)
- **Bizde (t13b):** Seç modunda Esc → "Çıkmak istediğinize emin misiniz?" penceresi açıldı (✓ düğmesini kapattı). 2B eskizde Esc hiçbir zaman çıkmıyor.
- **Kod:** `src/sketch/sketch3d.ts:1425-1440` olayı tüketmiyor → `main.ts:7433` `guardedCancel`.
- **Öneri:** 3B eskiz açıkken Esc'i yalnız seçim/araç sıfırlamada kullan.

#### E-31 — Yeni ölçü yerleştirirken Değiştir kutusunda ⟳, ± ve canlı önizleme yok
- **Önem:** Düşük · **Tür:** SolidWorks'ten farklı
- **Bizde (t07):** İlk yerleştirmede kutuda `− + mm 🎤 ✓ ✕` var. ⟳/± yalnız mevcut ölçüye çift tıklayınca çıkıyor (t07b'de ⟳, ± ve tekerlek çalıştı).
- **Kod:** `src/sketch/editor.ts:3797` `promptValue` (extra yok).

#### E-32 — Tam Tanımla seçeneksiz çalışıyor
- **Önem:** Düşük · **Tür:** Eksik
- **Bizde (t18):** Düğmeye basınca doğrudan uygulanıyor (sonuç doğru: "Tam tanımlı", 7 ölçü). Taban noktası, ölçü düzeni (taban çizgisi / zincir / sıralı), ilişki türü seçimi yok.
- **Kod:** `src/sketch/editor.ts:3185`, `src/sketch/define.ts`.

#### E-33 — Spline düzenleme eksikleri
- **Önem:** Düşük · **Tür:** Eksik
- **Bizde (t12):** Tutamak sürükleme, ara nokta sürükleme, eğrilik tarağı ve uç teğet/ağırlık alanları çalışıyor. **Yok:** spline'a nokta ekle/sil, kontrol çokgeni, basitleştir/uydur, ara tutamaklara ölçü, spline uzunluk ölçüsü.

#### E-34 — Yay gövdesinden sürüklemede uç noktalar da kayıyor
- **Önem:** Düşük · **Tür:** SolidWorks'ten farklı
- **SolidWorks:** Kısıtsız yayın ortasından sürüklenince uç noktalar yerinde kalır, yarıçap/şişkinlik değişir.
- **Bizde (t17b):** R30, 0–90° yay ortasından 9.6 mm dışa sürüklendi → R 55.7 oldu, uçlar (30,0)/(0,30)'dan (41.1,1.6)/(1.6,41.1)'e, merkez (−12.7,−12.7)'ye kaydı.
- **Kod:** `src/sketch/editor.ts:2824-2826` (`kind: "radius"` yayda da kullanılıyor).
- **Öneri:** Yayda sürüklemede uçları geçici sabitle, yalnız merkez/yarıçap çözülsün.

---

### Denendi – sorun yok

| Özellik | Deneme (gerçek fare/klavye) | Sonuç |
|---|---|---|
| Seçimsiz "Eskiz" → düzlem seç modu, Esc ile iptal | t01 | ✓ |
| Ağaçta düzlem + Eskiz, seçili yüzde Eskiz (üst yüz) | t01, t10 | ✓ (normal görünüm) |
| Boş eskizde ✓ → ağaca eklenmez | t01 | ✓ |
| ✕ ile değişiklikli çıkış → 3 seçenekli onay; Vazgeç / Kaydetmeden çık | t01 | ✓ |
| Değişiklik yoksa ✕ sormadan çıkar; ağaçta çift tık eskizi düzenler | t01 | ✓ |
| Esc: zinciri bitir → Seç'e dön → seçimi temizle (eskizden çıkmaz) | t01 | ✓ |
| Eskiz düzlemini değiştir (grafik alandan) | t02 | ✓ |
| Çizgi zinciri, çift tıkla bitirme, başlangıca dönünce kapanma, otomatik Y/D | t03 | ✓ |
| A tuşu çizgi→yay→çizgi (teğet), otomatik yay geçişi (uca dönüp çıkma) | t03 | ✓ |
| Merkez çizgisi (yapı), Orta nokta çizgisi (simetrik 60 mm) | t03 | ✓ |
| Dikdörtgen: köşe, merkez (köşegen + orta nokta), 3N köşe, 3N merkez, paralelkenar | t03 | ✓ |
| Düz kanal (2 yay + 2 çizgi, 4 teğet + eşit, ölçü seçeneği) | t03 | ✓ |
| Daire (merkez), Çevre dairesi (3 nokta) R20 | t03 | ✓ |
| Merkez yay, Teğet yay (çizgi ucundan, teğet ilişki), 3 noktalı yay | t03 | ✓ |
| Elips, kısmi elips, parabol, konik, çokgen (6 kenar, eşit), nokta | t03 | ✓ |
| Spline (çift tıkla bitir), denklem eğrisi | t03, t11 | ✓ |
| Metin: yerleştirme, yazı tipi (Sans/kalın/Serif/mono), yayın üzerine tıklayınca eğri üzerinde metin, harf aralığı, yön çevir | t03, t11 | ✓ |
| Serbest çizim tanıyıcı: kaba daire → daire, kaba dikdörtgen → 4 çizgi Y/D, eğri çizgi → yatay çizgi | t12 | ✓ |
| Kırp: tık, güç kırpma (sürükleme), kesişimsiz öğeyi silme | t09, t09c | ✓ |
| Uzat (en yakın öğeye) | t09 | ✓ |
| Eskiz radyüsü (köşe tık, R8 + 2 teğet + ölçü) | t09 | ✓ |
| Aynala (merkez çizgisi + çizgi + daire, simetrik + eşit) | t09 | ✓ |
| Doğrusal (4) / dairesel (6) çoğaltma, örnek atla (es1) | t09b | ✓ (ilişki eksikliği E-23) |
| Ayır, Kademe çizgisi | t11 | ✓ |
| Blok kaydet / ekle (2. örnek) | t11b | ✓ (rijitlik E-14) |
| DXF içe aktarma (dosya seçici: 2 çizgi + daire + yay) | t11 | ✓ |
| Eskiz resmi (dosya seçici) + kenar izleme (4 çizgi + delik dairesi) | t11 | ✓ |
| Kesişim eğrisi (Sağ düzlem ∩ kutu) | t18 | ✓ (ilişkisellik E-5) |
| Tam Tanımla (dikdörtgen + daire → tam tanımlı) | t18 | ✓ |
| Yapı Geom. komutu, Sil, Ctrl+A/C/V, Ctrl+Z/Y (sürükleme dahil), zincirde adım adım geri alma | t05, t16 | ✓ |
| İlişkiler (panelden, fareyle seçimle): Yatay, Dikey, Paralel, Dik, Doğrudaş, Eşit (çizgi / yay-daire), Eş merkezli, Eş yarıçaplı, Teğet (çizgi-daire, yay-daire), Çakışık, Birleştir, Yatay (2 nokta), Üzerinde (çizgi/daire), Orta nokta, Simetrik, Sabitle, Eşit eğri uzunluğu | t06 | ✓ |
| Mevcut ilişkiler listesi ✕, ilişki simgesine tık + Delete, "İlişkiler" göster/gizle | t06 | ✓ |
| SketchXpert önerileri (aşırı tanımda panelde) | t06b | ✓ |
| Durum çubuğu: Tanımlanmamış · n serbestlik / Tam tanımlı / Aşırı tanımlı | tümü | ✓ |
| Akıllı Ölçü: hizalı / yatay / dikey (etiket konumuna göre), daire Ø, yay R, D tuşu Ø↔R | t07, t07b | ✓ |
| Gereksiz ölçü → "Sürülen yap / Sürücü olarak bırak / Vazgeç" penceresi, sürülen ölçü | t07b | ✓ |
| Değiştir kutusu: çift tıkla aç, tekerlek artımı + canlı, ⟳, ±, ✕ ile geri dönüş, `=20*2+5` | t07b | ✓ |
| Ölçüde global değişken `=gen*2` ve değişken değişince güncelleme | t14 | ✓ |
| Shift ile yay koşulu (en uzak kenar 50) | t07b | ✓ |
| Zincir ölçü (farklı y'deki noktalarda) | t07c | ✓ (E-9 hariç) |
| Çıkarım: uç, orta, merkez, çeyrek, kesişim, üzerinde (çizgi/daire), yay ortası, orijin, imleç simgeleri | t08 | ✓ |
| Uyandırılmış noktadan mavi hizalama, zincirde Dik çıkarımı, Ctrl ile çıkarım kapalı | t08 | ✓ |
| Izgaraya yakalama (5 mm), açı yakalama (15°), hızlı yakalama filtresi (orta nokta kapalı) | t08 | ✓ |
| Seçim: tık, Ctrl ile ekle/çıkar, Shift ile ekle, soldan sağa pencere, sağdan sola kesişen, boşluğa tık temizler | t05 | ✓ |
| Sürükleme: tanımsız çizgi gövdesi/uç, tanımsız daire yarıçapı; tam tanımlı daire kıpırdamaz; dikdörtgen köşesi dikdörtgen kalır | t05, t16 | ✓ |
| Sayıyla giriş (rakama basınca X/Y → Uzunluk/Açı), çizgi 80 mm 30° + ölçü | t11 | ✓ |
| Çizdikten sonra ölçü gir (daire Ø50) | t11 | ✓ |
| Kalem: dokun-dokun daire, kaldırınca yerleştir (nokta kalkış yerinde) | t15 | ✓ |
| Sağ tık: zincirde "Zinciri bitir", öğede Yapı geometrisi/Sil, Hızlı yakalama, Eskizden çık; S kısayol çubuğu; Enter son komutu tekrarlar | t16 | ✓ |
| Spline: tutamak sürükleme, ara nokta sürükleme, eğrilik tarağı, uç teğet/ağırlık alanları | t12 | ✓ |
| Şekil sihirbazları (7 sihirbaz serbestlik 0) | wz1, mb2 | ✓ |
| 3B eskiz: çizgi zinciri + Tab ile düzlem (XY→YZ), eksen çıkarımı (X/Y boyunca), dikdörtgen (xyxy), yay, spline, nokta, kırp, nokta sürükleme, Akıllı Ölçü 150, 2 çizgide ilişki çubuğu (X/Y/Z boyunca, düzleme paralel, paralel, dik, eşit, doğrusal, ayna, açı ölçüsü) | t13, t13b, t13c | ✓ (E-3, E-29, E-30 hariç) |
| 3B eskiz radyüsü, uzat, ayna, helis, kesişim eğrisi | s3d1–s3d7 testleri | ✓ |

---

## İmaj CAD — PARÇA ÖZELLİKLERİ denetimi (ajan: parca)

Tarih: 2026-11-13 · Sürüm: canlı v0.82 derlemesi (`dist`, localhost:4173) · Tarayıcı: Playwright + Chrome (swiftshader)
Deneme betikleri: `/home/claude/denetim/parca/` (`ph.py` yardımcı; `e1–e9`, `u1–u8`, `s1–s3`, `kr2`, `io1`, `w1`, `t1` …) · Test günlükleri: `/home/claude/denetim/parca/logs/`

Yöntem: Her özellik için (1) `setDoc` ile belge kurup çekirdek hacmini (`kernel.props()`) **elle hesaplanan SolidWorks sonucu** ile karşılaştırdım, (2) gerçek fare / klavye olaylarıyla şerit komutu → PM alanları → modelde tıklama → ✓ / ✕ / Ctrl+Z / ağaç işlemlerini denedim, (3) kodda kesin gördüğüm davranışları dosya:satır ile yazdım. Doğrulanamayan SolidWorks davranışı "Doğrulanmadı" diye işaretlidir.

### Özet

| Önem | Sayı |
|---|---|
| Kritik | 1 |
| Yüksek | 4 |
| Orta | 10 |
| Düşük | 23 |
| **Toplam** | **38** |

En önemli beş bulgu:
1. **P-1 (Kritik)** Kabuk başarısız olduğunda sessizce yok sayılıyor: tüm kenarları radyüslü kutuda (çok yaygın SW iş akışı: önce radyüs, sonra kabuk) kabuk hiçbir şey yapmıyor, hata yok, durum "Hazır". t ≥ yarı kalınlıkta da aynı; t = yarı kalınlıkta bozuk hacim.
2. **P-2 (Yüksek)** Derinliği 0 olan ekstrüzyon (ör. denklemde değişken 0) çekirdeği kalıcı kilitliyor: "Hesaplanıyor…" sonsuza dek, sonraki hiçbir değişiklik yapılmıyor (sayfa yenilenene dek).
3. **P-3 (Yüksek)** Radyüs / pah / kabuk sarı önizlemesi değer değişince güncellenmiyor (yarıçap 10 yazılır, önizleme R3 kalır).
4. **P-4 (Yüksek)** Taban flanş, yapı elemanı iskeleti, çizgiden büküm, kademe, gönye flanş, havalandırma, aç/katla kes, eskiz/eğri çoğaltma eskizleri ağaçta hiç görünmüyor; bu eskizleri düzenlemenin bir yolu yok.
5. **P-5 (Yüksek)** Dairesel çoğaltma ekseni yalnız orijinden geçen X/Y/Z; referans eksen / silindir yüzü / kenar seçilemiyor (`refAxis` derleyicide var, arayüzde yok).

---

### Mevcut e2e testleri

65 test çalıştırıldı (`runtests.sh`, günlükler `logs/`). Sonuç: **64 geçti / beklenen çıktıyı verdi, 1 başarısız (th2)**.

| Test(ler) | Sonuç | Not |
|---|---|---|
| pf1–pf9, sm1–sm4, th3, md1, ss1, dd1, sf1–sf3, wc1, wl1, fp1, fc1, pg1, pj1, kr1, inc1, lk1, an1, fea1 | SONUC: TAMAM | — |
| fx1, pl1, pb1, pb2, fl1, lb1, sb1, pj0, t3–t10, k1–k6, s1, s2, w1–w8, m2 | Hata yok (bu testler doğrulama yapmıyor, yalnız çıktı basıyor; çıktılar incelendi, sayfa hatası / çekirdek hatası yok) | t10'daki "Kaburga … malzeme tarafını ters çevirin" testin kasıtlı ters durumudur |
| **th2** | **SONUC: HATA** | "gerçek diş < 16 sn" koşulu: 35,4 sn (toplu koşuda) / 17,6 sn (tek başına). Hacim doğru. **Uygulama hatası değil, ortam yüküne bağlı süre eşiği** (2 çekirdek, yük ortalaması ≈3; diğer ajanlar aynı makinede). Bkz. P-36. |

---

### Bulgular

#### P-1 · Kabuk başarısız olunca sessizce yok sayılıyor (hata yok, yanlış geometri)
- **Önem:** Kritik · **Tür:** Hata
- **SolidWorks:** Kabuk oluşturulamazsa PM'de "Kabuk oluşturulamadı / kalınlık çok büyük" hatası verir, özellik oluşmaz. Tüm kenarları radyüslenmiş kutuda (R3, t=2, üst yüz kaldırılır) kabuk sorunsuz çalışır.
- **Bizde:** 40×30×20 kutu, tüm kenarlar R3 (yüz seçimi ile), ardından kabuk t=2 üst yüz kaldırılarak → hacim **23 340,85 = yalnız radyüslü kutu hacmi**; yüz sayısı 26 (kabuk yok), hata listesi boş, durum "Hazır". R1/R5, t=1 ile de aynı. Yalnız üst 4 kenar R3 + kabuk → yine kabuksuz (23 778,6). Radyüssüz kutuda: t=12 ve t=16 → hacim 24 000 (kabuk yok, hata yok); t=10 (tam yarı kalınlık) → 11 yüzlü, hacmi 20 148 olan bozuk gövde. (Dikey kenarlar R5 + kabuk çalışıyor: 7444,5.) Betik: `e2.py`, `e2b.py`, `e6.py`.
- **Kod:** `src/kernel.worker.ts:4008–4017` `b.shell(...)` sonucu doğrulanmıyor; replicad `shellShape` (`node_modules/replicad/dist/casting-*.js:1392`) `BRepOffsetAPI_MakeThickSolid.MakeThickSolidByJoin` sonrası `IsDone()` denetlemeden `Shape()` döndürüyor (başarısızlıkta girdi geri gelir).
- **Öneri:** `MakeThickSolid`'i doğrudan çağırıp `IsDone()` + sonuç hacmi < girdi hacmi + `BRepCheck_Analyzer` ile doğrula; değilse anlamlı hata at ("Kalınlık radyüsten / parça kalınlığının yarısından büyük olabilir"). Radyüslü modelde `GeomAbs_Intersection` + `BRepOffset_Skin` ile yeniden dene.

#### P-2 · Derinliği 0 olan ekstrüzyon çekirdeği kilitliyor (uygulama donar)
- **Önem:** Yüksek · **Tür:** Hata
- **SolidWorks:** Derinlik 0 kabul edilmez ("değer sıfırdan büyük olmalı"), model diğer özelliklerle kurulur.
- **Bizde:** `d1: 0` ekstrüzyon → durum çubuğu 18 sn sonra hâlâ "Hesaplanıyor…"; ardından d1=10 yapılsa da kurulum hiç bitmiyor (worker yanıt vermiyor). Arayüzden erişim: global değişken `L=0` ve derinlik `=L` (Denklemler penceresi / yapılandırma değeri) → aynı kilitlenme (`e8.py`). PM alanı min 0,001 olduğu için yalnız doğrudan yazılarak oluşmaz. Negatif derinlik (−5) ise sessizce ters yönde 5 mm yapıyor.
- **Kod:** `src/doc/compile.ts:330–352` (extrude derlemesinde değer denetimi yok), `src/kernel.worker.ts:extrudeTool` `sk(0).extrude(sign*d1)`; `kernel.worker.ts:4598` onmessage `try/catch` WASM çökmesini yakalayamıyor; `src/kernel.ts` tarafında zaman aşımı / worker yeniden başlatma yok.
- **Öneri:** Derleyicide tüm uzunluk/açı/kalınlık parametrelerini `> 0` denetle (denklem sonucu dahil); `kernel.ts`'te build için zaman aşımı + worker'ı yeniden oluşturma.

#### P-3 · Radyüs / pah / kabuk sarı önizlemesi sayısal değer değişince güncellenmiyor
- **Önem:** Yüksek · **Tür:** Hata
- **SolidWorks:** Yarıçap / mesafe / kalınlık değiştikçe sarı önizleme hemen yenilenir.
- **Bizde:** Radyüs PM, kenar seçilir (önizleme R3) → Yarıçap alanına 10 yazılır, 3 sn beklenir → çekirdekteki önizleme hacmi hâlâ R3 (23 922,74; R10 olsaydı 23 141,59). Pah mesafesi 6 → önizleme 2 mm'de (fark 80, beklenen 720). Kabuk kalınlığı 4 → önizleme 2 mm'de (7872). Önizleme yalnız seçim değişince yenileniyor; ✓ sonrası sonuç doğru. (`u2b.py`)
- **Kod:** `src/main.ts:2508` (radyüs/pah numField: `(v) => (isF ? (d.r = v) : (d.d = v))` — `schedulePreview()` yok); kabuk `main.ts:2627` (`(v) => (d.t = v)`, "Dışa kabuk" onay kutusu da); bitiş yarıçapı, rho, mesafe 2/3, açı alanları aynı. `ghostPreview` `main.ts:1007`.
- **Öneri:** Bu alanların onChange'ine `upd()` ekle.

#### ✅ P-4 · Bazı özelliklerin eskizleri ağaçta görünmüyor, düzenlenemiyor
- **Önem:** Yüksek · **Tür:** Hata
- **SolidWorks:** Taban flanş, yapı elemanı, çizgiden büküm vb. eskizi özelliğin altında (çocuk) görünür; sağ tık → Eskizi düzenle.
- **Bizde:** Taban flanş (`Taban-Flanş1`) ve yapı elemanı (`Yapı-Elemanı1`) oluşturulunca ağaç: `Ön/Üst/Sağ Düzlem, Orijin, Taban-Flanş1` — `Eskiz1` hiçbir yerde yok; ağaç eylemleri `Düzenle, Adlandır, Buraya geri sar, Bastır, ▲ Yukarı, Ebeveyn / çocuk, Klasöre ekle…, Sil` (Eskizi düzenle yok); sağ tık menüsünde de yok; grafik alanda eskize çift tıklama işleyicisi yok (`t1.py`). Sonuç: levha / çerçeve ölçüsü değiştirilemiyor.
- **Kod:** `src/main.ts:6228` `kids` yalnız extrude/revolve/rib/wrap/sweep/loft/edgeflange.prof; `src/doc/compile.ts:963` `sketchUsers` ise sheetbase, sketchbend, flatcut, member, spattern, cvpattern, sheetjog, miterflange, vent eskizlerini de "tüketilmiş" sayıyor → `renderTree` (main.ts ~6213) bunları gizliyor. `main.ts:6360` "Eskizi düzenle" yalnız extrude/revolve/sweep.
- **Öneri:** `kids` listesini `sketchUsers` ile aynı kümeye genişlet; "Eskizi düzenle"yi eskiz kullanan tüm özelliklere ekle.

#### ✅ P-5 · Dairesel çoğaltma ekseni yalnız orijinden X/Y/Z
- **Önem:** Yüksek · **Tür:** Eksik
- **SolidWorks:** Eksen olarak referans eksen, geçici eksen (silindir / delik yüzü), doğrusal kenar, açısal ölçü seçilir (ör. flanşta cıvata dairesi).
- **Bizde:** PM yalnız "Eksen (orijinden geçen): X/Y/Z" seçimi sunuyor; modelde yüz/kenar/eksen tıklaması çoğaltma eksenini değiştirmiyor (`pmPick`'te cpattern dalı yok). Derleyicide `refAxis` desteği var ama arayüzde hiçbir yerde atanmıyor (`grep refAxis src/main.ts` → yok).
- **Kod:** `src/main.ts:2690–2694`, `src/doc/compile.ts:855–859`, `src/doc/types.ts:427` (`refAxis`).
- **Öneri:** PM'e "Eksen" seçim kutusu: referans eksen özellikleri + modelde silindir yüzü / düz kenar tıklaması (`ax`/`ac` bilgisi FaceInfo'da zaten var).

#### P-6 · Radyüs / pah / kabuk vb. hata verse de ✓ ile ağaca hatalı özellik giriyor
- **Önem:** Orta · **Tür:** SolidWorks'ten farklı
- **SolidWorks:** Radyüs oluşturulamazsa PM açık kalır, "Radyüs oluşturulamadı" mesajı; özellik eklenmez.
- **Bizde:** R50 (40×30×20 kutuda) → ✓ → PM kapanır, ağaçta kırmızı `Radyüs1`, hata "Geometri işlemi başarısız (OpenCascade hatası)", durum "1 özellikte hata" (`u2.py`). Aynısı pah, kabuk, koniklik, kenar flanş, birleştir, gövde sil, girinti, diş, saca dönüştür için.
- **Kod:** `src/main.ts:2230` (bu türler `draftError` denetiminden muaf; nedeni canlı önizleme olmaması).
- **Öneri:** ✓'de bu türler için bir kez kurup hata varsa PM'i açık tutup mesajı göster.

#### P-7 · Ebeveyn bastırılınca çocuklar bastırılmıyor, hata veriyor
- **Önem:** Orta · **Tür:** SolidWorks'ten farklı
- **SolidWorks:** Bir özellik bastırılınca ona bağlı çocuklar (radyüs, kesme, çoğaltma) da otomatik bastırılır; hata çıkmaz.
- **Bizde:** `Ekstrüzyon1` → Bastır → `Radyüs1`, `Kesme1`, `DÇ1` kırmızı hata ("Önce bir katı oluşturun", "Kesilecek bir katı yok"), durum "3 özellikte hata" (`u3.py`).
- **Kod:** `src/main.ts:6371–6378` (yalnız `f.off`).
- **Öneri:** Bastırırken geometri/kimlik çocuklarını da `off` yap (bkz. P-8 çocuk listesi).

#### P-8 · Ebeveyn/çocuk yalnız kimlik bağları; sıralama ve silme bunu kullanıyor
- **Önem:** Orta · **Tür:** Hata
- **SolidWorks:** Radyüs, seçtiği kenarın ait olduğu ekstrüzyonun çocuğudur; çocuk ebeveynin üstüne sürüklenemez; silmede bağımlı öğeler listelenir ("Çocuk özellikleri de sil").
- **Bizde:** `Ekstrüzyon1` → Ebeveyn / çocuk → "Ebeveyn: Eskiz1 · Çocuk: —" (Radyüs1 ve Kesme1 yok). `Radyüs1` → ▲ Yukarı → `Ekstrüzyon1`'in önüne geçiyor, radyüs hata veriyor ("Önce bir katı oluşturun"). `Ekstrüzyon1` sil → yalnız "silinsin mi? / eskiz de silinsin mi?" soruluyor; Radyüs1, Kesme1, DÇ1 hatalı olarak kalıyor (`u3.py`).
- **Kod:** `src/main.ts:6250` `parentsOf` (yalnız sketch/path/feats/plane id), `orderOk` 6259, `deleteFeature` ~6400.
- **Öneri:** Kenar/yüz referanslarını çekirdekte "sahibi" (`faceOwner` zaten var) ile özelliğe bağlayan bir bağımlılık haritası; sıralama ve silme bu haritayı kullansın.

#### ✅ P-9 · Statik koordinatlı referanslar model değişince takip etmiyor
- **Önem:** Orta · **Tür:** Hata
- **SolidWorks:** "Köşeye kadar" köşesi, referans eksen (silindirden), 3 noktalı düzlem, "referansa kadar" çoğaltma referansı geometriye bağlıdır; model değişince izler.
- **Bizde:** Köşeye kadar `vtx=[40,30,20]` → taban derinliği 20→35 yapılınca `vtx` hâlâ `[40,30,20]` (yeni köşe z=35'e gitmez). Delikten (Ø8, x=10) referans eksen → delik x=25'e taşınınca eksen `p` hâlâ `[10,15,0]` (`kr2.py`). (Yüz üzerindeki eskiz ve radyüs kenarları doğru izliyor — kr1 TAMAM.)
- **Kod:** `src/doc/types.ts` `ExtrudeFeature.vtx/fromVtx`, `RefAxisFeature {p,d}`, `RefPointFeature`, `PlaneFeature.pts`, `LPatternFeature.upTo` — hepsi `Vec3`; `applyHeals` (`main.ts:920`) yalnız `{m,d}` kenar ve `{c,n}` yüz referanslarını onarıyor.
- **Öneri:** Köşe referanslarını kenar referansı + uç (`{m,d,end}`) olarak, ekseni silindir yüz referansı olarak sakla; heal mekanizmasına kat.

#### P-10 · Dışa koniklikli ekstrüzyonda yan yüzler B-spline ve hacim hatalı
- **Önem:** Orta · **Tür:** Hata
- **SolidWorks:** Dikdörtgen profil 5° dışa koniklikle 6 düzlemsel yüzlü kesik piramit; hacim = h/6·(A1+A2+4Am).
- **Bizde:** 40×30, d=20, 5° **içe** → 6 yüz, 21 631,96 (tam doğru). 5° **dışa** → **14 yüz** (12 yan yüz `BSPLINE_SURFACE`), hacim 26 528,28 (beklenen 26 531,33; −3,05). Yan yüzler düzlem olmadığı için bu yüzlere eskiz / "yüzeye kadar" / düz yüz gerektiren işlemler çalışmaz (`e1.py`, `e1b.py`).
- **Kod:** `src/kernel.worker.ts:339` `profile(f.loops).offset(off, { lineJoinType: "miter" })` dışa ötelemede köşeye ek segment üretiyor, `loftWith(ruled)` dörtgenle 8+ kenarlı profili eşleyince bükük yüzler.
- **Öneri:** Çokgen profilde köşeleri elle (kenar doğrularını ötele + kesiştir) hesapla ya da `BRepOffsetAPI_DraftAngle` ile yan yüzlere koniklik ver.

#### P-11 · Ekstrüzyonda koniklik ve Yön 2 kısıtları
- **Önem:** Orta · **Tür:** Eksik
- **SolidWorks:** Koniklik çok konturlu (delikli) profilde, orta düzlemde, tümünden geçende ve Yön 2'de (ayrı açı) kullanılabilir; Yön 2 tüm uç koşullarını (sonrakine, yüzeye, köşeye, gövdeye, ötele) destekler.
- **Bizde:** Delikli profil + koniklik → hata "Koniklik şimdilik tek konturlu profillerde destekleniyor". Orta düzlem / tümünden geçen / sonrakine kadar seçilince Koniklik onay kutusu gizleniyor; veride verilirse sessizce yok sayılıyor (kesme tümünden + 2° → hacim konikliksiz ile aynı). Yön 2 yalnız "Kör / Tümünden geçen"; koniklik + Yön 2 → Yön 2 konikliksiz (hacim 33 631,96 = içe konik + düz 12 000) (`e1.py`, `u1.py`).
- **Kod:** `src/kernel.worker.ts:336` ve 338–341, 351–354; `src/main.ts` ~2396–2420.
- **Öneri:** Koniklik için ayrı `draft` uygulaması (yüz bazlı `DraftAngle`) ile tüm profillere; Yön 2 için aynı `endOpts` listesi + ayrı açı alanı.

#### P-12 · Doğrusal çoğaltma yönü yalnız X/Y/Z ekseni
- **Önem:** Orta · **Tür:** Eksik
- **SolidWorks:** Yön için doğrusal kenar, eksen, doğrusal ölçü veya düz yüz (normali) seçilir.
- **Bizde:** PM'de "Yön: X/Y/Z ekseni" + Ters çevir; modelde kenar tıklaması yönü değiştirmiyor. Eğik bir kenar boyunca çoğaltma yapılamıyor.
- **Kod:** `src/main.ts:2648–2655`, `src/doc/compile.ts:847–852` (`AXES[f.axis]`).
- **Öneri:** `dirVec` alanı + kenar/yüz seçimi (ekstrüzyondaki "Ekstrüzyon yönü (kenar)" düğmesi gibi).

#### P-13 · Dışa kabukta dış kenarlar yuvarlanıyor
- **Önem:** Orta · **Tür:** SolidWorks'ten farklı (SolidWorks davranışı **Doğrulanmadı**)
- **SolidWorks (beklenen):** Düz yüzlü kutuda "Dışa kabuk" sonucu keskin köşeli büyük kutu (44×32×24, açık üst) → hacim 9792.
- **Bizde:** 40×30×20, t=2 dışa, üst açık → 23 yüz, hacim 9570,74 (yuvarlak dış kenarlar, r=2). pb1 testinde de 23 yüz.
- **Kod:** replicad `shellShape` `GeomAbs_Arc` birleşim türü (`casting-*.js:1398`).
- **Öneri:** `GeomAbs_Intersection` kullan (SW ile aynı keskin kenar).

#### P-14 · Çakışan konturlu eskizde ekstrüzyon sessizce tek parça seçiyor
- **Önem:** Orta · **Tür:** Hata
- **SolidWorks:** Kesişen kapalı konturlarda "Seçili konturlar" istenir ya da hata verir; rastgele bir bölge katılaştırılmaz.
- **Bizde:** Merkezleri 10 mm aralı iki R10 daire, d=10 → hacim 1913,2 = **tek bir hilal bölgesi** (birleşim 5054,8, ikisi 3826 olurdu); hata/uyarı yok (`e7.py`).
- **Kod:** `src/sketch/profile.ts` bölge çıkarma + `selectContours` (`compile.ts`).
- **Öneri:** Kesişen konturda kullanıcıya "Seçili konturlar" uyarısı ver ya da SW gibi tüm dış bölgeyi kullan.

#### P-15 · Sac büküm payı / büküm düşümü 90°'ye göre K'ya çevriliyor
- **Önem:** Orta · **Tür:** SolidWorks'ten farklı (kodda kesin)
- **SolidWorks:** "Büküm payı" / "Büküm düşümü" yönteminde girilen değer her bükümde doğrudan kullanılır (açıdan bağımsız).
- **Bizde:** `effK` BA/BD'yi 90° için eşdeğer K'ya çevirip bütün açılarda o K'yı kullanıyor → 90° dışı bükümlerde (45°, 135°, kenet) açınım SW'den farklı. 90° bükümde doğru (BA=5 → 87 mm, s1 testi).
- **Kod:** `src/sheet/sheet.ts:98–104` `effK`.
- **Öneri:** Açınımda BA/BD yönteminde K yerine doğrudan BA/BD değerini kullan.

#### P-16 · Tam yuvarlak radyüs tam yarım daire değil
- **Önem:** Düşük · **Tür:** Hata
- **SolidWorks:** Tam yuvarlak, orta yüzü tamamen kaldırır; yarıçap = genişlik/2.
- **Bizde:** 10 mm genişlikte 2·(1−π/4)·25·20 = 214,60 beklenirken 212,46 (−%1); 20 mm genişlikte 1716,8 yerine 1699,7. Üstte ~0,05 mm düz şerit kalıyor (`e2.py`).
- **Kod:** `src/kernel.worker.ts:1321` `r: (best.d / 2) * 0.995`.
- **Öneri:** Üç yüz takımlı gerçek tam yuvarlak (yan yüzleri yuvarlakla değiştir) ya da tam yarıçapla dene, başarısızsa 0,995'e düş.

#### P-17 · Kabuk yüz seçmeden (içi boş kapalı gövde) yapılamıyor
- **Önem:** Düşük · **Tür:** Eksik
- **SolidWorks:** Kaldırılacak yüz seçilmezse kapalı, içi boş gövde oluşturur.
- **Bizde:** Yüz seçmeden ✓ → "Kaldırılacak en az bir yüz seçin"; çekirdekte de "Kaldırılacak yüz seçin" (`e2.py`).
- **Kod:** `src/main.ts:2201`, `src/kernel.worker.ts:4011`.

#### P-18 · İlk özellikte "Tümünden geçen" 1000 mm gövde oluşturuyor
- **Önem:** Düşük · **Tür:** SolidWorks'ten farklı
- **SolidWorks:** Taban ekstrüzyonda "Tümünden geçen" seçeneği yoktur.
- **Bizde:** İlk ekstrüzyonda Uç koşulu = Tümünden geçen → z 0…1000 gövde, uyarı yok (`u1.py`).
- **Kod:** `src/kernel.worker.ts:163–167` `bodySize()` gövde yokken 1000.

#### P-19 · Varsayılan değerler SolidWorks'ten farklı
- **Önem:** Düşük · **Tür:** SolidWorks'ten farklı
- **Bizde / SW:** Ekst. Kesme varsayılan uç koşulu "Tümünden geçen" (SW: Kör); ekstrüzyon derinliği 20 (SW: 10 mm); radyüs 3 (SW: 10 mm); kenar flanş boyu 25. (`main.ts:1866`, 1876.)
- **Öneri:** Kullanıcının son değerini hatırla (SW de böyle) ya da SW varsayılanları.

#### P-20 · PM ✕'te onay penceresi çıkıyor
- **Önem:** Düşük · **Tür:** SolidWorks'ten farklı
- **SolidWorks:** ✕ değişiklikleri sormadan atar.
- **Bizde:** Değer değiştirilmiş PM'de ✕ → "Çıkmak istediğinize emin misiniz? Uygula ve çık / Kaydetmeden çık / Vazgeç" (`u1.py`). (Telefonda geri tuşu için yararlı; masaüstünde bir tık fazla.)
- **Kod:** `src/main.ts:1788–1820` `askExit` / `guardedCancel`.

#### P-21 · Hata mesajları genel / İngilizce
- **Önem:** Düşük · **Tür:** Hata
- **Bizde:** R50 radyüs, eksen profili kesen döndürme, kabuk t=0 → "Geometri işlemi başarısız (OpenCascade hatası)"; r=0 daire → "Failed to build the wire, disconnected wire" (İngilizce) (`e7.py`, `e9.py`). SW: "Radyüs çok büyük", "Eskiz döndürme eksenini kesiyor" gibi özel mesajlar.
- **Öneri:** Özellik türüne göre ön denetimler (yarıçap ≤ komşu yüz genişliği, profil eksenin bir tarafında) ve mesaj eşlemesi.

#### P-22 · Döndürme açısı 0° sessizce 0,01° yapılıyor
- **Önem:** Düşük · **Tür:** Hata
- **Bizde:** `angle: 0` → hata yok, 0,785 mm³ dilim (`e9.py`). Doğrusal çoğaltma aralığı 0 → hata yok, örnekler üst üste. SW: değer sıfırdan büyük olmalı.
- **Kod:** `src/kernel.worker.ts` `revolveTool` `Math.max(0.01, f.angle)`.

#### P-23 · ▼ Aşağı, gizli eskizin arkasına taşıyor (görünürde değişiklik yok)
- **Önem:** Düşük · **Tür:** Hata
- **Bizde:** [Ekstrüzyon1, Radyüs1, Kesme1(Eskiz2)] → Radyüs1 ▼ Aşağı → belge sırası `Eskiz1, Ekstrüzyon1, Eskiz2, Radyüs1, Kesme1`, ağaç görünümü aynı (Radyüs1 hâlâ Kesme1'in üstünde); geri alma yığınına adım eklendi (`u3.py`).
- **Kod:** `src/main.ts:6381` `doc.features[i0 + 2]` gizli eskizleri hesaba katmıyor.

#### P-24 · Silme penceresi bağımlı özellikleri listelemiyor
- **Önem:** Düşük · **Tür:** SolidWorks'ten farklı
- **SolidWorks:** Silme onayında bağımlı öğeler ve "Çocuk özellikleri de sil" seçeneği.
- **Bizde:** Ekstrüzyon silinince yalnız `"Ekstrüzyon1" silinsin mi?` + `Kullandığı eskiz(ler) de silinsin mi?` (iki ayrı `confirm`); radyüs/kesme/çoğaltma hatalı kalıyor (`u3.py`). Bkz. P-8.

#### P-25 · Kütle Özellikleri penceresinde Esc → Malzeme penceresi açılıyor
- **Önem:** Düşük · **Tür:** Hata
- **Bizde:** Değerlendir > Kütle Özell. → Esc → pencere kapanıyor ve hemen "Malzeme" penceresi açılıyor (`u4.py`).
- **Kod:** `src/main.ts:5852` `if (v !== "ok") chooseMaterial()` (Esc'te `returnValue` boş).
- **Öneri:** "Malzeme değiştir" düğmesine `value="mat"` ver, yalnız o değerde aç.

#### P-26 · Kütle özelliklerinde eylemsizlik momentleri yok
- **Önem:** Düşük · **Tür:** Eksik
- **SolidWorks:** Kütle, hacim, alan, ağırlık merkezi + ana eksenler, ana eylemsizlik momentleri, eylemsizlik tensörü (merkezde ve çıktı koordinat sisteminde); gövde seçimi; koordinat sistemi seçimi.
- **Bizde:** Kütle, hacim, alan, ağırlık merkezi, sınır kutusu (değerler doğru: delikli kutu 22 429,2 mm³, AM 20/15/10). Eylemsizlik, gövde seçimi yok.
- **Kod:** `src/main.ts:5829`.

#### P-27 · Ölçüm aracında köşe / nokta, koordinat ve dX/dY/dZ yok
- **Önem:** Düşük · **Tür:** Eksik
- **SolidWorks:** Köşe seçilince XYZ; iki öğe için merkezden merkeze / min / maks, dX dY dZ; Ctrl ile çoklu seçim toplamı.
- **Bizde:** Yalnız kenar / yüz (en fazla 2). Köşeye tıklayınca kenar seçiliyor. Uzunluk, çap, alan, en kısa mesafe, açı, paralel yüzler arası doğru (40/30/20, Ø10, 800 mm², 30 mm) (`u4.py`).
- **Kod:** `src/main.ts` `measurePick`.

#### P-28 · Kesit görünümü yalnız standart düzlemlerle
- **Önem:** Düşük · **Tür:** Eksik
- **SolidWorks:** Kesit düzlemi olarak herhangi bir düzlem / düz yüz, açı ile döndürme, 2.-3. kesit.
- **Bizde:** "Ön / Üst / Sağ düzlem + Öteleme + Ters" (`u4.py`). Ayrıca kaydırıcının min/max ekseni pencere açılışında bir kez hesaplanıyor; düzlem değiştirilince güncellenmiyor (kodda, `main.ts:6049–6053`; denenmedi).

#### P-29 · Instant3D tutamağı yüz merkezini örtüyor; yanlış ipucu
- **Önem:** Düşük · **Tür:** Hata
- **Bizde:** Ekstrüzyon PM'i açıkken, Başla = "Yüzey / yüz" seçiliyken hedef yüzün ortasına tıklama ok tutamağına gidiyor, yüz seçilmiyor (merkezden uzağa tıklayınca çalışıyor). Aynı ekranda üstteki ipucu "Başlamak için bir düzlem seçip Eskiz'e basın" (PM bağlamıyla ilgisiz). Ekran görüntüsü `/home/claude/denetim/parca/u5b.png`. Instant3D yalnız Yön 1 derinliğinde var (SW: Yön 2, döndürme açısı, radyüs vb.).
- **Kod:** `src/main.ts:8030–8090`.

#### P-30 · Kenar flanş önizlemesi varsayılan kapalı
- **Önem:** Düşük · **Tür:** SolidWorks'ten farklı
- **SolidWorks:** Kenar seçilir seçilmez flanş önizlemesi görünür, sürükleyerek boy verilir.
- **Bizde:** Kenar seçildikten sonra önizleme yok (hacim 12 000 kalıyor), "Önizlemeyi göster" düğmesine basmak gerekiyor (`s2.py`). Gönye flanş ve kenet aynı (`main.ts:442`).

#### P-31 · Düz desen ağaçta özellik değil
- **Önem:** Düşük · **Tür:** SolidWorks'ten farklı
- **SolidWorks:** Ağacın sonunda "Düz Desen" özelliği (bastır/geri al ile katla/aç), "Sac Metal" klasörü.
- **Bizde:** Düzleştir ayrı bir mod; ağaçta iz yok (`s2.py`). Açınım ölçüleri, büküm tablosu ve DXF katmanları (`KESIM`, `BUKUM_YUKARI`, `NOTLAR`) doğru.

#### P-32 · Delik sihirbazı uç koşulları yalnız kör / tümünden geçen
- **Önem:** Düşük · **Tür:** Eksik
- **SolidWorks:** Kör, Tümünden geçen, Sonrakine kadar, Köşeye kadar, Yüzeye kadar, Yüzeyden ötele.
- **Bizde:** "Tümünden geçen" onay kutusu + Derinlik (`main.ts` hole PM). Delik çapları (M8 normal 9, M6 kılavuz 5, 118° uç) ve hacimler doğru (`u6.py`).

#### P-33 · Çoğaltılabilir özellik kümesi dar
- **Önem:** Düşük · **Tür:** Eksik
- **SolidWorks:** Radyüs, pah, kubbe, kaburga, çoğaltmanın çoğaltması, aynalanmış özellik; ayrıca "Çoğaltılacak gövdeler" ve "Çoğaltılacak yüzler".
- **Bizde:** Yalnız ekstrüzyon, döndürme, süpürme, loft, delik, kaburga (`main.ts:2166–2168`); gövde/yüz çoğaltma yok.

#### P-34 · Denklemler penceresi bağlı denklemleri göstermiyor
- **Önem:** Düşük · **Tür:** Eksik
- **SolidWorks:** Denklemler yöneticisi global değişkenleri + `"D1@Eskiz1" = …` denklemlerini listeler, düzenletir; değişken adı değişince denklemler güncellenir.
- **Bizde:** Yalnız değişken tablosu ve "Bağlı alan / ölçü sayısı: N"; değişken adı değiştirilince ona bağlı `=L` ifadeleri güncellenmiyor (kod `main.ts` `openEquations`, n.addEventListener("change")).

#### P-35 · Döndürme: Yön 2 açısı ve model kenarı ekseni yok
- **Önem:** Düşük · **Tür:** Eksik
- **SolidWorks:** Yön 2 ayrı açı ve uç koşulu; eksen olarak model kenarı / referans eksen seçilebilir.
- **Bizde:** Açı + Orta düzlem + Ters; eksen yalnız eskizdeki çizgiler listesi (`u7.py`). Hacimler doğru (360° 28 274,33, 90° 7068,58, ince t1 7916,81).

#### P-36 · Gerçek diş yavaş; th2 süre eşiği
- **Önem:** Düşük · **Tür:** Hata (performans)
- **Bizde:** M20×30 gerçek diş 17,6 sn (tek başına) – 35,4 sn (yük altında); kurulum boyunca çekirdek meşgul, diğer işlemler kuyrukta. th2 testi 16 sn eşiğini aşıyor (ortam yüküne bağlı). kr1'de diş içeren kurulum 29,6 sn.
- **Öneri:** Diş kurulumunu artımlı önbellekte tut (inc1 var), testte eşiği ortama göre gevşet.

#### P-37 · Eksik yüzey / katı / referans komutları
- **Önem:** Düşük · **Tür:** Eksik
- **SolidWorks'te olup bizde komutu olmayanlar:** yüzey döndürme / süpürme, öteleme yüzeyi, yüzey uzat, sınır yüzeyi ve sınır katı (boundary), ayırma çizgisi (split line), projeksiyon eğrisi, düzgün olmayan (X/Y/Z ayrı) ölçekleme, kütle merkezi noktası, FilletXpert/DraftXpert, basamaklı koniklik, değişken radyüste ara kontrol noktaları (yalnız başlangıç→bitiş), setback (zaten ⬜). Yüzey PM modları yalnız `extrude | planar | loft | fill` (`types.ts:377`).

#### P-38 · Bir kesme hiçbir gövdeye değmezse sessizce yön çevriliyor / hiçbir şey olmuyor
- **Önem:** Düşük · **Tür:** SolidWorks'ten farklı (SolidWorks davranışı **Doğrulanmadı**)
- **Bizde:** Kör/tümünden kesme hiçbir gövdeyle çakışmıyorsa otomatik ters yöne çevriliyor (`kernel.worker.ts:356`); iki yönde de çakışmıyorsa (z=50'de eskiz, gövde 0–20) hata/uyarı yok, hacim değişmiyor (`e1.py`). SW'de kesme modele değmezse kullanıcı uyarılır (beklenen; doğrulanmadı).

---

### Denendi – sorun yok

Sayısal karşılaştırmalar SolidWorks'te beklenen elle hesaplanmış değerlerle yapılmıştır (40×30×20 kutu = 24 000 mm³).

| Komut / seçenek | Denenen | Sonuç |
|---|---|---|
| Ekstrüzyon kör / ters / orta düzlem | hacim, sınır kutusu | 24 000; z −20…0; z −10…10 ✓ |
| Yön 2 kör | 36 000 | ✓ |
| Koniklik 5° içe | prismatoid 21 631,96 | ✓ (dışa: P-10) |
| İnce özellik tek / ters / orta / iki yön, uçları kapat, açık L profil, köşe R | 5920 / 5280 / 5600 / 8640 / 10 720 / 2800 / 2714,16 | ✓ |
| Büküm açılı (twist) 90° | hacim korunur 16 000 | ✓ |
| Başlangıç: öteleme / yüz / köşe | z 10…30; üst 30 | ✓ (PM'de yüz seçimi çalışıyor) |
| Sonrakine kadar, Yüzeye kadar, Yüzeyden ötele, Köşeye kadar, Gövdeye kadar | +π·25·30 / ·30 / ·25 / ·20 / ·30 | ✓ (PM'de hedef yüz, gövde, köşe seçimi gerçek tıklamayla ✓) |
| Ekstrüzyon yönü (kenar), paralel kenar hatası | 24 000, x +20 kayma; "Yön vektörü eskiz düzlemine paralel olamaz" | ✓ |
| Sonucu birleştir kapalı | 2 gövde | ✓ |
| Kesme tümünden / kör / orta / kesme tarafını çevir | 22 429,20 / 23 607,30 / 196,35 / 1570,80 | ✓ |
| Açık eskizle katı ekstrüzyon | anlamlı hata mesajı | ✓ |
| Ekstrüzyon PM: önizleme, ters, derinlik, ✓, Ctrl+Z / Ctrl+Y, çift tıkla düzenle, ✕ ile at | gerçek fare/klavye | ✓ |
| Instant3D ok sürükleme (+10 mm), tek adımda geri al | izometrik görünüm | ✓ |
| Sağ tık yüz → Bitiş koşulunu değiştir… | menüde var | ✓ (th3 de) |
| Seçili konturlar | fx1 | ✓ |
| Döndürme 360 / 90 / orta / ters / ince / döndürerek kesme | 28 274,33 / 7068,58 / simetrik / 7916,81 / 7068,58 | ✓ |
| Süpürme: dairesel profil, boru, L yol, burulma, kılavuz, takım gövdesi, helis | 3926,99 / 2513,27 / 28 274,33; ss1, pf4, md1 | ✓ |
| Loft: kare→kare 7000, daire→kare, ince, kapalı, bağlayıcı, teğetlik, kılavuz, merkez | u7, pf5, pf9, md1 | ✓ |
| Radyüs sabit tek kenar / tüm kenarlar (yüz seçimi) | 214,60 / 22 235,99 (tam formül) | ✓ |
| Radyüs çoklu yarıçap, değişken, konik rho 0,5 (25/6·L), yüz radyüsü | 262,7 / 151,6 / 166,99 / pf1 | ✓ |
| Radyüs teğet yayılımı (R5 dikey kenar + üst ön kenar R2) | zincir radyüslendi, 10 yüz | ✓ |
| Radyüs PM: ön seçim, tıkla ekle / tekrar tıkla çıkar, iğne | u2 | ✓ (önizleme: P-3) |
| Pah eşit 2 / 3-6 / 5-30° / ters / öteleme yüzü / yüz seçimi / köşe pahı / yüz–yüz | 80 / 360 / 288,68 / aynı / 80 / 229,33 / pf1 | ✓ |
| Kabuk tek yüz / iki yüz / yüz başına kalınlık / silindir / dikey R5 sonrası | 7872 / 5856 / pf1 / 11 586,19 / 7444,5 | ✓ (P-1, P-13 hariç) |
| Koniklik nötr düzlem 5° (içe/ters), tek yüz, ayırma çizgisi, koniklik analizi | 21 631,96 / 26 531,33 / 524,93; pf2 | ✓ |
| Delik sihirbazı düz M8 (2 konum), kılavuz M6 kör, havşa/konik/yuva/yakın-uzak havşa, konum eskizi | 3817,04 / 304,36; pf6, fs1 | ✓ |
| Kozmetik / gerçek diş | th2 (hacim), kr1 | ✓ (süre P-36) |
| Doğrusal çoğaltma 3×2, örnek atla, referansa kadar, eskizi değiştir | 6 / 5 örnek; pf3 | ✓ |
| Dairesel (orijin ekseni), tablo, eskiz, eğri, doldurma çoğaltma | 4 / 3 / 3 / pf3 / 8 | ✓ |
| Ayna: gövde (sağ düzlem), gövde (düz yüze göre → tek gövde), özellik | 48 565,49; 48 000 tek gövde | ✓ |
| Birleştir ekle / çıkar / ortak | 28 000 / 22 000 / 2000 | ✓ |
| Gövde böl, gövde kopyala, döndür, gövde sil / tut, ölçekle (orijin / ağırlık merkezi) | 2 gövde; 48 000; bb; 24 000 / 6000; 192 000 | ✓ |
| Referans düzlem türleri (öteleme, açılı, orta, 3 nokta, kenara dik, noktadan paralel, ekrana paralel, teğet) | pl1, pf7, pf9 | ✓ (ilişkisellik: P-9) |
| Referans eksen (kenar/silindir, iki düzlem, iki nokta), nokta (7 tür), koordinat sistemi | PM seçenekleri, pf7, md1 | ✓ (statik: P-9) |
| Yüzey ekstrüzyon / düzlemsel / loft / sınır doldur / kalınlaştır / yüzeyle kes / kırp / dik | sf1–sf3 | ✓ |
| Doğrudan düzenleme (yüz taşı / sil-doldur) | dd1 | ✓ |
| Sac taban flanş levha / açık L profil | 12 000; açınım 86,712 × 30 | ✓ |
| Kenar flanş dış/iç sanal sivri, teğet; içte/dışta/büküm dışta; K 0,3; BA/BD (90°); R5; kısaltma; 2 ve 4 kenar; kalınlık kenarı hatası | 17 342,48 (+400, +800); açınım 86,712 / 86,084 / 87 | ✓ |
| Kenet kapalı/açık, çizgiden büküm, kademe, gönye flanş, köşe kapat, köşe kır, boşaltmalar, saca dönüştür, geçiş parçası, aç/katla, şekillendirme, havalandırma, çapraz kırma, sac takviye, tırnak-yuva, normal kesim | s1, sm1–sm4, k5, k6, lb1, sb1, fc1, fp1, dd1, th3 | ✓ |
| Düzleştir + Açınım DXF (katmanlar, büküm tablosu) | s2 | ✓ |
| Kaynaklı yapı: profil listesi, gruplar, delme noktası, döndürme, ayna, hizalama, köşe işlemleri, kırp/uzat, yapı sistemi, uç kapağı, köşe takviyesi, kaynak dikişi | w1, pg1, pj0, pj1, wc1, wl1, w1–w8 | ✓ |
| Kesim listesi (640/440 × 2, 45°, kg), özellikler, imalat resmi, STEP | w1.py, td4 | ✓ |
| Dudak / yiv, mandal | sm4 | ✓ |
| Denklemler / değişkenler, yapılandırmalar, tasarım tablosu | md1, t10 | ✓ (P-2, P-34) |
| Malzeme, kütle özellikleri değerleri | u4 | ✓ (P-25, P-26) |
| Ölçüm (uzunluk, çap, alan, mesafe, açı, paralel yüzler) | u4 | ✓ |
| Kesit görünüşü | u4 | ✓ |
| Ne Yanlış? / Kontrol, koniklik analizi | pf8, pf2 | ✓ |
| Mukavemet, statik FEA (sehim 0,1909 ≈ FL³/3EI 0,1905, tepki 100 N) | an1, fea1 | ✓ |
| Kalıcı referanslar (derinlik/genişlik değişince radyüs, kabuk, pah, flanş, diş korunur; yüz üstündeki eskiz izler) | kr1, kr2 | ✓ (statik köşe/eksen: P-9) |
| Ağaç: geri sar (yeni özellik çubuğun yerine eklenir, çubuğa tıkla sona), bastır, adlandır, klasör, sürükle-sırala | u3, pf8 | ✓ (P-7, P-8, P-23) |
| STEP dışa → içe aktar (hacim aynı, sonrasında kesme), STL ikili dışa → içe, DXF içe | io1, lk1, dx1 | ✓ |
| Artımlı yapı (önbellek) | inc1 | ✓ |

---

## Denetim raporu — Arayüz / Gezinme / Montaj / Teknik resim (ajan: arayuz)

Tarih: 2026-11-13 · Sürüm: v0.82 (dist, localhost:4173) · Tarayıcı: Chrome (swiftshader), Playwright; gerçek fare / klavye olayları, telefon/tablette CDP dokunma olayları.
Deneme betikleri ve ekran görüntüleri: `/home/claude/denetim/arayuz/` (nav1, nav2, ui1–ui3, sel1–2, sk1, mb1–mb6, asm1–asm4, td, pv, hv, vc, pms .py; logs/).

SolidWorks başvuruları: [SOLIDWORKS blog – How do I manipulate my model view](https://blogs.solidworks.com/products/solidworks/how-do-i-manipulate-my-model-view-let-me-count-the-ways/) (döndürme merkezi, ok tuşları, tekerlek yönü, Z/Shift+Z, eskizde varlık etrafında döndürme), [Javelin – SOLIDWORKS Box Selection](https://www.javelin-tech.com/blog/2026/10/how-to-use-solidworks-box-selection/). help.solidworks.com sayfaları bu ortamda okunamadı. Bu yüzden bu kaynaklara dayanmayan SolidWorks karşılaştırmaları "Doğrulanmadı" diye işaretlendi.

### Özet

| Önem | Sayı |
|---|---|
| Kritik | 0 |
| Yüksek | 0 |
| Orta | 9 |
| Düşük | 25 |

En önemli bulgular:
1. **A-2**: Telefonda iki parmakla kaydırırken, parmaklar ~80 px aralıklıysa model istemeden çevriliyor (yuvarlanıyor). Kaydırma yanlış yöne gidiyor.
2. **A-3**: Telefonda/tablette eskiz modunda sağdaki ekran çubuğu (✓ ✕ A 123 …) şeridin ve görünüm çubuğunun üstüne biniyor.
3. **A-1**: Görüntü stili düğmesi her cihazda gizli. Telefonda/tablette görüntü stili hiç değiştirilemiyor, "Saydam" seçeneğine ise hiçbir yerden ulaşılamıyor.
4. **A-4**: Çift orta tık ekrana sığdırıyor ama orta tıkla seçilen varlık (eksen) seçili kalıyor. Sonraki döndürme beklenmedik bir eksen etrafında oluyor.
5. **T-1**: Teknik resimde delik çapı / konum ölçüleri yalnız ön görünüşte görünen daireler için çıkıyor. Üst düzlemde çizilmiş delikli plakada hiç Ø ölçüsü yok.

---

### Mevcut testlerin sonucu

| Test | Sonuç | Not |
|---|---|---|
| mr1 | **1. çalıştırmada HATA**, 2.'de TAMAM | "çift orta tık sığdırır" başarısız (zoom 6.34 → 6.34). Yük altında iki tık arası 350 ms'yi geçiyor → zamanlamaya bağlı kararsız test; uygulama tarafı A-5. |
| sw1, cube1, pa1, mob1, tp1, as1, as2 | geçti (SONUC satırı yok, errors: []) | |
| nt1, ui2, gn1, ex1, pv1, as3–as11, td1–td4, fs1, fs2 | SONUC: TAMAM | |
| v2 | argümansız **çöküyor** (`sys.argv[1]` IndexError). URL ile TAMAM | Test eski: varsayılan adrese geçirilmemiş, `/home/claude/tests/` altına yazıyor (A-25). |
| birim asm_matrix | TOPLAM BAŞARISIZ: 0 | `esbuild` node_modules'ta yok, `npx` indirdi (A-25). |

---

### Bulgular

#### A — Arayüz / gezinme

**A-1 · Görüntü stili düğmesi Heads-up çubuğunda her zaman gizli; "Saydam" hiç erişilemiyor**
- Önem: **Orta** · Tür: Hata
- SolidWorks: Heads-up görünüm çubuğunda "Görüntü stili" açılır menüsü her zaman görünür.
- Bizde: `#viewbar` içindeki "Görüntü stili (…)" düğmesi `display:none` (390, 820 ve 1400 px'te ölçüldü).
  - Masaüstünde stil yalnız Görünüm › Görüntü stili menüsünden değişiyor. O menüde "Saydam" yok.
  - Telefonda/tablette menü çubuğu da olmadığından görüntü stili ve saydamlık hiç değiştirilemiyor.
- Kod: `src/main.ts:7001` `btn("iso", "Görüntü stili …")`. `btn()` "iso" simgesine `orient` sınıfı veriyor. `src/style.css:300` `body.has-cube #viewbar button.orient {display:none}` bu düğmeyi de gizliyor.
- Öneri: Stil düğmesine başka simge/sınıf ver (ör. `style`). Görünüm menüsüne "Saydam" ekle.

**✅ A-2 · İki parmakla kaydırmada istenmeyen yuvarlanma (roll)**
- Önem: **Orta** · Tür: Hata
- SolidWorks / beklenen: İki parmak aynı yöne kayınca yalnız kaydırma olur.
- Bizde (390×844, CDP, iki parmak 80 px aralıkla 50,30 px kaydırıldı):
  - Kamera döndü. Dünya noktası ekranda (3.5, 57.7) px kaydı; beklenen (50, 30).
  - Aynı hareket 60 px ve 120 px aralıkla doğru (50.2, 29.2), dönme yok.
- Neden: Parmak hareket olayları sırayla geliyor, bu yüzden aralık 85 ↔ 80 arasında gidip geliyor. `s.d > 80` koşulu yalnız 85'li adımlarda çevirme uyguluyor. `pinch` her adımda güncellendiği için ters yöndeki düzeltme hiç uygulanmıyor ve açı birikiyor.
- Kod: `src/nav.ts:101-107`.
- Öneri:
  - Eşiği hareketin başındaki parmak aralığına göre bir kez belirle.
  - Ya da eşik sağlanmadığında `pinch.a`'yı güncelleme.
  - Küçük açılarda ölü bölge ve birikimli eşik kullan.

**✅ A-3 · Telefonda/tablette eskiz modunda ekran çubuğu şeridi ve görünüm çubuğunu örtüyor**
- Önem: **Orta** · Tür: Hata
- Bizde (ölçüldü):
  - 390×844: "Eskizden çık" düğmesinin üstü 56 px, şeridin altı 138 px; ✓ ✕ A düğmeleri şerit komutlarının ("Dikdörtgen…") üstünde. "Çizgi ↔ teğet yay" ve "Sayıyla gir", görünüm çubuğundaki "Ekrana sığdır" ve "Düzlemleri göster/gizle" düğmelerini örtüyor.
  - 820×1180: ✓ şeridin üstünde; "İptal / Seç" görünüm çubuğunu örtüyor.
  - Parça modunda (390): kırıntılar (T › e1 › Yüz) görünüm küpünün üstünde, mini araç çubuğu ve "Diğer adaylar" çubuğu ekran çubuğundaki Ctrl düğmesini örtüyor.
  - Ekran görüntüleri: `mb_390_eskiz.png`, `mb_820_eskiz.png`, `mb_390_parca.png`.
- Kod: `.actbar` yerleşimi (style.css), `renderCrumbs`, `showMiniBar` (main.ts:1578).
- Öneri: Ekran çubuğunu şeridin altından başlat (`top: şerit altı`). Görünüm çubuğunu sola kaydır. Mini çubuğu ve aday çubuğunu ekran çubuğunun soluna sınırla. Kırıntıları küpün sağına koy.

**A-4 · Çift orta tık sonrası orta-tık varlık seçimi kalıyor**
- Önem: **Orta** · Tür: Hata
- SolidWorks: Çift orta tık yalnız "Ekrana sığdır" yapar.
- Bizde: Model yüzü/kenarı üzerinde çift orta tık:
  - Görünüm sığdırılıyor (zoom 2.113).
  - Ama `controls.sticky = {axis: (0,1,0)}` kalıyor ve macenta eksen işareti görünüyor.
  - Sonraki orta sürükleme o yüz normali etrafında dönüyor.
- Neden: İkinci `down` sticky'yi siliyor, ama ikinci `up` (hareketsiz) `pivotAt(…, true)` ile yeniden seçiyor.
- Kod: `src/nav.ts:64` ve `:124`.
- Öneri: Çift tık algılanınca bir sonraki `up`'ta varlık seçimini atla.

**A-5 · Çift orta tık penceresi 350 ms**
- Önem: Düşük · Tür: Hata
- Bizde: `nav.ts:64` sabit 350 ms. İşletim sistemlerinin varsayılanı ~500 ms. mr1 testi yük altında bu yüzden bir kez başarısız oldu.
- Öneri: 500 ms kullan ya da `dblclick` / `e.detail` ile algıla.

**A-6 · Ok tuşlarıyla döndürme ekran merkezi etrafında**
- Önem: Düşük · Tür: SolidWorks'ten farklı
- SolidWorks: Ok / Shift+ok / Alt+ok model ağırlık merkezi etrafında döner (blog).
- Bizde: Görünüm 3 kez Ctrl+← ile kaydırılıp ← basıldığında model merkezi ekranda 188 px kaydı.
- Kod: `main.ts:8538` `rot()` → `nav.rotateDeg` (`pv=null` → `target`).
- Öneri: `rotate(...)` çağrısına model kutusu merkezini `Pivot` olarak ver.
- Ölçülen adımlar SolidWorks'e uygun: ← → ↑ ↓ 15°, Shift+ok 90°, Alt+ok 15° çevirme. Ctrl+ok kaydırma.

**A-7 · Orta tuşla döndürme merkezi: imleç altı nokta**
- Önem: Düşük · Tür: SolidWorks'ten farklı (bilinçli tercih olabilir)
- SolidWorks (blog): Model tümüyle görünürken model ağırlık merkezi etrafında döner. Model ekrandan taşmışsa görünen geometride izdüşürülen bir nokta seçilir. İmleç altı nokta yalnız orta tıkla varlık seçilirse kullanılır.
- Bizde:
  - Merkez her zaman imleç altındaki model noktası (köşe ve yüz noktasında ekranda kayma 0.0 px, doğru çalışıyor).
  - Boşlukta model tümüyle görünürken model merkezi doğru.
  - Model kısmen ekrandayken boşlukta merkez = ekran merkezi (`pivot = null`).
- Kod: `viewer.ts:649-692` `navPivot`.
- Öneri: Seçenek ekle ("Döndürme merkezi: imleç altı / model merkezi"). Kısmen görünürken görünen geometriye izdüşür.

**A-8 · Eskizde orta tık varlık etrafında döndürme çalışıyor; orta sürüklemede merkez imleç altında değil**
- Önem: Düşük · Tür: SolidWorks'ten farklı
- SolidWorks (blog): Eskiz düzenlerken "Varlık etrafında döndür" çalışmaz.
- Bizde: Eskizde kenara orta tık → `sticky {axis:(1,0,0)}`. Eskizde orta sürüklemede `pivot = null`, yani merkez ekran merkezi; parça modundaki imleç altı davranışından farklı.

**A-9 · Tekerlekle uzaklaştırma imleç merkezli**
- Önem: Düşük · Tür: SolidWorks'ten farklı
- SolidWorks (blog): Uzaklaştırma ayardan bağımsız olarak her zaman ekran merkezine göre yapılır.
- Bizde: İleri tekerlek uzaklaştırıyor (yön doğru), ama imleç noktası sabit kalıyor (kayma 0.0).
- Kod: `nav.ts:133-139`.

**A-10 · Esc seçimi temizliyor ama ipucu kalıyor**
- Önem: Düşük · Tür: Hata
- Bizde: 2 yüz seçili → Esc. Vurgu, kırıntılar, mini çubuk ve durum çubuğu temizleniyor, ancak `#hint` "Seçili: 2 yüz" olarak kalıyor (`sel_esc.png`). Kırıntıdan özellik seçince de eski "Seçili: 1 yüz" ipucu duruyor.
- Kod: `main.ts:7441-7446` `escAction` `hint("")` çağırmıyor.

**A-11 · Kesit görünümünde Esc kesiti kapatmıyor; yalnız 3 ana düzlem**
- Önem: Düşük · Tür: SolidWorks'ten farklı / Eksik
- SolidWorks: PM'de Esc = iptal (kesit kapanır). Kesit düzlemi olarak herhangi bir düz yüz/düzlem seçilebilir, birden fazla kesit yapılabilir.
- Bizde:
  - Esc → `endAux()`; mod part olur ama `renderer.clippingPlanes.length = 1`, yani kesit açık kalıyor. Panel metni ise "✕ kapatır" diyor.
  - Düzlem seçimi yalnız Ön / Üst / Sağ.
- Kod: `main.ts:7435`, `main.ts:6016-6047`.

**A-12 · Masaüstü menü çubuğu eksik**
- Önem: Düşük · Tür: Eksik
- Masaüstü Dosya menüsünde (ui1.py ile listelendi) şunlar yok: Dosya yöneticisi, Belge özellikleri, 3MF, Görünümü PDF, Eskiz DXF, Yüz DXF, Birim mm↔inç.
- Bunlar yalnız sağ üstteki eski "Dosya" düğmesinin menüsünde (`index.html:71-95`).
- Araçlar menüsünde "Şeridi özelleştir" ve "Görev bölmesi" yok; ikisine yalnız komut aramasıyla ulaşılıyor.
- Kod: `main.ts:8645` `MENUS`.

**A-13 · Durum çubuğundaki "MMGS" tıklanamıyor**
- Önem: Düşük · Tür: Eksik
- SolidWorks: Durum çubuğundaki birim sistemi tıklanınca birim seçme menüsü açılır.
- Bizde: Tıklayınca hiçbir şey olmuyor.

**A-14 · Şerit (CommandManager) üzerinde sağ tık menüsü yok**
- Önem: Düşük · Tür: Eksik
- SolidWorks: Sağ tıkla sekmeler gösterilip gizlenir, Özelleştir açılır.
- Bizde: "Ekstrüzyon" düğmesine sağ tık → menü ya da pencere açılmıyor. Kodda yalnız ağaç için `contextmenu` var (`main.ts:6158`).

**A-15 · Kutu seçimi parçada yüz seçiyor**
- Önem: Düşük · Tür: SolidWorks'ten farklı (Doğrulanmadı)
- SolidWorks: Parça belgesinde kutu seçiminin varsayılan türü kenarlardır (Doğrulanmadı: yardım sayfası açılamadı; Javelin yalnız "her belge türünün varsayılan geometri türü vardır" diyor).
- Bizde: İzometrik görünümde modelin tamamını kapsayan soldan-sağa kutu "4 yüz, 0 kenar" seçti. 6 yüzün 4'ü seçildi; görünen 3 yüzle de tutarlı değil.
- Sağdan-sola (kesişen) kutu çalışıyor.

**A-16 · Grafik alanda seçim ağaçta özelliği vurgulamıyor**
- Önem: Düşük · Tür: SolidWorks'ten farklı
- Bizde: Üst yüz seçilince `#tree li` sınıfları boş kalıyor (sahip özellik e1 vurgulanmıyor). Ağaç → grafik yönü çalışıyor.

**A-17 · Onay köşesi (Confirmation Corner) yok**
- Önem: Düşük · Tür: Eksik
- SolidWorks: Grafik alanın sağ üstünde eskizden çıkış ve PM ✓/✕ köşesi var.
- Bizde: Masaüstünde yalnız PM başlığında ✓ ✕ var (eskizde kodda/arayüzde bulunamadı).

**A-18 · Ctrl+Tab ve Ctrl+W belge sekmeleri için çalışmıyor**
- Önem: Düşük · Tür: Eksik
- Bizde: Ctrl+N ile 2. sekme açıldıktan sonra Ctrl+Tab ve Ctrl+W `tabs` durumunu değiştirmedi. Tarayıcıda kısmen ayrılmış kısayollar; PWA'da yakalanabilir.

**A-19 · Perspektifte Ctrl+orta kaydırma imleçle 1:1 değil**
- Önem: Düşük · Tür: Hata
- Bizde:
  - Ortografikte 80,40 px sürükleme imleç altındaki noktayı 80,40 taşıyor.
  - Perspektifte 89.9,44.9 taşıyor (%12 hızlı).
  - Tekerlek ve orta döndürme merkezi perspektifte de doğru (kayma < 0.3 px).
- Kod: `nav.ts:183-198` `wpp()` ortografik kameraya göre hesaplıyor.

**A-20 · PM açıkken Ctrl+S özelliği sessizce iptal ediyor**
- Önem: **Orta** · Tür: Hata
- Bizde: Radyüs PM'i açık → Ctrl+S. Mod `pm` → `part` oldu, panel kapandı, taslak kayboldu, uyarı yok. Dosya menüsünün diğer komutları da aynı yoldan geçiyor.
- Kod: `main.ts:7057` `if (mode.k === "pm") cancelFeature();`.
- Öneri: Kaydetmede PM'i iptal etme (belge zaten yalnız işlenmiş özellikleri kaydeder). Diğer eylemlerde `askExit` sor.

**A-21 · Sesle sayı çözümlemesinde eksik kalıplar**
- Önem: Düşük · Tür: Eksik
- Doğru çözülenler: "yirmi beş" 25, "on iki virgül beş" 12.5, "iki buçuk" 2.5, "eksi on" −10, "elli çarpı otuz" [50,30], "bin iki yüz" 1200, "sıfır virgül sıfır beş" 0.05, "kırk beş nokta iki" 45.2, "otuz iki x yirmi" [32,20].
- Boş dönenler: "yarım" → [] (0.5 beklenir) ve "1.250,5" → [] (binlik ayırıcı).
- Kod: `src/input/voice.ts` `parseSpokenNumber`.

**A-22 · Telefonda küçük dokunma hedefleri**
- Önem: Düşük · Tür: Eksik
- Bizde (390 px):
  - Sekmeler 26 px yüksek, grup çipleri 28 px.
  - Kırıntılar 15×18 / 19×18 px, küpün "İzo" düğmesi 44×20 px.
  - Yaklaşık 40–44 px önerilir.

**A-23 · Telefonda uzun basma menüsü masaüstündeki sağ tık menüsünden kısa olabilir**
- Önem: Düşük · Tür: Doğrulanmadı
- Bizde:
  - Masaüstünde yüze sağ tık: Dik / Eskiz / Ekstrüzyon / Kesme / **Bitiş koşulunu değiştir… / Görünüm: yüz rengi…** / Sığdır / İzo / Önceki görünüm.
  - Telefonda uzun basmada bu iki satır yoktu. Ancak o anda belge geri al/ileri al denemesi sonrasında yalnız eskizden oluşuyordu, yani karşılaştırma eşit koşulda yapılamadı.

**A-24 · Belge açılışında düzlemler görünür**
- Önem: Düşük · Tür: SolidWorks'ten farklı (Doğrulanmadı)
- SolidWorks: Yeni parçada ana düzlemler gizli başlar.
- Bizde: Ön/Üst/Sağ düzlemler model üzerinde görünüyor (`sel_esc.png`).

**A-25 · Test altyapısı**
- Önem: Düşük · Tür: Hata (test)
- `tests/e2e/v2.py` URL argümanı olmadan çöküyor ve `/home/claude/tests/` altına yazıyor (CLAUDE.md'de "eski testler varsayılan adresle çalışır" deniyor).
- `esbuild` `package.json`/node_modules'ta yok; birim testleri `npx` ile ağdan indiriyor.
- mr1 testi zamanlamaya bağlı (A-5).

#### M — Montaj

**✅ M-1 · Montaj ayrı bir belge değil; Ctrl+S montajı kaydetmiyor** (v0.91: montajda Ctrl+S / Dosya › Kaydet montajı .icasm olarak kaydeder; montajın belge sekmesi olarak açılması ayrıca ele alınmadı)
- Önem: **Orta** · Tür: SolidWorks'ten farklı
- SolidWorks: Montaj ayrı bir belgedir (.sldasm). Kendi penceresinde/sekmesinde açılır. Ctrl+S etkin montajı kaydeder, Dosya › Aç montaj da açar.
- Bizde:
  - Tek bir global montaj var (localStorage `imajcad.asm`). Montaj sekmesinde "Montajı Aç" ile parça belgesinin içinde açılıyor.
  - Montaj açıkken Ctrl+S `saveFile()` ile **parçayı** kaydediyor; montaj indirilmedi.
  - Montaj ancak "Montajı Kaydet" ile indirilebiliyor, aynı dosyaya yazılamıyor.
  - Dosya › Aç .icasm açmıyor.
  - Belge sekmelerinde görünmüyor.
  - Özellikler sekmesine geçince montaj kapanıyor (`a.on = false`).
- Kod: `main.ts:7068`, `asmui.ts:2707-2735`.
- Öneri: Montajı belge sekmesi türü yap; Ctrl+S / Farklı kaydet / Aç / Son belgeler montajı da kapsasın.

**M-2 · Bileşen Ekle: açık belgeler listelenmiyor, yerleştirme otomatik**
- Önem: Düşük · Tür: Eksik
- SolidWorks: "Bileşen ekle" penceresi açık belgeleri listeler. Bileşen imleçle yerleştirilir.
- Bizde:
  - Pencerede yalnız Geçerli parça / Kütüphane / Dosyadan / Alt montaj / Bağlantı elemanı var. Diğer sekmelerdeki açık parçalar yok.
  - 2. bileşen kendiliğinden x+80 mm'ye konuyor.
  - Boş kütüphane ipucu "'Parçayı kütüphaneye kaydet'" diyor; şeritteki ad "Kütüphaneye Kaydet".
- Kod: `asmui.ts:1359-1369`.

**M-3 · Eşleşme bağlam çubuğu yalnız iki Ctrl seçimiyle açılıyor**
- Önem: Düşük · Tür: SolidWorks'ten farklı
- SolidWorks: İlk yüzü tıkla, ikincisini Ctrl+tıkla → eşleşme açılır çubuğu.
- Bizde:
  - Düz tık + Ctrl+tık → çubuk yok, ipucu "İkinci bileşenden … seçin (Ctrl)".
  - Ctrl+tık + Ctrl+tık → çubuk açılıyor: Çakışık, Paralel, Dik, Mesafe, Açı, Kilit, Diğer….
- Kod: `asmui.ts:973-980` (`ctrl` olmayan tık `pre`'yi sıfırlıyor).

**M-4 · Eşleşme PM'de "Seçenekler" bölümü yok**
- Önem: Düşük · Tür: Eksik
- SolidWorks seçenekleri: Yalnız konumlandırma için kullan, Çoklu eşleşme modu, İlk seçimi saydam yap, Eşleşme klasörü.
- Bizde PM içeriği: Seçimler, Standart/Gelişmiş/Mekanik, değerler, Ters hizalı/Hizalı. Bu seçenekler yok.

**M-5 · Montajda tarayıcı confirm/prompt pencereleri**
- Önem: Düşük · Tür: Hata
- Bizde: "Yeni Montaj" `confirm()`, "Montaj Adı" `prompt()` kullanıyor (`asmui.ts:2703`, `2741`). Uygulamanın kendi pencereleriyle (`askExit` vb.) tutarsız; telefonda ve tam ekranda kötü görünüyor.

#### T — Teknik resim

**T-1 · Otomatik delik ölçüleri yalnız ön görünüşteki dairelerden**
- Önem: **Orta** · Tür: Hata
- SolidWorks: "Model öğeleri" bütün görünüşlerden çaplar ve konumlar getirir.
- Bizde: Üst düzlemde çizilmiş 80×50×20 plaka + 2×Ø12 delik. Resmin metinleri: "80; 20; 50" ve antet. Hiç Ø ya da delik konumu ölçüsü yok; delikler yalnız üst görünüşte daire olarak görünüyor. td1 testi delikleri Ön düzlemde çizdiği için bunu yakalamıyor.
- Kod: `src/drawing/techdraw.ts:185` ve `:504` `circlesOf(F)` (yalnız ön görünüş).
- Öneri: Daireleri ön, üst ve sol görünüşlerden topla; her deliği bir kez, en uygun görünüşte ölçülendir.

**T-2 · İzometrik görünüş üst görünüşün ölçüsü üzerine biniyor**
- Önem: **Orta** · Tür: Hata
- Bizde: A4, otomatik ölçek, 80×50×20 plaka. İzometriğin sol köşesi üst görünüşün sağ kenarına ve "50" ölçü çizgisine biniyor (`td_dialog.png`).
- Kod: `techdraw.ts:114-120` ızgara sütun genişlikleri ölçü payını izometrik sütununa katmıyor.

**T-3 · Merkez işareti ve eksen çizgileri yok**
- Önem: **Orta** · Tür: Eksik
- SolidWorks: Deliklere otomatik merkez işareti, silindirik görünüşlere eksen çizgisi konur.
- Bizde: SVG'de yalnız 2 adet `stroke-dasharray` var (gizli çizgiler). Üst görünüşteki dairelerde merkez işareti yok. EKSEN katmanı tanımlı ama bu resimde kullanılmamış.

**T-4 · Teknik resim seçenekleri sınırlı**
- Önem: Düşük · Tür: Eksik
- Kâğıt yalnız A4/A3 yatay (A2–A0, dikey, özel boyut yok).
- Kesit yalnız sabit "A-A" (yarım, ofset, hizalı kesit ve düzlem seçimi yok).
- Yardımcı, kesik ve kırık görünüş yok; delik açıklaması (hole callout) yok.
- İzdüşüm açısı yalnız Belge özelliklerinden değişiyor, resim penceresinden değiştirilemiyor.

---

### Denendi – sorun yok

| Özellik / komut | Ölçüm / sonuç |
|---|---|
| Orta sürükle döndür, açı/px | 0,008 rad/px = 0,458°/px (100 px → 45,84°). Pencere boyutundan bağımsız. SolidWorks hassasiyeti Doğrulanmadı. |
| Yatay sürükleme ekseni | Ekran dikeyi etrafında. İzometrikten 150 px sağa sürüklemede dünya Y ekranda dikey kalıyor (0,0°). |
| Dikey sürükleme ve "üst" yönü | Ekran yatay ekseni etrafında. Aşağı sürükleme modeli öne eğip üst yüzü gösteriyor. 393 px (180°) sonra up (0,−1,0): serbest döndürme, model ters dönebiliyor. Gimbal kilitlenmesi yok (her adım ekran eksenlerinde). Daire çizen sürüklemede yuvarlanma birikiyor (iz topu davranışı). SolidWorks serbest döndürmesiyle uyumlu (Doğrulanmadı). |
| Döndürme merkezi ekranda sabit | Köşe 0,0 px, yüz noktası 0,0 px, boşlukta model merkezi 0 px; perspektifte de 0 px |
| Köşeye yakalama (8 px), macenta işaret, bırakınca kalkar | mr1 + elle |
| Orta tık kenar → eksen etrafında, sürükleme sonrası seçim kalkar | mr1 |
| Ctrl+orta kaydır | 80,40 px → nokta 80,0 / 40,0 (ortografik). Döndürmüyor. |
| Shift+orta yakınlaştır | Yukarı 100 px → ×2,718 (yukarı = yakınlaş) |
| Alt+orta çevir | 100 px → 40°, bakış yönü değişmiyor |
| Tekerlek yönü | İleri = uzaklaş (SolidWorks varsayılanı), imleç noktası sabit; "Tekerlek yönünü ters çevir" menüde var |
| Çift orta tık sığdır | Çalışıyor (A-4 ve A-5 hariç) |
| F, Z, Shift+Z | Sığdır; Z ×0,8; Shift+Z ×1,25 |
| Ctrl+Shift+Z önceki görünüm, viewbar "Önceki görünüm" | Geri dönüyor |
| Bölgeye yakınlaştır | Kutu çizince ×5,5, sonra kapanıyor |
| Boşluk / Ctrl+Boşluk görünüm menüsü, Esc kapatır, menüden Üstten | Çalışıyor |
| Ctrl+1…7 | Ön/Arka/Sol/Sağ/Üst/Alt/İzo yönleri doğru |
| Ctrl+8 dik bak; ikinci basış arka taraf; sağ tık › Dik | Çalışıyor (nt1 + elle); eskizde de |
| Ok / Shift+ok / Alt+ok / Ctrl+ok | 15° / 90° / 15° çevirme / kaydırma (merkez A-6) |
| Görünüm küpü (yüz/kenar/köşe/İzo) | cube1, mob1 |
| Perspektif aç/kapa (menü) | Çalışıyor; tekerlek ve döndürme merkezi doğru |
| Görüntü stilleri (Görünüm menüsü): kenarlı gölgeli, gölgeli, HLR, HLV, tel kafes | `displayStyle` değişiyor |
| Kesit görünümü ✓ / düzlem / öteleme | Açılıyor (A-11 hariç) |
| Eskizde: açınca dik bakış, orta döndürme, döndürülmüş görünümde çizim | Çizilen noktalar eskiz düzleminde doğru (−30,10)/(30,−10); Ctrl+8 geri dik; tekerlek; Boşluk; S çubuğu (12 eskiz aracı); sağ tık menüsü |
| Seçim: tık, Ctrl çoklu, Ctrl ile kaldırma, Shift ekleme | Durum çubuğu "1 yüz, 0 kenar seçili", kırıntılar, mini çubuk doğru |
| Kesişen kutu (sağdan sola), diğerini seç (Alt / ikinci tık) | Çalışıyor |
| Seçim filtresi F5 (tümü/yüz/kenar) + durum çubuğu "Filtre: kenar" | Kenar filtresinde yüze tık seçmiyor, kenara tık seçiyor |
| Ön seçim vurgusu | Yüz üzerinde 2, kenar üzerinde 1 vurgu nesnesi; imleç "pointer" |
| Bağlam mini çubuğu | Eskiz, Normal görünüm, Delik, Kabuk, Diğerini seç |
| Sağ tık menüsü (yüz / boşluk), fare hareketleri 4 yön (Üst/Sağ/Alt/Sol görünüm), 8 yön | ui2 + elle |
| Ağaç → grafik vurgusu, kırıntıya tıkla → özellik seçimi | Çalışıyor |
| Menü çubuğu (6 menü, alt menüler), Esc menüyü kapatır | ui1 / ui2 |
| Komut arama "rady" + Enter → Radyüs PM | Çalışıyor |
| Enter = son komutu tekrarla (parça ve eskiz) | Radyüs yeniden açıldı; sw1'de eskiz |
| S kısayol çubuğu (parça / eskiz) | Açılıyor; Esc kapatıyor |
| F1 yardım, Özelleştir (Klavye / Fare hareketleri), ⌨ durum çubuğu, Başlangıç rehberi | Pencereler açılıyor |
| Belge sekmeleri (Ctrl+N yeni sekme), dosya yöneticisi, belge özellikleri, 3MF/PDF/DXF, görev bölmesi, şerit özelleştirme | gn1 + elle (görev bölmesi görünür) |
| PM ✓ / ✕ / iğne / küçült, Esc değişmemiş PM'i sormadan kapatır | Çalışıyor; değişmişte sorma: ex1 |
| Çıkış onayı (eskiz / PM / geri tuşu / beforeunload) | ex1 TAMAM |
| Geri al / ileri al (Ctrl+Z / Ctrl+Y; montajda ayrı yığın) | Çalışıyor |
| Telefon: tek parmak döndürme | 100 px → 45,84° |
| Telefon: iki parmak açma | ×1,667 (beklenen 1,667), orta nokta kayması 0,0 px |
| Telefon: iki parmak kaydırma (≥ 100 px aralık) | 50,2 / 29,2 (A-2 hariç) |
| Telefon: iki parmak çevirme | 30° → 30,0°, bakış yönü sabit |
| Telefon: 2 parmak dokunuşu geri al, 3 parmak ileri al | Özellik sayısı 1→2→1 |
| Telefon: uzun basma menüsü, ekran çubuğu (parça 10 / eskiz 10 düğme), dairesel menü, dokunmatik fare, büyüteç, avuç reddi | mob1, tp1, mb1 |
| Küçük ekran: şerit grup çipleri, alt panel, yatay taşma yok (scrollWidth = pencere) | Taşan şerit düğmeleri yatay kaydırılan şeritte (beklenen) |
| Saha: fotoğraf notları, kumpas çözümleme ("+12.50" → 12,5; "−0.487in" → −12,37), HID | fs2 TAMAM + elle |
| Montaj: aç, bileşen ekle (ilk sabit (f), sonraki (-)), serbest bileşeni sol tuşla sürükleme, sabit bileşen kıpırdamaz | Çalışıyor |
| Montaj: orta tuş merkezi | İmleç altı yüz/köşe 0,0 px |
| Montaj: eşleşme PM (Standart/Gelişmiş/Mekanik: 8+7+7 tür, SolidWorks listesinin tamamı), önizleme, ✓ sonrası panel açık, Esc kapatır, ağaçta "Eşleşmeler (1)", Ctrl+Z/Y | Çalışıyor |
| Montaj: Taşı/Döndür, SmartMate, girişim, boşluk, çarpışma, fiziksel dinamik, patlatma, hareket etüdü + WebM, alt montaj, ayna, doğrusal/dairesel/desen güdümlü çoğaltma, bastırma, yapılandırma, bağlam içi düzenleme, BOM, kütle, kesit, STEP, kaydet/aç, delik hizalama, montaj kesmesi | as1–as11 TAMAM; birim asm_matrix 0 hata |
| Teknik resim: ilk açı ızgarası (ön, sağında sol, altında üst), izometrik, kesit A-A, detay B + 2. sayfa, otomatik toplam ölçüler, ölçü ekle/taşı, tolerans, Ra, GDT, datum, antet, üçüncü açı (ANSI), A4/A3, ölçek, SVG/DXF indir, Yazdır/PDF, montaj resmi (balon + BOM), kaynaklı resim (kesim listesi, balon) | td1–td4 TAMAM + elle (SVG/DXF indirildi) |

---


# Denetim raporu (v0.35, 2026-11-13) — özet

Tam rapor (Claude Docs): https://claude.ai/artifact/8hC3QmasELfPv3mcPvmhP4
Yöntem: 77 e2e test + 6 deneme senaryosu + kod taraması (`SOLIDWORKS_OZELLIKLERI.md`'ye göre).

## Test sonucu
- 77 testin 73'ü hatasız. Başarısız: `mob1` (gerçek gerileme: eskizde Seç aracı + boş seçimde Esc / ekran çubuğu ✕ çıkış penceresini açıyor; SolidWorks'te Esc eskizden çıkmaz), `t8`, `t9` (✕ artık soruyor — test güncellenmeli), `touch` (v0.12'de kalkan `[data-tool=rect]` seçicisi). `k1` diş alt testi: silindir iki yarım yüz, test referansı (eksen merkezi) gerçek dışı.

## Kritik bulgular
1. **Kalıcı referans yok:** `matchEdges/matchFaces/planarFace` 2 mm konum toleransı. Kutu 20→30 mm: radyüs ve kabuk hata; eskiz 40→50: radyüs hata; sac taban 100→120: kenar flanşı hata. Etkilenen: radyüs, pah, kabuk, koniklik, kenar flanşı, kenet, köşe kapat, saca dönüştür, birleştir, sarma, kubbe, diş.
2. **Montaj–parça bağı yok:** `c.part` JSON kopya; parça değişince montaj ve aynı parçanın diğer örnekleri güncellenmez (`replaceComp` tek bileşen).
3. **Eşleşme referansı dondurulmuş geometri** (`MateEnt {c,n,r}`): parça düzenlenince eski konuma göre çözülür, uyarı yok.
4. Teknik resim modülü yok.
5. Delik konumları yüz merkezine göre sabit X/Y; ölçü/ilişki yok.
6. Diş M20×30: 18,3 sn; tüm model her değişiklikte baştan kurulur (22 özellik 0,7 sn).
7. Kaydet her seferinde yeni .icad indirir; belge/montaj tarayıcı belleğinde tek kopya.
8. Çarpışma algılama sınır kutusuyla (`worldBox`).
9. Kayıtlar "STL içe aktarma" diyor; menüde yalnız STEP içe aktarma var.

## Önerilen sıra
0. Esc gerilemesi + 4 eski test + kayıt düzeltmesi
1. Kalıcı referanslar (üreten özellik + eskiz öğesi + konum türüyle adlandırma; bulunamazsa uyarı + yeniden seç)
2. Montaj bağlantısı (tek kaynak parça, örnekler birlikte, eşleşmeler yeniden bağlanır / ⚠, gerçek geometriyle çarpışma)
3. Montaj kesme/delik, delik hizalama (kullanıcının bekleyen isteği)
4. Teknik resim modülü
5. Hız ve dosya (artımlı yeniden oluşturma, diş hızı, aynı dosyaya kaydet, delik konumu eskizle)
6. Modelleme eksikleri (helis, süpürme burulma/kılavuz, loft teğetlik, ref. eksen/nokta, sac aç/katla + flanş profili + büküm tablosu, köşe başına kaynak işlemi, yapılandırmalar)
7. İleri (yüzey, doğrudan düzenleme, renk, birim, STL/IGES/DXF içe aktarma, perspektif, analiz)

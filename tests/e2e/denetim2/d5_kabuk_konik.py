# d5 — Kabuk (tek / çoklu kalınlık / dışa / yüz seçmeden / çok kalın), Koniklik (nötr düzlem, ayırma çizgisi, ters),
#      Koniklik Analizi; yaşam döngüsü. Hazır model: 40×30×20 kutu (setDoc); tüm özellik adımları gerçek UI.
import sys
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d5_lib import *

V0 = 24000
TOPF = lambda f: f['n'] and f['n'][1] > 0.99
FRONTF = lambda f: f['n'] and f['n'][2] > 0.99
RIGHTF = lambda f: f['n'] and f['n'][0] > 0.99
TAN5 = math.tan(math.radians(5))

with sync_playwright() as p:
    a = App(p)
    # ================= KABUK =================
    a.setup(box()); a.iso()
    a.feature_cmd("Kabuk")
    a.pick_face(TOPF)
    a.pmfield("Kalınlık", 2)
    g = a.ghost_vol()
    chk("S1 sarı önizleme t2", near(g, V0 - 36 * 26 * 18, 5), g)
    a.ok()
    v = a.vol()
    chk("S2 kabuk t2 üst açık = 7152", near(v, V0 - 36 * 26 * 18, 0.5), v)
    nm = a.lastfeat()['name']
    a.tree_edit(nm); a.pmfield("Kalınlık", 3); a.ok()
    chk("S3 düzenle t3 = 10128", near(a.vol(), V0 - 34 * 24 * 17, 0.5), a.vol())
    a.edit_sketch_dim("Ekstrüzyon1", 1, 40)
    chk("S4 derinlik 40 → kabuk korundu (12348)", near(a.vol(), 32000 - 34 * 34 * 17, 0.5), (a.vol(), a.errs_tree()))
    a.undo(); chk("S5 Ctrl+Z", near(a.vol(), V0 - 34 * 24 * 17, 0.5), a.vol())
    a.redo(); chk("S6 Ctrl+Y", near(a.vol(), 32000 - 34 * 34 * 17, 0.5), a.vol())
    a.reload(); chk("S7 yenile", near(a.vol(), 32000 - 34 * 34 * 17, 0.5), a.vol())
    a.iso()
    a.suppress(nm); chk("S8 bastır", near(a.vol(), 32000, 0.1), a.vol())
    a.unsuppress(nm)
    # yüksekliği kalınlığın altına indir (20 → 5, kabuk t3 hâlâ olur) ve 20 → 4 (t3: iç boşluk 1 mm)
    # yüz seçimini temizle → ✓ (P-17)
    a.tree_edit(nm)
    a.pmbtn("Seçimi temizle")
    a.ok()
    chk("S9 yüz seçmeden ✓ → kapalı içi boş gövde (P-17 hâlâ?)", (not a.pm_open()) and near(a.vol(), 32000 - 34 * 34 * 14, 1), (a.pm_open(), a.toast(), a.vol()))
    if a.pm_open():
        a.cancel("discard")

    # çoklu kalınlık: üst açık, ön yüz 6
    a.setup(box()); a.iso()
    a.feature_cmd("Kabuk")
    a.pick_face(TOPF)
    a.pmfield("Kalınlık", 2)
    a.pmseg("Farklı kalınlık")
    a.pick_face(FRONTF)
    a.pmfield("Yüz 1", 6)
    a.ok()
    v = a.vol()
    chk("S10 çoklu kalınlık ön 6 = 24000−36·18·22", near(v, V0 - 36 * 18 * 22, 0.5), (v, a.errs_tree()))
    a.edit_sketch_dim("Ekstrüzyon1", 1, 40)
    chk("S11 derinlik 40 → ön yüz hâlâ 6 mm", near(a.vol(), 32000 - 36 * 18 * 32, 0.5), (a.vol(), a.errs_tree()))

    # dışa kabuk
    a.setup(box()); a.iso()
    a.feature_cmd("Kabuk")
    a.pick_face(TOPF)
    a.pmfield("Kalınlık", 2)
    a.pmcheck("Dışa kabuk", True)
    a.ok()
    v = a.vol()
    chk("S12 dışa kabuk keskin kenarlı 44×34×22−40·30·20 (P-13 hâlâ?)", near(v, 44 * 34 * 22 - V0, 1), (v, 44 * 34 * 22 - V0, a.nfaces()))

    # çok kalın: t = 16 (P-1)
    a.setup(box()); a.iso()
    a.feature_cmd("Kabuk")
    a.pick_face(TOPF)
    a.pmfield("Kalınlık", 16)
    a.ok()
    chk("S13 t16 (yarı genişlikten büyük) → hata vermeli (P-1 hâlâ?)", bool(a.errs_tree()) or a.pm_open(), (a.vol(), a.errs_tree()))

    # ================= KONİKLİK — nötr düzlem =================
    a.setup(box()); a.iso()
    a.feature_cmd("Koniklik")
    chk("K0 koniklik PM", a.pm_open())
    a.pick_face(FRONTF)
    a.pmfield("Açı", 5)
    dr = a.draft()
    chk("K1 nötr düzlem Üst Düzlem, ön yüz seçili", dr['plane'] == {"k": "std", "n": "top"} and len(dr['faces']) == 1, dr)
    g = a.ghost_vol()
    a.ok()
    v = a.vol()
    dv = 0.5 * 20 * 20 * TAN5 * 40
    chk("K2 5° koniklik |ΔV| = ½·20²·tan5·40", near(abs(v - V0), dv, 0.5), (v, dv))
    chk("K3 önizleme ✓ sonucuyla aynı", near(g, v, 5), (g, v))
    nm = a.lastfeat()['name']
    a.tree_edit(nm); a.pmfield("Açı", 10); a.ok()
    v10 = a.vol()
    chk("K4 düzenle 10°", near(abs(v10 - V0), 0.5 * 400 * math.tan(math.radians(10)) * 40, 0.5), v10)
    a.tree_edit(nm); a.pmcheck("Yönü ters çevir", True); a.ok()
    vr = a.vol()
    chk("K5 ters çevir → diğer yön (ΔV işaret değiştirir)", near(vr - V0, -(v10 - V0), 1), (v10, vr))
    a.edit_sketch_dim("Ekstrüzyon1", 1, 40)
    chk("K6 derinlik 40 → koniklik yeni ön yüzde", near(abs(a.vol() - 32000), 0.5 * 400 * math.tan(math.radians(10)) * 40, 0.5), (a.vol(), a.errs_tree()))
    a.undo(); chk("K7 Ctrl+Z", near(a.vol(), vr, 0.5), a.vol())
    # nötr düzlem = model yüzü (üst yüz) seçimi: PM'de düzlem alanı açıkken üst yüze dokunmak düzlemi mi yüzü mü ekler?
    a.setup(box()); a.iso()
    a.feature_cmd("Koniklik")
    a.pick_face(FRONTF)
    a.pick_face(RIGHTF)
    a.pmfield("Açı", 5)
    a.ok()
    v = a.vol()
    chk("K8 iki yan yüz 5° (≈ 2 × tek yüz, köşe payı)", 1.6 * dv < abs(v - V0) < 2.0 * dv * 30 / 40 + dv, (v, dv))

    # ================= KONİKLİK — ayırma çizgisi =================
    a.setup(box()); a.iso()
    a.feature_cmd("Koniklik")
    a.pmseg("Ayırma çizgisi")
    a.pick_edge(lambda e: e['t'] == 'LINE' and abs(e['m'][1] - 20) < 0.01 and abs(e['m'][2] - 15) < 0.01)
    a.pmfield("Açı", 5)
    a.btn("#pm-ok"); a.wait(0.8)
    chk("L0 varsayılan taraf (yukarı) → yüz yok hatası PM'de / ✓'de görünmeli", a.pm_open() or bool(a.errs_tree()), (a.pm_open(), a.toast(), a.errs_tree()))
    if not a.pm_open():
        a.tree_edit(a.lastfeat()['name'])
    a.pmcheck("Öbür taraftaki yüzler", True)
    dr = a.draft()
    chk("L1 ayırma çizgisi kenarı seçildi", dr.get('mode') == 'parting' and len(dr.get('edges') or []) == 1, dr)
    a.ok()
    v = a.vol()
    chk("L2 ayırma çizgisinde 5° |ΔV| = ½·20²·tan5·40", near(abs(v - V0), dv, 1), (v, a.errs_tree()))
    nm = a.lastfeat()['name']
    a.edit_sketch_dim("Ekstrüzyon1", 1, 40)
    chk("L3 derinlik 40 → ayırma kenarı izlendi", near(abs(a.vol() - 32000), dv, 1), (a.vol(), a.errs_tree()))

    # ================= KONİKLİK ANALİZİ =================
    vert = [{"m": [sx * 20, 10, sz * 15], "d": [0, 1, 0]} for sx in (1, -1) for sz in (1, -1)]
    a.setup(box() + [{"id": "f0", "type": "fillet", "name": "Radyüs1", "r": 5, "edges": vert}]); a.iso()
    a.tab("evaluate")
    a.cmd("Koniklik Analizi")
    time.sleep(0.8)
    st = a.ev("(document.querySelector('.draft-ana .da-stat')||{}).textContent||''")
    chk("N1 silindirik yüzlü modelde analiz paneli istatistik verdi", "Pozitif" in st, (st, a.errs[-3:]))
    a.close_dialogs()
    # model değişince istatistik güncelleniyor mu (temiz sayfa)
    a.reload()
    a.setup(box()); a.iso()
    a.tab("evaluate")
    if not a.ev("!!document.querySelector('.draft-ana')"):
        a.cmd("Koniklik Analizi")
    st1 = a.ev("(document.querySelector('.draft-ana .da-stat')||{}).textContent||''")
    chk("N2 kutu: Pozitif 1 · Negatif 1 · gerekli 4", "Pozitif 1" in st1 and "Negatif 1" in st1 and "gerekli 4" in st1, st1)
    a.tab("features")
    a.feature_cmd("Koniklik")
    a.pick_face(FRONTF)
    a.pmfield("Açı", 5)
    a.ok()
    st2 = a.ev("(document.querySelector('.draft-ana .da-stat')||{}).textContent||''")
    chk("N3 konik sonrası istatistik güncellendi (gerekli 3)", "gerekli 3" in st2, (st1, st2))
    print("sayfa hataları:", a.errs[:5])
    a.close()
finish()

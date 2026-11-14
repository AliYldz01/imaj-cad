# d5 — Radyüs: sabit / değişken / yüz / tam yuvarlak / konik / çoklu yarıçap / teğet yayılımı; yaşam döngüsü a–g
# Hazır model: 40×30×20 kutu (ölçülü eskiz, setDoc). Tüm radyüs adımları şeritten + gerçek kenar/yüz tıklamasıyla.
import sys
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d5_lib import *

K = 1 - PI / 4  # köşe artığı katsayısı
V0 = 24000


def top_front(e):  # üst-ön kenar (y=20, z=15, x boyunca)
    return e['t'] == 'LINE' and abs(e['m'][1] - 20) < 0.01 and abs(e['m'][2] - 15) < 0.01 and abs(e['d'][0]) > 0.99


with sync_playwright() as p:
    a = App(p)
    # ================= A: sabit R3 → yaşam döngüsü =================
    a.setup(box()); a.iso()
    chk("A0 hazır kutu 24000", near(a.vol(), V0, 0.1), a.vol())
    a.feature_cmd("Radyüs")
    chk("A1 PM açıldı", a.pm_open())
    a.pick_edge(top_front)
    dr = a.draft()
    chk("A2 kenar seçildi (tıklama)", dr and len(dr['edges']) == 1, dr and dr['edges'])
    g3 = a.ghost_vol()
    chk("A3 sarı önizleme R3", near(g3, V0 - K * 9 * 40, 3), g3)
    a.pmfield("Yarıçap", 10)
    g10 = a.ghost_vol(3)
    chk("A4 önizleme R10'a güncellendi (P-3?)", near(g10, V0 - K * 100 * 40, 15), f"önizleme {g10}, beklenen {V0 - K * 100 * 40:.1f}")
    a.pmfield("Yarıçap", 3)
    a.ok()
    v = a.vol()
    chk("A5 ✓ R3 hacmi", near(v, V0 - K * 9 * 40, 0.3), f"{v} beklenen {V0 - K * 9 * 40:.2f}")
    chk("A6 ağaçta Radyüs1, hata yok", "Radyüs1" in a.feats() and not a.errs_tree(), (a.feats(), a.errs_tree()))
    # b: düzenle
    a.tree_edit("Radyüs1")
    chk("B1 düzenle → PM", a.pm_open() and a.draft()['r'] == 3)
    gb = a.ghost_vol()
    chk("B2 düzenlemede sarı önizleme var", gb is not None, gb)
    a.pmfield("Yarıçap", 5)
    a.ok()
    v = a.vol()
    chk("B3 R5 → hacim", near(v, V0 - K * 25 * 40, 0.3), f"{v} beklenen {V0 - K * 25 * 40:.2f}")
    chk("B4 kayıt r=5", a.saved_feat(a.featbyname("Radyüs1")['id'])['r'] == 5)
    # c: ebeveyn eskiz derinlik 30 → 40 (ön kenar z=15 → z=20)
    a.edit_sketch_dim("Ekstrüzyon1", 1, 40)
    v = a.vol()
    chk("C1 derinlik 40 → radyüs ön kenarda kaldı", near(v, 32000 - K * 25 * 40, 0.5), f"{v} beklenen {32000 - K * 25 * 40:.2f} hata {a.errs_tree()}")
    fr = a.featbyname("Radyüs1")
    zmax = a.bbox()[1][2]
    chk("C2 kenar referansı onarıldı (m.z = yeni ön yüz)", abs(fr['edges'][0]['m'][2] - zmax) < 0.01, (fr['edges'][0]['m'], zmax))
    a.edit_sketch_dim("Ekstrüzyon1", 0, 60)
    v = a.vol()
    chk("C3 genişlik 60 → radyüs uzadı", near(v, 60 * 40 * 20 - K * 25 * 60, 0.5), f"{v} beklenen {48000 - K * 25 * 60:.2f}")
    # d: geri al / ileri al
    a.undo()
    v = a.vol()
    chk("D1 Ctrl+Z → genişlik 40", near(v, 32000 - K * 25 * 40, 0.5), v)
    a.redo()
    v = a.vol()
    chk("D2 Ctrl+Y → genişlik 60", near(v, 48000 - K * 25 * 60, 0.5), v)
    # e: yenile
    a.reload()
    v = a.vol()
    chk("E1 yenile → aynı model", near(v, 48000 - K * 25 * 60, 0.5), v)
    chk("E2 yenile sonrası ağaç", "Radyüs1" in a.feats(), a.feats())
    # f: ✕ vazgeç / Kaydet ve çık
    a.iso()
    a.tree_edit("Radyüs1")
    a.pmfield("Yarıçap", 8)
    a.cancel("discard")
    v = a.vol()
    chk("F1 ✕ Kaydetmeden çık → R5 kaldı", near(v, 48000 - K * 25 * 60, 0.5) and a.featbyname("Radyüs1")['r'] == 5, v)
    a.tree_edit("Radyüs1")
    a.pmfield("Yarıçap", 8)
    a.cancel("save")
    v = a.vol()
    chk("F2 ✕ Kaydet ve çık → R8", near(v, 48000 - K * 64 * 60, 0.5), f"{v} beklenen {48000 - K * 64 * 60:.2f}")
    # g: bastır / sil / geri al
    a.suppress("Radyüs1")
    chk("G1 bastır → kutu", near(a.vol(), 48000, 0.1), a.vol())
    a.unsuppress("Radyüs1")
    chk("G2 etkinleştir → R8", near(a.vol(), 48000 - K * 64 * 60, 0.5), a.vol())
    a.delete_feat("Radyüs1")
    chk("G3 sil → kutu, ağaçta yok", near(a.vol(), 48000, 0.1) and "Radyüs1" not in a.feats(), (a.vol(), a.feats()))
    a.undo()
    chk("G4 geri al → radyüs döndü", near(a.vol(), 48000 - K * 64 * 60, 0.5) and "Radyüs1" in a.feats(), (a.vol(), a.feats()))
    # ebeveyn bastır → çocuk (P-7)
    a.suppress("Ekstrüzyon1")
    errs = a.errs_tree()
    chk("G5 ebeveyn bastırınca radyüs hata vermemeli (P-7 hâlâ?)", not errs, errs)
    a.unsuppress("Ekstrüzyon1")

    # ================= B: değişken R2 → R6 =================
    a.setup(box()); a.iso()
    a.feature_cmd("Radyüs")
    a.pmsel("Radyüs türü", "var")
    a.pick_edge(top_front)
    a.pmfield("Başlangıç", 2)
    a.pmfield("Bitiş", 6)
    a.ok()
    v = a.vol()
    exp = V0 - K * 40 * (4 + 12 + 36) / 3
    chk("V1 değişken R2→R6 hacmi (doğrusal r yaklaşık)", near(v, exp, 4), f"{v} beklenen ≈{exp:.1f}")
    fr = a.lastfeat()
    chk("V2 kayıt kind=var r=2 r2=6", fr.get('kind') == 'var' and fr['r'] == 2 and fr.get('r2') == 6, fr)
    a.tree_edit(fr['name'])
    a.pmfield("Bitiş", 3)
    a.ok()
    v2 = a.vol()
    exp2 = V0 - K * 40 * (4 + 6 + 9) / 3
    chk("V3 düzenle bitiş 3", near(v2, exp2, 3), f"{v2} beklenen ≈{exp2:.1f}")
    a.undo()
    chk("V4 geri al", near(a.vol(), v, 0.5), a.vol())

    # ================= C: yüz radyüsü üst ↔ ön =================
    a.setup(box()); a.iso()
    a.feature_cmd("Radyüs")
    a.pmsel("Radyüs türü", "face")
    a.pick_face(lambda f: f['n'] and f['n'][1] > 0.99)       # grup 1: üst
    a.pmseg("Yüz grubu 2")
    a.pick_face(lambda f: f['n'] and f['n'][2] > 0.99)       # grup 2: ön
    a.pmfield("Yarıçap", 5)
    dr = a.draft()
    chk("Y1 iki yüz grubu", len(dr.get('faces') or []) == 1 and len(dr.get('faces2') or []) == 1, (dr.get('faces'), dr.get('faces2')))
    a.ok()
    v = a.vol()
    chk("Y2 yüz radyüsü R5 = 214,6 eksik", near(v, V0 - K * 25 * 40, 0.5), v)
    # ebeveyn derinlik 30→40: ön yüz kayar
    a.edit_sketch_dim("Ekstrüzyon1", 1, 40)
    v = a.vol()
    chk("Y3 derinlik 40 → yüz radyüsü korundu", near(v, 32000 - K * 25 * 40, 0.5), f"{v} hata {a.errs_tree()}")

    # ================= D: tam yuvarlak (40×10×20 kaburga) =================
    a.setup(box(40, 10, 20)); a.iso()
    a.feature_cmd("Radyüs")
    a.pmsel("Radyüs türü", "full")
    a.pick_face(lambda f: f['n'] and f['n'][1] > 0.99)
    a.ok()
    v = a.vol()
    exp = 8000 - 2 * K * 25 * 40
    chk("T1 tam yuvarlak = 2(1−π/4)·5²·40 eksik (P-16 hâlâ?)", near(v, exp, 0.5), f"{v} beklenen {exp:.2f}")
    a.edit_sketch_dim("Ekstrüzyon1", 1, 16)
    v = a.vol()
    exp = 40 * 16 * 20 - 2 * K * 64 * 40
    chk("T2 kalınlık 16 → tam yuvarlak R8'e uydu", near(v, exp, 10), f"{v} beklenen {exp:.1f} hata {a.errs_tree()}")

    # ================= E: konik rho =================
    a.setup(box()); a.iso()
    a.feature_cmd("Radyüs")
    a.pmsel("Radyüs türü", "conic")
    a.pick_edge(top_front)
    a.pmfield("Yarıçap", 5)
    a.pmfield("Rho", 0.5)
    a.ok()
    v = a.vol()
    chk("K1 konik rho 0,5 R5 = r²/6·L eksik", near(v, V0 - 25 / 6 * 40, 1), f"{v} beklenen {V0 - 25 / 6 * 40:.2f}")
    a.tree_edit(a.lastfeat()['name'])
    a.pmfield("Rho", 0.414)
    a.ok()
    v = a.vol()
    chk("K2 düzenle rho 0,414 ≈ daire", near(v, V0 - K * 25 * 40, 3), v)
    a.edit_sketch_dim("Ekstrüzyon1", 1, 40)
    v = a.vol()
    chk("K3 derinlik 40 → konik radyüs ön kenarda", near(v, 32000 - K * 25 * 40, 4), f"{v} hata {a.errs_tree()}")

    # ================= F: çoklu yarıçap (ön R2, arka R4) =================
    a.setup(box()); a.iso()
    a.feature_cmd("Radyüs")
    a.pick_edge(top_front)
    a.pick_edge(lambda e: e['t'] == 'LINE' and abs(e['m'][1] - 20) < 0.01 and abs(e['m'][2] + 15) < 0.01)
    chk("M1 iki kenar", len(a.draft()['edges']) == 2, a.draft()['edges'])
    a.pmcheck("Kenar başına farklı yarıçap", True)
    a.pmfield("Kenar 1", 2)
    a.pmfield("Kenar 2", 4)
    a.ok()
    v = a.vol()
    chk("M2 çoklu yarıçap R2 + R4", near(v, V0 - K * 40 * (4 + 16), 0.5), f"{v} beklenen {V0 - K * 40 * 20:.2f}")

    # ================= G: teğet yayılımı =================
    vert = [{"m": [sx * 20, 10, sz * 15], "d": [0, 1, 0]} for sx in (1, -1) for sz in (1, -1)]
    a.setup(box() + [{"id": "f0", "type": "fillet", "name": "Radyüs1", "r": 5, "edges": vert}]); a.iso()
    v0 = a.vol()
    chk("P0 hazır: düşey kenarlar R5", near(v0, V0 - 4 * K * 25 * 20, 0.5), v0)
    a.feature_cmd("Radyüs")
    a.pick_edge(top_front)
    a.pmfield("Yarıçap", 2)
    a.ok()
    v = a.vol()
    # Pappus: düz 100 mm + köşe yayları ağırlık merkezi yarıçapı 5−0,4467
    cg = 2 * (10 - 3 * PI) / (3 * (4 - PI))
    exp = v0 - K * 4 * (100 + 2 * PI * (5 - cg))
    chk("P1 tek kenar → teğet zincirin tamamı (SW varsayılan)", near(v, exp, 2), f"{v} beklenen {exp:.1f} (tek kenar olsa {v0 - K * 4 * 30:.1f})")
    chk("P2 hata yok", not a.errs_tree(), a.errs_tree())

    # ================= H: hata durumu R50 =================
    a.setup(box()); a.iso()
    a.feature_cmd("Radyüs")
    a.pick_edge(top_front)
    a.pmfield("Yarıçap", 50)
    a.ok()
    chk("H1 R50 → PM açık kalmalı / ağaçta hatalı özellik olmamalı (P-6 hâlâ?)", a.pm_open() or not a.errs_tree(), (a.pm_open(), a.errs_tree()))
    if a.pm_open():
        a.cancel("discard")
    print("sayfa hataları:", a.errs[:5])
    a.close()
finish()

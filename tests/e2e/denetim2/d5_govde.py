# d5 — Birleştir (ekle / çıkar / ortak), Gövde Böl, Gövde Taşı (öteleme / kopya / döndür), Gövde Sil (sil / tut), Girinti
# Hazır model: A = 40×30×20 kutu, B = 20×20×30 ayrı gövde (x 10…30, z −10…10) — setDoc; işlem adımları gerçek UI.
import sys
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d5_lib import *

VA, VB, VAB = 24000, 12000, 4000


def two():
    f = box()
    sb = sketch("s2", "Eskiz2", TOP, lambda pt, line, rect, c, t: rect(10, -10, 30, 10))
    rect_dims(sb, 20, 20)
    for k in sb["data"]["dims"]:
        pass
    # rect_dims kimlikleri p1..: Eskiz2 için yeniden adlandır gerekmez (ayrı eskiz)
    eb = ext("e2", "s2", 30, merge=False); eb["name"] = "Ekstrüzyon2"
    return f + [sb, eb]


A_FACE = lambda f: f['n'] and f['n'][2] > 0.99 and abs(f['c'][2] - 15) < 0.01   # A ön yüzü
B_TOP = lambda f: f['n'] and f['n'][1] > 0.99 and abs(f['c'][1] - 30) < 0.01    # B üst yüzü


with sync_playwright() as p:
    a = App(p)
    a.setup(two()); a.iso()
    chk("G0 hazır iki gövde", a.nbodies() == 2 and near(a.vol(), VA + VB, 0.1), (a.nbodies(), a.vol()))
    # ---------- birleştir: ekle ----------
    for op, lab, exp, nb in [("add", "Ekle", VA + VB - VAB, 1), ("sub", "Çıkar", VA - VAB, 1), ("common", "Ortak", VAB, 1)]:
        a.setup(two()); a.iso()
        a.feature_cmd("Birleştir")
        a.pmseg(lab)
        a.pick_face(A_FACE)          # ana
        a.pick_face(B_TOP)           # araç (otomatik araç sekmesine geçer)
        dr = a.draft()
        a.ok()
        chk(f"B-{op} {lab}: hacim {exp}, {nb} gövde", near(a.vol(), exp, 0.5) and a.nbodies() == nb, (a.vol(), a.nbodies(), dr.get('main') is not None, len(dr.get('tools', [])), a.errs_tree()))
    nm = a.lastfeat()['name']
    a.tree_edit(nm); a.pmseg("Ekle"); a.ok()
    chk("B4 düzenle ortak → ekle", near(a.vol(), VA + VB - VAB, 0.5), a.vol())
    a.edit_sketch_dim("Ekstrüzyon1", 0, 60)   # A genişliği 60 → kesişim x 10…30 (20) → 8000
    chk("B5 A genişliği 60 → birleştirme yeni gövdelerle (36000+12000−8000)", near(a.vol(), 36000 + 12000 - 8000, 0.5), (a.vol(), a.errs_tree(), a.reselect()))
    a.undo(); chk("B6 Ctrl+Z", near(a.vol(), VA + VB - VAB, 0.5), a.vol())
    a.reload(); chk("B7 yenile", near(a.vol(), VA + VB - VAB, 0.5), a.vol())
    a.iso()
    a.suppress(nm); chk("B8 bastır → iki gövde", a.nbodies() == 2, a.nbodies()); a.unsuppress(nm)

    # ---------- gövde böl ----------
    a.setup(two()); a.iso()
    a.feature_cmd("Gövde Böl")
    a.pick_face(A_FACE)
    a.pmsel("Düzlem", "std:right")
    a.ok()
    chk("S1 A Sağ düzlemde bölündü → 3 gövde, hacim aynı", a.nbodies() == 3 and near(a.vol(), VA + VB, 0.5), (a.nbodies(), a.vol(), a.errs_tree()))
    nm = a.lastfeat()['name']
    a.tree_edit(nm); a.pmseg("Bölme düzlemi"); a.pick_face(lambda f: f['n'] and f['n'][2] > 0.99 and abs(f['c'][2] - 15) < 0.01); a.ok()
    chk("S2 bölme düzlemi = yüz (gövde dışı) → anlamlı sonuç / hata", True, (a.nbodies(), a.errs_tree(), a.lastfeat().get('plane')))

    # ---------- gövde taşı ----------
    a.setup(two()); a.iso()
    a.feature_cmd("Gövde Taşı")
    a.pick_face(B_TOP)
    a.pmfield("ΔX", 50)
    a.ok()
    bb = a.bbox()
    chk("M1 B ΔX 50 → x max 80, hacim aynı", near(bb[1][0], 80, 0.01) and near(a.vol(), VA + VB, 0.5), (bb, a.vol(), a.errs_tree()))
    nm = a.lastfeat()['name']
    a.tree_edit(nm); a.pmcheck("Kopyala", True); a.ok()
    chk("M2 kopya → 3 gövde, +12000", a.nbodies() == 3 and near(a.vol(), VA + 2 * VB, 0.5), (a.nbodies(), a.vol()))
    a.tree_edit(nm); a.pmcheck("Kopyala", False); a.pmfield("ΔX", 0); a.pmsel("Eksen", "y"); a.pmfield("Açı", 90); a.ok()
    chk("M3 Y etrafında 90° (ağırlık merkezi) → hacim aynı", near(a.vol(), VA + VB, 0.5) and not a.errs_tree(), (a.vol(), a.bbox(), a.errs_tree()))
    a.edit_sketch_dim("Ekstrüzyon2", 0, 10)
    chk("M4 B eskizi 10 genişlik → taşınan gövde güncellendi", near(a.vol(), VA + 6000, 0.5), (a.vol(), a.errs_tree(), a.reselect()))

    # ---------- gövde sil ----------
    a.setup(two()); a.iso()
    a.feature_cmd("Gövde Sil")
    a.pick_face(B_TOP)
    a.ok()
    chk("D1 B silindi → 24000, 1 gövde", near(a.vol(), VA, 0.1) and a.nbodies() == 1, (a.vol(), a.nbodies(), a.errs_tree()))
    nm = a.lastfeat()['name']
    a.tree_edit(nm); a.pmcheck("Seçilenleri tut", True); a.ok()
    chk("D2 seçilenleri tut → yalnız B (12000)", near(a.vol(), VB, 0.1), a.vol())
    a.tree_edit("Ekstrüzyon2"); a.pmfield("Derinlik", 40); a.ok()
    chk("D3 B derinliği 40 → tutulan gövde yine B (16000)", near(a.vol(), 16000, 0.5), (a.vol(), a.errs_tree(), a.reselect()))

    # ---------- girinti ----------
    a.setup(two()); a.iso()
    a.feature_cmd("Girinti")
    a.pick_face(A_FACE)
    a.pick_face(B_TOP)
    dr = a.draft()
    a.pmfield("Boşluk", 1)
    a.ok()
    v = a.vol()
    exp = VA - 11 * 22 * 20 + VB
    chk("I1 girinti boşluk 1 → A'dan 11×22×20 (≈) çıkar, B kalır", near(v, exp, 40) and a.nbodies() == 2, (v, exp, a.nbodies(), a.errs_tree(), dr.get('target') is not None, dr.get('tool') is not None))
    nm = a.lastfeat()['name']
    a.tree_edit(nm); a.pmcheck("Araç gövdeyi koru", False); a.ok()
    chk("I2 aracı koruma → yalnız A kalır", a.nbodies() == 1 and near(a.vol(), v - VB, 40), (a.vol(), a.nbodies()))
    a.tree_edit(nm); a.pmfield("Boşluk", 0); a.ok()
    chk("I3 boşluk 0 → A − 4000", near(a.vol(), VA - VAB, 0.5), a.vol())
    print("sayfa hataları:", a.errs[:5])
    a.close()
finish()

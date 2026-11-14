# d5 — Kaburga, Kubbe, Sarma, Esnet (bük / bur / daralt / uzat), Ölçekle, Yüz Taşı / Sil, Dudak / Yiv, Mandal; yaşam döngüsü
# Hazır modeller setDoc ile; özellik adımları şeritten + gerçek yüz tıklamasıyla.
import sys
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d5_lib import *

V0 = 24000
TOPF = lambda f: f['n'] and f['n'][1] > 0.99


def lsketch(sid, name, plane, pts, closed=True, cons=False):
    def b(pt, line, rect, c, t):
        ids = [pt(x, y) for x, y in pts]
        n = len(ids)
        for i in range(n if closed else n - 1):
            line(ids[i], ids[(i + 1) % n])
    return sketch(sid, name, plane, b)


def lbracket():
    L = lsketch("s1", "Eskiz1", FRONT, [(0, 0), (60, 0), (60, 5), (5, 5), (5, 60), (0, 60)])
    e = ext("e1", "s1", 40); e["name"] = "Ekstrüzyon1"
    pl = {"id": "pl1", "type": "plane", "name": "Düzlem1", "base": FRONT, "offset": 20, "flip": False}
    rib = lsketch("s2", "Eskiz2", {"k": "ref", "id": "pl1"}, [(5, 40), (40, 5)], closed=False)
    return [L, e, pl, rib]


with sync_playwright() as p:
    a = App(p)
    # ================= KABURGA =================
    a.setup(lbracket()); a.iso()
    vL = a.vol()
    chk("R0 hazır L braket", near(vL, (60 * 5 + 55 * 5) * 40, 0.1), vL)
    a.feature_cmd("Kaburga")
    dr = a.draft()
    chk("R1 Kaburga PM, son açık eskiz seçili", dr and dr['sketch'] == 's2', dr)
    a.pmfield("Kalınlık", 5)
    a.ok()
    chk("R1b varsayılan malzeme tarafı kapalı bölge buldu (SW: önizleme yönü otomatik)", not a.pm_open(), (a.status(), a.toast()))
    if a.pm_open():
        a.pmcheck("Malzeme tarafını ters çevir", True)
        a.ok()
    v = a.vol()
    chk("R2 kaburga 5 mm (üçgen 35×35/2 × 5)", near(v - vL, 0.5 * 35 * 35 * 5, 2), (v - vL, a.errs_tree()))
    nm = a.lastfeat()['name']
    a.tree_edit(nm); a.pmseg("Tek taraf"); a.pmfield("Kalınlık", 8); a.ok()
    chk("R3 düzenle 8 mm tek taraf", near(a.vol() - vL, 0.5 * 35 * 35 * 8, 3), (a.vol() - vL, a.errs_tree()))
    a.tree_edit(nm); a.pmsel("Uzama yönü", "normal"); a.ok()
    bbn = a.bbox()
    chk("R4 eskize dik kaburga: sonuç parça sınırları içinde olmalı (ya da hata)", bool(a.errs_tree()) or (bbn[1][0] <= 60.01 and bbn[1][1] <= 60.01 and bbn[0][2] >= -0.01 and bbn[1][2] <= 40.01), (a.vol() - vL, bbn, a.errs_tree()))
    a.undo()
    # ebeveyn kaburga eskizi: çizgi ucunu sürükle
    acts = (a.tree_click(nm), a.tree_actions())[1]
    chk("R4b kaburgada 'Eskizi düzenle' eylemi (P-4 benzeri)", "Eskizi düzenle" in acts, acts)
    a.tree_act("Eskiz2", "Eskizi düzenle")
    a.wait(0.5)
    s0 = a.sc(40, 5); s1 = a.sc(50, 5)
    a.drag(s0, s1)
    a.btn("#pm-ok"); a.wait(1.0)
    v = a.vol()
    chk("R5 kaburga eskizi değişti (40→~50) → kaburga büyüdü", v - vL > 0.5 * 35 * 35 * 8 + 50, (v - vL, a.errs_tree(), a.mode()))
    a.undo(); a.redo()
    a.reload(); chk("R6 yenile", a.vol() > vL, a.vol())
    a.iso()
    a.suppress(nm); chk("R7 bastır", near(a.vol(), vL, 0.1), a.vol()); a.unsuppress(nm)

    # ================= KUBBE =================
    a.setup(box()); a.iso()
    a.feature_cmd("Kubbe")
    a.pick_face(TOPF)
    a.pmfield("Yükseklik", 10)
    a.ok()
    v = a.vol(); bb = a.bbox()
    chk("D1 kubbe h10: yükseklik 30, hacim artışı (2/3·A·h ≈ 8000 civarı)", near(bb[1][1], 30, 0.05) and 4000 < v - V0 < 12000, (v - V0, bb))
    nm = a.lastfeat()['name']
    a.tree_edit(nm); a.pmfield("Yükseklik", 5); a.ok()
    chk("D2 düzenle h5 → yükseklik 25", near(a.bbox()[1][1], 25, 0.05), a.bbox())
    a.tree_edit("Ekstrüzyon1"); a.pmfield("Derinlik", 30); a.ok()
    chk("D3 ekstrüzyon 30 → kubbe yeni üst yüzde (y max 35)", near(a.bbox()[1][1], 35, 0.05) and not a.errs_tree(), (a.bbox(), a.errs_tree()))

    # ================= SARMA =================
    cs = sketch("s1", "Eskiz1", FRONT, lambda pt, line, rect, c, t: c(0, 0, 20))
    cyl = ext("e1", "s1", 40); cyl["name"] = "Ekstrüzyon1"
    # silindir z 0..40 (Ön düzlem); teğet düzlem: Sağ düzlem ötelemesi 20 (x=20), eskiz 10×10 kare (merkez z=20, y=0)
    pl = {"id": "pl1", "type": "plane", "name": "Düzlem1", "base": RIGHT, "offset": 20, "flip": False}
    sq = sketch("s2", "Eskiz2", {"k": "ref", "id": "pl1"}, lambda pt, line, rect, c, t: rect(-5, -5, 5, 5))
    a.setup([cs, cyl, pl, sq]); a.iso()
    vc = a.vol()
    loc = a.ev("(()=>{const m=window.__app.viewer.mesh;return m.faces.filter(f=>f.type==='CYLINDRE').map(f=>f.c)})()")
    print("silindir yüzleri", loc, "eskiz2 çerçevesi bbox", a.bbox())
    a.feature_cmd("Sarma")
    a.pick_world([20, 0, 20] if True else None)
    dr = a.draft()
    if not dr.get('face'):
        a.pick_face(lambda f: f['t'] == 'CYLINDRE')
        dr = a.draft()
    chk("W1 silindire dokun → yüz seçildi", dr.get('face') is not None, dr)
    a.pmfield("Derinlik", 1)
    a.ok()
    v = a.vol()
    chk("W2 kabartma 1 mm (≈ 10 × 10,1 × 1)", 80 < v - vc < 130, (v - vc, a.errs_tree()))
    nm = a.lastfeat()['name']
    a.tree_edit(nm); a.pmseg("Oyma"); a.ok()
    chk("W3 oyma 1 mm → ≈ 98 mm³ azalmalı (kabartmayla aynı mertebe)", 80 < vc - a.vol() < 130, (vc - a.vol(), a.errs_tree()))
    a.edit_sketch_dim("Ekstrüzyon1", 0, 50) if a.ev("window.__app.doc.features[0].data.dims.length") else None

    # ================= ESNET =================
    bar = sketch("s1", "Eskiz1", RIGHT, lambda pt, line, rect, c, t: rect(-5, 0, 5, 10))
    bare = ext("e1", "s1", 100); bare["name"] = "Ekstrüzyon1"
    a.setup([bar, bare]); a.iso()
    vb = a.vol(); bb0 = a.bbox()
    print("çubuk bbox", bb0)
    for mode, val, check in [("Bük", 90, lambda v, bb: near(v, vb, vb * 0.03)),
                             ("Bur", 90, lambda v, bb: near(v, vb, vb * 0.03)),
                             ("Daralt", 0.5, lambda v, bb: near(v, vb * (1 + 0.5 + 0.25) / 3, vb * 0.03)),
                             ("Uzat", 1.5, lambda v, bb: near(v, vb * 1.5, vb * 0.02))]:
        a.setup([bar, bare]); a.iso()
        a.feature_cmd("Esnet")
        a.pick_face(TOPF)
        a.pmseg(mode)
        dr = a.draft()
        lab = {"Bük": "Büküm açısı", "Bur": "Burma açısı", "Daralt": "Uç ölçeği", "Uzat": "Boy oranı"}[mode]
        a.pmfield(lab, val)
        a.ok()
        v = a.vol(); bb = a.bbox()
        chk(f"X {mode} {val}: hacim beklenen, hata yok", check(v, bb) and not a.errs_tree(), (v, vb, bb, a.errs_tree(), dr.get('axis')))
    # esnet: ebeveyn uzunluğu değişince
    a.tree_edit("Ekstrüzyon1"); a.pmfield("Derinlik", 60); a.ok()
    chk("X5 çubuk 60 → uzat 1,5 → 9000", near(a.vol(), 6000 * 1.5, 150), (a.vol(), a.errs_tree()))

    # ================= ÖLÇEKLE =================
    a.setup(box()); a.iso()
    a.feature_cmd("Ölçekle")
    a.pmfield("Ölçek oranı", 1.5)
    a.ok()
    chk("O1 ölçek 1,5 → 81000", near(a.vol(), V0 * 3.375, 1), a.vol())
    chk("O2 orijin merkezli: y 0…30", near(a.bbox()[0][1], 0, 0.01) and near(a.bbox()[1][1], 30, 0.01), a.bbox())
    nm = a.lastfeat()['name']
    a.tree_edit(nm); a.pmsel("Merkez", "centroid"); a.ok()
    chk("O3 ağırlık merkezi: y −5…25", near(a.bbox()[0][1], -5, 0.01) and near(a.bbox()[1][1], 25, 0.01), a.bbox())
    a.undo(); chk("O4 geri al", near(a.bbox()[0][1], 0, 0.01), a.bbox())
    a.tree_edit(nm); a.pmfield("Ölçek oranı", 0); a.ok()
    chk("O5 ölçek 0 reddedilmeli", not near(a.vol(), 0, 0.1) or bool(a.errs_tree()), (a.vol(), a.errs_tree(), a.lastfeat().get('factor')))

    # ================= YÜZ TAŞI / SİL =================
    a.setup(box()); a.iso()
    a.feature_cmd("Yüz Taşı / Sil")
    a.pick_face(TOPF)
    a.pmfield("Mesafe", 5)
    a.ok()
    chk("F1 üst yüz +5", near(a.vol(), 30000, 0.2), (a.vol(), a.errs_tree(), a.lastfeat()))
    a.edit_sketch_dim("Ekstrüzyon1", 0, 60)
    chk("F2 genişlik 60 → yüz taşı korundu", near(a.vol(), 60 * 30 * 25, 0.5), (a.vol(), a.errs_tree()))

    # ================= DUDAK / YİV + MANDAL =================
    a.setup(box() + [{"id": "sh", "type": "shell", "name": "Kabuk1", "t": 2, "faces": [{"c": [0, 20, 0], "n": [0, 1, 0]}]}]); a.iso()
    vs = a.vol()
    a.feature_cmd("Dudak / Yiv")
    a.pick_face(TOPF, off=[19, 0, 0])   # ağız halka yüzü (x 18…20)
    a.ok()
    v = a.vol()
    chk("L1 dudak (iç) eklendi", v > vs + 50 and not a.errs_tree(), (v - vs, a.errs_tree()))
    nm = a.lastfeat()['name']
    a.tree_edit(nm); a.pmseg("Yiv")
    a.ok()
    chk("L2 yiv → hacim azaldı", a.vol() < vs and not a.errs_tree(), (a.vol() - vs, a.errs_tree()))
    a.edit_sketch_dim("Ekstrüzyon1", 0, 60)
    chk("L3 genişlik 60 → dudak/yiv izledi", not a.errs_tree(), (a.vol(), a.errs_tree(), a.reselect()))

    a.setup(box()); a.iso()
    a.feature_cmd("Mandal")
    a.pick_face(TOPF)
    a.ok()
    v = a.vol()
    chk("M1 mandal eklendi", v > V0 + 50 and a.bbox()[1][1] > 20, (v - V0, a.bbox(), a.errs_tree()))
    nm = a.lastfeat()['name']
    a.tree_edit("Ekstrüzyon1"); a.pmfield("Derinlik", 30); a.ok()
    chk("M2 ekstrüzyon 30 → mandal yeni üst yüzde (y max 30+15 = 45)", near(a.bbox()[1][1], 45, 0.05) and not a.errs_tree(), (a.bbox(), a.errs_tree(), a.reselect()))
    print("sayfa hataları:", a.errs[:5])
    a.close()
finish()

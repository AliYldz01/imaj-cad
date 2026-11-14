# d5 — Delik sihirbazı (düz / havşa / konik / kılavuz; ISO / boru / inç / özel; tümünden / kör; yuva; yakın / uzak havşa;
#      konum eskizi), gerçek / kozmetik diş; yaşam döngüsü. Hazır model 40×30×20 kutu (setDoc), adımlar gerçek UI.
import sys
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d5_lib import *

V0 = 24000
TOPF = lambda f: f['n'] and f['n'][1] > 0.99


def cyl(r, h):
    return PI * r * r * h


def frustum_extra(D, d):  # 90° havşa: Ø D'den Ø d'ye koni, aynı yükseklikte silindirin üstündeki fazla
    h = (D - d) / 2
    R, r = D / 2, d / 2
    return PI * h / 3 * (R * R + R * r + r * r) - PI * r * r * h


def new_hole(a, at=None):
    a.setup(box()); a.iso()
    a.feature_cmd("Delik Sihirb.")
    a.pick_face(TOPF, off=at)


def hole_cyl_faces(a):
    return [f for f in a.faces() if f['t'] == 'CYLINDRE']


with sync_playwright() as p:
    a = App(p)
    # ---------- hızlı ✓ yarışı: yüze dokunur dokunmaz ✓ ----------
    new_hole(a)
    a.ok(fast=True)
    t1 = a.toast()
    chk("H0 yüze dokunup hemen ✓ → delik oluşmalı (bayat 'yüzü seçin' hatası olmamalı)", not a.pm_open(), (a.mode(), t1))
    # ---------- Düz M8 tümünden (Ø9) ----------
    new_hole(a)
    dr = a.draft()
    chk("H1 yüze dokun → düzlem + 1 konum", dr['plane'] and len(dr['pts']) == 1, (dr['plane'] and dr['plane'].get('label'), dr['pts']))
    a.ok()
    v = a.vol()
    chk("H2 düz M8 (Ø9) tümünden", near(v, V0 - cyl(4.5, 20), 0.3), (v, V0 - cyl(4.5, 20)))
    nm = a.lastfeat()['name']
    # düzenle: kör 12 mm
    a.tree_edit(nm)
    a.pmcheck("Tümünden geçen", False)
    a.pmfield("Derinlik", 12)
    a.ok()
    v = a.vol()
    tip = cyl(4.5, 4.5 / math.tan(math.radians(59))) / 3
    chk("H3 kör 12 (+118° uç)", near(v, V0 - cyl(4.5, 12) - tip, 1.0) or near(v, V0 - cyl(4.5, 12), 0.3), (v, V0 - cyl(4.5, 12) - tip, V0 - cyl(4.5, 12)))
    vk = v
    # ebeveyn: ekstrüzyon derinliği 20 → 30 (üst yüz y=30'a çıkar). Kör delik yeni üst yüzden başlamalı
    a.tree_edit("Ekstrüzyon1")
    a.pmfield("Derinlik", 30)
    a.ok()
    v = a.vol()
    cy = hole_cyl_faces(a)
    ymax = max((c['c'][1] for c in cy), default=None)
    chk("H4 kutu 30 yüksek → kör delik yeni üst yüzden (silindir merkezi y≈24)", near(v, 36000 - (V0 - vk), 1.0) and ymax is not None and near(ymax, 24, 0.6), (v, [c['c'] for c in cy], a.errs_tree()))
    a.undo(); chk("H5 Ctrl+Z", near(a.vol(), vk, 0.5), a.vol())
    a.redo()
    a.reload(); chk("H6 yenile", near(a.vol(), 36000 - (V0 - vk), 1.0), a.vol())
    a.iso()
    a.tree_edit(nm); a.pmfield("Delik çapı", 5); a.cancel("discard")
    chk("H7 ✕ vazgeç", near(a.vol(), 36000 - (V0 - vk), 1.0), a.vol())
    a.suppress(nm); chk("H8 bastır", near(a.vol(), 36000, 0.1), a.vol()); a.unsuppress(nm)

    # ---------- Havşa (cbore) M8 ----------
    new_hole(a)
    a.pmseg("Havşa")
    a.ok()
    v = a.vol()
    exp = V0 - cyl(4.5, 20) - PI * (7.5 ** 2 - 4.5 ** 2) * 8.6
    chk("C1 havşa M8 Ø15×8,6 + Ø9", near(v, exp, 0.5), (v, exp))
    # ---------- Konik havşa (csink) ----------
    new_hole(a)
    a.pmseg("Konik")
    a.ok()
    v = a.vol()
    exp = V0 - cyl(4.5, 20) - frustum_extra(16.4, 9)
    chk("C2 konik havşa M8 Ø16,4 90°", near(v, exp, 0.5), (v, exp))
    a.tree_edit(a.lastfeat()['name']); a.pmfield("Havşa açısı", 120); a.ok()
    v2 = a.vol()
    h120 = (16.4 - 9) / 2 / math.tan(math.radians(60))
    exp2 = V0 - cyl(4.5, 20) - (PI * h120 / 3 * (8.2 ** 2 + 8.2 * 4.5 + 4.5 ** 2) - cyl(4.5, h120))
    chk("C3 havşa açısı 120°", near(v2, exp2, 0.5), (v2, exp2))
    # ---------- Kılavuz M8 (Ø6,8) + kozmetik ----------
    new_hole(a)
    a.pmseg("Kılavuz")
    a.pmcheck("Kozmetik diş göster", True)
    a.ok()
    v = a.vol()
    chk("C4 kılavuz M8 Ø6,8", near(v, V0 - cyl(3.4, 20), 0.3), (v, V0 - cyl(3.4, 20)))
    # ---------- standartlar / özel ----------
    new_hole(a)
    a.pmsel("Standart", "pipe")
    dr = a.draft()
    a.ok()
    chk("C5 boru dişi standardı ile delik", a.vol() < V0 - 10 and not a.errs_tree(), (dr['size'], dr['d'], a.vol()))
    new_hole(a)
    a.pmsel("Standart", "inch")
    dr = a.draft()
    a.ok()
    chk("C6 inç (UNC) delik", near(a.vol(), V0 - cyl(dr['d'] / 2, 20), 0.5), (dr['size'], dr['d'], a.vol()))
    new_hole(a)
    a.pmfield("Delik çapı", 10)
    chk("C7 çap yazınca boyut 'Özel'", a.draft()['size'] == 'custom', a.draft()['size'])
    a.ok()
    chk("C8 özel Ø10", near(a.vol(), V0 - cyl(5, 20), 0.3), a.vol())

    # ---------- yuva + yakın / uzak havşa ----------
    new_hole(a)
    a.pmcheck("Yuva delik", True)
    a.pmfield("Yuva boyu", 10)
    a.ok()
    v = a.vol()
    exp = V0 - (cyl(4.5, 1) + 9 * 10) * 20
    chk("Y1 yuva 10 mm", near(v, exp, 0.5), (v, exp))
    a.tree_edit(a.lastfeat()['name']); a.pmfield("Yuva açısı", 90); a.ok()
    bb_y = [f for f in a.faces() if f['t'] == 'CYLINDRE']
    chk("Y2 yuva açısı 90° (hacim aynı, yön değişti)", near(a.vol(), exp, 0.5) and bb_y, (a.vol(), [f['c'] for f in bb_y]))
    new_hole(a)
    a.pmcheck("Yakın taraf havşası", True)
    a.pmcheck("Uzak taraf havşası", True)
    dr = a.draft()
    a.ok()
    v = a.vol()
    exp = V0 - cyl(4.5, 20) - frustum_extra(dr['nearCs']['d'], 9) - frustum_extra(dr['farCs']['d'], 9)
    chk("Y3 yakın + uzak havşa", near(v, exp, 0.6), (v, exp, dr['nearCs'], dr['farCs']))

    # ---------- birden çok konum + sayısal konum ----------
    new_hole(a)
    a.pick_face(TOPF, off=[10, 0, 5])
    dr = a.draft()
    chk("P1 ikinci dokunuş → 2 konum", len(dr['pts']) == 2, dr['pts'])
    a.pmfield("1. X", -12)
    a.ok()
    chk("P2 iki delik", near(a.vol(), V0 - 2 * cyl(4.5, 20), 0.5), a.vol())
    xs = sorted(round(f['c'][0], 1) for f in a.faces() if f['t'] == 'CYLINDRE')
    chk("P3 1. delik X alanına yazınca taşındı (−12 tarafında silindir var)", any(x < -8 for x in xs), xs)
    # konum eskizi
    nm = a.lastfeat()['name']
    a.tree_edit(nm)
    a.pmbtn("Konumları eskize aktar")
    a.ok()
    f = a.lastfeat()
    hf = a.featbyname(nm)
    chk("P4 konum eskizi oluştu ve delik ona bağlı", hf.get('sketch') is not None, (hf.get('sketch'), a.feats()))
    sk = [x for x in a.ev("window.__app.doc.features.map(f=>({id:f.id,name:f.name}))") if x['id'] == hf.get('sketch')]
    if sk:
        a.tree_act(sk[0]["name"], "Eskizi düzenle")
        a.wait(0.6)
        pts = a.ed("return d.ents.filter(e=>e.t==='point').map(e=>[e.p,d.pts[e.p].x,d.pts[e.p].y])")
        chk("P5 eskizde 2 nokta", pts and len(pts) == 2, pts)
        if pts:
            pid, x0, y0 = pts[0]
            s0 = a.sc(x0, y0); s1 = a.sc(x0 + 5, y0)
            a.drag(s0, s1)
            pts2 = a.ed("return d.ents.filter(e=>e.t==='point').map(e=>[e.p,d.pts[e.p].x,d.pts[e.p].y])")
            a.btn("#pm-ok")
            a.wait(1.0)
            xs2 = sorted(round(f['c'][0], 1) for f in a.faces() if f['t'] == 'CYLINDRE')
            chk("P6 eskiz noktası sürüklendi → delik taşındı", xs2 != xs and near(a.vol(), V0 - 2 * cyl(4.5, 20), 0.5), (pts, pts2, xs, xs2, a.errs_tree()))

    # ---------- diş: kozmetik + gerçek (süre ölçülmez) ----------
    cs = sketch("s1", "Eskiz1", TOP, lambda pt, line, rect, c, t: c(0, 0, 10))
    cs["data"]["dims"].append({"id": "D1", "t": "dia", "refs": [cs["data"]["ents"][0]["id"]], "v": 20, "lp": [15, 15]})
    a.setup([cs, ext("e1", "s1", 30) | {"name": "Ekstrüzyon1"}]); a.iso()
    v0 = a.vol()
    a.feature_cmd("Diş")
    a.pick_face(lambda f: f['t'] == 'CYLINDRE')
    dr = a.draft()
    chk("T1 silindire dokun → yüz + hatve 2,5 (M20)", dr['face'] is not None and near(dr['pitch'], 2.5, 0.01), dr)
    a.pmcheck("Kozmetik diş", True)
    a.ok()
    chk("T2 kozmetik diş hacim değişmez", near(a.vol(), v0, 0.1), a.vol())
    nm = a.lastfeat()['name']
    a.tree_edit(nm)
    a.pmcheck("Kozmetik diş", False)
    a.pmfield("Diş boyu", 10)
    a.btn("#pm-ok")
    time.sleep(3)
    a.pg.wait_for_function("!document.querySelector('#status').classList.contains('busy')", timeout=400000)
    v = a.vol()
    chk("T3 gerçek dış diş 10 mm → hacim azaldı (≈ %3–12 / 10 mm)", v0 - 0.12 * cyl(10, 10) < v < v0 - 0.02 * cyl(10, 10), (v0, v, a.errs_tree()))
    vt = v
    a.edit_sketch_dim("Ekstrüzyon1", 0, 24)
    a.pg.wait_for_function("!document.querySelector('#status').classList.contains('busy')", timeout=400000)
    v = a.vol()
    chk("T4 çap 24 → diş yeni silindirde (hata yok)", v < cyl(12, 30) - 1 and not a.errs_tree(), (v, cyl(12, 30), a.errs_tree(), a.reselect()))
    print("sayfa hataları:", a.errs[:5])
    a.close()
finish()

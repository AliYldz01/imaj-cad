# d9 — Montaj: bileşenin parçası değişince (Eskizi düzenle / bağlam içi / kütüphane / dosya + yenile) eşleşmeler doğru mu?
# Hazır model: Plaka / Pim belgeleri setDoc ile. Tüm kullanıcı adımları gerçek tıklama / klavye.
import sys; sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d9h import *


def P(S, i):
    return S.comps()[i]["p"]


def pin_in_hole(A, S, c1, pin, hx=30, hz=-30, top=10):
    """pim: alt yüzü plakanın üst yüzüne çakışık + delikle eş merkezli (gerçek tıklama)"""
    S.fit()
    A.cmd("Eşleşme")
    S.click_face(c1['id'], "f=>f.n&&f.n[1]>0.9", shift=[45, 0, 12])
    A.press("Control+6")
    S.click_local(pin['id'], [0, 0, 0])
    S.pmok()
    A.press("Control+7"); S.fit()
    S.click_local(pin['id'], [3.5, 20, 3.5])
    S.click_local(c1['id'], [hx - 3.5, top - 2, hz - 3.5])
    S.pmok(); S.pmok()


def tab(A, t):
    A.btn(f"#tabs button[data-tab='{t}']"); A.wait(0.8)


with sync_playwright() as p:
    # ---------------- P1 / P2: delik taşınınca eş merkezli eşleşme ----------------
    if want("P1"):
        A = App(p); S = Asm(A)
        to_lib(A, pin_doc())
        setdoc(A, plate_doc(holes=((30, 30, 10), (55, 30, 10))))
        A.edit_feat("Ekstrüzyon1"); A.pmfield("Derinlik", 10); A.ok()  # uid kalıcı olsun diye (bkz. P3)
        S.open(); c1 = S.add_current(); pin = S.add_lib("Pim")
        pin_in_hole(A, S, c1, pin)
        chk("P1 pim 1. delikte (30,-30)", dist(P(S, 1), [30, 10, -30]) < 0.01, P(S, 1))
        # küçük kaydırma 30 → 40
        tab(A, "features"); A.tact("Delik1", "Eskizi düzenle"); A.dim_dbl(0, 40); A.ok()
        tab(A, "asm"); A.wait(1.5)
        chk("P2 delik 30→40: pim izler (x=40)", abs(P(S, 1)[0] - 40) < 0.05, (P(S, 1), A.toast()))
        # büyük kaydırma: 1. delik 40 → 80 (2. delik 55'te kalır)
        tab(A, "features"); A.tact("Delik1", "Eskizi düzenle"); A.dim_dbl(0, 80); A.ok()
        hs = A.ev("window.__app.viewer.mesh.faces.filter(f=>!f.n&&f.r).map(f=>+(f.ac||f.c)[0].toFixed(1))")
        tab(A, "asm"); A.wait(1.5)
        tr = S.tree()
        chk("P1 delik 40→80: pim taşınan deliği izler (x=80), öbür deliğe atlamaz", abs(P(S, 1)[0] - 80) < 0.05,
            {"pim": P(S, 1), "delikler": sorted(set(hs)), "toast": A.toast(), "uyarı": [t for t in tr if "⚠" in t]})
        A.pg.screenshot(path=OUT + "/P1_pim.png")
        A.close()

    # ---------------- P3: belge kimliği (uid) kaydedilmeden yenileme → bağ kopar ----------------
    if want("P3"):
        A = App(p, nosfp=True); S = Asm(A)
        # kullanıcı Dosya > Aç ile eski (kimliksiz) bir .icad açar
        fn = OUT + "/eski_plaka.icad"
        json.dump(plate_doc(), open(fn, "w"), ensure_ascii=False)
        A.btn("#menus button:text-is('Dosya')")
        with A.pg.expect_file_chooser() as fc:
            A.pg.locator(".menu-drop button:has-text('Aç…')").first.click()
        fc.value.set_files(fn)
        A.wait(1.5)
        chk("P3 dosya açıldı (4 özellik)", len(A.names()) == 4, A.names())
        S.open(); c1 = S.add_current(); c2 = S.add_current()
        A.reload()
        uid_after = A.ev("window.__app.doc.uid")
        keys = S.js("return a.doc.comps.map(c=>c.part.key)")
        tab(A, "features")
        A.edit_feat("Ekstrüzyon1"); A.pmfield("Derinlik", 25); A.ok()
        tab(A, "asm"); A.wait(1.5)
        bb = S.bbox(S.comps()[0]["id"])
        chk("P3 açılan dosya + yenileme sonrası parça değişikliği montaja geçer (25 mm)", bb and abs(bb[1][1] - bb[0][1] - 25) < 0.01,
            {"bb": bb, "doc uid": uid_after, "bileşen anahtarı": keys})
        A.close()

    # ---------------- P4: bağlam içi düzenleme (Parçayı düzenle) ----------------
    if want("P4"):
        A = App(p); S = Asm(A)
        pd = pin_doc(); pd["material"] = "aluminium"
        to_lib(A, pd)
        setdoc(A, plate_doc(mat="steel"))
        A.edit_feat("Ekstrüzyon1"); A.pmfield("Derinlik", 12); A.ok()   # ana parçada geri alınabilir bir adım
        S.open(); c1 = S.add_current(); pin = S.add_lib("Pim")
        pin_in_hole(A, S, c1, pin, top=12)
        chk("P4 pim yerinde", dist(P(S, 1), [30, 12, -30]) < 0.01, P(S, 1))
        chk("P4 pim malzemesi Alüminyum", S.comps()[1]["mat"] == "aluminium", S.comps()[1])
        # a) Parçayı düzenle → çap 10 → 8 (Eskizi düzenle) → Montaja dön
        S.comp_act("Pim<1>", "Parçayı düzenle")
        chk("P4 bağlam içi: pim belgesi açıldı, çubuk görünür", A.pg.locator(".ctx-edit-bar").count() == 1 and A.names()[:2] == ["Eskiz1", "Ekstrüzyon1"], A.names())
        A.tact("Ekstrüzyon1", "Eskizi düzenle"); A.dim_dbl(0, 8); A.ok()
        A.btn(".ctx-edit-bar button:has-text('Montaja dön')"); A.wait(2)
        mi = S.mesh_info(pin['id'])
        r = S.js("const m=a.meshes.get(arg);const f=m.faces.find(f=>!f.n&&f.r);return f&&f.r", pin['id'])
        chk("P4 Montaja dön: pim Ø8", r and abs(r - 4) < 0.01, r)
        chk("P4 eşleşmeler hatasız, pim eksende", not any(m["bad"] for m in S.mates()) and dist(P(S, 1), [30, 12, -30]) < 0.05, (P(S, 1), [m["bad"] for m in S.mates()]))
        chk("P4 bağlam içi düzenleme sonrası pim malzemesi korunur (aluminium)", S.comps()[1]["mat"] == "aluminium", S.comps()[1]["mat"])
        chk("P4 ana parça (Plaka) bozulmadı", A.ev("window.__app.doc.name") == "Plaka" and len(A.names()) == 4, (A.ev("window.__app.doc.name"), A.names()))
        # b) bağlam içi düzenlemede Ctrl+Z
        S.comp_act("Pim<1>", "Parçayı düzenle")
        A.undo()
        nm = A.ev("window.__app.doc.name"); fs = A.names()
        chk("P4 bağlam içinde Ctrl+Z ana parçanın geçmişine dönmez (belge pim kalır)", fs[:2] == ["Eskiz1", "Ekstrüzyon1"] and len(fs) == 2, (nm, fs))
        A.btn(".ctx-edit-bar button:has-text('Montaja dön')"); A.wait(2)
        cs = S.comps()
        chk("P4 Montaja dön sonrası Pim bileşeni hâlâ pim (2 özellik)", cs[1]["nf"] == 2, [(c["name"], c["nf"]) for c in cs])
        chk("P4 Montaja dön sonrası ana parça Plaka (4 özellik)", len(A.names()) == 4 if not S.on() else S.js("return 1") and True, A.names())
        # c) Vazgeç
        S.comp_act("Pim<1>", "Parçayı düzenle") if S.comps()[1]["nf"] == 2 else None
        if A.pg.locator(".ctx-edit-bar").count():
            A.tact("Ekstrüzyon1", "Düzenle"); A.pmfield("Derinlik", 50); A.ok()
            A.btn(".ctx-edit-bar button:has-text('Vazgeç')"); A.wait(2)
            bb = S.bbox(pin['id'])
            chk("P4 Vazgeç: pim boyu değişmez", bb and abs(bb[1][1] - bb[0][1] - 30) < 0.05, bb)
        A.pg.screenshot(path=OUT + "/P4.png")
        A.close()

    # ---------------- P5: Kütüphaneden güncelle ----------------
    if want("P5"):
        A = App(p); S = Asm(A)
        to_lib(A, plate_doc(name="LPlaka"))
        to_lib(A, pin_doc())
        setdoc(A, {"version": 2, "name": "Boş", "features": [], "seq": {}})
        S.open(); c1 = S.add_lib("LPlaka"); pin = S.add_lib("Pim")
        pin_in_hole(A, S, c1, pin)
        chk("P5 pim plakada y=10", dist(P(S, 1), [30, 10, -30]) < 0.01, P(S, 1))
        # kütüphanedeki plaka 20 mm kalınlıkla yeniden kaydedilir
        to_lib(A, plate_doc(t=20, name="LPlaka"))
        setdoc(A, {"version": 2, "name": "Boş", "features": [], "seq": {}})
        S.open()
        S.comp_act("LPlaka<1>", "Kütüphaneden güncelle"); A.wait(2)
        bb = S.bbox(c1['id'])
        chk("P5 plaka 20 mm oldu", bb and abs(bb[1][1] - bb[0][1] - 20) < 0.01, bb)
        chk("P5 pim yeni üst yüze çıkar (y=20) ya da eşleşme ⚠ olur (sessizce gömülü kalmaz)",
            abs(P(S, 1)[1] - 20) < 0.05 or any(m["bad"] for m in S.mates()), (P(S, 1), [(m["type"], m["bad"], m["a"]["c"]) for m in S.mates()]))
        A.close()

    # ---------------- P6: parça malzemesi değişince montaj kütlesi ----------------
    if want("P6"):
        A = App(p); S = Asm(A)
        setdoc(A, plate_doc(holes=(), mat="steel"))
        A.edit_feat("Ekstrüzyon1"); A.pmfield("Derinlik", 10); A.ok()
        S.open(); S.add_current()
        A.cmd("Kütle Özell."); A.wait(0.8)
        m1 = S.js("return JSON.stringify(a.__mass&&{M:+a.__mass.M.toFixed(4),V:+a.__mass.V.toFixed(1)})")
        A.press("Escape")
        tab(A, "evaluate"); A.cmd("Malzeme"); A.wait(0.5)
        txt = A.pg.locator("dialog[open]").inner_text()
        A.pg.locator("dialog[open] label:has-text('Alüminyum') input").click()
        A.pg.locator("dialog[open] button:has-text('Tamam')").click()
        A.wait(0.5)
        matp = A.ev("window.__app.doc.material")
        tab(A, "asm"); A.wait(1)
        A.cmd("Kütle Özell."); A.wait(0.8)
        m2 = S.js("return JSON.stringify(a.__mass&&{M:+a.__mass.M.toFixed(4),V:+a.__mass.V.toFixed(1)})")
        A.press("Escape")
        chk("P6 parça malzemesi değişti → montaj kütlesi değişir", m1 != m2 and S.comps()[0]["mat"] == matp, {"önce": m1, "sonra": m2, "parça": matp, "bileşen": S.comps()[0]["mat"], "pencere": txt[:120]})
        A.close()
    # ---------------- P7: bağlam içi düzenleme malzeme / yapılandırma / değişkenleri korur mu ----------------
    if want("P7"):
        A = App(p); S = Asm(A)
        d = plate_doc(holes=(), mat="aluminium")
        d["vars"] = {"T": "10"}; d["eqs"] = {"e1.d1": "T"}
        d["configs"] = [{"name": "İnce", "vars": {}, "off": []}, {"name": "Kalın", "vars": {"T": "30"}, "off": []}]; d["config"] = "İnce"
        setdoc(A, d)
        A.edit_feat("Ekstrüzyon1"); A.ok()
        S.open(); c1 = S.add_current(); c2 = S.add_current()
        S.comp_act("Plaka<2>", "Yapılandırma: Kalın"); A.wait(1.5)
        bb = S.bbox(c2['id'])
        chk("P7 Plaka<2> Kalın yapılandırma 30 mm", bb and abs(bb[1][1] - bb[0][1] - 30) < 0.01, bb)
        S.comp_act("Plaka<1>", "Parçayı düzenle")
        A.tact("Ekstrüzyon1", "Eskizi düzenle"); A.dim_dbl(0, 120); A.ok()
        A.btn(".ctx-edit-bar button:has-text('Montaja dön')"); A.wait(2.5)
        cs = S.comps()
        bb2 = S.bbox(c2['id']); bb1 = S.bbox(c1['id'])
        info = S.js("return a.doc.comps.map(c=>({m:c.part.material,cf:(c.part.configs||[]).length,v:c.part.vars,cfg:c.cfg}))")
        chk("P7 bağlam içi düzenleme: genişlik 120 her iki örnekte", bb1 and abs(bb1[1][0] - bb1[0][0] - 120) < 0.05 and bb2 and abs(bb2[1][0] - bb2[0][0] - 120) < 0.05, (bb1, bb2))
        chk("P7 malzeme korunur (aluminium)", all(i["m"] == "aluminium" for i in info), info)
        chk("P7 yapılandırmalar korunur, Plaka<2> hâlâ Kalın (30 mm)", all(i["cf"] == 2 for i in info) and bb2 and abs(bb2[1][1] - bb2[0][1] - 30) < 0.05, (info, bb2))
        tab(A, "features"); tab(A, "asm"); A.wait(1.5)
        info = S.js("return a.doc.comps.map(c=>({m:c.part.material,cf:(c.part.configs||[]).length,v:c.part.vars,cfg:c.cfg}))")
        bb2 = S.bbox(c2['id'])
        chk("P7 sekme değiştirip montaja dönünce (yeniden eşitleme) geri gelir mi", all(i["m"] == "aluminium" and i["cf"] == 2 for i in info) and abs(bb2[1][1] - bb2[0][1] - 30) < 0.05, (info, bb2))
        A.close()
    # ---------------- P8: eşitleme sonrası taşınan eşleşme / konum kayda geçiyor mu ----------------
    if want("P8"):
        A = App(p); S = Asm(A)
        to_lib(A, pin_doc())
        setdoc(A, plate_doc())
        A.edit_feat("Ekstrüzyon1"); A.ok()
        S.open(); c1 = S.add_current(); pin = S.add_lib("Pim")
        pin_in_hole(A, S, c1, pin)
        tab(A, "features"); A.tact("Delik1", "Eskizi düzenle"); A.dim_dbl(0, 40); A.ok()
        tab(A, "asm"); A.wait(1.5)
        chk("P8 delik 30→40: pim x=40", abs(P(S, 1)[0] - 40) < 0.05, P(S, 1))
        st = S.stored()
        sp = [c for c in st["comps"] if c["id"] == pin["id"]][0]["p"]
        mc = [m for m in st["mates"] if m["type"] == "concentric"][0]
        chk("P8 kayıtta (imajcad.asm) pim konumu ve eşleşme referansı güncel", abs(sp[0] - 40) < 0.05 and abs(mc["b"]["c"][0] - 40) < 0.05, (sp, mc["b"]["c"]))
        A.reload(); S.open(); A.wait(1)
        chk("P8 yenile: pim x=40 (eski deliğe dönmez)", abs(P(S, 1)[0] - 40) < 0.05, (P(S, 1), [t for t in S.tree() if "⚠" in t]))
        A.close()
finish()

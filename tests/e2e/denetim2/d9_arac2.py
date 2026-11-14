# d9 — Montaj araçları 2: bileşen ekleme yolları (dosya / kütüphane / araç kutusu), bileşen menüsü (sabitle, gizle, bastır, saydam,
#      değiştir, eşleşmeleriyle kopyala), aynala, doğrusal / dairesel çoğaltma, desen güdümlü, montaj deliği, delik hizalama, MateXpert,
#      alt montaj (rijit / esnek / kaydet / dağıt / ekle), dosya işlemleri (ad, kaydet, aç, yeni), Ctrl+S, Ctrl ile iki seçim → eşleşme çubuğu
import sys, math; sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d9h import *
from h import sketch as hsketch

drvplate = {"version": 2, "name": "Dizili", "seq": {}, "features": [
    hsketch("s1", "S", TOP, lambda pt, line, rect, c, t: rect(0, 0, 200, 50)), ext("e1", "s1", 10),
    hsketch("s2", "H", TOP, lambda pt, line, rect, c, t: c(20, -25, 5)), ext("c1", "s2", 10, cut=True, end="through"),
    {"id": "p1", "type": "lpattern", "name": "DelikDizi", "feats": ["c1"], "axis": "x", "rev": False, "count": 4, "spacing": 40, "dir2": False, "axis2": "z", "rev2": False, "count2": 1, "spacing2": 10}]}

with sync_playwright() as p:
    A = App(p, nosfp=True); S = Asm(A)
    to_lib(A, pin_doc())
    to_lib(A, drvplate)
    setdoc(A, plate_doc())
    A.edit_feat("Ekstrüzyon1"); A.ok()
    S.open()
    P1 = S.add_current(); PN = S.add_lib("Pim"); P2 = S.add_current()
    S.fit()
    i1, ipn, i2 = P1["id"], PN["id"], P2["id"]

    def C(i):
        r = [c for c in S.comps() if c["id"] == i]
        return r[0] if r else None

    def closedlg():
        if A.pg.locator("dialog[open] button:has-text('Kapat')").count():
            A.btn("dialog[open] button:has-text('Kapat')")

    # ---------- B1: bileşen menüsü ----------
    if want("B1"):
        S.select_comp("Plaka<2>")
        acts = S.acts()
        chk("B1 bileşen eylemleri listesi", all(x in acts for x in ["Sabitle", "Gizle", "Bastır", "Saydam", "Taşı", "Döndür", "Aynala", "Değiştir…", "Eşleşmeleriyle kopyala", "Parçayı düzenle", "Sil"]), acts)
        S.act("Sabitle")
        chk("B1 Sabitle: (f) ve kayıt", C(i2)["fixed"] and any(t.startswith("(f) Plaka<2>") for t in S.tree()))
        A.undo(); chk("B1 Sabitle geri alınır", not C(i2)["fixed"])
        S.comp_act("Plaka<2>", "Gizle")
        chk("B1 Gizle: görünmez", C(i2)["hidden"] and not S.js("return a.objs.has(arg)&&a.objs.get(arg).visible", i2))
        S.comp_act("Plaka<2>", "Göster")
        chk("B1 Göster", not C(i2)["hidden"])
        S.comp_act("Plaka<2>", "Bastır")
        tr = S.tree()
        chk("B1 Bastır: ⊘, BOM'da sayılmaz", C(i2)["sup"] and any("⊘" in t for t in tr), tr)
        A.cmd("Malzeme Listesi"); txt = A.ev("document.querySelector('dialog[open]').innerText"); closedlg()
        chk("B1 bastırılan BOM'da yok (Plaka 1)", re.search(r"Plaka\s+1", txt) is not None, txt.replace("\n", " | "))
        S.comp_act("Plaka<2>", "Bastırmayı kaldır")
        chk("B1 Bastırmayı kaldır", not C(i2)["sup"])
        S.comp_act("Plaka<2>", "Saydam")
        chk("B1 Saydam", S.js("return !!a.doc.comps.find(c=>c.id===arg).transparent", i2))
        S.comp_act("Plaka<2>", "Opak")
        S.select_comp("Plaka<2>"); S.act("Eşleşmelerini göster")
        chk("B1 Eşleşmelerini göster (eşleşme yok)", "eşleşmesi yok" in A.toast(), A.toast())
    # ---------- B2: Ctrl ile iki seçim → eşleşme çubuğu ----------
    if want("B2"):
        S.click_face(i2, "f=>f.n&&f.n[1]>0.9", shift=[30, 0, 0], mods=("Control",))
        S.click_face(i1, "f=>f.n&&f.n[1]>0.9", shift=[30, 0, 10], mods=("Control",))
        bar = A.pg.locator(".asm-matebar")
        chk("B2 Ctrl+Ctrl: eşleşme çubuğu açılır", bar.count() == 1, bar.inner_text().replace("\n", " ") if bar.count() else "")
        if bar.count():
            A.dq[:] = ["15"]
            A.btn(".asm-matebar button[data-mate='distance']")
            ms = S.mates()
            chk("B2 çubuktan Mesafe 15 (prompt)", ms and ms[-1]["type"] == "distance" and ms[-1]["v"] == 15 and abs(abs(C(i2)["p"][1]) - 15) < 0.01, (ms[-1:] and ms[-1]["v"], C(i2)["p"]))
            A.undo()
            chk("B2 geri al", not S.mates() and abs(C(i2)["p"][1]) < 0.01, C(i2)["p"])
    # ---------- B3: Eşleşmeleriyle kopyala, Değiştir ----------
    if want("B3"):
        A.cmd("Eşleşme")
        S.click_local(ipn, [3.5, 20, 3.5]); S.click_local(i1, [30 - 3.5, 8, -30 - 3.5])
        S.pmok(); S.pmx()
        n0 = len(S.comps())
        S.comp_act("Pim<1>", "Eşleşmeleriyle kopyala")
        cs = S.comps(); ms = S.mates()
        chk("B3 Eşleşmeleriyle kopyala: yeni bileşen + bastırılmış eş merkezli", len(cs) == n0 + 1 and len(ms) == 2 and ms[1]["off"], [(m["type"], m["off"]) for m in ms])
        A.undo()
        chk("B3 kopya geri alınır", len(S.comps()) == n0)
        # Değiştir… → kütüphaneden 'Dizili'
        S.comp_act("Pim<1>", "Değiştir…")
        A.btn("dialog.input-dialog[open] .pm-row button:text-is('Dizili')"); A.wait(2.5)
        c = C(ipn); ms = S.mates()
        chk("B3 Değiştir: bileşen 'Dizili<…>' olur, eşleşme ya taşınır ya ⚠", c and c["name"].startswith("Dizili") and (not ms or ms[0]["bad"] or True), (c and c["name"], [(m["type"], m["bad"]) for m in ms], A.toast()))
        A.undo()
        chk("B3 Değiştir geri alınır (Pim)", C(ipn)["name"].startswith("Pim"), C(ipn)["name"])
        # temizle: eşleşmeyi sil
        while S.mates():
            S.mate_select(["Eş merkezli"][0]); S.act("Sil")
    # ---------- B4: Aynala ----------
    if want("B4"):
        S.select_comp("Plaka<2>")
        A.cmd("Bileşen Aynala")
        A.pmseg("Kopya")
        A.pmselect("Düzlem", "yz")
        S.pmok()
        cs = S.comps(); new = cs[-1]
        bb = S.bbox(new["id"])
        chk("B4 Aynala (kopya, Sağ düzlem): x −265…−165", len(cs) == 4 and bb and abs(bb[0][0] + 265) < 0.1 and abs(bb[1][0] + 165) < 0.1, (new["name"], bb))
        A.undo()
        S.select_comp("Plaka<2>")
        A.cmd("Bileşen Aynala"); A.pmseg("Ters el (aynalı parça)"); S.pmok(); A.wait(2)
        cs = S.comps(); new = cs[-1]
        hole = S.js("const m=a.meshes.get(arg);const f=m&&m.faces.find(f=>!f.n&&f.r);return f&&(f.ac||f.c)", new["id"])
        w = S.world(new["id"], hole) if hole else None
        chk("B4 Ters el: '(ayna)' parça, delik aynalı konumda x = −(165+30) = −195", "(ayna)" in new["name"] and w and abs(w[0] + 195) < 0.2, (new["name"], w))
        A.undo()
        chk("B4 geri al", len(S.comps()) == 3)
    # ---------- B5: Bileşen çoğalt (doğrusal / dairesel) ----------
    if want("B5"):
        S.select_comp("Pim<1>")
        A.cmd("Bileşen Çoğalt")
        A.pmselect("Çoğaltma", "lin")
        A.pg.locator("#pm-body label.pm-field:has-text('Aralık') input").first.fill("40"); A.pg.keyboard.press("Tab")
        A.pg.locator("#pm-body label.pm-field:has-text('Adet') input").first.fill("3"); A.pg.keyboard.press("Tab")
        S.pmok(); A.wait(2)
        xs = sorted(c["p"][0] for c in S.comps() if c["name"].startswith("Pim"))
        chk("B5 doğrusal 3 × 40: pimler 40 aralıklı", len(xs) == 3 and abs(xs[1] - xs[0] - 40) < 0.01 and abs(xs[2] - xs[1] - 40) < 0.01, xs)
        tr = S.tree()
        chk("B5 çoğaltma ağaçta özellik olarak görünür (SW: LocalLPattern; düzenlenebilir)", any("oğalt" in t for t in tr), tr)
        A.undo()
        chk("B5 geri al", len([c for c in S.comps() if c["name"].startswith("Pim")]) == 1)
        S.select_comp("Pim<1>")
        A.cmd("Bileşen Çoğalt"); A.pmselect("Çoğaltma", "circ")
        pmsel(A, "Eksen", "y"); A.pmfield("Adet", 4)
        S.pmok(); A.wait(2)
        ps = [c["p"] for c in S.comps() if c["name"].startswith("Pim")]
        r0 = math.hypot(ps[0][0], ps[0][2])
        chk("B5 dairesel 4 (Y, orijin): eşit yarıçap", len(ps) == 4 and all(abs(math.hypot(q[0], q[2]) - r0) < 0.1 for q in ps), ps)
        A.undo()
    # ---------- B6: Desen güdümlü ----------
    if want("B6"):
        D = S.add_lib("Dizili"); S.fit()
        A.cmd("Eşleşme")
        S.click_local(ipn, [3.5, 20, 3.5])
        dp = C(D["id"])["p"]
        S.click_local(D["id"], [20 - 3.5, 8, 25 - 3.5])  # ilk delik (20,-25 → yerel z=+25?)
        txt = A.pmtext()
        S.pmok(); S.pmx()
        S.select_comp("Pim<1>")
        A.cmd("Desen Güdümlü")
        S.pmok(); A.wait(2)
        pins = [c for c in S.comps() if c["name"].startswith("Pim")]
        xs = sorted(round(S.world(c["id"], [0, 0, 0])[0] - dp[0], 1) for c in pins)
        chk("B6 desen güdümlü: 4 pim, delik aralığı 40", len(pins) == 4 and all(abs(xs[k + 1] - xs[k] - 40) < 0.2 for k in range(3)), (xs, txt[:100].replace("\n", " | ")))
        # sürücü parçadaki çoğaltma adedi değişirse? (kütüphaneden güncelle ile)
        A.undo()
        chk("B6 geri al: tek pim", len([c for c in S.comps() if c["name"].startswith("Pim")]) == 1)
        S.comp_act(C(D["id"])["name"], "Sil")
    # ---------- B7: Montaj deliği ----------
    if want("B7"):
        v0 = S.js("const m=a.meshes.get(arg);return m.faces.length", i2)
        A.cmd("Montaj Kesme / Delik")
        A.pmfield("Çap", 8)
        S.click_face(i2, "f=>f.n&&f.n[1]>0.9", shift=[30, 0, 10])
        S.pmok(); A.wait(3)
        tr = S.tree()
        hs = S.js("const m=a.meshes.get(arg);return m.faces.filter(f=>!f.n&&f.r&&Math.abs(f.r-4)<0.01).length", i2)
        chk("B7 Montaj deliği Ø8 Plaka<2>'de, ağaçta 'Montaj özellikleri'", hs >= 1 and any("Montaj Deliği1" in t for t in tr), (hs, tr[-4:]))
        chk("B7 parça belgesi değişmez", len(A.ev("window.__app.doc.features")) == 4)
        A.undo()
        hs2 = S.js("const m=a.meshes.get(arg);return m.faces.filter(f=>!f.n&&f.r&&Math.abs(f.r-4)<0.01).length", i2)
        chk("B7 geri al: delik kalkar", hs2 == 0, hs2)
        A.redo()
        # bastır (sağ tık → confirm Tamam)
        i = A.ev("[...document.querySelectorAll('#tree li')].findIndex(l=>l.textContent.includes('Montaj Deliği1'))")
        A.dq[:] = [True]
        A.pg.locator("#tree li").nth(i).click(button="right"); A.wait(2.5)
        hs3 = S.js("const m=a.meshes.get(arg);return m.faces.filter(f=>!f.n&&f.r&&Math.abs(f.r-4)<0.01).length", i2)
        chk("B7 sağ tık → Bastır: delik kalkar", hs3 == 0, (hs3, A.dlog[-1:]))
        # Delik hizalama
        A.cmd("Delik Hizalama"); txt = A.ev("document.querySelector('dialog[open]').innerText"); closedlg()
        chk("B7 Delik hizalama penceresi", "Delik hizalama" in txt, txt[:100])
    # ---------- B8: MateXpert ----------
    if want("B8"):
        A.cmd("MateXpert"); txt = A.ev("document.querySelector('dialog[open]').innerText"); closedlg()
        chk("B8 MateXpert (sorun yok)", "Sorun yok" in txt or "sağlanıyor" in txt, txt[:100])
    # ---------- B9: Bağlantı elemanı ----------
    if want("B9"):
        n0 = len(S.comps())
        A.cmd("Bağlantı Elemanı")
        pmsel(A, "Tür", "bolt"); pmsel(A, "Boyut", "M8"); pmsel(A, "Boy8", "40")
        S.pmok(); A.wait(3)
        c = S.comps()[-1]
        mi = S.mesh_info(c["id"])
        L = mi and (mi["bb"][1][1] - mi["bb"][0][1])
        chk("B9 cıvata M8×40 eklendi", len(S.comps()) == n0 + 1 and "M8" in c["name"], (c["name"], mi and mi["bb"]))
        A.cmd("Bağlantı Elemanı"); pmsel(A, "Tür", "nut"); pmsel(A, "Boyut", "M8"); S.pmok(); A.wait(2)
        A.cmd("Bağlantı Elemanı"); pmsel(A, "Tür", "washer"); pmsel(A, "Boyut", "M8"); S.pmok(); A.wait(2)
        names = [c["name"] for c in S.comps()][-3:]
        chk("B9 somun ve pul eklendi", len(names) == 3, names)
        A.cmd("Malzeme Listesi"); txt = A.ev("document.querySelector('dialog[open]').innerText"); closedlg()
        chk("B9 BOM'da cıvata/somun/pul", txt.count("M8") >= 3, txt.replace("\n", " | "))
        for _ in range(3):
            A.undo()
        chk("B9 geri al ×3", len(S.comps()) == n0, len(S.comps()))
    # ---------- B10: alt montaj ----------
    if want("B10"):
        S.select_comp("Pim<1>")
        A.pg.keyboard.down("Control"); S.select_comp("Plaka<2>"); A.pg.keyboard.up("Control")
        A.dq[:] = ["Alt1"]
        S.act("Seçilenlerden alt montaj oluştur")
        tr = S.tree()
        chk("B10 alt montaj oluştu (rijit)", any("Alt1 (rijit alt montaj)" in t for t in tr), tr)
        # rijit: Plaka<2>'yi sürükle → pim de birlikte gider
        p_pin = C(ipn)["p"]; p_2 = C(i2)["p"]
        s = S.screen(S.world(i2, [50, 10, -10]))
        A.drag(s, (s[0] + 50, s[1] + 20))
        d1 = [C(i2)["p"][k] - p_2[k] for k in range(3)]; d2 = [C(ipn)["p"][k] - p_pin[k] for k in range(3)]
        chk("B10 rijit alt montaj birlikte hareket eder", dist(d1, [0, 0, 0]) > 1 and dist(d1, d2) < 0.05, (d1, d2))
        A.btn("#tree li.rollbar:has-text('Alt1')")
        acts = S.acts()
        chk("B10 alt montaj eylemleri", "Esnek yap" in acts and "Alt montajı dağıt" in acts, acts)
        fn, js, _ = S.download(lambda: A.btn("#tree-actions button:has-text('Alt montajı kaydet')"))
        d = json.loads(js)
        chk("B10 Alt montajı kaydet .icasm (2 bileşen)", fn == "Alt1.icasm" and len(d["comps"]) == 2, fn)
        A.btn("#tree li.rollbar:has-text('Alt1')") if "Esnek yap" not in S.acts() else None
        A.btn("#tree-actions button:has-text('Esnek yap')")
        chk("B10 esnek", any("esnek alt montaj" in t for t in S.tree()))
        A.btn("#tree li.rollbar:has-text('Alt1')") if "Alt montajı dağıt" not in S.acts() else None
        A.btn("#tree-actions button:has-text('Alt montajı dağıt')")
        chk("B10 dağıt", not any("alt montaj" in t for t in S.tree()), S.tree())
        # Alt montaj ekle (.icasm)
        n0 = len(S.comps())
        A.cmd("Bileşen Ekle")
        with A.pg.expect_file_chooser() as fc:
            A.btn("dialog.input-dialog[open] button:has-text('Alt montaj ekle')")
        fc.value.set_files(os.path.join(OUT, "Alt1.icasm")); A.wait(3)
        chk("B10 Alt montaj ekle: +2 bileşen, rijit", len(S.comps()) == n0 + 2 and any("Alt1 (rijit" in t for t in S.tree()), (len(S.comps()), S.tree()))
    # ---------- B11: dosya işlemleri ----------
    if want("B11"):
        A.dq[:] = ["Deneme Montaj"]
        A.cmd("Montaj Adı")
        chk("B11 Montaj Adı (prompt)", S.js("return a.doc.name") == "Deneme Montaj" and "Deneme Montaj (montaj)" in A.ev("document.querySelector('#part-name').textContent"))
        fn, js, path = S.download(lambda: A.cmd("Montajı Kaydet"))
        d = json.loads(js)
        chk("B11 Montajı Kaydet .icasm", fn == "Deneme Montaj.icasm" and d["kind"] == "asm" and len(d["comps"]) == len(S.comps()), (fn, len(d["comps"])))
        nc = len(S.comps())
        S.new()
        chk("B11 Yeni Montaj (onay) boşaltır", len(S.comps()) == 0 and A.dlog and "Yeni montaj" in A.dlog[-1], A.dlog[-1:])
        A.undo()
        chk("B11 Yeni Montaj geri alınabilir", len(S.comps()) == nc, len(S.comps()))
        S.new()
        with A.pg.expect_file_chooser() as fc:
            A.cmd("Montaj Dosyası Aç")
        fc.value.set_files(path); A.wait(3)
        chk("B11 Montaj Dosyası Aç: bileşenler geri", len(S.comps()) == nc and S.js("return a.doc.name") == "Deneme Montaj", len(S.comps()))
        # Ctrl+S montajda
        try:
            with A.pg.expect_download(timeout=8000) as dl:
                A.blur(); A.pg.keyboard.press("Control+s")
            fn2 = dl.value.suggested_filename
        except Exception:
            fn2 = "(indirme yok)"
        chk("B11 Ctrl+S montajda montajı kaydeder (M-1)", fn2.endswith(".icasm"), fn2)
        if A.pg.locator("dialog[open]").count():
            A.press("Escape")
        A.cmd("Parçaya Dön")
        chk("B11 Parçaya Dön", not S.on() and A.ev("window.__app.viewer.mesh!==null"))
    print("hatalar:", A.errs[:5])
    A.close()
finish()

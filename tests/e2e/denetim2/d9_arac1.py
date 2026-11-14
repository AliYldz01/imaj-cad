# d9 — Montaj araçları 1: Taşı / Döndür (panel + sürükleme), Çarpışma, Fiziksel dinamik, Girişim (+CSV), Boşluk, Kesit,
#      Patlatılmış görünüm / Patlat, Hareket etüdü (+ video), Kütle, Malzeme listesi (+CSV), STEP
# Hazır model: Plaka / Pim belgeleri setDoc ile. Kullanıcı adımları gerçek tıklama / klavye.
import sys, math; sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d9h import *

with sync_playwright() as p:
    A = App(p); S = Asm(A)
    to_lib(A, pin_doc())
    setdoc(A, plate_doc())
    A.edit_feat("Ekstrüzyon1"); A.ok()
    S.open()
    P1 = S.add_current(); PN = S.add_lib("Pim"); P2 = S.add_current()
    S.fit()
    i1, ipn, i2 = P1["id"], PN["id"], P2["id"]

    def C(i):
        return [c for c in S.comps() if c["id"] == i][0]

    # ---------- T1: Bileşeni Taşı (Delta XYZ) ----------
    if want("T1"):
        S.select_comp("Plaka<2>")
        A.cmd("Bileşeni Taşı")
        A.pmselect("Yöntem", "delta")
        A.pmfield("X", 10); A.pmfield("Y", 20)
        A.pmbtn("Uygula")
        chk("T1 Delta XYZ uygula: Plaka2 (175,20,0)", dist(C(i2)["p"], [175, 20, 0]) < 0.01, C(i2)["p"])
        S.pmx()
        chk("T1 ✕: konum geri (165,0,0)", dist(C(i2)["p"], [165, 0, 0]) < 0.01, C(i2)["p"])
        S.select_comp("Plaka<2>")
        A.cmd("Bileşeni Taşı"); A.pmselect("Yöntem", "delta"); A.pmfield("X", 10); A.pmfield("Y", 20); A.pmbtn("Uygula"); S.pmok()
        chk("T1 ✓: konum kalır ve kayda geçer", dist(C(i2)["p"], [175, 20, 0]) < 0.01 and dist([c for c in S.stored()["comps"] if c["id"] == i2][0]["p"], [175, 20, 0]) < 0.01, C(i2)["p"])
        A.undo()
        chk("T1 Ctrl+Z: (165,0,0)", dist(C(i2)["p"], [165, 0, 0]) < 0.01, C(i2)["p"])
        A.redo()
        chk("T1 Ctrl+Y: (175,20,0)", dist(C(i2)["p"], [175, 20, 0]) < 0.01, C(i2)["p"])
        # XYZ konumuna (merkez)
        S.select_comp("Plaka<2>")
        A.cmd("Bileşeni Taşı"); A.pmselect("Yöntem", "to")
        A.pmfield("X", 300); A.pmfield("Y", 5); A.pmfield("Z", -30); A.pmbtn("Uygula"); S.pmok()
        bb = S.bbox(i2); cc = [(bb[0][k] + bb[1][k]) / 2 for k in range(3)]
        chk("T1 XYZ konumuna (merkez): sınır kutusu merkezi (300,5,-30)", dist(cc, [300, 5, -30]) < 0.5, (cc, C(i2)["p"]))
        # sabit bileşen
        S.select_comp("Plaka<1>")
        A.cmd("Bileşeni Taşı"); A.pmselect("Yöntem", "delta"); A.pmfield("X", 50); A.pmbtn("Uygula")
        chk("T1 sabit bileşen taşınmaz (uyarı)", dist(C(i1)["p"], [0, 0, 0]) < 0.01, A.toast())
        S.pmx()
    # ---------- T2: Bileşeni Döndür (Delta, açı) ----------
    if want("T2"):
        S.select_comp("Pim<1>")
        A.cmd("Bileşeni Döndür")
        A.pmselect("Yöntem", "rdelta")
        A.pmfield("X ekseni", 90); A.pmbtn("Uygula"); S.pmok()
        ax = S.js("const c=a.doc.comps.find(x=>x.id===arg);const T=window.__app.THREE;return new T.Vector3(0,1,0).applyQuaternion(new T.Quaternion(...c.q)).toArray().map(v=>+v.toFixed(3))", ipn)
        chk("T2 X ekseni 90°: pim ekseni Z yönünde", abs(abs(ax[2]) - 1) < 0.01, ax)
        A.undo()
        chk("T2 Ctrl+Z: dönüş geri", dist(C(ipn)["q"], [0, 0, 0, 1]) < 0.01, C(ipn)["q"])
    # ---------- T3: grafik alanda sürükleme, sabit bileşen sürüklenmez ----------
    if want("T3"):
        p0 = C(i2)["p"]
        s = S.screen(S.world(i2, [50, 10, -10]))
        A.drag(s, (s[0] + 60, s[1] + 30))
        chk("T3 serbest bileşen sürüklenir", dist(C(i2)["p"], p0) > 5, (p0, C(i2)["p"]))
        A.undo()
        chk("T3 sürükleme Ctrl+Z ile geri alınır", dist(C(i2)["p"], p0) < 0.01, C(i2)["p"])
        s = S.screen(S.world(i1, [50, 10, -10]))
        A.drag(s, (s[0] + 60, s[1] + 30))
        chk("T3 sabit bileşen sürüklenmez", dist(C(i1)["p"], [0, 0, 0]) < 0.01, C(i1)["p"])
    # ---------- T4: çarpışma algıla ----------
    if want("T4"):
        A.cmd("Çarpışma Algıla")
        on = S.js("return a.collide")
        # pimi plakanın üzerine (aynı yükseklik) sürükle: pim (130) → plaka içine (50)
        s = S.screen(S.world(ipn, [0, 5, 0])); t = S.screen([50, 5, -30])
        A.drag(s, t, steps=25)
        px = C(ipn)["p"]
        inside = 0 - 5 < px[0] < 100 + 5 and -60 - 5 < px[2] < 5 and px[1] < 10
        chk("T4 çarpışma açıkken pim plakaya girmez", on and not inside, (on, px, A.toast()))
        A.cmd("Çarpışma Algıla")
        chk("T4 Çarpışma Algıla kapanır", not S.js("return a.collide"))
        A.undo() if dist(C(ipn)["p"], [130, 0, 0]) > 0.01 else None
    # ---------- T5: Girişim (+CSV) ----------
    if want("T5"):
        # Plaka2'yi Plaka1'e bindir: Delta ile (50,5,0) konumuna
        S.select_comp("Plaka<2>")
        A.cmd("Bileşeni Taşı"); A.pmselect("Yöntem", "delta")
        c2 = C(i2)["p"]
        A.pmfield("X", 50 - c2[0]); A.pmfield("Y", 5 - c2[1]); A.pmfield("Z", 0 - c2[2]); A.pmbtn("Uygula"); S.pmok()
        chk("T5 Plaka2 (50,5,0)", dist(C(i2)["p"], [50, 5, 0]) < 0.01, C(i2)["p"])
        A.cmd("Girişim"); A.wait(3)
        txt = A.pmtext()
        exp = 50 * 5 * 60 - math.pi * 25 * 5
        m = re.findall(r"— ([\d.]+) mm³", txt)
        chk("T5 Girişim: 2 çift; Plaka1↔Plaka2 = 50·5·60 − π·5²·5 = %.1f, Pim↔Plaka2 = π·5²/2·10 = 392,7" % exp, len(m) == 2 and abs(float(m[0]) - exp) < 2 and abs(float(m[1]) - 392.7) < 1, txt.replace("\n", " | ")[:300])
        csvb = A.pg.locator("#pm-body button:has-text('CSV indir')")
        if csvb.count():
            fn, csv, _ = S.download(lambda: csvb.first.click())
            chk("T5 Girişim CSV içerik", "Plaka<1>" in csv and "Plaka<2>" in csv, csv[:200])
        else:
            chk("T5 Girişim panelinde CSV indir düğmesi (SW: rapor kaydet)", False, "yok")
        A.pmcheck("Yalnız çakışan bileşenleri göster", True)
        S.pmx()
        chk("T5 Girişim paneli kapanır, kırmızı ağ kalkar", not S.pm_open() and S.js("return a.group.children.filter(o=>o.userData&&o.userData.ifc).length") == 0)
        A.undo()
        chk("T5 Ctrl+Z: Plaka2 eski yerine", C(i2)["p"][1] == 0 and C(i2)["p"][0] > 120, C(i2)["p"])
    # ---------- T6: Boşluk doğrula ----------
    if want("T6"):
        A.dq[:] = ["2"]
        A.cmd("Boşluk Doğrula"); A.wait(3)
        txt = A.ev("(()=>{const d=document.querySelector('dialog[open]');return d?d.innerText:''})()")
        chk("T6 Boşluk tablosu: Plaka1–Pim arası 25 mm (pim x=125..135)", "25.000" in txt, txt.replace("\n", " | ")[:300])
        A.btn("dialog[open] button:has-text('Kapat')")
    # ---------- T7: Montaj kesiti ----------
    if want("T7"):
        A.cmd("Montaj Kesiti")
        A.pmseg("Ön (XY)"); A.pmfield("Öteleme", -30)
        n = A.ev("window.__app.viewer.renderer.clippingPlanes.length")
        A.pg.screenshot(path=OUT + "/T7_kesit.png")
        chk("T7 Kesit: kesme düzlemi etkin", n >= 1, n)
        S.pmx()
        chk("T7 ✕: kesit kalkar", A.ev("window.__app.viewer.renderer.clippingPlanes.length") == 0)
    # ---------- T8: Patlatılmış görünüm ----------
    if want("T8"):
        RB = lambda i: S.js("const T=window.__app.THREE;const b=new T.Box3().setFromObject(a.objs.get(arg));return [b.min.toArray().map(v=>+v.toFixed(2)),b.max.toArray().map(v=>+v.toFixed(2))]", i)
        b0 = RB(ipn)
        A.cmd("Patlatılmış Görünüm")
        S.click_local(ipn, [3.5, 20, 3.5])
        A.pmselect("Yön", "y"); A.pmfield("Mesafe", 80); A.pmbtn("Adım ekle")
        b1 = RB(ipn)
        chk("T8 adım eklendi: pim +Y 80 (önizleme)", b1 and abs(b1[0][1] - b0[0][1] - 80) < 0.1, (b0, b1))
        S.pmok()
        chk("T8 ✓: 1 adım kayıtlı, ağaçta", len(S.stored().get("steps", [])) == 1 and any("Patlatılmış görünüm (1 adım)" in t for t in S.tree()), S.tree()[-1])
        chk("T8 bileşen gerçek konumu değişmez (yalnız görüntü)", dist(C(ipn)["p"], [130, 0, 0]) < 0.01, C(ipn)["p"])
        lbl = A.ev("[...document.querySelectorAll('#cmds button')].map(b=>b.title).find(t=>t==='Daralt'||t==='Patlat')")
        A.cmd(lbl)
        b2 = RB(ipn)
        chk("T8 Daralt/Patlat düğmesi görüntüyü değiştirir", b2 and abs(b2[0][1] - b1[0][1]) > 1, (lbl, b1, b2))
        A.reload(); S.open()
        chk("T8 yenile: adım kalıcı", len(S.stored().get("steps", [])) == 1)
        # ✕ ile vazgeç: yeni adım kaydedilmemeli
        A.cmd("Patlatılmış Görünüm")
        S.click_local(i2, [50, 10, -10])
        A.pmselect("Yön", "x"); A.pmfield("Mesafe", 40); A.pmbtn("Adım ekle")
        S.pmx()
        chk("T8 ✕: eklenen adım kaydedilmez (SW: iptal)", len(S.stored().get("steps", [])) == 1, len(S.stored().get("steps", [])))
    # ---------- T9: Hareket etüdü ----------
    if want("T9"):
        if A.ev("[...document.querySelectorAll('#cmds button')].some(b=>b.title==='Daralt')"):
            A.cmd("Daralt"); time.sleep(2)
        # menteşe: pim plakada dönebilir
        A.cmd("Eşleşme"); S.mate_tab("Mekanik"); S.mate_type("hinge")
        S.click_local(ipn, [3.5, 20, 3.5]); S.click_local(i1, [30 - 3.5, 8, -30 - 3.5])
        S.click_face(i1, "f=>f.n&&f.n[1]>0.9", shift=[45, 0, 12])
        A.press("Control+6"); S.click_local(ipn, [0, 0, 0]); A.press("Control+7"); S.fit()
        S.pmok(); S.pmx() if S.pm_open() else None
        q0 = C(ipn)["q"]
        A.cmd("Hareket Etüdü"); A.wait(0.5)
        S.click_local(ipn, [3.5, 20, 3.5])
        txt = A.pmtext()
        A.pmbtn("▶ Oynat"); time.sleep(2.5)
        q1 = C(ipn)["q"]
        A.pmbtn("■ Durdur")
        chk("T9 döner motor: pim döner", dist(q0, q1) > 0.01, (q0, q1, txt.replace("\n", " | ")[:200]))
        chk("T9 pim ekseni yerinde (30,10,-30)", dist(C(ipn)["p"], [30, 10, -30]) < 0.05, C(ipn)["p"])
        A.pmbtn("⟲ Başa al")
        chk("T9 Başa al", dist(C(ipn)["q"], q0) < 0.01, C(ipn)["q"])
        rec = A.pg.locator("#pm-body button:has-text('Kaydet ve oynat')")
        if rec.count():
            try:
                fn, _, path = S.download(lambda: rec.first.click())
                chk("T9 video kaydı .webm iner", fn.endswith(".webm") and os.path.getsize(path) > 1000, (fn, os.path.getsize(path)))
            except Exception as e:
                chk("T9 video kaydı iner", False, str(e)[:120])
        S.pmx()
        chk("T9 ✕: etüt sonrası pim başlangıç dönüşünde", dist(C(ipn)["q"], q0) < 0.01, C(ipn)["q"])
    # ---------- T10: Kütle, Malzeme listesi, STEP ----------
    if want("T10"):
        A.cmd("Kütle Özell."); A.wait(0.5)
        txt = A.ev("document.querySelector('dialog[open]').innerText")
        V = S.js("return a.__mass.V")
        exp = 2 * (60000 - math.pi * 25 * 10) + math.pi * 25 * 30
        chk("T10 Kütle: toplam hacim 2·59214,6 + 2356,2", abs(V - exp) < 5, (V, exp, txt[:160].replace("\n", " | ")))
        A.btn("dialog[open] button:has-text('Kapat')")
        A.cmd("Malzeme Listesi"); A.wait(0.4)
        txt = A.ev("document.querySelector('dialog[open]').innerText")
        fn, csv, _ = S.download(lambda: A.pg.locator("dialog[open] button:has-text('CSV indir')").click())
        rows = [r.split(";") for r in csv.strip().splitlines()]
        chk("T10 BOM CSV: Plaka 2, Pim 1", ["Plaka", "2"] in [r[1:] for r in rows] and ["Pim", "1"] in [r[1:] for r in rows], rows)
        A.btn("dialog[open] button:has-text('Kapat')")
        fn, step, _ = S.download(lambda: A.cmd("STEP (montaj)"))
        nsol = step.count("MANIFOLD_SOLID_BREP")
        chk("T10 STEP: 3 katı, ürün adları", fn.endswith(".step") and nsol == 3 and "Pim" in step, (fn, nsol, re.findall(r"PRODUCT\('([^']*)'", step)[:6]))
        # STEP'teki pim konumu: hareket ettirilmiş bileşen konumu yazılmış mı (pim (30,10,-30) ya da (130,0,0))
        chk("T10 STEP ürün adları bileşen adları (Plaka<1> …)", any("Plaka" in n for n in re.findall(r"PRODUCT\('([^']*)'", step)), re.findall(r"PRODUCT\('([^']*)'", step)[:6])
    print("hatalar:", A.errs[:5])
    A.close()
finish()

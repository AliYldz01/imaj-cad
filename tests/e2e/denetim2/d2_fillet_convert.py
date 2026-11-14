# d2: eskiz radyüsü / pahı (sanal sivri köşe, ölçü), Dönüştür (kenar / yüz / silüet), Kesişim Eğrisi, Delme
from d2h import *
import math


def tab(A, t):
    A.btn(f"#tabs button[data-tab='{t}']")


with sync_playwright() as p:
    A = App(p)
    # ================= ESKİZ RADYÜSÜ =================
    A.setup(plate(80, 60, 10))
    A.edit_sketch_of("e1")
    A.cmd("Eskiz Radyüs")
    chk("Radyüs aracı", A.ed("return e.tool") == "fillet")
    A.pmfield("Yarıçap", 10)
    A.clk(40, 30)          # sağ üst köşe
    i = A.skinfo(); print("radyüs", i)
    chk("radyüs: yay + R10 ölçüsü", "arc" in i["types"] and any(d.startswith("rad:10") for d in i["dims"]), i)
    chk("radyüs sonrası serbestlik artmadı (önce 2: konum)", i["dof"] == 2, i["dof"])
    chk("sanal sivri köşe: D2 (60) korunur", "dist:60.000" in i["dims"], i["dims"])
    A.ok()
    exp = 48000 - 100 * (1 - math.pi / 4) * 10
    chk("✓ → hacim radyüslü", abs(A.vol() - exp) < 0.5, (A.vol(), exp))
    # sanal köşeye bağlı 60 ölçüsünü 70 yap
    A.edit_sketch_of("e1")
    dims = A.ed("return d.dims.map(x=>x.t+':'+x.v)"); print("ölçüler", dims)
    idx = A.ed("return d.dims.findIndex(x=>x.v===60)")
    A.dim_dbl(idx, 70)
    i = A.skinfo(); print("60→70", i)
    A.ok()
    chk("✓ → 80×70 radyüslü", A.size() and abs(A.size()[2] - 70) < 0.01 and abs(A.vol() - (56000 - 100 * (1 - math.pi / 4) * 10)) < 0.5, (A.size(), A.vol()))
    # R ölçüsü 10 → 15
    A.edit_sketch_of("e1")
    idx = A.ed("return d.dims.findIndex(x=>x.t==='rad')")
    A.dim_dbl(idx, 15)
    A.ok()
    exp15 = 56000 - 225 * (1 - math.pi / 4) * 10
    chk("R 15 → model", abs(A.vol() - exp15) < 0.5, (A.vol(), exp15))
    A.press("Control+z"); A.wait(0.8)
    chk("Ctrl+Z → R10", abs(A.vol() - (56000 - 100 * (1 - math.pi / 4) * 10)) < 0.5, A.vol())
    A.press("Control+y"); A.wait(0.8)
    chk("Ctrl+Y → R15", abs(A.vol() - exp15) < 0.5, A.vol())
    A.reload()
    chk("yenile → R15", abs(A.vol() - exp15) < 0.5, A.vol())
    # ✕ vazgeç: yeni radyüs ekleyip kaydetmeden çık
    A.edit_sketch_of("e1")
    A.cmd("Eskiz Radyüs"); A.pmfield("Yarıçap", 5); A.clk(*A.ptxy("p1"))
    chk("2. radyüs eklendi (yenilemeden sonra)", A.skinfo()["types"].count("arc") == 2, (A.skinfo(), A.toast(), A.ed("return [e.tool, e.opts.filletR]")))
    A.cancel("discard")
    chk("Kaydetmeden çık → tek radyüs", abs(A.vol() - exp15) < 0.5 and sum(e["t"] == "arc" for e in A.saved_feat("s1")["data"]["ents"]) == 1, A.vol())

    # ================= ESKİZ PAHI =================
    A.setup(plate(80, 60, 10))
    A.edit_sketch_of("e1")
    A.cmd("Eskiz Pahı"); A.pmfield("Mesafe", 6); A.clk(-40, 30)
    i = A.skinfo(); print("pah", i)
    chk("pah: 5 çizgi (+ sanal köşe noktası, v0.90 D2-9)", i["types"].count("line") == 5 and i["dof"] == 2, i["types"])
    print("BILGI pah sonrası serbestlik", i["dof"], "ölçüler", i["dims"])
    A.ok()
    chk("✓ → pahlı hacim", abs(A.vol() - (48000 - 18 * 10)) < 0.5, A.vol())
    # pahtan sonra 80 → 90 (sanal köşe korunuyor mu)
    A.edit_sketch_of("e1")
    idx = A.ed("return d.dims.findIndex(x=>x.v===80)")
    A.dim_dbl(idx, 90)
    A.ok()
    chk("pah sonrası genişlik 90", A.size() and abs(A.size()[0] - 90) < 0.01, (A.size(), A.vol()))
    print("BILGI pah sonrası 90 genişlikte hacim", A.vol(), "beklenen (pah aynı kalırsa)", 54000 - 180)

    # ================= DÖNÜŞTÜR (yeni eskiz, üst yüz) =================
    A.setup(plate(80, 60, 10, dims=True))
    # üst yüze tıkla → Eskiz sekmesi → Eskiz
    x, y = A.wsc([0, 10, 0])
    A.click(x, y); time.sleep(0.3)
    tab(A, "sketch")
    A.cmd("Eskiz"); A.wait(0.5)
    chk("üst yüzde yeni eskiz açıldı", A.mode() == "sketch", A.mode())
    A.cmd("Dönüştür")
    # kenar: ön üst kenar (z=30)
    x, y = A.wsc([0, 10, 30]); A.click(x, y)
    i = A.skinfo(); print("kenar dönüştür", i)
    chk("kenar → 1 çizgi", i["types"] == ["line"], i)
    # yüz → dış döngü
    x, y = A.wsc([10, 10, -10]); A.click(x, y)
    i = A.skinfo(); print("yüz dönüştür", i)
    chk("önce dönüştürülmüş kenar yüz dönüştürmede yinelenmez (SolidWorks)", i["ents"] == 4, i)
    if i["ents"] != 4:
        n = 0
        while A.skinfo()["ents"] > 0 and n < 8:
            A.press("Control+z"); n += 1
        print("BILGI yüz dönüştürme + kenar geri almak için Ctrl+Z sayısı", n, "(SolidWorks: 2)")
        x, y = A.wsc([10, 10, -10]); A.click(x, y)
        print("yalnız yüz dönüştür", A.skinfo())
    A.ok()
    sid = A.ev("window.__app.doc.features[window.__app.doc.features.length-1].id")
    # Ekstrüzyon önerisi / şerit
    if A.pg.locator(".suggest button:has-text('Ekstrüzyon')").count():
        A.btn(".suggest button:has-text('Ekstrüzyon')")
    else:
        tab(A, "features"); A.cmd("Ekstrüzyon")
    A.wait(0.5)
    A.pmfield("Derinlik", 5); A.ok()
    print("dönüştürülmüş eskizden ekstrüzyon", A.vol(), A.size(), A.errtree())
    chk("dönüştürülmüş yüzden ekstrüzyon 80×60×(10+5)", A.vol() and abs(A.vol() - 72000) < 1, (A.vol(), A.errtree()))
    # taban eskizi 80 → 100: dönüştürülen kenarlar izler mi (E-5 hâlâ?)
    A.edit_sketch_of("e1")
    idx = A.ed("return d.dims.findIndex(x=>x.v===80)")
    A.dim_dbl(idx, 100); A.ok()
    print("taban 100 sonrası", A.size(), A.vol(), A.errtree())
    chk("dönüştürülmüş kenarlar modeli izler (E-5 hâlâ?)", A.vol() and abs(A.vol() - 90000) < 1, A.vol())

    # ---- silüet (silindir) ----
    def cyl(pt, line, rect, c, t):
        c(0, 0, 10)
    A.setup([sketch("s1", "Eskiz1", TOP, cyl), ext("e1", "s1", 40)])
    A.show_tree()
    A.btn("#tree li:has-text('Ön Düzlem')")
    tab(A, "sketch"); A.cmd("Eskiz"); A.wait(0.5)
    chk("Ön düzlemde eskiz", A.mode() == "sketch", A.mode())
    A.cmd("Dönüştür")
    x, y = A.wsc([0, 20, 10]); A.click(x, y)   # silindir yüzü (ön)
    i = A.skinfo(); print("silüet", i)
    chk("silindir yüzü → 2 silüet çizgisi", i["types"].count("line") == 2, i)
    A.cancel("discard")

    # ================= KESİŞİM EĞRİSİ =================
    A.setup(plate(80, 60, 10))
    A.show_tree()
    A.btn("#tree li:has-text('Sağ Düzlem')")
    tab(A, "sketch"); A.cmd("Eskiz"); A.wait(0.5)
    A.cmd("Kesişim Eğr."); A.wait(0.5)
    print("BILGI komut sonrası öğe", A.skinfo()["ents"], "(SolidWorks: yüz seçip ✓; burada grafik alana dokunmak gerekiyor)")
    A.clk(0, 0); A.wait(1.5)
    i = A.skinfo(); print("kesişim eğrisi", i, A.toast())
    chk("Sağ düzlem ∩ plaka → 4 çizgi (dikdörtgen kesit)", i["types"].count("line") >= 4, i)
    A.ok()
    nfe = len(A.ev("window.__app.doc.features"))
    chk("kesişim eskizi kaydedildi", nfe == 3, nfe)
    A.press("Control+z"); A.wait(0.6)
    chk("Ctrl+Z → kesişim eskizi kalkar", len(A.ev("window.__app.doc.features")) == 2)

    # ================= DELME =================
    # yapı: Ön düzlemde nokta; delme kenarı: plakanın düşey kenarı (x=40,z=30 düşey değil). Plaka TOP'ta; düşey kenar (40,y,30) ön düzlemi (z=0) kesmez.
    # Sağ düzlem (x=0) üst ön kenarı (z=30, y=10) keser → (0,10,30)
    def pt1(pt, line, rect, c, t):
        a = pt(5, 5)
    sk2 = sketch("s2", "Eskiz2", RIGHT, pt1)
    sk2["data"]["ents"].append({"id": "n9", "t": "point", "p": "p1"})
    A.setup(plate(80, 60, 10) + [sk2])
    A.show_tree()
    A.btn("#tree li:has-text('Eskiz2')"); A.btn("#tree-actions button:has-text('Düzenle')"); A.wait(0.5)
    chk("Eskiz2 açıldı", A.mode() == "sketch")
    A.clk(5, 5)    # noktayı seç (Seç aracı)
    A.cmd("Delme")
    x, y = A.wsc([0, 10, 30])  # üst ön kenar ortası
    A.click(x, y)
    q = A.ptxy("p1"); i = A.skinfo(); print("delme (önce seçili nokta)", q, i, A.toast())
    chk("Delme: araçtan önce seçilen nokta kullanılır (ipucu 'Önce eskiz noktasını seçin')", i["rels"].count("fix") == 1, i["rels"])
    if i["rels"].count("fix") == 0:
        A.clk(5, 5)
        A.btn(".vcube .iso"); time.sleep(0.5)   # kenar uçtan görünmesin diye görünümü döndür
        x, y = A.wsc([0, 10, 30]); A.click(x, y)
        q = A.ptxy("p1"); i = A.skinfo(); print("delme (araç içinde nokta + kenar)", q, i, A.toast())
    chk("delme: nokta kenarla düzlem kesişimine taşındı ve sabitlendi", i["rels"].count("fix") == 1 and q is not None, (q, i["rels"]))
    chk("delme: (y=10, z=30) → eskizde (30,10) ya da eşdeğeri", q and abs(abs(q[0]) - 30) < 1e-3 and abs(q[1] - 10) < 1e-3, q)
    A.ok()
    sf = A.saved_feat("s2"); chk("delme kayıtta fix", any(r["t"] == "fix" for r in sf["data"]["rels"]))
    # plaka kalınlığı 10 → 20 (ekstrüzyon değil; eskiz y) — delme izler mi? (sabit 'fix' ile bağlı)
    print("Konsol:", A.errs)
    chk("konsol hatası yok", not A.errs, A.errs)
    A.close()
finish()

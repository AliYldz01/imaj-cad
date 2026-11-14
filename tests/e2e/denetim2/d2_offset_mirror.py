# d2: Ötele (tek / çift yön / taban yapı / ölçü değişince) ve Aynala (normal + dinamik)
from d2h import *
import math


def winsel(A, x0, y0, x1, y1):
    """Seç aracında soldan sağa pencere seçimi (gerçek sürükleme)"""
    a = A.sc(x0, y0); b = A.sc(x1, y1)
    A.drag(a, b, 10)


def quickdim_off(A):
    loc = A.pg.locator("#pm-body label:has-text('Çizdikten sonra ölçü gir') input")
    if loc.count() and loc.first.is_checked():
        loc.first.click(); time.sleep(0.2)


with sync_playwright() as p:
    A = App(p)
    # ================= ÖTELE =================
    A.setup(plate(80, 60, 10))
    v0 = A.vol(); print("plaka", v0)
    A.edit_sketch_of("e1")
    winsel(A, -50, 45, 50, -45)
    chk("pencere seçimi 4 kenar", A.ed("return e.sel.size") == 4, A.ed("return [...e.sel]"))
    A.cmd("Ötele")
    chk("Ötele aracında seçim korunur", A.ed("return e.sel.size") == 4)
    A.pmfield("Mesafe", 5)
    A.pmbtn("Uygula")
    i = A.skinfo(); print("ötele sonrası", i)
    chk("ötele: 8 çizgi", i["ents"] == 8, i["types"])
    # dışa mı içe mi? en büyük |x|
    xs = A.ed("return Object.values(d.pts).map(p=>Math.abs(p.x))")
    outward = max(xs) > 44
    print("ötele yönü:", "dışa" if outward else "içe", max(xs))
    chk("ötele sonrası eskiz çözülebilir", i["ok"] and i["conf"] == 0)
    dof_after = i["dof"]
    A.ok()
    exp = (90 * 70 - 80 * 60) * 10 if outward else (80 * 60 - 70 * 50) * 10
    chk("✓ → halka (çerçeve) hacmi", abs(A.vol() - exp) < 1, (A.vol(), exp, A.errtree()))
    A.reload()
    chk("yenilemede korunur", abs(A.vol() - exp) < 1, A.vol())
    # ölçü değişince: taban 80 → 100 (ötelenen zincir izlemeli; E-4)
    A.edit_sketch_of("e1")
    A.dim_dbl(0, 100)
    i = A.skinfo(); print("D1=100 sonrası", i)
    A.ok()
    exp2 = (110 * 70 - 100 * 60) * 10 if outward else (100 * 60 - 90 * 50) * 10
    v2 = A.vol()
    print("taban 100 sonrası hacim", v2, "beklenen", exp2, A.errtree())
    chk("taban ölçüsü değişince öteleme izler (E-4 hâlâ?)", v2 is not None and abs(v2 - exp2) < 1, v2)
    # geri al (parça) → önceki
    A.press("Control+z"); A.wait(0.8)
    chk("parça Ctrl+Z → ötelenmiş 80'lik", abs(A.vol() - exp) < 1, A.vol())

    # ---- ✕ ile vazgeç ----
    A.setup(plate(80, 60, 10))
    A.edit_sketch_of("e1")
    winsel(A, -50, 45, 50, -45); A.cmd("Ötele"); A.pmfield("Mesafe", 5); A.pmbtn("Uygula")
    A.cancel("discard")
    chk("ötele + Kaydetmeden çık → plaka aynı", abs(A.vol() - v0) < 1, A.vol())
    chk("kayıtta 4 öğe", len(A.saved_feat("s1")["data"]["ents"]) == 4)

    # ---- çift yön + taban yapı ----
    A.edit_sketch_of("e1")
    winsel(A, -50, 45, 50, -45); A.cmd("Ötele"); A.pmfield("Mesafe", 5)
    A.pmcheck("Çift yön", True); A.pmcheck("Tabanı yapı geometrisi yap", True)
    A.pmbtn("Uygula")
    i = A.skinfo(); print("çift yön + taban yapı", i)
    chk("çift yön: 12 çizgi, 4'ü yapı", i["ents"] == 12 and sum(t.endswith("*") for t in i["types"]) == 4, i["types"])
    A.ok()
    exp3 = (90 * 70 - 70 * 50) * 10
    chk("✓ → 90×70 − 70×50 çerçeve", abs((A.vol() or 0) - exp3) < 1, (A.vol(), exp3, A.errtree()))
    A.press("Control+z"); A.wait(0.8)
    chk("parça Ctrl+Z → plaka", abs(A.vol() - v0) < 1, A.vol())

    # ---- daire ötelemesi + ölçü ----
    A.setup([sketch("s1", "Eskiz1", TOP, lambda pt, line, rect, c, t: c(0, 0, 20)), ext("e1", "s1", 10)])
    A.edit_sketch_of("e1")
    A.clk(20, 0)
    A.cmd("Ötele"); A.pmfield("Mesafe", 5); A.pmbtn("Uygula")
    i = A.skinfo(); print("daire ötele", i)
    A.ok()
    print("daire ötele hacim", A.vol())
    A.edit_sketch_of("e1")
    nd = A.pg.locator(".dim").count(); print("ölçü etiketi", nd)
    if nd:
        A.dim_dbl(nd - 1, 8)
        i = A.skinfo(); print("ötele ölçüsü 8 →", i)
        rr = A.ed("return d.ents.filter(x=>x.t==='circle').map(x=>+x.r.toFixed(3))")
        chk("daire ötelemesi ölçüsü 8 → yarıçap farkı 8", len(rr) == 2 and abs(abs(rr[0] - rr[1]) - 8) < 1e-3, rr)
    A.ok()

    # ================= AYNALA =================
    def mm(pt, line, rect, c, t):
        rect(-40, -30, 40, 30)
        c(20, 0, 8)                       # p9 merkez, c10
        a, b = pt(0, -40), pt(0, 40)      # p11, p12
        line(a, b, True)                  # l13 merkez çizgisi
    sk = sketch("s1", "Eskiz1", TOP, mm)
    sk["data"]["dims"] = [{"id": "D9", "t": "dia", "refs": ["c10"], "v": 16, "lp": [30, 10]}] if False else []
    A.setup([sk, ext("e1", "s1", 10)])
    v1 = A.vol(); print("tek delikli plaka", v1)
    A.edit_sketch_of("e1")
    A.clk(28, 0)                         # daire
    A.clk(0, 35, mods=("Control",))      # merkez çizgisi
    chk("daire + merkez çizgisi seçili", A.ed("return e.sel.size") == 2, A.ed("return [...e.sel]"))
    A.cmd("Aynala")
    A.pmbtn("Uygula")
    i = A.skinfo(); print("ayna sonrası", i)
    chk("ayna: 2. daire + symmetric/equal ilişki", i["types"].count("circle") == 2 and "symmetric" in i["rels"], i)
    c2 = A.ed("const c=d.ents.filter(x=>x.t==='circle')[1]; const p=d.pts[c.c]; return [+p.x.toFixed(3),+p.y.toFixed(3),c.r]")
    chk("aynalanan daire (-20,0) R8", c2[0] == -20 and c2[1] == 0 and abs(c2[2] - 8) < 1e-6, c2)
    A.ok()
    exp = 4800 * 10 - 2 * math.pi * 64 * 10
    chk("✓ → iki delik", abs(A.vol() - exp) < 1, (A.vol(), exp))
    # kaynak daireyi sürükle → ayna izler
    A.edit_sketch_of("e1")
    x, y = A.sc(20, 0)
    A.drag((x, y), A.sc(25, 10), 10)
    c1 = A.ed("const c=d.ents.filter(x=>x.t==='circle'); return c.map(z=>{const p=d.pts[z.c];return [+p.x.toFixed(2),+p.y.toFixed(2),+z.r.toFixed(2)]})")
    ax = A.lineyx("l13"); print("eksen", ax)
    # gerçek eksene göre yansıma denetimi
    (ax1, ay1), (ax2, ay2) = ax
    dx, dy = ax2 - ax1, ay2 - ay1; L = (dx * dx + dy * dy) ** 0.5; ux, uy = dx / L, dy / L
    px, py = c1[0][0] - ax1, c1[0][1] - ay1; t = px * ux + py * uy
    rx, ry = ax1 + 2 * t * ux - px, ay1 + 2 * t * uy - py
    chk("kaynak merkezi sürüklenince ayna (eksene göre) simetrik", abs(rx - c1[1][0]) < 0.05 and abs(ry - c1[1][1]) < 0.05, (c1, (rx, ry)))
    chk("serbest merkez çizgisi sürüklemede yerinde kalır (SolidWorks: ekseni değil daireyi taşır)", abs(ax1) < 1e-3 and abs(ax2) < 1e-3, ax)
    # kaynak çevresini sürükle → yarıçap; ayna eşit
    x, y = A.sc(c1[0][0] + c1[0][2], c1[0][1])
    A.drag((x, y), (x + 25, y), 8)
    c1 = A.ed("const c=d.ents.filter(x=>x.t==='circle'); return c.map(z=>+z.r.toFixed(3))")
    chk("kaynak yarıçapı değişince ayna eşit", abs(c1[0] - c1[1]) < 1e-3 and c1[0] > 8.5, c1)
    A.ok()
    exp = 48000 - 2 * math.pi * c1[0] ** 2 * 10
    chk("✓ → model iki delik yeni yarıçapta", abs(A.vol() - exp) < 2, (A.vol(), exp))
    A.press("Control+z"); A.wait(0.8)
    chk("parça Ctrl+Z → iki R8 delik", abs(A.vol() - (48000 - 2 * math.pi * 640)) < 1, A.vol())
    A.reload()
    chk("yenile → aynı", abs(A.vol() - (48000 - 2 * math.pi * 640)) < 1, A.vol())

    # ---- Dinamik ayna: merkez çizgisini seç → Dinamik ayna ekseni yap → çiz ----
    A.setup([sketch("s1", "Eskiz1", TOP, mm), ext("e1", "s1", 10)])
    A.edit_sketch_of("e1")
    A.clk(0, 35)
    dyn = A.pg.locator("#pm-body button:has-text('Dinamik ayna ekseni yap')")
    chk("Seç: tek çizgide 'Dinamik ayna ekseni yap' düğmesi", dyn.count() == 1)
    dyn.first.click(); time.sleep(0.3)
    A.cmd("Daire")
    quickdim_off(A)
    A.clk(-15, 15); A.clk(-10, 15)   # merkez (-15,15) r=5
    i = A.skinfo(); print("dinamik ayna daire", i)
    chk("dinamik ayna: daire karşı tarafta da çizildi", i["types"].count("circle") == 3, i["types"])
    # çizgi zinciri: eksenden başlayıp eksende biten U (dinamik ayna ile kapalı olmalı)
    A.cmd("Çizgi")
    for q in [(0, -25), (12, -25), (12, -15), (0, -15)]:
        A.clk(*q)
    A.press("Escape")
    i = A.skinfo(); print("dinamik ayna U", i)
    A.ok()
    exp = 48000 - math.pi * 64 * 10 - 2 * math.pi * 25 * 10 - 24 * 10 * 10
    v = A.vol()
    print("dinamik ayna sonrası hacim", v, "beklenen", exp, A.errtree())
    chk("dinamik ayna: U + ayna kapalı bölge (cep) oluşturur", v is not None and abs(v - exp) < 2, (v, exp, A.errtree()))
    print("Konsol:", A.errs)
    chk("konsol hatası yok", not A.errs, A.errs)
    A.close()
finish()

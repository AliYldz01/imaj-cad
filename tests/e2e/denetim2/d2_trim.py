# d2: Kırp (en yakına kırp tık + güç kırpma sürükleme) ve Uzat — ekstrüzyonlu eskizde yaşam döngüsü
from d2h import *


def model(pt, line, rect, c, t):
    rect(-40, -30, 40, 30)          # p1..p4, l5..l8 (alt, sağ, üst, sol)
    a, b = pt(20, -45), pt(20, 45)  # p9, p10
    line(a, b)                      # l11


with sync_playwright() as p:
    A = App(p)
    sk = sketch("s1", "Eskiz1", TOP, model)
    A.setup([sk, ext("e1", "s1", 10)])
    v0 = A.vol(); print("başlangıç hacim", v0, A.size(), A.errtree())

    # ---- 1) Kırp: tıklayarak (en yakına kırp) ----
    A.edit_sketch_of("e1")
    chk("eskiz Seç aracıyla açıldı", A.ed("return e.tool") == "select")
    A.cmd("Kırp")
    chk("Kırp aracı etkin", A.ed("return e.tool") == "trim")
    A.clk(20, 40)   # üst taşan uç
    A.clk(20, -40)  # alt taşan uç
    i1 = A.skinfo(); print("taşanlar kırpıldı", i1)
    chk("taşan uçlar kırpıldı (çizgi y -30..30)", sorted(q[1] for q in A.lineyx("l11")) == [-30, 30], A.lineyx("l11"))
    A.clk(30, 30)   # üst kenarın sağ parçası
    A.clk(30, -30)  # alt kenarın sağ parçası
    A.clk(40, 0)    # sağ kenar
    i2 = A.skinfo(); print("sağ bölge kırpıldı", i2)
    chk("eskiz çözülebilir, çakışma yok", i2["ok"] and i2["conf"] == 0)
    chk("öğe sayısı 4 (dikdörtgen 60x60)", i2["ents"] == 4, i2["types"])
    # eskiz içinde geri al / ileri al
    A.press("Control+z")
    chk("Ctrl+Z (eskiz içi) sağ kenarı geri getirir", A.skinfo()["ents"] == 5, A.skinfo()["ents"])
    A.press("Control+y")
    chk("Ctrl+Y (eskiz içi) yeniden kırpar", A.skinfo()["ents"] == 4)
    A.ok()
    v1 = A.vol(); s1 = A.size()
    chk("✓ → model 60×60×10 = 36000", abs(v1 - 36000) < 1, (v1, s1, A.errtree()))
    sf = A.saved_feat("s1")
    chk("kayıtta 4 öğe", sf and len(sf["data"]["ents"]) == 4)
    # model düzeyinde geri al / ileri al
    A.press("Control+z"); A.wait(0.8)
    vz = A.vol(); chk("Ctrl+Z (parça) → kırpma öncesi model (hatalı ilk eskiz)", vz == v0 and len(A.feat("s1")["data"]["ents"]) == 5, (vz, A.errtree()))
    A.press("Control+y"); A.wait(0.8)
    chk("Ctrl+Y (parça) → kırpılmış model", abs(A.vol() - 36000) < 1, A.vol())
    A.reload()
    chk("yenileme sonrası 36000", abs(A.vol() - 36000) < 1, A.vol())

    # ---- 2) ✕ → Kaydetmeden çık: değişmemeli ----
    A.edit_sketch_of("e1")
    A.cmd("Kırp")
    A.clk(-40, 0)  # sol kenarı (kesişimsiz uç uca) sil
    n_in = A.skinfo()["ents"]
    A.cancel("discard")
    chk("✕ Kaydetmeden çık → model aynı (36000)", abs(A.vol() - 36000) < 1, (n_in, A.vol()))
    chk("✕ sonrası kayıtta 4 öğe", len(A.saved_feat("s1")["data"]["ents"]) == 4)

    # ---- 3) Güç kırpma (sürükleme) ----
    A.setup([sketch("s1", "Eskiz1", TOP, model), ext("e1", "s1", 10)])
    A.edit_sketch_of("e1")
    A.cmd("Kırp")
    a = A.sc(14, 42); b = A.sc(26, 38)
    A.drag(a, b, 12)  # yalnız üst taşan ucun üzerinden geç
    a = A.sc(14, -38); b = A.sc(26, -42)
    A.drag(a, b, 12)
    chk("güç kırpma: iki uç kırpıldı", sorted(q[1] for q in A.lineyx("l11")) == [-30, 30], A.lineyx("l11"))
    # güç kırpma ile tek sürüklemede 3 parça (üst sağ, sağ, alt sağ) — sağdan geçen eğri yol
    path = [A.sc(30, 34), A.sc(30, 26), A.sc(36, 10), A.sc(44, 0), A.sc(36, -10), A.sc(30, -26), A.sc(30, -34)]
    A.pg.mouse.move(*path[0]); A.pg.mouse.down()
    for i in range(1, len(path)):
        for k in range(1, 6):
            A.pg.mouse.move(path[i - 1][0] + (path[i][0] - path[i - 1][0]) * k / 5, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * k / 5); time.sleep(0.02)
    A.pg.mouse.up(); time.sleep(0.4)
    i3 = A.skinfo(); print("güç kırpma sonrası", i3)
    chk("güç kırpma tek sürüklemede 3 parça → 4 öğe", i3["ents"] == 4, i3["types"])
    A.press("Control+z")
    print("güç kırpma sonrası tek Ctrl+Z:", A.skinfo()["ents"], "öğe")
    print("BILGI güç kırpma: her parça ayrı geri alma adımı (SolidWorks'te tek adım olmalı — doğrulanmadı)")
    A.cancel("discard")

    # ---- 4) Uzat ----
    def m2(pt, line, rect, c, t):
        rect(-40, -30, 40, 30)
        a, b = pt(-20, -30), pt(-20, 10)  # alttan çıkan, üst kenara ulaşmayan çizgi
        line(a, b)
    A.setup([sketch("s1", "Eskiz1", TOP, m2), ext("e1", "s1", 10)])
    vb = A.vol()
    A.edit_sketch_of("e1")
    A.cmd("Uzat")
    chk("Uzat aracı etkin", A.ed("return e.tool") == "extend")
    A.clk(-20, 5)  # çizginin üst ucuna yakın
    y = max(A.lineyx("l11"), key=lambda q: q[1])
    chk("Uzat: çizgi üst kenara (y=30) uzadı", y and abs(y[1] - 30) < 1e-3, A.lineyx("l11"))
    rels = A.skinfo()["rels"]
    chk("Uzat: uç üst kenar üzerinde ilişkisi (onLine/coincident)", any(r in ("onLine", "coincident") for r in rels), rels)
    A.press("Control+z")
    chk("Uzat geri alınır", abs(max(q[1] for q in A.lineyx("l11")) - 10) < 1e-6, A.lineyx("l11"))
    A.press("Control+y")
    A.ok()
    print("uzat sonrası hacim", A.vol(), "önce", vb, A.errtree())
    print("BILGI ikiye bölünmüş dikdörtgen hata iletisi:", A.ev("document.querySelector('#tree li.err')?.title"))
    sf = A.saved_feat("s1")
    l = [e for e in sf["data"]["ents"] if e["id"] == "l11"][0]
    chk("uzatma kayıtta", max(sf["data"]["pts"][k]["y"] if k in sf["data"]["pts"] else 0 for k in (l["p1"], l["p2"])) > 29.99)
    # uzatılmış uç, üst kenar ölçüsü değişince (eskiz düzenle, kenarı sürükle) kenarda kalıyor mu
    A.edit_sketch_of("e1")
    x, yy = A.sc(0, 30)
    A.drag((x, yy), (x, yy - 60), 10)   # üst kenarı aşağı sürükle (Seç aracı)
    top = A.ptxy("p3"); end = max(A.lineyx("l11"), key=lambda q: q[1])
    chk("üst kenar taşınınca uzatılmış uç da kenarda kalır", top and end and abs(end[1] - top[1]) < 1e-3 and abs(top[1] - 30) > 1, (top, end))
    A.ok()
    print("Konsol hataları:", A.errs)
    chk("konsol hatası yok", not A.errs, A.errs)
    A.close()
finish()

# d1 — Daire (merkez, çevre), yaylar (merkez, teğet, 3 nokta) (masaüstü, gerçek fare)
import sys, math; sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d1_lib import *
PI = math.pi
with sync_playwright() as p:
    t = T(p)
    # ---------- daire
    t.new_sketch(); t.zoom_to(200)
    t.cmd("Daire")
    t.mclick(0, 0); t.mclick(15, 0)
    lbl = t.pg.locator(".dim-prompt.quick label").all_inner_texts() if t.quick_open() else []
    t.chk("daire: hızlı kutu 'Çap'", any("Çap" in x for x in lbl), lbl)
    t.close_quick()
    s = t.st()
    t.chk("daire: 1 daire, merkez orijinde (yeni nokta yok)", s["ents"] == ["circle"] and s["npts"] == 0, s)
    t.chk("daire: 1 serbestlik", s["dof"] == 1, s["dof"])
    t.smart_dim([(10.6, 10.6)], 40, (25, 25))
    t.chk("daire: Ø40 → tam tanımlı", t.st()["dof"] == 0 and t.st()["dims"][0][0] == "dia", t.st()["dims"])
    life(t, "daire", PI * 400 * 10, 40, 50, PI * 625 * 10)

    # daire hızlı kutudan çap
    t.fresh(); t.new_sketch(); t.zoom_to(200)
    t.cmd("Daire"); t.mclick(10, 10); t.mclick(20, 10)
    inp = t.pg.locator(".dim-prompt.quick input")
    if inp.count(): inp.first.fill("16"); inp.first.press("Enter"); time.sleep(0.3)
    t.chk("daire: hızlı kutu Ø16 ölçüsü", t.st()["dims"] == [["dia", 16, False]], t.st()["dims"])

    # ---------- çevre dairesi
    t.fresh(); t.new_sketch(); t.zoom_to(200)
    t.cmd("Çevre Dairesi")
    t.mclick(-20, 0); t.mclick(0, 20); t.mclick(20, 0); t.close_quick()
    s = t.st(); d = t.data()
    c = [e for e in d["ents"] if e["t"] == "circle"]
    t.chk("çevre dairesi: R20, merkez (0,0)", len(c) == 1 and abs(c[0]["r"] - 20) < 0.3, c)
    t.chk("çevre dairesi: 3 serbestlik (merkez orijine bağlı değil)", s["dof"] == 3, s["dof"])
    t.smart_dim([(14.1, 14.1)], 30, (30, 30))
    life(t, "çevre dairesi", PI * 225 * 10, 30, 36, PI * 324 * 10)

    # çevre dairesi var olan 3 noktadan (üçgen köşeleri) → üzerinde ilişkileri
    t.fresh(); t.new_sketch(); t.zoom_to(200)
    t.cmd("Çizgi"); t.mclick(-30, -10); t.mclick(30, -10); t.mclick(0, 30); t.mclick(-30, -10); t.close_quick()
    t.cmd("Çevre Dairesi"); t.mclick(-30, -10); t.mclick(30, -10); t.mclick(0, 30); t.close_quick()
    s = t.st()
    t.chk("çevre dairesi köşelerden: 3 'üzerinde' ilişkisi", s["rels"].count("onCircle") == 3, s["rels"])

    # ---------- merkez yay + iki çizgi = çeyrek daire
    t.fresh(); t.new_sketch(); t.zoom_to(200)
    t.cmd("Merkez Yay")
    t.mclick(0, 0); t.mclick(20, 0); t.mclick(0, 20)
    lbl = t.pg.locator(".dim-prompt.quick label").all_inner_texts() if t.quick_open() else []
    t.chk("merkez yay: hızlı kutu 'Yarıçap'", any("Yarıçap" in x for x in lbl), lbl)
    t.close_quick()
    s = t.st()
    t.chk("merkez yay: 1 yay, merkez orijin", s["ents"] == ["arc"], s)
    a = t.ents_of("arc")[0]
    t.chk("merkez yay: saat yönü tersine 0→90 (s=(20,0))", abs(t.P(a["s"])[0] - 20) < 0.3 and abs(t.P(a["e"])[1] - 20) < 0.3, (t.P(a["s"]), t.P(a["e"])))
    t.cmd("Çizgi"); t.mclick(0, 0); t.mclick(20, 0); t.close_quick(); t.key("Escape")
    t.cmd("Çizgi"); t.mclick(0, 0); t.mclick(0, 20); t.close_quick(); t.key("Escape")
    s = t.st()
    t.chk("çeyrek daire: 1 serbestlik", s["dof"] == 1, (s["dof"], s["rels"]))
    t.smart_dim([(14.14, 14.14)], 30, (25, 25))
    t.chk("çeyrek daire: R30 → tam tanımlı", t.st()["dof"] == 0, t.st())
    life(t, "merkez yay", PI * 900 / 4 * 10, 30, 25, PI * 625 / 4 * 10)

    # merkez yay saat yönünde süpürme (imleç ters yöne dolaşınca)
    t.fresh(); t.new_sketch(); t.zoom_to(200)
    t.cmd("Merkez Yay"); t.mclick(0, 0); t.mclick(20, 0)
    for ang in range(0, -100, -15):
        t.pg.mouse.move(*t.sc(20 * math.cos(math.radians(ang)), 20 * math.sin(math.radians(ang))), steps=2); time.sleep(0.03)
    t.mclick(0, -20); t.close_quick()
    a = t.ents_of("arc")[0]
    sweep = (math.degrees(math.atan2(t.P(a["e"])[1], t.P(a["e"])[0]) - math.atan2(t.P(a["s"])[1], t.P(a["s"])[0])) + 360) % 360
    t.chk("merkez yay saat yönünde dolaşınca 90° yay (270° değil)", abs(sweep - 90) < 2, sweep)

    # ---------- teğet yay: çizgi + teğet yay + 2 çizgi = D şekli
    t.fresh(); t.new_sketch(); t.zoom_to(200)
    t.cmd("Çizgi"); t.mclick(0, 0); t.mclick(30, 0); t.close_quick(); t.key("Escape")
    t.cmd("Teğet Yay"); t.mclick(30, 0); t.mclick(30, 20); t.close_quick()
    s = t.st()
    t.chk("teğet yay: yay + teğet ilişkisi", "arc" in s["ents"] and "tangent" in s["rels"], s)
    a = t.ents_of("arc")[0]
    t.chk("teğet yay: R10, merkez (30,10)", abs(a["r"] - 10) < 0.3 and abs(t.P(a["c"])[0] - 30) < 0.3, (a["r"], t.P(a["c"])))
    t.cmd("Çizgi"); t.mclick(30, 20); t.mclick(0, 20); t.mclick(0, 0); t.close_quick()
    s = t.st()
    t.chk("D şekli: 3 serbestlik veya daha az", s["dof"] <= 3, (s["dof"], s["rels"]))
    t.smart_dim([(15, 0)], 30, (15, -12))
    t.smart_dim([(0, 10)], 20, (-12, 10))
    t.chk("D şekli: yay ucundan başlayan yatay çizgiye teğet ilişkisi (SW) → 2 ölçüyle tam tanımlı", t.st()["dof"] == 0, (t.st()["dof"], t.st()["rels"]))
    life(t, "teğet yay", (600 + PI * 50) * 10, 30, 40, None)

    # teğet yay boşlukta (uç noktası olmayan yerde) → uyarı, çizim yok
    t.fresh(); t.new_sketch(); t.zoom_to(200)
    t.cmd("Teğet Yay"); t.mclick(10, 10); t.mclick(30, 30)
    t.chk("teğet yay boşlukta başlamaz", t.st()["ents"] == [], t.st()["ents"])

    # ---------- 3 noktalı yay + kiriş çizgisi
    t.fresh(); t.new_sketch(); t.zoom_to(200)
    t.cmd("Çizgi"); t.mclick(-20, 0); t.mclick(20, 0); t.close_quick(); t.key("Escape")
    t.cmd("3N Yay"); t.mclick(20, 0); t.mclick(-20, 0); t.mclick(0, 20); t.close_quick()
    s = t.st(); a = t.ents_of("arc")
    t.chk("3N yay: yay R20, uçlar çizgiye bağlı (yeni nokta yalnız merkez)", len(a) == 1 and abs(a[0]["r"] - 20) < 0.4 and s["npts"] == 3, (a, s["npts"]))
    t.smart_dim([(0, 0)], 40, (0, -12))
    t.smart_dim([(14.1, 14.1)], 20, (25, 25))
    print("  3N yay durumu:", t.st()["dof"], t.st()["rels"])
    life(t, "3N yay", PI * 400 / 2 * 10, 20, 25, None, tol=5)
    t.end()

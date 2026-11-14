# d1 — Dikdörtgen türleri: köşe, merkez, 3 nokta köşe, 3 nokta merkez, paralelkenar (masaüstü, gerçek fare)
import sys; sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d1_lib import *

with sync_playwright() as p:
    t = T(p)

    # ---------- köşe dikdörtgen
    t.new_sketch(); t.zoom_to(200)
    t.cmd("Dikdörtgen")
    t.mclick(0, 0); t.mclick(40, 30)
    q = t.quick_open()
    t.chk("rect: hızlı ölçü kutusu (Genişlik/Yükseklik) açılır", q)
    t.close_quick()
    s = t.st()
    t.chk("rect: 4 çizgi, 2Y + 2D", s["ents"] == ["line"] * 4 and sorted(s["rels"]) == ["horizontal", "horizontal", "vertical", "vertical"], s)
    t.chk("rect: orijinden → 2 serbestlik", s["dof"] == 2, s["dof"])
    t.smart_dim([(20, 0)], 50, (20, -12))
    t.smart_dim([(50, 15)], 30, (62, 15))
    s = t.st()
    t.chk("rect: 2 ölçü → tam tanımlı", s["dof"] == 0 and "Tam" in s["status"], s["status"])
    life(t, "rect", 15000, 50, 60, 18000)

    # hızlı ölçü kutusu ile değer girme (Genişlik/Yükseklik → Enter)
    t.fresh(); t.new_sketch(); t.zoom_to(200)
    t.cmd("Dikdörtgen"); t.mclick(0, 0); t.mclick(40, 30)
    ins = t.pg.locator(".dim-prompt.quick input")
    if ins.count() == 2:
        ins.nth(0).fill("45"); ins.nth(1).fill("25"); ins.nth(1).press("Enter"); time.sleep(0.4)
    s = t.st()
    t.chk("rect: hızlı kutudan 45×25 → 2 ölçü, tam tanımlı", sorted(x[1] for x in s["dims"]) == [25, 45] and s["dof"] == 0, s)
    t.ok_pm(); t.extrude(10)
    v = t.vol()
    t.chk("rect hızlı kutu: hacim 45×25×10", v and abs(v - 11250) < 1, v)

    # ---------- merkez dikdörtgen
    t.fresh(); t.new_sketch(); t.zoom_to(200)
    t.cmd("Merkez Dikd.")
    t.mclick(0, 0); t.mclick(25, 15); t.close_quick()
    s = t.st()
    t.chk("crect: 4 çizgi + 2 yapı köşegeni", s["ents"].count("line") == 4 and s["ents"].count("line*") == 2, s["ents"])
    t.chk("crect: orta nokta ilişkisi orijine, 2 serbestlik", "midpoint" in s["rels"] and s["dof"] == 2, (s["rels"], s["dof"]))
    t.smart_dim([(0, 15)], 60, (0, 27))
    t.smart_dim([(30, 0)], 40, (42, 0))
    s = t.st()
    t.chk("crect: tam tanımlı ve simetrik", s["dof"] == 0, s["status"])
    life(t, "crect", 24000, 60, 80, 32000)

    # merkez dikdörtgen köşesi var olan noktaya (çizgi ucuna) yakalanınca
    t.fresh(); t.new_sketch(); t.zoom_to(200)
    t.cmd("Çizgi"); t.mclick(30, 20); t.mclick(60, 20); t.close_quick(); t.key("Escape")
    t.cmd("Merkez Dikd.")
    t.mclick(0, 0)
    t.pg.mouse.move(*t.sc(29.5, 19.6), steps=4); time.sleep(0.4)
    t.mclick(30, 20); t.close_quick()
    s = t.st(); d = t.data()
    t.chk("crect köşesi var olan noktaya çakışır (fazladan nokta yok)", s["npts"] == 2 + 3 , (s["npts"], s["rels"]))

    # ---------- 3 nokta köşe dikdörtgen
    t.fresh(); t.new_sketch(); t.zoom_to(200)
    t.cmd("3N Dikdörtgen")
    t.mclick(0, 0); t.mclick(40, 0); t.mclick(40, 20); t.close_quick()
    s = t.st()
    t.chk("rect3: 4 çizgi, yatay + dik + 2 paralel", s["ents"] == ["line"] * 4 and "perpendicular" in s["rels"] and s["rels"].count("parallel") == 2 and "horizontal" in s["rels"], s["rels"])
    t.chk("rect3: 2 serbestlik", s["dof"] == 2, s["dof"])
    t.smart_dim([(20, 0)], 50, (20, -12))
    t.smart_dim([(50, 10)], 25, (62, 10))
    t.chk("rect3: tam tanımlı", t.st()["dof"] == 0, t.st()["status"])
    life(t, "rect3", 12500, 50, 60, 15000)

    # açılı 3 nokta dikdörtgen: alan korunur
    t.fresh(); t.new_sketch(); t.zoom_to(200)
    t.cmd("3N Dikdörtgen")
    t.mclick(0, 0); t.mclick(30, 30); t.mclick(10, 50); t.close_quick()
    s = t.st()
    t.chk("rect3 açılı: yatay/dikey yok, 3 serbestlik", "horizontal" not in s["rels"] and s["dof"] == 3, (s["rels"], s["dof"]))

    # ---------- 3 nokta merkez dikdörtgen
    t.fresh(); t.new_sketch(); t.zoom_to(200)
    t.cmd("3N Merkez Dikd.")
    t.mclick(0, 0); t.mclick(30, 0); t.mclick(30, 20); t.close_quick()
    s = t.st()
    t.chk("crect3: 4 çizgi + 2 yapı köşegeni + orta nokta", s["ents"].count("line") == 4 and s["ents"].count("line*") == 2 and "midpoint" in s["rels"], s)
    t.chk("crect3: ikinci nokta yatay çıkarımla konunca yatay ilişki (SW) → 2 serbestlik", s["dof"] == 2, (s["rels"], s["dof"]))
    t.smart_dim([(0, 20)], 60, (0, 32))
    t.smart_dim([(30, 0)], 40, (42, 0))
    d = t.data()
    xs = [q["x"] for q in d["pts"].values()]; ys = [q["y"] for q in d["pts"].values()]
    print("  crect3 noktalar:", [(round(q['x'],2), round(q['y'],2)) for q in d['pts'].values()], t.st()["dof"])
    t.ok_pm(); t.extrude(10)
    v = t.vol()
    t.chk("crect3: 60×40 → 24000", v and abs(v - 24000) < 1, v)

    # ---------- paralelkenar
    t.fresh(); t.new_sketch(); t.zoom_to(200)
    t.cmd("Paralelkenar")
    t.mclick(0, 0); t.mclick(40, 0); t.mclick(55, 20); t.close_quick()
    s = t.st(); d = t.data()
    t.chk("para: 4 çizgi, 2 paralel, yatay, dik yok", s["ents"] == ["line"] * 4 and s["rels"].count("parallel") == 2 and "perpendicular" not in s["rels"], s["rels"])
    t.chk("para: 3 serbestlik", s["dof"] == 3, s["dof"])
    top = [q for q in d["pts"].values() if abs(q["y"] - 20) < 0.5]
    t.chk("para: üst kenar y=20 (iki köşe)", len(top) == 2, d["pts"])
    t.smart_dim([(20, 0)], 50, (20, -12))
    life(t, "para", 50 * 20 * 10, 50, 30, 30 * 20 * 10)
    t.end()

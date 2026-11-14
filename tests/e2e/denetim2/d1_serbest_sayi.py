# d1 — Serbest çizim tanıma, sayıyla giriş (123 / rakama basma), şekil sihirbazı eskizleri (masaüstü)
import sys, math, random; sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d1_lib import *
PI = math.pi
random.seed(3)
def stroke(t, pts, wait_end=0.8):
    a = t.sc(*pts[0]); t.pg.mouse.move(*a); t.pg.mouse.down()
    for q in pts[1:]:
        s = t.sc(q[0] + random.uniform(-0.6, 0.6), q[1] + random.uniform(-0.6, 0.6))
        t.pg.mouse.move(*s, steps=2); time.sleep(0.008)
    time.sleep(wait_end)
    t.pg.mouse.up(); time.sleep(0.4)
def path(corners, n=12):
    out = []
    for i in range(len(corners) - 1):
        a, b = corners[i], corners[i + 1]
        for k in range(n):
            u = k / n; out.append((a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u))
    out.append(corners[-1]); return out
def num_entry(t, vals):
    ins = t.pg.locator(".num-entry input")
    for i, v in enumerate(vals):
        ins.nth(i).fill(str(v))
    ins.nth(len(vals) - 1).press("Enter"); time.sleep(0.3)

with sync_playwright() as p:
    t = T(p)
    # ---------- serbest çizim: kaba dikdörtgen
    t.new_sketch(); t.zoom_to(200)
    t.cmd("Serbest Çizim")
    stroke(t, path([(0, 0), (50, 0), (50, 30), (0, 30), (0, 0)]))
    t.close_quick()
    s = t.st()
    t.chk("serbest: kaba dikdörtgen → 4 çizgi", s["ents"].count("line") == 4, s)
    t.chk("serbest: Y/D ilişkileri", s["rels"].count("horizontal") == 2 and s["rels"].count("vertical") == 2, s["rels"])
    t.chk("serbest: köşe orijine yakalandı", s["npts"] == 3, s["npts"])
    t.cmd("Akıllı Ölçü")
    t.smart_dim([(25, 0)], 60, (25, -12)); t.smart_dim([(60, 15)], 40, (72, 15))
    t.chk("serbest dikdörtgen + 2 ölçü → tam tanımlı", t.st()["dof"] == 0, t.st())
    life(t, "serbest", 60 * 40 * 10, 60, 70, 70 * 40 * 10)

    # serbest: daire
    t.fresh(); t.new_sketch(); t.zoom_to(200)
    t.cmd("Serbest Çizim")
    stroke(t, [(20 * math.cos(a / 24 * 2 * PI) + 10, 20 * math.sin(a / 24 * 2 * PI) + 10) for a in range(25)])
    t.close_quick()
    s = t.st(); c = t.ents_of("circle")
    t.chk("serbest: daire tanınır R≈20", len(c) == 1 and abs(c[0]["r"] - 20) < 2, (s["ents"], c))
    t.key("Control+z")
    t.chk("serbest: Ctrl+Z tanınan şekli siler", t.st()["ents"] == [], t.st()["ents"])
    t.key("Control+y")
    t.chk("serbest: Ctrl+Y geri getirir", len(t.ents_of("circle")) == 1)

    # ---------- sayıyla giriş: çizgi (rakama bas)
    t.fresh(); t.new_sketch(); t.zoom_to(200)
    t.cmd("Çizgi")
    t.pg.mouse.move(*t.sc(10, 10))
    t.key("0")
    t.chk("rakama basınca sayıyla giriş kutusu (X, Y)", t.pg.locator(".num-entry input").count() == 2)
    num_entry(t, [0, 0])
    t.pg.mouse.move(*t.sc(30, 5))
    t.key("5")
    lab = t.pg.locator(".num-entry label").all_inner_texts()
    t.chk("zincirde Uzunluk / Açı", any("Uzunluk" in x for x in lab), lab)
    num_entry(t, [50, 0]); t.close_quick()
    t.key("3"); num_entry(t, [30, 90]); t.close_quick()
    t.key("5"); num_entry(t, [50, 180]); t.close_quick()
    t.key("3"); num_entry(t, [30, 270]); t.close_quick()
    s = t.st()
    t.chk("sayıyla 4 çizgi + uzunluk ölçüleri, gereksiz ölçü yok (v0.90)", s["ents"].count("line") == 4 and len(s["dims"]) >= 2 and "Aşırı" not in s["status"], s)
    t.chk("sayıyla kare son nokta başlangıca birleşir (kapalı, 3 nokta + orijin)", s["npts"] == 3, (s["npts"], s["drawing"]))
    print("  sayıyla kare durumu:", s["dof"], s["rels"], s["conf"])
    t.key("Escape")
    t.ok_pm(); t.extrude(10)
    v = t.vol()
    t.chk("sayıyla kare ekstrüzyon 50×30×10", v and abs(v - 15000) < 1, (v, t.tree_errs()))

    # sayıyla giriş: daire ve dikdörtgen (123 düğmesi = panel)
    t.fresh(); t.new_sketch(); t.zoom_to(200)
    t.cmd("Daire")
    t.pg.locator("#pm-body button:has-text('Sayıyla gir')").click(); time.sleep(0.2)
    num_entry(t, [10, 10])
    t.pg.locator("#pm-body button:has-text('Sayıyla gir')").click(); time.sleep(0.2)
    num_entry(t, [24]); t.close_quick()
    s = t.st(); c = t.ents_of("circle")
    t.chk("sayıyla daire Ø24 merkez (10,10) + çap ölçüsü", c and abs(c[0]["r"] - 12) < 1e-6 and ["dia", 24, False] in s["dims"], (c, s["dims"]))
    t.cmd("Dikdörtgen")
    t.pg.locator("#pm-body button:has-text('Sayıyla gir')").click(); time.sleep(0.2)
    num_entry(t, [-50, -40])
    t.pg.locator("#pm-body button:has-text('Sayıyla gir')").click(); time.sleep(0.2)
    num_entry(t, [30, 20]); t.close_quick()
    s = t.st()
    t.chk("sayıyla dikdörtgen 30×20 oluşur", s["ents"].count("line") == 4, s["ents"])
    print("  sayıyla dikdörtgen ölçüleri (E-27):", s["dims"])
    t.cmd("Merkez Yay")
    t.pg.mouse.move(*t.sc(0, 0)); t.key("7")
    t.chk("merkez yayda sayıyla giriş (SW: tüm araçlarda) — E-27", t.pg.locator(".num-entry").count() > 0)
    t.key("Escape")
    # sayıyla eğik çizgi (30°): ölçü eklenir mi
    t.cmd("Çizgi"); t.pg.mouse.move(*t.sc(40, 40)); t.key("4"); num_entry(t, [40, 40]); t.key("2"); num_entry(t, [20, 30]); t.close_quick()
    t.chk("sayıyla 30° çizgi: uzunluk ölçüsü 20", ["dist", 20, False] in t.st()["dims"], t.st()["dims"])
    t.key("Escape")

    # ---------- şekil sihirbazı: plaka
    t.fresh()
    t.pg.click("#menubar >> text=Dosya"); time.sleep(0.2)
    t.pg.click("text=Şekil sihirbazı…"); time.sleep(0.4)
    t.chk("Dosya > Şekil sihirbazı penceresi", t.pg.locator("dialog.input-dialog h2:has-text('Şekil sihirbazı')").count() == 1)
    t.pg.click("dialog.input-dialog button:has-text('Oluştur')"); time.sleep(1.5); t.wait()
    v = t.vol()
    exp = 200 * 120 * 10 - 4 * PI * 5.5 ** 2 * 10
    t.chk("plaka sihirbazı hacmi", v and abs(v - exp) < 2, (v, exp))
    fs = t.feats()
    sk = [f for f in fs if f[1] == "sketch"]
    t.chk("sihirbaz eskizi + ekstrüzyon", len(sk) >= 1 and any(f[1] == "extrude" for f in fs), fs)
    exn = [f[2] for f in fs if f[1] == "extrude"][0]
    print("  sihirbaz özellikleri:", fs)
    t.edit_sketch_of(exn)
    st = t.st()
    t.chk("sihirbaz eskizi tam tanımlı", st["dof"] == 0, st["status"])
    i = dim_label_idx(t, 200)
    if i is not None:
        t.dim_dbl(i, 260)
    t.ok_pm()
    v2 = t.vol()
    t.chk("plaka genişliği 200→260 modele geçer, delikler kenar mesafesinde kalır", v2 and abs(v2 - (260 * 120 * 10 - 4 * PI * 5.5 ** 2 * 10)) < 2, v2)
    d = [f for f in t.saved()["features"] if f["type"] == "sketch"][0]["data"]
    circ = [e for e in d["ents"] if e["t"] == "circle"]
    xs = sorted(round(d["pts"][c["c"]]["x"], 2) for c in circ)
    print("  delik x konumları:", xs)
    t.reload()
    t.chk("plaka yenilemeden sonra 260", abs((t.vol() or 0) - v2) < 1, t.vol())
    t.end()

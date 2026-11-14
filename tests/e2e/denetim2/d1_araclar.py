# d1 — Tüm çizim araçları için ortak döngü: çiz → eskizde Ctrl+Z / Ctrl+Y → Seç + Delete → Ctrl+Z → ✓ → yenile → kayıtta aynı
#      + kapalı profilin bir kenarı silinince ekstrüzyon davranışı (masaüstü, gerçek fare / klavye)
import sys, math; sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d1_lib import *

TOOLS = [
    # (şerit etiketi, tıklamalar, son işlem, silmek için öğe üstü nokta)
    ("Çizgi", [(0, 0), (30, 0), (30, 20)], "esc", (15, 0)),
    ("Merkez Çiz.", [(0, 0), (0, 30)], None, (0, 15)),
    ("Orta N. Çizgi", [(10, 10), (30, 10)], None, (25, 10)),
    ("Dikdörtgen", [(0, 0), (30, 20)], None, (15, 0)),
    ("Merkez Dikd.", [(0, 0), (20, 10)], None, (0, 10)),
    ("3N Dikdörtgen", [(0, 0), (30, 0), (30, 20)], None, (15, 0)),
    ("3N Merkez Dikd.", [(0, 0), (20, 0), (20, 10)], None, (20, 5)),
    ("Paralelkenar", [(0, 0), (30, 0), (40, 20)], None, (15, 0)),
    ("Daire", [(0, 0), (15, 0)], None, (10.6, 10.6)),
    ("Çevre Dairesi", [(-15, 0), (0, 15), (15, 0)], None, (-10.6, -10.6)),
    ("Merkez Yay", [(0, 0), (20, 0), (0, 20)], None, (14.14, 14.14)),
    ("3N Yay", [(-20, 0), (20, 0), (0, 20)], None, (14.14, 14.14)),
    ("Kanal", [(0, 0), (30, 0), (30, 6)], None, (15, 6)),
    ("Merkez Kanal", [(0, 0), (20, 0), (20, 6)], None, (0, 6)),
    ("Yay Kanal", [(0, 0), (30, 0), (0, 30), (0, 36)], "sweep", (25.5, 25.5)),
    ("Çokgen", [(0, 0), (20, 0)], None, (15, 8.6)),
    ("Elips", [(0, 0), (30, 0), (0, 15)], None, (0, 15)),
    ("Kısmi Elips", [(0, 0), (30, 0), (0, 15), (30, 0), (-30, 0)], None, (0, 15)),
    ("Parabol", [(-20, 0), (20, 0), (0, 20)], None, (0, 20)),
    ("Konik", [(-20, 0), (20, 0), (0, 30)], None, None),
    ("Spline", [(-30, 0), (-10, 15), (10, -10)], "dbl30", None),
    ("Nokta", [(10, 10)], None, (10, 10)),
    ("Metin", [(5, 5)], None, (9, 9)),
]

with sync_playwright() as p:
    t = T(p)
    for (label, clicks, extra, hit) in TOOLS:
        t.fresh(); t.new_sketch(); t.zoom_to(200)
        t.cmd(label)
        for i, q in enumerate(clicks):
            if extra == "sweep" and i == 2:
                for a in range(0, 95, 10):
                    t.pg.mouse.move(*t.sc(30 * math.cos(math.radians(a)), 30 * math.sin(math.radians(a))), steps=2)
            t.mclick(*q)
        if extra == "esc": t.close_quick(); t.key("Escape")
        if extra == "dbl30": t.mclick(30, 0, dbl=True)
        t.close_quick()
        if label == "Merkez Çiz.": t.key("Escape")  # D1-13: merkez çizgisi zinciri sürer
        n = len(t.data()["ents"])
        ok = t.chk(f"[{label}] çizildi (öğe var, çizim bitti)", n > 0 and not t.st()["drawing"], (t.st()["ents"], t.st()["drawing"]))
        if not ok:
            if t.st()["drawing"]: t.key("Escape")
            continue
        status = t.st()["status"]
        t.undo()
        n0 = len(t.data()["ents"])
        t.chk(f"[{label}] eskizde Ctrl+Z son çizim adımını geri alır", n0 < n, (n0, t.st()["ents"]))
        t.redo()
        t.chk(f"[{label}] Ctrl+Y geri getirir", len(t.data()["ents"]) == n, len(t.data()["ents"]))
        if hit:
            t.cmd("Seç")
            t.mclick(*hit)
            seln = t.ev(ED + ".sel.size")
            t.key("Delete")
            n1 = len(t.data()["ents"])
            t.chk(f"[{label}] Seç + Delete siler", seln > 0 and n1 < n, (seln, n, n1))
            t.undo()
            t.chk(f"[{label}] silme Ctrl+Z ile geri", len(t.data()["ents"]) == n, len(t.data()["ents"]))
        t.ok_pm()
        t.reload()
        sk = [f for f in (t.saved() or {"features": []})["features"] if f["type"] == "sketch"]
        t.chk(f"[{label}] ✓ + yenileme → kayıtta {n} öğe", sk and len(sk[0]["data"]["ents"]) == n, len(sk[0]["data"]["ents"]) if sk else None)
        print(f"  [{label}] durum: {status}")

    # kapalı profilin kenarını silme → ekstrüzyon hatası, çökme yok, geri alınca düzelir
    t.fresh(); t.new_sketch(); t.zoom_to(200)
    t.cmd("Dikdörtgen"); t.mclick(0, 0); t.mclick(40, 30); t.close_quick()
    t.ok_pm(); t.extrude(10)
    v = t.vol()
    t.edit_sketch_of("Ekstrüzyon"); t.cmd("Seç"); t.mclick(20, 30); t.key("Delete"); t.ok_pm(); time.sleep(0.8)
    errs = t.tree_errs()
    t.chk("açık profil: ağaçta hata gösterilir (sessiz değil)", errs, (errs, t.vol()))
    t.undo(); t.wait(); time.sleep(0.6)
    t.chk("açık profil: Ctrl+Z ile model geri gelir", abs((t.vol() or 0) - v) < 1 and not t.tree_errs(), (t.vol(), t.tree_errs()))
    t.end()

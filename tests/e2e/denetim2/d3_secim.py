# d3 — seçim ve sürükleme: tanımsız geometri sürüklenir, tanımlı kıpırdamaz; pencere / kesişen seçim; Ctrl çoklu seçim;
# sürükleme geri alınır; boş sürükleme geri alma yığınını kirletmez; sürükleme ✓ → model; sabit / ölçülü daire.
import math, json
from d3_ortak import *

with sync_playwright() as p:
    t = T(p)
    t.setup([])
    t.new_sketch("Ön Düzlem"); t.zoom(1.6)
    P = lambda s, k: (s["pts"][k]["x"], s["pts"][k]["y"])
    g = lambda i: next(x for x in t.sk()["ents"] if x["id"] == i)

    # tanımsız dikdörtgen (orijinden) + serbest daire
    t.draw_rect(0, 0, 60, 40); t.key("Escape")
    t.cmd("Daire"); t.kclick(-40, 30, "Control"); t.kclick(-28, 30, "Control")
    s = t.sk(); circ = next(e for e in s["ents"] if e["t"] == "circle")
    corner = next(k for k, v in s["pts"].items() if abs(v["x"] - 60) < 0.5 and abs(v["y"] - 40) < 0.5)
    t.cmd("Seç"); t.key("Escape")
    # 1) köşe sürükle: 60,40 → 80,55 (köşe noktası serbest: iki kenar uzar, orijin köşesi yerinde)
    x, y = t.scp(corner); x2, y2 = t.sc(80, 55)
    u0 = t.ev(f"{ED}.undoStack.length")
    t.drag(x, y, x2, y2)
    q = P(t.sk(), corner)
    t.chk("tanımsız köşe sürüklenir (≈80,55), dikdörtgen korunur", abs(q[0] - 80) < 1 and abs(q[1] - 55) < 1 and t.res()["ok"], q)
    ol = [e for e in t.sk()["ents"] if e["t"] == "line" and "O" in (e["p1"], e["p2"])]
    t.chk("dikdörtgen köşesi doğrudan orijin (O) ve yerinde", len(ol) == 2, [(e["p1"], e["p2"]) for e in t.sk()["ents"] if e["t"] == "line"])
    t.key("Control+z")
    q = P(t.sk(), corner)
    t.chk("sürükleme tek Ctrl+Z ile geri alınır", abs(q[0] - 60) < 0.5 and abs(q[1] - 40) < 0.5, q)
    t.key("Control+y")
    # 2) çizgiden sürükleme (üst kenar yukarı) — paralel taşınır
    x, y = t.sc(30, 55); t.drag(x, y, x, y - 40)
    s = t.sk(); top = [k for k, v in s["pts"].items() if v["y"] > 30]
    ys = sorted(round(s["pts"][k]["y"], 3) for k in top)
    t.chk("üst kenar sürüklenince yatay kalır ve yukarı gider", len(ys) == 2 and ys[0] == ys[1] and ys[0] > 60, ys)
    # 3) daire kenarından sürükle → yarıçap değişir, merkez yerinde
    c0 = P(t.sk(), circ["c"]); x, y = t.sc(-28, 30); x2, y2 = t.sc(-20, 30)
    t.drag(x, y, x2, y2)
    c1 = P(t.sk(), circ["c"]); r1 = g(circ["id"])["r"]
    t.chk("daire kenarı sürüklenince yarıçap değişir, merkez yerinde", abs(r1 - 20) < 1.0 and math.hypot(c1[0] - c0[0], c1[1] - c0[1]) < 1e-6, (r1, c1))
    # 4) dairenin merkezini sürükle → taşınır
    x, y = t.scp(circ["c"]); x2, y2 = t.sc(-50, 20); t.drag(x, y, x2, y2)
    c2 = P(t.sk(), circ["c"])
    t.chk("daire merkezi sürüklenir", abs(c2[0] + 50) < 1 and abs(c2[1] - 20) < 1, c2)

    # 5) tam tanımla → sürükleme kıpırdatmaz, veri değişmez
    t.cmd("Tam Tanımla")
    t.chk("tam tanımlı", t.res()["dof"] == 0, t.res())
    t.cmd("Seç"); t.key("Escape")
    before = json.dumps(t.sk(), sort_keys=True)
    u0 = t.ev(f"{ED}.undoStack.length")
    s = t.sk(); cr = next(k for k, v in s["pts"].items() if v["x"] > 50 and v["y"] > 50)
    x, y = t.scp(cr); t.drag(x, y, x + 60, y + 40)
    x, y = t.sc(-50 + g(circ["id"])["r"], 20); t.drag(x, y, x + 40, y)
    after = json.dumps(t.sk(), sort_keys=True)
    t.chk("tam tanımlı geometri sürüklenince kıpırdamaz", before == after)
    u1 = t.ev(f"{ED}.undoStack.length")
    t.chk("kıpırdamayan sürükleme geri alma yığınına adım eklemez", u1 == u0, (u0, u1))
    nd = len(t.sk()["dims"])
    t.key("Control+z")
    t.chk("ardından Ctrl+Z son gerçek işlemi (Tam Tanımla) geri alır", len(t.sk()["dims"]) < nd, (nd, len(t.sk()["dims"])))
    t.key("Control+y")

    # 6) pencere seçimi (soldan sağa: tamamen içindekiler) / kesişen (sağdan sola)
    t.key("Escape")
    a = t.sc(-75, 60); b = t.sc(-5, -5)   # daireyi tamamen kapsar, dikdörtgene değmez
    t.drag(a[0], a[1], b[0], b[1], 10)
    sel = t.ev(f"[...{ED}.sel]")
    t.chk("pencere seçimi (soldan sağa) yalnız içindeki daireyi seçer", circ["id"] in sel and not any(x.startswith("l") for x in sel), sel)
    t.key("Escape")
    a = t.sc(20, 80); b = t.sc(-10, 30)   # sağdan sola: üst kenara ve sol kenara değer
    t.drag(a[0], a[1], b[0], b[1], 10)
    sel = t.ev(f"[...{ED}.sel]")
    t.chk("kesişen seçim (sağdan sola) değdiği kenarları seçer", sum(1 for x in sel if x.startswith("l")) >= 2, sel)
    t.key("Escape")
    # 7) Ctrl ile çoklu seçim / Ctrl ile seçimden çıkar
    t.kclick(30, 0.0 + 0.0); t.kclick(0, 25, "Control")
    s1 = t.ev(f"[...{ED}.sel]")
    t.kclick(0, 25, "Control"); s2 = t.ev(f"[...{ED}.sel]")
    t.chk("Ctrl+tık ekler / tekrar Ctrl+tık çıkarır", len(s1) == 2 and len(s2) == 1, (s1, s2))
    t.kclick(-90, -60); s3 = t.ev(f"[...{ED}.sel]")
    t.chk("boşluğa tık seçimi temizler", not s3, s3)
    # 8) Delete seçimi siler, Ctrl+Z geri getirir
    n0 = len(t.sk()["ents"]); t.kclick(*t.ev(f"(()=>{{const e={ED};const c=e.data.ents.find(x=>x.t==='circle');const p=e.data.pts[c.c];return [p.x+c.r*0.7071,p.y+c.r*0.7071]}})()"))
    t.key("Delete")
    n1 = len(t.sk()["ents"]); t.key("Control+z"); n2 = len(t.sk()["ents"])
    t.chk("Delete siler, Ctrl+Z geri getirir", n1 == n0 - 1 and n2 == n0, (n0, n1, n2))

    # 9) sürükle → ✓ → model (hazır: ekstrüzyon değil, kayıt)
    t.cmd("Seç"); t.key("Escape")
    fid = t.ev("window.__app.mode.featId")
    t.pm_ok()
    t.close()

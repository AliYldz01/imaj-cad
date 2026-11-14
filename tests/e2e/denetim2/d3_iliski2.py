# d3 — eşit eğrilik (spline ucu + yay), eşit kanallar, delme (model kenarı), koordinat ölçüsü, yapı geometrisi;
# ilişkili eskizden ekstrüzyon → ilişkiyi sil + sürükle → ✓ → model; delme noktasının modele bağlılığı.
import math
from d3_ortak import *

with sync_playwright() as p:
    t = T(p)
    P = lambda s, k: (s["pts"][k]["x"], s["pts"][k]["y"]) if k != "O" else (0.0, 0.0)
    g = lambda i: next(x for x in t.sk()["ents"] if x["id"] == i)

    def new(before):
        old = {e["id"] for e in before["ents"]}
        return [e for e in t.sk()["ents"] if e["id"] not in old]

    t.setup([])
    t.new_sketch("Ön Düzlem"); t.zoom(1.5)
    # 1) eşit eğrilik: merkez yay (R20) + ucundan başlayan spline
    t.cmd("Merkez Yay"); b0 = t.sk()
    t.kclick(-50, 20, "Control"); t.kclick(-30, 20, "Control"); t.kclick(-50, 40, "Control")
    A = new(b0)[0]
    s = t.sk(); pa = P(s, A["s"])
    t.cmd("Spline"); b0 = t.sk()
    x, y = t.sc(*pa); t.pg.mouse.move(x + 4, y + 3); t.pg.mouse.move(x, y); time.sleep(0.15); t.pg.mouse.click(x, y); time.sleep(0.2)
    t.kclick(-33, 4, "Control"); t.kclick(-45, -8, "Control")
    if t.pg.locator("#pm-body button:has-text(\"Spline'ı bitir\")").count():
        t.pg.click("#pm-body button:has-text(\"Spline'ı bitir\")"); time.sleep(0.3)
    SP = next((e for e in new(b0) if e["t"] == "spline"), None)
    t.chk("spline yayın ucundan başladı", SP and SP["pts"][0] == A["s"], SP and (SP["pts"], A["s"]))
    t.cmd("Seç"); t.key("Escape")
    t.kclick(-50 + 20 * math.cos(0.7), 20 + 20 * math.sin(0.7))
    poly = t.ev(f"(()=>{{const e={ED};const x=e.data.ents.find(q=>q.id==='{SP['id']}');return e.entPolyline(x)}})()") if SP else [[0, 0]]
    sp_mid = poly[len(poly) // 4]
    t.kclick(sp_mid[0], sp_mid[1], "Control")
    sel = t.ev(f"[...{ED}.sel]")
    btn = t.pg.locator("#pm-body button.rel-btn:has-text('Eşit eğrilik')")
    t.chk("yay + spline seçilince 'Eşit eğrilik' düğmesi", btn.count() > 0, (sel, t.panel_btns()))
    if btn.count():
        btn.click(); time.sleep(0.4)
        t.note("eşit eğrilik iletisi", t.ev("(document.querySelector('#toast')||{}).textContent"))
        sp = g(SP["id"])
        t.chk("eşit eğrilik spline tutamağını ayarladı", sp.get("h") and sp["h"][0], sp.get("h"))
        # yay yarıçapı değişince (sürükle) eşit eğrilik korunur mu?
        h0 = sp.get("h") and sp["h"][0]
        t.key("Escape"); x, y = t.sc(-50 + 20 * math.cos(1.2), 20 + 20 * math.sin(1.2)); t.drag(x, y, x - 20, y - 25)
        t.note("yay sürüklendi: R", g(A["id"])["r"], "tutamak", g(SP["id"]).get("h"), "önce", h0)
        t.chk("eşit eğrilik kalıcı bir ilişki olarak kayıtlı (yay R değişince güncellenir — SolidWorks)", any(r["t"] in ("eqcurv", "curvature", "eqcurve2") for r in t.sk()["rels"]), [r["t"] for r in t.sk()["rels"]])
    t.key("Escape")

    # 2) eşit kanallar: iki kanal
    def slot(a, b, w):
        t.cmd("Kanal"); b0 = t.sk(); t.kclick(*a, "Control"); t.kclick(*b, "Control"); t.kclick(*w, "Control"); t.key("Escape"); return new(b0)
    S1 = slot((20, 40), (60, 40), (40, 46))
    S2 = slot((20, -10), (45, -10), (32, -14))
    arcs1 = [e for e in S1 if e["t"] == "arc"]; arcs2 = [e for e in S2 if e["t"] == "arc"]
    t.chk("iki kanal (2 yay + 2 çizgi)", len(arcs1) == 2 and len(arcs2) == 2, ([e["t"] for e in S1], [e["t"] for e in S2]))
    if len(arcs1) == 2 and len(arcs2) == 2:
        t.cmd("Seç"); t.key("Escape"); t.cmd("İlişkiler")  # simgeler tıklamayı engellemesin
        def onarc(a, ang):
            s = t.sk(); c = P(s, a["c"]); r = g(a["id"])["r"]; return (c[0] + r * math.cos(ang), c[1] + r * math.sin(ang))
        ln1 = [e for e in S1 if e["t"] == "line" and not g(e["id"]).get("cons")][0]; ln2 = [e for e in S2 if e["t"] == "line" and not g(e["id"]).get("cons")][0]
        def online(e, f=0.15):
            s = t.sk(); a, b = P(s, g(e["id"])["p1"]), P(s, g(e["id"])["p2"]); return (a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f)
        t.kclick(*online(ln1)); t.kclick(*online(ln2), "Control")
        t.note("kanal seçimi", t.ev(f"[...{ED}.sel]"), ln1["id"], ln2["id"])
        okb = t.press_rel("Eşit kanallar")
        r1, r2 = g(arcs1[0]["id"])["r"], g(arcs2[0]["id"])["r"]
        s = t.sk(); cl = lambda A: math.hypot(*(lambda a, b: (a[0] - b[0], a[1] - b[1]))(P(s, g(A[0]["id"])["c"]), P(s, g(A[1]["id"])["c"])))
        t.chk("Eşit kanallar: yarıçap ve merkezler arası eşit", okb and abs(r1 - r2) < 1e-6 and abs(cl(arcs1) - cl(arcs2)) < 1e-6, (okb, t.panel_btns(), r1, r2, cl(arcs1), cl(arcs2)))
        t.key("Escape"); t.cmd("İlişkiler")

    # 3) koordinat ölçüsü: orijin sıfır, iki noktaya
    t.cmd("Nokta"); b0 = t.sk(); t.kclick(30, -50, "Control"); t.kclick(70, -40, "Control"); pts = [e["p"] for e in new(b0)]
    t.cmd("Koord. Ölçü")
    nd = len(t.sk()["dims"])
    t.kclick(0, 0); t.kclick(*P(t.sk(), pts[0])); t.kclick(*P(t.sk(), pts[1]))
    ds = t.sk()["dims"][nd:]
    t.chk("koordinat ölçüsü: orijinden 2 yatay ölçü 30 / 70", len(ds) == 2 and sorted(round(abs(d["v"]), 3) for d in ds) == [30.0, 70.0], [(d["sub"], d["v"]) for d in ds])
    t.chk("koordinat ölçüsü etiketlerinde eksi değer görünmez", all(not x.strip().startswith("-") and "−" not in x for x in t.pg.locator(".dim").all_inner_texts()), t.pg.locator(".dim").all_inner_texts())
    t.cmd("Seç"); t.key("Escape")
    # 4) Yapı Geom.: çizgi seç → yapı → tekrar → normal
    t.cmd("Çizgi"); b0 = t.sk(); t.kclick(-80, -60, "Control"); t.kclick(-40, -60, "Control"); t.key("Escape"); Lc = new(b0)[0]
    t.cmd("Seç"); t.key("Escape"); t.kclick(-70, -60); t.cmd("Yapı Geom.")
    c1 = g(Lc["id"]).get("cons"); t.kclick(-70, -60); t.cmd("Yapı Geom."); c2 = g(Lc["id"]).get("cons")
    t.chk("Yapı Geom. aç / kapat", c1 and not c2, (c1, c2))
    t.pm_ok()

    # 5) delme: hazır model kutu (Üst düzlemde 80×60, 20 yüksek) → Sağ düzlemde nokta → Delme → üst ön kenar
    sk0 = sketch("s0", "Taban", TOP, lambda pt, line, rect, c, tx: rect(-40, -30, 40, 30))
    sk0["data"]["dims"] = [{"id": "W", "t": "dist", "refs": ["p1", "p2"], "v": 80, "sub": "a", "lp": [0, -40]},
                           {"id": "H", "t": "dist", "refs": ["p2", "p3"], "v": 60, "sub": "a", "lp": [50, 0]}]
    t.setup([sk0, ext("e0", "s0", 20)])
    t.new_sketch("Sağ Düzlem"); t.zoom(1.5)
    t.cmd("Nokta"); b0 = t.sk(); t.kclick(5, 5, "Control"); pt = new(b0)[0]["p"]
    t.cmd("Seç"); t.key("Escape"); t.kclick(*P(t.sk(), pt))
    t.cmd("Delme")
    t.note("Delme aracına geçince seçim", t.ev(f"[...{ED}.sel]"))
    if not t.ev(f"[...{ED}.sel]"): t.kclick(*P(t.sk(), pt))
    # model kenarı: (0, 20, 30) üzerinden geçen x yönlü üst kenar; ekranda kenar üzerinde x=+15 noktası
    t.pg.click(".vcube .iso"); time.sleep(0.5)
    R = t.pg.query_selector("#view canvas").bounding_box()
    w = t.ev("window.__app.viewer.toScreen([15,20,30])")
    t.pg.mouse.move(R["x"] + w[0], R["y"] + w[1]); t.pg.mouse.click(R["x"] + w[0], R["y"] + w[1]); time.sleep(0.4)
    t.note("delme iletisi", t.ev("(document.querySelector('#toast')||{}).textContent"))
    q = P(t.sk(), pt)
    wq = t.ev(f"(()=>{{const f={ED}.frame,p={ED}.data.pts['{pt}'];const yv=[f.n[1]*f.x[2]-f.n[2]*f.x[1],f.n[2]*f.x[0]-f.n[0]*f.x[2],f.n[0]*f.x[1]-f.n[1]*f.x[0]];return [0,1,2].map(i=>+(f.o[i]+f.x[i]*p.x+yv[i]*p.y).toFixed(3))}})()")
    t.chk("Delme: nokta kenarın düzlemi deldiği yere (0,20,±30)", abs(wq[0]) < 1e-3 and abs(wq[1] - 20) < 1e-3 and abs(abs(wq[2]) - 30) < 1e-3, (wq, t.rels()))
    fid = t.ev("window.__app.mode.featId")
    t.pm_ok()
    # kutunun H ölçüsü 60 → 80 (taban eskizini düzenle) → delinen nokta z=±40'a gitmeli (SolidWorks: delme ilişkisi modele bağlı)
    t.edit_sketch("e0")
    ix = [d["id"] for d in t.sk()["dims"]].index("H")
    t.pg.locator(".dim").nth(ix).dblclick(); time.sleep(0.3); t.prompt_val(80)
    t.pm_ok()
    f = next(x for x in t.doc()["features"] if x["id"] == fid)
    pp = f["data"]["pts"][pt]
    t.note("model değişince delme noktası (eskiz yerel)", pp)
    t.chk("Delme ilişkisi modele bağlı: kutu 60→80 olunca nokta kenarı izler (|z| 40)", abs(abs(pp["x"]) - 40) < 1e-3 or abs(abs(pp["y"]) - 40) < 1e-3, pp)
    t.close()

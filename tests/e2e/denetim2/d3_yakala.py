# d3 — çıkarım / yakalama: uç, orta, merkez, çeyrek, kesişim, üzerinde, yatay/dikey, dik, uyandırma (hizalama),
# ızgara, açı, hızlı yakalama filtresi, model kenarı; Ctrl ile yakalama kapalı. Gerçek fare (bekleyerek gezdirme + tık).
import math
from d3_ortak import *

with sync_playwright() as p:
    t = T(p)
    # hazır model: 80×60×20 kutu (üst yüzde eskiz için)
    sk0 = sketch("s0", "Taban", TOP, lambda pt, line, rect, c, tx: rect(-40, -30, 40, 30))
    t.setup([sk0, ext("e0", "s0", 20)])
    P = lambda s, k: (s["pts"][k]["x"], s["pts"][k]["y"]) if k != "O" else (0.0, 0.0)
    g = lambda i: next(x for x in t.sk()["ents"] if x["id"] == i)

    def hover(sx, sy, dwell=0.12):
        x, y = t.sc(sx, sy)
        for k in range(6, 0, -1):
            t.pg.mouse.move(x + 3 * k, y + 2 * k); time.sleep(0.02)
        t.pg.mouse.move(x, y); time.sleep(dwell)
        return x, y

    def hclick(sx, sy, dwell=0.12):
        x, y = hover(sx, sy, dwell); t.pg.mouse.click(x, y); time.sleep(0.2)

    def new(before):
        old = {e["id"] for e in before["ents"]}
        return [e for e in t.sk()["ents"] if e["id"] not in old]

    def newrels(before):
        old = {r["id"] for r in before["rels"]}
        return [(r["t"], r["refs"]) for r in t.sk()["rels"] if r["id"] not in old]

    t.new_sketch("Ön Düzlem"); t.zoom(1.6)
    # temel geometri (Ctrl: ilişkisiz)
    t.cmd("Çizgi"); t.kclick(-70, -20, "Control"); t.kclick(-10, -20, "Control"); t.key("Escape")
    A = t.sk()["ents"][-1]
    t.cmd("Çizgi"); t.kclick(-40, -45, "Control"); t.kclick(-14, 20, "Control"); t.key("Escape")
    B = t.sk()["ents"][-1]
    t.cmd("Daire"); t.kclick(40, 30, "Control"); t.kclick(55, 30, "Control")
    C = t.sk()["ents"][-1]
    rel_rows = []

    def case(name, start, target, check, dwell=0.12):
        t.cmd("Çizgi"); b0 = t.sk()
        t.kclick(*start, "Control")
        lab = None
        x, y = hover(*target, dwell)
        lab = t.ev(f"({ED}.st.inf||{{}}).label || null")
        cur = t.ev(f"{ED}.curKind || null")
        t.pg.mouse.click(x, y); time.sleep(0.2); t.key("Escape")
        ne = new(b0); nr = newrels(b0)
        ok = bool(ne) and check(ne[-1], nr, t.sk())
        t.chk(f"yakalama: {name}", ok, f"etiket={lab} imleç={cur} ilişkiler={nr}")
        return ne, nr

    sA = t.sk()
    case("uç nokta → çakışık (aynı nokta)", (-80, 10), P(sA, A["p2"]), lambda e, r, s: e["p2"] == A["p2"])
    ne, nr = case("çizgi ortası → orta nokta ilişkisi", (-80, 20), (-40, -20), lambda e, r, s: any(x[0] == "midpoint" for x in r))
    t.chk("orta noktaya yakalarken başka ilişki (çizgiyi yataylayan nokta–nokta hizası) eklenmez", [x[0] for x in nr] == ["midpoint"], nr)
    case("daire merkezi → çakışık merkez", (10, 60), (40, 30), lambda e, r, s: e["p2"] == C["c"])
    ne, nr = case("çeyrek nokta → çember üzerinde + merkezle yatay", (80, 70), (55, 30), lambda e, r, s: any(x[0] == "onCircle" for x in r) and any(x[0] == "horizontal" and C["c"] in x[1] for x in r))
    hz = [x for x in nr if x[0] == "horizontal" and C["c"] in x[1]]
    t.chk("çeyrek noktasında aynı yatay ilişki iki kez eklenmez (gereksiz kısıt)", len(hz) == 1 and not t.res()["red"], (hz, t.res()["red"]))
    # A: y=-20, B: (-40,-45)→(-20,5) eğim 2.5 → y=-20'de x=-30
    case("kesişim → iki çizgi üzerinde", (-85, -60), (-30, -20), lambda e, r, s: sum(1 for x in r if x[0] == "onLine") == 2 and abs(P(s, e["p2"])[0] + 30) < 1e-4)  # v0.90: çözücü toleransı
    case("çizgi üzerinde → üzerinde ilişkisi", (-60, 30), (-58, -20), lambda e, r, s: any(x[0] == "onLine" for x in r))
    case("yatay çıkarım (0,4° eğik) → yatay ilişkisi", (0, -60), (40, -59.7), lambda e, r, s: any(x[0] == "horizontal" for x in r) and abs(P(s, e["p1"])[1] - P(s, e["p2"])[1]) < 1e-6)
    case("dikey çıkarım → dikey ilişkisi", (75, -10), (75.3, -50), lambda e, r, s: any(x[0] == "vertical" for x in r))
    case("daire çevresinde → üzerinde", (20, 70), (40 + 15 * math.cos(2.0), 30 + 15 * math.sin(2.0)), lambda e, r, s: any(x[0] == "onCircle" for x in r))

    # dik çıkarım: zincir (0,-80)→(30,-70) sonra dik yönde
    t.cmd("Çizgi"); b0 = t.sk(); t.kclick(0, -80, "Control"); t.kclick(30, -70, "Control")
    x, y = hover(30 - 6, -70 + 18); lab = t.ev(f"({ED}.st.inf||{{}}).label || null")
    t.pg.mouse.click(x, y); time.sleep(0.2); t.key("Escape")
    t.chk("dik çıkarım (zincirde önceki çizgiye) → dik ilişkisi", any(r[0] == "perpendicular" for r in newrels(b0)), (lab, newrels(b0)))

    # uyandırma: A'nın ucunda bekle, sonra aynı x'te aşağıda tıkla → dikey hizalama
    t.cmd("Çizgi"); b0 = t.sk(); t.kclick(-85, -70, "Control")
    wx, wy = t.sc(*P(t.sk(), A["p1"]))
    for k in range(8): t.pg.mouse.move(wx + (k % 2), wy); time.sleep(0.08)   # imleç noktada bekler (küçük titreme)
    x, y = hover(-70.4, -70, 0.15); lab = t.ev(f"({ED}.st.inf||{{}}).label || null"); guides = t.ev(f"(({ED}.st.inf||{{}}).guides||[]).length")
    t.pg.mouse.click(x, y); time.sleep(0.2); t.key("Escape")
    nr = newrels(b0); ne = new(b0)
    pa = P(t.sk(), A["p1"])
    t.chk("uyandırılmış noktaya dikey hizalama (mavi kılavuz) → x eşit, A yerinde", ne and abs(P(t.sk(), ne[-1]["p2"])[0] - pa[0]) < 1e-4 and abs(pa[0] + 70) < 1e-4, (lab, guides, nr, pa, ne and P(t.sk(), ne[-1]["p2"]), t.res()))

    # Ctrl basılıyken yakalama yok
    t.cmd("Çizgi"); b0 = t.sk(); t.kclick(-85, 55, "Control")
    t.pg.keyboard.down("Control"); x, y = hover(-40, -20); t.pg.mouse.click(x, y); t.pg.keyboard.up("Control"); time.sleep(0.2); t.key("Escape")
    t.chk("Ctrl basılıyken orta nokta ilişkisi eklenmez", not newrels(b0), newrels(b0))

    # hızlı yakalama filtresi: sağ tık → Hızlı yakalama… → Orta nokta kapat
    t.cmd("Çizgi")
    x, y = t.sc(80, 80); t.pg.mouse.click(x, y, button="right"); time.sleep(0.3)
    t.pg.click(".sw-ctx .sw-mi:has-text('Hızlı yakalama')"); time.sleep(0.3)
    t.pg.click(".sw-ctx .sw-mi:has-text('Orta nokta')"); time.sleep(0.2)
    t.key("Escape")
    t.chk("hızlı yakalama: Orta nokta kapalı", "mid" in t.ev(f"[...{ED}.snapOff]"), t.ev(f"[...{ED}.snapOff]"))
    t.pg.mouse.click(5, 5) if False else None
    ne, nr = case("filtre kapalıyken orta noktaya yakalamaz", (-80, 40), (-40, -20), lambda e, r, s: not any(x[0] == "midpoint" for x in r))
    t.pg.mouse.click(*t.sc(80, 80), button="right"); time.sleep(0.3)
    t.pg.click(".sw-ctx .sw-mi:has-text('Hızlı yakalama')"); time.sleep(0.3)
    t.pg.click(".sw-ctx .sw-mi:has-text('Tümünü aç')"); time.sleep(0.2); t.key("Escape")

    # açı yakalama 15°
    sel = t.pg.locator("#pm-body select").filter(has_text="Açı yakalama")
    sel.select_option("15"); time.sleep(0.2)
    t.cmd("Çizgi"); b0 = t.sk(); t.kclick(-80, 75, "Control")
    hclick(-80 + 40 * math.cos(math.radians(32)), 75 - 40 * math.sin(math.radians(32))); t.key("Escape")
    ne = new(b0); s = t.sk()
    a_ = math.degrees(math.atan2(P(s, ne[-1]["p2"])[1] - P(s, ne[-1]["p1"])[1], P(s, ne[-1]["p2"])[0] - P(s, ne[-1]["p1"])[0])) if ne else None
    t.chk("açı yakalama 15°: 32° → 30°", a_ is not None and abs(abs(a_) - 30) < 1e-3, a_)
    t.pg.locator("#pm-body select").filter(has_text="Açı yakalama").select_option("0")

    # ızgara: aralık 10, yakala; iki ayrı çizgi aynı ızgara x'ine düşer → aralarında ilişki oluşmamalı (uyandırılmadı)
    t.pg.locator("#pm-body label:has-text('Izgaraya yakala') input").check(); time.sleep(0.1)
    gs = t.pg.locator("#pm-body label:has-text('Izgara aralığı') input")
    if gs.count(): gs.fill("10"); gs.press("Enter"); time.sleep(0.2)
    t.cmd("Çizgi"); b0 = t.sk()
    hclick(61.7, -31.2); hclick(78.4, -48.6); t.key("Escape")
    ne = new(b0); s = t.sk()
    q1 = P(s, ne[-1]["p1"]) if ne else None
    t.chk("ızgaraya yakala (10): 61.7,-31.2 → 60,-30", q1 and abs(q1[0] - 60) < 1e-6 and abs(q1[1] + 30) < 1e-6, q1)
    t.cmd("Çizgi"); b1 = t.sk()
    hclick(88.6, 19.4); hclick(61.2, 9.1); t.key("Escape")
    nr = newrels(b1)
    t.chk("ızgarada aynı x'e düşen ilgisiz noktalar arasında kendiliğinden dikey ilişkisi kurulmaz", not any(r[0] in ("vertical", "horizontal") and len(r[1]) == 2 for r in nr), nr)
    t.pg.locator("#pm-body label:has-text('Izgaraya yakala') input").uncheck()
    t.pm_ok()

    # model kenarı: kutunun üst yüzünde eskiz → köşeye yakalama = sabit
    t.tab("features")
    t.ev("window.__app.viewer.viewStd && 0")
    t.pg.click(".vcube .iso") if t.pg.locator(".vcube .iso").count() else None
    time.sleep(0.4)
    # üst yüze tıkla (y=20 düzlemi): merkez (0,20,0)
    R = t.pg.query_selector("#view canvas").bounding_box()
    s0 = t.ev("window.__app.viewer.toScreen([0,20,0])")
    t.pg.mouse.click(R["x"] + s0[0], R["y"] + s0[1]); time.sleep(0.3)
    t.cmd("Eskiz"); t.wait(0.6)
    t.chk("üst yüzde eskiz açıldı", t.ev("window.__app.mode.k") == "sketch", t.ev("window.__app.mode.k"))
    t.quickdim(False)
    if t.ev("window.__app.mode.k") == "sketch":
        # model köşesi (40,20,30) → eskiz yerel koordinatı
        loc = t.ev("(()=>{const f=window.__app.mode.editor.frame;const w=[40,20,30];const d=[0,1,2].map(i=>w[i]-f.o[i]);const yv=[f.n[1]*f.x[2]-f.n[2]*f.x[1],f.n[2]*f.x[0]-f.n[0]*f.x[2],f.n[0]*f.x[1]-f.n[1]*f.x[0]];return [d[0]*f.x[0]+d[1]*f.x[1]+d[2]*f.x[2], d[0]*yv[0]+d[1]*yv[1]+d[2]*yv[2]]})()")
        case("model köşesi → sabit nokta (Model köşesi)", (0, 0), tuple(loc), lambda e, r, s: any(x[0] == "fix" for x in r) and abs(P(s, e["p2"])[0] - loc[0]) < 1e-6)
        t.pm_cancel("discard")
    t.close()

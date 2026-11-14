# d3 — Akıllı Ölçü türleri, Değiştir kutusu (çift tık, tekerlek, ±, ⟳, ✕, Esc, Enter, ifade), D tuşu, yay koşulu,
# çift mesafe, zincir ölçü, etiket sürükleme, sürülen/sürücü; inç birimi; ölçü değişikliğinin modele / kayda geçmesi.
import math
from d3_ortak import *

def dist(a, b): return math.hypot(a[0] - b[0], a[1] - b[1])

with sync_playwright() as p:
    t = T(p)
    t.setup([])
    t.new_sketch("Ön Düzlem"); t.zoom(1.5)
    P = lambda s, k: (s["pts"][k]["x"], s["pts"][k]["y"])
    g = lambda i: next(x for x in t.sk()["ents"] if x["id"] == i)
    dimv = lambda: [(d["t"], d.get("sub"), round(d["v"], 4), bool(d.get("ref"))) for d in t.sk()["dims"]]

    def new(before):
        old = {e["id"] for e in before["ents"]}
        return [e["id"] for e in t.sk()["ents"] if e["id"] not in old]

    def line(a, b, tool="Çizgi"):
        t.cmd(tool); b0 = t.sk(); t.kclick(*a, "Control"); t.kclick(*b, "Control"); t.key("Escape"); return new(b0)[0]

    def circle(c, r):
        t.cmd("Daire"); b0 = t.sk(); t.kclick(*c, "Control"); t.kclick(c[0] + r, c[1], "Control"); return new(b0)[0]

    def dimclick(targets, lab, val=None):
        t.cmd("Akıllı Ölçü")
        for q in targets: t.kclick(*q)
        t.kclick(*lab)
        has = t.pg.locator(".dim-prompt").count() > 0
        if has and val is not None: t.prompt_val(val)
        return has

    def last_dim(): return t.sk()["dims"][-1]

    # 1) hizalı / yatay / dikey doğrusal
    L1 = line((-80, -60), (-50, -20))           # 50 boy
    dimclick([(-71, -48)], (-58, -45), 60)
    d = last_dim(); s = t.sk(); l = g(L1)
    t.chk("hizalı ölçü (etiket çizgiye dik) sub=a, boy 60", d["sub"] == "a" and abs(dist(P(s, l["p1"]), P(s, l["p2"])) - 60) < 1e-6, (d["sub"], d["v"]))
    L2 = line((-30, -60), (0, -30))
    dimclick([(-21, -51)], (-15, -20), 40)   # etiket üstte → yatay
    d = last_dim(); s = t.sk(); l = g(L2)
    t.chk("yatay ölçü (etiket üstte) sub=h, dx 40", d["sub"] == "h" and abs(abs(P(s, l["p2"])[0] - P(s, l["p1"])[0]) - 40) < 1e-6, (d["sub"], d["v"]))
    L3 = line((20, -60), (45, -35))
    dimclick([(27.5, -52.5)], (55, -48), 15)    # etiket yanda → dikey
    d = last_dim(); s = t.sk(); l = g(L3)
    t.chk("dikey ölçü (etiket yanda) sub=v, dy 15", d["sub"] == "v" and abs(abs(P(s, l["p2"])[1] - P(s, l["p1"])[1]) - 15) < 1e-6, (d["sub"], d["v"]))

    # 2) açı
    La = line((-80, 10), (-40, 10)); Lb = line((-80, 14), (-50, 40))
    dimclick([(-68, 10), (-71, 21.8)], (-58, 22), 30)
    d = last_dim(); s = t.sk()
    ang = lambda i: math.degrees(math.atan2(P(s, g(i)["p2"])[1] - P(s, g(i)["p1"])[1], P(s, g(i)["p2"])[0] - P(s, g(i)["p1"])[0]))
    t.chk("açı ölçüsü 30°", d["t"] == "angle" and abs(abs(ang(Lb) - ang(La)) - 30) < 1e-4, (d["t"], d["v"], ang(La), ang(Lb)))

    # 3) daire Ø → D tuşu → R
    C = circle((60, 30), 10)
    dimclick([(60 + 10 * math.cos(0.6), 30 + 10 * math.sin(0.6))], (78, 45), 25)
    d = last_dim()
    t.chk("daire çap ölçüsü Ø25 → r 12.5", d["t"] == "dia" and abs(g(C)["r"] - 12.5) < 1e-6, (d["t"], d["v"], g(C)["r"]))
    t.cmd("Seç"); t.key("Escape")
    t.pg.locator(".dim").last.click(); time.sleep(0.2)
    t.key("d")
    d = last_dim()
    t.chk("D tuşu çap → yarıçap (R 12.5, geometri aynı)", d["t"] == "rad" and abs(d["v"] - 12.5) < 1e-6 and abs(g(C)["r"] - 12.5) < 1e-6, (d["t"], d["v"]))
    t.key("Control+z")
    t.chk("D tuşu geri alınır", last_dim()["t"] == "dia", last_dim()["t"])

    # 4) yay R + nokta–çizgi + iki daire (yay koşulu)
    t.cmd("Merkez Yay"); b0 = t.sk(); t.kclick(-40, 60, "Control"); t.kclick(-28, 60, "Control"); t.kclick(-40, 72, "Control"); A = new(b0)[0]
    dimclick([(-40 + 12 * math.cos(0.5), 60 + 12 * math.sin(0.5))], (-20, 75), 8)
    d = last_dim()
    t.chk("yay yarıçap ölçüsü R8", d["t"] == "rad" and abs(g(A)["r"] - 8) < 1e-6, (d["t"], g(A)["r"]))
    t.cmd("Nokta"); b0 = t.sk(); t.kclick(-60, 0, "Control"); Pn = new(b0)[0]
    dimclick([P(t.sk(), g(Pn)["p"]), (-55, 10)], (-65, 5), 6)
    t.note("nokta-çizgi dims", dimv()[-2:])
    d = last_dim(); s = t.sk()
    ll = g(d["refs"][1]); a_, b_, q_ = P(s, ll["p1"]), P(s, ll["p2"]), P(s, d["refs"][0])
    pld = abs((b_[0]-a_[0])*(q_[1]-a_[1]) - (b_[1]-a_[1])*(q_[0]-a_[0])) / dist(a_, b_)
    t.chk("nokta–çizgi mesafesi 6", d["t"] == "pldist" and abs(pld - 6) < 1e-6, (d["t"], pld))
    C2 = circle((20, 40), 6); C3 = circle((40, 50), 4)
    dimclick([(20 + 6 * math.cos(2.4), 40 + 6 * math.sin(2.4)), (40 + 4 * math.cos(0.7), 50 + 4 * math.sin(0.7))], (30, 62), None)   # merkezler arası (değer sorulur)
    t.prompt_val(25)
    d = last_dim(); s = t.sk()
    cc = dist(P(s, g(C2)["c"]), P(s, g(C3)["c"]))
    dx = abs(P(s, g(C2)["c"])[0] - P(s, g(C3)["c"])[0])
    t.chk("daire–daire merkezleri (etiket üstte → yatay) 25", d.get("sub") == "h" and abs(dx - 25) < 1e-6, (d["t"], d.get("sub"), dx))
    t.cmd("Seç"); t.key("Escape"); t.pg.locator(".dim").last.click(); time.sleep(0.3)
    has_cond = t.pg.locator("#pm-body button:has-text('En uzak')").count() > 0
    t.chk("panelde Yay koşulu (Merkez / En yakın / En uzak)", has_cond)
    if has_cond:
        t.pg.click("#pm-body button:has-text('En uzak')"); time.sleep(0.3)
        d = last_dim(); s = t.sk(); cc2 = dist(P(s, g(C2)["c"]), P(s, g(C3)["c"]))
        t.chk("En uzak koşulu: değer = 25+6+4, geometri değişmez", abs(d["v"] - (cc + 10)) < 1e-4 and abs(cc2 - cc) < 1e-6, (d["t"], d.get("cond"), d["v"], cc2))

    # 5) çift mesafe: merkez çizgisi + nokta, etiket öbür yanda
    CL = line((0, 80), (0, 60), "Merkez Çiz.")
    t.cmd("Nokta"); b0 = t.sk(); t.kclick(12, 70, "Control"); Q = new(b0)[0]
    dimclick([P(t.sk(), g(Q)["p"]), (0, 75)], (-8, 70), None)
    t.note("çift mesafe dims", dimv()[-1:], t.sk()["rels"][-2:])
    lab = t.pg.locator(".dim-prompt input").input_value() if t.pg.locator(".dim-prompt").count() else ""
    t.prompt_val(30)
    d = last_dim(); s = t.sk()
    t.chk("çift mesafe (etiket merkez çizgisinin öbür yanında): Ø30 → nokta x=15", d.get("dbl") and abs(abs(P(s, g(Q)["p"])[0] - P(s, g(CL)["p1"])[0]) - 15) < 1e-6, (d.get("dbl"), lab, P(s, g(Q)["p"])))

    # 6) zincir ölçü (farklı y'deki noktalar) + aynı hizada (E-9)
    t.cmd("Nokta"); b0 = t.sk()
    for q in [(60, -70), (75, -64), (95, -74)]: t.kclick(*q, "Control")
    zs = new(b0)
    t.cmd("Akıllı Ölçü")
    t.pg.locator("#pm-body label:has-text('Zincir ölçü') input").check(); time.sleep(0.1)
    pz = [P(t.sk(), g(z)["p"]) for z in zs]
    nd0 = len(t.sk()["dims"])
    t.kclick(*pz[0]); t.kclick(*pz[1]); t.kclick(67, -85)
    if t.pg.locator(".dim-prompt").count(): t.prompt_val(15)
    t.kclick(*pz[2]);
    if t.pg.locator(".dim-prompt").count(): t.prompt_val(20)
    s = t.sk(); pz2 = [P(s, g(z)["p"]) for z in zs]
    t.chk("zincir ölçü: 2 yatay ölçü 15 / 20", len(s["dims"]) - nd0 == 2 and abs(pz2[1][0] - pz2[0][0] - 15) < 1e-6 and abs(pz2[2][0] - pz2[1][0] - 20) < 1e-6, (len(s["dims"]) - nd0, pz2))
    t.pg.locator("#pm-body label:has-text('Zincir ölçü') input").uncheck()

    # 7) Değiştir kutusu: çift tık → tekerlek → canlı önizleme → ✕ geri döner
    t.cmd("Seç"); t.key("Escape")
    t.pm_ok()  # ✓: önce kaydet, sonra yeniden aç (Seç aracı)
    fid = t.ev("window.__app.doc.features.at(-1).id")
    sv = t.saved_feat(fid)
    t.chk("✓ sonrası tüm ölçüler kayıtta", sv and len(sv["data"]["dims"]) == len(t.doc()["features"][-1]["data"]["dims"]), sv and len(sv["data"]["dims"]))
    t.edit_sketch("Eskiz1")
    ix = next(i for i, d in enumerate(t.sk()["dims"]) if d["t"] == "dia")
    lab = t.pg.locator(".dim").nth(ix)
    lab.dblclick(); time.sleep(0.4)
    has = t.pg.locator(".dim-prompt").count() > 0
    t.chk("çift tık Değiştir kutusunu açar", has)
    inp = t.pg.locator(".dim-prompt input")
    box = inp.bounding_box(); t.pg.mouse.move(box["x"] + 10, box["y"] + 5)
    for _ in range(3): t.pg.mouse.wheel(0, -100); time.sleep(0.15)
    v_in = inp.input_value(); r_live = g(C)["r"]
    t.chk("tekerlek 3 adım +3 → 28, canlı önizleme r 14", v_in.replace(",", ".") in ("28", "28.000") and abs(r_live - 14) < 1e-6, (v_in, r_live))
    t.pg.click(".dim-prompt .no"); time.sleep(0.3)
    t.chk("✕ değeri ve geometriyi geri alır (r 12.5)", abs(g(C)["r"] - 12.5) < 1e-6 and abs(t.sk()["dims"][ix]["v"] - 25) < 1e-6, g(C)["r"])
    lab.dblclick(); time.sleep(0.4)
    t.pg.fill(".dim-prompt input", "33"); time.sleep(0.2); t.pg.press(".dim-prompt input", "Escape"); time.sleep(0.3)
    t.chk("Esc değeri geri alır", abs(g(C)["r"] - 12.5) < 1e-6, g(C)["r"])
    t.chk("Esc eskizden çıkmaz / çıkış penceresi açmaz", t.ev("window.__app.mode.k") == "sketch" and not t.pg.locator("dialog.exit-dialog[open]").count())
    lab.dblclick(); time.sleep(0.4)
    t.pg.fill(".dim-prompt input", "10*3"); t.pg.press(".dim-prompt input", "Enter"); time.sleep(0.4)
    t.chk("aritmetik ifade 10*3 → Ø30", abs(g(C)["r"] - 15) < 1e-6 and abs(t.sk()["dims"][ix]["v"] - 30) < 1e-6, g(C)["r"])
    # yatay ölçüde ± (yön çevir)
    ih = next(i for i, d in enumerate(t.sk()["dims"]) if d.get("sub") == "h")
    lh = g(L2); x0 = P(t.sk(), lh["p2"])[0] - P(t.sk(), lh["p1"])[0]
    t.pg.locator(".dim").nth(ih).dblclick(); time.sleep(0.4)
    fl = t.pg.locator(".dim-prompt .fl")
    t.chk("yatay ölçüde ± düğmesi var", fl.count() > 0)
    if fl.count():
        fl.click(); time.sleep(0.3); t.pg.click(".dim-prompt .ok"); time.sleep(0.4)
        x1 = P(t.sk(), g(L2)["p2"])[0] - P(t.sk(), g(L2)["p1"])[0]
        t.chk("± yönü ters çevirir (dx işareti değişir, |dx| 40)", abs(abs(x1) - 40) < 1e-6 and x1 * x0 < 0, (x0, x1))
        t.key("Control+z")
    # ⟳ canlı
    t.pg.locator(".dim").nth(ix).dblclick(); time.sleep(0.4)
    t.pg.fill(".dim-prompt input", "40"); time.sleep(0.2)
    rb = t.pg.locator(".dim-prompt .rb")
    if rb.count(): rb.click(); time.sleep(0.3)
    t.chk("⟳ / yazarken canlı: r 20", abs(g(C)["r"] - 20) < 1e-6, g(C)["r"])
    t.pg.press(".dim-prompt input", "Enter"); time.sleep(0.3)
    # 8) etiket sürükleme (E-7 hâlâ?)
    lp0 = t.sk()["dims"][ix]["lp"]
    bb = t.pg.locator(".dim").nth(ix).bounding_box()
    t.drag(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2, bb["x"] + bb["width"] / 2 + 80, bb["y"] + bb["height"] / 2 + 60, 15)
    lp1 = t.sk()["dims"][ix]["lp"]
    exp = (lp0[0] + 80 / 1.0 / t.ev("1/(" + str(1) + ")") * 0, 0)
    sc0 = t.sc(*lp0); sc1 = t.sc(*lp1)
    t.chk("ölçü etiketi fareyle 80 px sürüklenir (E-7)", abs((sc1[0] - sc0[0]) - 80) < 12 and abs((sc1[1] - sc0[1]) - 60) < 12, (sc0, sc1))
    # 9) ✓ → kayıt → yenile
    t.pm_ok()
    sv = t.saved_feat(fid); c = next(e for e in sv["data"]["ents"] if e["id"] == C)
    t.chk("Değiştir kutusu değişikliği (Ø40) kayda geçti", abs(c["r"] - 20) < 1e-6, c["r"])
    t.reload()
    f = next(x for x in t.doc()["features"] if x["id"] == fid)
    c = next(e for e in f["data"]["ents"] if e["id"] == C)
    t.chk("sayfa yenilenince Ø40", abs(c["r"] - 20) < 1e-6, c["r"])
    t.close()

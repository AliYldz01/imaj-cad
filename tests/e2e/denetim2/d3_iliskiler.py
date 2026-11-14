# d3 — 2B eskiz ilişkileri: her ilişki gerçek fareyle (şerit aracı + tık/Ctrl+tık + İlişki Ekle düğmesi)
# → geometri koşulu + serbestlik düşüşü; ✓ → kayıt; Eskizi düzenle → ilişki silinir (Mevcut ilişkiler ✕) → ✓
# → Ctrl+Z / Ctrl+Y (parça) → sayfa yenile. Başlangıç: boş belge (hazır model: boş).
import math
from d3_ortak import *

def dist(a, b): return math.hypot(a[0] - b[0], a[1] - b[1])

with sync_playwright() as p:
    t = T(p)
    t.setup([])
    t.new_sketch("Ön Düzlem")
    t.zoom(1.4)
    P = lambda s, k: (s["pts"][k]["x"], s["pts"][k]["y"])

    def new_ids(before, kind="ents"):
        s = t.sk()
        if kind == "ents":
            old = {e["id"] for e in before["ents"]}
            return [e for e in s["ents"] if e["id"] not in old]
        return [k for k in s["pts"] if k not in before["pts"]]

    def line(a, b):
        t.cmd("Çizgi"); b0 = t.sk()
        t.kclick(*a, "Control"); t.kclick(*b, "Control"); t.key("Escape")
        n = new_ids(b0); return n[0]["id"] if n else None

    def cline(a, b):
        t.cmd("Merkez Çiz."); b0 = t.sk()
        t.kclick(*a, "Control"); t.kclick(*b, "Control"); t.key("Escape")
        n = new_ids(b0); return n[0]["id"] if n else None

    def circle(c, r):
        t.cmd("Daire"); b0 = t.sk()
        t.kclick(*c, "Control"); t.kclick(c[0] + r, c[1], "Control")
        n = new_ids(b0); return n[0]["id"] if n else None

    def arc(c, s, e):
        t.cmd("Merkez Yay"); b0 = t.sk()
        t.kclick(*c, "Control"); t.kclick(*s, "Control"); t.kclick(*e, "Control")
        n = new_ids(b0); return n[0]["id"] if n else None

    def point(q):
        t.cmd("Nokta"); b0 = t.sk()
        t.kclick(*q, "Control")
        n = new_ids(b0); return n[0]["id"] if n else None

    def on_line(e, f=0.3):
        s = t.sk(); a, b = P(s, e["p1"]), P(s, e["p2"])
        return (a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f)

    def on_circ(e, ang=35):
        s = t.sk(); c = P(s, e["c"]); r = next(x for x in s["ents"] if x["id"] == e["id"])["r"]
        return (c[0] + r * math.cos(math.radians(ang)), c[1] + r * math.sin(math.radians(ang)))

    def select(targets):
        t.cmd("Seç"); t.key("Escape")
        for i, q in enumerate(targets):
            t.kclick(*q, None if i == 0 else "Control")
        return t.ev(f"[...{ED}.sel]")

    rows = []
    def rel_case(name, label, targets, cond, dof_drop=None):
        sel = select(targets)
        btns = t.panel_btns()
        r0 = t.res(); n0 = len(t.sk()["rels"])
        okb = t.press_rel(label)
        r1 = t.res(); s = t.sk()
        good = okb and cond(s) and len(s["rels"]) > n0 and r1["ok"] and not r1["conf"]
        dd = r0["dof"] - r1["dof"]
        if dof_drop is not None: good = good and dd == dof_drop
        t.chk(f"İlişki {name}", good, f"sel={sel} btn={btns} dof {r0['dof']}→{r1['dof']} red={r1['red']}")
        rows.append((name, good))
        t.key("Escape")
        return good

    s = t.sk
    # 1 Yatay
    L = line((-85, 45), (-55, 62)); e = {"id": L}
    eL = lambda: next(x for x in t.sk()["ents"] if x["id"] == L)
    rel_case("Yatay", "Yatay", [on_line(eL())], lambda s: abs(P(s, eL()["p1"])[1] - P(s, eL()["p2"])[1]) < 1e-6, 1)
    # 2 Dikey
    L2 = line((-40, 42), (-28, 68)); e2 = lambda: next(x for x in t.sk()["ents"] if x["id"] == L2)
    rel_case("Dikey", "Dikey", [on_line(e2())], lambda s: abs(P(s, e2()["p1"])[0] - P(s, e2()["p2"])[0]) < 1e-6, 1)
    # 3 Çakışık (L3.p2 ↔ L4.p1)
    L3 = line((5, 45), (18, 60)); L4 = line((24, 62), (38, 48))
    g = lambda i: next(x for x in t.sk()["ents"] if x["id"] == i)
    rel_case("Çakışık", "Çakışık", [P(t.sk(), g(L3)["p2"]), P(t.sk(), g(L4)["p1"])], lambda s: dist(P(s, g(L3)["p2"]), P(s, g(L4)["p1"])) < 1e-6, 2)
    # 4 Birleştir
    L5 = line((50, 45), (63, 60)); L6 = line((68, 62), (82, 48))
    npts = len(t.sk()["pts"])
    select([P(t.sk(), g(L5)["p2"]), P(t.sk(), g(L6)["p1"])]); r0 = t.res()
    t.press_rel("Birleştir (tek nokta)"); r1 = t.res()
    t.chk("İlişki Birleştir: tek nokta, serbestlik −2", len(t.sk()["pts"]) == npts - 1 and r0["dof"] - r1["dof"] == 2, (npts, len(t.sk()["pts"]), r0["dof"], r1["dof"]))
    t.key("Escape")
    # 5 Orta nokta (nokta + çizgi)
    L7 = line((-88, 8), (-55, 20)); pt = point((-75, 25))
    pid = lambda: g(pt)["p"]
    rel_case("Orta nokta", "Orta nokta", [P(t.sk(), pid()), on_line(g(L7))],
             lambda s: dist(P(s, pid()), ((P(s, g(L7)["p1"])[0] + P(s, g(L7)["p2"])[0]) / 2, (P(s, g(L7)["p1"])[1] + P(s, g(L7)["p2"])[1]) / 2)) < 1e-6, 2)
    # 6 Eşit
    L8 = line((-42, 5), (-30, 10)); L9 = line((-42, 22), (-8, 28))
    ln = lambda i, s: dist(P(s, g(i)["p1"]), P(s, g(i)["p2"]))
    rel_case("Eşit (çizgi)", "Eşit", [on_line(g(L8)), on_line(g(L9))], lambda s: abs(ln(L8, s) - ln(L9, s)) < 1e-6, 1)
    # 7 Paralel
    L10 = line((5, 5), (35, 12)); L11 = line((5, 20), (35, 30))
    ang = lambda i, s: math.atan2(P(s, g(i)["p2"])[1] - P(s, g(i)["p1"])[1], P(s, g(i)["p2"])[0] - P(s, g(i)["p1"])[0])
    rel_case("Paralel", "Paralel", [on_line(g(L10)), on_line(g(L11))], lambda s: abs(math.sin(ang(L10, s) - ang(L11, s))) < 1e-6, 1)
    # 8 Dik
    L12 = line((50, 5), (80, 12)); L13 = line((55, 15), (62, 30))
    nr = len(t.sk()["rels"])
    rel_case("Dik", "Dik", [on_line(g(L12)), on_line(g(L13))], lambda s: abs(math.cos(ang(L12, s) - ang(L13, s))) < 1e-6, 1)
    t.note("Dik sonrası eklenen ilişkiler", [ (r["t"], r["refs"]) for r in t.sk()["rels"][nr:]], [ (e["id"], e["t"]) for e in t.sk()["ents"][-3:]])
    # 9 Doğrudaş
    L14 = line((-88, -30), (-74, -26)); L15 = line((-68, -22), (-52, -20))
    def colin(s):
        a, b, c, d = P(s, g(L14)["p1"]), P(s, g(L14)["p2"]), P(s, g(L15)["p1"]), P(s, g(L15)["p2"])
        u = (b[0] - a[0], b[1] - a[1]); n = math.hypot(*u)
        cr = lambda q: abs(u[0] * (q[1] - a[1]) - u[1] * (q[0] - a[0])) / n
        return cr(c) < 1e-6 and cr(d) < 1e-6
    rel_case("Doğrudaş (eş doğrusal)", "Doğrudaş", [on_line(g(L14)), on_line(g(L15))], colin, 2)
    # 10 Teğet çizgi + daire
    C1 = circle((-25, -28), 8); L16 = line((-42, -12), (-8, -15))
    def tang(s):
        c = P(s, g(C1)["c"]); r = g(C1)["r"]; a, b = P(s, g(L16)["p1"]), P(s, g(L16)["p2"])
        u = (b[0] - a[0], b[1] - a[1]); n = math.hypot(*u)
        return abs(abs(u[0] * (c[1] - a[1]) - u[1] * (c[0] - a[0])) / n - r) < 1e-5
    rel_case("Teğet (çizgi–daire)", "Teğet", [on_line(g(L16), 0.2), on_circ(g(C1), 250)], tang, 1)
    # 11 Eş merkezli
    C2 = circle((12, -28), 9); C3 = circle((27, -22), 7)
    rel_case("Eş merkezli", "Eş merkezli", [on_circ(g(C2), 200), on_circ(g(C3), 30)], lambda s: dist(P(s, g(C2)["c"]), P(s, g(C3)["c"])) < 1e-6, 2)
    # 12 Eş yarıçaplı
    C4 = circle((55, -28), 9); C5 = circle((76, -24), 5)
    rel_case("Eş yarıçaplı", "Eş yarıçaplı", [on_circ(g(C4), 200), on_circ(g(C5), 30)],
             lambda s: dist(P(s, g(C4)["c"]), P(s, g(C5)["c"])) < 1e-6 and abs(g(C4)["r"] - g(C5)["r"]) < 1e-6, 3)
    # 13 Simetrik (iki nokta + merkez çizgisi)
    CL = cline((-70, -50), (-70, -85)); q1 = point((-82, -60)); q2 = point((-60, -70))
    def sym(s):
        a, b = P(s, g(q1)["p"]), P(s, g(q2)["p"]); x0 = P(s, g(CL)["p1"])[0]
        return abs((a[0] + b[0]) / 2 - x0) < 1e-6 and abs(a[1] - b[1]) < 1e-6
    rel_case("Simetrik", "Simetrik", [P(t.sk(), g(q1)["p"]), P(t.sk(), g(q2)["p"]), on_line(g(CL), 0.3)], sym, 2)
    # 14 Sabit
    q3 = point((-30, -70))
    rel_case("Sabit (nokta)", "Sabitle", [P(t.sk(), g(q3)["p"])], lambda s: any(r["t"] == "fix" for r in s["rels"]), 2)
    # sabit nokta sürüklenince kıpırdamamalı
    t.cmd("Seç"); x, y = t.scp(g(q3)["p"]); t.drag(x, y, x + 60, y + 30)
    pq = P(t.sk(), g(q3)["p"])
    t.chk("Sabit nokta sürüklenince kıpırdamaz", dist(pq, (-30, -70)) < 0.05, pq)
    # 15 Üzerinde (nokta + daire)
    C6 = circle((20, -70), 9); q4 = point((32, -60))
    rel_case("Üzerinde (nokta–daire)", "Üzerinde", [P(t.sk(), g(q4)["p"]), on_circ(g(C6), 220)], lambda s: abs(dist(P(s, g(q4)["p"]), P(s, g(C6)["c"])) - g(C6)["r"]) < 1e-6, 1)
    # 15b Üzerinde (nokta + çizgi)
    L17 = line((5, -88), (38, -82)); q5 = point((25, -78))
    def onl(s):
        a, b, c = P(s, g(L17)["p1"]), P(s, g(L17)["p2"]), P(s, g(q5)["p"])
        u = (b[0] - a[0], b[1] - a[1]); return abs(u[0] * (c[1] - a[1]) - u[1] * (c[0] - a[0])) / math.hypot(*u) < 1e-6
    rel_case("Üzerinde (nokta–çizgi)", "Üzerinde", [P(t.sk(), g(q5)["p"]), on_line(g(L17), 0.8)], onl, 1)
    # 16 Eşit eğri uzunluğu (çizgi + yay)
    A1 = arc((65, -75), (77, -75), (65, -63)); L18 = line((50, -55), (62, -50))
    def alen(s):
        a = g(A1); c, ps, pe = P(s, a["c"]), P(s, a["s"]), P(s, a["e"])
        a0 = math.atan2(ps[1] - c[1], ps[0] - c[0]); a1 = math.atan2(pe[1] - c[1], pe[0] - c[0])
        sw = (a1 - a0) % (2 * math.pi); return sw * a["r"]
    rel_case("Eşit eğri uzunluğu", "Eşit eğri uzunluğu", [on_line(g(L18)), on_circ(g(A1), 30)], lambda s: abs(alen(s) - ln(L18, s)) < 1e-4, 1)

    sk_before = t.sk(); nrel = len(sk_before["rels"])
    t.note("toplam ilişki", nrel, t.res())
    # ilişki simgeleri görünür; İlişkiler komutu gizle / göster
    n_icons = t.pg.locator(".rel").count()
    t.cmd("İlişkiler"); n_off = t.pg.locator(".rel").count()
    t.cmd("İlişkiler"); n_on = t.pg.locator(".rel").count()
    t.chk("İlişkiler komutu simgeleri gizler / gösterir", n_icons > 0 and n_off == 0 and n_on == n_icons, (n_icons, n_off, n_on))
    # simgeye tıkla → ilişki seçilir → Delete ile silinir (SolidWorks)
    fid = t.ev("window.__app.mode.featId")
    t.pm_ok()
    sv = t.saved_feat(fid)
    t.chk("✓ sonrası kayıtta tüm ilişkiler", sv and len(sv["data"]["rels"]) == nrel, sv and len(sv["data"]["rels"]))
    # yeniden aç, Yatay ilişkisini sil (çizgiyi seç → Mevcut ilişkiler ✕)
    t.edit_sketch("Eskiz1")
    t.chk("yeniden açınca ilişkiler aynı", len(t.sk()["rels"]) == nrel)
    t.kclick(*on_line(eL()))
    lis = t.pg.locator("#pm-body li.pm-rel").all_inner_texts()
    _s = t.sk(); _l = eL(); t.note("l3 ilişkileri", [r for r in _s["rels"] if set(r["refs"]) & {_l["id"], _l["p1"], _l["p2"]}])
    t.pg.locator("#pm-body li.pm-rel:has-text('Yatay') button.x").first.click(); time.sleep(0.4)
    t.chk("Mevcut ilişkiler ✕ yatayı siler", len(t.sk()["rels"]) == nrel - 1, lis)
    # SolidWorks: ilişki simgesine tık yalnız simgeyi seçer (önceki seçim bırakılır) → D3 bulgusu: bizde seçime ekleniyor
    sel_before = t.ev(f"[...{ED}.sel]")
    icon = t.pg.locator(".rel[title='Dikey']").first
    icon.click(); time.sleep(0.2)
    sel_after = t.ev(f"[...{ED}.sel]")
    t.chk("simgeye tık önceki seçimi bırakır (yalnız ilişki seçili)", len(sel_after) == 1, (sel_before, sel_after))
    t.key("Escape"); icon = t.pg.locator(".rel[title='Dikey']").first; icon.click(); time.sleep(0.2); t.key("Delete")
    t.chk("ilişki simgesi seçilip Delete ile silinir", len(t.sk()["rels"]) == nrel - 2, len(t.sk()["rels"]))
    # silinen yatay çizgi artık sürüklenebilir
    a = eL(); x, y = t.scp(a["p2"]); t.drag(x, y, x + 10, y - 40)
    s2 = t.sk(); t.chk("ilişki silinince çizgi ucu serbest", abs(P(s2, a["p2"])[1] - P(s2, a["p1"])[1]) > 1, (P(s2, a["p1"]), P(s2, a["p2"])))
    t.pm_ok()
    sv = t.saved_feat(fid)
    t.chk("silme ✓ sonrası kayda geçti", len(sv["data"]["rels"]) == nrel - 2, len(sv["data"]["rels"]))
    t.key("Control+z"); time.sleep(0.6)
    sv = t.saved_feat(fid)
    t.chk("parça Ctrl+Z eskiz düzenlemesini geri alır", sv and len(sv["data"]["rels"]) == nrel, sv and len(sv["data"]["rels"]))
    t.key("Control+y"); time.sleep(0.6)
    sv = t.saved_feat(fid)
    t.chk("Ctrl+Y yeniden uygular", sv and len(sv["data"]["rels"]) == nrel - 2, sv and len(sv["data"]["rels"]))
    t.reload()
    d = t.doc(); f = next(x for x in d["features"] if x["id"] == fid)
    t.chk("sayfa yenilenince ilişkiler korunur", len(f["data"]["rels"]) == nrel - 2, len(f["data"]["rels"]))
    t.close()

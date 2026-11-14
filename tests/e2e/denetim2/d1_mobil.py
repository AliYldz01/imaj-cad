# d1 — Telefonda (390×844, is_mobile, has_touch, CDP dokunma) eskiz çizim araçları: 14 araç + yaşam döngüsü
import sys, math, random; sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d1_lib import *
PI = math.pi
random.seed(5)

def actbar(t, label):
    loc = t.pg.locator(f".actbar button:has-text('{label}')")
    if not loc.count(): return False
    t.tap(f".actbar button:has-text('{label}')"); time.sleep(0.3); return True

def quick_fill(t, vals):
    ins = t.pg.locator(".dim-prompt.quick input")
    for i, v in enumerate(vals):
        if i < ins.count(): ins.nth(i).fill(str(v))
    if ins.count(): ins.nth(ins.count() - 1).press("Enter"); time.sleep(0.4)

def mstroke(t, pts):
    """parmakla serbest çizim (imleç parmağın OFF px üstünde)"""
    a = t.sc(*pts[0]); t.touch("touchStart", [(a[0], a[1] + t.OFF)])
    for q in pts[1:]:
        s = t.sc(q[0] + random.uniform(-0.5, 0.5), q[1] + random.uniform(-0.5, 0.5)); t.touch("touchMove", [(s[0], s[1] + t.OFF)]); time.sleep(0.012)
    time.sleep(0.8); t.touch("touchEnd", []); time.sleep(0.5)

with sync_playwright() as p:
    t = T(p, mobile=True)
    # ---------- 1) Çizgi zinciri (dokunma) + ekran çubuğu ✓ ile bitir → kapalı → yaşam döngüsü
    t.new_sketch("Ön Düzlem")
    t.chk("telefon: eskiz açıldı, alt panel küçük", t.mode() == "sketch")
    t.cmd("Çizgi")
    t.pick(0, 0); t.pick(50, 0); t.close_quick(); t.pick(50, 30); t.close_quick(); t.pick(0, 30); t.close_quick(); t.pick(0, 0); t.close_quick()
    s = t.st()
    t.chk("telefon çizgi: kapalı 4 çizgi, Y/D, orijin, 2 serbestlik", s["ents"] == ["line"] * 4 and s["dof"] == 2 and s["npts"] == 3, s)
    t.cmd("Akıllı Ölçü")
    t.smart_dim([(25, 0)], 60, (25, -15)); t.smart_dim([(0, 8)], 40, (15, 15))  # sol kenar: sağ kenar dar ekranda ekran çubuğunun altında kalıyor; kenarın ortası değil (orta nokta seçilir) (v0.89)
    t.chk("telefon çizgi: 2 ölçü → tam tanımlı", t.st()["dof"] == 0, t.st())
    life(t, "telefon çizgi", 60 * 40 * 10, 60, 70, 70 * 40 * 10)

    # ekran çubuğu: zincir ✓ = Bitir, A = yay
    t.fresh(); t.new_sketch("Ön Düzlem"); t.cmd("Çizgi")
    t.pick(-40, 0); t.pick(-10, 0); t.close_quick()
    actbar(t, "A")
    t.chk("telefon: ekran çubuğu A → yay modu", t.ev(ED + ".st.arc"), t.ev(ED + ".st.arc"))
    t.pick(-10, 20); t.close_quick()
    s = t.st()
    t.chk("telefon: teğet yay oluştu", "arc" in s["ents"] and "tangent" in s["rels"], s)
    actbar(t, "✓")
    t.chk("telefon: ekran çubuğu ✓ (çizerken) zinciri bitirir, eskizde kalır", not t.st()["drawing"] and t.mode() == "sketch", (t.st()["drawing"], t.mode()))
    # iki parmak dokunuşu = geri al
    n0 = len(t.data()["ents"])
    a = t.sc(30, -20); b = t.sc(50, -20)  # v0.90: yeni eskiz orijini görünür bandın ortasında
    t.touch("touchStart", [a, b]); time.sleep(0.05); t.touch("touchEnd", []); time.sleep(0.4)
    t.chk("telefon: iki parmak dokunuşu geri alır", len(t.data()["ents"]) == n0 - 1, (n0, len(t.data()["ents"])))
    t.touch("touchStart", [a, b, t.sc(40, 75)]); time.sleep(0.05); t.touch("touchEnd", []); time.sleep(0.4)  # üçüncü parmak ekran çubuğuna değil tuvale (v0.89)
    t.chk("telefon: üç parmak dokunuşu ileri alır", len(t.data()["ents"]) == n0, len(t.data()["ents"]))

    # ---------- 2) Dikdörtgen + hızlı kutu
    t.fresh(); t.new_sketch("Ön Düzlem")
    t.cmd("Dikdörtgen"); t.pick(0, 0); t.pick(40, 30)
    t.chk("telefon dikdörtgen: hızlı kutu", t.quick_open())
    quick_fill(t, [50, 20])
    s = t.st()
    t.chk("telefon dikdörtgen: 50×20 tam tanımlı", s["dof"] == 0 and sorted(x[1] for x in s["dims"]) == [20, 50], s)
    life(t, "telefon dikdörtgen", 50 * 20 * 10, 50, 30, 30 * 20 * 10)

    # ---------- 3) Merkez dikdörtgen
    t.fresh(); t.new_sketch("Ön Düzlem")
    t.cmd("Merkez Dikd."); t.pick(0, 0); t.pick(25, 15); t.close_quick()
    s = t.st()
    t.chk("telefon merkez dikd.: 4+2 çizgi, orta nokta, 2 serbestlik", s["ents"].count("line") == 4 and "midpoint" in s["rels"] and s["dof"] == 2, s)

    # ---------- 4) Daire
    t.fresh(); t.new_sketch("Ön Düzlem")
    t.cmd("Daire"); t.pick(0, 0); t.pick(20, 0)
    quick_fill(t, [40])
    s = t.st()
    t.chk("telefon daire: Ø40, merkez orijin, tam tanımlı", s["ents"] == ["circle"] and s["dof"] == 0, s)
    life(t, "telefon daire", PI * 400 * 10, 40, 30, PI * 225 * 10)

    # ---------- 5) Merkez yay
    t.fresh(); t.new_sketch("Ön Düzlem")
    t.cmd("Merkez Yay"); t.pick(0, 0); t.pick(30, 0); t.pick(0, 30); t.close_quick()
    a = t.ents_of("arc")
    t.chk("telefon merkez yay: R30 çeyrek", len(a) == 1 and abs(a[0]["r"] - 30) < 1, a)

    # ---------- 6) 3 nokta yay
    t.cmd("3N Yay"); t.pick(-40, 0); t.pick(-10, 0); t.pick(-25, 15); t.close_quick()
    a = t.ents_of("arc")
    t.chk("telefon 3N yay: R15 yay", len(a) == 2 and abs(a[1]["r"] - 15) < 1, [x["r"] for x in a])

    # ---------- 7) Kanal
    t.fresh(); t.new_sketch("Ön Düzlem")
    t.cmd("Kanal"); t.pick(0, 0); t.pick(40, 0); t.pick(40, 8)
    quick_fill(t, [20, 50])
    s = t.st()
    t.chk("telefon kanal: tam tanımlı", s["dof"] == 0 and len(s["dims"]) == 2, s)
    life(t, "telefon kanal", (50 * 20 + PI * 100) * 10, 50, 60, (60 * 20 + PI * 100) * 10)

    # ---------- 8) Çokgen
    t.fresh(); t.new_sketch("Ön Düzlem")
    t.cmd("Çokgen"); t.pick(0, 0); t.pick(25, 0); t.close_quick()
    s = t.st()
    t.chk("telefon çokgen: 6 kenar", s["ents"].count("line") == 6, s["ents"])

    # ---------- 9) Elips
    t.cmd("Elips"); t.pick(-50, 50); t.pick(-25, 50); t.pick(-50, 60); t.close_quick()
    e = t.ents_of("ellipse")
    t.chk("telefon elips: a 25, b 10", e and abs(e[0]["rb"] - 10) < 1, e)

    # ---------- 10) Spline (dokunma, çift dokunmayla bitir)
    t.fresh(); t.new_sketch("Ön Düzlem")
    t.cmd("Spline")
    for q in [(-40, 0), (-20, 20), (0, 10), (20, 30)]: t.pick(*q)
    actbar(t, "✓")
    sp = t.ents_of("spline")
    t.chk("telefon spline: ekran çubuğu ✓ (Bitir) spline'ı oluşturur (noktalar kaybolmaz)", sp and len(sp[0]["pts"]) == 4, sp)
    if not sp:
        for q in [(-40, 0), (-20, 20), (0, 10)]: t.pick(*q)
        sx, sy = t.sc(20, 30)
        for _ in range(2):
            t.touch("touchStart", [(sx, sy + t.OFF)]); t.touch("touchEnd", []); time.sleep(0.08)
        time.sleep(0.4)
        sp = t.ents_of("spline")
        t.chk("telefon spline: hızlı çift dokunmayla biter", sp and len(sp[0]["pts"]) == 4, sp)

    # ---------- 11) Nokta
    t.cmd("Nokta"); t.pick(40, -20); t.pick(50, -20)
    t.chk("telefon nokta: 2 nokta", t.st()["ents"].count("point") == 2, t.st()["ents"])

    # ---------- 12) Serbest çizim (parmak)
    t.fresh(); t.new_sketch("Ön Düzlem")
    t.cmd("Serbest Çizim")
    corners = [(-30, 10), (30, 10), (30, 50), (-30, 50), (-30, 10)]
    pts = []
    for i in range(4):
        a, b = corners[i], corners[i + 1]
        for k in range(12): pts.append((a[0] + (b[0] - a[0]) * k / 12, a[1] + (b[1] - a[1]) * k / 12))
    pts.append(corners[-1])
    mstroke(t, pts); t.close_quick()
    s = t.st()
    t.chk("telefon serbest çizim: kaba dikdörtgen → 4 çizgi Y/D", s["ents"].count("line") == 4 and s["rels"].count("horizontal") == 2, s)

    # ---------- 13) 123 sayıyla giriş (ekran çubuğu)
    t.fresh(); t.new_sketch("Ön Düzlem")
    t.cmd("Daire")
    actbar(t, "123")
    ins = t.pg.locator(".num-entry input")
    t.chk("telefon 123: X/Y kutusu", ins.count() == 2)
    if ins.count() == 2:
        ins.nth(0).fill("10"); ins.nth(1).fill("10"); ins.nth(1).press("Enter"); time.sleep(0.3)
        actbar(t, "123"); ins = t.pg.locator(".num-entry input"); ins.nth(0).fill("30"); ins.nth(0).press("Enter"); time.sleep(0.3); t.close_quick()
    c = t.ents_of("circle")
    t.chk("telefon 123: daire Ø30", c and abs(c[0]["r"] - 15) < 1e-6, c)

    # ---------- 14) Metin
    t.cmd("Metin")
    tf = "#pm-body .pm-field:has-text('Metin') input"
    if t.pg.locator(tf).count():
        t.pg.fill(tf, "TR"); t.pg.dispatch_event(tf, "input"); t.pg.dispatch_event(tf, "change")
    t.close_sheet()
    t.pick(-40, 40)
    tx = t.ents_of("text")
    t.chk("telefon metin: TR", tx and tx[0]["text"] == "TR", tx)

    # ---------- 15) 3 nokta dikdörtgen + paralelkenar
    t.cmd("3N Dikdörtgen"); t.pick(30, 40); t.pick(60, 40); t.pick(60, 60); t.close_quick()
    t.cmd("Paralelkenar"); t.pick(-60, -30); t.pick(-30, -30); t.pick(-20, -10); t.close_quick()
    s = t.st()
    t.chk("telefon 3N dikd + paralelkenar: 8 çizgi", s["ents"].count("line") == 8, s["ents"])
    # eskizden çık (ekran çubuğu ✓) → kayıt
    actbar(t, "✓")
    t.chk("telefon: ekran çubuğu ✓ eskizden çıkar", t.mode() == "part", t.mode())
    t.reload()
    sk = [f for f in t.saved()["features"] if f["type"] == "sketch"]
    t.chk("telefon: eskiz kaydedildi (daire + metin + 8 çizgi)", sk and len(sk[-1]["data"]["ents"]) >= 10, len(sk[-1]["data"]["ents"]) if sk else None)
    t.end()

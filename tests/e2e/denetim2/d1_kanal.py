# d1 — Kanal türleri: düz kanal, merkez kanal, yay kanal (masaüstü, gerçek fare)
import sys, math; sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d1_lib import *
PI = math.pi
def quick_fill(t, vals):
    ins = t.pg.locator(".dim-prompt.quick input")
    labs = t.pg.locator(".dim-prompt.quick label").all_inner_texts()
    for i, v in enumerate(vals):
        if i < ins.count(): ins.nth(i).fill(str(v))
    if ins.count(): ins.nth(ins.count() - 1).press("Enter"); time.sleep(0.4)
    return labs
with sync_playwright() as p:
    t = T(p)
    # ---------- düz kanal (orijinden)
    t.new_sketch(); t.zoom_to(200)
    t.cmd("Kanal")
    t.mclick(0, 0); t.mclick(40, 0); t.mclick(40, 8)
    labs = quick_fill(t, [20, 50])
    t.chk("kanal: hızlı kutu Kanal genişliği + Merkezler arası", any("genişli" in x for x in labs) and any("Merkez" in x for x in labs), labs)
    s = t.st()
    t.chk("kanal: 2 yay + 2 çizgi + yapı merkez çizgisi", sorted(s["ents"]) == sorted(["arc", "arc", "line", "line", "line*"]), s["ents"])
    t.chk("kanal: 4 teğet + eşit + yatay", s["rels"].count("tangent") == 4 and "equal" in s["rels"] and "horizontal" in s["rels"], s["rels"])
    t.chk("kanal: orijinden + 2 ölçü → tam tanımlı", s["dof"] == 0, (s["dof"], s["dims"]))
    life(t, "kanal", (50 * 20 + PI * 100) * 10, 50, 60, (60 * 20 + PI * 100) * 10)

    # kanal ölçü seçeneği (panel: merkezden merkeze / toplam)
    t.fresh(); t.new_sketch(); t.zoom_to(200)
    t.cmd("Kanal")
    sel = t.pg.locator("#pm-body select")
    opts = sel.first.evaluate("s=>[...s.options].map(o=>o.value)") if sel.count() else []
    t.chk("kanal paneli: ölçü seçeneği (none/cc/total)", "total" in opts, opts)
    if "total" in opts:
        sel.first.select_option("total")
        t.mclick(-30, 20); t.mclick(10, 20); t.mclick(10, 26); t.close_quick()
        s = t.st()
        t.chk("kanal toplam boy ölçüsü otomatik: cc 52 + Ø12", sorted(round(x[1]) for x in s["dims"]) == [12, 52], s["dims"])

    # ---------- merkez kanal
    t.fresh(); t.new_sketch(); t.zoom_to(200)
    t.cmd("Merkez Kanal")
    t.mclick(0, 0); t.mclick(25, 0); t.mclick(25, 10)
    labs = quick_fill(t, [20, 50])
    s = t.st(); d = t.data()
    cl = [e for e in d["ents"] if e["t"] == "line" and e.get("cons")]
    A = t.P(cl[0]["p1"]) if cl else None; B = t.P(cl[0]["p2"]) if cl else None
    t.chk("merkez kanal: merkez çizgisi orijine göre simetrik", cl and abs(A[0] + B[0]) < 0.5, (A, B))
    print("  merkez kanal ilişkiler:", s["rels"], "dof", s["dof"], "(E-11 hâlâ var mı: merkez noktası/orta nokta)")
    t.chk("merkez kanal: tam tanımlı (merkez orijine bağlı) — E-11", s["dof"] == 0, s["dof"])
    life(t, "merkez kanal", (50 * 20 + PI * 100) * 10, 50, 60, (60 * 20 + PI * 100) * 10)

    # ---------- yay kanal
    t.fresh(); t.new_sketch(); t.zoom_to(200)
    t.cmd("Yay Kanal")
    t.mclick(0, 0); t.mclick(30, 0)
    for a in range(0, 95, 10):
        t.pg.mouse.move(*t.sc(30 * math.cos(math.radians(a)), 30 * math.sin(math.radians(a))), steps=2)
    t.mclick(0, 30); t.mclick(0, 36); t.close_quick()
    s = t.st(); d = t.data()
    t.chk("yay kanal: 4 yay + yapı yayı + 2 yapı çizgisi", s["ents"].count("arc") == 4 and s["ents"].count("arc*") == 1 and s["ents"].count("line*") == 2, s["ents"])
    arcs = [e for e in d["ents"] if e["t"] == "arc" and e.get("cons")]
    cpt = arcs[0]["c"] if arcs else None
    t.chk("yay kanal: merkez orijine bağlı (orijine tıklandı)", cpt == "O" or "coincident" in s["rels"], (cpt, s["rels"]))
    print("  yay kanal dof:", s["dof"], s["rels"])
    t.ok_pm(); t.extrude(10)
    v = t.vol()
    exp = ((PI / 4) * (36 ** 2 - 24 ** 2) + PI * 36) * 10
    t.chk("yay kanal hacmi (90°, R30, w6)", v and abs(v - exp) < 5, (v, exp))
    # eskizi düzenle: yapı yayının ucunu sürükle → kanal açısı değişir, model güncellenir
    t.edit_sketch_of("Ekstrüzyon")
    t.cmd("Seç")
    t.drag(0, 30, -21.2, 21.2, steps=12)
    d = t.data()
    ca = [e for e in d["ents"] if e["t"] == "arc" and e.get("cons")][0]
    S, E, C = t.P(ca["s"]), t.P(ca["e"]), t.P(ca["c"])
    sw = (math.degrees(math.atan2(E[1]-C[1], E[0]-C[0]) - math.atan2(S[1]-C[1], S[0]-C[0])) + 360) % 360
    print("  sürükleme sonrası yapı yayı: C", C, "S", S, "E", E, "açı", round(sw, 1))
    t.chk("yay kanal: ucu sürükleyince açı büyür, merkez yerinde (SW)", sw > 110 and abs(C[0]) < 0.5 and abs(C[1]) < 0.5, (sw, C))
    t.ok_pm()
    v2 = t.vol()
    t.chk("yay kanal: uç sürüklenince hacim büyür, hata yok", v2 and v2 > v + 100 and not t.tree_errs(), (v, v2, t.tree_errs()))
    t.key("Control+z"); t.wait(); time.sleep(0.5)
    t.chk("yay kanal: Ctrl+Z eski hacim", abs(t.vol() - v) < 1, t.vol())
    t.end()

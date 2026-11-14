# d3 — ilişki yaşam döngüsü modelde: ekstrüzyonlu eskizi düzenle → eğik kenara Yatay (gerçek tık + panel) → ✓ → model;
# yeniden aç → ilişkiyi sil → köşeyi sürükle → ✓ → model; Ctrl+Z / Ctrl+Y; yenile; ✕ ile vazgeç.
# Hazır model: dörtgen (0,0)(80,0)(80,50)(0,40) — üst kenar eğik — 20 mm ekstrüzyon.
from d3_ortak import *

def quad():
    sk = sketch("s1", "Eskiz1", FRONT, lambda pt, line, rect, c, tx: None)
    d = sk["data"]
    d["pts"] = {"a": {"x": 0, "y": 0}, "b": {"x": 80, "y": 0}, "c": {"x": 80, "y": 50}, "e": {"x": 0, "y": 40}}
    d["ents"] = [{"id": "l1", "t": "line", "p1": "a", "p2": "b"}, {"id": "l2", "t": "line", "p1": "b", "p2": "c"},
                 {"id": "l3", "t": "line", "p1": "c", "p2": "e"}, {"id": "l4", "t": "line", "p1": "e", "p2": "a"}]
    d["rels"] = [{"id": "r1", "t": "coincident", "refs": ["a", "O"]}, {"id": "r2", "t": "horizontal", "refs": ["l1"]},
                 {"id": "r3", "t": "vertical", "refs": ["l2"]}, {"id": "r4", "t": "vertical", "refs": ["l4"]}]
    d["seq"] = 20
    return sk

with sync_playwright() as p:
    t = T(p)
    t.setup([quad(), ext("e1", "s1", 20)])
    ymax = lambda: (lambda b: b and round(b[1][1], 3))(t.bbox())
    xmax = lambda: (lambda b: b and round(b[1][0], 3))(t.bbox())
    t.chk("başlangıç y max 50", ymax() == 50, ymax())
    t.edit_sketch("e1")
    x_, y_ = t.sc(30, 43.75)
    t.note("ekran", x_, y_, t.ev(f"(()=>{{const e=document.elementFromPoint({x_},{y_});return e.tagName+'.'+e.className}})()"), t.ev(f"{ED}.tool"))
    t.kclick(30, 43.75)                    # üst eğik kenar
    t.note("1. tık sonrası", t.ev(f"[...{ED}.sel]"), t.ev(f"{ED}.hov"))
    if not t.ev(f"[...{ED}.sel]"):
        t.kclick(30, 43.75); t.note("2. tık sonrası", t.ev(f"[...{ED}.sel]"))
    t.chk("üst kenar seçildi", t.ev(f"[...{ED}.sel]") == ["l3"], t.ev(f"[...{ED}.sel]"))
    t.press_rel("Yatay")
    s = t.sk(); yc, ye = s["pts"]["c"]["y"], s["pts"]["e"]["y"]
    t.chk("Yatay: üst kenar yatay", abs(yc - ye) < 1e-6, (yc, ye))
    t.pm_ok()
    t.chk("✓ sonrası model üst yüzü düz (ymax = c.y)", abs(ymax() - round(yc, 3)) < 1e-3, (ymax(), yc))
    y1 = ymax()
    # yeniden aç: ilişkiyi sil, köşe c'yi yukarı sürükle
    t.edit_sketch("e1")
    t.kclick(30, (yc + ye) / 2)
    t.pg.locator("#pm-body li.pm-rel:has-text('Yatay') button.x").first.click(); time.sleep(0.4)
    t.key("Escape")
    x, y = t.scp("c"); x2, y2 = t.sc(80, 70); t.drag(x, y, x2, y2)
    cy = t.sk()["pts"]["c"]["y"]
    t.chk("ilişki silinince köşe yukarı sürüklenir (≈70)", abs(cy - 70) < 1, cy)
    t.pm_ok()
    t.chk("✓ → model ymax ≈ 70", abs(ymax() - cy) < 1e-3, ymax())
    t.key("Control+z"); t.wait(0.8)
    t.chk("Ctrl+Z → ymax önceki (yatay)", abs(ymax() - y1) < 1e-3, ymax())
    t.key("Control+y"); t.wait(0.8)
    t.chk("Ctrl+Y → ≈70", abs(ymax() - cy) < 1e-3, ymax())
    t.reload()
    t.chk("yenile → ≈70", abs(ymax() - round(cy, 3)) < 1e-2, ymax())
    # ✕ ile vazgeç: sürükle → ✕ → Kaydetmeden çık → model aynı
    t.edit_sketch("e1")
    x, y = t.scp("b"); x2, y2 = t.sc(110, 0); t.drag(x, y, x2, y2)
    t.pm_cancel("discard")
    t.chk("✕ Kaydetmeden çık → xmax 80", xmax() == 80, xmax())
    # ✕ → Kaydet ve çık
    t.edit_sketch("e1")
    x, y = t.scp("b"); x2, y2 = t.sc(110, 0); t.drag(x, y, x2, y2)
    bx = t.sk()["pts"]["b"]["x"]
    t.pm_cancel("save")
    t.chk("✕ Kaydet ve çık → xmax ≈ 110", abs(xmax() - bx) < 1e-3 and bx > 100, (xmax(), bx))
    t.close()

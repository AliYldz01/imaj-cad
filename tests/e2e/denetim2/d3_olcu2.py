# d3 — ölçü değişikliği → model / kayıt / geri al / yenile; ondalık ve inç hassasiyeti; açık Değiştir kutusuyla ✓;
# global değişken (=d1) ile ölçü, Denklemler'de değişken değişince model; çözülemez değişken değeri.
# Hazır model: 80×50 dikdörtgen eskiz (2 ölçü + orijin) + 20 mm ekstrüzyon; 30-40-50 üçgen eskizi (3. kenar =d2).
import math
from d3_ortak import *

def rect_sketch():
    sk = sketch("s1", "Eskiz1", FRONT, lambda pt, line, rect, c, tx: rect(0, 0, 80, 50))
    d = sk["data"]
    d["rels"] = [{"id": "r1", "t": "horizontal", "refs": ["l5"]}, {"id": "r2", "t": "vertical", "refs": ["l6"]},
                 {"id": "r3", "t": "horizontal", "refs": ["l7"]}, {"id": "r4", "t": "vertical", "refs": ["l8"]},
                 {"id": "r5", "t": "coincident", "refs": ["p1", "O"]}]
    d["dims"] = [{"id": "D1", "t": "dist", "refs": ["p1", "p2"], "v": 80, "sub": "a", "lp": [40, -12]},
                 {"id": "D2", "t": "dist", "refs": ["p1", "p4"], "v": 50, "sub": "a", "lp": [-12, 25]}]
    d["seq"] = 40
    return sk

def tri_sketch():
    sk = sketch("s2", "Üçgen", TOP, lambda pt, line, rect, c, tx: None)
    d = sk["data"]
    d["pts"] = {"a": {"x": 0, "y": 0}, "b": {"x": 40, "y": 0}, "c": {"x": 40, "y": 30}}
    d["ents"] = [{"id": "t1", "t": "line", "p1": "a", "p2": "b"}, {"id": "t2", "t": "line", "p1": "b", "p2": "c"}, {"id": "t3", "t": "line", "p1": "c", "p2": "a"}]
    d["rels"] = [{"id": "q1", "t": "coincident", "refs": ["a", "O"]}, {"id": "q2", "t": "horizontal", "refs": ["t1"]}]
    d["dims"] = [{"id": "E1", "t": "dist", "refs": ["a", "b"], "v": 40, "sub": "a", "lp": [20, -8]},
                 {"id": "E2", "t": "dist", "refs": ["b", "c"], "v": 30, "sub": "a", "lp": [48, 15]},
                 {"id": "E3", "t": "dist", "refs": ["c", "a"], "v": 50, "sub": "a", "lp": [15, 20], "expr": "d2"}]
    d["seq"] = 10
    return sk

with sync_playwright() as p:
    t = T(p)
    t.setup([rect_sketch(), ext("e1", "s1", 20)], {"vars": {"d2": "50"}})
    span = lambda: (lambda b: b and round(b[1][0] - b[0][0], 4))(t.bbox())
    hgt = lambda: (lambda b: b and round(b[1][1] - b[0][1], 4))(t.bbox())
    dv = lambda i: next(d for d in t.sk()["dims"] if d["id"] == i)
    sdim = lambda fid, i: next(d for d in t.saved_feat(fid)["data"]["dims"] if d["id"] == i)
    t.chk("başlangıç model 80 × 50", span() == 80 and hgt() == 50, t.bbox())

    def dimlab(i):
        ix = [d["id"] for d in t.sk()["dims"]].index(i)
        return t.pg.locator(".dim").nth(ix)

    # 1) Eskizi düzenle → çift tık D1 → 100 → ✓
    t.edit_sketch("e1")
    dimlab("D1").dblclick(); time.sleep(0.3); t.prompt_val(100)
    t.pm_ok()
    t.chk("D1 100 → model 100", span() == 100, span())
    t.key("Control+z"); t.wait(0.8)
    t.chk("Ctrl+Z → model 80", span() == 80, span())
    t.key("Control+y"); t.wait(0.8)
    t.chk("Ctrl+Y → model 100", span() == 100, span())

    # 2) ondalık hassasiyet: 100/3, sonra değiştirmeden Enter
    t.edit_sketch("e1")
    dimlab("D1").dblclick(); time.sleep(0.3); t.prompt_val("100/3")
    v1 = dv("D1")["v"]
    dimlab("D1").dblclick(); time.sleep(0.3)
    shown = t.pg.locator(".dim-prompt input").input_value()
    t.pg.press(".dim-prompt input", "Enter"); time.sleep(0.3)
    v2 = dv("D1")["v"]
    t.chk("Değiştir kutusu değiştirmeden Enter: değer aynı kalır (33.3333…)", abs(v2 - v1) < 1e-9, (v1, shown, v2))
    n_undo = t.ev(f"{ED}.undoStack.length")
    # 3) inç: Dosya > Birim, ölçü 80 mm = 3,150 in → değiştirmeden Enter
    dimlab("D1").dblclick(); time.sleep(0.3); t.prompt_val(80)
    t.pg.click("#file-btn"); time.sleep(0.2); t.pg.click("#file-menu button[data-act='units']"); time.sleep(0.4)
    labs = t.pg.locator(".dim").all_inner_texts()
    t.chk("inç biriminde etiketler inç", any("3" in x and ("in" in x or "," in x or "." in x) for x in labs), labs)
    dimlab("D1").dblclick(); time.sleep(0.3)
    shown = t.pg.locator(".dim-prompt input").input_value()
    t.pg.press(".dim-prompt input", "Enter"); time.sleep(0.3)
    v3 = dv("D1")["v"]
    t.chk("inçte değiştirmeden Enter: 80 mm kalır", abs(v3 - 80) < 1e-6, (shown, v3))
    dimlab("D1").dblclick(); time.sleep(0.3); t.prompt_val(4)
    t.chk("inçte 4 yazınca 101,6 mm", abs(dv("D1")["v"] - 101.6) < 1e-6, dv("D1")["v"])
    t.pg.click("#file-btn"); time.sleep(0.2); t.pg.click("#file-menu button[data-act='units']"); time.sleep(0.4)
    dimlab("D1").dblclick(); time.sleep(0.3); t.prompt_val(80)

    # 4) Değiştir kutusu açıkken (Enter'a basmadan) PM ✓
    dimlab("D2").dblclick(); time.sleep(0.3)
    t.pg.fill(".dim-prompt input", "70"); time.sleep(0.3)
    live_h = t.ev(f"{ED}.data.pts.p4.y")
    t.pm_ok()
    left = t.pg.locator(".dim-prompt").count()
    t.note("açık kutuyla ✓: canlı y", live_h, "model yükseklik", hgt(), "kayıt D2", sdim("s1", "D2")["v"], "kutu kaldı mı", left)
    t.chk("açık Değiştir kutusu eskizden çıkınca kapanır", left == 0, left)
    t.chk("açık kutuyla ✓: model ve kayıttaki ölçü uyumlu (geometri = ölçü değeri)", abs(hgt() - sdim("s1", "D2")["v"]) < 1e-6, (hgt(), sdim("s1", "D2")["v"]))
    if left:
        t.pg.press(".dim-prompt input", "Escape"); time.sleep(0.3)
        t.note("eskiz dışında kutuda Esc sonrası model", hgt(), "mod", t.ev("window.__app.mode.k"))
    t.key("Control+z"); t.wait(0.8)
    t.note("geri al sonrası", hgt(), span())

    # 5) global değişken: Denklemler → d1 = 30 → D2 = "=d1"
    t.tab("evaluate"); t.cmd("Denklemler"); time.sleep(0.3)
    t.pg.click("dialog button:has-text('+ Değişken ekle')"); time.sleep(0.2)
    rows = t.pg.locator("dialog .eq-row")
    for i in range(rows.count()):
        if rows.nth(i).locator("input").first.input_value() == "d1":
            rows.nth(i).locator("input").nth(1).fill("30")
    t.pg.click("dialog button[value='ok']"); t.wait(0.6)
    t.tab("features")
    t.edit_sketch("e1")
    dimlab("D2").dblclick(); time.sleep(0.3); t.prompt_val("=d1")
    t.chk("=d1 ölçüsü 30 ve Σ işareti", abs(dv("D2")["v"] - 30) < 1e-9 and dv("D2").get("expr") == "d1" and any("Σ" in x for x in t.pg.locator(".dim").all_inner_texts()), (dv("D2"), t.pg.locator(".dim").all_inner_texts()))
    t.pm_ok()
    t.chk("model yüksekliği 30", hgt() == 30, hgt())
    t.tab("evaluate"); t.cmd("Denklemler"); time.sleep(0.3)
    rows = t.pg.locator("dialog .eq-row")
    for i in range(rows.count()):
        if rows.nth(i).locator("input").first.input_value() == "d1":
            rows.nth(i).locator("input").nth(1).fill("45")
    t.pg.click("dialog button[value='ok']"); t.wait(0.8)
    t.chk("Denklemler d1 = 45 → model 45", hgt() == 45, hgt())
    t.chk("kayıtta D2 = 45", abs(sdim("s1", "D2")["v"] - 45) < 1e-9, sdim("s1", "D2")["v"])
    t.key("Control+z"); t.wait(0.8)
    t.chk("Ctrl+Z → değişken 30, model 30", hgt() == 30, (hgt(), t.doc().get("vars")))
    t.key("Control+y"); t.wait(0.8)
    t.reload()
    t.chk("yenileyince model 45", hgt() == 45, hgt())

    # 6) çözülemez değişken: üçgen 30-40-=d2 ; d2 = 100
    t.tab("features")
    t.ev("d=>{}", 0)
    doc = t.doc(); doc["features"].append(tri_sketch()); t.setup(doc["features"], {"vars": doc.get("vars", {})})  # hazır model: üçgen eskizi eklendi
    t.tab("evaluate"); t.cmd("Denklemler"); time.sleep(0.3)
    rows = t.pg.locator("dialog .eq-row")
    for i in range(rows.count()):
        if rows.nth(i).locator("input").first.input_value() == "d2":
            rows.nth(i).locator("input").nth(1).fill("100")
    t.pg.click("dialog button[value='ok']"); t.wait(0.8)
    f = next(x for x in t.doc()["features"] if x["id"] == "s2")
    pa, pc = f["data"]["pts"]["a"], f["data"]["pts"]["c"]
    geo = math.hypot(pc["x"] - pa["x"], pc["y"] - pa["y"])
    e3 = next(d for d in f["data"]["dims"] if d["id"] == "E3")["v"]
    toast = t.ev("(document.querySelector('#toast')||{}).textContent")
    err_tree = t.pg.locator("#tree li.err, #tree li.warn").count()
    t.note("d2=100: ölçü", e3, "geometri", round(geo, 3), "toast", toast, "ağaç hata", err_tree, "durum", t.status())
    t.chk("çözülemez değişken değeri kullanıcıya bildirilir (hata / uyarı)", err_tree > 0 or "çöz" in (toast or "").lower() or "aşırı" in (toast or "").lower(), (toast, err_tree))
    t.edit_sketch("Üçgen")
    r = t.res()
    t.note("eskiz açılınca", r, t.status(), t.pg.locator("#pm-body .pm-xpert").count())
    t.chk("eskiz açılınca aşırı tanımlı + SketchXpert", (not r["ok"] or r["conf"]) and t.pg.locator("#pm-body .pm-xpert").count() > 0, r)
    sols = t.pg.locator("#pm-body .pm-xpert .pm-relrow").all_inner_texts()
    t.note("SketchXpert önerileri", sols)
    if sols:
        t.pg.locator("#pm-body .pm-xpert button:has-text('Uygula')").first.click(); time.sleep(0.5)
        r = t.res(); t.chk("SketchXpert Uygula → eskiz çözülür", r["ok"] and not r["conf"], r)
    t.pm_cancel("discard")
    t.close()

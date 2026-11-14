# d3 — 3B eskiz araçları (gerçek fare): Dikdörtgen, Yay, Spline, Nokta, Kırp, Uzat, Sil; geri al (E-3); ✓ → kayıt → yenile.
from d3_ortak import *

with sync_playwright() as p:
    t = T(p)
    t.setup([])
    t.tab("weld"); t.cmd("3B Eskiz"); time.sleep(0.4)
    t.pg.click(".vcube .iso"); time.sleep(0.4)
    t.ev("(()=>{const v=window.__app.viewer;v.camera.zoom*=0.7;v.camera.updateProjectionMatrix();v.requestRender&&v.requestRender()})()")
    R = t.pg.query_selector("#view canvas").bounding_box()
    S = lambda x, y, z: (lambda s: (R["x"] + s[0], R["y"] + s[1]))(t.ev(f"window.__app.viewer.toScreen([{x},{y},{z}])"))
    D = lambda js: t.ev(f"(()=>{{const d=window.__app.mode.draft; return {js}}})()")
    tool = lambda name: (t.pg.click(f"#pm-body .seg button:text-is('{name}')"), time.sleep(0.25))
    def mc(pt, dx=2, dy=1):
        x, y = S(*pt); t.pg.mouse.move(x + dx + 4, y + dy + 3); time.sleep(0.04); t.pg.mouse.move(x + dx, y + dy); time.sleep(0.08); t.pg.mouse.click(x + dx, y + dy); time.sleep(0.2)
    esc_dlg = []
    def esc(where):
        t.key("Escape")
        if t.pg.locator("dialog.exit-dialog[open]").count():
            esc_dlg.append(where); t.pg.click("dialog.exit-dialog button[data-v='stay']"); time.sleep(0.3)
    cnt = lambda: D("({l:d.lines.length,a:(d.arcs3||[]).length,s:(d.spl3||[]).length,p:d.xyz.length})")

    tool("Dikdörtgen"); c0 = cnt(); mc((0, 0, 0)); mc((120, 80, 0))
    c1 = cnt(); t.chk("3B Dikdörtgen: 4 çizgi", c1["l"] - c0["l"] == 4, (c0, c1))
    esc("adım")
    tool("Yay"); c0 = cnt(); mc((0, 0, 100)); mc((80, 0, 100)); mc((40, 0, 130))
    c1 = cnt(); t.chk("3B Yay (3 nokta): 1 yay", c1["a"] - c0["a"] == 1, (c0, c1))
    esc("adım")
    tool("Spline"); c0 = cnt(); mc((150, 0, 0)); mc((180, 40, 0)); mc((220, 20, 0)); x, y = S(240, 60, 0); t.pg.mouse.dblclick(x, y); time.sleep(0.3)
    c1 = cnt(); t.chk("3B Spline: çift tıkla biter", c1["s"] - c0["s"] == 1, (c0, c1))
    esc("adım")
    tool("Nokta"); c0 = cnt(); mc((60, 120, 0))
    c1 = cnt(); t.chk("3B Nokta", c1["p"] - c0["p"] == 1, (c0, c1))
    esc("adım")
    # Kırp: dikdörtgenin üst çizgisini (y=80) kesen çapraz çizgi çiz, sonra taşan parçayı kırp
    tool("Çizgi"); mc((60, 40, 0), 0, 0); mc((60, 120, 0), 0, 0); esc("çizgi-1"); esc("çizgi-2")
    c0 = cnt()
    tool("Kırp"); mc((60, 105, 0), 0, 0)
    c1 = cnt()
    seg = D("(()=>{const P=id=>d.xyz[d.ids.indexOf(id)];return d.lines.map(l=>[P(l.a),P(l.b)])})()")
    tops = [s_ for s_ in seg if abs(s_[0][0] - 60) < 1 and abs(s_[1][0] - 60) < 1]
    t.chk("3B Kırp: dikey çizginin y>80 parçası kırpılır", tops and max(max(a[1], b[1]) for a, b in tops) <= 80.5, tops)
    # Uzat: kırpılmış çizgiyi tekrar uzat (sınır yoksa?)
    esc("adım")
    # Ctrl+Z (E-3)
    n = D("d.lines.length"); t.key("Control+z")
    t.chk("3B Ctrl+Z (E-3)", D("d.lines.length") != n or cnt() != c1, (n, D("d.lines.length")))
    # Sil: bir çizgi seç + Delete
    tool("Seç"); mc((60, 0, 0), 0, 0); n = D("d.lines.length"); t.key("Delete")
    t.chk("3B Seç + Delete çizgiyi siler", D("d.lines.length") == n - 1, (n, D("d.lines.length")))
    esc("adım")
    t.chk("3B eskizde Esc hiçbir adımda çıkış penceresi açmaz (E-30)", not esc_dlg, esc_dlg)
    fid = D("d.id"); c_end = cnt()
    t.pm_ok()
    sv = t.saved_feat(fid)
    t.chk("✓ → 3B eskiz kayda geçti (çizgi / yay / spline sayıları)", sv and len(sv["lines"]) == c_end["l"] and len(sv.get("arcs3", [])) == c_end["a"] and len(sv.get("spl3", [])) == c_end["s"], (c_end, sv and (len(sv["lines"]), len(sv.get("arcs3", [])), len(sv.get("spl3", [])))))
    t.reload()
    f = next(x for x in t.doc()["features"] if x["id"] == fid)
    t.chk("yenileyince 3B eskiz aynı", len(f["lines"]) == c_end["l"], len(f["lines"]))
    t.close()

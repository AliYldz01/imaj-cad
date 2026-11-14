# Denetim 2 / d7 — Telefon (390×844, is_mobile, has_touch; Playwright tap = CDP dokunma, sürükleme / uzun basma CDP):
# yüzey ekstrüzyon + kalınlaştır + eskizi düzenle, yüzey kırp, sınır doldur (kenar dokunma), denklemler, yapılandırmalar,
# yüz rengi (uzun basma menüsü), klasör + geri sarma, Ne yanlış? (durum çubuğuna dokunma).
import sys
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d7h import *  # noqa


def close_tree(a):
    if a.ev("document.querySelector('#side').classList.contains('open')"):
        if a.pg.locator("#side-close").count():
            a.pg.locator("#side-close").tap(); time.sleep(0.4)


def onscreen(a, sel):
    bb = a.pg.locator(sel).first.bounding_box()
    return bool(bb) and bb["x"] >= 0 and bb["y"] >= 0 and bb["x"] + bb["width"] <= 390 and bb["y"] + bb["height"] <= 844


with sync_playwright() as p:
    a = App(p, mobile=True)
    case = lambda n, f: run_case(a, n, f)

    def p1():
        a.setup([line_sk("s1", "Yol", TOP, -30, 0, 30, 0)])
        a.cmd("Yüzey Ekstrüzyon"); a.wait(0.8)
        chk("P1 telefonda Yüzey Ekstrüzyon PM", a.mode() == "pm", a.mode())
        a.pmfield("Mesafe", 40); a.wait(0.6)
        chk("P1 ✓ dokunulabilir", onscreen(a, "#pm-ok"))
        a.ok()
        a.cmd("Kalınlaştır"); a.wait(0.6); a.pmfield("Kalınlık", 3); a.pmseg("İki taraf"); a.wait(0.6); a.ok()
        chk("P1a kalınlaştır iki taraf → 7200", near(a.vol(), 7200, 1), a.vol())
        a.tact("Yol", "Eskizi düzenle")
        a.dim_dbl(0, 80)
        if a.ev("document.querySelector('#side').classList.contains('min')"):
            a.pg.locator("#pm .sheet-min").tap(); time.sleep(0.4)
        a.ok()
        chk("P1c eskiz 60→80 (dokunarak) → 9600", near(a.vol(), 9600, 1), (a.vol(), a.mode()))
        a.undo(); u = a.vol(); a.redo()
        chk("P1d ↶ ↷", near(u, 7200, 1) and near(a.vol(), 9600, 1), (u, a.vol()))
        a.reload(); chk("P1e yenile", near(a.vol(), 9600, 1), a.vol())
    case("P1", p1)

    def p2():
        a.setup([rect_sk("s1", "Plan", TOP, -20, -15, 20, 15)])
        a.cmd("Düzlemsel Yüzey"); a.wait(0.6); a.ok()
        a.cmd("Yüzey Kırp"); a.wait(0.6); a.pmseg("Taraf 2 kalsın"); a.wait(0.6); a.ok()
        m = mesh_info(a)
        chk("P2 telefonda yüzey kırp (Sağ düzlem, taraf 2) → x ≤ 0", m and m["bb"] == [[-20, 0, -15], [0, 0, 15]], m)
        nm = [f for f in surf_feats(a) if f["type"] == "surftrim"][0]["name"]
        a.edit_feat(nm); a.pmseg("Taraf 1 kalsın"); a.wait(0.5); a.cancel("discard")
        chk("P2f ✕ değişmez", mesh_info(a)["bb"][1][0] == 0, mesh_info(a))
    case("P2", p2)

    def p3():
        a.setup([rect_sk("s1", "Kontur", TOP, -20, -15, 20, 15)])
        a.cmd("Yüzey Ekstrüzyon"); a.wait(0.6); a.pmfield("Mesafe", 20); a.wait(0.5); a.ok()
        tops = a.ev("window.__app.viewer.mesh.edges.filter(e=>Math.abs(e.m[1]-20)<1e-3).map(e=>e.m)")
        a.cmd("Sınır Doldur"); a.wait(0.6)
        for m_ in tops:
            s = a.wsc(m_); a.tap(s[0], s[1]); a.wait(0.3)
            cb = a.pg.locator(".cand-bar button").count()
            if cb:
                print("   P3 aday çubuğu:", a.ev("[...document.querySelectorAll('.cand-bar button')].map(b=>b.textContent)"))
                a.pg.locator(".cand-bar button:has-text('Kenar')").first.tap() if a.pg.locator(".cand-bar button:has-text('Kenar')").count() else None
        n = a.ev("(window.__app.mode.draft.edges||[]).length")
        chk("P3 telefonda 4 üst kenara dokunarak seçildi", n == 4, n)
        a.wait(0.8); a.ok(); a.wait(0.4)
        chk("P3 ✓ → Sınır Doldur oluşur", a.mode() == "part", (a.mode(), a.status()))
        if a.mode() == "pm":
            a.cancel("discard")
    case("P3", p3)

    def p4():
        hole = circ_sk("s2", "Delik", top_face(20), 10, 5, 5)
        a.setup(block(80, 60, 20) + [hole, ext("e2", "s2", 20, cut=True, end="through")])
        tab(a, "evaluate"); a.cmd("Denklemler"); a.wait(0.6)
        chk("P4 Denklemler penceresi ekrana sığar", onscreen(a, "dialog[open]"), a.pg.locator("dialog[open]").bounding_box())
        a.btn("dialog[open] button:has-text('+ Değişken ekle')")
        row = a.pg.locator("dialog[open] .eq-row").nth(0)
        row.locator("input").nth(0).fill("L"); row.locator("input").nth(0).press("Tab"); time.sleep(0.3)
        a.pg.locator("dialog[open] .eq-row").nth(0).locator("input").nth(1).fill("30")
        a.btn("dialog[open] form button[value='ok']"); a.wait(0.8); tab(a, "features")
        a.edit_feat("Ekstrüzyon1"); a.pmfield("Derinlik", "=L"); a.wait(0.5); a.ok()
        chk("P4 derinlik =L → 30", a.featbyname("Ekstrüzyon1")["d1"] == 30, a.featbyname("Ekstrüzyon1")["d1"])
        tab(a, "evaluate"); a.cmd("Yapılandırmalar"); a.wait(0.6)
        bb = a.pg.locator("dialog[open]").bounding_box()
        chk("P4 Yapılandırmalar penceresi ekrana sığar", onscreen(a, "dialog[open]"), bb)
        a.btn("dialog[open] button:has-text('Yapılandırma ekle')"); a.wait(0.3)
        c = a.pg.locator("dialog[open] tr:has-text('L (=') input").nth(1)
        c.tap(); c.fill("10"); c.press("Tab"); time.sleep(0.3)
        r = a.pg.locator("dialog[open] th input[type=radio]").nth(1)
        r.scroll_into_view_if_needed(); r.tap(); a.wait(0.8)
        k = a.pg.locator("dialog[open] button:has-text('Kapat')"); k.scroll_into_view_if_needed(); k.tap(); a.wait(0.6)
        tab(a, "features")
        chk("P4 Yapılandırma2 → derinlik 10", a.featbyname("Ekstrüzyon1")["d1"] == 10, a.featbyname("Ekstrüzyon1")["d1"])
    case("P4", p4)

    def p5():
        a.setup(block(80, 60, 20))
        close_tree(a)
        s = a.wsc([0, 20, 0])
        a.longpress(s[0], s[1])
        it = menu_items(a)
        chk("P5 uzun basma menüsünde 'Görünüm: yüz rengi…'", "Görünüm: yüz rengi…" in it, it)
        if "Görünüm: yüz rengi…" in it:
            menu_click(a, "Görünüm: yüz rengi"); choose_color(a, "#00ff00"); a.wait(0.8)
            chk("P5 üst yüz yeşil", (look(a) or {}).get("faces"), look(a))
        close_dialogs(a)
    case("P5", p5)

    def p6():
        hole = circ_sk("s2", "Delik", top_face(20), 10, 5, 5)
        cut = ext("e2", "s2", 20, cut=True, end="through"); cut["name"] = "Kesme1"
        a.setup(block(80, 60, 20) + [hole, cut, {"id": "fl", "type": "fillet", "name": "Radyüs1", "r": 5, "edges": [{"m": [0, 20, 30], "d": [1, 0, 0]}]}])
        a.tact("Kesme1", "Klasöre ekle…", confirm=["Detay"])
        chk("P6 klasöre ekle (telefon)", a.featbyname("Kesme1").get("folder") == "Detay", a.featbyname("Kesme1"))
        a.tact("Radyüs1", "Buraya geri sar")
        chk("P6 geri sar", "geri sarılmış" in a.status(), a.status())
        a.show_tree(); a.btn("#tree li.rollbar"); a.wait(0.6)
        chk("P6 çubuğa dokun → sona sar", a.ev("window.__app.doc.rollback") is None, a.ev("window.__app.doc.rollback"))
        close_tree(a)
        a.edit_feat("Ekstrüzyon1"); a.pmfield("Derinlik", 4); a.wait(0.5); a.ok()
        if a.pg.locator("dialog.reselect-dialog[open]").count():
            a.pg.locator("dialog.reselect-dialog[open] button:has-text('Daha sonra')").tap(); time.sleep(0.3)
        close_tree(a)
        st = a.pg.locator("#status")
        print("   P6 durum:", a.status(), "görünür:", st.is_visible())
        if st.is_visible():
            st.tap(); a.wait(0.6)
        ww = a.ev("document.querySelector('dialog.whatswrong')?.innerText||''")
        chk("P6 telefonda durum dokunuşu → Ne yanlış? Radyüs1", "Radyüs1" in ww, (a.status(), ww[:100]))
        close_dialogs(a)
    case("P6", p6)

    print("SAYFA HATALARI:", a.errs[:5])
    finish()

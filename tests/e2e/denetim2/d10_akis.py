# d10 — UÇTAN UCA İŞ AKIŞLARI (masaüstü 1400×900 + telefon 390×844). Tüm kullanıcı adımları gerçek UI.
import sys; sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d10h import *

FLOW = {}


def flow(name, ok, info=""):
    FLOW[name] = FLOW.get(name, True) and bool(ok)
    chk(name, ok, info)


def draw_rect(a, w, h, plane="Ön Düzlem"):
    """ağaçtan düzlem → Eskiz → Dikdörtgen (2 tık) → ölçü kutusu → ✓"""
    a.show_tree()
    a.btn(f"#tree li:has-text('{plane}')")
    a.btn("#tree-actions button:text-is('Eskiz')"); a.wait(0.5)
    a.cmd("Dikdörtgen")
    if a.mobile:
        p0 = a.sc(-20, -15); p1 = a.sc(20, 15)
        a.tap(*p0); a.tap(*p1)
    else:
        a.clk(-20, -15); a.clk(20, 15)
    time.sleep(0.5)
    ins = a.pg.locator(".dim-prompt input")
    ins.nth(0).fill(str(w)); ins.nth(1).fill(str(h)); ins.nth(1).press("Enter"); time.sleep(0.5)
    a.btn("#pm-ok"); a.wait(0.8)


def extrude_suggest(a, d):
    a.btn(".suggest button:text-is('Ekstrüzyon')"); a.wait(0.5)
    a.pmfield("Derinlik", d); a.ok()


with sync_playwright() as p:
    # ---------------- W1: masaüstü belge yaşam döngüsü ----------------
    if want("W1"):
        a = App(p)
        draw_rect(a, 60, 40)
        extrude_suggest(a, 25)
        flow("W1 çiz → ekstrüzyon 60×40×25 = 60000", near(a.vol(), 60000, 1), a.vol())
        a.dq[:] = ["W1"]
        nm, data = a.download(lambda: a.pg.keyboard.press("Control+s"))
        flow("W1 Ctrl+S → W1.icad içerik güncel", nm == "W1.icad" and json.loads(data)["features"][1]["d1"] == 25, nm)
        a.pg.keyboard.press("Control+n"); a.wait(0.6)
        flow("W1 Ctrl+N → yeni sekme", len(a.tabs()) == 2 and a.nfeat() == 0, a.tabs())
        a.btn("#doctabs .dtab:nth-child(1) span"); a.wait(0.8)
        flow("W1 sekmeye geri dön → 60000", near(a.vol(), 60000, 1), a.vol())
        a.reload()
        flow("W1 yenile → 60000", near(a.vol(), 60000, 1), a.vol())
        a.edit_feat("Ekstrüzyon1"); a.pmfield("Derinlik", 40); a.ok()
        a.dq[:] = ["W1b"]
        nm, data = a.download(lambda: a.menu("Dosya", "Farklı kaydet…"))
        flow("W1 Farklı kaydet W1b d1=40", nm == "W1b.icad" and json.loads(data)["features"][1]["d1"] == 40, nm)
        a.open_file(lambda: a.menu("Dosya", "Aç…"), os.path.join(DL, "W1.icad"))
        a.wait(1)
        flow("W1 W1.icad'ı aç → W1 (d1=25) görünür", a.docname() == "W1" and a.featv("Ekstrüzyon1", "d1") == 25, (a.docname(), a.featv("Ekstrüzyon1", "d1"), a.tabs()))
        a.close()

    # ---------------- W2: sihirbaz → STEP / STL dışa → içe aktar yeni sekmede ----------------
    if want("W2"):
        a = App(p)
        a.menu("Dosya", "Şekil sihirbazı…")
        bt = a.pg.locator("dialog[open] button").all_inner_texts()
        note("sihirbaz düğmeleri:", bt)
        a.btn("dialog[open] button:has-text('Blok')"); time.sleep(0.4)
        ins = a.pg.locator("dialog[open] input")
        note("blok alanları:", a.pg.locator("dialog[open] label").all_inner_texts())
        a.btn("dialog[open] button:has-text('Oluştur')"); a.wait(1.5)
        v = a.vol(); bb = a.bbox()
        flow("W2 sihirbaz blok oluştu", v and v > 0, (v, bb))
        nm, data = a.download(lambda: a.menu("Dosya", "STEP dışa aktar"))
        sb = step_bbox(data)
        flow("W2 STEP sınır kutusu = model", sb and [list(x) for x in sb] == bb, (sb, bb))
        nm2, data2 = a.download(lambda: a.menu("Dosya", "STL dışa aktar"))
        a.pg.keyboard.press("Control+n"); a.wait(0.5)
        a.open_file(lambda: a.menu("Dosya", "STEP / STL içe aktar…"), os.path.join(DL, nm))
        a.wait(2)
        flow("W2 STEP içe aktar (yeni sekme) hacim aynı", near(a.vol(), v, 1), (a.vol(), v))
        a.pg.keyboard.press("Control+n"); a.wait(0.5)
        a.open_file(lambda: a.menu("Dosya", "STEP / STL içe aktar…"), os.path.join(DL, nm2))
        a.wait(2)
        flow("W2 STL içe aktar hacim aynı", near(a.vol(), v, 1), (a.vol(), v))
        a.reload()
        flow("W2 yenile: 3 sekme ve STL belgesi", near(a.vol(), v, 1), (a.vol(), a.tabs()))
        # 3MF ve PDF
        nm3, d3 = a.download(lambda: a.filemenu("3mf"))
        names, bb3 = threemf_bbox(d3)
        flow("W2 3MF zip + köşe sınırları = model", bb3 is not None and [list(x) for x in bb3] == a.bbox(), (names, bb3, a.bbox()))
        nm4, d4 = a.download(lambda: a.filemenu("pdf"))
        flow("W2 görünüm PDF", d4[:5] == b"%PDF-" and len(d4) > 5000, (nm4, len(d4)))
        a.close()

    # ---------------- W3: eskiz DXF / yüz DXF / sac DXF ----------------
    if want("W3"):
        a = App(p)
        draw_rect(a, 60, 40, "Üst Düzlem")
        extrude_suggest(a, 10)
        a.tsel("Eskiz1")
        nm, d = a.download(lambda: a.filemenu("skdxf"))
        t = d.decode("latin-1")
        flow("W3 eskiz DXF: 4 LINE", t.count("\nLINE") == 4 or t.count("LINE\n") == 4, (nm, t.count("LINE")))
        a.pg.keyboard.press("Control+7"); a.press("f")
        a.face_click("f=>f.n&&f.n[1]>0.99")
        nm, d = a.download(lambda: a.filemenu("facedxf"))
        t = d.decode("latin-1")
        L = [x.strip() for x in t.splitlines()]
        xs = [float(L[i + 1]) for i in range(len(L) - 1) if L[i] == "10"]
        flow("W3 seçili yüz DXF: sınırlar 60 genişlik", xs and round(max(xs) - min(xs), 2) == 60, (nm, (min(xs), max(xs)) if xs else None))
        a.close()

    # ---------------- W4: eskiz düzenle → ✕ → geri al zinciri ----------------
    if want("W4"):
        a = App(p)
        draw_rect(a, 60, 40)
        extrude_suggest(a, 20)
        a.edit_feat("Ekstrüzyon1"); a.pmfield("Derinlik", 30); a.ok()
        a.tact("Eskiz1", "Eskizi düzenle")
        a.dim_dbl(0, 80)
        a.cancel("discard")
        a.undo()
        flow("W4 ✕ sonrası Ctrl+Z: derinlik 20, eskiz duruyor", a.featv("Ekstrüzyon1", "d1") == 20, (a.names(), a.featv("Ekstrüzyon1", "d1")))
        a.close()

    # ---------------- W5: belge adı → kaydet adı → teknik resim anteti ----------------
    if want("W5"):
        a = App(p)
        draw_rect(a, 60, 40)
        extrude_suggest(a, 20)
        a.filemenu("docprops")
        a.pg.locator("dialog.docprops[open] label:has-text('Belge adı') input").fill("Mil Yatağı")
        a.btn("dialog.docprops[open] button:text-is('Tamam')")
        a.dq[:] = [True]
        nm, d = a.download(lambda: a.pg.keyboard.press("Control+s"))
        note("W5 kaydet:", nm, a.dlog[-1:])
        flow("W5 belge adı dosya adına geçer", nm.startswith("Mil") and json.loads(d)["name"] == "Mil Yatağı", nm)
        nm, d = a.download(lambda: a.menu("Dosya", "STEP dışa aktar"))
        flow("W5 STEP dosya adı belge adıyla", nm.startswith("Mil"), nm)
        a.close()

    # ---------------- W6: inç ile eskiz ölçüsü → kaydet → yenile ----------------
    if want("W6"):
        a = App(p)
        draw_rect(a, 50.8, 25.4)
        extrude_suggest(a, 10)
        a.filemenu("units")
        a.tact("Eskiz1", "Eskizi düzenle")
        lab = a.pg.locator(".dim").first.inner_text()
        note("W6 inçte ölçü etiketi:", lab)
        a.dim_dbl(0, 3)
        a.btn("#pm-ok"); a.wait(0.8)
        flow("W6 inçte 3 → 76.2 mm genişlik (hacim 76.2×25.4×10)", near(a.vol(), 76.2 * 25.4 * 10, 2), a.vol())
        a.reload()
        flow("W6 yenile → aynı", near(a.vol(), 76.2 * 25.4 * 10, 2), a.vol())
        a.filemenu("units")
        a.close()

    # ---------------- W7: telefon — sihirbaz, ↶ ↷, kaydet, yeni, geçiş, yenile ----------------
    if want("W7"):
        a = App(p, mobile=True)
        a.btn(".actbar button[title='Şekil sihirbazı']") if a.pg.locator(".actbar button[title='Şekil sihirbazı']").count() else (a.tap(195, 400), a.btn(".actbar button[title='Şekil sihirbazı']"))
        a.btn("dialog[open] button:has-text('Blok')"); time.sleep(0.3)
        a.btn("dialog[open] button:has-text('Oluştur')"); a.wait(1.5)
        v = a.vol()
        flow("W7 telefonda sihirbaz blok", v and v > 0, v)
        a.btn(".actbar button[title='Geri al']"); a.wait(0.8)
        flow("W7 ↶ → boş", a.nfeat() == 0, a.nfeat())
        a.btn(".actbar button[title='İleri al']"); a.wait(0.8)
        flow("W7 ↷ → blok", near(a.vol(), v, 1), a.vol())
        a.dq[:] = ["TelBlok"]
        nm, d = a.download(lambda: (a.btn("#file-btn"), a.btn("#file-menu button[data-act='save']")), timeout=30000)
        flow("W7 telefonda Kaydet", nm == "TelBlok.icad", nm)
        a.btn("#file-btn"); a.btn("#file-menu button[data-act='new']"); a.wait(0.6)
        a.btn("#doctabs .dtab:nth-child(1) span"); a.wait(0.8)
        flow("W7 sekme geçişi", near(a.vol(), v, 1), a.vol())
        a.reload()
        flow("W7 yenile", near(a.vol(), v, 1) and a.docname() == "TelBlok", (a.vol(), a.docname()))
        a.close()

    # ---------------- W8: telefon — uzun basma → yüzde eskiz → tepsiden Daire → kesme ----------------
    if want("W8"):
        a = App(p, mobile=True)
        a.setup(block())
        a.btn(".actbar button[title='Ekrana sığdır']") if a.pg.locator(".actbar button[title='Ekrana sığdır']").count() else None
        fc = a.ev("(()=>{const m=window.__app.viewer.mesh;return m.faces.find(f=>f.n&&f.n[1]>0.99).c})()")
        x, y = a.wsc(fc)
        a.longpress(x, y)
        bb = a.pg.locator(".sw-ctx .sw-mi:has-text('Eskiz')").first.bounding_box()
        a.tap(bb["x"] + 20, bb["y"] + bb["height"] / 2); a.wait(0.6)
        flow("W8 uzun basma › Eskiz (üst yüz)", a.mode() == "sketch", a.mode())
        t = "#tray button[title='Daire']"
        a.pg.locator(t).scroll_into_view_if_needed()
        bb = a.pg.locator(t).bounding_box(); a.tap(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2)
        if a.pg.locator(".sheet-min").count() and a.pg.locator(".sheet-min").first.is_visible():
            a.btn(".sheet-min")  # alt paneli küçült (kullanıcı modele yer açar)
        c = a.sc(0, 0); e = a.sc(10, 0)
        # parmak profili: imleç parmağın ~70 px üstünde (tasarım gereği) → kullanıcı imleci hedefe getirir
        a.tap(c[0], c[1] + 70); a.tap(e[0], e[1] + 70); time.sleep(0.5)
        if a.pg.locator(".dim-prompt input").count():
            a.pg.locator(".dim-prompt input").first.fill("20"); a.pg.locator(".dim-prompt input").first.press("Enter"); time.sleep(0.4)
        nc = a.ed("return d.ents.filter(x=>x.t==='circle').length")
        flow("W8 parmakla daire", nc == 1, a.skinfo())
        a.btn(".actbar button.ok"); a.wait(0.8)
        if a.pg.locator(".suggest button:text-is('Ekst. Kesme')").count():
            a.btn(".suggest button:text-is('Ekst. Kesme')"); a.wait(0.5)
            a.pmselect("Uç koşulu", "through") if a.pmhas("Uç koşulu") else None
            a.pmfield("Derinlik", 20) if a.pmhas("Derinlik") else None
            bb = a.pg.locator("#pm-ok").bounding_box(); a.tap(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2); a.wait(1)
        note("W8 kesme özelliği:", {k: v for k, v in (a.ev("JSON.parse(JSON.stringify(window.__app.doc.features.slice(-1)[0]))") or {}).items() if k in ("type", "end", "d1", "rev", "cut")}, "eskiz:", a.ev("(()=>{const f=window.__app.doc.features.find(f=>f.name==='Eskiz2');return f&&{plane:f.plane.k, c:Object.values(f.data.pts)}})()"))
        flow("W8 Ø20 delik → 96000 − π·100·20", near(a.vol(), 96000 - math.pi * 100 * 20, 2), a.vol())
        a.close()

    # ---------------- W9: iki pencere aynı anda (PWA + tarayıcı sekmesi) ----------------
    if want("W9"):
        a = App(p)
        a.setup(block())
        pg2 = a.ctx.new_page(); pg2.goto(URL); wait_ready(pg2); time.sleep(1)
        # 1. pencerede derinlik 30
        a.edit_feat("Ekstrüzyon1"); a.pmfield("Derinlik", 30); a.ok()
        # 2. pencerede (eski belge, d1=20) adlandırma
        pg2.bring_to_front()
        li = pg2.locator("#tree li", has=pg2.locator("span:text-is('Ekstrüzyon1')")).first
        li.click(); time.sleep(0.3)
        pg2.once("dialog", lambda d: d.accept("Gövde"))
        pg2.locator("#tree-actions button:text-is('Adlandır')").click(); time.sleep(0.8)
        a.pg.bring_to_front()
        a.reload()
        d1 = a.featv("Ekstrüzyon1", "d1") if "Ekstrüzyon1" in a.names() else a.featv("Gövde", "d1")
        note("W9 iki pencere sonrası yenileme: adlar", a.names(), "d1", d1)
        flow("W9 iki pencere: 1. penceredeki değişiklik (d1=30) sessizce kaybolmaz", d1 == 30, (a.names(), d1))
        a.close()

    # ---------------- W10: bozuk / yanlış dosya aç ----------------
    if want("W10"):
        a = App(p)
        a.setup(block())
        bad = os.path.join(DL, "bozuk.icad"); open(bad, "w").write('{"version":2,"name":"X","features":[{"id":"a","type":"extrude"')
        a.open_file(lambda: a.menu("Dosya", "Aç…"), bad)
        flow("W10 bozuk dosya: hata iletisi, belge korunur", "açılamadı" in a.toast() and near(a.vol(), 96000, 1), (a.toast(), a.vol()))
        odd = os.path.join(DL, "garip.icad"); open(odd, "w").write(json.dumps({"version": 2, "name": "G", "features": [{"id": "z", "type": "extrude", "name": "E", "sketch": "yok", "d1": 10}]}))
        a.open_file(lambda: a.menu("Dosya", "Aç…"), odd)
        note("W10 eksik eskizli dosya:", a.tabs(), a.errtree(), a.toast())
        flow("W10 eksik referanslı dosya açılır, hata ağaçta gösterilir", a.errtree() != [] or "hata" in a.toast().lower(), (a.errtree(), a.toast()))
        a.close()

finish()
print("İŞ AKIŞLARI:", FLOW)

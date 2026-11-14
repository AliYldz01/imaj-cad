# Denetim 2 / d7 — çok adımlı iş akışları (masaüstü). Telefon akışları d7_mobil.py (P1, P4, P6).
# Hazır model: yalnız eskizler / taban blok. Adımlar gerçek tıklama / klavye.
import sys, re
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d7h import *  # noqa

FR = lambda a1, a2, h: h / 3 * (a1 + a2 + math.sqrt(a1 * a2))

with sync_playwright() as p:
    a = App(p, nosfp=True)
    case = lambda n, f: run_case(a, n, f)

    def later():
        if a.pg.locator("dialog.reselect-dialog[open]").count():
            a.btn("dialog.reselect-dialog[open] button:has-text('Daha sonra')")

    # A1: kapalı yüzey loft + iki kapak + dik (katı) → kutu üstüne kubbe → profil ölçüsü değiştir → kaydet / indir / yenile → malzeme
    def a1():
        a.setup([rect_sk("q1", "Alt", TOP, -20, -20, 20, 20), refplane("pl1", "Düzlem1", TOP, 30),
                 rect_sk("q2", "Ust", {"k": "ref", "id": "pl1"}, -10, -10, 10, 10)])
        a.cmd("Yüzey Loft"); a.wait(0.5); a.pmcheck("Alt"); a.pmcheck("Ust"); a.wait(0.6); a.ok()
        a.cmd("Düzlemsel Yüzey"); a.wait(0.4); a.pmselect("Eskiz", "q1"); a.ok()
        a.cmd("Düzlemsel Yüzey"); a.wait(0.4); a.pmselect("Eskiz", "q2"); a.ok()
        a.cmd("Yüzey Dik"); a.wait(0.4); a.pmcheck("Kapalıysa katı oluştur"); a.wait(0.6); a.ok()
        chk("A1 dik → 28000", near(a.vol(), FR(1600, 400, 30), 2), a.vol())
        a.cmd("Kubbe"); a.wait(0.4); a.face_click("f=>f.n&&f.n[1]>0.99"); a.pmfield("Yükseklik", 5); a.wait(0.5); a.ok()
        vk = a.vol()
        chk("A1 kubbe dikilmiş katının üst yüzünde → y max 35", near(a.bbox()[1][1], 35, .05) and vk > 28000, (vk, a.bbox(), a.errs_map()))
        a.tact("Ust", "Eskizi düzenle"); a.dim_dbl(0, 30); a.ok(); later()
        e = a.errs_map(); v2 = a.vol()
        print("   A1 üst 20→30 genişlik:", v2, a.bbox(), e)
        chk("A1 üst profil değişince zincir + kubbe yeniden kuruldu", not e and v2 > vk, (v2, e))
        with a.pg.expect_download(timeout=20000) as dl:
            a.blur(); a.pg.keyboard.press("Control+s")
        txt = open(dl.value.path(), encoding="utf-8").read()
        js = json.loads(txt)
        q2 = [f for f in js["features"] if f["id"] == "q2"][0]["data"]["dims"][0]["v"]
        chk("A1 Ctrl+S indirilen dosya güncel (Ust 30, dik + kubbe var)", q2 == 30 and any(f["type"] == "knit" for f in js["features"]) and any(f["type"] == "dome" for f in js["features"]), q2)
        a.reload(); chk("A1 yenile", near(a.vol(), v2, 1), a.vol())
    case("A1", a1)

    # A2: blok + eğik yüzeyle kes + yüz rengi + değişken ile kesen yükseklik
    def a2():
        cl = line_sk("s2", "Kesen", FRONT, -60, 10, 60, 10)
        cl["data"]["dims"].append({"id": "D2", "t": "dist", "refs": ["O", "p1"], "v": 10, "sub": "v", "lp": [-70, 5]})
        a.setup(block(80, 80, 30) + [cl], {"vars": {"H": "10"}})
        a.tact("Kesen", "Eskizi düzenle"); a.dim_dbl(1, "=H"); a.ok()
        a.cmd("Yüzey Ekstrüzyon"); a.wait(0.4); a.pmselect("Eskiz", "s2"); a.pmfield("Mesafe", 100); a.pmcheck("Orta düzlem"); a.wait(0.4); a.ok()
        a.cmd("Yüzeyle Kes"); a.wait(0.4); seg_click(a, "Taraf 2'yi kaldır"); a.wait(0.5); a.ok()
        chk("A2 kesim sonrası (alt 10 mm kaldırıldı) 80·80·20", near(a.vol(), 128000, 2), a.vol())
        tab(a, "evaluate"); a.cmd("Denklemler"); a.wait(0.4)
        a.pg.locator("dialog[open] .eq-row input").nth(1).fill("20")
        a.btn("dialog[open] form button[value='ok']"); a.wait(0.8); tab(a, "features")
        chk("A2 H 10→20 → kesen yüzey + kesme izler 64000", near(a.vol(), 64000, 2), (a.vol(), a.errs_map()))
        a.undo(); chk("A2 geri al → 128000", near(a.vol(), 128000, 2), a.vol())
    case("A2", a2)

    # A3: kabuk + dudak + yapılandırma (dudaksız) + geçiş + yenile
    def a3():
        box = [rect_sk("s1", "Eskiz1", TOP, -30, -20, 30, 20), ext("e1", "s1", 30), {"id": "sh", "type": "shell", "name": "Kabuk1", "t": 2, "faces": [{"c": [0, 30, 0], "n": [0, 1, 0]}]}]
        box[1]["name"] = "Ekstrüzyon1"
        a.setup(box); vs = a.vol()
        a.cmd("Dudak / Yiv"); a.wait(0.4); a.wclick([29, 30, 0]); a.wait(0.5); a.ok()
        vl = a.vol(); print("   A3 dudak:", vl - vs, a.names()); lid = a.ev("window.__app.doc.features.at(-1).id")
        tab(a, "evaluate"); a.cmd("Yapılandırmalar"); a.wait(0.4)
        a.btn("dialog[open] button:has-text('Yapılandırma ekle')"); a.wait(0.3)
        a.pg.locator("dialog[open] tr:has-text('Dudak-Yiv1') input[type=checkbox]").nth(1).check(); a.wait(0.3)
        a.pg.locator("dialog[open] th input[type=radio]").nth(1).check(); a.wait(0.8)
        a.btn("dialog[open] button:has-text('Kapat')"); a.wait(0.5); tab(a, "features")
        chk("A3 Yapılandırma2 dudaksız → kabuk hacmi", near(a.vol(), vs, 1), (a.vol(), vs))
        a.reload(); chk("A3 yenile → hâlâ dudaksız", near(a.vol(), vs, 1), a.vol())
        tab(a, "evaluate"); a.cmd("Yapılandırmalar"); a.wait(0.4)
        a.pg.locator("dialog[open] th input[type=radio]").nth(0).check(); a.wait(0.8)
        a.btn("dialog[open] button:has-text('Kapat')"); a.wait(0.5); tab(a, "features")
        chk("A3 Varsayılan → dudaklı", near(a.vol(), vl, 1), (a.vol(), vl))
    case("A3", a3)

    # A4: düzlemsel yüzey + kırp + kalınlaştır, klasör, geri sar → yeni yüzey özelliği → sona sar
    def a4():
        a.setup([rect_sk("s1", "Plan", TOP, -20, -15, 20, 15)])
        a.cmd("Düzlemsel Yüzey"); a.wait(0.4); a.ok()
        a.cmd("Yüzey Kırp"); a.wait(0.4); a.ok()
        a.cmd("Kalınlaştır"); a.wait(0.4); a.pmfield("Kalınlık", 2); a.wait(0.5); a.ok()
        chk("A4 kırp + kalınlaştır 1200", near(a.vol(), 1200, 1), a.vol())
        names = a.names()
        a.tact(names[2], "Klasöre ekle…", confirm=["Yuzey"])
        a.tact(names[3], "Klasöre ekle…", confirm=["Yuzey"])
        a.tact(names[3], "Buraya geri sar")
        chk("A4 kalınlaştırmaya geri sar → yalnız yüzey (hacim 0)", (a.vol() or 0) == 0 and "geri sarılmış" in a.status(), (a.vol(), a.status()))
        a.btn("#tree li.rollbar"); a.wait(0.6)
        chk("A4 sona sar → 1200", near(a.vol(), 1200, 1), a.vol())
        a.reload(); chk("A4 yenile", near(a.vol(), 1200, 1) and a.ev("window.__app.doc.features.filter(f=>f.folder==='Yuzey').length") == 2, a.vol())
    case("A4", a4)

    # A5: blok + yüz taşı + mandal → hata (derinlik) → Ne yanlış → düzelt
    def a5():
        a.setup(block(80, 60, 20))
        a.cmd("Yüz Taşı / Sil"); a.wait(0.4); a.face_click("f=>f.n&&f.n[1]>0.99"); a.pmfield("Mesafe", 5); a.wait(0.5); a.ok()
        a.cmd("Mandal"); a.wait(0.4); a.wclick([10, 25, 5]); a.wait(0.5); a.ok()
        v = a.vol(); bb = a.bbox()
        print("   A5 yüz taşı + mandal:", v, bb, a.featbyname(a.names()[-1]).get("p"))
        chk("A5 mandal taşınmış üst yüzde (y 25 + 15 = 40)", near(bb[1][1], 40, .1), bb)
        a.edit_feat("Ekstrüzyon1"); a.pmfield("Derinlik", 10); a.wait(0.5); a.ok(); later()
        bb2 = a.bbox()
        print("   A5 taban 20→10:", a.vol(), bb2, a.errs_map())
        chk("A5 taban 10 → yüz taşı izler (y 15), mandal y 30", near(bb2[1][1], 30, .1), bb2)
    case("A5", a5)

    # A6: kubbe yüksekliği değişkenle (=H) → H değişince
    def a6():
        a.setup(block(80, 60, 20), {"vars": {"H": "6"}})
        a.cmd("Kubbe"); a.wait(0.4); a.face_click("f=>f.n&&f.n[1]>0.99"); a.pmfield("Yükseklik", "=H"); a.wait(0.5); a.ok()
        chk("A6 kubbe =H → y max 26", near(a.bbox()[1][1], 26, .05), a.bbox())
        tab(a, "evaluate"); a.cmd("Denklemler"); a.wait(0.4)
        a.pg.locator("dialog[open] .eq-row input").nth(1).fill("12")
        a.btn("dialog[open] form button[value='ok']"); a.wait(0.8); tab(a, "features")
        chk("A6 H 12 → y max 32", near(a.bbox()[1][1], 32, .05), a.bbox())
        a.reload(); chk("A6 yenile", near(a.bbox()[1][1], 32, .05), a.bbox())
    case("A6", a6)

    # A7: açık yollu yüzey + kalınlaştır + yüz rengi + malzeme → kütle
    def a7():
        a.setup([line_sk("s1", "Yol", TOP, -30, 0, 30, 0)])
        a.cmd("Yüzey Ekstrüzyon"); a.wait(0.4); a.pmfield("Mesafe", 50); a.wait(0.4); a.ok()
        a.cmd("Kalınlaştır"); a.wait(0.4); a.pmfield("Kalınlık", 4); a.wait(0.5); a.ok()
        tab(a, "evaluate"); a.cmd("Malzeme"); a.wait(0.4)
        a.pg.locator("dialog[open] label:has-text('lüminyum') input").first.check(); a.btn("dialog[open] button[value='ok']"); a.wait(0.5)
        a.cmd("Kütle Özell."); a.wait(0.6)
        t = a.ev("document.querySelector('dialog[open]').innerText")
        a.btn("dialog[open] button[value='ok']"); tab(a, "features")
        m = re.search(r"Kütle: ([\d.,]+) g", t)
        g = float(m.group(1).replace(".", "").replace(",", ".")) if m else None
        chk("A7 60·50·4 = 12000 mm³ alüminyum → 32,4 g", g and near(g, 32.4, 0.1), t[:150])
    case("A7", a7)

    print("SAYFA HATALARI:", a.errs[:5])
    finish()

# Denetim 2 / d4 — Ekstrüzyon: referanslı uç / başlangıç koşulları (sonrakine, yüzeye, ötele, köşeye, gövdeye,
# başla yüz / köşe, ekstrüzyon yönü kenarı), referansın model değişince izlenmesi, bitiş koşulu penceresi, Instant3D
# Hazır model: B bloğu (Düzlem1 = Üst + 30, 80×60×10 → y 30..40) ve Üst düzlemde Ø20 daire eskizi (Eskiz3).
import sys
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d4h import *  # noqa

B = 48000.0
CYL = lambda h: PI * 100 * h


def setupR(a, extra=()):
    feats = [refplane("pl1", "Düzlem1", TOP, 30), rect_sk("s2", "Eskiz2", {"k": "ref", "id": "pl1"}, -40, -30, 40, 30)]
    e = ext("e2", "s2", 10); e["name"] = "Blok"
    feats += [e, circ_sk("s3", "Eskiz3", TOP, 0, 0, 10)] + list(extra)
    a.setup(feats)


def new_ext(a, sk="Eskiz3"):
    a.tsel(sk); a.cmd("Ekstrüzyon"); a.wait(0.8)


def click_face_pt(a, w):
    a.wclick(w); a.wait(0.8)


import os
ONLY = os.environ.get('ONLY')


def case(name, fn):
    if ONLY and name not in ONLY.split(","):
        return
    try:
        fn()
    except Exception as ex:
        chk(name + " (istisna)", False, str(ex)[:300])
        print("   açık pencereler:", a.ev("[...document.querySelectorAll('dialog[open]')].map(d=>d.className+':'+d.textContent.slice(0,80))"))
        try:
            a.pg.keyboard.press("Escape"); time.sleep(0.3)
            if a.mode() in ("pm", "sketch"): a.cancel("discard")
        except Exception:
            pass


with sync_playwright() as p:
    a = App(p)

    def r1():
        setupR(a); new_ext(a)
        a.pmselect("Uç koşulu", "next"); a.wait(1.2); a.ok()
        chk("R1a sonrakine kadar → silindir 0..30 + blok = 57424.78", near(a.vol(), B + CYL(30), 1), a.vol())
        a.edit_feat("Blok"); a.pmselect("Başla", "off"); a.pmfield("Başlangıç ötelemesi", 10); a.ok()
        print("   R1 blok y 40..50 sonrası:", a.vol(), a.bbox(), a.errtree())
        chk("R1c blok yukarı taşınınca sonrakine kadar uyar (0..40)", near(a.vol(), B + CYL(40), 1), a.vol())
    case("R1", r1)

    def r2():
        setupR(a); new_ext(a)
        a.pmselect("Uç koşulu", "surface"); a.wait(0.3)
        a.pmcheck("Sonucu birleştir", False)
        click_face_pt(a, [25, 40, 15])
        chk("R2a hedef yüz seçildi yazısı", "Hedef yüz seçili" in a.pmtext(), a.pmtext()[:200])
        a.ok()
        chk("R2a yüzeye kadar (blok üst y=40) → ayrı gövde h=40", near(a.vol(), B + CYL(40), 1) and a.bodies() == 2, (a.vol(), a.bodies()))
        # c) hedef yüz model değişince: blok derinliği 10 → 20 (üst yüz y=50)
        a.edit_feat("Blok"); a.pmfield("Derinlik", 20); a.ok()
        print("   R2c blok 20 sonrası:", a.vol(), a.errtree(), a.status())
        chk("R2c hedef yüz taşınınca özellik izler (h=50)", near(a.vol(), 2 * B + CYL(50), 1), a.vol())
        a.undo()
        chk("R2d geri al → h=40", near(a.vol(), B + CYL(40), 1), a.vol())
        # düzlem ötelemesi 30 → 50 (blok y 50..60)
        a.edit_feat("Düzlem1"); a.pmfield("Mesafe", 50); a.ok()
        print("   R2c düzlem 50 sonrası:", a.vol(), a.errtree(), a.status())
        chk("R2c düzlem taşınınca yüzeye kadar izler (h=60)", near(a.vol(), B + CYL(60), 1), a.vol())
        a.reload()
        chk("R2e yenile sonrası aynı", near(a.vol(), B + CYL(60), 1), a.vol())
    case("R2", r2)

    def r3():
        setupR(a); new_ext(a)
        a.pmselect("Uç koşulu", "offset"); a.wait(0.3)
        a.pmcheck("Sonucu birleştir", False)
        click_face_pt(a, [25, 40, 15])
        a.pmfield("Öteleme mesafesi", 5); a.wait(1.0); a.ok()
        chk("R3a yüzeyden ötele 5 (üst yüz y=40) → h=35", near(a.vol(), B + CYL(35), 1), a.vol())
        a.edit_feat("Ekstrüzyon1"); a.pmfield("Öteleme mesafesi", -5); a.ok()
        chk("R3b öteleme -5 → h=45 (ters öteleme)", near(a.vol(), B + CYL(45), 1), (a.vol(), a.errtree()))
    case("R3", r3)

    def r4():
        setupR(a); new_ext(a)
        a.pmselect("Uç koşulu", "vertex"); a.wait(0.3)
        a.pmcheck("Sonucu birleştir", False)
        a.pmbtn("Hedef köşe"); a.wait(0.3)
        w = edge_near_vertex(a, [40, 40, 30])
        a.wclick(w); a.wait(1.0)
        chk("R4a köşe seçildi ✓ işareti", "Hedef köşe ✓" in a.pmtext(), a.pmtext()[:300])
        a.ok()
        chk("R4a köşeye kadar (y=40) → h=40", near(a.vol(), B + CYL(40), 1), (a.vol(), a.feat(a.featbyname('Ekstrüzyon1')['id']).get('vtx')))
        a.edit_feat("Blok"); a.pmfield("Derinlik", 20); a.ok()
        print("   R4c blok 20 sonrası köşeye kadar:", a.vol(), "(P-9: vtx statik — beklenen h=50)")
    case("R4", r4)

    def r5():
        setupR(a); new_ext(a)
        a.pmselect("Uç koşulu", "body"); a.wait(0.3)
        a.pmcheck("Sonucu birleştir", False)
        a.pmbtn("Hedef gövde"); a.wait(0.3)
        click_face_pt(a, [25, 40, 15])
        chk("R5a gövde seçildi ✓", "Hedef gövde ✓" in a.pmtext(), a.pmtext()[:300])
        a.ok()
        chk("R5a gövdeye kadar → h=30", near(a.vol(), B + CYL(30), 1), a.vol())
        a.edit_feat("Blok"); a.pmselect("Başla", "off"); a.pmfield("Başlangıç ötelemesi", 10); a.ok()
        print("   R5c blok 40..50 sonrası:", a.vol(), a.errtree())
        chk("R5c gövde taşınınca izler (h=40)", near(a.vol(), B + CYL(40), 1), (a.vol(), a.errtree()))
    case("R5", r5)

    def r6():
        setupR(a); new_ext(a)
        a.pmselect("Başla", "face"); a.wait(0.3)
        click_face_pt(a, [25, 40, 15])
        chk("R6a başlangıç yüzü ✓", "Başlangıç yüzü ✓" in a.pmtext(), a.pmtext()[:300])
        a.pmfield("Derinlik", 10); a.wait(1.0); a.ok()
        chk("R6a başla: blok üst yüzü, kör 10 → y 40..50 birleşik", near(a.vol(), B + CYL(10), 1) and a.bbox()[1][1] == 50, (a.vol(), a.bbox()))
        a.edit_feat("Blok"); a.pmfield("Derinlik", 20); a.ok()
        print("   R6c blok 20 sonrası:", a.vol(), a.bbox(), a.errtree())
        chk("R6c başlangıç yüzü izler (y 50..60)", a.bbox()[1][1] == 60 and near(a.vol(), 2 * B + CYL(10), 1), (a.vol(), a.bbox()))
        a.reload()
        chk("R6e yenile", a.bbox()[1][1] == 60, a.bbox())
    case("R6", r6)

    def r7():
        setupR(a); new_ext(a)
        a.pmselect("Başla", "vtx"); a.wait(0.3)
        w = edge_near_vertex(a, [40, 40, 30])
        a.wclick(w); a.wait(1.0)
        chk("R7a başlangıç köşesi ✓", "Başlangıç köşesi ✓" in a.pmtext(), a.pmtext()[:300])
        a.pmfield("Derinlik", 10); a.wait(1.0); a.ok()
        chk("R7a başla köşe y=40, kör 10 → y 40..50", a.bbox()[1][1] == 50 and near(a.vol(), B + CYL(10), 1), (a.vol(), a.bbox()))
    case("R7", r7)

    def r8():
        # eğik kenarlı paralelkenar blok (Ön düzlem, x 100..140)
        par = sketch("s5", "Eskiz5", FRONT, lambda pt, line, rect, c, t: (lambda A, Bp, C, D: (line(A, Bp), line(Bp, C), line(C, D), line(D, A)))(pt(100, 0), pt(120, 0), pt(140, 20), pt(120, 20)))
        e5 = ext("e5", "s5", 10); e5["name"] = "Paralel"
        setupR(a, [par, e5])
        v0 = a.vol()
        new_ext(a)
        a.pmcheck("Sonucu birleştir", False)
        a.pmbtn("Ekstrüzyon yönü"); a.wait(0.3)
        a.wclick([130, 10, 10]); a.wait(1.2)   # eğik kenar orta noktası (z=10 ön yüz)
        dv = a.ev("window.__app.mode.draft && window.__app.mode.draft.dirVec")
        a.ok()
        bb = a.bbox()
        print("   R8 yön vektörü:", dv, "hacim", a.vol(), "beklenen", round(v0 + CYL(20), 2), a.errtree())
        chk("R8a eğik yön: hacim = taban × normal yükseklik (20)", near(a.vol(), v0 + CYL(20), 2), a.vol())
    case("R8", r8)

    # ---------------- bitiş koşulunu değiştir penceresi (sağ tık) ----------------
    def r9():
        a.setup(block())
        a.wait(0.5)
        s = a.wsc([20, 20, 10])
        a.pg.mouse.click(s[0], s[1], button="right"); time.sleep(0.6)
        it = a.pg.locator("text=Bitiş koşulunu değiştir…")
        chk("R9 sağ tık menüsünde 'Bitiş koşulunu değiştir…'", it.count() > 0)
        it.first.click(); time.sleep(0.8)
        dl = a.pg.locator("dialog.endcond[open]")
        chk("R9 pencere açıldı", dl.count() == 1)
        a.btn("dialog.endcond button:has-text('Orta düzlem')"); a.wait(0.8)
        chk("R9 orta düzlem → y -10..10", a.bbox()[0][1] == -10, a.bbox())
        s = a.wsc([20, 10, 10]); a.pg.mouse.click(s[0], s[1], button="right"); time.sleep(0.6)
        a.pg.locator("text=Bitiş koşulunu değiştir…").first.click(); time.sleep(0.8)
        a.pg.locator("dialog.endcond input").first.fill("30"); a.btn("dialog.endcond button:has-text('Derinliği uygula')"); a.wait(0.8)
        chk("R9 derinlik 30 → y -15..15", a.bbox()[0][1] == -15 and a.bbox()[1][1] == 15, a.bbox())
        a.undo()
        chk("R9 geri al → y -10..10", a.bbox()[0][1] == -10, a.bbox())
        a.undo()
        chk("R9 geri al ×2 → kör y 0..20", a.bbox()[0][1] == 0, a.bbox())
    case("R9", r9)

    # ---------------- Instant3D (PM'de ve parça modunda) ----------------
    def r10():
        a.setup([rect_sk("s1", "Eskiz1", TOP, -40, -30, 40, 30)])
        a.tsel("Eskiz1"); a.cmd("Ekstrüzyon"); a.wait(1.0)
        hd = a.pg.locator(".i3d .i3d-ar")
        print("   i3d:", hd.bounding_box(), a.ev("(()=>{const e=document.querySelector('.i3d');return [e.hidden,e.style.left,e.style.top]})()"))
        vis = not a.ev("document.querySelector('.i3d').hidden") and hd.bounding_box() and hd.bounding_box()["width"] > 0
        chk("R10 PM'de Instant3D oku görünür", vis)
        if vis:
            bb = hd.bounding_box(); x, y = bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2
            a.drag((x, y), (x, y - 60), steps=12); a.wait(1.2)
            d1 = a.ev("window.__app.mode.draft.d1")
            fld = a.pg.locator("#pm-body label.pm-field:has-text('Derinlik') input").first.input_value()
            pv = a.vol()
            a.ok()
            chk("R10 ok sürükle → derinlik > 20, alan = taslak = model", d1 > 20 and abs(float(fld.replace(',', '.')) - d1) < 1e-6 and near(a.vol(), 4800 * d1, 1), (d1, fld, pv, a.vol()))
            # parça modunda: seçili ekstrüzyon → ok sürükle → geri al
            a.tsel("Ekstrüzyon1"); a.wait(0.5)
            if hd.bounding_box() and hd.bounding_box()["width"] > 0 and not a.ev("document.querySelector('.i3d').hidden"):
                bb = hd.bounding_box(); x, y = bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2
                v0 = a.vol()
                a.drag((x, y), (x, y + 40), steps=10); a.wait(1.2)
                v1 = a.vol()
                a.undo()
                chk("R10 parça modunda ok → model değişir, geri al → eski", v1 != v0 and near(a.vol(), v0, 1), (v0, v1, a.vol()))
            else:
                chk("R10 parça modunda seçili ekstrüzyonda ok görünür", False)
    case("R10", r10)

    print("hatalar:", a.errs)
    a.close()
finish()

# Denetim 2 / d4 — Ek av: seçenek birleşimleri (ince + uçları kapat + başla yüz, seçili konturlar + ince, ondalık virgül,
# eskiz değiştirince bölge seçimi, büküm + orta düzlem). Gerçek tık / klavye; hazır eskizler setDoc.
import sys, os
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d4h import *  # noqa
ONLY = os.environ.get('ONLY')


def case(name, fn):
    if ONLY and name not in ONLY.split(","):
        return
    try:
        fn()
    except Exception as ex:
        chk(name + " (istisna)", False, str(ex)[:300])
        try:
            a.pg.keyboard.press("Escape"); time.sleep(0.3)
            if a.mode() in ("pm", "sketch"): a.cancel("discard")
        except Exception:
            pass


def new_ext(a, sk, cmd="Ekstrüzyon"):
    a.tsel(sk); a.cmd(cmd); a.wait(0.9)


with sync_playwright() as p:
    a = App(p)

    def x1():
        # 80×60×20 blok; Üst düzlemde 40×40 eskiz; ince (ters = içe, 2) + uçları kapat 2, Başla: blok üst yüzü, kör 20
        a.setup(block(ename="Blok") + [rect_sk("s2", "Eskiz2", TOP, -20, -20, 20, 20)])
        new_ext(a, "Eskiz2")
        a.pmselect("Başla", "face"); a.wait(0.3)
        a.wclick([30, 20, 20]); a.wait(0.8)
        a.pmcheck("Sonucu birleştir", False)
        a.pmcheck("İnce özellik (açık"); a.pmseg("Ters yön"); a.pmcheck("Uçları kapat"); a.wait(1.5)
        a.ok()
        bb = a.bbox()
        V = 40 * 40 * 20 - 36 * 36 * 16
        print("   X1 kapaklı ince + başla yüz:", a.vol(), "beklenen", 96000 + V, "kutu", bb, "gövde", a.bodies(), a.errs_map())
        chk("X1 uçları kapat + Başla: yüz → içi boş kutu y 20..40 (kapaklar da yüzden)", near(a.vol(), 96000 + V, 1) and bb[1][1] == 40, (a.vol(), 96000 + V, bb))
    case("X1", x1)

    def x2():
        a.setup([rect_sk("s1", "Eskiz1", TOP, -40, -30, 40, 30)])
        new_ext(a, "Eskiz1")
        a.pmcheck("İnce özellik (açık"); a.pmseg("Ters yön"); a.pmcheck("Uçları kapat"); a.pmcheck("Yönü ters çevir"); a.wait(1.5)
        a.ok()
        bb = a.bbox()
        chk("X2 uçları kapat + yönü ters → y -20..0, 96000−76·56·16", near(a.vol(), 96000 - 76 * 56 * 16, 1) and bb[0][1] == -20, (a.vol(), bb, a.errs_map()))
        nm = a.names()[-1]
        a.edit_feat(nm); a.pmselect("Başla", "off"); a.pmfield("Başlangıç ötelemesi", 10); a.ok()
        bb = a.bbox()
        chk("X2 + başlangıç ötelemesi 10 → kapaklar da ötelenir (y -10..10)", bb[0][1] == -10 and bb[1][1] == 10 and near(a.vol(), 96000 - 76 * 56 * 16, 1), (a.vol(), bb))
    case("X2", x2)

    def x3():
        a.setup([rect_sk("s1", "Eskiz1", TOP, -40, -30, 40, 30)])
        new_ext(a, "Eskiz1")
        a.pmfield("Derinlik", "12,5"); a.wait(1.2)
        bad = a.pg.locator("#pm-body label.pm-field:has-text('Derinlik') input.bad").count()
        a.ok()
        print("   X3 '12,5' →", a.vol(), "bad sınıfı", bad)
        chk("X3 ondalık virgül 12,5 kabul edilir (60000)", near(a.vol(), 60000, 1), a.vol())
        a.edit_feat(a.names()[-1]); a.pmfield("Derinlik", "100/4"); a.ok()
        chk("X3 işlem 100/4 → 25", near(a.vol(), 120000, 1), a.vol())
    case("X3", x3)

    def x8():
        sk = sketch("s1", "Eskiz1", TOP, lambda pt, line, rect, c, t: (rect(-40, -20, -10, 20), rect(10, -20, 40, 20)))
        a.setup([sk]); new_ext(a, "Eskiz1")
        a.pmcheck("Bölge 2"); a.wait(0.8); v1 = a.vol(); b1 = a.bbox()
        a.pmcheck("İnce özellik (açık"); a.wait(1.5); v2 = a.vol(); b2 = a.bbox()
        st = a.status()
        a.cancel("discard")
        one = (34 * 44 - 30 * 40) * 20
        print("   X8 seçili kontur (Bölge 2) + ince:", v1, b1, "→", v2, b2, st)
        chk("X8 seçili kontur + ince → yalnız Bölge 2'nin ince duvarı (5440, x 10..44 ya da 12..38)", near(v2, one, 1) or near(v2, (30 * 40 - 26 * 36) * 20, 1), (v2, b2, st))
    case("X8", x8)

    def x9():
        sk = sketch("s1", "Eskiz1", TOP, lambda pt, line, rect, c, t: (rect(-40, -20, -10, 20), rect(10, -20, 40, 20)))
        a.setup([sk, rect_sk("s2", "Eskiz2", TOP, -5, -5, 5, 5)]); new_ext(a, "Eskiz1")
        a.pmcheck("Bölge 2"); a.wait(0.8); a.ok()
        nm = a.names()[-1]
        a.edit_feat(nm); a.pmselect("Eskiz", "s2"); a.wait(1.5)
        txt = a.pmtext(); st = a.status(); v = a.vol()
        a.ok()
        print("   X9 eskiz değiştirilince (eski bölge seçimi 2):", v, st, a.errs_map(), "| PM:", "tek bölge" in txt)
        chk("X9 eskizi değiştirince eski bölge seçimi temizlenir → 10×10×20 = 2000", near(a.vol(), 2000, 1), (a.vol(), a.errs_map(), st))
    case("X9", x9)

    def x5():
        a.setup([rect_sk("s1", "Eskiz1", TOP, -40, -30, 40, 30)])
        new_ext(a, "Eskiz1")
        a.pmselect("Uç koşulu", "mid"); a.pmfield("Büküm açısı", 45); a.wait(1.5); a.ok()
        bb = a.bbox()
        chk("X5 büküm + orta düzlem → y -10..10, hacim 96000", bb[0][1] == -10 and near(a.vol(), 96000, 480), (a.vol(), bb, a.errs_map()))
    case("X5", x5)

    def x6():
        # ince özellik + Yön 2
        a.setup([rect_sk("s1", "Eskiz1", TOP, -40, -30, 40, 30)])
        new_ext(a, "Eskiz1")
        a.pmcheck("İnce özellik (açık"); a.pmseg("Ters yön")
        a.pmcheck("İkinci yönü kullan"); a.wait(0.3)
        loc = a.pg.locator("#pm-body label.pm-field:has-text('Derinlik') input"); loc.nth(1).fill("10"); loc.nth(1).press("Tab"); a.wait(1.5)
        a.ok()
        chk("X6 ince + Yön 2 → (4800−4256)·30", near(a.vol(), 544 * 30, 1), (a.vol(), a.errs_map()))
    case("X6", x6)

    def x7():
        # koniklik + yüzeye kadar: hedef yüz (blok altında 30 mm yukarıda)
        feats = [refplane("pl1", "Düzlem1", TOP, 30), rect_sk("s2", "Eskiz2", {"k": "ref", "id": "pl1"}, -40, -30, 40, 30)]
        e = ext("e2", "s2", 10); e["name"] = "Blok"
        a.setup(feats + [e, rect_sk("s3", "Eskiz3", TOP, -10, -10, 10, 10)])
        new_ext(a, "Eskiz3")
        a.pmselect("Uç koşulu", "surface"); a.pmcheck("Sonucu birleştir", False)
        a.wclick([25, 40, 15]); a.wait(0.6)
        a.pmcheck("Koniklik"); a.pmfield("Koniklik açısı", 5); a.wait(1.5); a.ok()
        t = 40 * math.tan(math.radians(5))
        V = 40 / 6 * (400 + (20 - 2 * t) ** 2 + 4 * (20 - t) ** 2)
        chk("X7 koniklik + yüzeye kadar (h=40)", near(a.vol() - 48000, V, 2), (a.vol() - 48000, round(V, 2), a.errs_map()))
    case("X7", x7)

    print("hatalar:", a.errs)
    a.close()
finish()

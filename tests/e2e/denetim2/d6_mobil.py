# Denetim 2 / d6 — Telefon (390×844, is_mobile, has_touch; CDP dokunma): Taban Flanş, Kenar Flanş, Kenet,
# Şekillendirme, Çizgiden Büküm, Havalandırma, Düzleştir, Açınım DXF; düzenle / geri al düğmeleri / yenile.
# Hazır model: yalnız eskizler setDoc ile.
import sys
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d6h import *  # noqa
ONLY = os.environ.get('ONLY')
FR = {"o": [0, 2, 0], "x": [1, 0, 0], "n": [0, 1, 0]}
FACE = {"k": "face", "frame": FR, "label": "Yüz", "face": {"c": [50, 2, -30], "n": [0, 1, 0]}}
BD = 2 * 4 - ba(90, 2, 2, 0.5)


def close_tree(a):
    if a.ev("document.querySelector('#side').classList.contains('open')") and a.pg.locator("#side-close").is_visible():
        a.pg.locator("#side-close").tap(); time.sleep(0.4)


def fit_m(a):
    a.pg.locator(".actbar button[title='Ekrana sığdır']").first.tap(); time.sleep(0.6)


def tap_w(a, w, kind):
    """telefonda: model alt panelin arkasında kalıyorsa kullanıcı gibi paneli küçült (▾), sığdır, dokun, paneli aç"""
    s = a.wsc(w)
    top = a.ev("document.querySelector('#side').getBoundingClientRect().top")
    mini = False
    if s[1] > top - 10:
        a.pg.locator(".sheet-min").first.tap(); time.sleep(0.5); mini = True
        fit_m(a); s = a.wsc(w)
        print("   (model panelin arkasındaydı → panel küçültüldü)", s, top)
    a.tap(s[0], s[1]); a.wait(0.4); cand_pick(a, kind)
    if mini:
        a.pg.locator(".sheet-min").first.tap(); time.sleep(0.5)


def cand_pick(a, kind="kenar"):
    """dokunmada üst üste aday çubuğu çıktıysa istenen türü seç"""
    if a.pg.locator(".cand-bar button").count():
        btns = a.pg.locator(".cand-bar button")
        txt = [btns.nth(i).inner_text() for i in range(btns.count())]
        print("   aday çubuğu:", txt)
        for i, t in enumerate(txt):
            if kind in t.lower():
                btns.nth(i).tap(); time.sleep(0.4)
                return True
    return False


with sync_playwright() as p:
    a = App(p, mobile=True)

    def case(name, fn):
        if ONLY and name not in ONLY.split(","):
            return
        print("=====", name, flush=True)
        try:
            fn()
        except Exception as ex:
            chk(name + " (istisna)", False, str(ex)[:300])
            try:
                a.close_dialogs()
                if a.mode() == "flat": flat_close(a)
                if a.mode() in ("pm", "sketch"): a.cancel("discard")
            except Exception:
                pass

    def base(extra=()):
        a.setup([plate_sk()] + list(extra))
        a.tsel("Eskiz1"); close_tree(a)
        sheet_tab(a); a.cmd("Taban Flanş"); a.wait(1.0)
        a.ok()
        view_iso(a)
        a.pg.locator("#globals button[title='Ekrana sığdır'], .actbar button[title='Ekrana sığdır']").first.tap() if a.pg.locator("#globals button[title='Ekrana sığdır'], .actbar button[title='Ekrana sığdır']").count() else None
        time.sleep(0.4)

    def m1():
        base()
        chk("M1a telefonda Taban Flanş → 12000", near(a.vol(), 12000), a.vol())
        tray = a.ev("(()=>{const t=document.querySelector('#tray');return t?t.getBoundingClientRect().top:null})()")
        print("   tepsi üstü:", tray)
        a.edit_feat("Taban-Flanş1"); close_tree(a)
        ok = a.pg.locator("#pm-ok").bounding_box()
        chk("M1 ✓ dokunulabilir alanda", ok and 0 <= ok["y"] <= 844 - ok["height"], ok)
        a.pmfield("Kalınlık", 3); a.ok()
        chk("M1b düzenle t=3 → 18000", near(a.vol(), 18000), a.vol())
        a.undo()
        chk("M1d ↶ → 12000", near(a.vol(), 12000), a.vol())
        a.redo()
        chk("M1d ↷ → 18000", near(a.vol(), 18000), a.vol())
        r = flat_open(a)
        pm = a.pg.locator("#pm").bounding_box() if a.pg.locator("#pm").count() else None
        chk("M1 telefonda Düzleştir açılır, 100×60", r and near(r["w"], 100, .01) and near(r["h"], 60, .01), r and (r["w"], r["h"]))
        flat_close(a)
        chk("M1 Düzleştir kapanır, model geri", a.mode() == "part" and near(a.vol(), 18000), (a.mode(), a.vol()))
    case("M1", m1)

    def m2():
        base()
        sheet_tab(a); a.cmd("Kenar Flanş"); a.wait(0.8)
        fit_m(a)
        s = a.wsc([50, 2, 0]); top = a.ev("document.querySelector('#side').getBoundingClientRect().top")
        chk("M2 telefonda ⤢ sığdır sonrası ön kenar alt panelin üstünde görünür", s[1] < top, (s, top))
        tap_w(a, [50, 2, 0], "kenar")
        t = a.pmtext()
        sel = a.ev("JSON.stringify((window.__app.mode.draft||{}).edges||[])")
        print("   dokunma ile seçilen:", sel)
        chk("M2 parmakla kenar seçildi (1 kenar)", "1 kenar seçili" in t, t[:60])
        a.pmfield("Uzunluk", 30); a.ok()
        v = a.vol(); r = flat_dims(a)
        print("   flanş:", v, a.errs_map(), r and (r["w"], r["h"]))
        chk("M2a parmakla kenar flanşı (L30): hata yok, açınım 86.712", not a.errs_map() and r and near(max(r["w"], r["h"]), 100, 0.01) and near(min(r["w"], r["h"]), 86.712, 0.02), (a.errs_map(), r and (r["w"], r["h"])))
        a.edit_feat("Kenar-Flanş1"); close_tree(a); a.pmfield("Büküm açısı", 45); a.ok()
        r = flat_dims(a)
        chk("M2b düzenle 45°", r and r["bends"] and near(r["bends"][0]["angle"], 45, 0.2), r and r["bends"])
        a.reload()
        chk("M2e yenile → 45° korunur", a.featbyname("Kenar-Flanş1")["angle"] == 45, a.featbyname("Kenar-Flanş1")["angle"])
    case("M2", m2)

    def m3():
        base()
        sheet_tab(a); a.cmd("Kenet"); a.wait(0.8)
        fit_m(a); tap_w(a, [50, 2, -60], "kenar")
        chk("M3 parmakla kenet kenarı", "1 kenar" in a.pmtext(), a.pmtext()[:50])
        a.pmseg("Açık"); a.ok()
        r = flat_dims(a)
        chk("M3 telefonda açık kenet: 180° büküm", not a.errs_map() and r and r["bends"] and near(r["bends"][0]["angle"], 180, 0.5), (a.errs_map(), r and r["bends"]))
    case("M3", m3)

    def m4():
        base()
        sheet_tab(a); a.cmd("Şekillendirme"); a.wait(0.8)
        fit_m(a); tap_w(a, [50, 2, -30], "yüz"); tap_w(a, [20, 2, -15], "yüz")
        chk("M4 parmakla 2 konum", "2 konum" in a.pmtext(), a.pmtext()[:120])
        a.pmfield("Koniklik", 0); a.ok()
        chk("M4 telefonda 2 kabartma → +2·452.39", near(a.vol() - 12000, 2 * (PI * 100 * 4 - PI * 64 * 4), 1), a.vol() - 12000)
    case("M4", m4)

    def m5():
        base([sketch("s4", "Eskiz2", FACE, lambda pt, line, rect, c, t: line(pt(-10, 30), pt(110, 30)))])
        a.tsel("Eskiz2"); close_tree(a)
        sheet_tab(a); a.cmd("Çizgiden Büküm"); a.wait(0.8)
        a.pmfield("Büküm açısı", 60); a.ok()
        r = flat_dims(a)
        chk("M5 telefonda çizgiden büküm 60°, açınım 100×60", r and near(r["bends"][0]["angle"], 60, 0.2) and near(r["h"], 60, 0.02), r and (r["h"], r["bends"]))
    case("M5", m5)

    def m6():
        def vsk(pt, line, rect, c, t):
            rect(30, 10, 70, 50); line(pt(30, 30), pt(70, 30), True)
        base([sketch("s2", "Eskiz2", FACE, vsk)])
        a.tsel("Eskiz2"); close_tree(a)
        sheet_tab(a); a.cmd("Havalandırma"); a.wait(0.8); a.ok()
        chk("M6 telefonda havalandırma −3040", near(12000 - a.vol(), 3040, 0.5), 12000 - a.vol())
        txt = dxf_download(a, "/tmp/d6/mobil.dxf"); d = dxf_parse(txt)
        chk("M6 telefonda Açınım DXF indirilir (100×60, kesim çizgileri)", dxf_cut_bbox(d) == [100.0, 60.0] and len(d["lines"]) >= 8, (dxf_cut_bbox(d), len(d["lines"])))
    case("M6", m6)

    print("diyaloglar:", a.dlog, "hatalar:", a.errs[:5])
    a.close()
finish()

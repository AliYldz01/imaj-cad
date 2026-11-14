# Denetim 2 / d4 — Telefon (390×844, dokunmatik, CDP / Playwright tap): ekstrüzyon, kesme, döndürme, süpürme, loft,
# Instant3D parmakla, düzenle / eskizi düzenle / geri al düğmesi, uzun basma → bitiş koşulu.
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
        print("   açık pencereler:", a.ev("[...document.querySelectorAll('dialog[open]')].map(d=>d.className+':'+d.textContent.slice(0,80))"))
        try:
            if a.mode() in ("pm", "sketch"): a.cancel("discard")
        except Exception:
            pass


def close_tree(a):
    if a.ev("document.querySelector('#side').classList.contains('open')"):
        a.pg.locator("#side-close").tap(); time.sleep(0.4)


with sync_playwright() as p:
    a = App(p, mobile=True)

    def m1():
        a.setup([rect_sk("s1", "Eskiz1", TOP, -40, -30, 40, 30)])
        a.tsel("Eskiz1"); close_tree(a)
        a.cmd("Ekstrüzyon"); a.wait(1.0)
        chk("M1 telefonda Ekstrüzyon PM açılır", a.mode() == "pm", a.mode())
        tray = a.ev("(()=>{const t=document.querySelector('#tray');return t?getComputedStyle(t).display+'|'+document.body.classList.contains('pm-only'):null})()")
        a.pmfield("Derinlik", 15); a.wait(1.0)
        ok = a.pg.locator("#pm-ok"); bb = ok.bounding_box()
        chk("M1 ✓ ekranda dokunulabilir", bb and bb["y"] >= 0 and bb["y"] + bb["height"] <= 844, (bb, tray))
        a.ok()
        chk("M1a ✓ → 72000", near(a.vol(), 72000, 1), a.vol())
        a.edit_feat("Ekstrüzyon1"); a.pmfield("Derinlik", 25); a.ok()
        chk("M1b düzenle (ağaçtan) → 120000", near(a.vol(), 120000, 1), a.vol())
        a.tact("Ekstrüzyon1", "Eskizi düzenle")
        cov = a.ev("""(()=>{const d=document.querySelectorAll('.dim')[0];const r=d.getBoundingClientRect();const e=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return !(e===d||d.contains(e))})()""")
        print("   M1c 80 ölçü etiketi alt panelin arkasında:", cov)
        chk("M1c telefonda Eskizi düzenle: ölçü etiketleri görünür alanda (panelin arkasında değil)", not cov)
        a.dim_dbl(0, 100)
        if a.ev("document.querySelector('#side').classList.contains('min')"):
            a.pg.locator("#pm .sheet-min").tap(); time.sleep(0.4)
        a.ok()
        chk("M1c eskizi düzenle (çift dokunuş ölçü) → 150000", near(a.vol(), 150000, 1), (a.vol(), a.mode()))
        a.undo(); u = a.vol(); a.redo()
        chk("M1d ↶ / ↷ düğmeleri → 120000 / 150000", near(u, 120000, 1) and near(a.vol(), 150000, 1), (u, a.vol()))
        a.reload()
        chk("M1e yenile", near(a.vol(), 150000, 1), a.vol())
    case("M1", m1)

    def m2():
        a.setup(block() + [circ_sk("s2", "Eskiz2", top_face(20), 0, 0, 10)])
        a.tsel("Eskiz2"); close_tree(a)
        a.cmd("Ekst. Kesme"); a.wait(1.0); a.ok()
        chk("M2a telefonda kesme → delik", near(a.vol(), 96000 - PI * 100 * 20, 1), a.vol())
        a.edit_feat(a.names()[-1]); a.pmselect("Uç koşulu", "blind"); a.pmfield("Derinlik", 5); a.ok()
        chk("M2b düzenle kör 5", near(a.vol(), 96000 - PI * 500, 1), a.vol())
    case("M2", m2)

    def m3():
        def b(pt, line, rect, c, t):
            rect(10, 0, 20, 30); line(pt(0, -5), pt(0, 45), True)
        sk = sketch("s1", "Eskiz1", FRONT, b); rect_dims(sk, 10, 30)
        a.setup([sk]); a.tsel("Eskiz1"); close_tree(a)
        a.cmd("Döndürme"); a.wait(1.0)
        a.pmfield("Açı", 90); a.wait(1.0); a.ok()
        chk("M3a telefonda döndürme 90°", near(a.vol(), PI * 300 * 30 / 4, 1), a.vol())
    case("M3", m3)

    def m4():
        path = sketch("y", "Yol", FRONT, lambda pt, line, rect, c, t: line(pt(0, 0), pt(0, 50)))
        a.setup([circ_sk("p", "Profil", TOP, 0, 0, 5), path])
        a.cmd("Süpürme"); a.wait(1.0); a.ok()
        chk("M4a telefonda süpürme", near(a.vol(), PI * 25 * 50, 1), a.vol())
        a.edit_feat(a.names()[-1]); a.pmseg("Dairesel profil"); a.pmfield("Çap", 6); a.wait(1.0); a.ok()
        chk("M4b dairesel profil Ø6 (segment dokunuşu)", near(a.vol(), PI * 9 * 50, 1), a.vol())
    case("M4", m4)

    def m5():
        f = [rect_sk("q1", "Profil1", TOP, -20, -20, 20, 20), refplane("pl1", "Düzlem1", TOP, 30), rect_sk("q2", "Profil2", {"k": "ref", "id": "pl1"}, -10, -10, 10, 10)]
        a.setup(f); a.cmd("Loft"); a.wait(1.0); a.ok()
        chk("M5a telefonda loft → 28000", near(a.vol(), 28000, 1), a.vol())
        a.tact("Profil2", "Eskizi düzenle"); a.dim_dbl(0, 30)
        if a.ev("document.querySelector('#side').classList.contains('min')"):
            a.pg.locator("#pm .sheet-min").tap(); time.sleep(0.4)
        a.ok()
        chk("M5c çocuk eskiz düzenle → loft güncellenir", a.vol() and not near(a.vol(), 28000, 1), a.vol())
    case("M5", m5)

    def m6():
        a.setup([rect_sk("s1", "Eskiz1", TOP, -40, -30, 40, 30)])
        a.tsel("Eskiz1"); close_tree(a)
        a.cmd("Ekstrüzyon"); a.wait(1.2)
        cube = a.ev("(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='İzo'&&x.offsetParent);return !!b})()")
        hid0 = a.ev("document.querySelector('.i3d').hidden")
        print("   M6 ok gizli mi (görünüm üstten ise normal):", hid0, a.ev("window.__app.viewer.camera.position.toArray().map(v=>Math.round(v))"))
        if hid0 and cube:
            a.pg.locator("button:text-is('İzo')").first.tap(); a.wait(1.0)
        ar = a.pg.locator(".i3d .i3d-ar"); bb = ar.bounding_box()
        hid = a.ev("document.querySelector('.i3d').hidden")
        chk("M6 telefonda PM'de Instant3D oku", bb and bb["width"] > 0 and not hid, (bb, hid))
        if bb and not hid:
            x, y = bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2
            a.tdrag((x, y), (x, y - 50), steps=12); a.wait(1.2)
            d1 = a.ev("window.__app.mode.draft.d1")
            a.ok()
            chk("M6 parmakla ok → derinlik artar ve model eşleşir", d1 > 20 and near(a.vol(), 4800 * d1, 1), (d1, a.vol()))
    case("M6", m6)

    def m7():
        a.setup(block()); a.wait(1.0)
        close_tree(a)
        if a.pg.locator("button:text-is('İzo')").count():
            a.pg.locator("button:text-is('İzo')").first.tap(); a.wait(1.0)
        s = a.wsc([20, 20, 10])
        a.longpress(s[0], s[1])
        it = a.pg.locator("text=Bitiş koşulunu değiştir…")
        chk("M7 uzun basma menüsünde 'Bitiş koşulunu değiştir…'", it.count() > 0, a.ev("[...document.querySelectorAll('.ctxmenu *, .menu *')].slice(0,10).map(e=>e.textContent)"))
        if it.count():
            it.first.tap(); time.sleep(0.8)
            a.btn("dialog.endcond button:has-text('Orta düzlem')"); a.wait(0.8)
            chk("M7 orta düzlem → y -10..10", a.bbox()[0][1] == -10, a.bbox())
    case("M7", m7)

    print("hatalar:", a.errs)
    a.close()
finish()

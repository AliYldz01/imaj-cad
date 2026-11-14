# Denetim 2 / d4 — Döndürme ve döndürerek kesme: eksen, açı, orta düzlem, ters, ince, birleştir, yaşam döngüsü
# Hazır model: Ön düzlemde dikdörtgen profil (x 10..20, y 0..30) + merkez çizgisi (x=0); blok (kesme için).
import sys
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d4h import *  # noqa


def prof(x0=10, x1=20, y0=0, y1=30, sid="s1", name="Eskiz1", cl=True):
    def b(pt, line, rect, c, t):
        rect(x0, y0, x1, y1)
        if cl:
            line(pt(0, -5), pt(0, 45), True)
    sk = sketch(sid, name, FRONT, b)
    rect_dims(sk, x1 - x0, y1 - y0)
    if cl:
        # merkez çizgisi sabit (iki ucu fix); ilk köşeye yatay mesafe (genişlik değişince dış kenar kayar)
        sk["data"]["rels"] += [{"id": "rf1", "t": "fix", "refs": ["p9"], "fx": 0, "fy": -5}, {"id": "rf2", "t": "fix", "refs": ["p10"], "fx": 0, "fy": 45}]
        if x0 > 0:
            sk["data"]["dims"].append({"id": "D3", "t": "pldist", "refs": ["p1", "l11"], "v": x0, "lp": [x0 / 2, y0 - 8]})
        else:
            sk["data"]["rels"].append({"id": "rf3", "t": "onLine", "refs": ["p1", "l11"]})
    return sk


def new_rev(a, sk="Eskiz1", cmd="Döndürme"):
    a.tsel(sk); a.cmd(cmd); a.wait(1.0)


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


ANN = lambda r0, r1, h, ang=360: PI * (r1 * r1 - r0 * r0) * h * ang / 360

with sync_playwright() as p:
    a = App(p)

    def d1():
        a.setup([prof()])
        new_rev(a)
        chk("D1a PM: eksen merkez çizgisi seçili", "Merkez çizgisi" in a.pmtext(), a.pmtext()[:200])
        a.wait(0.8)
        chk("D1a önizleme 360° halka", near(a.vol(), ANN(10, 20, 30), 1), a.vol())
        a.ok()
        chk("D1a 360° → π(400−100)·30", near(a.vol(), ANN(10, 20, 30), 1), a.vol())
        a.edit_feat("Döndürme1"); a.pmfield("Açı", 90); a.wait(1.0); pv = a.vol(); a.ok()
        chk("D1b açı 90° (önizleme de)", near(a.vol(), ANN(10, 20, 30, 90), 1) and near(pv, a.vol(), 1), (pv, a.vol()))
        a.tact("Döndürme1", "Eskizi düzenle"); a.dim_dbl(0, 15); a.ok()
        chk("D1c eskiz genişlik 10→15 (dış R25) → 90°", near(a.vol(), ANN(10, 25, 30, 90), 1), (a.vol(), a.errs_map()))
        a.undo(); u1 = a.vol(); a.undo(); u2 = a.vol(); a.redo(); a.redo(); r = a.vol()
        chk("D1d geri al ×2 / ileri al ×2", near(u1, ANN(10, 20, 30, 90), 1) and near(u2, ANN(10, 20, 30), 1) and near(r, ANN(10, 25, 30, 90), 1), (u1, u2, r))
        a.reload()
        chk("D1e yenile", near(a.vol(), ANN(10, 25, 30, 90), 1), a.vol())
        a.edit_feat("Döndürme1"); a.pmfield("Açı", 180); a.cancel("discard")
        chk("D1f ✕ değişmez", near(a.vol(), ANN(10, 25, 30, 90), 1), a.vol())
        a.tact("Döndürme1", "Bastır"); v = a.vol(); a.tact("Döndürme1", "Etkinleştir")
        chk("D1g bastır → yok, etkinleştir → var", not v and near(a.vol(), ANN(10, 25, 30, 90), 1), (v, a.vol()))
        a.tact("Döndürme1", "Sil", confirm=[True, False])
        chk("D1g sil → eskiz kalır (serbest)", a.names() == ["Eskiz1"], a.names())
    case("D1", d1)

    def d2():
        a.setup([prof()]); new_rev(a)
        a.pmfield("Açı", 90); a.pmcheck("Orta düzlem"); a.wait(1.0); a.ok()
        b = a.bbox()
        chk("D2a orta düzlem 90° → ön düzleme simetrik (z ±)", near(a.vol(), ANN(10, 20, 30, 90), 1) and abs(b[0][2] + b[1][2]) < 0.05, (a.vol(), b))
        a.edit_feat("Döndürme1"); a.pmcheck("Orta düzlem", False); a.ok(); b1 = a.bbox()
        a.edit_feat("Döndürme1"); a.pmcheck("Yönü ters çevir"); a.ok(); b2 = a.bbox()
        chk("D3a yönü ters çevir → diğer tarafa (z işareti değişir)", b1 != b2 and abs(b1[0][2] + b2[1][2]) < 0.05, (b1, b2))
    case("D2", d2)

    def d4():
        a.setup([prof()]); new_rev(a)
        sel = a.pg.locator("#pm-body label.pm-field:has-text('Eksen') select").first
        opts = sel.evaluate("s=>[...s.options].map(o=>[o.value,o.textContent])")
        left = [v for v, t in opts if "(10,0 → 10,30)" in t or "(10,30 → 10,0)" in t]
        print("   eksen seçenekleri:", opts)
        sel.select_option(left[0]); a.wait(1.2); a.ok()
        chk("D4a eksen = profilin sol kenarı (x=10) → Ø20×30 silindir", near(a.vol(), PI * 100 * 30, 1), a.vol())
        chk("D4a eksen türleri: yalnız eskiz çizgileri (P-35: model kenarı / ref. eksen yok)", all(("Çizgi" in t or "Merkez" in t) for v, t in opts), opts)
    case("D4", d4)

    def d5():
        a.setup([prof()]); new_rev(a)
        a.pmcheck("İnce özellik"); a.pmfield("Kalınlık", 1); a.wait(1.2); v1 = a.vol()
        a.pmseg("Orta"); a.wait(1.2); v2 = a.vol()
        a.pmseg("Ters yön"); a.wait(1.2); v3 = a.vol()
        a.ok()
        chk("D5a ince tek / ters yön {7162.83, 7916.81}", sorted([round(v1, 1), round(v3, 1)]) == [7162.8, 7916.8], (v1, v3))
        chk("D5a ince orta → 7539.82 (Pappus)", near(v2, 80 * 2 * PI * 15, 1), v2)
        a.tact("Döndürme1", "Eskizi düzenle"); a.dim_dbl(1, 40); a.ok()
        print("   D5c ince + yükseklik 40:", a.vol(), a.errs_map())
        chk("D5c ince döndürme eskiz değişince yeniden kurulur", a.vol() and a.vol() > v3, a.vol())
    case("D5", d5)

    def d6():
        a.setup([prof()]); new_rev(a)
        a.pmfield("Açı", 400); a.wait(1.2); a.ok()
        print("   D6 açı 400 →", a.vol(), a.status(), a.errs_map())
        chk("D6 açı > 360 reddedilir ya da 360'a sınırlanır", near(a.vol(), ANN(10, 20, 30), 1) or a.errs_map(), (a.vol(), a.errs_map()))
        a.setup([prof(-5, 10, 0, 30)]); new_rev(a); a.wait(2.0)
        st = a.status(); busy = a.busy()
        a.cancel("discard")
        chk("D6 eksen profili kesiyor → hata mesajı, çekirdek kilitlenmez", not busy and "Hazır" not in st, (st, busy))
        print("   D6 eksen kesen profil mesajı:", st)
        # merkez çizgisiz, çizgisiz eskiz (yalnız daire) → döndürme
        a.setup([circ_sk("s1", "Eskiz1", FRONT, 30, 0, 5)])
        a.tsel("Eskiz1"); a.cmd("Döndürme"); a.wait(1.0)
        txt = a.pmtext()
        a.btn("#pm-ok"); time.sleep(0.6)
        print("   D6 eksensiz eskiz:", a.toast(), "| PM:", "Eskizde çizgi yok" in txt)
        chk("D6 eksensiz eskizde ✓ → anlamlı uyarı, PM açık kalır", a.mode() == "pm" and "merkez çizgisi" in a.toast().lower(), a.toast())
        a.cancel("discard")
    case("D6", d6)

    def d7():
        a.setup([prof()]); new_rev(a)
        a.pmcheck("Sonucu birleştir", False); a.wait(0.8); a.ok()
        chk("D7 birleştirme kapalı → ayrı gövde (tek özellik 1 gövde)", a.bodies() == 1 and near(a.vol(), ANN(10, 20, 30), 1), a.bodies())
    case("D7", d7)

    # ---------------- Döndürerek kesme ----------------
    def dk():
        a.setup(block() + [prof(0, 10, 15, 25, "s2", "Eskiz2")])
        V0 = 96000.0
        new_rev(a, "Eskiz2", "Dönd. Kesme")
        chk("DK PM: Kes seçili", a.pg.locator("#pm-body .seg button.active:text-is('Kes')").count() == 1)
        a.wait(0.8); a.ok()
        nm = a.names()[-1]
        chk("DKa döndürerek kesme 360° → π·100·5 oyuk", near(V0 - a.vol(), PI * 100 * 5, 1), (V0 - a.vol(), nm))
        a.edit_feat(nm); a.pmfield("Açı", 180); a.ok()
        chk("DKb 180° → yarısı", near(V0 - a.vol(), PI * 100 * 5 / 2, 1), V0 - a.vol())
        a.tact(nm, "Eskizi düzenle"); a.dim_dbl(0, 15); a.ok()
        chk("DKc eskiz R10→R15 → π·225·5/2", near(V0 - a.vol(), PI * 225 * 5 / 2, 1), (V0 - a.vol(), a.errs_map()))
        a.undo(); u = a.vol(); a.redo()
        chk("DKd geri al / ileri al", near(V0 - u, PI * 100 * 5 / 2, 1) and near(V0 - a.vol(), PI * 225 * 5 / 2, 1), (u, a.vol()))
        a.reload()
        chk("DKe yenile", near(V0 - a.vol(), PI * 225 * 5 / 2, 1), a.vol())
        a.edit_feat(nm); a.pmfield("Açı", 90); a.cancel("discard")
        chk("DKf ✕", near(V0 - a.vol(), PI * 225 * 5 / 2, 1), a.vol())
        a.tact(nm, "Bastır")
        chk("DKg bastır → 96000", near(a.vol(), V0, 1), a.vol())
        a.tact(nm, "Etkinleştir")
        a.tact(nm, "Sil", confirm=[True, True])
        chk("DKg sil (eskiziyle)", near(a.vol(), V0, 1) and "Eskiz2" not in a.names(), (a.vol(), a.names()))
    case("DK", dk)

    def dk2():
        a.setup(block() + [prof(0, 10, 15, 25, "s2", "Eskiz2")]); new_rev(a, "Eskiz2", "Dönd. Kesme")
        a.pmcheck("İnce özellik"); a.pmfield("Kalınlık", 1); a.wait(1.5)
        st = a.status()
        a.btn("#pm-ok"); time.sleep(0.6)
        print("   DK2 ince tek yön (duvar eksenden taşar):", st, "| mod", a.mode(), "| uyarı", a.toast())
        chk("DK2 eksenden taşan ince duvar → hata, ✓ engellenir", a.mode() == "pm" and "Hazır" not in st, (st, a.mode()))
        a.pmseg("Ters yön"); a.wait(1.5); a.ok()
        print("   DK2 ince ters yön:", 96000 - a.vol(), a.bodies(), a.errs_map())
        chk("DK2 ince döndürerek kesme (içe) → π·… > 0", 96000 - a.vol() > 1 and not a.errs_map(), (96000 - a.vol(), a.errs_map()))
    case("DK2", dk2)

    print("hatalar:", a.errs)
    a.close()
finish()

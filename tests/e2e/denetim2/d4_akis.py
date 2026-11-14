# Denetim 2 / d4 — Çok adımlı iş akışları (masaüstü 1400×900): temel özellik zinciri → düzenle → eskiz → geri al → kaydet / yenile
# Hazır model: yalnız eskizler (setDoc); tüm özellik adımları şerit / PM / ağaç / klavye ile.
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
            a.pg.keyboard.press("Escape"); time.sleep(0.3)
            if a.mode() in ("pm", "sketch"): a.cancel("discard")
        except Exception:
            pass


def save_download(a):
    a.blur()
    with a.pg.expect_download(timeout=20000) as dl:
        a.pg.keyboard.press("Control+s")
    path = dl.value.path()
    return json.load(open(path))


with sync_playwright() as p:
    a = App(p, nosfp=True)

    # W1 Plaka + delik (paylaşılan iş akışı): ekstrüzyon → üst yüze delik kesme → plaka genişliği değişir → delik hâlâ boydan boya
    #    → kesme derinliği düzenle → geri al zinciri → Ctrl+S dosyası güncel → yenile
    def w1():
        a.setup([rect_sk("s1", "Eskiz1", TOP, -40, -30, 40, 30), circ_sk("s2", "Eskiz2", top_face(10), 20, 0, 5)])
        a.tsel("Eskiz1"); a.cmd("Ekstrüzyon"); a.wait(0.6); a.pmfield("Derinlik", 10); a.ok()
        a.tsel("Eskiz2"); a.cmd("Ekst. Kesme"); a.wait(0.8); a.ok()
        chk("W1 plaka 80×60×10 + Ø10 delik", near(a.vol(), 48000 - PI * 250, 1), a.vol())
        a.tact("Ekstrüzyon1", "Eskizi düzenle"); a.dim_dbl(0, 120); a.ok()
        chk("W1 plaka 80→120 → delik hâlâ boydan boya", near(a.vol(), 72000 - PI * 250, 1), (a.vol(), a.errs_map()))
        a.edit_feat("Ekstrüzyon1"); a.pmfield("Derinlik", 25); a.ok()
        print("   W1 plaka 25 kalınlık (delik eskizi üst yüzde y=10 idi):", a.vol(), a.errs_map(), a.feat("s2")["plane"]["frame"]["o"])
        chk("W1 plaka kalınlaşınca delik eskizi üst yüzle taşınır, delik 25 boyunca", near(a.vol(), 120 * 60 * 25 - PI * 25 * 25, 1), (a.vol(), a.errs_map()))
        d = save_download(a)
        e1 = [f for f in d["features"] if f["name"] == "Ekstrüzyon1"][0]
        chk("W1 Ctrl+S dosyası güncel (d1=25, genişlik 120)", e1["d1"] == 25 and [f for f in d["features"] if f["id"] == "s1"][0]["data"]["dims"][0]["v"] == 120, e1["d1"])
        for _ in range(3): a.undo()
        chk("W1 geri al ×3 → yalnız plaka (delik kesmesi öncesi)", near(a.vol(), 48000, 1), a.vol())
        for _ in range(3): a.redo()
        chk("W1 ileri al ×3 → son durum", near(a.vol(), 120 * 60 * 25 - PI * 25 * 25, 1), a.vol())
        a.reload()
        chk("W1 yenile → son durum", near(a.vol(), 120 * 60 * 25 - PI * 25 * 25, 1), a.vol())
    case("W1", w1)

    # W2 Burç: döndürme → flanşa delik (kesme, sonrakine kadar) → profil iç çapı değişir → döndürme açısı → bastır → etkinleştir
    def w2():
        def b(pt, line, rect, c, t):
            P = [pt(10, 0), pt(40, 0), pt(40, 8), pt(20, 8), pt(20, 40), pt(10, 40)]
            for i in range(6): line(P[i], P[(i + 1) % 6])
            line(pt(0, -5), pt(0, 50), True)
        sk = sketch("s1", "Profil", FRONT, b)
        sk["data"]["dims"].append({"id": "D1", "t": "pldist", "refs": ["p1", "l15"], "v": 10, "lp": [5, -6]})
        a.setup([sk, circ_sk("s2", "Delik", top_face(8), 30, 0, 3)])
        a.tsel("Profil"); a.cmd("Döndürme"); a.wait(0.8); a.ok()
        v_rev = PI * (40 ** 2 - 10 ** 2) * 8 + PI * (20 ** 2 - 10 ** 2) * 32
        chk("W2 burç döndürme", near(a.vol(), v_rev, 2), (a.vol(), round(v_rev, 2)))
        a.tsel("Delik"); a.cmd("Ekst. Kesme"); a.wait(0.6); a.pmselect("Uç koşulu", "next"); a.wait(0.8); a.ok()
        chk("W2 flanşa Ø6 delik (sonrakine kadar)", near(a.vol(), v_rev - PI * 9 * 8, 2), (a.vol(), a.errs_map()))
        a.tact("Döndürme1", "Eskizi düzenle"); a.dim_dbl(0, 12); a.ok()
        v2 = PI * (40 ** 2 - 12 ** 2) * 8 + PI * (20 ** 2 - 12 ** 2) * 32 - PI * 9 * 8
        # profil çizgilerinde yatay/dikey ilişki yok (eksik tanımlı): yalnız p1 kayar → yalnız hatasızlık denetlenir
        chk("W2 iç yarıçap 10→12 → hatasız yeniden kurulur, delik korunur", not a.errs_map() and a.vol() and abs(a.vol() - v_rev) > 1, (a.vol(), a.errs_map()))
        a.edit_feat("Döndürme1"); a.pmfield("Açı", 180); a.ok()
        print("   W2 döndürme 180° sonrası delik (x=30 tarafı):", a.vol(), a.errs_map())
        a.tact("Döndürme1", "Bastır")
        print("   W2 döndürme bastırılınca:", a.errs_map(), a.status(), "(P-7)")
        a.tact("Döndürme1", "Etkinleştir")
        chk("W2 etkinleştir → hatasız", not a.errs_map(), a.errs_map())
    case("W2", w2)

    # W3 Boru + uç flanşı: dairesel profilli süpürme (Ø20 / iç Ø16) → boru ucundan (Başla: yüz) flanş ekstrüzyonu → yol uzar → flanş uca gider mi
    def w3():
        path = sketch("y", "Yol", FRONT, lambda pt, line, rect, c, t: line(pt(0, 0), pt(0, 60)))
        path["data"]["dims"].append({"id": "D1", "t": "dist", "refs": ["p1", "p2"], "v": 60, "sub": "v", "lp": [8, 30]})
        path["data"]["rels"] += [{"id": "r1", "t": "fix", "refs": ["p1"]}, {"id": "r2", "t": "vertical", "refs": ["l3"]}]
        fl = rect_sk("f", "Flanş", TOP, -20, -20, 20, 20, dims=True)
        a.setup([path, fl])
        a.cmd("Süpürme"); a.wait(0.8)
        a.pmselect("Yol (açık", "y")
        a.pmseg("Dairesel profil"); a.pmfield("Çap", 20); a.pmfield("İç çap", 16); a.wait(1.0); a.ok()
        chk("W3 boru Ø20/16 × 60", near(a.vol(), PI * (100 - 64) * 60, 1), (a.vol(), a.errs_map()))
        a.tsel("Flanş"); a.cmd("Ekstrüzyon"); a.wait(0.6)
        a.pmselect("Başla", "face"); a.wait(0.3)
        a.wclick([0, 60, 9]); a.wait(0.8)
        print("   W3 başlangıç yüzü:", a.ev("JSON.stringify(window.__app.mode.draft.fromFace)"))
        a.pmfield("Derinlik", 5); a.wait(1.0); a.ok()
        bb = a.bbox()
        chk("W3 flanş borunun ucundan (y 60..65)", bb[1][1] == 65, (bb, a.vol(), a.errs_map()))
        a.tact("Yol", "Eskizi düzenle"); a.dim_dbl(0, 90); a.ok()
        bb = a.bbox()
        print("   W3 yol 60→90 sonrası:", bb, a.errs_map())
        chk("W3 yol uzayınca uç yüzünden başlayan flanş izler (y 90..95)", bb[1][1] == 95, (bb, a.errs_map()))
    case("W3", w3)

    # W4 Huni: kare→daire loft + ince → alt tarafa ekstrüzyon boğaz (Başla: Öteleme) → profil değişir
    def w4():
        f = [rect_sk("q1", "Kare", TOP, -30, -30, 30, 30), refplane("pl1", "Düzlem1", TOP, -40), circ_sk("q2", "Daire", {"k": "ref", "id": "pl1"}, 0, 0, 10)]
        a.setup(f); a.cmd("Loft"); a.wait(0.8)
        a.pmcheck("İnce özellik (uçlar"); a.wait(1.5); a.ok()
        v1 = a.vol()
        chk("W4 kare→daire ince loft (hatasız)", v1 and not a.errs_map(), (v1, a.errs_map()))
        a.tact("Daire", "Eskizi düzenle"); a.dim_dbl(0, 30); a.ok()
        chk("W4 alt daire Ø20→Ø30 → loft güncellenir", a.vol() and not near(a.vol(), v1, 1) and not a.errs_map(), (a.vol(), a.errs_map()))
        a.undo()
        chk("W4 geri al", near(a.vol(), v1, 1), a.vol())
    case("W4", w4)

    # W5 Kademeli mil + kanal (döndürerek kesme) → kanal açısı → mil bastır → çocuk durumu
    def w5():
        def b(pt, line, rect, c, t):
            P = [pt(0, 0), pt(15, 0), pt(15, 40), pt(10, 40), pt(10, 80), pt(0, 80)]
            for i in range(6): line(P[i], P[(i + 1) % 6])
        sk = sketch("s1", "Mil", FRONT, b)
        g = sketch("s2", "Kanal", FRONT, lambda pt, line, rect, c, t: (rect(13, 18, 16, 22), line(pt(0, -5), pt(0, 90), True)))
        a.setup([sk, g])
        a.tsel("Mil"); a.cmd("Döndürme"); a.wait(0.6)
        sel = a.pg.locator("#pm-body label.pm-field:has-text('Eksen') select").first
        opts = sel.evaluate("s=>[...s.options].map(o=>[o.value,o.textContent])")
        ax = [v for v, t in opts if "(0,80 → 0,0)" in t or "(0,0 → 0,80)" in t]
        sel.select_option(ax[0]); a.wait(0.8); a.ok()
        vm = PI * 225 * 40 + PI * 100 * 40
        chk("W5 kademeli mil (eksen = eskiz kenarı)", near(a.vol(), vm, 2), (a.vol(), round(vm, 2)))
        a.tsel("Kanal"); a.cmd("Dönd. Kesme"); a.wait(0.8); a.ok()
        vg = PI * (225 - 169) * 4
        chk("W5 kanal (R13–15, 4 mm)", near(vm - a.vol(), vg, 2), (vm - a.vol(), round(vg, 2), a.errs_map()))
        nm = a.names()[-1]
        a.edit_feat(nm); a.pmfield("Açı", 90); a.ok()
        chk("W5 kanal 90°", near(vm - a.vol(), vg / 4, 2), vm - a.vol())
        a.tact("Döndürme1", "Bastır")
        print("   W5 mil bastırılınca kanal:", a.errs_map(), "(P-7)")
        a.tact("Döndürme1", "Etkinleştir")
        a.reload()
        chk("W5 yenile", near(vm - a.vol(), vg / 4, 2), a.vol())
    case("W5", w5)

    # W6 Kutu + cep: blok → cep (üst yüzden kör 12) → blok derinliği 20→30 → cep eskizi üst yüzle gider, derinlik 12 kalır → Instant3D ile cebi değiştir → geri al
    def w6():
        a.setup([rect_sk("s1", "Eskiz1", TOP, -40, -30, 40, 30), rect_sk("s2", "Cep", top_face(20), -20, -10, 20, 10)])
        a.tsel("Eskiz1"); a.cmd("Ekstrüzyon"); a.wait(0.6); a.ok()
        a.tsel("Cep"); a.cmd("Ekst. Kesme"); a.wait(0.6); a.pmselect("Uç koşulu", "blind"); a.pmfield("Derinlik", 12); a.ok()
        chk("W6 kutu + cep 40×20×12", near(a.vol(), 96000 - 9600, 1), a.vol())
        a.edit_feat("Ekstrüzyon1"); a.pmfield("Derinlik", 30); a.ok()
        chk("W6 kutu 30 → cep üst yüzde, 12 derin", near(a.vol(), 144000 - 9600, 1) and a.bbox()[1][1] == 30, (a.vol(), a.bbox(), a.errs_map()))
        nm = a.names()[-1]
        a.tsel(nm); a.wait(0.5)
        ar = a.pg.locator(".i3d .i3d-ar"); bb = ar.bounding_box()
        if bb and bb["width"] > 0 and not a.ev("document.querySelector('.i3d').hidden"):
            x, y = bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2
            a.drag((x, y), (x, y + 30), steps=10); a.wait(1.2)
            dd = a.feat(a.featbyname(nm)["id"])["d1"]
            chk("W6 Instant3D cep derinliği değişti ve modelde", dd != 12 and near(a.vol(), 144000 - 800 * dd, 1), (dd, a.vol()))
            a.undo()
            chk("W6 geri al → 12", a.feat(a.featbyname(nm)["id"])["d1"] == 12, a.feat(a.featbyname(nm)["id"])["d1"])
        else:
            chk("W6 parça modunda kesme için Instant3D oku", False, bb)
    case("W6", w6)

    # W7 Kayıt bütünlüğü: PM açıkken sayfa yenile → taslak kaybolur ama belge bozulmaz; eskiz açıkken yenile
    def w7():
        a.setup([rect_sk("s1", "Eskiz1", TOP, -40, -30, 40, 30)])
        a.tsel("Eskiz1"); a.cmd("Ekstrüzyon"); a.wait(0.6); a.ok()
        a.edit_feat("Ekstrüzyon1"); a.pmfield("Derinlik", 50); a.wait(1.0)
        a.dq[:] = [True]
        a.reload()
        chk("W7 PM açıkken yenile → kayıtlı 20 kalır (taslak yazılmaz)", near(a.vol(), 96000, 1) and a.mode() == "part", (a.vol(), a.mode()))
        a.tact("Ekstrüzyon1", "Eskizi düzenle"); a.dim_dbl(0, 100)
        a.reload()
        print("   W7 eskizde değişiklikten sonra yenile:", a.vol(), a.feat("s1")["data"]["dims"][0]["v"])
        chk("W7 eskiz ✓ olmadan yenile → belge tutarlı (model = eskiz)", (near(a.vol(), 96000, 1) and a.feat("s1")["data"]["dims"][0]["v"] == 80) or (near(a.vol(), 120000, 1) and a.feat("s1")["data"]["dims"][0]["v"] == 100), (a.vol(), a.feat("s1")["data"]["dims"][0]["v"]))
    case("W7", w7)

    # W8 Hata kurtarma: koniklik çok büyük / ince kalınlık profili aşar → hata → düzelt → çekirdek kilitlenmez
    def w8():
        a.setup([rect_sk("s1", "Eskiz1", TOP, -10, -10, 10, 10)])
        a.tsel("Eskiz1"); a.cmd("Ekstrüzyon"); a.wait(0.6)
        a.pmcheck("Koniklik"); a.pmfield("Koniklik açısı", 40); a.pmfield("Derinlik", 20); a.wait(2.0)
        st = a.status(); busy = a.busy()
        print("   W8 iç koniklik 40° (profil kapanır):", st, busy)
        chk("W8 aşırı koniklik → hata mesajı, kilit yok", not busy and "Hazır" not in st, st)
        a.pmfield("Koniklik açısı", 5); a.wait(1.5)
        chk("W8 düzeltince önizleme gelir", "Hazır" in a.status(), a.status())
        a.pmcheck("Koniklik", False)
        a.pmcheck("İnce özellik (açık"); a.pmfield("Kalınlık", 15); a.pmseg("Ters yön"); a.wait(2.0)
        st = a.status(); busy = a.busy(); v = a.vol()
        print("   W8 ince 15 (içe, 20×20 profil):", st, busy, v)
        chk("W8 profili aşan ince kalınlık → hata (sessiz yanlış geometri değil)", not busy and ("Hazır" not in st or v is None), (st, v))
        a.pmfield("Kalınlık", 2); a.wait(1.5)
        a.ok()
        chk("W8 düzeltip ✓ → model", a.vol() and not a.errs_map(), (a.vol(), a.errs_map()))
    case("W8", w8)

    print("hatalar:", a.errs)
    a.close()
finish()

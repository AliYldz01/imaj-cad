# Denetim 2 / d4 — Süpürme (+ kesme): eskiz profili, dairesel profil, yön, burulma, kılavuz, helis, takım, 3B yol; yaşam döngüsü
# Hazır model: profil / yol eskizleri (setDoc); süpürme şeritten ve PM'den.
import sys, os
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d4h import *  # noqa
ONLY = os.environ.get('ONLY')


def path_sk(L=50, sid="y", name="Yol"):
    sk = sketch(sid, name, FRONT, lambda pt, line, rect, c, t: line(pt(0, 0), pt(0, L)))
    sk["data"]["dims"].append({"id": "D1", "t": "dist", "refs": ["p1", "p2"], "v": L, "sub": "v", "lp": [8, L / 2]})
    return sk


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


def new_sweep(a):
    a.cmd("Süpürme"); a.wait(1.0)


with sync_playwright() as p:
    a = App(p)

    def s1():
        a.setup([circ_sk("p", "Profil", TOP, 0, 0, 5), path_sk()])
        new_sweep(a)
        chk("S1a PM: profil=Profil, yol=Yol", a.pmselval("Profil (kapalı") == "p" and a.pmselval("Yol (açık") == "y", (a.pmselval("Profil (kapalı"), a.pmselval("Yol (açık")))
        a.wait(0.8)
        chk("S1a önizleme", near(a.vol(), PI * 25 * 50, 1), a.vol())
        a.ok()
        chk("S1a Ø10 × 50 → 3926.99", near(a.vol(), PI * 25 * 50, 1), a.vol())
        nm = a.names()[-1]
        chk("S1a ağaçta Süpürme1, çocuklar Profil + Yol", nm.startswith("Süpürme") and a.ev("[...document.querySelectorAll('#tree li.child')].map(l=>l.textContent.trim())") == ["Profil", "Yol"], (nm, a.ev("[...document.querySelectorAll('#tree li.child')].map(l=>l.textContent.trim())")))
        a.edit_feat(nm); a.pmseg("Dairesel profil"); a.wait(0.3)
        a.pmfield("Çap", 10); a.pmfield("İç çap", 6); a.wait(1.0); a.ok()
        chk("S1b dairesel profil Ø10 / iç Ø6 → π(25−9)·50", near(a.vol(), PI * 16 * 50, 1), a.vol())
        a.edit_feat(nm); a.pmseg("Eskiz profili"); a.wait(0.3)
        chk("S1b eskiz profiline dönünce Profil seçili", a.pmselval("Profil (kapalı") == "p", a.pmselval("Profil (kapalı"))
        a.ok()
        chk("S1b eskiz profiline geri dönüş → 3926.99", near(a.vol(), PI * 25 * 50, 1), (a.vol(), a.errs_map()))
        a.tact(nm, "Eskizi düzenle"); a.dim_dbl(0, 16); a.ok()
        chk("S1c profil eskizi Ø10→Ø16 → π·64·50", near(a.vol(), PI * 64 * 50, 1), a.vol())
        a.tact("Yol", "Eskizi düzenle"); a.dim_dbl(0, 80); a.ok()
        chk("S1c yol eskizi 50→80 (çocuk satırından) → π·64·80", near(a.vol(), PI * 64 * 80, 1), (a.vol(), a.errs_map()))
        a.undo(); u1 = a.vol(); a.undo(); u2 = a.vol(); a.redo(); a.redo(); r = a.vol()
        chk("S1d geri al ×2 / ileri al ×2", near(u1, PI * 64 * 50, 1) and near(u2, PI * 25 * 50, 1) and near(r, PI * 64 * 80, 1), (u1, u2, r))
        a.reload()
        chk("S1e yenile", near(a.vol(), PI * 64 * 80, 1), a.vol())
        a.edit_feat(nm); a.pmseg("Dairesel profil"); a.wait(0.8); a.cancel("discard")
        chk("S1f ✕ değişmez", near(a.vol(), PI * 64 * 80, 1) and not a.feat(a.featbyname(nm)["id"]).get("circ"), a.vol())
        a.tact(nm, "Bastır"); v = a.vol(); a.tact(nm, "Etkinleştir")
        chk("S1g bastır / etkinleştir", not v and near(a.vol(), PI * 64 * 80, 1), (v, a.vol()))
        a.tact(nm, "Sil", confirm=[True, True])
        chk("S1g sil (eskizleriyle) → profil ve yol da silinir", a.names() == [], a.names())
        a.undo()
        chk("S1g geri al → üçü geri", len(a.names()) == 3 and near(a.vol(), PI * 64 * 80, 1), a.names())
    case("S1", s1)

    def s2():
        # yay yolu (R100, 30°): Yolu izle → simit dilimi; Normali sabit → öteleme (A × düşey yükseklik 50)
        def b(pt, line, rect, c, t):
            pass
        sk = sketch("y", "Yol", FRONT, b)
        d = sk["data"]
        d["pts"] = {"p1": {"x": 100, "y": 0}, "p2": {"x": 100 + 100 * math.cos(math.radians(150)), "y": 100 * math.sin(math.radians(150))}, "p3": {"x": 0, "y": 0}}
        d["ents"] = [{"id": "a4", "t": "arc", "c": "p1", "s": "p2", "e": "p3", "r": 100}]
        d["seq"] = 5
        a.setup([circ_sk("p", "Profil", TOP, 0, 0, 5), sk])
        new_sweep(a); a.wait(0.8); a.ok()
        vf = a.vol()
        chk("S2a yolu izle: yay boyunca → π·25·(100·π/6)", near(vf, PI * 25 * 100 * PI / 6, 3), (vf, a.errs_map()))
        nm = a.names()[-1]
        a.edit_feat(nm); a.pmselect("Profil yönelimi", "normal"); a.wait(1.2); a.ok()
        vn = a.vol()
        chk("S2b normali sabit tut → A × 50 = 3926.99", near(vn, PI * 25 * 50, 3), (vn, a.errs_map()))
        a.undo()
        chk("S2d geri al → yolu izle", near(a.vol(), vf, 1), a.vol())
    case("S2", s2)

    def s3():
        prof = rect_sk("p", "Profil", TOP, -10, -5, 10, 5)
        a.setup([prof, path_sk()]); new_sweep(a)
        a.pmfield("Burulma açısı", 90); a.wait(1.5); a.ok()
        b = a.bbox()
        chk("S3a burulma 90° → hacim ≈ 200·50 (±%1), sınır kutusu döner", near(a.vol(), 10000, 100) and (b[1][2] - b[0][2]) > 15, (a.vol(), b, a.errs_map()))
        nm = a.names()[-1]
        a.tact(nm, "Eskizi düzenle"); a.dim_dbl(0, 30); a.ok()
        chk("S3c profil 20→30 genişlik, burulma korunur → ≈ 300·50", near(a.vol(), 15000, 150), (a.vol(), a.errs_map()))
    case("S3", s3)

    def s4():
        g = sketch("g", "Kılavuz", FRONT, lambda pt, line, rect, c, t: line(pt(5, 0), pt(10, 50)))
        a.setup([circ_sk("p", "Profil", TOP, 0, 0, 5), path_sk(), g]); new_sweep(a)
        a.pmselect("Kılavuz eğri", "g"); a.wait(1.5); a.ok()
        V = PI * 10 / 3 * (1000 - 125)
        chk("S4a kılavuz: yarıçap 5→10 → ≈ π∫r² (±%1.5)", near(a.vol(), V, V * 0.015), (a.vol(), round(V, 1), a.errs_map()))
        chk("S4a kılavuz eskizi ağaçta (çocuk değil, serbest)", "Kılavuz" in a.names(), a.names())
    case("S4", s4)

    def s5():
        a.setup([circ_sk("y", "Taban", TOP, 0, 0, 20)]); new_sweep(a)
        chk("S5 tek kapalı eskizde dairesel profil ile başlar", a.pmhas("Çap"), a.pmtext()[:200])
        a.pmseg("Helis / yay"); a.wait(0.3)
        a.pmfield("Tur sayısı", 3); a.pmfield("Çap", 4); a.wait(2.5); a.ok()
        L = 3 * math.hypot(2 * PI * 20, 10)
        chk("S5a helis (hatve 10, 3 tur, tel Ø4) → π·4·L (±%1)", near(a.vol(), PI * 4 * L, PI * 4 * L * 0.01), (a.vol(), round(PI * 4 * L, 1), a.bbox()))
        b = a.bbox()
        chk("S5a helis yüksekliği 30 (+tel)", near(b[1][1] - b[0][1], 34, 0.6), b)
        nm = a.names()[-1]
        a.edit_feat(nm); a.pmfield("Hatve", 15); a.wait(1.5); a.ok()
        b = a.bbox()
        chk("S5b hatve 15 → yükseklik 45 (+tel)", near(b[1][1] - b[0][1], 49, 0.6), b)
        a.tsel("Taban") if "Taban" in a.ev("[...document.querySelectorAll('#tree li span')].map(s=>s.textContent)") else None
        a.tact("Taban", "Eskizi düzenle"); a.dim_dbl(0, 60); a.ok()
        b = a.bbox()
        chk("S5c taban Ø40→Ø60 → helis R30", near(b[1][0] - b[0][0], 64, 0.6), (b, a.errs_map()))
        a.edit_feat(nm); a.pmcheck("Sol el"); a.ok()
        chk("S5b sol el (hacim aynı)", a.vol() > 0 and not a.errs_map(), a.vol())
        a.edit_feat(nm); a.pmfield("Koniklik açısı", 10); a.wait(2.5); a.ok()
        chk("S5b konik helis çalışır", a.vol() > 0 and not a.errs_map(), (a.vol(), a.errs_map()))
    case("S5", s5)

    def s6():
        pth = sketch("y", "Yol", top_face(20), lambda pt, line, rect, c, t: line(pt(-30, 0), pt(30, 0)))
        a.setup(block() + [pth]); new_sweep(a)
        a.pmseg("Katı gövde (takım)"); a.wait(1.5)
        v1 = a.vol()
        a.pmcheck("Takım yönünü çevir"); a.wait(1.5); v2 = a.vol()
        a.ok()
        rem = [96000 - v1, 96000 - a.vol()]
        chk("S6a takım süpürme Ø10×20 düz uç → (60·10 + π·25)·20 = 13570.8 (bir yönde)", any(near(r, 13570.8, 2) for r in rem), (rem, a.errs_map()))
        nm = a.names()[-1]
        a.edit_feat(nm); a.pmseg("Küresel uç"); a.wait(1.5); a.ok()
        chk("S6b küresel uç → farklı hacim", not near(96000 - a.vol(), 13570.8, 2) and 96000 - a.vol() > 0, 96000 - a.vol())
    case("S6", s6)

    def s7():
        k3 = {"id": "k", "type": "sketch3d", "name": "3B Yol", "ids": ["p1", "p2", "p3"], "xyz": [[0, 0, 0], [0, 50, 0], [40, 80, 0]],
              "lines": [{"id": "l1", "a": "p1", "b": "p2"}, {"id": "l2", "a": "p2", "b": "p3"}], "r": 0, "seq": 10}
        a.setup([k3]); new_sweep(a)
        a.pmselect("Yol (açık", "k"); a.wait(0.3)
        if not a.pmhas("Çap"):
            a.pmseg("Dairesel profil")
        a.pmfield("Çap", 10); a.wait(1.5); a.ok()
        Ltot = 50 + 50
        v = a.vol()
        print("   S7 3B yol (keskin köşeli 2 çizgi) Ø10:", v, "π·25·100 =", round(PI * 2500, 1), a.errs_map())
        chk("S7a 3B yol süpürme oluşur (≈ π·25·100, köşe payı)", v and abs(v - PI * 2500) < PI * 2500 * 0.1, (v, a.errs_map()))
        # 3B yolda burulma alanı görünüyor mu, etkisi var mı?
        a.setup([k3, rect_sk("p", "Profil", TOP, -10, -5, 10, 5)]); new_sweep(a)
        a.pmselect("Profil (kapalı", "p"); a.pmselect("Yol (açık", "k"); a.wait(1.5)
        v0 = a.vol(); b0 = a.bbox()
        shown = a.pmhas("Burulma açısı")
        if shown:
            a.pmfield("Burulma açısı", 90); a.wait(1.5)
        v1 = a.vol(); b1 = a.bbox()
        a.ok()
        print("   S7b 3B yol + burulma: alan görünür", shown, "hacim", v0, v1, "kutu", b0, b1, a.errs_map())
        chk("S7b 3B yolda burulma ya gizli ya da uygulanır (sessizce yok sayılmaz)", (not shown) or b0 != b1 or a.errs_map(), (shown, b0, b1))
    # S7 ayrıntılı hâli d4_supur3b.py içinde (yalnız 3B eskizle komut açılmıyor: D4-5)
    # case("S7", s7)

    def s8():
        pth = sketch("y", "Yol", FRONT, lambda pt, line, rect, c, t: line(pt(-60, 10), pt(60, 10)))
        a.setup(block() + [rect_sk("p", "Profil", RIGHT, -5, 5, 5, 15, dims=False), pth])
        a.cmd("Süpürme"); a.wait(1.0)
        a.pmselect("Profil (kapalı", "p"); a.pmselect("Yol (açık", "y"); a.pmseg("Kes"); a.wait(1.5)
        pv = a.vol(); a.ok()
        print("   S8 süpürmeli kesme: ", pv, a.vol(), a.errs_map(), a.names())
        chk("S8a süpürmeli kesme: kanal 10×10 boyunca 80 → 96000−8000", near(a.vol(), 88000, 2), (a.vol(), a.errs_map()))
        nm = a.names()[-1]
        chk("S8a ağaç adı kesme olduğunu belirtir", "Kes" in nm, nm)
    case("S8", s8)

    print("hatalar:", a.errs)
    a.close()
finish()

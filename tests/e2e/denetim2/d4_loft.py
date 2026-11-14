# Denetim 2 / d4 — Loft (+ kesme): profiller, düz yüzeyli, 3 profil, kapalı, ince, merkez çizgisi, kılavuz, bağlayıcılar,
# başlangıç / bitiş kısıtı, sac geçiş; yaşam döngüsü. Hazır model: profil eskizleri ve referans düzlemleri (setDoc).
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


def base2(s2=20, h=30):
    return [rect_sk("q1", "Profil1", TOP, -20, -20, 20, 20), refplane("pl1", "Düzlem1", TOP, h),
            rect_sk("q2", "Profil2", {"k": "ref", "id": "pl1"}, -s2 / 2, -s2 / 2, s2 / 2, s2 / 2)]


FR = lambda a1, a2, h: h / 3 * (a1 + a2 + math.sqrt(a1 * a2))

with sync_playwright() as p:
    a = App(p)

    def l1():
        a.setup(base2())
        a.cmd("Loft"); a.wait(1.0)
        chk("L1a PM: iki profil seçili sırayla", "Profil1 (1.)" in a.pmtext() and "Profil2 (2.)" in a.pmtext(), a.pmtext()[:200])
        a.wait(0.8); a.ok()
        chk("L1a 40² → 20², h30 → 28000", near(a.vol(), 28000, 1), a.vol())
        nm = a.names()[-1]
        kids = a.ev("[...document.querySelectorAll('#tree li.child')].map(l=>l.textContent.trim())")
        chk("L1a ağaçta Loft1 + çocuklar Profil1, Profil2", nm == "Loft1" and kids == ["Profil1", "Profil2"], (nm, kids))
        acts = (a.tsel(nm), a.ev("[...document.querySelectorAll('#tree-actions button')].map(b=>b.textContent)"))[1]
        print("   L1 loft ağaç eylemleri:", acts)
        a.edit_feat(nm); a.pmcheck("Düz yüzeyli"); a.wait(1.0); a.ok()
        chk("L1b düz yüzeyli → 28000", near(a.vol(), 28000, 1), a.vol())
        a.tact("Profil2", "Eskizi düzenle"); a.dim_dbl(0, 30); a.ok()
        print("   L1c Profil2 genişlik 20→30 (yükseklik 20 kalır):", a.vol(), a.errs_map())
        chk("L1c profil eskizi değişince loft yeniden kurulur (30×20)", near(a.vol(), 30 / 6 * (1600 + 600 + 4 * 35 * 30), 2), (a.vol(), a.errs_map()))
        a.undo(); u1 = a.vol(); a.redo(); r1 = a.vol()
        chk("L1d geri al / ileri al", near(u1, 28000, 1) and near(r1, 30 / 6 * (1600 + 600 + 4 * 35 * 30), 2), (u1, r1))
        a.reload()
        chk("L1e yenile", near(a.vol(), 30 / 6 * (1600 + 600 + 4 * 35 * 30), 2), a.vol())
        a.edit_feat(nm); a.pmcheck("Düz yüzeyli", False); a.pmcheck("Kapalı loft"); a.wait(0.8); a.cancel("discard")
        chk("L1f ✕ değişmez", near(a.vol(), 30 / 6 * (1600 + 600 + 4 * 35 * 30), 2) and not a.feat(a.featbyname(nm)["id"]).get("closed"), a.vol())
        a.tact(nm, "Bastır"); v = a.vol(); a.tact(nm, "Etkinleştir")
        chk("L1g bastır / etkinleştir", not v and a.vol() > 0, (v, a.vol()))
        a.tact(nm, "Sil", confirm=[True, False])
        chk("L1g sil (eskizler kalır) → profiller serbest", a.names() == ["Profil1", "Düzlem1", "Profil2"], a.names())
    case("L1", l1)

    def l2():
        f = base2() + [refplane("pl2", "Düzlem2", TOP, 60), rect_sk("q3", "Profil3", {"k": "ref", "id": "pl2"}, -20, -20, 20, 20)]
        a.setup(f); a.cmd("Loft"); a.wait(0.8)
        chk("L2 varsayılan: son iki profil seçili (Profil2, Profil3)", "Profil2 (1.)" in a.pmtext() and "Profil3 (2.)" in a.pmtext(), a.pmtext()[:200])
        # SolidWorks sırası: Profil1, Profil2, Profil3 → önce Profil2/3 kaldır, sonra sırayla işaretle
        a.pmcheck("Profil2", False); a.pmcheck("Profil3", False)
        a.pmcheck("Profil1"); a.pmcheck("Profil2"); a.pmcheck("Profil3"); a.wait(0.3)
        chk("L2 seçim sırası 1., 2., 3.", "Profil1 (1.)" in a.pmtext() and "Profil3 (3.)" in a.pmtext(), a.pmtext()[:250])
        a.pmcheck("Düz yüzeyli"); a.wait(1.5)
        vr = a.vol()
        a.pmcheck("Düz yüzeyli", False); a.wait(1.5)
        vs = a.vol()
        a.ok()
        chk("L2a 3 profil düz yüzeyli → 2 × 28000", near(vr, 56000, 2), vr)
        chk("L2a 3 profil düzgün (smooth) → farklı ve hatasız", vs and not near(vs, 56000, 2) and not a.errs_map(), (vs, a.errs_map()))
        nm = a.names()[-1]
        a.edit_feat(nm); a.pmcheck("Kapalı loft"); a.wait(1.5); st = a.status(); a.ok()
        print("   L3 kapalı loft (düz dizili 3 profil):", a.vol(), st, a.errs_map())
        if a.mode() == "pm": a.cancel("discard")  # v0.90: düz dizili kapalı loft hata verir, ✓ engellenir (D4-11)
    case("L2", l2)

    def l3():
        a.setup(base2()); a.cmd("Loft"); a.wait(0.8)
        a.pmcheck("Kapalı loft"); a.wait(1.5)
        st = a.status()
        a.btn("#pm-ok"); time.sleep(0.8)
        chk("L3 iki profilde kapalı loft → anlamlı hata, ✓ engellenir", a.mode() == "pm" and ("3" in st or "profil" in st.lower()), (st, a.mode(), a.toast()))
        if a.mode() == "pm":
            a.cancel("discard")
    case("L3", l3)

    def l4():
        a.setup(base2()); a.cmd("Loft"); a.wait(0.8)
        a.pmcheck("İnce özellik (uçlar"); a.wait(1.5); a.ok()
        lat = 4 * 30 * math.hypot(30, 10)
        chk("L4a ince loft t2 → yanal alan × 2 (±%10), 10 yüz", near(a.vol(), lat * 2, lat * 0.2) and a.faces() == 10, (a.vol(), round(lat * 2, 1), a.faces()))
        nm = a.names()[-1]
        a.edit_feat(nm); a.pmfield("İnce kalınlık", 1); a.ok()
        v1 = a.vol()
        chk("L4b ince kalınlık 1 → yaklaşık yarısı", near(v1, lat, lat * 0.2), v1)
    case("L4", l4)

    def l5():
        c = sketch("c", "Merkez", FRONT, lambda pt, line, rect, cc, t: line(pt(0, 0), pt(0, 30)))
        a.setup(base2() + [c]); a.cmd("Loft"); a.wait(0.8)
        a.pmselect("Merkez çizgisi", "c"); a.wait(1.5)
        chk("L5 merkez çizgisi seçilince bağlayıcılar gizlenir", not a.pmhas("Bağlayıcıları kullan"))
        a.ok()
        chk("L5a düz merkez çizgisi → ≈ 28000 (±%1)", near(a.vol(), 28000, 280), (a.vol(), a.errs_map()))
        kids = a.ev("[...document.querySelectorAll('#tree li.child')].map(l=>l.textContent.trim())")
        chk("L5a merkez çizgisi eskizi çocuk", "Merkez" in kids, kids)
    case("L5", l5)

    def l6():
        g = sketch("g", "Kılavuz", FRONT, lambda pt, line, rect, cc, t: line(pt(20, 0), pt(10, 30)))
        a.setup(base2() + [g]); a.cmd("Loft"); a.wait(0.8)
        a.pmcheck("Kılavuz"); a.wait(1.5); a.ok()
        chk("L6a düz kılavuz (profil kenarlarında) → ≈ 28000 (±%2)", near(a.vol(), 28000, 560), (a.vol(), a.errs_map()))
        g2 = sketch("g", "Kılavuz", FRONT, lambda pt, line, rect, cc, t: line(pt(20, 0), pt(10, 30)))
        # yay kılavuz: (20,0) → (10,30) dışa şişkin, merkez (-10, 20) civarı → 3 noktalı yay yerine iki doğru: (20,0)→(25,15)→(10,30)
        g3 = sketch("g", "Kılavuz", FRONT, lambda pt, line, rect, cc, t: (lambda A, Bp, C: (line(A, Bp), line(Bp, C)))(pt(20, 0), pt(26, 15), pt(10, 30)))
        a.setup(base2() + [g3]); a.cmd("Loft"); a.wait(0.8)
        a.pmcheck("Kılavuz"); a.wait(1.5); a.ok()
        print("   L6 dışa kırık kılavuz:", a.vol(), a.bbox(), a.errs_map())
        chk("L6a dışa şişkin kılavuz → hacim > 28000 ve x en büyük ≈ 26", a.vol() > 28500 and near(a.bbox()[1][0], 26, 1.5), (a.vol(), a.bbox()))
    case("L6", l6)

    def l7():
        a.setup(base2()); a.cmd("Loft"); a.wait(0.8)
        a.pmcheck("Bağlayıcıları kullan"); a.wait(1.0); v0 = a.vol()
        loc = a.pg.locator("#pm-body label.pm-field:has-text('başlangıç köşesi') input")
        chk("L7 her profil için başlangıç köşesi alanı", loc.count() == 2, loc.count())
        loc.nth(1).fill("1"); loc.nth(1).press("Tab"); a.wait(1.5); v1 = a.vol()
        a.ok()
        chk("L7a bağlayıcı köşe 0 → 28000; köşe 1 → burulmuş, farklı hacim", near(v0, 28000, 1) and not near(v1, 28000, 5), (v0, v1, a.errs_map()))
        nm = a.names()[-1]
        a.edit_feat(nm)
        loc = a.pg.locator("#pm-body label.pm-field:has-text('başlangıç köşesi') input")
        chk("L7b düzenlemede köşe 1 korunur", loc.nth(1).input_value() == "1", loc.nth(1).input_value())
        a.pmcheck("Bağlayıcıları kullan", False); a.ok()
        chk("L7b bağlayıcı kapat → 28000", near(a.vol(), 28000, 1), a.vol())
    case("L7", l7)

    def l8():
        a.setup(base2()); a.cmd("Loft"); a.wait(0.8)
        a.pmselect("Başlangıç kısıtı", "1"); a.wait(1.5); v1 = a.vol()
        a.pmselect("Bitiş kısıtı", "1"); a.wait(1.5); v2 = a.vol()
        fld = a.pg.locator("#pm-body label.pm-field:has-text('Başlangıç teğet uzunluğu') input")
        fld.fill("3"); fld.press("Tab"); a.wait(1.5); v3 = a.vol()
        a.ok()
        print("   L8 profile dik: başlangıç", v1, "+bitiş", v2, "uzunluk 3", v3, a.errs_map())
        chk("L8a profile dik kısıt hacmi değiştirir ve teğet uzunluğu etkiler", v1 and v2 and v3 and not near(v1, 28000, 5) and not near(v3, v2, 1), (v1, v2, v3))
        a.reload()
        chk("L8e yenile → aynı", near(a.vol(), v3, 1), a.vol())
    case("L8", l8)

    def l9():
        a.setup(base2()); a.cmd("Loft"); a.wait(0.8)
        a.pmcheck("Sac geçiş parçası"); a.wait(1.5)
        chk("L9 sac geçiş: düz yüzeyli otomatik, Açınım (DXF) düğmesi", a.pg.locator("#pm-body label.pm-check:has-text('Düz yüzeyli') input").first.is_checked() and a.pmhas("Sac kalınlığı"))
        with a.pg.expect_download(timeout=20000) as dl:
            a.pmbtn("Açınım (DXF indir)")
        chk("L9 açınım DXF indirildi", dl.value.suggested_filename.endswith(".dxf"), dl.value.suggested_filename)
        a.ok()
        chk("L9a sac geçiş katı (ince cidar)", a.vol() and a.vol() < 28000 and not a.errs_map(), (a.vol(), a.errs_map()))
    case("L9", l9)

    def l10():
        f = block() + [rect_sk("q1", "Üst", top_face(20), -10, -10, 10, 10), refplane("pl1", "Düzlem1", TOP, 5),
                       rect_sk("q2", "Alt", {"k": "ref", "id": "pl1"}, -5, -5, 5, 5)]
        a.setup(f); a.cmd("Loft"); a.wait(0.8)
        a.pmseg("Kes"); a.wait(1.5); a.ok()
        rem = 96000 - a.vol()
        chk("L10a loft kesme 20²→10², h15 → 3500", near(rem, FR(400, 100, 15), 1), (rem, a.errs_map()))
        nm = a.names()[-1]
        chk("L10a ağaç adı kesme (SW: Kesme-Loft)", "Kes" in nm, nm)
        a.edit_feat(nm); a.pmcheck("Düz yüzeyli"); a.ok()
        chk("L10b düz yüzeyli → aynı", near(96000 - a.vol(), FR(400, 100, 15), 1), 96000 - a.vol())
        a.tact("Alt", "Eskizi düzenle"); a.dim_dbl(0, 4); a.ok()
        print("   L10c alt profil 10→4 genişlik:", 96000 - a.vol(), a.errs_map())
        chk("L10c profil değişince kesme yeniden kurulur", not near(96000 - a.vol(), FR(400, 100, 15), 1) and not a.errs_map(), 96000 - a.vol())
        a.undo(); a.redo()
        chk("L10d geri al / ileri al", not a.errs_map(), a.errs_map())
    case("L10", l10)

    print("hatalar:", a.errs)
    a.close()
finish()

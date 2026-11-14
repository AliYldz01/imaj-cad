# Denetim 2 / d7 — Yüzey Loft (açık / kapalı), Sınır Doldur (kenar tıklama), Yüzey Kırp (Sağ / Ön / Üst düzlem, yüzeyle, taraf),
# Yüzey Dik (kabuk / katı) ve zincir yeniden kurma (eskiz ölçüsü değişince kırp → dik → kalınlaştır).
# Hazır model: yalnız eskizler ve referans düzlemi (setDoc). Kullanıcı adımları gerçek tıklama / klavye.
import sys
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d7h import *  # noqa

FR = lambda a1, a2, h: h / 3 * (a1 + a2 + math.sqrt(a1 * a2))

with sync_playwright() as p:
    a = App(p)
    case = lambda n, f: run_case(a, n, f)

    def edge_mid(pred_js):
        return a.ev("p=>{const m=window.__app.viewer.mesh;const fn=eval(p);return m.edges.filter(fn).map(e=>e.m)}", pred_js)

    # ---------------- L1: açık yollardan yüzey loft ----------------
    def l1():
        a.setup([line_sk("q1", "Yol1", TOP, -30, 0, 30, 0), refplane("pl1", "Düzlem1", TOP, 40),
                 line_sk("q2", "Yol2", {"k": "ref", "id": "pl1"}, -30, 0, 30, 0)])
        a.cmd("Yüzey Loft"); a.wait(0.6)
        txt = a.pmtext()
        print("   L1 PM:", txt[:200].replace("\n", " | "))
        a.pmcheck("Yol1"); a.pmcheck("Yol2"); a.wait(0.8)
        a.ok()
        m = mesh_info(a)
        chk("L1a iki açık yol → 1 yüz 60×40", m and m["f"] == 1 and m["bb"] == [[-30, 0, 0], [30, 40, 0]], (m, a.errs_map(), a.status()))
        nm = [f for f in surf_feats(a) if f["mode"] == "loft"][0]["name"]
        a.cmd("Kalınlaştır"); a.wait(0.5); a.pmfield("Kalınlık", 2); a.wait(0.6); a.ok()
        chk("L1a kalınlaştır → 4800", near(a.vol(), 4800, 1), a.vol())
        a.tact("Yol2", "Eskizi düzenle"); a.dim_dbl(0, 80); a.ok()
        chk("L1c Yol2 60→80 → yamuk (60+80)/2·40·2 = 5600", near(a.vol(), 5600, 2) and not a.errs_map(), (a.vol(), a.errs_map()))
        a.undo(); u = a.vol(); a.redo(); r = a.vol()
        chk("L1d geri al / ileri al", near(u, 4800, 1) and near(r, 5600, 2), (u, r))
        a.reload(); chk("L1e yenile", near(a.vol(), 5600, 2), a.vol())
        # b: düzenle → sıra ters (Yol2, Yol1) yine aynı yüzey
        a.edit_feat(nm); a.pmcheck("Yol1", False); a.pmcheck("Yol1"); a.wait(0.8)
        pt = a.pmtext()
        a.ok()
        chk("L1b sıra değişince (Yol2 1., Yol1 2.) aynı sonuç", "Yol2 (1.)" in pt and near(a.vol(), 5600, 2), (pt[:120], a.vol()))
        # açık + kapalı karışık hata
        a.setup([line_sk("q1", "Yol1", TOP, -30, 0, 30, 0), refplane("pl1", "Düzlem1", TOP, 40),
                 rect_sk("q2", "Kare", {"k": "ref", "id": "pl1"}, -10, -10, 10, 10)])
        a.cmd("Yüzey Loft"); a.wait(0.5); a.pmcheck("Yol1"); a.pmcheck("Kare"); a.wait(0.8)
        st = a.status(); a.ok(); a.wait(0.3)
        chk("L1 açık + kapalı karışık → Türkçe hata, eklenmez", a.mode() == "pm" and "açık" in st, (a.mode(), st))
        if a.mode() == "pm":
            a.cancel("discard")
        a.cmd("Yüzey Loft"); a.wait(0.5); a.pmcheck("Yol1"); a.wait(0.5)
        st = a.status(); a.ok(); a.wait(0.3)
        chk("L1 tek kesit → 'en az iki' hatası", a.mode() == "pm" and "iki" in st, (a.mode(), st))
        if a.mode() == "pm":
            a.cancel("discard")
    case("L1", l1)

    # ---------------- L2: kapalı profillerle loft + iki düzlemsel kapak + dik (katı) zinciri ----------------
    def l2():
        a.setup([rect_sk("q1", "Alt", TOP, -20, -20, 20, 20), refplane("pl1", "Düzlem1", TOP, 30),
                 rect_sk("q2", "Ust", {"k": "ref", "id": "pl1"}, -10, -10, 10, 10)])
        a.cmd("Yüzey Loft"); a.wait(0.5); a.pmcheck("Alt"); a.pmcheck("Ust"); a.wait(0.8); a.ok()
        m = mesh_info(a)
        chk("L2a kapalı profiller → 4 yan yüz (uçlar açık)", m and m["f"] == 4, (m, a.errs_map()))
        a.cmd("Düzlemsel Yüzey"); a.wait(0.5); a.pmselect("Eskiz", "q1"); a.wait(0.5); a.ok()
        a.cmd("Düzlemsel Yüzey"); a.wait(0.5); a.pmselect("Eskiz", "q2"); a.wait(0.5); a.ok()
        a.cmd("Yüzey Dik"); a.wait(0.6)
        pt = a.pmtext()
        print("   L2 Dik PM:", pt.replace("\n", " | ")[:200])
        a.pmcheck("Kapalıysa katı oluştur"); a.wait(1.0); a.ok()
        exp = FR(1600, 400, 30)
        chk("L2a dik (katı) → kesik piramit 28000, 1 gövde, 6 yüz", near(a.vol(), exp, 2) and a.bodies() == 1 and a.faces() == 6, (a.vol(), a.bodies(), a.faces(), a.errs_map()))
        kn = [f for f in surf_feats(a) if f["type"] == "knit"][0]["name"]
        a.tact("Ust", "Eskizi düzenle"); a.dim_dbl(0, 30); a.ok()
        exp2 = 30 / 6 * (1600 + 600 + 4 * 35 * 30)   # 30×20 üst (yalnız genişlik değişti)
        v = a.vol()
        print("   L2c Ust genişlik 20→30:", v, a.errs_map())
        chk("L2c üst profil değişince loft + kapak + dik zinciri yeniden kurulur", near(v, exp2, 3) and not a.errs_map(), (v, exp2, a.errs_map()))
        a.undo(); u = a.vol(); a.redo(); r = a.vol()
        chk("L2d geri al / ileri al", near(u, exp, 2) and near(r, exp2, 3), (u, r))
        a.reload(); chk("L2e yenile", near(a.vol(), exp2, 3), a.vol())
        # b: dik düzenle → katı kapalı → kabuk
        a.edit_feat(kn); a.pmcheck("Kapalıysa katı oluştur", False); a.wait(0.8); a.ok()
        m = mesh_info(a)
        chk("L2b katı kapatılınca kabuk (hacim 0, 6 yüz)", (a.vol() or 0) == 0 and m and m["f"] == 6, (a.vol(), m))
        a.edit_feat(kn); a.pmcheck("Kapalıysa katı oluştur"); a.wait(0.8); a.cancel("discard")
        chk("L2f ✕ → kabuk kaldı", (a.vol() or 0) == 0, a.vol())
        # g: üst kapağı bastır → dik katı olamaz
        a.edit_feat(kn); a.pmcheck("Kapalıysa katı oluştur"); a.wait(0.8); a.ok()
        names = a.names()
        cap = [n for n in names if n.startswith("Düzlemsel")][-1]
        a.tact(cap, "Bastır"); a.wait(0.8)
        if a.pg.locator("dialog.reselect-dialog[open]").count():
            print("   L2g: 'Eksik referans' penceresi açıldı")
            a.btn("dialog.reselect-dialog[open] button:has-text('Daha sonra')")
        e = a.errs_map()
        print("   L2g üst kapak bastırılınca:", a.vol(), e)
        offs = a.ev("window.__app.doc.features.filter(f=>f.off).map(f=>f.type)")
        chk("L2g kapak bastırılınca Dik hatası anlaşılır ya da Dik de bastırılır (v0.90 D7-17)", (bool(e) and any("yüzey" in x.lower() or "hacim" in x.lower() for x in e.values())) or "knit" in offs, (e, offs))
        a.tact(cap, "Etkinleştir"); a.wait(0.6)
        if a.pg.locator("dialog.reselect-dialog[open]").count():
            a.btn("dialog.reselect-dialog[open] button:has-text('Daha sonra')")
        chk("L2g etkinleştir → katı geri", near(a.vol(), exp2, 3), a.vol())
    case("L2", l2)

    # ---------------- F1: sınır doldur (kenar tıklama) + dik ----------------
    def f1():
        a.setup([rect_sk("s1", "Kontur", TOP, -20, -15, 20, 15)])
        a.cmd("Yüzey Ekstrüzyon"); a.wait(0.5); a.pmfield("Mesafe", 20); a.wait(0.5); a.ok()
        a.cmd("Düzlemsel Yüzey"); a.wait(0.5); a.pmselect("Eskiz", "s1"); a.ok()
        a.pg.click(".vcube .iso") if a.pg.locator(".vcube .iso").count() else None
        a.wait(0.5)
        tops = edge_mid("e=>Math.abs(e.m[1]-20)<1e-3")
        chk("F1 duvar yüzeyinin üst kenarları 4", len(tops) == 4, tops)
        a.cmd("Sınır Doldur"); a.wait(0.5)
        for m_ in tops:
            a.wclick(m_); a.wait(0.3)
        pt = a.pmtext()
        chk("F1a PM'de 4 kenar tıklandı → '4 kenar seçili'", "4 kenar seçili" in pt, pt[:150])
        a.wait(1.0); a.ok(); a.wait(0.4)
        st = a.status()
        print("   F1a PM'de kenar seçip ✓:", a.mode(), st, a.toast())
        chk("F1a PM'de kenarlar seçilip ✓ → Sınır Doldur oluşur (eski 'kenarları seçin' hatası ✓'yi engellemez)", a.mode() == "part", (a.mode(), st))
        if a.mode() == "pm":
            a.cancel("discard")
            # geçici yol: kenarları önce seç (Ctrl+tık), sonra komut
            a.pg.keyboard.press("Escape"); time.sleep(0.2)
            a.pg.keyboard.down("Control")
            for m_ in tops:
                s_ = a.wsc(m_); a.pg.mouse.click(s_[0], s_[1]); time.sleep(0.25)
            a.pg.keyboard.up("Control")
            a.cmd("Sınır Doldur"); a.wait(1.0)
            print("   F1a önceden seçili kenarlarla:", a.pmtext()[:60].replace(chr(10), ' '))
            a.ok()
        a.cmd("Yüzey Dik"); a.wait(0.5); a.pmcheck("Kapalıysa katı oluştur"); a.wait(0.8); a.ok()
        chk("F1a dik → 24000 katı", near(a.vol(), 24000, 2), (a.vol(), a.errs_map()))
        a.tact("Kontur", "Eskizi düzenle"); a.dim_dbl(0, 50); a.ok()
        v = a.vol(); e = a.errs_map()
        if a.pg.locator("dialog.reselect-dialog[open]").count():
            print("   F1c 'Eksik referans' penceresi")
            a.btn("dialog.reselect-dialog[open] button:has-text('Daha sonra')")
        print("   F1c kontur 40→50:", v, e, [f["edges"] if False else None for f in []])
        chk("F1c kontur 40→50 → doldurma kenarları izler, katı 30000", near(v, 30000, 3) and not e, (v, e))
        a.undo(); u = a.vol()
        chk("F1d geri al", near(u, 24000, 2), u)
        a.reload(); chk("F1e yenile (geri alınmış hâl 24000)", near(a.vol(), 24000, 2), a.vol())
        # b: doldurmayı düzenle → seçimi temizle → ✓
        fn = [f for f in surf_feats(a) if f["mode"] == "fill"][0]["name"]
        a.edit_feat(fn)
        if a.pg.locator("#pm-body button:has-text('Seçimi temizle')").count():
            a.pmbtn("Seçimi temizle")
        st = a.status(); a.ok(); a.wait(0.3)
        chk("F1b kenarsız ✓ → hata, eklenmez / değişmez", a.mode() == "pm", (a.mode(), st))
        if a.mode() == "pm":
            a.cancel("discard")
        # yalnız 3 kenar (açık döngü)
        a.setup([rect_sk("s1", "Kontur", TOP, -20, -15, 20, 15)])
        a.cmd("Yüzey Ekstrüzyon"); a.wait(0.5); a.pmfield("Mesafe", 20); a.wait(0.5); a.ok()
        tops = edge_mid("e=>Math.abs(e.m[1]-20)<1e-3")
        a.cmd("Sınır Doldur"); a.wait(0.5)
        for m_ in tops[:3]:
            a.wclick(m_); a.wait(0.3)
        a.wait(0.8); st = a.status(); a.ok(); a.wait(0.5)
        m = mesh_info(a)
        print("   F1 3 kenar (açık sınır):", a.mode(), st, m, a.errs_map())
        chk("F1 açık sınır (3 kenar) → anlaşılır hata, sessiz yüzey yok", a.mode() == "pm" or a.errs_map(), (a.mode(), st, m))
        if a.mode() == "pm":
            a.cancel("discard")
    case("F1", f1)

    # ---------------- T1: yüzey kırp (düzlemlerle, yüzeyle) + zincir ----------------
    def t1():
        a.setup([rect_sk("s1", "Plan", TOP, -20, -15, 20, 15), refplane("pl1", "Düzlem1", RIGHT, 10)])
        a.cmd("Düzlemsel Yüzey"); a.wait(0.5); a.ok()
        a.cmd("Yüzey Kırp"); a.wait(0.6)
        opts = a.ev("[...document.querySelectorAll('#pm-body label.pm-field')].find(l=>l.textContent.includes('Kırpma aracı')).querySelector('select').options.length && [...[...document.querySelectorAll('#pm-body label.pm-field')].find(l=>l.textContent.includes('Kırpma aracı')).querySelector('select').options].map(o=>o.textContent)")
        print("   T1 kırpma aracı seçenekleri:", opts)
        chk("T1 kırpma aracı listesinde referans düzlem (Düzlem1) var", "Düzlem1" in (opts or []), opts)
        a.ok()
        m = mesh_info(a)
        chk("T1a Sağ düzlem, taraf 1 kalsın → x ≥ 0 yarısı 20×30", m and m["bb"] == [[0, 0, -15], [20, 0, 15]], m)
        tn = [f for f in surf_feats(a) if f["type"] == "surftrim"][0]["name"]
        a.edit_feat(tn); a.pmseg("Taraf 2 kalsın"); a.wait(0.6); a.ok()
        m = mesh_info(a)
        chk("T1b taraf 2 → x ≤ 0", m and m["bb"] == [[-20, 0, -15], [0, 0, 15]], m)
        a.edit_feat(tn); a.pmselect("Kırpma aracı", "std:front"); a.wait(0.6); a.ok()
        m = mesh_info(a)
        chk("T1b Ön düzlem → z yarısı", m and m["bb"][1][0] == 20 and (m["bb"][0][2] == 0 or m["bb"][1][2] == 0), m)
        a.edit_feat(tn); a.pmselect("Kırpma aracı", "std:top"); a.wait(1.0)
        st = a.status(); a.ok(); a.wait(0.4)
        m = mesh_info(a)
        print("   T1 yüzeyle aynı düzlem (Üst) aracı:", a.mode(), st, m, a.errs_map())
        chk("T1 eş düzlemli araç (Üst düzlem) → anlaşılır hata ya da değişmez", a.mode() == "pm" or a.errs_map() or (m and m["f"] == 1 and m["bb"] == [[-20, 0, -15], [20, 0, 15]]), (st, m))
        if a.mode() == "pm":
            a.cancel("discard")
        a.edit_feat(tn); a.pmselect("Kırpma aracı", "std:right"); seg_click(a, "Taraf 1 kalsın"); a.wait(0.6); a.ok()
        a.cmd("Kalınlaştır"); a.wait(0.5); a.pmfield("Kalınlık", 2); a.wait(0.6)
        sel = a.pmselval("Yüzey")
        a.ok()
        chk("T1 kalınlaştır varsayılan yüzeyi = kırpılmış yüzey → 1200", sel == a.featbyname(tn)["id"] and near(a.vol(), 1200, 1), (sel, a.vol()))
        a.tact("Plan", "Eskizi düzenle"); a.dim_dbl(0, 60); a.ok()
        v = a.vol(); bb = a.bbox()
        print("   T1c Plan 40→60:", v, bb)
        chk("T1c eskiz değişince kırp + kalınlaştır yeniden kuruldu (x ≥ 0 kısmı × 30 × 2)", v and near(v, bb[1][0] * 30 * 2, 1) and bb[0][0] == 0, (v, bb))
        a.undo(); u = a.vol(); a.redo(); r = a.vol()
        chk("T1d geri al / ileri al", near(u, 1200, 1) and near(r, v, 1), (u, r))
        a.reload(); chk("T1e yenile", near(a.vol(), v, 1), a.vol())
        a.tact(tn, "Bastır"); a.wait(0.8)
        if a.pg.locator("dialog.reselect-dialog[open]").count():
            a.btn("dialog.reselect-dialog[open] button:has-text('Daha sonra')")
        e = a.errs_map(); vv = a.vol()
        print("   T1g kırp bastırılınca:", vv, e)
        chk("T1g kırp bastırılınca kalınlaştır kırpılmamış yüzeyi kullanır ya da çocuk bastırılır (SolidWorks: kalınlaştır da bastırılır)", not e, (vv, e))
        a.tact(tn, "Etkinleştir"); a.wait(0.6)
        if a.pg.locator("dialog.reselect-dialog[open]").count():
            a.btn("dialog.reselect-dialog[open] button:has-text('Daha sonra')")
        # yüzeyle kırp: kırpılacak yüzey önce, araç yüzey sonra oluşturulmuş (olağan sıra)
        s2 = line_sk("s2", "Kesen", RIGHT, -50, 5, 50, 5, dim=False)
        a.setup([rect_sk("s1", "Plan", FRONT, -20, 0, 20, 30), s2])
        a.cmd("Düzlemsel Yüzey"); a.wait(0.5); a.pmselect("Eskiz", "s1"); a.ok()
        a.cmd("Yüzey Ekstrüzyon"); a.wait(0.5); a.pmselect("Eskiz", "s2"); a.pmfield("Mesafe", 100); a.pmcheck("Orta düzlem"); a.wait(0.5); a.ok()
        a.cmd("Yüzey Kırp"); a.wait(0.6)
        sfs = surf_feats(a)
        a.pmselect("Kırpılacak yüzey", sfs[0]["id"]); a.wait(0.6)
        topts = a.ev("[...[...document.querySelectorAll('#pm-body label.pm-field')].find(l=>l.textContent.includes('Kırpma aracı')).querySelectorAll('option')].map(o=>o.value)")
        dr = a.ev("({s:window.__app.mode.draft.surf,t:window.__app.mode.draft.tool})")
        print("   T1 kırpılacak yüzey değişince araç listesi:", topts, dr)
        chk("T1 kırpılacak yüzey değişince araç listesi yenilenir (Yüzey2 seçilebilir, kendisi listede yok)", sfs[1]["id"] in topts and sfs[0]["id"] not in topts, (topts, dr))
        st = None
        if sfs[1]["id"] in topts:
            a.pmselect("Kırpma aracı", sfs[1]["id"]); a.wait(0.8); a.ok()
        else:
            a.wait(0.8); st = a.status(); a.ok(); a.wait(0.4)
            print("   T1 araç = kırpılan yüzey ile ✓:", a.mode(), st)
            chk("T1 araç = kırpılacak yüzey olamaz (anlaşılır hata)", "aynı" in (st or ""), st)
            a.cancel("discard")
            # geçici yol: önce araç yüzeyi, sonra kırpılacak yüzey oluşturulursa varsayılanlar doğru
            a.setup([rect_sk("s1", "Plan", FRONT, -20, 0, 20, 30), s2])
            a.cmd("Yüzey Ekstrüzyon"); a.wait(0.5); a.pmselect("Eskiz", "s2"); a.pmfield("Mesafe", 100); a.pmcheck("Orta düzlem"); a.wait(0.5); a.ok()
            a.cmd("Düzlemsel Yüzey"); a.wait(0.5); a.pmselect("Eskiz", "s1"); a.ok()
            a.cmd("Yüzey Kırp"); a.wait(0.8); a.ok()
        m = mesh_info(a)
        print("   T1 yüzeyle kırp:", m, a.errs_map())
        chk("T1 yüzeyle kırp: 40×30 düzlem y=5'te kesilir, araç yüzeyi kalır (2 yüz)", m and m["f"] == 2 and not a.errs_map(), m)
        f2 = [f for f in surf_feats(a) if f["type"] == "surftrim"][0]["name"]
        a.cmd("Kalınlaştır"); a.wait(0.5); a.pmselect("Yüzey", a.featbyname(f2)["id"]); a.pmfield("Kalınlık", 2); a.wait(0.6); a.ok()
        v1 = a.vol()
        a.edit_feat(f2); a.pmseg("Taraf 2 kalsın"); a.wait(0.6); a.ok()
        v2 = a.vol()
        chk("T1 yüzeyle kırp taraf 1 / 2 → 40·5·2 = 400 ve 40·25·2 = 2000", sorted([round(v1 or 0), round(v2 or 0)]) == [400, 2000], (v1, v2))
    case("T1", t1)

    # ---------------- K1: dik (kabuk) + kalınlaştır, hatalar ----------------
    def k1():
        a.setup([rect_sk("s1", "Taban", TOP, 0, 0, 40, 30), line_sk("s2", "Duvar", FRONT, 0, 0, 40, 0)])
        a.cmd("Düzlemsel Yüzey"); a.wait(0.5); a.pmselect("Eskiz", "s1"); a.ok()
        a.cmd("Yüzey Ekstrüzyon"); a.wait(0.5); a.pmselect("Eskiz", "s2"); a.pmfield("Mesafe", 20); a.wait(0.5); a.ok()
        mb = mesh_info(a)
        print("   K1 taban + duvar:", mb)
        a.cmd("Yüzey Dik"); a.wait(0.5)
        a.pmcheck("Kapalıysa katı oluştur"); a.wait(0.8)
        st = a.status(); a.ok(); a.wait(0.4)
        chk("K1 açık yüzeylerle 'katı oluştur' → kapalı hacim hatası", a.mode() == "pm" and "kapalı" in st, (a.mode(), st))
        if a.mode() == "pm":
            a.pmcheck("Kapalıysa katı oluştur", False); a.wait(0.6); a.ok()
        m = mesh_info(a)
        chk("K1 dik (kabuk) → 2 yüz tek kabuk", m and m["f"] == 2, m)
        a.cmd("Kalınlaştır"); a.wait(0.5); a.pmfield("Kalınlık", 2); a.wait(0.8); a.ok()
        v = a.vol()
        th = [f for f in surf_feats(a) if f["type"] == "thicken"][0]["name"]
        a.edit_feat(th); a.pmseg("Taraf 2"); a.wait(0.8); a.ok()
        v2 = a.vol()
        print("   K1 L kabuğu kalınlaştır:", v, v2, mb)
        # NOT (v0.87): "Duvar" Ön düzlemde y=0 doğrusu → Ön düzleme dik çekilince taban ile AYNI düzlemde (y=0) kalır;
        # yani kabuk L değil, 40×50 düz levhadır: 40·50·2 = 4000 her iki tarafta doğru sonuçtur (önceki 3840/4160 beklentisi yanlıştı).
        chk("K1 dikilmiş (düzlemdeş) kabuğu kalınlaştır: 4000 / 4000", sorted([round(v or 0), round(v2 or 0)]) == [4000, 4000], (v, v2))
    case("K1", k1)

    print("SAYFA HATALARI:", a.errs[:5])
    finish()

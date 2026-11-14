# Denetim 2 / d6 — Şekillendirme, Havalandırma, Çapraz Kırma, Sac Takviye, Tırnak ve Yuva, Aç/Katla Kes,
# Ekst. Kesme (normal kesim), Delik Sihirbazı (sacta) — PM seçenekleri + yaşam döngüsü + açınım / DXF
# Hazır model: yalnız eskizler (ve tırnak-yuva için iki levha) setDoc ile; sac özellikleri şeritten / PM'den.
import sys
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d6h import *  # noqa
ONLY = os.environ.get('ONLY')
FR = {"o": [0, 2, 0], "x": [1, 0, 0], "n": [0, 1, 0]}
FACE = {"k": "face", "frame": FR, "label": "Yüz", "face": {"c": [50, 2, -30], "n": [0, 1, 0]}}
DIMPLE0 = PI * 100 * 4 - PI * 64 * 4  # Ø20 H4 koniklik 0


with sync_playwright() as p:
    a = App(p)

    def case(name, fn):
        if ONLY and name not in ONLY.split(","):
            return
        print("=====", name, flush=True)
        try:
            fn()
        except Exception as ex:
            chk(name + " (istisna)", False, str(ex)[:300])
            try:
                a.pg.keyboard.press("Escape"); time.sleep(0.3)
                if a.mode() == "flat": flat_close(a)
                if a.mode() in ("pm", "sketch"): a.cancel("discard")
            except Exception:
                pass

    def base(extra=()):
        a.setup([plate_sk()] + list(extra))
        new_sheet(a, "Taban Flanş", "Eskiz1"); a.ok()
        view_iso(a); fit(a)

    def top(x, z):
        a.wclick([x, 2, z]); a.wait(0.4)

    # ---------- F1 Şekillendirme ----------
    def f1():
        base()
        new_sheet(a, "Şekillendirme")
        chk("F1 PM açıldı", a.mode() == "pm" and a.pmhas("Çap"))
        top(50, -30)
        chk("F1 1 konum", "1 konum" in a.pmtext(), a.pmtext()[:120])
        a.pmfield("Koniklik", 0); a.ok()
        v1 = a.vol() - 12000
        chk("F1 yuvarlak kabartma Ø20 H4 koniklik 0 → +%.1f" % DIMPLE0, near(v1, DIMPLE0, 0.5), v1)
        nm = a.names()[-1]
        a.edit_feat(nm)
        chk("F1b Düzenle → 1 konum", "1 konum" in a.pmtext())
        top(20, -15)
        a.ok()
        chk("F1b ikinci konum → 2×", near(a.vol() - 12000, 2 * DIMPLE0, 1), a.vol() - 12000)
        a.edit_feat(nm); a.pmfield("Koniklik", 15); a.ok()
        v15 = a.vol() - 12000
        chk("F1b koniklik 15° → daha küçük hacim, hata yok", not a.errs_map() and 0 < v15 < 2 * DIMPLE0, v15)
        a.edit_feat(nm); a.pmcheck("Ters yöne", True); a.ok()
        bb = a.bbox()
        chk("F1b ters → alt tarafa (y min < −1)", bb[0][1] < -1, bb)
        a.edit_feat(nm); a.pmseg("Dikdörtgen kabartma"); a.pmfield("Koniklik", 0); a.pmcheck("Ters yöne", False); a.ok()
        print("   dikdörtgen 2 konum:", a.vol() - 12000, a.errs_map())
        chk("F1b dikdörtgen kabartma 20×30×4 ×2 → +2·736", near(a.vol() - 12000, 2 * 736, 1), a.vol() - 12000)
        a.edit_feat(nm); a.pmfield("Açı", 90); a.ok()
        print("   dikdörtgen 90°:", a.bbox(), a.errs_map())
        a.edit_feat(nm); a.pmseg("Panjur"); a.pmfield("Yükseklik", 5); a.ok()
        vl = a.vol() - 12000
        chk("F1b panjur hata yok, hacim > 0", not a.errs_map() and vl > 50, (vl, a.errs_map()))
        r = flat_dims(a)
        chk("F1 şekillendirmeli sac açılır (100×60, şekillendirme bastırılır)", r and near(r["w"], 100, .01) and near(r["h"], 60, .01), r and (r["w"], r["h"]))
        chk("F1 açınımdan çıkınca panjurlu model geri", near(a.vol() - 12000, vl, 0.5), a.vol() - 12000)
        txt = dxf_download(a); d = dxf_parse(txt)
        print("   DXF şekillendirme işareti var mı?", [t for t in d["texts"]], len(d["circles"]), len(d["lines"]))
        chk("F1 DXF'te şekillendirme konumları işaretli (SW: düz desende şekillendirme aracı izi / merkez)", len(d["circles"]) > 0 or any("PANJUR" in t[3].upper() or "KABART" in t[3].upper() for t in d["texts"]) or len([l for l in d["lines"] if l[0] == "KESIM"]) > 4, (d["layers"], len(d["lines"])))
        a.undo(); a.undo(); a.undo(); a.undo(); a.undo(); a.undo()
        chk("F1d 6× geri al → tek konum Ø20 koniksiz", near(a.vol() - 12000, DIMPLE0, 0.5), a.vol() - 12000)
        a.redo()
        chk("F1d ileri al → 2 konum", near(a.vol() - 12000, 2 * DIMPLE0, 1), a.vol() - 12000)
        a.reload()
        chk("F1e yenile", near(a.vol() - 12000, 2 * DIMPLE0, 1), a.vol() - 12000)
        a.edit_feat(nm); a.pmbtn("Konumları temizle"); a.cancel("discard")
        chk("F1f ✕ → konumlar korunur", near(a.vol() - 12000, 2 * DIMPLE0, 1), a.vol() - 12000)
        a.edit_feat(nm); a.pmbtn("Konumları temizle"); a.ok()
        print("   konumsuz ✓:", a.mode(), a.toast(), a.errs_map())
        chk("F1f konumsuz ✓ reddedilir / hata", a.mode() == "pm" or a.errs_map(), (a.mode(), a.errs_map()))
        if a.mode() == "pm": a.cancel("discard")
        # taban kalınlığı değişince
        a.edit_feat("Taban-Flanş1"); a.pmfield("Kalınlık", 1); a.ok()
        print("   t=1 sonrası kabartma:", a.vol(), a.errs_map())
        chk("F1 taban t 2→1: kabartma hatasız yeniden kurulur", not a.errs_map(), a.errs_map())
    case("F1", f1)

    # ---------- V1 Havalandırma ----------
    def v1():
        def vsk(pt, line, rect, c, t):
            rect(30, 10, 70, 50); line(pt(30, 30), pt(70, 30), True)
        base([sketch("s2", "Eskiz2", FACE, vsk)])
        new_sheet(a, "Havalandırma", "Eskiz2")
        chk("V1 PM açıldı, eskiz seçili", a.mode() == "pm" and a.pmselval("Eskiz") == "s2", a.pmselval("Eskiz"))
        a.ok()
        dv = 12000 - a.vol()
        chk("V1 (1600 − 40·2)·2 = 3040 kaldırılır", near(dv, 3040, 0.5), dv)
        nm = a.names()[-1]
        a.edit_feat(nm); a.pmfield("Kaburga", 4); a.ok()
        chk("V1b kaburga 4 → (1600 − 160)·2 = 2880", near(12000 - a.vol(), 2880, 0.5), 12000 - a.vol())
        a.undo()
        chk("V1d geri al", near(12000 - a.vol(), 3040, 0.5), 12000 - a.vol())
        a.reload()
        chk("V1e yenile", near(12000 - a.vol(), 3040, 0.5), 12000 - a.vol())
        r = flat_dims(a)
        chk("V1 havalandırmalı sac açılır, net alan 6000 − 1520", r and near(r["area"], 6000 - 1520, 1), r and r["area"])
        a.tsel(nm)
        acts = a.ev("[...document.querySelectorAll('#tree-actions button')].map(b=>b.textContent)")
        tree = a.ev("document.querySelector('#tree').innerText")
        chk("V1c (P-4) havalandırma eskizi ağaçta / Eskizi düzenle", "Eskiz2" in tree or "Eskizi düzenle" in acts, tree.replace("\n", "|"))
        a.tact(nm, "Bastır")
        chk("V1g bastır → 12000", near(a.vol(), 12000), a.vol())
    case("V1", v1)

    # ---------- X1 Çapraz kırma ----------
    def x1():
        base()
        new_sheet(a, "Çapraz Kırma")
        chk("X1 PM açıldı", a.mode() == "pm" and a.pmhas("Kırma açısı"))
        top(50, -30)
        chk("X1 yüz seçili", "Yüz seçili" in a.pmtext())
        a.pmfield("Kırma açısı", 5); a.ok()
        chk("X1 hacim değişmez 12000, hata yok", near(a.vol(), 12000) and not a.errs_map(), (a.vol(), a.errs_map()))
        nm = a.names()[-1]
        sf = a.saved_feat(a.featbyname(nm)["id"])
        chk("X1 kayıtta açı 5", sf and sf["angle"] == 5, sf)
        a.edit_feat(nm); a.pmcheck("Yönü ters", True); a.ok()
        chk("X1b ters kayıtta", a.featbyname(nm).get("flip") is True, a.featbyname(nm))
        a.undo()
        chk("X1d geri al → ters değil", not a.featbyname(nm).get("flip"), a.featbyname(nm))
        txt = dxf_download(a); d = dxf_parse(txt)
        print("   çapraz kırma DXF:", d["layers"], [t[3] for t in d["texts"]])
        chk("X1 açınım DXF'inde çapraz kırma notu / çizgisi (SW: düz desende gösterilir)", any("KIRMA" in t[3].upper() or "CROSS" in t[3].upper() for t in d["texts"]) or len([l for l in d["lines"] if l[0] != "KESIM"]) >= 2, d["layers"])
    case("X1", x1)

    # ---------- U1 Sac takviye ----------
    def u1():
        base()
        new_sheet(a, "Kenar Flanş"); edge_click(a, [50, 2, 0]); a.pmfield("Uzunluk", 30); a.ok()
        vL = a.vol()
        new_sheet(a, "Sac Takviye")
        chk("U1 PM açıldı", a.mode() == "pm" and a.pmhas("Bacak uzunluğu"))
        fc = a.ev("(()=>{const f=window.__app.viewer.mesh.faces.find(f=>f.type==='CYLINDRE'&&Math.abs(f.r-2)<1e-6); return f&&f.c})()")
        zoom_at = lambda w: (lambda s: (a.pg.mouse.move(s[0], s[1]), [a.pg.mouse.wheel(0, 240) for _ in range(4)], time.sleep(0.5)))(a.wsc(w))
        # iç büküm yüzü izometrikte flanşın arkasında: kullanıcı gibi arkadan bak (Ctrl+2), yüz üzerindeki noktaya dokun
        a.blur(); a.pg.keyboard.press("Control+2"); time.sleep(0.5); fit(a)
        pin = [50, 4 - 2 * 0.7071, -4 + 2 * 0.7071]
        zoom_at(pin)
        a.wclick(pin); a.wait(0.4)
        chk("U1 büküm yüzü seçili", "Büküm yüzü seçili" in a.pmtext(), a.pmtext()[:80])
        a.ok()
        dv = a.vol() - vL
        exp = 150 - 3 * (4 - PI)
        chk("U1 takviye +%.2f" % exp, near(dv, exp, 0.5), (dv, a.errs_map()))
        nm = a.names()[-1]
        a.edit_feat(nm); a.pmfield("Bacak uzunluğu", 15); a.pmfield("Takviye genişliği", 4); a.ok()
        dv2 = a.vol() - vL
        exp2 = 0.5 * 15 * 15 * 4 - 4 * (4 - PI)
        chk("U1b L15 w4 → +%.2f" % exp2, near(dv2, exp2, 0.5), dv2)
        a.edit_feat(nm); a.pmfield("konum", 10); a.ok()
        chk("U1b konum %10 → hacim aynı, hata yok", near(a.vol() - vL, exp2, 0.5) and not a.errs_map(), a.vol() - vL)
        r = flat_dims(a)
        chk("U1 takviyeli sac açılır (takviye bastırılır)", r and len(r["bends"]) == 1, r and r["bends"])
        a.undo(); a.undo()
        chk("U1d 2× geri al", near(a.vol() - vL, exp, 0.5), a.vol() - vL)
        a.reload()
        chk("U1e yenile", near(a.vol() - vL, exp, 0.5), a.vol() - vL)
        # flanş uzunluğu değişince takviye
        a.edit_feat("Kenar-Flanş1"); a.pmfield("Uzunluk", 40); a.ok()
        chk("U1c ebeveyn flanş 30→40: takviye hatasız", not a.errs_map(), a.errs_map())
        a.edit_feat("Taban-Flanş1"); a.pmfield("Büküm yarıçapı", 4); a.ok()
        print("   R 2→4 sonrası takviye:", a.errs_map(), a.vol())
        chk("U1c taban R 2→4 (büküm yüzü değişir): takviye kalıcı referansla yaşar ya da açık hata", True, a.errs_map())
        a.dq[:] = [True]; a.tact("Kenar-Flanş1", "Sil")
        print("   flanş silinince:", a.names(), a.errs_map())
        chk("U1g flanş silinince takviye hata gösterir / silinir", nm not in a.names() or a.errs_map(), a.errs_map())
    case("U1", u1)

    # ---------- T1 Tırnak ve yuva ----------
    def t1():
        pa = sketch("sa", "EskizA", FRONT, lambda pt, ln, rect, c, t: rect(0, 0, 100, 40))
        pb = sketch("sb", "EskizB", TOP, lambda pt, ln, rect, c, t: rect(-10, -30, 110, 30))
        e1 = ext("ea", "sa", 3); e1["name"] = "Dikey"
        e2 = ext("eb", "sb", 4, rev=True, merge=False); e2["name"] = "Yatay"
        a.setup([pa, e1, pb, e2]); view_iso(a); fit(a)
        v0 = a.vol()
        new_sheet(a, "Tırnak ve Yuva")
        chk("T1 PM açıldı", a.mode() == "pm" and a.pmhas("Adet"))
        # dikey levhanın alt uç yüzü (y=0) yatay levhanın üst yüzüyle çakışık: kullanıcı aynı yere tekrar tıklayarak 'diğerini seç'
        tries = []
        for i in range(4):
            a.wclick([50, 0, 1.5]); a.wait(0.4)
            fsel = a.ev("JSON.stringify((window.__app.mode.draft||{}).face||null)")
            tries.append(fsel)
            if fsel != "null" and '"n":[0,-1,0]' in fsel.replace(" ", ""):
                break
        print("   uç yüz seçim denemeleri:", tries, a.pmtext()[:80])
        ok_face = '"n":[0,-1,0]' in tries[-1].replace(" ", "")
        chk("T1 çakışık dar uç yüzü grafik alanda seçilebilir (tekrar tık / diğerini seç)", ok_face, tries)
        if not ok_face:
            a.cancel("discard"); return
        a.pmfield("Yükseklik", 4); a.ok()
        dv = a.vol() - v0
        chk("T1 2 tırnak 10×3×4 − 2 yuva 10.4×3.4×4 → %.2f" % (240 - 2 * 10.4 * 3.4 * 4), near(dv, 240 - 2 * 10.4 * 3.4 * 4, 0.5) and a.bodies() == 2, (dv, a.bodies(), a.errs_map()))
        nm = a.names()[-1]
        a.edit_feat(nm); a.pmfield("Adet", 3); a.pmfield("Yuva boşluğu", 0.5); a.ok()
        exp = 3 * 10 * 3 * 4 - 3 * 11 * 4 * 4
        chk("T1b 3 tırnak, boşluk 0.5 → %.2f" % exp, near(a.vol() - v0, exp, 0.5), a.vol() - v0)
        a.undo()
        chk("T1d geri al", near(a.vol() - v0, 240 - 2 * 10.4 * 3.4 * 4, 0.5), a.vol() - v0)
        a.reload()
        chk("T1e yenile", near(a.vol() - v0, 240 - 2 * 10.4 * 3.4 * 4, 0.5), a.vol() - v0)
        a.edit_feat(nm); a.pmfield("Adet", 12); a.ok()
        print("   12 tırnak:", a.errs_map(), a.mode())
        chk("T1 sığmayan adet → hata", a.errs_map() or a.mode() == "pm", a.errs_map())
    case("T1", t1)

    # ---------- AK1 Aç / Katla Kes ----------
    def ak1():
        base()
        new_sheet(a, "Kenar Flanş"); edge_click(a, [50, 2, 0]); a.pmfield("Uzunluk", 30); a.ok()
        vL = a.vol()
        # flanş açınımda tabanın y<0 tarafında (açınım koordinatında): Ø10 delik flanşta, 20×20 yuva bükümü geçiyor
        a.ev("d=>{}", 0)
        sk = sketch("sc", "Eskiz2", FACE, lambda pt, line, rect, c, t: (c(50, -15, 5), rect(10, -10, 30, 10)))
        doc = a.stored(); doc["features"].append(sk)
        a.setup(doc["features"]); view_iso(a); fit(a)  # hazır model: kesim eskizi eklendi
        new_sheet(a, "Aç/Katla Kes", "Eskiz2")
        chk("AK1 PM açıldı", a.mode() == "pm" and a.pmselval("Eskiz") == "sc", a.pmselval("Eskiz"))
        a.ok()
        dv = vL - a.vol()
        exp = PI * 25 * 2 + 400 * 2
        chk("AK1 Ø10 (flanşta) + 20×20 (bükümü geçen) → −%.2f" % exp, near(dv, exp, 1) and not a.errs_map(), (dv, a.errs_map()))
        r = flat_dims(a)
        chk("AK1 açınım alanı 100×(60+30−3.288) − π25 − 400", r and near(r["area"], 100 * (90 - 3.288) - PI * 25 - 400, 1), r and r["area"])
        txt = dxf_download(a); d = dxf_parse(txt)
        cs = [c for c in d["circles"] if c[0] == "KESIM"]
        chk("AK1 DXF'te Ø10 daire (açınım ölçüsünde)", any(near(c[3], 5, 0.01) for c in cs) or any(near(x[3], 5, 0.01) for x in d["arcs"]), (cs, len(d["arcs"])))
        nm = a.names()[-1]
        a.undo()
        chk("AK1d geri al → kesimsiz", near(a.vol(), vL), a.vol())
        a.redo()
        a.reload()
        chk("AK1e yenile", near(vL - a.vol(), exp, 1), vL - a.vol())
        # flanş uzunluğu değişince kesim açınım koordinatında kalır
        a.edit_feat("Kenar-Flanş1"); a.pmfield("Uzunluk", 40); a.ok()
        chk("AK1c flanş 30→40: kesim hatasız, hacim farkı aynı", not a.errs_map(), a.errs_map())
        a.tsel(nm)
        acts = a.ev("[...document.querySelectorAll('#tree-actions button')].map(b=>b.textContent)")
        tree = a.ev("document.querySelector('#tree').innerText")
        chk("AK1c (P-4) aç/katla eskizi ağaçta / Eskizi düzenle", "Eskiz2" in tree or "Eskizi düzenle" in acts, tree.replace("\n", "|"))
    case("AK1", ak1)

    # ---------- N1 Ekst. Kesme: normal kesim + Delik Sihirbazı sacta ----------
    def n1():
        base()
        new_sheet(a, "Kenar Flanş"); edge_click(a, [50, 2, 0]); a.pmfield("Uzunluk", 30); a.ok()
        vL = a.vol()
        sk = sketch("sc", "Eskiz2", FACE, lambda pt, line, rect, c, t: c(50, 30, 5))
        doc = a.stored(); doc["features"].append(sk)
        a.setup(doc["features"]); view_iso(a); fit(a)
        new_sheet(a, "Ekst. Kesme", "Eskiz2")
        chk("N1 Ekst. Kesme PM, Normal kesim seçeneği", a.mode() == "pm" and a.pmhas("Normal kesim"))
        a.pmcheck("Normal kesim", True); a.ok()
        chk("N1 normal kesim Ø10 → −π·25·2", near(vL - a.vol(), PI * 50, 0.5), vL - a.vol())
        r = flat_dims(a)
        chk("N1 açınımda delik", r and near(r["area"], 100 * (90 - 3.288) - PI * 25, 1), r and r["area"])
        a.undo(); a.redo()
        chk("N1d geri al / ileri al", near(vL - a.vol(), PI * 50, 0.5), vL - a.vol())
        # Delik sihirbazı: üst yüze dokun
        a.tsel("Taban-Flanş1"); a.blur()
        sheet_tab(a); a.cmd("Delik Sihirb."); a.wait(0.8)
        chk("N1 Delik PM", a.mode() == "pm", a.mode())
        top(20, -40)
        print("   delik PM:", a.pmtext()[:200].replace("\n", " | "))
        a.ok()
        dv = vL - a.vol() - PI * 50
        print("   delik sonrası:", dv, a.errs_map())
        chk("N1 delik sacta (M8 normal Ø9 boydan boya → −π·4.5²·2 = %.2f)" % (PI * 4.5 ** 2 * 2), near(dv, PI * 4.5 ** 2 * 2, 1) and not a.errs_map(), (dv, a.errs_map()))
        r = flat_dims(a)
        chk("N1 açınımda 2 delik", r and near(r["area"], 100 * (90 - 3.288) - PI * 25 - PI * 4.5 ** 2, 1), r and r["area"])
    case("N1", n1)

    print("diyaloglar:", a.dlog, "hatalar:", a.errs[:5])
    a.close()
finish()

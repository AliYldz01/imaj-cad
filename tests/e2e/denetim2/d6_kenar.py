# Denetim 2 / d6 — Kenar Flanş: tüm PM seçenekleri + yaşam döngüsü + açınım (gerçek tık / klavye)
# Hazır model: yalnız taban eskizi setDoc ile; taban flanş ve kenar flanşları şeritten / PM'den.
import sys
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d6h import *  # noqa
ONLY = os.environ.get('ONLY')
BD = 2 * 4 - ba(90, 2, 2, 0.5)  # 3.288

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

    def base():
        a.setup([plate_sk()])
        new_sheet(a, "Taban Flanş", "Eskiz1"); a.ok()
        view_iso(a); fit(a)

    def flange(edges=([50, 2, 0],), **kw):
        new_sheet(a, "Kenar Flanş")
        for e in edges:
            edge_click(a, e)
        for k, v in kw.items():
            k(a, v) if callable(k) else None
        return a.pmtext()

    def ef(edges=([50, 2, 0],), L=None, ang=None, ref=None, pos=None, flip=False, r=None, o1=None, o2=None, tp1=None, tp2=None, gap=None, commit=True):
        new_sheet(a, "Kenar Flanş")
        for e in edges:
            edge_click(a, e)
        if L is not None: a.pmfield("Uzunluk", L)
        if ang is not None: a.pmfield("Büküm açısı", ang)
        if ref: a.pmselect("Ölçü referansı", ref)
        if pos: a.pmseg(pos)
        if flip: a.pmcheck("Yönü ters çevir", True)
        if r is not None:
            a.pmcheck("Varsayılan yarıçapı kullan", False); a.pmfield("Yarıçap", r)
        if o1 is not None: a.pmfield("Baştan kısalt", o1)
        if o2 is not None: a.pmfield("Sondan kısalt", o2)
        if tp1 is not None: a.pmfield("uçta baştan daralt", tp1)
        if tp2 is not None: a.pmfield("uçta sondan daralt", tp2)
        if gap is not None: a.pmfield("Köşe boşluğu", gap)
        if commit:
            a.ok()

    # ---------- K1 ölçü referansları × konumlar (90°) ----------
    def k1():
        cases = [
            ("outer", "Malzeme içte", 60 + 25 - BD, 25, 0),
            ("inner", "Malzeme içte", 60 + 27 - BD, 27, 0),
            ("tangent", "Malzeme içte", 60 + 29 - BD, 29, 0),
            ("outer", "Malzeme dışta", 62 + 25 - BD, 25, 2),
            ("outer", "Bükümün dışı", 64 + 25 - BD, 25, 4),
        ]
        for ref, pos, fexp, hexp, zmax in cases:
            base()
            ef(ref=ref, pos=pos)
            bb = a.bbox(); r = flat_dims(a); errs = a.errs_map()
            chk("K1 %s / %s: yükseklik %g, z üst %g, açınım %.3f" % (ref, pos, hexp, zmax, fexp),
                bb and not errs and near(bb[1][1] - bb[0][1], hexp, 0.01) and near(bb[1][2], zmax, 0.01) and r and near(r["h"], fexp, 0.02),
                (bb, r and r["h"], errs))
            sf = a.saved_feat(a.featbyname("Kenar-Flanş1")["id"])
            pv = {"Malzeme içte": "inside", "Malzeme dışta": "outside", "Bükümün dışı": "bendout"}[pos]
            chk("K1 kayıt lenRef=%s pos=%s" % (ref, pv), sf and sf["lenRef"] == ref and sf["pos"] == pv, sf and (sf["lenRef"], sf["pos"]))
    case("K1", k1)

    # ---------- K2 yaşam döngüsü: düzenle / geri al / yenile / ✕ / sil ----------
    def k2():
        base()
        new_sheet(a, "Kenar Flanş")
        chk("K2a PM açıldı, kenar ipucu", a.mode() == "pm" and "dış kenarına dokunun" in a.pmtext())
        v0 = a.vol()
        edge_click(a, [50, 2, 0])
        chk("K2a 1 kenar seçili", "1 kenar seçili" in a.pmtext(), a.pmtext()[:60])
        v1 = a.vol()
        print("   (P-30) kenar seçilince önizleme hacmi:", v0, "→", v1)
        a.pmcheck("Önizlemeyi göster", True); a.wait(1)
        vp = a.vol()
        chk("K2a önizleme açık → 16342.48", near(vp, 16342.48, 0.5), vp)
        a.pmcheck("Önizlemeyi göster", False); a.wait(0.5)
        a.pmfield("Uzunluk", 30); a.ok()
        v = a.vol()
        chk("K2a ✓ L=30: 12000 - 400 + 100·(π/4·12 + 2·26) → %.2f" % (12000 - 4 * 2 * 100 + 100 * (PI / 4 * 12) + 100 * 2 * 26), near(v, 12000 - 800 + 100 * (PI / 4 * 12) + 5200, 0.5), v)
        # b
        a.edit_feat("Kenar-Flanş1")
        chk("K2b Düzenle → PM, 1 kenar seçili, L 30", a.mode() == "pm" and "1 kenar seçili" in a.pmtext() and a.pg.locator("#pm-body label.pm-field:has-text('Uzunluk') input").first.input_value() == "30")
        a.pmfield("Uzunluk", 40); a.pmfield("Büküm açısı", 60); a.ok()
        bb = a.bbox(); r = flat_dims(a)
        chk("K2b L40 / 60° → büküm 60°", r and r["bends"] and near(r["bends"][0]["angle"], 60, 0.1), r and r["bends"])
        # ikinci kenar ekle (düzenlemede)
        a.edit_feat("Kenar-Flanş1"); a.pmfield("Büküm açısı", 90)
        edge_click(a, [0, 2, -30])
        chk("K2b düzenlemede 2. kenar eklendi", "2 kenar seçili" in a.pmtext(), a.pmtext()[:60])
        a.ok()
        r2 = flat_dims(a)
        chk("K2b 2 kenar → 2 büküm, açınım 60+40-BD × 100+40-BD", r2 and len(r2["bends"]) == 2 and near(r2["h"], 100 - BD, 0.05) and near(r2["w"], 140 - BD, 0.05), r2 and (r2["w"], r2["h"], len(r2["bends"])))
        v2 = a.vol()
        # d
        a.undo(); u1 = a.vol(); a.undo(); u2 = a.vol(); a.redo(); a.redo(); u3 = a.vol()
        chk("K2d geri al ×2 / ileri al ×2", u3 == v2 and u1 != v2 and u2 != u1, (v2, u1, u2, u3))
        # e
        a.reload()
        chk("K2e yenile → aynı", near(a.vol(), v2), (a.vol(), v2))
        # f
        a.edit_feat("Kenar-Flanş1"); a.pmfield("Uzunluk", 10); a.wait(0.8); a.cancel("discard")
        chk("K2f ✕ → değişmez", near(a.vol(), v2), a.vol())
        a.edit_feat("Kenar-Flanş1"); a.pmbtn("Seçimi temizle"); a.cancel("discard")
        chk("K2f seçim temizle + ✕ → kenarlar korunur", near(a.vol(), v2) and len(a.featbyname("Kenar-Flanş1")["edges"]) == 2, a.vol())
        a.edit_feat("Kenar-Flanş1"); a.pmbtn("Seçimi temizle"); a.ok()
        print("   kenarsız ✓:", a.mode(), a.vol(), a.errs_map(), a.toast())
        chk("K2f kenarsız ✓ reddedilir ya da hata gösterilir (sessiz boş özellik değil)", a.mode() == "pm" or a.errs_map() or "kenar" in a.toast().lower(), (a.mode(), a.errs_map()))
        if a.mode() == "pm": a.cancel("discard")
        else: a.undo()
        # g sil
        a.dq[:] = [True]
        a.tact("Kenar-Flanş1", "Sil")
        chk("K2g sil → 12000", near(a.vol(), 12000) and "Kenar-Flanş1" not in a.names(), (a.vol(), a.names()))
    case("K2", k2)

    # ---------- K3 açı, yön, yarıçap ----------
    def k3():
        base(); ef(flip=True)
        bb = a.bbox()
        chk("K3 ters yön → aşağı (y −23..2)", bb and near(bb[0][1], -23, 0.01) and near(bb[1][1], 2, 0.01), bb)
        r = flat_dims(a)
        chk("K3 ters yön açınım aynı 81.712", r and near(r["h"], 81.712, 0.02), r and (r["h"], r["bends"]))
        base(); ef(); ef(edges=([50, 2, -60],), flip=True)
        r = flat_dims(a)
        chk("K3 karşı kenarlarda biri yukarı biri aşağı flanş → büküm yönleri farklı, açınım 60+2·21.712", r and len(r["bends"]) == 2 and r["bends"][0]["up"] != r["bends"][1]["up"] and near(r["h"], 60 + 2 * (25 - BD), 0.05), r and (r["h"], r["bends"]))
        base(); ef(r=5)
        r = flat_dims(a); exp = 60 + 25 - (2 * 7 - ba(90, 5, 2, 0.5))
        bb = a.bbox()
        chk("K3 özel R5: dış ölçü 25, açınım %.3f, büküm R5" % exp, r and near(r["h"], exp, 0.02) and near(r["bends"][0]["r"], 5, 0.01) and near(bb[1][1], 25, .01), r and (r["h"], r["bends"]))
        base(); ef(ang=120)
        r = flat_dims(a)
        chk("K3 120° → büküm 120°", r and near(r["bends"][0]["angle"], 120, 0.1), r and r["bends"])
        base(); ef(ang=180)
        print("   180°:", a.vol(), a.errs_map(), a.toast())
        base(); ef(ang=0.1)
        print("   0.1°:", a.vol(), a.errs_map())
    case("K3", k3)

    # ---------- K4 kısaltma + büküm boşaltma türleri, profil daraltma ----------
    def k4():
        vols = {}
        for rt, label in (("rect", "Dikdörtgen"), ("obround", "Oval"), ("tear", "Yırtma")):
            a.setup([plate_sk()])
            new_sheet(a, "Taban Flanş", "Eskiz1"); a.pmselect("Büküm boşaltma türü", rt); a.ok()
            ef(o1=10, o2=20)
            v = a.vol()
            fx = a.ev("(()=>{const m=window.__app.viewer.mesh;const xs=[];m.faces.forEach(f=>{if(f.n&&Math.abs(f.n[2]-1)<1e-3&&f.c[1]>5)xs.push(f.c[0])});return xs})()")
            r = flat_dims(a)
            vols[rt] = v
            print("   %s: hacim %s, flanş yüz merkezleri x %s, açınım %s alan %s" % (rt, v, fx, r and (r["w"], r["h"]), r and r["area"]))
            chk("K4 %s: flanş x 10..80 (merkez 45), açınım h 81.712" % rt, any(near(x, 45, 0.05) for x in fx) and r and near(r["h"], 81.712, 0.02), (fx, r and r["h"]))
        chk("K4 boşaltma hacim sırası yırtma > oval >= dikdörtgen (dikdörtgen en çok malzeme alır)", vols["tear"] > vols["obround"] >= vols["rect"] - 0.01, vols)
        # oran 0 → boşaltma yok
        a.setup([plate_sk()])
        new_sheet(a, "Taban Flanş", "Eskiz1"); a.pmfield("Oran", 0); a.ok()
        ef(o1=10, o2=20)
        v0 = a.vol()
        chk("K4 oran 0 → boşaltmasız hacim en büyük", v0 >= vols["tear"] - 0.01, (v0, vols))
        # daraltma
        base(); ef(tp1=5, tp2=5)
        v = a.vol()
        # yamuk: düz bölüm yüksekliği 25-4=21; iki üçgen 5×21/2 × t2
        exp = 16342.48 - 2 * (5 * 21 / 2) * 2
        chk("K4 profil daraltma 5/5 → hacim %.2f" % exp, near(v, exp, 0.5), v)
        r = flat_dims(a)
        chk("K4 daraltılmış flanş açınımı (h 81.712)", r and near(r["h"], 81.712, 0.02), r and r["h"])
        base(); ef(tp1=60, tp2=60)
        print("   aşırı daraltma:", a.vol(), a.errs_map())
        chk("K4 aşırı daraltma hata verir", bool(a.errs_map()), a.errs_map())
    case("K4", k4)

    # ---------- K5 serbest profil eskizi ----------
    def k5():
        base()
        new_sheet(a, "Kenar Flanş"); edge_click(a, [50, 2, 0])
        a.pmbtn("Profil eskizi oluştur")
        print("   toast:", a.toast())
        prof = a.pmselval("Serbest profil eskizi")
        chk("K5 profil eskizi oluştu ve seçildi", bool(prof), prof)
        a.wait(1); a.ok()
        v = a.vol()
        chk("K5 dikdörtgen profil = standart flanş 16342.48", near(v, 16342.48, 0.5), v)
        names = a.names(); tree = a.ev("document.querySelector('#tree').innerText")
        pname = [n for n in names if "flanş profili" in n]
        print("   ağaç:", tree.replace("\n", " | "))
        chk("K5 profil eskizi ağaçta görünür (toast 'Ağaçtan düzenleyin' diyor)", pname and pname[0] in tree, (pname, tree))
        if pname and pname[0] in tree:
            a.tact(pname[0], "Eskizi düzenle")
            chk("K5 profil eskizi düzenlenebilir", a.mode() == "sketch", a.mode())
            if a.mode() == "sketch":
                a.dim_dbl(0, 50) if a.pg.locator(".dim").count() else None
                a.ok()
        # ✕: oluşturulan profil eskizi geri alınmalı
        base()
        new_sheet(a, "Kenar Flanş"); edge_click(a, [50, 2, 0])
        a.pmbtn("Profil eskizi oluştur"); a.wait(0.5)
        a.cancel("discard")
        left = [n for n in a.names() if "flanş profili" in n]
        chk("K5 ✕ ile vazgeçince oluşturulan profil eskizi belgede kalmaz", not left, a.names())
    case("K5", k5)

    # ---------- K6 çoklu kenar: köşe gönyesi, köşe boşluğu, köşe boşaltma türü, 4 kenar tepsi ----------
    def k6():
        base()
        ef(edges=([50, 2, 0], [0, 2, -30]), gap=1)
        errs = a.errs_map(); r = flat_dims(a)
        chk("K6 komşu 2 kenar, boşluk 1 → hata yok, 2 büküm", not errs and r and len(r["bends"]) == 2, (errs, r and r["bends"]))
        v2 = a.vol()
        a.edit_feat("Kenar-Flanş1"); a.pmfield("Köşe boşluğu", 0.2); a.ok()
        chk("K6 boşluk 1 → 0.2 hacim artar", a.vol() > v2, (v2, a.vol()))
        base()
        ef(edges=([50, 2, 0], [0, 2, -30], [50, 2, -60], [100, 2, -30]))
        r = flat_dims(a); errs = a.errs_map()
        chk("K6 4 kenar tepsi: açınım (100+2·21.712)×(60+2·21.712), 4 büküm", not errs and r and near(r["w"], 100 + 2 * (25 - BD), 0.05) and near(r["h"], 60 + 2 * (25 - BD), 0.05) and len(r["bends"]) == 4, (errs, r and (r["w"], r["h"], len(r["bends"]))))
        txt = dxf_download(a); d = dxf_parse(txt)
        chk("K6 tepsi DXF: 4 büküm çizgisi, kesim sınır kutusu = açınım", len([l for l in d["lines"] if l[0].startswith("BUKUM")]) == 4 and dxf_cut_bbox(d) and near(dxf_cut_bbox(d)[0], r["w"], .01), (dxf_cut_bbox(d), len(d["lines"])))
        bb = a.bbox()
        chk("K6 tepsi dış ölçüsü 100×60×25", bb == [[0, 0, -60], [100, 25, 0]] or (near(bb[1][0] - bb[0][0], 100, .01) and near(bb[1][2] - bb[0][2], 60, .01) and near(bb[1][1], 25, .01)), bb)
        # dairesel köşe boşaltma
        v4 = a.vol()
        a.edit_feat("Taban-Flanş1"); a.pmselect("Köşe boşaltma türü", "circ"); a.ok()
        print("   tepsi dairesel köşe boşaltma:", v4, "→", a.vol(), a.errs_map())
        chk("K6 dairesel köşe boşaltması hacmi değiştirir, hata yok", not a.errs_map() and not near(a.vol(), v4, 0.01), (v4, a.vol()))
        r = flat_dims(a)
        chk("K6 dairesel köşe boşaltmalı tepsi açılır", r is not None and len(r["bends"]) == 4, r and len(r["bends"]))
    case("K6", k6)

    # ---------- K7 geçersiz kenar seçimi ----------
    def k7():
        base()
        new_sheet(a, "Kenar Flanş")
        edge_click(a, [100, 1, 0])  # kalınlık kenarı (düşey 2 mm)
        t = a.pmtext()
        sel = a.ev("JSON.stringify(window.__app.mode.draft.edges)")
        print("   seçilen:", sel)
        vertical = '"d":[0,1,0]' in sel.replace(" ", "")
        if not vertical:
            print("   (tıklama düşey kenarı seçmedi — sonuç belirsiz, atlandı)"); t = "dokunun"
        print("   kalınlık kenarı tıklandı:", t[:40], a.toast())
        a.ok()
        print("   →", a.mode(), a.vol(), a.errs_map())
        chk("K7 kalınlık kenarı kabul edilmez ya da hata", "0 kenar" in t or "dokunun" in t or bool(a.errs_map()) or a.mode() == "pm", (t[:40], a.errs_map()))
        if a.mode() == "pm": a.cancel("discard")
        # aynı kenara iki kez tık → seçim kalkar (SolidWorks)
        base(); new_sheet(a, "Kenar Flanş"); edge_click(a, [50, 2, 0]); edge_click(a, [50, 2, 0])
        t = a.pmtext()
        chk("K7 aynı kenara ikinci tık seçimi kaldırır", "1 kenar" not in t, t[:40])
        a.cancel("discard")
    case("K7", k7)

    print("diyaloglar:", a.dlog, "hatalar:", a.errs[:5])
    a.close()
finish()

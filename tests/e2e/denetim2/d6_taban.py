# Denetim 2 / d6 — Taban Flanş: tüm PM seçenekleri + yaşam döngüsü + açınım / DXF (gerçek tık / klavye)
# Hazır model: yalnız eskizler setDoc ile kurulur; sac özellikleri şeritten / PM'den oluşturulur.
import sys
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d6h import *  # noqa
ONLY = os.environ.get('ONLY')
BD90 = lambda r, t, k: 2 * (r + t) - ba(90, r, t, k)

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

    # ---------- T1 kapalı levha: tam yaşam döngüsü ----------
    def t1():
        a.setup([plate_sk()])
        new_sheet(a, "Taban Flanş", "Eskiz1")
        chk("T1a PM açıldı, kapalı profil ipucu", a.mode() == "pm" and "Kapalı profil" in a.pmtext())
        chk("T1a önizleme 100×60×2 = 12000", near(a.vol(), 12000, 1), a.vol())
        a.pmfield("Kalınlık", 3); a.wait(1)
        chk("T1a kalınlık 3 önizleme 18000", near(a.vol(), 18000, 1), a.vol())
        a.ok()
        chk("T1a ✓ 18000, y 0..3", near(a.vol(), 18000, 1) and a.bbox()[1][1] == 3, (a.vol(), a.bbox()))
        chk("T1a ağaç Taban-Flanş1", a.names() == ["Eskiz1", "Taban-Flanş1"], a.names())
        # P-4: eskiz ağaçta / Eskizi düzenle
        a.tsel("Taban-Flanş1")
        acts = a.ev("[...document.querySelectorAll('#tree-actions button')].map(b=>b.textContent)")
        tree = a.ev("document.querySelector('#tree').innerText")
        chk("T1c (P-4) taban flanşın eskizi ağaçta / 'Eskizi düzenle' var", "Eskizi düzenle" in acts or "Eskiz1" in tree, acts)
        # b) düzenle
        a.edit_feat("Taban-Flanş1")
        chk("T1b Düzenle → PM, kalınlık 3", a.mode() == "pm" and a.pg.locator("#pm-body label.pm-field:has-text('Kalınlık') input").first.input_value() == "3")
        a.pmfield("Kalınlık", 1.5); a.ok()
        chk("T1b 1.5 → 9000", near(a.vol(), 9000, 1), a.vol())
        a.edit_feat("Taban-Flanş1"); a.pmcheck("Kalınlık yönünü ters çevir", True); a.ok()
        chk("T1b ters → y -1.5..0", a.bbox() and a.bbox()[0][1] == -1.5 and a.bbox()[1][1] == 0, a.bbox())
        # d) geri al / ileri al
        a.undo(); b1 = a.bbox(); v1 = a.vol()
        a.undo(); v2 = a.vol()
        a.redo(); v3 = a.vol()
        a.redo(); b4 = a.bbox()
        chk("T1d Ctrl+Z ×2 / Ctrl+Y ×2", b1 and b1[1][1] == 1.5 and near(v1, 9000) and near(v2, 18000) and near(v3, 9000) and b4[0][1] == -1.5, (b1, v1, v2, v3, b4))
        # e) yenile + kayıt
        sf = a.saved_feat(a.featbyname("Taban-Flanş1")["id"])
        chk("T1e kayıtta t=1.5 rev=True", sf and sf["t"] == 1.5 and sf["rev"] is True, sf and (sf["t"], sf["rev"]))
        a.reload()
        chk("T1e yenile → 9000, y -1.5..0", near(a.vol(), 9000) and a.bbox()[0][1] == -1.5, (a.vol(), a.bbox()))
        # f) ✕
        a.edit_feat("Taban-Flanş1"); a.pmfield("Kalınlık", 4); a.wait(1)
        pv = a.vol()
        a.cancel("discard")
        chk("T1f ✕ Kaydetmeden çık → 9000 (önizleme 24000 idi)", near(a.vol(), 9000) and near(pv, 24000), (pv, a.vol()))
        a.edit_feat("Taban-Flanş1"); a.pmfield("Kalınlık", 2); a.cancel("save")
        chk("T1f ✕ Kaydet ve çık → 12000", near(a.vol(), 12000), a.vol())
        # açınım düz levha
        r = flat_open(a)
        chk("T1 düzleştir düz levha 100×60, büküm 0", r and r["w"] == 100 and r["h"] == 60 and not r["bends"], r and (r["w"], r["h"], r["bends"]))
        flat_close(a)
        chk("T1 düzleştir kapat → model geri 12000", a.mode() == "part" and near(a.vol(), 12000), (a.mode(), a.vol()))
        # g) kenar flanşı ekle, taban flanşı bastır / sil
        new_sheet(a, "Kenar Flanş"); edge_click(a, [50, 0, 0]); a.ok()
        vf = a.vol()
        chk("T1g kenar flanşı eklendi (alt kenar)", vf and vf > 12000, vf)
        a.tact("Taban-Flanş1", "Bastır"); a.wait(1)
        st = a.status(); errs = a.errs_map(); vb = a.vol()
        print("   bastır sonrası:", vb, st, errs, a.names())
        chk("T1g taban bastırılınca model boş ve kenar flanşı da bastırılır / hata (sessiz değil)", not vb and (errs or "bastır" in str(a.feat(a.featbyname("Kenar-Flanş1")["id"]).get("off", ""))), (vb, errs))
        a.tact("Taban-Flanş1", "Etkinleştir"); a.wait(1)
        chk("T1g etkinleştir → geri", near(a.vol(), vf), a.vol())
        a.dq[:] = [True, True]
        a.tact("Taban-Flanş1", "Sil")
        print("   sil diyalogları:", a.dlog[-2:], a.names(), a.errs_map())
        chk("T1g taban silinince kenar flanşı da gider ya da hata gösterilir", "Taban-Flanş1" not in a.names() and ("Kenar-Flanş1" not in a.names() or a.errs_map()), (a.names(), a.errs_map()))
        a.undo()
        chk("T1g sil → geri al → taban + flanş geri", "Taban-Flanş1" in a.names() and near(a.vol(), vf), (a.names(), a.vol()))
    case("T1", t1)

    # ---------- T2 Büküm hesabı: K / BA / BD / tablo / kalınlık tablosu (tek 90° kenar flanşıyla) ----------
    def base_and_flange(L=25, angle=None):
        a.setup([plate_sk()])
        new_sheet(a, "Taban Flanş", "Eskiz1"); a.ok()
        new_sheet(a, "Kenar Flanş"); edge_click(a, [50, 2, 0])
        a.pmfield("Uzunluk", L)
        if angle: a.pmfield("Büküm açısı", angle)
        a.ok()

    def t2():
        base_and_flange()
        r = flat_dims(a)
        exp = 60 + 25 - BD90(2, 2, 0.5)
        chk("T2 K=0.5 açınım 60+25-BD = %.3f" % exp, r and near(r["h"], exp, 0.01), r and r["h"])
        # K = 0.3
        a.edit_feat("Taban-Flanş1"); a.pmfield("K faktörü", 0.3)
        info = a.pmtext()
        a.ok()
        r = flat_dims(a); exp = 60 + 25 - BD90(2, 2, 0.3)
        chk("T2 K=0.3 açınım %.3f" % exp, r and near(r["h"], exp, 0.01), r and r["h"])
        chk("T2 PM bilgi satırı K 0,3 BA 4,084", "4,084" in info, [l for l in info.split("\n") if "Eşdeğer" in l])
        # BA
        a.edit_feat("Taban-Flanş1"); a.pmselect("Büküm hesabı", "ba"); a.pmfield("Büküm payı (90°)", 5); a.ok()
        r = flat_dims(a)
        chk("T2 BA=5 → 60+25-(8-5) = 82", r and near(r["h"], 82, 0.01), r and r["h"])
        # BD
        a.edit_feat("Taban-Flanş1"); a.pmselect("Büküm hesabı", "bd"); a.pmfield("Büküm düşümü (90°)", 4); a.ok()
        r = flat_dims(a)
        chk("T2 BD=4 → 60+25-4 = 81", r and near(r["h"], 81, 0.01), r and r["h"])
        txt = dxf_download(a); d = dxf_parse(txt)
        chk("T2 DXF KESIM sınır kutusu 100×81", dxf_cut_bbox(d) == [100.0, 81.0], dxf_cut_bbox(d))
        # tablo
        a.edit_feat("Taban-Flanş1"); a.pmselect("Büküm hesabı", "table"); a.wait(0.5)
        rows = a.pg.locator("#pm-body .pm-picks .pm-row")
        n = rows.count()
        angs = [rows.nth(i).locator("input").nth(0).input_value() for i in range(n)]
        chk("T2 tablo varsayılan 6 satır (30…135)", n == 6, angs)
        i90 = angs.index("90") if "90" in angs else 3
        inp = rows.nth(i90).locator("input").nth(1); inp.fill("6"); inp.press("Tab"); time.sleep(0.3)
        a.ok()
        r = flat_dims(a)
        chk("T2 tablo 90°→BA 6 → 60+25-(8-6) = 83", r and near(r["h"], 83, 0.01), r and r["h"])
        sf = a.saved_feat(a.featbyname("Taban-Flanş1")["id"])
        chk("T2 kayıtta bendMethod=table, 90 satırı 6", sf and sf.get("bendMethod") == "table" and any(x["angle"] == 90 and x["ba"] == 6 for x in sf.get("btable", [])), sf and sf.get("btable"))
        # Kalınlık tablosu
        a.edit_feat("Taban-Flanş1"); a.pmselect("Kalınlık tablosu", "3 mm"); a.wait(0.5)
        t_ = a.pg.locator("#pm-body label.pm-field:has-text('Kalınlık') input").first.input_value()
        r_ = a.pg.locator("#pm-body label.pm-field:has-text('Büküm yarıçapı') input").first.input_value()
        meth = a.pmselval("Büküm hesabı")
        chk("T2 kalınlık tablosu '3 mm' → t 3, r 3, K yöntemi", t_ == "3" and r_ == "3" and meth == "k", (t_, r_, meth))
        a.ok()
        r = flat_dims(a); exp = 60 + 25 - (2 * (3 + 3) - ba(90, 3, 3, 0.44))
        chk("T2 3 mm (K 0.44, r 3) açınım %.3f" % exp, r and near(r["h"], exp, 0.01), r and r["h"])
        v = a.vol()
        # hacim: levha 100×60×3 + bükümde çeyrek halka + düz flanş
        vexp = 100 * (60 - 6) * 3 + 100 * (PI / 4) * ((6) ** 2 - 3 ** 2) + 100 * 3 * (25 - 6)
        chk("T2 3 mm hacim = levha + çeyrek halka + düz flanş %.1f" % vexp, near(v, vexp, 1), v)
    case("T2", t2)

    # ---------- T3 90° dışı açılar: K ile ve BA / tablo ile (P-15) ----------
    def t3():
        for ang in (45, 135):
            base_and_flange(angle=ang)
            r = flat_dims(a)
            # dış ölçü (dış sanal keskin) referanslı: açınım = 60 + 25 - setback·2 + BA ; OSSB = (r+t)·tan(θ/2)
            th = math.radians(ang); ossb = (2 + 2) * math.tan(th / 2)
            exp = 60 + 25 - 2 * ossb + ba(ang, 2, 2, 0.5)
            if ang > 90:
                # SW: >90° bükümde dış ölçü teğete göre (sanal keskin sonsuza gider) — yalnız bilgi
                print("   %d°: açınım %s (dış sanal keskinle %.3f)" % (ang, r and r["h"], exp))
            else:
                chk("T3 %d° K=0.5 açınım %.3f (dış sanal keskin)" % (ang, exp), r and near(r["h"], exp, 0.02), r and r["h"])
            chk("T3 %d° büküm tablosunda açı %d" % (ang, ang), r and r["bends"] and near(r["bends"][0]["angle"], ang, 0.1), r and r["bends"])
            # BA yöntemi: 90° için 5 → SW 45°'de BA değeri açıyla orantılı değil, kullanıcı tablosu gerekir; bilgi olarak
            a.edit_feat("Taban-Flanş1"); a.pmselect("Büküm hesabı", "table"); a.wait(0.5)
            rows = a.pg.locator("#pm-body .pm-picks .pm-row")
            angs = [rows.nth(i).locator("input").nth(0).input_value() for i in range(rows.count())]
            if str(ang) in angs:
                inp = rows.nth(angs.index(str(ang))).locator("input").nth(1); inp.fill("3" if ang < 90 else "8"); inp.press("Tab"); time.sleep(0.3)
            a.ok()
            r2 = flat_dims(a)
            bal = 3.0 if ang < 90 else 8.0
            # aynı geometri, büküm payı 3 olarak
            exp2 = (r["h"] - ba(ang, 2, 2, 0.5) + bal) if r else None
            chk("T3 %d° tablo BA=%g → açınım %.3f" % (ang, bal, exp2 or 0), r2 and exp2 and near(r2["h"], exp2, 0.02), (r2 and r2["h"], exp2))
        # büküm payı iç yay uzunluğundan küçükse (K < 0) uyarı var mı?
        a.edit_feat("Taban-Flanş1")
        rows = a.pg.locator("#pm-body .pm-picks .pm-row")
        angs = [rows.nth(i).locator("input").nth(0).input_value() for i in range(rows.count())]
        inp = rows.nth(angs.index("135")).locator("input").nth(1); inp.fill("3"); inp.press("Tab"); time.sleep(0.5)
        pmt = a.pmtext(); a.ok(); r3 = flat_dims(a)
        print("   135° BA=3 (< iç yay 4.712):", r3 and r3["h"], "uyarı:", a.toast(), [l for l in pmt.split("\n") if "K" in l][:3])
        chk("T3 135° BA=3 geçersiz (K<0) değer uyarısız kırpılmıyor (açınım 80 ya da uyarı)", (r3 and near(r3["h"], 80, 0.02)) or "uyar" in (a.toast() + pmt).lower(), r3 and r3["h"])
        # malzeme içte 45°: dış sanal keskin seçili kenarda mı? (dış yüz düzleminin taban alt yüzüyle kesişimi z=0 olmalı)
        a.setup([plate_sk()])
        new_sheet(a, "Taban Flanş", "Eskiz1"); a.ok()
        new_sheet(a, "Kenar Flanş"); edge_click(a, [50, 2, 0]); a.pmfield("Büküm açısı", 45); a.ok()
        fo = a.ev("window.__app.viewer.mesh.faces.find(f=>f.n&&Math.abs(f.n[1]+0.7071)<1e-3&&Math.abs(f.n[2]-0.7071)<1e-3)")
        zv = None
        if fo:
            # n·(p - c) = 0 , y = 0  →  z
            n = fo["n"]; c = fo["c"]; zv = c[2] + (n[1] * c[1]) / n[2]
        chk("T3 45° malzeme içte: dış sanal keskin seçili kenarda (z = 0)", zv is not None and abs(zv) < 0.01, zv)
    case("T3", t3)

    # ---------- T4 açık profil (L) taban flanş: derinlik, orta düzlem, malzeme tarafı ----------
    def t4():
        a.setup([L_sk()])
        new_sheet(a, "Taban Flanş", "Eskiz2")
        chk("T4a açık profil ipucu + Derinlik alanı", "Açık profil" in a.pmtext() and a.pmhas("Derinlik"))
        a.pmfield("Derinlik", 40); a.ok()
        bb = a.bbox(); v = a.vol()
        print("   L açık profil:", v, bb, a.errtree())
        chk("T4a L profil oluştu, z 0..40 (ya da -40..0)", bb and abs(abs(bb[1][2] - bb[0][2]) - 40) < 0.01, bb)
        W = bb[1][0] - bb[0][0]; H = bb[1][1] - bb[0][1]
        # SW: çizgi uzunlukları; malzeme varsayılan tarafta → dış ölçüler W×H, düz uzunluk = W + H - BD
        r = flat_dims(a); exp = W + H - BD90(2, 2, 0.5)
        chk("T4a açınım (dış ölçü %.1f + %.1f − BD) = %.3f" % (W, H, exp), r and near(max(r["w"], r["h"]), exp, 0.02) and near(min(r["w"], r["h"]), 40, 0.01), r and (r["w"], r["h"]))
        # SW kuralı: eskiz çizgileri kalınlığın bir yüzünü tanımlar → ölçülerden biri 50 ya da 52 olmalı
        chk("T4a eskiz 50×30 → dış ölçü 50×30 ya da 52×32 (malzeme tarafı)", (near(W, 50, .01) and near(H, 30, .01)) or (near(W, 52, .01) and near(H, 32, .01)), (W, H))
        vexp = 40 * 2 * (W - 4 + H - 4) + 40 * (PI / 4) * (16 - 4)
        chk("T4a hacim = düzler + çeyrek halka %.1f" % vexp, near(v, vexp, 1), v)
        a.edit_feat("Taban-Flanş1"); a.pmcheck("Orta düzlem", True); a.ok()
        bb2 = a.bbox()
        chk("T4b orta düzlem → z -20..20", bb2 and near(bb2[0][2], -20, .01) and near(bb2[1][2], 20, .01), bb2)
        a.edit_feat("Taban-Flanş1"); a.pmcheck("Malzeme tarafını ters çevir", True); a.ok()
        bb3 = a.bbox(); W3 = bb3[1][0] - bb3[0][0]; H3 = bb3[1][1] - bb3[0][1]
        chk("T4b malzeme tarafı ters → dış ölçü 4 mm değişir", abs((W3 + H3) - (W + H)) > 3.9, (W, H, W3, H3))
        r3 = flat_dims(a)
        exp3 = W3 + H3 - BD90(2, 2, 0.5)
        chk("T4b ters tarafta açınım %.3f" % exp3, r3 and near(max(r3["w"], r3["h"]), exp3, 0.02), r3 and (r3["w"], r3["h"]))
        a.edit_feat("Taban-Flanş1"); a.pmfield("Büküm yarıçapı (iç)", 5); a.ok()
        r4 = flat_dims(a); bb4 = a.bbox(); W4 = bb4[1][0] - bb4[0][0]; H4 = bb4[1][1] - bb4[0][1]
        exp4 = W4 + H4 - (2 * (5 + 2) - ba(90, 5, 2, 0.5))
        chk("T4b R5: dış ölçü korunur, açınım %.3f" % exp4, r4 and near(max(r4["w"], r4["h"]), exp4, 0.02) and near(W4 + H4, W3 + H3, 0.01), (r4 and (r4["w"], r4["h"]), W4, H4))
        a.undo(); a.undo(); a.undo()
        chk("T4d 3× geri al → ilk hâl", a.bbox() == bb, (a.bbox(), bb))
        a.reload()
        chk("T4e yenile", a.bbox() == bb and near(a.vol(), v), a.bbox())
    case("T4", t4)

    # ---------- T5 U profil (iki büküm) açınım ve DXF içeriği ----------
    def t5():
        def bld(pt, line, rect, c, t):
            p0, p1, p2, p3 = pt(0, 30), pt(0, 0), pt(80, 0), pt(80, 30)
            line(p0, p1); line(p1, p2); line(p2, p3)
        a.setup([sketch("s2", "Eskiz2", FRONT, bld)])
        new_sheet(a, "Taban Flanş", "Eskiz2"); a.pmfield("Derinlik", 50); a.ok()
        bb = a.bbox(); W = bb[1][0] - bb[0][0]; H = bb[1][1] - bb[0][1]
        r = flat_dims(a); exp = W + 2 * H - 2 * BD90(2, 2, 0.5)
        chk("T5 U profil açınım W+2H-2BD = %.3f" % exp, r and near(max(r["w"], r["h"]), exp, 0.02) and len(r["bends"]) == 2, r and (r["w"], r["h"], r["bends"]))
        txt = dxf_download(a); d = dxf_parse(txt)
        bl = [l for l in d["lines"] if l[0].startswith("BUKUM")]
        notes = [t[3] for t in d["texts"]]
        chk("T5 DXF: 2 büküm çizgisi, katmanlar, notlar B1/B2 + sınır kutusu", len(bl) == 2 and {"KESIM", "NOTLAR"} <= d["layers"] and any("B1" in s for s in notes) and any("Sinir kutusu" in s for s in notes), (bl, d["layers"], notes))
        bb_ = dxf_cut_bbox(d)
        chk("T5 DXF KESIM ölçüsü = açınım", bb_ and r and near(max(bb_), max(r["w"], r["h"]), 0.01) and near(min(bb_), min(r["w"], r["h"]), 0.01), (bb_, r and (r["w"], r["h"])))
        # büküm çizgileri bükümün ortasında: uç flanş düz kısmı H - (r+t) + BA/2
        if len(bl) == 2:
            pos = sorted([bl[0][1], bl[1][1]] if abs(bl[0][1] - bl[0][3]) < 1e-6 else [bl[0][2], bl[1][2]])
            e1 = H - 4 + ba(90, 2, 2, .5) / 2
            chk("T5 büküm çizgisi konumu %.3f (büküm ortası)" % e1, near(pos[0], e1, 0.02) or near(max(r["w"], r["h"]) - pos[1], e1, 0.02), pos)
        # yukarı / aşağı: U'nun iki bükümü aynı yöne
        ups = [b["up"] for b in r["bends"]]
        chk("T5 iki büküm aynı yön", len(set(ups)) == 1, ups)
    case("T5", t5)

    # ---------- T6 kalınlık değişince kenar flanşları ve dış ölçü ----------
    def t6():
        base_and_flange(L=30)
        bb0 = a.bbox()
        a.edit_feat("Taban-Flanş1"); a.pmfield("Kalınlık", 4); a.ok()
        bb = a.bbox(); errs = a.errs_map()
        chk("T6 t 2→4: flanş hata yok, dış ölçü 'malzeme içte' korunur (z 0..-60, y yükseklik 30)", not errs and bb and near(bb[0][2], -60, .01) and near(bb[1][2], 0, .01) and near(bb[1][1] - bb[0][1], 30, 0.01), (bb0, bb, errs))
        r = flat_dims(a); exp = 60 + 30 - (2 * (2 + 4) - ba(90, 2, 4, 0.5))
        chk("T6 t=4 açınım %.3f" % exp, r and near(r["h"], exp, 0.02), r and r["h"])
    case("T6", t6)

    print("diyaloglar:", a.dlog, "hatalar:", a.errs[:5])
    a.close()
finish()

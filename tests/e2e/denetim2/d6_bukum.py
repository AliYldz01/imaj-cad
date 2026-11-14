# Denetim 2 / d6 — Kenet, Çizgiden Büküm, Kademe: PM seçenekleri + yaşam döngüsü + açınım (gerçek tık / klavye)
# Hazır model: yalnız eskizler (taban levhası, yüz üzerindeki büküm / kademe çizgisi) setDoc ile; sac özellikleri şeritten.
import sys
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d6h import *  # noqa
ONLY = os.environ.get('ONLY')
FR = {"o": [0, 2, 0], "x": [1, 0, 0], "n": [0, 1, 0]}
FACE = {"k": "face", "frame": FR, "face": {"c": [50, 2, -30], "n": [0, 1, 0]}}


def line_sk(sid, name, x0, y0, x1, y1):
    return sketch(sid, name, FACE, lambda pt, line, rect, c, t: line(pt(x0, y0), pt(x1, y1)))


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

    # ---------- H1 Kenet ----------
    def h1():
        res = {}
        for kind, pos in (("Kapalı", "Malzeme içte"), ("Açık", "Malzeme içte"), ("Kapalı", "Bükümün dışı"), ("Açık", "Bükümün dışı")):
            base()
            new_sheet(a, "Kenet")
            chk("H1 PM açıldı", a.mode() == "pm" and a.pmhas("Uzunluk"))
            edge_click(a, [50, 2, 0])
            a.pmseg(kind); a.pmseg(pos)
            if kind == "Açık":
                chk("H1 açık kenette Aralık alanı", a.pmhas("Aralık"))
                a.pmfield("Aralık", 1)
            a.pmfield("Uzunluk", 10); a.ok()
            bb = a.bbox(); v = a.vol(); r = flat_dims(a); errs = a.errs_map()
            res[(kind, pos)] = (bb, v, r and r["h"])
            print("   %s/%s: bb %s hacim %s açınım %s bükümler %s %s" % (kind, pos, bb, v, r and r["h"], r and r["bends"], errs))
            gap = 1 if kind == "Açık" else 0
            chk("H1 %s/%s: hata yok, üst yükseklik 4+aralık (kapalıda 0.1 boşluk), büküm 180°" % (kind, pos), not errs and bb and near(bb[1][1], 4 + gap, 0.15) and r and r["bends"] and near(r["bends"][0]["angle"], 180, 0.5), (bb, errs, r and r["bends"]))
            zmax = 0 if pos == "Malzeme içte" else None
            if zmax is not None:
                chk("H1 %s malzeme içte → dış ölçü korunur (z üst 0)" % kind, bb and near(bb[1][2], 0, 0.01), bb)
            else:
                chk("H1 %s bükümün dışı → kenet kenardan dışarı (z üst > 0)" % kind, bb and bb[1][2] > 0.5, bb)
            # açınım: düz kısımlar + 180° büküm payı (SW): yaklaşık 60 + 10 - (r+t)·2 + π(r + K t)
            rr = gap / 2
            rr = r["bends"][0]["r"] if r and r["bends"] else rr
            # uzunluk dış katlama kenarından ölçülürse (SW görseli): düz kısım L − (r+t)
            exp_sw = (60 - (rr + 2) if pos == "Malzeme içte" else 60) + (10 - (rr + 2)) + PI * (rr + 0.5 * 2)
            # bizdeki yorum: L = düz (teğet) kısım
            exp_tan = (60 - (rr + 2) if pos == "Malzeme içte" else 60) + 10 + PI * (rr + 0.5 * 2)
            print("   açınım %.3f · dış kenardan L ise %.3f · teğetten L ise %.3f" % (r["h"] if r else -1, exp_sw, exp_tan))
            chk("H1 %s/%s açınım iç tutarlı (teğet yorumu) %.3f" % (kind, pos, exp_tan), r and abs(r["h"] - exp_tan) < 0.02, r and r["h"])
            chk("H1 %s/%s kenet uzunluğu dış katlama kenarından (SW, doğrulanmadı) %.3f" % (kind, pos, exp_sw), r and abs(r["h"] - exp_sw) < 0.02, r and r["h"])
        # yaşam döngüsü (kapalı, içte)
        base()
        new_sheet(a, "Kenet"); edge_click(a, [50, 2, 0]); a.ok()
        v0 = a.vol()
        a.edit_feat("Kenet1")
        chk("H1b Düzenle → PM, 1 kenar", a.mode() == "pm" and "1 kenar" in a.pmtext())
        a.pmfield("Uzunluk", 15); a.ok()
        v1 = a.vol()
        chk("H1b L 10→15 hacim +5·2·100=1000", near(v1 - v0, 1000, 1), (v0, v1))
        a.edit_feat("Kenet1"); a.pmcheck("Yönü ters çevir", True); a.ok()
        bb = a.bbox()
        chk("H1b ters yön → kenet alta (y min −2.1)", bb and near(bb[0][1], -2.1, 0.06), bb)
        a.undo(); a.undo()
        chk("H1d 2× geri al → ilk", near(a.vol(), v0), a.vol())
        a.redo()
        chk("H1d ileri al → L15", near(a.vol(), v1), a.vol())
        a.reload()
        chk("H1e yenile → L15", near(a.vol(), v1), a.vol())
        a.edit_feat("Kenet1"); a.pmfield("Uzunluk", 30); a.cancel("discard")
        chk("H1f ✕ → değişmez", near(a.vol(), v1), a.vol())
        # kenet + kenar flanşı karşı kenarda, sonra kenet sil
        new_sheet(a, "Kenar Flanş"); edge_click(a, [50, 2, -60]); a.ok()
        a.dq[:] = [True]; a.tact("Kenet1", "Sil")
        chk("H1g kenet silinince kenar flanşı yaşar", not a.errs_map() and a.vol() > 12000, (a.errs_map(), a.vol()))
        # flanşın ucuna kenet (flanş dış kenarı)
        new_sheet(a, "Kenet"); edge_click(a, [50, 25, -60]); a.ok()
        print("   flanş ucuna kenet:", a.vol(), a.errs_map())
        chk("H1 flanş ucundaki kenara kenet", not a.errs_map(), a.errs_map())
        r = flat_dims(a)
        chk("H1 flanş + kenet açınım 2 büküm", r and len(r["bends"]) == 2, r and r["bends"])
    case("H1", h1)

    # ---------- B1 Çizgiden Büküm ----------
    def b1():
        for pos, label, fexp in (("center", "Büküm merkez çizgisi", 60), ("inside", "Malzeme içte", None), ("outside", "Malzeme dışta", None)):
            base([line_sk("s4", "Eskiz2", -10, 30, 110, 30)])
            new_sheet(a, "Çizgiden Büküm", "Eskiz2")
            chk("B1 PM açıldı (%s)" % pos, a.mode() == "pm" and a.pmhas("Büküm açısı"))
            a.pmselect("Büküm konumu", pos); a.ok()
            bb = a.bbox(); r = flat_dims(a); errs = a.errs_map()
            print("   %s: bb %s hacim %s açınım %s %s" % (pos, bb, a.vol(), r and (r["w"], r["h"], r["bends"]), errs))
            chk("B1 %s: hata yok, 1 büküm 90°" % pos, not errs and r and len(r["bends"]) == 1 and near(r["bends"][0]["angle"], 90, 0.2), (errs, r and r["bends"]))
            if fexp:
                chk("B1 merkez çizgisi: açınım değişmez 100×60 (SW)", r and near(r["h"], 60, 0.02) and near(r["w"], 100, 0.02), r and (r["w"], r["h"]))
                # büküm çizgisi açınımda çizilen yerde (z=30 → açınımda 30)
                txt = dxf_download(a); d = dxf_parse(txt)
                bl = [l for l in d["lines"] if l[0].startswith("BUKUM")]
                ys = [l[2] for l in bl]
                chk("B1 merkez çizgisi: DXF büküm çizgisi çizilen çizgide (30 mm)", bl and (near(ys[0], 30, 0.02) or near(ys[0], 30, 0.02)), bl)
            else:
                # SW: çizgiden büküm malzeme eklemez → açınım her konumda 100×60; konum yalnız bükümün çizgiye göre yerini değiştirir
                chk("B1 %s: açınım yine 100×60" % pos, r and near(r["h"], 60, 0.02), r and r["h"])
        # bükülen taraf / yön / açı / R
        base([line_sk("s4", "Eskiz2", -10, 30, 110, 30)])
        new_sheet(a, "Çizgiden Büküm", "Eskiz2"); a.ok()
        bb0 = a.bbox()
        a.edit_feat("Büküm1") if "Büküm1" in a.names() else a.edit_feat(a.names()[-1])
        nm = a.names()[-1]
        chk("B1b Düzenle → PM", a.mode() == "pm")
        a.pmcheck("Bükülen tarafı değiştir", True); a.ok()
        bb1 = a.bbox()
        chk("B1b bükülen taraf değişti (bbox farklı)", bb1 != bb0, (bb0, bb1))
        a.edit_feat(nm); a.pmcheck("Büküm yönünü ters çevir", True); a.ok()
        bb2 = a.bbox()
        chk("B1b büküm yönü ters → aşağı (y min < −10)", bb2[0][1] < -10, bb2)
        a.edit_feat(nm); a.pmfield("Büküm açısı", 45); a.pmcheck("Varsayılan yarıçapı kullan", False); a.pmfield("Yarıçap", 5); a.ok()
        r = flat_dims(a)
        chk("B1b 45° R5 → büküm 45° R5, açınım merkez çizgisinde 60", r and near(r["bends"][0]["angle"], 45, 0.2) and near(r["bends"][0]["r"], 5, 0.01) and near(r["h"], 60, 0.05), r and (r["h"], r["bends"]))
        v = a.vol()
        a.undo(); a.undo(); a.undo()
        chk("B1d 3× geri al → ilk bbox", a.bbox() == bb0, (a.bbox(), bb0))
        a.redo(); a.redo(); a.redo()
        chk("B1d 3× ileri al", near(a.vol(), v), a.vol())
        a.reload()
        chk("B1e yenile", near(a.vol(), v), a.vol())
        tree = a.ev("document.querySelector('#tree').innerText")
        a.tsel(nm)
        acts = a.ev("[...document.querySelectorAll('#tree-actions button')].map(b=>b.textContent)")
        chk("B1c (P-4) büküm çizgisi eskizi ağaçta / Eskizi düzenle", "Eskiz2" in tree or "Eskizi düzenle" in acts, (tree.replace("\n", "|"), acts))
        # çok çizgili eskiz → hata
        base([sketch("s4", "Eskiz2", FACE, lambda pt, line, rect, c, t: (line(pt(-10, 30), pt(110, 30)), line(pt(-10, 40), pt(110, 40))))])
        new_sheet(a, "Çizgiden Büküm", "Eskiz2"); a.ok()
        print("   2 çizgili eskiz:", a.vol(), a.errs_map(), a.toast())
        m_ = a.mode(); tt = a.toast()
        if m_ == "pm": a.cancel("discard")
        chk("B1 2 çizgili eskiz: SW gibi iki büküm (SW çok çizgiye izin verir)", len((flat_dims(a) or {"bends": []})["bends"]) == 2, (m_, tt, a.errs_map()))
        # çizgi levhayı tam geçmiyor (SW: çizgi uzatılır)
        base([line_sk("s4", "Eskiz2", 20, 30, 80, 30)])
        new_sheet(a, "Çizgiden Büküm", "Eskiz2"); a.ok()
        r = flat_dims(a)
        print("   kısa çizgi:", a.errs_map(), r and r["bends"])
        chk("B1 kısa çizgi (levhayı geçmiyor) → SW gibi tam genişlikte büküm", not a.errs_map() and r and len(r["bends"]) == 1 and near(r["bends"][0]["len"], 100, 0.1), (a.errs_map(), r and r["bends"]))
    case("B1", b1)

    # ---------- J1 Kademe ----------
    def j1():
        base([line_sk("s4", "Eskiz2", -10, 30, 110, 30)])
        new_sheet(a, "Kademe", "Eskiz2")
        chk("J1 PM açıldı", a.mode() == "pm" and a.pmhas("Kademe yüksekliği"))
        a.pmfield("Kademe yüksekliği", 15); a.ok()
        bb = a.bbox(); r = flat_dims(a); errs = a.errs_map(); v = a.vol()
        print("   kademe 15:", bb, v, r and (r["w"], r["h"], r["bends"]), errs)
        chk("J1 hata yok, 2 büküm 90° zıt yönlü", not errs and r and len(r["bends"]) == 2 and r["bends"][0]["up"] != r["bends"][1]["up"], (errs, r and r["bends"]))
        chk("J1 izdüşüm boyu korunur (z 60) ve yükseklik 15 (dış ölçü 15 ya da 17)", bb and near(bb[1][2] - bb[0][2], 60, 0.02) and (near(bb[1][1] - bb[0][1], 15, 0.05) or near(bb[1][1] - bb[0][1], 17, 0.05)), bb)
        # SW (dış öteleme, sabit izdüşüm boyu): açınım = 60 + düşey bacak boyu ... yaklaşık 60 + 15 − 2·BD + ...
        H = bb[1][1] - bb[0][1]
        exp = 60 + (H - 2) - 2 * (2 * 4 - ba(90, 2, 2, 0.5)) + (2)  # kaba: dikey bacak dış ölçüsü H, iki büküm
        print("   kaba beklenen açınım ≈ %.3f" % exp)
        nm = a.names()[-1]
        a.edit_feat(nm); a.pmfield("Kademe yüksekliği", 25); a.ok()
        bb2 = a.bbox()
        chk("J1b yükseklik 25", near(bb2[1][1] - bb2[0][1] - (H - 15), 25, 0.05), bb2)
        topy = lambda z: a.ev("z=>{const m=window.__app.viewer.mesh;let b=null;m.faces.forEach(f=>{if(f.n&&f.n[1]>0.99&&Math.abs(f.c[2]-z)<12&&(b===null||f.c[1]>b))b=f.c[1]});return b}", z)
        h0 = (topy(-55), topy(-5))
        a.edit_feat(nm); a.pmcheck("Hareket eden tarafı değiştir", True); a.ok()
        h1 = (topy(-55), topy(-5))
        chk("J1b hareket eden taraf değişti (yükselen bölge öbür yanda)", h0 != h1 and h0[0] is not None and h1[0] is not None, (h0, h1))
        a.edit_feat(nm); a.pmcheck("Yönü ters çevir", True); a.ok()
        bb4 = a.bbox()
        chk("J1b yön ters → aşağı", bb4[0][1] < -10, bb4)
        a.undo(); a.undo(); a.undo()
        chk("J1d 3× geri al → ilk", a.bbox() == bb, (a.bbox(), bb))
        a.reload()
        chk("J1e yenile", a.bbox() == bb, a.bbox())
        a.edit_feat(nm); a.pmfield("Kademe yüksekliği", 40); a.cancel("discard")
        chk("J1f ✕", a.bbox() == bb, a.bbox())
        # kademe yüksekliği < 2t+r
        a.edit_feat(nm); a.pmfield("Kademe yüksekliği", 1); a.ok()
        m_, tt = a.mode(), a.toast()
        print("   kademe 1 mm ✓ sonrası:", m_, tt)
        if m_ == "pm":
            chk("J1 çok küçük kademe → ✓ reddedilir (uyarı: %s)" % tt, bool(tt), tt)
            a.cancel("discard")
        r = flat_dims(a)
        print("   kademe 1 mm:", a.bbox(), a.vol(), a.errs_map(), r and r["bends"])
        chk("J1 çok küçük kademe sonrası model tutarlı (ya reddedildi → 25 mm kademe, ya hata)", a.errs_map() or (r and len(r["bends"]) == 2), (a.vol(), a.errs_map(), r and r["bends"]))
    case("J1", j1)

    print("diyaloglar:", a.dlog, "hatalar:", a.errs[:5])
    a.close()
finish()

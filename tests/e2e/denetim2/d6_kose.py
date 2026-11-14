# Denetim 2 / d6 — Gönye Flanş, Köşe Kapat (kaynaklı dahil), Köşe Kır (R / pah), Saca Dönüştür
# Hazır model: eskizler (+ Saca Dönüştür için kabuklanmış kutu) setDoc ile; sac özellikleri şeritten / PM'den.
import sys
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d6h import *  # noqa
ONLY = os.environ.get('ONLY')
BD = 2 * 4 - ba(90, 2, 2, 0.5)


def miter_prof(sid="s5", name="Eskiz2", h=22, w=15):
    # Sağ düzlem (x=0): yerel (u,v) → dünya (0, v, −u); ön kenarın (z=0) x=0 ucunda, kenara dik
    return sketch(sid, name, RIGHT, lambda pt, line, rect, c, t: (lambda p0, p1, p2: (line(p0, p1), line(p1, p2)))(pt(0, 2), pt(0, h), pt(-w, h)))


def zoom_at(a, w, clicks=4):
    s = a.wsc(w)
    a.pg.mouse.move(s[0], s[1])
    for _ in range(clicks):
        a.pg.mouse.wheel(0, 240); time.sleep(0.15)
    time.sleep(0.4)


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

    # ---------- G1 Gönye flanş ----------
    def g1():
        base([miter_prof()])
        new_sheet(a, "Gönye Flanş", "Eskiz2")
        chk("G1 PM açıldı, profil seçici", a.mode() == "pm" and a.pmhas("Profil eskizi"), a.pmtext()[:80])
        edge_click(a, [50, 2, 0])
        chk("G1 1 kenar", "1 kenar seçili" in a.pmtext())
        a.ok()
        bb = a.bbox(); errs = a.errs_map(); v1 = a.vol(); r = flat_dims(a)
        print("   gönye 1 kenar:", bb, v1, errs, r and (r["w"], r["h"], r["bends"]))
        chk("G1 tek kenar: hata yok, x 0..100, y 0..22, z 0..15", not errs and bb and near(bb[1][1], 22, 0.05) and near(bb[1][2], 15, 0.05) and near(bb[1][0] - bb[0][0], 100, 0.05), bb)
        chk("G1 tek kenar açınım 2 büküm", r and len(r["bends"]) == 2, r and r["bends"])
        # SW: profil çizgileri malzemenin bir yüzü: dış ölçüler 22 / 15 → açınım ≈ 60 + 20 + 15 − 2·BD(dışa) ... kaba bilgi
        nm = a.names()[-1]
        a.edit_feat(nm)
        chk("G1b Düzenle → PM 1 kenar", a.mode() == "pm" and "1 kenar" in a.pmtext())
        edge_click(a, [100, 2, -30])
        a.ok()
        errs = a.errs_map(); v2 = a.vol(); r2 = flat_dims(a)
        print("   gönye 2 kenar:", a.bbox(), v2, errs, r2 and (r2["w"], r2["h"], len(r2["bends"])))
        chk("G1b 2 kenar (köşede gönye): hata yok, hacim artar, 4 büküm", not errs and v2 > v1 + 1000 and r2 and len(r2["bends"]) == 4, (errs, v1, v2, r2 and len(r2["bends"])))
        a.edit_feat(nm); a.pmfield("Köşe boşluğu", 2); a.ok()
        v3 = a.vol()
        chk("G1b köşe boşluğu 0.5 → 2: hacim azalır", v3 < v2, (v2, v3))
        a.edit_feat(nm); a.pmcheck("Malzeme tarafını ters çevir", True); a.ok()
        bb4 = a.bbox()
        print("   malzeme ters:", bb4, a.vol(), a.errs_map())
        chk("G1b malzeme ters → dış ölçü değişir, hata yok", not a.errs_map() and bb4 != bb, bb4)
        a.undo(); a.undo(); a.undo()
        chk("G1d 3× geri al → tek kenar", near(a.vol(), v1), (a.vol(), v1))
        a.redo(); a.redo()
        chk("G1d 2× ileri al → boşluk 2", near(a.vol(), v3), (a.vol(), v3))
        a.reload()
        chk("G1e yenile", near(a.vol(), v3), a.vol())
        a.edit_feat(nm); a.pmbtn("Seçimi temizle"); a.cancel("discard")
        chk("G1f ✕ → kenarlar korunur", near(a.vol(), v3), a.vol())
        a.tsel(nm)
        acts = a.ev("[...document.querySelectorAll('#tree-actions button')].map(b=>b.textContent)")
        tree = a.ev("document.querySelector('#tree').innerText")
        chk("G1c (P-4) gönye profili eskizi ağaçta / Eskizi düzenle", "Eskiz2" in tree or "Eskizi düzenle" in acts, (tree.replace("\n", "|"), acts))
        a.tact(nm, "Bastır")
        chk("G1g bastır → 12000", near(a.vol(), 12000), a.vol())
        a.tact(nm, "Etkinleştir")
        chk("G1g etkinleştir", near(a.vol(), v3), a.vol())
        # kapalı profil eskizi seçilemez
        base([miter_prof(), rect_sk("s6", "Eskiz3", RIGHT, -10, 5, -5, 10, dims=False)])
        new_sheet(a, "Gönye Flanş", "Eskiz2")
        opts = a.ev("[...document.querySelectorAll('#pm-body label.pm-field select option')].map(o=>o.textContent)")
        chk("G1 profil listesinde yalnız açık eskizler", "Eskiz3" not in opts and "Eskiz2" in opts, opts)
        a.cancel("discard")
        # profil kenar ucunda değil → hata
        base([sketch("s5", "Eskiz2", RIGHT, lambda pt, line, rect, c, t: (lambda p0, p1, p2: (line(p0, p1), line(p1, p2)))(pt(-30, 2), pt(-30, 22), pt(-45, 22)))])
        new_sheet(a, "Gönye Flanş", "Eskiz2"); edge_click(a, [50, 2, 0]); a.ok()
        print("   uçta olmayan profil:", a.vol(), a.errs_map(), a.mode(), a.toast())
        chk("G1 profil kenar ucunda değilse hata (sessiz değil)", a.errs_map() or a.mode() == "pm", (a.vol(), a.errs_map()))
        if a.mode() == "pm": a.cancel("discard")
    case("G1", g1)

    # ---------- C1 Köşe kapat ----------
    def two_flanges():
        base()
        new_sheet(a, "Kenar Flanş"); edge_click(a, [50, 2, 0]); a.pmfield("Uzunluk", 30); a.ok()
        new_sheet(a, "Kenar Flanş"); edge_click(a, [100, 2, -30]); a.pmfield("Uzunluk", 30); a.ok()
        print("   iki ayrı flanş:", a.vol(), a.errs_map(), a.bbox())

    def c1():
        two_flanges()
        v0 = a.vol()
        ends = a.ev("""window.__app.viewer.mesh.faces.filter(f=>f.n&&f.c[1]>8&&Math.abs(f.n[2]-1)<1e-3&&f.c[0]>90&&f.c[2]>-6).map(f=>f.c)""")
        print("   köşe uç yüzü (flanş 2):", ends)
        res = {}
        for mode_, lbl, gap in (("under", "Alın (iç yüze kadar)", 0.2), ("under1", "Alın (iç yüze kadar)", 1), ("over", "Bindirme (dış yüze kadar)", 0.2), ("over1", "Bindirme (dış yüze kadar)", 1)):
            two_flanges()
            new_sheet(a, "Köşe Kapat")
            chk("C1 PM açıldı", a.mode() == "pm" and "uç yüz" in a.pmtext())
            a.wclick(ends[0]); a.wait(0.4)
            chk("C1 1 uç yüz seçili", "1 uç yüz" in a.pmtext(), a.pmtext()[:80])
            a.pmseg(lbl); a.pmfield("Boşluk", gap); a.ok()
            v = a.vol(); errs = a.errs_map()
            res[mode_] = v
            print("   köşe kapat %s boşluk %g:" % (lbl, gap), v, errs)
            chk("C1 %s boşluk %g: hata yok, hacim artar" % (lbl, gap), not errs and v > v0, (v0, v, errs))
            r = flat_dims(a)
            chk("C1 %s boşluk %g: açınım çalışır (2 büküm)" % (lbl, gap), r and len(r["bends"]) == 2, r and r["bends"])
        chk("C1 alın: boşluk 0.2 → 1 hacim azalır", res["under1"] < res["under"], res)
        chk("C1 bindirme: boşluk 0.2 → 1 hacim azalır (boşluk uygulanır)", res["over1"] < res["over"], res)
        chk("C1 bindirme > alın hacmi", res["over"] > res["under"], res)
        # yaşam döngüsü (alın)
        two_flanges()
        new_sheet(a, "Köşe Kapat"); a.wclick(ends[0]); a.wait(0.4); a.ok()
        nm = a.names()[-1]; vu = a.vol()
        a.edit_feat(nm)
        chk("C1b Düzenle → 1 uç yüz", a.mode() == "pm" and "1 uç yüz" in a.pmtext())
        a.pmfield("Boşluk", 1); a.ok()
        vg = a.vol()
        chk("C1b boşluk 0.2 → 1: hacim azalır", vg < vu, (vu, vg))
        a.edit_feat(nm); a.pmcheck("Kaynaklı köşe", True); a.ok()
        vw = a.vol()
        chk("C1b kaynaklı köşe: hacim artar (boşluk dolar)", vw > vg, (vg, vw))
        r = flat_dims(a)
        chk("C1b kaynaklı köşe açınımda bastırılır, açınım çalışır", r and len(r["bends"]) == 2, r and r["bends"])
        chk("C1b açınımdan çıkınca kaynaklı model geri", near(a.vol(), vw), (a.vol(), vw))
        a.undo(); a.undo()
        chk("C1d 2× geri al → boşluk 0.2", near(a.vol(), vu), (a.vol(), vu))
        a.redo(); a.redo()
        chk("C1d ileri al → kaynaklı", near(a.vol(), vw), a.vol())
        a.reload()
        chk("C1e yenile", near(a.vol(), vw), a.vol())
        a.edit_feat(nm); a.pmfield("Boşluk", 3); a.cancel("discard")
        chk("C1f ✕", near(a.vol(), vw), a.vol())
        # ebeveyn flanş uzunluğu değişince
        a.edit_feat("Kenar-Flanş2"); a.pmfield("Uzunluk", 40); a.ok()
        print("   flanş 2 boyu 30→40:", a.vol(), a.errs_map(), a.ev("[...document.querySelectorAll('dialog[open]')].map(d=>d.className)"))
        chk("C1c ebeveyn flanş 30→40: köşe kapatma uç yüzü izler (hata yok)", not a.errs_map(), a.errs_map())
        a.close_dialogs()
        a.dq[:] = [True]
        a.tact("Kenar-Flanş2", "Sil")
        print("   flanş 2 silinince:", a.names(), a.errs_map())
        chk("C1g ebeveyn flanş silinince köşe kapat hata gösterir ya da birlikte silinir", nm not in a.names() or a.errs_map(), (a.names(), a.errs_map()))
        a.close_dialogs()
        a.undo()
        a.close_dialogs()
    case("C1", c1)

    # ---------- R1 Köşe kır (R / pah) ----------
    def r1():
        for cmd, val, dv in (("Köşe Kır (R)", 5, (25 - PI * 25 / 4) * 2), ("Köşe Kır (pah)", 5, 12.5 * 2)):
            base()
            new_sheet(a, cmd)
            chk("R1 %s PM açıldı" % cmd, a.mode() == "pm", a.mode())
            zoom_at(a, [100, 1, 0], 6)
            e = edge_click(a, [100, 1, 0])
            sel = a.ev("JSON.stringify((window.__app.mode.draft||{}).edges||[])")
            print("   seçilen kenar:", sel)
            fld = "Yarıçap" if "R" in cmd else "Mesafe"
            if a.pmhas(fld): a.pmfield(fld, val)
            a.ok()
            v = a.vol(); errs = a.errs_map()
            chk("R1 %s %g: hacim 12000 − %.2f" % (cmd, val, dv), not errs and near(v, 12000 - dv, 0.05), (v, errs))
            r = flat_dims(a)
            chk("R1 %s açınım kesim konturunda yay / pah (düz levha 100×60)" % cmd, r and near(r["w"], 100, 0.01) and near(r["h"], 60, 0.01) and ("a" in r["kinds"] if "R" in cmd else r["n"] >= 5), r and (r["w"], r["h"], r["kinds"], r["n"]))
            nm = a.names()[-1]
            a.edit_feat(nm); a.pmfield(fld, 10) if a.pmhas(fld) else None; a.ok()
            dv2 = (100 - PI * 100 / 4) * 2 if "R" in cmd else 50 * 2
            chk("R1b %s 10: hacim 12000 − %.2f" % (cmd, dv2), near(a.vol(), 12000 - dv2, 0.05), a.vol())
            a.undo()
            chk("R1d geri al → %g" % val, near(a.vol(), 12000 - dv, 0.05), a.vol())
            a.reload()
            chk("R1e yenile", near(a.vol(), 12000 - dv, 0.05), a.vol())
            # kenar flanşı eklenince (kalınlık kenarı kaybolmaz) köşe kır yaşar mı
        base()
        new_sheet(a, "Köşe Kır (R)")
        zoom_at(a, [50, 2, 0], 1)
        edge_click(a, [50, 2, 0])  # kalınlık boyunca olmayan kenar (üst yüz kenarı)
        a.ok()
        print("   köşe kırda yüz kenarı:", a.vol(), a.errs_map(), a.mode(), a.toast())
        chk("R1 sac köşe kırda kalınlık boyunca olmayan kenar → uyarı / hata (SW yalnız köşe kenarı kabul eder)", a.errs_map() or a.mode() == "pm" or near(a.vol(), 12000), (a.vol(), a.errs_map()))
        if a.mode() == "pm": a.cancel("discard")
    case("R1", r1)

    # ---------- S1 Saca dönüştür ----------
    def vkey(k):
        a.blur(); a.pg.keyboard.press(k); time.sleep(0.5); fit(a)

    def pick_s1():
        """alt dış kenarlar (büküm) alttan görünüşte, dikey köşe kenarları (yarık) izometrik + arkadan"""
        vkey("Control+6")
        for w in ([50, 0, 0], [100, 0, -30], [50, 0, -60], [0, 0, -30]):
            edge_click(a, w)
        a.pmseg("Yarık kenarları")
        vkey("Control+7")
        for w in ([100, 20, 0], [100, 20, -60], [0, 20, 0]):
            edge_click(a, w)
        vkey("Control+2")
        edge_click(a, [0, 20, -60])
        vkey("Control+7")

    def s1():
        box = rect_sk("s1", "Eskiz1", TOP, 0, 0, 100, 60)
        feats = [box, ext("e1", "s1", 40), {"id": "sh", "type": "shell", "name": "Kabuk1", "t": 2, "faces": [{"c": [50, 40, -30], "n": [0, 1, 0]}]}]
        a.setup(feats)
        view_iso(a); fit(a)
        v0 = a.vol()
        print("   kabuklu kutu:", v0, a.bbox(), a.errs_map())
        new_sheet(a, "Saca Dönüştür")
        chk("S1 PM açıldı", a.mode() == "pm" and a.pmhas("Kalınlık"))
        pick_s1()
        t2 = a.pmtext()
        print("   ", [l for l in t2.split("\n") if "Büküm:" in l])
        chk("S1 4 büküm + 4 yarık seçildi", "Büküm: 4 · Yarık: 4" in t2, [l for l in t2.split("\n") if "Büküm:" in l])
        a.ok()
        v = a.vol(); errs = a.errs_map()
        print("   saca dönüştür:", v, errs, a.bbox())
        chk("S1 hata yok", not errs, errs)
        r = flat_dims(a)
        print("   açınım:", r and (r["w"], r["h"], r["bends"]))
        # SW: dış ölçü 100×60×40, t2 r2 K.5 → açınım (100 + 2·(40 − BD/… )) kaba: 100 + 2·(40−4) + 2·BA/... dış kenar seçildi
        expw = 100 - 2 * 4 + 2 * (40 - 4) + 2 * ba(90, 2, 2, 0.5)
        exph = 60 - 2 * 4 + 2 * (40 - 4) + 2 * ba(90, 2, 2, 0.5)
        print("   SW beklenen (dış ölçüler korunur, R2 eklenir): %.3f × %.3f" % (expw, exph))
        chk("S1 açınım 4 büküm", r and len(r["bends"]) == 4, r and r["bends"])
        chk("S1 açınım ≈ (dış ölçüler korunarak) %.2f × %.2f (±0.3)" % (expw, exph), r and abs(max(r["w"], r["h"]) - expw) < 0.3 and abs(min(r["w"], r["h"]) - exph) < 0.3, r and (r["w"], r["h"]))
        nm = a.names()[-1]
        a.edit_feat(nm); a.pmfield("Büküm yarıçapı", 4); a.ok()
        print("   R4:", a.vol(), a.errs_map())
        r2 = flat_dims(a)
        chk("S1b R4 → büküm R4", r2 and r2["bends"] and near(r2["bends"][0]["r"], 4, 0.01), r2 and r2["bends"])
        a.edit_feat(nm); a.pmfield("K faktörü", 0.3); a.ok()
        r3 = flat_dims(a)
        chk("S1b K 0.3 → açınım küçülür", r3 and r2 and r3["w"] < r2["w"], (r2 and r2["w"], r3 and r3["w"]))
        a.undo(); a.undo()
        chk("S1d 2× geri al", near(a.vol(), v), (a.vol(), v))
        a.reload()
        chk("S1e yenile", near(a.vol(), v), a.vol())
        # saca dönüştürülmüş parçaya kenar flanşı
        new_sheet(a, "Kenar Flanş"); edge_click(a, [50, 40, 0]); a.ok()
        print("   saca dönüştür + kenar flanşı:", a.vol(), a.errs_map())
        chk("S1 dönüştürülen saca kenar flanşı eklenir", not a.errs_map() and a.vol() > v, (a.vol(), a.errs_map()))
        # kabuk kalınlığı ≠ sac kalınlığı
        a.setup(feats); view_iso(a); fit(a)
        new_sheet(a, "Saca Dönüştür"); a.pmfield("Kalınlık", 3)
        pick_s1()
        a.ok()
        print("   kalınlık 3 (kabuk 2):", a.vol(), a.errs_map())
        r = flat_dims(a)
        print("   t3 açınım:", r and (r["w"], r["h"], len(r["bends"])))
        chk("S1 kalınlık (3) kabuk kalınlığıyla (2) uyuşmazsa hata / uyarı ya da doğru 4 bükümlü açınım (sessiz yanlış açınım değil)", bool(a.errs_map()) or r is None or len(r["bends"]) == 4, (a.vol(), a.errs_map(), r and (r["w"], r["h"], len(r["bends"]))))
    case("S1", s1)

    print("diyaloglar:", a.dlog, "hatalar:", a.errs[:5])
    a.close()
finish()

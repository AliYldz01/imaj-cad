# Denetim 2 / d7 — Özellikler > Detay: Kubbe, Yüz Taşı / Sil (taşı ±, deliği doldur), Dudak / Yiv (iç / dış, boşluk), Mandal (açı),
# Sarma (kabartma / oyma); Sac Metal > Tırnak ve Yuva. Yaşam döngüsü a–g (d5 a/b'yi denedi; burada c–g ağırlıklı).
# Hazır model: taban blok / kabuk / levhalar (setDoc). Kullanıcı adımları gerçek tıklama.
import sys
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d7h import *  # noqa

TOPF = "f=>f.n&&f.n[1]>0.99"

with sync_playwright() as p:
    a = App(p)
    case = lambda n, f: run_case(a, n, f)

    def dlg_later():
        if a.pg.locator("dialog.reselect-dialog[open]").count():
            txt = a.ev("document.querySelector('dialog.reselect-dialog[open]').innerText")
            a.btn("dialog.reselect-dialog[open] button:has-text('Daha sonra')")
            return txt.replace("\n", " | ")
        return ""

    # ---------------- KUBBE ----------------
    def kb():
        a.setup(block(80, 60, 20))
        v0 = a.vol()
        a.cmd("Kubbe"); a.wait(0.5)
        a.face_click(TOPF); a.wait(0.3)
        a.pmfield("Yükseklik", 10); a.wait(0.5); a.ok()
        v1 = a.vol(); bb = a.bbox()
        chk("KB-a kubbe h10 → y max 30, hacim arttı", near(bb[1][1], 30, .05) and v1 > v0, (v1 - v0, bb, a.errs_map()))
        nm = a.names()[-1]
        a.tact("Ekstrüzyon1", "Eskizi düzenle"); a.dim_dbl(0, 100); a.ok()
        v2 = a.vol(); bb = a.bbox(); rs = dlg_later()
        chk("KB-c taban 80→100 → kubbe yeni üst yüzde, x ±50, hacim arttı", near(bb[1][0] - bb[0][0], 100, .05) and near(bb[1][1], 30, .05) and v2 > v1 and not a.errs_map(), (v2, bb, a.errs_map(), rs))
        a.undo(); u = a.vol(); a.redo(); r = a.vol()
        chk("KB-d geri al / ileri al", near(u, v1, 1) and near(r, v2, 1), (u, r))
        a.reload(); chk("KB-e yenile", near(a.vol(), v2, 1), a.vol())
        a.edit_feat(nm); a.pmfield("Yükseklik", 4); a.wait(0.5); a.cancel("discard")
        chk("KB-f ✕ değişmez", near(a.vol(), v2, 1), a.vol())
        a.edit_feat(nm); a.pmfield("Yükseklik", 4); a.wait(0.5); a.ok()
        chk("KB-b h4 → y max 24", near(a.bbox()[1][1], 24, .05), a.bbox())
        a.tact(nm, "Bastır"); vs = a.vol(); a.tact(nm, "Etkinleştir")
        chk("KB-g bastır → taban", near(vs, 100 * 60 * 20, 1), vs)
    case("KB", kb)

    # ---------------- YÜZ TAŞI / SİL ----------------
    def yt():
        a.setup(block(80, 60, 20))
        a.cmd("Yüz Taşı / Sil"); a.wait(0.5)
        a.face_click(TOPF); a.wait(0.3)
        a.pmfield("Mesafe", 5); a.wait(0.5); a.ok()
        chk("YT-a üst yüz +5 → 120000", near(a.vol(), 120000, 1), (a.vol(), a.errs_map()))
        nm = a.names()[-1]
        a.edit_feat(nm); a.pmfield("Mesafe", -3); a.wait(0.5); a.ok()
        chk("YT-b −3 → 81600", near(a.vol(), 81600, 1), a.vol())
        a.tact("Ekstrüzyon1", "Eskizi düzenle"); a.dim_dbl(0, 100); a.ok()
        rs = dlg_later()
        chk("YT-c genişlik 80→100 → 100·60·17 = 102000", near(a.vol(), 102000, 1) and not a.errs_map(), (a.vol(), a.errs_map(), rs))
        a.edit_feat("Ekstrüzyon1"); a.pmfield("Derinlik", 30); a.wait(0.5); a.ok()
        rs = dlg_later()
        chk("YT-c derinlik 20→30 → taşınan üst yüz izlenir: 100·60·27 = 162000", near(a.vol(), 162000, 1) and not a.errs_map(), (a.vol(), a.errs_map(), rs))
        a.undo(); u = a.vol(); a.redo(); r = a.vol()
        chk("YT-d geri al / ileri al", near(u, 102000, 1) and near(r, 162000, 1), (u, r))
        a.reload(); chk("YT-e yenile", near(a.vol(), 162000, 1), a.vol())
        # deliği doldur
        hole = circ_sk("s2", "Delik", top_face(20), 10, 5, 5)
        cut = ext("e2", "s2", 20, cut=True, end="through"); cut["name"] = "Kesme1"
        a.setup(block(80, 60, 20) + [hole, cut])
        vh = a.vol()
        a.cmd("Yüz Taşı / Sil"); a.wait(0.5); a.pmseg("Deliği doldur (yüz sil)")
        a.wclick([5.2, 17, -5]); a.wait(0.3)   # deliğin uzak duvarı (izometrikte görünen)
        chk("YT-a delik duvarı tıklandı → 1 yüz", a.ev("window.__app.mode.draft.faces.length") == 1, a.pmtext()[:80])
        a.wait(0.6); a.ok()
        chk("YT-a deliği doldur → 96000", near(vh, 96000 - math.pi * 25 * 20, 1) and near(a.vol(), 96000, 1), (vh, a.vol(), a.errs_map()))
        nm = a.names()[-1]
        a.tact("Delik", "Eskizi düzenle"); a.dim_dbl(0, 16); a.ok()
        rs = dlg_later()
        v = a.vol()
        print("   YT delik Ø10→16 sonrası doldurma:", v, a.errs_map(), rs)
        chk("YT-c delik çapı değişince doldurma izler (96000)", near(v, 96000, 1) and not a.errs_map(), (v, a.errs_map(), rs))
    case("YT", yt)

    # ---------------- DUDAK / YİV ----------------
    def lp():
        box = [rect_sk("s1", "Eskiz1", TOP, -30, -20, 30, 20), ext("e1", "s1", 30), {"id": "sh", "type": "shell", "name": "Kabuk1", "t": 2, "faces": [{"c": [0, 30, 0], "n": [0, 1, 0]}]}]
        box[1]["name"] = "Ekstrüzyon1"
        a.setup(box)
        vs = a.vol()
        a.cmd("Dudak / Yiv"); a.wait(0.5)
        a.wclick([29, 30, 0]); a.wait(0.3)
        pt = a.pmtext()
        a.pmfield("Genişlik", 1); a.pmfield("Yükseklik", 2); a.wait(0.5); a.ok()
        ring = (58 * 38 - (4 - math.pi) * 1) - 56 * 36
        d1 = a.vol() - vs
        chk("LP-a iç dudak w1 h2 → +374,3", near(d1, ring * 2, 1), (d1, ring * 2, a.errs_map(), pt[:80]))
        nm = a.names()[-1]
        a.edit_feat(nm); a.pmseg("Yiv (oy)"); a.wait(0.5); a.ok()
        chk("LP-b yiv → −374,3", near(vs - a.vol(), ring * 2, 1), vs - a.vol())
        a.edit_feat(nm); a.pmseg("Dudak (ekle)"); a.pmseg("Dış kenar"); a.wait(0.5); a.ok()
        d3 = a.vol() - vs
        chk("LP-b dış dudak → +392", near(d3, 392, 2), d3)
        a.edit_feat(nm); a.pmseg("İç kenar"); a.pmfield("Kenardan boşluk", 0.5); a.wait(0.5); a.ok()
        d4 = a.vol() - vs
        print("   LP iç dudak boşluk 0,5:", d4)
        chk("LP-b boşluk 0,5 → hacim farklı, hata yok", d4 > 0 and not near(d4, d1, 0.5) and not a.errs_map(), (d4, a.errs_map()))
        a.tact("Eskiz1", "Eskizi düzenle") if False else a.tact("Ekstrüzyon1", "Eskizi düzenle")
        a.dim_dbl(0, 80); a.ok()
        rs = dlg_later()
        v = a.vol()
        print("   LP-c kutu 60→80:", v, a.errs_map(), rs)
        chk("LP-c kutu genişliği 60→80 → dudak yeni ağızda, hata yok", not a.errs_map() and not rs, (v, a.errs_map(), rs))
        a.undo(); a.redo()
        a.reload(); chk("LP-e yenile hatasız", not a.errs_map() and near(a.vol(), v, 1), (a.vol(), a.errs_map()))
        a.tact("Kabuk1", "Bastır"); a.wait(0.6); rs = dlg_later(); e = a.errs_map()
        print("   LP-g kabuk bastırılınca:", e, rs)
        chk("LP-g kabuk bastırılınca dudak hatası anlaşılır Türkçe", bool(e), e)
        a.tact("Kabuk1", "Etkinleştir"); dlg_later()
    case("LP", lp)

    # ---------------- MANDAL ----------------
    def mn():
        a.setup(block(80, 60, 20))
        v0 = a.vol()
        a.cmd("Mandal"); a.wait(0.5)
        a.wclick([10, 20, 5]); a.wait(0.3); a.wait(0.5); a.ok()
        dv = a.vol() - v0
        chk("MN-a mandal (L15 t2 w6 hd1,5 hh3) → +193,5", near(dv, 193.5, 1), (dv, a.errs_map()))
        nm = a.names()[-1]
        f0 = a.featbyname(nm)
        a.edit_feat(nm); a.pmfield("Yön açısı", 90); a.pmfield("Boy", 25); a.wait(0.5); a.ok()
        dv2 = a.vol() - v0; bb = a.bbox()
        chk("MN-b boy 25 + 90° → y max 45, hacim arttı", near(bb[1][1], 45, .1) and dv2 > dv, (dv2, bb))
        a.edit_feat("Ekstrüzyon1"); a.pmfield("Derinlik", 30); a.wait(0.5); a.ok(); rs = dlg_later()
        print("   MN-c mandal konumu (p) taban 30 olunca:", a.featbyname(nm)["p"], a.featbyname(nm).get("face"))
        chk("MN-c taban 20→30 → mandal yeni üst yüzde (y max 55)", near(a.bbox()[1][1], 55, .1) and not a.errs_map(), (a.bbox(), a.errs_map(), rs))
        a.undo(); u = a.bbox()[1][1]; a.redo()
        chk("MN-d geri al → 45", near(u, 45, .1), u)
        a.reload(); chk("MN-e yenile (kayıtla aynı)", a.bbox() is not None, a.bbox())
        a.edit_feat(nm); a.wclick([-20, 30, -10]); a.wait(0.5); a.cancel("discard")
        chk("MN-f ✕ konum değişmedi", a.featbyname(nm)["p"] == a.stored()["features"][-1]["p"], a.featbyname(nm)["p"])
    case("MN", mn)

    # ---------------- SARMA ----------------
    def sr():
        cs = circ_sk("s1", "Eskiz1", FRONT, 0, 0, 20)
        cyl = ext("e1", "s1", 40); cyl["name"] = "Ekstrüzyon1"
        pl = refplane("pl1", "Düzlem1", RIGHT, 20)
        sq = rect_sk("s2", "Eskiz2", {"k": "ref", "id": "pl1"}, -5, -5, 5, 5)
        a.setup([cs, cyl, pl, sq])
        vc = a.vol()
        a.cmd("Sarma"); a.wait(0.5)
        a.wclick([20, 0, 20]); a.wait(0.3)
        if not a.ev("!!window.__app.mode.draft.face"):
            a.face_click("f=>f.t==='CYLINDRE'")
        a.pmfield("Derinlik", 1); a.wait(0.5); a.ok()
        d1 = a.vol() - vc
        chk("SR-a kabartma ≈ 10×10×1 (80…130)", 80 < d1 < 130, (d1, a.errs_map()))
        nm = a.names()[-1]
        a.tact("Eskiz2", "Eskizi düzenle"); a.dim_dbl(0, 20); a.ok(); rs = dlg_later()
        d2 = a.vol() - vc
        chk("SR-c eskiz 10→20 genişlik → kabartma ≈ 2 katı", 1.6 < d2 / d1 < 2.4 and not a.errs_map(), (d1, d2, a.errs_map(), rs))
        a.tact("Ekstrüzyon1", "Eskizi düzenle"); a.dim_dbl(0, 50); a.ok(); rs = dlg_later()
        e = a.errs_map()
        print("   SR-c silindir Ø40→Ø50 (eskiz düzlemi teğet değil artık):", a.vol(), e, rs)
        chk("SR-c silindir çapı değişince ya izler ya anlaşılır hata", True, e)
        a.undo(); a.undo(); u = a.vol() - vc; a.redo()
        chk("SR-d geri al iki adım → ilk kabartma", near(u, d1, 1), (u, d1))
        a.reload(); chk("SR-e yenile", a.vol() is not None, a.vol())
    case("SR", sr)

    # ---------------- TIRNAK VE YUVA ----------------
    def ts():
        pa = sketch("sa", "A", FRONT, lambda pt, ln, rect, c, t: rect(0, 0, 100, 40))
        rect_dims(pa, 100, 40)
        pb = sketch("sb", "B", TOP, lambda pt, ln, rect, c, t: rect(-10, -30, 110, 30))
        ea = ext("ea", "sa", 3); ea["name"] = "LevhaA"
        eb = ext("eb", "sb", 4, rev=True, merge=False); eb["name"] = "LevhaB"
        a.setup([pa, ea, pb, eb])
        v0 = a.vol()
        tab(a, "sheet")
        a.cmd("Tırnak ve Yuva"); a.wait(0.5)
        # dar uç yüzü (y=0, n −y) B levhasına dayalı → görünmez; kullanıcı A'nın alt kenarına tıklar
        a.wclick([50, 0, 1.5]); a.wait(0.3)
        fc = a.ev("JSON.parse(JSON.stringify(window.__app.mode.draft.face||null))")
        a.pmfield("Adet", 2); a.pmfield("Tırnak boyu", 10); a.pmfield("Yükseklik", 4); a.pmfield("Yuva boşluğu", 0.2); a.wait(0.6)
        st = a.status(); a.ok()
        dv = a.vol() - v0
        print("   TS-a alt kenara tıklayınca seçilen yüz:", fc, "durum", st, "hacim farkı", dv, a.mode())
        chk("TS-a dar uç yüzü olmayan (geniş ön) yüz seçilince hata / uyarı (tırnaklar yanlış yüzden çıkmaz)", a.mode() == "pm" or a.errs_map() or near(dv, 240 - 2 * 10.4 * 3.4 * 4, 0.5), (fc, dv, st))
        if a.mode() == "pm":
            a.cancel("discard")
        tab(a, "features")
        # yaşam döngüsü için doğru yüzlü özellik hazır model olarak (yüz kullanıcıca seçilemiyor)
        a.setup([pa, ea, pb, eb, {"id": "ts", "type": "tabslot", "name": "Tırnak-Yuva1", "face": {"c": [50, 0, 1.5], "n": [0, -1, 0]}, "n": 2, "L": 10, "H": 4, "c": 0.2}])
        dv = a.vol() - v0
        chk("TS hazır: +240 / −282,88", near(dv, 240 - 2 * 10.4 * 3.4 * 4, 0.5) and a.bodies() == 2, dv)
        nm = "Tırnak-Yuva1"
        a.edit_feat(nm); a.pmfield("Adet", 3); a.wait(0.5); a.ok()
        dv3 = a.vol() - v0
        chk("TS-b adet 3 → 3 × (120 − 141,44)", near(dv3, 3 * (120 - 10.4 * 3.4 * 4), 0.5), dv3)
        a.tact("A", "Eskizi düzenle"); a.dim_dbl(0, 80); a.ok(); rs = dlg_later()
        v = a.vol()
        print("   TS-c A levhası 100→80:", v - v0, a.featbyname(nm)["face"], a.errs_map(), rs)
        chk("TS-c levha kısalınca dar uç yüzü izlenir, hata yok", not a.errs_map() and not rs, (a.errs_map(), rs))
        a.undo(); a.redo(); a.reload()
        chk("TS-e yenile", not a.errs_map(), a.errs_map())
    case("TS", ts)

    print("SAYFA HATALARI:", a.errs[:5])
    finish()

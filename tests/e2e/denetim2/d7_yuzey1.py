# Denetim 2 / d7 — Yüzey Ekstrüzyon (açık yol, kapalı kontur, orta düzlem), Düzlemsel Yüzey, Kalınlaştır (taraf 1 / 2 / iki),
# Yüzeyle Kes (taraf 1 / 2); yaşam döngüsü a–g. Hazır model: yalnız eskizler ve taban blok (setDoc). Komutlar şeritten,
# değerler PM alanlarına yazılarak, ✓ / ✕ / Ctrl+Z / Ctrl+Y gerçek basılarak; eskiz değişikliği "Eskizi düzenle → ölçüye çift tık".
import sys
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d7h import *  # noqa

with sync_playwright() as p:
    a = App(p)
    case = lambda n, f: run_case(a, n, f)

    # ---------------- Y1: açık yol yüzey ekstrüzyon + kalınlaştır, tam yaşam döngüsü ----------------
    def y1():
        a.setup([line_sk("s1", "Yol", TOP, -30, 0, 30, 0)])
        a.cmd("Yüzey Ekstrüzyon"); a.wait(0.6)
        chk("Y1a PM açıldı, eskiz Yol seçili", a.mode() == "pm" and a.pmselval("Eskiz") == "s1", (a.mode(), a.pmselval("Eskiz")))
        a.pmfield("Mesafe", 40); a.wait(0.8)
        a.ok()
        m = mesh_info(a)
        sf = surf_feats(a)
        chk("Y1a yüzey: 1 yüz, kalınlıksız, 60×40", m and m["f"] == 1 and sorted([round(m["bb"][1][i] - m["bb"][0][i], 1) for i in range(3)]) == [0, 40, 60], (m, sf))
        nm = sf[0]["name"]
        print("   Y1 ad:", nm, "ağaç:", a.ev("[...document.querySelectorAll('#tree li')].map(l=>l.textContent.trim())"))
        chk("Y1a kütle (hacim) 0 — yüzey katı sayılmaz", (a.vol() or 0) == 0, a.vol())
        a.cmd("Kalınlaştır"); a.wait(0.6)
        chk("Y1 Kalınlaştır PM: son yüzey seçili", a.pmselval("Yüzey") == sf[0]["id"], a.pmselval("Yüzey"))
        a.pmfield("Kalınlık", 3); a.wait(0.8); a.ok()
        chk("Y1a kalınlaştır t3 → 60×40×3 = 7200, 6 yüz", near(a.vol(), 7200, 1) and a.faces() == 6, (a.vol(), a.faces()))
        thn = [f for f in surf_feats(a) if f["type"] == "thicken"][0]["name"]
        # b: düzenle
        a.edit_feat(nm); a.pmfield("Mesafe", 50); a.wait(0.8); a.ok()
        chk("Y1b yüzey mesafe 40→50 → kalınlaştır 9000", near(a.vol(), 9000, 1), (a.vol(), a.errs_map()))
        a.edit_feat(thn); a.pmseg("İki taraf"); a.wait(0.6); a.ok()
        bb = a.bbox()
        chk("Y1b iki taraf → hacim aynı, yüzeyin iki yanına ±1,5 (z)", near(a.vol(), 9000, 1) and bb and near(bb[0][2], -1.5, 0.05) and near(bb[1][2], 1.5, 0.05), (a.vol(), bb))
        a.edit_feat(thn); a.pmseg("Taraf 2"); a.wait(0.6); a.ok()
        bb2 = a.bbox()
        a.edit_feat(thn); a.pmseg("Taraf 1"); a.wait(0.6); a.ok()
        bb1 = a.bbox()
        chk("Y1b taraf 1 / taraf 2 yüzeyin ayrı yanlarında", bb1 and bb2 and ((near(bb1[0][2], 0, .05) and near(bb2[1][2], 0, .05)) or (near(bb1[1][2], 0, .05) and near(bb2[0][2], 0, .05))), (bb1, bb2))
        # c: ebeveyn eskizi düzenle
        a.tact("Yol", "Eskizi düzenle"); a.dim_dbl(0, 80); a.ok()
        chk("Y1c eskiz 60→80 → yüzey + kalınlaştır yeniden kuruldu 80×50×3 = 12000", near(a.vol(), 12000, 1) and not a.errs_map(), (a.vol(), a.errs_map()))
        # d: geri al / ileri al
        a.undo(); u = a.vol(); a.redo(); r = a.vol()
        chk("Y1d geri al → 9000, ileri al → 12000", near(u, 9000, 1) and near(r, 12000, 1), (u, r))
        # e: kayıt + yenile
        st = a.stored()
        sv = [f for f in st["features"] if f["id"] == "s1"][0]["data"]["dims"][0]["v"]
        a.reload()
        chk("Y1e kayıt 80 ve yenileme sonrası 12000", near(sv, 80, 1e-6) and near(a.vol(), 12000, 1), (sv, a.vol()))
        # f: ✕
        a.edit_feat(thn); a.pmfield("Kalınlık", 6); a.wait(0.8); a.cancel("discard")
        chk("Y1f ✕ Kaydetmeden çık → değişmedi", near(a.vol(), 12000, 1) and a.featbyname(thn)["t"] == 3, (a.vol(), a.featbyname(thn)["t"]))
        a.edit_feat(thn); a.pmfield("Kalınlık", 6); a.wait(0.8); a.cancel("save")
        chk("Y1f ✕ Kaydet ve çık → 24000", near(a.vol(), 24000, 1), a.vol())
        # g: bastır / sil
        a.tact(nm, "Bastır"); a.wait(0.8)
        rs = a.ev("document.querySelector('dialog.reselect-dialog[open]')?.innerText||''")
        print("   Y1g bastırınca açılan pencere:", rs.replace(chr(10), ' | '))
        chk("Y1g yüzey bastırılınca 'Eksik referans / Yeniden seç' penceresi çıkmaz", not rs, rs[:120])
        if rs:
            a.btn("dialog.reselect-dialog[open] button:has-text('Daha sonra')")
        e = a.errs_map(); v = a.vol()
        print("   Y1g yüzey bastırılınca:", v, e, [ (f["name"], f["off"]) for f in surf_feats(a)])
        chk("Y1g yüzey bastırılınca kalınlaştır da bastırılır / hata yok (SolidWorks: çocuk bastırılır)", not e, e)
        a.tact(nm, "Etkinleştir"); a.wait(0.6)
        chk("Y1g etkinleştir → 24000", near(a.vol(), 24000, 1), a.vol())
        a.tact(nm, "Sil", confirm=[True, False]); a.wait(0.8)
        if a.pg.locator("dialog.reselect-dialog[open]").count():
            a.btn("dialog.reselect-dialog[open] button:has-text('Daha sonra')")
        e = a.errs_map(); names = a.names()
        print("   Y1g yüzey silinince:", names, e, a.dlog[-2:])
        chk("Y1g yüzey silinince bağımlı Kalınlaştır sorulur / silinir (hatalı kalmaz)", not e, (names, e))
        a.undo()
        chk("Y1g sil geri al → 24000", near(a.vol(), 24000, 1), a.vol())
    case("Y1", y1)

    # ---------------- Y2: kapalı kontur yüzey ekstrüzyon + orta düzlem ----------------
    def y2():
        a.setup([rect_sk("s1", "Kontur", TOP, -20, -15, 20, 15)])
        a.cmd("Yüzey Ekstrüzyon"); a.wait(0.5)
        a.pmfield("Mesafe", 20); a.wait(0.6); a.ok()
        m = mesh_info(a)
        chk("Y2a kapalı kontur → 4 yan yüz (boru, uçlar açık), 40×20×30", m and m["f"] == 4 and m["bb"] == [[-20, 0, -15], [20, 20, 15]], m)
        nm = surf_feats(a)[0]["name"]
        a.edit_feat(nm); a.pmcheck("Orta düzlem"); a.wait(0.6); a.ok()
        m = mesh_info(a)
        chk("Y2b orta düzlem → y −10…10", m and near(m["bb"][0][1], -10, .01) and near(m["bb"][1][1], 10, .01), m)
        a.cmd("Kalınlaştır"); a.wait(0.5); a.pmfield("Kalınlık", 2); a.wait(0.8); a.ok()
        th = [f for f in surf_feats(a) if f["type"] == "thicken"][0]["name"]
        res = {}
        for sd in ["Taraf 1", "Taraf 2", "İki taraf"]:
            a.edit_feat(th); a.pmseg(sd); a.wait(0.8); a.ok()
            res[sd] = (a.vol(), a.faces(), a.bbox(), a.status(), a.errs_map())
            print("   Y2 kapalı boru kalınlaştır", sd, res[sd])
        # SolidWorks: içe 2 → 40×30 dış, 36×26 iç, h20 → 5280; dışa 2 (keskin köşe) → 5920 (yuvarlatılmış köşe 5851); iki taraf ±1 → 5600
        chk("Y2 kapalı boru kalınlaştır içe (taraf 1) ≈ 5280", near(res["Taraf 1"][0], 5280, 80) or near(res["Taraf 2"][0], 5280, 80), (res["Taraf 1"][0], res["Taraf 2"][0]))
        chk("Y2 kapalı boru kalınlaştır dışa ≈ 5851…5920", any(r[0] and 5800 < r[0] < 5960 for r in res.values()), [r[0] for r in res.values()])
        chk("Y2 kapalı boru iki taraf → katı (≈5600) ya da ağaçta işaretli hata; model kaybolmaz", (res["İki taraf"][0] or 0) > 5000 or res["İki taraf"][4], res["İki taraf"])
        if not res["İki taraf"][4] and not res["İki taraf"][0]:
            a.show_tree(); ww = None
            evcmd(a, "Ne Yanlış?"); a.wait(1.0)
            ww = a.ev("document.querySelector('dialog.whatswrong')?.innerText||''")
            print("   Y2 Ne yanlış?:", ww.replace(chr(10), ' | ')[:200])
            close_dialogs(a); tab(a, "features")
            chk("Y2 durum 'özellikte hata' derken Ne yanlış? hatayı gösterir", "hata yok" not in ww, ww[:120])
        a.edit_feat(th); a.pmseg("Taraf 1"); a.wait(0.8); a.ok()
        v1 = a.vol()
        a.tact("Kontur", "Eskizi düzenle"); a.dim_dbl(0, 60); a.ok()
        v2 = a.vol()
        chk("Y2c kontur 40→60 → kalınlaştır yeniden kuruldu, hacim arttı", v2 and v1 and v2 > v1 and not a.errs_map(), (v1, v2, a.errs_map()))
        a.reload()
        chk("Y2e yenile", near(a.vol(), v2, 1), a.vol())
        # L biçimli açık yol (iki çizgi, keskin köşe)
        a.setup([sketch("s1", "L", TOP, lambda pt, line, rect, c, t: (lambda p1, p2, p3: (line(p1, p2), line(p2, p3)))(pt(0, 0), pt(40, 0), pt(40, 30)))])
        a.cmd("Yüzey Ekstrüzyon"); a.wait(0.5); a.pmfield("Mesafe", 20); a.wait(0.6); a.ok()
        mL = mesh_info(a)
        a.cmd("Kalınlaştır"); a.wait(0.5); a.pmfield("Kalınlık", 2); a.wait(0.8); a.ok()
        vL1 = a.vol()
        th = [f for f in surf_feats(a) if f["type"] == "thicken"][0]["name"]
        a.edit_feat(th); a.pmseg("Taraf 2"); a.wait(0.8); a.ok()
        vL2 = a.vol()
        print("   Y2 L yol:", mL, "taraf1", vL1, "taraf2", vL2)
        # iç köşe: (40+30−2)·2·20 = 2720; dış köşe keskin: (40+30+2)·2·20 = 2880 (yuvarlak: 2800+π·4·20/4 = 2862,8)
        chk("Y2 L yol kalınlaştır iki taraf: 2720 ve 2863…2880", sorted([round(vL1 or 0), round(vL2 or 0)])[0] in range(2700, 2741) and 2850 < max(vL1 or 0, vL2 or 0) < 2890, (vL1, vL2))
    case("Y2", y2)

    # ---------------- Y3: düzlemsel yüzey (delikli) + kalınlaştır ----------------
    def y3():
        sk = rect_sk("s1", "Plan", TOP, -20, -15, 20, 15)
        a.setup([sk])
        a.cmd("Düzlemsel Yüzey"); a.wait(0.5)
        chk("Y3a PM'de mesafe alanı yok", not a.pmhas("Mesafe"), a.pmtext()[:120])
        a.ok()
        m = mesh_info(a)
        chk("Y3a düzlemsel yüzey: 1 yüz, 40×30, kalınlık 0", m and m["f"] == 1 and m["bb"] == [[-20, 0, -15], [20, 0, 15]], m)
        nm = surf_feats(a)[0]["name"]
        a.cmd("Kalınlaştır"); a.wait(0.5); a.pmfield("Kalınlık", 2); a.wait(0.6); a.ok()
        chk("Y3a kalınlaştır → 2400", near(a.vol(), 2400, 0.5), a.vol())
        a.tact("Plan", "Eskizi düzenle"); a.dim_dbl(0, 50); a.ok()
        chk("Y3c genişlik 40→50 → 3000", near(a.vol(), 3000, 0.5), (a.vol(), a.errs_map()))
        a.undo(); u = a.vol(); a.redo(); r = a.vol()
        chk("Y3d geri al / ileri al", near(u, 2400, 0.5) and near(r, 3000, .5), (u, r))
        a.reload(); chk("Y3e yenile", near(a.vol(), 3000, .5), a.vol())
        a.edit_feat(nm); a.cancel("discard"); chk("Y3f ✕ değişmez", near(a.vol(), 3000, .5), a.vol())
        # delikli kontur: SolidWorks düzlemsel yüzeyi iç döngülerle (delikli) oluşturur
        sk = rect_sk("s1", "Plan", TOP, -20, -15, 20, 15)
        sk["data"]["pts"]["pc"] = {"x": 0, "y": 0}
        sk["data"]["ents"].append({"id": "c9", "t": "circle", "c": "pc", "r": 5})
        a.setup([sk])
        a.cmd("Düzlemsel Yüzey"); a.wait(1.0)
        st = a.status(); a.ok(); a.wait(0.6)
        m = mesh_info(a)
        print("   Y3 delikli düzlemsel yüzey:", st, a.mode(), m)
        chk("Y3 delikli kontur → delikli düzlemsel yüzey (1 yüz)", m and m["f"] == 1 and a.mode() == "part", (st, a.mode(), m))
        if a.mode() == "pm":
            a.cancel("discard")
        # açık eskizle düzlemsel yüzey
        a.setup([line_sk("s1", "Acik", TOP, -30, 0, 30, 0)])
        a.cmd("Düzlemsel Yüzey"); a.wait(0.6)
        st = a.status(); a.ok(); a.wait(0.4)
        print("   Y3 açık eskizle düzlemsel yüzey:", a.mode(), st, a.errs_map())
        chk("Y3 açık eskizde Türkçe hata, ✓ ile hatalı özellik eklenmez", a.mode() == "pm" and "kapalı" in st, (a.mode(), st, a.names()))
        if a.mode() == "pm":
            a.cancel("discard")
    case("Y3", y3)

    # ---------------- Y4: yüzeyle kes (taraf 1 / 2) ----------------
    def y4():
        cl = line_sk("s2", "Kesen", FRONT, -60, 10, 60, 10)
        d = cl["data"]
        # çizginin yüksekliği: p1 → orijin dikey mesafe ölçüsü (hazır model)
        d["dims"].append({"id": "D2", "t": "dist", "refs": ["O", "p1"], "v": 10, "sub": "v", "lp": [-70, 5]})
        a.ev("(()=>{const k=window.__app.kernel;if(k.__d7) return;k.__d7=1;const o=k.build.bind(k);k.build=async(...x)=>{const r=await o(...x);window.__lastErr=r.errors;return r}})()")
        a.setup(block(80, 80, 30) + [cl])
        a.cmd("Yüzey Ekstrüzyon"); a.wait(0.5)
        a.pmselect("Eskiz", "s2"); a.pmfield("Mesafe", 100); a.pmcheck("Orta düzlem"); a.wait(0.6); a.ok()
        a.cmd("Yüzeyle Kes"); a.wait(0.6)
        a.ok()
        v1 = a.vol(); bb1 = a.bbox()
        print("   Y4 yüzeyle kes taraf 1:", v1, bb1)
        chk("Y4a taraf 1 → 80·80·10 ya da 80·80·20", near(v1, 64000, 2) or near(v1, 128000, 2), v1)
        nm = [f for f in surf_feats(a) if f["type"] == "surfcut"][0]["name"]
        a.edit_feat(nm); seg_click(a, "Taraf 2'yi kaldır"); a.wait(0.6); a.ok()
        v2 = a.vol()
        chk("Y4b taraf 2 → diğer parça, toplam 192000", near(v1 + v2, 192000, 3), (v1, v2))
        a.tact("Kesen", "Eskizi düzenle"); a.dim_dbl(1, 15); a.ok()
        v3 = a.vol()
        y = a.feat("s2")["data"]["pts"]["p1"]["y"]
        chk("Y4c kesen yüzey yüksekliği 10→15 → kalan 80·80·15 = 96000", y == 15 and near(v3, 96000, 3), (y, v2, v3, a.errs_map(), a.ev("window.__lastErr")))
        a.undo(); u = a.vol(); a.redo(); r = a.vol()
        chk("Y4d geri al / ileri al", near(u, v2, 1) and near(r, v3, 1), (u, r))
        a.reload()
        chk("Y4e yenile", near(a.vol(), v3, 1), a.vol())
        a.tact(nm, "Bastır"); v = a.vol(); a.tact(nm, "Etkinleştir")
        chk("Y4g bastır → 192000, etkinleştir → geri", near(v, 192000, 2) and near(a.vol(), v3, 1), (v, a.vol()))
        # kesen yüzey bloğun üstüne (y 35) taşınınca: taraf 2 (alt) kaldırılırsa tüm gövde gider
        a.tact("Kesen", "Eskizi düzenle"); a.dim_dbl(1, 35); a.ok()
        m = mesh_info(a); st = a.status(); e = a.errs_map()
        print("   Y4h kesen yüzey gövdenin dışında:", a.vol(), m, st, e, a.ev("window.__lastErr"))
        chk("Y4h yüzeyle kes tüm gövdeyi kaldırırsa hata Yüzeyle Kes özelliğinde gösterilir (model sessizce kaybolmaz)", bool(e) or (m and m["f"] > 0), (st, e, m))
    case("Y4", y4)

    # ---------------- Y5: sıfır / negatif mesafe ----------------
    def y5():
        a.setup([line_sk("s1", "Yol", TOP, -30, 0, 30, 0)])
        a.cmd("Yüzey Ekstrüzyon"); a.wait(0.5)
        bad = a.ev("(()=>{const i=[...document.querySelectorAll('#pm-body label.pm-field')].find(l=>l.textContent.includes('Mesafe')).querySelector('input');return i})()")
        a.pmfield("Mesafe", 0); a.wait(2.0)
        cls = a.ev("[...document.querySelectorAll('#pm-body label.pm-field')].find(l=>l.textContent.includes('Mesafe')).querySelector('input').className")
        st = a.status()
        print("   Y5 mesafe 0: alan sınıfı", cls, "durum", st)
        t0 = time.time()
        try:
            a.ok(); a.wait(1.0)
        except Exception as ex:
            print("   Y5 bekleme:", ex)
        busy = a.busy()
        print("   Y5 ✓ sonrası", a.mode(), a.status(), a.errs_map(), "meşgul", busy, f"{time.time()-t0:.0f} sn")
        chk("Y5 mesafe 0 reddedilir (alan kırmızı) ya da hata mesajı; çekirdek kilitlenmez", "bad" in (cls or "") or (not busy and a.errs_map()), (cls, st, busy, a.errs_map()))
        if a.mode() == "pm":
            a.cancel("discard")
        if not busy:
            a.setup([line_sk("s1", "Yol", TOP, -30, 0, 30, 0)])
            a.cmd("Yüzey Ekstrüzyon"); a.wait(0.5); a.pmfield("Mesafe", -20); a.wait(0.8); a.ok()
            m = mesh_info(a)
            print("   Y5 mesafe −20:", m, a.errs_map())
    case("Y5", y5)

    print("SAYFA HATALARI:", a.errs[:5])
    finish()

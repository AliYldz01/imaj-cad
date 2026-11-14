# d8 — Yapı Elemanı PM seçenekleri (her biri Düzenle → değiştir → ✓ → sayısal; çoğunda Ctrl+Z / yenile):
# delme noktası, öteleme, döndürme, aynala, hizalama, profili konumlandır, gruplar (grafik segment seçimi + grup profili),
# köşe başına işlem, yapı sistemi (nokta-uzunluk, ikincil), eskizden profil, kütüphaneye ekle / dışa aktar, önceki elemanlara göre kırp / gönye.
# Hazır model: iskelet eskizleri + başlangıç yapı elemanı (setDoc); seçenek değişiklikleri gerçek UI ile.
import sys; sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d8h import *

SEGS = [("s1", e) for e in ["l5", "l6", "l7", "l8"]]


def base(a, **kw):
    a.setup([frame_sk(), mem("m1", SEGS, name="YE", **kw)])
    a.wait(1.5)


def bb(a):
    return a.bbox()


def lens(a):
    return sorted(c[2] for c in cl_api(a))


with sync_playwright() as p:
    a = App(p)
    if want("S1"):
        # delme noktası Sol alt köşe → profil iskeletin bir yanında (z tek taraflı)
        base(a); b0 = bb(a)
        a.edit_feat("YE"); a.pmselect("Delme noktası", "bl"); a.ok()
        b1 = bb(a)
        chk("S1 delme noktası Sol alt köşe: z tek taraflı (0..±40)", b1 and (abs(b1[0][2]) < 0.01 or abs(b1[1][2]) < 0.01) and abs(b1[1][2] - b1[0][2] - 40) < 0.1, (b0, b1))
        L = lens(a); note("S1 boylar", L)
        chk("S1 köşe gönyesi hâlâ 45°", all(c[3] == 45 and c[4] == 45 for c in cl_api(a)), L)
        a.undo(); chk("S1 Ctrl+Z → merkez", bb(a) == b0, bb(a))
        # öteleme X 10
        a.edit_feat("YE"); a.pmfield("Delme noktası öteleme Y", 10); a.ok()
        b2 = bb(a)
        chk("S1 öteleme Y 10 → z aralığı 10 kayar", b2 and abs(abs(b2[0][2] - b0[0][2]) - 10) < 0.1, (b0, b2))
        a.reload(); chk("S1 yenile → öteleme korunur", bb(a) == b2, bb(a))
    if want("S2"):
        # döndürme 90° (dkutu 80x40): kalınlık yönü 40 → 80
        base(a, std="dkutu", size="80x40x3"); b0 = bb(a)
        a.edit_feat("YE"); a.pmfield("Döndürme açısı", 90); a.ok(); b1 = bb(a)
        dz0, dz1 = b0[1][2] - b0[0][2], b1[1][2] - b1[0][2]
        chk("S2 dkutu 80x40 döndürme 90°: z kalınlığı değişir (40↔80)", {round(dz0), round(dz1)} == {40, 80}, (dz0, dz1))
        # aynala L profilinde
        a.setup([frame_sk(), mem("m1", SEGS, name="YE", std="L", size="50x50x5", align="tl")]); a.wait(1.5)
        b2 = bb(a)
        a.edit_feat("YE"); a.pmcheck("Profili aynala", True); a.ok(); b3 = bb(a)
        chk("S2 L 50x50 sol üst köşe + aynala: sınır kutusu değişir", b2 != b3 and not a.errtree(), (b2, b3))
        # hizalama: dkutu 80x40, profil yatay eksen → Global Z
        a.setup([frame_sk(), mem("m1", SEGS, name="YE", std="dkutu", size="80x40x3")]); a.wait(1.5); b4 = bb(a)
        a.edit_feat("YE"); a.pmselect("Profil ekseni", "h"); a.pmselect("Hedef yön", "z"); a.ok(); b5 = bb(a)
        note("S2 hizalama", b4, b5, a.feat("m1").get("alignAx"), a.feat("m1").get("alignTo"))
        chk("S2 hizalama yatay eksen (genişlik 40) → Global Z: z kalınlığı 80 → 40", round(b5[1][2] - b5[0][2]) == 40 and round(b4[1][2] - b4[0][2]) == 80, (b4, b5))
    if want("S3"):
        # profili konumlandır penceresi → köşe noktasına tık
        base(a); b0 = bb(a)
        a.edit_feat("YE"); a.pmbtn("Profili konumlandır")
        a.pg.wait_for_selector("dialog.pierce-dialog[open]")
        n = a.pg.locator("dialog.pierce-dialog g.pp").count()
        chk("S3 kutu profilde 17 nokta", n == 17, n)
        # sol alt köşe: en küçük x+y'li dış nokta
        k = a.ev("""(()=>{const g=[...document.querySelectorAll('dialog.pierce-dialog g.pp')];let bi=0,bv=1e9;g.forEach((e,i)=>{const c=e.querySelectorAll('circle')[1];const v=+c.getAttribute('cx')-(+c.getAttribute('cy'));if(v<bv){bv=v;bi=i}});return bi})()""")
        a.btn(f"dialog.pierce-dialog g.pp >> nth={k}")
        po = a.ev("window.__app.mode.draft && window.__app.mode.draft.poff")
        chk("S3 nokta seçilince öteleme (−20, −20)", po == [-20, -20], po)
        a.ok(); b1 = bb(a)
        chk("S3 ✓ → z tek taraflı", abs(b1[0][2]) < 0.01 or abs(b1[1][2]) < 0.01, b1)
    if want("S4"):
        # gruplar: + Yeni grup → üst çizgiye grafik alanda tık → grup 2'ye geçer → grup 2 profili lama 50x10
        base(a)
        a.edit_feat("YE"); a.pmbtn("+ Yeni grup")
        a.wclick([300, 400, 0]); a.wait(0.8)
        d = a.ev("JSON.parse(JSON.stringify({s:window.__app.mode.draft.segs,g:window.__app.mode.draft.groups}))")
        chk("S4 üst çizgiye tık → Grup 2'ye geçti", d["g"] and len(d["g"][0]["segs"]) == 1 and d["g"][0]["segs"][0]["ent"] == "l7" and len(d["s"]) == 3, d)
        a.pmcheck("Grup 1 ile aynı profil", False)
        a.pmselect("Standart", "lama"); a.pmselect("Ölçü", "50x10"); a.ok(); a.wait(1.5)
        cl = cl_api(a); names = sorted(set(c[1] for c in cl))
        chk("S4 kesim listesinde 2 profil (kutu + lama)", len(names) == 2 and any("ama" in x for x in names), cl)
        ifc = a.ev("window.__app.kernel.interfere().then(r=>r.length)")
        chk("S4 gruplar arası köşelerde girişim yok", ifc == 0, ifc)
        a.reload(); cl2 = cl_api(a)
        chk("S4 yenile → aynı", cl2 == cl, cl2)
        # grubu sil → tek profil
        a.edit_feat("YE"); a.btn("#pm-body button:has-text('Grup 2')"); a.pmbtn("Grubu sil"); a.ok(); a.wait(1.5)
        names = sorted(set(c[1] for c in cl_api(a)))
        chk("S4 Grubu sil → tek profil", len(names) == 1, names)
        a.undo(); names = sorted(set(c[1] for c in cl_api(a)))
        chk("S4 Ctrl+Z → 2 profil", len(names) == 2, names)
    if want("S5"):
        # köşe başına işlem: Köşe 1 → Alın 1 + 3 mm
        base(a)
        a.edit_feat("YE")
        sel = a.pg.locator("#pm-body label.pm-field:has-text('Köşe 1') select").first
        sel.select_option("butt1"); time.sleep(0.4)
        gp = a.pg.locator("#pm-body label.pm-field:has-text('Boşluk') input")
        note("S5 boşluk alanları", gp.count())
        gp.nth(gp.count() - 1).fill("3"); gp.nth(gp.count() - 1).press("Tab"); time.sleep(0.3)
        a.ok()
        cl = cl_api(a); note("S5", cl)
        chk("S5 bir köşe alın + 3: bir uçta 0°, boy 397 ve 640", any(c[3] == 0 for c in cl) and any(abs(c[2] - 397) < 0.2 or abs(c[2] - 597) < 0.2 for c in cl), cl)
        a.reload(); chk("S5 yenile → korunur", cl_api(a) == cl)
    if want("S6"):
        # yapı sistemi: nokta-uzunluk birincil (orijin, +Z, 250) ve ikincil (alt ↔ üst %50)
        base(a)
        a.edit_feat("YE"); a.pmbtn("+ Nokta-uzunluk birincil eleman")
        # noktayı modelden seç: sağ alt köşe (600,0,0) iskelet noktası
        a.wclick([600, 0, 0]); a.wait(0.5)
        q = a.ev("JSON.parse(JSON.stringify(window.__app.mode.draft.ptl))")
        chk("S6 birincil nokta modele dokununca (600,0,0)", q and [round(v) for v in q[0]["p"]] == [600, 0, 0], q)
        a.pg.locator("#pm-body .pm-row:has-text('Birincil 1') label.pm-field:has-text('Yön') select").select_option("4"); time.sleep(0.3)
        a.pg.locator("#pm-body .pm-row:has-text('Birincil 1') label.pm-field:has-text('Uzunluk') input").fill("250")
        a.pg.locator("#pm-body .pm-row:has-text('Birincil 1') label.pm-field:has-text('Uzunluk') input").press("Tab"); time.sleep(0.3)
        a.pmbtn("+ İkincil eleman")
        a.pg.locator("#pm-body .pm-row:has-text('İkincil 1') label.pm-field:has-text('Birincil B') select").select_option("2"); time.sleep(0.3)
        a.ok(); a.wait(1.5)
        L = lens(a); note("S6", L, a.errtree())
        chk("S6 nokta-uzunluk 250 (+Z) elemanı var", any(abs(x - 250) < 25 for x in L), L)
        chk("S6 ikincil alt↔üst %50: 360 (iç yüzler arası)", any(abs(x - 360) < 0.5 for x in L), L)
        ifc = a.ev("window.__app.kernel.interfere().then(r=>r.map(x=>+(x.vol).toFixed(1)))")
        chk("S6 yapı sisteminde girişim yok", not ifc, ifc)
        # düzenle: ikincil %25
        a.edit_feat("YE")
        f = a.pg.locator("#pm-body .pm-row:has-text('İkincil 1') label.pm-field:has-text('A konumu') input"); f.fill("25"); f.press("Tab"); time.sleep(0.2)
        f = a.pg.locator("#pm-body .pm-row:has-text('İkincil 1') label.pm-field:has-text('B konumu') input"); f.fill("25"); f.press("Tab"); time.sleep(0.2)
        a.ok(); a.wait(1.2)
        c = a.ev("(()=>{const m=window.__app.viewer.mesh;return m.bodies})()")
        chk("S6 ikincil %25 düzenlendi, hatasız", not a.errtree() and c >= 6, (c, a.errtree()))
        a.reload(); chk("S6 yenile → ptl / sec korunur", a.feat("m1").get("ptl") and a.feat("m1").get("sec"))
    if want("S7"):
        # eskizden profil: Ø30 daire eskizi (hazır) → Standart 'Eskizden profil' → yuvarlak çubuk
        prof = sketch("sp", "Profil", RIGHT, lambda pt, line, rect, c, t: c(0, 0, 15))
        a.setup([frame_sk(), prof, mem("m1", SEGS, name="YE", corner="none")]); a.wait(1.5)
        a.edit_feat("YE"); a.pmselect("Standart", "sketch")
        opts = a.pg.locator("#pm-body label.pm-field:has-text('Profil eskizi') select option").all_inner_texts()
        chk("S7 'Profil eskizi' seçeneklerinde Profil var, iskelet yok", opts == ["Profil"], opts)
        a.ok(); a.wait(1.5); V = a.vol()
        chk("S7 Ø30 eskiz profil hacmi π·15²·2000 = 1 413 717", near(V, math.pi * 225 * 2000, 500), V)
        # profil eskizini düzenle (ağaçta görünüyor mu?)
        tree = a.ev("[...document.querySelectorAll('#tree li')].map(l=>l.textContent.trim())")
        chk("S7 profil eskizi ağaçta görünür (düzenlenebilir) — P-4 benzeri", any("Profil" == x or x.endswith("Profil") for x in tree), tree)
        # kütüphaneye ekle
        a.edit_feat("YE")
        a.dq[:] = ["Ø30 çubuk"]
        a.pmbtn("Bir eskizi kütüphaneye ekle")
        time.sleep(0.6)
        dd = a.ev("JSON.parse(JSON.stringify({std:window.__app.mode.draft.std,size:window.__app.mode.draft.size}))")
        chk("S7 kütüphaneye eklendi → özel profil seçili", dd["std"] == "custom", dd)
        a.ok(); a.wait(1.5); V2 = a.vol()
        chk("S7 özel profil hacmi aynı", near(V2, V, 50), (V, V2))
        lib = json.loads(a.ev("localStorage.getItem('imajcad.profiles')") or "{}")
        chk("S7 imajcad.profiles içinde 'Ø30 çubuk'", any(v.get("name") == "Ø30 çubuk" for v in lib.values()), list(lib.values())[:1])
        a.edit_feat("YE")
        nm, data = download(a, "#pm-body button:has-text('Kütüphaneyi dışa aktar')")
        js = json.loads(data.decode("utf-8"))
        chk("S7 dışa aktarılan JSON'da profil + döngü", nm.endswith(".json") and any(v.get("name") == "Ø30 çubuk" and v.get("loops") for v in js.values()), (nm, list(js)[:3]))
        a.cancel("discard")
        a.reload(); chk("S7 yenile → özel profil belgede gömülü, hacim aynı", near(a.vol(), V, 50) and not a.errtree(), (a.vol(), a.errtree()))
        cl = cl_api(a); note("S7 kesim adı", cl[:1])
    if want("S8"):
        # önceki elemanlara göre kırp + gönye (iki ayrı özellik): alt+sağ (hazır), üst+sol şeritten
        a.setup([frame_sk(), mem("m1", [("s1", "l5"), ("s1", "l6")], name="YE1")]); a.wait(1.5)
        a.tsel("YE1")
        tab(a, "weld"); a.cmd("Yapı Elemanı"); a.wait(0.8)
        # grafik alanda üst ve sol çizgiye tık (seçili 4 segment varsa önce temizle)
        d = a.ev("JSON.parse(JSON.stringify(window.__app.mode.draft.segs))")
        note("S8 başlangıç segmentleri", d)
        # alt ve sağ çizgiler önceki özellikte; taslaktan çıkar
        for w in ([300, 0, 0], [600, 200, 0]):
            if any(s["ent"] in ("l5", "l6") for s in a.ev("JSON.parse(JSON.stringify(window.__app.mode.draft.segs))")):
                a.wclick(w); a.wait(0.4)
        segs = [s["ent"] for s in a.ev("JSON.parse(JSON.stringify(window.__app.mode.draft.segs))")]
        if "l7" not in segs: a.wclick([300, 400, 0])
        if "l8" not in segs: a.wclick([0, 200, 0])
        segs = sorted(s["ent"] for s in a.ev("JSON.parse(JSON.stringify(window.__app.mode.draft.segs))"))
        chk("S8 grafik seçimle segmentler l7, l8", segs == ["l7", "l8"], segs)
        a.pmcheck("Önceki elemanlarla köşede gönye", True)
        a.ok(); a.wait(1.5)
        cl = cl_api(a); note("S8", cl)
        chk("S8 özellikler arası gönye: 4 eleman, tüm uçlar 45°, 640/440", len(cl) == 4 and all(c[3] == 45 and c[4] == 45 for c in cl) and sorted(set(c[2] for c in cl)) == [440, 640], cl)
        ifc = a.ev("window.__app.kernel.interfere().then(r=>r.length)")
        chk("S8 girişim yok", ifc == 0, ifc)
        # gönyeyi kapat → alın
        n2 = a.ev("window.__app.doc.features.filter(f=>f.type==='member')[1].name")
        a.edit_feat(n2); a.pmcheck("Önceki elemanlarla köşede gönye", False); a.ok()
        cl = cl_api(a); note("S8 alın", cl)
        chk("S8 gönye kapalı: özellikler arası köşelerde 0° uçlar var", any(c[3] == 0 for c in cl), cl)
        a.edit_feat(n2); a.pmcheck("Önceki yapı elemanlarına göre kırp", False); a.ok()
        ifc = a.ev("window.__app.kernel.interfere().then(r=>r.length)")
        chk("S8 kırpma kapalı → köşelerde girişim (SolidWorks gibi)", ifc > 0, ifc)
    chk("konsol hatası yok", not a.errs, a.errs[:5])
    a.close()
finish()

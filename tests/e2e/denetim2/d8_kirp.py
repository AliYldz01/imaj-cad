# d8 — Kırp / Uzat, Uç Kapağı, Kaynak Dikişi, Köşe Takviyesi: şeritten oluştur (yüz / eleman tıklaması) → sayısal →
# Düzenle → ✓ → iskelet (3B ölçü) değişince izliyor mu → Ctrl+Z / Ctrl+Y → yenile → ✕ → bastır / sil.
# Hazır model: 3B iskelet çerçeve + yapı elemanları (setDoc); kullanıcı adımları gerçek tıklama.
import sys; sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d8h import *

FR = [("k1", l) for l in ["l1", "l2", "l3", "l4"]]


def k_mid(x0=300, y0=0, y1=400):
    """3B eskiz: orta dikme (x0, y0)→(x0, y1) — uzunluk ölçüsü yok"""
    return {"id": "k2", "type": "sketch3d", "name": "Dikme", "ids": ["q1", "q2"], "xyz": [[x0, y0, 0], [x0, y1, 0]],
            "lines": [{"id": "m1", "a": "q1", "b": "q2", "ax": "y"}], "r": 0, "seq": 10}




with sync_playwright() as p:
    a = App(p)
    if want("K1"):
        # ---------- Kırp / Uzat: orta dikme çerçeveye taşar (y −100..500), kırpma kapalı → alt + üst sınır
        a.setup([s3_frame(), k_mid(300, -100, 500), mem("m1", FR, name="Çerçeve-YE"), mem("m2", [("k2", "m1")], name="Dikme-YE", trimPrev=False, corner="none")])
        a.wait(1.5); front(a)
        L0 = sorted(c[2] for c in cl_api(a)); note("K1 başlangıç", L0)
        tab(a, "weld"); a.cmd("Kırp / Uzat"); a.wait(0.5)
        a.wclick([300, 200, 20]); a.wait(0.3)          # kırpılacak: dikme
        a.pmseg("Sınır")
        a.wclick([150, 0, 20]); a.wclick([150, 400, 20]); a.wait(0.3)
        d = a.ev("JSON.parse(JSON.stringify({t:window.__app.mode.draft.targets,b:window.__app.mode.draft.bounds}))")
        chk("K1 tıklamayla 1 kırpılacak, 2 sınır", len(d["t"]) == 1 and len(d["b"]) == 2, d)
        a.ok(); a.wait(1.5)
        L = sorted(c[2] for c in cl_api(a)); t = a.status()
        chk("K1 100 mm taşan dikme sınırlarda kırpılır: 360 (SolidWorks)", 360 in L and 600 not in L, (L, t))
        if a.mode() == "pm": a.cancel("discard")
        # 30 mm taşan dikme
        a.setup([s3_frame(), k_mid(300, -30, 430), mem("m1", FR, name="Çerçeve-YE"), mem("m2", [("k2", "m1")], name="Dikme-YE", trimPrev=False, corner="none")])
        a.wait(1.5); front(a)
        tab(a, "weld"); a.cmd("Kırp / Uzat"); a.wait(0.5)
        a.wclick([300, 200, 20]); a.pmseg("Sınır"); a.wclick([150, 0, 20]); a.wclick([150, 400, 20]); a.wait(0.3)
        a.ok(); a.wait(1.5)
        L = sorted(c[2] for c in cl_api(a))
        chk("K1 30 mm taşan dikme kırpılır: 360", 360 in L and 460 not in L, (L, a.status()))
        # koplama
        tn = a.ev("window.__app.doc.features.find(f=>f.type==='trim').name")
        a.edit_feat(tn); a.pmcheck("Profile göre kes", True); a.ok(); a.wait(1.5)
        L2 = sorted(c[2] for c in cl_api(a)); note("K1 koplama", L2)
        ifc = a.ev("window.__app.kernel.interfere().then(r=>r.length)")
        chk("K1 koplama → girişim yok", ifc == 0, ifc)
        # 3B iskelet: çerçeve yüksekliği 400 → 500 (çift tık) → dikme izler mi? (dikme eskizi 500'e kadar)
        s3_open(a, "3B Çerçeve"); s3_edit_dim(a, 1, 450); a.ok(); a.wait(1.5)
        L3 = sorted(c[2] for c in cl_api(a)); note("K1 çerçeve 450", L3, a.errtree())
        chk("K1 çerçeve 450 → koplamalı dikme 372 + 50 = 422 (sınır izlendi)", any(abs(x - 422) < 1 for x in L3) and not a.errtree(), (L3, a.errtree()))
        a.undo(); L4 = sorted(c[2] for c in cl_api(a))
        chk("K1 Ctrl+Z → 372", any(abs(x - 372) < 1 for x in L4), L4)
        a.redo(); a.reload(); L5 = sorted(c[2] for c in cl_api(a))
        chk("K1 Ctrl+Y + yenile → 422", L5 == L3, L5)
        # uzatma: kısa dikme (100..300) → sınırlara uzar
        a.setup([s3_frame(), k_mid(300, 100, 300), mem("m1", FR, name="Çerçeve-YE"), mem("m2", [("k2", "m1")], name="Dikme-YE", trimPrev=False, corner="none")])
        a.wait(1.5); front(a)
        tab(a, "weld"); a.cmd("Kırp / Uzat"); a.wait(0.4)
        a.wclick([300, 200, 20]); a.pmseg("Sınır"); a.wclick([150, 0, 20]); a.wclick([150, 400, 20])
        a.ok(); a.wait(1.5)
        L = sorted(c[2] for c in cl_api(a))
        chk("K1 kısa dikme sınırlara uzar: 360", 360 in L, L)
        # ✕
        tn = a.ev("window.__app.doc.features.find(f=>f.type==='trim').name")
        a.edit_feat(tn); a.pg.locator("#pm-body .pm-feats button:has-text('✕')").last.click(); time.sleep(0.3); a.cancel("discard")
        chk("K1 ✕ Kaydetmeden çık → 360 kalır", 360 in sorted(c[2] for c in cl_api(a)))
        a.tact(tn, "Bastır"); L = sorted(c[2] for c in cl_api(a))
        chk("K1 bastır → 200", 200 in L, L)
        a.tact(tn, "Sil", confirm=[True]); chk("K1 sil → 200", 200 in sorted(c[2] for c in cl_api(a)))
    if want("K2"):
        # ---------- Uç kapağı: tek dikme kutu 40x40x3 (0,0)→(0,500) üst uç yüzü
        one = {"id": "k3", "type": "sketch3d", "name": "Tek", "ids": ["a", "b"], "xyz": [[0, 0, 0], [0, 500, 0]],
               "lines": [{"id": "n1", "a": "a", "b": "b", "ax": "y"}], "r": 0, "seq": 5, "dims3": [{"id": "d1", "t": "len", "e": ["n1"], "v": 500}],
               "cons3": [{"id": "c1", "t": "fix", "e": ["a"], "p": [0, 0, 0]}]}
        a.setup([one, mem("m1", [("k3", "n1")], name="Dikme-YE", corner="none")]); a.wait(1.5); iso(a)
        V0 = a.vol()
        tab(a, "weld"); a.cmd("Uç Kapağı"); a.wait(0.4)
        a.wclick([18.5, 500, 0]); a.wait(0.4)
        chk("K2 uç yüze tık → 1 yüz seçili", "1 uç yüz seçili" in a.pmtext(), a.pmtext()[:80])
        a.ok(); a.wait(1.5); V1 = a.vol(); b = a.bbox()
        note("K2", V0, V1, b)
        # kutu dış kontur alanı (R köşeli) = kesit alanı + iç boşluk; beklenen ≈ 40×40×5 − köşe payı
        chk("K2 kapak t5 ≈ 1600×5 (±5%), üst 505", 7400 < V1 - V0 < 8100 and abs(b[1][1] - 505) < 0.1, (V1 - V0, b))
        en = a.ev("window.__app.doc.features.find(f=>f.type==='endcap').name")
        a.edit_feat(en); a.pmfield("Kalınlık", 8); a.pmfield("Kenardan içeri", 2); a.ok(); V2 = a.vol()
        chk("K2 düzenle t8 + içeri 2 → ≈ 36²×8 = 10 368 (±5%)", 9600 < V2 - V0 < 10500, V2 - V0)
        cl = cl_api(a); note("K2 kesim listesi", cl)
        chk("K2 kesim listesinde uç kapağı levha kalemi", any(c[0] != "member" for c in cl), cl)
        # iskelet 500 → 700: kapak izler mi
        s3_open(a, "Tek"); s3_edit_dim(a, 0, 700); a.ok(); a.wait(1.5)
        b = a.bbox(); note("K2 700", b, a.errtree())
        chk("K2 dikme 700 → kapak 708'de (izler)", b and abs(b[1][1] - 708) < 0.2 and not a.errtree(), (b, a.errtree()))
        a.undo(); b = a.bbox(); chk("K2 Ctrl+Z → 508", abs(b[1][1] - 508) < 0.2, b)
        a.reload(); chk("K2 yenile → 508", abs(a.bbox()[1][1] - 508) < 0.2)
        a.tact(en, "Bastır"); chk("K2 bastır → hacim ilk", near(a.vol(), V0, 1))
    if want("K3"):
        # ---------- Kaynak dikişi: dikme (trim'li T) yan yüzü + alt elemanın üst yüzü
        a.setup([s3_frame(), k_mid(300, 0, 400), mem("m1", FR, name="Çerçeve-YE"), mem("m2", [("k2", "m1")], name="Dikme-YE", corner="none")])
        a.wait(1.5); iso(a)
        L = sorted(c[2] for c in cl_api(a)); note("K3 elemanlar", L)
        V0 = a.vol()
        tab(a, "weld"); a.cmd("Kaynak Dikişi"); a.wait(0.4)
        a.wclick([320, 60, 0]); a.wait(0.3)     # dikmenin +x yan yüzü
        t1 = a.pmtext()
        a.wclick([450, 20, 0]); a.wait(0.5)     # alt elemanın üst yüzü
        d = a.ev("JSON.parse(JSON.stringify(window.__app.mode.draft.pairs))")
        chk("K3 iki yüze tık → 1 dikiş", len(d) == 1, d)
        chk("K3 1. tıktan sonra PM '2. yüze dokunun' der", "2. yüze" in t1, t1[:120])
        a.pmfield("Kaynak kalınlığı a", 4)
        a.ok(); a.wait(1.5)
        V1 = a.vol()
        rows = cutlist_open(a)
        wt = a.ev("""(()=>{const d=document.querySelector('dialog.cut-dialog[open]');const t=d.querySelectorAll('table.cut-table')[1];return t?[...t.querySelectorAll('tr')].slice(1).map(r=>[...r.querySelectorAll('td')].map(x=>x.textContent.trim())):null})()""")
        note("K3 kaynak tablosu", wt, "hacim farkı", V1 - V0)
        chk("K3 kaynak tablosu: a 4, 1 dikiş, boy 28 (kutu düz yüz genişliği 40 − 2·R6)", wt and wt[0][1] == "4" and wt[0][2] == "1" and abs(num(wt[0][3]) - 28) < 1, wt)
        # kaynak metali: z = a√2 = 5,657 → üçgen alanı z²/2 = 16 → ×40 = 640 mm³ → 0,005 kg
        chk("K3 kaynak metali ≈ 16×28 mm³ × 7,85 = 0,0035 kg", wt and abs(num(wt[0][4]) - 0.0035) < 0.0011, wt)
        nm, data = download(a, "dialog.cut-dialog[open] button:has-text('CSV')")
        csv = data.decode("utf-8-sig")
        note("K3 CSV:\n" + csv)
        chk("K3 CSV'de kaynak bölümü", "Kaynak" in csv and "a (mm)" in csv, nm)
        cutlist_close(a)
        wn = a.ev("window.__app.doc.features.find(f=>f.type==='weld').name")
        a.edit_feat(wn); a.pmcheck("Kesikli kaynak", True); a.pmfield("Dikiş boyu", 10); a.pmfield("Adım", 20); a.ok(); a.wait(1.5)
        rows = cutlist_open(a)
        wt2 = a.ev("""(()=>{const d=document.querySelector('dialog.cut-dialog[open]');const t=d.querySelectorAll('table.cut-table')[1];return t?[...t.querySelectorAll('tr')].slice(1).map(r=>[...r.querySelectorAll('td')].map(x=>x.textContent.trim())):null})()""")
        cutlist_close(a); note("K3 kesikli", wt2)
        chk("K3 kesikli 10 / 20 → toplam boy < 40", wt2 and num(wt2[0][3]) < 40, wt2)
        # iskelet: dikme x 300 → çerçeve genişliği değişince dikme yerinde; çerçeve yüksekliği 400 → 300
        s3_open(a, "3B Çerçeve"); s3_edit_dim(a, 0, 800); a.ok(); a.wait(1.5)
        pr = a.feat(a.ev("window.__app.doc.features.find(f=>f.type==='weld').id"))["pairs"]
        chk("K3 çerçeve 800 → kaynak hatasız, alt yüz referansı (400,20,0)'a iyileşti", not a.errtree() and [round(v) for v in pr[0]["f2"]["c"]] == [400, 20, 0], (a.errtree(), pr))
        a.undo(); a.reload()
        chk("K3 yenile sonrası kaynak özelliği hatasız", not a.errtree(), a.errtree())
        a.tact(wn, "Sil", confirm=[True]); chk("K3 sil → hacim ilk", near(a.vol(), V0, 1), (a.vol(), V0))
    if want("K4"):
        # ---------- Köşe takviyesi: sol alt iç köşe — alt elemanın üst yüzü (y=20) + sol elemanın iç yüzü (x=20)
        a.setup([s3_frame(), mem("m1", FR, name="Çerçeve-YE")]); a.wait(1.5); iso(a)
        V0 = a.vol()
        tab(a, "weld"); a.cmd("Köşe Takviyesi"); a.wait(0.4)
        a.wclick([200, 20, 0]); a.wclick([20, 200, 0]); a.wait(0.5)
        txt = a.pmtext()
        chk("K4 iki yüz seçildi (taslak)", a.ev("!!(window.__app.mode.draft.f1&&window.__app.mode.draft.f2)"))
        chk("K4 PM '1. yüz: seçili · 2. yüz: seçili' gösterir", "1. yüz: seçili" in txt and "2. yüz: seçili" in txt, txt[:90])
        a.ok(); a.wait(1.5); V1 = a.vol()
        # (100·100/2 − 10·10/2)·6 = 29 700
        chk("K4 takviye hacmi (100²/2 − 10²/2)·6 = 29 700", near(V1 - V0, 29700, 30), V1 - V0)
        gn = a.ev("window.__app.doc.features.find(f=>f.type==='gusset').name")
        a.edit_feat(gn); a.pmfield("Kenar 1", 150); a.pmfield("Köşe pahı", 0); a.ok(); V2 = a.vol()
        chk("K4 düzenle 150 × 100, pah 0 → 45 000", near(V2 - V0, 45000, 30), V2 - V0)
        cl = cl_api(a); chk("K4 kesim listesinde takviye levhası", any(c[0] != "member" for c in cl), cl)
        # iskelet genişliği 600 → 800: köşe takviyesi sol alt köşede kalır mı
        s3_open(a, "3B Çerçeve"); s3_edit_dim(a, 0, 800); a.ok(); a.wait(1.5)
        V3 = a.vol(); note("K4 800", V3 - a.ev("0"), a.errtree())
        chk("K4 çerçeve 800 → takviye hatasız kalır", not a.errtree(), a.errtree())
        # iskelet yüksekliği 400 → 300 (sol elemanın iç yüzü merkezi değişir)
        s3_open(a, "3B Çerçeve"); s3_edit_dim(a, 1, 300); a.ok(); a.wait(1.5)
        chk("K4 çerçeve yüksekliği 300 → takviye hatasız kalır (yüz referansı izler)", not a.errtree(), a.errtree())
        a.undo(); a.undo(); a.redo(); a.redo()
        a.reload(); chk("K4 yenile → hatasız", not a.errtree(), a.errtree())
        a.tact(gn, "Bastır"); chk("K4 bastır → takviye yok", a.ev("window.__app.kernel.cutList().then(r=>r.every(c=>c.kind==='member'))"))
    chk("konsol hatası yok", not a.errs, a.errs[:5])
    a.close()
finish()

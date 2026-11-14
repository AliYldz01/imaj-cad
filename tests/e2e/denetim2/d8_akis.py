# d8 — iş akışları (masaüstü):
# W1 masa: 3B çerçeve iskeleti → Yapı Elemanı (gönye) → ayak iskeleti → Yapı Elemanı 2 (önceki elemanlara göre kırp) → alttan bak →
#    4 ayak ucuna Uç Kapağı (tıkla) → Kesim Listesi + CSV → iskelet 600 → 800 (çift tık) → liste güncel, kapaklar yerinde →
#    Ctrl+S dosyası güncel → yenile.
# W3 kiriş: tek kutu 40x40x3 L=500 → Mukavemet (konsol, yayılı 1000 N) ↔ Statik Analiz (uç yüz sabit, üst yüz 1000 N −Y) karşılaştır.
# Hazır model: 3B iskelet eskizleri (setDoc).
import sys, re; sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d8h import *


def legs(h=700, w=600, d=400):
    pts = [[0, 0, 0], [w, 0, 0], [w, d, 0], [0, d, 0]]
    ids, xyz, lines = [], [], []
    for i, p in enumerate(pts):
        ids += [f"t{i}", f"b{i}"]; xyz += [p, [p[0], p[1], -h]]
        lines.append({"id": f"g{i}", "a": f"t{i}", "b": f"b{i}", "ax": "z"})
    return {"id": "k2", "type": "sketch3d", "name": "Ayaklar", "ids": ids, "xyz": xyz, "lines": lines, "r": 0, "seq": 30}


with sync_playwright() as p:
    a = App(p, nosfp=True)
    if want("W1"):
        # çerçeve XY düzleminde (z=0), ayaklar −Z yönünde
        a.setup([s3_frame()]); a.wait(1)
        a.tsel("3B Çerçeve"); tab(a, "weld"); a.cmd("Yapı Elemanı"); a.wait(0.8); a.ok(); a.wait(1.5)
        # ayak iskeleti (hazır, ağaca eklenir)
        a.ev("f=>{window.__app.doc.features.push(f)}", legs()); a.ev("window.__app.setDoc(JSON.parse(JSON.stringify(window.__app.doc)))"); a.wait(1.2)
        note("W1 hazır ayak iskeleti eklendi (setDoc)")
        a.tsel("Ayaklar"); tab(a, "weld"); a.cmd("Yapı Elemanı"); a.wait(0.8)
        chk("W1 ayak PM: 4 segment, önceki elemanlara göre kırp açık", "Grup 1 (4)" in a.pmtext() and a.pg.locator("#pm-body label.pm-check:has-text('Önceki yapı elemanlarına') input").is_checked())
        a.ok(); a.wait(2)
        cl = cl_api(a); note("W1 elemanlar", cl)
        L = sorted(c[2] for c in cl)
        ifc = a.ev("window.__app.kernel.interfere().then(r=>r.length)")
        chk("W1 8 eleman, girişim yok", len(cl) == 8 and ifc == 0, (L, ifc))
        # arkadan bak (ayaklar −Z) → 4 ayak ucuna uç kapağı
        a.blur(); a.pg.keyboard.press("Control+2"); time.sleep(0.4); a.pg.keyboard.press("f"); time.sleep(0.5)
        bz = a.bbox()[0][2]
        tab(a, "weld"); a.cmd("Uç Kapağı"); a.wait(0.3)
        for x, y in ([0, 0], [600, 0], [600, 400], [0, 400]):
            a.wclick([x + 18.5, y, bz]); time.sleep(0.3)
        nf = a.ev("window.__app.mode.draft.faces.length")
        chk("W1 alttan 4 ayak ucuna tıkla → 4 yüz", nf == 4, nf)
        a.pmfield("Kalınlık", 8); a.ok(); a.wait(1.5)
        b = a.bbox(); chk("W1 kapaklar ayak altında (z −708 ...)", abs(b[0][2] - (bz - 8)) < 0.1, (bz, b))
        rows = cutlist_open(a)
        nm, data = download(a, "dialog.cut-dialog[open] button:has-text('CSV')")
        csv = data.decode("utf-8-sig"); cutlist_close(a)
        note("W1 CSV\n" + csv)
        chk("W1 CSV: 640×2, 440×2, ayak ×4, levha ×4", ";640;" in csv and ";440;" in csv and any(l.startswith(("3;4;", "4;4;", "1;4;", "2;4;")) and "Levha" in l for l in csv.split("\r\n")), csv[:300])
        # iskelet 600 → 800
        a.blur(); a.pg.keyboard.press("Control+7"); time.sleep(0.3)
        s3_open(a, "3B Çerçeve"); s3_edit_dim(a, 0, 800); a.ok(); a.wait(2)
        cl2 = cl_api(a); L2 = sorted(c[2] for c in cl2); note("W1 800", L2, a.errtree())
        chk("W1 çerçeve 800 → 840 kirişler; hata yok", 840 in L2 and not a.errtree(), (L2, a.errtree()))
        ax = a.ev("window.__app.doc.features.find(f=>f.id==='k2').xyz")
        note("W1 ayak iskeleti (bağımsız) noktaları", ax)
        # ayak iskeleti çerçeveye bağlı değil: sağdaki ayaklar 600'de kalır → kullanıcı ayak eskizini de güncellemeli (SolidWorks'te de bağımsız 3B eskiz)
        ec = [f for f in a.ev("JSON.parse(JSON.stringify(window.__app.doc.features))") if f["type"] == "endcap"][0]
        chk("W1 uç kapağı hatasız", not a.errtree(), a.errtree())
        # Ctrl+S → dosya içeriği güncel
        a.blur()
        with a.pg.expect_download(timeout=60000) as dl:
            a.pg.keyboard.press("Control+s")
            time.sleep(0.6)
            if a.pg.locator("dialog[open] input").count():
                a.pg.locator("dialog[open] button.primary, dialog[open] button[value='ok']").first.click()
        js = json.loads(open(dl.value.path(), encoding="utf-8").read())
        k1 = [f for f in js["features"] if f["id"] == "k1"][0]
        chk("W1 Ctrl+S dosyasında 3B ölçü 800, 2 yapı elemanı, uç kapağı", any(d["v"] == 800 for d in k1["dims3"]) and sum(f["type"] == "member" for f in js["features"]) == 2 and any(f["type"] == "endcap" for f in js["features"]), [f["type"] for f in js["features"]])
        a.reload(); L3 = sorted(c[2] for c in cl_api(a))
        chk("W1 yenile → aynı kesim listesi", L3 == L2, L3)
    if want("W3"):
        # ---------- W3: kutu 40x40x3, L=500 (−X yönünde), uç yüz x=0 sabit
        k = {"id": "k3", "type": "sketch3d", "name": "Kiriş", "ids": ["a", "b"], "xyz": [[0, 0, 0], [-500, 0, 0]],
             "lines": [{"id": "n1", "a": "a", "b": "b", "ax": "x"}], "r": 0, "seq": 5}
        a.setup([k, mem("m1", [("k3", "n1")], name="Kiriş-YE", corner="none")]); a.wait(1.2); iso(a)
        tab(a, "evaluate"); a.cmd("Mukavemet"); a.pg.wait_for_selector("dialog.analysis-dialog[open]"); time.sleep(0.4)
        lsel(a, "dialog.analysis-dialog", "Yük", "udl")
        r = a.ev("document.querySelector('dialog.analysis-dialog').__res"); note("W3 mukavemet", r)
        a.btn("dialog.analysis-dialog[open] button:has-text('Kapat')")
        a.cmd("Statik Analiz"); time.sleep(0.4)
        a.wclick([0, 0, 18.5]); a.wait(0.2)   # x=0 uç yüzü (halka)
        a.btn(".fea-panel button:has-text('Seçili yüzleri sabitle')")
        a.wclick([-250, 20, 0]); a.wait(0.2)  # üst yüz
        lsel(a, ".fea-panel", "Yön", "0")
        a.btn(".fea-panel button:has-text('Seçili yüzlere yük ekle')")
        st = a.ev("JSON.parse(JSON.stringify(window.__app.doc.fea))"); note("W3 çalışma", st)
        lsel(a, ".fea-panel", "Ağ", "20000")
        a.btn(".fea-panel button:has-text('▶ Çöz')")
        for _ in range(300):
            time.sleep(1)
            t = a.ev("document.querySelector('.fea-panel').textContent")
            if "von Mises" in t or "Önce" in a.toast(): break
        m = re.search(r"En büyük yer değiştirme:\s*([\d.,]+)", t); u = num(m.group(1)) if m else None
        note("W3 SEA", t[-260:])
        chk("W3 SEA sehimi Mukavemet (yayılı konsol) ile ±%15 uyumlu", u and abs(u - r["d"]) < 0.15 * r["d"], (u, r["d"]))
        a.btn(".fea-panel button:has-text('Kapat')")
    chk("konsol hatası yok", not a.errs, a.errs[:5])
    a.close()
finish()

# d8 — Kesim listesi: pencere satırları, Özellikler (tanım / malzeme / özel özellik) → kayıt / yenile / geri al,
# CSV içeriği, iskelet ölçüsü değişince satırlar ve özellikler, malzeme ↔ Kütle Özellikleri, imalat resmi (SVG),
# levha DXF (1:1), satır STEP, Dosya > Kesim listesi… menüsü, PM açıkken uyarı.
# Hazır model: 3B iskelet + yapı elemanı + köşe takviyesi (setDoc). Kullanıcı adımları gerçek tıklama.
import sys, re; sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d8h import *

FR = [("k1", l) for l in ["l1", "l2", "l3", "l4"]]
GUS = {"id": "g1", "type": "gusset", "name": "Köşe-Takviyesi1", "f1": {"c": [300, 20, 0], "n": [0, 1, 0]}, "f2": {"c": [20, 200, 0], "n": [1, 0, 0]},
       "d1": 100, "d2": 100, "t": 6, "chamfer": 10, "offset": 0}


def row_btn(a, i, text):
    return f"dialog.cut-dialog[open] table.cut-table >> nth=0 >> tr >> nth={i + 1} >> button:has-text('{text}')"


with sync_playwright() as p:
    a = App(p)
    a.setup([s3_frame(), mem("m1", FR, name="Çerçeve-YE"), GUS]); a.wait(1.5)
    if want("C1"):
        rows = cutlist_open(a)
        chk("C1 3 kalem (640×2, 440×2, levha)", rows and len(rows) == 3 and rows[2][2].startswith("Levha"), rows)
        # 1. kalem Özellikler
        a.btn(row_btn(a, 0, "Özellikler"))
        a.pg.wait_for_selector("dialog.cutprops[open]")
        auto = a.ev("[...document.querySelectorAll('dialog.cutprops[open] table tr')].map(r=>r.textContent)")
        chk("C1 Özellikler: UZUNLUK 640 / AÇI 45 / ADET 2", any("640" in x for x in auto) and any("ADET2" in x.replace(" ", "") for x in auto), auto)
        a.pg.fill("dialog.cutprops[open] label.pm-field:has-text('TANIM') input", "Yatay kiriş")
        a.pg.select_option("dialog.cutprops[open] label.pm-field:has-text('MALZEME') select", "aluminium")
        a.btn("dialog.cutprops[open] button:has-text('+ Özellik ekle')")
        ins = a.pg.locator("dialog.cutprops[open] .cp-list input")
        ins.nth(0).fill("Boya"); ins.nth(1).fill("RAL 7016")
        a.btn("dialog.cutprops[open] button:has-text('Tamam')"); time.sleep(1.5)
        a.pg.wait_for_selector("dialog.cut-dialog[open]", timeout=60000); time.sleep(0.5)
        rows = cutlist_rows(a); note("C1", rows)
        r0 = [r for r in rows if r[4] == "640"][0]
        # 252 494 mm³ × 2,70 g/cm³ = 0,68 kg
        chk("C1 satır: tanım + özellik, Alüminyum, birim 0,68 kg", "Yatay kiriş" in r0[2] and "RAL 7016" in r0[2] and "lüminyum" in r0[3] and r0[7] == "0,68", r0)
        tot = a.ev("(()=>{const d=document.querySelector('dialog.cut-dialog[open]');return [...d.querySelectorAll('p.small')].map(p=>p.textContent).join('|')})()")
        nm, data = download(a, "dialog.cut-dialog[open] button:has-text('CSV')")
        csv = data.decode("utf-8-sig"); note("C1 CSV\n" + csv)
        lines = csv.split("\r\n")
        chk("C1 CSV başlıkta 'Boya' sütunu, satırda RAL 7016 ve Alüminyum", "Boya" in lines[0] and any("RAL 7016" in l and "lüminyum" in l for l in lines), lines[:3])
        tot_csv = num([l for l in lines if ";Toplam;" in l][0].split(";")[-1])
        cutlist_close(a)
        # kayıt / yenile / geri al
        cp = a.stored().get("cutProps")
        chk("C1 cutProps localStorage'da", cp and any(v.get("desc") == "Yatay kiriş" for v in cp.values()), cp)
        a.reload(); rows = cutlist_open(a); cutlist_close(a)
        chk("C1 yenile → özellik korunur", any("Yatay kiriş" in r[2] for r in rows), rows)
        a.undo(); a.wait(1)
        cp2 = a.ev("JSON.parse(JSON.stringify(window.__app.doc.cutProps||null))")
        note("C1 Ctrl+Z sonrası cutProps", cp2)
        chk("C1 kesim listesi özelliği değişikliği geri alınabilir (Ctrl+Z)", not cp2, cp2)
        if cp2 is None or not cp2:
            a.redo()
        # ---------- C2: Kütle Özellikleri ↔ kesim listesi toplamı (kalem malzemesi alüminyum)
        tab(a, "evaluate"); a.cmd("Kütle Özell.")
        a.pg.wait_for_selector("dialog[open] .pm-result"); time.sleep(0.3)
        mtxt = a.pg.inner_text("dialog[open] .pm-result"); note("C2 kütle", mtxt, "| kesim toplam", tot_csv)
        mm = re.search(r"Kütle:\s*([\d.,]+)\s*(kg|g)", mtxt)
        mk = num(mm.group(1)) / (1000 if mm.group(2) == "g" else 1)
        chk("C2 Kütle Özellikleri kesim listesi kalem malzemesini (Alüminyum) hesaba katar (toplam ≈ CSV toplamı)", abs(mk - tot_csv) < 0.05, (mk, tot_csv))
        a.btn("dialog[open] button[value='ok']")
        # ---------- C3: iskelet 600 → 800: satırlar ve özellikler
        s3_open(a, "3B Çerçeve"); s3_edit_dim(a, 0, 800); a.ok(); a.wait(1.5)
        rows = cutlist_open(a); cutlist_close(a); note("C3", rows)
        chk("C3 iskelet 800 → 840 satırı", any(r[4] == "840" for r in rows), rows)
        chk("C3 boy değişince kalem özellikleri (tanım / malzeme / Boya) korunur", any(r[4] == "840" and "Yatay kiriş" in r[2] for r in rows), rows)
        a.undo()
    if want("C4"):
        # ---------- C4: imalat resmi (eleman) → SVG indir; levha DXF; STEP
        rows = cutlist_open(a)
        a.btn(row_btn(a, 0, "Resim"))
        a.pg.wait_for_selector("dialog.draw-dialog[open]", timeout=120000); time.sleep(1)
        nm, data = download(a, "dialog.draw-dialog[open] button:has-text('SVG indir')")
        svg = data.decode("utf-8")
        chk("C4 imalat resmi SVG: 640 boyu, 45° açı, antet", "640" in svg and "45" in svg and "İMALAT RESMİ" in svg, (nm, len(svg)))
        chk("C4 levha olmayan kalemde 'Levha DXF' yok", a.pg.locator("dialog.draw-dialog[open] button:has-text('Levha DXF')").count() == 0)
        a.btn("dialog.draw-dialog[open] form button"); time.sleep(0.4)
        a.btn(row_btn(a, 2, "Resim"))
        a.pg.wait_for_selector("dialog.draw-dialog[open]", timeout=120000); time.sleep(1)
        nm, data = download(a, "dialog.draw-dialog[open] button:has-text('Levha DXF')")
        dxf = data.decode("utf-8", "replace")
        xs = [float(v) for k, v in zip(dxf.split("\n")[::2], dxf.split("\n")[1::2]) if k.strip() in ("10", "11")]
        ys = [float(v) for k, v in zip(dxf.split("\n")[::2], dxf.split("\n")[1::2]) if k.strip() in ("20", "21")]
        note("C4 DXF", nm, dxf.count("LINE"), (min(xs), max(xs), min(ys), max(ys)) if xs else None)
        chk("C4 levha DXF 1:1: hipotenüse hizalı 141,4 × 63,6 (100×100, pah 10), 4 çizgi", xs and abs((max(xs) - min(xs)) - 141.42) < 0.2 and abs((max(ys) - min(ys)) - 63.64) < 0.2 and dxf.count("\nLINE") == 4, (min(xs), max(xs), min(ys), max(ys), dxf.count("\nLINE")) if xs else None)
        a.btn("dialog.draw-dialog[open] form button"); time.sleep(0.4)
        nm, data = download(a, row_btn(a, 1, "STEP"))
        st = data.decode("utf-8", "replace")
        chk("C4 satır STEP: tek katı, dosya adı 440", "MANIFOLD_SOLID_BREP" in st and "440" in nm, (nm, st.count("MANIFOLD_SOLID_BREP")))
        a.btn("dialog.cut-dialog[open] button:has-text('Tüm imalat resimleri')")
        a.pg.wait_for_selector("dialog.draw-dialog[open]", timeout=180000); time.sleep(1)
        h = a.pg.locator("dialog.draw-dialog[open] h2").inner_text()
        chk("C4 tüm imalat resimleri: 3 sayfa", "3 sayfa" in h, h)
        chk("C4 başlık Türkçesi doğru ('İmalat resimleri')", "resmileri" not in h, h)
        a.btn("dialog.draw-dialog[open] form button"); time.sleep(0.4)
        cutlist_close(a)
    if want("C5"):
        # ---------- C5: Dosya > Kesim listesi… menüsü; PM açıkken uyarı
        a.pg.click("#menus button:has-text('Dosya')"); time.sleep(0.3)
        a.pg.click(".menu-drop .mrow:has-text('Kesim listesi')"); time.sleep(1.5)
        chk("C5 Dosya > Kesim listesi… pencereyi açar", a.pg.locator("dialog.cut-dialog[open]").count() == 1)
        cutlist_close(a)
        tab(a, "weld"); a.cmd("Uç Kapağı"); a.wait(0.3)
        a.cmd("Kesim Listesi"); time.sleep(0.8)
        chk("C5 PM açıkken Kesim Listesi uyarır, açılmaz", a.pg.locator("dialog.cut-dialog[open]").count() == 0 and "tamamlayın" in a.toast(), a.toast())
        a.cancel("discard")
        # malzeme değişince kesim listesi kg
        tab(a, "evaluate"); a.cmd("Malzeme"); time.sleep(0.4)
        a.pg.check("dialog[open] input[value='aluminium']"); a.btn("dialog[open] button[value='ok']"); a.wait(0.8)
        rows = cutlist_open(a); cutlist_close(a)
        chk("C5 parça malzemesi Alüminyum → 640 kalem 0,68 kg", any(r[4] == "640" and r[7] == "0,68" for r in rows), rows)
        nm, data = download(a, "#nonexistent") if False else (None, None)
        a.undo(); rows = cutlist_open(a); cutlist_close(a)
        chk("C5 malzeme Ctrl+Z → çelik 1,98", any(r[4] == "640" and r[7] == "1,98" for r in rows), rows)
    chk("konsol hatası yok", not a.errs, a.errs[:5])
    a.close()
finish()

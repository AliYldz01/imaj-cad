# d8 — Değerlendir sekmesi (SEA hariç: d8_sea.py; Fotoğraflar / Kumpas: d8_saha.py): Ölç, Kütle Özell., Malzeme, Teknik Resim girişi,
# Mukavemet (analitik karşılaştırma + iskelet değişince), Girişim, Ne Yanlış?, Kontrol, Koniklik Analizi (silindirli model, model
# değişince), Kesit, Denklemler (değişken → uç kapağı kalınlığı), Yapılandırmalar (yapı elemanı bastırılınca kesim listesi).
# Hazır model: blok / 3B iskelet + yapı elemanı (setDoc). Kullanıcı adımları gerçek tıklama.
import sys, re; sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d8h import *

FR = [("k1", l) for l in ["l1", "l2", "l3", "l4"]]


def one_line(L=1000, fid="k3"):
    return {"id": fid, "type": "sketch3d", "name": "Kiriş", "ids": ["a", "b"], "xyz": [[0, 0, 0], [L, 0, 0]],
            "lines": [{"id": "n1", "a": "a", "b": "b", "ax": "x"}], "r": 0, "seq": 5, "dims3": [{"id": "d1", "t": "len", "e": ["n1"], "v": L}],
            "cons3": [{"id": "c1", "t": "fix", "e": ["a"], "p": [0, 0, 0]}]}


def mres(a):
    return a.pg.inner_text("#pm-body") if a.pg.locator("#pm-body .pm-result").count() else ""


def dlg_text(a, sel="dialog[open]"):
    return a.pg.inner_text(sel) if a.pg.locator(sel).count() else ""


with sync_playwright() as p:
    a = App(p)
    if want("E1"):
        # ---------- Ölç: blok 80×60×20 (üst düzlem) — üst yüz alanı, üst yüz ↔ ön alt kenar, kenar uzunluğu
        a.setup(block(80, 60, 20)); iso(a)
        tab(a, "evaluate"); a.cmd("Ölç")
        chk("E1 Ölç modu", a.mode() == "measure", a.mode())
        a.wclick([0, 20, 0]); time.sleep(1.0)
        t = mres(a); chk("E1 üst yüz alanı 4 800", "4800" in t.replace(".", "").replace(",", "") or "4 800" in t, t)
        a.wclick([0, 0, 30]); time.sleep(1.0)
        t = mres(a); note("E1", t)
        chk("E1 üst yüz ↔ ön alt kenar: en kısa mesafe 20", re.search(r"En kısa mesafe: 20([.,]0+)? mm", t) is not None, t)
        a.wclick([10, 20, 30]); time.sleep(1.0)
        t = mres(a); chk("E1 3. tık yeni ölçüm: ön üst kenar 80", re.search(r"Kenar uzunluğu: 80", t) is not None, t)
        a.press("Escape"); time.sleep(0.4)
        chk("E1 Esc → ölçüden çık", a.mode() == "part", a.mode())
    if want("E2"):
        # ---------- Kütle Özell. + Malzeme değiştir + Ctrl+Z
        a.setup(block(80, 60, 20))
        tab(a, "evaluate"); a.cmd("Kütle Özell.")
        a.pg.wait_for_selector("dialog[open] .pm-result"); t = dlg_text(a)
        chk("E2 kütle 96 000 mm³ × 7,85 = 753,6 g, AM y=10", "753,6 g" in t and "Y 10" in t, t)
        a.btn("dialog[open] form button:not([value='ok'])"); time.sleep(0.5)
        a.pg.check("dialog[open] input[value='aluminium']"); a.btn("dialog[open] button[value='ok']"); a.wait(0.5)
        a.cmd("Kütle Özell."); a.pg.wait_for_selector("dialog[open] .pm-result"); t = dlg_text(a)
        chk("E2 Malzeme değiştir → Alüminyum 259,2 g", "259,2 g" in t, t)
        a.btn("dialog[open] button[value='ok']"); time.sleep(0.3)
        a.undo(); a.cmd("Kütle Özell."); a.pg.wait_for_selector("dialog[open] .pm-result"); t = dlg_text(a)
        chk("E2 Ctrl+Z → çelik 753,6 g", "753,6 g" in t, t)
        a.press("Escape"); time.sleep(0.5)
        chk("E2 Kütle penceresinde Esc Malzeme penceresini açmamalı (P-25)", a.pg.locator("dialog[open]").count() == 0, dlg_text(a)[:60])
        if a.pg.locator("dialog[open]").count(): a.press("Escape")
        a.reload(); chk("E2 yenile → malzeme çelik", (a.stored().get("material") or "steel") == "steel", a.stored().get("material"))
    if want("E3"):
        # ---------- Teknik Resim girişi (içi d9)
        a.setup(block(80, 60, 20))
        tab(a, "evaluate"); a.cmd("Teknik Resim")
        a.pg.wait_for_selector("dialog[open]", timeout=120000); time.sleep(2)
        t = dlg_text(a)
        chk("E3 Teknik Resim penceresi açılır", "resim" in t.lower(), t[:80])
        a.press("Escape"); time.sleep(0.5)
    if want("E4"):
        # ---------- Mukavemet: tek kutu 40x40x3 elemanı L=1000, konsol 1000 N
        a.setup([one_line(1000), mem("m1", [("k3", "n1")], name="Kiriş-YE", corner="none")]); a.wait(1.5)
        tab(a, "evaluate"); a.cmd("Mukavemet")
        a.pg.wait_for_selector("dialog.analysis-dialog[open]", timeout=60000); time.sleep(0.5)
        r = a.ev("document.querySelector('dialog.analysis-dialog').__res")
        note("E4", r)
        I_rect = (40 ** 4 - 34 ** 4) / 12
        chk("E4 L = 1000, I ≈ EN 10219 SHS 40×40×3 tablo 9,32 cm⁴ (köşe R'li; R'siz 10,20)", abs(r["L"] - 1000) < 0.5 and abs(r["I"] - 93200) < 0.02 * 93200, (r["L"], r["I"], I_rect))
        sig = 1000 * 1000 * 20 / r["I"]; dl = 1000 * 1000 ** 3 / (3 * 210000 * r["I"])
        chk("E4 σ = F·L·c / I, δ = F·L³ / 3EI", abs(r["sig"] - sig) < 0.01 * sig and abs(r["d"] - dl) < 0.01 * dl, (r["sig"], sig, r["d"], dl))
        a.pg.select_option("dialog.analysis-dialog label.pm-field:has-text('Mesnet') select", "simple"); time.sleep(0.4)
        r2 = a.ev("document.querySelector('dialog.analysis-dialog').__res")
        chk("E4 basit mesnet ortada tekil: σ/4, δ/16", abs(r2["sig"] - sig / 4) < 0.01 * sig and abs(r2["d"] - dl / 16) < 0.01 * dl, (r2["sig"], r2["d"]))
        a.pg.select_option("dialog.analysis-dialog label.pm-field:has-text('Mesnet') select", "cant"); time.sleep(0.3)
        a.btn("dialog.analysis-dialog[open] button:has-text('Kapat')")
        # iskelet 1000 → 500
        s3_open(a, "Kiriş"); s3_edit_dim(a, 0, 500); a.ok(); a.wait(1.5)
        tab(a, "evaluate"); a.cmd("Mukavemet"); a.pg.wait_for_selector("dialog.analysis-dialog[open]"); time.sleep(0.5)
        r3 = a.ev("document.querySelector('dialog.analysis-dialog').__res")
        chk("E4 iskelet 500 → L 500, δ / 8", abs(r3["L"] - 500) < 0.5 and abs(r3["d"] - dl / 8) < 0.02 * dl / 8, (r3["L"], r3["d"]))
        txt = dlg_text(a, "dialog.analysis-dialog[open]"); note("E4 yazı", txt[-500:])
        a.btn("dialog.analysis-dialog[open] button:has-text('Malzeme…')"); time.sleep(0.5)
        chk("E4 Malzeme… düğmesi malzeme penceresini açar", "Malzeme" in dlg_text(a))
        a.btn("dialog[open] button[value='cancel']")
    if want("E5"):
        # ---------- Girişim: köşe işlemi yok → 4 girişim; gönye → yok
        a.setup([s3_frame(), mem("m1", FR, name="Çerçeve-YE", corner="none")]); a.wait(1.5)
        tab(a, "evaluate"); a.cmd("Girişim"); time.sleep(2.5)
        t = a.toast(); note("E5", t)
        m = re.search(r"(\d+) girişim", t)
        # 40×40 kesitin köşe kesişimi: dolu iki kutu kesişimi 40×40×40 küpün kutu–kutu ortak hacmi
        chk("E5 köşe işlemi yok → 4 girişim listelenir", m and m.group(1) == "4", t)
        a.edit_feat("Çerçeve-YE"); a.pmseg("Gönye"); a.ok(); a.wait(1.2)
        tab(a, "evaluate"); a.cmd("Girişim"); time.sleep(2.5)
        chk("E5 gönye → 'girişim yok'", "girişim yok" in a.toast(), a.toast())
    if want("E6"):
        # ---------- Ne Yanlış? + Kontrol: uç kapağı yüzü yok (hatalı özellik)
        bad = {"id": "ec", "type": "endcap", "name": "Uç-Kapağı1", "faces": [{"c": [999, 999, 999], "n": [0, 1, 0]}], "t": 5, "inset": 0}
        a.setup([s3_frame(), mem("m1", FR, name="Çerçeve-YE"), bad]); a.wait(1.5)
        tab(a, "evaluate"); a.cmd("Ne Yanlış?"); a.pg.wait_for_selector("dialog.whatswrong[open]")
        t = dlg_text(a, "dialog.whatswrong[open]"); note("E6", t)
        chk("E6 Ne Yanlış? Uç-Kapağı1 hatasını listeler", "Uç-Kapağı1" in t, t)
        a.btn("dialog.whatswrong[open] button:has-text('Bastır')"); a.wait(1.0)
        chk("E6 Bastır → hata kalkar", not a.errtree() and a.feat("ec").get("off"), a.errtree())
        a.cmd("Kontrol"); a.pg.wait_for_selector("dialog.whatswrong[open] .ww-check .ww-row", timeout=120000)
        rows = a.pg.locator("dialog.whatswrong[open] .ww-check .ww-row").all_inner_texts(); note("E6 kontrol", rows)
        chk("E6 Kontrol: 4 gövde geçerli, serbest kenar yok", len(rows) == 4 and all(r.startswith("✓") for r in rows), rows)
        a.btn("dialog.whatswrong[open] button:has-text('Kapat')")
        a.undo(); chk("E6 Ctrl+Z → bastırma geri, hata yine görünür", "Uç-Kapağı1" in " ".join(a.errtree()), a.errtree())
    if want("E7"):
        # ---------- Koniklik Analizi: boru elemanı (silindirik yüzler) + blok
        a.setup([one_line(400), mem("m1", [("k3", "n1")], name="Boru-YE", std="boru", size="42.4x3.2", corner="none")]); a.wait(1.5)
        od = a.ev("[...document.querySelectorAll('dialog[open]')].map(d=>d.className+':'+d.textContent.slice(0,80))")
        if od: note("E7 açık pencere", od); a.press("Escape")
        e0 = len(a.errs)
        tab(a, "evaluate"); a.cmd("Koniklik Analizi"); time.sleep(0.8)
        st = a.ev("(document.querySelector('.draft-ana .da-stat')||{}).textContent||''")
        note("E7 boru", st, a.errs[e0:])
        chk("E7 silindirik yüzlü modelde koniklik analizi hatasız (sayılar yazılır, konsol hatası yok)", st.startswith("Pozitif") and len(a.errs) == e0, (st, a.errs[e0:]))
        a.cmd("Koniklik Analizi"); time.sleep(0.4)
        a.setup(block(80, 60, 20)); a.wait(1)
        a.cmd("Koniklik Analizi"); time.sleep(0.6)
        st1 = a.ev("document.querySelector('.draft-ana .da-stat').textContent")
        chk("E7 blok +Y: Pozitif 1 · Negatif 1 · Koniklik gerekli 4", "Pozitif 1" in st1 and "Negatif 1" in st1 and "gerekli 4" in st1, st1)
        # model değişince (eskiz düzenle: ölçü 80 → 100) analiz yenilenir mi
        a.tact("Ekstrüzyon1", "Eskizi düzenle"); a.wait(0.5)
        a.dim_dbl(0, 100); a.ok(); a.wait(1.5)
        st2 = a.ev("(document.querySelector('.draft-ana .da-stat')||{}).textContent||'(panel yok)'")
        col = a.ev("!!(window.__app.viewer.colorsOn||window.__app.viewer.analysis)")
        note("E7 model değişince", st2, col, a.size())
        chk("E7 eskiz düzenleme sonrası koniklik paneli / renkleri açık kalır", st2.startswith("Pozitif"), st2)
        a.pg.locator(".draft-ana button:has-text('Kapat')").click() if a.pg.locator(".draft-ana").count() else None
    if want("E8"):
        # ---------- Kesit: Ön düzlem, öteleme 10, ters, ✓ / ✕
        a.setup(block(80, 60, 20)); iso(a)
        tab(a, "evaluate"); a.cmd("Kesit"); time.sleep(0.4)
        cp = lambda: a.ev("(()=>{const r=window.__app.viewer.renderer;return r.clippingPlanes.map(p=>[p.normal.x,p.normal.y,p.normal.z,+p.constant.toFixed(2)])})()")
        chk("E8 kesit açık → kırpma düzlemi", len(cp()) == 1, cp())
        a.pmfield("Öteleme", 10); c1 = cp()
        chk("E8 öteleme 10 → düzlem sabiti ±10", c1 and abs(abs(c1[0][3]) - 10) < 0.01, c1)
        a.pmcheck("Yönü ters çevir", True); c2 = cp()
        chk("E8 ters çevir → normal ters", c2 and c2[0][2] == -c1[0][2], (c1, c2))
        a.pmselect("Kesit düzlemi", "top"); c3 = cp(); chk("E8 Üst düzlem → normal Y", c3 and abs(c3[0][1]) == 1, c3)
        a.btn("#pm-ok"); time.sleep(0.4)
        chk("E8 ✓ kesiti açık bırakır", len(cp()) == 1 and a.mode() == "part", (cp(), a.mode()))
        a.cmd("Kesit"); time.sleep(0.3); a.btn("#pm-cancel"); time.sleep(0.4)
        chk("E8 ✕ kesiti kapatır", len(cp()) == 0, cp())
    if want("E9"):
        # ---------- Denklemler: T = 5 → uç kapağı Kalınlık alanına =T → T = 12 → kapak 12
        one = one_line(500)
        one["xyz"] = [[0, 0, 0], [0, 500, 0]]; one["lines"][0]["ax"] = "y"
        a.setup([one, mem("m1", [("k3", "n1")], name="Dikme-YE", corner="none")]); a.wait(1.2); iso(a)
        tab(a, "evaluate"); a.cmd("Denklemler"); time.sleep(0.4)
        a.btn("dialog[open] button:has-text('+ Değişken ekle')")
        ins = a.pg.locator("dialog[open] .eq-row input")
        ins.nth(0).fill("T"); ins.nth(0).press("Tab"); time.sleep(0.2)
        ins = a.pg.locator("dialog[open] .eq-row input"); ins.nth(1).fill("5")
        a.btn("dialog[open] button[value='ok']"); a.wait(0.5)
        chk("E9 değişken T = 5 belgede", (a.ev("JSON.parse(JSON.stringify(window.__app.doc.vars||{}))") or {}).get("T") == "5", a.ev("window.__app.doc.vars"))
        tab(a, "weld"); a.cmd("Uç Kapağı"); a.wclick([18.5, 500, 0]); a.wait(0.3)
        a.pmfield("Kalınlık", "=T"); a.ok(); a.wait(1.2)
        b1 = a.bbox(); chk("E9 Kalınlık =T → kapak 505", abs(b1[1][1] - 505) < 0.1, b1)
        tab(a, "evaluate"); a.cmd("Denklemler"); time.sleep(0.4)
        ins = a.pg.locator("dialog[open] .eq-row input"); ins.nth(1).fill("12")
        a.btn("dialog[open] button[value='ok']"); a.wait(1.5)
        b2 = a.bbox(); chk("E9 T = 12 → kapak 512 (denklem modele geçer)", abs(b2[1][1] - 512) < 0.1, b2)
        a.undo(); b3 = a.bbox(); chk("E9 Ctrl+Z → 505", abs(b3[1][1] - 505) < 0.1, b3)
        a.reload(); chk("E9 yenile → 505", abs(a.bbox()[1][1] - 505) < 0.1, a.bbox())
    if want("E10"):
        # ---------- Yapılandırmalar: 2. yapılandırmada uç kapağı bastırılmış → kesim listesi yapılandırmayı izler
        one = one_line(500); one["xyz"] = [[0, 0, 0], [0, 500, 0]]; one["lines"][0]["ax"] = "y"
        ec = {"id": "ec", "type": "endcap", "name": "Uç-Kapağı1", "faces": [{"c": [0, 500, 0], "n": [0, 1, 0]}], "t": 5, "inset": 0}
        a.setup([one, mem("m1", [("k3", "n1")], name="Dikme-YE", corner="none"), ec]); a.wait(1.2)
        n0 = len(cl_api(a))
        tab(a, "evaluate"); a.cmd("Yapılandırmalar"); time.sleep(0.4)
        a.btn("dialog[open] button:has-text('Yapılandırma ekle')"); time.sleep(0.4)
        # 2. sütunda Uç-Kapağı1 satırını işaretle (bastır)
        a.ev("""(()=>{const tr=[...document.querySelectorAll('dialog[open] table tr')].find(r=>r.textContent.includes('Uç-Kapağı1'));const cb=tr.querySelectorAll('input[type=checkbox]');return cb.length})()""")
        cb = a.pg.locator("dialog[open] table tr:has-text('Uç-Kapağı1') input[type=checkbox]")
        cb.nth(cb.count() - 1).click(); time.sleep(0.3)
        rad = a.pg.locator("dialog[open] input[type=radio]")
        rad.nth(rad.count() - 1).click(); time.sleep(0.5)
        a.btn("dialog[open] button:has-text('Kapat')"); a.wait(1.2)
        n1 = len(cl_api(a))
        chk("E10 2. yapılandırma (kapak bastırılmış) → kesim listesi 1 kalem az", n1 == n0 - 1, (n0, n1, a.ev("window.__app.doc.config")))
        a.reload(); chk("E10 yenile → etkin yapılandırma korunur", len(cl_api(a)) == n1, a.ev("window.__app.doc.config"))
    chk("konsol hatası yok", not a.errs, a.errs[:5])
    a.close()
finish()

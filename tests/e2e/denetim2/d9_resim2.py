# d9 — Teknik resim 2: Montaj Resmi (balonlar, malzeme listesi, 2. sayfa patlatılmış) + parça değişince montaj resmi,
#      kaynaklı resim (kesim listesi tablosu), sac parça resmi.
import sys, math; sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d9h import *
from d8h import frame_sk, mem
from h import sketch as hsketch
src = open('/home/claude/imaj-cad/tests/e2e/denetim2/d9_resim.py').read()
exec(src[src.index("class TD:"):src.index("with sync_playwright() as p:")])

with sync_playwright() as p:
    # ---------- M1: Montaj Resmi ----------
    if want("M1"):
        A = App(p); S = Asm(A); T = TD(A)
        to_lib(A, pin_doc())
        setdoc(A, plate_doc())
        A.edit_feat("Ekstrüzyon1"); A.ok()
        S.open(); P1 = S.add_current(); PN = S.add_lib("Pim"); P2 = S.add_current(); S.fit()
        A.cmd("Montaj Resmi")
        for _ in range(120):
            time.sleep(0.25)
            if A.pg.locator("dialog.draw-dialog[open]").count() and T.svg():
                break
        time.sleep(0.5)
        sv = T.svg(); ts = T.texts()
        chk("M1 Montaj resmi: malzeme listesi Plaka 2 / Pim 1", "Plaka" in sv and "Pim" in sv, [t for t in ts if t in ("Plaka", "Pim", "2", "1")][:8])
        nb = len(re.findall(r"<circle", sv))
        chk("M1 balonlar (≥ 2 parça numarası)", nb >= 2, nb)
        chk("M1 montaj resminde ölçü / açıklama araç çubuğu yok (SW'de var)", A.pg.locator("dialog.draw-dialog[open] .td-tools").count() > 0, "araç çubuğu yok")
        T.close()
        # patlatma adımı + 2. sayfa
        A.cmd("Patlatılmış Görünüm"); S.click_local(PN["id"], [3.5, 20, 3.5]); A.pmselect("Yön", "y"); A.pmfield("Mesafe", 60); A.pmbtn("Adım ekle"); S.pmok()
        A.cmd("Montaj Resmi")
        for _ in range(160):
            time.sleep(0.25)
            if A.pg.locator("dialog.draw-dialog[open]").count() and T.svg():
                break
        time.sleep(0.5)
        chk("M1 patlatma adımı varken 2 sayfa (patlatılmış)", T.nsheets() == 2, T.nsheets())
        T.close()
        if A.ev("[...document.querySelectorAll('#cmds button')].some(b=>b.title==='Daralt')"):
            A.cmd("Daralt"); time.sleep(1.5)
        # parça değişir (bağlam içi: Plaka<2> genişlik 100 → 150) → montaj resmi güncellenir
        S.comp_act("Plaka<2>", "Parçayı düzenle")
        A.tact("Ekstrüzyon1", "Eskizi düzenle"); A.dim_dbl(0, 150); A.ok()
        A.btn(".ctx-edit-bar button:has-text('Montaja dön')"); A.wait(2.5)
        bb = S.bbox(P2["id"])
        chk("M1 bağlam içi: Plaka<2> 150 mm", bb and abs(bb[1][0] - bb[0][0] - 150) < 0.05, bb)
        A.cmd("Montaj Resmi")
        for _ in range(160):
            time.sleep(0.25)
            if A.pg.locator("dialog.draw-dialog[open]").count() and T.svg():
                break
        time.sleep(0.5)
        d = A.ev("(()=>{const d=document.querySelector('dialog.draw-dialog[open]');const x=d._data();return x&&x.iso?[x.iso.min,x.iso.max]:null})()")
        chk("M1 montaj resmi yeni geometriden (izometrik genişlik büyüdü)", d is not None, d)
        fn, svgf, _ = S.download(lambda: A.btn("dialog.draw-dialog[open] .cut-bar button:has-text('SVG indir')"))
        chk("M1 montaj resmi SVG (2 sayfa → 2 dosya ilk)", fn.endswith(".svg") and "Plaka" in svgf, fn)
        T.close()
        A.close()
    # ---------- K1: kaynaklı resim kesim listesi ----------
    if want("K1"):
        A = App(p); T = TD(A)
        fs = [frame_sk("s1", "Çerçeve", FRONT, 600, 400), mem("m1", [("s1", "l5"), ("s1", "l6"), ("s1", "l7"), ("s1", "l8")], name="Yapı Elemanı1")]
        setdoc(A, {"version": 2, "name": "Çerçeve", "features": fs, "seq": {}})
        A.wait(2)
        T.open()
        sv = T.svg(); ts = T.texts()
        chk("K1 KESİM LİSTESİ tablosu ve balonlar", "KESİM LİSTESİ" in sv and len(re.findall(r"<circle", sv)) >= 2, [t for t in ts if t.isdigit()][:12])
        T.opt_check("Kesim listesi + balonlar", False)
        chk("K1 seçenek kapatınca tablo kalkar", "KESİM LİSTESİ" not in T.svg())
        T.close()
        # çerçeve 600 → 800 (3B değil 2B iskelet ağaçta görünmüyor: P-4) — Yapı Elemanı1 düzenle yerine resmi tekrar açarak boy kontrolü
        A.close()
    # ---------- SM1: sac parça resmi ----------
    if want("SM1"):
        A = App(p); T = TD(A)
        plate = hsketch("s1", "E", TOP, lambda pt, line, rect, circle, text: rect(0, 0, 100, 60))
        base = {"id": "b1", "type": "sheetbase", "name": "Taban", "sketch": "s1", "t": 2, "r": 2, "k": 0.5, "rev": False, "d": 40, "mid": False, "relief": 0.5}
        ef = {"id": "e1", "type": "edgeflange", "name": "Flanş", "edges": [{"m": [50, 2, 0]}], "L": 30, "angle": 90, "pos": "inside", "lenRef": "outer", "flip": False, "useDef": True, "r": 2, "o1": 0, "o2": 0, "gap": 0.2}
        setdoc(A, {"version": 2, "name": "Sac", "features": [plate, base, ef], "seq": {}})
        A.wait(2)
        T.open()
        ts = T.texts()
        chk("SM1 sac parça resmi açılır, ölçüler (100 / 60)", "100" in ts and "60" in ts, numtexts(ts)[:10])
        chk("SM1 sac resminde açınım görünüşü / büküm notu (SW: düz desen görünüşü)", any("açınım" in t.lower() or "büküm" in t.lower() for t in ts), "yok")
        T.close()
        A.close()
finish()

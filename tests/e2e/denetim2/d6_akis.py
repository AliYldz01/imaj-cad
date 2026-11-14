# Denetim 2 / d6 — İş akışları (masaüstü): eskizi gerçekten çiz → sac parça → açınım → DXF → kaydet → yenile;
# geçiş parçası (Loft + "Sac geçiş parçası") → açınım DXF.
import sys
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d6h import *  # noqa
ONLY = os.environ.get('ONLY')
BD = lambda r, t, k: 2 * (r + t) - ba(90, r, t, k)

with sync_playwright() as p:
    a = App(p, nosfp=True)

    def case(name, fn):
        if ONLY and name not in ONLY.split(","):
            return
        print("=====", name, flush=True)
        try:
            fn()
        except Exception as ex:
            chk(name + " (istisna)", False, str(ex)[:300])
            try:
                a.close_dialogs()
                if a.mode() == "flat": flat_close(a)
                if a.mode() in ("pm", "sketch"): a.cancel("discard")
            except Exception:
                pass

    # W1: Üst düzlemde dikdörtgen çiz (gerçek tık) → Taban flanş t1.5 → 2 kenar flanşı → köşe kır R → delik → açınım → DXF → kaydet → yenile
    def w1():
        a.setup([])
        a.tact("Üst Düzlem", "Eskiz")
        chk("W1 eskiz modu", a.mode() == "sketch", a.mode())
        a.btn("#tabs button[data-tab=sketch]")
        a.cmd("Dikdörtgen")
        a.clk(0, 0); a.clk(120, 80)
        info = a.skinfo()
        print("   çizilen eskiz:", info)
        chk("W1 dikdörtgen çizildi (4 çizgi)", info["types"].count("line") >= 4, info)
        a.press("Escape")
        a.ok()
        chk("W1 eskizden çıkıldı", a.mode() == "part", a.mode())
        sk = [n for n in a.names() if n.startswith("Eskiz")][-1]
        bbx = a.ev("JSON.stringify(Object.values(window.__app.doc.features.at(-1).data.pts).map(p=>[+p.x.toFixed(2),+p.y.toFixed(2)]))")
        print("   noktalar:", bbx)
        new_sheet(a, "Taban Flanş", sk)
        a.pmselect("Kalınlık tablosu", "1,5 mm"); a.ok()
        v = a.vol(); bb = a.bbox()
        print("   levha:", v, bb)
        W = bb[1][0] - bb[0][0]; H = bb[1][2] - bb[0][2]
        chk("W1 taban flanş 1.5 mm levha", near(v, W * H * 1.5, 1), (v, W, H))
        view_iso(a); fit(a)
        x0, x1, z0, z1 = bb[0][0], bb[1][0], bb[0][2], bb[1][2]
        new_sheet(a, "Kenar Flanş")
        edge_click(a, [(x0 + x1) / 2, 1.5, z1]); edge_click(a, [x1, 1.5, (z0 + z1) / 2])
        a.pmfield("Uzunluk", 20); a.ok()
        chk("W1 iki kenar flanşı hatasız", not a.errs_map(), a.errs_map())
        r = flat_dims(a)
        e = 20 - BD(1.5, 1.5, 0.43)
        print("   açınım:", r and (r["w"], r["h"], len(r["bends"])))
        chk("W1 açınım (W+%.3f)×(H+%.3f), 2 büküm" % (e, e), r and sorted([r["w"], r["h"]]) == sorted([round(W + e, 3), round(H + e, 3)]) or (r and near(max(r["w"], r["h"]), max(W, H) + e, 0.02) and near(min(r["w"], r["h"]), min(W, H) + e, 0.02)), r and (r["w"], r["h"]))
        txt = dxf_download(a, "/tmp/d6/w1.dxf"); d = dxf_parse(txt)
        notes = [t[3] for t in d["texts"]]
        chk("W1 DXF: kesim = açınım, 2 büküm çizgisi, 't=1.5' notu", dxf_cut_bbox(d) and near(max(dxf_cut_bbox(d)), max(r["w"], r["h"]), 0.01) and len([l for l in d["lines"] if l[0].startswith("BUKUM")]) == 2 and any("t=1,5" in s or "t=1.5" in s for s in notes), (dxf_cut_bbox(d), notes))
        # dosya kaydet (Ctrl+S → indirme)
        a.blur()
        with a.pg.expect_download(timeout=60000) as dl:
            a.pg.keyboard.press("Control+s")
            time.sleep(0.5)
            if a.ev("document.querySelectorAll('dialog[open]').length"):
                a.pg.keyboard.press("Enter")
        dl.value.save_as("/tmp/d6/w1.icad")
        js = json.load(open("/tmp/d6/w1.icad"))
        types = [f["type"] for f in js["features"]]
        chk("W1 Kaydet: dosyada sheetbase + edgeflange (t 1.5)", "sheetbase" in types and "edgeflange" in types and any(f.get("t") == 1.5 for f in js["features"] if f["type"] == "sheetbase"), types)
        v1 = a.vol()
        a.reload()
        chk("W1 yenile → aynı model", near(a.vol(), v1, 0.01), (v1, a.vol()))
    case("W1", w1)

    # W2: geçiş parçası (Ø100 → 120×80, 80 yüksek) Loft + sac geçiş + açınım DXF
    def w2():
        circ = circ_sk("s1", "Eskiz1", TOP, 0, 0, 50)
        pl = refplane("p1", "Düzlem1", {"k": "std", "n": "top"}, 80)
        rs = rect_sk("s2", "Eskiz2", {"k": "ref", "id": "p1"}, -60, -40, 60, 40)
        a.setup([circ, pl, rs]); view_iso(a); fit(a)
        a.btn("#tabs button[data-tab=features]")
        a.cmd("Loft"); a.wait(1)
        chk("W2 Loft PM", a.mode() == "pm" and a.pmhas("Sac geçiş parçası"), a.pmtext()[:80])
        a.pmcheck("Sac geçiş parçası", True); a.wait(1)
        a.ok()
        v = a.vol(); errs = a.errs_map(); bb = a.bbox()
        print("   geçiş parçası:", v, errs, bb)
        chk("W2 geçiş parçası hatasız, yükseklik 80", not errs and bb and near(bb[1][1] - bb[0][1], 80, 0.05), (errs, bb))
        nm = a.names()[-1]
        a.edit_feat(nm)
        with a.pg.expect_download(timeout=60000) as dl:
            a.pmbtn("Açınım (DXF indir)")
        dl.value.save_as("/tmp/d6/w2.dxf")
        tt = a.toast()
        d = dxf_parse(open("/tmp/d6/w2.dxf", encoding="latin-1").read())
        print("   geçiş açınımı:", tt, len(d["lines"]), d["layers"])
        m = re.search(r"alanı ([\d,]+) cm²", tt)
        area = float(m.group(1).replace(",", ".")) * 100 if m else None
        # orta yüzey alanı yaklaşık: yanal yüzey ≈ (çevre ort.) × eğik yükseklik; kaba sınır
        P1 = PI * 100; P2 = 2 * (120 + 80)
        approx = (P1 + P2) / 2 * 80
        chk("W2 açınım alanı ≈ ortalama çevre × yükseklik (±%25)", area and abs(area - approx) / approx < 0.25, (area, approx))
        a.cancel("discard")
        # Sac sekmesinden Düzleştir / Açınım DXF bu parçada çalışıyor mu?
        r = flat_open(a)
        print("   Sac > Düzleştir (geçiş parçası):", r and (r["w"], r["h"]), a.toast())
        chk("W2 Sac > Düzleştir geçiş parçasında çalışır ya da açıklayıcı uyarı verir", r is not None or "taban" in a.toast().lower() or "geçiş" in a.toast().lower(), a.toast())
        flat_close(a)
        v1 = a.vol(); a.reload()
        chk("W2 yenile", near(a.vol(), v1, 0.01), (v1, a.vol()))
    case("W2", w2)

    print("diyaloglar:", a.dlog, "hatalar:", a.errs[:5])
    a.close()
finish()

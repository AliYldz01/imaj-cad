# Denetim 2 / d6 — (c) Ebeveyn eskiz değişince sac özellikleri doğru kenarda kalıyor mu?
# Taban flanş eskizi ağaçta görünmediği (P-4) için kullanıcının tek yolu: eskiz ölçülerini önceden global
# değişkene bağlamak (=W, =H) ve Değerlendir > Denklemler'den değiştirmek. Hepsi gerçek tık / klavye.
# Hazır model: yalnız ölçülü 100×60 levha eskizi.
import sys
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d6h import *  # noqa
ONLY = os.environ.get('ONLY')


def set_vars(a, vals):
    """Değerlendir > Denklemler → değişkenleri yaz → Uygula"""
    a.btn("#tabs button[data-tab=evaluate]")
    a.cmd("Denklemler")
    dl = a.pg.locator("dialog[open]").last
    for name, v in vals.items():
        rows = dl.locator(".eq-row")
        idx = None
        for i in range(rows.count()):
            if rows.nth(i).locator("input").nth(0).input_value() == name:
                idx = i
        if idx is None:
            dl.locator("button:has-text('+ Değişken ekle')").click(); time.sleep(0.2)
            idx = rows.count() - 1
            n = rows.nth(idx).locator("input").nth(0)
            n.fill(name); n.press("Tab"); time.sleep(0.2)
            rows = dl.locator(".eq-row")
            idx = [rows.nth(i).locator("input").nth(0).input_value() for i in range(rows.count())].index(name)
        e = rows.nth(idx).locator("input").nth(1)
        e.fill(str(v)); time.sleep(0.1)
    dl.locator("button[value=ok]").click()
    a.wait(1.5)
    sheet_tab(a)


def top_extent(a):
    """üst yüzeylerin (n=+y) en geniş x aralığı ve en yüksek flanş"""
    return a.ev("""(()=>{const m=window.__app.viewer.mesh;return m.bbox?[m.bbox.min.map(v=>+v.toFixed(2)),m.bbox.max.map(v=>+v.toFixed(2))]:null})()""")


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
                a.close_dialogs()
                if a.mode() == "flat": flat_close(a)
                if a.mode() in ("pm", "sketch"): a.cancel("discard")
            except Exception:
                pass

    def e1():
        a.setup([plate_sk()])
        set_vars(a, {"W": 100, "H": 60})
        chk("E1 değişkenler kaydedildi", a.ev("JSON.stringify(window.__app.doc.vars||{})") in ('{"W":"100","H":"60"}', '{"H":"60","W":"100"}'), a.ev("JSON.stringify(window.__app.doc.vars||{})"))
        a.tact("Eskiz1", "Eskizi düzenle")
        a.dim_dbl(0, "=W"); a.dim_dbl(1, "=H"); a.ok()
        exprs = a.ev("window.__app.doc.features[0].data.dims.map(d=>d.expr||null)")
        chk("E1 eskiz ölçüleri =W / =H bağlı", exprs == ["W", "H"] or exprs == ["=W", "=H"], exprs)
        sheet_tab(a)
        new_sheet(a, "Taban Flanş", "Eskiz1"); a.ok()
        view_iso(a); fit(a)
        new_sheet(a, "Kenar Flanş"); edge_click(a, [50, 2, 0]); a.ok()                 # ön kenar
        new_sheet(a, "Kenar Flanş"); edge_click(a, [100, 2, -30]); a.ok()              # sağ kenar
        new_sheet(a, "Kenet"); edge_click(a, [50, 2, -60]); a.ok()                    # arka kenar
        new_sheet(a, "Şekillendirme"); a.wclick([50, 2, -45]); a.wait(0.4); a.pmfield("Koniklik", 0); a.ok()
        # köşe kapat: sağ flanşın ön uç yüzü
        ends = a.ev("""window.__app.viewer.mesh.faces.filter(f=>f.n&&f.c[1]>8&&Math.abs(f.n[2]-1)<1e-3&&f.c[0]>90&&f.c[2]>-6).map(f=>f.c)""")
        if ends:
            new_sheet(a, "Köşe Kapat"); a.wclick(ends[0]); a.wait(0.4); a.ok()
        names = a.names()
        print("   ağaç:", names, a.errs_map())
        chk("E1 başlangıç: 6 sac özelliği hatasız", not a.errs_map() and len([n for n in names if n != "Eskiz1"]) == 6, (names, a.errs_map()))
        bb0 = a.bbox(); v0 = a.vol(); r0 = flat_dims(a)
        print("   W100:", bb0, v0, r0 and (r0["w"], r0["h"], len(r0["bends"])))
        # --- W 100 → 130
        set_vars(a, {"W": 130})
        bb1 = a.bbox(); errs = a.errs_map(); r1 = flat_dims(a)
        print("   W130:", bb1, a.vol(), errs, r1 and (r1["w"], r1["h"], len(r1["bends"])))
        chk("E1c W 100→130: hata yok", not errs, errs)
        chk("E1c W 130: dış ölçü x 0..130, z −60..0, yükseklik aynı", bb1 and near(bb1[1][0] - bb1[0][0], 130, 0.05) and near(bb1[0][2], bb0[0][2], 0.05) and near(bb1[1][1], bb0[1][1], 0.05), (bb0, bb1))
        sx = a.ev("""(()=>{const m=window.__app.viewer.mesh;return m.faces.filter(f=>f.n&&Math.abs(f.n[0]-1)<1e-3&&f.c[1]>5).map(f=>+f.c[0].toFixed(2))})()""")
        chk("E1c sağ flanş yeni sağ kenarda (taban sağ kenarı)", sx and all(near(x, bb1[1][0], 0.05) for x in sx), (sx, bb1))
        chk("E1c açınım genişliği +30, yüksekliği aynı, büküm sayısı aynı", r0 and r1 and near(r1["w"] - r0["w"], 30, 0.05) and near(r1["h"], r0["h"], 0.05) and len(r1["bends"]) == len(r0["bends"]), (r0 and (r0["w"], r0["h"]), r1 and (r1["w"], r1["h"])))
        # kabartma konumu: SW'de eskiz noktası/konum sabit (yüzde mutlak) → aynı yerde kalmalı
        v1 = a.vol()
        a.reload()
        chk("E1e yenileme sonrası aynı (kalıcı referans kayması yok)", near(a.vol(), v1, 0.01) and a.bbox() == bb1 and not a.errs_map(), (v1, a.vol(), a.errs_map()))
        a.reload()
        chk("E1e ikinci yenileme de aynı", near(a.vol(), v1, 0.01), (v1, a.vol()))
        # --- H 60 → 80
        set_vars(a, {"H": 80})
        bb2 = a.bbox(); errs = a.errs_map(); r2 = flat_dims(a)
        print("   H80:", bb2, a.vol(), errs, r2 and (r2["w"], r2["h"], len(r2["bends"])))
        chk("E1c H 60→80: hata yok, z genişliği +20 (arka kenet yeni arka kenarda)", not errs and bb2 and near((bb2[1][2] - bb2[0][2]) - (bb1[1][2] - bb1[0][2]), 20, 0.06), (bb2, errs))
        chk("E1c H80 açınım yüksekliği +20", r1 and r2 and near(r2["h"] - r1["h"], 20, 0.05), (r1 and r1["h"], r2 and r2["h"]))
        # --- küçült: W 70
        set_vars(a, {"W": 70})
        bb3 = a.bbox(); errs = a.errs_map(); r3 = flat_dims(a)
        print("   W70:", bb3, a.vol(), errs, r3 and (r3["w"], r3["h"], len(r3["bends"])))
        chk("E1c W 130→70: hata yok, x genişliği 70", not errs and bb3 and near(bb3[1][0] - bb3[0][0], 70, 0.05), (bb3, errs))
        chk("E1c W70 H80 açınım = (W100 H60 açınımı) −30 / +20 (yön değişebilir)", r0 and r3 and sorted([round(r3["w"], 2), round(r3["h"], 2)]) == sorted([round(r0["w"] - 30, 2), round(r0["h"] + 20, 2)]), (r0 and (r0["w"], r0["h"]), r3 and (r3["w"], r3["h"])))
        # --- geri al zinciri
        # (yenilemeden sonra geri alma geçmişi yok — SW'de de belge yeniden açılınca geçmiş silinir)
        a.undo(); bu1 = a.bbox()
        a.undo(); bu2 = a.bbox()
        print("   geri al:", bu1, bu2)
        chk("E1d 2× geri al → W130/H80, W130/H60", bu1 == bb2 and bu2 == bb1, (bu1, bu2))
        chk("E1d geri al sonrası hacim W130 hâli", near(a.vol(), v1, 0.01) and not a.errs_map(), (a.vol(), v1, a.errs_map()))
        a.redo(); a.redo()
        chk("E1d 3× ileri al → W70", a.bbox() == bb3, a.bbox())
        # Dosya kaydı
        st = a.stored()
        chk("E1e kayıtta W=70, H=80", st.get("vars", {}).get("W") in ("70", 70) and st.get("vars", {}).get("H") in ("80", 80), st.get("vars"))
    case("E1", e1)

    # tek tek: eskiz değişince kenar flanşı yerine kenar ölçüsü çok değişirse (kalıcı referans imzası)
    def e2():
        a.setup([plate_sk()])
        set_vars(a, {"W": 100, "H": 60})
        a.tact("Eskiz1", "Eskizi düzenle"); a.dim_dbl(0, "=W"); a.dim_dbl(1, "=H"); a.ok()
        sheet_tab(a)
        new_sheet(a, "Taban Flanş", "Eskiz1"); a.ok(); view_iso(a); fit(a)
        # iki kenarda tek flanş (köşe gönyeli)
        new_sheet(a, "Kenar Flanş"); edge_click(a, [50, 2, 0]); edge_click(a, [100, 2, -30]); a.pmfield("Uzunluk", 30); a.ok()
        new_sheet(a, "Köşe Kır (R)")
        # sol arka köşenin kalınlık kenarı izometrikte arkada: arkadan bak (Ctrl+2), yakınlaştır, seç
        a.blur(); a.pg.keyboard.press("Control+2"); time.sleep(0.5); fit(a)
        s = a.wsc([0, 1, -60]); a.pg.mouse.move(s[0], s[1])
        for _ in range(6): a.pg.mouse.wheel(0, 240); time.sleep(0.1)
        edge_click(a, [0, 1, -60])
        print("   köşe kır kenarı:", a.ev("JSON.stringify(window.__app.mode.draft.edges)"))
        a.pmfield("Yarıçap", 8); a.ok(); a.pg.keyboard.press("Control+7"); time.sleep(0.3); fit(a)
        v0 = a.vol(); e0 = a.errs_map(); r0 = flat_dims(a)
        print("   başlangıç:", v0, e0, r0 and (r0["w"], r0["h"], len(r0["bends"]), r0["kinds"]))
        chk("E2 köşe kır R8 sol arka köşede, açınımda yay", not e0 and r0 and "a" in r0["kinds"], (e0, r0 and r0["kinds"]))
        for W, H in ((160, 60), (160, 120), (50, 30)):
            set_vars(a, {"W": W, "H": H})
            bb = a.bbox(); errs = a.errs_map(); r = flat_dims(a)
            print("   W%d H%d:" % (W, H), bb, a.vol(), errs, r and (r["w"], r["h"], len(r["bends"]), r["kinds"]))
            chk("E2c W%d H%d: hata yok, 2 büküm, köşe kır yayı korunur" % (W, H), not errs and r and len(r["bends"]) == 2 and "a" in r["kinds"], (errs, r and (len(r["bends"]), r["kinds"])))
            chk("E2c W%d H%d: dış ölçü" % (W, H), bb and near(bb[1][0] - bb[0][0], W, 0.05) and near(bb[1][2] - bb[0][2], H, 0.05), bb)
    case("E2", e2)

    print("diyaloglar:", a.dlog, "hatalar:", a.errs[:5])
    a.close()
finish()

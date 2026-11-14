# d1 — Çok adımlı kullanıcı iş akışları (masaüstü 6 + telefon 2), yalnız gerçek fare / klavye / dokunma
import sys, math; sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d1_lib import *
PI = math.pi
def wscr(t, w):
    return t.ev("w=>{const s=window.__app.viewer.toScreen(w);const r=window.__app.viewer.renderer.domElement.getBoundingClientRect();return [r.left+s[0],r.top+s[1]]}", w)
def quick_fill(t, vals):
    ins = t.pg.locator(".dim-prompt.quick input")
    for i, v in enumerate(vals):
        if i < ins.count(): ins.nth(i).fill(str(v))
    if ins.count(): ins.nth(ins.count() - 1).press("Enter"); time.sleep(0.4)

with sync_playwright() as p:
    t = T(p)
    # ===== A1: delikli plaka → genişlik değişir → delik konumu ölçüyle korunur → Dosya > Kaydet içeriği → yenile
    print("== A1 delikli plaka")
    t.new_sketch(); t.zoom_to(200)
    t.cmd("Dikdörtgen"); t.mclick(0, 0); t.mclick(60, 40); quick_fill(t, [100, 60])
    t.cmd("Daire"); t.mclick(70, 30); t.mclick(78, 30); quick_fill(t, [20])
    t.smart_dim([(70, 30), (100, 30)], 30, (85, 45))   # merkez → sağ kenar (yatay)
    t.smart_dim([(70, 30), (70, 60)], 30, (55, 45))    # merkez → üst kenar (dikey)
    s = t.st()
    t.chk("A1: dikdörtgen + delik tam tanımlı", s["dof"] == 0, (s["dof"], s["dims"]))
    t.ok_pm(); t.extrude(10)
    v = t.vol()
    t.chk("A1: hacim 100×60×10 − π·10²·10", v and abs(v - (60000 - PI * 1000)) < 2, v)
    t.edit_sketch_of("Ekstrüzyon")
    i = dim_label_idx(t, 100); t.dim_dbl(i, 140)
    t.ok_pm()
    d = [f for f in t.saved()["features"] if f["type"] == "sketch"][0]["data"]
    c = [e for e in d["ents"] if e["t"] == "circle"][0]
    cx = d["pts"][c["c"]]["x"]
    t.chk("A1: genişlik 140 → delik sağ kenardan 30'da (x=110)", abs(cx - 110) < 1e-3, cx)
    v2 = t.vol()
    t.chk("A1: hacim 140×60×10 − delik", v2 and abs(v2 - (84000 - PI * 1000)) < 2, v2)
    # Dosya > Kaydet (dosya erişim API'si olmayan tarayıcı yolu: indirme)
    t.ev("delete window.showSaveFilePicker")  # hazır ortam: Firefox/telefon gibi indirme yoluna zorla
    try:
        with t.pg.expect_download(timeout=8000) as dl:
            t.pg.click("#menubar >> text=Dosya"); time.sleep(0.2)
            t.pg.click("text=KaydetCtrl+S") if t.pg.locator("text=KaydetCtrl+S").count() else t.pg.locator(".menu-drop >> text=Kaydet").first.click()
        path = dl.value.path(); js = json.load(open(path))
        dd = [f for f in js["features"] if f["type"] == "sketch"][0]["data"]
        t.chk("A1: indirilen .icad güncel (140)", any(abs(x["v"] - 140) < 1e-9 for x in dd["dims"]), [x["v"] for x in dd["dims"]])
    except Exception as ex:
        t.chk("A1: Dosya > Kaydet indirme", False, str(ex)[:120])
    t.reload()
    t.chk("A1: yenileme sonrası hacim aynı", abs((t.vol() or 0) - v2) < 1, t.vol())

    # ===== A2: L profil (çizgi zinciri) → ölçüler → ekstrüzyon → ölçü sil + sürükle + eskizde geri al → ✓
    print("== A2 L profil")
    t.fresh(); t.new_sketch(); t.zoom_to(200)
    t.cmd("Çizgi")
    for q in [(0, 0), (60, 0), (60, 10), (10, 10), (10, 40), (0, 40), (0, 0)]:
        t.mclick(*q); t.close_quick()
    s = t.st()
    t.chk("A2: 6 çizgi kapalı", s["ents"] == ["line"] * 6 and not s["drawing"], s)
    t.smart_dim([(30, 0)], 60, (30, -12)); t.smart_dim([(5, 40)], 10, (5, 52))
    t.smart_dim([(60, 5)], 10, (72, 5)); t.smart_dim([(0, 20)], 40, (-12, 20))
    t.chk("A2: 4 ölçü → tam tanımlı", t.st()["dof"] == 0, t.st())
    t.ok_pm(); t.extrude(20)
    v = t.vol()
    t.chk("A2: L hacmi (60·10 + 10·30)·20", v and abs(v - 18000) < 1, v)
    t.edit_sketch_of("Ekstrüzyon")
    i = dim_label_idx(t, 40); t.dim_dbl(i, 50)
    i = dim_label_idx(t, 60); t.dim_dbl(i, 80)
    t.undo()
    t.chk("A2: eskiz içinde Ctrl+Z son ölçüyü (80) geri alır", dim_label_idx(t, 60) is not None and dim_label_idx(t, 50) is not None)
    t.ok_pm()
    v2 = t.vol()
    t.chk("A2: (60·10 + 10·40)·20 = 20000", v2 and abs(v2 - 20000) < 1, v2)

    # ===== A3: model yüzünde kanal → kesme tümünden → kutu ölçüsü değişir → kanal hâlâ üst yüzde
    print("== A3 yüzde kanal")
    t.fresh(); t.new_sketch(); t.zoom_to(200)
    t.cmd("Merkez Dikd."); t.mclick(0, 0); t.mclick(40, 25); quick_fill(t, [80, 50])
    t.ok_pm(); t.extrude(20)
    t.tab("sketch"); t.cmd("Eskiz")
    x, y = wscr(t, [10, 10, 20]); t.pg.mouse.click(x, y); time.sleep(1.2)
    t.chk("A3: üst yüzde eskiz", t.mode() == "sketch")
    t.zoom_to(150)
    t.cmd("Kanal"); t.mclick(-20, 0); t.mclick(20, 0); t.mclick(20, 5); quick_fill(t, [10, 40])
    t.ok_pm()
    t.tab("features"); t.cmd("Ekst. Kesme"); time.sleep(1.0); t.wait()
    f = "#pm-body .pm-field:has-text('Derinlik') input"
    if t.pg.locator(f).count(): t.pg.fill(f, "5"); t.pg.dispatch_event(f, "input"); time.sleep(0.5)
    t.ok_pm()
    v = t.vol()
    exp = 80 * 50 * 20 - (40 * 10 + PI * 25) * 20  # kesme varsayılanı: tümünden geçen
    t.chk("A3: kanal kesme (tümünden geçen)", v and abs(v - exp) < 2, (v, exp))
    t.edit_sketch_of("Ekstrüzyon1")
    t.ok_pm()
    t.tree_click("Ekstrüzyon1"); t.tree_action("Düzenle")
    f = "#pm-body .pm-field:has-text('Derinlik') input"
    t.pg.fill(f, "30"); t.pg.dispatch_event(f, "input"); time.sleep(0.5); t.ok_pm()
    v2 = t.vol()
    t.chk("A3: kutu 30 yüksek → kanal yeni üst yüzde, hata yok", v2 and abs(v2 - (80 * 50 * 30 - (40 * 10 + PI * 25) * 30)) < 2 and not t.tree_errs(), (v2, t.tree_errs()))

    # ===== A4: döndürme: merkez çizgisi + profil → Döndürme → eskiz yarıçapı değişir
    print("== A4 döndürme")
    t.fresh(); t.new_sketch(); t.zoom_to(200)
    t.cmd("Merkez Çiz."); t.mclick(0, -10); t.mclick(0, 50); t.close_quick()
    t.cmd("Dikdörtgen"); t.mclick(0, 0); t.mclick(20, 40); quick_fill(t, [20, 40])
    t.ok_pm()
    t.tab("features"); t.cmd("Döndürme"); time.sleep(1.0); t.wait(); t.ok_pm()
    v = t.vol()
    t.chk("A4: silindir π·20²·40", v and abs(v - PI * 400 * 40) < 5, (v, t.tree_errs()))
    t.edit_sketch_of("Döndürme")
    i = dim_label_idx(t, 20); t.dim_dbl(i, 25); t.ok_pm()
    v2 = t.vol()
    t.chk("A4: R25 → π·625·40", v2 and abs(v2 - PI * 625 * 40) < 5, v2)
    t.undo(); t.wait(); time.sleep(0.5)
    t.chk("A4: Ctrl+Z → R20", abs((t.vol() or 0) - v) < 5, t.vol())

    # ===== A5: metin oyma: kutu → üst yüzde metin → kesme 1 mm → metni değiştir
    print("== A5 metin oyma")
    t.fresh(); t.new_sketch(); t.zoom_to(200)
    t.cmd("Merkez Dikd."); t.mclick(0, 0); t.mclick(40, 20); quick_fill(t, [80, 40])
    t.ok_pm(); t.extrude(10)
    v0 = t.vol()
    t.tab("sketch"); t.cmd("Eskiz")
    x, y = wscr(t, [0, 0, 10]); t.pg.mouse.click(x, y); time.sleep(1.2)
    t.zoom_to(150)
    t.cmd("Metin")
    tf = "#pm-body .pm-field:has-text('Metin') input"
    t.pg.fill(tf, "AB"); t.pg.dispatch_event(tf, "input"); t.pg.dispatch_event(tf, "change")
    t.mclick(-20, -5)
    t.ok_pm()
    t.tab("features"); t.cmd("Ekst. Kesme"); time.sleep(1.0); t.wait()
    f = "#pm-body .pm-field:has-text('Derinlik') input"
    if t.pg.locator(f).count(): t.pg.fill(f, "1"); t.pg.dispatch_event(f, "input"); time.sleep(0.5)
    t.ok_pm()
    v1 = t.vol()
    t.chk("A5: metin oyması hacmi azaltır", v1 and v0 - 2000 < v1 < v0 - 5, (v0, v1, t.tree_errs()))
    t.edit_sketch_of("Ekst. Kesme") if t.pg.locator("#tree li:has-text('Ekst. Kesme')").count() else t.edit_sketch_of("Kesme")
    t.mclick(-17, -1)
    loc = t.pg.locator("#pm-body .pm-field:has-text('Metin') input")
    if loc.count():
        loc.first.fill("ABCDE"); t.pg.dispatch_event("#pm-body .pm-field:has-text('Metin') input", "change"); time.sleep(0.3)
    t.ok_pm()
    v2 = t.vol()
    t.chk("A5: metin ABCDE → daha çok oyma", v2 and v2 < v1 - 5, (v1, v2))

    # ===== A6: kapalı spline profil → ekstrüzyon → nokta sürükle → eskizde Ctrl+Z → ✓ → model = ilk
    print("== A6 spline")
    t.fresh(); t.new_sketch(); t.zoom_to(200)
    t.cmd("Spline")
    for q in [(-30, 0), (0, 25), (30, 0), (0, -25)]: t.mclick(*q)
    t.mclick(-30, 0)
    t.ok_pm(); t.extrude(10)
    v = t.vol()
    t.edit_sketch_of("Ekstrüzyon"); t.cmd("Seç")
    t.drag(0, 25, 0, 40)
    t.undo()
    t.ok_pm()
    t.chk("A6: sürükle + eskizde geri al + ✓ → hacim değişmez", abs((t.vol() or 0) - v) < 1, (v, t.vol()))
    t.edit_sketch_of("Ekstrüzyon"); t.cmd("Seç"); t.drag(0, 25, 0, 40); t.ok_pm()
    v2 = t.vol()
    t.chk("A6: sürükle + ✓ → hacim artar", v2 and v2 > v + 100, (v, v2))
    t.end(); ok1 = t.ok

    # ===== telefonda iki akış
    t = T(p, mobile=True)
    print("== M1 telefon: delikli plaka")
    t.new_sketch("Ön Düzlem")
    t.chk("M1 öncesi: (bilgi) dokunma hayalet tıklaması ölçü kutusunun 🎤 düğmesine gidebilir — bkz. d1_mobil", True)
    t.cmd("Dikdörtgen"); t.pick(0, 0); t.pick(50, 30); quick_fill(t, [60, 40])
    t.cmd("Daire"); t.pick(45, 30); t.pick(45, 18); quick_fill(t, [10])
    t.ok_pm(); t.extrude(5)
    v = t.vol()
    t.chk("M1: hacim 60·40·5 − π·25·5", v and abs(v - (12000 - PI * 125)) < 2, v)
    t.edit_sketch_of("Ekstrüzyon")
    i = dim_label_idx(t, 10); t.dim_dbl(i, 16); t.ok_pm()
    v2 = t.vol()
    t.chk("M1: delik Ø16", v2 and abs(v2 - (12000 - PI * 320)) < 2, v2)
    t.reload()
    t.chk("M1: yenileme sonrası Ø16", abs((t.vol() or 0) - v2) < 1, t.vol())

    print("== M2 telefon: serbest çizim → ölçü → ekstrüzyon → geri al / ileri al")
    t.fresh(); t.new_sketch("Ön Düzlem")
    t.cmd("Serbest Çizim")
    corners = [(0, 0), (50, 0), (50, 30), (0, 30), (0, 0)]
    O = t.OFF
    a = t.sc(*corners[0]); t.touch("touchStart", [(a[0], a[1] + O)])
    for k in range(4):
        A, B = corners[k], corners[k + 1]
        for j in range(1, 13):
            u = j / 12; q = t.sc(A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u); t.touch("touchMove", [(q[0], q[1] + O)]); time.sleep(0.01)
    time.sleep(0.8); t.touch("touchEnd", []); time.sleep(0.5); t.close_quick()
    t.cmd("Akıllı Ölçü"); t.smart_dim([(25, 0)], 60, (25, -15)); t.smart_dim([(0, 8)], 40, (15, 15))  # v0.89: sol kenar (sağ kenar ekran çubuğunun altında), ortası değil
    s = t.st()
    t.chk("M2: serbest dikdörtgen + 2 ölçü → tam tanımlı", s["dof"] == 0, s)
    t.ok_pm(); t.extrude(10)
    v = t.vol()
    t.chk("M2: 24000", v and abs(v - 24000) < 1, v)
    t.undo(); t.wait(); time.sleep(0.5)
    t.chk("M2: ↶ ekstrüzyonu geri alır", [x[1] for x in t.feats()] == ["sketch"], t.feats())
    t.redo(); t.wait(); time.sleep(0.5)
    t.chk("M2: ↷ geri getirir", abs((t.vol() or 0) - 24000) < 1, t.vol())
    t.end()
    print('GENEL SONUC:', 'TAMAM' if (ok1 and t.ok) else 'HATA')

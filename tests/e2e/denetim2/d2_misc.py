# d2: Yapı geometrisi, Sil, Kopyala / Yapıştır (Ctrl+C/V/X), pencere / kesişen / Ctrl seçim, Ayır, Eskizi Onar,
#     Tam Tanımla, İlişkiler göster, Eskiz düzlemini değiştir, Türetilmiş eskiz
from d2h import *
import math


def circles(A):
    return A.ed("return d.ents.filter(x=>x.t==='circle').map(z=>{const p=d.pts[z.c];return [+p.x.toFixed(2),+p.y.toFixed(2),+z.r.toFixed(2), !!z.cons]})")


def hp():
    def b(pt, line, rect, c, t):
        rect(-40, -30, 40, 30)
        c(-20, 0, 5)  # c9/p10
        c(20, 0, 5)   # c11/p12
    sk = sketch("s1", "Eskiz1", TOP, b); rect_dims(sk, 80, 60)
    return [sk, ext("e1", "s1", 10)]


H = math.pi * 25 * 10
with sync_playwright() as p:
    A = App(p)
    A.pg.on("dialog", lambda d: d.accept())
    # ===== Yapı geometrisi =====
    A.setup(hp())
    A.edit_sketch_of("e1")
    A.clk(-15, 0)
    A.cmd("Yapı Geom.")
    chk("daire yapı geometrisi oldu", circles(A)[0][3] is True, circles(A))
    A.press("Control+z"); chk("Ctrl+Z → normal", circles(A)[0][3] is False, circles(A))
    A.press("Control+y"); chk("Ctrl+Y → yapı", circles(A)[0][3] is True)
    A.ok()
    chk("✓ → tek delik", abs(A.vol() - (48000 - H)) < 1, A.vol())
    A.reload(); chk("yenile → tek delik", abs(A.vol() - (48000 - H)) < 1, A.vol())
    # ===== Sil (Delete tuşu + şerit) =====
    A.edit_sketch_of("e1")
    A.clk(25, 0); A.press("Delete")
    chk("Delete → daire silindi", len(circles(A)) == 1, circles(A))
    A.press("Control+z"); chk("Ctrl+Z → geri", len(circles(A)) == 2)
    A.clk(25, 0); A.cmd("Sil")
    chk("şerit Sil → silindi", len(circles(A)) == 1)
    # ölçülü kenarı sil: ölçü de silinir mi
    A.clk(0, -30); A.press("Delete")
    i = A.skinfo(); print("alt kenar silindi", i)
    chk("ölçülü kenar silinince bağlı ölçü kalkar, eskiz çözülür", i["ok"] and i["conf"] == 0, i)
    A.cancel("discard")
    chk("Kaydetmeden çık → değişmez", abs(A.vol() - (48000 - H)) < 1, A.vol())

    # ===== Seçim: pencere / kesişen / Ctrl =====
    A.setup(hp())
    A.edit_sketch_of("e1")
    A.drag(A.sc(-30, 10), A.sc(-10, -10), 8)
    chk("pencere (soldan sağa) yalnız tam içeridekini seçer", A.ed("return [...e.sel].sort().join()") == "c9", A.ed("return [...e.sel]"))
    A.drag(A.sc(-10, 10), A.sc(-45, -10), 8)
    s = A.ed("return [...e.sel].sort()"); print("kesişen", s)
    chk("kesişen (sağdan sola) dokunanları seçer (daire + sol kenar)", "c9" in s and "l8" in s, s)
    A.clk(25, 0); A.clk(-15, 0, mods=("Control",))
    chk("Ctrl+tık ekler", A.ed("return e.sel.size") == 2, A.ed("return [...e.sel]"))
    A.clk(-15, 0, mods=("Control",))
    chk("Ctrl+tık çıkarır", A.ed("return e.sel.size") == 1)
    A.press("Control+a")
    chk("Ctrl+A tümünü seçer", A.ed("return e.sel.size") >= 6, A.ed("return e.sel.size"))
    A.press("Escape")

    # ===== Kopyala / Yapıştır / Kes =====
    A.clk(25, 0)
    A.press("Control+c")
    A.pg.mouse.move(*A.sc(0, 15)); time.sleep(0.2)
    A.press("Control+v")
    cs = circles(A); print("yapıştır", cs)
    chk("Ctrl+V → imleçte 3. daire", len(cs) == 3 and any(abs(c[0]) < 1 and abs(c[1] - 15) < 1 for c in cs), cs)
    A.press("Control+z"); chk("yapıştırma geri alınır", len(circles(A)) == 2)
    A.press("Control+y")
    A.clk(25, 0); A.press("Control+x")
    print("BILGI Ctrl+X sonrası daire sayısı", len(circles(A)), "(SolidWorks: Kes → 2)")
    chk("Ctrl+X (kes) çalışır", len(circles(A)) == 2, circles(A))
    A.ok()
    print("kopyala/yapıştır sonrası hacim", A.vol())
    # eskizler arası kopyala: Eskiz1'de Ctrl+C, Eskiz2'de Ctrl+V
    A.setup(hp() + [sketch("s2", "Eskiz2", FRONT, lambda pt, line, rect, c, t: c(0, 30, 5))])
    A.edit_sketch_of("e1"); A.clk(25, 0); A.press("Control+c"); A.ok()
    A.show_tree(); A.btn("#tree li:has-text('Eskiz2')"); A.btn("#tree-actions button:has-text('Düzenle')"); A.wait(0.4)
    A.pg.mouse.move(*A.sc(20, 20)); A.press("Control+v")
    chk("başka eskize yapıştır (SolidWorks'te olur)", len(circles(A)) == 2, (circles(A), A.toast()))
    A.cancel("discard")

    # ===== Ayır =====
    A.setup(plate(80, 60, 10))
    A.edit_sketch_of("e1")
    A.cmd("Ayır"); A.clk(0, 30)
    i = A.skinfo(); print("ayır", i)
    chk("Ayır: üst kenar ikiye → 5 çizgi", i["ents"] == 5, i["types"])
    A.press("Control+z"); chk("Ayır geri alınır", A.skinfo()["ents"] == 4)
    A.press("Control+y")
    A.ok()
    chk("ayırma sonrası model aynı (48000)", abs(A.vol() - 48000) < 1, (A.vol(), A.errtree()))
    # ayrılan iki parçanın birini sürükle → parçalar uç uca kalmalı
    A.edit_sketch_of("e1")
    x, y = A.sc(20, 30); A.drag((x, y), (x, y - 40), 8)
    i = A.skinfo(); print("ayrılmış kenarı sürükle", i)
    A.ok()
    print("BILGI ayrılmış kenar sürüklendi → hacim", A.vol(), A.errtree())

    # ===== Eskizi Onar =====
    def dup(pt, line, rect, c, t):
        rect(-40, -30, 40, 30)
        line("p1", "p2")  # tekrarlı alt kenar
    A.setup([sketch("s1", "Eskiz1", TOP, dup), ext("e1", "s1", 10)])
    print("tekrarlı kenarla model hata:", A.errtree())
    A.edit_sketch_of("e1")
    A.cmd("Eskizi Onar")
    i = A.skinfo(); print("onar", i, A.toast())
    chk("Eskizi Onar tekrarlı çizgiyi siler", i["ents"] == 4, i)
    A.ok()
    chk("onarım sonrası model 48000", abs((A.vol() or 0) - 48000) < 1, (A.vol(), A.errtree()))

    # ===== Tam Tanımla + İlişkiler göster =====
    A.setup(plate(80, 60, 10, dims=False))
    A.edit_sketch_of("e1")
    A.cmd("Tam Tanımla")
    i = A.skinfo(); print("tam tanımla", i)
    chk("Tam Tanımla → serbestlik 0", i["dof"] == 0, i)
    A.ok(); chk("✓ → model aynı", abs(A.vol() - 48000) < 1)
    A.edit_sketch_of("e1")
    n0 = A.pg.locator(".rel, .sk-rel, .rel-tag").count()
    A.cmd("İlişkiler")
    n1 = A.pg.locator(".rel, .sk-rel, .rel-tag").count()
    print("BILGI İlişkiler aç/kapa: etiket sayısı", n0, "→", n1, A.ed("return e.opts.showRels"))
    A.cancel("discard")

    # ===== Eskiz düzlemini değiştir =====
    A.setup(hp())
    A.show_tree(); A.btn("#tree li:has-text('Eskiz1')")
    A.btn("#tree-actions button:has-text('Eskiz düzlemini değiştir')"); time.sleep(0.4)
    chk("düzlem seçme modu", A.mode() == "pickSketchPlane", A.mode())
    # grafik alanda Ön düzleme tıkla (düzlem görünür olmalı) — düzlem karesinin köşesine yakın
    # v0.90: D2-3 — eskizin kendi alt özelliğinin yüzü reddedilir; E-15 — ağaçtaki düzleme tıklanabilir
    x, y = A.wsc([0, 10, 0]); A.click(x, y); time.sleep(0.6)
    chk("D2-3: kendi ekstrüzyonunun üst yüzü reddedilir", A.mode() == "pickSketchPlane" and A.feat("s1")["plane"].get("n") == "top", (A.mode(), A.feat("s1")["plane"], A.toast()))
    A.btn("#tree li:has-text('Ön Düzlem')"); time.sleep(0.6)
    print("düzlem değiştir sonrası", A.mode(), A.feat("s1")["plane"], A.size(), A.errtree())
    chk("eskiz Ön düzleme taşındı → ekstrüzyon Z yönünde", A.feat("s1")["plane"].get("n") == "front" and A.size() and abs(A.size()[2] - 10) < 0.01, (A.feat("s1")["plane"], A.size()))
    A.press("Control+z"); A.wait(0.8)
    chk("Ctrl+Z → Üst düzlem", A.feat("s1")["plane"].get("n") == "top", A.feat("s1")["plane"])

    # ===== Türetilmiş eskiz =====
    A.setup(hp())
    A.show_tree(); A.btn("#tree li:has-text('Eskiz1')")
    A.btn("#tree-actions button:has-text('Türetilmiş eskiz')"); time.sleep(0.4)
    x, y = A.wsc([0, 10, 0]); A.click(x, y); time.sleep(0.6)   # üst yüz
    fs = A.ev("window.__app.doc.features.map(f=>f.type+':'+f.name)"); print("türetilmiş", fs, A.toast())
    chk("türetilmiş eskiz eklendi", len(fs) == 3, fs)
    A.press("Control+z"); A.wait(0.6)
    chk("Ctrl+Z → kalkar", len(A.ev("window.__app.doc.features")) == 2)
    print("Konsol:", A.errs)
    chk("konsol hatası yok", not A.errs, A.errs)
    A.close()
finish()

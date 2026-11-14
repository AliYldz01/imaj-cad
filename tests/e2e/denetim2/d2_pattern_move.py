# d2: eskiz doğrusal / dairesel çoğaltma (örnek atla) ve Taşı / Kopyala / Döndür / Ölçekle / Esnet
from d2h import *
import math

R = 5
A_HOLE = math.pi * R * R * 10


def holeplate(cx, cy, r=R, dims=True):
    def b(pt, line, rect, c, t):
        rect(-40, -30, 40, 30)
        c(cx, cy, r)       # p9, c10
    sk = sketch("s1", "Eskiz1", TOP, b)
    if dims:
        rect_dims(sk, 80, 60)
    return [sk, ext("e1", "s1", 10)]


def winsel(A, x0, y0, x1, y1):
    A.drag(A.sc(x0, y0), A.sc(x1, y1), 10)


def circles(A):
    return A.ed("return d.ents.filter(x=>x.t==='circle').map(z=>{const p=d.pts[z.c];return [+p.x.toFixed(2),+p.y.toFixed(2),+z.r.toFixed(2)]})")


with sync_playwright() as p:
    A = App(p)
    # ================= DOĞRUSAL ÇOĞALTMA =================
    A.setup(holeplate(-25, -15))
    v1 = A.vol(); print("tek delik", v1)
    A.edit_sketch_of("e1")
    A.clk(-25 + R, -15)
    A.cmd("Doğrusal Çoğ.")
    chk("seçim korunur", A.ed("return e.sel.size") == 1)
    A.pmfield("Adet", 3)
    A.pmfield("Aralık", 25)
    # Yön 2 alanları ikinci "Adet" / "Aralık" / "Açı"
    A.pg.locator("#pm-body label.pm-field:has-text('Adet') input").nth(1).fill("2")
    A.pg.locator("#pm-body label.pm-field:has-text('Aralık') input").nth(1).fill("30")
    A.pg.locator("#pm-body label.pm-field:has-text('Açı') input").nth(1).fill("90"); time.sleep(0.2)
    A.pmbtn("Uygula")
    cs = circles(A); print("doğrusal çoğaltma", cs)
    chk("doğrusal 3×2 = 6 daire", len(cs) == 6, cs)
    A.ok()
    chk("✓ → 6 delik", abs(A.vol() - (48000 - 6 * A_HOLE)) < 1, A.vol())
    # tohum dairenin çapını değiştir → örnekler izler mi (E-23)
    A.edit_sketch_of("e1")
    x, y = A.sc(-25 + R, -15)
    A.drag((x, y), (x + 20, y), 8)
    cs = circles(A); print("tohum büyütüldü", cs)
    chk("tohum yarıçapı değişince örnekler izler (E-23 hâlâ?)", len(set(c[2] for c in cs)) == 1, cs)
    A.cancel("discard")
    chk("Kaydetmeden çık → 6 R5 delik", abs(A.vol() - (48000 - 6 * A_HOLE)) < 1, A.vol())
    # örnek atla
    A.setup(holeplate(-25, -15))
    A.edit_sketch_of("e1")
    A.clk(-25 + R, -15)
    A.cmd("Doğrusal Çoğ.")
    A.pmfield("Adet", 3); A.pmfield("Aralık", 25)
    A.pg.locator("#pm-body label.pm-field:has-text('Atlanacak') input").fill("2"); A.pg.locator("#pm-body label.pm-field:has-text('Atlanacak') input").press("Tab"); time.sleep(0.2)
    A.pmbtn("Uygula")
    cs = circles(A); print("atla 2", cs)
    chk("örnek atla '2' → 2 daire (x -25, 25)", sorted(c[0] for c in cs) == [-25, 25], cs)
    A.ok()
    chk("✓ → 2 delik", abs(A.vol() - (48000 - 2 * A_HOLE)) < 1, A.vol())
    A.press("Control+z"); A.wait(0.8)
    chk("Ctrl+Z → 1 delik", abs(A.vol() - v1) < 1, A.vol())
    A.press("Control+y"); A.wait(0.8)
    A.reload()
    chk("yenile → 2 delik", abs(A.vol() - (48000 - 2 * A_HOLE)) < 1, A.vol())

    # ================= DAİRESEL ÇOĞALTMA =================
    A.setup(holeplate(20, 0, 4))
    A.edit_sketch_of("e1")
    A.clk(24, 0)
    A.cmd("Dairesel Çoğ.")
    A.pmfield("Adet", 6); A.pmfield("Toplam açı", 360)
    t = A.pg.locator("#pm-body label.pm-field:has-text('Atlanacak') input"); t.fill("3"); t.press("Tab"); time.sleep(0.2)
    A.pmbtn("Uygula")
    cs = circles(A); print("dairesel", cs)
    chk("dairesel 6, 3. atlandı → 5 daire R20 çemberde", len(cs) == 5 and all(abs(math.hypot(c[0], c[1]) - 20) < 0.01 for c in cs), cs)
    A.ok()
    chk("✓ → 5 delik", abs(A.vol() - (48000 - 5 * math.pi * 16 * 10)) < 1, A.vol())
    # merkez olarak seçili nokta: dikdörtgen köşesi
    A.setup(holeplate(20, 0, 4))
    A.edit_sketch_of("e1")
    A.clk(24, 0)
    A.clk(-40, -30, mods=("Control",)) if False else None
    A.cmd("Dairesel Çoğ.")
    A.clk(-40, -30)  # Dairesel aracında köşe noktasına tıkla (seçime eklenir)
    sel = A.ed("return [...e.sel]"); print("seçim", sel)
    A.pmfield("Adet", 4); A.pmfield("Toplam açı", 90)
    A.pmbtn("Uygula")
    cs = circles(A); print("köşe merkezli", cs)
    chk("seçili köşe merkez alınır (hepsi köşeden eşit uzaklıkta)", len(cs) == 4 and len(set(round(math.hypot(c[0] + 40, c[1] + 30), 2) for c in cs)) == 1, cs)
    A.cancel("discard")

    # ================= TAŞI / KOPYALA =================
    A.setup(holeplate(20, 0, 4))
    v0 = A.vol()
    A.edit_sketch_of("e1")
    A.clk(24, 0)
    A.cmd("Taşı")
    A.pmfield("X öteleme", 5); A.pmfield("Y öteleme", 10)
    A.pmbtn("Uygula")
    cs = circles(A); chk("Taşı → (25,10)", cs == [[25, 10, 4]], cs)
    A.press("Control+z"); chk("eskiz Ctrl+Z → (20,0)", circles(A) == [[20, 0, 4]], circles(A))
    A.press("Control+y"); chk("eskiz Ctrl+Y → (25,10)", circles(A) == [[25, 10, 4]], circles(A))
    A.ok()
    chk("✓ → hacim aynı, kayıtta (25,10)", abs(A.vol() - v0) < 1 and A.saved_feat("s1")["data"]["pts"]["p10"] == {"x": 25, "y": 10}, A.saved_feat("s1")["data"]["pts"]["p10"])
    A.reload()
    A.edit_sketch_of("e1")
    chk("yenile → eskizde (25,10)", circles(A) == [[25, 10, 4]], circles(A))
    A.clk(29, 10)
    A.cmd("Kopyala")
    A.pmfield("X öteleme", -50); A.pmfield("Y öteleme", 0)
    A.pmbtn("Uygula")
    chk("Kopyala → 2 daire", len(circles(A)) == 2, circles(A))
    A.ok()
    chk("✓ → 2 delik", abs(A.vol() - (48000 - 2 * math.pi * 160)) < 1, A.vol())

    # ================= DÖNDÜR (ölçülü / ilişkili dikdörtgen) =================
    A.setup(plate(80, 60, 10))
    A.edit_sketch_of("e1")
    A.drag(A.sc(-50, 45), A.sc(50, -45), 10)
    A.cmd("Döndür")
    A.pmfield("Döndürme açısı", 90)
    A.pmbtn("Uygula")
    i = A.skinfo(); print("döndür (ilişkili)", i, A.toast())
    A.ok()
    print("döndür sonrası boyut", A.size())
    chk("ilişkili dikdörtgen döndürülür ya da açık uyarı verilir", (A.size() and abs(A.size()[0] - 60) < 0.01) or "aşırı" in A.toast() or "çözül" in A.toast(), (A.size(), A.toast()))
    # ölçüsüz
    A.setup(plate(80, 60, 10, dims=False))
    A.edit_sketch_of("e1")
    A.drag(A.sc(-50, 45), A.sc(50, -45), 10)
    A.cmd("Döndür"); A.pmfield("Döndürme açısı", 90); A.pmbtn("Uygula")
    A.ok()
    chk("ölçüsüz dikdörtgen 90° → 60 × 80", A.size() and abs(A.size()[0] - 60) < 0.01 and abs(A.size()[2] - 80) < 0.01, A.size())

    # ================= ÖLÇEKLE =================
    A.setup(plate(80, 60, 10, dims=False))
    A.edit_sketch_of("e1")
    A.drag(A.sc(-50, 45), A.sc(50, -45), 10)
    A.cmd("Ölçekle"); A.pmfield("Ölçek", 0.5); A.pmbtn("Uygula")
    A.ok()
    chk("ölçek 0.5 → 40 × 30", A.size() and abs(A.size()[0] - 40) < 0.01, A.size())
    # ölçülü dikdörtgende ölçekle: SolidWorks ölçüleri de ölçekler (ya da uyarır)
    A.setup(plate(80, 60, 10))
    A.edit_sketch_of("e1")
    A.drag(A.sc(-50, 45), A.sc(50, -45), 10)
    A.cmd("Ölçekle"); A.pmfield("Ölçek", 0.5); A.pmbtn("Uygula")
    i = A.skinfo(); print("ölçülü ölçekle", i, A.toast())
    A.ok()
    print("ölçülü ölçekle boyut", A.size())
    chk("ölçülü dikdörtgende Ölçekle: sonuç 40 genişlik ya da açık uyarı", (A.size() and abs(A.size()[0] - 40) < 0.01) or A.toast(), (A.size(), A.toast()))

    # ================= ESNET =================
    A.setup(plate(80, 60, 10, dims=False))
    A.edit_sketch_of("e1")
    A.drag(A.sc(30, 40), A.sc(50, -40), 10)   # sağ kenar (iki köşe) pencere
    print("esnet seçim", A.ed("return [...e.sel]"))
    A.cmd("Esnet"); A.pmfield("X öteleme", 20); A.pmfield("Y öteleme", 0); A.pmbtn("Uygula")
    A.ok()
    chk("esnet → 100 × 60", A.size() and abs(A.size()[0] - 100) < 0.01 and abs(A.size()[2] - 60) < 0.01, A.size())
    # esnet ölçülü: genişlik ölçüsü 80 iken → ölçü engel olur (SolidWorks ölçüyü korur, esnetmez/uyarı)
    A.setup(plate(80, 60, 10))
    A.edit_sketch_of("e1")
    A.drag(A.sc(30, 40), A.sc(50, -40), 10)
    A.cmd("Esnet"); A.pmfield("X öteleme", 20); A.pmbtn("Uygula")
    i = A.skinfo(); print("ölçülü esnet", i, A.toast())
    A.ok()
    print("ölçülü esnet boyut", A.size())
    print("Konsol:", A.errs)
    chk("konsol hatası yok", not A.errs, A.errs)
    A.close()
finish()

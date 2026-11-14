# d2: telefonda (390×844, CDP parmak) eskiz düzenleme araçları — Kırp, Uzat, Radyüs, Pah, Ayır, Ötele, Aynala,
#     Doğrusal Çoğ., Taşı, Yapı Geom., Sil + ✓ / ✕ / ↶
from d2h import *
import math

OFF = 70  # parmakla çizimde imleç kayması (prefs.cursorOffset)


def model(pt, line, rect, c, t):
    rect(-40, -30, 40, 30)
    a, b = pt(20, -45), pt(20, 45); line(a, b)   # l11
    c(-20, 0, 10)                                # c12 / p13
    c(0, 18, 3)                                  # c14 / p15 (küçük: seçim denemesi)


def tap_tool(A, x, y, direct_first=False, probe=None):
    """araçta dokunma: önce doğrudan (bilgi), sonra imleç kaymasına göre"""
    sx, sy = A.sc(x, y)
    if direct_first:
        before = probe()
        A.tap(sx, sy)
        after = probe()
        return before != after
    A.tap(sx, sy + OFF)


with sync_playwright() as p:
    A = App(p, mobile=True)
    A.setup([sketch("s1", "Eskiz1", TOP, model), ext("e1", "s1", 10)])
    A.edit_sketch_of("e1")
    chk("telefonda eskiz açıldı", A.mode() == "sketch")
    st = lambda: json.dumps(A.ed("return [d.ents.length, JSON.stringify(d.pts)]"))
    # ---- Kırp ----
    A.cmd("Kırp")
    hit = tap_tool(A, 20, 40, True, st)
    chk("Kırp: çizgiye doğrudan dokunmak kırpar (parmak altındaki öğe)", hit, A.lineyx("l11"))
    if not hit:
        tap_tool(A, 20, 40)
    tap_tool(A, 20, -40)
    chk("Kırp (imleç kaymasıyla) taşan uçlar kırpıldı", sorted(q[1] for q in A.lineyx("l11")) == [-30, 30], A.lineyx("l11"))
    # ↶ düğmesi
    A.btn("#undo")
    chk("↶ (ekran) eskizde geri alır", max(q[1] for q in A.lineyx("l11")) == 45 or min(q[1] for q in A.lineyx("l11")) == -45, A.lineyx("l11"))
    A.btn("#redo")
    # ---- Eskiz Radyüs ----
    A.cmd("Eskiz Radyüs"); A.pmfield("Yarıçap", 6)
    hit = tap_tool(A, -40, 30, True, st)
    chk("Radyüs: köşeye doğrudan dokunmak radyüs yapar", hit)
    if not hit:
        tap_tool(A, -40, 30)
    chk("Radyüs (kaymayla) yay eklendi", "arc" in A.skinfo()["types"], A.skinfo()["types"])
    # ---- Eskiz Pahı ----
    A.cmd("Eskiz Pahı"); A.pmfield("Mesafe", 4)
    tap_tool(A, -40, -30)
    n_lines = A.skinfo()["types"].count("line")
    chk("Pah eklendi (çizgi sayısı arttı)", n_lines >= 6, A.skinfo()["types"])
    # ---- Ayır ----
    A.cmd("Ayır")
    before = A.skinfo()["ents"]
    tap_tool(A, 0, -30)
    chk("Ayır: alt kenar bölündü", A.skinfo()["ents"] == before + 1, A.skinfo()["ents"])
    # ---- Uzat: önce kısa bir çizgi (sayı ile değil: hazır modelde yok) → l11'i kırpılmış hâlden uzatmak yerine sağ kenarı dene
    A.cmd("Uzat")
    # Seç ile daire seç → Yapı Geom.
    A.cmd("Seç")
    x, y = A.sc(3, 18); A.tap(x, y)
    chk("Seç: R3 dairenin çevresine dokunma daireyi seçer (merkez noktası değil)", A.ed("return [...e.sel].join()") == "c14", A.ed("return [...e.sel]"))
    A.press("Escape") if False else None
    x, y = A.sc(3, 18); A.tap(x, y)  # seçimi kaldır (dokunuş ekle/çıkar)
    x, y = A.sc(-10, 0); A.tap(x, y)
    chk("Seç: R10 dairenin çevresine dokunma daireyi seçer", A.ed("return [...e.sel].join()") == "c12", A.ed("return [...e.sel]"))
    A.cmd("Yapı Geom.")
    chk("Yapı Geom. → daire yapı", A.ed("return d.ents.find(x=>x.id==='c12').cons") is True)
    A.btn("#undo")
    chk("↶ → normal", not A.ed("return d.ents.find(x=>x.id==='c12').cons"))
    # ---- Aynala: daire + merkez yok → l11 (x=20) eksen olarak ----
    x, y = A.sc(-10, 0); A.tap(x, y)
    x, y = A.sc(20, 10); A.tap(x, y)
    chk("iki dokunuşla daire + çizgi seçili", A.ed("return e.sel.size") == 2, A.ed("return [...e.sel]"))
    A.cmd("Aynala"); A.pmbtn("Uygula")
    cs = A.ed("return d.ents.filter(x=>x.t==='circle').map(z=>{const p=d.pts[z.c];return [+p.x.toFixed(2),+p.y.toFixed(2)]})")
    chk("Aynala → (60,0)'da daire", [60, 0] in cs, cs)
    A.btn("#undo")
    # ---- Doğrusal Çoğ. ----
    A.cmd("Seç"); x, y = A.sc(-10, 0); A.tap(x, y)
    A.cmd("Doğrusal Çoğ."); A.pmfield("Adet", 2); A.pmfield("Aralık", 15); A.pmbtn("Uygula")
    cs = A.ed("return d.ents.filter(x=>x.t==='circle').length")
    chk("Doğrusal Çoğ. → +1 daire (3)", cs == 3, cs)
    # ---- Taşı ----
    A.cmd("Seç"); x, y = A.sc(-20, -10); A.tap(x, y)
    print("taşı seçimi", A.ed("return [...e.sel]"), A.ed("return e.tool"))
    A.cmd("Taşı"); print("taşı aracında seçim", A.ed("return [...e.sel]")); A.pmfield("X öteleme", 0); A.pmfield("Y öteleme", 10); A.pmbtn("Uygula")
    cs = A.ed("return d.ents.filter(x=>x.t==='circle').map(z=>{const p=d.pts[z.c];return [+p.x.toFixed(2),+p.y.toFixed(2)]})")
    chk("Taşı → (-20,10)", [-20, 10] in cs, cs)
    A.btn("#undo")
    # ---- Ötele (kırpılmış dikdörtgende değil; tek daire) ----
    A.cmd("Seç"); x, y = A.sc(-10, 10); A.tap(x, y)
    A.cmd("Ötele"); A.pmfield("Mesafe", 2); A.pmbtn("Uygula")
    print("ötele sonrası", A.skinfo())
    # ---- Sil ----
    A.cmd("Seç"); x, y = A.sc(-8, 10); A.tap(x, y)
    print("sil seçimi", A.ed("return [...e.sel]"))
    nb = A.skinfo()["ents"]
    A.cmd("Sil")
    chk("Sil → bir öğe eksildi", A.skinfo()["ents"] == nb - 1, (nb, A.skinfo()["ents"]))
    i = A.skinfo(); print("telefon eskiz sonu", i)
    # sağ kesimi temizle: l11 sağındaki parçaları kırp → kapalı profil
    A.cmd("Kırp")
    for q in [(30, 30), (30, -30), (40, 0)]:
        tap_tool(A, *q)
    i = A.skinfo(); print("sağ bölge kırpıldı", i)
    A.btn("#pm-ok"); A.wait(0.8)
    v = A.vol(); print("telefon ✓ hacim", v, A.errtree())
    chk("telefonda ✓ → model güncellendi (60 genişlik)", A.size() and abs(A.size()[0] - 60) < 0.01, (A.size(), A.errtree()))
    A.reload()
    chk("telefon yenile → aynı", A.size() and abs(A.size()[0] - 60) < 0.01, A.size())
    # ✕ → Kaydetmeden çık
    v1 = A.vol()
    A.edit_sketch_of("e1")
    A.cmd("Eskiz Radyüs"); A.pmfield("Yarıçap", 3); tap_tool(A, 20, 30)
    A.cancel("discard")
    chk("telefon ✕ Kaydetmeden çık → değişmez", A.vol() == v1, (A.vol(), v1))
    print("Konsol:", A.errs)
    chk("konsol hatası yok", not A.errs, A.errs)
    A.close()
finish()

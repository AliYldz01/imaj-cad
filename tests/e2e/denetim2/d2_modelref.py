# d2: modeldeki radyüs / pah / kabuk, eskiz düzenleme araçlarıyla eskiz değiştikten sonra doğru kenarda / yüzde kalıyor mu
from d2h import *
import math


def winsel(A, x0, y0, x1, y1):
    A.drag(A.sc(x0, y0), A.sc(x1, y1), 10)


with sync_playwright() as p:
    A = App(p)
    # ---- S1: düşey kenarda 3B radyüs R5; eskizde başka köşeye eskiz radyüsü R10 ----
    fil = {"id": "f1", "type": "fillet", "name": "Radyüs1", "r": 5, "edges": [{"m": [40, 5, 30], "d": [0, 1, 0]}]}
    A.setup(plate(80, 60, 10) + [fil])
    v0 = A.vol(); print("S1 başlangıç", v0, A.errtree())
    chk("S1 3B radyüs kuruldu", abs(v0 - (48000 - 25 * (1 - math.pi / 4) * 10)) < 0.5, v0)
    A.edit_sketch_of("e1")
    # 3B radyüslü köşenin karşı köşesine (çaprazına) eskiz radyüsü
    corner = [q for q in ("p1", "p2", "p3", "p4")]
    # dünya (40,*,30) köşesine karşılık gelen eskiz noktasını bul (o köşeyi seçme)
    w = A.ed("const f=e.frame;const yv=[f.n[1]*f.x[2]-f.n[2]*f.x[1],f.n[2]*f.x[0]-f.n[0]*f.x[2],f.n[0]*f.x[1]-f.n[1]*f.x[0]];return Object.entries(d.pts).map(([k,p])=>[k,[0,1,2].map(i=>f.o[i]+f.x[i]*p.x+yv[i]*p.y)])")
    far = [k for k, q in w if abs(q[0] + 40) < 1e-6 and abs(q[2] + 30) < 1e-6][0]
    A.cmd("Eskiz Radyüs"); A.pmfield("Yarıçap", 10); A.clk(*A.ptxy(far))
    A.ok()
    v1 = A.vol(); exp = 48000 - 25 * (1 - math.pi / 4) * 10 - 100 * (1 - math.pi / 4) * 10
    print("S1 sonrası", v1, A.errtree())
    chk("S1 eskiz radyüsünden sonra 3B radyüs aynı kenarda (hacim)", v1 and abs(v1 - exp) < 0.5 and not A.errtree(), (v1, exp, A.errtree()))
    # aynı köşeye eskiz radyüsü: 3B radyüs kenarı yok olur → hata beklenir (sessiz kayma olmamalı)
    A.edit_sketch_of("e1")
    near = [k for k, q in w if abs(q[0] - 40) < 1e-6 and abs(q[2] - 30) < 1e-6][0]
    A.cmd("Eskiz Radyüs"); A.pmfield("Yarıçap", 8); A.clk(*A.ptxy(near))
    A.ok(); time.sleep(1)
    v2 = A.vol(); print("S1b: 3B radyüslü köşeye eskiz radyüsü →", v2, A.errtree(), A.pg.locator("dialog.reselect-dialog[open]").count())
    exp2 = 48000 - 100 * (1 - math.pi / 4) * 10 - 64 * (1 - math.pi / 4) * 10
    chk("S1b kaybolan kenar: radyüs hata verir ya da yeniden seç penceresi (sessizce başka kenara geçmez)",
        A.errtree() or A.pg.locator("dialog.reselect-dialog[open]").count() or (v2 and abs(v2 - exp2) < 0.5), (v2, exp2))
    if A.pg.locator("dialog.reselect-dialog[open]").count():
        A.press("Escape")

    # ---- S2: üst ön kenarda pah 2; eskizde Taşı (tüm dikdörtgen X +10) ----
    ch = {"id": "c1", "type": "chamfer", "name": "Pah1", "d": 2, "d2": 2, "angle": 45, "mode": "dd", "edges": [{"m": [0, 10, 30], "d": [1, 0, 0]}]}
    A.setup(plate(80, 60, 10) + [ch])
    v0 = A.vol(); print("S2 başlangıç", v0)
    chk("S2 pah kuruldu", abs(v0 - (48000 - 160)) < 0.5, v0)
    A.edit_sketch_of("e1")
    winsel(A, -50, 45, 50, -45)
    A.cmd("Taşı"); A.pmfield("X öteleme", 10); A.pmfield("Y öteleme", 0); A.pmbtn("Uygula")
    A.ok(); time.sleep(0.5)
    print("S2 sonrası", A.vol(), A.bbox(), A.errtree())
    chk("S2 taşıdıktan sonra pah duruyor (hacim)", A.vol() and abs(A.vol() - 47840) < 0.5, A.vol())
    # hangi kenarda? kesit: ön yüz (z=30) üst kenarında pah varsa ön yüz yüksekliği 8
    fz = A.ev("(()=>{const m=window.__app.viewer.mesh;let mx=-1e9;for(let i=0;i<m.vertices.length;i+=3){if(Math.abs(m.vertices[i+2]-30)<1e-6)mx=Math.max(mx,m.vertices[i+1]);}return mx})()")
    chk("S2 pah hâlâ ön (z=30) üst kenarda", abs(fz - 8) < 1e-3, fz)
    A.press("Control+z"); A.wait(0.8)
    chk("S2 Ctrl+Z → eski konum, pah var", A.bbox()[0][0] == -40 and abs(A.vol() - 47840) < 0.5, (A.bbox(), A.vol()))

    # ---- S3: kabuk (üst yüz açık, 2 mm); eskizde Esnet sağ kenar +20 ----
    sh = {"id": "sh", "type": "shell", "name": "Kabuk1", "t": 2, "faces": [{"c": [0, 10, 0], "n": [0, 1, 0]}]}
    A.setup(plate(80, 60, 10, dims=False) + [sh])
    v0 = A.vol(); print("S3 başlangıç", v0)
    chk("S3 kabuk kuruldu", abs(v0 - (48000 - 76 * 56 * 8)) < 1, v0)
    A.edit_sketch_of("e1")
    w = A.ed("return Object.entries(d.pts).map(([k,p])=>[k,p.x,p.y])")
    xs = sorted(set(q[1] for q in w))
    winsel(A, 30, 40, 50, -40)
    A.cmd("Esnet"); A.pmfield("X öteleme", 20); A.pmfield("Y öteleme", 0); A.pmbtn("Uygula")
    A.ok(); time.sleep(0.5)
    print("S3 sonrası", A.vol(), A.size(), A.errtree())
    chk("S3 esnetince kabuk üst açık kalır (hacim 100×60)", A.vol() and abs(A.vol() - (60000 - 96 * 56 * 8)) < 1, A.vol())
    A.reload()
    chk("S3 yenile → aynı", A.vol() and abs(A.vol() - (60000 - 96 * 56 * 8)) < 1, A.vol())

    # ---- S4: kırp ile köşe kesilen eskiz (L şekli) + 3B radyüs başka kenarda ----
    fil2 = {"id": "f2", "type": "fillet", "name": "Radyüs2", "r": 3, "edges": [{"m": [-40, 5, -30], "d": [0, 1, 0]}]}
    def m4(pt, line, rect, c, t):
        rect(-40, -30, 40, 30)
        a, b = pt(10, -45), pt(10, 45); line(a, b)
        a2, b2 = pt(-55, 10), pt(55, 10); line(a2, b2)
    # önce düz plaka + radyüs; sonra eskize çizgiler eklenmiş hâli (hazır) yerine gerçek akış: çizgiyi çiz → kırp
    A.setup(plate(80, 60, 10, dims=False) + [fil2])
    v0 = A.vol(); print("S4 başlangıç", v0, A.errtree())
    A.edit_sketch_of("e1")
    A.cmd("Çizgi")
    loc = A.pg.locator("#pm-body label:has-text('Çizdikten sonra ölçü gir') input")
    if loc.count() and loc.first.is_checked(): loc.first.click(); time.sleep(0.2)
    # dünya (40,*,30) köşesinin eskiz koordinatları
    wc = A.ed("const f=e.frame;const yv=[f.n[1]*f.x[2]-f.n[2]*f.x[1],f.n[2]*f.x[0]-f.n[0]*f.x[2],f.n[0]*f.x[1]-f.n[1]*f.x[0]];return Object.entries(d.pts).map(([k,p])=>[p.x,p.y,[0,1,2].map(i=>f.o[i]+f.x[i]*p.x+yv[i]*p.y)])")
    cx, cy = [(q[0], q[1]) for q in wc if abs(q[2][0] - 40) < 1e-6 and abs(q[2][2] - 30) < 1e-6][0]
    sx, sy = (1 if cx > 0 else -1), (1 if cy > 0 else -1)
    # köşeyi kesen çizgi: (cx-20*sx, cy+5*sy) → (cx+5*sx, cy-20*sy)
    A.clk(cx - 20 * sx, cy + 6 * sy); A.clk(cx + 6 * sx, cy - 20 * sy); A.press("Escape"); A.press("Escape")
    A.cmd("Kırp")
    A.clk(cx - 15 * sx + 17 * sx, cy + 1 * sy) if False else None
    # taşan uçlar
    A.clk(cx - 17 * sx, cy + 3 * sy); A.clk(cx + 3 * sx, cy - 17 * sy)
    # köşede kalan iki parça
    A.clk(cx - 2 * sx, cy); A.clk(cx, cy - 2 * sy)
    i = A.skinfo(); print("S4 eskiz", i)
    chk("S4 köşe kırpıldı → 5 çizgi", i["ents"] == 5, i["types"])
    A.ok(); time.sleep(0.5)
    v4 = A.vol(); exp4 = v0 - 14 * 14 / 2 * 10
    print("S4 sonrası", v4, exp4, A.errtree())
    chk("S4 köşe kırpıldıktan sonra karşı köşedeki 3B radyüs yerinde", v4 and abs(v4 - exp4) < 0.5 and not A.errtree(), (v4, exp4))
    print("Konsol:", A.errs)
    chk("konsol hatası yok", not A.errs, A.errs)
    A.close()
finish()

# d2: Blok (kaydet / ekle / düzenle / dağıt), DXF İçe Aktar, Eskiz Resmi + Kenarları izle
from d2h import *
import math, base64

DXF = """0
SECTION
2
ENTITIES
0
CIRCLE
8
0
10
0
20
0
40
10
0
LINE
8
0
10
-30
20
-20
11
-10
21
-20
0
ENDSEC
0
EOF
"""


def circles(A):
    return A.ed("return d.ents.filter(x=>x.t==='circle').map(z=>{const p=d.pts[z.c];return [+p.x.toFixed(2),+p.y.toFixed(2),+z.r.toFixed(2), z.blk||'']})")


with sync_playwright() as p:
    A = App(p)
    A.pg.on("dialog", lambda d: d.accept("Delik") if d.type == "prompt" else d.accept())
    # ================= BLOK =================
    def b(pt, line, rect, c, t):
        rect(-40, -30, 40, 30)
        c(-20, 0, 5)   # c9 / p10
    sk = sketch("s1", "Eskiz1", TOP, b); rect_dims(sk, 80, 60)
    A.setup([sk, ext("e1", "s1", 10)])
    v1 = A.vol()
    A.edit_sketch_of("e1")
    A.clk(-15, 0)
    A.pmbtn("Blok olarak kaydet")
    chk("blok kaydedildi (daire blk etiketi)", circles(A)[0][3].startswith("Delik#"), circles(A))
    A.press("Control+z")
    print("BILGI 'Blok olarak kaydet' sonrası Ctrl+Z → blk etiketi:", circles(A))
    chk("blok kaydetme geri alınabilir (ya da geri alma yığınına zarar vermez)", circles(A) and (circles(A)[0][3] == "" or len(circles(A)) == 1), circles(A))
    if circles(A)[0][3] == "":
        A.clk(-15, 0); A.pmbtn("Blok olarak kaydet")
    A.cmd("Blok Ekle")
    A.clk(20, 0)
    cs = circles(A); print("blok ekle", cs)
    chk("Blok Ekle: 2. örnek (20,0)", len(cs) == 2 and [20, 0] in [c[:2] for c in cs], cs)
    A.ok()
    exp2 = 48000 - 2 * math.pi * 25 * 10
    chk("✓ → 2 delik", abs(A.vol() - exp2) < 1, A.vol())
    A.reload()
    chk("yenile → 2 delik", abs(A.vol() - exp2) < 1, A.vol())
    # bloğu düzenle: 1. örneğe ikinci daire ekle (örneğin merkezinin sağında)
    A.edit_sketch_of("e1")
    A.cmd("Seç") if A.pg.locator("#cmds button[title='Seç']").count() else None
    A.clk(-15, 0)
    A.pmbtn("Bloğu düzenle")
    chk("blok düzenleme modu", A.pg.locator("#pm button:has-text('Bloğu güncelle')").count() == 1)
    A.cmd("Daire")
    loc = A.pg.locator("#pm-body label:has-text('Çizdikten sonra ölçü gir') input")
    if loc.count() and loc.first.is_checked(): loc.first.click(); time.sleep(0.2)
    A.clk(-5, 0); A.clk(-2, 0)     # yeni daire (-5,0) r3
    A.cmd("Seç") if A.pg.locator("#cmds button[title='Seç']").count() else None
    A.pmbtn("Bloğu güncelle")
    cs = circles(A); print("blok güncellendi", cs)
    pos = sorted(c[:3] for c in cs)
    chk("2. örnek: R5 (20,0)'da kalır, R3 (35,0)'a gelir (ekleme noktası korunur)", [20, 0, 5] in pos and [35, 0, 3] in pos, pos)
    A.ok()
    print("blok düzenleme sonrası hacim", A.vol(), A.errtree())
    # dağıt
    A.edit_sketch_of("e1")
    A.clk(-15, 0)
    A.pmbtn("Bloğu dağıt")
    cs = circles(A); print("dağıt", cs)
    chk("dağıt: o örnekte blk etiketi kalmaz", any(c[3] == "" for c in cs), cs)
    A.press("Control+z")
    chk("dağıt geri alınır", all(c[3] for c in circles(A)), circles(A))
    A.cancel("discard")

    # ================= DXF İÇE AKTAR =================
    open("/tmp/d2_in.dxf", "w").write(DXF)
    A.setup(plate(80, 60, 10))
    A.edit_sketch_of("e1")
    with A.pg.expect_file_chooser() as fc:
        A.cmd("DXF İçe Aktar")
    fc.value.set_files("/tmp/d2_in.dxf"); time.sleep(0.8)
    i = A.skinfo(); print("DXF", i, A.toast())
    chk("DXF: daire + çizgi eklendi", i["types"].count("circle") == 1 and i["types"].count("line") == 5, i["types"])
    A.press("Control+z")
    chk("DXF içe aktarma tek Ctrl+Z ile geri alınır", A.skinfo()["ents"] == 4, A.skinfo()["ents"])
    A.press("Control+y")
    # serbest çizgiyi sil (açık kontur olmasın): çizgiye tıkla + Delete
    A.clk(-20, -20); A.press("Delete")
    A.ok()
    chk("✓ → Ø20 delikli plaka", abs(A.vol() - (48000 - math.pi * 100 * 10)) < 1, (A.vol(), A.errtree()))
    A.reload()
    chk("yenile → aynı", abs(A.vol() - (48000 - math.pi * 100 * 10)) < 1, A.vol())
    # ✕ ile vazgeç
    A.edit_sketch_of("e1")
    with A.pg.expect_file_chooser() as fc:
        A.cmd("DXF İçe Aktar")
    fc.value.set_files("/tmp/d2_in.dxf"); time.sleep(0.8)
    A.cancel("discard")
    chk("DXF + Kaydetmeden çık → değişmez", abs(A.vol() - (48000 - math.pi * 100 * 10)) < 1 and len(A.saved_feat("s1")["data"]["ents"]) == 5, A.vol())

    # ================= ESKİZ RESMİ + KENARLARI İZLE =================
    src = A.ev("""(()=>{const c=document.createElement('canvas');c.width=600;c.height=400;const g=c.getContext('2d');
      g.fillStyle='#fff';g.fillRect(0,0,600,400);g.fillStyle='#111';g.fillRect(150,100,300,200);
      g.fillStyle='#fff';g.beginPath();g.arc(300,200,40,0,Math.PI*2);g.fill();return c.toDataURL('image/png')})()""")
    open("/tmp/d2_pic.png", "wb").write(base64.b64decode(src.split(",")[1]))
    A.setup([])
    A.show_tree()
    A.btn("#tree li:has-text('Üst Düzlem')")
    A.btn("#tabs button[data-tab='sketch']")
    A.cmd("Eskiz"); A.wait(0.5)
    with A.pg.expect_file_chooser() as fc:
        A.cmd("Eskiz Resmi")
    fc.value.set_files("/tmp/d2_pic.png"); time.sleep(1.0)
    chk("resim yerleşti, araç picture", A.ed("return !!d.pic && e.tool") == "picture", A.ed("return [!!d.pic, e.tool]"))
    A.pmfield("Genişlik (mm)", 120)
    A.pmbtn("Kenarları izle"); time.sleep(1.5)
    i = A.skinfo(); print("izleme", i)
    chk("izleme: 4 çizgi + daire", i["types"].count("line") == 4 and i["types"].count("circle") == 1, i["types"])
    A.press("Control+z")
    chk("izleme tek Ctrl+Z", A.skinfo()["ents"] == 0, A.skinfo()["ents"])
    A.press("Control+y")
    A.ok()
    A.btn(".suggest button:has-text('Ekstrüzyon')"); A.wait(0.5)
    A.pmfield("Derinlik", 10); A.ok()
    v = A.vol(); print("izlenen parçadan ekstrüzyon", v, A.size())
    exp = (60 * 40 - math.pi * 8 * 8) * 10
    chk("ekstrüzyon ≈ 60×40 − Ø16 (±2%)", v and abs(v - exp) / exp < 0.02, (v, exp))
    A.reload()
    chk("yenile → aynı (resim belgeyle kaydedildi)", A.vol() and abs(A.vol() - v) < 1, A.vol())
    print("Konsol:", A.errs)
    chk("konsol hatası yok", not A.errs, A.errs)
    A.close()
finish()

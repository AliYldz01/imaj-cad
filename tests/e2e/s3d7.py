# 3B eskiz Akıllı Ölçü (SolidWorks gibi): ölçü çizgileri/okları, imleci izleyen önizleme, yerleştirme ötelemesi,
# nokta–çizgi, paralel çizgi mesafesi, açı yayı, yarıçap/çap (D), aşırı tanımda sürülen ölçü, etiketi sürükleme
import cmdpatch, time, json
from h import *
ok=[]
def chk(n,c,info=""): ok.append(bool(c)); print(("✓ " if c else "✗ ")+n, info)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e))); pg.on("dialog", lambda d: d.accept())
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    pg.click("#tabs button[data-tab='weld']")
    pg.click("#cmds button:has-text('3B Eskiz')"); time.sleep(0.4)
    pg.click(".vcube .iso"); time.sleep(0.3)
    R = pg.query_selector("#view").bounding_box()
    def S(x,y,z):
        s = pg.evaluate(f"window.__app.viewer.toScreen([{x},{y},{z}])"); return R['x']+s[0], R['y']+s[1]
    D = lambda js: pg.evaluate(f"(()=>{{const d=window.__app.mode.draft; return {js}}})()")
    tool = lambda t: pg.click(f"#pm-body .seg button:has-text('{t}')")
    tool("Dikdörtgen"); time.sleep(0.2)
    for pt in [(0,0,0),(120,80,0)]:
        x,y = S(*pt); pg.mouse.move(x,y); pg.mouse.click(x,y); time.sleep(0.15)
    pg.keyboard.press("f"); time.sleep(0.3)
    tool("Akıllı Ölçü"); time.sleep(0.2)
    def put(val):
        pg.keyboard.press("Control+a"); pg.keyboard.type(str(val)); pg.keyboard.press("Enter"); time.sleep(0.3)
    # 1) alt çizgi: tıkla → önizleme imleci izler → aşağıya yerleştir
    x,y = S(60,0,0); pg.mouse.click(x,y); time.sleep(0.2)
    gx, gy = S(60,-40,0); pg.mouse.move(gx, gy); time.sleep(0.25)
    chk("önizleme ölçüsü (turuncu) çizgileriyle görünür", pg.locator(".s3-dim.ghost").count()==1 and pg.locator(".s3-dimsvg line").count()>=3 and pg.locator(".s3-dimsvg polygon").count()==2)
    pg.screenshot(path="/home/claude/s3d7_ghost.png")
    pg.mouse.click(gx, gy); time.sleep(0.2); put(150)
    chk("boy ölçüsü eklendi, öteleme kaydedildi", D("JSON.stringify(d.dims3.map(m=>[m.t,m.v,Math.round(m.o||0)]))") and D("d.dims3[0].v")==150 and abs(D("d.dims3[0].o||0"))>10, D("JSON.stringify(d.dims3)"))
    chk("ölçü çizgisi + 2 uzatma çizgisi + 2 ok", pg.locator(".s3-dimsvg line").count()>=3 and pg.locator(".s3-dimsvg polygon").count()==2)
    # 2) nokta–çizgi: sağ üst köşe + alt çizgi → mesafe (yükseklik)
    x,y = S(150,80,0); pg.mouse.click(x,y); time.sleep(0.15)
    x,y = S(75,0,0); pg.mouse.click(x,y); time.sleep(0.15)
    chk("nokta+çizgi → nokta–çizgi önizlemesi", pg.evaluate("window.__app.s3.dimPend&&window.__app.s3.dimPend.t")=="pl")
    x,y = S(200,40,0); pg.mouse.move(x,y); pg.mouse.click(x,y); time.sleep(0.2); put(90)
    chk("nokta–çizgi 90 → yükseklik 90", abs(D("Math.abs(d.xyz[2][1]-d.xyz[1][1])")-90)<1e-3, D("JSON.stringify(d.xyz)"))
    # 3) paralel iki çizgi → çizgi–çizgi mesafesi (aşırı tanım → sürülen ölçü)
    x,y = S(75,0,0); pg.mouse.click(x,y); time.sleep(0.15)
    x,y = S(75,90,0); pg.mouse.click(x,y); time.sleep(0.15)
    chk("paralel çizgiler → çizgi–çizgi", pg.evaluate("window.__app.s3.dimPend&&window.__app.s3.dimPend.t")=="ll")
    x,y = S(-40,45,0); pg.mouse.move(x,y); pg.mouse.click(x,y); time.sleep(0.2); put(50)
    chk("çelişen ölçü sürülen (referans) oldu", D("d.dims3.some(m=>m.t==='ll'&&m.ref)") and pg.locator(".s3-dim.ref").count()==1)
    # 4) açı: ayrı bir çapraz çizgi çiz ve alt çizgiyle açı
    tool("Çizgi"); time.sleep(0.2)
    for pt in [(150,0,0),(250,60,0)]:
        x,y = S(*pt); pg.mouse.move(x,y); pg.mouse.click(x,y); time.sleep(0.15)
    pg.keyboard.press("Escape"); time.sleep(0.1)
    tool("Akıllı Ölçü"); time.sleep(0.2)
    x,y = S(75,0,0); pg.mouse.click(x,y); time.sleep(0.15)
    x,y = S(200,30,0); pg.mouse.click(x,y); time.sleep(0.15)
    chk("iki çizgi → açı", pg.evaluate("window.__app.s3.dimPend&&window.__app.s3.dimPend.t")=="ang")
    x,y = S(200,10,0); pg.mouse.move(x,y); pg.mouse.click(x,y); time.sleep(0.2); put(45)
    chk("açı 45° ve yay çizildi", abs(D("(()=>{const l=d.lines[d.lines.length-1]; const a=d.xyz[d.ids.indexOf(l.a)], b=d.xyz[d.ids.indexOf(l.b)]; return Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI})()")-45)<0.05 and pg.locator(".s3-dimsvg polyline").count()>=1)
    # 5) etiketi sürükle: öteleme değişir, değer aynı
    o0 = D("d.dims3[0].o")
    el = pg.locator(".s3-dim:not(.ghost)").first; bb = el.bounding_box()
    pg.mouse.move(bb['x']+bb['width']/2, bb['y']+bb['height']/2); pg.mouse.down(); pg.mouse.move(bb['x']+5, bb['y']+60, steps=4); pg.mouse.up(); time.sleep(0.3)
    chk("etiketi sürükleme ötelemeyi değiştirdi", abs(D("d.dims3[0].o")-o0)>5 and D("d.dims3[0].v")==150)
    pg.mouse.click(R['x']+20, R['y']+R['height']-20); time.sleep(0.2)
    pg.screenshot(path="/home/claude/s3d7_dims.png")
    # 6) seç (tek tık) → bağlam çubuğu; sürülen ↔ sürücü; Delete ile sil; çift tık düzenle
    pg.locator(".s3-dim.ref").click(); time.sleep(0.3)
    chk("ölçü seçildi + çubuk", pg.locator(".s3-dim.sel").count()==1 and pg.locator(".s3-relbar button:has-text('Sürücü yap')").count()==1)
    pg.click(".s3-relbar button:has-text('Sürücü yap')"); time.sleep(0.3)
    chk("çelişen sürülen ölçü sürücü yapılamaz", D("d.dims3.some(m=>m.t==='ll'&&m.ref)") and "aşırı" in pg.inner_text("#toast"))
    n0 = D("d.dims3.length")
    pg.locator(".s3-dim.ref").click(); time.sleep(0.2); pg.keyboard.press("Delete"); time.sleep(0.3)
    chk("Delete ile ölçü silindi", D("d.dims3.length")==n0-1)
    el = pg.locator(".s3-dim:not(.ghost)").first; bb = el.bounding_box()
    pg.mouse.dblclick(bb['x']+bb['width']/2, bb['y']+bb['height']/2); time.sleep(0.3); put(160)
    chk("çift tık düzenle → 160", D("d.dims3[0].v")==160 and abs(D("d.xyz[1][0]")-160)<1e-3, D("JSON.stringify(d.xyz[1])"))
    # 7) yay + nokta → nokta–yay merkezi mesafesi, yarıçap ↔ çap (D)
    tool("Yay"); time.sleep(0.2)
    for pt in [(0,-60,0),(100,-60,0),(50,-110,0)]:
        x,y = S(*pt); pg.mouse.move(x,y); pg.mouse.click(x,y); time.sleep(0.4)
    tool("Akıllı Ölçü"); time.sleep(0.2)
    print("   yaylar:", D("(d.arcs3||[]).length")); x,y = S(85.36,-95.36,0); x2,y2 = x,y
    pg.mouse.click(x,y); time.sleep(0.15)
    chk("yay → yarıçap önizlemesi", pg.evaluate("window.__app.s3.dimPend&&window.__app.s3.dimPend.t")=="rad")
    pg.keyboard.press("d"); time.sleep(0.1)
    chk("D → çap", pg.evaluate("window.__app.s3.dimPend.t")=="dia")
    pg.keyboard.press("Escape")
    x,y = S(0,90,0); pg.mouse.click(x,y); time.sleep(0.15)
    pg.mouse.click(x2,y2); time.sleep(0.15)
    chk("nokta + yay → merkez mesafesi", pg.evaluate("window.__app.s3.dimPend&&window.__app.s3.dimPend.t")=="pc")
    pg.keyboard.press("Escape")
    print("hatalar:", logs); print("SONUC:", "TAMAM" if all(ok) and not logs else "HATA")

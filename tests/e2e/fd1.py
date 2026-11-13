# Serbest Çizim: elle kaba kare / daire / çizgi / yay / üçgen → bekleyince tanınır, bırakınca eklenir
import cmdpatch, time, math, random
from h import *
random.seed(3)
ok = []
def chk(name, cond, info=""):
    ok.append(cond); print(("TAMAM " if cond else "HATA  ") + name, info)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    pg.click("#tree li:has-text('Ön Düzlem')"); pg.click("#tree-actions button:has-text('Eskiz')"); time.sleep(0.4)
    r = pg.query_selector("#view").bounding_box()
    pg.evaluate("(()=>{const v=window.__app.viewer; v.camera.zoom=0.9; v.camera.updateProjectionMatrix(); v.requestRender();})()")
    ed = "window.__app.mode.editor"
    def sc(x,y):
        s = pg.evaluate(f"(()=>{{const e={ed}; const f=e.frame; const yv=[f.n[1]*f.x[2]-f.n[2]*f.x[1], f.n[2]*f.x[0]-f.n[0]*f.x[2], f.n[0]*f.x[1]-f.n[1]*f.x[0]]; const w=[f.o[0]+f.x[0]*{x}+yv[0]*{y}, f.o[1]+f.x[1]*{x}+yv[1]*{y}, f.o[2]+f.x[2]*{x}+yv[2]*{y}]; return window.__app.viewer.toScreen(w);}})()")
        return r["x"]+s[0], r["y"]+s[1]
    # düğme: Çizgi'nin solunda
    order = pg.eval_on_selector_all("#cmds button", "els=>els.map(e=>e.title||e.textContent.trim())")
    i_f = next((i for i,t in enumerate(order) if "Serbest" in t), -1); i_l = next((i for i,t in enumerate(order) if t.startswith("Çizgi")), -1)
    chk("düğme Çizgi'nin solunda", i_f >= 0 and i_f + 1 == i_l, (i_f, i_l))
    pg.click("#cmds button[title^='Serbest']"); time.sleep(0.2)
    chk("araç free", pg.evaluate(f"{ed}.tool") == "free")
    pg.evaluate(f"{ed}.opts.quickDim=false")
    def stroke(pts, hold=True, jitter=0.6):
        x,y = sc(*pts[0]); pg.mouse.move(x,y); pg.mouse.down()
        for q in pts[1:]:
            x,y = sc(q[0]+random.uniform(-jitter,jitter), q[1]+random.uniform(-jitter,jitter)); pg.mouse.move(x,y)
        if hold: time.sleep(0.8)
        kind = pg.evaluate(f"{ed}.free && {ed}.free.shape && {ed}.free.shape.kind")
        pg.mouse.up(); time.sleep(0.3)
        return kind
    def interp(poly, n=12):
        out=[]
        for a,b2 in zip(poly, poly[1:]):
            for k in range(n): out.append((a[0]+(b2[0]-a[0])*k/n, a[1]+(b2[1]-a[1])*k/n))
        out.append(poly[-1]); return out
    cnt = lambda t: pg.evaluate(f"{ed}.data.ents.filter(e=>e.t==='{t}').length")
    rels = lambda t: pg.evaluate(f"{ed}.data.rels.filter(r=>r.t==='{t}').length")
    # 1) kaba kare (uçlar tam birleşmiyor, biraz eğik)
    sq = interp([(0,0),(61,1.5),(60,59),(-1.5,61),(2,3)])
    k = stroke(sq)
    chk("kare bekleyince tanındı", k == "rect", k)
    chk("kare 4 çizgi", cnt("line") == 4, cnt("line"))
    npts = pg.evaluate(f"new Set({ed}.data.ents.flatMap(e=>[e.p1,e.p2])).size")
    chk("kare kapalı (4 nokta, köşe orijine yakalandı)", npts == 4 and pg.evaluate(f"{ed}.data.ents.some(e=>e.p1==='O'||e.p2==='O')"), npts)
    chk("yatay 2 + dikey 2", rels("horizontal") == 2 and rels("vertical") == 2, (rels("horizontal"), rels("vertical")))
    chk("kare eşit kenar", rels("equal") == 1, rels("equal"))
    chk("kare çözüldü", pg.evaluate(f"{ed}.result.ok"))
    # 2) daire
    circ = [(150+30*math.cos(t/40*2*math.pi), 30+30*math.sin(t/40*2*math.pi)*1.04) for t in range(42)]
    k = stroke(circ); chk("daire", k == "circle" and cnt("circle") == 1, k)
    # 3) düz çizgi (bekleme yok: bırakınca da tanınır), neredeyse yatay
    k = stroke(interp([(0,-40),(80,-41.5)], 20), hold=False)
    chk("çizgi (bırakınca)", cnt("line") == 5, cnt("line"))
    chk("çizgi yatay ilişkisi", rels("horizontal") == 3, rels("horizontal"))
    # 4) yay (yarım daire)
    arc = [(-80+25*math.cos(math.pi - t/30*math.pi), 30+25*math.sin(math.pi - t/30*math.pi)) for t in range(31)]
    k = stroke(arc); chk("yay", k == "arc" and cnt("arc") == 1, k)
    # 5) eğik üçgen
    k = stroke(interp([(100,-100),(160,-100),(130,-50),(101,-99)]))
    chk("üçgen", k == "poly" and cnt("line") == 8, (k, cnt("line")))
    # 6) mevcut köşeden başlayan çizgi: kare köşesine yakalanır
    before = pg.evaluate(f"Object.keys({ed}.data.pts).length")
    k = stroke(interp([(60.5,59.5),(60,100)], 15))
    after = pg.evaluate(f"Object.keys({ed}.data.pts).length")
    chk("köşeye yakalama (1 yeni nokta)", after - before == 1, (before, after))
    chk("dikey", rels("vertical") >= 3, rels("vertical"))
    # 7) tanındıktan sonra devam edince iptal: önce düz, bekle, sonra köşe yap → çokgen
    x,y = sc(-60,-80); pg.mouse.move(x,y); pg.mouse.down()
    for q in interp([(-60,-80),(-20,-80)], 15)[1:]: pg.mouse.move(*sc(*q))
    time.sleep(0.8); k1 = pg.evaluate(f"{ed}.free.shape && {ed}.free.shape.kind")
    for q in interp([(-20,-80),(-20,-120)], 15)[1:]: pg.mouse.move(*sc(*q))
    time.sleep(0.8); k2 = pg.evaluate(f"{ed}.free.shape && {ed}.free.shape.kind")
    pg.mouse.up(); time.sleep(0.3)
    chk("devam: çizgi→çokgen", k1 == "line" and k2 == "poly", (k1, k2))
    # 8) geri al
    n0 = cnt("line"); pg.keyboard.press("Control+z"); time.sleep(0.3)
    chk("geri al", cnt("line") == n0 - 2, (n0, cnt("line")))
    pg.screenshot(path="/home/claude/fd1.png")
    # 9) dokunmatik (CDP) ile kare
    cdp = pg.context.new_cdp_session(pg)
    pg.evaluate(f"{ed}.data.ents=[]; {ed}.data.rels=[]; {ed}.data.pts={{}}; {ed}.resolve()")
    pts = interp([(0,0),(50,0),(50,50),(0,50),(1,1)], 10)
    def tp(t, q): x,y = sc(*q); cdp.send("Input.dispatchTouchEvent", {"type": t, "touchPoints": ([{"x": x, "y": y}] if t != "touchEnd" else [])})
    tp("touchStart", pts[0])
    for q in pts[1:]: tp("touchMove", q); time.sleep(0.01)
    time.sleep(0.8); kt = pg.evaluate(f"{ed}.free && {ed}.free.shape && {ed}.free.shape.kind")
    tp("touchEnd", pts[-1]); time.sleep(0.3)
    chk("parmakla kare", kt == "rect" and cnt("line") == 4, (kt, cnt("line")))
    # 10) dalgalı eğri → serbest eğri (spline)
    k = stroke([(-100+u*1.5, -60+15*math.sin(u/60*2*math.pi)) for u in range(61)], jitter=0.2)
    chk("serbest eğri", k == "spline" and cnt("spline") == 1, k)
    # 11) elips, yuvarlatılmış dikdörtgen, çok bozuk / kapanmamış kare, eğik dikdörtgen
    def clear(): pg.evaluate(f"{ed}.data.ents=[]; {ed}.data.rels=[]; {ed}.data.pts={{}}; {ed}.resolve()")
    clear()
    k = stroke([(60*math.cos(t/50*6.4), 25*math.sin(t/50*6.4)) for t in range(51)])
    chk("elips", k == "ellipse" and cnt("ellipse") == 1 and rels("horizontal") == 1, (k, cnt("ellipse")))
    clear()
    def rrp(w,h,r,ox,oy):
        o=[]
        for cx,cy,a0 in [(w/2-r,h/2-r,0),(-w/2+r,h/2-r,90),(-w/2+r,-h/2+r,180),(w/2-r,-h/2+r,270)]:
            for kk in range(10): a=math.radians(a0+10*kk); o.append((ox+cx+r*math.cos(a), oy+cy+r*math.sin(a)))
        o.append(o[0]); return interp(o, 3)
    k = stroke(rrp(100,50,12,0,0))
    chk("yuvarlatılmış dikdörtgen", k == "rect" and cnt("line") == 4 and cnt("arc") == 4 and rels("tangent") == 8, (k, cnt("line"), cnt("arc"), rels("tangent")))
    chk("yuv. çözüldü", pg.evaluate(f"{ed}.result.ok") and pg.evaluate(f"{ed}.result.conflicts.length") == 0)
    clear()
    k = stroke(interp([(0,0),(55,7),(63,57),(4,66),(-3,12)]), jitter=1.5)
    chk("çok bozuk kapanmamış kare", k == "rect" and cnt("line") == 4 and rels("equal") == 1, (k, cnt("line")))
    clear()
    k = stroke(interp([(0,0),(80,40),(60,80),(-20,40),(1,1)]))
    chk("eğik dikdörtgen: paralel + dik", k == "rect" and rels("parallel") == 2 and rels("perpendicular") == 1, (k, rels("parallel")))
    pg.screenshot(path="/home/claude/fd1b.png")
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

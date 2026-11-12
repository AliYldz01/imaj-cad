import cmdpatch
import sys, time
from playwright.sync_api import sync_playwright
URL=sys.argv[1]; out="/home/claude/tests/t6_"
def wait_ready(pg, t=90000):
    pg.wait_for_function("!document.querySelector('#status').classList.contains('busy') && !document.querySelector('#status-text').textContent.includes('yükleniyor')", timeout=t)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.on("dialog", lambda d: d.accept())
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    r = pg.query_selector("#view").bounding_box()
    st = lambda: pg.inner_text("#status-text")
    def zoom(z=0.9):
        pg.evaluate(f"(()=>{{const v=window.__app.viewer; v.camera.zoom={z}; v.camera.updateProjectionMatrix(); const d=v.camera.position.clone().sub(v.controls.target); v.controls.target.set(0,0,0); v.camera.position.copy(d); v.camera.updateMatrixWorld(); v.requestRender();}})()")
    def sc(x,y):
        s = pg.evaluate(f"(()=>{{const e=window.__app.mode.editor; const f=e.frame; const yv=[f.n[1]*f.x[2]-f.n[2]*f.x[1], f.n[2]*f.x[0]-f.n[0]*f.x[2], f.n[0]*f.x[1]-f.n[1]*f.x[0]]; const w=[f.o[0]+f.x[0]*{x}+yv[0]*{y}, f.o[1]+f.x[1]*{x}+yv[1]*{y}, f.o[2]+f.x[2]*{x}+yv[2]*{y}]; return window.__app.viewer.toScreen(w);}})()")
        return r["x"]+s[0], r["y"]+s[1]
    def clk(*pts):
        for q in pts: pg.mouse.click(*sc(*q)); time.sleep(0.12)
    def tool(t): pg.click(f"#cmds button[title='{t}']"); time.sleep(0.1)
    ents = lambda: pg.evaluate("window.__app.mode.editor.data.ents.length")
    def fld(label, v):
        sel=f"#pm-body .pm-field:has-text('{label}') input"; pg.fill(sel, str(v)); pg.dispatch_event(sel,"input")
    def apply(): pg.click("#pm-body button:has-text('Uygula')"); time.sleep(0.3)
    # Ön düzlemde kutu yapıp üst yüzüne eskiz (dönüştür için)
    pg.click("#tree li:has-text('Ön Düzlem')"); pg.click("#tree-actions button:has-text('Eskiz')"); time.sleep(0.3); zoom()
    tool("Dikdörtgen"); clk((-100,-100),(-60,-70)); pg.click("#pm-ok"); time.sleep(0.4); wait_ready(pg)
    pg.click("#tabs button[data-tab='features']"); tool("Ekstrüzyon"); time.sleep(0.6); wait_ready(pg); pg.click("#pm-ok"); time.sleep(0.5); wait_ready(pg)
    pg.click("#tree li:has-text('Ön Düzlem')"); pg.click("#tree-actions button:has-text('Eskiz')"); time.sleep(0.3); zoom()
    print("start ents", ents())
    tool("Dikdörtgen"); clk((0,0),(40,30))
    # ötele: 4 çizgiyi seç
    tool("Seç"); clk((20,0),(40,15),(20,30),(0,15))
    tool("Ötele"); fld("Mesafe", 5); apply()
    print("offset ->", ents(), st())
    # aynala: merkez çizgisi x=60 dikey, dairenin aynası
    tool("Merkez Çiz."); clk((60,-20),(60,60))
    tool("Daire"); clk((80,10),(85,10))
    tool("Seç"); clk((85,10),(60,40))
    tool("Aynala"); apply()
    print("mirror ->", ents(), st())
    # doğrusal çoğaltma: küçük daire
    tool("Daire"); clk((0,-40),(8,-40))
    tool("Seç"); clk((8,-40))
    tool("Doğrusal Çoğ."); print("  sel:", pg.evaluate("[...window.__app.mode.editor.sel]")); fld("Adet", 4); apply(); print("  toast:", pg.inner_text("#toast"), pg.evaluate("window.__app.mode.editor.opts"))
    print("lpattern ->", ents(), st())
    # dairesel çoğaltma: (100,0) etrafında? merkez orijin; daire (-30,60)
    tool("Daire"); clk((-30,60),(-22,60))
    tool("Seç"); clk((-22,60))
    tool("Dairesel Çoğ."); apply()
    print("cpattern ->", ents(), st())
    # taşı/kopyala
    tool("Daire"); clk((-60,20),(-52,20)); tool("Seç"); clk((-52,20))
    tool("Taşı/Kopyala"); pg.check("#pm-body .pm-check:has-text('Kopyala') input"); apply()
    print("copy ->", ents(), st())
    # 3N dikdörtgen, paralelkenar, çevre dairesi
    tool("3N Dikdörtgen"); clk((100,0),(130,20),(120,40)); print("rect3 ->", ents(), st())
    tool("Paralelkenar"); clk((100,-60),(140,-60),(150,-40)); print("para ->", ents(), st())
    tool("Çevre Dairesi"); clk((-60,-30),(-40,-30),(-50,-15)); print("circle3 ->", ents(), st())
    # eskiz pahı: ötelenen dikdörtgenin köşesi (45,35)
    tool("Eskiz Pahı"); clk((45,35)); print("chamfer ->", ents(), st())
    # uzat: yatay çizgi + dikey hedef
    tool("Çizgi"); clk((0,80),(30,80)); pg.keyboard.press("Enter")
    tool("Çizgi"); clk((50,70),(50,95)); pg.keyboard.press("Enter")
    tool("Uzat"); clk((28,80))
    print("extend ->", pg.evaluate("(()=>{const d=window.__app.mode.editor.data; return Object.values(d.pts).filter(p=>Math.abs(p.y-80)<1e-6).map(p=>+p.x.toFixed(2))})()"), st())
    # dönüştür: kutunun kenarı (z=10 ön yüz kenarları) -> eskiz düzlemine izdüşür
    tool("Dönüştür")
    e = pg.evaluate("(()=>{const v=window.__app.viewer, m=v.mesh, rr=v.renderer.domElement.getBoundingClientRect(); for(let i=0;i<m.edges.length;i++){const sp=v.toScreen(m.edges[i].m); const h=v.pick(rr.left+sp[0], rr.top+sp[1], {edge:true}); if(h&&h.index===i) return [rr.left+sp[0], rr.top+sp[1]];} return null})()")
    if e: pg.mouse.click(*e); time.sleep(0.3)
    print("convert ->", ents(), st())
    pg.click("#viewbar button[title='Ekrana sığdır']"); time.sleep(0.3)
    pg.screenshot(path=out+"1.png")
    print("errors:", logs or "none")
    b.close()

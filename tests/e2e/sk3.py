import sys, time, json
from playwright.sync_api import sync_playwright
URL=sys.argv[1]; out="/home/claude/tests/t8_"
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
    ents = lambda: pg.evaluate("window.__app.mode.editor.data.ents.map(e=>e.t).join(',')")
    def ok(): pg.click("#pm-ok"); time.sleep(0.5); wait_ready(pg)
    pg.click("#tree li:has-text('Ön Düzlem')"); pg.click("#tree-actions button:has-text('Eskiz')"); time.sleep(0.3); zoom()
    pg.evaluate("window.__app.mode.editor.opts.quickDim=false")
    E = lambda: pg.evaluate("window.__app.mode.editor.data.ents.map(e=>e.t+(e.cons?'*':'')+(e.rho?'('+e.rho+')':'')).join(',')")
    tool("Orta N. Çizgi"); clk((0,0),(40,10)); print("mline:", E(), st())
    tool("3N Merkez Dikd."); clk((-60,40),(-30,40),(-40,60)); print("crect3:", E()[-60:], st())
    tool("Konik"); clk((40,40),(90,40),(60,80)); print("conic:", E()[-20:], st())
    tool("Ayır"); clk((20,5)); print("split line:", E()[:40], st())
    tool("Daire"); clk((-60,-50),(-40,-50)); tool("Ayır"); clk((-40,-50),(-80,-50)); print("split circle:", E()[-30:], st())
    tool("Çizgi"); clk((0,-60),(100,-60)); pg.keyboard.press("Escape"); time.sleep(0.1)
    tool("Kademe"); clk((30,-60),(60,-60),(45,-45)); print("jog:", E()[-50:], st())
    tool("Koord. Ölçü"); clk((0,0),(40,10),(90,40)); print("ordinate dims:", pg.evaluate("window.__app.mode.editor.data.dims.map(d=>d.t+d.sub+':'+(+d.v).toFixed(1)+(d.ref?'R':''))"))
    tool("Denklem Eğrisi"); pg.click("#pm-body button:has-text('Eğriyi oluştur')"); time.sleep(0.3); print("eq:", E()[-12:], st())
    tool("Akıllı Ölçü") if pg.query_selector("#cmds button[title='Akıllı Ölçü']") else tool("Ölçü")
    pg.screenshot(path="sk3.png")
    pg.click("#pm-ok"); time.sleep(0.6)
    print("profile check:", pg.evaluate("window.__app.doc.features.length"), st())
    print("errors:", logs[:5] or "none")
    b.close()

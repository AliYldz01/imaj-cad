import cmdpatch
import sys, time, json
from playwright.sync_api import sync_playwright
URL=sys.argv[1] if len(sys.argv)>1 else "http://localhost:4173/"; out="/tmp/sk1_"
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
    def quick(*vals):
        box = pg.locator(".dim-prompt.quick")
        print("   quick fields:", box.locator("label").all_inner_texts())
        ins = box.locator("input")
        for i,v in enumerate(vals):
            if v is None: continue
            ins.nth(i).fill(str(v)); ins.nth(i).dispatch_event("input")
        ins.nth(0).press("Enter"); time.sleep(0.4)
    tool("Çizgi"); clk((0,0),(80,5)); quick(125)
    L = pg.evaluate("(()=>{const d=window.__app.mode.editor.data; const l=d.ents.find(e=>e.t==='line'); const a=d.pts[l.p1]||{x:0,y:0}, b=d.pts[l.p2]; return Math.hypot(b.x-a.x,b.y-a.y)})()")
    print("line length:", round(L,3))
    pg.keyboard.press("Escape"); time.sleep(0.2)
    tool("Dikdörtgen"); clk((-100,-100),(-20,-60)); quick(150, 70)
    print("rect dims:", pg.evaluate("window.__app.mode.editor.data.dims.map(d=>d.t+':'+d.v)"))
    tool("Daire"); clk((60,-60),(75,-60)); quick(42)
    print("dims:", pg.evaluate("window.__app.mode.editor.data.dims.map(d=>d.t+':'+d.v)"), st())
    pg.screenshot(path="sk1.png")
    print("errors:", logs[:5] or "none")
    b.close()

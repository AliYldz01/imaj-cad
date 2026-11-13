import cmdpatch
import sys, time, json
from playwright.sync_api import sync_playwright
URL=sys.argv[1] if len(sys.argv)>1 else "http://localhost:4173/"; out="/tmp/t8_"
def wait_ready(pg, t=90000):
    pg.wait_for_function("!document.querySelector('#status').classList.contains('busy') && !document.querySelector('#status-text').textContent.includes('yükleniyor')", timeout=t)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.on("dialog", lambda d: d.accept("Blok1") if d.type=="prompt" else d.accept())
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
    D = lambda: pg.evaluate("window.__app.mode.editor.data.dims.map(d=>d.t+':'+(+d.v).toFixed(2))")
    E = lambda: pg.evaluate("window.__app.mode.editor.data.ents.map(e=>e.t).join(',')")
    # yay uzunluğu
    tool("Merkez Yay"); clk((0,0),(40,0),(0,40))
    tool("Akıllı Ölçü"); pg.click("#pm-body label:has-text('yay uzunluğu')"); time.sleep(0.1)
    clk((28.3,28.3),(50,50)); time.sleep(0.3)
    pg.fill(".dim-prompt input", "100"); pg.press(".dim-prompt input", "Enter"); time.sleep(0.4)
    print("arc len dims:", D(), pg.evaluate("(()=>{const d=window.__app.mode.editor.data; const a=d.ents.find(e=>e.t==='arc'); return a.r})()"))
    # kenar mesafesi: daire + çizgi
    tool("Çizgi"); clk((-100,-80),(100,-80)); pg.keyboard.press("Escape")
    tool("Daire"); clk((-50,-40),(-40,-40))
    tool("Akıllı Ölçü"); pg.click("#pm-body label:has-text('yay uzunluğu')"); pg.click("#pm-body label:has-text('en yakın kenar')"); time.sleep(0.1)
    clk((-40,-40),(0,-80),(-20,-60)); time.sleep(0.3)
    pg.fill(".dim-prompt input", "15"); pg.press(".dim-prompt input", "Enter"); time.sleep(0.4)
    print("edge measure:", pg.evaluate("(()=>{const d=window.__app.mode.editor.data; const c=d.ents.find(e=>e.t==='circle'); const l=d.ents.filter(e=>e.t==='line')[0]; return [d.pts[l.p1], d.pts[l.p2]]})()"))
    print("edge dims:", D(), pg.evaluate("(()=>{const d=window.__app.mode.editor.data; const c=d.ents.find(e=>e.t==='circle'); return [d.pts[c.c].y, c.r]})()"))
    # dinamik ayna
    tool("Merkez Çiz."); clk((150,-100),(150,100)); pg.keyboard.press("Escape")
    tool("Seç"); clk((150,0)); time.sleep(0.2)
    pg.click("#pm-body button:has-text('Dinamik ayna ekseni yap')"); time.sleep(0.2)
    tool("Daire"); clk((180,50),(190,50)); print("dyn mirror:", E()[-30:])
    # blok kaydet / ekle
    tool("Seç"); clk((190,50)); time.sleep(0.2)
    pg.click("#pm-body button:has-text('Blok olarak kaydet')"); time.sleep(0.3)
    print("blocks:", pg.evaluate("Object.keys(JSON.parse(localStorage.getItem('imajcad.blocks')||'{}'))"), pg.evaluate("[...window.__app.mode.editor.sel]"))
    tool("Blok Ekle"); time.sleep(0.2); print("panel:", pg.inner_text("#pm-body")[:120].replace("\n"," / ")); clk((200,-60)); print("block:", E()[-30:], pg.inner_text("#toast"))
    # onarım: çakışık çift nokta oluştur
    pg.evaluate("""(()=>{const e=window.__app.mode.editor; const d=e.data; d.pts['zz1']={x:300,y:0}; d.pts['zz2']={x:300.00001,y:0}; d.pts['zz3']={x:350,y:0}; d.ents.push({id:'lz1',t:'line',p1:'zz1',p2:'zz3'}); d.ents.push({id:'lz2',t:'line',p1:'zz2',p2:'zz3'}); e.resolve(); e.render();})()""")
    tool("Eskizi Onar"); time.sleep(0.4); print("repair:", pg.inner_text("#toast"))
    pg.screenshot(path="sk4.png")
    print("errors:", logs[:5] or "none")
    b.close()

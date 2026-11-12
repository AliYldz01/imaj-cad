# merkez dikdörtgeni ötele (köşegen yapı çizgileri ötelenmez, dikdörtgen doğru ötelenir); çizim aracı eskiz dışında çalışmaz
import cmdpatch, time
from h import *
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    pg.click("#tabs button[data-tab='sketch']"); time.sleep(0.2)
    pg.click("#cmds button[title='Çizgi']", force=True); time.sleep(0.3)
    print("tool outside sketch -> mode:", pg.evaluate("window.__app.mode.k"), "| toast:", pg.inner_text("#toast"))
    sk = sketch("s1","S",FRONT if 'FRONT' in dir() else TOP, lambda pt,line,rect,c,t: None)
    pg.click("#tree li:has-text('Ön Düzlem')"); pg.click("#tree-actions button:has-text('Eskiz')"); time.sleep(0.4)
    r = pg.query_selector("#view").bounding_box()
    def sc(x,y):
        s = pg.evaluate(f"(()=>{{const e=window.__app.mode.editor; const f=e.frame; const yv=[f.n[1]*f.x[2]-f.n[2]*f.x[1], f.n[2]*f.x[0]-f.n[0]*f.x[2], f.n[0]*f.x[1]-f.n[1]*f.x[0]]; const w=[f.o[0]+f.x[0]*{x}+yv[0]*{y}, f.o[1]+f.x[1]*{x}+yv[1]*{y}, f.o[2]+f.x[2]*{x}+yv[2]*{y}]; return window.__app.viewer.toScreen(w);}})()")
        return r["x"]+s[0], r["y"]+s[1]
    pg.evaluate("window.__app.mode.editor.opts.quickDim=false")
    pg.evaluate("window.__app.mode.editor.setTool('crect')"); time.sleep(0.2)
    for q in [(0,0),(40,20)]: pg.mouse.click(*sc(*q)); time.sleep(0.15)
    pg.evaluate("""(()=>{const e=window.__app.mode.editor; e.setTool('offset'); e.sel=new Set(e.data.ents.map(x=>x.id)); e.opts.offD=5; e.opts.offRev=false; e.applyOp();})()""")
    time.sleep(0.3)
    L = pg.evaluate("""(()=>{const d=window.__app.mode.editor.data; const P=id=>{const p=d.pts[id]; const a=Array.isArray(p)?p:[p.x,p.y]; return [Math.round(a[0]*10)/10,Math.round(a[1]*10)/10]}; return d.ents.filter(e=>e.t==='line').map(e=>(e.cons?'*':'')+JSON.stringify([P(e.p1),P(e.p2)]))})()""")
    print("lines:", len(L)); [print("  ",x) for x in L]
    print("errors:", logs)

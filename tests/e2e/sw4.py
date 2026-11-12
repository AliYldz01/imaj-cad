import sys, time
from playwright.sync_api import sync_playwright
from h import wait_ready
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto((sys.argv[1] if len(sys.argv)>1 else 'http://localhost:4173/')); wait_ready(pg); time.sleep(0.5)
    r = pg.query_selector("#view").bounding_box()
    pg.click("#tree li:has-text('Ön Düzlem')"); pg.click("#tree-actions button:has-text('Eskiz')"); time.sleep(0.4)
    pg.evaluate("(()=>{const v=window.__app.viewer; v.camera.zoom=1; v.camera.updateProjectionMatrix(); v.requestRender(); window.__app.mode.editor.opts.quickDim=false})()")
    def sc(x,y):
        s = pg.evaluate(f"(()=>{{const e=window.__app.mode.editor; const f=e.frame; const yv=[f.n[1]*f.x[2]-f.n[2]*f.x[1], f.n[2]*f.x[0]-f.n[0]*f.x[2], f.n[0]*f.x[1]-f.n[1]*f.x[0]]; const w=[f.o[0]+f.x[0]*{x}+yv[0]*{y}, f.o[1]+f.x[1]*{x}+yv[1]*{y}, f.o[2]+f.x[2]*{x}+yv[2]*{y}]; return window.__app.viewer.toScreen(w);}})()")
        return r["x"]+s[0], r["y"]+s[1]
    ed = lambda js: pg.evaluate(f"(()=>{{const e=window.__app.mode.editor; const d=e.data; {js}}})()")
    def mv(x,y,steps=6): pg.mouse.move(*sc(x,y), steps=steps); time.sleep(0.03)
    def ck(x,y): mv(x,y); pg.mouse.click(*sc(x,y)); time.sleep(0.1)
    rels = lambda: ed("return d.rels.map(r=>r.t).join(',')")
    ed("e.setTool('line')")
    ck(-80,-40); ck(-30,-40)          # yatay çizgi
    mv(-10,-40); mv(-30,-40,4); mv(-30,-40,1)   # uzaklaş, geri gel
    mv(-12,-38,4)                       # teğet yönde çık
    print("arc mode:", ed("return [e.st.arc, !!e.st.arcNormal]"))
    print("before:", ed("return JSON.stringify(d.pts)"))
    ck(-10,-20)                         # yay bitiş
    print("after arc:", ed("return JSON.stringify(d.pts)"), ed("return JSON.stringify(d.ents)"))
    print("ents:", ed("return d.ents.map(x=>x.t).join(',')"), "rels:", rels(), "tool still line chain:", ed("return !!e.st.last && !e.st.arc"))
    # normal yay: geri dön, dik çık
    mv(-10,0); mv(-10,-20,4); mv(-10,-20,1); mv(-25,-22,4)
    print("arc mode 2:", ed("return [e.st.arc, !!e.st.arcNormal]"))
    pg.keyboard.press("Escape"); pg.keyboard.press("Escape")
    # pencere seçimi: soldan sağa, sadece tamamen içerdekiler
    print("count ents", ed("return d.ents.length"))
    pg.mouse.move(*sc(-90,-50)); pg.mouse.down(); pg.mouse.move(*sc(-25,-30), steps=8); 
    print("box visible:", pg.locator(".sk-box").count(), pg.locator(".sk-box.cross").count()); pg.mouse.up(); time.sleep(0.1)
    print("window sel:", ed("return [...e.sel].map(id=>d.ents.find(x=>x.id===id)?.t).join(',')"))
    # kesişen: sağdan sola
    pg.mouse.move(*sc(-12,-48)); pg.mouse.down(); pg.mouse.move(*sc(-50,-36), steps=8); pg.mouse.up(); time.sleep(0.1)
    print("crossing sel:", ed("return [...e.sel].map(id=>d.ents.find(x=>x.id===id)?.t).join(',')"))
    # tek tık değiştirir, ctrl+tık ekler
    pg.mouse.click(*sc(-60,-40)); print("click:", ed("return e.sel.size"))
    pg.keyboard.down("Control"); pg.mouse.click(*sc(-15,-30)); pg.keyboard.up("Control"); print("ctrl click:", ed("return e.sel.size"))
    print("errors:", logs)
    print(ed("return JSON.stringify(d.pts)"), ed("return JSON.stringify(d.ents)"), ed("return e.tool"))

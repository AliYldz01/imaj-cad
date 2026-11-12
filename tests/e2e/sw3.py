import cmdpatch
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
    def mv(x,y,steps=6): pg.mouse.move(*sc(x,y), steps=steps); time.sleep(0.05)
    def ck(x,y): mv(x,y); pg.mouse.click(*sc(x,y)); time.sleep(0.1)
    badge = lambda: pg.evaluate("(()=>{const e=window.__app.mode.editor; const i=(e.tool==='dim'?e.st.vpt:e.st.inf); return (i&&i.label||'')+'|'+e.curKind})()")
    rels = lambda: ed("return d.rels.map(r=>r.t).join(',')")
    tool = lambda t: ed(f"e.setTool('{t}')")
    # 1) eğik çizgi, sonra dik çıkarım
    tool("line"); ck(-60,-40); ck(-20,-10)  # eğim 3/4
    # dik yön: (-3,4)/5 -> 40 birim: (-44, 22)
    mv(-20-24+0.8, -10+32+0.5); print("perp badge:", badge())
    ck(-20-24+0.8, -10+32+0.5); print("rels after perp:", rels())
    # doğrusal: bu çizginin uzantısı (yön (-3,4))
    mv(-44-12+0.6, 22+16+0.4); print("collinear badge:", badge())
    pg.keyboard.press("Escape"); time.sleep(0.1)
    # 2) uyandırma: p (-60,-40) üzerinde bekle, sonra dikey hizaya git
    tool("line"); ck(40,60)
    mv(-60,-40); time.sleep(0.35); mv(-60,-40,1); time.sleep(0.05)
    mv(-59.3, 20); print("wake badge:", badge(), "guides:", ed("return (e.st.inf.guides||[]).map(g=>g.rel?'Y':'B').join('')"), "p:", ed("return e.st.inf.p.map(v=>+v.toFixed(3))"))
    pg.keyboard.press("Escape"); pg.keyboard.press("Escape")
    # 3) kesişim: iki kesişen çizgi
    tool("line"); ck(60,-60); ck(120,0); pg.keyboard.press("Escape")
    tool("line"); ck(60,-30); ck(110,-50); pg.keyboard.press("Escape")
    tool("point"); mv(82,-38); print("isect badge:", badge(), ed("return e.st.inf.p.map(v=>+v.toFixed(2))")); ck(82,-38)
    print("isect rels:", rels())
    # 4) çeyrek nokta
    tool("circle"); ck(0,80); ck(25,80)
    tool("point"); mv(0.6, 104.6); print("quadrant badge:", badge())
    # 5) Ctrl bastırma
    pg.keyboard.down("Control"); mv(0.6,104.6,2); print("ctrl badge:", repr(badge()), ed("return e.st.inf.p.map(v=>+v.toFixed(2))")); pg.keyboard.up("Control")
    print("errors:", logs)

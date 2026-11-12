import cmdpatch, time
from playwright.sync_api import sync_playwright
from h import wait_ready, sketch, ext, run, TOP
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto('http://localhost:4173/'); wait_ready(pg); time.sleep(0.4)
    run(pg, "box", [sketch("s1","S",TOP,lambda pt,line,rect,c,t: rect(-50,-30,50,30)), ext("e1","s1",20)])
    pg.evaluate("window.__app.viewer.viewStd('top')"); time.sleep(0.2)
    r = pg.query_selector("#view").bounding_box()
    sc = lambda w: (lambda q: (r["x"]+q[0], r["y"]+q[1]))(pg.evaluate(f"window.__app.viewer.toScreen({w})"))
    x,y = sc("[0,20,0]"); pg.mouse.click(x+30,y+20); pg.mouse.click(x+30,y+20, button='right'); pg.click(".sw-ctx .sw-mi:has-text('Eskiz')"); time.sleep(0.5)
    ed = lambda js: pg.evaluate(f"(()=>{{const e=window.__app.mode.editor; const d=e.data; {js}}})()")
    ed("e.opts.quickDim=false; e.setTool('circle')")
    a=sc("[10,20,-5]"); b2=sc("[20,20,-5]"); pg.mouse.click(*a); pg.mouse.click(*b2)
    ed("e.setTool('dim')")
    # dairenin sağ çeyreği → model sağ kenar ortası (50,20,0)
    q=sc("[20,20,-5]"); pg.mouse.move(q[0],q[1],steps=3); print("hover quad:", pg.evaluate("(()=>{const e=window.__app.mode.editor; const i=(e.tool==='dim'?e.st.vpt:e.st.inf); return (i&&i.label||'')+'|'+e.curKind})()"))
    pg.mouse.click(*q)
    m=sc("[50,20,0]"); pg.mouse.move(m[0],m[1],steps=3); print("hover model mid:", pg.evaluate("(()=>{const e=window.__app.mode.editor; const i=(e.tool==='dim'?e.st.vpt:e.st.inf); return (i&&i.label||'')+'|'+e.curKind})()"))
    pg.mouse.click(*m); l=sc("[35,20,-25]"); pg.mouse.click(*l); time.sleep(0.2)
    print("prompt:", pg.locator(".dim-prompt").count()); pg.fill(".dim-prompt input","25"); pg.press(".dim-prompt input","Enter"); time.sleep(0.3)
    print("dims:", ed("return d.dims.map(x=>x.t+(x.sub||'')+':'+x.v)"), "status:", pg.inner_text("#status-text"))
    print("errors:", logs)

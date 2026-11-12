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
    ed("e.opts.quickDim=false; e.setTool('point')")
    # model kenarı üzerinde (köşe/orta dışı): (20, 20, 30)
    xe,ye = sc("[20,20,30]"); pg.mouse.move(xe,ye+1,steps=3); print("on model badge:", pg.evaluate("document.querySelector('.sk-badge')?.title")); pg.mouse.click(xe,ye+1)
    print("rels:", ed("return d.rels.map(r=>r.t).join(',')"), "status:", pg.inner_text("#status-text"))
    # kendi dikdörtgenimiz ve merkezi
    ed("e.setTool('rect')"); a=sc("[-40,20,-20]"); b2=sc("[0,20,10]"); pg.mouse.click(*a); pg.mouse.click(*b2)
    ed("e.setTool('circle')"); cx,cy = sc("[-20,20,-5]"); pg.mouse.move(cx+1,cy,steps=3); print("rect center badge:", pg.evaluate("document.querySelector('.sk-badge')?.title"))
    pg.mouse.click(cx+1,cy); pg.mouse.click(cx+40,cy)
    print("circle center:", ed("const c=d.ents.find(x=>x.t==='circle'); return [d.pts[c.c].x.toFixed(2), d.pts[c.c].y.toFixed(2)]"), "rels:", ed("return d.rels.map(r=>r.t).join(',')"))
    print("errors:", logs)

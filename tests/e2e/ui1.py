import cmdpatch
import time
from playwright.sync_api import sync_playwright
from h import wait_ready, sketch, ext, run, TOP
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto('http://localhost:4173/'); wait_ready(pg); time.sleep(0.4)
    print("chips:", pg.locator("#cmds .cmd-chip").all_inner_texts(), "items:", pg.locator("#cmds .cmd").count())
    pg.click("#cmds .cmd-chip:has-text('Detay')"); print("after Detay:", pg.locator("#cmds .cmd .lbl").all_inner_texts()[:8])
    run(pg, "box", [sketch("s1","S",TOP,lambda pt,line,rect,c,t: rect(-50,-30,50,30)), ext("e1","s1",20)])
    # üst yüzde eskiz
    pg.evaluate("window.__app.viewer.viewStd('top')"); time.sleep(0.2)
    r = pg.query_selector("#view").bounding_box()
    s = pg.evaluate("window.__app.viewer.toScreen([0,20,0])"); pg.mouse.click(r["x"]+s[0], r["y"]+s[1]); time.sleep(0.2)
    pg.mouse.click(r['x']+s[0], r['y']+s[1], button='right'); pg.click(".sw-ctx .sw-mi:has-text('Eskiz')"); time.sleep(0.5)
    print("mode:", pg.evaluate("window.__app.mode.k"), "modelPts:", pg.evaluate("window.__app.mode.editor.modelPts.length"))
    pg.evaluate("(()=>{const e=window.__app.mode.editor; e.opts.quickDim=false; e.setTool('line')})()")
    sc = lambda w: (lambda q: (r["x"]+q[0], r["y"]+q[1]))(pg.evaluate(f"window.__app.viewer.toScreen({w})"))
    x,y = sc("[50,20,30]"); x2,y2 = sc("[50,20,-30]")
    pg.mouse.move(x+2,y+2, steps=4); print("badge corner:", pg.evaluate("(()=>{const e=window.__app.mode.editor; const i=(e.tool==='dim'?e.st.vpt:e.st.inf); return (i&&i.label||'')+'|'+e.curKind})()"), "cursor:", pg.evaluate("window.__app.viewer.renderer.domElement.style.cursor.slice(0,12)"))
    xm,ym = sc("[50,20,0]"); pg.mouse.move(xm+1,ym+1, steps=4); print("badge mid:", pg.evaluate("(()=>{const e=window.__app.mode.editor; const i=(e.tool==='dim'?e.st.vpt:e.st.inf); return (i&&i.label||'')+'|'+e.curKind})()"))
    pg.mouse.click(x+2,y+2); pg.mouse.click(xm+1,ym+1); pg.keyboard.press("Escape")
    print("fix rels:", pg.evaluate("window.__app.mode.editor.data.rels.map(r=>r.t).join(',')"), pg.inner_text("#status-text"))
    # dim tool on model edge
    pg.evaluate("window.__app.mode.editor.setTool('dim')")
    xe,ye = sc("[0,20,30]"); pg.mouse.click(xe,ye+0); pg.mouse.click(xe+10, ye+40); time.sleep(0.2)
    print("dim prompt:", pg.locator(".dim-prompt").count())
    print("errors:", logs)

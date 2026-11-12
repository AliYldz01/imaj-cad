import cmdpatch, time
from playwright.sync_api import sync_playwright
from h import wait_ready, sketch, ext, run, TOP
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto('http://localhost:4173/'); wait_ready(pg); time.sleep(0.4)
    run(pg, "box", [sketch("s1","S",TOP,lambda pt,line,rect,c,t: rect(-50,-30,50,30)), ext("e1","s1",20)])
    pg.keyboard.press("Control+1"); pg.keyboard.press("f"); time.sleep(0.3)
    pg.click("#tree li:has-text('e1')"); time.sleep(0.3)
    ar = pg.locator(".i3d .i3d-ar"); print("i3d visible:", ar.is_visible(), pg.inner_text(".i3d .i3d-v"))
    bb = ar.bounding_box(); x,y = bb["x"]+16, bb["y"]+17
    pg.mouse.move(x,y); pg.mouse.down(); pg.mouse.move(x, y-60, steps=6); pg.mouse.up(); time.sleep(0.6); wait_ready(pg)
    print("after drag bb:", pg.evaluate("window.__app.viewer.mesh.bbox.max"))
    # display styles
    for st in ["shaded","hlr","hlv","wire","shadedEdges"]:
        pg.evaluate(f"window.__app.viewer.setStyle('{st}')"); time.sleep(0.1)
    pg.evaluate("window.__app.viewer.setStyle('hlv')"); time.sleep(0.2); pg.screenshot(path="pb2_hlv.png")
    pg.evaluate("window.__app.viewer.setStyle('shadedEdges')")
    print("errors:", logs)

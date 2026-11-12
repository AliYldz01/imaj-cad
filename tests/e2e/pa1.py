import cmdpatch, time
from playwright.sync_api import sync_playwright
from h import wait_ready, sketch, ext, run, TOP
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e))); pg.on("dialog", lambda d: d.accept("YeniAd"))
    pg.goto('http://localhost:4173/'); wait_ready(pg); time.sleep(0.4)
    run(pg, "box", [sketch("s1","S",TOP,lambda pt,line,rect,c,t: rect(-50,-30,50,30)), ext("e1","s1",20)])
    pg.evaluate("window.__app.viewer.viewStd('iso')"); pg.keyboard.press("f"); time.sleep(0.3)
    r = pg.query_selector("#view").bounding_box()
    sc = lambda w: (lambda q: (r["x"]+q[0], r["y"]+q[1]))(pg.evaluate(f"window.__app.viewer.toScreen({w})"))
    x,y = sc("[0,20,0]"); pg.mouse.click(x,y); time.sleep(0.2)
    print("minibar:", pg.locator(".minibar .sw-sb").evaluate_all("els=>els.map(e=>e.title)"))
    sel = lambda: pg.evaluate("(()=>{const a=window.__app; return a.psel? [...a.psel.faces]:null})()")
    pg.mouse.click(x,y); time.sleep(0.2); print("select other -> hint:", pg.inner_text("#hint"))
    # box select: drag from empty
    pg.keyboard.press("Escape")
    a=sc("[-80,0,-80]"); b2=sc("[80,40,80]")
    pg.mouse.move(r["x"]+150, r["y"]+r["height"]-40); pg.mouse.down(); pg.mouse.move(r["x"]+r["width"]-100, r["y"]+120, steps=8); pg.mouse.up(); time.sleep(0.2)
    print("box select hint:", pg.inner_text("#hint"))
    # live modify: sketch + dim + live update
    print("errors:", logs)

import cmdpatch, time
from playwright.sync_api import sync_playwright
from h import wait_ready, sketch, ext, run, TOP
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}, accept_downloads=True); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto('http://localhost:4173/'); wait_ready(pg); time.sleep(0.4)
    sq = sketch("a","Kare",TOP,lambda pt,line,rect,c,t: rect(-50,-50,50,50))
    pl = {"id":"p1","type":"plane","name":"D1","base":TOP,"offset":80,"flip":False}
    ci = sketch("b","Daire",{"k":"ref","id":"p1"},lambda pt,line,rect,c,t: c(0,0,30))
    lf = {"id":"L","type":"loft","name":"Huni","sketches":["a","b"],"cut":False,"ruled":True,"sheetT":2}
    run(pg, "hopper", [sq, pl, ci, lf])
    print("vol:", pg.evaluate("window.__app.kernel.props ? 'ok' : 'n/a'"))
    pg.click("#tree li:has-text('Huni')"); pg.dblclick("#tree li:has-text('Huni')"); time.sleep(0.5)
    with pg.expect_download() as dl: pg.click("#pm-body button:has-text('Açınım')")
    d = dl.value; path = "/tmp/huni.dxf"; d.save_as(path)
    print("toast:", pg.inner_text("#toast"))
    txt = open(path).read(); print("dxf vertices:", txt.count("\n10\n"))
    print("errors:", logs)

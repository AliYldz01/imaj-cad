from h import *
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e))); pg.on("console", lambda m: print("CONSOLE", m.text) if "THREADDBG" in m.text else None)
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    cyl = sketch("s7","C",TOP, lambda pt,line,rect,circle,text: circle(0,0,10))
    base=[cyl, ext("c1","s7",d1=40)]
    run(pg,"cyl",base)
    cf = pg.evaluate("window.__app.viewer.mesh.faces.find(f=>f.type==='CYLINDRE').c")
    t0=time.time()
    run(pg,"thread M20", base+[{"id":"th","type":"thread","name":"T","face":{"c":cf,"r":10},"pitch":2.5,"length":30,"left":False,"fromEnd":True}])
    print("  time", round(time.time()-t0,1), "vol", pg.evaluate("async()=>(await window.__app.kernel.cutList()).map(c=>Math.round(c.vol))"))
    pg.keyboard.press('Control+1'); pg.click("#viewbar button[title='Ekrana sığdır']"); time.sleep(0.5); pg.screenshot(path="k2.png", clip={"x":450,"y":150,"width":600,"height":600})
    # iç diş: blok içinde delik
    blk = sketch("s8","B",TOP, lambda pt,line,rect,circle,text: (rect(-30,-30,30,30), circle(0,0,8.5)))
    run(pg,"block hole",[blk, ext("x1","s8",d1=30)])
    cf = pg.evaluate("window.__app.viewer.mesh.faces.find(f=>f.type==='CYLINDRE').c")
    run(pg,"internal thread", [blk, ext("x1","s8",d1=30), {"id":"th","type":"thread","name":"T","face":{"c":cf,"r":8.5},"pitch":2.5,"length":0,"left":False,"fromEnd":False}])
    print("  vol", pg.evaluate("async()=>(await window.__app.kernel.cutList()).map(c=>Math.round(c.vol))"))
    print("errors:", logs[:5] or "none")
    b.close()

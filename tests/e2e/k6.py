import cmdpatch
from h import *
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    box = sketch("s1","S1",TOP, lambda pt,line,rect,circle,text: rect(0,0,100,60))
    feats=[box, ext("e1","s1",d1=40), {"id":"sh","type":"shell","name":"K","t":2,"faces":[{"c":[50,40,-30],"n":[0,1,0]}]}]
    run(pg,"shelled",feats)
    bends=[{"m":[50,0,0]},{"m":[50,0,-60]},{"m":[0,0,-30]},{"m":[100,0,-30]}]
    rips=[{"m":[0,20,0]},{"m":[100,20,0]},{"m":[0,20,-60]},{"m":[100,20,-60]}]
    run(pg,"to sheet", feats+[{"id":"ts","type":"tosheet","name":"S","bends":bends,"rips":rips,"t":2,"r":2,"k":0.5,"relief":0.5,"gap":0.5}])
    r = pg.evaluate("async()=>{const r=await window.__app.kernel.flat(0,2,0.5); return {err:r.error, w:r.w&&+r.w.toFixed(2), h:r.h&&+r.h.toFixed(2), bends:r.bends.length}}")
    print("  flat:", r)
    pg.click(".vcube .iso"); pg.click("#viewbar button[title='Ekrana sığdır']"); time.sleep(0.4); pg.screenshot(path="k6.png", clip={"x":400,"y":150,"width":700,"height":600})
    print("errors:", logs[:5] or "none")
    b.close()

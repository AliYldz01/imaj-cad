import cmdpatch
from h import *
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    a = sketch("s1","A",TOP, lambda pt,line,rect,circle,text: circle(0,0,20))
    pl = {"id":"pl1","type":"plane","name":"D1","base":TOP,"offset":100,"flip":False}
    bb = sketch("s2","B",{"k":"ref","id":"pl1"}, lambda pt,line,rect,circle,text: rect(-15,-15,15,15))
    g = {"id":"s3","type":"sketch","name":"K","plane":FRONT,"data":{"pts":{"a":{"x":20,"y":0},"b":{"x":15,"y":100},"c":{"x":45,"y":50}},"ents":[{"id":"sp","t":"spline","pts":["a","c","b"]}],"rels":[],"dims":[],"seq":5}}
    lf = {"id":"lf","type":"loft","name":"L","sketches":["s1","s2"],"cut":False,"ruled":False}
    run(pg,"plain loft",[a,pl,bb,dict(lf)])
    run(pg,"guided loft",[a,pl,bb,g,dict(lf, guides=["s3"])])
    pg.click(".vcube .iso"); pg.click("#viewbar button[title='Ekrana sığdır']"); time.sleep(0.4); pg.screenshot(path="k4.png", clip={"x":400,"y":100,"width":700,"height":700})
    print("errors:", logs[:5] or "none")
    b.close()

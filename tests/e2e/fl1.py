# küp: önce üst kenarlar radyüs, sonra düşey kenarlar radyüs (SolidWorks'te çalışır)
import cmdpatch, time, os
from h import *
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900})
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    cube = [sketch("s1","S",TOP,lambda pt,line,rect,c,t: rect(-50,-50,50,50)), ext("e1","s1",100)]
    pg.evaluate("d=>window.__app.setDoc(d)", {"version":2,"name":"T","features":cube,"seq":{}}); time.sleep(0.5); wait_ready(pg)
    E = pg.evaluate("window.__app.viewer.mesh.edges.map(e=>({m:e.m,d:e.d}))")
    top = [e for e in E if abs(e["m"][1]-100)<1e-3]
    vert = [e for e in E if abs(abs(e["d"][1])-1)<1e-3]
    print("edges top/vert:", len(top), len(vert))
    for R1,R2 in [(10,10),(10,5),(10,20),(5,10)]:
        f1 = {"id":"f1","type":"fillet","name":"R1","edges":top,"r":R1}
        pg.evaluate("d=>window.__app.setDoc(d)", {"version":2,"name":"T","features":cube+[f1],"seq":{}}); time.sleep(0.4); wait_ready(pg)
        E2 = pg.evaluate("window.__app.viewer.mesh.edges.map(e=>({m:e.m,d:e.d}))")
        vert2 = [e for e in E2 if e["d"] and abs(abs(e["d"][1])-1)<1e-3]
        f2 = {"id":"f2","type":"fillet","name":"R2","edges":vert2,"r":R2}
        pg.evaluate("d=>window.__app.setDoc(d)", {"version":2,"name":"T","features":cube+[f1,f2],"seq":{}}); time.sleep(0.6); wait_ready(pg)
        print(R1,R2,"vert:",len(vert2), pg.inner_text('#status-text'), pg.eval_on_selector_all("#tree li.err", "els=>els.map(e=>e.title)"))

import cmdpatch
from h import *
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    plate=sketch("s2","Levha",TOP, lambda pt,line,rect,circle,text: rect(-100,-100,100,100))
    pid=[]
    col=sketch("s3","Dikme",FRONT, lambda pt,line,rect,circle,text: (pid.append(line(pt(0,50),pt(0,300))), pid.append(line(pt(50,-40),pt(120,250)))))
    m={"id":"m1","type":"member","name":"Y","segs":[{"sk":"s3","ent":i} for i in pid],"std":"kutu","size":"40x40x3","align":"c","mirror":False,"rot":0,"corner":"none","gap":0}
    t={"id":"t1","type":"trim","name":"K","targets":[{"f":"m1","i":0},{"f":"m1","i":1}],"bounds":[],"faces":[{"c":[0,10,0],"n":[0,1,0]}]}
    run(pg,"face trim",[plate, ext("x1","s2",d1=10), col, m, t])
    print("  ", pg.evaluate("async()=>(await window.__app.kernel.cutList()).map(c=>[c.kind,c.name,+c.length.toFixed(2),+c.a1.toFixed(1),+c.a2.toFixed(1)])"))
    for sz in ["UPN 100","UPN 200"]:
        print("  ", sz, pg.evaluate(f"(()=>{{return 1}})()"))
    print("errors:", logs[:5] or "none")
    b.close()

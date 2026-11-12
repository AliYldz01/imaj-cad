import cmdpatch, time
from playwright.sync_api import sync_playwright
from h import wait_ready, sketch, ext, run, TOP, FRONT
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto('http://localhost:4173/'); wait_ready(pg); time.sleep(0.4)
    box = [sketch("s1","S",TOP,lambda pt,line,rect,c,t: rect(-50,-30,50,30)), ext("e1","s1",20)]
    sh = lambda out: {"id":"sh","type":"shell","name":"K","t":3,"faces":[{"c":[0,20,0],"n":[0,1,0]}], **({"out":True} if out else {})}
    run(pg, "shell in", box+[sh(False)])
    run(pg, "shell out", box+[sh(True)])
    # sweep circular profile along L path
    def path(pt,line,rect,c,t):
        a=pt(0,0); b2=pt(0,60); c2=pt(40,60); line(a,b2); line(b2,c2)
    run(pg, "sweep circ", [sketch("p","P",FRONT,path), {"id":"sw","type":"sweep","name":"S","sketch":"","path":"p","cut":False,"circ":10,"circIn":6}])
    run(pg, "sweep circ normal", [sketch("p","P",FRONT,path), {"id":"sw","type":"sweep","name":"S","sketch":"","path":"p","cut":False,"circ":10,"orient":"normal"}])
    # pattern skip
    hole = sketch("s2","H",TOP,lambda pt,line,rect,c,t: c(-40,0,3))
    lp = {"id":"lp","type":"lpattern","name":"LP","feats":["e2"],"axis":"x","rev":False,"count":5,"spacing":20,"dir2":False,"axis2":"z","rev2":False,"count2":1,"spacing2":10}
    run(pg, "pattern 5", box+[hole, ext("e2","s2",5,cut=True,end="through"), lp])
    run(pg, "pattern skip 2,4", box+[hole, ext("e2","s2",5,cut=True,end="through"), {**lp, "skip":["2","4"]}])
    print("errors:", logs)

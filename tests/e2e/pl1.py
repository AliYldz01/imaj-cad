import cmdpatch, time
from playwright.sync_api import sync_playwright
from h import wait_ready, sketch, ext, run, TOP, FRONT
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto('http://localhost:4173/'); wait_ready(pg); time.sleep(0.4)
    def pl(id, **kw):
        d={"id":id,"type":"plane","name":id,"base":TOP,"offset":0,"flip":False}; d.update(kw); return d
    REF=lambda id: {"k":"ref","id":id}
    sm = lambda id, plane: sketch(id, id, plane, lambda pt,line,rect,c,t: c(0,0,5))
    run(pg, "angle 90 about z-edge", [pl("p1", mode="angle", base=TOP, edge={"m":[0,0,0],"d":[0,0,1]}, angle=90), sm("s1", REF("p1")), ext("e1","s1",10)])
    run(pg, "3pt plane y=10", [pl("p1", mode="3pt", pts=[[0,10,0],[10,10,0],[0,10,10]]), sm("s1", REF("p1")), ext("e1","s1",5)])
    run(pg, "mid plane top+offset40", [pl("p0", base=TOP, offset=40), pl("p1", mode="mid", base=TOP, base2=REF("p0")), sm("s1", REF("p1")), ext("e1","s1",3)])
    run(pg, "normal to edge at pt", [pl("p1", mode="normal", edge={"m":[5,5,5],"d":[1,0,0]}, pts=[[30,0,0]]), sm("s1", REF("p1")), ext("e1","s1",4)])
    run(pg, "parallel through pt", [pl("p1", mode="parallelPt", base=FRONT, pts=[[0,0,25]]), sm("s1", REF("p1")), ext("e1","s1",4)])
    print("errors:", logs)

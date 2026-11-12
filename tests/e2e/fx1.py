import cmdpatch, time
from playwright.sync_api import sync_playwright
from h import wait_ready, sketch, ext, run, TOP, FRONT
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto('http://localhost:4173/'); wait_ready(pg); time.sleep(0.4)
    two = sketch("s1","S",TOP,lambda pt,line,rect,c,t: (rect(-60,-20,-20,20), rect(20,-20,60,20), c(40,0,5)))
    run(pg, "all contours", [two, ext("e1","s1",10)])
    run(pg, "contour 2 (with hole)", [two, ext("e1","s1",10, contours=[1])])
    run(pg, "contour 1", [two, ext("e1","s1",10, contours=[0])])
    base = sketch("s0","B",TOP,lambda pt,line,rect,c,t: rect(-50,-50,50,50))
    small = sketch("s2","C",TOP,lambda pt,line,rect,c,t: c(0,0,10))
    run(pg, "flip cut", [base, ext("e0","s0",20), small, ext("e2","s2",5, cut=True, end="through", flipCut=True)])
    run(pg, "up to vertex", [base, ext("e0","s0",20), small, ext("e2","s2",5, end="vertex", vtx=[50,37,50])])
    run(pg, "dir vector", [small, ext("e2","s2",30, dirVec=[1,1,0])])
    run(pg, "from offset face", [base, ext("e0","s0",20), small, ext("e2","s2",10, fromFace={"c":[0,20,0],"n":[0,1,0]})])
    print("errors:", logs)

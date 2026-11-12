import cmdpatch
from h import *
def base(id="b1", sk="s1", t=2, r=2, k=0.5, **kw):
    f={"id":id,"type":"sheetbase","name":"Taban-Flanş1","sketch":sk,"t":t,"r":r,"k":k,"rev":False,"d":40,"mid":False,"relief":0.5}; f.update(kw); return f
def ef(id, edges, L=30, **kw):
    f={"id":id,"type":"edgeflange","name":id,"edges":[{"m":m} for m in edges],"L":L,"angle":90,"pos":"inside","lenRef":"outer","flip":False,"useDef":True,"r":2,"o1":0,"o2":0,"gap":0.2}; f.update(kw); return f
def flat(pg, k=0.5, t=2):
    r = pg.evaluate(f"async()=>{{const r=await window.__app.kernel.flat(0,{t},{k}); return {{err:r.error, w:r.w&&+r.w.toFixed(3), h:r.h&&+r.h.toFixed(3), area:r.area&&+r.area.toFixed(2), n:r.outline.length, kinds:[...new Set(r.outline.map(o=>o.k))], bends:r.bends.map(b=>[+b.angle.toFixed(1), b.up, +b.r.toFixed(2)])}}}}")
    print("   flat:", r); return r
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e))); pg.on("dialog", lambda d: d.accept())
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    plate = sketch("s1","Eskiz1",TOP, lambda pt,line,rect,circle,text: rect(0,0,100,60))
    run(pg,"base plate",[plate, base()]); flat(pg)
    run(pg,"one flange",[plate, base(), ef("e1",[[50,2,0]])]); flat(pg)
    run(pg,"flange bendout",[plate, base(), ef("e1",[[50,2,0]],pos="bendout")]); flat(pg)
    run(pg,"flange 45 offs",[plate, base(), ef("e1",[[50,2,0]],angle=45,o1=10,o2=20)]); flat(pg)
    run(pg,"four flanges",[plate, base(), ef("e1",[[50,2,0],[50,2,-60],[0,2,-30],[100,2,-30]])]); flat(pg)
    run(pg,"flange down",[plate, base(), ef("e1",[[50,0,0]])]); flat(pg)
    run(pg,"hem",[plate, base(), {"id":"h1","type":"hem","name":"Kenet1","edges":[{"m":[50,2,0]}],"kind":"open","L":10,"gap":1,"pos":"inside","flip":False}]); flat(pg)
    L = sketch("s2","Eskiz2",FRONT, lambda pt,line,rect,circle,text: (lambda a,b_,c: (line(a,b_),line(b_,c)))(pt(0,0),pt(50,0),pt(50,30)))
    run(pg,"open base",[L, base(sk="s2")]); flat(pg)
    fr={"o":[0,2,0],"x":[1,0,0],"n":[0,1,0]}
    hole = sketch("s3","Eskiz3",{"k":"face","frame":fr,"face":{"c":[50,2,-30],"n":[0,1,0]}}, lambda pt,line,rect,circle,text: circle(50,30,5))
    run(pg,"with hole",[plate, base(), ef("e1",[[50,2,0]]), hole, ext("x1","s3",cut=True,end="through")]); flat(pg)
    bl = sketch("s4","Eskiz4",{"k":"face","frame":fr,"face":{"c":[50,2,-30],"n":[0,1,0]}}, lambda pt,line,rect,circle,text: line(pt(-10,30),pt(110,30)))
    run(pg,"sketch bend",[plate, base(), bl, {"id":"sb","type":"sketchbend","name":"Büküm1","sketch":"s4","angle":90,"side":True,"flip":False,"pos":"center","useDef":True,"r":2}]); flat(pg)
    print("errors:", logs[:5] or "none")
    b.close()

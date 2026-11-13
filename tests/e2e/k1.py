import cmdpatch
from h import *
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    vol = lambda: pg.evaluate("async()=>(await window.__app.kernel.cutList()).map(c=>Math.round(c.vol))")
    box = sketch("s1","S1",FRONT, lambda pt,line,rect,circle,text: rect(0,0,100,60))
    box2 = sketch("s2","S2",FRONT, lambda pt,line,rect,circle,text: rect(50,30,150,90))
    two=[box, ext("e1","s1",d1=20), box2, ext("e2","s2",d1=20,merge=False)]
    F = lambda **kw: kw
    run(pg,"two bodies",two); print("  vols", vol())
    for op in ["add","sub","common"]:
        run(pg,"combine "+op, two+[{"id":"c1","type":"combine","name":"B","op":op,"main":{"c":[50,30,20],"n":[0,0,1]},"tools":[{"c":[100,60,20],"n":[0,0,1]}]}]); print("  vols", vol())
    run(pg,"split", [box, ext("e1","s1",d1=20), {"id":"sp","type":"splitbody","name":"S","body":{"c":[50,30,20],"n":[0,0,1]},"plane":{"k":"face","frame":{"o":[40,0,0],"x":[0,0,1],"n":[1,0,0]}}}]); print("  vols", vol())
    run(pg,"move copy", [box, ext("e1","s1",d1=20), {"id":"mv","type":"movebody","name":"M","body":{"c":[50,30,20],"n":[0,0,1]},"copy":True,"d":[0,0,50],"axis":"z","angle":30}]); print("  vols", vol())
    run(pg,"delete", two+[{"id":"db","type":"delbody","name":"D","bodies":[{"c":[100,60,20],"n":[0,0,1]}],"keep":False}]); print("  vols", vol())
    run(pg,"indent", two+[{"id":"in","type":"indent","name":"I","target":{"c":[50,30,20],"n":[0,0,1]},"tool":{"c":[100,60,20],"n":[0,0,1]},"clearance":2,"keepTool":True}]); print("  vols", vol())
    run(pg,"start offset", [box, ext("e1","s1",d1=20,startOff=30)])
    # çoğaltmalar
    plate = sketch("s3","P",TOP, lambda pt,line,rect,circle,text: rect(0,0,200,120))
    hole = sketch("s4","H",{"k":"face","frame":{"o":[0,10,0],"x":[1,0,0],"n":[0,1,0]},"face":{"c":[100,10,-60],"n":[0,1,0]}}, lambda pt,line,rect,circle,text: circle(20,20,5))
    base=[plate, ext("p1","s3",d1=10), hole, ext("h1","s4",cut=True,end="through")]
    pts = sketch("s5","N",{"k":"face","frame":{"o":[0,10,0],"x":[1,0,0],"n":[0,1,0]},"face":{"c":[100,10,-60],"n":[0,1,0]}}, lambda pt,line,rect,circle,text: [None for x in [0]] )
    pts["data"]["ents"]=[{"id":f"q{i}","t":"point","p":f"pp{i}"} for i in range(3)]
    for i,(x,y) in enumerate([(60,20),(100,60),(150,90)]): pts["data"]["pts"][f"pp{i}"]={"x":x,"y":y}
    run(pg,"sketch pattern", base+[pts, {"id":"sp1","type":"spattern","name":"SP","feats":["h1"],"sketch":"s5"}])
    run(pg,"table pattern", base+[{"id":"tp","type":"tpattern","name":"TP","feats":["h1"],"rows":[[30,0,0],[60,0,-30],[0,0,-60]]}])
    path = sketch("s6","Y",{"k":"face","frame":{"o":[0,10,0],"x":[1,0,0],"n":[0,1,0]},"face":{"c":[100,10,-60],"n":[0,1,0]}}, lambda pt,line,rect,circle,text: line(pt(20,20),pt(180,100)))
    run(pg,"curve pattern", base+[path, {"id":"cp","type":"cvpattern","name":"CP","feats":["h1"],"sketch":"s6","count":5,"spacing":30,"equal":True,"align":False}])
    run(pg,"fill pattern", base+[{"id":"fp","type":"fpattern","name":"FP","feats":["h1"],"face":{"c":[100,10,-60],"n":[0,1,0]},"spacing":25,"layout":"stagger","margin":8,"angle":0}])
    # diş
    cyl = sketch("s7","C",TOP, lambda pt,line,rect,circle,text: circle(0,0,10))
    run(pg,"thread M20", [cyl, ext("c1","s7",d1=40), {"id":"th","type":"thread","name":"T","face":{"c":[0,20,6.37],"r":10},"pitch":2.5,"length":30,"left":False,"fromEnd":True}])
    # esnet
    bar = sketch("s8","B",FRONT, lambda pt,line,rect,circle,text: rect(0,0,200,20))
    for mode,val in [("bend",90),("twist",90),("taper",0.5),("stretch",1.5)]:
        run(pg,"flex "+mode, [bar, ext("b1","s8",d1=5), {"id":"fx","type":"flex","name":"F","body":{"c":[100,10,5],"n":[0,0,1]},"mode":mode,"axis":"x","value":val,"dir":"y"}]); print("  vols", vol())
    run(pg,"vertex chamfer", [box, ext("e1","s1",d1=20), {"id":"vc","type":"vchamfer","name":"V","v":[100,60,20],"d":10}]); print("  vols", vol())
    run(pg,"interfere", two)
    print("  interfere:", pg.evaluate("async()=>await window.__app.kernel.interfere()"))
    print("errors:", logs[:5] or "none")
    b.close()

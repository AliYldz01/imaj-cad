import cmdpatch
from h import *
def mem(id, segs, std="dkutu", size="60x40x3", corner="miter", **kw):
    f={"id":id,"type":"member","name":id,"segs":[{"sk":s,"ent":e} for s,e in segs],"std":std,"size":size,"align":"c","mirror":False,"rot":0,"corner":corner,"gap":0}; f.update(kw); return f
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    ids=[]
    def frame(pt,line,rect,circle,text):
        a,b_,c,d=pt(0,0),pt(1000,0),pt(1000,600),pt(0,600)
        ids.extend([line(a,b_),line(b_,c),line(c,d),line(d,a), line(pt(500,0),pt(500,600))])
    sk=sketch("s1","İskelet",FRONT, frame)
    base=[sk, mem("m1",[("s1",i) for i in ids[:4]]), mem("m2",[("s1",ids[4])]), {"id":"t1","type":"trim","name":"K","targets":[{"f":"m2","i":0}],"bounds":[{"f":"m1","i":0},{"f":"m1","i":2}]}]
    W=lambda **kw: dict({"id":"w1","type":"weld","name":"W","pairs":[{"f1":{"c":[470,300,0],"n":[-1,0,0]},"f2":{"c":[500,30,0],"n":[0,1,0]}},{"f1":{"c":[530,300,0],"n":[1,0,0]},"f2":{"c":[500,30,0],"n":[0,1,0]}}],"a":3,"intermittent":False,"len":50,"pitch":100}, **kw)
    run(pg,"weld fillet",base+[W()])
    r=pg.evaluate("async()=>(await window.__app.kernel.cutListFull()).welds"); print("  welds:", r)
    # kesikli: uzun kenar boyunca: alt elemanın ön yüzü ile ... örnek: dikmenin ön yüzü (z=20) değil; iki elemanın 940mm ortak kenarı yok -> plaka ile
    plate=sketch("s2","Levha",TOP, lambda pt,line,rect,circle,text: rect(-100,-100,100,100))
    pid=[]
    pipe=sketch("s3","Boru",FRONT, lambda pt,line,rect,circle,text: pid.append(line(pt(0,10),pt(0,300))))
    pp=[plate, ext("x1","s2",d1=10), pipe, mem("m3",[("s3",pid[0])],std="boru",size="48.3x3.2",corner="none")]
    run(pg,"pipe only",pp)
    cf = pg.evaluate("window.__app.viewer.mesh.faces.find(f=>f.type==='CYLINDRE' && Math.abs(f.r-24.15)<0.01).c")
    run(pg,"pipe plate",pp+[{"id":"w2","type":"weld","name":"W","pairs":[{"f1":{"c":cf,"n":None,"r":24.15},"f2":{"c":[0,10,0],"n":[0,1,0]}}],"a":4,"intermittent":False,"len":50,"pitch":100}])
    r=pg.evaluate("async()=>(await window.__app.kernel.cutListFull()).welds"); print("  welds:", r)
    pg.click(".vcube .iso"); pg.click("#viewbar button[title='Ekrana sığdır']"); time.sleep(0.4); pg.screenshot(path="w5.png")
    # kesikli: levha üstüne lama: lama dikey duvar
    run(pg,"intermittent",[plate, ext("x1","s2",d1=10), sketch("s4","Duvar",FRONT, lambda pt,line,rect,circle,text: rect(-90,10,90,110)), ext("x2","s4",d1=5,end="mid"), {"id":"w3","type":"weld","name":"W","pairs":[{"f1":{"c":[0,60,2.5],"n":[0,0,1]},"f2":{"c":[0,10,0],"n":[0,1,0]}}],"a":3,"intermittent":True,"len":30,"pitch":60}])
    r=pg.evaluate("async()=>(await window.__app.kernel.cutListFull()).welds"); print("  welds:", r)
    print("errors:", logs[:5] or "none")
    b.close()

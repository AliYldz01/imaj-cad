from h import *
def mem(id, segs, std="kutu", size="40x40x3", corner="miter", **kw):
    f={"id":id,"type":"member","name":id,"segs":[{"sk":s,"ent":e} for s,e in segs],"std":std,"size":size,"align":"c","mirror":False,"rot":0,"corner":corner,"gap":0}; f.update(kw); return f
def cl(pg):
    r = pg.evaluate("async()=>(await window.__app.kernel.cutList()).map(c=>[c.kind,c.name,+c.length.toFixed(2),+c.a1.toFixed(1),+c.a2.toFixed(1),+(c.vol/1000).toFixed(1)])")
    for x in r: print("    ", x)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e))); pg.on("console", lambda m: logs.append(m.text) if m.type=="warning" else None)
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    ids=[]
    def frame(pt,line,rect,circle,text):
        a,b_,c,d=pt(0,0),pt(1000,0),pt(1000,600),pt(0,600)
        ids.extend([line(a,b_),line(b_,c),line(c,d),line(d,a)])
        ids.append(line(pt(500,0),pt(500,600)))
    sk = sketch("s1","İskelet",FRONT, frame)
    four=[("s1",i) for i in ids[:4]]
    run(pg,"miter frame",[sk, mem("m1",four)]); cl(pg)
    run(pg,"butt1 frame",[sk, mem("m1",four,corner="butt1")]); cl(pg)
    run(pg,"T trim",[sk, mem("m1",four), mem("m2",[("s1",ids[4])]), {"id":"t1","type":"trim","name":"K","targets":[{"f":"m2","i":0}],"bounds":[{"f":"m1","i":0},{"f":"m1","i":2}]}]); cl(pg)
    run(pg,"T trim coped",[sk, mem("m1",four), mem("m2",[("s1",ids[4])]), {"id":"t1","type":"trim","name":"K","coped":True,"targets":[{"f":"m2","i":0}],"bounds":[{"f":"m1","i":0},{"f":"m1","i":2}]}]); cl(pg)
    run(pg,"IPE frame",[sk, mem("m1",four,std="IPE",size="IPE 200")]); cl(pg)
    run(pg,"L mirror rot",[sk, mem("m1",four,std="L",size="50x50x5",align="tl",rot=90,mirror=True)]); cl(pg)
    def arcsk(pt,line,rect,circle,text):
        pass
    arc = {"id":"s2","type":"sketch","name":"Yay","plane":TOP,"data":{"pts":{"c":{"x":0,"y":0},"s":{"x":200,"y":0},"e":{"x":0,"y":200},"p":{"x":0,"y":-300}},"ents":[{"id":"a1","t":"arc","c":"c","s":"s","e":"e","r":200},{"id":"l1","t":"line","p1":"s","p2":"p"}],"rels":[],"dims":[],"seq":10}}
    run(pg,"bent pipe",[arc, mem("m3",[("s2","a1"),("s2","l1")],std="boru",size="42.4x3.2",corner="none")]); cl(pg)
    # uç kapağı: m1 sol dikme (x=0) üst ucu değil; T dikmenin... basit: düz tek eleman
    oid=[]
    one = sketch("s3","Tek",FRONT, lambda pt,line,rect,circle,text: oid.append(line(pt(0,0),pt(0,500))))
    run(pg,"endcap",[one, mem("m4",[("s3",oid[0])],corner="none"), {"id":"e1","type":"endcap","name":"U","faces":[{"c":[0,500,0],"n":[0,1,0]}],"t":5,"inset":2}]); cl(pg)
    # köşe takviyesi: gönye çerçevenin sol alt iç köşesi: alt elemanın üst yüzü (y=20) ve sol elemanın iç yüzü (x=20)
    run(pg,"gusset",[sk, mem("m1",four), {"id":"g1","type":"gusset","name":"G","f1":{"c":[500,20,0],"n":[0,1,0]},"f2":{"c":[20,300,0],"n":[1,0,0]},"d1":100,"d2":100,"t":6,"chamfer":10,"offset":0}]); cl(pg)
    print("errors:", logs[:6] or "none")
    b.close()

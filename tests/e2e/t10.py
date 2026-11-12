import cmdpatch
import sys, time, json
from playwright.sync_api import sync_playwright
URL=sys.argv[1]
def wait_ready(pg, t=120000):
    pg.wait_for_function("!document.querySelector('#status').classList.contains('busy') && !document.querySelector('#status-text').textContent.includes('yükleniyor')", timeout=t)
# --- yardımcılar: eskiz verisi
def sketch(id, name, plane, build):
    d={"pts":{}, "ents":[], "rels":[], "dims":[], "seq":1}
    c=[0]
    def pt(x,y):
        c[0]+=1; k=f"p{c[0]}"; d["pts"][k]={"x":x,"y":y}; return k
    def line(a,b,cons=False):
        c[0]+=1; e={"id":f"l{c[0]}","t":"line","p1":a,"p2":b}; 
        if cons: e["cons"]=True
        d["ents"].append(e); return e["id"]
    def rect(x0,y0,x1,y1):
        a,b,cc,dd=pt(x0,y0),pt(x1,y0),pt(x1,y1),pt(x0,y1); line(a,b);line(b,cc);line(cc,dd);line(dd,a)
    def circle(x,y,r):
        c[0]+=1; d["ents"].append({"id":f"c{c[0]}","t":"circle","c":pt(x,y),"r":r})
    def text(x,y,s,size):
        c[0]+=1; d["ents"].append({"id":f"x{c[0]}","t":"text","p":pt(x,y),"text":s,"size":size,"angle":0})
    build(pt,line,rect,circle,text)
    d["seq"]=c[0]+1
    return {"id":id,"type":"sketch","name":name,"plane":plane,"data":d}
FRONT={"k":"std","n":"front"}; TOP={"k":"std","n":"top"}; RIGHT={"k":"std","n":"right"}
def ext(id, sk, d1=20, **kw):
    f={"id":id,"type":"extrude","name":id,"sketch":sk,"cut":False,"end":"blind","d1":d1,"rev":False,"dir2":False,"end2":"blind","d2":10}; f.update(kw); return f
def run(pg, name, feats, extra=None):
    doc={"version":2,"name":"T","features":feats,"seq":{}}
    if extra: doc.update(extra)
    pg.evaluate("d=>window.__app.setDoc(d)", doc); time.sleep(0.4); wait_ready(pg)
    m = pg.evaluate("(()=>{const m=window.__app.viewer.mesh; return m&&{f:m.faces.length, bodies:m.bodies, bb:[m.bbox.min.map(v=>+v.toFixed(2)),m.bbox.max.map(v=>+v.toFixed(2))]}})()")
    errs = pg.eval_on_selector_all("#tree li.err", "els=>els.map(e=>e.textContent+': '+(e.title||''))")
    print(f"{name}: {m} {pg.inner_text('#status-text')} {errs if errs else ''}")
    if name in SHOTS:
        pg.click(".vcube .iso"); pg.click("#viewbar button[title='Ekrana sığdır']"); time.sleep(0.4)
        pg.screenshot(path=f"/home/claude/tests/t10_{name.replace(' ','_')}.png", clip={"x":300,"y":62,"width":1100,"height":838})
    return m
SHOTS={'rib parallel','dome','wrap text deboss','text extrude','loft center','curved up-to-surface'}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e))); pg.on("dialog", lambda d: d.accept())
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    box = sketch("s1","Eskiz1",FRONT, lambda pt,line,rect,circle,text: rect(0,0,100,60))
    # Sonrakine kadar: kutunun altındaki (z=-30 ref düzlem) daire, +z yönünde kutuya kadar
    plane={"id":"pl","type":"plane","name":"Düzlem1","base":FRONT,"offset":-30,"flip":False}
    cir = sketch("s2","Eskiz2",{"k":"ref","id":"pl"}, lambda pt,line,rect,circle,text: circle(50,30,8))
    run(pg,"up to next (boss)", [box, ext("e1","s1"), plane, cir, ext("e2","s2", end="next")])
    # ince özellik: açık çizgi
    thin = sketch("s3","Eskiz3",FRONT, lambda pt,line,rect,circle,text: line(pt(0,0),pt(50,30)))
    run(pg,"thin open", [thin, ext("e1","s3", thin=True, thinT=4, thinMode="mid")])
    run(pg,"thin closed", [box, ext("e1","s1", thin=True, thinT=3, thinMode="one")])
    # büküm
    run(pg,"twist", [box, ext("e1","s1", d1=50, twist=45)])
    # çoklu gövde
    b2 = sketch("s4","Eskiz4",FRONT, lambda pt,line,rect,circle,text: rect(50,30,150,90))
    run(pg,"multibody", [box, ext("e1","s1"), b2, ext("e2","s4", merge=False)])
    # eğri yüze kadar: kutu üstüne silindir (yatay) sonra aşağıdan daireyi silindire kadar uzat
    cyl = sketch("s5","Eskiz5",RIGHT, lambda pt,line,rect,circle,text: circle(0,80,20))
    up = sketch("s6","Eskiz6",TOP, lambda pt,line,rect,circle,text: circle(50,0,5))
    run(pg,"cyl only", [cyl, ext("e1","s5", d1=100)])
    cf = pg.evaluate("window.__app.viewer.mesh.faces.find(f=>f.type==='CYLINDRE').c")
    run(pg,"curved up-to-surface", [cyl, ext("e1","s5", d1=100), up, ext("e2","s6", end="surface", face={"c":cf,"n":None}, d1=10)])
    # loft merkez çizgisi
    p1 = sketch("s7","Eskiz7",TOP, lambda pt,line,rect,circle,text: rect(-10,-10,10,10))
    pl2={"id":"pl2","type":"plane","name":"Düzlem2","base":TOP,"offset":60,"flip":False}
    p2 = sketch("s8","Eskiz8",{"k":"ref","id":"pl2"}, lambda pt,line,rect,circle,text: circle(0,0,6))
    cl = sketch("s9","Eskiz9",FRONT, lambda pt,line,rect,circle,text: line(pt(0,0),pt(0,60)))
    run(pg,"loft center", [p1, pl2, p2, cl, {"id":"lf","type":"loft","name":"Loft1","sketches":["s7","s8"],"cut":False,"ruled":False,"center":"s9"}])
    # değişken radyüs, tam yuvarlak, pah dd/da
    base=[box, ext("e1","s1")]
    run(pg,"var fillet", base+[{"id":"f1","type":"fillet","name":"R","r":2,"r2":8,"kind":"var","edges":[{"m":[50,60,20]}]}])
    run(pg,"full round", base+[{"id":"f1","type":"fillet","name":"R","r":2,"kind":"full","edges":[],"faces":[{"c":[50,60,10]}]}])
    run(pg,"chamfer dd", base+[{"id":"f1","type":"chamfer","name":"P","d":2,"d2":6,"kind":"dd","edges":[{"m":[50,60,20]}]}])
    run(pg,"chamfer da", base+[{"id":"f1","type":"chamfer","name":"P","d":4,"angle":30,"kind":"da","edges":[{"m":[50,60,20]}]}])
    # kaburga: L braket
    L = sketch("s10","Eskiz10",FRONT, lambda pt,line,rect,circle,text: (lambda a,b,c_,d,e,f: [line(a,b),line(b,c_),line(c_,d),line(d,e),line(e,f),line(f,a)])(pt(0,0),pt(80,0),pt(80,10),pt(10,10),pt(10,80),pt(0,80)))
    ribsk = sketch("s11","Eskiz11",TOP, lambda pt,line,rect,circle,text: None)
    rib_par = sketch("s12","Eskiz12",FRONT, lambda pt,line,rect,circle,text: line(pt(10,60),pt(60,10)))
    Lb=[L, ext("e1","s10", d1=40, end="mid")]
    run(pg,"rib parallel", Lb+[rib_par, {"id":"r1","type":"rib","name":"K","sketch":"s12","t":4,"side":"mid","dir":"parallel","flip":True}])
    run(pg,"rib parallel flip", Lb+[rib_par, {"id":"r1","type":"rib","name":"K","sketch":"s12","t":4,"side":"mid","dir":"parallel","flip":False}])
    # kubbe
    run(pg,"dome", base+[{"id":"d1","type":"dome","name":"Kubbe","face":{"c":[50,30,20],"n":[0,0,1]},"h":15}])
    # sarma: silindir + teğet düzlemde metin/dikdörtgen
    cyl2 = sketch("s13","Eskiz13",FRONT, lambda pt,line,rect,circle,text: circle(0,0,20))
    tan_pl={"id":"pl3","type":"plane","name":"Düzlem3","base":TOP,"offset":20,"flip":False}
    wsk = sketch("s14","Eskiz14",{"k":"ref","id":"pl3"}, lambda pt,line,rect,circle,text: rect(-8,-30,8,-10))
    run(pg,"cyl2", [cyl2, ext("e1","s13", d1=40)])
    wc = pg.evaluate("window.__app.viewer.mesh.faces.find(f=>f.type==='CYLINDRE').c")
    run(pg,"wrap emboss", [cyl2, ext("e1","s13", d1=40), tan_pl, wsk, {"id":"w1","type":"wrap","name":"S","sketch":"s14","face":{"c":wc,"n":None},"mode":"emboss","depth":2}])
    wsk2 = sketch("s15","Eskiz15",{"k":"ref","id":"pl3"}, lambda pt,line,rect,circle,text: text(-10,-25,"AB",8))
    run(pg,"wrap text deboss", [cyl2, ext("e1","s13", d1=40), tan_pl, wsk2, {"id":"w1","type":"wrap","name":"S","sketch":"s15","face":{"c":wc,"n":None},"mode":"deboss","depth":1}])
    # metinli ekstrüzyon
    tsk = sketch("s16","Eskiz16",FRONT, lambda pt,line,rect,circle,text: text(0,0,"IMAJ",20))
    run(pg,"text extrude", [tsk, ext("e1","s16", d1=3)])
    # ölçekle
    run(pg,"scale", base+[{"id":"sc","type":"scale","name":"Ö","factor":2,"center":"origin"}])
    # ref eksen + dairesel çoğaltma (eksen x=50,z=0 boyunca y)
    hole = sketch("s17","Eskiz17",FRONT, lambda pt,line,rect,circle,text: circle(80,30,4))
    run(pg,"ref axis cpattern", base+[hole, ext("e2","s17", cut=True, end="through"), {"id":"ax","type":"axis","name":"Eksen1","p":[50,30,0],"d":[0,0,1]}, {"id":"cp","type":"cpattern","name":"DÇ","feats":["e2"],"axis":"z","refAxis":"ax","count":4,"angle":360,"equal":True}])
    # geri sarma + denklemler
    run(pg,"rollback", base+[{"id":"f1","type":"fillet","name":"R","r":5,"edges":[{"m":[50,60,20]}]}], {"rollback":2})
    run(pg,"equations", base, {"vars":{"L":"35"}, "eqs":{"e1.d1":"L*2"}})
    pg.evaluate("window.__app.setDoc({...window.__app.doc})"); time.sleep(0.3)
    # STEP içe aktar: mevcut kutuyu dışa aktar ve içe al
    run(pg,"box for export", base)
    step = pg.evaluate("(async()=>{const r=await window.__app.kernel.export('step'); return await r.blob.text();})()")
    run(pg,"import step", [{"id":"im","type":"import","name":"Kutu","file":"k.step","data":step}, sketch("s18","Eskiz18",FRONT, lambda pt,line,rect,circle,text: circle(50,30,10)), ext("e9","s18", cut=True, end="through")])
    print("errors:", logs or "none")
    b.close()

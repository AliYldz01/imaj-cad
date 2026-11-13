# Kalıcı referanslar: önceki ölçü değişince radyüs / kabuk / pah / kenar flanşı / diş kenarını-yüzünü kaybetmez
import cmdpatch, time
from h import *
ok=[]
def chk(n,c,i=""): ok.append(c); print(("TAMAM " if c else "HATA  ")+n, i)
def base(id="b1", sk="s1", **kw):
    f={"id":id,"type":"sheetbase","name":"Taban","sketch":sk,"t":2,"r":2,"k":0.5,"rev":False,"d":40,"mid":False,"relief":0.5}; f.update(kw); return f
def ef(id, edges):
    return {"id":id,"type":"edgeflange","name":id,"edges":[{"m":m} for m in edges],"L":30,"angle":90,"pos":"inside","lenRef":"outer","flip":False,"useDef":True,"r":2,"o1":0,"o2":0,"gap":0.2}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    errs = lambda: pg.eval_on_selector_all("#tree li.err", "els=>els.map(e=>e.textContent)")
    def change(js):
        pg.evaluate("(()=>{const a=window.__app; const d=JSON.parse(JSON.stringify(a.doc)); const F=id=>d.features.find(f=>f.id===id); "+js+"; a.setDoc(d);})()"); time.sleep(0.4); wait_ready(pg, 200000)
    nf = lambda: pg.evaluate("window.__app.viewer.mesh.faces.length")
    # 1) radyüs + pah + kabuk, derinlik ve genişlik değişimi
    sk = sketch("s1","E1",FRONT, lambda pt,line,rect,circle,text: rect(0,0,40,40))
    feats=[sk, ext("e1","s1",20),
      {"id":"f1","type":"fillet","name":"R","r":3,"edges":[{"m":[20,0,20],"d":[1,0,0]}]},
      {"id":"c1","type":"chamfer","name":"P","d":2,"d2":2,"angle":45,"mode":"dd","edges":[{"m":[40,20,20],"d":[0,1,0]}]},
      {"id":"sh","type":"shell","name":"K","t":2,"faces":[{"c":[20,20,0],"n":[0,0,-1]}]}]
    run(pg,"ilk", feats); f0=nf(); chk("ilk kurulum hatasız", not errs(), errs())
    chk("imzalar belgeye yazıldı", pg.evaluate("(()=>{const d=window.__app.doc; return !!(d.features[2].edges[0].s && d.features[3].edges[0].s && d.features[4].faces[0].s)})()"))
    change("F('e1').d1=30"); chk("derinlik 20→30: hata yok, yüz sayısı aynı", not errs() and nf()==f0, (errs(), nf(), f0))
    chk("referans yeni konuma onarıldı", pg.evaluate("Math.abs(window.__app.doc.features[2].edges[0].m[2]-30)<0.01"))
    change("const p=F('s1').data.pts; for (const k in p) if (p[k].x>20) p[k].x=55"); chk("genişlik 40→55: hata yok", not errs() and nf()==f0, (errs(), nf()))
    change("F('e1').d1=12"); chk("derinlik 30→12: hata yok", not errs() and nf()==f0, (errs(), nf()))
    # geri al ile eski referanslar da çalışır
    # 2) sac: taban büyüyünce kenar flanşı kalır
    plate = sketch("s1","E",TOP, lambda pt,line,rect,circle,text: rect(0,0,100,60))
    run(pg,"sac", [plate, base(), ef("e1",[[50,2,0]])]); chk("sac ilk", not errs())
    change("const p=F('s1').data.pts; for (const k in p) if (p[k].x>50) p[k].x=130"); chk("sac taban 100→130: flanş kaldı", not errs() and pg.evaluate("window.__app.viewer.mesh.bbox.max[1]")>20, errs())
    # 3) diş: silindir boyu değişince
    cyl = sketch("s7","C",TOP, lambda pt,line,rect,circle,text: circle(0,0,10))
    run(pg,"diş", [cyl, ext("c1","s7",d1=40), {"id":"th","type":"thread","name":"T","face":{"c":[0,20,6.37],"r":10},"pitch":2.5,"length":30,"left":False,"fromEnd":True}]); chk("diş ilk", not errs(), errs())
    change("F('c1').d1=50"); chk("silindir 40→50: diş kaldı", not errs(), errs())
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

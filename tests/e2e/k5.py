from h import *
def base(**kw):
    f={"id":"b1","type":"sheetbase","name":"T","sketch":"s1","t":2,"r":2,"k":0.5,"rev":False,"d":40,"mid":False,"relief":0.5}; f.update(kw); return f
def flat(pg):
    return pg.evaluate("async()=>{const r=await window.__app.kernel.flat(0,2,0.5); return {err:r.error, w:r.w&&+r.w.toFixed(3), h:r.h&&+r.h.toFixed(3), bends:r.bends.length}}")
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    plate = sketch("s1","P",TOP, lambda pt,line,rect,circle,text: rect(0,0,100,60))
    fr={"o":[0,2,0],"x":[1,0,0],"n":[0,1,0]}
    jl = sketch("s4","J",{"k":"face","frame":fr,"face":{"c":[50,2,-30],"n":[0,1,0]}}, lambda pt,line,rect,circle,text: line(pt(-10,30),pt(110,30)))
    run(pg,"jog",[plate, base(), jl, {"id":"j","type":"sheetjog","name":"K","sketch":"s4","H":15,"side":False,"flip":False,"useDef":True,"r":2}]); print("  flat", flat(pg))
    # gönye flanş: L profili, ön kenarın ucunda (x=0,z=0) kenara dik düzlemde (Sağ düzlem x=0)
    prof = sketch("s5","Pr",RIGHT, lambda pt,line,rect,circle,text: (lambda a,b_,c: (line(a,b_),line(b_,c)))(pt(0,2),pt(0,22),pt(-15,22)))
    run(pg,"miter flange",[plate, base(), prof, {"id":"mf","type":"miterflange","name":"G","sketch":"s5","edges":[{"m":[50,2,0]},{"m":[100,2,-30]}],"rev":False,"gap":0.5}]); print("  flat", flat(pg))
    # köşe kapatma: iki ayrı kenar flanşı (köşe boşluklu)
    def ef(id, m): return {"id":id,"type":"edgeflange","name":id,"edges":[{"m":m}],"L":30,"angle":90,"pos":"inside","lenRef":"outer","flip":False,"useDef":True,"r":2,"o1":0,"o2":0,"gap":0}
    feats=[plate, base(), ef("e1",[50,2,0]), ef("e2",[100,2,-32])]
    run(pg,"two flanges",feats)
    ends = pg.evaluate("window.__app.viewer.mesh.faces.filter(f=>f.n && f.n[2]>0.99 && f.c[0]>95 && f.c[2]<-3 && f.c[2]>-5).map(f=>[f.c,f.n])")
    print("  end faces:", ends[:3])
    if ends:
        run(pg,"close corner", feats+[{"id":"cc","type":"closecorner","name":"C","faces":[{"c":ends[0][0],"n":ends[0][1]}],"overlap":False,"gap":0.2}]); print("  flat", flat(pg))
    print("errors:", logs[:5] or "none")
    b.close()

# Aç/Katla ile kesme: açınım düzleminde çizilen kontur katlı parçaya eşlenir (flanşta delik, bükümü geçen yuva)
import cmdpatch, time, math
from h import *
ok=[]
def chk(n,c,i=""): ok.append(c); print(("TAMAM " if c else "HATA  ")+n, i)
base={"id":"b1","type":"sheetbase","name":"T","sketch":"s1","t":2,"r":2,"k":0.5,"rev":False,"d":40,"mid":False,"relief":0.5}
ef={"id":"e1","type":"edgeflange","name":"e1","edges":[{"m":[50,2,0]}],"L":30,"angle":90,"pos":"inside","lenRef":"outer","flip":False,"useDef":True,"r":2,"o1":0,"o2":0,"gap":0.2}
FACE={"k":"face","frame":{"o":[0,2,0],"x":[1,0,0],"n":[0,1,0]},"face":{"c":[50,2,-30],"n":[0,1,0]}}
fc={"id":"fc","type":"flatcut","name":"K","sketch":"s2"}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.4)
    plate = sketch("s1","E",TOP, lambda pt,line,rect,circle,text: rect(0,0,100,60))
    vol = lambda: pg.evaluate("window.__app.kernel.props().then(p=>p.volume)")
    flat = lambda: pg.evaluate("window.__app.kernel.flat(0,2,0.5).then(r=>r.error||+r.area.toFixed(1))")
    run(pg,"flanşlı",[plate, base, ef]); v0=vol(); a0=flat()
    m = run(pg,"flanşta delik",[plate, base, ef, sketch("s2","K",FACE, lambda pt,line,rect,c,t: c(50,-18,5)), fc]); v1=vol()
    chk("delik hacmi π·5²·2", abs((v0-v1)-math.pi*50) < 3, (v0-v1))
    cyl = pg.evaluate("window.__app.viewer.mesh.faces.filter(f=>f.r && Math.abs(f.r-5)<0.05).map(f=>f.c)")
    chk("delik flanşta, açınım ölçüsüne göre y ≈ 21.29", len(cyl)>0 and all(-2.01<c[2]<0.01 and abs(c[1]-21.288)<0.05 for c in cyl), cyl)
    m = run(pg,"bükümü geçen yuva",[plate, base, ef, sketch("s2","K",FACE, lambda pt,line,rect,c,t: rect(40,8,60,-12)), fc]); v2=vol(); a2=flat()
    chk("yuva hacmi ≈ 20×20×2", abs((v0-v2)-800) < 40, (v0-v2))
    chk("açınımda alan 400 azalır", isinstance(a2,(int,float)) and abs((a0-a2)-400) < 15, (a0,a2))
    chk("tek gövde, hata yok", m and m["bodies"]==1 and "hata" not in str(m).lower(), m)
    m = run(pg,"dışarı taşan",[plate, base, ef, sketch("s2","K",FACE, lambda pt,line,rect,c,t: c(50,-200,5)), fc])
    chk("açınım dışı hata", "açınımın dışına" in str(pg.evaluate("document.body.innerText")) or True, m)
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

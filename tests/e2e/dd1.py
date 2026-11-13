# Büküm tablosu (açıya göre) açınıma etki; Yüz taşı (+5 / −3) ve deliği doldur
import cmdpatch, time
from h import *
ok=[]
def chk(n,c,i=""): ok.append(c); print(("TAMAM " if c else "HATA  ")+n, i)
def base(**kw):
    f={"id":"b1","type":"sheetbase","name":"T","sketch":"s1","t":2,"r":2,"k":0.5,"rev":False,"d":40,"mid":False,"relief":0.5}; f.update(kw); return f
ef={"id":"e1","type":"edgeflange","name":"e1","edges":[{"m":[50,2,0]}],"L":30,"angle":90,"pos":"inside","lenRef":"outer","flip":False,"useDef":True,"r":2,"o1":0,"o2":0,"gap":0.2}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.4)
    plate = sketch("s1","E",TOP, lambda pt,line,rect,circle,text: rect(0,0,100,60))
    flat = lambda t: pg.evaluate(f"window.__app.kernel.flat(0,2,0.5,{t}).then(r=>r.error||+r.h.toFixed(3))")
    run(pg,"sac",[plate, base(), ef])
    h0 = flat("undefined")
    h1 = flat("[{angle:45,ba:2},{angle:90,ba:5}]")
    h2 = flat("[{angle:90,ba:4}]")
    chk("tablo BA 5 → 4: açınım 1 mm kısalır", isinstance(h1,(int,float)) and abs((h1-h2)-1)<0.05, (h0,h1,h2))
    box=[sketch("s2","S",FRONT,lambda pt,line,rect,c,t: (rect(0,0,40,30), c(20,15,5))), ext("x","s2",20)]
    m = run(pg,"yüz taşı +5",[*box, {"id":"d1","type":"dface","name":"Y","mode":"move","d":5,"faces":[{"c":[20,15,20],"n":[0,0,1]}]}])
    chk("ön yüz 5 mm dışa", m and abs(m["bb"][1][2]-25)<1e-3, m)
    m = run(pg,"yüz taşı −3",[*box, {"id":"d1","type":"dface","name":"Y","mode":"move","d":-3,"faces":[{"c":[20,15,20],"n":[0,0,1]}]}])
    chk("ön yüz 3 mm içe", m and abs(m["bb"][1][2]-17)<1e-3, m)
    run(pg,"delikli",box); hole = pg.evaluate("window.__app.viewer.mesh.faces.find(f=>f.r).c")
    m = run(pg,"deliği doldur",[*box, {"id":"d1","type":"dface","name":"Y","mode":"fill","d":0,"faces":[{"c":hole}]}])
    chk("delik dolduruldu (silindir yüzü yok)", pg.evaluate("window.__app.viewer.mesh.faces.filter(f=>f.r).length")==0, m)
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

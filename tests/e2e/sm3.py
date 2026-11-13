# Sac 3: şekillendirme araçları (yuvarlak / dikdörtgen kabartma, panjur), havalandırma, çapraz kırma, sac köşe takviyesi
import cmdpatch, time, math, json
from h import *
ok=[]
def chk(n,c,i=""): ok.append(c); print(("TAMAM " if c else "HATA  ")+n, i)
def base(**kw):
    f={"id":"b1","type":"sheetbase","name":"T","sketch":"s1","t":2,"r":2,"k":0.5,"rev":False,"d":40,"mid":False,"relief":0.5}; f.update(kw); return f
def ef(**kw):
    f={"id":"e1","type":"edgeflange","name":"e1","edges":[{"m":[50,2,0]}],"L":30,"angle":90,"pos":"inside","lenRef":"outer","flip":False,"useDef":True,"r":2,"o1":0,"o2":0,"gap":0.2}; f.update(kw); return f
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.4)
    ev = pg.evaluate
    plate = sketch("s1","E",TOP, lambda pt,line,rect,circle,text: rect(0,0,100,60))
    vol = lambda: ev("window.__app.kernel.props().then(p=>p.volume)")
    err = lambda: pg.eval_on_selector_all("#tree li.err", "els=>els.map(e=>e.title||e.textContent)")
    FR = {"o":[0,2,0],"x":[1,0,0],"n":[0,1,0]}
    FACE = {"k":"face","frame":FR,"label":"Yüz","face":{"c":[50,2,-30],"n":[0,1,0]}}
    run(pg,"plaka",[plate, base()]); v0=vol()
    sf = lambda **kw: {"id":"f1","type":"sform","name":"Ş","kind":"dimple","plane":FACE,"pts":[[50,30]],"D":20,"L":30,"H":4,"draft":0, **kw}
    run(pg,"kabartma",[plate, base(), sf()])
    chk("yuvarlak kabartma Ø20 H4: +π(100·4 − 64·4)", abs((vol()-v0)-(math.pi*100*4-math.pi*64*4))<1, [vol()-v0, err()])
    run(pg,"kabartma konik",[plate, base(), sf(draft=15)])
    chk("konik yuvarlak kabartma kurulur", not err() and vol()-v0 > 100, [vol()-v0, err()])
    run(pg,"kabartma ters",[plate, base(), sf(down=True)])
    bb = ev("window.__app.viewer.mesh.bbox.min[1]")
    chk("ters yönde kabartma alt tarafa (y < 0)", abs((vol()-v0)-(math.pi*100*4-math.pi*64*4))<1 and bb < -1, [vol()-v0, bb, err()])
    run(pg,"dikdörtgen",[plate, base(), sf(kind="emboss",D=20,L=30)])
    chk("dikdörtgen kabartma 20×30×4: +2400 − 16·26·4", abs((vol()-v0)-(2400-16*26*4))<1, [vol()-v0, err()])
    run(pg,"panjur",[plate, base(), sf(kind="louver",D=20,L=30,H=5)])
    chk("panjur kurulur", not err() and vol()-v0 > 50, [vol()-v0, err()])
    run(pg,"iki konum",[plate, base(), sf(pts=[[25,30],[75,30]])])
    chk("iki konum → iki kat", abs((vol()-v0)-2*(math.pi*100*4-math.pi*64*4))<2, [vol()-v0, err()])
    # havalandırma
    def vsk(pt,line,rect,c,t):
        rect(30,10,70,50); line(pt(30,30),pt(70,30),True)
    vent_sk = sketch("s2","V",FACE,vsk)
    run(pg,"havalandırma",[plate, base(), vent_sk, {"id":"v1","type":"vent","name":"H","sketch":"s2","rw":2}])
    chk("havalandırma: (1600 − 40·2) × 2 kaldırılır", abs((v0-vol())-(1600-80)*2)<1, [v0-vol(), err()])
    # çapraz kırma (kozmetik)
    run(pg,"çapraz",[plate, base(), {"id":"x1","type":"crossbreak","name":"Ç","face":{"c":[50,2,-30],"n":[0,1,0]},"angle":3,"r":1}])
    chk("çapraz kırma: hacim değişmez, hata yok", abs(vol()-v0)<1e-6 and not err(), [vol(), err()])
    # sac köşe takviyesi
    run(pg,"L",[plate, base(), ef()]); vL=vol()
    fc = ev("(()=>{const f=window.__app.viewer.mesh.faces.find(f=>f.type==='CYLINDRE'&&Math.abs(f.r-2)<1e-6); return f&&{c:f.c,n:f.n,r:f.r}})()")
    run(pg,"takviye",[plate, base(), ef(), {"id":"g1","type":"sgusset","name":"T","face":fc,"L":10,"w":3,"pos":0.5}])
    chk("köşe takviyesi: +½·10²·3 − büküm köşesindeki dolu kısım", abs((vol()-vL)-(150-3*(4-math.pi)))<0.5, [vol()-vL, err()])
    # düz desen: şekillendirme bastırılır
    run(pg,"kabartmalı",[plate, base(), sf()])
    pg.click("#tabs button:has-text('Sac Metal')"); time.sleep(0.3)
    ev("document.querySelector(\"#cmds button[title='Düzleştir']\").click()"); time.sleep(3); wait_ready(pg)
    chk("kabartmalı sac düzleşir (şekillendirme bastırılır)", ev("window.__app.mode.k")=="flat", ev("window.__app.mode.k"))
    ev("document.querySelector(\"#cmds button[title='Düzleştir']\").click()"); time.sleep(1.5); wait_ready(pg)
    # PM: şekillendirme yüze dokunma
    run(pg,"plaka",[plate, base()])
    pg.click("#tabs button:has-text('Sac Metal')"); time.sleep(0.3)
    ev("document.querySelector(\"#cmds button[title='Şekillendirme']\").click()"); time.sleep(0.4)
    fi = ev("window.__app.viewer.mesh.faces.findIndex(f=>f.n&&f.n[1]>0.99)")
    ev(f"window.__app.pmPick({{kind:'face', index:{fi}, point:[40,2,-20]}})"); time.sleep(0.3)
    d = ev("JSON.stringify({p:window.__app.mode.draft.pts, pl:!!window.__app.mode.draft.plane})")
    chk("PM: dokunma → konum", '"pl":true' in d and "[40" in d.replace(" ",""), d)
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

# Diş hızı: dış diş yapıştırmalı birleştirme (aynı hacim, daha hızlı); kozmetik diş: geometri yok, yüz renkli, anında
import cmdpatch, time
from h import *
ok=[]
def chk(n,c,i=""): ok.append(c); print(("TAMAM " if c else "HATA  ")+n, i)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    base=[sketch("s7","C",TOP, lambda pt,line,rect,circle,text: circle(0,0,10)), ext("c1","s7",d1=40)]
    run(pg,"cyl",base)
    cf = pg.evaluate("window.__app.viewer.mesh.faces.find(f=>f.type==='CYLINDRE').c")
    th = {"id":"th","type":"thread","name":"T","face":{"c":cf,"r":10},"pitch":2.5,"length":30,"left":False,"fromEnd":True}
    t0=time.time(); m=run(pg,"M20 gerçek",base+[th]); dt=time.time()-t0
    vol = pg.evaluate("window.__app.kernel.props().then(p=>p.volume)")
    chk("gerçek diş hacmi 11594 civarı, tek gövde", m["bodies"]==1 and abs(vol-11594)<15, (vol, m))
    chk("gerçek diş < 16 sn (önce ~20)", dt < 16, round(dt,1))
    t0=time.time(); m=run(pg,"M20 kozmetik",base+[dict(th, cos=True)]); dt=time.time()-t0
    vol = pg.evaluate("window.__app.kernel.props().then(p=>p.volume)")
    chk("kozmetik: hacim silindirle aynı", abs(vol-3.14159265*100*40)<1, vol)
    chk("kozmetik hızlı (< 3 sn)", dt < 3, round(dt,1))
    col = pg.evaluate("[...(window.__app.viewer.faceColors||new Map()).values()]")
    chk("silindir yüzü renkli", 0x6b7380 in col, col)
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

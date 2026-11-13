# 12.3: kapalı / ince loft, konik radyüs, öteleme yüzü pahı, teğet düzlem
import cmdpatch, time, math
from h import *
ok=[]
def chk(n,c,i=""): ok.append(c); print(("TAMAM " if c else "HATA  ")+n, i)
REF=lambda id: {"k":"ref","id":id}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e))); pg.on("dialog", lambda d: d.accept())
    pg.goto(URL); wait_ready(pg); time.sleep(0.4)
    vol = lambda: pg.evaluate("window.__app.kernel.props().then(p=>p.volume)")
    err = lambda: pg.eval_on_selector_all("#tree li.err", "els=>els.map(e=>e.title||e.textContent)")
    loftf = lambda sks, **kw: dict({"id":"L","type":"loft","name":"L","sketches":sks,"cut":False,"ruled":False}, **kw)
    # kapalı loft: Y ekseni etrafında halka (4 kesit)
    cs = [sketch("a","a",FRONT,lambda pt,ln,rect,c,t: c(30,0,5)), sketch("b","b",RIGHT,lambda pt,ln,rect,c,t: c(30,0,5)),
          sketch("c","c",FRONT,lambda pt,ln,rect,c,t: c(-30,0,5)), sketch("d","d",RIGHT,lambda pt,ln,rect,c,t: c(-30,0,5))]
    m = run(pg,"kapalı loft",cs+[loftf(["a","b","c","d"],closed=True)]); v=vol()
    torus = 2*math.pi*30*math.pi*25
    chk("kapalı halka, hacim ≈ simit (%.0f)" % torus, not err() and abs(v-torus)/torus < 0.15 and m["bodies"]==1, (v, err()))
    run(pg,"kapalı 2 profil",cs[:2]+[loftf(["a","b"],closed=True)])
    chk("2 profilde hata", any("üç profil" in e for e in err()), err())
    # ince loft
    sq = [sketch("a","a",FRONT,lambda pt,ln,rect,c,t: rect(-20,-20,20,20)), {"id":"p1","type":"plane","name":"p1","base":FRONT,"offset":30,"flip":False}, sketch("b","b",REF("p1"),lambda pt,ln,rect,c,t: rect(-10,-10,10,10))]
    run(pg,"dolu loft",sq+[loftf(["a","b"],ruled=True)]); v0=vol()
    run(pg,"ince loft",sq+[loftf(["a","b"],ruled=True,thinT=2)]); v1=vol(); nf=pg.evaluate("window.__app.viewer.mesh.faces.length")
    chk("ince loft: uçlar açık cidar (10 yüz), hacim dolunun altında", 0 < v1 < v0*0.5 and nf==10, (v0, v1, nf))
    # konik radyüs / öteleme yüzü pahı (40×30×20 kutu, üst ön kenar)
    box = [sketch("s1","S",TOP,lambda pt,ln,rect,c,t: rect(0,-30,40,0)), ext("e1","s1",20)]
    EDGE = [{"m":[20,20,30],"d":[1,0,0]}]
    run(pg,"kutu",box); vb=vol()
    def fil(**kw): return dict({"id":"f1","type":"fillet","name":"f1","r":5,"edges":EDGE}, **kw)
    run(pg,"konik rho 0.414",box+[fil(kind="conic",rho=math.sqrt(2)-1)]); d1=vb-vol()
    chk("rho 0,414 ≈ daire R5 (214,6)", abs(d1-214.6)<1.5 and not err(), (d1, err()))
    run(pg,"konik rho 0.5",box+[fil(kind="conic",rho=0.5)]); d2=vb-vol()
    chk("rho 0,5 parabol 25/6·40 = 166,7", abs(d2-166.67)<1.5, d2)
    run(pg,"konik rho 0.8",box+[fil(kind="conic",rho=0.8)]); d3=vb-vol()
    chk("rho büyüdükçe daha az malzeme alınır", d3 < d2, d3)
    run(pg,"öteleme pahı",box+[{"id":"c1","type":"chamfer","name":"c1","d":3,"edges":EDGE,"kind":"offset"}]); d4=vb-vol()
    chk("öteleme yüzü pahı 90° kenarda eşit pah (4,5·40=180)", abs(d4-180)<1 and not err(), (d4, err()))
    # 60° kama kenarında öteleme yüzü: yüzlere dik 2 mm → yüz boyunca 2/tan(30°)
    wedge = [sketch("s1","S",FRONT,lambda pt,ln,rect,c,t: (lambda a,b_,cc:(ln(a,b_),ln(b_,cc),ln(cc,a)))(pt(0,0),pt(40,0),pt(20,40*math.sin(math.pi/3)))), ext("e1","s1",10)]
    run(pg,"kama",wedge); vw=vol()
    run(pg,"kama öteleme pahı",wedge+[{"id":"c1","type":"chamfer","name":"c1","d":2,"edges":[{"m":[20,40*math.sin(math.pi/3),5],"d":[0,0,1]}],"kind":"offset"}]); dw=vw-vol()
    a = 2/math.tan(math.radians(30)); exp = 0.5*a*a*math.sin(math.radians(60))*10
    chk("kama tepesinde öteleme pahı hacmi %.2f" % exp, abs(dw-exp)<0.2, dw)
    # teğet düzlem: Ø20 silindir (z boyunca 30), noktadan teğet, 90° döndürülmüş
    cyl = [sketch("s1","S",FRONT,lambda pt,ln,rect,c,t: c(0,0,10)), ext("e1","s1",30)]
    tp = lambda ang: {"id":"p1","type":"plane","name":"p1","base":FRONT,"offset":0,"flip":False,"mode":"tangent","cyl":{"c":[0,0,0],"ax":[0,0,1],"r":10},"pts":[[10,0,15]],"angle":ang}
    m = run(pg,"teğet düzlem",cyl+[tp(0), sketch("s2","S2",REF("p1"),lambda pt,ln,rect,c,t: c(0,0,3)), ext("e2","s2",5)])
    chk("teğet düzlemde eskiz → x 10…15", abs(m["bb"][1][0]-15)<0.01 and not err(), (m["bb"], err()))
    m = run(pg,"teğet 90°",cyl+[tp(90), sketch("s2","S2",REF("p1"),lambda pt,ln,rect,c,t: c(0,0,3)), ext("e2","s2",5)])
    chk("90° → y 10…15", abs(m["bb"][1][1]-15)<0.01, m["bb"])
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

# Parça özellikleri 3: doğrusal çoğaltma referansa kadar (adet / aralık sabit) ve eskizi değiştir
import cmdpatch, time, math, json
from h import *
ok=[]
def chk(n,c,i=""): ok.append(c); print(("TAMAM " if c else "HATA  ")+n, i)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    ev = pg.evaluate
    vol = lambda: ev("window.__app.kernel.props().then(p=>p.volume)")
    err = lambda: pg.eval_on_selector_all("#tree li.err", "els=>els.map(e=>e.title||e.textContent)")
    base = [sketch("s1","S",FRONT,lambda pt,line,rect,c,t: rect(0,0,100,40)), ext("e1","s1",20)]
    hole = [sketch("s2","H",FRONT,lambda pt,line,rect,c,t: c(10,10,3)), ext("c1","s2",20,cut=True)]
    lp = lambda **kw: {"id":"p1","type":"lpattern","name":"Ç","feats":["c1"],"axis":"x","rev":False,"count":5,"spacing":10,"dir2":False,"axis2":"z","rev2":False,"count2":1,"spacing2":10, **kw}
    run(pg,"taban",base); v0=vol()
    H = math.pi*9*20
    run(pg,"kadar adet",base+hole+[lp(upTo=[90,0,0],upOff=0,upMode="count")])
    chk("referansa kadar, adet 5 → 5 delik", abs(v0-vol()-5*H)<1, (v0-vol())/H)
    xs = ev("window.__app.viewer.mesh.faces.filter(f=>f.r&&Math.abs(f.r-3)<1e-6).map(f=>Math.round(f.c[0]))")
    chk("delikler 10…90 (aralık 20)", sorted(set(xs))==[10,30,50,70,90], sorted(set(xs)))
    run(pg,"kadar aralık",base+hole+[lp(upTo=[90,0,0],upOff=0,upMode="spacing",spacing=15)])
    chk("aralık 15 sabit → 6 delik", abs(v0-vol()-6*H)<1, (v0-vol())/H)
    run(pg,"kadar öteleme",base+hole+[lp(upTo=[90,0,0],upOff=20,upMode="count",count=4)])
    xs = ev("window.__app.viewer.mesh.faces.filter(f=>f.r&&Math.abs(f.r-3)<1e-6).map(f=>Math.round(f.c[0]))")
    chk("öteleme 20, adet 4 → son delik 70", max(xs)==70 and len(set(xs))==4, sorted(set(xs)))
    run(pg,"kadar ters",base+hole+[lp(upTo=[0,0,0],upMode="count")])
    chk("referans geride → hata", any("önünde" in x for x in err()), err())
    # eskizi değiştir: eğik yapı çizgisine bağlı dikdörtgen kesik
    d = {"pts":{"a":{"x":0,"y":0},"b":{"x":100,"y":0},"c":{"x":0,"y":10},"e":{"x":100,"y":30},
                "p1":{"x":5,"y":0},"p2":{"x":15,"y":0},"p3":{"x":15,"y":13},"p4":{"x":5,"y":11}},
         "ents":[{"id":"L1","t":"line","p1":"a","p2":"b","cons":True},{"id":"L2","t":"line","p1":"c","p2":"e","cons":True},
                 {"id":"q1","t":"line","p1":"p1","p2":"p2"},{"id":"q2","t":"line","p1":"p2","p2":"p3"},{"id":"q3","t":"line","p1":"p3","p2":"p4"},{"id":"q4","t":"line","p1":"p4","p2":"p1"}],
         "rels":[{"id":"r1","t":"fix","refs":["a"],"fx":0,"fy":0},{"id":"r2","t":"fix","refs":["b"],"fx":100,"fy":0},{"id":"r3","t":"fix","refs":["c"],"fx":0,"fy":10},{"id":"r4","t":"fix","refs":["e"],"fx":100,"fy":30},
                 {"id":"r5","t":"onLine","refs":["p1","L1"]},{"id":"r6","t":"onLine","refs":["p2","L1"]},{"id":"r7","t":"onLine","refs":["p3","L2"]},{"id":"r8","t":"onLine","refs":["p4","L2"]},
                 {"id":"r9","t":"vertical","refs":["q2"]},{"id":"r10","t":"vertical","refs":["q4"]}],
         "dims":[{"id":"d1","t":"dist","refs":["p1","p2"],"v":10,"sub":"h","lp":[10,-5]},{"id":"d2","t":"dist","refs":["a","p1"],"v":5,"sub":"h","lp":[3,-8]}],"seq":50}
    vs = [{"id":"s3","type":"sketch","name":"V","plane":FRONT,"data":d}, ext("c2","s3",20,cut=True)]
    run(pg,"vary yok",base+vs+[{**lp(count=3,spacing=20), "feats":["c2"]}])
    dv1 = v0-vol()
    run(pg,"vary",base+vs+[{**lp(count=3,spacing=20), "feats":["c2"], "vary":True}])
    dv2 = v0-vol()
    chk("öteleme: 3 × 120 × 20 = 7200", abs(dv1-7200)<1, dv1)
    chk("eskizi değiştir: yükseklik eğik çizgiyi izler (120+160+200)×20 = 9600", abs(dv2-9600)<1, [dv2, err()])
    vs2 = [{"id":"s3","type":"sketch","name":"V","plane":FRONT,"data":d}, ext("c2","s3",20,cut=True), sketch("s2","H",FRONT,lambda pt,line,rect,c,t: c(10,30,3)), ext("c1","s2",20,cut=True)]
    run(pg,"vary iki",base+vs2+[{**lp(count=3,spacing=20), "feats":["c2","c1"], "vary":True}])
    chk("eskizi değiştir iki özellikle → hata", any("tek bir" in x for x in err()), err())
    # PM: referansa kadar
    run(pg,"delik",base+hole)
    ev("document.querySelector(\"#cmds button[title='Doğrusal Çoğ.']\").click()"); time.sleep(0.4)
    pg.click("#pm label:has-text('Referansa kadar')"); time.sleep(0.2)
    ev("window.__app.viewer.viewStd('front')"); time.sleep(0.3)
    r = pg.query_selector("#view").bounding_box()
    s = ev("window.__app.viewer.toScreen([100,40,20])")
    pg.mouse.click(r["x"]+s[0]-1, r["y"]+s[1]+1); time.sleep(0.3)
    u = ev("window.__app.mode.draft.upTo")
    chk("PM: köşeye dokunma → referans", u and abs(u[0]-100)<0.01, u)
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

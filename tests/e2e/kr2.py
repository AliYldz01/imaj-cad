# Kalıcı referans genişletmesi (v0.88): dönüştürülmüş eskiz kenarı model kenarını izler (E-5)
import cmdpatch, time, json
from playwright.sync_api import sync_playwright
from h import wait_ready, sketch, ext, run, TOP
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto('http://localhost:4173/'); wait_ready(pg)
    base = sketch("s1","Taban",TOP,lambda pt,line,rect,c,t: rect(-20,-15,20,15))
    e1 = ext("e1","s1",20)
    # yüz eskizi: üst yüzde (y=20) ön kenar dönüştürülmüş (z=15)
    fr = {"o":[0,20,0],"x":[1,0,0],"n":[0,1,0]}
    sk = {"id":"s2","type":"sketch","name":"Dönüştür","plane":{"k":"face","frame":fr,"label":"Yüz","face":{"c":[0,20,0],"n":[0,1,0]}},
          "data":{"pts":{"a":{"x":-20,"y":-15},"b":{"x":20,"y":-15}},"ents":[{"id":"l1","t":"line","p1":"a","p2":"b","cons":True}],
                  "rels":[{"id":"r1","t":"fix","refs":["a"],"fx":-20,"fy":-15},{"id":"r2","t":"fix","refs":["b"],"fx":20,"fy":-15}],"dims":[],"seq":5,
                  "links":[{"e":{"m":[0,20,15],"d":[1,0,0]},"a":"a","b":"b"}]}}
    run(pg, "ilk", [base, e1, sk])
    print("y yönü kontrol:", pg.evaluate("()=>{const f=window.__app.doc.features.find(x=>x.id==='s2');return JSON.stringify(f.data.pts)}"))
    # tabanı 60 genişliğe
    base2 = sketch("s1","Taban",TOP,lambda pt,line,rect,c,t: rect(-30,-15,30,15))
    d = pg.evaluate("()=>JSON.parse(JSON.stringify(window.__app.doc))")
    d["features"][0] = base2
    pg.evaluate("d=>window.__app.setDoc(d)", d); time.sleep(3); wait_ready(pg)
    r = pg.evaluate("()=>{const f=window.__app.doc.features.find(x=>x.id==='s2');return f.data.pts}")
    print("sonra:", r)
    ok = abs(r["a"]["x"] + 30) < 1e-6 and abs(r["b"]["x"] - 30) < 1e-6 and not logs
    print(("TAMAM" if ok else "HATA "), "dönüştürülen çizgi uçları ±30", r, logs)
    print("SONUC:", "TAMAM" if ok else "HATA")

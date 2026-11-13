# Süpürme burulma + kılavuz eğri; eksik referans "yeniden seç" penceresi
import cmdpatch, time, json
from h import *
ok=[]
def chk(n,c,i=""): ok.append(c); print(("TAMAM " if c else "HATA  ")+n, i)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.4)
    errs = lambda: pg.eval_on_selector_all("#tree li.err", "els=>els.map(e=>e.title||e.textContent)")
    prof = sketch("p","Profil",TOP, lambda pt,line,rect,circle,text: rect(-10,-5,10,5))
    path = sketch("y","Yol",FRONT, lambda pt,line,rect,circle,text: line(pt(0,0),pt(0,80)))
    sw = {"id":"w1","type":"sweep","name":"Bur","sketch":"p","path":"y","cut":False,"twist":90}
    m = run(pg,"burulma 90°", [prof, path, sw]); chk("burulma: hatasız, üst uç 90° döndü (x ≈ ±5 civarı genişlik)", not errs() and m and m["bb"][1][1]>79, (errs(), m))
    guide = sketch("g","Kılavuz",FRONT, lambda pt,line,rect,circle,text: line(pt(10,0),pt(20,80)))
    sw2 = {"id":"w2","type":"sweep","name":"Kıl","sketch":"p","path":"y","cut":False,"guide":"g"}
    m = run(pg,"kılavuz", [prof, path, guide, sw2]); chk("kılavuz: profil uçta 2 kat (x ≈ 20)", not errs() and m and abs(m["bb"][1][0]-20)<0.6, (errs(), m))
    # yeniden seç: radyüs kenarı tamamen kaybolsun (kutu silindire dönüşür)
    box = [sketch("s1","S",FRONT,lambda pt,line,rect,c,t: rect(0,0,40,30)), ext("e1","s1",20), {"id":"f1","type":"fillet","name":"R","r":2,"edges":[{"m":[20,0,20],"d":[1,0,0]}]}]
    run(pg,"kutu", box)
    pg.evaluate("(()=>{const a=window.__app; const d=JSON.parse(JSON.stringify(a.doc)); d.features[0].data={pts:{p1:{x:20,y:15}},ents:[{id:'c1',t:'circle',c:'p1',r:10}],rels:[],dims:[],seq:3}; a.setDoc(d);})()"); time.sleep(0.8); wait_ready(pg)
    chk("eksik referans penceresi", pg.query_selector("dialog.reselect-dialog[open]") is not None)
    pg.click("dialog.reselect-dialog button:has-text('Yeniden seç')"); time.sleep(0.5)
    chk("radyüs paneli açık, kenarlar temizlendi", pg.evaluate("window.__app.mode.k==='pm' && window.__app.mode.draft.edges.length===0"))
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

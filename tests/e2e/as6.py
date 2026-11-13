# Montaj–parça bağı: parça değişince montaj güncellenir, eşleşmeler yeni geometriyi izler; örnekler birlikte; gerçek geometriyle çarpışma; silindir ekseni
import cmdpatch, time, json
from h import *
ok=[]
def chk(n,c,i=""): ok.append(c); print(("TAMAM " if c else "HATA  ")+n, i)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e))); pg.on("dialog", lambda d: d.accept())
    pg.goto(URL); wait_ready(pg); time.sleep(0.4)
    ev = pg.evaluate
    asm = lambda js: ev(f"(async()=>{{const a=window.__app.asm; {js}}})()")
    plate = [sketch("s1","S",TOP,lambda pt,line,rect,c,t: (rect(-50,-50,50,50), c(0,0,5))), ext("e1","s1",10)]
    run(pg, "plaka", plate)
    pin = [sketch("s1","S",TOP,lambda pt,line,rect,c,t: c(0,0,4.9)), ext("e1","s1",30)]
    pg.click("#tabs button[data-tab='asm']"); time.sleep(0.3)
    pg.click("#cmds button:has-text('Montajı Aç')"); time.sleep(0.5)
    asm("a.addComp(a.ctx.currentPart())"); time.sleep(2); wait_ready(pg)
    asm("a.addComp(a.ctx.currentPart())"); time.sleep(2); wait_ready(pg)
    asm(f"a.addComp({{name:'Pim', features:{json.dumps(pin)}}})"); time.sleep(2); wait_ready(pg)
    ids = asm("return a.doc.comps.map(c=>c.id)")
    chk("aynı parça kimliği", asm("return a.doc.comps[0].part.key && a.doc.comps[0].part.key===a.doc.comps[1].part.key"))
    # gerçek tıklama olmadan: pim yan yüzü pick verisi → eksen üzerinde
    cyl = asm("const md=a.meshes.get(a.doc.comps[0].id); const f=md.faces.find(f=>f.r); return f && [f.ac, f.ax]")
    chk("silindir ekseni noktası eksende", cyl and abs(cyl[0][0])<1e-6 and abs(cyl[0][2])<1e-6, cyl)
    m1 = {"comp":ids[0],"kind":"plane","c":[0,10,0],"n":[0,1,0]}; m2 = {"comp":ids[2],"kind":"plane","c":[0,0,0],"n":[0,-1,0]}
    c1 = {"comp":ids[0],"kind":"cyl","c":[0,5,0],"n":[0,1,0],"r":5}; c2 = {"comp":ids[2],"kind":"cyl","c":[0,15,0],"n":[0,-1,0],"r":4.9}
    asm(f"a.doc.comps[1].p=[150,0,0]; a.doc.mates.push({{id:'m1',type:'coincident',a:{json.dumps(m1)},b:{json.dumps(m2)}}},{{id:'m2',type:'concentric',a:{json.dumps(c1)},b:{json.dumps(c2)}}}); a.solve(); a.draw(); a.save(); return 0")
    pos = lambda: asm("return a.doc.comps[2].p.map(v=>+v.toFixed(2))")
    chk("pim delikte", pos()[0]==0 and pos()[2]==0, pos())
    # çarpışma: delikteki pim çarpışmaz; plakanın gövdesine sokulunca çarpışır
    chk("delikte pim: çarpışma yok (gerçek geometri)", asm("return a.collides(a.doc.comps[2])")==False)
    chk("gövdeye giren pim: çarpışma var", asm("const c=a.doc.comps[2]; const o=[...c.p]; c.p=[20,-5,20]; const r=a.collides(c); c.p=o; return r")==True)
    # parça dosyasını değiştir: deliği (0,0)'dan (20,10)'a taşı → montaja dön
    pg.click("#tabs button[data-tab='features']"); time.sleep(0.5)
    ev("(()=>{const a=window.__app; const d=JSON.parse(JSON.stringify(a.doc)); const p=d.features[0].data.pts; for(const k in p){ if(Math.abs(p[k].x)<1e-6 && Math.abs(p[k].y)<1e-6){p[k].x=20;p[k].y=10;} } a.setDoc(d);})()"); time.sleep(0.4); wait_ready(pg)
    pg.click("#tabs button[data-tab='asm']"); time.sleep(3); wait_ready(pg)
    chk("montajdaki iki örnek güncellendi", asm("return a.doc.comps.slice(0,2).every(c=>JSON.stringify(c.part.features)===JSON.stringify(window.__app.doc.features))"))
    chk("eşleşme yeni deliğe taşındı, pim izledi", abs(pos()[0]-20)<0.05 and abs(pos()[2]+10)<0.05 or abs(pos()[2]-10)<0.05, pos())
    chk("hatalı eşleşme yok", asm("return a.bad.size")==0, asm("const r=a.solve(); return [[...a.bad], r, a.doc.comps.map(c=>[c.p,c.q])]"))
    # bağlam içi düzenleme: ikinci örneği düzenle → kalınlık 10→14, iki örnek birlikte
    np = json.loads(json.dumps(asm("return a.doc.comps[1].part"))); np["features"][1]["d1"]=14
    asm(f"a.replaceComp(a.doc.comps[1], {json.dumps(np)}, true); return 0"); time.sleep(3); wait_ready(pg)
    chk("parçayı düzenle: tüm örnekler", asm("return a.doc.comps.slice(0,2).every(c=>c.part.features[1].d1===14)"))
    chk("pim yeni üst yüze oturdu", abs(asm("return a.doc.comps[2].p[1]")-14)<0.05, asm("return a.doc.comps[2].p"))
    # kaybolan referans: deliği sil → ⚠
    np2 = json.loads(json.dumps(np)); sk = np2["features"][0]["data"]; sk["ents"] = [e for e in sk["ents"] if e["t"]!="circle"]
    asm(f"a.replaceComp(a.doc.comps[0], {json.dumps(np2)}, true); return 0"); time.sleep(3); wait_ready(pg)
    chk("delik silinince eşleşme ⚠", "m2" in asm("return [...a.bad]"), asm("return [...a.bad]"))
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

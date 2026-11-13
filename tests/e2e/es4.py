import cmdpatch, time, math
from playwright.sync_api import sync_playwright
from h import wait_ready, run, FRONT
ok = True
def chk(name, cond, info=""):
    global ok
    print(("TAMAM " if cond else "HATA  ") + name, info)
    ok = ok and bool(cond)
def skdoc(pts, ents, rels=[], dims=[]):
    return [{"id":"s1","type":"sketch","name":"Zq9","plane":FRONT,"data":{"pts":{k:{"x":x,"y":y} for k,(x,y) in pts.items()},"ents":ents,"rels":rels,"dims":dims,"seq":200}}]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e))); pg.on("dialog", lambda d: d.accept())
    pg.goto('http://localhost:4173/'); wait_ready(pg); time.sleep(0.4)
    ev = pg.evaluate
    E = "window.__app.mode.editor"
    def edit(feats):
        pg.goto("http://localhost:4173/"); wait_ready(pg); time.sleep(0.3); run(pg, "e", feats); pg.dblclick("#tree li:has-text('Zq9')"); time.sleep(0.5)
    def select(ids):
        ev(f"ids=>{{const e={E}; if(e.tool!=='select') e.setTool('select'); e.sel.clear(); ids.forEach(i=>e.sel.add(i)); e.renderPanel(); e.render()}}", ids); time.sleep(0.2)
    def btns(): return pg.locator("#pm-body button.rel-btn").all_inner_texts()
    # --- 1. eşit eğri uzunluğu: çizgi 30 ↔ yay (R10, 90°: 15.7)
    pts = {"a":(0,0),"b":(30,0),"c":(60,0),"s":(70,0),"t":(60,10)}
    ents = [{"id":"l1","t":"line","p1":"a","p2":"b"},{"id":"r1","t":"arc","c":"c","s":"s","e":"t","r":10}]
    edit(skdoc(pts, ents, [{"id":"f1","t":"fix","refs":["a"],"fx":0,"fy":0},{"id":"h1","t":"horizontal","refs":["l1"]},{"id":"f2","t":"fix","refs":["c"],"fx":60,"fy":0}]))
    select(["l1","r1"])
    chk("seçenek: Eşit eğri uzunluğu", any("Eşit eğri uzunluğu" in t for t in btns()), btns())
    pg.click("#pm-body button.rel-btn:has-text('Eşit eğri uzunluğu')"); time.sleep(0.3)
    L = lambda: ev(f"(()=>{{const d={E}.data,P=k=>d.pts[k];const l=Math.hypot(P('b').x-P('a').x,P('b').y-P('a').y);const a=d.ents.find(e=>e.id==='r1');let sw=Math.atan2(P('t').y-P('c').y,P('t').x-P('c').x)-Math.atan2(P('s').y-P('c').y,P('s').x-P('c').x);if(sw<=0)sw+=2*Math.PI;return [l,a.r*sw]}})()")
    v = L(); chk("uzunluklar eşit", abs(v[0]-v[1])<1e-6, v)
    chk("ilişki kaydedildi", ev(f"{E}.data.rels.some(r=>r.t==='eqcurve')"))
    ev(f"(()=>{{const e={E}; e['op'](()=>e.data.dims.push({{id:'dd',t:'dist',sub:'a',refs:['a','b'],v:40,lp:[15,-8]}}))}})()"); time.sleep(0.2)
    v = L(); chk("çizgi 40 → yay uzunluğu 40", abs(v[0]-40)<1e-4 and abs(v[1]-40)<1e-4, v)
    # --- 2. eş yarıçaplı (iki yay) + eşit kanallar
    pts = {"a1":(0,45),"a2":(0,35),"a3":(30,35),"a4":(30,45),"c1":(0,40),"c2":(30,40),
           "b1":(0,88),"b2":(0,72),"b3":(50,72),"b4":(50,88),"d1":(0,80),"d2":(50,80)}
    ents = [{"id":"A1","t":"arc","c":"c1","s":"a1","e":"a2","r":5},{"id":"A2","t":"arc","c":"c2","s":"a3","e":"a4","r":5},
            {"id":"AL1","t":"line","p1":"a4","p2":"a1"},{"id":"AL2","t":"line","p1":"a2","p2":"a3"},{"id":"AC","t":"line","p1":"c1","p2":"c2","cons":True},
            {"id":"B1","t":"arc","c":"d1","s":"b1","e":"b2","r":8},{"id":"B2","t":"arc","c":"d2","s":"b3","e":"b4","r":8},
            {"id":"BL1","t":"line","p1":"b4","p2":"b1"},{"id":"BL2","t":"line","p1":"b2","p2":"b3"},{"id":"BC","t":"line","p1":"d1","p2":"d2","cons":True}]
    rels = []
    for s in ["A","B"]:
        rels += [{"id":s+"t1","t":"tangent","refs":[s+"1",s+"L1"]},{"id":s+"t2","t":"tangent","refs":[s+"1",s+"L2"]},{"id":s+"t3","t":"tangent","refs":[s+"2",s+"L1"]},{"id":s+"t4","t":"tangent","refs":[s+"2",s+"L2"]},{"id":s+"h","t":"horizontal","refs":[s+"C"]}]
    edit(skdoc(pts, ents, rels))
    select(["A1","B1"])
    chk("iki yay: Eş yarıçaplı seçeneği", any("Eş yarıçaplı" in t for t in btns()), btns())
    select(["AL1","BL2"])
    chk("iki kanal: Eşit kanallar seçeneği", any("Eşit kanallar" in t for t in btns()), btns())
    pg.click("#pm-body button.rel-btn:has-text('Eşit kanallar')"); time.sleep(0.3)
    info = ev(f"(()=>{{const d={E}.data,P=k=>d.pts[k],r=i=>d.ents.find(e=>e.id===i).r,len=(a,b)=>Math.hypot(P(b).x-P(a).x,P(b).y-P(a).y);return [r('A1'),r('B1'),len('c1','c2'),len('d1','d2'),{E}.result.ok]}})()")
    chk("kanallar eşit (R ve merkez arası)", abs(info[0]-info[1])<1e-6 and abs(info[2]-info[3])<1e-6 and info[4], info)
    select(["AL1","l_yok"])
    chk("tek kanalda seçenek yok", not any("Eşit kanallar" in t for t in btns()))
    # --- 3. çap ↔ yarıçap
    pts = {"o":(0,0)}
    edit(skdoc(pts, [{"id":"C1","t":"circle","c":"o","r":10}], [], [{"id":"D1","t":"dia","refs":["C1"],"v":20,"lp":[12,12]}]))
    select(["D1"])
    chk("panelde Yarıçap olarak göster", pg.locator("#pm-body button:has-text('Yarıçap olarak göster')").count()==1)
    pg.click("#pm-body button:has-text('Yarıçap olarak göster')"); time.sleep(0.2)
    d = ev(f"{E}.data.dims[0]"); r = ev(f"{E}.data.ents[0].r")
    chk("yarıçap 10, daire aynı", d["t"]=="rad" and abs(d["v"]-10)<1e-9 and abs(r-10)<1e-9, (d, r))
    select(["D1"]); pg.mouse.move(700,450); pg.keyboard.press("d"); time.sleep(0.2)
    d = ev(f"{E}.data.dims[0]")
    chk("D tuşu → çap 20", d["t"]=="dia" and abs(d["v"]-20)<1e-9, d)
    # --- 4. çift mesafe
    pts = {"m1":(0,-20),"m2":(0,40),"q":(15,10)}
    edit(skdoc(pts, [{"id":"CL","t":"line","p1":"m1","p2":"m2","cons":True},{"id":"PQ","t":"point","p":"q"}], [{"id":"v1","t":"vertical","refs":["CL"]},{"id":"fx","t":"fix","refs":["m1"],"fx":0,"fy":-20}]))
    sp = ev(f"(()=>{{const e={E}; return e['dimSpec'](['q','CL'],[-10,10])}})()")
    chk("etiket merkez çizgisinin öbür yanında → çift mesafe", sp and sp.get("dbl") and sp["t"]=="pldist", sp)
    sp2 = ev(f"(()=>{{const e={E}; return e['dimSpec'](['q','CL'],[25,10])}})()")
    chk("aynı yanda → tek mesafe", sp2 and not sp2.get("dbl"), sp2)
    ev(f"(()=>{{const e={E}; e['op'](()=>e.data.dims.push({{id:'DD',t:'pldist',refs:['q','CL'],v:50,dbl:true,lp:[-10,10]}}))}})()"); time.sleep(0.2)
    chk("Ø50 → nokta merkezden 25", abs(ev(f"{E}.data.pts.q.x")-25)<1e-6, ev(f"{E}.data.pts.q"))
    select(["DD"])
    chk("panelde çift mesafe düğmesi", pg.locator("#pm-body button:has-text('Çift mesafe')").count()==1)
    ev(f"{E}.toggleDouble('DD')"); time.sleep(0.2)
    d = ev(f"{E}.data.dims.find(x=>x.id==='DD')")
    chk("tek mesafeye çevirince 25 ve nokta yerinde", abs(d["v"]-25)<1e-9 and not d.get("dbl") and abs(ev(f"{E}.data.pts.q.x")-25)<1e-6, d)
    chk("sayfa hatası yok", not logs, logs)
    print("SONUC:", "TAMAM" if ok else "HATA")

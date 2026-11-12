# montaj: teğet + limit eşleşmesi, eşleşme mini çubuğu, çarpışma algılama, bileşen çoğaltma
import cmdpatch, time, json
from playwright.sync_api import sync_playwright
from h import wait_ready, sketch, ext, TOP
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e))); pg.on("dialog", lambda d: d.accept(d.default_value))
    pg.goto('http://localhost:4173/'); wait_ready(pg); time.sleep(0.4)
    plate = [sketch("s1","S",TOP,lambda pt,line,rect,c,t: rect(-50,-50,50,50)), ext("e1","s1",10)]
    pin = [sketch("s1","S",TOP,lambda pt,line,rect,c,t: c(0,0,5)), ext("e1","s1",30)]
    asm = lambda js: pg.evaluate(f"(()=>{{const a=window.__app.asm; {js}}})()")
    pg.click("#tabs button[data-tab='asm']"); time.sleep(0.3)
    pg.click("#cmds button:has-text('Montajı Aç')"); time.sleep(0.5)
    asm(f"a.addComp({{name:'Plaka', features:{json.dumps(plate)}}})"); time.sleep(2); wait_ready(pg)
    asm(f"a.addComp({{name:'Pim', features:{json.dumps(pin)}}})"); time.sleep(2); wait_ready(pg)
    C = asm("return a.doc.comps.map(c=>c.id)")
    top = {"comp":C[0],"kind":"plane","c":[0,10,0],"n":[0,1,0]}
    side = {"comp":C[0],"kind":"plane","c":[50,5,0],"n":[1,0,0]}
    bot = {"comp":C[1],"kind":"plane","c":[0,0,0],"n":[0,-1,0]}
    cyl = {"comp":C[1],"kind":"cyl","c":[0,15,0],"n":[0,1,0],"r":5}
    # mini çubuk: Ctrl ile iki yüz → öneriler
    asm(f"a.pre=[{json.dumps(side)},{json.dumps(cyl)}]; a.showMateBar(400,300); return 0")
    print("bar:", pg.locator(".asm-matebar button").all_inner_texts())
    pg.click(".asm-matebar button[data-mate='tangent']"); time.sleep(0.2)
    asm(f"a.pre=[{json.dumps(top)},{json.dumps(bot)}]; a.showMateBar(400,300); return 0")
    pg.click(".asm-matebar button[data-mate='coincident']"); time.sleep(0.2)
    asm("a.doc.comps[1].p=[200,60,40]; a.press={x:0,y:0,comp:a.doc.comps[1].id,moved:true}; a.input.up({clientX:0,clientY:0}); return 0")
    print("tangent pin pos (x=55,y=10):", asm("return a.doc.comps[1].p.map(v=>+v.toFixed(2))"), "mates:", asm("return a.doc.mates.map(m=>m.type)"))
    # limit: z mesafesi [0,20] — ön yüz düzlemleri
    asm("a.doc.mates=[]; return 0")
    fr = {"comp":C[0],"kind":"plane","c":[0,5,50],"n":[0,0,1]}
    asm(f"a.doc.mates.push({{id:'t',type:'coincident',a:{json.dumps(top)},b:{json.dumps(bot)}}}); a.doc.mates.push({{id:'l',type:'limit',a:{json.dumps(fr)},b:{json.dumps({**cyl,'kind':'plane','c':[0,15,0],'n':[0,0,-1]})},v:0,vmax:20}}); return 0")
    for z in (100, 60, 10):
        asm(f"a.doc.comps[1].p=[0,0,{z}]; a.doc.comps[1].q=[0,0,0,1]; a.press={{x:0,y:0,comp:a.doc.comps[1].id,moved:true}}; a.input.up({{clientX:0,clientY:0}}); return 0")
        print(f"limit z0={z} →", asm("return +a.doc.comps[1].p[2].toFixed(2)"))
    # çarpışma algılama
    asm("a.doc.mates=[]; a.doc.comps[1].p=[0,5,0]; return 0")
    print("bbox:", asm("const b=a.bbox(a.doc.comps[1]); return b&&[b.min.toArray(),b.max.toArray()]"))
    print("collides on plate:", asm("return a.collides(a.doc.comps[1])"))
    asm("a.doc.comps[1].p=[200,0,0]; return 0")
    print("collides away:", asm("return a.collides(a.doc.comps[1])"))
    pg.keyboard.press("Control+1"); time.sleep(0.3)
    asm("a.collide=true; a.doc.comps[1].p=[60,0,0]; a.press={x:500,y:400,comp:a.doc.comps[1].id,moved:true}; return 0")
    for i in range(10): asm(f"a.input.move({{clientX:{500-40*(i+1)},clientY:400}}); return 0")
    print("drag blocked:", asm("return a.doc.comps[1].p.map(v=>+v.toFixed(1))"), "no overlap:", not asm("return a.collides(a.doc.comps[1])"))
    asm("a.press=null; a.collide=false; return 0")
    # bileşen çoğaltma
    asm("a.sel=a.doc.comps[1].id; return 0")
    pg.click("#cmds button:has-text('Bileşen Çoğalt')"); time.sleep(0.3)
    pg.click("#pm-ok"); time.sleep(2.5); wait_ready(pg)
    print("after lin pattern:", asm("return a.doc.comps.map(c=>c.name+'@'+c.p.map(v=>Math.round(v)).join(','))"))
    print("tree li:", pg.locator("#tree li").count(), "errors:", logs)

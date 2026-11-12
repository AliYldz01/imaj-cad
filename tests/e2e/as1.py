import cmdpatch, time
from playwright.sync_api import sync_playwright
from h import wait_ready, sketch, ext, run, TOP, FRONT
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}, accept_downloads=True); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e))); pg.on("dialog", lambda d: d.accept())
    pg.goto('http://localhost:4173/'); wait_ready(pg); time.sleep(0.4)
    # parça 1: plaka 100x100x10 ; parça 2: pim Ø10 boy 30
    plate = [sketch("s1","S",TOP,lambda pt,line,rect,c,t: (rect(-50,-50,50,50), c(0,0,5))), ext("e1","s1",10)]
    pin = [sketch("s1","S",TOP,lambda pt,line,rect,c,t: c(0,0,5)), ext("e1","s1",30)]
    A = pg.evaluate("window.__app")
    ev = pg.evaluate
    asm = lambda js: ev(f"(()=>{{const a=window.__app.asm; {js}}})()")
    pg.click("#tabs button[data-tab='asm']"); time.sleep(0.3)
    print("cmds off:", pg.locator("#cmds .cmd .lbl").all_inner_texts())
    pg.click("#cmds button:has-text('Montajı Aç')"); time.sleep(0.5)
    asm(f"a.addComp({{name:'Plaka', features:{__import__('json').dumps(plate)}}})"); time.sleep(2); wait_ready(pg)
    asm(f"a.addComp({{name:'Pim', features:{__import__('json').dumps(pin)}}})"); time.sleep(2); wait_ready(pg)
    print("tree:", pg.locator("#tree li").all_inner_texts())
    # eşleşme: plaka üst yüzü (y=10, n +y) ile pim alt yüzü (y=0, n -y) çakışık; delik ve pim eş merkezli
    comps = asm("return a.doc.comps.map(c=>c.id)")
    m1 = {"comp":comps[0],"kind":"plane","c":[0,10,0],"n":[0,1,0]}
    m2 = {"comp":comps[1],"kind":"plane","c":[0,0,0],"n":[0,-1,0]}
    c1 = {"comp":comps[0],"kind":"cyl","c":[0,5,0],"n":[0,1,0],"r":5}
    c2 = {"comp":comps[1],"kind":"cyl","c":[0,15,0],"n":[0,1,0],"r":5}
    import json
    asm(f"a.doc.mates.push({{id:'m1',type:'coincident',a:{json.dumps(m1)},b:{json.dumps(m2)}}}); a.doc.mates.push({{id:'m2',type:'concentric',a:{json.dumps(c1)},b:{json.dumps(c2)}}}); return 0")
    print("solve:", asm("const r = window.__solve ? 0 : 0; return 0"))
    asm("a.doc.comps[1].p=[120,40,30]; a.doc.comps[1].q=[0.3826834,0,0,0.9238795]; return 0")
    r = ev("(()=>{const a=window.__app.asm; return import('/src/asm/assembly.ts').catch(()=>null)})()")
    # çözücüyü sürükleme bırakma yoluyla tetikle
    asm("a.input.down({clientX:0,clientY:0}); a.input.up({clientX:0,clientY:0}); return 0")
    asm("a.press={x:0,y:0,comp:a.doc.comps[1].id,moved:true}; a.input.up({clientX:0,clientY:0}); return 0")
    print("pin pos:", asm("return a.doc.comps[1].p.map(v=>+v.toFixed(3))"), "q:", asm("return a.doc.comps[1].q.map(v=>+v.toFixed(3))"))
    print("tree:", pg.locator("#tree li").all_inner_texts())
    pg.keyboard.press("f"); time.sleep(0.3)
    r = pg.query_selector("#view").bounding_box()
    sp = ev("window.__app.viewer.toScreen([30,10,30])")
    print("pick plate top:", asm(f"const p=a.pick({r['x']}+{sp[0]},{r['y']}+{sp[1]}); return p&&[p.comp===a.doc.comps[0].id, p.ent&&p.ent.kind, p.ent&&p.ent.n.map(v=>+v.toFixed(2))]"))
    sp = ev("window.__app.viewer.toScreen([5,25,0])")
    print("pick pin side:", asm(f"const p=a.pick({r['x']}+{sp[0]},{r['y']}+{sp[1]}); return p&&[p.ent&&p.ent.kind, p.ent&&p.ent.r, p.ent&&p.ent.n.map(v=>+Math.abs(v).toFixed(2))]"))
    pg.click("#cmds button:has-text('Girişim')"); time.sleep(4); print("interf:", pg.inner_text("#toast"))
    with pg.expect_download() as dl: pg.click("#cmds button:has-text('STEP (montaj)')")
    print("step size:", len(open(dl.value.path()).read()))
    pg.click("#cmds button:has-text('Malzeme Listesi')"); print("bom:", pg.locator("dialog table tr").all_inner_texts()); pg.keyboard.press("Escape")
    pg.click("#cmds button:has-text('Parçaya Dön')"); time.sleep(0.5); print("back tab tree:", pg.locator("#tree li").count())
    print("errors:", logs)

# yapı elemanı grupları, Alignment, profili konumlandır; 3B eskizde nokta sürükleme + Along X/Y/Z korunumu, Ctrl+yüz eksen hizalama
import cmdpatch, time, json
from h import *
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    # iskelet: X çizgisi + düşey çizgi (L)
    s3 = {"id":"k","type":"sketch3d","name":"K","ids":["a","b","c"],"xyz":[[0,0,0],[500,0,0],[500,400,0]],"lines":[{"id":"l1","a":"a","b":"b","ax":"x"},{"id":"l2","a":"b","b":"c","ax":"y"}],"r":0,"seq":5}
    base = {"id":"m","type":"member","name":"M","std":"dkutu","size":"100x50x4","align":"c","mirror":False,"rot":0,"corner":"none","gap":0,"ori":2}
    # 1) gruplar: l1 grup1 (merkez), l2 grup2 (rot 90)
    run(pg,"grup: l2 dondurulmus",[s3, dict(base, segs=[{"sk":"k","ent":"l1"}], groups=[{"segs":[{"sk":"k","ent":"l2"}],"align":"c","mirror":False,"rot":90,"corner":"none","gap":0}])])
    print("cut:", pg.evaluate("async()=>(await window.__app.kernel.cutList()).map(c=>[c.name,+c.length.toFixed(1)])"))
    # 2) alignment: X çizgisinde dikey eksen Z'ye → yükseklik Z boyunca (bb z ±50)
    s1 = dict(s3, lines=[s3["lines"][0]])
    run(pg,"align dikey->Z",[s1, dict(base, segs=[{"sk":"k","ent":"l1"}], alignAx="v", alignTo=[0,0,1])])
    run(pg,"align yatay->Y (yukseklik Z)",[s1, dict(base, segs=[{"sk":"k","ent":"l1"}], alignAx="h", alignTo=[0,1,0])])
    # 3) UI: yapı elemanı paneli, grup ekle, segment tıkla, profili konumlandır
    pg.evaluate("d=>window.__app.setDoc(d)", {"version":2,"name":"T","features":[s3],"seq":{}}); time.sleep(0.4); wait_ready(pg)
    pg.click("#tabs button[data-tab='weld']")
    pg.click("#tree li:has-text('K')")
    pg.click("#cmds button:has-text('Yapı Elemanı')"); time.sleep(0.5)
    pg.click(".vcube .iso"); time.sleep(0.3); pg.click("#view", position={"x":5,"y":400}); pg.keyboard.press("f"); time.sleep(0.4)
    R = pg.query_selector("#view").bounding_box()
    def S(x,y,z):
        s = pg.evaluate(f"window.__app.viewer.toScreen([{x},{y},{z}])"); return R['x']+s[0], R['y']+s[1]
    pg.click("#pm-body button:has-text('+ Yeni grup')"); time.sleep(0.2)
    x,y = S(500,200,0); pg.mouse.click(x,y); time.sleep(0.3)
    print("groups:", pg.evaluate("(()=>{const d=window.__app.mode.draft; return [d.segs.map(s=>s.ent), d.groups.map(g=>g.segs.map(s=>s.ent))]})()"))
    pg.click("#pm-body button:has-text('Profili konumlandır')"); time.sleep(0.3)
    n = pg.locator("dialog circle.pp").count(); print("pierce candidates:", n)
    pg.evaluate("document.querySelector('dialog circle.pp').dispatchEvent(new MouseEvent('click'))"); time.sleep(0.3)
    print("group2 pierce:", pg.evaluate("(()=>{const g=window.__app.mode.draft.groups[0]; return [g.align, g.poff]})()"))
    pg.select_option("#pm-body label.pm-field:has-text('Profil ekseni') select", "v"); time.sleep(0.3)
    pg.click("#pm-body button:has-text('Kenar veya eskiz çizgisi seç')"); time.sleep(0.2)
    x,y = S(250,0,0); pg.mouse.click(x,y); time.sleep(0.3)
    print("align from line:", pg.evaluate("window.__app.mode.draft.groups[0].alignTo"))
    pg.click("#pm-ok"); time.sleep(1.5); wait_ready(pg)
    print("status:", pg.inner_text('#status-text'), pg.eval_on_selector_all("#tree li.err", "els=>els.map(e=>e.title)"))
    # 4) 3B eskiz: nokta sürükle, Along korunur
    pg.evaluate("d=>window.__app.setDoc(d)", {"version":2,"name":"T","features":[],"seq":{}}); time.sleep(0.4); wait_ready(pg)
    pg.click("#cmds button:has-text('3B Eskiz')"); time.sleep(0.4)
    pg.click(".vcube .iso"); time.sleep(0.3)
    pg.evaluate("(()=>{const d=window.__app.mode.draft; d.ids=['a','b','c']; d.xyz=[[0,0,0],[300,0,0],[300,200,0]]; d.lines=[{id:'l1',a:'a',b:'b',ax:'x'},{id:'l2',a:'b',b:'c',ax:'y'}]; d.seq=5; d._act=-1;})()")
    x,y = S(300,0,0); x2,y2 = S(300,0,150)
    pg.mouse.move(x,y); pg.mouse.down(); pg.mouse.move((x+x2)/2,(y+y2)/2, steps=4); pg.mouse.move(x2,y2, steps=4); pg.mouse.up(); time.sleep(0.3)
    print("after drag:", pg.evaluate("JSON.stringify(window.__app.mode.draft.xyz)"))
    # Ctrl + boşluk: global eksen
    pg.keyboard.down("Control"); pg.mouse.click(R['x']+60, R['y']+60); pg.keyboard.up("Control")
    print("axes z:", pg.evaluate("window.__app.s3.axes.z.toArray()"))
    print("errors:", logs)

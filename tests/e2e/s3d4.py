# 3B eskiz eksikleri: 3 noktalı yay, eskiz radyüsü (teğet + R ölçüsü), kırp, uzat, ayna, ölçü–denklem bağı,
# yay boyunca yapı elemanı, gruplar arası kırpma önceliği
import cmdpatch, time, json
from h import *
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    pg.click("#tabs button[data-tab='weld']")
    pg.click("#cmds button:has-text('3B Eskiz')"); time.sleep(0.4)
    pg.click(".vcube .iso"); time.sleep(0.3)
    R = pg.query_selector("#view").bounding_box()
    def S(x,y,z):
        s = pg.evaluate(f"window.__app.viewer.toScreen([{x},{y},{z}])"); return R['x']+s[0], R['y']+s[1]
    D = lambda js: pg.evaluate(f"(()=>{{const d=window.__app.mode.draft; return {js}}})()")
    tool = lambda t: pg.click(f"#pm-body .seg button:has-text('{t}')")
    # L şekli: (0,0,0)->(150,0,0)->(150,100,0) + çapraz çizgi (75,-30,0)->(75,60,0) (kırp/uzat için)
    pg.evaluate("""(()=>{const d=window.__app.mode.draft; d.ids=['a','b','c','e','f']; d.xyz=[[0,0,0],[150,0,0],[150,100,0],[75,-30,0],[75,60,0]];
      d.lines=[{id:'l1',a:'a',b:'b',ax:'x'},{id:'l2',a:'b',b:'c',ax:'y'},{id:'l3',a:'e',b:'f'}]; d.seq=20; d._act=-1;})()""")
    pg.keyboard.press("f"); time.sleep(0.4)
    # yay: 3 nokta
    tool("Yay"); time.sleep(0.2)
    for pt in [(150,100,0),(0,0,0),(40,90,0)]:
        x,y = S(*pt); pg.mouse.move(x,y); pg.mouse.click(x,y); time.sleep(0.4)
    print("arc:", D("(d.arcs3||[]).length"), D("JSON.stringify(d.xyz[d.ids.indexOf((d.arcs3||[])[0]?.m)])"))
    pg.evaluate("window.__app.s3.sel=[{k:'a',id:window.__app.mode.draft.arcs3[0].id}]; window.__app.s3.deleteSel()")
    print("arc deleted:", D("d.arcs3.length"), D("d.xyz.length"))
    # eskiz radyüsü: b köşesi, R=30
    pg.evaluate("window.__app.s3.sel=[{k:'p',id:'b'}]; window.__app.s3.fillet('b',30)")
    print("fillet:", D("d.arcs3.length"), D("(d.cons3||[]).map(c=>c.t).join(',')"), D("(d.dims3||[]).map(m=>m.t+m.v).join(',')"),
          D("JSON.stringify(d.lines.slice(0,2).map(l=>[d.xyz[d.ids.indexOf(l.a)],d.xyz[d.ids.indexOf(l.b)]]))"))
    # yarıçap ölçüsünü 40 yap → çözücü teğetliği korur
    pg.evaluate("(()=>{const s=window.__app.s3, d=window.__app.mode.draft; s.editDim(d.dims3.find(m=>m.t==='rad').id, undefined, 40)})()")
    print("R40:", D("JSON.stringify(d.lines.slice(0,2).map(l=>[d.xyz[d.ids.indexOf(l.a)],d.xyz[d.ids.indexOf(l.b)]]))"))
    # kırp: l3 çizgisinin l1 altındaki parçası (75,-15,0)
    tool("Kırp"); time.sleep(0.2)
    x,y = S(75,-20,0); pg.mouse.click(x,y); time.sleep(0.3)
    print("trim:", D("JSON.stringify(d.lines.filter(l=>l.id==='l3').map(l=>[d.xyz[d.ids.indexOf(l.a)],d.xyz[d.ids.indexOf(l.b)]]))"))
    # uzat: l3 üst ucu (75,60) → yukarı doğrultuda hedef yok; önce hedef çizgi ekle (0,100)->(100,100)
    pg.evaluate("(()=>{const d=window.__app.mode.draft; d.ids.push('g','h'); d.xyz.push([0,100,0],[100,100,0]); d.lines.push({id:'l4',a:'g',b:'h',ax:'x'})})()")
    tool("Uzat"); time.sleep(0.2)
    x,y = S(75,55,0); pg.mouse.click(x,y); time.sleep(0.3)
    print("extend:", D("JSON.stringify(d.xyz[d.ids.indexOf(d.lines.find(l=>l.id==='l3').b)])"))
    # ayna: l4 çizgisini YZ düzlemine göre aynala
    pg.evaluate("window.__app.s3.sel=[{k:'l',id:'l4'}]; window.__app.s3.addRel('mirYZ')"); time.sleep(0.2)
    print("mirror:", D("JSON.stringify(d.lines.slice(-1).map(l=>[d.xyz[d.ids.indexOf(l.a)],d.xyz[d.ids.indexOf(l.b)]]))"))
    pg.click("#pm-ok"); time.sleep(0.8); wait_ready(pg)
    # denklem: yarıçap ölçüsü = 25
    pg.evaluate("""(()=>{const app=window.__app, d=JSON.parse(JSON.stringify(app.doc)); const f=d.features.find(x=>x.type==='sketch3d'); const j=f.dims3.findIndex(m=>m.t==='rad'); d.eqs={[f.id+'.dims3['+j+'].v']:'25'}; app.setDoc(d);})()"""); time.sleep(0.8); wait_ready(pg)
    print("eq R:", pg.evaluate("(()=>{const f=window.__app.doc.features.find(x=>x.type==='sketch3d'); return f.dims3.find(m=>m.t==='rad').v})()"))
    # yapı elemanı: köşesi yaylı L (l1, yay, l2) boru
    pg.click("#cmds button:has-text('Yapı Elemanı')"); time.sleep(0.5)
    pg.select_option("#pm-body select >> nth=0", "boru"); time.sleep(0.3)
    pg.click("#pm-ok"); time.sleep(1.5); wait_ready(pg)
    print("member:", pg.inner_text('#status-text'), pg.eval_on_selector_all("#tree li.err", "els=>els.map(e=>e.title)"))
    print("cut:", pg.evaluate("async()=>(await window.__app.kernel.cutList()).map(c=>[c.name,+c.length.toFixed(1)])"))
    # kırpma önceliği: iki grup köşede; prio ile yatay sürekli
    sk = {"id":"k","type":"sketch3d","name":"K","ids":["a","b","c"],"xyz":[[0,0,0],[500,0,0],[500,400,0]],"lines":[{"id":"l1","a":"a","b":"b"},{"id":"l2","a":"b","b":"c"}],"r":0,"seq":5}
    mem = lambda prio: {"id":"m","type":"member","name":"M","std":"kutu","size":"40x40x3","align":"c","mirror":False,"rot":0,"corner":"miter","gap":0,"ori":2,"segs":[{"sk":"k","ent":"l1"}],**({"prio":1} if prio else {}),
         "groups":[{"segs":[{"sk":"k","ent":"l2"}],"align":"c","mirror":False,"rot":0,"corner":"miter","gap":0,**({"prio":2} if prio else {})}]}
    for pr in (False, True):
        pg.evaluate("d=>window.__app.setDoc(d)", {"version":2,"name":"T","features":[sk,mem(pr)],"seq":{}}); time.sleep(0.4); wait_ready(pg)
        print("prio" if pr else "auto", pg.evaluate("async()=>(await window.__app.kernel.cutList()).map(c=>+c.length.toFixed(1))"))
    print("errors:", logs)

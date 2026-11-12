# 2B eskiz radyüsü: kırpmadan kalan çift noktalı köşe, çakışık ilişkili köşe, çizgi–yay köşesi, yay–yay köşesi
import cmdpatch, time
from h import *
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    pg.click("#tree li:has-text('Ön Düzlem')"); pg.click("#tree-actions button:has-text('Eskiz')"); time.sleep(0.4)
    r = pg.query_selector("#view").bounding_box()
    def sc(x,y):
        s = pg.evaluate(f"(()=>{{const e=window.__app.mode.editor; const f=e.frame; const yv=[f.n[1]*f.x[2]-f.n[2]*f.x[1], f.n[2]*f.x[0]-f.n[0]*f.x[2], f.n[0]*f.x[1]-f.n[1]*f.x[0]]; const w=[f.o[0]+f.x[0]*{x}+yv[0]*{y}, f.o[1]+f.x[1]*{x}+yv[1]*{y}, f.o[2]+f.x[2]*{x}+yv[2]*{y}]; return window.__app.viewer.toScreen(w);}})()")
        return r["x"]+s[0], r["y"]+s[1]
    ed = "window.__app.mode.editor"
    def setup(js, corner, label):
        pg.evaluate(f"""(()=>{{const e={ed}; const d=e.data; d.ents=[]; d.rels=[]; d.dims=[]; for (const k of Object.keys(d.pts)) if (k!=='o') delete d.pts[k];
          const P=(id,x,y)=>{{d.pts[id]={{x,y}}; return id}}; {js} e.resolve(); e.render?.(); e.setTool('fillet'); e.opts.filletR=8;}})()""")
        time.sleep(0.15)
        pg.mouse.click(*sc(*corner)); time.sleep(0.3)
        res = pg.evaluate(f"{ed}.data.ents.map(e=>e.t).join(',')")
        tan = pg.evaluate(f"{ed}.data.rels.filter(r=>r.t==='tangent').length")
        st = pg.evaluate(f"[{ed}.result.ok, {ed}.result.conflicts.length]")
        print(f"{label}: {res} teget={tan} cozucu={st} toast='{pg.inner_text('#toast')}'")
        pg.evaluate("document.querySelector('#toast') && (document.querySelector('#toast').textContent='')")
    # 1) kırpmadan kalan: aynı yerde iki ayrı nokta
    setup("P('a',0,0);P('b',50,0);P('c',50,0.00004);P('d',50,40); d.ents.push({id:'L1',t:'line',p1:'a',p2:'b'},{id:'L2',t:'line',p1:'c',p2:'d'});", (50,0), "cift nokta")
    # 2) çakışık ilişkili iki nokta
    setup("P('a',0,0);P('b',50,0);P('c',50,0);P('d',50,40); d.ents.push({id:'L1',t:'line',p1:'a',p2:'b'},{id:'L2',t:'line',p1:'c',p2:'d'}); d.rels.push({id:'q1',t:'coincident',refs:['b','c']});", (50,0), "cakisik iliskili")
    # 3) çizgi–yay: yay merkez (0,0) R30, 0°→90°; çizgi (30,0)→(70,0)... yayın başlangıcından dışa doğru değil; (30,0)'dan aşağı eğik
    setup("P('o1',0,0);P('s',30,0);P('e',0,30);P('f',30,-40); d.ents.push({id:'A1',t:'arc',c:'o1',s:'s',e:'e',r:30},{id:'L1',t:'line',p1:'s',p2:'f'});", (30,0), "cizgi-yay (90°)")
    setup("P('o1',0,0);P('s',30,0);P('e',0,30);P('f',70,-10); d.ents.push({id:'A1',t:'arc',c:'o1',s:'s',e:'e',r:30},{id:'L1',t:'line',p1:'s',p2:'f'});", (30,0), "cizgi-yay (egik)")
    # 4) yay–yay: iki yay bir noktada buluşuyor
    setup("P('o1',0,0);P('o2',60,0);P('m',30,0);P('s1',0,30);P('e2',60,30); d.ents.push({id:'A1',t:'arc',c:'o1',s:'m',e:'s1',r:30},{id:'A2',t:'arc',c:'o2',s:'e2',e:'m',r:30});", (30,0), "yay-yay")
    print("errors:", logs)

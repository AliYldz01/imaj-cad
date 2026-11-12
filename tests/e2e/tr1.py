# 2B kırpma: iki daire + altlarında teğet çizgi; çizginin taşan uçlarını kırp, sonra dairelerin iç kısımlarını kırp (kayış şekli)
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
    pg.evaluate(f"{ed}.opts.quickDim=false")
    def run(c1, r1, c2, r2, y, label):
        # sıfırla ve kur: daireler + yatay çizgi + teğet ilişkileri (çözücü çizgiyi teğet konuma getirir)
        pg.evaluate(f"""(()=>{{const e={ed}; const d=e.data; d.ents=[]; d.rels=[]; d.dims=[]; for (const k of Object.keys(d.pts)) delete d.pts[k];
          let n=0; const P=(x,y)=>{{const id='T'+(n++); d.pts[id]={{x,y}}; return id}};
          const a=P({c1[0]},{c1[1]}), b=P({c2[0]},{c2[1]});
          d.ents.push({{id:'C1',t:'circle',c:a,r:{r1}}},{{id:'C2',t:'circle',c:b,r:{r2}}});
          const l1=P(-200,{y}+3e-8), l2=P(190,{y}-2e-8); d.ents.push({{id:'L',t:'line',p1:l1,p2:l2}});
          e.resolve(); e.render?.();}})()""")
        pg.evaluate(f"{ed}.setTool('trim')"); time.sleep(0.1)
        Y = pg.evaluate(f"(()=>{{const d={ed}.data; const l=d.ents.find(e=>e.id==='L'); const p=d.pts[l.p1]; return Array.isArray(p)?p[1]:p.y}})()")
        print("  cuts0:", pg.evaluate(f"{ed}.intersections({ed}.data.ents.find(e=>e.id==='L')).map(c=>c.p.map(v=>+v.toFixed(4)))"))
        for q in [(-150, Y), (175, Y)]:
            pg.mouse.click(*sc(*q)); time.sleep(0.25)
            print("  cuts:", pg.evaluate(f"{ed}.intersections({ed}.data.ents.find(e=>e.id==='L')).map(c=>c.p.map(v=>+v.toFixed(4)))"), pg.evaluate(f"{ed}.tool"))
        if "teget" in label:
            # üstte ikinci teğet çizgi ekle, onu da kırp; sonra dairelerin iç yarılarını kırp → kayış şekli
            pg.evaluate(f"""(()=>{{const e={ed}; const d=e.data; d.pts.U1={{x:-150,y:30}}; d.pts.U2={{x:175,y:30}}; d.ents.push({{id:'L2',t:'line',p1:'U1',p2:'U2'}}); e.resolve(); e.render?.();}})()""")
            for q in [(-100, 30), (160, 30), (30, 0), (90, 0)]:
                pg.mouse.click(*sc(*q)); time.sleep(0.3)
            print("  kayis:", pg.evaluate(f"{ed}.data.ents.map(e=>e.t+(e.t==='arc'?'':'')).join(',')"), "toast:", pg.inner_text("#toast"))
        L = pg.evaluate(f"""(()=>{{const d={ed}.data; const P=id=>{{const p=d.pts[id]; const a=Array.isArray(p)?p:[p.x,p.y]; return a.map(v=>Math.round(v*100)/100)}}; return d.ents.filter(e=>e.t==='line').map(e=>[P(e.p1),P(e.p2)])}})()""")
        st = pg.evaluate(f"[{ed}.result.ok, {ed}.result.conflicts.length, {ed}.result.dof]")
        print(f"{label}: tegetY={Y:.3f} cizgi={L} cozucu(ok,catisma,dof)={st} varlik={pg.evaluate(f'{ed}.data.ents.map(e=>e.t).join(\",\")')}")
    run((0,0),30,(120,0),30,-30,"esit daireler (teget, 1e-8 sapma)")
    run((0,0),30,(120,0),30,-20,"kesen cizgi")
    print("errors:", logs)

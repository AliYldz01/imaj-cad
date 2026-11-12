# 2B: çizgilerle kare (orijinden) → otomatik yatay/dikey; sol + üst ölçü → tam tanımlı; hizalama ilişkisi
import cmdpatch, time
from h import *
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    pg.click("#tree li:has-text('Ön Düzlem')"); pg.click("#tree-actions button:has-text('Eskiz')"); time.sleep(0.4)
    r = pg.query_selector("#view").bounding_box()
    pg.evaluate("(()=>{const v=window.__app.viewer; v.camera.zoom=0.9; v.camera.updateProjectionMatrix(); v.requestRender();})()")
    def sc(x,y):
        s = pg.evaluate(f"(()=>{{const e=window.__app.mode.editor; const f=e.frame; const yv=[f.n[1]*f.x[2]-f.n[2]*f.x[1], f.n[2]*f.x[0]-f.n[0]*f.x[2], f.n[0]*f.x[1]-f.n[1]*f.x[0]]; const w=[f.o[0]+f.x[0]*{x}+yv[0]*{y}, f.o[1]+f.x[1]*{x}+yv[1]*{y}, f.o[2]+f.x[2]*{x}+yv[2]*{y}]; return window.__app.viewer.toScreen(w);}})()")
        return r["x"]+s[0], r["y"]+s[1]
    ed = "window.__app.mode.editor"
    pg.evaluate(f"{ed}.opts.quickDim=false"); pg.evaluate(f"{ed}.setTool('line')")
    for q in [(0,0),(60,0),(60,60),(0,60),(0,0)]:
        x,y = sc(*q); pg.mouse.move(x,y); pg.mouse.click(x,y); time.sleep(0.15)
    pg.keyboard.press("Escape"); time.sleep(0.1)
    print("rels:", pg.evaluate(f"{ed}.data.rels.map(r=>r.t+':'+r.refs.length).join(', ')"))
    print("dof:", pg.evaluate(f"{ed}.result.dof"), pg.evaluate(f"{ed}.result.ok"))
    # ölçüler: sol çizgi ve üst çizgi
    lines = pg.evaluate(f"{ed}.data.ents.filter(e=>e.t==='line').map(e=>e.id)")
    pg.evaluate(f"""(()=>{{const e={ed}; const d=e.data; for (const id of ['{lines[1]}','{lines[2]}']) {{const l=d.ents.find(x=>x.id===id); d.dims.push({{id:'dx'+id,t:'dist',sub:'a',refs:[l.p1,l.p2],v:60,lp:[0,0]}});}} e.resolve();}})()""")
    print("after 2 dims dof:", pg.evaluate(f"{ed}.result.dof"), "conflicts:", pg.evaluate(f"{ed}.result.conflicts.length"))
    print("errors:", logs)

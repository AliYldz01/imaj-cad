import sys, time, json
from playwright.sync_api import sync_playwright
URL=sys.argv[1]; out="/home/claude/tests/t8_"
def wait_ready(pg, t=90000):
    pg.wait_for_function("!document.querySelector('#status').classList.contains('busy') && !document.querySelector('#status-text').textContent.includes('yükleniyor')", timeout=t)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.on("dialog", lambda d: d.accept())
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    r = pg.query_selector("#view").bounding_box()
    st = lambda: pg.inner_text("#status-text")
    def zoom(z=0.9):
        pg.evaluate(f"(()=>{{const v=window.__app.viewer; v.camera.zoom={z}; v.camera.updateProjectionMatrix(); const d=v.camera.position.clone().sub(v.controls.target); v.controls.target.set(0,0,0); v.camera.position.copy(d); v.camera.updateMatrixWorld(); v.requestRender();}})()")
    def sc(x,y):
        s = pg.evaluate(f"(()=>{{const e=window.__app.mode.editor; const f=e.frame; const yv=[f.n[1]*f.x[2]-f.n[2]*f.x[1], f.n[2]*f.x[0]-f.n[0]*f.x[2], f.n[0]*f.x[1]-f.n[1]*f.x[0]]; const w=[f.o[0]+f.x[0]*{x}+yv[0]*{y}, f.o[1]+f.x[1]*{x}+yv[1]*{y}, f.o[2]+f.x[2]*{x}+yv[2]*{y}]; return window.__app.viewer.toScreen(w);}})()")
        return r["x"]+s[0], r["y"]+s[1]
    def clk(*pts):
        for q in pts: pg.mouse.click(*sc(*q)); time.sleep(0.12)
    def tool(t): pg.click(f"#cmds button[title='{t}']"); time.sleep(0.1)
    ents = lambda: pg.evaluate("window.__app.mode.editor.data.ents.map(e=>e.t).join(',')")
    def ok(): pg.click("#pm-ok"); time.sleep(0.5); wait_ready(pg)
    # kutu
    pg.click("#tree li:has-text('Ön Düzlem')"); pg.click("#tree-actions button:has-text('Eskiz')"); time.sleep(0.3); zoom()
    tool("Dikdörtgen"); clk((-100,-100),(100,-60)); ok()
    tool("Ekstrüzyon"); time.sleep(0.6); wait_ready(pg); ok()
    # yeni eskiz araçları
    pg.click("#tree li:has-text('Ön Düzlem')"); pg.click("#tree-actions button:has-text('Eskiz')"); time.sleep(0.3); zoom()
    tool("Merkez Kanal"); clk((-70,40),(-50,40),(-50,48)); print("cslot:", ents(), st())
    tool("Yay Kanal"); clk((0,0),(30,0),(0,30),(36,0)); print("aslot:", ents()[-40:], st())
    tool("Elips"); clk((70,40),(90,40),(70,48)); print("ellipse:", ents()[-20:], st())
    tool("Kısmi Elips"); clk((70,0),(90,0),(70,8),(90,0),(70,8)); print("pellipse:", st())
    tool("Parabol"); clk((-90,-20),(-50,-20),(-70,0)); print("parabola:", st())
    tool("Spline"); clk((-40,-30),(-20,-20),(0,-35),(20,-25)); pg.click("#pm-body button:has-text(\"Spline'ı bitir\")"); time.sleep(0.2); print("spline:", ents()[-12:], st())
    tool("Metin"); clk((30,-40)); print("text:", ents()[-6:], st())
    pg.screenshot(path=out+"1_sketch.png")
    # tam tanımla
    tool("Tam Tanımla"); time.sleep(0.5); print("fully define:", pg.inner_text("#toast"), "|", st())
    print("undef:", pg.evaluate("""(()=>{const e=window.__app.mode.editor; const d=e.data; const und=Object.keys(d.pts).filter(id=>!e.defined.pts.has(id)); return und.map(id=>{const users=d.ents.filter(x=>JSON.stringify(x).includes('"'+id+'"')).map(x=>x.t); return id+':'+users.join('/')});})()"""))
    print("try:", pg.evaluate("""(async()=>{const e=window.__app.mode.editor; const d=e.data; const m=await import('/src/sketch/solver.ts').catch(()=>null); return 'n/a'})()"""))
    print("rels on p39:", pg.evaluate("(()=>{const d=window.__app.mode.editor.data; return [d.rels.filter(r=>r.refs.includes('p39')).map(r=>r.t), d.dims.filter(x=>x.refs.includes('p39')).map(x=>x.t+x.sub)]})()"))
    print("radii undef:", pg.evaluate("(()=>{const e=window.__app.mode.editor; return e.data.ents.filter(x=>(x.t==='arc'||x.t==='circle')&&!e.defined.radii.has(x.id)).map(x=>x.id)})()"))
    # referans ölçü: zaten tanımlı çizgiye ölçü → referans önerisi
    pg.screenshot(path=out+"2_defined.png")
    pg.click("#pm-cancel"); time.sleep(0.5); wait_ready(pg)
    # kesişim eğrisi: Üst düzlemde eskiz (kutuyu keser)
    pg.click("#tree li:has-text('Sağ Düzlem')"); pg.click("#tree-actions button:has-text('Eskiz')"); time.sleep(0.3); zoom()
    tool("Kesişim Eğr."); clk((0,0)); time.sleep(0.8); print("isect:", ents(), st())
    # ölçekle (taşı/kopyala)
    tool("Seç"); clk((0,-80))
    pg.click("#cmds button[title='Taşı/Kopyala']")
    pg.fill("#pm-body .pm-field:has-text('Ölçek') input","2"); pg.dispatch_event("#pm-body .pm-field:has-text('Ölçek') input","input")
    pg.fill("#pm-body .pm-field:has-text('X öteleme') input","0"); pg.dispatch_event("#pm-body .pm-field:has-text('X öteleme') input","input")
    pg.click("#pm-body button:has-text('Uygula')"); time.sleep(0.3)
    print("scale op:", pg.inner_text("#toast") if pg.is_visible("#toast") else "", st())
    pg.click("#pm-cancel"); time.sleep(0.4)
    print("errors:", logs or "none")
    b.close()

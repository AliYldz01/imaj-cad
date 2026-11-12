import cmdpatch
import sys, time
from playwright.sync_api import sync_playwright
URL=sys.argv[1]
def wait_ready(pg, t=90000):
    pg.wait_for_function("!document.querySelector('#status').classList.contains('busy') && !document.querySelector('#status-text').textContent.includes('yükleniyor')", timeout=t)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.on("dialog", lambda d: d.accept())
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    r = pg.query_selector("#view").bounding_box()
    def zoom(z=0.9):
        pg.evaluate(f"(()=>{{const v=window.__app.viewer; v.camera.zoom={z}; v.camera.updateProjectionMatrix(); const d=v.camera.position.clone().sub(v.controls.target); v.controls.target.set(0,0,0); v.camera.position.copy(d); v.camera.updateMatrixWorld(); v.requestRender();}})()")
    def sc(x,y):
        s = pg.evaluate(f"(()=>{{const e=window.__app.mode.editor; const f=e.frame; const yv=[f.n[1]*f.x[2]-f.n[2]*f.x[1], f.n[2]*f.x[0]-f.n[0]*f.x[2], f.n[0]*f.x[1]-f.n[1]*f.x[0]]; const w=[f.o[0]+f.x[0]*{x}+yv[0]*{y}, f.o[1]+f.x[1]*{x}+yv[1]*{y}, f.o[2]+f.x[2]*{x}+yv[2]*{y}]; return window.__app.viewer.toScreen(w);}})()")
        return r["x"]+s[0], r["y"]+s[1]
    def clk(*pts):
        for q in pts: pg.mouse.click(*sc(*q)); time.sleep(0.12)
    def tool(t): pg.click(f"#cmds button[title='{t}']"); time.sleep(0.1)
    def ok(): pg.click("#pm-ok"); time.sleep(0.5); wait_ready(pg)
    def screen_of(kind, pred):
        return pg.evaluate(f"""(()=>{{const v=window.__app.viewer, m=v.mesh, rr=v.renderer.domElement.getBoundingClientRect(); const L=m.{kind}s; for(let i=0;i<L.length;i++){{ const it=L[i]; if(!({pred})(it)) continue; const sp=v.toScreen(it.{'m' if kind=='edge' else 'c'}); const h=v.pick(rr.left+sp[0], rr.top+sp[1], {{{kind}:true}}); if(h&&h.index===i) return [rr.left+sp[0], rr.top+sp[1]]; }} return null;}})()""")
    pg.click("#tree li:has-text('Ön Düzlem')"); pg.click("#tree-actions button:has-text('Eskiz')"); time.sleep(0.3); zoom()
    tool("Dikdörtgen"); clk((0,0),(80,50)); ok()
    tool("Ekstrüzyon"); time.sleep(0.5); wait_ready(pg); ok()
    pg.click(".vcube .iso"); zoom()
    fc = screen_of("face", "f=>f.n&&f.n[2]>0.9"); pg.mouse.click(*fc); time.sleep(0.2)
    tool("Eskiz"); time.sleep(0.3); zoom()
    tool("Daire"); clk((40,25),(50,25)); ok()
    tool("Ekst. Kesme"); time.sleep(0.4)
    pg.select_option("#pm-body .pm-group:has-text('Yön 1') select", "blind"); time.sleep(0.2)
    pg.fill("#pm-body .pm-field:has-text('Derinlik') input","5"); pg.dispatch_event("#pm-body .pm-field:has-text('Derinlik') input","input"); time.sleep(0.6); wait_ready(pg); ok()
    zmin = lambda: pg.evaluate("Math.min(...window.__app.viewer.mesh.faces.filter(f=>f.type==='PLANE'&&f.n&&f.n[2]>0.9).map(f=>f.c[2]))")
    print("pocket floor z (expect 15):", round(zmin(),3))
    # Ekstrüzyon1 derinliğini 40 yap
    pg.click("#tree li:has-text('Ekstrüzyon1')"); pg.click("#tree-actions button:has-text('Düzenle')"); time.sleep(0.5)
    pg.fill("#pm-body .pm-field:has-text('Derinlik') input","40"); pg.dispatch_event("#pm-body .pm-field:has-text('Derinlik') input","input"); time.sleep(0.6); wait_ready(pg); ok()
    time.sleep(0.5); wait_ready(pg)
    print("after edit pocket floor z (expect 35):", round(zmin(),3), "bbox", pg.evaluate("window.__app.viewer.mesh.bbox.max"))
    print("sketch frame:", pg.evaluate("JSON.stringify(window.__app.doc.features[2].plane.frame.o)"))
    # Koniklik: +x yüzü, nötr = ön
    pg.click("#tabs button[data-tab='features']"); tool("Koniklik"); time.sleep(0.4)
    pg.click(".vcube .iso"); zoom(); time.sleep(0.2)
    fx = screen_of("face", "f=>f.n&&f.n[0]>0.9"); pg.mouse.click(*fx); time.sleep(0.2)
    pg.select_option("#pm-body .pm-group:has-text('Nötr') select", "std:front"); ok()
    print("draft status:", pg.inner_text("#status-text"), "x-face normals:", pg.evaluate("window.__app.viewer.mesh.faces.filter(f=>f.n&&f.n[0]>0.5).map(f=>f.n.map(v=>+v.toFixed(3)))"))
    print("errors:", logs or "none")
    b.close()

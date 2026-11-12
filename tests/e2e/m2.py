import sys, time
from playwright.sync_api import sync_playwright
URL=sys.argv[1]; out="/home/claude/tests/m2_"
def wait_ready(pg, t=60000):
    pg.wait_for_function("!document.querySelector('#status').classList.contains('busy') && !document.querySelector('#status-text').textContent.includes('yükleniyor')", timeout=t)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    ctx = b.new_context(viewport={"width":390,"height":844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    m = ctx.new_page(); logs=[]
    m.on("pageerror", lambda e: logs.append(str(e)))
    m.on("dialog", lambda d: d.accept())
    m.goto(URL); wait_ready(m); time.sleep(0.5)
    m.evaluate("localStorage.setItem('imajcad.input', JSON.stringify({profile:'capacitive'}))"); m.reload(); wait_ready(m)
    m.screenshot(path=out+"0.png")
    m.tap("#tree-btn"); time.sleep(0.3)
    m.screenshot(path=out+"1_tree.png")
    m.tap("#tree li:has-text('Üst Düzlem')"); m.tap("#tree-actions button:has-text('Eskiz')"); time.sleep(0.4)
    print("mode", m.evaluate("window.__app.mode.k"))
    r = m.query_selector("#view").bounding_box()
    m.tap("#cmds button[title='Daire']")
    def sc(x,y):
        s = m.evaluate(f"(()=>{{const f=window.__app.mode.editor.frame; const yv=[f.n[1]*f.x[2]-f.n[2]*f.x[1], f.n[2]*f.x[0]-f.n[0]*f.x[2], f.n[0]*f.x[1]-f.n[1]*f.x[0]]; const w=[f.o[0]+f.x[0]*{x}+yv[0]*{y}, f.o[1]+f.x[1]*{x}+yv[1]*{y}, f.o[2]+f.x[2]*{x}+yv[2]*{y}]; return window.__app.viewer.toScreen(w);}})()")
        return r["x"]+s[0], r["y"]+s[1]
    m.touchscreen.tap(*sc(0,0)); time.sleep(0.2); m.touchscreen.tap(*sc(30,0)); time.sleep(0.4)
    print("ents", m.evaluate("window.__app.mode.editor.data.ents.map(e=>e.t)"), m.inner_text("#status-text"))
    m.tap("#cmds button[title='Akıllı Ölçü']")
    m.touchscreen.tap(*sc(0,30)); time.sleep(0.2); m.touchscreen.tap(*sc(45,45)); time.sleep(0.4)
    m.screenshot(path=out+"2_prompt.png")
    m.fill(".dim-prompt input","50"); m.tap(".dim-prompt .ok"); time.sleep(0.4)
    print("status", m.inner_text("#status-text"))
    m.screenshot(path=out+"3_sketch.png")
    m.tap("#pm-ok"); time.sleep(0.4); wait_ready(m)
    m.tap("#tabs button[data-tab='features']")
    m.tap("#cmds button[title='Ekstrüzyon']"); time.sleep(1.0); wait_ready(m)
    m.screenshot(path=out+"4_extrude_pm.png")
    m.tap("#pm-ok"); time.sleep(0.6); wait_ready(m)
    m.tap(".vcube .iso"); m.tap("#viewbar button[title='Ekrana sığdır']"); time.sleep(0.4)
    m.screenshot(path=out+"5_solid.png")
    print("faces", m.evaluate("window.__app.viewer.mesh&&window.__app.viewer.mesh.faces.length"))
    print("errors:", logs or "none")
    b.close()

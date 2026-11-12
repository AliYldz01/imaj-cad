import cmdpatch
import sys, time, json
from playwright.sync_api import sync_playwright
URL=sys.argv[1]; out="/home/claude/tests/t5_"
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
    def tab(t): pg.click(f"#tabs button[data-tab='{t}']"); time.sleep(0.1)
    def sketch_on(plane):
        pg.click(f"#tree li:has-text('{plane}')"); pg.click("#tree-actions button:has-text('Eskiz')"); time.sleep(0.3); zoom()
    def ok(): pg.click("#pm-ok"); time.sleep(0.4); wait_ready(pg)
    def feat(name, setup=None):
        tab("features"); tool(name); time.sleep(0.6); wait_ready(pg)
        if setup: setup()
        time.sleep(0.6); wait_ready(pg)
        err = pg.evaluate("document.querySelector('#status').className")
        s_ = st(); ok(); return s_
    def mesh(): return pg.evaluate("(()=>{const m=window.__app.viewer.mesh; return m&&{f:m.faces.length, bb:m.bbox}})()")
    def screen_of(kind, pred):
        return pg.evaluate(f"""(()=>{{const v=window.__app.viewer, m=v.mesh, rr=v.renderer.domElement.getBoundingClientRect(); const L=m.{kind}s; for(let i=0;i<L.length;i++){{ const it=L[i]; if(!({pred})(it)) continue; const sp=v.toScreen(it.{'m' if kind=='edge' else 'c'}); const h=v.pick(rr.left+sp[0], rr.top+sp[1], {{{kind}:true}}); if(h&&h.index===i) return [rr.left+sp[0], rr.top+sp[1]]; }} return null;}})()""")
    def iso(): pg.click(".vcube .iso"); zoom(); time.sleep(0.2)
    # 1. Kutu
    sketch_on("Ön Düzlem"); tool("Dikdörtgen"); clk((0,0),(100,60))
    # ötele (dikdörtgen kopyası içe) testi sonra; şimdi çık
    ok(); print("box:", feat("Ekstrüzyon"), mesh())
    iso()
    # 2. Delik sihirbazı: üst yüz (z=20, n +z)
    tab("features"); tool("Delik Sihirb."); time.sleep(0.4)
    fc = screen_of("face", "f=>f.n&&f.n[2]>0.9")
    pg.mouse.click(fc[0]-40, fc[1]); time.sleep(0.3); pg.mouse.click(fc[0]+40, fc[1]); time.sleep(0.3)
    pg.click("#pm-body .seg button:has-text('Havşa')"); time.sleep(0.8); wait_ready(pg)
    print("hole pts:", pg.evaluate("window.__app.mode.draft.pts"), st())
    pg.screenshot(path=out+"1_hole.png")
    ok(); print("after hole:", mesh(), st())
    # 3. Yüzeye kadar: ön düzlemde daire (-40,30) -> kutunun üst yüzü (z=20)
    sketch_on("Ön Düzlem"); tool("Daire"); clk((-40,30),(-30,30)); ok()
    def up_to():
        pg.select_option("#pm-body .pm-group:has-text('Yön 1') select", "surface"); time.sleep(0.4)
        iso()
        fc2 = screen_of("face", "f=>f.n&&f.n[2]>0.9&&f.c[0]>10")
        pg.mouse.click(*fc2); time.sleep(0.8); wait_ready(pg)
    print("up to surface:", feat("Ekstrüzyon", up_to), mesh())
    # 4. Koniklikli ekstrüzyon: daire (-40,-40) r10, 30 mm, 5°
    sketch_on("Ön Düzlem"); tool("Daire"); clk((-40,-40),(-30,-40)); ok()
    def drafted():
        pg.fill("#pm-body .pm-field:has-text('Derinlik') input","30"); pg.dispatch_event("#pm-body .pm-field:has-text('Derinlik') input","input")
        pg.check("#pm-body .pm-check:has-text('Koniklik') input"); time.sleep(0.3)
    print("draft extrude:", feat("Ekstrüzyon", drafted), mesh())
    # 5. Süpürme: yol ön düzlemde, profil üst düzlemde
    sketch_on("Ön Düzlem"); tool("Çizgi"); clk((-90,0),(-90,50),(-70,70)); pg.keyboard.press("Enter"); ok()
    sketch_on("Üst Düzlem"); tool("Daire"); clk((-90,0),(-85,0)); ok()
    def sweep_setup():
        sels = pg.query_selector_all("#pm-body select")
        print("  sweep opts:", pg.evaluate("[...document.querySelectorAll('#pm-body select')].map(s=>s.value)"))
    print("sweep:", feat("Süpürme", sweep_setup), mesh())
    # 6. Loft: ön düzlemde kare, ref düzlemde (-40) daire
    tab("features"); tool("Ref. Düzlem"); time.sleep(0.3)
    pg.fill("#pm-body .pm-field:has-text('Mesafe') input","-40"); pg.dispatch_event("#pm-body .pm-field:has-text('Mesafe') input","input"); ok()
    sketch_on("Ön Düzlem"); tool("Merkez Dikd."); clk((50,30),(65,45)); ok()
    pg.click("#tree li:has-text('Düzlem1')"); pg.click("#tree-actions button:has-text('Eskiz')"); time.sleep(0.3); zoom()
    tool("Daire"); clk((50,30),(58,30)); ok()
    print("loft:", feat("Loft"), mesh())
    iso(); pg.screenshot(path=out+"2_features.png")
    # 7. Koniklik özelliği: kutunun +x yan yüzü, nötr düzlem Ön
    def draft_setup():
        fc3 = screen_of("face", "f=>f.n&&f.n[0]>0.9&&f.c[0]>99")
        print("  draft face:", fc3)
        if fc3: pg.mouse.click(*fc3); time.sleep(0.3)
        pg.select_option("#pm-body .pm-group:has-text('Nötr') select", "std:front")
    print("draft feature:", feat("Koniklik", draft_setup), mesh())
    # 8. Ölç: iki paralel yüz
    tab("evaluate"); tool("Ölç")
    a = screen_of("face", "f=>f.n&&f.n[1]>0.9&&f.c[1]>59"); bq = screen_of("face", "f=>f.n&&f.n[2]>0.9&&f.c[2]>19")
    if a: pg.mouse.click(*a); time.sleep(0.6)
    if bq: pg.mouse.click(*bq); time.sleep(0.8)
    print("measure:", pg.inner_text("#pm-body .pm-result") if pg.query_selector("#pm-body .pm-result") else "none")
    pg.click("#pm-ok"); time.sleep(0.2)
    # 9. Kütle
    tool("Kütle Özell."); time.sleep(1.0)
    print("mass:", pg.inner_text("dialog[open] .pm-result").replace("\n"," | "))
    pg.click("dialog[open] button[value='ok']"); time.sleep(0.2)
    # 10. Kesit
    tool("Kesit"); time.sleep(0.4); pg.screenshot(path=out+"3_section.png"); pg.click("#pm-cancel"); time.sleep(0.2)
    print("tree:", pg.eval_on_selector_all("#tree li", "els=>els.map(e=>e.textContent+(e.classList.contains('err')?'!':''))"))
    print("errors:", logs or "none")
    b.close()

import cmdpatch
import sys, time, json
from playwright.sync_api import sync_playwright
URL=sys.argv[1]
def wait_ready(pg, t=60000):
    pg.wait_for_function("!document.querySelector('#status').classList.contains('busy') && !document.querySelector('#status-text').textContent.includes('yükleniyor')", timeout=t)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":860}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    r = pg.query_selector("#view").bounding_box()
    pg.click("#tree li:has-text('Üst Düzlem')"); pg.click("#tree-actions button:has-text('Eskiz')"); time.sleep(0.3)
    def sc(x,y):
        s = pg.evaluate(f"(()=>{{const f=window.__app.mode.editor.frame; const yv=[f.n[1]*f.x[2]-f.n[2]*f.x[1], f.n[2]*f.x[0]-f.n[0]*f.x[2], f.n[0]*f.x[1]-f.n[1]*f.x[0]]; const w=[f.o[0]+f.x[0]*{x}+yv[0]*{y}, f.o[1]+f.x[1]*{x}+yv[1]*{y}, f.o[2]+f.x[2]*{x}+yv[2]*{y}]; return window.__app.viewer.toScreen(w);}})()")
        return r["x"]+s[0], r["y"]+s[1]
    pg.click("#cmds button[title='Merkez Dikd.']"); pg.mouse.click(*sc(0,0)); time.sleep(0.1); pg.mouse.click(*sc(50,40)); time.sleep(0.2)
    print("crect:", pg.inner_text("#status-text"))
    pg.click("#pm-ok"); time.sleep(0.3); wait_ready(pg)
    pg.click("#tabs button[data-tab='features']"); pg.click("#cmds button[title='Ekstrüzyon']"); time.sleep(0.8); wait_ready(pg); pg.click("#pm-ok"); time.sleep(0.5); wait_ready(pg)
    pg.click(".vcube .iso"); pg.click("#viewbar button[title='Ekrana sığdır']"); time.sleep(0.3)
    print("box bbox:", pg.evaluate("window.__app.viewer.mesh.bbox"))
    def pick_visible(kind, pred):
        return pg.evaluate(f"""(()=>{{const v=window.__app.viewer, m=v.mesh, rr=v.renderer.domElement.getBoundingClientRect(); const L=m.{kind}s; for(let i=0;i<L.length;i++){{ const it=L[i]; if(!({pred})(it)) continue; const sp=v.toScreen(it.{'m' if kind=='edge' else 'c'}); const h=v.pick(rr.left+sp[0], rr.top+sp[1], {{{kind}:true}}); if(h&&h.index===i) return [rr.left+sp[0], rr.top+sp[1]]; }} return null;}})()""")
    # pah
    pg.click("#cmds button[title='Pah']"); time.sleep(0.3)
    pt = pick_visible("edge", "e=>e.d && Math.abs(e.d[1])>0.9"); pg.mouse.click(*pt); time.sleep(0.2)
    pg.click("#pm-ok"); time.sleep(0.6); wait_ready(pg)
    print("chamfer faces:", pg.evaluate("window.__app.viewer.mesh.faces.length"), pg.inner_text("#status-text"))
    # kabuk: üst yüz (n=+y)
    pg.click("#cmds button[title='Kabuk']"); time.sleep(0.3)
    pt = pick_visible("face", "f=>f.n && f.n[1]>0.9"); pg.mouse.click(*pt); time.sleep(0.2)
    print("shell picks:", pg.inner_text("#pm-body .pm-picks"))
    pg.click("#pm-ok"); time.sleep(0.8); wait_ready(pg)
    print("shell faces:", pg.evaluate("window.__app.viewer.mesh.faces.length"), pg.evaluate("window.__app.viewer.mesh.bbox"), pg.inner_text("#status-text"))
    pg.screenshot(path="t4_shell.png")
    # dairesel çoğaltma: Ön düzlemde küçük daire ekstrüzyonu, Y ekseni etrafında 6 adet
    pg.click("#tree li:has-text('Ön Düzlem')"); pg.click("#tree-actions button:has-text('Eskiz')"); time.sleep(0.3)
    pg.click("#cmds button[title='Daire']"); pg.mouse.click(*sc(60,10)); time.sleep(0.1); pg.mouse.click(*sc(66,10)); time.sleep(0.2)
    pg.click("#pm-ok"); time.sleep(0.3); wait_ready(pg)
    pg.click("#tabs button[data-tab='features']"); pg.click("#cmds button[title='Ekstrüzyon']"); time.sleep(0.8); wait_ready(pg); pg.click("#pm-ok"); time.sleep(0.5); wait_ready(pg)
    pg.click("#cmds button[title='Dairesel Çoğ.']"); time.sleep(1.0); wait_ready(pg)
    print("cp feats:", pg.eval_on_selector_all("#pm-body .pm-feats label", "els=>els.map(e=>e.textContent+':'+e.querySelector('input').checked)"))
    pg.click("#pm-ok"); time.sleep(0.8); wait_ready(pg)
    pg.click("#viewbar button[title='Ekrana sığdır']"); time.sleep(0.3)
    print("cpattern bbox:", pg.evaluate("window.__app.viewer.mesh.bbox"), pg.inner_text("#status-text"))
    pg.screenshot(path="t4_cp.png")
    print("errors:", logs or "none")
    b.close()

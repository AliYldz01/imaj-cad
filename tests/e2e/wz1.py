import time, sys
from playwright.sync_api import sync_playwright
from h import wait_ready
URL = sys.argv[1] if len(sys.argv)>1 else 'http://localhost:4173/'
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e))); pg.on("dialog", lambda d: d.accept())
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    ev = pg.evaluate
    vol = lambda: ev("window.__app.kernel.props ? 0 : 0")
    def wiz(name, vals):
        pg.click("#file-btn"); pg.click("#file-menu button[data-act='wizard']")
        pg.click(f"dialog .wiz-types button:has-text('{name}')")
        for k,v in vals.items(): pg.fill(f"dialog label.pm-field:has-text('{k}') input", str(v))
        pg.click("dialog button:has-text('Oluştur')"); time.sleep(0.5); wait_ready(pg)
        m = ev("(()=>{const m=window.__app.viewer.mesh; return m&&{bb:[m.bbox.min.map(v=>+v.toFixed(1)),m.bbox.max.map(v=>+v.toFixed(1))], f:m.faces.length}})()")
        print(name, m, pg.inner_text("#status-text"))
    wiz("Flanş", {})
    pg.click("#file-btn"); pg.click("#file-menu button[data-act='new']"); time.sleep(0.5); wait_ready(pg)
    wiz("Kademeli mil", {"Kademeler": "30x40; 40x80; 25x30"})
    pg.click("#file-btn"); pg.click("#file-menu button[data-act='new']"); time.sleep(0.5); wait_ready(pg)
    wiz("Delikli plaka", {})
    # sayıyla çizim + öneri
    pg.click("#file-btn"); pg.click("#file-menu button[data-act='new']"); time.sleep(0.5); wait_ready(pg)
    pg.click("#tree li:has-text('Ön Düzlem')"); pg.click("#tree-actions button:has-text('Eskiz')"); time.sleep(0.3)
    ev("(()=>{const e=window.__app.mode.editor; e.opts.quickDim=false; e.setTool('line')})()")
    pg.keyboard.press("0"); pg.keyboard.press("Enter")   # X=0, Y default 0
    time.sleep(0.2); print("num box?", pg.locator(".num-entry").count())
    pg.keyboard.press("Enter") if pg.locator(".num-entry").count() else None
    for L,a in [(100,0),(50,90),(100,180)]:
        pg.keyboard.press("1"); pg.locator(".num-entry input").nth(0).fill(str(L)); pg.locator(".num-entry input").nth(1).fill(str(a)); pg.locator(".num-entry input").nth(1).press("Enter"); time.sleep(0.15)
    print("lines:", ev("(()=>{const d=window.__app.mode.editor.data; return d.ents.map(l=>{const a=d.pts[l.p1]||{x:0,y:0},b=d.pts[l.p2]||{x:0,y:0}; return [+(b.x-a.x).toFixed(2),+(b.y-a.y).toFixed(2)]})})()"), "dims:", ev("window.__app.mode.editor.data.dims.map(d=>d.v)"), "rels:", ev("window.__app.mode.editor.data.rels.map(r=>r.t).join(',')"))
    pg.keyboard.press("Escape"); ev("window.__app.mode.editor.setTool('circle')")
    pg.keyboard.press("5"); pg.locator(".num-entry input").nth(1).fill("25"); pg.locator(".num-entry input").nth(1).press("Enter"); time.sleep(0.1)
    pg.keyboard.press("2"); pg.locator(".num-entry input").nth(0).fill("20"); pg.locator(".num-entry input").nth(0).press("Enter"); time.sleep(0.2)
    print("circle:", ev("(()=>{const d=window.__app.mode.editor.data; const c=d.ents.find(e=>e.t==='circle'); return c&&[d.pts[c.c].x,d.pts[c.c].y,c.r]})()"))
    pg.click("#pm-ok"); time.sleep(0.5); wait_ready(pg)
    print("suggest:", pg.locator(".suggest button").all_inner_texts())
    pg.click(".suggest button:has-text('Ekstrüzyon')"); time.sleep(0.6); print("mode after suggest:", ev("window.__app.mode.k"))
    print("errors:", logs)

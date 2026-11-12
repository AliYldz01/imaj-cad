from h import *
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}, accept_downloads=True); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e))); pg.on("dialog", lambda d: d.accept())
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    pg.click("#tabs button[data-tab='weld']")
    pg.click("#cmds button:has-text('3B Eskiz')"); time.sleep(0.4)
    # başlangıç: mutlak 0,0,0
    pg.click("#pm-body button:has-text('Mutlak koordinatla ekle')"); time.sleep(0.2)
    def setlen(v):
        f = pg.locator("#pm-body label.pm-field:has-text('Uzunluk') input").first
        f.fill(str(v)); f.press("Enter"); time.sleep(0.1)
    setlen(400); pg.click("#pm-body .dir-grid button:has-text('+X')"); time.sleep(0.2)
    setlen(300); pg.click("#pm-body .dir-grid button:has-text('+Z')"); time.sleep(0.2)
    setlen(500); pg.click("#pm-body .dir-grid button:has-text('+Y')"); time.sleep(0.2)
    print("lines:", pg.evaluate("window.__app.mode.draft.lines.length"), pg.evaluate("JSON.stringify(window.__app.mode.draft.xyz)"))
    rf = pg.locator("#pm-body label.pm-field:has-text('Köşe yarıçapı') input"); rf.fill("60"); rf.press("Enter"); time.sleep(0.3)
    pg.click("#pm-ok"); time.sleep(0.6); wait_ready(pg)
    print("tree:", pg.evaluate("window.__app.doc.features.map(f=>f.name)"))
    pg.click("#tree li:has-text('3B-Eskiz1')")
    pg.click("#cmds button:has-text('Yapı Elemanı')"); time.sleep(0.5)
    pg.select_option("#pm-body select >> nth=0", "boru"); time.sleep(0.3)
    pg.select_option("#pm-body select >> nth=1", "33.7x3.2"); time.sleep(0.8); wait_ready(pg)
    pg.click("#pm-ok"); time.sleep(0.8); wait_ready(pg)
    print("status:", pg.inner_text('#status-text'), pg.eval_on_selector_all("#tree li.err", "els=>els.map(e=>e.title)"))
    r = pg.evaluate("async()=>(await window.__app.kernel.cutList()).map(c=>[c.kind,c.name,+c.length.toFixed(2)])"); print("cut:", r)
    pg.click(".vcube .iso"); pg.click("#viewbar button[title='Ekrana sığdır']"); time.sleep(0.5)
    pg.screenshot(path="w4.png")
    # yarıçapsız, kare kutu: gönye köşeler
    pg.evaluate("(()=>{const d=window.__app.doc; d.features.find(f=>f.type==='sketch3d').r=0; const m=d.features.find(f=>f.type==='member'); m.std='kutu'; m.size='40x40x3'; window.__app.setDoc(JSON.parse(JSON.stringify(d)))})()"); time.sleep(0.5); wait_ready(pg)
    r = pg.evaluate("async()=>(await window.__app.kernel.cutList()).map(c=>[c.kind,c.name,+c.length.toFixed(2),+c.a1.toFixed(1),+c.a2.toFixed(1)])"); print("cut sharp:", r)
    print("errors:", logs[:5] or "none")
    b.close()

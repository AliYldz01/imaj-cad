import cmdpatch
import sys, time
from playwright.sync_api import sync_playwright
URL=sys.argv[1]; out="/home/claude/tests/t3_"
def wait_ready(pg, t=60000):
    pg.wait_for_function("!document.querySelector('#status').classList.contains('busy') && !document.querySelector('#status-text').textContent.includes('yükleniyor')", timeout=t)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":860}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.on("console", lambda m: logs.append(m.text) if m.type=="error" else None)
    pg.on("dialog", lambda d: d.accept())
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    r = pg.query_selector("#view").bounding_box()
    pg.click("#tree li:has-text('Ön Düzlem')"); pg.click("#tree-actions button:has-text('Eskiz')"); time.sleep(0.3)
    def sc(x,y):
        s = pg.evaluate(f"window.__app.viewer.toScreen([{x},{y},0])"); return r["x"]+s[0], r["y"]+s[1]
    def clk(*pts):
        for p_ in pts: pg.mouse.click(*sc(*p_)); time.sleep(0.12)
    def ents(): return pg.evaluate("window.__app.mode.editor.data.ents.map(e=>e.t+(e.cons?'*':''))")
    def tool(t): pg.click(f"#cmds button[title='{t}']")
    # Çizgi zinciri: L şekli + teğet yay ile kapat
    tool("Çizgi"); clk((0,0),(60,0),(60,30)); pg.keyboard.press("Enter"); time.sleep(0.2)
    print("chain:", ents(), pg.inner_text("#status-text"))
    tool("Teğet Yay"); clk((60,30),(20,50)); time.sleep(0.2)
    print("tarc:", ents(), pg.inner_text("#status-text"))
    tool("Çizgi"); clk((20,50),(0,0)); time.sleep(0.2)
    print("closed:", ents())
    # Kanal
    tool("Kanal"); clk((-80,0),(-40,0),(-40,10)); time.sleep(0.2)
    print("slot:", ents()[-6:], pg.inner_text("#status-text"))
    # Çokgen
    tool("Çokgen"); clk((-60,-60),(-40,-60)); time.sleep(0.2)
    print("poly count:", len(ents()), pg.inner_text("#status-text"))
    # Dikdörtgen + eskiz radyüsü + kırpma
    tool("Dikdörtgen"); clk((40,-80),(100,-40)); time.sleep(0.2)
    tool("Eskiz Radyüs"); pg.fill("#pm-body .pm-field input","8"); pg.dispatch_event("#pm-body .pm-field input","input")
    clk((100,-40)); time.sleep(0.2)
    print("fillet:", ents()[-1], pg.inner_text("#status-text"))
    print("rels:", pg.evaluate("window.__app.mode.editor.data.rels.map(r=>r.t).join(',')"))
    print("red glyphs:", pg.evaluate("document.querySelectorAll('.labels .rel.err').length"))
    pg.screenshot(path=out+"1.png")
    # sürükle: tanımsız noktayı sürükle
    tool("Seç")
    a = sc(-60+20,-60); pg.mouse.move(*a); pg.mouse.down(); pg.mouse.move(a[0]+30,a[1]+30, steps=6); pg.mouse.up(); time.sleep(0.2)
    print("drag ok:", pg.inner_text("#status-text"))
    # profil: eskizden çık -> ekstrüzyon (çokgen/kanal/şekiller ayrık konturlar)
    pg.click("#pm-ok"); time.sleep(0.4); wait_ready(pg)
    pg.click("#tabs button[data-tab='features']"); pg.click("#cmds button[title='Ekstrüzyon']"); time.sleep(1.0); wait_ready(pg)
    print("extrude preview status:", pg.inner_text("#status-text"))
    pg.click("#pm-ok"); time.sleep(0.6); wait_ready(pg)
    pg.click(".vcube .iso"); pg.click("#viewbar button[title='Ekrana sığdır']"); time.sleep(0.3)
    print("faces:", pg.evaluate("window.__app.viewer.mesh&&window.__app.viewer.mesh.faces.length"), pg.inner_text("#status-text"))
    pg.screenshot(path=out+"2.png")
    # kabuk + ayna + ref düzlem
    pg.click("#cmds button[title='Ref. Düzlem']"); time.sleep(0.5); pg.click("#pm-ok"); time.sleep(0.5); wait_ready(pg)
    pg.click("#cmds button[title='Ayna']"); time.sleep(0.8); wait_ready(pg); pg.click("#pm-ok"); time.sleep(0.6); wait_ready(pg)
    print("after mirror bbox:", pg.evaluate("window.__app.viewer.mesh.bbox"), pg.inner_text("#status-text"))
    pg.click("#viewbar button[title='Ekrana sığdır']"); time.sleep(0.3)
    pg.screenshot(path=out+"3.png")
    # Kırpma testi: ayrı eskiz
    pg.click("#tree li:has-text('Ön Düzlem')"); pg.click("#tree-actions button:has-text('Eskiz')"); time.sleep(0.3)
    tool("Dikdörtgen"); clk((-40,-40),(20,10)); time.sleep(0.2)
    tool("Daire"); clk((-40,-40),(-28,-40)); time.sleep(0.2)
    tool("Kırp"); clk((-34,-40)); time.sleep(0.3)
    print("trim line:", ents(), pg.inner_text("#status-text"))
    clk((-52,-40)); time.sleep(0.3)
    print("trim circle->arc:", ents(), pg.inner_text("#status-text"))
    pg.screenshot(path=out+"4_trim.png")
    pg.click("#pm-cancel"); time.sleep(0.3)
    print("tree:", pg.eval_on_selector_all("#tree li", "els=>els.map(e=>e.textContent+(e.classList.contains('err')?'!':''))"))
    print("errors:", logs or "none")
    b.close()

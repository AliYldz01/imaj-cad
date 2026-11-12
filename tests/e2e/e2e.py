import cmdpatch
import sys, time
from playwright.sync_api import sync_playwright
URL = sys.argv[1]
out = "/home/claude/tests/"
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1280,"height":800}, accept_downloads=True)
    logs=[]
    pg.on("console", lambda m: logs.append(f"{m.type}: {m.text}"))
    pg.on("pageerror", lambda e: logs.append(f"PAGEERROR: {e}"))
    pg.goto(URL)
    t0=time.time()
    pg.wait_for_function("document.querySelector('#status-text').textContent.startsWith('Hazır')", timeout=120000)
    print("kernel ready in", round(time.time()-t0,1),"s")
    # Dikdörtgen çiz
    pg.click("[data-tool=rect]")
    pg.mouse.move(500,500); pg.mouse.down(); pg.mouse.move(600,420, steps=5); pg.mouse.move(700,350, steps=5); pg.mouse.up()
    pg.wait_for_selector("#panel:not([hidden])")
    inputs = pg.query_selector_all("#panel-fields input")
    inputs[0].fill("120"); inputs[0].dispatch_event("input")
    inputs[1].fill("80"); inputs[1].dispatch_event("input")
    inputs[2].fill("0"); inputs[2].dispatch_event("input")
    inputs[3].fill("0"); inputs[3].dispatch_event("input")
    pg.fill("#f-depth","30")
    pg.click("#panel-ok")
    pg.wait_for_function("document.querySelector('#status-text').textContent.startsWith('Hazır ·')", timeout=60000)
    print("status:", pg.inner_text("#status-text"))
    pg.screenshot(path=out+"1_box.png")
    # Üst yüzeye daire çiz (delik)
    pg.click("[data-tool=circle]")
    time.sleep(0.3)
    # kutunun merkezini ekranda bul
    c = pg.evaluate("""() => { return null }""")
    pg.mouse.move(640,400); pg.mouse.down(); pg.mouse.move(660,400, steps=5); pg.mouse.up()
    pg.wait_for_selector("#panel:not([hidden])")
    print("z:", pg.input_value("#f-z"), "depth:", pg.input_value("#f-depth"), "op active:", pg.inner_text("#f-op button.active"))
    inputs = pg.query_selector_all("#panel-fields input")
    inputs[0].fill("30"); inputs[0].dispatch_event("input")
    inputs[1].fill("120/2"); inputs[1].dispatch_event("input")
    inputs[2].fill("40"); inputs[2].dispatch_event("input")
    pg.click("#panel-ok")
    time.sleep(0.5)
    pg.wait_for_function("document.querySelector('#status-text').textContent.startsWith('Hazır ·')", timeout=60000)
    pg.screenshot(path=out+"2_hole.png")
    # Çokgen
    pg.click("[data-tool=poly]")
    for (x,y) in [(300,600),(400,600),(350,500)]:
        pg.mouse.click(x,y); time.sleep(0.1)
    pg.click("#poly-close")
    pg.wait_for_selector("#panel:not([hidden])")
    pg.click("#panel-ok")
    time.sleep(0.5)
    pg.wait_for_function("document.querySelector('#status-text').textContent.startsWith('Hazır ·')", timeout=60000)
    pg.click("#tree-btn")
    print("tree:", pg.inner_text("#tree-list"))
    pg.screenshot(path=out+"3_tree.png")
    pg.click("#tree-close")
    # Dışa aktar
    for fmt in ["step","stl"]:
        pg.click("#export-btn")
        with pg.expect_download() as d:
            pg.click(f"[data-fmt={fmt}]")
        path = d.value.path()
        data = open(path,"rb").read()
        print(fmt, len(data), data[:20])
    # Undo
    pg.click("#undo"); time.sleep(0.5)
    pg.wait_for_function("document.querySelector('#status-text').textContent.startsWith('Hazır')", timeout=60000)
    print("after undo items:", len(pg.query_selector_all("#tree-list li")))
    # reload persists
    pg.reload()
    pg.wait_for_function("document.querySelector('#status-text').textContent.startsWith('Hazır ·')", timeout=120000)
    print("after reload items:", len(pg.query_selector_all("#tree-list li")))
    pg.screenshot(path=out+"4_reload.png")
    # Telefon görünümü
    m = b.new_page(viewport={"width":390,"height":844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    m.goto(URL)
    m.wait_for_function("document.querySelector('#status-text').textContent.startsWith('Hazır')", timeout=120000)
    m.screenshot(path=out+"5_mobile.png")
    m.tap("[data-tool=rect]")
    time.sleep(0.3)
    m.screenshot(path=out+"6_mobile_rect.png")
    print("\n".join(l for l in logs if "error" in l.lower()) or "no errors")
    b.close()

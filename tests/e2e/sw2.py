import sys, time
from playwright.sync_api import sync_playwright
from h import wait_ready
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto('http://localhost:4173/'); wait_ready(pg); time.sleep(0.5)
    r = pg.query_selector("#view").bounding_box(); cx, cy = r["x"]+r["width"]/2, r["y"]+r["height"]/2
    pg.click("#tree li:has-text('Ön Düzlem')"); pg.click("#tree-actions button:has-text('Eskiz')"); time.sleep(0.4)
    pg.evaluate("window.__app.mode.editor.opts.quickDim=false")
    stt = lambda: pg.evaluate("(()=>{const s=window.__app.mode.editor.st; return Object.keys(s).filter(k=>k!=='inf').map(k=>k+'='+JSON.stringify(s[k])).join(' ')})()")
    pg.keyboard.press("l") ; pg.evaluate("window.__app.mode.editor.setTool('line')")
    pg.mouse.click(cx-200,cy+80); time.sleep(0.15); print(stt())
    pg.mouse.click(cx-40,cy+83); time.sleep(0.15); print(stt())
    pg.keyboard.press("a"); time.sleep(0.1); print(stt(), pg.inner_text("#toast"))
    pg.mouse.move(cx+100,cy-100, steps=4); pg.mouse.click(cx+100,cy-100); time.sleep(0.15); print(stt())
    print(pg.evaluate("window.__app.mode.editor.data.ents.map(e=>e.t).join(',')"), logs)

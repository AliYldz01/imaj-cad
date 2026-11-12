import time
from playwright.sync_api import sync_playwright
from h import wait_ready
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    ctx = b.new_context(viewport={"width":412,"height":880}, has_touch=True, is_mobile=True)
    pg = ctx.new_page(); logs=[]; pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto('http://localhost:4173/'); pg.evaluate("localStorage.setItem('imajcad.input', JSON.stringify({profile:'finger', touchpad:true}))"); pg.reload(); wait_ready(pg); time.sleep(0.4)
    cdp = ctx.new_cdp_session(pg)
    T = lambda k, pts: cdp.send("Input.dispatchTouchEvent", {"type": k, "touchPoints": [{"x":x,"y":y,"id":i} for i,(x,y) in enumerate(pts)]})
    pg.evaluate("document.querySelector('#side').classList.add('open')")
    pg.locator("#tree li:has-text('Ön Düzlem')").tap(); pg.locator("#tree-actions button:has-text('Eskiz')").tap(); time.sleep(0.4)
    pg.evaluate("(()=>{const e=window.__app.mode.editor; e.opts.quickDim=false; e.setTool('point')})()")
    T("touchStart", [(200,500)]); [T("touchMove", [(200+i*10,500)]) for i in range(1,9)]; T("touchEnd", []); time.sleep(0.1)
    print("cursor visible:", pg.locator(".touch-cursor").is_visible(), pg.evaluate("(()=>{const c=document.querySelector('.touch-cursor'); return [c.style.left,c.style.top]})()"))
    print("pts before tap:", pg.evaluate("Object.keys(window.__app.mode.editor.data.pts).length"))
    T("touchStart", [(100,700)]); T("touchEnd", []); time.sleep(0.2)
    print("pts after tap:", pg.evaluate("Object.keys(window.__app.mode.editor.data.pts).length"), "errors:", logs)

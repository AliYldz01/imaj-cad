import cmdpatch
import sys, time
from playwright.sync_api import sync_playwright
URL=sys.argv[1]; out="/home/claude/tests/"
def touch(cdp, typ, pts):
    cdp.send("Input.dispatchTouchEvent", {"type":typ, "touchPoints":[{"x":x,"y":y,"id":i} for i,(x,y) in enumerate(pts)]})
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    ctx = b.new_context(viewport={"width":390,"height":844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    m = ctx.new_page(); logs=[]
    m.on("pageerror", lambda e: logs.append(str(e)))
    m.goto(URL)
    m.wait_for_function("document.querySelector('#status-text').textContent.startsWith('Hazır')", timeout=120000)
    m.screenshot(path=out+"m0.png")
    cdp = ctx.new_cdp_session(m)
    m.tap("[data-tool=rect]"); time.sleep(0.3)
    touch(cdp,"touchStart",[(120,400)])
    for i in range(1,11): touch(cdp,"touchMove",[(120+i*15,400-i*10)]); time.sleep(0.02)
    m.screenshot(path=out+"m1_drag.png")
    touch(cdp,"touchEnd",[])
    m.wait_for_selector("#panel:not([hidden])", timeout=5000)
    m.screenshot(path=out+"m2_panel.png")
    m.tap("#panel-ok")
    m.wait_for_function("document.querySelector('#status-text').textContent.startsWith('Hazır ·')", timeout=60000)
    time.sleep(0.3)
    m.screenshot(path=out+"m3_solid.png")
    # tek parmakla döndürme
    touch(cdp,"touchStart",[(200,500)])
    for i in range(1,11): touch(cdp,"touchMove",[(200+i*8,500)]); time.sleep(0.02)
    touch(cdp,"touchEnd",[])
    time.sleep(0.2); m.screenshot(path=out+"m4_rot.png")
    m.tap("#export-btn"); time.sleep(0.2); m.screenshot(path=out+"m5_export.png")
    print("errors:", logs or "none")
    b.close()

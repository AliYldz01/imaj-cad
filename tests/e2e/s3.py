from h import *
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    pg.screenshot(path="s3_desk.png", clip={"x":0,"y":0,"width":700,"height":70})
    ph = b.new_page(viewport={"width":390,"height":844}, device_scale_factor=2, is_mobile=True, has_touch=True); ph.goto(URL); wait_ready(ph); time.sleep(0.5)
    ph.click("#tabs button[data-tab='sheet']"); time.sleep(0.3)
    ph.screenshot(path="s3_phone.png")
    b.close()

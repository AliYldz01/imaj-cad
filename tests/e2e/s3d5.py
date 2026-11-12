# 3B: üst çubukta 3B araçlar, seçince ilişki çubuğu (paralel/eşit/ölçü), eksen boyunca hizalama çıkarımı
import cmdpatch, time
from h import *
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    pg.click("#tabs button[data-tab='weld']")
    pg.click("#cmds button:has-text('3B Eskiz')"); time.sleep(0.4)
    print("cmd bar:", pg.locator("#cmds button.cmd").all_inner_texts()[:8])
    pg.click(".vcube .iso"); time.sleep(0.3)
    R = pg.query_selector("#view").bounding_box()
    def S(x,y,z):
        s = pg.evaluate(f"window.__app.viewer.toScreen([{x},{y},{z}])"); return R['x']+s[0], R['y']+s[1]
    D = lambda js: pg.evaluate(f"(()=>{{const d=window.__app.mode.draft; return {js}}})()")
    # dikey çizgi (0,0,0)->(0,80,0); ikinci zincir (60,0,0) -> yukarı, ilk çizginin ucuyla hizalanmalı (y=80)
    for q in [(0,0,0),(0,80,0)]:
        x,y = S(*q); pg.mouse.move(x,y); pg.mouse.click(x,y); time.sleep(0.15)
    x,y = S(0,80,0); pg.mouse.dblclick(x,y); time.sleep(0.2)
    pg.keyboard.press("Escape")
    pg.click("#cmds button:has-text('Çizgi')"); time.sleep(0.2)
    x,y = S(60,0,0); pg.mouse.move(x,y); pg.mouse.click(x,y); time.sleep(0.15)
    x,y = S(60,81.5,0); pg.mouse.move(x,y-1); time.sleep(0.1)
    print("tip:", pg.inner_text(".s3-tip"))
    pg.mouse.click(x,y-1); time.sleep(0.2)
    print("pts:", D("JSON.stringify(d.xyz)"))
    # Seç: iki çizgi Ctrl ile → ilişki çubuğu
    pg.click("#cmds button:has-text('Seç')"); time.sleep(0.2)
    x,y = S(0,40,0); pg.mouse.click(x,y); time.sleep(0.2)
    pg.keyboard.down("Control"); x,y = S(60,40,0); pg.mouse.click(x,y); pg.keyboard.up("Control"); time.sleep(0.2)
    print("sel:", pg.evaluate("window.__app.s3.sel.length"), pg.evaluate("document.querySelectorAll('.s3-relbar').length"))
    print("relbar:", pg.locator(".s3-relbar button").all_inner_texts())
    pg.screenshot(path="/home/claude/s3d5_relbar.png")
    bx = pg.evaluate("[...document.querySelectorAll('.s3-relbar .s3-rb')].map(b=>{const r=b.getBoundingClientRect();return [r.left,r.top,r.right,r.bottom]})")
    ov = any(not (a[2]<=b[0] or b[2]<=a[0] or a[3]<=b[1] or b[3]<=a[1]) for i,a in enumerate(bx) for b in bx[i+1:])
    print("relbar overlap:", ov)
    pg.click(".s3-relbar button:has-text('Eşit')"); time.sleep(0.3)
    print("cons:", D("(d.cons3||[]).map(c=>c.t).join(',')"))
    x,y = S(0,40,0); pg.mouse.click(x,y); time.sleep(0.2)
    pg.click(".s3-relbar button:has-text('Boy ölçüsü')"); time.sleep(0.2)
    pg.keyboard.press("Control+a"); pg.keyboard.type("120"); pg.keyboard.press("Enter"); time.sleep(0.3)
    print("after dim:", D("JSON.stringify(d.xyz)"), D("(d.dims3||[]).map(m=>m.t+m.v).join(',')"))
    print("errors:", logs)

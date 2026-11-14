# Telefon (v0.89): iki parmakla kaydırmada parmak aralığı 60 / 80 / 120 px — yuvarlanma yok, kayma (50, 30) (A-2)
import time
import cmdpatch
from playwright.sync_api import sync_playwright
from h import wait_ready, sketch, ext, run, TOP
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    ctx = b.new_context(viewport={"width":390,"height":844}, has_touch=True, is_mobile=True)
    pg = ctx.new_page(); pg.goto('http://localhost:4173/'); wait_ready(pg)
    run(pg, "kutu", [sketch("s1","E",TOP,lambda pt,line,rect,c,t: rect(-20,-15,20,15)), ext("e1","s1",20)])
    cdp = ctx.new_cdp_session(pg)
    T = lambda k, pts: cdp.send("Input.dispatchTouchEvent", {"type": k, "touchPoints": [{"x":x,"y":y,"id":i} for i,(x,y) in enumerate(pts)]})
    scr = lambda: pg.evaluate("(()=>{const s=window.__app.viewer.toScreen([0,10,0]);return s})()")
    ok = []
    for gap in (60, 80, 120):
        pg.evaluate("window.__app.viewer.viewStd('iso')"); time.sleep(0.3)
        s0 = scr(); x, y = 150, 420
        T("touchStart", [(x, y), (x+gap, y)])
        for i in range(1, 21):
            dx, dy = 2.5*i, 1.5*i
            T("touchMove", [(x+dx, y+dy), (x+gap+dx-1.2, y+dy)]); time.sleep(0.01)
            T("touchMove", [(x+dx, y+dy), (x+gap+dx, y+dy)]); time.sleep(0.01)
        T("touchEnd", []); time.sleep(0.3)
        s1 = scr(); d = [round(s1[0]-s0[0],1), round(s1[1]-s0[1],1)]
        c = abs(d[0]-50) < 2 and abs(d[1]-30) < 2; ok.append(c)
        print(('TAMAM' if c else 'HATA '), f'aralık {gap}: kayma', d)
    print('SONUC:', 'TAMAM' if all(ok) else 'HATA')

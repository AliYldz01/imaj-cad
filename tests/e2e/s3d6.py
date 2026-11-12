# 3B: orijinden çizgilerle kare → kapanan çizgi dahil eksen ilişkileri, orijin sabit, 2 ölçü → tam tanımlı;
# hizalama ile konan nokta → nokta hizalama ilişkisi; dikdörtgen orijinden → sabit
import cmdpatch, time
from h import *
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    pg.click("#tabs button[data-tab='weld']")
    pg.click("#cmds button:has-text('3B Eskiz')"); time.sleep(0.4)
    pg.click(".vcube .iso"); time.sleep(0.3)
    R = pg.query_selector("#view").bounding_box()
    def S(x,y,z):
        s = pg.evaluate(f"window.__app.viewer.toScreen([{x},{y},{z}])"); return R['x']+s[0], R['y']+s[1]
    D = lambda js: pg.evaluate(f"(()=>{{const d=window.__app.mode.draft; return {js}}})()")
    for q in [(0,0,0),(60,0,0),(60,60,0),(0,60,0),(0,0,0)]:
        x,y = S(*q); pg.mouse.move(x,y); time.sleep(0.05); pg.mouse.click(x,y); time.sleep(0.4)
    print("ax:", D("d.lines.map(l=>l.ax||'-').join(',')"), "cons:", D("(d.cons3||[]).map(c=>c.t).join(',')"))
    st = lambda: pg.inner_text("#pm-body .pm-group >> nth=0").split("\n")[-1]
    print("durum:", st())
    pg.evaluate("(()=>{const s=window.__app.s3, d=window.__app.mode.draft; d.dims3=[{id:'m1',t:'len',e:[d.lines[3].id],v:80},{id:'m2',t:'len',e:[d.lines[2].id],v:80}]; s.resolve(); s.setMode('select');})()"); time.sleep(0.3)
    print("2 olcu sonra:", st(), D("JSON.stringify(d.xyz)"))
    # alt çizgiyi sürükle: hareket etmemeli
    x,y = S(40,0,0); x2,y2 = S(40,-30,0)
    pg.mouse.move(x,y); pg.mouse.down(); pg.mouse.move(x2,y2,steps=5); pg.mouse.up(); time.sleep(0.2)
    print("surukleme sonrasi:", D("JSON.stringify(d.xyz)"))
    print("errors:", logs)

# Eskiz radyüsü sonrası "gereksiz ölçü" sorunu: yay R ölçüsü Akıllı Ölçü'de düzenlenir, orijindeki köşe, merkez dikdörtgen köşeleri
import cmdpatch, time
from h import *
ok=[]
def chk(n,c,i=""): ok.append(c); print(("TAMAM " if c else "HATA  ")+n, i)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e))); dl=[]; pg.on("dialog", lambda d: (dl.append(d.message), d.accept()))
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    ed = "window.__app.mode.editor"
    def newsk():
        pg.goto(URL); wait_ready(pg); time.sleep(0.3)
        pg.click("#tree li:has-text('Ön Düzlem')"); pg.click("#tree-actions button:has-text('Eskiz')"); time.sleep(0.4)
        pg.evaluate(f"{ed}.opts.quickDim=false")
    def sc(x,y):
        r = pg.query_selector("#view").bounding_box()
        s = pg.evaluate(f"(()=>{{const e=window.__app.mode.editor; const f=e.frame; const yv=[f.n[1]*f.x[2]-f.n[2]*f.x[1], f.n[2]*f.x[0]-f.n[0]*f.x[2], f.n[0]*f.x[1]-f.n[1]*f.x[0]]; const w=[f.o[0]+f.x[0]*{x}+yv[0]*{y}, f.o[1]+f.x[1]*{x}+yv[1]*{y}, f.o[2]+f.x[2]*{x}+yv[2]*{y}]; return window.__app.viewer.toScreen(w);}})()")
        return r["x"]+s[0], r["y"]+s[1]
    res = lambda: pg.evaluate(f"{ed}.result")
    # 1) merkez dikdörtgen, tam tanımlı → 4 köşe radyüs, serbestlik 0 kalır
    newsk()
    pg.evaluate(f"{ed}.setTool('crect')"); pg.mouse.click(*sc(0,0)); time.sleep(0.2); pg.mouse.click(*sc(30,20)); time.sleep(0.3); pg.keyboard.press("Escape")
    pg.evaluate(f"{ed}.fullyDefine()")
    pg.evaluate(f"{ed}.setTool('fillet'); {ed}.opts.filletR=5")
    for c in [(30,20),(-30,-20),(30,-20),(-30,20)]: pg.mouse.click(*sc(*c)); time.sleep(0.3)
    r = res(); na = pg.evaluate(f"{ed}.data.ents.filter(e=>e.t==='arc').length")
    chk("merkez dikdörtgen 4 radyüs, serbestlik 0", na==4 and r["ok"] and r["dof"]==0 and not r["redundant"], (na, r))
    # 2) orijinden başlayan dikdörtgen: orijindeki köşe
    newsk()
    pg.evaluate(f"{ed}.setTool('rect')"); pg.mouse.click(*sc(0,0)); time.sleep(0.2); pg.mouse.click(*sc(60,40)); time.sleep(0.3); pg.keyboard.press("Escape")
    pg.evaluate(f"{ed}.setTool('fillet'); {ed}.opts.filletR=6")
    pg.mouse.click(*sc(0,0)); time.sleep(0.3)
    chk("orijindeki köşeye radyüs", pg.evaluate(f"{ed}.data.ents.filter(e=>e.t==='arc').length")==1 and res()["ok"], pg.inner_text("#toast"))
    # 3) radyüs yayına Akıllı Ölçü → mevcut R düzenlenir, gereksiz uyarısı yok
    pg.mouse.click(*sc(60,40)); time.sleep(0.3)
    a = pg.evaluate(f"(()=>{{const d={ed}.data; const a=d.ents.filter(e=>e.t==='arc')[1]; const c=d.pts[a.c]; const dd=d.dims.find(x=>x.refs[0]===a.id); return {{c:[c.x,c.y], r:a.r, lp:dd.lp, id:a.id}}}})()")
    chk("R etiketi yayın dışında (köşe tarafında)", ((a["lp"][0]-a["c"][0])**2+(a["lp"][1]-a["c"][1])**2)**0.5 > a["r"]*1.5, a)
    import math
    q = (a["c"][0]+a["r"]*math.cos(math.pi/4), a["c"][1]+a["r"]*math.sin(math.pi/4))
    pg.evaluate(f"{ed}.setTool('dim')"); dl.clear()
    pg.mouse.click(*sc(*q)); time.sleep(0.2); pg.mouse.click(*sc(q[0]+12,q[1]+12)); time.sleep(0.4)
    chk("gereksiz ölçü penceresi çıkmaz", pg.locator("dialog.redund-dlg").count()==0 and not dl, dl)
    chk("mevcut R ölçüsü düzenleme kutusu", pg.locator(".dim-prompt").count()==1)
    if pg.locator(".dim-prompt").count():
        pg.fill(".dim-prompt input","10"); pg.press(".dim-prompt input","Enter"); time.sleep(0.4)
    r2 = pg.evaluate(f"{ed}.data.ents.find(e=>e.id==='{a['id']}').r")
    nd = pg.evaluate(f"{ed}.data.dims.filter(d=>d.t==='rad').length")
    chk("R 10 oldu, yeni ölçü eklenmedi", abs(r2-10)<1e-6 and nd==2, (r2, nd))
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

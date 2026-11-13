# Parça özellikleri 5: loft bağlayıcıları (köşe eşleşmesi / burulma) ve komşu yüzlere teğet
import cmdpatch, time, math
from h import *
ok=[]
def chk(n,c,i=""): ok.append(c); print(("TAMAM " if c else "HATA  ")+n, i)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    ev = pg.evaluate
    vol = lambda: ev("window.__app.kernel.props().then(p=>p.volume)")
    err = lambda: pg.eval_on_selector_all("#tree li.err", "els=>els.map(e=>e.title||e.textContent)")
    pl = {"id":"pl1","type":"plane","name":"D1","base":FRONT,"offset":40,"flip":False}
    A = sketch("s1","A",FRONT,lambda pt,line,rect,c,t: rect(-10,-10,10,10))
    B = sketch("s2","B",{"k":"ref","id":"pl1"},lambda pt,line,rect,c,t: rect(-10,-10,10,10))
    lf = lambda **kw: {"id":"lf","type":"loft","name":"L","sketches":["s1","s2"],"cut":False,"ruled":True, **kw}
    run(pg,"düz",[A,pl,B,lf()]); v1=vol()
    chk("bağlayıcısız prizma 16000", abs(v1-16000)<1, v1)
    run(pg,"bağlayıcı 0/0",[A,pl,B,lf(conn=[{"k":0},{"k":0}])])
    chk("bağlayıcı aynı köşe → 16000", abs(vol()-16000)<1, [vol(), err()])
    run(pg,"bağlayıcı 0/1",[A,pl,B,lf(conn=[{"k":0},{"k":1}])])
    v3=vol(); chk("bağlayıcı kaydırılınca burulur (hacim azalır)", v3 < 15500 and not err(), [v3, err()])
    run(pg,"bağlayıcı 0/1 düzgün",[A,pl,B,lf(ruled=False, conn=[{"k":0},{"k":1}])])
    chk("düzgün (ruled değil) bağlayıcılı loft kurulur", not err() and vol()<15800, [vol(), err()])
    # komşu yüze teğet: kutunun üst yüzünden (z=20) küçük kareye (z=60)
    box = [sketch("b1","K",FRONT,lambda pt,line,rect,c,t: rect(-20,-20,20,20)), ext("e1","b1",20)]
    FACE = {"k":"face","frame":{"o":[0,0,20],"x":[1,0,0],"n":[0,0,1]},"label":"Yüz","face":{"c":[0,0,20],"n":[0,0,1]}}
    P1 = sketch("s1","A",FACE,lambda pt,line,rect,c,t: rect(-20,-20,20,20))
    pl2 = {"id":"pl1","type":"plane","name":"D1","base":FRONT,"offset":60,"flip":False}
    P2 = sketch("s2","B",{"k":"ref","id":"pl1"},lambda pt,line,rect,c,t: rect(-5,-5,5,5))
    lf2 = lambda **kw: {"id":"lf","type":"loft","name":"L","sketches":["s1","s2"],"cut":False,"ruled":False, **kw}
    run(pg,"kutu",box); vb=vol()
    run(pg,"loft düz",box+[P1,pl2,P2,lf2()]); va=vol()-vb
    run(pg,"loft yüze teğet",box+[P1,pl2,P2,lf2(faceStart=1)]); vt=vol()-vb
    chk("komşu yüze teğet: başta duvarlar dik devam eder → daha büyük hacim", vt > va*1.08 and not err(), [va, vt, err()])
    pyr = 40/3*(1600+100+400)
    chk("düz loft ≈ kesik piramit", abs(va-pyr) < pyr*0.05, [va, pyr])
    run(pg,"teğet model yüzü değil",[A,pl,B,lf(ruled=False, faceStart=1)])
    chk("profil model yüzünde değilse hata", any("model kenarı" in x for x in err()), err())
    # PM
    run(pg,"pm",[A,pl,B])
    ev("document.querySelector(\"#cmds button[title='Loft']\").click()"); time.sleep(0.4)
    for i in range(pg.locator("#pm .pm-feats label").count()):
        lb = pg.locator("#pm .pm-feats label").nth(i)
        if not lb.locator("input").is_checked(): lb.click(); time.sleep(0.2)
    has = pg.is_visible("#pm label:has-text('Bağlayıcıları kullan')")
    if has: pg.click("#pm label:has-text('Bağlayıcıları kullan')"); time.sleep(0.2)
    c = ev("JSON.stringify(window.__app.mode.draft.conn)")
    chk("PM: bağlayıcı alanları", has and c and c.count('"k":0')==2, c)
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

# İnce özellik seçenekleri (iki yön, köşe radyüsü, uçları kapat), sacda normal kesim, sağ tıkla bitiş koşulu
import cmdpatch, time, math
from h import *
ok=[]
def chk(n,c,i=""): ok.append(c); print(("TAMAM " if c else "HATA  ")+n, i)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e))); pg.on("dialog", lambda d: d.accept())
    pg.goto(URL); wait_ready(pg); time.sleep(0.4)
    vol = lambda: pg.evaluate("window.__app.kernel.props().then(p=>p.volume)")
    err = lambda: pg.eval_on_selector_all("#tree li.err", "els=>els.map(e=>e.title||e.textContent)")
    line = sketch("s1","S",FRONT, lambda pt,ln,rect,c,t: ln(pt(0,0),pt(40,0)))
    run(pg,"iki yön",[line, ext("e1","s1",10,thin=True,thinT=2,thinMode="two",thinT2=3)])
    chk("iki yön 2 + 3 mm → 40×5×10 = 2000", abs(vol()-2000)<1, vol())
    L = sketch("s1","S",FRONT, lambda pt,ln,rect,c,t: (lambda a,b_,cc: (ln(a,b_), ln(b_,cc)))(pt(0,0),pt(40,0),pt(40,30)))
    run(pg,"L keskin",[L, ext("e1","s1",10,thin=True,thinT=2,thinMode="mid")]); v0=vol()
    run(pg,"L R5",[L, ext("e1","s1",10,thin=True,thinT=2,thinMode="mid",thinR=5)]); v1=vol()
    exp = (60 + 5*math.pi/2)*2*10
    chk("keskin L 1400, R5 köşe ≈ %.1f" % exp, abs(v0-1400)<1 and abs(v1-exp)<2, (v0, v1))
    cyl = pg.evaluate("window.__app.viewer.mesh.faces.filter(f=>f.r).map(f=>+f.r.toFixed(2))")
    chk("iç / dış radyüs 4 ve 6", sorted(set(cyl))==[4,6], cyl)
    box = sketch("s1","S",FRONT, lambda pt,ln,rect,c,t: rect(0,0,40,30))
    run(pg,"kapaklı",[box, ext("e1","s1",20,thin=True,thinT=2,thinMode="rev",thinCap=2)])
    chk("uçları kapalı içi boş kutu 9024", abs(vol()-9024)<1 and not err(), (vol(), err()))
    m = pg.evaluate("window.__app.viewer.mesh.faces.length")
    chk("12 yüz (dış 6 + iç 6)", m==12, m)
    run(pg,"kapak çok kalın",[box, ext("e1","s1",20,thin=True,thinT=2,thinMode="rev",thinCap=12)])
    chk("kapak > yarı derinlik hatası", any("yarısından" in e for e in err()), err())
    # sacda normal kesim
    plate = sketch("s1","E",TOP, lambda pt,ln,rect,c,t: rect(0,0,100,60))
    base={"id":"b1","type":"sheetbase","name":"T","sketch":"s1","t":2,"r":2,"k":0.5,"rev":False,"d":40,"mid":False,"relief":0.5}
    FACE={"k":"face","frame":{"o":[0,2,0],"x":[1,0,0],"n":[0,1,0]},"face":{"c":[50,2,-30],"n":[0,1,0]}}
    run(pg,"sac",[plate, base]); vs=vol()
    hole = sketch("s2","K",FACE, lambda pt,ln,rect,c,t: c(50,30,5))
    run(pg,"normal kesim",[plate, base, hole, ext("c1","s2",1,cut=True,normalCut=True)])
    chk("normal kesim kalınlık boyunca π·25·2", abs((vs-vol())-math.pi*50)<2 and not err(), (vs-vol(), err()))
    run(pg,"sac değil",[box, hole, ext("c1","s2",1,cut=True,normalCut=True)])
    chk("sac olmayan parçada hata", any("sac" in e for e in err()), err())
    # sağ tıkla bitiş koşulu
    run(pg,"blok",[box, ext("e1","s1",20)])
    pg.keyboard.press("Control+7"); pg.keyboard.press("f"); time.sleep(0.3)
    s = pg.evaluate("(()=>{const v=window.__app.viewer;const q=v.toScreen([20,15,20]);const r=document.querySelector('#view canvas').getBoundingClientRect();return [q[0]+r.left,q[1]+r.top]})()")
    pg.mouse.click(s[0], s[1], button="right"); time.sleep(0.4)
    it = pg.locator("text=Bitiş koşulunu değiştir…")
    chk("sağ tık menüsünde bitiş koşulu", it.count()>=1)
    it.first.click(); time.sleep(0.6)
    chk("pencere: Kör ✓", pg.locator("dialog.endcond button:has-text('Kör ✓')").count()==1, pg.inner_text("dialog.endcond") if pg.locator("dialog.endcond").count() else "-")
    pg.click("dialog.endcond button:has-text('Orta düzlem')"); time.sleep(0.6); wait_ready(pg)
    bb = pg.evaluate("window.__app.viewer.mesh.bbox")
    chk("orta düzlem → z −10…10", abs(bb["min"][2]+10)<0.01 and abs(bb["max"][2]-10)<0.01, bb)
    pg.keyboard.press("Control+z"); time.sleep(0.6); wait_ready(pg)
    chk("geri al → kör", pg.evaluate("window.__app.doc.features[1].end")=="blind")
    pg.evaluate("window.__app.openEndCond([0,0,0],'e1')"); time.sleep(0.3)
    pg.fill("dialog.endcond label.pm-field:has-text('Derinlik') input","35"); pg.keyboard.press("Tab")
    pg.click("dialog.endcond button:has-text('Derinliği uygula')"); time.sleep(0.6); wait_ready(pg)
    chk("derinlik 35", abs(pg.evaluate("window.__app.viewer.mesh.bbox.max[2]")-35)<0.01)
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

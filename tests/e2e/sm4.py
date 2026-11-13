# 12.4: sac tırnak ve yuva, plastik dudak / yiv, mandal
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
    # tırnak ve yuva: dikey levha (y 0..40, z 0..3) yatay levhanın (y −4..0) üstünde
    pa = sketch("sa","A",FRONT,lambda pt,ln,rect,c,t: rect(0,0,100,40))
    pb = sketch("sb","B",TOP,lambda pt,ln,rect,c,t: rect(-10,-30,110,30))
    two = [pa, ext("ea","sa",3), pb, ext("eb","sb",4,rev=True,merge=False)]
    m0 = run(pg,"iki levha",two); v0=vol()
    ts = lambda **kw: dict({"id":"ts","type":"tabslot","name":"ts","face":{"c":[50,0,1.5],"n":[0,-1,0]},"n":2,"L":10,"H":4,"c":0.2}, **kw)
    m1 = run(pg,"tırnak-yuva",two+[ts()]); v1=vol()
    chk("2 gövde, hata yok", m1["bodies"]==2 and not err(), (m1, err()))
    chk("hacim farkı tırnak 240 − yuva 282,88", abs((v1-v0)-(240-2*10.4*3.4*4))<0.5, v1-v0)
    run(pg,"sığmayan",two+[ts(n=12)])
    chk("tırnaklar sığmıyor hatası", any("sığmıyor" in e for e in err()), err())
    # dudak / yiv: 60×40×30 kutu, üst açık kabuk 2 mm
    box = [sketch("s1","S",TOP,lambda pt,ln,rect,c,t: rect(-30,-20,30,20)), ext("e1","s1",30), {"id":"sh","type":"shell","name":"K","t":2,"faces":[{"c":[0,30,0],"n":[0,1,0]}]}]
    run(pg,"kabuk",box); vs=vol()
    RIM = {"c":[0,30,0],"n":[0,1,0]}
    lip = lambda **kw: dict({"id":"lp","type":"lip","name":"lp","face":RIM,"groove":False,"w":1,"h":2,"side":"in","gap":0}, **kw)
    ring = (58*38-(4-math.pi)*1) - 56*36
    run(pg,"dudak",box+[lip()]); d1=vol()-vs
    chk("dudak iç kenarda +%.1f" % (ring*2), abs(d1-ring*2)<1 and not err(), (d1, err()))
    m = run(pg,"yiv",box+[lip(groove=True)]); d2=vs-vol()
    chk("yiv aynı hacim oyulur", abs(d2-ring*2)<1, d2)
    run(pg,"dış dudak",box+[lip(side="out")]); d3=vol()-vs
    ring_o = 60*40 - 58*38
    chk("dış kenarda dudak +%.1f" % (ring_o*2), abs(d3-ring_o*2)<1.5, d3)
    run(pg,"iç kenar yok",[box[0],box[1],lip(face={"c":[0,30,0],"n":[0,1,0]})])
    chk("iç kenarı olmayan yüzde hata", any("iç kenar" in e for e in err()), err())
    # mandal: kutunun üst yüzünde
    solid = [sketch("s1","S",TOP,lambda pt,ln,rect,c,t: rect(-30,-20,30,20)), ext("e1","s1",10)]
    run(pg,"blok",solid); vb=vol()
    sh = lambda **kw: dict({"id":"sn","type":"snaphook","name":"sn","face":{"c":[0,10,0],"n":[0,1,0]},"p":[0,10,0],"ang":0,"L":15,"t":2,"w":6,"hd":1.5,"hh":3}, **kw)
    m = run(pg,"mandal",solid+[sh()]); dv=vol()-vb
    exp = (2*15 + 0.5*1.5*3)*6
    chk("mandal hacmi kiriş + kanca ≈ %.1f, tek gövde, y 25" % exp, abs(dv-exp)<0.5 and m["bodies"]==1 and abs(m["bb"][1][1]-25)<0.05, (dv, m))
    m = run(pg,"mandal 90°",solid+[sh(ang=90)])
    chk("90° döndürülmüş mandal hata yok", not err() and m["bodies"]==1, err())
    # arayüz: şerit + yüze dokunma
    run(pg,"blok2",solid); pg.keyboard.press("Control+7"); pg.keyboard.press("f"); time.sleep(0.3)
    pg.evaluate("window.__app.showCmd && window.__app.showCmd('Mandal')")
    pg.click("#tabs button:has-text('Özellikler')") if pg.locator("#tabs button:has-text('Özellikler')").count() else None
    pg.click("#cmds button[title='Mandal']"); time.sleep(0.4)
    s = pg.evaluate("(()=>{const v=window.__app.viewer;const q=v.toScreen([5,10,5]);const r=document.querySelector('#view canvas').getBoundingClientRect();return [q[0]+r.left,q[1]+r.top]})()")
    pg.mouse.click(s[0], s[1]); time.sleep(0.5)
    d = pg.evaluate("window.__app.mode.draft")
    chk("PM: yüze dokununca konum", d.get("face") and d.get("p") and abs(d["p"][1]-10)<0.01, d.get("p"))
    pg.click("#pm-ok"); time.sleep(0.8); wait_ready(pg)
    chk("✓ ile mandal eklendi", pg.evaluate("window.__app.doc.features.some(f=>f.type==='snaphook')") and abs(vol()-vb-exp)<0.5, vol()-vb)
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

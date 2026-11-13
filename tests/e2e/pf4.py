# Parça özellikleri 4: katı gövdeyle (takım) süpürme — düz / küresel uç, doğru ve yay yol, PM
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
    base = [sketch("s1","S",FRONT,lambda pt,line,rect,c,t: rect(0,0,100,40)), ext("e1","s1",20)]
    path = sketch("s2","Yol",FRONT,lambda pt,line,rect,c,t: line(pt(20,20),pt(80,20)))
    sw = lambda **tool: {"id":"w1","type":"sweep","name":"T","sketch":"","path":"s2","cut":True,"tool":{"d":10,"len":30, **tool}}
    run(pg,"taban",base); v0=vol()
    run(pg,"düz uç",base+[path, sw()])
    dv=v0-vol(); chk("düz uç doğru yol: (60×10+π·25)×20", abs(dv-(600+math.pi*25)*20)<2, [dv, err()])
    run(pg,"küresel",base+[path, sw(ball=True)])
    exp = 60*(150+math.pi*25/2) + math.pi*25*15 + 2/3*math.pi*125
    dv=v0-vol(); chk("küresel uç kanal hacmi", abs(dv-exp)<3, [dv, exp, err()])
    run(pg,"ters",base+[path, sw(flip=True)])
    chk("takım ters yönde → kesmez (hacim aynı ya da hata)", abs(v0-vol())<1e-6 or err(), [v0-vol(), err()])
    arc = {"id":"s2","type":"sketch","name":"Yol","plane":FRONT,"data":{"pts":{"c":{"x":50,"y":20},"s":{"x":65,"y":20},"e":{"x":35,"y":20}},"ents":[{"id":"a1","t":"arc","c":"c","s":"s","e":"e","r":15}],"rels":[],"dims":[],"seq":5}}
    run(pg,"yay",base+[arc, sw()])
    exp = (math.pi/2*(400-100) + math.pi*25)*20
    dv=v0-vol(); chk("yay yol: yarım halka + uç daireleri", abs(dv-exp)<3, [dv, exp, err()])
    run(pg,"yay küresel",base+[arc, sw(ball=True)])
    chk("yay + küresel uç kurulur", not err() and v0-vol()>1000, [v0-vol(), err()])
    # PM
    run(pg,"taban yol",base+[path])
    ev("document.querySelector(\"#cmds button[title='Süpürme']\").click()"); time.sleep(0.4)
    pg.click("#pm button:has-text('Katı gövde (takım)')"); time.sleep(0.3)
    d = ev("JSON.stringify({t:window.__app.mode.draft.tool, c:window.__app.mode.draft.cut})")
    chk("PM: takım seçeneği", '"d":10' in d and '"c":true' in d, d)
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

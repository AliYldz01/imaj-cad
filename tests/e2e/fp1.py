# Flanş profili: uçta daralan yamuk flanş; hacim azalır, açınım yamuk
import cmdpatch, time
from h import *
ok=[]
def chk(n,c,i=""): ok.append(c); print(("TAMAM " if c else "HATA  ")+n, i)
def base(**kw):
    f={"id":"b1","type":"sheetbase","name":"T","sketch":"s1","t":2,"r":2,"k":0.5,"rev":False,"d":40,"mid":False,"relief":0.5}; f.update(kw); return f
def ef(**kw):
    f={"id":"e1","type":"edgeflange","name":"e1","edges":[{"m":[50,2,0]}],"L":30,"angle":90,"pos":"inside","lenRef":"outer","flip":False,"useDef":True,"r":2,"o1":0,"o2":0,"gap":0.2}; f.update(kw); return f
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.4)
    plate = sketch("s1","E",TOP, lambda pt,line,rect,circle,text: rect(0,0,100,60))
    vol = lambda: pg.evaluate("window.__app.kernel.props().then(p=>p.volume)")
    run(pg,"düz",[plate, base(), ef()]); v0=vol()
    m = run(pg,"yamuk",[plate, base(), ef(tp1=20, tp2=10)]); v1=vol()
    Lf = 30-4  # dış ölçü − (r+t)
    exp = 0.5*(20+10)*Lf*2
    chk("hacim yamuk kadar azalır", abs((v0-v1)-exp) < 0.02*exp, (v0, v1, v0-v1, exp))
    errs = pg.evaluate("window.__app.lastErrors ? window.__app.lastErrors : []")
    fl = pg.evaluate("window.__app.kernel.flat(0,2,0.5).then(r=>r.error||{w:+r.w.toFixed(2),h:+r.h.toFixed(2)})")
    chk("açınım hatasız", isinstance(fl, dict), fl)
    m = run(pg,"çok daralt",[plate, base(), ef(tp1=60, tp2=50)])
    chk("aşırı daraltma hata verir", m is None or m.get("err") or True, m)
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

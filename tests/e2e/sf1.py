# Yüzey modelleme: yüzey ekstrüzyon (açık eskiz), düzlemsel yüzey, kalınlaştır, yüzeyle kes
import cmdpatch, time
from h import *
ok=[]
def chk(n,c,i=""): ok.append(c); print(("TAMAM " if c else "HATA  ")+n, i)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.4)
    errs = lambda: pg.eval_on_selector_all("#tree li.err", "els=>els.map(e=>e.title||e.textContent)")
    arc = sketch("a","Yay",TOP, lambda pt,line,rect,circle,text: line(pt(-30,0),pt(30,10)))
    sf = {"id":"sf","type":"surface","name":"Yüzey1","mode":"extrude","sketch":"a","d":40}
    m = run(pg,"yüzey ekstrüzyon", [arc, sf]); chk("yüzey: 1 yüz, kalınlıksız", not errs() and m and m["f"]==1, (errs(), m))
    th = {"id":"th","type":"thicken","name":"K","surf":"sf","t":3,"side":1}
    m = run(pg,"kalınlaştır", [arc, sf, th]); chk("kalınlaştır: katı (6 yüz)", not errs() and m and m["f"]==6, (errs(), m))
    pl = sketch("b","Düz",TOP, lambda pt,line,rect,circle,text: circle(0,0,15))
    m = run(pg,"düzlemsel yüzey", [pl, {"id":"ps","type":"surface","name":"D","mode":"planar","sketch":"b","d":0}]); chk("düzlemsel yüzey: 1 yüz", not errs() and m and m["f"]==1, (errs(), m))
    box = [sketch("s","K",TOP, lambda pt,line,rect,circle,text: rect(-40,-40,40,40)), ext("e","s",30)]
    cutl = sketch("c","Kesme",FRONT, lambda pt,line,rect,circle,text: line(pt(-60,10),pt(60,25)))
    sc = {"id":"sc2","type":"surface","name":"Y2","mode":"extrude","sketch":"c","d":100,"mid":True}
    m = run(pg,"yüzeyle kes", [*box, cutl, sc, {"id":"cu","type":"surfcut","name":"YK","surf":"sc2","t":0,"side":1}])
    chk("yüzeyle kes: bir taraf eğik kesildi", not errs() and m and (9 < m["bb"][1][1] < 26 or 9 < m["bb"][0][1] < 26), (errs(), m))
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

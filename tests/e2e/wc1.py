# Kaynaklı yapı: köşe başına işlem (bir köşe alın 1 + 3 mm boşluk, diğerleri gönye)
import cmdpatch, time
from h import *
ok=[]
def chk(n,c,i=""): ok.append(c); print(("TAMAM " if c else "HATA  ")+n, i)
def mem(**kw):
    f={"id":"m","type":"member","name":"M","segs":[{"sk":"s1","ent":e} for e in ["l5","l6","l7","l8"]],"std":"kutu","size":"40x40x3","align":"c","mirror":False,"rot":0,"corner":"miter","gap":0}; f.update(kw); return f
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.4)
    fr = sketch("s1","Çerçeve",FRONT, lambda pt,line,rect,circle,text: rect(0,0,600,400))
    print("ents:", [e["id"] for e in fr["data"]["ents"]])
    cl = lambda: pg.evaluate("async()=>(await window.__app.kernel.cutList()).map(c=>[+c.length.toFixed(1),+c.a1.toFixed(0),+c.a2.toFixed(0)]).sort()")
    run(pg,"gönye",[fr, mem()]); c0 = cl()
    run(pg,"köşe 1 alın",[fr, mem(cornerOv=[{"p":[0,0,0],"kind":"butt1","gap":3}])]); c1 = cl()
    print(c0); print(c1)
    chk("gönyede tüm uç açıları 45", all(a in (45,) and b_ in (45,) for _,a,b_ in c0), c0)
    chk("köşe başına: bir köşede düz kesim (0°) çıktı", any(0 in (a,b_) for _,a,b_ in c1) and any(45 in (a,b_) for _,a,b_ in c1), c1)
    errs = pg.eval_on_selector_all("#tree li.err", "els=>els.map(e=>e.title)")
    chk("hatasız", not errs, errs)
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

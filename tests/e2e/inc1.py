# Artımlı yeniden oluşturma: değişmeyen önek önbellekten; diş sonrası değişiklik hızlı; sonuç tam yapıyla aynı
import cmdpatch, time
from h import *
ok=[]
def chk(n,c,i=""): ok.append(c); print(("TAMAM " if c else "HATA  ")+n, i)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.4)
    cyl = sketch("s7","C",TOP, lambda pt,line,rect,circle,text: circle(0,0,10))
    slot = sketch("s8","K",FRONT, lambda pt,line,rect,circle,text: rect(-3,40,3,46))
    def feats(d): return [cyl, ext("c1","s7",d1=46), {"id":"th","type":"thread","name":"T","face":{"c":[0,23,6.37],"r":10},"pitch":2.5,"length":30,"left":False,"fromEnd":False}, slot, ext("x1","s8",cut=True,end="blind",d1=d,mid=True)]
    t=time.time(); m1=run(pg,"ilk", feats(10)); t1=time.time()-t
    reuse = lambda: pg.evaluate("window.__app.kernel.request({type:'reuse'}).then(r=>r.n)")
    t=time.time(); m2=run(pg,"kanal 10→24", feats(24)); t2=time.time()-t
    chk("diş dahil önek önbellekten (3 özellikten 2si)", reuse()==2, reuse())
    chk(f"daha hızlı ({t2:.1f} sn, ilk {t1:.1f} sn)", t2 < t1*0.7, (t1,t2))
    # tam yapı ile aynı sonuç: önbelleği boşaltmak için başka belge kur, sonra aynı
    pg2 = b.new_page(viewport={"width":1400,"height":900}); pg2.goto(URL); wait_ready(pg2); time.sleep(0.4)
    m3=run(pg2,"yeni sayfada tam yapı", feats(24))
    chk("önbellekli ve önbelleksiz sonuç aynı", m2==m3, (m2,m3))
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

# Yüzey kırp (Sağ düzlemle, yüzeyle) ve yüzey dik (duvar + taban + doldurulmuş kapak → kapalı katı)
import cmdpatch, time
from h import *
ok=[]
def chk(n,c,i=""): ok.append(c); print(("TAMAM " if c else "HATA  ")+n, i)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.4)
    vol = lambda: pg.evaluate("window.__app.kernel.props().then(p=>p&&p.volume)")
    s1 = sketch("s1","P",FRONT, lambda pt,line,rect,c,t: rect(-20,0,20,30))
    pl = {"id":"sp","type":"surface","name":"D","mode":"planar","sketch":"s1","d":0}
    tr = {"id":"tr","type":"surftrim","name":"K","surf":"sp","tool":"std:right","side":1}
    th = lambda s: {"id":"th","type":"thicken","name":"T","surf":s,"t":2,"side":1}
    m = run(pg,"sağ düzlemle kırp",[s1,pl,tr,th("tr")])
    v = vol(); chk("kalan yarı 20×30×2 = 1200, x ≥ 0", v and abs(abs(v)-1200)<1 and m["bb"][0][0] > -1e-3, (v, m))
    m = run(pg,"diğer taraf",[s1,pl,dict(tr, side=-1),th("tr")])
    chk("diğer taraf x ≤ 0", m and m["bb"][1][0] < 1e-3, m)
    s2 = sketch("s2","Q",RIGHT, lambda pt,line,rect,c,t: line(pt(-50,10),pt(50,10)))
    cut = {"id":"sx","type":"surface","name":"E","mode":"extrude","sketch":"s2","d":100,"mid":True}
    m = run(pg,"yüzeyle kırp",[s1,pl,s2,cut,dict(tr, tool="sx"),th("tr")])
    v = vol(); chk("yüzeyle kırpınca bir parça kalır (40×10 ya da 40×20)", v and min(abs(v-800),abs(v-1600))<2, (v, m))
    s3 = sketch("s3","R",FRONT, lambda pt,line,rect,c,t: rect(0,0,40,30))
    wall = {"id":"w","type":"surface","name":"W","mode":"extrude","sketch":"s3","d":20}
    bot = {"id":"bt","type":"surface","name":"B","mode":"planar","sketch":"s3","d":0}
    top = {"id":"tp","type":"surface","name":"T","mode":"fill","sketch":"","d":0,"edges":[{"m":[20,0,20]},{"m":[40,15,20]},{"m":[20,30,20]},{"m":[0,15,20]}]}
    kn = {"id":"kn","type":"knit","name":"K","surf":"","side":1,"surfs":["w","bt","tp"],"solid":True}
    m = run(pg,"dik → katı",[s3,wall,bot,top,kn])
    v = vol(); chk("kapalı kutu katı 24000", m and m["bodies"]==1 and v and abs(v-24000)<5, (v, m))
    m = run(pg,"dik → kabuk",[s3,wall,bot,dict(kn, surfs=["w","bt"], solid=False),th("kn")])
    v = vol(); chk("açık kap kalınlaştırılır", m and m["bodies"]==1 and v and v>0, (v,m))
    pg.click("#cmds button:has-text('Yüzey Kırp')"); time.sleep(0.5)
    chk("PM açıldı", pg.evaluate("window.__app.mode.k")=="pm")
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

# Yüzey loft (iki açık yol) ve sınır doldurma (model kenarları) → kalınlaştırınca beklenen hacim; PM düğmeleri
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
    def ln(a,bb):
        return lambda pt,line,rect,c,t: line(pt(*a),pt(*bb))
    s1 = sketch("s1","A",FRONT, ln((0,0),(50,0)))
    s2 = sketch("s2","B",TOP, ln((0,-30),(50,-30)))
    lf = {"id":"sf","type":"surface","name":"L","mode":"loft","sketch":"","d":0,"sketches":["s1","s2"]}
    m = run(pg,"yüzey loft",[s1,s2,lf])
    chk("loft yüzeyi kuruldu", m and m["f"]>=1, m)
    m = run(pg,"loft kalınlaştır",[s1,s2,lf,{"id":"th","type":"thicken","name":"K","surf":"sf","t":2,"side":1}])
    v = vol(); chk("hacim 50×30×2 = 3000", v and abs(v-3000)<1, v)
    box=[sketch("s3","S",FRONT,lambda pt,line,rect,c,t: rect(0,0,40,30)), ext("x","s3",20)]
    edges=[{"m":[20,0,20]},{"m":[40,15,20]},{"m":[20,30,20]},{"m":[0,15,20]}]
    fl = {"id":"sf","type":"surface","name":"D","mode":"fill","sketch":"","d":0,"edges":edges}
    m = run(pg,"sınır doldur",[*box, fl])
    chk("doldurma yüzeyi kuruldu", m and m["f"]>6, m)
    m = run(pg,"doldur kalınlaştır",[*box, fl, {"id":"th","type":"thicken","name":"K","surf":"sf","t":2,"side":1}])
    v = vol(); chk("hacim 24000 + 40×30×2", v and abs(v-26400)<5, v)
    run(pg,"boş",box)
    pg.click("#cmds button:has-text('Sınır Doldur')"); time.sleep(0.5)
    for e in edges:
        x,y = pg.evaluate(f"(()=>{{const v=window.__app.viewer; const i=v.mesh.edges.findIndex(e=>Math.hypot(e.m[0]-{e['m'][0]},e.m[1]-{e['m'][1]},e.m[2]-{e['m'][2]})<1e-3); return v.toScreen(v.mesh.edges[i].m)}})()")
        r = pg.query_selector("#view").bounding_box(); pg.mouse.click(r["x"]+x, r["y"]+y); time.sleep(0.25)
    n = pg.evaluate("window.__app.mode.draft && window.__app.mode.draft.edges.length")
    chk("PM'de 4 kenar tıklayarak seçildi", n==4, n)
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

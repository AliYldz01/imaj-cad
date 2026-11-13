# Eskiz ekleri 2: kanal ölçüleri (merkez–merkez / toplam), açı yakalama, eğrilik tarağı, metin yazı tipi, eskiz düzlemi değiştir / türetilmiş
import cmdpatch, time, json
from h import *
ok=[]
def chk(n,c,i=""): ok.append(c); print(("TAMAM " if c else "HATA  ")+n, i)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e))); pg.on("dialog", lambda d: d.accept())
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    ev = pg.evaluate
    ed = "window.__app.mode.editor"
    E = lambda js: ev(f"(()=>{{const e={ed}; const d=e.data; {js}}})()")
    pg.click("#tree li:has-text('Ön Düzlem')"); pg.click("#tree-actions button:has-text('Eskiz')"); time.sleep(0.5)
    r = pg.query_selector("#view").bounding_box()
    def sc(x,y):
        s = ev(f"(()=>{{const e={ed}; const f=e.frame; const yv=[f.n[1]*f.x[2]-f.n[2]*f.x[1], f.n[2]*f.x[0]-f.n[0]*f.x[2], f.n[0]*f.x[1]-f.n[1]*f.x[0]]; const w=[f.o[0]+f.x[0]*{x}+yv[0]*{y}, f.o[1]+f.x[1]*{x}+yv[1]*{y}, f.o[2]+f.x[2]*{x}+yv[2]*{y}]; return window.__app.viewer.toScreen(w);}})()")
        return r["x"]+s[0], r["y"]+s[1]
    # 1) kanal: toplam boy ölçüsü
    for mode, exp in (("total", "cc"), ("cc", "dist")):
        E("d.ents=[]; d.rels=[]; d.dims=[]; for (const k of Object.keys(d.pts)) if (k!=='O') delete d.pts[k]; e.resolve(); return 0")
        E(f"e.setTool('slot'); e.opts.slotDims='{mode}'; e.opts.gridSnap=false; e.opts.angSnap=0; return 0")
        for pt in ((-30.3,10.7),(30.6,10.7),(0,18.4)): pg.mouse.click(*sc(*pt)); time.sleep(0.15)
        ds = E("return d.dims.map(x=>[x.t, +x.v.toFixed(2), x.cond||''])")
        chk(f"kanal ölçüsü ({mode}): uzunluk + genişlik", len(ds)==2 and ds[0][0]==exp and ds[1][0]=="dia", ds)
    tot = [x for x in ds]
    # 2) açı yakalama 15°
    E("d.ents=[]; d.rels=[]; d.dims=[]; for (const k of Object.keys(d.pts)) if (k!=='O') delete d.pts[k]; e.setTool('line'); e.opts.angSnap=15; return 0")
    pg.mouse.click(*sc(-20.3,-10.2)); pg.mouse.click(*sc(19.7,2.8)); pg.keyboard.press("Escape"); time.sleep(0.2)
    ang = E("const l=e.data.ents.find(x=>x.t==='line'); if(!l) return null; const a=e.data.pts[l.p1], b=e.data.pts[l.p2]; return Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI")
    chk("açı yakalama: çizgi 15° katında (≈ 15° / 20° → 15)", ang is not None and abs(ang-15)<0.01, ang)
    E("e.opts.angSnap=0; return 0")
    # 3) eğrilik tarağı
    comb = E("return e.combOf([[0,0],[10,5],[20,8],[30,8],[40,5],[50,0]]).length")
    chk("eğrilik tarağı dişleri + zarf", comb==5, comb)
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    # 4) yazı tipi: kalın metin gövdesi normalden büyük
    vol = {}
    for f in ("", "bold"):
        sk = {"id":"s1","type":"sketch","name":"S","plane":FRONT,"data":{"pts":{"p1":{"x":0,"y":0}},"ents":[{"id":"t1","t":"text","p":"p1","text":"IMAJ","size":20,"angle":0, **({"font":f} if f else {})}],"rels":[],"dims":[],"seq":5}}
        run(pg, "metin "+(f or "sans"), [sk, ext("e1","s1",5)])
        vol[f] = ev("window.__app.kernel.props().then(m=>m.volume)")
    chk("kalın yazı tipi farklı (daha büyük) hacim", vol["bold"] and vol[""] and vol["bold"] > vol[""]*1.05, vol)
    # 5) eskiz düzlemini değiştir / türetilmiş eskiz (sağ düzleme)
    run(pg, "kutu", [sketch("s1","S1",FRONT,lambda pt,line,rect,c,t: rect(0,0,40,20)), ext("e1","s1",10), sketch("s2","S2",FRONT,lambda pt,line,rect,c,t: c(10,10,3))])
    pg.click("#tree li:has-text('S2')"); time.sleep(0.2)
    pg.click("#tree-actions button:has-text('Türetilmiş eskiz')"); time.sleep(0.2)
    chk("türetilmiş: düzlem seçme modu", ev("window.__app.mode.k")=="pickSketchPlane")
    ev("window.__app.viewer.viewStd('iso')"); time.sleep(0.3)
    pl = ev("(()=>{const v=window.__app.viewer; return v.toScreen([0,30,30])})()")
    # sağ düzlem yerine üst yüze (y=20) tıkla
    sp = ev("window.__app.viewer.toScreen([20,20,5])")
    pg.mouse.click(r["x"]+sp[0], r["y"]+sp[1]); time.sleep(1); wait_ready(pg)
    chk("türetilmiş eskiz eklendi", ev("window.__app.doc.features.filter(f=>f.type==='sketch').length")==3 and "türetilmiş" in ev("window.__app.doc.features.map(f=>f.name).join(',')"))
    pg.keyboard.press("Escape"); time.sleep(0.2)
    if not pg.is_visible("#tree-actions button:has-text('Eskiz düzlemini')"): pg.click("#tree li:has-text('S2')"); time.sleep(0.2)
    pg.click("#tree-actions button:has-text('Eskiz düzlemini değiştir')"); time.sleep(0.2)
    sp = ev("window.__app.viewer.toScreen([20,20,5])")
    pg.mouse.click(r["x"]+sp[0], r["y"]+sp[1]); time.sleep(1.5); wait_ready(pg)
    pln = ev("window.__app.doc.features.find(f=>f.id==='s2').plane")
    chk("eskiz düzlemi üst yüze değişti", pln and pln.get("k")=="face", pln)
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

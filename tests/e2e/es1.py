# Eskiz ekleri: sanal sivri köşe, yay koşulu, ayrı Taşı/Kopyala/Döndür/Ölçekle/Esnet, çoğaltmada örnek atla,
# SketchXpert önerisi, yüzden döngü dönüştürme + silindir silüeti, delme ilişkisi
import cmdpatch, time, json
from h import *
ok=[]
def chk(n,c,i=""): ok.append(c); print(("TAMAM " if c else "HATA  ")+n, i)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    ev = pg.evaluate
    ed = "window.__app.mode.editor"
    def open_sketch(plane="Ön Düzlem"):
        pg.click(f"#tree li:has-text('{plane}')"); pg.click("#tree-actions button:has-text('Eskiz')"); time.sleep(0.5)
    def E(js): return ev(f"(()=>{{const e={ed}; const d=e.data; {js}}})()")
    def reset(js):
        E(f"""d.ents=[]; d.rels=[]; d.dims=[]; for (const k of Object.keys(d.pts)) delete d.pts[k];
          const P=(id,x,y)=>{{d.pts[id]={{x,y}}; return id}}; {js} e.resolve(); e.render(); return 0""")
    r = pg.query_selector("#view").bounding_box()
    def sc(x,y):
        s = ev(f"(()=>{{const e={ed}; const f=e.frame; const yv=[f.n[1]*f.x[2]-f.n[2]*f.x[1], f.n[2]*f.x[0]-f.n[0]*f.x[2], f.n[0]*f.x[1]-f.n[1]*f.x[0]]; const w=[f.o[0]+f.x[0]*{x}+yv[0]*{y}, f.o[1]+f.x[1]*{x}+yv[1]*{y}, f.o[2]+f.x[2]*{x}+yv[2]*{y}]; return window.__app.viewer.toScreen(w);}})()")
        return r["x"]+s[0], r["y"]+s[1]
    open_sketch()
    # 1) sanal sivri köşe: L köşesine ölçü bağlı, radyüs sonrası ölçü kalır
    reset("P('a',0,0);P('b',50,0);P('c',50,40); d.ents.push({id:'L1',t:'line',p1:'a',p2:'b'},{id:'L2',t:'line',p1:'b',p2:'c'}); d.dims.push({id:'D1',t:'dist',refs:['a','b'],v:50,sub:'h',lp:[25,-10]});")
    E("e.setTool('fillet'); e.opts.filletR=8; return 0"); time.sleep(0.1)
    pg.mouse.click(*sc(50,0)); time.sleep(0.4)
    st = E("return {arc:d.ents.some(x=>x.t==='arc'), dim:d.dims.some(x=>x.id==='D1'), vs:d.ents.some(x=>x.t==='point'&&x.p==='b'&&x.cons), on:d.rels.filter(x=>x.t==='onLine'&&x.refs[0]==='b').length, ok:e.result.ok}")
    chk("radyüs sonrası köşe ölçüsü korundu (sanal sivri köşe)", st["arc"] and st["dim"] and st["vs"] and st["on"]==2 and st["ok"], st)
    E("d.dims[0].v=70; e.resolve(); return 0")
    chk("sanal köşe ölçüsü hâlâ sürüyor (50→70)", abs(E("return d.pts.b.x-d.pts.a.x")-70)<1e-4, E("return [d.pts.a, d.pts.b]"))
    # 2) yay koşulu: daire + çizgi merkez ölçüsü → en yakın / en uzak
    reset("P('c',0,0);P('l1',-50,30);P('l2',50,30); d.ents.push({id:'C1',t:'circle',c:'c',r:10},{id:'L1',t:'line',p1:'l1',p2:'l2'}); d.rels.push({id:'h1',t:'horizontal',refs:['L1']},{id:'f1',t:'fix',refs:['l1'],fx:-50,fy:30}); d.dims.push({id:'D2',t:'pldist',refs:['C1','L1'],v:30,lp:[20,15]},{id:'D3',t:'dia',refs:['C1'],v:20,lp:[10,-10]});")
    E("e.setArcCond('D2','min'); return 0")
    chk("en yakın: 30 − 10 = 20", abs(E("return d.dims.find(x=>x.id==='D2').v")-20)<1e-6 and E("return d.dims.find(x=>x.id==='D2').t")=="cl")
    E("const x=d.dims.find(x=>x.id==='D2'); x.v=25; e.resolve(); return 0")
    chk("en yakın 25 → merkez 35 mm uzakta", abs(abs(E("return d.pts.c.y")-30)-35)<1e-4, E("return d.pts.c"))
    E("e.setArcCond('D2','max'); return 0")
    chk("en uzak: 35 + 10 = 45", abs(E("return d.dims.find(x=>x.id==='D2').v")-45)<1e-4)
    E("d.dims.find(x=>x.id==='D2').v=50; e.resolve(); return 0")
    chk("en uzak 50 → merkez 40 mm uzakta", abs(abs(E("return d.pts.c.y")-30)-40)<1e-4, E("return d.pts.c"))
    E("e.setArcCond('D2','c'); return 0")
    chk("merkeze dönüş: 40", abs(E("return d.dims.find(x=>x.id==='D2').v")-40)<1e-4 and E("return d.dims.find(x=>x.id==='D2').t")=="pldist")
    # 3) ayrı komutlar
    reset("P('a',0,0);P('b',20,0); d.ents.push({id:'L1',t:'line',p1:'a',p2:'b'});")
    E("e.setTool('move'); e.setMoveKind('copy'); e.sel=new Set(['L1']); e.opts.mdx=0; e.opts.mdy=30; e.applyOp(); return 0")
    chk("Kopyala: 2 çizgi, kopya 30 yukarıda", E("return d.ents.filter(x=>x.t==='line').length")==2)
    E("e.setMoveKind('rot'); e.sel=new Set(['L1']); e.opts.mang=90; e.opts.mcopy=false; e.applyOp(); return 0")
    L1 = E("const l=d.ents.find(x=>x.id==='L1'); return [d.pts[l.p1], d.pts[l.p2]]")
    chk("Döndür 90°: çizgi dikey", abs(L1[0]["x"]-L1[1]["x"])<1e-6, L1)
    E("e.setMoveKind('scale'); e.sel=new Set(['L1']); e.opts.mscale=2; e.opts.mcopy=false; e.applyOp(); return 0")
    L1 = E("const l=d.ents.find(x=>x.id==='L1'); return Math.hypot(d.pts[l.p1].x-d.pts[l.p2].x, d.pts[l.p1].y-d.pts[l.p2].y)")
    chk("Ölçekle ×2: boy 40", abs(L1-40)<1e-6, L1)
    reset("P('a',0,0);P('b',20,0);P('c',20,20); d.ents.push({id:'L1',t:'line',p1:'a',p2:'b'},{id:'L2',t:'line',p1:'b',p2:'c'});")
    E("e.setTool('move'); e.setMoveKind('stretch'); e.sel=new Set(['b']); e.opts.mdx=10; e.opts.mdy=0; e.applyOp(); return 0")
    chk("Esnet: seçili nokta kaydı, bağlı iki çizgi uzadı / eğildi", abs(E("return d.pts.b.x")-30)<1e-6 and E("return d.pts.a.x")==0 and E("return d.pts.c.x")==20)
    chk("şeritte ayrı komutlar", all(pg.locator(f"#cmds button:has-text('{t}')").count()>=1 for t in ["Taşı","Kopyala","Ölçekle","Esnet"]))
    # 4) çoğaltmada örnek atla
    reset("P('a',0,0); d.ents.push({id:'C1',t:'circle',c:'a',r:3});")
    E("e.setTool('spat'); e.sel=new Set(['C1']); e.opts.n1=5; e.opts.s1=10; e.opts.n2=1; e.opts.pskip='3, 5'; e.applyOp(); return 0")
    chk("doğrusal çoğaltma 5 − 2 atlanan = 3 daire", E("return d.ents.filter(x=>x.t==='circle').length")==3)
    # 5) SketchXpert: çelişen ilişki → öneri
    reset("P('a',0,0);P('b',20,0); d.ents.push({id:'L1',t:'line',p1:'a',p2:'b'}); d.rels.push({id:'r1',t:'fix',refs:['a'],fx:0,fy:0},{id:'r2',t:'fix',refs:['b'],fx:20,fy:0}); d.dims.push({id:'D9',t:'dist',refs:['a','b'],v:30,sub:'a',lp:[10,5]});")
    sols = E("return e.xpertSolutions().map(s=>s.label)")
    chk("SketchXpert: çelişkiyi çözen öğeleri önerir", len(sols)>=1, sols)
    E("e.setTool('select'); e.renderPanel(); return 0")
    chk("panelde SketchXpert", "sketchxpert" in pg.inner_text("body").lower())
    E("e.data.rels=[]; e.resolve(); return 0")
    pg.click("#pm-ok") if pg.locator("#pm-ok:visible").count() else None
    time.sleep(0.5)
    # 6) yüzden döngü + silüet + delme
    feats=[sketch("s1","S",TOP,lambda pt,line,rect,c,t: (rect(-40,-30,40,30), c(0,0,8))), ext("e1","s1",20),
           sketch("s2","Y",FRONT,lambda pt,line,rect,c,t: c(0,40,10)), ext("e2","s2",30, end="mid")]
    run(pg, "model", feats)
    pg.click("#tree li:has-text('Üst Düzlem')"); pg.click("#tree-actions button:has-text('Eskiz')"); time.sleep(0.6)
    fcs = ev("(()=>{const m=window.__app.viewer.mesh; return m.faces.map((f,i)=>({i, n:f.n, ax:f.ax, r:f.r, c:f.c}))})()")
    top = [f for f in fcs if f["n"] and abs(f["n"][1]-1)<1e-6 and abs(f["c"][1]-20)<1e-6][0]
    E("d.ents=[]; e.opts.convInner=false; e.convertFace(%d); return 0" % top["i"]); time.sleep(0.3)
    n1 = E("return d.ents.filter(x=>x.t==='line').length + ':' + d.ents.filter(x=>x.t==='circle'||x.t==='arc').length")
    chk("düz yüz → dış döngü (4 çizgi, delik yok)", n1.startswith("4:0"), n1)
    E("d.ents=[]; e.opts.convInner=true; e.convertFace(%d); return 0" % top["i"]); time.sleep(0.3)
    n2 = E("return d.ents.filter(x=>x.t==='line').length + ':' + d.ents.filter(x=>x.t==='circle'||x.t==='arc').length")
    chk("iç döngüleri de al → delik de geldi", n2.startswith("4:") and not n2.endswith(":0"), n2)
    cyl = [f for f in fcs if f["ax"] and f["r"] and abs(f["r"]-10)<1e-3][0]
    E("d.ents=[]; e.convertFace(%d); return 0" % cyl["i"]); time.sleep(0.3)
    sil = E("return d.ents.filter(x=>x.t==='line').map(l=>[d.pts[l.p1].x,d.pts[l.p1].y,d.pts[l.p2].x,d.pts[l.p2].y].map(v=>+v.toFixed(2)))")
    chk("silindir silüeti: 2 paralel çizgi, aralık 20 (Ø20)", len(sil)==2 and abs(abs(sil[0][0]-sil[1][0])-20)<0.05, sil)
    # delme: nokta + kutunun düşey kenarı (y 0..20) üst düzlemi köşede keser
    E("d.ents=[]; d.pts.q={x:5,y:5}; d.ents.push({id:'Q',t:'point',p:'q'}); e.setTool('pierce'); e.sel=new Set(['q']); return 0")
    ed2 = ev("(()=>{const m=window.__app.viewer.mesh; const i=m.edges.findIndex(e=>e.d&&Math.abs(Math.abs(e.d[1])-1)<1e-6&&Math.abs(e.m[0]-40)<1e-6&&Math.abs(e.m[2]-30)<1e-6); return {i, m:m.edges[i].m}})()")
    ev("window.__app.viewer.viewStd('iso')"); time.sleep(0.3)
    sp = ev(f"window.__app.viewer.toScreen({ed2['m']})")
    pg.mouse.click(r["x"]+sp[0], r["y"]+sp[1]); time.sleep(0.4)
    q = E("return [d.pts.q.x, d.pts.q.y, d.rels.some(x=>x.t==='fix'&&x.refs[0]==='q')]")
    chk("delme: nokta kenarın düzlemi kestiği köşeye sabitlendi", abs(abs(q[0])-40)<1e-4 and abs(abs(q[1])-30)<1e-4 and q[2], q)
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

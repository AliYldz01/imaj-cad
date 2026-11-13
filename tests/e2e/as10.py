# Montaj raporu kalanları: bileşen yapılandırmaları, yol / kam / yuva eşleşmeleri, fiziksel dinamik, animasyon kaydı
import cmdpatch, time, json, math
from h import *
ok=[]
def chk(n,c,i=""): ok.append(c); print(("TAMAM " if c else "HATA  ")+n, i)
plate = [sketch("s1","S",TOP,lambda pt,line,rect,c,t: rect(-50,-50,50,50)), ext("e1","s1",10)]
disk = [sketch("s2","S",TOP,lambda pt,line,rect,c,t: c(0,0,40)), ext("e2","s2",10)]
pin = [sketch("s3","S",TOP,lambda pt,line,rect,c,t: c(0,0,5)), ext("e3","s3",30)]
cube = [sketch("s4","S",TOP,lambda pt,line,rect,c,t: rect(-10,-10,10,10)), ext("e4","s4",20)]
CUT = dict(cut=True, end="through", dir2=True, end2="through")
slotp = plate + [sketch("s5","R",TOP,lambda pt,line,rect,c,t: rect(-30,-5,30,5)), ext("e5","s5",10,**CUT),
                 sketch("s6","C",TOP,lambda pt,line,rect,c,t: (c(-30,0,5), c(30,0,5))), ext("e6","s6",10,**CUT)]
bar = {"name":"Çubuk","features":[sketch("s7","S",TOP,lambda pt,line,rect,c,t: rect(-5,-5,5,5)), ext("e7","s7",20)],
       "vars":{"L":"20"},"eqs":{"e7.d1":"L"},"configs":[{"name":"Kısa","vars":{},"off":[]},{"name":"Uzun","vars":{"L":"60"},"off":[]}],"config":"Kısa"}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e))); pg.on("dialog", lambda d: d.accept())
    pg.goto(URL); wait_ready(pg); time.sleep(0.4)
    ev = pg.evaluate
    asm = lambda js: ev(f"(async()=>{{const a=window.__app.asm; const T=window.__app.THREE; {js}}})()")
    pg.click("#tabs button[data-tab='asm']"); time.sleep(0.6)
    if not asm("return a.on"): pg.click("#cmds button:has-text('Montajı Aç')"); time.sleep(0.6)
    def reset(parts):
        asm("if (a.doc.comps.length) a.removeComps(a.doc.comps.map(c=>c.id)); a.doc.mates=[]; return 0")
        for prt in parts: asm(f"await a.addComp({json.dumps(prt)}); return 0"); time.sleep(1.0); wait_ready(pg)
        time.sleep(0.5); wait_ready(pg)
    hgt = lambda i: asm(f"const m=a.meshes.get(a.doc.comps[{i}].id); return +(m.bbox.max[1]-m.bbox.min[1]).toFixed(3)")
    # 1) yapılandırmalar
    reset([bar, bar])
    chk("varsayılan yapılandırma (Kısa) 20 mm", hgt(0)==20 and hgt(1)==20, (hgt(0), hgt(1)))
    asm("await a.setCompConfig([a.doc.comps[1].id], 'Uzun'); return 0"); time.sleep(1); wait_ready(pg)
    chk("2. bileşen Uzun → 60 mm, 1. değişmez", hgt(1)==60 and hgt(0)==20, (hgt(0), hgt(1)))
    tree = pg.inner_text("#tree")
    chk("ağaçta yapılandırma adı", "(Uzun)" in tree and "(Kısa)" in tree, tree[:200])
    asm("a.sel=a.doc.comps[0].id; a.selSet=new Set([a.sel]); a.renderTree(); return 0")
    chk("bileşen menüsünde yapılandırma seçimi", "Yapılandırma: Uzun" in pg.inner_text("#tree-panel") or asm("return a.actions().some(x=>x.t==='Yapılandırma: Uzun')"))
    chk("malzeme listesinde ayrı satırlar", asm("return a.bomRows().length")==2, asm("return a.bomRows()"))
    # 2) yol eşleşmesi: küp köşesi diskin üst çemberi üzerinde
    reset([{"name":"Disk","features":disk}, {"name":"Küp","features":cube}])
    asm("a.doc.comps[1].p=[100,30,0]; a.doc.comps[1].fixed=false; a.save(); a.draw(); return 0")
    circ = {"comp":"__B","kind":"circle","c":[0,10,0],"n":[0,1,0],"r":40}
    vtx = {"comp":"__A","kind":"point","c":[10,0,10],"n":[0,0,1]}
    def mate(typ, A, B, extra=""):
        js = f"""const A={json.dumps(A)}, B={json.dumps(B)}; A.comp=a.doc.comps[1].id; B.comp=a.doc.comps[0].id;
          const ch=a.chainOf(B); if(!ch) return 'zincir yok';
          const m={{id:'m'+Math.random(), type:'{typ}', a:A, b:B, poly:ch.pts, closed:ch.closed||undefined, pn:ch.n||undefined, seg:ch.seg||undefined {extra}}};
          const ok=a.addMate(m); a.draw(); return ok?1:0"""
        return asm(js)
    chk("yol eşleşmesi eklendi", mate("path", vtx, circ)==1)
    w = asm("const c=a.doc.comps[1]; const p=new T.Vector3(10,0,10).applyQuaternion(new T.Quaternion(...c.q)).add(new T.Vector3(...c.p)); return [p.x,p.y,p.z]")
    chk("köşe çemberin üzerinde (r=40, y=10)", abs(math.hypot(w[0],w[2])-40)<0.05 and abs(w[1]-10)<0.05, w)
    asm("const m=a.doc.mates[0]; a.doc.mates=[]; await a.refresh(); return 0")
    chk("yol yüzde 25: zincirde konum", mate("path", vtx, circ, ", v:25")==1)
    w2 = asm("const c=a.doc.comps[1]; const p=new T.Vector3(10,0,10).applyQuaternion(new T.Quaternion(...c.q)).add(new T.Vector3(...c.p)); return [p.x,p.y,p.z]")
    chk("yüzde konumunda da çember üzerinde", abs(math.hypot(w2[0],w2[2])-40)<0.1, w2)
    # 3) kam: pim (r=5) disk profiline teğet → eksen merkezden 45 mm
    reset([{"name":"Disk","features":disk}, {"name":"Pim","features":pin}])
    asm("a.doc.comps[1].p=[90,0,10]; a.doc.comps[1].fixed=false; a.save(); a.draw(); return 0")
    cyl = {"comp":"__A","kind":"cyl","c":[0,0,0],"n":[0,1,0],"r":5}
    chk("kam eşleşmesi eklendi", mate("cam", cyl, circ)==1)
    w = asm("const c=a.doc.comps[1]; const p=new T.Vector3(0,0,0).applyQuaternion(new T.Quaternion(...c.q)).add(new T.Vector3(...c.p)); const n=new T.Vector3(0,1,0).applyQuaternion(new T.Quaternion(...c.q)); return [p.x,p.y,p.z,n.y]")
    chk("pim ekseni disk merkezinden 45 mm, eksen paralel", abs(math.hypot(w[0],w[2])-45)<0.1 and abs(abs(w[3])-1)<1e-3, w)
    # 4) yuva: pim yuvanın orta çizgisinde; %50 → orta, %0 → uç
    reset([{"name":"Yuvalı","features":slotp}, {"name":"Pim","features":pin}])
    asm("a.doc.comps[1].p=[12,-5,9]; a.doc.comps[1].fixed=false; a.save(); a.draw(); return 0")
    arc = {"comp":"__B","kind":"circle","c":[30,10,0],"n":[0,1,0],"r":5}
    ch = asm(f"const B={json.dumps(arc)}; B.comp=a.doc.comps[0].id; const c=a.chainOf(B); return c&&{{closed:c.closed, seg:c.seg, n:c.pts.length}}")
    chk("yuva zinciri kapalı, orta çizgi ±30", ch and ch["closed"] and ch["seg"] and sorted([round(s[0]) for s in ch["seg"]])==[-30,30], ch)
    chk("yuva eşleşmesi eklendi", mate("slot", cyl, arc)==1)
    w = asm("const c=a.doc.comps[1]; return [c.p[0], c.p[2]]")
    chk("serbest: pim orta çizgide (z=0), x arada", abs(w[1])<0.05 and -30.05<=w[0]<=30.05, w)
    asm("a.doc.mates[0].v=50; a.solve(); a.draw(); return 0")
    chk("%50 → yuvanın ortası", abs(asm("return a.doc.comps[1].p[0]"))<0.05)
    asm("a.doc.mates[0].v=0; a.solve(); a.draw(); return 0")
    x0 = asm("return a.doc.comps[1].p[0]")
    chk("%0 → yuvanın bir ucu (±30)", abs(abs(x0)-30)<0.05, x0)
    # panelde yeni türler
    asm("a.startMate(); return 0"); time.sleep(0.2)
    pg.click("#pm-body button:has-text('Mekanik')"); time.sleep(0.2)
    names = pg.inner_text("#pm-body")
    chk("mekanik sekmesinde Kam ve Yuva", "Kam" in names and "Yuva" in names)
    pg.click("#pm-body button:has-text('Gelişmiş')"); time.sleep(0.2)
    chk("gelişmiş sekmesinde Yol", "Yol" in pg.inner_text("#pm-body"))
    pg.click("#pm-cancel"); time.sleep(0.2)
    # 5) fiziksel dinamik: küp diğer küpü iter, sabit bileşende durur
    reset([{"name":"Taban","features":plate}, {"name":"A","features":cube}, {"name":"B","features":cube}])
    asm("const c=a.doc.comps; c[1].p=[0,10,0]; c[2].p=[25,10,0]; c[1].fixed=c[2].fixed=false; a.save(); a.draw(); return 0")
    r = asm("const b=a.poses(); a.doc.comps[1].p=[10,10,0]; const ok=a.pushApart(b); return [ok, a.doc.comps[2].p[0]]")
    chk("A sağa 10 mm → B 10 mm itildi", r[0] and abs(r[1]-35)<1e-6, r)
    r = asm("const b=a.poses(); a.doc.comps[1].p=[10,-5,0]; const ok=a.pushApart(b); return [ok, a.doc.comps[1].p[1]]")
    chk("sabit tabana doğru → hareket geri alınır", (not r[0]) and abs(r[1]-10)<1e-6, r)
    chk("Fiziksel Dinamik komutu", pg.locator("#cmds button:has-text('Fiziksel Dinamik')").count()==1)
    # 6) animasyon kaydı
    started = asm("return a.startRec()")
    asm("a.doc.comps[1].p=[0,10,30]; a.draw(); return 0"); time.sleep(1.2)
    asm("a.stopRec(false); return 0"); time.sleep(0.8)
    sz = asm("return a.__lastRec ? a.__lastRec.size : -1")
    chk("hareket videosu kaydı (WebM)", started and sz > 0, (started, sz))
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

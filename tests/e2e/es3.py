# Eskiz ekleri 3: blok düzenleme (tüm örnekler), bloğu dağıt, eğri üzerinde metin, spline tutamakları
import cmdpatch, time, json, math
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
    # 1) eğri üzerinde metin (yay yapı geometrisi, 3 harf)
    sk = {"id":"s1","type":"sketch","name":"S","plane":FRONT,"data":{"pts":{"c":{"x":0,"y":0},"a":{"x":40,"y":0},"b":{"x":-40,"y":0},"t":{"x":28.284,"y":28.284}},
          "ents":[{"id":"a1","t":"arc","c":"c","s":"a","e":"b","r":40,"cons":True},{"id":"x1","t":"text","p":"t","text":"ABC","size":8,"angle":0,"on":"a1"}],"rels":[],"dims":[],"seq":9}}
    m = run(pg, "eğri metin", [sk, ext("e1","s1",3)])
    bb = m and m["bb"]
    # harfler yayın 40 mm yarıçapında dışında: tüm noktalar 38..52 mm yarıçap bandında olmalı → bbox x ve y >0 bölgesinde, 45° civarı
    chk("eğri üzerinde metin: 3 harf gövdesi, yay boyunca", m and m["bodies"]==3 and bb[0][1] > 20 and bb[1][1] < 45 and bb[0][0] > 8 and bb[1][0] < 32, m)
    # düz metinle karşılaştır: aynı metin eğrisiz → bbox y aralığı ≤ 8+
    sk2 = json.loads(json.dumps(sk)); del sk2["data"]["ents"][1]["on"]
    m2 = run(pg, "düz metin", [sk2, ext("e1","s1",3)])
    chk("düz metin: yükseklik ~8, noktadan +x yönünde (x ≈ 28)", m2 and (m2["bb"][1][1]-m2["bb"][0][1]) < 10 and abs(m2["bb"][0][0]-28.3) < 1.5, m2)
    # 2) blok düzenleme: eskizde kare → blok, iki örnek; birini düzenle → diğeri de değişir
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    pg.click("#tree li:has-text('Ön Düzlem')"); pg.click("#tree-actions button:has-text('Eskiz')"); time.sleep(0.5)
    E("""const m=window.__app; const P=(x,y)=>{const id='q'+Object.keys(d.pts).length+'_'+Math.round(x)+'_'+Math.round(y); d.pts[id]={x,y}; return id};
      const a=P(0,0),b=P(10,0),c=P(10,10),f=P(0,10); let n=0; for (const [u,v] of [[a,b],[b,c],[c,f],[f,a]]) d.ents.push({id:'L'+(n++),t:'line',p1:u,p2:v});
      e.setTool('select'); e.sel.clear(); for (const x of d.ents) e.sel.add(x.id); e.saveBlock('Kare'); e.sel.clear(); e.insertBlock('Kare',[50,0]); e.resolve(); return 0""")
    inst = E("return [...e.blockInstances('Kare').entries()].map(([k,v])=>[k,v.length])")
    chk("blok: 2 örnek × 4 öğe", len(inst)==2 and all(v==4 for k,v in inst), inst)
    t0 = inst[0][0]
    E(f"e.sel.clear(); e.sel.add(d.ents.find(x=>x.blk==='{t0}').id); e.renderPanel(); return 0"); time.sleep(0.2)
    chk("panelde Bloğu düzenle / dağıt", pg.is_visible("#pm button:has-text('Bloğu düzenle')") and pg.is_visible("#pm button:has-text('Bloğu dağıt')"))
    pg.click("#pm button:has-text('Bloğu düzenle')"); time.sleep(0.2)
    chk("blok düzenleme şeridi", pg.is_visible("#pm button:has-text('Bloğu güncelle')"))
    # örneğe köşegen ekle (düzenlerken çizilen öğe bloğa katılır)
    E(f"const ls=d.ents.filter(x=>x.blk==='{t0}'); d.ents.push({{id:'Ldg',t:'line',p1:ls[0].p1,p2:ls[1].p2}}); e.render(); return 0")
    pg.click("#pm button:has-text('Bloğu güncelle')"); time.sleep(0.3)
    inst2 = E("return [...e.blockInstances('Kare').entries()].map(([k,v])=>[k,v.length])")
    chk("güncelle: her iki örnek 5 öğe", len(inst2)==2 and all(v==5 for k,v in inst2), inst2)
    cen = E(f"const o=[...e.blockInstances('Kare').entries()].find(([k])=>k!=='{t0}')[1]; const ps=new Set(o.flatMap(x=>[x.p1,x.p2])); let sx=0,sy=0; for (const id of ps){{sx+=d.pts[id].x; sy+=d.pts[id].y}} return [sx/ps.size, sy/ps.size]")
    chk("diğer örnek yerinde kaldı (merkez ≈ 50,0)", abs(cen[0]-50)<0.01 and abs(cen[1])<0.01, cen)
    lib = ev("JSON.parse(localStorage.getItem('imajcad.blocks')).Kare.ents.length")
    chk("tanım güncellendi (5 öğe)", lib==5, lib)
    E(f"e.sel.clear(); e.sel.add(d.ents.find(x=>x.blk && x.blk!=='{t0}').id); e.renderPanel(); return 0")
    pg.click("#pm button:has-text('Bloğu dağıt')"); time.sleep(0.2)
    chk("bloğu dağıt: 1 örnek kaldı", len(E("return [...e.blockInstances('Kare').keys()]"))==1)
    # 3) spline tutamakları
    E("d.ents=[]; d.rels=[]; d.dims=[]; for (const k of Object.keys(d.pts)) delete d.pts[k]; d.pts.s1={x:0,y:0}; d.pts.s2={x:30,y:20}; d.pts.s3={x:60,y:0}; d.ents.push({id:'sp',t:'spline',pts:['s1','s2','s3']}); e.resolve(); e.setTool('select'); e.sel.clear(); e.sel.add('sp'); e.render(); e.renderPanel(); return 0")
    pg.mouse.move(700,400); pg.keyboard.press("f"); time.sleep(0.6)
    hs = E("return e.splineHandles(d.ents[0]).map(h=>[h.b[0],h.b[1]])")
    chk("3 tutamak", len(hs)==3, hs)
    r = pg.query_selector("#view").bounding_box()
    def sc(x,y):
        s = ev(f"(()=>{{const e={ed}; const f=e.frame; const yv=[f.n[1]*f.x[2]-f.n[2]*f.x[1], f.n[2]*f.x[0]-f.n[0]*f.x[2], f.n[0]*f.x[1]-f.n[1]*f.x[0]]; const w=[f.o[0]+f.x[0]*{x}+yv[0]*{y}, f.o[1]+f.x[1]*{x}+yv[1]*{y}, f.o[2]+f.x[2]*{x}+yv[2]*{y}]; return window.__app.viewer.toScreen(w);}})()")
        return r["x"]+s[0], r["y"]+s[1]
    before = E("return e.entPolyline(d.ents[0])[8]")
    # başlangıç tutamağının ucunu yukarı sürükle
    x0,y0 = sc(*hs[0]); x1,y1 = sc(0,25)
    pg.mouse.move(x0,y0); pg.mouse.down(); pg.mouse.move(x0+5,y0-5, steps=3); pg.mouse.move(x1,y1, steps=8); pg.mouse.up(); time.sleep(0.3)
    h0 = E("return d.ents[0].h && d.ents[0].h[0]")
    chk("tutamak sürükleme → başlangıç teğeti dik yukarı", h0 and abs(h0[0])<1.5 and h0[1]>15, h0)
    after = E("return e.entPolyline(d.ents[0])[8]")
    chk("eğri değişti", abs(after[1]-before[1])>0.5, [before, after])
    E("e.setSplineHandle('sp', 2, [0,-10]); return 0")
    h2 = E("return d.ents[0].h[2]")
    chk("bitiş tutamağı programla (0,-10)", h2==[0,-10], h2)
    chk("panelde açı / ağırlık alanları + sıfırla", pg.is_visible("#pm :text('Başlangıç teğet açısı')") and pg.is_visible("#pm button:has-text('Tutamakları sıfırla')"))
    pg.click("#pm button:has-text('Tutamakları sıfırla')"); time.sleep(0.2)
    chk("sıfırla", E("return !d.ents[0].h"))
    # eşit eğrilik: spline sonu (60,0) ↔ merkez (60,20) R20 yay
    E("d.pts.c9={x:60,y:20}; d.pts.e9={x:80,y:20}; d.ents.push({id:'ar',t:'arc',c:'c9',s:'e9',e:'s3',r:20}); e.sel.clear(); e.sel.add('sp'); e.sel.add('ar'); e.render(); e.renderPanel(); return 0")
    chk("eşit eğrilik düğmesi", pg.is_visible("#pm button:has-text('Eşit eğrilik')"))
    pg.click("#pm button:has-text('Eşit eğrilik')"); time.sleep(0.2)
    kap = E("""const sp=d.ents.find(x=>x.id==='sp'); const pl=e.entPolyline(sp); const n=pl.length; const [a,b,c]=[pl[n-3],pl[n-2],pl[n-1]];
      const A=Math.hypot(b[0]-a[0],b[1]-a[1]),B=Math.hypot(c[0]-b[0],c[1]-b[1]),C=Math.hypot(c[0]-a[0],c[1]-a[1]); const cr=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]));
      const h=sp.h[2]; return [4*cr/2/(A*B*C), h]""")
    chk("uçta eğrilik ≈ 1/20, teğet yatay", abs(kap[0]-0.05) < 0.01 and abs(kap[1][1]) < 1e-6, kap)
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

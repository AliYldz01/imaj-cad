# Kaynaklı 1: kesim listesi özellikleri, yapı sistemi (nokta-uzunluk + ikincil), 3B eskiz spline / helis / kesişim + birleşik eğri süpürme, özellikler arası gönye
import cmdpatch, time, math, json
from h import *
P = {"a":[0,0,0],"b":[600,0,0],"c":[600,0,400],"d":[0,0,400]}
def s3(lines, **kw):
    ids=list(P); d={"id":"k","type":"sketch3d","name":"K","ids":ids,"xyz":[P[i] for i in ids],"lines":[{"id":f"l{n}","a":a,"b":b} for n,(a,b) in enumerate(lines)],"r":0,"seq":40}; d.update(kw); return d
G = lambda idx: [{"sk":"k","ent":f"l{n}"} for n in idx]
def mem(id, segs, **kw):
    m={"id":id,"type":"member","name":id,"segs":G(segs),"std":"kutu","size":"40x40x3","align":"c","mirror":False,"rot":0,"corner":"miter","gap":0,"ori":2}; m.update(kw); return m
LINES=[("a","b"),("b","c"),("c","d"),("d","a")]
ok=[]
def chk(n,c,i=""): ok.append(bool(c)); print(("TAMAM " if c else "HATA  ")+n, i)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]; pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.on("dialog", lambda d: d.accept())
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    ev = pg.evaluate
    err = lambda: pg.eval_on_selector_all("#tree li.err", "els=>els.map(e=>e.title||e.textContent)")
    def build(feats):
        ev("d=>window.__app.setDoc(d)", {"version":2,"name":"T","features":feats,"seq":{}}); time.sleep(0.3); wait_ready(pg)
        return ev("""async()=>{const k=window.__app.kernel; const it=await k.interfere(); const cl=await k.cutListFull();
          return {interf:it.map(p=>+p.vol.toFixed(1)), cut:cl.items.filter(i=>i.kind==='member').map(i=>[Math.round(i.length), +i.a1.toFixed(1), +i.a2.toFixed(1)])}}""")
    # 5.4 özellikler arası gönye
    r0 = build([s3(LINES), mem("m1",[0]), mem("m2",[3])])
    r1 = build([s3(LINES), mem("m1",[0]), mem("m2",[3], prevMiter=True)])
    chk("özellikler arası gönye: hatasız, girişim yok", not err() and all(v<=1 for v in r1["interf"]), [err(), r1["interf"]])
    a = sorted(max(x[1],x[2]) for x in r1["cut"])
    chk("gönyede iki elemanın da ucu 45°", a == [45.0, 45.0], r1["cut"])
    chk("gönyesiz (alın) önceki uzatılır, açı 0", all(max(x[1],x[2])==0 for x in r0["cut"]), r0["cut"])
    # 5.2 yapı sistemi
    r2 = build([s3(LINES), mem("m1",[0,2], ptl=[{"p":[0,0,0],"d":[0,-1,0],"L":500}], sec=[{"a":{"sk":"k","ent":"l0"},"ta":0.5,"b":{"sk":"k","ent":"l2"},"tb":0.5}])])
    Ls = sorted(x[0] for x in r2["cut"])
    chk("yapı sistemi: nokta-uzunluk 500 + ikincil eleman (400 − iki yarım profil)", not err() and any(abs(x-500)<=21 for x in Ls) and any(340<=x<=400 for x in Ls), [Ls, err()])
    chk("yapı sistemi: girişim yok", all(v<=1 for v in r2["interf"]), r2["interf"])
    # 5.1 kesim listesi özellikleri
    build([s3(LINES), mem("m1",[0,1,2,3])])
    pg.click("#tabs button:has-text('Kaynaklı')"); time.sleep(0.3)
    ev("document.querySelector(\"#cmds button[title='Kesim Listesi']\").click()"); time.sleep(1.5)
    pg.click("dialog.cut-dialog tr:nth-child(2) button:has-text('Özellikler')"); time.sleep(0.3)
    pg.fill("dialog.cutprops label:has-text('TANIM') input", "Çerçeve uzun kenar")
    pg.select_option("dialog.cutprops select", "aluminum") if pg.locator("dialog.cutprops select option[value='aluminum']").count() else None
    pg.click("dialog.cutprops button:has-text('Özellik ekle')"); time.sleep(0.2)
    ins = pg.locator("dialog.cutprops .cp-list input")
    ins.nth(0).fill("Parça No"); ins.nth(1).fill("A1")
    pg.click("dialog.cutprops button:has-text('Tamam')"); time.sleep(1.5)
    cp = ev("JSON.stringify(window.__app.doc.cutProps||{})")
    chk("kesim listesi özellikleri kaydedildi", "Çerçeve uzun kenar" in cp and "Parça No" in cp, cp)
    tx = pg.inner_text("dialog.cut-dialog")
    chk("tabloda yeni tanım + özel özellik + malzeme sütunu", "Çerçeve uzun kenar" in tx and "Parça No: A1" in tx and "Malzeme" in tx, tx[:200])
    pg.keyboard.press("Escape"); time.sleep(0.3)
    # 5.3 3B eskiz: spline / helis / kesişim, birleşik eğri yolu ile süpürme
    sp = {"id":"k2","type":"sketch3d","name":"Y","ids":["p1","p2","p3","p4"],"xyz":[[0,0,0],[50,20,0],[100,0,30],[150,10,60]],"lines":[],"r":0,"seq":10,"spl3":[{"id":"s1","pts":["p1","p2","p3","p4"]}]}
    build([sp, {"id":"w1","type":"sweep","name":"S","sketch":"","path":"k2","cut":False,"circ":10}])
    v = ev("window.__app.kernel.props().then(p=>p.volume)")
    chk("3B spline yolu boyunca boru", not err() and v > math.pi*25*150, [v, err()])
    hel = {"id":"k3","type":"sketch3d","name":"H","ids":[],"xyz":[],"lines":[],"r":0,"seq":10,"hel3":[{"id":"h1","c":[0,0,0],"ax":[0,1,0],"r":20,"pitch":15,"turns":2}]}
    build([hel, {"id":"w1","type":"sweep","name":"S","sketch":"","path":"k3","cut":False,"circ":4}])
    v = ev("window.__app.kernel.props().then(p=>p.volume)")
    Lh = 2*math.hypot(2*math.pi*20, 15)
    chk("3B helis yolu: hacim ≈ π·2²·L", not err() and abs(v - math.pi*4*Lh) < 0.03*math.pi*4*Lh, [v, math.pi*4*Lh, err()])
    comp = {"id":"k4","type":"sketch3d","name":"C","ids":["p1","p2","p3","p4","p5"],"xyz":[[0,0,0],[100,0,0],[150,50,0],[200,100,0],[200,100,80]],"lines":[{"id":"l1","a":"p1","b":"p2"},{"id":"l2","a":"p4","b":"p5"}],"r":0,"seq":10,"spl3":[{"id":"s1","pts":["p2","p3","p4"]}]}
    build([comp, {"id":"w1","type":"sweep","name":"S","sketch":"","path":"k4","cut":False,"circ":8}])
    chk("birleşik eğri (çizgi + spline + çizgi) süpürme", not err() and ev("window.__app.kernel.props().then(p=>p.volume)") > math.pi*16*250, err())
    comp2 = dict(comp); comp2["lines"] = [{"id":"l1","a":"p1","b":"p2"},{"id":"l2","a":"p4","b":"p5"}]; comp2["spl3"] = []
    build([comp2, {"id":"w1","type":"sweep","name":"S","sketch":"","path":"k4","cut":False,"circ":8}])
    chk("bağlı olmayan eğriler → hata", any("bağlı değil" in x for x in err()), err())
    box = [sketch("s1","S",FRONT,lambda pt,line,rect,c,t: rect(0,0,40,40)), ext("e1","s1",40), sketch("s2","C",TOP,lambda pt,line,rect,c,t: c(20,-20,10)), ext("e2","s2",60)]
    build(box)
    cs = ev("""(async()=>{const m=window.__app.viewer.mesh; const top=m.faces.find(f=>f.n&&f.n[1]>0.99&&Math.abs(f.c[1]-40)<1e-6); const cyl=m.faces.find(f=>f.type==='CYLINDRE'); return window.__app.kernel.isect({c:top.c,n:top.n},{c:cyl.c,n:cyl.n,r:cyl.r})})()""")
    rr = [math.hypot(q[0]-20, q[2]-20) for c in cs for q in c] if cs else []
    chk("kesişim eğrisi: üst yüz ∩ silindir = R10 çember", cs and all(abs(x-10)<0.05 for x in rr), [len(cs) if cs else 0, rr[:3]])
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

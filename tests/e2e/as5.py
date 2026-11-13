# Montaj: ön seçim vurgusu (yüz turuncu + sınır, kenar, köşe), parça modu yüz vurgusu (eskiz düzlemi seçerken),
# serbest döndürülmüş blok → gerçek tıklamalarla 3 çakışık (alt, yan, ön) + mesafe tarafı korunur
import cmdpatch, time, json
from h import *
ok=[]
def chk(n,c,info=""): ok.append(bool(c)); print(("✓ " if c else "✗ ")+n, info)
blk = [sketch("s1","S",TOP,lambda pt,line,rect,c,t: rect(-100,-100,100,100)), ext("e1","s1",200)]
plate = [sketch("s1","S",TOP,lambda pt,line,rect,c,t: rect(-600,-600,600,600)), ext("e1","s1",100)]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e))); pg.on("dialog", lambda d: d.accept())
    pg.goto(URL); wait_ready(pg); time.sleep(0.4)
    # parça modu: eskiz düzlemi seçerken yüz vurgusu
    run(pg, "box", [sketch("s1","S",TOP,lambda pt,line,rect,c,t: rect(-50,-30,50,30)), ext("e1","s1",20)])
    pg.evaluate("window.__app.viewer.viewStd('iso')"); time.sleep(0.3)
    R = pg.query_selector("#view").bounding_box()
    s = pg.evaluate("window.__app.viewer.toScreen([10,20,5])")
    pg.click("#cmds button[title='Eskiz']"); time.sleep(0.3)
    pg.mouse.move(R['x']+50, R['y']+50); pg.mouse.move(R['x']+s[0], R['y']+s[1], steps=3); time.sleep(0.3)
    chk("eskiz düzlemi seçerken yüz vurgusu (yüz + sınır)", pg.evaluate("window.__app.viewer.hl.children.length")>=2 and pg.evaluate("window.__app.mode.k")=="pickSketchPlane")
    pg.screenshot(path="/home/claude/as5_parthover.png", clip={"x":R['x']+s[0]-220,"y":R['y']+s[1]-150,"width":440,"height":300})
    pg.keyboard.press("Escape")
    # montaj
    pg.evaluate("localStorage.removeItem('imajcad.asm')")
    A = lambda js: pg.evaluate(f"(()=>{{const a=window.__app.asm; {js}}})()")
    pg.click("#tabs button[data-tab='asm']"); pg.click("#cmds button:has-text('Montajı Aç')"); time.sleep(0.5)
    A("a.doc={kind:'asm',name:'T',comps:[],mates:[]}; return 0")
    for nm,f in (("Plaka",plate),("Blok",blk)):
        A(f"a.addComp({{name:'{nm}', features:{json.dumps(f)}}})"); time.sleep(1.5); wait_ready(pg)
    # bloğu serbestçe döndür (Bileşeni Döndür ile sürükle)
    A("a.doc.comps[1].p=[900,600,300]; a.draw(); a.sel=a.doc.comps[1].id; return 0")
    pg.keyboard.press("f"); time.sleep(0.3)
    pg.click("#cmds button:has-text('Bileşeni Döndür')"); time.sleep(0.3)
    c = pg.evaluate("window.__app.viewer.toScreen([900,700,300])")
    pg.mouse.move(R['x']+c[0], R['y']+c[1]); pg.mouse.down(); pg.mouse.move(R['x']+c[0]+60, R['y']+c[1]+35, steps=8); pg.mouse.up(); time.sleep(0.3)
    pg.click("#pm-ok"); time.sleep(0.2)
    q = A("return a.doc.comps[1].q.map(v=>+v.toFixed(3))")
    chk("blok serbestçe döndürüldü", abs(q[3])<0.99, q)
    pg.keyboard.press("f"); time.sleep(0.3)
    # vurgu: plaka üst yüzü üzerinde
    def find(comp, pred):
        return A(f"""const r=document.querySelector('#view').getBoundingClientRect(); for(let i=2;i<68;i++)for(let j=2;j<48;j++){{const x=r.left+i*r.width/70,y=r.top+j*r.height/50; const p=a.pick(x,y); if(p&&p.comp===a.doc.comps[{comp}].id&&p.ent&&({pred})(p.ent,a.doc.comps[{comp}])) return [x,y];}} return null""")
    top = find(0, "(e)=>e.kind==='plane'&&e.n[1]>0.9")
    pg.mouse.move(top[0]-5, top[1]-5); pg.mouse.move(*top); time.sleep(0.35)
    chk("montajda yüz üzerinde turuncu vurgu", A("return !!a.hovObj && a.hovObj.children.length>=2"))
    pg.screenshot(path="/home/claude/as5_hover.png")
    # kenar vurgusu
    sc = pg.evaluate("window.__app.viewer.toScreen([0,100,600])")
    pg.mouse.move(R['x']+sc[0], R['y']+sc[1]); time.sleep(0.35)
    chk("kenar üzerinde vurgu", A("return !!a.hovObj && a.hovKey.includes('line')"), A("return a.hovKey.slice(0,40)"))
    # 3 çakışık: blok alt ↔ plaka üst, blok yan ↔ plaka yan, blok ön ↔ plaka ön — gerçek tıklamayla
    def mate_click(p1, p2):
        # v0.57: eşleşme paneli ✓ sonrası açık kalır (SolidWorks); kapalıysa aç
        if pg.evaluate("document.querySelector('#pm').hidden"): pg.click("#cmds button:has-text('Eşleşme')"); time.sleep(0.3)
        pg.mouse.click(*p1); time.sleep(0.2); pg.mouse.click(*p2); time.sleep(0.4)
        st = pg.inner_text("#mate-status"); pg.click("#pm-ok"); time.sleep(0.4)
        return st
    # blok için: dünya normali en çok -Y olan yüzü bul (alt); yan: +X'e en yakın; ön: +Z'ye en yakın
    W = lambda comp, ax, sg: f"(e,c)=>{{if(e.kind!=='plane')return false; const T=window.__app.THREE; return true}}"
    def face_dir(comp, axis, sign):
        return A(f"""const r=document.querySelector('#view').getBoundingClientRect(); let best=null,bd=-2; const c=a.doc.comps[{comp}];
          for(let i=2;i<68;i++)for(let j=2;j<48;j++){{const x=r.left+i*r.width/70,y=r.top+j*r.height/50; const p=a.pick(x,y); if(!p||p.comp!==c.id||!p.ent||p.ent.kind!=='plane') continue;
            const n=p.ent.n, q=c.q; const ix=q[3]*n[0]+q[1]*n[2]-q[2]*n[1], iy=q[3]*n[1]+q[2]*n[0]-q[0]*n[2], iz=q[3]*n[2]+q[0]*n[1]-q[1]*n[0], iw=-q[0]*n[0]-q[1]*n[1]-q[2]*n[2];
            const w=[ix*q[3]+iw*-q[0]+iy*-q[2]-iz*-q[1], iy*q[3]+iw*-q[1]+iz*-q[0]-ix*-q[2], iz*q[3]+iw*-q[2]+ix*-q[1]-iy*-q[0]];
            const d=w[{axis}]*{sign}; if(d>bd){{bd=d;best=[x,y]}} }} return best""")
    st1 = mate_click(top, face_dir(1,1,-1) or face_dir(1,1,1))
    n1 = A("return a.doc.mates.length")
    chk("1. çakışık (döndürülmüş blok alt ↔ plaka üst) kabul", n1==1 and "sağlanamıyor" not in st1, st1)
    pg.keyboard.press("f"); time.sleep(0.3)
    side = find(0, "(e)=>e.kind==='plane'&&e.n[0]>0.9") or find(0, "(e)=>e.kind==='plane'&&e.n[2]>0.9")
    bside = face_dir(1,0,1)
    st2 = mate_click(side, bside)
    chk("2. çakışık (yan yüzler) kabul", A("return a.doc.mates.length")==2 and "sağlanamıyor" not in st2, st2)
    pg.keyboard.press("f"); time.sleep(0.3)
    front = find(0, "(e)=>e.kind==='plane'&&e.n[2]>0.9")
    bfront = face_dir(1,2,1)
    st3 = mate_click(front, bfront)
    chk("3. çakışık (ön yüzler) kabul → tam tanımlı", A("return a.doc.mates.length")==3 and A("return a.bad.size")==0, [st3, A("return a.doc.comps[1].p.map(v=>+v.toFixed(2))")])
    chk("ağaçta blok tam tanımlı", "(-) Blok" not in pg.inner_text("#tree"))
    pg.screenshot(path="/home/claude/as5_mated.png")
    print("hatalar:", logs); print("SONUC:", "TAMAM" if all(ok) and not logs else "HATA")

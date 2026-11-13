# Montaj 11: desen güdümlü bileşen çoğaltma (doğrusal / dairesel çoğaltmayı izler, sürücü değişince güncellenir, sil / dağıt) ve bileşen bastırma
import cmdpatch, time, json, math
from h import *
ok=[]
def chk(n,c,i=""): ok.append(bool(c)); print(("TAMAM " if c else "HATA  ")+n, i)
plate = [sketch("s1","S",TOP,lambda pt,line,rect,c,t: rect(0,0,200,50)), ext("e1","s1",10),
         sketch("s2","H",TOP,lambda pt,line,rect,c,t: c(20,-25,4)), ext("c1","s2",10,cut=True),
         {"id":"p1","type":"lpattern","name":"DelikDizi","feats":["c1"],"axis":"x","rev":False,"count":4,"spacing":40,"dir2":False,"axis2":"z","rev2":False,"count2":1,"spacing2":10}]
disk = [sketch("s1","S",TOP,lambda pt,line,rect,c,t: c(0,0,60)), ext("e1","s1",10),
        sketch("s2","H",TOP,lambda pt,line,rect,c,t: c(40,0,4)), ext("c1","s2",10,cut=True),
        {"id":"p2","type":"cpattern","name":"Dairesel","feats":["c1"],"axis":"y","count":6,"angle":360,"equal":True}]
pin = [sketch("s1","S",TOP,lambda pt,line,rect,c,t: c(0,0,4)), ext("e1","s1",30)]
ARGS=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=ARGS)
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e))); pg.on("dialog", lambda d: d.accept())
    pg.goto(URL); wait_ready(pg); time.sleep(0.4)
    ev = pg.evaluate
    asm = lambda js: ev(f"(async()=>{{const a=window.__app.asm; {js}}})()")
    pg.click("#tabs button[data-tab='asm']"); time.sleep(0.6)
    if not asm("return a.on"): pg.click("#cmds button:has-text('Montajı Aç')"); time.sleep(0.6)
    asm("if (a.doc.comps.length) a.removeComps(a.doc.comps.map(c=>c.id)); return 0")
    for name, feats in (("Plaka", plate), ("Pim", pin), ("Disk", disk), ("Pim2", pin)):
        asm(f"a.addComp({json.dumps({'name':name,'features':feats})}); return 0"); time.sleep(1.2); wait_ready(pg)
    # pim ilk deliğe (20,0,25), disk uzağa, pim2 disk deliğine (240+40,0,0)
    asm("const c=a.doc.comps; c[1].p=[20,0,25]; c[1].fixed=true; c[2].p=[300,0,0]; c[2].fixed=true; c[3].p=[340,0,0]; c[3].fixed=true; a.save(); return 0")
    asm("a.sel=a.doc.comps[1].id; a.selSet=new Set([a.sel]); return 0")
    pg.click("#cmds button:has-text('Desen Güdümlü')"); time.sleep(0.5)
    chk("panel: sürücü seçenekleri (DelikDizi, Dairesel)", "DelikDizi" in pg.inner_text("#pm-body") and "Dairesel" in pg.inner_text("#pm-body"))
    pg.select_option("#pm-body select", label=[o for o in pg.eval_on_selector_all("#pm-body select option","e=>e.map(x=>x.textContent)") if "DelikDizi" in o][0])
    pg.click("#pm-ok"); time.sleep(2); wait_ready(pg)
    ins = asm("return a.doc.comps.filter(c=>c.pat).map(c=>c.p.map(v=>Math.round(v)))")
    chk("doğrusal: 3 örnek x 60 / 100 / 140", sorted(q[0] for q in ins)==[60,100,140] and all(q[2]==25 for q in ins), ins)
    # sürücü parça değişsin: adet 5, aralık 30
    asm("const d=a.doc.comps[0]; const f=d.part.features.find(x=>x.id==='p1'); f.count=5; f.spacing=30; a.solve(); a.save(); return 0")
    ins = asm("return a.doc.comps.filter(c=>c.pat).map(c=>Math.round(c.p[0]))")
    chk("sürücü değişince güncellenir: 4 örnek 50/80/110/140", sorted(ins)==[50,80,110,140], ins)
    # sürücü bileşen taşınırsa örnekler de
    asm("const d=a.doc.comps[0]; d.p=[0,0,100]; a.doc.comps[1].p=[20,0,125]; a.solve(); return 0")
    zs = asm("return a.doc.comps.filter(c=>c.pat).map(c=>Math.round(c.p[2]))")
    chk("sürücü taşınınca örnekler izler (z 125)", all(z==125 for z in zs), zs)
    # dairesel
    asm("a.sel=a.doc.comps[3].id; a.selSet=new Set([a.sel]); return 0")
    pg.click("#cmds button:has-text('Desen Güdümlü')"); time.sleep(0.5)
    pg.select_option("#pm-body select", label=[o for o in pg.eval_on_selector_all("#pm-body select option","e=>e.map(x=>x.textContent)") if "Dairesel" in o][0])
    pg.click("#pm-ok"); time.sleep(2); wait_ready(pg)
    cr = asm("const s=a.doc.pdp[1].id; return a.doc.comps.filter(c=>c.pat&&c.pat.id===s).map(c=>[Math.hypot(c.p[0]-300,c.p[2]).toFixed(2), Math.round(Math.atan2(-c.p[2], c.p[0]-300)*180/Math.PI)])")
    chk("dairesel: 5 örnek, yarıçap 40", len(cr)==5 and all(abs(float(r)-40)<0.01 for r,_ in cr), cr)
    # malzeme listesi
    bom = asm("return a.bomRows ? JSON.stringify(a.bomRows()) : ''")
    chk("BOM'da örnekler sayılır (Pim 5)", '"qty":5' in bom.replace(" ",""), bom[:200])
    # tek örnek silinemez
    n0 = asm("return a.doc.comps.length")
    asm("a.removeComps([a.doc.comps.find(c=>c.pat).id]); return 0")
    chk("tek desen örneği silinmez", asm("return a.doc.comps.length")==n0)
    # bastırma
    pid = asm("return a.doc.comps[3].id")
    asm(f"a.setSuppressed(['{pid}'], true); return 0"); time.sleep(0.5)
    chk("bastırılan bileşen çizilmez", asm(f"return !a.objs.has('{pid}')"))
    bom2 = asm("return JSON.stringify(a.bomRows())")
    chk("bastırılan malzeme listesinde yok (Pim2 eksik)", "Pim2" not in bom2, bom2[:200])
    chk("ağaçta ⊘", "⊘" in pg.inner_text("#tree"))
    asm(f"a.setSuppressed(['{pid}'], false); return 0"); time.sleep(0.5)
    chk("bastırma kaldırılınca çizilir", asm(f"return a.objs.has('{pid}')"))
    # dağıt / sil
    asm("a.removePattern(a.doc.pdp[1].id, true); return 0"); time.sleep(0.5)
    chk("dağıt: örnekler bağımsız (pat yok) kaldı", asm("return a.doc.pdp.length===1 && a.doc.comps.filter(c=>!c.pat).length===4+5"))
    asm("a.removePattern(a.doc.pdp[0].id); return 0"); time.sleep(0.5)
    chk("sil: doğrusal desen örnekleri kalktı", asm("return a.doc.comps.filter(c=>c.pat).length===0 && !a.doc.pdp.length"))
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

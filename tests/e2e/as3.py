# Montaj v2 (SolidWorks mantığı): eşzamanlı çözücü, eşleşme paneli + önizleme, serbestlik, sürükleme, aşırı tanım reddi,
# eşleşme düzenle/bastır/çevir/sil, gelişmiş (genişlik, simetrik, limit) ve mekanik (dişli, menteşe, vida) eşleşmeler,
# SmartMate, kenar seçimi, bileşen taşı/döndür, aynala (ters el), patlatma adımları, kütle özellikleri
import cmdpatch, time, json, math
from h import *
ok=[]
def chk(n,c,info=""): ok.append(bool(c)); print(("✓ " if c else "✗ ")+n, info)
plate = [sketch("s1","S",TOP,lambda pt,line,rect,c,t: (rect(-50,-50,50,50), c(0,0,5), c(30,0,5))), ext("e1","s1",10)]
pin = [sketch("s1","S",TOP,lambda pt,line,rect,c,t: c(0,0,5)), ext("e1","s1",30)]
blk = [sketch("s1","S",TOP,lambda pt,line,rect,c,t: rect(-10,-10,10,10)), ext("e1","s1",20)]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e))); pg.on("dialog", lambda d: d.accept())
    pg.goto(URL); wait_ready(pg); time.sleep(0.4)
    pg.evaluate("localStorage.removeItem('imajcad.asm')"); pg.reload(); wait_ready(pg); time.sleep(0.3)
    A = lambda js: pg.evaluate(f"(()=>{{const a=window.__app.asm; {js}}})()")
    pg.click("#tabs button[data-tab='asm']"); time.sleep(0.3)
    pg.click("#cmds button:has-text('Montajı Aç')"); time.sleep(0.5)
    for nm,f in (("Plaka",plate),("Pim",pin),("Pim2",pin),("Blok",blk)):
        A(f"a.addComp({{name:'{nm}', features:{json.dumps(f)}}})"); time.sleep(1.5); wait_ready(pg)
    C = A("return a.doc.comps.map(c=>c.id)")
    E = lambda comp,kind,c,n,r=None: {"comp":comp,"kind":kind,"c":c,"n":n,**({"r":r} if r else {})}
    top=E(C[0],"plane",[0,10,0],[0,1,0]); bot=E(C[1],"plane",[0,0,0],[0,-1,0]); hole=E(C[0],"cyl",[0,5,0],[0,1,0],5); pcyl=E(C[1],"cyl",[0,15,0],[0,1,0],5)
    A(f"a.doc.comps[1].p=[150,40,30]; a.doc.comps[1].q=[0.38268,0,0,0.92388]; return 0")
    # 1) eşleşme paneli + önizleme
    A("a.startMate(); return 0")
    A(f"a.pickInto({json.dumps(top)}); a.pickInto({json.dumps(bot)}); return 0"); time.sleep(0.2)
    chk("önizleme pimi yüzeye taşıdı", abs(A("return a.doc.comps[1].p[1]")-10)<1e-3, A("return a.doc.comps[1].p.map(v=>+v.toFixed(2))"))
    chk("panelde tür düğmeleri", pg.locator("#pm-body .mate-types button").count() >= 6)
    pg.click("#pm-ok"); time.sleep(0.3)
    A("a.startMate(); return 0"); A(f"a.pickInto({json.dumps(hole)}); a.pickInto({json.dumps(pcyl)}); return 0")
    chk("silindir+silindir önerisi eş merkezli", A("return a.mateDraft.type")=="concentric")
    pg.click("#pm-ok"); time.sleep(0.3)
    pp = A("return a.doc.comps[1].p.map(v=>+v.toFixed(3))")
    chk("pim delikte (0,10,0)", abs(pp[0])<1e-3 and abs(pp[1]-10)<1e-3 and abs(pp[2])<1e-3, pp)
    chk("ağaçta (-) ve 1 serbestlik", "(-) Pim<1>" in pg.inner_text("#tree") and "1 serbestlik" in (pg.get_attribute("#tree li:has-text('Pim<1>')","title") or ""))
    # 2) sürükle: yalnız dönebilir
    sp = pg.evaluate("window.__app.viewer.toScreen([4,30,0])"); r = pg.query_selector("#view").bounding_box()
    A(f"a.input.down({{clientX:{r['x']+sp[0]},clientY:{r['y']+sp[1]}}}); for(let i=1;i<6;i++) a.input.move({{clientX:{r['x']+sp[0]}+i*15,clientY:{r['y']+sp[1]}+i*10}}); a.input.up({{clientX:0,clientY:0}}); return 0")
    pp = A("return a.doc.comps[1].p.map(v=>+v.toFixed(3))")
    chk("sürüklemede eksende kaldı", abs(pp[0])<1e-2 and abs(pp[1]-10)<1e-2 and abs(pp[2])<1e-2, pp)
    # 3) aşırı tanım reddi
    n0 = A("return a.doc.mates.length")
    A(f"a.addMate({{id:'x1',type:'distance',a:{json.dumps(top)},b:{json.dumps(bot)},v:5}}); return 0")
    chk("çelişen eşleşme reddedildi", A("return a.doc.mates.length")==n0 and "sağlanamıyor" in pg.inner_text("#toast"))
    # 4) düzenle: çakışık → mesafe 10
    A("a.startMate(a.doc.mates[0]); a.mateDraft.type='distance'; a.mateDraft.v=10; a.renderMatePM(); a.preview(); return 0")
    pg.click("#pm-ok"); time.sleep(0.3)
    chk("düzenle: mesafe 10 → pim y=20", abs(A("return a.doc.comps[1].p[1]")-20)<1e-3 and A("return a.doc.mates[0].type")=="distance")
    # bastır / çevir / sil (ağaç)
    pg.click("#tree li:has-text('Mesafe')"); time.sleep(0.2)
    pg.click("#tree-actions button:has-text('Bastır')"); time.sleep(0.2)
    chk("bastır", A("return !!a.doc.mates[0].off") and "(-) Pim<1>" in pg.inner_text("#tree"))
    pg.click("#tree-actions button:has-text('Etkinleştir')"); time.sleep(0.2)
    pg.click("#tree-actions button:has-text('Hizalamayı çevir')"); time.sleep(0.2)
    chk("hizalamayı çevir", A("return !!a.doc.mates[0].flip"))
    pg.click("#tree-actions button:has-text('Hizalamayı çevir')"); time.sleep(0.2)
    chk("geri çevir: y=20", abs(A("return a.doc.comps[1].p[1]")-20)<1e-3, A("return a.doc.comps[1].p[1]"))
    # 5) menteşe + dişli: pim2 ikinci delikte menteşe; pim1 ile dişli (1:2)
    top2=E(C[0],"plane",[30,10,0],[0,1,0]); hole2=E(C[0],"cyl",[30,5,0],[0,1,0],5); bot2=E(C[2],"plane",[0,0,0],[0,-1,0]); pcyl2=E(C[2],"cyl",[0,15,0],[0,1,0],5)
    ok1 = A(f"return a.addMate({{id:'h1',type:'hinge',a:{json.dumps(hole2)},b:{json.dumps(pcyl2)},c:{json.dumps(top2)},d:{json.dumps(bot2)}}})")
    pp2 = A("return a.doc.comps[2].p.map(v=>+v.toFixed(3))")
    chk("menteşe: pim2 ikinci delikte", ok1 and abs(pp2[0]-30)<1e-3 and abs(pp2[1]-10)<1e-3, pp2)
    ok2 = A(f"return a.addMate({{id:'g1',type:'gear',a:{json.dumps(pcyl)},b:{json.dumps(pcyl2)},v:1,vmax:2}})")
    A("const c=a.doc.comps[1]; const s=Math.sin(Math.PI/12), w=Math.cos(Math.PI/12); const q=[0,s,0,w]; a.q0=[...a.doc.comps[2].q]; a.solve({drag:{comp:c.id,rot:(()=>{const T=window.__app.THREE; return null})()||[q[0]*c.q[3]+q[3]*c.q[0]+q[1]*c.q[2]-q[2]*c.q[1], q[1]*c.q[3]+q[3]*c.q[1]+q[2]*c.q[0]-q[0]*c.q[2], q[2]*c.q[3]+q[3]*c.q[2]+q[0]*c.q[1]-q[1]*c.q[0], q[3]*c.q[3]-q[0]*c.q[0]-q[1]*c.q[1]-q[2]*c.q[2]]}}); return 0")
    ang = A("const q=a.doc.comps[2].q, q0=a.q0; const w=q[3]*q0[3]+q[0]*q0[0]+q[1]*q0[1]+q[2]*q0[2]; const y=q[1]*q0[3]-q[3]*q0[1]+q[2]*q0[0]-q[0]*q0[2]; return +(2*Math.atan2(y,w)*180/Math.PI).toFixed(2)")
    chk("dişli 1:2 → pim1 30° ise pim2 −15°", ok2 and abs(abs(ang)-15)<0.5, ang)
    # 6) genişlik: blok iki pim arasında ortada (x=15) — pim yüzleri yerine plaka iç yüzleri: blok yan yüzleri ile plaka kenarları
    sideL=E(C[0],"plane",[-50,5,0],[-1,0,0]); sideR=E(C[0],"plane",[50,5,0],[1,0,0]); bL=E(C[3],"plane",[-10,10,0],[-1,0,0]); bR=E(C[3],"plane",[10,10,0],[1,0,0])
    A(f"a.doc.comps[3].p=[120,40,30]; return 0")
    ok3 = A(f"return a.addMate({{id:'w1',type:'width',a:{json.dumps(sideL)},b:{json.dumps(sideR)},c:{json.dumps(bL)},d:{json.dumps(bR)}}})")
    chk("genişlik: blok x ortada (0)", ok3 and abs(A("return a.doc.comps[3].p[0]"))<1e-3, A("return a.doc.comps[3].p.map(v=>+v.toFixed(2))"))
    # 7) limit mesafe: blok altı plaka üstünden 0…40
    bb=E(C[3],"plane",[0,0,0],[0,-1,0])
    ok4 = A(f"return a.addMate({{id:'l1',type:'limit',a:{json.dumps(top)},b:{json.dumps(bb)},v:0,vmax:40}})")
    y = A("return a.doc.comps[3].p[1]")
    chk("limit: blok 10…50 arasında", ok4 and 10-1e-3 <= y <= 50+1e-3, y)
    # 8) SmartMate (Alt+sürükle): blok alt yüzü → plaka üst yüzü
    A("a.doc.mates=a.doc.mates.filter(m=>m.id!=='l1'); return 0")
    pg.keyboard.press("Control+7"); time.sleep(0.2)
    sp = pg.evaluate("window.__app.viewer.toScreen([-25,10,30])")
    A(f"const c=a.doc.comps[3]; a.press={{x:0,y:0,comp:c.id,moved:true,alt:true,ent:{json.dumps(bb)},start:a.poses()}}; a.input.up({{clientX:{r['x']+sp[0]},clientY:{r['y']+sp[1]}}}); return 0"); time.sleep(0.2)
    print("   smart pick:", A(f"const p=a.pick({r['x']}+{sp[0]},{r['y']}+{sp[1]}, a.doc.comps[3].id); return p&&[p.comp===a.doc.comps[0].id, p.ent&&p.ent.kind]"), A("return a.doc.mates.map(m=>m.type)"), pg.inner_text("#toast"))
    chk("SmartMate çakışık oluşturdu", A("return a.doc.mates.some(m=>m.type==='coincident'&&m.b.comp===a.doc.comps[3].id)") and abs(A("return a.doc.comps[3].p[1]")-10)<1e-3)
    # 9) kenar seçimi
    sp = pg.evaluate("window.__app.viewer.toScreen([0,10,50])")
    k = A(f"const p=a.pick({r['x']}+{sp[0]},{r['y']}+{sp[1]}); return p&&p.ent&&p.ent.kind")
    chk("kenar seçimi (doğrusal kenar)", k=="line", k)
    # 10) aynala (ters el)
    A("a.sel=a.doc.comps[3].id; a.selSet=new Set([a.sel]); return 0")
    pg.click("#cmds button:has-text('Bileşen Aynala')"); time.sleep(0.3); pg.click("#pm-ok"); time.sleep(2.5); wait_ready(pg)
    chk("aynalı bileşen eklendi", A("return a.doc.comps.some(c=>c.name.includes('(ayna)'))"), A("return a.doc.comps.map(c=>c.name)"))
    # 11) patlatma adımları
    pg.click("#cmds button:has-text('Patlatılmış Görünüm')"); time.sleep(0.3)
    pg.click("#pm-body button:has-text('Otomatik adımlar')"); time.sleep(0.2); pg.click("#pm-ok"); time.sleep(0.3)
    chk("patlatma adımları", A("return (a.doc.steps||[]).length")>=3 and A("return !!a.doc.exploded"))
    pg.screenshot(path="/home/claude/as3_explode.png")
    pg.click("#cmds button:has-text('Daralt')"); time.sleep(1.0)
    chk("daralt", not A("return !!a.doc.exploded"))
    # 12) kütle özellikleri
    pg.click("#cmds button:has-text('Kütle Özell.')"); time.sleep(0.3)
    chk("kütle özellikleri penceresi", "Toplam hacim" in pg.inner_text("dialog[open]")); pg.keyboard.press("Escape")
    # 13) panel ekran görüntüsü
    A("a.sel=null; a.startMate(); return 0"); A(f"a.pickInto({json.dumps(top)}); return 0"); time.sleep(0.2)
    pg.click("#pm-body .seg button:has-text('Mekanik')"); time.sleep(0.2)
    pg.screenshot(path="/home/claude/as3_pm.png"); pg.click("#pm-cancel")
    print("hatalar:", logs); print("SONUC:", "TAMAM" if all(ok) and not logs else "HATA")

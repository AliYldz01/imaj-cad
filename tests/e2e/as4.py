# Montaj kalan özellikler: montaj/bileşen ana düzlemleri, Toolbox (cıvata/somun/pul), alt montaj (rijit/esnek, dağıt),
# bileşen değiştir, eşleşmeleriyle kopyala, MateXpert, boşluk doğrulama, montaj kesiti, hareket etüdü (dişli),
# profil merkezi + üniversal mafsal, bağlam içinde parça düzenleme
import cmdpatch, time, json, math
from h import *
ok=[]
def chk(n,c,info=""): ok.append(bool(c)); print(("✓ " if c else "✗ ")+n, info)
plate = [sketch("s1","S",TOP,lambda pt,line,rect,c,t: (rect(-50,-50,50,50), c(0,0,5), c(30,0,5))), ext("e1","s1",10)]
pin = [sketch("s1","S",TOP,lambda pt,line,rect,c,t: c(0,0,5)), ext("e1","s1",30)]
blk = [sketch("s1","S",TOP,lambda pt,line,rect,c,t: rect(-10,-10,10,10)), ext("e1","s1",20)]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}, accept_downloads=True); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e))); pg.on("dialog", lambda d: d.accept(d.default_value or "1"))
    pg.goto(URL); wait_ready(pg); time.sleep(0.4)
    pg.evaluate("localStorage.removeItem('imajcad.asm')"); pg.reload(); wait_ready(pg); time.sleep(0.3)
    A = lambda js: pg.evaluate(f"(()=>{{const a=window.__app.asm; {js}}})()")
    pg.click("#tabs button[data-tab='asm']"); time.sleep(0.3)
    pg.click("#cmds button:has-text('Montajı Aç')"); time.sleep(0.5)
    for nm,f in (("Plaka",plate),("Pim",pin),("Pim2",pin),("Blok",blk)):
        A(f"a.addComp({{name:'{nm}', features:{json.dumps(f)}}})"); time.sleep(1.5); wait_ready(pg)
    C = A("return a.doc.comps.map(c=>c.id)")
    E = lambda comp,kind,c,n,r=None: {"comp":comp,"kind":kind,"c":c,"n":n,**({"r":r} if r else {})}
    # 1) montaj ana düzlemi: Blok alt yüzü ↔ montaj Üst düzlemi (y=0) ağaçtan seçilir
    A("a.doc.comps[3].p=[100,37,20]; return 0")
    A("a.sel=a.doc.comps[3].id; a.startMate(); return 0"); time.sleep(0.2)
    chk("eşleşmede montaj ana düzlemleri ağaçta", pg.locator("#tree li:has-text('Montaj ana düzlemleri')").count()==1)
    pg.locator("#tree li:has-text('Montaj ana düzlemleri')").first.click(); time.sleep(0.2)  # v0.58: kapalı başlar
    pg.locator("#tree li:has-text('Üst düzlem')").first.click(); time.sleep(0.2)
    A(f"a.pickInto({json.dumps(E(C[3],'plane',[0,0,0],[0,-1,0]))}); return 0"); time.sleep(0.2)
    pg.click("#pm-ok"); time.sleep(0.3)
    chk("bileşen montajın üst düzlemine oturdu (y=0)", abs(A("return a.doc.comps[3].p[1]"))<1e-3, A("return a.doc.comps[3].p.map(v=>+v.toFixed(2))"))
    # 2) Toolbox: M10x30 cıvata, somun, pul
    pg.click("#cmds button:has-text('Bağlantı Elemanı')"); time.sleep(0.3)
    pg.click("#pm-ok"); time.sleep(2); wait_ready(pg)
    bb = A("const c=a.doc.comps[a.doc.comps.length-1]; const m=a.meshes.get(c.id); return [c.name, m&&m.bbox&&+(m.bbox.max[1]-m.bbox.min[1]).toFixed(2), m&&m.bbox&&+(m.bbox.max[0]-m.bbox.min[0]).toFixed(2)]")
    chk("cıvata M10x30: boy 30+6.4, baş köşe ölçüsü ~18.5", bb[0].startswith("Cıvata M10x30") and abs(bb[1]-36.4)<0.05 and abs(bb[2]-18.48)<0.1, bb)
    A("a.openToolbox(); return 0"); pg.select_option("#pm-body select >> nth=0", "nut"); time.sleep(0.2); pg.click("#pm-ok"); time.sleep(2); wait_ready(pg)
    chk("somun eklendi", A("return a.doc.comps.some(c=>c.name.startsWith('Somun M10'))"))
    # 3) alt montaj: Pim + Pim2 → rijit; Pim'i sürükle → Pim2 birlikte
    A("a.doc.comps[1].p=[0,60,0]; a.doc.comps[2].p=[30,60,0]; a.doc.comps[1].q=[0,0,0,1]; a.doc.comps[2].q=[0,0,0,1]; a.selSet=new Set([a.doc.comps[1].id,a.doc.comps[2].id]); a.renderTree(); return 0")
    pg.click("#tree-actions button:has-text('Seçilenlerden alt montaj oluştur')"); time.sleep(0.3)
    chk("alt montaj oluştu (ağaçta)", A("return (a.doc.subs||[]).length")==1 and pg.locator("#tree li:has-text('rijit alt montaj')").count()==1)
    A("a.solve({drag:{comp:a.doc.comps[1].id, local:[0,15,0], target:[20,75,0]}}); return 0")
    pp = A("return [a.doc.comps[1].p, a.doc.comps[2].p].map(p=>p.map(v=>+v.toFixed(2)))")
    chk("rijit: ikisi birlikte taşındı (aralık 30)", abs((pp[1][0]-pp[0][0])-30)<1e-2 and abs(pp[0][0]-20)<0.5, pp)
    pg.click("#tree li:has-text('rijit alt montaj')"); time.sleep(0.2)
    pg.click("#tree-actions button:has-text('Esnek yap')"); time.sleep(0.2)
    A("a.solve({drag:{comp:a.doc.comps[1].id, local:[0,15,0], target:[-10,75,0]}}); return 0")
    pp2 = A("return [a.doc.comps[1].p, a.doc.comps[2].p].map(p=>p.map(v=>+v.toFixed(2)))")
    chk("esnek: yalnız sürüklenen taşındı", abs(pp2[1][0]-pp[1][0])<1e-2 and abs(pp2[0][0]-pp[0][0])>5, pp2)
    with pg.expect_download() as dl: pg.click("#tree-actions button:has-text('Alt montajı kaydet')")
    chk("alt montaj .icasm indirildi", json.load(open(dl.value.path()))["kind"]=="asm")
    pg.click("#tree-actions button:has-text('Alt montajı dağıt')"); time.sleep(0.2)
    chk("dağıt", A("return (a.doc.subs||[]).length")==0)
    # 4) değiştir: Blok → Pim parçası (konum korunur)
    p0 = A("return a.doc.comps[3].p")
    A(f"a.replaceComp(a.doc.comps[3], {{name:'Pim', features:{json.dumps(pin)}}}); return 0"); time.sleep(2); wait_ready(pg)
    chk("değiştir: parça ve konum", A("return a.doc.comps[3].part.name")=="Pim" and A("return a.doc.comps[3].p")==p0)
    # 5) eşleşmeleriyle kopyala
    n0 = A("return a.doc.mates.length")
    A("a.copyWithMates(a.doc.comps[3]); return 0"); time.sleep(2); wait_ready(pg)
    chk("eşleşmeleriyle kopyala (bastırılmış konum eşleşmesi)", A("return a.doc.mates.length")==n0+1 and A("return a.doc.mates[a.doc.mates.length-1].off")==True)
    # 6) üniversal mafsal + profil merkezi (çözücü)
    hole=E(C[0],"cyl",[0,5,0],[0,1,0],5); pc=E(C[1],"cyl",[0,15,0],[0,1,0],5); top=E(C[0],"plane",[0,10,0],[0,1,0]); bot=E(C[1],"plane",[0,0,0],[0,-1,0])
    okm = A(f"return a.addMate({{id:'pc1',type:'profileCenter',a:{json.dumps(top)},b:{json.dumps(bot)},v:0}})")
    pp = A("return a.doc.comps[1].p.map(v=>+v.toFixed(3))")
    chk("profil merkezi: pim plakanın üst yüz merkezinde", okm and abs(pp[0])<1e-3 and abs(pp[1]-10)<1e-3 and abs(pp[2])<1e-3, pp)
    # 7) MateXpert: çelişen eşleşme (zorla) → önerir
    A(f"a.addMate({{id:'bad1',type:'distance',a:{json.dumps(top)},b:{json.dumps(bot)},v:7}}, true); return 0")
    pg.click("#cmds button:has-text('MateXpert')"); time.sleep(0.5)
    chk("MateXpert sorunlu eşleşmeyi ve çözümü gösterir", "Sağlanamayan" in pg.inner_text("dialog[open]") and pg.locator("dialog[open] button:has-text('Bastır')").count()>=1)
    pg.click("dialog[open] button:has-text('Bastır') >> nth=0"); time.sleep(0.3)
    chk("bastırınca sorun kalmadı", A("return a.bad.size")==0)
    # 8) boşluk doğrulama
    A("a.selSet=new Set([a.doc.comps[0].id,a.doc.comps[2].id]); return 0")
    pg.click("#cmds button:has-text('Boşluk Doğrula')"); time.sleep(4); wait_ready(pg)
    t = pg.inner_text("dialog[open]")
    chk("boşluk doğrulama tablosu", "Boşluk doğrulama" in t and "Plaka" in t, t.split("\n")[-1])
    pg.keyboard.press("Escape")
    # 9) montaj kesiti
    pg.click("#cmds button:has-text('Montaj Kesiti')"); time.sleep(0.3)
    chk("kesit düzlemi etkin", pg.evaluate("window.__app.viewer.renderer.clippingPlanes.length")==1)
    pg.screenshot(path="/home/claude/as4_section.png")
    pg.click("#pm-ok"); time.sleep(0.2)
    chk("kesit kapandı", pg.evaluate("window.__app.viewer.renderer.clippingPlanes.length")==0)
    # 10) hareket etüdü: dişli (pim2 ikinci delikte eş merkezli; pim ile 1:1 dişli) — motor pim'e
    A("a.doc.mates=a.doc.mates.filter(m=>m.id!=='bad1'); return 0")
    hole2=E(C[0],"cyl",[30,5,0],[0,1,0],5); top2=E(C[0],"plane",[30,10,0],[0,1,0]); pc2=E(C[2],"cyl",[0,15,0],[0,1,0],5); bot2=E(C[2],"plane",[0,0,0],[0,-1,0])
    A(f"a.addMate({{id:'h1',type:'concentric',a:{json.dumps(hole)},b:{json.dumps(pc)}}}); a.addMate({{id:'h2',type:'hinge',a:{json.dumps(hole2)},b:{json.dumps(pc2)},c:{json.dumps(top2)},d:{json.dumps(bot2)}}}); a.addMate({{id:'g1',type:'gear',a:{json.dumps(pc)},b:{json.dumps(pc2)},v:1,vmax:1}}); return 0")
    q2 = A("return [...a.doc.comps[2].q]")
    A("a.sel=a.doc.comps[1].id; return 0")
    pg.click("#cmds button:has-text('Hareket Etüdü')"); time.sleep(0.3)
    A(f"a.picker({{comp:a.doc.comps[1].id, ent:{json.dumps(pc)}}}); return 0")
    pg.fill("#pm-body label:has-text('Süre') input", "1"); time.sleep(0.1)
    pg.click("#pm-body button:has-text('Oynat')"); time.sleep(1.6)
    q2b = A("return [...a.doc.comps[2].q]")
    chk("hareket: motor pimi döndürdü, dişli ikinciyi döndürdü", abs(q2b[1]-q2[1])>0.05, [q2,q2b])
    pg.click("#pm-ok"); time.sleep(0.2)
    # 11) bağlam içinde parça düzenle
    A("a.sel=a.doc.comps[3].id; a.selSet=new Set([a.sel]); a.renderTree(); return 0")
    pg.click("#tree-actions button:has-text('Parçayı düzenle')"); time.sleep(1.5); wait_ready(pg)
    chk("parça düzenleme açıldı", pg.locator(".ctx-edit-bar").count()==1 and pg.evaluate("window.__app.doc.name")=="Pim")
    pg.evaluate("(()=>{const d=JSON.parse(JSON.stringify(window.__app.doc)); d.features[1].d1=50; window.__app.setDoc(d)})()"); time.sleep(1); wait_ready(pg)
    pg.click(".ctx-edit-bar button:has-text('Montaja dön')"); time.sleep(2.5); wait_ready(pg)
    h3 = A("const m=a.meshes.get(a.doc.comps[3].id); return m&&m.bbox&&+(m.bbox.max[1]-m.bbox.min[1]).toFixed(2)")
    chk("montaja dönünce bileşen güncellendi (boy 50)", h3==50 and A("return a.on"), h3)
    print("hatalar:", logs); print("SONUC:", "TAMAM" if all(ok) and not logs else "HATA")

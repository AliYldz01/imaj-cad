# Montaj denetimi kalanları: B7 girişim paneli, B8 ağaç düzlemleri kapalı, B10 dikiş köşesi seçilmez, B11 parça malzemesi,
# B3 telefonda parmakla bileşen sürükleme, B9 telefonda panel / ipucu yerleşimi
import cmdpatch, time, json
from h import *
ok=[]
def chk(n,c,i=""): ok.append(c); print(("TAMAM " if c else "HATA  ")+n, i)
plate = [sketch("s1","S",TOP,lambda pt,line,rect,c,t: rect(-50,-50,50,50)), ext("e1","s1",10)]
pin = [sketch("s2","S",TOP,lambda pt,line,rect,c,t: c(0,0,10)), ext("e2","s2",30)]
ARGS=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"]
def setup(pg, comps):
    asm = lambda js: pg.evaluate(f"(async()=>{{const a=window.__app.asm; {js}}})()")
    pg.click("#tabs button[data-tab='asm']"); time.sleep(0.6)
    if not asm("return a.on"): pg.click("#cmds button:has-text('Montajı Aç')"); time.sleep(0.6)
    asm("if (a.doc.comps.length) a.removeComps(a.doc.comps.map(c=>c.id)); return 0")
    for name, feats, mat in comps:
        part = {"name":name, "features":feats}
        if mat: part["material"]=mat
        asm(f"a.addComp({json.dumps(part)}); return 0"); time.sleep(1.2); wait_ready(pg)
    return asm
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=ARGS)
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e))); pg.on("dialog", lambda d: d.accept())
    pg.goto(URL); wait_ready(pg); time.sleep(0.4)
    ev = pg.evaluate
    asm = setup(pg, [("Plaka", plate, None), ("Pim", pin, "aluminium"), ("Uzak", plate, None)])
    # Pim plakanın içine girsin (girişim), Uzak plaka uzakta
    asm("const c=a.doc.comps; c[1].p=[0,-10,0]; c[2].p=[300,0,0]; a.save(); a.draw(); return 0")
    pg.keyboard.press("f"); time.sleep(0.3)
    # B7: girişim paneli
    pg.click("#cmds button:has-text('Girişim')"); time.sleep(5); wait_ready(pg)
    body = pg.inner_text("#pm-body") if not ev("document.querySelector('#pm').hidden") else ""
    chk("girişim paneli açık, 1 sonuç (Plaka ↔ Pim)", "Girişim1" in body and "Pim" in body and "Uzak" not in body, body[:200])
    vol = asm("return a.ifc.pairs[0].vol")
    chk("girişim hacmi = π·10²·10 ≈ 3141.6", abs(vol-3141.59) < 15, vol)
    chk("girişim hacmi kırmızı ağ olarak çizildi", asm("let n=0; a.group.traverse(o=>o.userData.ifc&&n++); return n")==1)
    pg.click("#pm-body label:has-text('Yalnız çakışan')"); time.sleep(0.3)
    chk("yalnız çakışanlar: Uzak gizli", asm("return !a.objs.has(a.doc.comps[2].id) && a.objs.has(a.doc.comps[1].id)"))
    pg.click("#pm-cancel"); time.sleep(0.3)
    chk("panel kapanınca vurgu kalkar", asm("return a.ifc===null && a.objs.has(a.doc.comps[2].id)"))
    # B11: kütle parça malzemesiyle
    asm("a.massProps(); return 0"); time.sleep(0.3)
    ms = asm("return a.__mass")
    rows = {r["name"]: r for r in ms["rows"]}
    pinr = [r for n,r in rows.items() if n.startswith("Pim")][0]; plr = [r for n,r in rows.items() if n.startswith("Plaka")][0]
    chk("Pim alüminyum: kütle = hacim × 2.7", abs(pinr["mass"] - pinr["vol"]*2.7e-6) < 1e-6 and "Alüminyum" in pinr["mat"], pinr)
    chk("Plaka varsayılan çelik 7.85", abs(plr["mass"] - plr["vol"]*7.85e-6) < 1e-6, plr)
    chk("pencerede malzeme sütunu", "Alüminyum" in pg.inner_text("dialog[open]")); pg.click("dialog[open] button:has-text('Kapat')")
    # B10: silindir kenarındaki dikiş noktası köşe olarak seçilmez
    r = pg.query_selector("#view").bounding_box()
    seam = asm("""const c=a.doc.comps[1], m=a.meshes.get(c.id); const e=m.edges.find(e=>e.c&&e.r&&e.s[1]>20);
        return [e.s[0]+c.p[0], e.s[1]+c.p[1], e.s[2]+c.p[2]]""")
    sp = ev(f"window.__app.viewer.toScreen({seam})")
    pk = asm(f"const p=a.pick({r['x']+sp[0]},{r['y']+sp[1]}); return p&&p.ent&&p.ent.kind")
    chk("silindir dikiş noktasına dokunmak köşe seçmez", pk not in ("point", None), pk)
    # gerçek köşe hâlâ seçilir (plaka köşesi)
    cp = ev("window.__app.viewer.toScreen([50,10,50])")
    pk2 = asm(f"const p=a.pick({r['x']+cp[0]},{r['y']+cp[1]}); return p&&p.ent&&p.ent.kind")
    chk("plaka köşesi köşe olarak seçilir", pk2=="point", pk2)
    # B8: eşleşmede ana düzlemler kapalı
    asm("a.sel=a.doc.comps[1].id; a.startMate(); return 0"); time.sleep(0.3)
    tree = pg.inner_text("#tree")
    chk("eşleşmede düzlem satırları kapalı", "Montaj ana düzlemleri" in tree and "Üst düzlem" not in tree and tree.count("Ana düzlemler")==3, tree.count("Ana düzlemler"))
    pg.locator("#tree li:has-text('Ana düzlemler')").first.click(); time.sleep(0.2)
    chk("dokununca o bileşenin düzlemleri açılır", pg.locator("#tree li:has-text('Üst düzlem')").count()==1)
    pg.click("#pm-cancel"); time.sleep(0.2)
    chk("hata yok (masaüstü)", not logs, logs)
    pg.close()

    # ---- telefon: B3 parmakla sürükleme, B9 panel yerleşimi
    ctx = b.new_context(viewport={"width":390,"height":844}, has_touch=True, is_mobile=True, device_scale_factor=2)
    pg = ctx.new_page(); logs2=[]
    pg.on("pageerror", lambda e: logs2.append(str(e))); pg.on("dialog", lambda d: d.accept())
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    ev = pg.evaluate
    asm = setup(pg, [("Plaka", plate, None), ("Kapak", plate, None)])
    asm("const c=a.doc.comps; c[1].p=[0,40,0]; a.save(); a.draw(); window.__app.viewer.fit(); return 0"); time.sleep(0.5)
    cdp = ctx.new_cdp_session(pg)
    def touch(kind, pts): cdp.send("Input.dispatchTouchEvent", {"type": kind, "touchPoints": [{"x":x,"y":y,"id":i} for i,(x,y) in enumerate(pts)]})
    def drag(x0,y0,dx,dy):
        touch("touchStart", [(x0,y0)])
        for k in range(1,9): touch("touchMove", [(x0+dx*k/8, y0+dy*k/8)]); time.sleep(0.03)
        touch("touchEnd", []); time.sleep(0.5)
    r = pg.query_selector("#view").bounding_box()
    sp = ev("window.__app.viewer.toScreen([0,50,0])")
    p0 = asm("return a.doc.comps[1].p.slice()"); q0 = ev("window.__app.viewer.camera.quaternion.toArray()")
    drag(r["x"]+sp[0], r["y"]+sp[1], 70, 0)
    p1 = asm("return a.doc.comps[1].p.slice()"); q1 = ev("window.__app.viewer.camera.quaternion.toArray()")
    chk("parmakla serbest bileşen sürüklenir (B3)", abs(p1[0]-p0[0])+abs(p1[2]-p0[2]) > 5, (p0, p1))
    chk("sürüklerken görünüm dönmez", max(abs(a-b) for a,b in zip(q0,q1)) < 1e-6)
    # sabit bileşen ve boşluk → görünüm döner
    p1b = asm("return a.doc.comps[0].p.slice()")
    drag(r["x"]+30, r["y"]+r["height"]*0.25, 80, 40)
    q2 = ev("window.__app.viewer.camera.quaternion.toArray()")
    chk("boşlukta parmak görünümü döndürür", max(abs(a-b) for a,b in zip(q1,q2)) > 1e-3)
    chk("sabit bileşen yerinde", asm("return a.doc.comps[0].p")==p1b)
    # B9: eşleşme paneli telefonda alçak, ipucu panelin üstünde
    asm("a.startMate(); return 0"); time.sleep(0.6)
    sh = pg.query_selector("#side").bounding_box()
    chk("montaj paneli ≤ %37 yükseklik", sh["height"] <= 844*0.37+2, sh)
    hb = pg.query_selector("#hint").bounding_box() if ev("document.querySelector('#hint').textContent") else None
    chk("ipucu panelin üstünde, örtüşmez", hb is None or hb["y"]+hb["height"] <= sh["y"]+1, (hb, sh["y"]))
    cb = pg.query_selector("#pm-cancel").bounding_box()
    chk("✕ yine dokunulabilir", ev(f"document.elementFromPoint({cb['x']+cb['width']/2},{cb['y']+cb['height']/2})?.id")=="pm-cancel")
    pg.screenshot(path="/home/claude/as9_phone.png")
    chk("hata yok (telefon)", not logs2, logs2)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

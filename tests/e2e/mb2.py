import cmdpatch, time, json
from playwright.sync_api import sync_playwright
from h import wait_ready, sketch, ext, run, TOP
ok = True
def chk(name, cond, info=""):
    global ok
    print(("TAMAM " if cond else "HATA  ") + name, info)
    ok = ok and bool(cond)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    ctx = b.new_context(viewport={"width":1400,"height":900}, has_touch=True)
    pg = ctx.new_page(); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e))); pg.on("dialog", lambda d: d.accept())
    pg.goto('http://localhost:4173/'); wait_ready(pg); time.sleep(0.4)
    ev = pg.evaluate
    cdp = ctx.new_cdp_session(pg)
    def tap(x, y):
        cdp.send("Input.dispatchTouchEvent", {"type":"touchStart","touchPoints":[{"x":x,"y":y,"id":1}]}); time.sleep(0.05)
        cdp.send("Input.dispatchTouchEvent", {"type":"touchEnd","touchPoints":[]}); time.sleep(0.35)

    # --- 8.3 sihirbaz eskizleri tam tanımlı
    def wiz(name, vals={}):
        pg.click("#file-btn"); pg.click("#file-menu button[data-act='new']"); time.sleep(0.4); wait_ready(pg)
        pg.click("#file-btn"); pg.click("#file-menu button[data-act='wizard']")
        pg.click(f"dialog .wiz-types button:has-text('{name}')")
        for k,v in vals.items(): pg.fill(f"dialog label.pm-field:has-text('{k}') input", str(v))
        pg.click("dialog button:has-text('Oluştur')"); time.sleep(0.5); wait_ready(pg)
        dofs = ev("window.__app.doc.features.filter(f=>f.type==='sketch').map(f=>window.__app.sketchDof(f.data))")
        nd = ev("window.__app.doc.features.filter(f=>f.type==='sketch').map(f=>f.data.dims.length)")
        err = pg.eval_on_selector_all("#tree li.err", "els=>els.length")
        chk(f"sihirbaz {name} tam tanımlı", dofs and all(d==0 for d in dofs) and err==0, f"dof {dofs} ölçü {nd}")
    for n in ["Delikli plaka", "Flanş", "Burç", "Kademeli mil", "L braket", "Kutu profil", "Blok"]: wiz(n)

    # --- 8.1 ekstrüzyon panelinde derinlik oku
    run(pg, "box", [sketch("s1","S",TOP,lambda pt,line,rect,c,t: rect(-50,-30,50,30)), ext("e1","s1",20)])
    pg.keyboard.press("Control+1"); pg.keyboard.press("f"); time.sleep(0.3)
    pg.dblclick("#tree li:has-text('e1')"); time.sleep(0.6)
    ar = pg.locator(".i3d .i3d-ar")
    chk("panelde ok görünür", ev("window.__app.mode.k")=="pm" and ar.is_visible(), pg.inner_text(".i3d .i3d-v"))
    bb = ar.bounding_box(); x,y = bb["x"]+bb["width"]/2, bb["y"]+bb["height"]/2
    pg.mouse.move(x,y); pg.mouse.down(); pg.mouse.move(x, y-60, steps=6); pg.mouse.up(); time.sleep(0.6)
    d1 = ev("window.__app.mode.draft.d1")
    chk("sürükleme taslak derinliğini değiştirir (tam mm)", d1 > 20 and abs(d1-round(d1))<1e-9, d1)
    pg.click("#pm-ok"); time.sleep(0.6); wait_ready(pg)
    ymax = ev("window.__app.viewer.mesh.bbox.max[1]")
    chk("✓ sonrası model yeni derinlikte", abs(ymax-d1)<0.01, ymax)

    # --- 8.2 dokunmatikte üst üste adaylar
    pg.keyboard.press("Escape"); time.sleep(0.2)
    pt = ev("(()=>{const v=window.__app.viewer,m=v.mesh; const e=m.edges.findIndex(e=>Math.abs(e.m[1]-%s)<0.01&&Math.abs(e.m[2]-30)<0.01); return v.toScreen(m.edges[e].m)})()" % ymax)
    r = ev("(()=>{const r=document.querySelector('#view canvas').getBoundingClientRect();return [r.left,r.top]})()")
    tap(pt[0]+r[0], pt[1]+r[1])
    cands = pg.locator(".cand-bar button").all_inner_texts()
    sel0 = ev("JSON.stringify(window.__app.psel||null)")
    chk("dokununca aday çubuğu", len(cands) >= 1, cands)
    if cands:
        pg.locator(".cand-bar button").first.click(); time.sleep(0.3)
        chk("aday seçilince çubuk kalkar", pg.locator(".cand-bar").count()==0)
    pg.mouse.click(700, 120); time.sleep(0.3)
    chk("fareyle tıklamada aday çubuğu yok", pg.locator(".cand-bar").count()==0)

    # --- 8.4 fotoğraftan kenar izleme: 600×400 px, siyah 300×200 dikdörtgen + Ø80 beyaz delik
    src = ev("""(()=>{const c=document.createElement('canvas');c.width=600;c.height=400;const g=c.getContext('2d');
      g.fillStyle='#fff';g.fillRect(0,0,600,400);g.fillStyle='#111';g.fillRect(150,100,300,200);
      g.fillStyle='#fff';g.beginPath();g.arc(300,200,40,0,Math.PI*2);g.fill();return c.toDataURL('image/png')})()""")
    skp = sketch("s2","Foto",TOP,lambda pt,line,rect,c,t: None)
    skp["data"]["pic"] = {"src":src,"aspect":400/600,"x":0,"y":0,"w":600,"rot":0,"op":0.6}
    run(pg, "foto", [skp])
    pg.dblclick("#tree li:has-text('Foto')"); time.sleep(0.6)
    ev("window.__app.mode.editor.setTool('picture')"); time.sleep(0.2)
    chk("panelde Kenarları izle", pg.locator("#pm button:has-text('Kenarları izle')").count()==1)
    n = ev("window.__app.mode.editor.traceEdges()")
    info = ev("""(()=>{const d=window.__app.mode.editor.data;const P=id=>d.pts[id];
      const ls=d.ents.filter(e=>e.t==='line').map(l=>[P(l.p1),P(l.p2)]);
      const xs=ls.flat().map(p=>p.x), ys=ls.flat().map(p=>p.y);
      const c=d.ents.find(e=>e.t==='circle');
      return {n:d.ents.length, lines:ls.length, w:Math.max(...xs)-Math.min(...xs), h:Math.max(...ys)-Math.min(...ys), c:c&&[P(c.c).x,P(c.c).y,c.r]}})()""")
    chk("2 kontur izlendi", n==2, info)
    chk("dış kontur 300×200 dikdörtgen", info["lines"]==4 and abs(info["w"]-300)<3 and abs(info["h"]-200)<3)
    chk("delik daire R40 merkezde", info["c"] and abs(info["c"][2]-40)<2 and abs(info["c"][0])<2 and abs(info["c"][1])<2)
    ev("window.__app.mode.editor.undo()"); time.sleep(0.2)
    chk("tek adımda geri alınır", ev("window.__app.mode.editor.data.ents.length")==0)

    # --- 8.5 sesle ölçü
    P = lambda t: ev("t=>window.__app.parseSpoken(t)", t)
    cases = [("on iki virgül beş",[12.5]),("yüz elli",[150]),("yirmi buçuk",[20.5]),("iki bin üç yüz",[2300]),("eksi on",[-10]),("25,4",[25.4]),("sıfır virgül sıfır beş",[0.05]),("yüz çarpı elli",[100,50]),("120 açı 30",[120,30]),("merhaba",[])]
    bad = [(t,P(t)) for t,e in cases if P(t)!=e]
    chk("Türkçe sayı çözümleme", not bad, bad)
    ev("window.__app.mode.editor.setTool('circle')"); time.sleep(0.1)
    r1 = ev("window.__app.voiceInput('elli ve otuz')"); time.sleep(0.3)
    chk("mikrofon düğmesi kutuda", True)
    r2 = ev("window.__app.voiceInput('yirmi')"); time.sleep(0.3)
    circ = ev("(()=>{const d=window.__app.mode.editor.data;const c=d.ents.find(e=>e.t==='circle');return c&&[d.pts[c.c].x,d.pts[c.c].y,c.r]})()")
    chk("sesle daire 50,30", circ and abs(circ[0]-50)<1e-6 and abs(circ[1]-30)<1e-6 and circ[2] in (10,20), circ)
    chk("sayfa hatası yok", not logs, logs)
    print("SONUC:", "TAMAM" if ok else "HATA")

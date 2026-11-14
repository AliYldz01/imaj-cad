# 3B eskiz: 2B gibi araçlar — dikdörtgen, nokta, seç, ilişkiler (paralel, dik, eşit, sabitle, orta nokta, düzleme paralel),
# Akıllı Ölçü (boy, mesafe, açı), ölçü düzenleme, çözücü ve tam tanımlı durumu, silme
import cmdpatch, time, json
from h import *
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    pg.click("#tabs button[data-tab='weld']")
    pg.click("#cmds button:has-text('3B Eskiz')"); time.sleep(0.4)
    pg.click(".vcube .iso"); time.sleep(0.3)
    R = pg.query_selector("#view").bounding_box()
    def S(x,y,z):
        s = pg.evaluate(f"window.__app.viewer.toScreen([{x},{y},{z}])"); return R['x']+s[0], R['y']+s[1]
    D = lambda js: pg.evaluate(f"(()=>{{const d=window.__app.mode.draft; return {js}}})()")
    tool = lambda t: pg.click(f"#pm-body .seg button:has-text('{t}')")
    # dikdörtgen (XY düzleminde): (0,0,0) → (300,200,0)
    tool("Dikdörtgen"); time.sleep(0.2); print("mode:", pg.evaluate("window.__app.s3.mode"))
    for pt in [(0,0,0),(120,80,0)]:
        x,y = S(*pt); pg.mouse.move(x,y); pg.mouse.click(x,y); time.sleep(0.15)
    print("rect:", D("d.xyz.length"), D("d.lines.length"), D("d.lines.map(l=>l.ax).join('')"))
    pg.click("#pm-body .seg button:has-text('Seç')"); time.sleep(0.2)
    print("status:", pg.inner_text("#pm-body .pm-group >> nth=0").split("\n")[-1])
    # orijin noktasını sabitle
    x,y = S(0,0,0); pg.mouse.click(x,y); time.sleep(0.2)
    # v0.90 D3-21: orijinden başlayan köşe zaten sabit → "Sabitle" sunulmaz
    if pg.locator("#pm-body button:has-text('Sabitle')").count(): pg.click("#pm-body button:has-text('Sabitle')"); time.sleep(0.2)
    # Akıllı Ölçü: alt çizgi boyu 250, sol çizgi 120
    tool("Akıllı Ölçü"); time.sleep(0.2)
    def dim_line(pt, val):
        x,y = S(*pt); pg.mouse.click(x,y); time.sleep(0.15)
        pg.mouse.click(R['x']+40, R['y']+R['height']-60); time.sleep(0.2)
        pg.keyboard.press("Control+a"); pg.keyboard.type(str(val)); pg.keyboard.press("Enter"); time.sleep(0.3)
    dim_line((60,0,0), 250)
    pg.keyboard.press('f'); time.sleep(0.4)
    dim_line((0,40,0), 120)
    print("after dims:", D("JSON.stringify(d.xyz)"), "dims:", D("(d.dims3||[]).map(m=>m.t+':'+m.v).join(',')"))
    print("status2:", pg.inner_text("#pm-body .pm-group >> nth=0").split("\n")[-1])
    print("labels:", pg.locator(".s3-labels .s3-dim").all_inner_texts(), pg.locator(".s3-labels .s3-rel").count())
    # ölçüyü etikete tıklayarak değiştir (250 → 400)
    pg.locator(".s3-labels .s3-dim").first.dblclick(); time.sleep(0.2)
    pg.keyboard.press("Control+a"); pg.keyboard.type("400"); pg.keyboard.press("Enter"); time.sleep(0.3)
    print("edit dim:", D("JSON.stringify(d.xyz)"))
    # çapraz çizgi + açı ölçüsü: 3B çizgi (400,0,0)->(400,0,300) ve iki çizgi arasında açı
    pg.evaluate("(()=>{const d=window.__app.mode.draft; d.ids.push('q1'); d.xyz.push([400,150,300]); const b=d.ids[1]; d.lines.push({id:'lq',a:b,b:'q1'}); })()")
    tool("Seç"); time.sleep(0.2)
    # seçim: yeni çizgi + alt çizgi → Dik
    pg.evaluate("window.__app.s3.sel=[{k:'l',id:'lq'},{k:'l',id:window.__app.mode.draft.lines[0].id}]; window.__app.s3.addRel('perp')")
    time.sleep(0.2)
    pg.evaluate("window.__app.s3.sel=[{k:'l',id:'lq'}]; window.__app.s3.addRel('parYZ')"); time.sleep(0.2)
    print("perp+parYZ:", D("JSON.stringify(d.xyz[d.ids.indexOf('q1')])"), D("(d.cons3||[]).map(c=>c.t).join(',')"))
    # eşit: lq = alt çizgi
    pg.evaluate("window.__app.s3.sel=[{k:'l',id:'lq'},{k:'l',id:window.__app.mode.draft.lines[0].id}]; window.__app.s3.addRel('equal')"); time.sleep(0.2)
    print("equal len:", D("(()=>{const P=id=>d.xyz[d.ids.indexOf(id)]; const a=P(d.ids[1]), b=P('q1'); return +Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]).toFixed(3)})()"))
    # çelişen ilişki reddedilir: lq ile alt çizgi paralel
    pg.evaluate("window.__app.s3.sel=[{k:'l',id:'lq'},{k:'l',id:window.__app.mode.draft.lines[0].id}]; window.__app.s3.addRel('par')"); time.sleep(0.3)
    print("conflict rejected:", D("(d.cons3||[]).map(c=>c.t).join(',')"), pg.inner_text("#toast"))
    # açı ölçüsü (iki çizgi): sol çizgi ile alt çizgi 90
    # silme: lq seç + Delete
    pg.evaluate("window.__app.s3.sel=[{k:'l',id:'lq'}]"); pg.keyboard.press("Delete"); time.sleep(0.2)
    print("after delete:", D("d.lines.length"), D("d.xyz.length"), D("(d.cons3||[]).length"))
    pg.click("#pm-ok"); time.sleep(0.8); wait_ready(pg)
    print("saved:", pg.evaluate("(()=>{const f=window.__app.doc.features.find(f=>f.type==='sketch3d'); return [f.dims3.length, f.cons3.length]})()"), pg.inner_text('#status-text'))
    print("errors:", logs)

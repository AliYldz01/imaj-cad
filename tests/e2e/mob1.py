import sys, time
from playwright.sync_api import sync_playwright
from h import wait_ready
URL = sys.argv[1] if len(sys.argv)>1 else 'http://localhost:4173/'
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    ctx = b.new_context(viewport={"width":412,"height":880}, has_touch=True, is_mobile=True, device_scale_factor=2)
    pg = ctx.new_page(); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.on("console", lambda m: m.type=="error" and logs.append(m.text))
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    cdp = ctx.new_cdp_session(pg)
    def touch(kind, pts):
        cdp.send("Input.dispatchTouchEvent", {"type": kind, "touchPoints": [{"x":x,"y":y,"id":i} for i,(x,y) in enumerate(pts)]})
    def pen(kind, x, y, buttons=0, button="none"):
        cdp.send("Input.dispatchMouseEvent", {"type": kind, "x": x, "y": y, "pointerType": "pen", "button": button, "buttons": buttons, "clickCount": 1 if kind!="mouseMoved" else 0})
    ev = lambda js: pg.evaluate(js)
    ed = lambda js: pg.evaluate(f"(()=>{{const e=window.__app.mode.editor; const d=e.data; {js}}})()")
    r = pg.query_selector("#view").bounding_box(); print("view", r)
    vis = lambda sel: pg.locator(sel).first.is_visible() if pg.locator(sel).count() else False
    print("actbar:", vis(".actbar"), "cube:", vis(".vcube"), "profile:", ev("JSON.parse(localStorage.getItem('imajcad.input')||'{}').profile||'auto'"))
    # parmakla kısa dokunuş -> profil 'finger'
    cx, cy = r["x"]+r["width"]/2, r["y"]+r["height"]*0.35
    touch("touchStart", [(cx,cy)]); touch("touchEnd", [])
    time.sleep(0.3); print("actbar after touch:", vis(".actbar"), "cube:", vis(".vcube"))
    # küp: Üst yüzüne dokun (görünen yüz İzo görünümde Ön/Üst/Sağ)
    pg.locator(".vcube .iso").tap(); time.sleep(0.2)
    top = pg.locator(".vcube .face:has-text('Üst')").bounding_box()
    pg.locator(".vcube .face:has-text('Üst')").tap(); time.sleep(0.3)
    print("camera after cube Top:", ev("(()=>{const v=window.__app.viewer; const d=v.camera.position.clone().sub(v.controls.target).normalize(); return [d.x,d.y,d.z].map(x=>+x.toFixed(2))})()"))
    # uzun basma: bağlam menüsü (parça modu)
    touch("touchStart", [(cx,cy)]); time.sleep(0.8); touch("touchEnd", []); time.sleep(0.2)
    print("longpress menu:", pg.locator(".sw-ctx .sw-mi").all_inner_texts()[:4])
    pg.locator(".sw-ctx .sw-mi:has-text('Ekrana')").tap() if pg.locator(".sw-ctx").count() else None
    # eskize gir
    ev("(()=>{const a=window.__app; })()")
    pg.evaluate("window.__app.beginSketchFront && 0")
    pg.locator("#side-close").count()
    # ağaçtan Ön Düzlem + Eskiz (panel açılması gerekebilir)
    ev("document.querySelector('#side').classList.add('open')")
    pg.locator("#tree li:has-text('Ön Düzlem')").tap(); pg.locator("#tree-actions button:has-text('Eskiz')").tap(); time.sleep(0.4)
    print("mode:", ev("window.__app.mode.k"))
    ed("e.opts.quickDim=false; e.setTool('line')"); time.sleep(0.3)
    print("actbar buttons:", pg.locator(".actbar button").all_inner_texts())
    vr = pg.query_selector("#view").bounding_box()
    sc = lambda x,y: pg.evaluate(f"(()=>{{const e=window.__app.mode.editor; const f=e.frame; const yv=[f.n[1]*f.x[2]-f.n[2]*f.x[1], f.n[2]*f.x[0]-f.n[0]*f.x[2], f.n[0]*f.x[1]-f.n[1]*f.x[0]]; const w=[f.o[0]+f.x[0]*{x}+yv[0]*{y}, f.o[1]+f.x[1]*{x}+yv[1]*{y}, f.o[2]+f.x[2]*{x}+yv[2]*{y}]; const s=window.__app.viewer.toScreen(w); const r=window.__app.viewer.renderer.domElement.getBoundingClientRect(); return [r.left+s[0], r.top+s[1]];}})()")
    ax, ay = vr["x"]+100, vr["y"]+250
    # parmakla çiz: dokun, kaydır, kaldır (imleç 70 px yukarıda)
    touch("touchStart", [(ax,ay)]); touch("touchMove", [(ax+5,ay+3)]); time.sleep(0.05)
    print("loupe visible while drawing:", vis(".loupe"), "touch cursor:", vis(".touch-cursor"), "sheet min:", ev("document.querySelector('#side').classList.contains('min')"))
    pg.screenshot(path="mob1_loupe.png")
    exp = pg.evaluate(f"(()=>{{const e=window.__app.mode.editor; const w=window.__app.viewer.pickFrame({ax+5},{ay+3-70},e.frame); const f=e.frame; return [w.x,w.y,w.z]}})()")
    print("expected world (offset 70px):", [round(v,1) for v in exp])
    touch("touchEnd", []); time.sleep(0.1)
    print("after first lift st.last:", ed("return !!e.st.last"), "pts:", ed("return Object.values(d.pts).map(p=>[+p.x.toFixed(1),+p.y.toFixed(1)])"))
    first = ed("return (()=>{const p=Object.values(d.pts)[0]; return [p.x,p.y]})()")
    exp = pg.evaluate(f"(()=>{{const e=window.__app.mode.editor; const p=e.local ? null : null; return null}})()")
    touch("touchStart", [(ax+150,ay+60)]); touch("touchMove", [(ax+160,ay+70)]); touch("touchEnd", []); time.sleep(0.1)
    p2 = pg.evaluate("(()=>{const e=window.__app.mode.editor; const d=e.data; const p=Object.values(d.pts)[0]; const w=e.frame; return null})()")
    touch("touchStart", [(ax+10,ay+75)]); touch("touchMove", [(ax+6,ay+72)]); time.sleep(0.15); pg.screenshot(path="mob1_loupe2.png", clip={"x":0,"y":150,"width":412,"height":350}); touch("touchEnd", []); time.sleep(0.1); pg.keyboard.press("Escape") if False else None
    print("ents after 2nd lift:", ed("return d.ents.map(x=>x.t).join(',')"))
    # ikinci parmak gelince çizim iptal, gezinme
    z0 = ev("window.__app.viewer.camera.zoom")
    touch("touchStart", [(ax+50,ay+200)]); time.sleep(0.05); touch("touchStart", [(ax+50,ay+200),(ax+150,ay+260)])
    touch("touchMove", [(ax+30,ay+180),(ax+190,ay+300)]); touch("touchEnd", []); time.sleep(0.1)
    print("pinch zoom:", z0, "->", round(ev("window.__app.viewer.camera.zoom"),3), "ents unchanged:", ed("return d.ents.length"))
    # iki parmak dokunuşu = geri al
    n0 = ed("return d.ents.length")
    touch("touchStart", [(ax,ay+100),(ax+80,ay+100)]); touch("touchEnd", []); time.sleep(0.3)
    print("two-finger tap undo:", n0, "->", ed("return d.ents.length"), pg.inner_text("#toast") if vis("#toast") else "")
    touch("touchStart", [(ax,ay+100),(ax+80,ay+100),(ax+160,ay+100)]); touch("touchEnd", []); time.sleep(0.3)
    print("three-finger tap redo:", ed("return d.ents.length"))
    pg.locator(".actbar button:has-text('✕')").tap(); pg.locator(".actbar button:has-text('✕')").tap(); time.sleep(0.1)
    # ---- kalem: havada önizleme ve yerleştir
    ed("e.setTool('circle')")
    pen("mouseMoved", ax+200, ay+150); pen("mouseMoved", ax+202, ay+151); time.sleep(0.1)
    print("profile after pen hover:", ev("window.__app.inputProfile && window.__app.inputProfile()"))
    print("pen hover preview:", ed("return !!e.st.inf"))
    pen("mousePressed", ax+200, ay+150, 1, "left"); time.sleep(0.05)
    # avuç reddi: kalem basılıyken dokunuş
    zr = ev("window.__app.viewer.camera.zoom")
    touch("touchStart", [(ax+20,ay+400)]); touch("touchMove", [(ax+60,ay+440)]); touch("touchEnd", [])
    print("palm rejected (zoom/camera same):", zr == ev("window.__app.viewer.camera.zoom"))
    pen("mouseReleased", ax+200, ay+150, 0, "left"); time.sleep(0.1)
    pen("mouseMoved", ax+240, ay+150); pen("mousePressed", ax+240, ay+150, 1, "left"); pen("mouseMoved", ax+245, ay+152, 1); pen("mouseReleased", ax+245, ay+152, 0, "left"); time.sleep(0.1)
    print("circle by pen:", ed("return d.ents.map(x=>x.t).join(',')"))
    # kalem yan tuşu: yukarı sürükle -> Akıllı Ölçü
    time.sleep(0.5)
    pen("mouseMoved", ax+150, ay+300); pen("mousePressed", ax+150, ay+300, 2, "right")
    for k in range(1,8): pen("mouseMoved", ax+150, ay+300-k*10, 2)
    print("pen gesture guide:", pg.locator(".sw-g.on").all_inner_texts())
    pen("mouseReleased", ax+150, ay+230, 0, "right"); time.sleep(0.1)
    print("tool after pen gesture:", ed("return e.tool")); time.sleep(0.6); print("tool 0.6s later:", ed("return e.tool"), ev("window.__app.mode.k"))
    # dairesel menü
    print("before radial:", pg.locator(".actbar button").all_inner_texts(), ev("document.querySelectorAll('.sw-popup').length"))
    bb = pg.locator(".actbar button:has-text('☰')").bounding_box(); print("elemAt:", ev(f"(()=>{{const e=document.elementFromPoint({bb['x']+bb['width']/2},{bb['y']+bb['height']/2}); return e.className+'/'+e.textContent.slice(0,20)}})()"))
    ev("window.__clk=[]; document.addEventListener('click', e=>window.__clk.push(e.target.className+':'+e.target.textContent), true); document.addEventListener('pointerdown', e=>window.__clk.push('pd:'+e.pointerType+':'+e.target.className), true); ['pointerup','pointercancel','touchend','touchcancel'].forEach(t=>document.addEventListener(t, e=>window.__clk.push(t), true)); new MutationObserver(()=>window.__clk.push('mut')).observe(document.querySelector('.actbar'),{childList:true})")
    pg.locator(".actbar button:has-text('☰')").tap(); time.sleep(0.1); print("events:", ev("window.__clk"))
    print("logs so far:", logs[:3]); print("keys:", [ev("document.querySelector('.actbar')._k") for _ in range(3)])
    ev("[...document.querySelectorAll('.actbar button')].find(b=>b.textContent==='☰').click()")
    print("js click popups:", ev("[...document.querySelectorAll('.sw-popup')].map(x=>x.className)")); ev("document.querySelectorAll('.sw-popup').forEach(x=>x.remove())")
    pg.locator(".actbar button:has-text('☰')").tap(); time.sleep(0.1)
    print("popups:", ev("[...document.querySelectorAll('.sw-popup')].map(x=>x.className)"))
    print("radial items:", pg.locator(".sw-radial .sw-rb span").all_inner_texts())
    pg.locator(".sw-radial .sw-rb:has-text('Dikdörtgen')").tap(); print("tool:", ed("return e.tool"))
    pg.screenshot(path="mob1.png")
    print("errors:", logs)

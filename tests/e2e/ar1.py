# ar1 — AR görüntüleme: komut yerleri, AR modeli (metre, taban y=0, ortalı, renk parçaları), USDZ çıktısı (zip),
#        masaüstünde uyarı, telefonda (WebXR / Quick Look yok) kamera önizlemesi açılıp kapanır, iPhone yolunda "AR'de aç" bağlantısı
import cmdpatch, time
from h import *
bad = []
def chk(n, c, i=""):
    print(("TAMAM " if c else "HATA  ") + n, "" if c else i)
    if not c: bad.append(n)
blk = [sketch("s1","S",FRONT,lambda pt,line,rect,c,t: rect(-40,0,40,50)), ext("e1","s1",20)]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=swiftshader","--enable-unsafe-swiftshader","--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream"])
    pg = b.new_page(viewport={"width":1400,"height":900}); pg.goto(URL); wait_ready(pg); time.sleep(0.4); ev = pg.evaluate
    # 80 x 50 x 20 mm blok
    run(pg, "Blok", blk); time.sleep(1)
    m = ev("window.__app.ar.model()")
    print(m)
    chk("AR modeli boyutu 80 × 50 × 20 mm", m and sorted(round(v) for v in m["size"]) == [20,50,80], m)
    chk("metre biriminde, taban y = 0, ortalı", m and abs(m["min"][1]) < 1e-6 and abs(m["min"][0] + m["max"][0]) < 1e-6 and abs(m["min"][2] + m["max"][2]) < 1e-6 and max(m["max"]) < 0.1, m)
    u = ev("window.__app.ar.usdz()")
    chk("USDZ çıktısı zip (PK)", u and u["head"][:2] == [80, 75] and u["n"] > 500, u)
    chk("masaüstünde AR yolu yok", ev("window.__app.ar.kind()") == "none")
    pg.click("[data-tab='evaluate']"); time.sleep(0.3)
    chk("Değerlendir şeridinde AR'de Gör", pg.locator("#cmds button:visible:has-text(\"AR'de Gör\")").count() > 0)
    pg.locator("#cmds button:visible:has-text(\"AR'de Gör\")").first.click(); time.sleep(0.4)
    chk("masaüstünde uyarı", "telefon ve tablette" in (ev("document.querySelector('#toast')?.textContent||''")))
    chk("dosya menüsünde AR", ev("!!document.querySelector('[data-act=\"ar\"]')"))
    # yüz rengi → ayrı renk parçası
    ev("""(()=>{const v=window.__app.viewer;const f=new Map();f.set(0,0x22aa44);v.setColors(0xcc3333,f)})()""")
    time.sleep(0.3)
    m2 = ev("window.__app.ar.model()")
    chk("parça + yüz rengi → 2 renk parçası", m2 and m2["parts"] == 2, m2)
    # telefon: kamera önizlemesi
    ctx = b.new_context(viewport={"width":390,"height":844}, is_mobile=True, has_touch=True)
    pg2 = ctx.new_page(); pg2.goto(URL); wait_ready(pg2); time.sleep(0.4); e2 = pg2.evaluate
    run(pg2, "Blok", blk); time.sleep(1)
    chk("telefonda (WebXR yok) kamera yolu", e2("window.__app.ar.kind()") == "camera", e2("window.__app.ar.kind()"))
    e2("window.__app.ar.open()"); time.sleep(1.5)
    chk("kamera görüntüsü + model tuvali + arayüz", e2("!!document.querySelector('.ar-video') && !!document.querySelector('.ar-canvas') && !!document.querySelector('.ar-ui .ar-close')"))
    pg2.screenshot(path="/home/claude/ar1_cam.png")
    pg2.locator(".ar-close").click(); time.sleep(0.4)
    chk("Kapat ile her şey kalkar", e2("!document.querySelector('.ar-video') && !document.querySelector('.ar-canvas') && !document.querySelector('.ar-ui')"))
    # iPhone yolu: relList 'ar' destekli gibi davran
    e2("""(()=>{const o=DOMTokenList.prototype.supports;DOMTokenList.prototype.supports=function(t){return t==='ar'||o.call(this,t)}})()""")
    chk("Quick Look yolu", e2("window.__app.ar.kind()") == "quicklook")
    e2("window.__app.ar.open()"); time.sleep(2)
    chk("'AR'de aç' bağlantısı rel=ar + blob + img", e2("(()=>{const a=document.querySelector('a.ar-open');return !!a&&a.rel==='ar'&&a.href.startsWith('blob:')&&a.firstElementChild?.tagName==='IMG'})()"))
    pg2.screenshot(path="/home/claude/ar1_ql.png")
    pg2.locator(".ar-ql .ar-btn:has-text('Vazgeç')").click(); time.sleep(0.3)
    chk("Vazgeç kapatır", e2("!document.querySelector('.ar-ql')"))
    b.close()
print("SONUC:", "TAMAM" if not bad else "HATA " + ", ".join(bad))

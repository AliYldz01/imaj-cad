import cmdpatch, time
from playwright.sync_api import sync_playwright
from h import wait_ready, sketch, ext, run, FRONT
ok = True
def chk(name, cond, info=""):
    global ok
    print(("TAMAM " if cond else "HATA  ") + name, info)
    ok = ok and bool(cond)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e))); pg.on("dialog", lambda d: d.accept())
    pg.goto('http://localhost:4173/'); wait_ready(pg); time.sleep(0.4)
    ev = pg.evaluate
    # 10×10 kesit, 100 mm boy (z), çelik konsol; z=0 sabit, z=100'de 100 N −Y
    feats = [sketch("s1","S",FRONT,lambda pt,line,rect,c,t: rect(-5,0,5,10)), ext("e1","s1",100)]
    run(pg, "beam", feats, {"fea": {"fix":[{"c":[0,5,0],"n":[0,0,-1]}], "loads":[{"ref":[{"c":[0,5,100],"n":[0,0,1]}],"kind":"F","v":100,"dir":0}], "n":2000}})
    pg.keyboard.press("Control+7"); pg.keyboard.press("f"); time.sleep(0.3)
    ev("window.__fea.open()"); time.sleep(0.4)
    chk("panel açık", pg.locator(".fea-panel").is_visible() and "(1 YÜZ)" in pg.inner_text(".fea-panel").upper())
    cols = ev("(()=>{const c=window.__app.viewer.modelMesh?.geometry.getAttribute('color');return c?c.count:0})()")
    chk("sabit / yük yüzleri renkli", cols > 0, cols)
    t0 = time.time()
    r = ev("window.__fea.run().then(r=>r&&{vm:r.vmMax,u:r.uMax,ne:r.ne,it:r.iters,re:r.Freac,ok:r.ok})")
    dt = time.time()-t0
    d = 100*100**3/(3*210000*(10*10**3/12))
    chk("sehim ≈ FL³/3EI = %.4f" % d, r and abs(r["u"]-d)/d < 0.06, r)
    chk("tepki 100 N", r and abs(r["re"][1]-100) < 0.5)
    chk("süre < 20 sn", dt < 20, round(dt,1))
    txt = pg.inner_text(".fea-panel")
    chk("sonuç yazıları", "von Mises" in txt and "Güvenlik katsayısı" in txt, txt[-200:])
    pg.select_option(".fea-panel label.pm-field:has-text('Göster') select", "u"); time.sleep(0.3)
    chk("yer değiştirme göstergesi mm", "mm" in pg.inner_text(".fea-leg"))
    pg.click(".fea-panel label.pm-check:has-text('Şekil değiştirmiş') input"); time.sleep(0.3)
    dy = ev("(()=>{const g=window.__app.viewer.modelMesh.geometry.getAttribute('position'), v=window.__app.viewer.mesh.vertices;let m=0;for(let i=0;i<v.length;i++)m=Math.max(m,Math.abs(g.array[i]-v[i]));return m})()")
    chk("abartılı şekil (≈8 mm)", 5 < dy < 10, dy)
    pg.screenshot(path="/home/claude/fea1.png")
    # arayüzle: üst yüzü seç → basınç ekle
    top = ev("(()=>{const v=window.__app.viewer;const s=v.toScreen([0,10,50]);const r=document.querySelector('#view canvas').getBoundingClientRect();return [s[0]+r.left,s[1]+r.top]})()")
    pg.mouse.click(top[0], top[1]); time.sleep(0.3)
    pg.select_option(".fea-panel label.pm-field:has-text('Yük türü') select", "p"); time.sleep(0.2)
    pg.fill(".fea-panel label.pm-field:has-text('Basınç') input", "0.1"); pg.keyboard.press("Tab")
    pg.click(".fea-panel button:has-text('Seçili yüzlere yük ekle')"); time.sleep(0.6); wait_ready(pg)
    L = ev("window.__app.doc.fea.loads")
    chk("basınç yükü eklendi (üst yüz)", len(L)==2 and L[1]["kind"]=="p" and abs(L[1]["ref"][0]["n"][1]-1)<1e-6, L[-1] if L else None)
    chk("sonuç geçersiz oldu", "von Mises" not in pg.inner_text(".fea-panel"))
    r2 = ev("window.__fea.run().then(r=>r&&{u:r.uMax,F:r.Fapp})")
    # basınç 0.1 MPa × 1000 mm² = 100 N daha (−Y)
    chk("toplam yük 200 N −Y", r2 and abs(r2["F"][1]+200) < 1, r2)
    chk("sehim artar", r2 and r2["u"] > r["u"]*1.3, r2 and r2["u"])
    # sabit yok → hata
    ev("window.__app.doc.fea.fix=[]"); 
    r3 = ev("window.__fea.run().then(r=>r)")
    chk("sabitleme yoksa çözmez", r3 is None)
    ev("window.__fea.close()"); time.sleep(0.3)
    chk("kapatınca renkler ve şekil eski", pg.locator(".fea-panel").count()==0 and ev("!window.__app.viewer.modelMesh.geometry.getAttribute('color')"))
    chk("çalışma belgeyle saklanır", ev("window.__app.doc.fea.loads.length")==2)
    chk("sayfa hatası yok", not logs, logs)
    print("SONUC:", "TAMAM" if ok else "HATA")

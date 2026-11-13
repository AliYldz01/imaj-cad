# Paket 5: delik konum eskizi (ölçüyle konum), kaydet / farklı kaydet / son belgeler (dosya erişimi olmadan yedek yol)
import cmdpatch, time, json
from h import *
ok=[]
def chk(n,c,i=""): ok.append(c); print(("TAMAM " if c else "HATA  ")+n, i)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}, accept_downloads=True); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e))); pg.on("dialog", lambda d: d.accept())
    pg.add_init_script("delete window.showSaveFilePicker; delete window.showOpenFilePicker;")
    pg.goto(URL); wait_ready(pg); time.sleep(0.4)
    plate = [sketch("s1","S",TOP,lambda pt,line,rect,c,t: rect(0,0,100,60)), ext("e1","s1",10)]
    fr={"o":[50,10,-30],"x":[1,0,0],"n":[0,1,0]}
    hole={"id":"h1","type":"hole","name":"Delik1","htype":"simple","size":"custom","d":8,"depth":10,"through":True,"cd":0,"cdepth":0,"cangle":90,"plane":{"k":"face","frame":fr,"face":{"c":[50,10,-30],"n":[0,1,0]}},"pts":[[-30,10],[30,10]]}
    run(pg,"delikli", plate+[hole]); f0 = pg.evaluate("window.__app.viewer.mesh.faces.length")
    # PM'de konumları eskize aktar
    pg.evaluate("(()=>{const a=window.__app;})()")
    pg.click("#tree li:has-text('Delik1')", click_count=2); time.sleep(0.6)
    pg.click("#pm-body button:has-text('Konumları eskize aktar')"); time.sleep(0.4)
    pg.click("#pm-ok"); time.sleep(0.4); wait_ready(pg)
    sk = pg.evaluate("window.__app.doc.features.find(f=>f.name.includes('delik konumu'))")
    chk("konum eskizi oluştu, delik ona bağlı", sk and pg.evaluate("window.__app.doc.features.find(f=>f.id==='h1').sketch")==sk["id"])
    chk("delik sayısı aynı", pg.evaluate("window.__app.viewer.mesh.faces.length")==f0)
    # eskizde noktayı taşı (ölçüyle konum değişimi gibi): x -30 → -40
    pg.evaluate(f"(()=>{{const a=window.__app; const d=JSON.parse(JSON.stringify(a.doc)); const s=d.features.find(f=>f.id==='{sk['id']}'); const p=s.data.pts; for(const k in p) if (p[k].x<0) p[k].x=-40; a.setDoc(d);}})()"); time.sleep(0.4); wait_ready(pg)
    cyl = pg.evaluate("window.__app.viewer.mesh.faces.filter(f=>f.r).map(f=>+f.ac[0].toFixed(2))")
    chk("delik eskizle taşındı (x=10 ve x=80)", 10.0 in cyl and 80.0 in cyl, cyl)
    # kaydet (yedek yol: ad sorulur, indirilir) + son belgeler
    with pg.expect_download() as dl: pg.evaluate("document.querySelector('#file-menu button[data-act=save]').click()")
    chk("kaydet → .icad indirildi", dl.value.suggested_filename.endswith(".icad"), dl.value.suggested_filename)
    rec = pg.evaluate("JSON.parse(localStorage.getItem('imajcad.recent')||'[]').length")
    chk("son belgelere eklendi", rec >= 1, rec)
    run(pg, "başka", plate)
    pg.evaluate("document.querySelector('#file-menu button[data-act=recent]').click()"); time.sleep(0.3)
    pg.click("dialog[open] button:has-text('Aç')"); time.sleep(0.6); wait_ready(pg)
    chk("son belgeden açıldı (delikli belge)", pg.evaluate("window.__app.doc.features.some(f=>f.id==='h1')"))
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

# Parça özellikleri 8: ağaç klasörleri, "Ne yanlış?" + geometri kontrolü, sarı önizleme (radyüs / kabuk)
import cmdpatch, time, math, json
from h import *
ok=[]
def chk(n,c,i=""): ok.append(c); print(("TAMAM " if c else "HATA  ")+n, i)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    ans = {"v": "Gövde"}
    pg.on("dialog", lambda d: d.accept(ans["v"]))
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    ev = pg.evaluate
    base = [sketch("s1","S",FRONT,lambda pt,line,rect,c,t: rect(0,0,40,40)), ext("e1","s1",20), sketch("s2","S2",FRONT,lambda pt,line,rect,c,t: c(20,20,5)), ext("e2","s2",30)]
    run(pg,"iki özellik",base)
    pg.click("#tree li:has-text('e1')"); time.sleep(0.2)
    pg.click("#tree-actions button:has-text('Klasöre ekle')"); time.sleep(0.6); wait_ready(pg)
    chk("klasöre eklendi", ev("window.__app.doc.features.find(f=>f.id==='e1').folder")=="Gövde")
    chk("ağaçta klasör başlığı", pg.is_visible("#tree li.folder:has-text('Gövde')"))
    pg.click("#tree li:has-text('e2')"); time.sleep(0.2)
    pg.click("#tree-actions button:has-text('Klasöre ekle')"); time.sleep(0.6); wait_ready(pg)
    fs = ev("window.__app.doc.features.map(f=>[f.id,f.folder||''])")
    chk("ikinci özellik aynı klasörde (ardışık)", [x for x in fs if x[1]=="Gövde"]==[["e1","Gövde"],["e2","Gövde"]] or sum(1 for x in fs if x[1]=="Gövde")==2, fs)
    chk("tek başlık", pg.locator("#tree li.folder").count()==1)
    pg.click("#tree li.folder .ftog"); time.sleep(0.3)
    chk("klasör kapanınca öğeler gizli", not pg.is_visible("#tree li:has-text('e2')"))
    pg.click("#tree-actions button:has-text('Aç')"); time.sleep(0.3)
    chk("aç", pg.is_visible("#tree li:has-text('e2')"))
    ans["v"] = "Ana"
    pg.click("#tree li.folder"); time.sleep(0.2)
    pg.click("#tree-actions button:has-text('Klasörü adlandır')"); time.sleep(0.5); wait_ready(pg)
    chk("klasör adı değişti", ev("window.__app.doc.features.filter(f=>f.folder==='Ana').length")==2)
    pg.click("#tree li.folder"); time.sleep(0.2)
    if not pg.is_visible("#tree-actions button:has-text('Klasörü bastır')"): pg.click("#tree li.folder"); time.sleep(0.2)
    pg.click("#tree-actions button:has-text('Klasörü bastır')"); time.sleep(0.6); wait_ready(pg)
    chk("klasörü bastır → iki özellik kapalı", ev("window.__app.doc.features.filter(f=>f.folder==='Ana'&&f.off).length")==2)
    # Ne yanlış?
    bad = base + [{"id":"f1","type":"fillet","name":"Radyüs1","r":2,"edges":[{"m":[200,200,200],"d":[1,0,0]}]}]
    run(pg,"hatalı",bad)
    pg.click("#status"); time.sleep(0.4)
    chk("durum çubuğundan Ne yanlış? penceresi", pg.is_visible("dialog.whatswrong") and pg.is_visible("dialog.whatswrong .ww-row:has-text('Radyüs1')"))
    pg.click("dialog.whatswrong button:has-text('Geometriyi kontrol et')"); time.sleep(1.5)
    gc = ev("window.__geomCheck")
    chk("geometri kontrolü: gövde geçerli, serbest kenar yok", gc and gc["bodies"] and all(x["valid"] and x["free"]==0 for x in gc["bodies"]), gc)
    pg.click("dialog.whatswrong button:has-text('Bastır')"); time.sleep(0.8); wait_ready(pg)
    chk("Bastır düğmesi hatayı giderir", ev("window.__app.doc.features.find(f=>f.id==='f1').off")==True and not pg.eval_on_selector_all("#tree li.err","e=>e.length"))
    # sarı önizleme
    run(pg,"kutu",base[:2])
    ev("document.querySelector(\"#cmds button[title='Radyüs']\")?.click()"); time.sleep(0.5)
    ei = ev("window.__app.viewer.mesh.edges.findIndex(e=>Math.hypot(e.m[0]-20,e.m[1]-40,e.m[2]-20)<1e-3)")
    ev(f"window.__app.pmPick({{kind:'edge', index:{ei}}})"); time.sleep(2); wait_ready(pg)
    gh = ev("(()=>{const g=window.__app.viewer.ghost; return g? g.children[0].geometry.getAttribute('position').count : 0})()")
    chk("radyüs PM: sarı önizleme görünür", gh > 0, gh)
    f0 = ev("window.__app.viewer.mesh.faces.length")
    chk("seçim için ana model değişmedi (6 yüz)", f0==6, f0)
    pg.click("#pm-ok"); time.sleep(1); wait_ready(pg)
    chk("onaylayınca önizleme kalkar", not ev("!!window.__app.viewer.ghost"))
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

# Montaj kesme / delik (montaj özelliği) ve delik hizalama
import cmdpatch, time, json
from h import *
ok=[]
def chk(n,c,i=""): ok.append(c); print(("TAMAM " if c else "HATA  ")+n, i)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e))); pg.on("dialog", lambda d: d.accept())
    pg.goto(URL); wait_ready(pg); time.sleep(0.4)
    ev = pg.evaluate
    asm = lambda js: ev(f"(async()=>{{const a=window.__app.asm; {js}}})()")
    plate = [sketch("s1","S",TOP,lambda pt,line,rect,c,t: rect(-50,-50,50,50)), ext("e1","s1",10)]
    pg.click("#tabs button[data-tab='asm']"); time.sleep(0.3)
    pg.click("#cmds button:has-text('Montajı Aç')"); time.sleep(0.5)
    asm(f"a.addComp({{name:'Alt', features:{json.dumps(plate)}}})"); time.sleep(2); wait_ready(pg)
    asm(f"a.addComp({{name:'Üst', features:{json.dumps(plate)}}})"); time.sleep(2); wait_ready(pg)
    asm("a.doc.comps[1].p=[0,10,0]; a.draw(); return 0")
    nf = lambda i: asm(f"return a.meshes.get(a.doc.comps[{i}].id).faces.length")
    f0 = [nf(0), nf(1)]
    pg.click("#cmds button:has-text('Montaj Kesme')"); time.sleep(0.3)
    pg.keyboard.press("f"); time.sleep(0.3)
    r = pg.query_selector("#view").bounding_box()
    for w in ([0,20,0],[25,20,0]):
        sp = ev(f"window.__app.viewer.toScreen({w})"); pg.mouse.click(r["x"]+sp[0], r["y"]+sp[1]); time.sleep(0.2)
    chk("2 konum seçildi", "·" in pg.inner_text("#pm-body"), pg.inner_text("#pm-body")[-150:])
    pg.click("#pm-ok"); time.sleep(3); wait_ready(pg)
    f1 = [nf(0), nf(1)]
    chk("iki plakada da 2 delik (yüz sayısı arttı)", f1[0] > f0[0] and f1[1] > f0[1], (f0, f1))
    chk("parça dosyası değişmedi", asm("return a.doc.comps[0].part.features.length")==2)
    chk("ağaçta montaj özelliği", "Montaj Deliği1" in pg.inner_text("#tree"))
    # delik hizalama: delikler hizalı → hata yok
    chk("hizalı delikler: rapor boş", asm("return a.holeAlignment().length")==0, asm("return a.holeAlignment()"))
    # üst plakayı 0.4 mm kaydır → 2 hizasız delik (montaj özelliği bileşene bağlı: delikler de kayar)
    asm("a.doc.comps[1].p=[0.4,10,0]; a.draw(); return 0")
    rows = asm("return a.holeAlignment()")
    chk("kaydırılmış plaka: 2 hizasız delik, sapma 0.4", len(rows)==2 and all(abs(x["off"]-0.4)<1e-3 for x in rows), rows)
    pg.click("#cmds button:has-text('Delik Hizalama')"); time.sleep(0.3)
    chk("pencere", "hizasız" in pg.inner_text("dialog[open]")); pg.click("dialog[open] button:has-text('Kapat')")
    # bastır → delikler kalkar
    asm("a.doc.feats[0].off=true; await a.refresh(); return 0"); time.sleep(0.5)
    chk("bastırınca delik yok", [nf(0), nf(1)]==f0, [nf(0), nf(1)])
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

# Teknik resim: parça (ön/üst/sol, izometrik, kesit A-A, ölçüler, antet, DXF) ve montaj resmi (balon + malzeme listesi)
import cmdpatch, time, json
from h import *
ok=[]
def chk(n,c,i=""): ok.append(c); print(("TAMAM " if c else "HATA  ")+n, i)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}, accept_downloads=True); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e))); pg.on("dialog", lambda d: d.accept())
    pg.goto(URL); wait_ready(pg); time.sleep(0.4)
    feats=[sketch("s1","S",FRONT,lambda pt,line,rect,c,t: (rect(0,0,80,50), c(20,25,6), c(60,25,6), c(40,25,10))), ext("e1","s1",20)]
    run(pg,"parça",feats)
    pg.evaluate("localStorage.setItem('imajcad.techdraw', JSON.stringify({iso:true, section:true, dims:true, paper:'A4'}))")
    pg.click("#tabs button[data-tab='evaluate']"); time.sleep(0.2)
    pg.click("#cmds button:has-text('Teknik Resim')"); time.sleep(6)
    svg = pg.evaluate("document.querySelector('dialog[open]')?._svg || ''")
    chk("pencere + SVG", len(svg) > 2000, len(svg))
    for t in ["ÖN GÖRÜNÜŞ","ÜST GÖRÜNÜŞ","SOL GÖRÜNÜŞ","İZOMETRİK","KESİT A-A"]: chk("görünüş "+t, t in svg)
    chk("delik çapları 2× Ø12 ve Ø20", "2× Ø12" in svg and "Ø20" in svg)
    chk("toplam ölçüler 80 / 50 / 20", ">80<" in svg and ">50<" in svg and ">20<" in svg)
    chk("kesit taraması", 'fill="url(#hatch)"' in svg)
    chk("antet + ölçek", "İlk açı (ISO E)" in svg and "Resim no" in svg)
    pg.locator("dialog[open] iframe").screenshot(path="/home/claude/td1_part.png")
    with pg.expect_download() as dl: pg.click("dialog[open] button:has-text('DXF indir')")
    dx = open(dl.value.path()).read(); chk("DXF: LINE + CIRCLE + TEXT", "LINE" in dx and "CIRCLE" in dx and "TEXT" in dx, len(dx))
    pg.click("dialog[open] button:has-text('Kapat')")
    # montaj resmi
    plate = [sketch("s1","S",TOP,lambda pt,line,rect,c,t: (rect(-50,-50,50,50), c(0,0,5))), ext("e1","s1",10)]
    pin = [sketch("s1","S",TOP,lambda pt,line,rect,c,t: c(0,0,4.9)), ext("e1","s1",30)]
    pg.click("#tabs button[data-tab='asm']"); time.sleep(0.3)
    pg.click("#cmds button:has-text('Montajı Aç')"); time.sleep(0.5)
    asm = lambda js: pg.evaluate(f"(async()=>{{const a=window.__app.asm; {js}}})()")
    asm(f"a.addComp({{name:'Plaka', features:{json.dumps(plate)}}})"); time.sleep(2); wait_ready(pg)
    asm(f"a.addComp({{name:'Pim', features:{json.dumps(pin)}}}); "); time.sleep(2); wait_ready(pg)
    asm(f"a.addComp({{name:'Pim', features:{json.dumps(pin)}}}); a.doc.comps[1].p=[0,10,0]; a.doc.comps[2].p=[30,10,30]; return 0"); time.sleep(2); wait_ready(pg)
    pg.click("#cmds button:has-text('Montaj Resmi')"); time.sleep(8)
    svg = pg.evaluate("document.querySelector('dialog[open]')?._svg || ''")
    chk("montaj resmi: malzeme listesi", "Parça adı" in svg and ">Pim<" in svg and ">Plaka<" in svg)
    chk("balonlar (2 balon: 1, 2)", svg.count('r="4"') == 2, svg.count('r="4"'))
    pg.locator("dialog[open] iframe").screenshot(path="/home/claude/td1_asm.png")
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

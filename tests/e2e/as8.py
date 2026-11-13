# Montaj modu: paneller ✕ / Esc / tekrar basma ile kapanır, montaj geri al, Delete, sağ tık menüsü, telefon ✕
import cmdpatch, time, json
from h import *
ok=[]
def chk(n,c,i=""): ok.append(c); print(("TAMAM " if c else "HATA  ")+n, i)
plate = [sketch("s1","S",TOP,lambda pt,line,rect,c,t: rect(-50,-50,50,50)), ext("e1","s1",10)]
PANELS = ["Eşleşme","Bileşeni Taşı","Bileşeni Döndür","Bileşen Çoğalt","Bileşen Aynala","Montaj Kesme","Patlatılmış Görünüm","Bağlantı Elemanı","Hareket Etüdü","Montaj Kesiti"]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e))); pg.on("dialog", lambda d: d.accept())
    pg.goto(URL); wait_ready(pg); time.sleep(0.4)
    ev = pg.evaluate
    asm = lambda js: ev(f"(async()=>{{const a=window.__app.asm; {js}}})()")
    run(pg, "parça", plate)
    nfeat = lambda: ev("window.__app.doc ? window.__app.doc.features.length : JSON.parse(localStorage.getItem('imajcad.doc')||'{}').features?.length")
    pf0 = nfeat()
    pg.click("#tabs button[data-tab='asm']"); time.sleep(0.5)
    if not asm("return a.on"): pg.click("#cmds button:has-text('Montajı Aç')"); time.sleep(0.5)
    asm("if (a.doc.comps.length) { a.removeComps(a.doc.comps.map(c=>c.id)); } return 0")
    asm(f"await a.addComp({{name:'Alt', features:{json.dumps(plate)}}}); return 0"); time.sleep(1.5); wait_ready(pg)
    asm(f"await a.addComp({{name:'Üst', features:{json.dumps(plate)}}}); return 0"); time.sleep(1.5); wait_ready(pg)
    asm("a.doc.comps[1].p=[0,30,0]; a.doc.comps[1].fixed=false; a.save(); a.draw(); return 0")
    pg.keyboard.press("f"); time.sleep(0.3)
    pmOpen = lambda: not ev("document.querySelector('#pm').hidden")
    # A1: her panel ✕, Esc ve aynı komuta yeniden basma ile kapanır
    asm("a.sel=a.doc.comps[1].id; a.selSet=new Set([a.sel]); return 0")
    for name in PANELS:
        sel = f"#cmds button:has-text('{name}')"
        res = []
        for how in ("x","esc","again"):
            asm("a.sel=a.doc.comps[1].id; a.selSet=new Set([a.sel]); return 0")
            pg.click(sel); time.sleep(0.4)
            opened = pmOpen()
            if how=="x": pg.click("#pm-cancel")
            elif how=="esc": pg.keyboard.press("Escape")
            else: pg.click(sel)
            time.sleep(0.4)
            res.append((opened, pmOpen()))
            if pmOpen(): ev("document.querySelector('#pm-cancel').click()"); time.sleep(0.3)
        chk(f"{name}: açılır ve ✕ / Esc / tekrar basma kapatır", all(o and not c for o,c in res), res)
    # B6: boş seçimle ✓ eşleşme panelini kapatır
    pg.click("#cmds button:has-text('Eşleşme')"); time.sleep(0.3); pg.click("#pm-ok"); time.sleep(0.3)
    chk("eşleşme: seçimsiz ✓ kapatır", not pmOpen() and asm("return !a.mateDraft"))
    # B5: seçim yokken Taşı paneli açılır
    pg.keyboard.press("Escape"); time.sleep(0.2)
    chk("Esc montaj seçimini temizler (B12)", asm("return a.sel===null && a.selSet.size===0"))
    pg.click("#cmds button:has-text('Bileşeni Taşı')"); time.sleep(0.3)
    chk("seçimsiz Taşı paneli açılır (B5)", pmOpen()); pg.click("#pm-cancel"); time.sleep(0.2)
    # A3: Ctrl+Z montajı geri alır, parça değişmez
    asm("a.doc.comps[1].p=[20,30,0]; a.save(); a.draw(); return 0")
    pg.keyboard.press("Control+z"); time.sleep(1.5); wait_ready(pg)
    chk("Ctrl+Z bileşen konumunu geri alır", asm("return a.doc.comps[1].p[0]")==0, asm("return a.doc.comps[1].p"))
    chk("parça belgesi değişmedi", nfeat()==pf0, (pf0, nfeat()))
    pg.keyboard.press("Control+y"); time.sleep(1.5); wait_ready(pg)
    chk("Ctrl+Y ileri alır", asm("return a.doc.comps[1].p[0]")==20, asm("return a.doc.comps[1].p"))
    # B2: sağ tık bileşen menüsü
    r = pg.query_selector("#view").bounding_box()
    sp = ev("(()=>{const a=window.__app.asm,c=a.doc.comps[1]; return window.__app.viewer.toScreen([c.p[0],c.p[1]+10,c.p[2]])})()")
    pg.mouse.click(r["x"]+sp[0], r["y"]+sp[1], button="right"); time.sleep(0.4)
    menu = pg.inner_text(".sw-ctx") if pg.query_selector(".sw-ctx") else ""
    chk("sağ tık: bileşen menüsü (parça komutları yok)", "Parçayı düzenle" in menu and "Gizle" in menu and "Ekstrüzyon" not in menu, menu.replace("\n"," | "))
    chk("sağ tık bileşeni seçti", asm("return a.sel")==asm("return a.doc.comps[1].id"))
    pg.keyboard.press("Escape"); time.sleep(0.2)
    # B1: Delete seçili bileşeni siler; Ctrl+Z geri getirir
    asm("a.sel=a.doc.comps[1].id; a.selSet=new Set([a.sel]); return 0")
    pg.mouse.move(r["x"]+20, r["y"]+r["height"]-20)
    pg.keyboard.press("Delete"); time.sleep(0.5)
    chk("Delete bileşeni siler", asm("return a.doc.comps.length")==1)
    pg.keyboard.press("Control+z"); time.sleep(2); wait_ready(pg)
    chk("geri al bileşeni geri getirir", asm("return a.doc.comps.length")==2)
    chk("undo düğmesi montaja bağlı", not ev("document.querySelector('#undo').disabled"))
    # A2 / B4: telefon boyutunda ✕ dokunulabilir, ekran çubuğu montaj düğmeleri
    pg.set_viewport_size({"width":390,"height":844})
    ev("localStorage.setItem('imajcad.input', JSON.stringify({...JSON.parse(localStorage.getItem('imajcad.input')||'{}'), actionBar:'on'}))")
    pg.reload(); wait_ready(pg); time.sleep(0.5)
    pg.click("#tabs button[data-tab='asm']"); time.sleep(1.5); wait_ready(pg)
    if not asm("return a.on"): pg.click("#cmds button:has-text('Montajı Aç')"); time.sleep(1.5); wait_ready(pg)
    ab0 = ev("[...document.querySelectorAll('.actbar button')].map(b=>b.textContent)")
    chk("ekran çubuğu montajda: parça düğmeleri yok (B4)", ab0 and "✚" not in ab0 and "Tümü" not in ab0 and "⊥" in ab0, ab0)
    asm("a.sel=a.doc.comps[1].id; a.selSet=new Set([a.sel]); return 0")
    pg.evaluate("window.__app.asm.startMate()"); time.sleep(0.6)
    cb = pg.query_selector("#pm-cancel").bounding_box()
    top = ev(f"document.elementFromPoint({cb['x']+cb['width']/2},{cb['y']+cb['height']/2})?.id")
    chk("telefonda ✕ örtülü değil", top=="pm-cancel", top)
    ab = ev("[...document.querySelectorAll('.actbar button')].map(b=>b.textContent)")
    chk("ekran çubuğu: panel açıkken ✓ ✕", ("✓" in ab and "✕" in ab), ab)
    pg.click("#pm-cancel"); time.sleep(0.3)
    chk("telefonda ✕ paneli kapatır", not pmOpen())
    pg.screenshot(path="/home/claude/as8_phone.png")
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

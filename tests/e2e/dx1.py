# DXF içe aktarma: dikdörtgen (LWPOLYLINE kapalı) + daire + yay + çizgi → eskiz; kapalı bölge ekstrüde edilir
import cmdpatch, time
from h import *
ok=[]
def chk(n,c,i=""): ok.append(c); print(("TAMAM " if c else "HATA  ")+n, i)
DXF = "\n".join(["0","SECTION","2","ENTITIES",
 "0","LWPOLYLINE","8","0","90","4","70","1","10","0","20","0","10","80","20","0","10","80","20","50","10","0","20","50",
 "0","CIRCLE","8","0","10","20","20","25","40","8",
 "0","ARC","8","0","10","60","20","25","40","10","50","0","51","180",
 "0","LINE","8","0","10","50","20","25","11","70","21","25",
 "0","ENDSEC","0","EOF"])
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.4)
    pg.click("#tree li:has-text('Ön Düzlem')"); pg.click("#tree-actions button:has-text('Eskiz')"); time.sleep(0.4)
    n = pg.evaluate(f"window.__app.mode.editor.importDxf({DXF!r})")
    chk("7 öğe (4 çizgi + daire + yay + çizgi)", n == 7, n)
    ents = pg.evaluate("window.__app.mode.editor.data.ents.map(e=>e.t).sort().join(',')")
    chk("türler", ents == "arc,circle,line,line,line,line,line", ents)
    chk("dikdörtgen köşeleri birleşik (4 nokta)", pg.evaluate("new Set(window.__app.mode.editor.data.ents.filter(e=>e.t==='line').slice(0,4).flatMap(e=>[e.p1,e.p2])).size")==4)
    chk("çözüldü", pg.evaluate("window.__app.mode.editor.result.ok"))
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

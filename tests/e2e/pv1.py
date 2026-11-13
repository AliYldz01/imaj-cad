# Perspektif görünüm: seçim ve ekrana izdüşüm perspektif kamerayla tutarlı; birim inç: alan dönüşümü
import cmdpatch, time
from h import *
ok=[]
def chk(n,c,i=""): ok.append(c); print(("TAMAM " if c else "HATA  ")+n, i)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.4)
    run(pg,"kutu",[sketch("s1","S",FRONT,lambda pt,line,rect,c,t: rect(0,0,40,30)), ext("e1","s1",20)])
    pg.keyboard.press("f"); time.sleep(0.3)
    pg.evaluate("window.__app.viewer.setPerspective(true)"); time.sleep(0.3)
    r = pg.query_selector("#view").bounding_box()
    sp = pg.evaluate("window.__app.viewer.toScreen([20,15,20])")
    hit = pg.evaluate(f"(()=>{{const h=window.__app.viewer.pick({r['x']}+{sp[0]},{r['y']}+{sp[1]},{{face:true}}); const m=window.__app.viewer.mesh; return h && h.kind==='face' && m.faces[h.index].n}})()")
    chk("perspektifte ön yüz merkezine tıklama ön yüzü seçer", hit and abs(hit[2]-1)<1e-6, hit)
    sp2 = pg.evaluate("window.__app.viewer.toScreen([0,30,20])"); sp3 = pg.evaluate("window.__app.viewer.toScreen([0,30,0])")
    pg.evaluate("window.__app.viewer.setPerspective(false)"); time.sleep(0.2)
    so2 = pg.evaluate("window.__app.viewer.toScreen([0,30,20])"); so3 = pg.evaluate("window.__app.viewer.toScreen([0,30,0])")
    chk("perspektif izdüşüm ortografikten farklı", abs((sp2[0]-sp3[0])-(so2[0]-so3[0]))>0.5, (sp2,sp3,so2,so3))
    pg.evaluate("localStorage.setItem('imajcad.units','in')"); pg.reload(); wait_ready(pg); time.sleep(0.4)
    run(pg,"kutu",[sketch("s1","S",FRONT,lambda pt,line,rect,c,t: rect(0,0,40,30)), ext("e1","s1",25.4)])
    pg.click("#tree li:has-text('e1')", click_count=2); time.sleep(0.6)
    txt = pg.inner_text("#pm-body")
    chk("inç modunda derinlik alanı 'in' ve 1", "(in)" in txt and pg.evaluate("[...document.querySelectorAll('#pm-body input')].some(i=>i.value==='1')"), txt[:200])
    pg.evaluate("localStorage.setItem('imajcad.units','mm')")
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

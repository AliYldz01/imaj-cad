# Basit mukavemet analizi: 1000×100×50 çubuk, konsol 1000 N → σ 24 MPa, δ 1.524 mm; yön Y → σ 12; basit mesnet; boru kesit atalet
import cmdpatch, time
from h import *
ok=[]
def chk(n,c,i=""): ok.append(c); print(("TAMAM " if c else "HATA  ")+n, i)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.4)
    run(pg,"çubuk",[sketch("s1","S",FRONT,lambda pt,line,rect,c,t: rect(0,0,1000,100)), ext("x","s1",50)])
    pg.click("#tabs button[data-tab='evaluate']"); time.sleep(0.2)
    pg.click("#cmds button:has-text('Mukavemet')"); time.sleep(1.5)
    res = lambda: pg.evaluate("document.querySelector('dialog.analysis-dialog').__res")
    r = res()
    chk("konsol σ ≈ 24 MPa", r and abs(r["sig"]-24)<0.2, r)
    chk("sehim ≈ 1.524 mm", r and abs(r["d"]-1.524)<0.01, r and r["d"])
    sel = pg.locator("dialog.analysis-dialog select")
    sel.nth(3).select_option(index=1); time.sleep(0.3); r=res()
    chk("diğer yön σ ≈ 12 MPa", r and abs(r["sig"]-12)<0.15, r and r["sig"])
    sel.nth(1).select_option("simple"); time.sleep(0.3); r=res()
    chk("basit mesnet σ ≈ 3 MPa", r and abs(r["sig"]-3)<0.05, r and r["sig"])
    pg.screenshot(path="/home/claude/an1.png")
    pg.keyboard.press("Escape"); time.sleep(0.3)
    run(pg,"boru",[sketch("s2","S",FRONT,lambda pt,line,rect,c,t: (c(0,0,30),c(0,0,25))), ext("x","s2",800)])
    bm = pg.evaluate("window.__app.kernel.beam(-1)")
    I = 3.14159265/64*(60**4-50**4)
    chk("boru I ≈ π/64(D⁴−d⁴)", bm and abs(bm["Iu"]-I)/I<0.01, (bm and bm["Iu"], I))
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

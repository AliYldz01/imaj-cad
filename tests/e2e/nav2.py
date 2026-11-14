# nav2 — kaydırırken görünüm kendiliğinden ortalanmaz: Ctrl+orta kısa vuruşlar ve tekerlek arası orta tıklar sığdırmaz;
#        telefonda kısa iki parmak kaydırması geri al sayılmaz; gerçek çift orta tık ve iki parmak dokunuşu çalışır
import cmdpatch, time
from h import *
bad = []
def chk(n, c, i=""):
    print(("TAMAM " if c else "HATA  ") + n, "" if c else i)
    if not c: bad.append(n)
plate = [sketch("s1","S",TOP,lambda pt,line,rect,c,t: rect(-50,-50,50,50)), ext("e1","s1",10)]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); pg.goto(URL); wait_ready(pg); time.sleep(0.4)
    ev = pg.evaluate
    run(pg, "parça", plate); time.sleep(0.6)
    T = lambda: [round(v,1) for v in ev("window.__app.viewer.controls.target.toArray()")] + [round(ev("window.__app.viewer.camera.zoom"),3)]
    pg.mouse.move(700,500); pg.keyboard.down("Control"); pg.mouse.down(button="middle"); pg.mouse.move(900,560,steps=8); pg.mouse.up(button="middle"); pg.keyboard.up("Control")
    pg.mouse.wheel(0,-300); time.sleep(0.3); pg.mouse.move(600,400); t0 = T()
    for i in range(3):
        pg.mouse.move(600,400); pg.keyboard.down("Control"); pg.mouse.down(button="middle"); pg.mouse.move(601+i,400); pg.mouse.up(button="middle"); pg.keyboard.up("Control"); time.sleep(0.12)
    t1 = T()
    chk("Ctrl+orta kısa vuruşlar görünümü ortalamaz (yalnız birkaç px kayar)", t1[3] == t0[3] and max(abs(t1[k]-t0[k]) for k in range(3)) < 12, (t0, t1))
    pg.mouse.move(600,400); pg.mouse.down(button="middle"); pg.mouse.up(button="middle"); pg.mouse.wheel(0,60); time.sleep(0.1); t2 = T()
    pg.mouse.down(button="middle"); pg.mouse.up(button="middle"); time.sleep(0.3)
    chk("tekerlek arasındaki iki orta tık sığdırmaz", T() == t2, (t2, T()))
    time.sleep(0.6); pg.mouse.move(200,700); pg.mouse.down(button="middle"); pg.mouse.up(button="middle"); time.sleep(0.1); pg.mouse.move(500,300); pg.mouse.down(button="middle"); pg.mouse.up(button="middle"); time.sleep(0.3)
    chk("farklı yerlerdeki iki orta tık sığdırmaz", T() == t2, (t2, T()))
    time.sleep(0.6); pg.mouse.move(600,400); pg.mouse.down(button="middle"); pg.mouse.up(button="middle"); time.sleep(0.1); pg.mouse.down(button="middle"); pg.mouse.up(button="middle"); time.sleep(0.4)
    chk("aynı yerde çift orta tık sığdırır", T() != t2, T())
    # telefon
    ctx = b.new_context(viewport={"width":390,"height":844}, is_mobile=True, has_touch=True)
    pg = ctx.new_page(); pg.goto(URL); wait_ready(pg); time.sleep(0.4); ev = pg.evaluate; cdp = ctx.new_cdp_session(pg)
    run(pg, "parça", plate); time.sleep(0.8)
    ev("window.__app.setDoc && 0")
    def touch(t, pts): cdp.send("Input.dispatchTouchEvent", {"type":t,"touchPoints":[{"x":x,"y":y,"id":i} for i,(x,y) in enumerate(pts)]})
    nf = lambda: ev("window.__app.doc.features.length")
    def pan2(x0,y0,dx,dy,n=4):
        touch("touchStart",[(x0,y0)]); touch("touchStart",[(x0,y0),(x0+80,y0)])
        for i in range(1,n+1): touch("touchMove",[(x0+dx*i/n,y0+dy*i/n),(x0+80+dx*i/n,y0+dy*i/n)]); time.sleep(0.015)
        touch("touchEnd",[]); time.sleep(0.4)
    n0 = nf()
    pan2(150,400,8,6); pan2(150,400,7,-6,2)
    chk("telefon: kısa iki parmak kaydırması geri almaz", nf() == n0, (n0, nf()))
    touch("touchStart",[(150,400)]); time.sleep(0.3); touch("touchStart",[(150,400),(230,400)]); time.sleep(0.05); touch("touchEnd",[]); time.sleep(0.4)
    chk("telefon: parmaklar ayrı ayrı inerse (tutup ikinci parmak) geri almaz", nf() == n0, (n0, nf()))
    touch("touchStart",[(150,400),(230,400)]); time.sleep(0.06); touch("touchEnd",[]); time.sleep(0.5)
    chk("telefon: gerçek iki parmak dokunuşu geri alır", nf() != n0, (n0, nf()))
    b.close()
print("SONUC:", "HATA" if bad else "TAMAM")

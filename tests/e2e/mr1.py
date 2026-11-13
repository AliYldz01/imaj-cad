# SolidWorks orta tuşla döndürme merkezi: imleç altındaki köşe / yüz noktası yerinde kalır, boşlukta model merkezi,
# orta tık + sürükle = varlık (kenar ekseni) etrafında, işaret, çift orta tık sığdır, Ctrl+orta kaydır
import cmdpatch, time, json, math
from h import *
ok=[]
def chk(n,c,i=""): ok.append(c); print(("TAMAM " if c else "HATA  ")+n, i)
box = [sketch("s1","S",TOP,lambda pt,line,rect,c,t: rect(-50,-25,50,25)), ext("e1","s1",20)]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.4)
    ev = pg.evaluate
    run(pg, "kutu", box)
    pg.keyboard.press("f"); time.sleep(0.3)
    R = pg.query_selector("#view").bounding_box()
    scr = lambda w: (lambda s: (R["x"]+s[0], R["y"]+s[1]))(ev(f"window.__app.viewer.toScreen({json.dumps(w)})"))
    def mdrag(x, y, dx, dy, mods=None):
        pg.mouse.move(x, y)
        if mods: pg.keyboard.down(mods)
        pg.mouse.down(button="middle")
        for k in range(1, 7): pg.mouse.move(x+dx*k/6, y+dy*k/6); time.sleep(0.02)
        mark = ev("window.__app.viewer.pivotMark.children.length")
        pg.mouse.up(button="middle")
        if mods: pg.keyboard.up(mods)
        time.sleep(0.4)
        return mark
    d = lambda a, b: math.hypot(a[0]-b[0], a[1]-b[1])
    # 1) köşe: imleç köşenin yakınında → köşe ekranda yerinde kalır
    V = [50, 20, 25]
    s0 = scr(V)
    mark = mdrag(s0[0]+3, s0[1]+2, 80, 40)
    s1 = scr(V)
    chk("köşe etrafında döndü: köşe ekranda sabit", d(s0, s1) < 1.5, (s0, s1))
    chk("döndürürken macenta işaret", mark >= 1)
    chk("bırakınca işaret kalkar", ev("window.__app.viewer.pivotMark.children.length")==0)
    q0 = ev("window.__app.viewer.camera.quaternion.toArray()")
    # 2) yüz noktası: üst yüzde bir nokta (köşelerden uzak)
    pg.keyboard.press("f"); time.sleep(0.3)
    F = [10, 20, 5]
    f0 = scr(F)
    mdrag(f0[0], f0[1], -70, 30)
    f1 = scr(F)
    chk("yüz noktası etrafında döndü: nokta sabit", d(f0, f1) < 1.5, (f0, f1))
    # 3) boşluk, model tümüyle görünüyor → model merkezi sabit
    pg.keyboard.press("f"); time.sleep(0.3)
    C = [0, 10, 0]
    c0 = scr(C)
    mdrag(R["x"]+40, R["y"]+R["height"]-40, 60, -30)
    c1 = scr(C)
    chk("boşlukta: model merkezi sabit", d(c0, c1) < 1.5, (c0, c1))
    # 4) orta tık kenara (sürüklemeden) → sonra sürükle: kenar ekseni etrafında, kenarın iki ucu sabit
    pg.keyboard.press("f"); time.sleep(0.3)
    edge = ev("""(()=>{const m=window.__app.viewer.mesh; const e=m.edges.find(e=>e.d&&Math.abs(Math.abs(e.d[0])-1)<1e-6&&e.m[1]>19&&e.m[2]>24); return e&&{m:e.m,s:e.s,e:e.e}})()""")
    em = scr(edge["m"]); pg.mouse.move(em[0], em[1]); pg.mouse.down(button="middle"); pg.mouse.up(button="middle"); time.sleep(0.4)
    sticky = ev("(()=>{const s=window.__app.viewer.controls.sticky; return s&&{axis:!!s.axis}})()")
    chk("orta tık kenarı seçti (eksen)", sticky and sticky["axis"], sticky)
    chk("seçili eksen işareti görünür", ev("window.__app.viewer.pivotMark.children.length")>=2)
    a0, b0 = scr(edge["s"]), scr(edge["e"])
    time.sleep(0.4)
    mdrag(R["x"]+R["width"]*0.5, R["y"]+R["height"]*0.3, 0, 60)
    a1, b1 = scr(edge["s"]), scr(edge["e"])
    chk("kenar ekseni etrafında: kenar uçları sabit", d(a0,a1) < 1.5 and d(b0,b1) < 1.5, (a0,a1,b0,b1))
    chk("görünüm gerçekten döndü", ev("window.__app.viewer.camera.quaternion.toArray()") != q0)
    chk("sürüklemeden sonra seçim kalkar", ev("window.__app.viewer.controls.sticky")==None)
    # 5) Ctrl+orta kaydırır (döndürmez)
    qa = ev("window.__app.viewer.camera.quaternion.toArray()")
    mdrag(R["x"]+300, R["y"]+300, 50, 0, "Control")
    qb = ev("window.__app.viewer.camera.quaternion.toArray()")
    chk("Ctrl+orta: döndürmez", max(abs(x-y) for x,y in zip(qa,qb)) < 1e-9)
    # 6) çift orta tık sığdırır
    ev("window.__app.viewer.camera.zoom*=3; window.__app.viewer.camera.updateProjectionMatrix()")
    z0 = ev("window.__app.viewer.camera.zoom")
    pg.mouse.move(R["x"]+200, R["y"]+200)
    for _ in range(2): pg.mouse.down(button="middle"); pg.mouse.up(button="middle"); time.sleep(0.08)
    time.sleep(0.3)
    chk("çift orta tık sığdırır", ev("window.__app.viewer.camera.zoom") < z0 * 0.6, (z0, ev("window.__app.viewer.camera.zoom")))
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

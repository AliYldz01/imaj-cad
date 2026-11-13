# SolidWorks orta tuşla döndürme: model tümüyle görünürken model merkezi (imleçten bağımsız), yakında ekran ortasındaki geometri; yatayda yuvarlanma yok;
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
    C = [0, 10, 0]   # model kutusunun merkezi
    up0 = lambda: ev("(()=>{const c=window.__app.viewer.camera;const v=new window.__app.THREE.Vector3().setFromMatrixColumn(c.matrixWorld,1);return v.toArray()})()")
    # 1) model tümüyle görünüyor: köşeye basıp sürükle → döndürme merkezi model merkezi (imleç değil), görüntü kaymaz
    V = [50, 20, 25]
    c0 = scr(C); s0 = scr(V)
    mark = mdrag(s0[0]+3, s0[1]+2, 80, 40)
    c1 = scr(C)
    chk("köşeden başlayınca da model merkezi ekranda sabit (sıçrama yok)", d(c0, c1) < 1.5, (c0, c1))
    chk("döndürürken macenta işaret", mark >= 1)
    chk("bırakınca işaret kalkar", ev("window.__app.viewer.pivotMark.children.length")==0)
    q0 = ev("window.__app.viewer.camera.quaternion.toArray()")
    # 2) yüz noktasından ve boşluktan başlayınca da aynı merkez
    pg.keyboard.press("f"); time.sleep(0.3)
    F = [10, 20, 5]; f0 = scr(F); c0 = scr(C)
    mdrag(f0[0], f0[1], -70, 30)
    chk("yüzden başlayınca model merkezi sabit", d(c0, scr(C)) < 1.5, (c0, scr(C)))
    pg.keyboard.press("f"); time.sleep(0.3)
    c0 = scr(C)
    mdrag(R["x"]+40, R["y"]+R["height"]-40, 60, -30)
    chk("boşlukta: model merkezi sabit", d(c0, scr(C)) < 1.5, (c0, scr(C)))
    # 3) yatay sürükleme ekranın dikey ekseni etrafında: ekranın "yukarı"sı değişmez (ekranda dönme / yuvarlanma yok)
    pg.keyboard.press("f"); time.sleep(0.3)
    u0 = up0(); mdrag(R["x"]+R["width"]*0.3, R["y"]+R["height"]*0.5, 240, 0); u1 = up0()
    chk("yatay sürükleme: ekran yukarısı aynı (yuvarlanma yok)", sum((a-b)**2 for a,b in zip(u0,u1))**0.5 < 1e-6, (u0, u1))
    cx, cy = R["x"]+R["width"]/2, R["y"]+R["height"]/2
    # 4) yakınlaştırılmışken: imleç köşedeyken bile ekranın ortasındaki geometri etrafında döner
    pg.keyboard.press("f"); time.sleep(0.3)
    ev("window.__app.viewer.camera.zoom*=5; window.__app.viewer.camera.updateProjectionMatrix(); window.__app.viewer.requestRender()"); time.sleep(0.3)
    mid = ev("([x,y])=>{const v=window.__app.viewer;const h=v.ray(x,y).intersectObjects(v.scene.children,true).find(h=>h.object.isMesh&&h.object.visible);return h&&h.point.toArray()}", [cx, cy])
    if mid:
        m0 = scr(mid); mdrag(R["x"]+60, R["y"]+80, 90, 50)
        chk("yakınken ekran ortasındaki nokta yerinde (kenara savrulmaz)", d(m0, scr(mid)) < 2.5, (m0, scr(mid)))
    # 5) peş peşe hızlı döndürme vuruşları sığdırma yapmaz (görüntü sıçramaz)
    z0 = ev("window.__app.viewer.camera.zoom")
    for _ in range(3):
        pg.mouse.move(cx, cy); pg.mouse.down(button="middle"); pg.mouse.move(cx+40, cy, steps=3); pg.mouse.up(button="middle"); time.sleep(0.05)
    time.sleep(0.3)
    chk("hızlı ardışık sürüklemeler yakınlaştırmayı bozmaz", abs(ev("window.__app.viewer.camera.zoom") - z0) < 1e-6, (z0, ev("window.__app.viewer.camera.zoom")))
    # 6) uzun basıp kıpırdamadan bırakmak eksen kilitlemez
    pg.mouse.move(cx, cy); pg.mouse.down(button="middle"); time.sleep(0.6); pg.mouse.up(button="middle"); time.sleep(0.2)
    chk("uzun basış varlık seçmez", ev("window.__app.viewer.controls.sticky")==None)
    # 7) orta tık kenara (sürüklemeden) → sonra sürükle: kenar ekseni etrafında, kenarın iki ucu sabit
    ev("window.__app.viewer.viewStd('iso')"); time.sleep(0.6); pg.keyboard.press("f"); time.sleep(0.3)
    edge = ev("""(()=>{const m=window.__app.viewer.mesh; const e=m.edges.find(e=>e.d&&Math.abs(Math.abs(e.d[0])-1)<1e-6&&e.m[1]>19&&e.m[2]>24); return e&&{m:e.m,s:e.s,e:e.e}})()""")
    em = scr(edge["m"]); pg.mouse.move(em[0], em[1]); pg.mouse.down(button="middle"); pg.mouse.up(button="middle"); time.sleep(0.4)
    sticky = ev("(()=>{const s=window.__app.viewer.controls.sticky; return s&&{axis:!!s.axis, a:s.axis&&s.axis.toArray(), p:s.p.toArray()}})()")
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
    # 8) montajda: iki bileşen, bir bileşenin köşesinden basıp sürükle → montajın merkezi sabit, yuvarlanma yok
    pg.evaluate("localStorage.removeItem('imajcad.asm')")
    A = lambda js: pg.evaluate(f"(()=>{{const a=window.__app.asm; {js}}})()")
    pg.click("#tabs button[data-tab='asm']"); pg.click("#cmds button:has-text('Montajı Aç')"); time.sleep(0.5)
    A("a.doc={kind:'asm',name:'T',comps:[],mates:[]}; return 0")
    for nm in ("A", "B"):
        A(f"a.addComp({{name:'{nm}', features:{json.dumps(box)}}})"); time.sleep(1.5); wait_ready(pg)
    A("a.doc.comps[1].p=[300,0,0]; a.draw(); return 0"); time.sleep(0.5)
    pg.keyboard.press("f"); time.sleep(0.4)
    ctr = ev("(()=>{const b=new window.__app.THREE.Box3();window.__app.viewer.scene.traverse(o=>{if(o.isMesh&&o.visible&&o.userData&&o.userData.comp)b.expandByObject(o)});return b.isEmpty()?null:b.getCenter(new window.__app.THREE.Vector3()).toArray()})()")
    cor = scr([350, 20, 25])
    pv = ev("([x,y])=>{const p=window.__app.viewer.navPivot(x,y,false);return p&&p.p.toArray()}", [cor[0]-2, cor[1]+2])
    ctr = pv
    k0 = scr(ctr); u0 = up0()
    mdrag(cor[0]-2, cor[1]+2, 120, 0)
    chk("montaj: bileşen köşesinden başlayınca montaj merkezi sabit", d(k0, scr(ctr)) < 3, (k0, scr(ctr), ctr))
    chk("montaj: yatay sürüklemede yuvarlanma yok", sum((a-b)**2 for a,b in zip(u0, up0()))**0.5 < 1e-6)
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

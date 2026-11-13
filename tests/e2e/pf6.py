# Parça özellikleri 6: delik sihirbazı — yuva delik, yakın / uzak taraf havşası
import cmdpatch, time, math
from h import *
ok=[]
def chk(n,c,i=""): ok.append(c); print(("TAMAM " if c else "HATA  ")+n, i)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    ev = pg.evaluate
    vol = lambda: ev("window.__app.kernel.props().then(p=>p.volume)")
    err = lambda: pg.eval_on_selector_all("#tree li.err", "els=>els.map(e=>e.title||e.textContent)")
    base = [sketch("s1","S",FRONT,lambda pt,line,rect,c,t: rect(0,0,100,60)), ext("e1","s1",10)]
    fr = {"o":[0,0,10],"x":[1,0,0],"n":[0,0,1]}
    H = lambda **kw: {"id":"h1","type":"hole","name":"D","htype":"simple","size":"custom","d":8,"depth":10,"through":True,"cd":0,"cdepth":0,"cangle":90,"plane":{"k":"face","frame":fr,"face":{"c":[50,30,10],"n":[0,0,1]}},"pts":[[50,30]], **kw}
    run(pg,"plaka",base); v0=vol()
    pi=math.pi
    fru = lambda h,a,b2: pi/3*h*(a*a+a*b2+b2*b2)
    cases = [
        ("düz delik", {}, pi*16*10),
        ("yuva 20", {"slot":20}, (pi*16+160)*10),
        ("yuva 20 açı 90", {"slot":20,"slotAng":90}, (pi*16+160)*10),
        ("yakın havşa Ø16", {"nearCs":{"d":16,"angle":90}}, pi*16*10 + fru(4,8,4) - pi*16*4),
        ("uzak havşa Ø16", {"farCs":{"d":16,"angle":90}}, pi*16*10 + fru(4,8,4) - pi*16*4),
        ("iki taraf havşa", {"nearCs":{"d":16,"angle":90},"farCs":{"d":16,"angle":90}}, pi*16*10 + 2*(fru(4,8,4) - pi*16*4)),
        ("havşalı + yakın konik", {"htype":"cbore","cd":14,"cdepth":5,"nearCs":{"d":20,"angle":90}}, fru(3,10,7) + pi*49*2 + pi*16*5),
        ("yuva + yakın havşa", {"slot":20,"nearCs":{"d":16,"angle":90}}, None),
    ]
    for nm, kw, exp in cases:
        run(pg, nm, base+[H(**kw)])
        dv = v0-vol()
        if exp is None: chk(nm+" kurulur", not err() and dv > (pi*16+160)*10 + 100, [dv, err()])
        else: chk(f"{nm}: {exp:.1f}", abs(dv-exp) < 1, [dv, err()])
    xs = ev("(()=>{const m=window.__app.viewer.mesh; return 0})()")
    run(pg, "yuva yönü", base+[H(slot=20, slotAng=90)])
    bb = ev("(()=>{const m=window.__app.viewer.mesh; const fs=m.faces.filter(f=>f.r&&Math.abs(f.r-4)<1e-6); return fs.map(f=>[Math.round(f.c[0]),Math.round(f.c[1])])})()")
    chk("90° yuva: yay merkezleri dikey (x 50, y 20/40)", bb and all(abs(q[0]-50)<=4 for q in bb), bb)
    # PM
    run(pg,"plaka",base)
    ev("document.querySelector(\"#cmds button[title='Delik Sihirb.']\")?.click()"); time.sleep(0.4)
    vis = pg.is_visible("#pm label:has-text('Yuva delik')")
    chk("PM: yuva / havşa seçenekleri", vis and pg.is_visible("#pm label:has-text('Yakın taraf havşası')"), vis)
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

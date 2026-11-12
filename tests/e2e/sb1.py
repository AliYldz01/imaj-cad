# sac: bitişik iki kenar flanşı — açınım dış hattı ve büküm çizgileri (resim: /home/claude/sb1.png)
import cmdpatch, json, os
from h import *
exec(open('s1.py').read().split("with sync_playwright")[0])
from PIL import Image, ImageDraw
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    plate = sketch("s1","Eskiz1",TOP, lambda pt,line,rect,circle,text: rect(0,0,100,60))
    cases = {"bitisik2": [ef("e1",[[50,2,0],[100,2,-30]])], "ayri2": [ef("e1",[[50,2,0]]), ef("e2",[[100,2,-30]])], "dort": [ef("e1",[[50,2,0],[50,2,-60],[0,2,-30],[100,2,-30]])]}
    for name, fl in cases.items():
        run(pg, name, [plate, base()] + fl)
        r = pg.evaluate("async()=>{const r=await window.__app.kernel.flat(0,2,0.5); return {err:r.error, o:r.outline, b:r.bends.map(x=>[x.a,x.b])}}")
        if r["err"]: print(name, "ERR", r["err"]); continue
        pts=[]; 
        for o in r["o"]:
            if o["k"]=="l": pts += [o["a"],o["b"]]
        xs=[q[0] for q in pts]; ys=[q[1] for q in pts]
        mn=(min(xs)-10,min(ys)-10); s=4
        W=int((max(xs)-mn[0]+10)*s); H=int((max(ys)-mn[1]+10)*s)
        im=Image.new("RGB",(W,H),"white"); d=ImageDraw.Draw(im)
        T=lambda q:((q[0]-mn[0])*s, H-(q[1]-mn[1])*s)
        for o in r["o"]:
            if o["k"]=="l": d.line([T(o["a"]),T(o["b"])],fill="black",width=2)
        for a,bb in r["b"]: d.line([T(a),T(bb)],fill="red",width=1)
        im.save(f"/home/claude/sb1_{name}.png")
        print(name, "bends:", [[[round(v,2) for v in a],[round(v,2) for v in bb]] for a,bb in r["b"]], "outline n:", len(r["o"]))
    print("errors:", logs)

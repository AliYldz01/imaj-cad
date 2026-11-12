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
    cases = {"bitisik2": [ef("e1",[[50,2,0],[100,2,-30]])], "dista": [ef("e1",[[50,2,0],[100,2,-30]],pos="outside")], "bukumdisi": [ef("e1",[[50,2,0],[100,2,-30]],pos="bendout")], "dort": [ef("e1",[[50,2,0],[50,2,-60],[0,2,-30],[100,2,-30]])], "dort_dista": [ef("e1",[[50,2,0],[50,2,-60],[0,2,-30],[100,2,-30]],pos="outside")]}
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
        # açınım kendini kesiyor mu? (dış hat parçaları arasında uç dışı kesişim)
        L=[(o["a"],o["b"]) for o in r["o"] if o["k"]=="l"]
        def X(p1,p2,p3,p4):
            d=(p2[0]-p1[0])*(p4[1]-p3[1])-(p2[1]-p1[1])*(p4[0]-p3[0])
            if abs(d)<1e-12: return False
            t=((p3[0]-p1[0])*(p4[1]-p3[1])-(p3[1]-p1[1])*(p4[0]-p3[0]))/d; u=((p3[0]-p1[0])*(p2[1]-p1[1])-(p3[1]-p1[1])*(p2[0]-p1[0]))/d
            return 1e-6<t<1-1e-6 and 1e-6<u<1-1e-6
        cross=sum(1 for i in range(len(L)) for j in range(i+1,len(L)) if X(*L[i],*L[j]))
        print(name, "kendini kesen kenar cifti:", cross)
        print(name, "bends:", [[[round(v,2) for v in a],[round(v,2) for v in bb]] for a,bb in r["b"]], "outline n:", len(r["o"]))
    print("errors:", logs)

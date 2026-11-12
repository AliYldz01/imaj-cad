from h import *
import re
def mem(id, segs, std="dkutu", size="60x40x3", corner="miter", **kw):
    f={"id":id,"type":"member","name":id,"segs":[{"sk":s,"ent":e} for s,e in segs],"std":std,"size":size,"align":"c","mirror":False,"rot":0,"corner":corner,"gap":0}; f.update(kw); return f
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}, accept_downloads=True); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    ids=[]
    def frame(pt,line,rect,circle,text):
        a,b_,c,d=pt(0,0),pt(1000,0),pt(1000,600),pt(0,600)
        ids.extend([line(a,b_),line(b_,c),line(c,d),line(d,a), line(pt(500,0),pt(500,600))])
    sk=sketch("s1","İskelet",FRONT, frame)
    holes=sketch("s5","Delikler",FRONT, lambda pt,line,rect,circle,text: (circle(250,0,6), circle(750,0,6), circle(150,0,4)))
    feats=[sk, mem("m1",[("s1",i) for i in ids[:4]]), mem("m2",[("s1",ids[4])]), {"id":"t1","type":"trim","name":"K","targets":[{"f":"m2","i":0}],"bounds":[{"f":"m1","i":0},{"f":"m1","i":2}]},
      {"id":"g1","type":"gusset","name":"G","f1":{"c":[500,30,0],"n":[0,1,0]},"f2":{"c":[30,300,0],"n":[1,0,0]},"d1":100,"d2":100,"t":6,"chamfer":10,"offset":0},
      holes, ext("x9","s5",cut=True,end="through",dir2=True,end2="through")]
    run(pg,"frame+holes",feats)
    print(pg.evaluate("(()=>{const m=window.__app.viewer.mesh; const bb={}; m.faces.forEach(f=>{const k=f.b; bb[k]=Math.min(bb[k]??1e9,f.c[1])}); return bb})()"))
    pg.click("#tabs button[data-tab='weld']")
    pg.click("#cmds button:has-text('Kesim Listesi')"); time.sleep(1.5)
    print(pg.inner_text("dialog.cut-dialog .cut-table"))
    pg.click("dialog.cut-dialog button:has-text('Tüm imalat resimleri')"); time.sleep(4)
    src = pg.evaluate("document.querySelector('iframe.draw-frame').srcdoc")
    svgs = re.findall(r"<svg.*?</svg>", src, re.S)
    print("sheets:", len(svgs))
    for i,sv in enumerate(svgs): open(f"dw{i}.svg","w").write(sv)
    print("errors:", logs[:5] or "none")
    b.close()

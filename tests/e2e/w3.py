import cmdpatch
from h import *
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    ph = b.new_page(viewport={"width":390,"height":844}, device_scale_factor=2, is_mobile=True, has_touch=True); ph.goto(URL); wait_ready(ph); time.sleep(0.5)
    ids=[]
    def frame(pt,line,rect,circle,text):
        a,b_,c,d=pt(0,0),pt(1000,0),pt(1000,600),pt(0,600)
        ids.extend([line(a,b_),line(b_,c),line(c,d),line(d,a)])
    sk=sketch("s1","İskelet",FRONT, frame)
    m={"id":"m1","type":"member","name":"Yapı-Elemanı1","segs":[{"sk":"s1","ent":i} for i in ids],"std":"L","size":"40x40x4","align":"c","mirror":False,"rot":0,"corner":"miter","gap":0}
    run(ph,"phone",[sk,m])
    ph.click("#tabs button[data-tab='weld']"); time.sleep(0.4)
    ph.screenshot(path="w3_a.png")
    ph.click("#cmds button:has-text('Kesim Listesi')"); time.sleep(1.5)
    ph.screenshot(path="w3_b.png")
    b.close()

# tanı: köşelerde girişim ve gönye yüzü eşleşmesi (L, U, IPE, kutu, boru; düzgün zincir ve ters çizilmiş çizgiler)
import cmdpatch, time, json, sys
from h import *
PROF = [("L","50x50x5"),("U","UPN 100"),("IPE","IPE 100"),("kutu","40x40x3"),("boru","33.7x3.2")]
def rect(order):
    # 600x400 dikdörtgen, üst düzlem
    def b(pt,line,rect_,c,t):
        P=[pt(0,0),pt(600,0),pt(600,400),pt(0,400)]
        for i,j in order: line(P[i],P[j])
    return sketch("s1","S",TOP,b)
CHAIN=[(0,1),(1,2),(2,3),(3,0)]; MIXED=[(0,1),(2,1),(2,3),(0,3)]
JS = """async()=>{const m=window.__app.viewer.mesh; const pr=await window.__app.kernel.interfere();
 const F=m.faces.filter(f=>f.n&&f.b!==undefined&&Math.abs(f.n[0])>0.3&&Math.abs(f.n[2])>0.3);
 let worst=0, pairs=0; for(const a of F) for(const b of F){ if(a.b>=b.b) continue; const dn=a.n[0]+b.n[0]+a.n[1]+b.n[1]+a.n[2]+b.n[2]; if(Math.abs(a.n[0]+b.n[0])<1e-3&&Math.abs(a.n[2]+b.n[2])<1e-3){ const d=Math.hypot(a.c[0]-b.c[0],a.c[1]-b.c[1],a.c[2]-b.c[2]); if(d<60){pairs++; worst=Math.max(worst,d);} } }
 return {bodies:m.bodies, interf:pr.map(p=>+p.vol.toFixed(1)), miterPairs:pairs, centerGap:+worst.toFixed(2)}}"""
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900})
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    import os; corners = os.environ.get("CORNERS","miter,butt1").split(",")
    for corner in corners:
      for nm,order in [("zincir",CHAIN),("karisik",MIXED)]:
        for std,size in PROF:
            sk = rect(order); ents=[e["id"] for e in sk["data"]["ents"]]
            mem={"id":"m","type":"member","name":"M","segs":[{"sk":"s1","ent":e} for e in ents],"std":std,"size":size,"align":"c","mirror":False,"rot":0,"corner":corner,"gap":0,"ori":2}
            doc={"version":2,"name":"T","features":[sk,mem],"seq":{}}
            pg.evaluate("d=>window.__app.setDoc(d)", doc); time.sleep(0.3); wait_ready(pg)
            errs = pg.eval_on_selector_all("#tree li.err", "els=>els.map(e=>e.title)")
            r = pg.evaluate(JS)
            print(f"{corner:6} {nm:8} {std:5} {r} {errs if errs else ''}")

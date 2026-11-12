# akıllı birleşimler: ters çizilmiş çizgilerde gönye eşleşmesi, T birleşimi, gruplar arası köşe, 3 elemanlı köşe (masa çerçevesi)
import cmdpatch, time, json, os
from h import *
PROF = [("L","50x50x5"),("U","UPN 100"),("IPE","IPE 100"),("kutu","40x40x3"),("boru","33.7x3.2"),("lama","50x10") ]
JS = """async()=>{const m=window.__app.viewer.mesh; const pr=await window.__app.kernel.interfere();
 const F=m.faces.filter(f=>f.n&&f.b!==undefined&&Math.abs(f.n[0])>0.3&&Math.abs(f.n[2])>0.3);
 let worst=0; for(const a of F) for(const b of F){ if(a.b>=b.b) continue; if(Math.abs(a.n[0]+b.n[0])<1e-3&&Math.abs(a.n[2]+b.n[2])<1e-3&&Math.abs(a.n[1]+b.n[1])<1e-3){ const d=Math.hypot(a.c[0]-b.c[0],a.c[1]-b.c[1],a.c[2]-b.c[2]); if(d<60) worst=Math.max(worst,d);} }
 return {bodies:m.bodies, interf:pr.map(p=>+p.vol.toFixed(1)), miterGap:+worst.toFixed(2)}}"""
P = {"a":[0,0,0],"b":[600,0,0],"c":[600,0,400],"d":[0,0,400],"e":[300,0,0],"f":[300,0,400],"ga":[0,-500,0],"gb":[600,-500,0],"gc":[600,-500,400],"gd":[0,-500,400]}
def s3(lines):
    ids=list(P); return {"id":"k","type":"sketch3d","name":"K","ids":ids,"xyz":[P[i] for i in ids],"lines":[{"id":f"l{n}","a":a,"b":b} for n,(a,b) in enumerate(lines)],"r":0,"seq":40}
ok=True
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900})
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    def run1(title, lines, groups, std, size, corner="miter"):
        global ok
        sk = s3(lines)
        g0 = groups[0]; rest = groups[1:]
        G = lambda idx: [{"sk":"k","ent":f"l{n}"} for n in idx]
        mem={"id":"m","type":"member","name":"M","segs":G(g0),"std":std,"size":size,"align":"c","mirror":False,"rot":0,"corner":corner,"gap":0,"ori":2,
             "groups":[{"segs":G(gr),"align":"c","mirror":False,"rot":0,"corner":corner,"gap":0} for gr in rest]}
        pg.evaluate("d=>window.__app.setDoc(d)", {"version":2,"name":"T","features":[sk,mem],"seq":{}}); time.sleep(0.3); wait_ready(pg)
        errs = pg.eval_on_selector_all("#tree li.err", "els=>els.map(e=>e.title)")
        r = pg.evaluate(JS)
        bad = errs or any(v>1 for v in r["interf"]) or r["miterGap"]>0.05
        ok = ok and not bad
        print(f"{'HATA' if bad else 'ok  '} {title:28} {std:5} {r} {errs if errs else ''}")
    for std,size in PROF:
        # karışık yönlü dikdörtgen + ortada T kiriş (aynı grup)
        run1("karisik+T (tek grup)", [("a","e"),("b","e"),("b","c"),("f","c"),("d","f"),("a","d"),("e","f")], [[0,1,2,3,4,5,6]], std, size)
        # dikdörtgen grup1, ayaklar grup2 (3 elemanlı köşeler)
        run1("masa: cerceve + ayaklar", [("a","b"),("c","b"),("c","d"),("a","d"),("a","ga"),("b","gb"),("c","gc"),("d","gd")], [[0,1,2,3],[4,5,6,7]], std, size)
        # iki grup köşede buluşuyor (gruplar arası köşe)
        run1("gruplar arasi kose", [("a","b"),("b","c")], [[0],[1]], std, size)
    print("SONUC:", "TAMAM" if ok else "SORUN VAR")

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
LEG = """(async()=>{const app=window.__app; const d=JSON.parse(JSON.stringify(app.doc));
 d.features[0].lines=[{id:'l0',a:'a',b:'b'},{id:'l1',a:'c',b:'b'},{id:'l2',a:'c',b:'d'},{id:'l3',a:'a',b:'d'},{id:'l4',a:'a',b:'ga'}];
 const m=d.features[1]; m.segs=['l0','l1','l2','l3'].map(e=>({sk:'k',ent:e})); m.groups=[{segs:[{sk:'k',ent:'l4'}],align:'c',mirror:false,rot:0,corner:'miter',gap:0}];
 app.setDoc(d); await new Promise(r=>setTimeout(r,1500)); const M=app.viewer.mesh;
 const acc={}; for(let g=0; g<M.faceGroups.length; g+=3){const st=M.faceGroups[g],n=M.faceGroups[g+1],b=M.faces[M.faceGroups[g+2]].b; for(let t=st;t<st+n;t+=3){const ps=[0,1,2].map(k=>{const v=M.triangles[t+k]*3; return [M.vertices[v],M.vertices[v+1],M.vertices[v+2]]}); const A=Math.hypot(...[0,1,2].map(q=>{const u=[0,1,2].map(j=>ps[1][j]-ps[0][j]), w=[0,1,2].map(j=>ps[2][j]-ps[0][j]); return [u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]][q]}))/2; const o=acc[b]??=[0,0,0,0]; for(let j=0;j<3;j++) o[j]+=A*(ps[0][j]+ps[1][j]+ps[2][j])/3; o[3]+=A;}}
 const legs=Object.values(acc).map(o=>[o[0]/o[3],o[1]/o[3],o[2]/o[3]]).filter(c=>c[1]<-100); const c=legs[0]; return [+c[0].toFixed(2),+c[2].toFixed(2)]})()"""
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
        bad = errs or any(v>1 for v in r["interf"]) or (r["miterGap"]>0.05 and "X" not in title)
        ok = ok and not bad
        print(f"{'HATA' if bad else 'ok  '} {title:28} {std:5} {r} {errs if errs else ''}")
    for std,size in PROF:
        # karışık yönlü dikdörtgen + ortada T kiriş (aynı grup)
        run1("karisik+T (tek grup)", [("a","e"),("b","e"),("b","c"),("f","c"),("d","f"),("a","d"),("e","f")], [[0,1,2,3,4,5,6]], std, size)
        # dikdörtgen grup1, ayaklar grup2 (3 elemanlı köşeler)
        run1("masa: cerceve + ayaklar", [("a","b"),("c","b"),("c","d"),("a","d"),("a","ga"),("b","gb"),("c","gc"),("d","gd")], [[0,1,2,3],[4,5,6,7]], std, size)
        # iki grup köşede buluşuyor (gruplar arası köşe)
        run1("gruplar arasi kose", [("a","b"),("b","c")], [[0],[1]], std, size)
        # çapraz X: köşegenler ortada kesişir
        run1("capraz X", [("a","c"),("b","d")], [[0,1]], std, size)
        if std in ("L","U"):
            # ayak otomatik dönüşü: a köşesindeki ayağın yüzey ağırlık merkezi dış köşeye (−x, −z) kaymalı
            c = pg.evaluate(LEG)
            print("   ayak yonu (a kosesi):", c, "ok" if (c[0]<-0.5 and c[1]<-0.5) or (std=="U" and min(c)<-0.5 and max(c)<0.5) else "HATA")
    print("SONUC:", "TAMAM" if ok else "SORUN VAR")

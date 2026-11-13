# Çeyrek noktalarından ölçü: çap değişince noktalar çeyrekte kalır (çember üzerinde kaymaz)
import cmdpatch, time
from h import *
ok=[]
def chk(n,c,i=""): ok.append(c); print(("TAMAM " if c else "HATA  ")+n, i)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.4)
    run(pg, "box", [sketch("s1","S",TOP,lambda pt,line,rect,c,t: rect(-50,-30,50,30)), ext("e1","s1",20)])
    pg.evaluate("window.__app.viewer.viewStd('top')"); time.sleep(0.2)
    r = pg.query_selector("#view").bounding_box()
    sc = lambda w: (lambda q: (r["x"]+q[0], r["y"]+q[1]))(pg.evaluate(f"window.__app.viewer.toScreen({w})"))
    x,y = sc("[0,20,0]"); pg.mouse.click(x+30,y+20); pg.mouse.click(x+30,y+20, button='right'); pg.click(".sw-ctx .sw-mi:has-text('Eskiz')"); time.sleep(0.5)
    ed = lambda js: pg.evaluate(f"(()=>{{const e=window.__app.mode.editor; const d=e.data; {js}}})()")
    ed("e.opts.quickDim=false; e.setTool('circle')")
    pg.mouse.click(*sc("[-25,20,-10]")); pg.mouse.click(*sc("[-16,20,-10]"))
    ed("e.setTool('dim')")
    def dim(a, bb, lab, val):
        q=sc(a); pg.mouse.move(q[0],q[1],steps=3); time.sleep(0.1); pg.mouse.click(*q)
        m=sc(bb); pg.mouse.move(m[0],m[1],steps=3); pg.mouse.click(*m)
        l=sc(lab); pg.mouse.click(*l); time.sleep(0.2)
        pg.fill(".dim-prompt input", str(val)); pg.press(".dim-prompt input","Enter"); time.sleep(0.4)
    # üst çeyrek (z = -10 - 9 = -19 → ekranda yukarı: z eksi) → model üst kenarı (z=-30) ortası değil; kenar üzerinde bir nokta
    dim("[-25,20,-19]", "[-25,20,-30]", "[-10,20,-25]", 12)
    dim("[-34,20,-10]", "[-50,20,-10]", "[-42,20,0]", 15)
    rels = ed("return d.rels.map(x=>x.t)")
    chk("çeyrek noktalarına yatay/dikey hizalama ilişkisi eklendi", "horizontal" in rels and "vertical" in rels, rels)
    # dairenin çapını ölç ve değiştir
    dim("[-16,20,-10]", "[-16,20,-10]", "[-5,20,5]", 18) if False else None
    ed("const c=d.ents.find(x=>x.t==='circle'); d.dims.push({id:'dD',t:'dia',refs:[c.id],v:18,lp:[0,0]}); e.resolve(); return 0")
    def geo():
        return ed("""const c=d.ents.find(x=>x.t==='circle'); const C=d.pts[c.c]; 
          const qs=d.rels.filter(r=>r.t==='onCircle').map(r=>d.pts[r.refs[0]]); return {C:[C.x,C.y], r:c.r, q:qs.map(p=>[p.x,p.y])}""")
    g0 = geo()
    ed("const D=d.dims.find(x=>x.id==='dD'); D.v=30; e.resolve(); return 0")
    pg.evaluate("window.__app.mode.editor.changed && 0")
    g1 = geo()
    def okq(g):
        C,rr=g["C"],g["r"]
        return all(abs(abs(q[0]-C[0])+abs(q[1]-C[1]) - rr) < 1e-3 and (abs(q[0]-C[0])<1e-3 or abs(q[1]-C[1])<1e-3) for q in g["q"]) and len(g["q"])==2
    chk("Ø18: noktalar çeyrekte", okq(g0), g0)
    chk("Ø30: noktalar hâlâ çeyrekte", okq(g1) and abs(g1["r"]-15)<1e-3, g1)
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

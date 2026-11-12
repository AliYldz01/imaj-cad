import sys, time, json
from playwright.sync_api import sync_playwright
URL=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:4173/'
SHOTS=set()
def wait_ready(pg, t=120000):
    pg.wait_for_function("!document.querySelector('#status').classList.contains('busy') && !document.querySelector('#status-text').textContent.includes('yükleniyor')", timeout=t)
# --- yardımcılar: eskiz verisi
def sketch(id, name, plane, build):
    d={"pts":{}, "ents":[], "rels":[], "dims":[], "seq":1}
    c=[0]
    def pt(x,y):
        c[0]+=1; k=f"p{c[0]}"; d["pts"][k]={"x":x,"y":y}; return k
    def line(a,b,cons=False):
        c[0]+=1; e={"id":f"l{c[0]}","t":"line","p1":a,"p2":b}; 
        if cons: e["cons"]=True
        d["ents"].append(e); return e["id"]
    def rect(x0,y0,x1,y1):
        a,b,cc,dd=pt(x0,y0),pt(x1,y0),pt(x1,y1),pt(x0,y1); line(a,b);line(b,cc);line(cc,dd);line(dd,a)
    def circle(x,y,r):
        c[0]+=1; d["ents"].append({"id":f"c{c[0]}","t":"circle","c":pt(x,y),"r":r})
    def text(x,y,s,size):
        c[0]+=1; d["ents"].append({"id":f"x{c[0]}","t":"text","p":pt(x,y),"text":s,"size":size,"angle":0})
    build(pt,line,rect,circle,text)
    d["seq"]=c[0]+1
    return {"id":id,"type":"sketch","name":name,"plane":plane,"data":d}
FRONT={"k":"std","n":"front"}; TOP={"k":"std","n":"top"}; RIGHT={"k":"std","n":"right"}
def ext(id, sk, d1=20, **kw):
    f={"id":id,"type":"extrude","name":id,"sketch":sk,"cut":False,"end":"blind","d1":d1,"rev":False,"dir2":False,"end2":"blind","d2":10}; f.update(kw); return f
def run(pg, name, feats, extra=None):
    doc={"version":2,"name":"T","features":feats,"seq":{}}
    if extra: doc.update(extra)
    pg.evaluate("d=>window.__app.setDoc(d)", doc); time.sleep(0.4); wait_ready(pg)
    m = pg.evaluate("(()=>{const m=window.__app.viewer.mesh; return m&&{f:m.faces.length, bodies:m.bodies, bb:[m.bbox.min.map(v=>+v.toFixed(2)),m.bbox.max.map(v=>+v.toFixed(2))]}})()")
    errs = pg.eval_on_selector_all("#tree li.err", "els=>els.map(e=>e.textContent+': '+(e.title||''))")
    print(f"{name}: {m} {pg.inner_text('#status-text')} {errs if errs else ''}")
    if name in SHOTS:
        pg.click(".vcube .iso"); pg.click("#viewbar button[title='Ekrana sığdır']"); time.sleep(0.4)
        pg.screenshot(path=f"/home/claude/tests/t10_{name.replace(' ','_')}.png", clip={"x":300,"y":62,"width":1100,"height":838})
    return m

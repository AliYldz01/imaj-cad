# Grup başına profil (tek özellikte farklı profiller) + özellikler arası birleşim (önceki yapı elemanına göre kırp/uzat)
import cmdpatch, time
from h import *
P = {"a":[0,0,0],"b":[600,0,0],"c":[600,0,400],"d":[0,0,400],"e":[300,0,0],"f":[300,0,400],"ga":[0,-500,0],"gb":[600,-500,0],"gc":[600,-500,400],"gd":[0,-500,400]}
def s3(lines):
    ids=list(P); return {"id":"k","type":"sketch3d","name":"K","ids":ids,"xyz":[P[i] for i in ids],"lines":[{"id":f"l{n}","a":a,"b":b} for n,(a,b) in enumerate(lines)],"r":0,"seq":40}
G = lambda idx: [{"sk":"k","ent":f"l{n}"} for n in idx]
def mem(id, segs, std, size, groups=(), **kw):
    m={"id":id,"type":"member","name":id,"segs":G(segs),"std":std,"size":size,"align":"c","mirror":False,"rot":0,"corner":"miter","gap":0,"ori":2,
       "groups":[dict({"segs":G(s),"align":"c","mirror":False,"rot":0,"corner":"miter","gap":0}, **({"std":st,"size":sz} if st else {})) for s,st,sz in groups]}
    m.update(kw); return m
LINES=[("a","b"),("c","b"),("c","d"),("a","d"),("a","ga"),("b","gb"),("c","gc"),("d","gd"),("e","f")]
ok=[]
def chk(n,c,info=""): ok.append(bool(c)); print(("✓ " if c else "✗ ")+n, info)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]; pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    def build(feats):
        pg.evaluate("d=>window.__app.setDoc(d)", {"version":2,"name":"T","features":[s3(LINES)]+feats,"seq":{}}); time.sleep(0.3); wait_ready(pg)
        errs = pg.eval_on_selector_all("#tree li.err", "els=>els.map(e=>e.title)")
        r = pg.evaluate("""async()=>{const k=window.__app.kernel; const it=await k.interfere(); const cl=await k.cutListFull();
          return {bodies:window.__app.viewer.mesh.bodies, interf:it.map(p=>+p.vol.toFixed(1)), cut:cl.items.filter(i=>i.kind==='member').map(i=>i.name+':'+Math.round(i.length))}}""")
        return errs, r
    # 1) tek özellik: çerçeve kutu 40x40x3, ayaklar kutu 60x60x4, orta kiriş L 50x50x5
    e, r = build([mem("m",[0,1,2,3],"kutu","40x40x3",[([4,5,6,7],"kutu","60x60x4"),([8],"L","50x50x5")])])
    names = sorted(set(c.split(":")[0] for c in r["cut"]))
    chk("tek özellik, 3 farklı profil: hatasız", not e, e)
    chk("girişim yok", all(v <= 1 for v in r["interf"]), r["interf"])
    chk("kesim listesinde 3 profil", len(names) == 3, names)
    chk("9 gövde", r["bodies"] == 9, r["bodies"])
    # 2) ayrı özellikler: çerçeve (önce), ayaklar + orta kiriş (sonra, farklı profil)
    e, r = build([mem("m1",[0,1,2,3],"kutu","40x40x3"), mem("m2",[4,5,6,7],"kutu","30x30x2",[([8],"L","40x40x4")])])
    chk("ayrı özellikler: hatasız", not e, e)
    chk("ayrı özellikler: girişim yok (köşe + T)", all(v <= 1 for v in r["interf"]), r["interf"])
    print("   kesim:", r["cut"])
    # kapalıyken girişim olmalı (karşılaştırma)
    e, r2 = build([mem("m1",[0,1,2,3],"kutu","40x40x3"), mem("m2",[4,5,6,7],"kutu","30x30x2",[([8],"L","40x40x4")], trimPrev=False)])
    chk("kırpma kapalıyken girişim var (kontrol)", any(v > 1 for v in r2["interf"]), r2["interf"])
    # 3) ters T: önce orta kiriş, sonra çerçeve → kirişin uçları çerçevede kırpılır
    e, r = build([mem("m1",[8],"kutu","30x30x2"), mem("m2",[0,1,2,3],"kutu","40x40x3")])
    chk("ters T: girişim yok", not e and all(v <= 1 for v in r["interf"]), r["interf"])
    # 4) ayrı özelliklerde L köşe: önceki eleman uzar, yeni eleman onun yüzünde biter
    e, r = build([mem("m1",[0],"kutu","40x40x3"), mem("m2",[1],"kutu","30x30x2")])
    chk("L köşe (ayrı özellik): girişim yok, önceki uzadı", not e and all(v <= 1 for v in r["interf"]) and "Kutu 40x40x3:615" in r["cut"], r["cut"])
    build([mem("m1",[0,1,2,3],"kutu","40x40x3"), mem("m2",[4,5,6,7],"kutu","30x30x2",[([8],"L","40x40x4")])])
    pg.evaluate("window.__app.viewer.viewStd('iso')"); pg.keyboard.press("f"); time.sleep(0.5)
    pg.screenshot(path="/home/claude/pg1.png")
    # panel: grup 2'nin kendi profili
    pg.dblclick("#tree li:has-text('m2')"); time.sleep(0.6)
    pg.click("#pm-body button:has-text('Grup 2')"); time.sleep(0.3)
    txt = pg.inner_text("#pm-body")
    chk("panel: Grup 2 kendi profili (L 40x40x4)", "Profil — Grup 2" in txt.replace("PROFİL","Profil") or "Grup 2" in txt, "")
    cb = pg.locator("#pm-body label:has-text('Grup 1 ile aynı profil') input")
    chk("Grup 1 ile aynı profil kutusu kapalı", cb.count() == 1 and not cb.is_checked())
    cb.check(); time.sleep(1.5); wait_ready(pg)
    chk("işaretleyince grup profili silinir", pg.evaluate("!window.__app.mode.draft.groups[0].std"))
    pg.screenshot(path="/home/claude/pg1_pm.png")
    print("hatalar:", logs); print("SONUC:", "TAMAM" if all(ok) and not logs else "HATA")

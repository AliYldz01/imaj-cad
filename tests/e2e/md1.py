# Paket 6: helis süpürme (yay, konik yay), loft başlangıç/bitiş "profile dik", referans eksen (silindir yüzü, iki düzlem, iki nokta), yapılandırmalar
import cmdpatch, time, json
from h import *
ok=[]
def chk(n,c,i=""): ok.append(c); print(("TAMAM " if c else "HATA  ")+n, i)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e))); pg.on("dialog", lambda d: d.accept())
    pg.goto(URL); wait_ready(pg); time.sleep(0.4)
    errs = lambda: pg.eval_on_selector_all("#tree li.err", "els=>els.map(e=>e.textContent+':'+(e.title||''))")
    base = sketch("s1","Taban",TOP, lambda pt,line,rect,circle,text: circle(0,0,10))
    sw = {"id":"w1","type":"sweep","name":"Yay","sketch":"","path":"s1","cut":False,"circ":2,"helix":{"pitch":5,"turns":4}}
    m = run(pg,"yay", [base, sw]); chk("yay: hatasız, yükseklik ~20+tel", not errs() and m and 19 < m["bb"][1][1]-m["bb"][0][1] < 23 and abs(m["bb"][1][0]-11)<0.3, (errs(), m))
    sw2 = json.loads(json.dumps(sw)); sw2["helix"]["taper"]=10; sw2["helix"]["left"]=True
    m = run(pg,"konik sol yay", [base, sw2]); chk("konik sol yay: hatasız", not errs() and m and m["f"] > 0, (errs(), m))
    # loft: kare → daire, başlangıç/bitiş profile dik
    sq = sketch("a","Kare",TOP, lambda pt,line,rect,circle,text: rect(-20,-20,20,20))
    ci = sketch("c","Daire",{"k":"std","n":"top","off":40} if False else {"k":"face","frame":{"o":[0,40,0],"x":[1,0,0],"n":[0,1,0]}}, lambda pt,line,rect,circle,text: circle(0,0,12))
    lf = {"id":"L1","type":"loft","name":"Loft","sketches":["a","c"],"cut":False,"ruled":False}
    m1 = run(pg,"loft", [sq, ci, lf])
    lf2 = dict(lf); lf2["tanStart"]=1; lf2["tanEnd"]=1
    m2 = run(pg,"loft teğet", [sq, ci, lf2]); chk("loft profile dik: hatasız, uçlar aynı, gövde biraz şişkin", not errs() and m2 and m2["bb"][1][1]==m1["bb"][1][1] and abs(m2["bb"][1][0]-m1["bb"][1][0])<2, (errs(), m1, m2))
    vol = lambda: pg.evaluate("window.__app.kernel.props ? null : null")
    # referans eksen: silindir yüzü
    cyl = [sketch("s9","C",TOP, lambda pt,line,rect,circle,text: (rect(-30,-30,30,30), circle(10,5,6))), ext("e9","s9",15)]
    run(pg,"blok", cyl)
    pg.click("#tabs button[data-tab='features']"); time.sleep(0.2)
    pg.click("#cmds button:has-text('Ref. Eksen')"); time.sleep(0.4)
    fi = lambda js: pg.evaluate(f"window.__app.viewer.mesh.faces.findIndex(f=>{js})")
    pg.evaluate(f"window.__app.pmPick({{kind:'face', index:{fi('f.r && Math.abs(f.r-6)<1e-6')}}})"); time.sleep(0.3)
    d = pg.evaluate("window.__app.mode.draft"); chk("eksen: silindir yüzü → delik ekseni", abs(abs(d["d"][1])-1)<1e-6 and abs(d["p"][0]-10)<1e-6 and abs(d["p"][2]+5)<1e-6, (d["p"], d["d"]))
    # iki düzlem: ön (z=+30) ve sağ (x=+30) yüzler
    pg.click("#pm-body button:has-text('İki düzlem')"); time.sleep(0.2)
    for js in ("f.n && f.n[2]>0.99", "f.n && f.n[0]>0.99"):
        pg.evaluate(f"window.__app.pmPick({{kind:'face', index:{fi(js)}}})"); time.sleep(0.3)
    d = pg.evaluate("window.__app.mode.draft"); chk("eksen: iki düzlemin kesişimi (x=30,z=30, Y yönü)", abs(abs(d["d"][1])-1)<1e-6 and abs(d["p"][0]-30)<1e-6 and abs(d["p"][2]-30)<1e-6, (d["p"], d["d"]))
    pg.click("#pm-ok"); time.sleep(0.4)
    # yapılandırmalar: L değişkeni ile ekstrüzyon derinliği
    pg.evaluate("(()=>{const a=window.__app; const d=JSON.parse(JSON.stringify(a.doc)); d.vars={L:'15'}; d.eqs={'e9.d1':'L'}; d.configs=[{name:'Kısa',vars:{},off:[]},{name:'Uzun',vars:{L:'40'},off:[]}]; d.config='Kısa'; a.setDoc(d);})()"); time.sleep(0.5); wait_ready(pg)
    h1 = pg.evaluate("window.__app.viewer.mesh.bbox.max[1]")
    pg.click("#tabs button[data-tab='evaluate']"); time.sleep(0.2)
    pg.click("#cmds button:has-text('Yapılandırmalar')"); time.sleep(0.3)
    pg.locator("dialog[open] input[type=radio]").nth(1).check(); time.sleep(1); wait_ready(pg)
    h2 = pg.evaluate("window.__app.viewer.mesh.bbox.max[1]")
    chk("yapılandırma değişince ölçü (15 → 40)", abs(h1-15)<1e-3 and abs(h2-40)<1e-3, (h1,h2))
    # bastırma sütunu: deliği değil eksenden sonra; ekstrüzyon bastırılamaz (gövde gider) → ref eksen satırı var mı
    chk("tasarım tablosunda özellik satırları", pg.locator("dialog[open] td:has-text('Bastır:')").count() >= 2)
    pg.click("dialog[open] button:has-text('Kapat')"); time.sleep(0.3)
    chk("ağaç başlığında etkin yapılandırma", "[Uzun]" in pg.inner_text("#part-name"), pg.inner_text("#part-name"))
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

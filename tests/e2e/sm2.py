# Sac 2: büküm boşaltma türleri (dikdörtgen / oval / yırtma), dairesel köşe boşaltması, kaynaklı köşe (açınımda bastırılır)
import cmdpatch, time, math
from h import *
ok=[]
def chk(n,c,i=""): ok.append(c); print(("TAMAM " if c else "HATA  ")+n, i)
def base(**kw):
    f={"id":"b1","type":"sheetbase","name":"T","sketch":"s1","t":2,"r":2,"k":0.5,"rev":False,"d":40,"mid":False,"relief":1}; f.update(kw); return f
def ef(id, m, **kw):
    f={"id":id,"type":"edgeflange","name":id,"edges":[{"m":mm} for mm in m],"L":30,"angle":90,"pos":"inside","lenRef":"outer","flip":False,"useDef":True,"r":2,"o1":0,"o2":0,"gap":0.2}; f.update(kw); return f
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.4)
    plate = sketch("s1","P",TOP, lambda pt,line,rect,circle,text: rect(0,0,100,60))
    vol = lambda: pg.evaluate("window.__app.kernel.props().then(p=>p.volume)")
    err = lambda: pg.eval_on_selector_all("#tree li.err", "els=>els.map(e=>e.title||e.textContent)")
    flat = lambda: pg.evaluate("window.__app.kernel.flat(0,2,0.5).then(r=>r.error||'ok')")
    V = {}
    for rt in ("none","rect","obround","tear"):
        bb = base(relief=0) if rt=="none" else base(**({} if rt=="rect" else {"rtype":rt}))
        run(pg,"boşaltma "+rt,[plate, bb, ef("e1",[[50,2,0]],o1=10,o2=10)]); V[rt]=vol()
        chk(f"boşaltma {rt}: açınım", flat()=="ok" and not err(), [flat(), err()])
    chk("hacim sırası dikdörtgen < oval < yırtma < boşaltmasız", V["rect"] < V["obround"] < V["tear"] < V["none"], V)
    # oval: dikdörtgenden farkı iki köşe parçası (rc²(1−π/4)·t × 2 uç)
    rc = 1.0  # boşaltma genişliği rr = 1×t = 2 → rc = 1
    chk("oval − dikdörtgen = 2 · rc²(4−π)/4 · t … (küçük pozitif)", 0 < V["obround"]-V["rect"] < 5, V["obround"]-V["rect"])
    # köşe boşaltması
    two = [[50,2,0],[100,2,-30]]
    run(pg,"köşe dikdörtgen",[plate, base(), ef("e1",two)]); vr=vol()
    run(pg,"köşe dairesel",[plate, base(ctype="circ"), ef("e1",two)]); vc=vol()
    chk("dairesel köşe boşaltması daha fazla malzeme kaldırır", vc < vr - 0.5 and not err(), [vr, vc, err()])
    chk("dairesel köşe: açınım", flat()=="ok", flat())
    # kaynaklı köşe
    feats=[plate, base(), ef("e1",[[50,2,0]],gap=0), ef("e2",[[100,2,-32]],gap=0)]
    run(pg,"iki flanş",feats)
    ends = pg.evaluate("window.__app.viewer.mesh.faces.filter(f=>f.n && f.n[2]>0.99 && f.c[0]>95 && f.c[2]<-3 && f.c[2]>-5).map(f=>[f.c,f.n])")
    cc = lambda **kw: {"id":"cc","type":"closecorner","name":"C","faces":[{"c":ends[0][0],"n":ends[0][1]}],"overlap":False,"gap":0.2, **kw}
    run(pg,"kapalı köşe",feats+[cc()]); v1=vol()
    run(pg,"kaynaklı köşe",feats+[cc(weld=True)]); v2=vol()
    chk("kaynaklı köşe boşluğu doldurur (hacim artar)", v2 > v1 + 0.5 and not err(), [v1, v2, err()])
    pg.click("#tabs button:has-text('Sac Metal')"); time.sleep(0.3)
    pg.evaluate("document.querySelector(\"#cmds button[title='Düzleştir']\").click()"); time.sleep(3); wait_ready(pg)
    chk("kaynaklı köşeli parça düzleşir (kaynak bastırılır)", pg.evaluate("window.__app.mode.k")=="flat", pg.evaluate("window.__app.mode.k"))
    pg.evaluate("document.querySelector(\"#cmds button[title='Düzleştir']\").click()"); time.sleep(1.5); wait_ready(pg)
    chk("düzleştirmeden çıkınca kaynaklı hacim geri", abs(vol()-v2)<0.01, vol())
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

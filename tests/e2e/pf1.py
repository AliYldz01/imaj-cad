# Parça özellikleri 1: yüz radyüsü, yüz–yüz pah, köşe pahı, kabukta yüz başına kalınlık (+ PM seçimleri)
import cmdpatch, time, math
from h import *
ok=[]
def chk(n,c,i=""): ok.append(c); print(("TAMAM " if c else "HATA  ")+n, i)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    ev = pg.evaluate
    box = [sketch("s1","S",FRONT,lambda pt,line,rect,c,t: rect(0,0,40,40)), ext("e1","s1",40)]
    vol = lambda: ev("window.__app.kernel.props().then(p=>p.volume)")
    err = lambda: pg.eval_on_selector_all("#tree li.err", "els=>els.map(e=>e.title||e.textContent)")
    TOPF={"c":[20,40,20],"n":[0,1,0]}; FRF={"c":[20,20,40],"n":[0,0,1]}; BOT={"c":[20,0,20],"n":[0,-1,0]}
    run(pg,"kutu",box); v0 = vol()
    run(pg,"yüz radyüsü",box+[{"id":"f1","type":"fillet","name":"R","r":5,"edges":[],"kind":"face","faces":[TOPF],"faces2":[FRF]}])
    dv = v0-vol(); chk("yüz radyüsü: üst ↔ ön ortak kenar R5", abs(dv-(1-math.pi/4)*25*40)<1, dv)
    run(pg,"yüz radyüsü komşu değil",box+[{"id":"f1","type":"fillet","name":"R","r":5,"edges":[],"kind":"face","faces":[TOPF],"faces2":[BOT]}])
    e = err(); chk("komşu olmayan yüzler hata verir", any("komşu" in x for x in e), e)
    run(pg,"yüz-yüz pah",box+[{"id":"c1","type":"chamfer","name":"P","d":5,"edges":[],"faces":[TOPF],"faces2":[FRF]}])
    dv = v0-vol(); chk("yüz–yüz pah 5 → 500 mm³", abs(dv-500)<1, dv)
    run(pg,"köşe pahı",box+[{"id":"c1","type":"chamfer","name":"P","d":10,"edges":[],"kind":"vtx","verts":[[40,40,40]]}])
    dv = v0-vol(); chk("köşe pahı eşit 10 → 166,7", abs(dv-1000/6)<0.5, dv)
    run(pg,"köşe pahı 2",box+[{"id":"c1","type":"chamfer","name":"P","d":10,"d2":20,"d3":30,"edges":[],"kind":"vtx","verts":[[40,40,40],[0,0,0]]}])
    dv = v0-vol(); chk("köşe pahı 10/20/30 iki köşe → 2000", abs(dv-2000)<1, dv)
    run(pg,"kabuk",box+[{"id":"k1","type":"shell","name":"K","t":2,"faces":[TOPF]}])
    chk("kabuk 2 mm → 14752", abs(vol()-14752)<1, vol())
    run(pg,"kabuk çoklu",box+[{"id":"k1","type":"shell","name":"K","t":2,"faces":[TOPF],"multi":[{"ref":FRF,"t":6}]}])
    chk("ön yüz 6 mm → 20224", abs(vol()-20224)<1, vol())
    run(pg,"kabuk ince",box+[{"id":"k1","type":"shell","name":"K","t":4,"faces":[TOPF],"multi":[{"ref":FRF,"t":1}]}])
    exp = 64000 - 32*(40-4)*(39-4)  # x 4..36, y 4..40, z 4..39
    exp = 64000 - 32*36*35
    chk("ön yüz 1 mm (kalan 4) → daha ince", abs(vol()-exp)<1, [vol(), exp])
    # PM: köşe pahı ve yüz radyüsü seçimleri
    run(pg,"kutu",box)
    pg.evaluate("window.__app.viewer.viewStd('iso')"); time.sleep(0.3)
    pg.evaluate("window.__app.newFeature ? 0 : 0")
    pg.click("#cmds button:has-text('Pah')"); time.sleep(0.4)
    pg.select_option("#pm select >> nth=0", "vtx"); time.sleep(0.2)
    r = pg.query_selector("#view").bounding_box()
    s = ev("window.__app.viewer.toScreen([40,40,40])")
    pg.mouse.click(r["x"]+s[0]+3, r["y"]+s[1]+3); time.sleep(0.3)
    nv = ev("window.__app.mode.draft.verts")
    chk("PM: köşeye dokunma → köşe", nv and len(nv)==1 and nv[0]==[40,40,40], nv)
    pg.click("#pm-ok"); time.sleep(1.5); wait_ready(pg)
    chk("PM köşe pahı uygulandı", abs(v0-vol()-4/6*1) < 0.1 or abs(v0-vol()-8/6) < 0.1, v0-vol())
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

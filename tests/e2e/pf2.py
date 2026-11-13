# Parça özellikleri 2: ayırma çizgisi konikliği (+ basamaklı), koniklik analizi, PM kenar seçimi
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
    box = [sketch("s1","S",FRONT,lambda pt,line,rect,c,t: rect(0,0,40,20)), ext("e1","s1",40)]
    vol = lambda: ev("window.__app.kernel.props().then(p=>p.volume)")
    err = lambda: pg.eval_on_selector_all("#tree li.err", "els=>els.map(e=>e.title||e.textContent)")
    bot = [{"m":[20,0,0],"d":[1,0,0]},{"m":[20,0,40],"d":[1,0,0]},{"m":[0,0,20],"d":[0,0,1]},{"m":[40,0,20],"d":[0,0,1]}]
    TOP = {"k":"std","n":"top"}
    run(pg,"kutu",box); v0=vol()
    dr = lambda **kw: {"id":"d1","type":"draft","name":"K","angle":5,"plane":TOP,"faces":[],"rev":False,"mode":"parting","edges":bot, **kw}
    run(pg,"ayırma çizgisi",box+[dr()])
    v1 = vol(); dl = 20*math.tan(math.radians(5))
    fr = lambda a,b2: 20/3*(a*a+b2*b2+a*b2)
    chk("ayırma çizgisi 5°: yan yüzler alt kenar etrafında (kesik piramit)", abs(v1-fr(40,40-2*dl))<2 or abs(v1-fr(40,40+2*dl))<2, [v0, v1, fr(40,40-2*dl)])
    chk("hata yok (ağaç)", not err(), err())
    run(pg,"ters",box+[dr(rev=True)])
    v2 = vol(); chk("ters yön diğer kesik piramit", abs(v2-v1)>50 and (abs(v2-fr(40,40-2*dl))<2 or abs(v2-fr(40,40+2*dl))<2), v2)
    run(pg,"öbür taraf",box+[dr(other=True)])
    e = err(); chk("öbür tarafta yüz yok → hata", any("yüz yok" in x for x in e), e)
    # basamaklı: L blok (alt basamak) — alt kenarlar y=0, üst blok kenarı y=20'de
    L = [sketch("s1","S",FRONT,lambda pt,line,rect,c,t: rect(0,0,40,20)), ext("e1","s1",40), sketch("s2","S2",TOP,lambda pt,line,rect,c,t: rect(0,0,20,-20)), ext("e2","s2",15)]
    m = run(pg,"basamak",L); vl0 = vol()
    run(pg,"basamaklı",L+[{"id":"d1","type":"draft","name":"K","angle":5,"plane":TOP,"faces":[],"rev":False,"mode":"parting","edges":[{"m":[10,20,0],"d":[1,0,0]}]+bot[:1]}])
    chk("basamaklı ayırma çizgisi (iki yükseklik) kurulur", not err() and abs(vol()-vl0)>1, [vl0, vol(), err()])
    # koniklik analizi
    run(pg,"kutu",box)
    pg.click("#tabs button:has-text('Değerlendir')"); time.sleep(0.3)
    pg.click("#cmds button:has-text('Koniklik Analizi')"); time.sleep(0.4)
    st = pg.inner_text(".draft-ana .da-stat")
    chk("analiz: +Y 1 pozitif, 1 negatif, 4 gerekli", "Pozitif 1" in st and "Negatif 1" in st and "gerekli 4" in st, st)
    col = ev("(()=>{const g=window.__app.viewer.modelMesh.geometry; return !!g.getAttribute('color')})()")
    chk("renkler uygulandı", col)
    run(pg,"koniklikli",box+[dr(rev=True)] if v2>v1 else box+[dr()])
    pg.select_option(".draft-ana select", "2"); time.sleep(0.3)
    run(pg,"koniklikli",box+([dr(rev=True)] if v2<v1 else [dr()]))
    pg.select_option(".draft-ana select", "2"); time.sleep(0.3)
    st2 = pg.inner_text(".draft-ana .da-stat")
    chk("koniklikten sonra yanlar pozitif (5 pozitif)", "Pozitif 5" in st2, st2)
    pg.click(".draft-ana button:has-text('Kapat')"); time.sleep(0.2)
    chk("kapat: renk kalkar", not pg.is_visible(".draft-ana") and not ev("(()=>{const g=window.__app.viewer.modelMesh.geometry; return !!g.getAttribute('color')})()"))
    # PM: ayırma çizgisi kenar seçimi
    run(pg,"kutu",box)
    pg.click("#tabs button:has-text('Özellikler')"); time.sleep(0.3)
    pg.click("#cmds button:has-text('Koniklik')"); time.sleep(0.4)
    pg.click("#pm button:has-text('Ayırma çizgisi')"); time.sleep(0.2)
    r = pg.query_selector("#view").bounding_box()
    ev("window.__app.viewer.viewStd('iso')"); time.sleep(0.3)
    s = ev("window.__app.viewer.toScreen([20,0,40])")
    pg.mouse.click(r["x"]+s[0], r["y"]+s[1]+2); time.sleep(0.3)
    ne = ev("(window.__app.mode.draft.edges||[]).length")
    chk("PM: kenara dokunma → ayırma kenarı", ne==1, ne)
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

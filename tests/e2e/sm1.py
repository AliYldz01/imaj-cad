# Sac 1: flanş profilini serbest eskizle düzenleme (dikdörtgen = standart, üçgen, uzun dar, delikli), açınım, PM
import cmdpatch, time, math
from h import *
ok=[]
def chk(n,c,i=""): ok.append(c); print(("TAMAM " if c else "HATA  ")+n, i)
def base(**kw):
    f={"id":"b1","type":"sheetbase","name":"T","sketch":"s1","t":2,"r":2,"k":0.5,"rev":False,"d":40,"mid":False,"relief":0.5}; f.update(kw); return f
def ef(**kw):
    f={"id":"e1","type":"edgeflange","name":"e1","edges":[{"m":[50,2,0]}],"L":30,"angle":90,"pos":"inside","lenRef":"outer","flip":False,"useDef":True,"r":2,"o1":0,"o2":0,"gap":0.2}; f.update(kw); return f
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.4)
    plate = sketch("s1","E",TOP, lambda pt,line,rect,circle,text: rect(0,0,100,60))
    vol = lambda: pg.evaluate("window.__app.kernel.props().then(p=>p.volume)")
    err = lambda: pg.eval_on_selector_all("#tree li.err", "els=>els.map(e=>e.title||e.textContent)")
    run(pg,"düz",[plate, base(), ef()]); v0=vol()
    def prof(build): return sketch("p1","Profil",FRONT,build)
    run(pg,"dikdörtgen profil",[plate, base(), prof(lambda pt,line,rect,c,t: rect(0,0,100,26)), ef(prof="p1")])
    chk("dikdörtgen profil = standart flanş", abs(vol()-v0)<1, [vol(), v0, err()])
    def tri(pt,line,rect,c,t):
        a,b2,cc = pt(0,0),pt(100,0),pt(50,26); line(a,b2); line(b2,cc); line(cc,a)
    run(pg,"üçgen",[plate, base(), prof(tri), ef(prof="p1")])
    chk("üçgen profil: hacim 1300×2 azalır", abs((v0-vol())-2600)<2, [v0-vol(), err()])
    run(pg,"uzun dar",[plate, base(), prof(lambda pt,line,rect,c,t: rect(30,0,70,50)), ef(prof="p1")])
    chk("uzun dar profil (40×50): hacim (2600−2000)×2 azalır", abs((v0-vol())-1200)<2, [v0-vol(), err()])
    def holed(pt,line,rect,c,t): rect(0,0,100,26); c(50,13,5)
    run(pg,"delikli",[plate, base(), prof(holed), ef(prof="p1")])
    chk("delikli profil: π·25·2 azalır", abs((v0-vol())-math.pi*50)<1, [v0-vol(), err()])
    fl = pg.evaluate("window.__app.kernel.flat(0,2,0.5).then(r=>r.error||{w:+r.w.toFixed(2),h:+r.h.toFixed(2)})")
    chk("açınım hatasız", isinstance(fl, dict), fl)
    chk("profil eskizi ağaçta flanşın altında", pg.is_visible("#tree li.child:has-text('Profil')"))
    # PM: profil eskizi oluştur
    run(pg,"pm",[plate, base(), ef()])
    pg.click("#tree li:has-text('e1')"); pg.click("#tree-actions button:has-text('Düzenle')"); time.sleep(0.5)
    pg.click("#pm button:has-text('Profil eskizi oluştur')"); time.sleep(0.6)
    pid = pg.evaluate("window.__app.mode.draft.prof")
    chk("PM: profil eskizi oluşturuldu ve atandı", bool(pid) and pg.evaluate(f"!!window.__app.doc.features.find(f=>f.id==='{pid}')"), pid)
    pg.click("#pm-ok"); time.sleep(1); wait_ready(pg)
    chk("oluşturulan profil standart hacim", abs(vol()-v0)<1, [vol(), v0, err()])
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

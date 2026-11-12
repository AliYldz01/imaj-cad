# 3B eskiz (SolidWorks): tıklayarak çizim, eksen çıkarımı, Tab düzlem, sayı ile uzunluk, çift tık bitir,
# çizgi uzunluğu düzenleme; yapı elemanı profil yönü (dikey eksen yukarı) ve grafik alanda segment seçimi
import cmdpatch, time, json
from h import *
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    pg.click("#tabs button[data-tab='weld']")
    pg.click("#cmds button:has-text('3B Eskiz')"); time.sleep(0.4)
    pg.click(".vcube .iso"); time.sleep(0.3)
    R = pg.query_selector("#view").bounding_box()
    def S(x,y,z):
        s = pg.evaluate(f"window.__app.viewer.toScreen([{x},{y},{z}])"); return R['x']+s[0], R['y']+s[1]
    D = lambda js: pg.evaluate(f"(()=>{{const d=window.__app.mode.draft; return {js}}})()")
    # 1) orijine tıkla (yakalama), 2) +X yönünde (eksen çıkarımı), 3) +Z
    for pt in [(0,0,0),(200,0,0)]:
        x,y = S(*pt); pg.mouse.move(x+3,y+2); time.sleep(0.05); pg.mouse.click(x+3,y+2); time.sleep(0.15)
    print("tip:", pg.inner_text(".s3-tip"))
    x,y = S(200,0,150); pg.mouse.move(x+1,y-3); time.sleep(0.05); print("tip z:", pg.inner_text(".s3-tip")); pg.mouse.click(x+1,y-3); time.sleep(0.15)
    # Tab: düzlem değişir
    pg.keyboard.press("Tab"); print("plane after Tab:", pg.evaluate("window.__app.s3.planeName"))
    # +Y yönüne imleci götür, 300 yaz Enter
    x,y = S(200,120,150); pg.mouse.move(x+2,y); time.sleep(0.1)
    pg.keyboard.press("3"); pg.keyboard.type("00"); pg.keyboard.press("Enter"); time.sleep(0.2)
    print("pts:", D("JSON.stringify(d.xyz)"), "ax:", D("d.lines.map(l=>l.ax||'-').join(',')"))
    # çift tık: zinciri bitir
    x,y = S(400,300,150); pg.mouse.dblclick(x,y); time.sleep(0.2)
    print("after dbl: act", D("d._act"), "lines", D("d.lines.length"))
    # boşluğa tek tık: yeni zincir başlar (çizgi eklenmez)
    x,y = S(0,0,300); pg.mouse.click(x,y); time.sleep(0.15)
    print("new chain start: lines", D("d.lines.length"), "pts", D("d.xyz.length"))
    pg.keyboard.press("Escape"); time.sleep(0.1); print("esc keeps PM:", pg.evaluate("window.__app.mode.k"))
    # çizgi uzunluğu: 1. çizgi 200 → 250 (bağlı noktalar kayar)
    f = pg.locator("#pm-body .pm-row label.pm-field input").first
    f.fill("250"); f.press("Enter"); time.sleep(0.2)
    print("after len edit:", D("JSON.stringify(d.xyz.slice(0,4))"))
    pg.click("#pm-ok"); time.sleep(0.6); wait_ready(pg)
    # yapı elemanı: dikdörtgen kutu 100x50 (h=100 dikey olmalı)
    pg.click("#cmds button:has-text('Yapı Elemanı')"); time.sleep(0.5)
    pg.select_option("#pm-body select >> nth=0", "dkutu"); time.sleep(0.3)
    pg.select_option("#pm-body select >> nth=1", "100x50x4"); time.sleep(0.3)
    sel = lambda: pg.evaluate("window.__app.mode.draft.segs.length")
    print("segs initially:", sel())
    # grafik alanda X çizgisine tıkla → seçimden çıkar, tekrar tıkla → ekle
    x,y = S(125,0,0); pg.mouse.click(x,y); time.sleep(0.2); n1 = sel()
    pg.mouse.click(x,y); time.sleep(0.2); print("seg click toggle:", n1, "->", sel())
    pg.click("#pm-ok"); time.sleep(1.5); wait_ready(pg)
    print("status:", pg.inner_text('#status-text'), pg.eval_on_selector_all("#tree li.err", "els=>els.map(e=>e.title)"))
    # tek X çizgisi üzerinde yön kontrolü (3B eskiz ve 2B üst düzlem eskizi)
    s3 = {"id":"k","type":"sketch3d","name":"K","ids":["a","b"],"xyz":[[0,0,0],[500,0,0]],"lines":[{"id":"l1","a":"a","b":"b"}],"r":0,"seq":3}
    mem = lambda sk,ent,**kw: dict({"id":"m","type":"member","name":"M","segs":[{"sk":sk,"ent":ent}],"std":"dkutu","size":"100x50x4","align":"c","mirror":False,"rot":0,"corner":"miter","gap":0,"ori":2},**kw)
    run(pg,"3B X cizgisi (Y=100 bekleniyor)",[s3, mem("k","l1")])
    s3z = dict(s3, xyz=[[0,0,0],[0,0,500]])
    run(pg,"3B Z cizgisi (Y=100)",[s3z, mem("k","l1")])
    s3y = dict(s3, xyz=[[0,0,0],[0,500,0]])
    run(pg,"3B dusey (Y=500, Z=100)",[s3y, mem("k","l1")])
    sk = sketch("s1","S",TOP,lambda pt,line,rect,c,t: line(pt(0,0),pt(500,0)))
    ent = [e["id"] for e in sk["data"]["ents"] if e["t"]=="line"][0]
    run(pg,"2B ust duzlem X (Y=100)",[sk, mem("s1",ent)])
    run(pg,"delme ust (Y -100..0)",[s3, mem("k","l1",align="t")])
    print("errors:", logs)

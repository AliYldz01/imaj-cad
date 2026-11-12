from h import *
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e))); pg.on("dialog", lambda d: d.accept("Özel 30x50"))
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    ids=[]
    sk=sketch("s1","İskelet",FRONT, lambda pt,line,rect,circle,text: ids.extend([line(pt(0,0),pt(800,0)), line(pt(800,0),pt(800,400))]))
    prof=sketch("s2","Profil",RIGHT, lambda pt,line,rect,circle,text: (rect(-15,-25,15,25), circle(0,0,8)))
    m={"id":"m1","type":"member","name":"Y","segs":[{"sk":"s1","ent":i} for i in ids],"std":"sketch","size":"s2","align":"c","mirror":False,"rot":0,"corner":"miter","gap":0}
    run(pg,"sketch profile",[sk,prof,m])
    print("  ", pg.evaluate("async()=>(await window.__app.kernel.cutList()).map(c=>[c.name,+c.length.toFixed(1),+c.a1.toFixed(1)])"))
    # UI: kütüphaneye ekle
    pg.click("#tree li:has-text('Yapı-Elemanı') , #tree li:has-text('Y')") if False else None
    pg.evaluate("window.__app.doc.features.find(f=>f.id==='m1')")
    pg.click("#tabs button[data-tab='weld']")
    pg.click("#tree li >> text=Y"); time.sleep(0.2)
    pg.click("#tree-actions button:has-text('Düzenle')"); time.sleep(0.6)
    pg.click("#pm-body button:has-text('kütüphaneye ekle')"); time.sleep(0.8); wait_ready(pg)
    print("  std/size:", pg.evaluate("[window.__app.mode.draft.std, window.__app.mode.draft.size]"), pg.evaluate("Object.values(window.__app.doc.profiles||{}).map(p=>p.name)"))
    pg.click("#pm-ok"); time.sleep(0.8); wait_ready(pg)
    print("  after:", pg.inner_text('#status-text'), pg.evaluate("async()=>(await window.__app.kernel.cutList()).map(c=>c.name)"))
    print("  lib:", pg.evaluate("Object.values(JSON.parse(localStorage.getItem('imajcad.profiles'))).map(p=>p.name)"))
    print("errors:", logs[:5] or "none")
    b.close()

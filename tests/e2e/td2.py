# Teknik resim ekleri: ölçü sürükleme (kalıcı), detay görünüşü B + tıklayarak merkez, 2. sayfa, montajda patlatılmış görünüş
import cmdpatch, time, json, re
from h import *
ok=[]
def chk(n,c,i=""): ok.append(c); print(("TAMAM " if c else "HATA  ")+n, i)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}, accept_downloads=True); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e))); pg.on("dialog", lambda d: d.accept())
    pg.goto(URL); wait_ready(pg); time.sleep(0.4)
    feats=[sketch("s1","S",FRONT,lambda pt,line,rect,c,t: (rect(0,0,80,50), c(20,25,6), c(60,25,6), c(40,25,10))), ext("e1","s1",20)]
    run(pg,"parça",feats)
    pg.evaluate("localStorage.setItem('imajcad.techdraw', JSON.stringify({iso:true, section:false, dims:true, paper:'A4'}))")
    pg.click("#tabs button[data-tab='evaluate']"); time.sleep(0.2)
    pg.click("#cmds button:has-text('Teknik Resim')"); time.sleep(6)
    fr = pg.frame_locator("dialog[open] iframe")
    ifr = pg.locator("dialog[open] iframe").bounding_box()
    def gbox(sel):
        return pg.evaluate(f"(()=>{{const d=document.querySelector('dialog[open] iframe').contentDocument; const r=d.querySelector('{sel}').getBoundingClientRect(); return [r.x,r.y,r.width,r.height]}})()")
    sv = lambda: pg.evaluate("document.querySelector('dialog[open]')._svg")
    chk("ölçüler sürüklenebilir grup", 'data-dim="fw"' in sv() and 'data-dim="d:12"' in sv())
    y_before = re.search(r'data-dim="fw"[^>]*>(.*?)</g>', sv()).group(1)
    x,y,w,h = gbox('[data-dim="fw"] text')
    sx, sy = ifr["x"]+x+w/2, ifr["y"]+y+h/2
    pg.mouse.move(sx, sy); pg.mouse.down(); pg.mouse.move(sx+30, sy+25, steps=6); pg.mouse.up(); time.sleep(1.2)
    off = pg.evaluate("window.__app.doc ? window.__app.doc.drawing : null") or pg.evaluate("JSON.parse(localStorage.getItem('imajcad.doc.v2')).drawing")
    chk("ölçü yalnız dikeyde kaydı ve kaydedildi", off and off["off"]["fw"][0]==0 and off["off"]["fw"][1] > 3, off)
    chk("SVG'de ölçü yeni yerde", re.search(r'data-dim="fw"[^>]*>(.*?)</g>', sv()).group(1) != y_before)
    # detay B
    pg.locator("dialog[open] label:has-text('Detay B') input").check(); time.sleep(1.5)
    sh = pg.evaluate("document.querySelector('dialog[open]')._sheets")
    chk("2 sayfa, detay görünüşü", len(sh)==2 and "DETAY B" in sh[1] and "clipPath" in sh[1] and "Sayfa 2 / 2" in sh[1], len(sh))
    chk("ön görünüşte B işareti", ">B<" in sh[0])
    # ön görünüşte (60,25) deliğine tıkla → detay merkezi
    # yerleşimden ekran koordinatı
    fpl = pg.evaluate("document.querySelector('dialog[open]')._front")
    m = pg.evaluate(f"""(()=>{{const fr=document.querySelector('dialog[open] iframe'); const sv=fr.contentDocument.querySelector('.page svg'); const M=sv.getScreenCTM();
       const F={json.dumps(fpl)}; const x=F.ox+(20-F.min[0])*F.s, y=F.oy+(F.max[1]-0)*F.s; const q=new DOMPoint(x,y).matrixTransform(M); return [q.x,q.y]}})()""")
    pg.mouse.click(ifr["x"]+m[0], ifr["y"]+m[1]); time.sleep(1.2)
    det = pg.evaluate("document.querySelector('dialog[open]')._dr.detail")
    chk("tıklanan yer detay merkezi (sağ delik)", det and abs(det["x"]-20)<1e-6 and abs(det["y"])<1e-6, det)
    sh = pg.evaluate("document.querySelector('dialog[open]')._sheets")
    chk("detayda Ø12", "Ø12" in sh[1])
    with pg.expect_download() as dl: pg.click("dialog[open] button:has-text('SVG indir')")
    time.sleep(0.5)
    pg.locator("dialog[open] iframe").screenshot(path="/home/claude/td2_part.png")
    open("/tmp/td2_s2.svg","w").write(sh[1])
    pg.click("dialog[open] button:has-text('Kapat')"); time.sleep(0.3)
    pg.click("#cmds button:has-text('Teknik Resim')"); time.sleep(6)
    sh = pg.evaluate("document.querySelector('dialog[open]')._sheets")
    chk("yeniden açınca ölçü ve detay korunur", len(sh)==2 and re.search(r'data-dim="fw"[^>]*>(.*?)</g>', sh[0]).group(1) != y_before, len(sh))
    pg.click("dialog[open] button:has-text('Ölçü konumlarını sıfırla')"); time.sleep(1)
    chk("sıfırla", re.search(r'data-dim="fw"[^>]*>(.*?)</g>', pg.evaluate("document.querySelector('dialog[open]')._svg")).group(1) == y_before)
    pg.click("dialog[open] button:has-text('Kapat')")
    # montaj: patlatılmış
    plate = [sketch("s1","S",TOP,lambda pt,line,rect,c,t: (rect(-50,-50,50,50), c(0,0,5))), ext("e1","s1",10)]
    pin = [sketch("s1","S",TOP,lambda pt,line,rect,c,t: c(0,0,4.9)), ext("e1","s1",30)]
    pg.click("#tabs button[data-tab='asm']"); time.sleep(0.3)
    pg.click("#cmds button:has-text('Montajı Aç')"); time.sleep(0.5)
    asm = lambda js: pg.evaluate(f"(async()=>{{const a=window.__app.asm; {js}}})()")
    asm(f"a.addComp({{name:'Plaka', features:{json.dumps(plate)}}})"); time.sleep(2); wait_ready(pg)
    asm(f"a.addComp({{name:'Pim', features:{json.dumps(pin)}}}); a.doc.comps[1].p=[0,0,0]; return 0"); time.sleep(2); wait_ready(pg)
    asm("a.doc.steps=[{id:'x1',comps:[a.doc.comps[1].id],dir:[0,1,0],d:60}]; return 0")
    pg.click("#cmds button:has-text('Montaj Resmi')"); time.sleep(12)
    sh = pg.evaluate("document.querySelector('dialog[open]')._sheets")
    chk("montaj 2. sayfa patlatılmış + balonlar", sh and len(sh)==2 and "PATLATILMIŞ" in sh[1] and sh[1].count('r="4"')==2, sh and len(sh))
    open("/tmp/td2_a2.svg","w").write(sh[1])
    chk("hata yok", not logs, logs)
    for f in ["s2","a2"]:
        p2 = b.new_page(viewport={"width":1123,"height":794}); p2.set_content('<img src="data:image/svg+xml;base64,'+__import__("base64").b64encode(open(f"/tmp/td2_{f}.svg","rb").read()).decode()+'" style="width:1123px">'); time.sleep(0.5); p2.screenshot(path=f"/home/claude/td2_{f}.png"); p2.close()
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

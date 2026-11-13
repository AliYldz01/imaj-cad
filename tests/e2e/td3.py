# Teknik resim açıklamaları: kullanıcı ölçüsü (2 nokta, çap), tolerans, otomatik ölçü düzenle / gizle,
# pürüzlülük, geometrik tolerans, referans, görünüş taşıma (gerçek sürükleme), kalıcılık, DXF
import cmdpatch, time, json, re
from h import *
ok=[]
def chk(n,c,i=""): ok.append(c); print(("TAMAM " if c else "HATA  ")+n, i)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e))); pg.on("dialog", lambda d: d.accept())
    pg.goto(URL); wait_ready(pg); time.sleep(0.4)
    feats=[sketch("s1","S",FRONT,lambda pt,line,rect,c,t: (rect(0,0,80,50), c(40,25,6))), ext("e1","s1",20)]
    run(pg,"parça",feats)
    pg.evaluate("localStorage.setItem('imajcad.techdraw', JSON.stringify({iso:false, section:true, dims:true, paper:'A4'}))")
    def open_td():
        pg.click("#tabs button[data-tab='evaluate']"); time.sleep(0.2)
        pg.click("#cmds button:has-text('Teknik Resim')"); time.sleep(6)
    open_td()
    D = "document.querySelector('dialog[open]')"
    sv = lambda: pg.evaluate(f"{D}._svg")
    td = lambda js: pg.evaluate(f"(()=>{{const t={D}._td; {js}}})()")
    # görünüş koordinatı → kağıt
    def paper(view, x, y):
        P = td(f"return t.places['{view}']")
        return [P["ox"]+(x-P["min"][0])*P["s"], P["oy"]+(P["max"][1]-y)*P["s"]]
    F = td("return t.places.front")
    chk("görünüş yerleşimleri (ön, üst, sol, kesit)", all(k in td("return t.places") for k in ["front","top","left","sec"]))
    # 1) ölçü: ön görünüşte üst kenarın iki köşesi (yakalama ile)
    td("t.setTool('dim'); return 0")
    a = paper("front", F["min"][0]+0.4, F["max"][1]-0.3); bb = paper("front", F["max"][0]-0.3, F["max"][1]-0.2)
    td(f"t.addAt({a[0]},{a[1]}); t.addAt({bb[0]},{bb[1]}); return 0"); time.sleep(0.6)
    u = td("return t.dr.user[0]")
    chk("2 noktadan yatay ölçü (köşelere yakalandı)", u and u["dir"]=="h" and abs(abs(u["a"][0]-u["b"][0])-80)<1e-6, u)
    uid = u["id"]
    g = re.search(rf'data-dim="u:{uid}"[^>]*>(.*?)</g>', sv(), re.S)
    chk("ölçü resimde: 80", g and ">80<" in g.group(1))
    # tolerans
    td("t.dr.user[0].tol={t:'sym',up:0.1}; t.select('u:'+t.dr.user[0].id); return 0"); time.sleep(0.6)
    chk("± tolerans: 80 ±0,1", "80 ±0,1" in sv())
    chk("düzenleme alanı açık (Sil düğmesi)", pg.locator("dialog[open] .td-edit button:has-text('Sil')").count()==1)
    # 2) daire çevresine dokunuş → çap
    cp = paper("front", F["min"][0]+40+6, F["min"][1]+25)
    td(f"t.addAt({cp[0]},{cp[1]}); return 0"); time.sleep(0.6)
    chk("daire çevresine dokunuş: Ø12 çap ölçüsü", td("return t.dr.user.some(u=>u.dir==='d' && Math.abs(u.b[0]-6)<1e-6)"))
    # 3) otomatik ölçü düzenle / gizle
    td("t.dr.ovr.fh={tol:{t:'dev',up:0.2,lo:-0.1}}; t.dr.ovr.th={hide:true}; t.dr.ovr.fw={text:'80', tol:{t:'fit',fit:'h7'}}; t.select(null); return 0"); time.sleep(0.6)
    s = sv()
    chk("otomatik ölçüye sapma toleransı", "50 +0,2 / −0,1" in s, re.findall(r'50[^<]{0,20}', s)[:3])
    chk("otomatik ölçü gizlendi", 'data-dim="th"' not in s)
    chk("uyum toleransı (80 h7)", "80 h7" in s)
    # 4) pürüzlülük, geometrik tolerans, referans (üst kenara dokunarak)
    e = paper("front", F["min"][0]+20, F["max"][1]-0.5)
    for tool in ["ra","gdt","datum"]:
        td(f"t.setTool('{tool}'); t.addAt({e[0]},{e[1]}); return 0"); time.sleep(0.5)
    s = sv()
    chk("pürüzlülük sembolü Ra 3,2", "Ra 3,2" in s)
    chk("geometrik tolerans çerçevesi ⏥ 0,05", "⏥" in s and "0,05" in s)
    chk("referans A", re.search(r'data-dim="n:[^"]+"[^>]*>(?:(?!</g>).)*>A<', s, re.S) is not None)
    nts = td("return t.dr.notes.map(n=>n.kind)")
    chk("açıklamalar kenara yapıştı (y = üst kenar)", td(f"return t.dr.notes.every(n=>Math.abs(n.at[1]-{F['max'][1]})<1e-6)"), nts)
    # 5) kesit görünüşünü gerçek sürükleme ile taşı
    td("t.setTool('sel'); return 0")
    S0 = td("return t.places.sec")
    c = paper("sec", (S0["min"][0]+S0["max"][0])/2, (S0["min"][1]+S0["max"][1])/2)
    ifr = pg.locator("dialog[open] iframe").bounding_box()
    m = pg.evaluate(f"""(()=>{{const fr=document.querySelector('dialog[open] iframe'); const sv=fr.contentDocument.querySelector('.page svg'); const M=sv.getScreenCTM();
       const q=new DOMPoint({c[0]},{c[1]}).matrixTransform(M); const q2=new DOMPoint({c[0]+25},{c[1]+8}).matrixTransform(M); return [q.x,q.y,q2.x,q2.y]}})()""")
    pg.mouse.move(ifr["x"]+m[0], ifr["y"]+m[1]); pg.mouse.down(); pg.mouse.move(ifr["x"]+m[2], ifr["y"]+m[3], steps=8); pg.mouse.up(); time.sleep(1.2)
    S1 = td("return t.places.sec")
    chk("kesit görünüşü taşındı (~25, 8 mm)", abs(S1["ox"]-S0["ox"]-25)<1 and abs(S1["oy"]-S0["oy"]-8)<1, (S0["ox"],S1["ox"],S0["oy"],S1["oy"]))
    chk("kesit görünüşü konumu kaydedildi", td("return !!t.dr.vOff.sec"))
    # 6) DXF ve kalıcılık
    pg.click("dialog[open] button:has-text('Kapat')"); time.sleep(0.5)
    dd = pg.evaluate("window.__app.doc.drawing")
    chk("parçayla kaydedildi (ölçü, açıklama, görünüş, düzeltme)", len(dd["user"])==2 and len(dd["notes"])==3 and "sec" in dd["vOff"] and dd["ovr"]["th"]["hide"], {k: (len(v) if isinstance(v,(list,dict)) else v) for k,v in dd.items()})
    open_td()
    s = sv()
    chk("yeniden açınca hepsi yerinde", "80 ±0,1" in s and "Ra 3,2" in s and "⏥" in s and 'data-dim="th"' not in s)
    pg.click("dialog[open] button:has-text('Gizli ölçüleri göster')"); time.sleep(0.8)
    chk("gizli ölçüleri göster", 'data-dim="th"' in sv())
    pg.screenshot(path="/home/claude/td3.png")
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

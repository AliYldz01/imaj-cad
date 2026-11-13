# Genel 1: belge sekmeleri, dosya yöneticisi, belge özellikleri (ondalık / ANSI / özel), dışa aktarma (3MF, PDF, eskiz / yüz DXF), panel iğnesi, kırıntılar, şerit özelleştirme, görev bölmesi
import cmdpatch, time, json
from h import *
ok=[]
def chk(n,c,i=""): ok.append(bool(c)); print(("TAMAM " if c else "HATA  ")+n, i)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    ctx = b.new_context(viewport={"width":1400,"height":900}, accept_downloads=True)
    pg = ctx.new_page(); logs=[]; pg.on("pageerror", lambda e: logs.append(str(e)))
    ans = {"v": True}
    pg.on("dialog", lambda d: d.accept())
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    ev = pg.evaluate
    box = [sketch("s1","S",FRONT,lambda pt,line,rect,c,t: rect(0,0,40,30)), ext("e1","s1",20)]
    run(pg,"kutu",box)
    ev("window.__app.doc.name='A'")
    ev("window.__app.fileAct('new')"); time.sleep(1); wait_ready(pg)
    t = ev("window.__app.tabs")
    chk("Yeni → ikinci sekme, boş belge", t["n"]==2 and t["active"]==1 and ev("window.__app.doc.features.length")==0, t)
    chk("sekme çubuğu görünür (2 sekme)", pg.is_visible("#doctabs") and pg.locator("#doctabs .dtab").count()==2)
    pg.click("#doctabs .dtab >> nth=0 >> span"); time.sleep(1); wait_ready(pg)
    chk("ilk sekmeye dönünce kutu geri", ev("window.__app.doc.features.length")==2 and ev("window.__app.viewer.mesh.faces.length")==6)
    pg.click("#doctabs .dtab >> nth=1 >> span"); time.sleep(0.8); wait_ready(pg)
    pg.click("#doctabs .dtab.on .dtab-x"); time.sleep(1); wait_ready(pg)
    chk("sekme kapat → tek sekme, kutu", ev("window.__app.tabs")["n"]==1 and ev("window.__app.doc.features.length")==2)
    # dosya yöneticisi
    ev("window.__app.fileAct('files')"); time.sleep(0.4)
    chk("dosya yöneticisi penceresi", pg.is_visible("dialog.filemgr") and "BELGELER" in pg.inner_text("dialog.filemgr").upper())
    pg.click("dialog.filemgr button:has-text('Kapat') >> nth=-1"); time.sleep(0.2)
    # belge özellikleri
    ev("window.__app.fileAct('docprops')"); time.sleep(0.4)
    pg.fill("dialog.docprops label:has-text('ondalık') input", "3")
    pg.select_option("dialog.docprops select", "ANSI")
    pg.fill("dialog.docprops label:has-text('Yazar') input", "Ali")
    pg.click("dialog.docprops button:has-text('Özellik ekle')"); time.sleep(0.1)
    pg.locator("dialog.docprops .cp-list input").nth(0).fill("Proje"); pg.locator("dialog.docprops .cp-list input").nth(1).fill("P-17")
    pg.click("dialog.docprops button:has-text('Tamam')"); time.sleep(0.8); wait_ready(pg)
    pr = ev("window.__app.doc.props")
    chk("belge özellikleri kaydedildi", pr and pr["dec"]==3 and pr["std"]=="ANSI" and pr["custom"][0]["v"]=="P-17", pr)
    chk("ölçü ondalığı 3 (lenTxt)", ev("window.__app.math.lenTxt(12.34567)")=="12,346")
    dr = ev("(async()=>{const r=await window.__app.kernel.pdraw([], {third:true}); return 0})()")
    names = ev("""(async()=>{const app=window.__app; const {compile}=await Promise.resolve({compile:null}); return 0})()""")
    # üçüncü açı: sağ görünüş — teknik resim penceresinde antet yazısı
    ev("window.__app.fileAct('techdraw')") if False else None
    pg.click("#tabs button:has-text('Değerlendir')"); time.sleep(0.3)
    ev("document.querySelector(\"#cmds button[title='Teknik Resim']\").click()"); time.sleep(4)
    html = ev("(()=>{const f=document.querySelector('dialog.draw-dialog iframe'); return f ? (f.srcdoc||f.contentDocument?.documentElement.outerHTML||'') : ''})()")
    chk("teknik resim: üçüncü açı + sağ görünüş + özel özellik", "Üçüncü açı" in html and "SAĞ GÖRÜNÜŞ" in html and "P-17" in html, [("Üçüncü açı" in html), ("SAĞ GÖRÜNÜŞ" in html), ("P-17" in html)])
    pg.keyboard.press("Escape"); time.sleep(0.3)
    ev("document.querySelectorAll('dialog').forEach(d=>d.close())")
    # dışa aktarma
    def dl(act):
        with pg.expect_download(timeout=15000) as d: ev(f"window.__app.fileAct('{act}')")
        return open(d.value.path(),"rb").read()
    z = dl("3mf"); chk("3MF: zip + 3dmodel", z[:2]==b"PK" and b"3D/3dmodel.model" in z and b"<triangle" in z, len(z))
    pdf = dl("pdf"); chk("PDF: başlık + JPEG", pdf[:5]==b"%PDF-" and b"DCTDecode" in pdf, len(pdf))
    ev("window.__app.doc.features.find(f=>f.type==='sketch') && 0")
    pg.click("#tree li.child"); time.sleep(0.3)
    sd = dl("skdxf").decode(); chk("eskiz DXF: 4 LINE", sd.count("\nLINE\r")>=4 or sd.count("LINE")>=4, sd.count("LINE"))
    fi = ev("window.__app.viewer.mesh.faces.findIndex(f=>f.n&&f.n[2]>0.99)")
    ev(f"window.__app.select ? 0 : 0")
    ev(f"(()=>{{const a=window.__app; a.psel ? a.psel.faces.add({fi}) : 0}})()")
    # yüz seç: gerçek tıklama
    pg.keyboard.press("Escape")
    r = pg.query_selector("#view").bounding_box()
    ev("window.__app.viewer.viewStd('iso')"); time.sleep(0.3)
    s = ev("window.__app.viewer.toScreen([20,15,20])")
    pg.mouse.click(r["x"]+s[0], r["y"]+s[1]); time.sleep(1.2)
    cr = pg.inner_text("#crumbs")
    chk("kırıntılar: belge › özellik › yüz", "A" in cr and "Yüz" in cr and "e1" in cr, cr)
    fd = dl("facedxf").decode(); chk("yüz DXF: kapalı çoklu çizgi", "POLYLINE" in fd and "VERTEX" in fd, fd.count("VERTEX"))
    # panel iğnesi
    pg.click("#tabs button:has-text('Özellikler')"); time.sleep(0.3)
    ev("document.querySelector(\"#cmds button[title='Radyüs']\").click()"); time.sleep(0.4)
    pg.click("#pm .pm-pin"); time.sleep(0.2)
    ei = ev("window.__app.viewer.mesh.edges.findIndex(e=>Math.hypot(e.m[0]-20,e.m[1]-30,e.m[2]-20)<1e-3)")
    ev(f"window.__app.pmPick({{kind:'edge', index:{ei}}})"); time.sleep(0.5)
    pg.click("#pm-ok"); time.sleep(1.5); wait_ready(pg)
    chk("iğneli panel: ✓ sonrası radyüs yeniden açık", ev("window.__app.mode.k")=="pm" and ev("window.__app.mode.draft.type")=="fillet" and ev("window.__app.doc.features.filter(f=>f.type==='fillet').length")==1)
    pg.click("#pm .pm-pin"); pg.click("#pm-cancel"); time.sleep(0.5)
    # şerit özelleştirme
    ev("window.__app.openRibbonCustom()"); time.sleep(0.3)
    pg.click("dialog.ribbon-dlg label:has-text('Radyüs')"); pg.click("dialog.ribbon-dlg button:has-text('Tamam')"); time.sleep(0.3)
    chk("şerit: Radyüs gizlendi", ev("!document.querySelector(\"#cmds button[title='Radyüs']\")"))
    ev("window.__app.openRibbonCustom()"); time.sleep(0.3); pg.click("dialog.ribbon-dlg button:has-text('Varsayılana')"); time.sleep(0.3)
    chk("şerit: varsayılana dönünce görünür", ev("!!document.querySelector(\"#cmds button[title='Radyüs']\")"))
    # görev bölmesi
    ev("window.__app.toggleTaskPane(true)"); time.sleep(0.3)
    chk("görev bölmesi: kütüphane", pg.is_visible("#taskpane") and "BLOKLARI" in pg.inner_text("#taskpane").upper())
    pg.click("#taskpane button:has-text('Dosyalar')"); time.sleep(0.2)
    chk("görev bölmesi: dosyalar", "BELGELER" in pg.inner_text("#taskpane").upper())
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

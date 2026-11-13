import cmdpatch, time
from playwright.sync_api import sync_playwright
from h import wait_ready, sketch, ext, run, TOP
ok = True
def chk(name, cond, info=""):
    global ok
    print(("TAMAM " if cond else "HATA  ") + name, info)
    ok = ok and bool(cond)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e))); pg.on("dialog", lambda d: d.accept())
    pg.goto('http://localhost:4173/'); wait_ready(pg); time.sleep(0.4)
    ev = pg.evaluate
    run(pg, "box", [sketch("s1","S",TOP,lambda pt,line,rect,c,t: rect(-50,-30,50,30)), ext("e1","s1",20)])
    pg.keyboard.press("Control+1"); pg.keyboard.press("f"); time.sleep(0.3)
    mkfile = """(async()=>{const c=document.createElement('canvas');c.width=320;c.height=240;const g=c.getContext('2d');g.fillStyle='#c33';g.fillRect(0,0,320,240);
      const bl=await new Promise(r=>c.toBlob(r,'image/png'));window.__app.photos.pick(new File([bl],'a.png',{type:'image/png'}))})()"""
    # --- 9.1 fotoğraf: modele bağla
    ev(mkfile); time.sleep(0.6)
    chk("bekleyen fotoğraf + ipucu", ev("!!window.__app.photos.pending"))
    top = ev("(()=>{const v=window.__app.viewer;const s=v.toScreen([0,20,0]);const r=document.querySelector('#view canvas').getBoundingClientRect();return [s[0]+r.left,s[1]+r.top]})()")
    pg.mouse.click(top[0], top[1]); time.sleep(0.5)
    ph = ev("window.__app.doc.photos")
    chk("fotoğraf üst yüze bağlandı", ph and len(ph)==1 and ph[0].get("p") and abs(ph[0]["p"][1]-20)<0.01, ph and ph[0].get("p"))
    chk("JPEG olarak saklandı", ph and ph[0]["src"].startswith("data:image/jpeg"))
    pin = pg.locator(".photo-pin")
    chk("işaret görünür", pin.count()==1 and pin.is_visible())
    pin.click(); time.sleep(0.3)
    chk("fotoğraf penceresi", pg.locator("dialog.photo-dlg img").count()==1)
    pg.fill("dialog.photo-dlg textarea", "Mil yatağı, sol taraf")
    pg.click("dialog.photo-dlg button:has-text('Kapat')"); time.sleep(0.3)
    chk("not kaydedildi", ev("window.__app.doc.photos[0].note")=="Mil yatağı, sol taraf")
    # konumsuz
    ev(mkfile); time.sleep(0.6); pg.mouse.click(1300, 150); time.sleep(0.4)
    chk("boşluğa dokununca konumsuz", ev("window.__app.doc.photos.length")==2 and not ev("window.__app.doc.photos[1].p"))
    # Esc vazgeçer
    ev(mkfile); time.sleep(0.6); pg.keyboard.press("Escape"); time.sleep(0.2)
    chk("Esc vazgeçer", not ev("!!window.__app.photos.pending") and ev("window.__app.doc.photos.length")==2)
    # galeri
    ev("window.__app.photos.gallery()"); time.sleep(0.3)
    chk("galeride 2 küçük resim", pg.locator("dialog.photo-gal .photo-th").count()==2)
    pg.click("dialog.photo-gal button:has-text('İşaretleri gizle')"); time.sleep(0.2)
    chk("işaretler gizlenir", not pg.locator(".photo-pins").is_visible())
    pg.click("dialog.photo-gal button:has-text('İşaretleri göster')"); pg.click("dialog.photo-gal button:has-text('Kapat')")
    # sil + geri al
    pg.locator(".photo-pin").click(); time.sleep(0.3)
    pg.click("dialog.photo-dlg button:has-text('Sil')"); time.sleep(0.4)
    chk("silindi", ev("window.__app.doc.photos.length")==1)
    pg.keyboard.press("Control+z"); time.sleep(0.5)
    chk("geri alınınca döner", ev("window.__app.doc.photos.length")==2)

    # --- 9.2 kumpas
    D = lambda a: ev("a=>window.__app.decodeCaliper(a)", a)
    asc = lambda s: [ord(c) for c in s]
    cases = [(asc("+012.34\r"), 12.34), (asc("1,5 in"), 38.1), ([0x39,0x30,0,0], 12.345), (asc("-0.50 mm\n"), -0.5), ([1,2,3,4,5], None)]
    bad = [(a,D(a),e) for a,e in cases if (D(a) is None) != (e is None) or (e is not None and abs(D(a)-e)>1e-6)]
    chk("paket çözümleme (ASCII / inç / µm / binary)", not bad, bad)
    pg.dblclick("#tree li:has-text('e1')"); time.sleep(0.6)
    pg.click("#pm-body label.pm-field:has-text('Derinlik') input")
    ev("window.__app.caliper.reading(42.5)"); time.sleep(0.4)
    chk("kumpas değeri odaklı alana yazılır", ev("window.__app.mode.draft.d1")==42.5, ev("window.__app.mode.draft.d1"))
    pg.click("#pm-ok"); time.sleep(0.6); wait_ready(pg)
    chk("model 42.5", abs(ev("window.__app.viewer.mesh.bbox.max[1]")-42.5)<0.01)
    ev("window.__app.caliper.setHid(true)")
    pg.mouse.click(1300, 150); time.sleep(0.2)
    pg.keyboard.type("33.5", delay=15); pg.keyboard.press("Enter"); time.sleep(0.3)
    chk("klavye (HID) kumpası okunur", ev("window.__app.caliper.last")==33.5)
    chk("rozet görünür", pg.locator(".cal-badge").is_visible() and "33.50" in pg.inner_text(".cal-badge"))
    pg.click(".cal-badge"); time.sleep(0.3)
    chk("kumpas penceresi", pg.locator("dialog.cal-dlg button:has-text('Bluetooth ile bağlan')").count()==1 and "33.500" in pg.inner_text("dialog.cal-dlg .cal-last"))
    pg.click("dialog.cal-dlg button:has-text('Kapat')")
    ev("window.__app.caliper.setHid(false)")
    pg.keyboard.press("5"); time.sleep(0.2)
    chk("HID kapalıyken tuşlar normal", ev("window.__app.caliper.last")==33.5)
    chk("sayfa hatası yok", not logs, logs)
    print("SONUC:", "TAMAM" if ok else "HATA")

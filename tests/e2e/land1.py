# land1 — telefon yatay modu (844×390): ince üst bant, sol komut kolonu, sol çekmece, sağda ekran çubuğu; dikeye dönünce alt tepsi
import time, sys
from playwright.sync_api import sync_playwright
URL = "http://localhost:4173/"
bad = []
def chk(name, ok, info=""):
    print(("TAMAM " if ok else "HATA  ") + name, "" if ok else info)
    if not ok: bad.append(name)
R = lambda pg, sel: pg.evaluate("s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height,r:r.right,b:r.bottom}}", sel)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
    c = b.new_context(viewport={"width": 844, "height": 390}, is_mobile=True, has_touch=True)
    pg = c.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:150]))
    pg.goto(URL); pg.wait_for_function("window.__app && window.__app.viewer", timeout=60000); time.sleep(4)
    chk("yatay: body.land", pg.evaluate("document.body.classList.contains('land')"))
    hd, tray, cv = R(pg, "#cmdbar"), R(pg, "#tray"), R(pg, "#view canvas")
    chk("üst bant tek satır (≤ 46 px)", hd["h"] <= 46, hd)
    chk("komutlar sol kolonda (≤ 66 px, tam yükseklik)", tray and tray["x"] == 0 and tray["w"] <= 66 and abs(tray["y"] - hd["b"]) <= 2 and tray["b"] >= 388, tray)
    chk("grafik alan ekranın ≥ %80'i", cv["w"] * cv["h"] >= 0.8 * 844 * 390, cv)
    n = pg.evaluate("document.querySelectorAll('#tray #cmds .cmd').length")
    chk("kolonda tüm gruplar (≥ 12 komut), kaydırılır", n >= 12 and pg.evaluate("(()=>{const e=document.querySelector('#cmds');return e.scrollHeight>e.clientHeight})()"), n)
    ab = R(pg, ".actbar")
    chk("ekran çubuğu sağ kenarda, ekran içinde", ab and ab["r"] <= 844 and ab["x"] > 700 and ab["b"] <= 390 and ab["y"] >= hd["b"], ab)
    # ağaç çekmecesi
    pg.tap("#tree-btn"); time.sleep(0.5)
    sd = R(pg, "#side")
    chk("ağaç sol çekmece (kolonun yanında, tam yükseklik)", sd and abs(sd["x"] - tray["r"]) <= 2 and sd["w"] <= 360 and sd["b"] >= 388 and abs(sd["y"] - hd["b"]) <= 2, sd)
    pg.tap("#tree li:has-text('Ön Düzlem')"); time.sleep(0.3)
    pg.tap("#side-close"); time.sleep(0.3)
    # eskiz: kolondan Eskiz → çizgi → dikdörtgen
    pg.tap("#tabs button[data-tab='sketch']"); time.sleep(0.4)
    pg.tap("#cmds button[title^='Eskiz']"); time.sleep(1.2)
    chk("eskiz açıldı", pg.evaluate("window.__app.mode.k") == "sketch")
    sd = R(pg, "#side")
    o = pg.evaluate("(()=>{const v=window.__app.viewer,e=window.__app.mode.editor,s=v.toScreen(e.frame.o),r=v.renderer.domElement.getBoundingClientRect();return [r.left+s[0],r.top+s[1]]})()")
    chk("yeni eskiz orijini çekmecenin sağında, görünür alanda", o[0] > sd["r"] + 20 and o[0] < ab["x"] - 20 and hd["b"] < o[1] < 390, (o, sd))
    cube = R(pg, ".vcube")
    chk("görünüm küpü çekmecenin altında kalmaz", cube["x"] >= sd["r"], (cube, sd))
    ok = R(pg, "#pm-ok")
    chk("panel ✓ görünür ve dokunulabilir", ok and ok["r"] <= sd["r"] and pg.evaluate("(()=>{const b=document.querySelector('#pm-ok').getBoundingClientRect();return document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.id})()") == "pm-ok", ok)
    pg.tap("#cmds button[title^='Dikdörtgen']"); time.sleep(0.3)
    chk("kolondan araç seçildi", pg.evaluate("window.__app.mode.editor.tool") == "rect")
    pg.tap("#pm-ok"); time.sleep(0.8)
    # dikeye dön → alt tepsi; yeniden yatay
    pg.set_viewport_size({"width": 390, "height": 844}); time.sleep(0.8)
    tr = R(pg, "#tray")
    chk("dikey: body.land yok, tepsi altta", not pg.evaluate("document.body.classList.contains('land')") and tr and tr["w"] >= 380 and tr["b"] >= 840, tr)
    pg.set_viewport_size({"width": 844, "height": 390}); time.sleep(0.8)
    tr = R(pg, "#tray")
    chk("yeniden yatay: sol kolon", tr and tr["w"] <= 66 and pg.evaluate("document.body.classList.contains('land')"), tr)
    # tablet yatay / masaüstü etkilenmez
    pg.set_viewport_size({"width": 1180, "height": 820}); time.sleep(0.8)
    chk("tablet yatay: masaüstü şeridi (tepsi yok)", not pg.evaluate("document.body.classList.contains('land')") and pg.evaluate("!document.querySelector('#tray')"))
    chk("sayfa hatası yok", not errs, errs)
    b.close()
print("SONUC:", "HATA" if bad else "TAMAM")

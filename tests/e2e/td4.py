# Kaynaklı yapı teknik resmi: kesim listesi tablosu, izometrikte balonlar, kaynak listesi + ISO 2553 işareti, DXF
import cmdpatch, time, re
from h import *
ok=[]
def chk(n,c,i=""): ok.append(c); print(("TAMAM " if c else "HATA  ")+n, i)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.4)
    fr = sketch("s1","Çerçeve",FRONT, lambda pt,line,rect,circle,text: rect(0,0,600,400))
    mem = {"id":"m","type":"member","name":"M","segs":[{"sk":"s1","ent":e} for e in ["l5","l6","l7","l8"]],"std":"kutu","size":"40x40x3","align":"c","mirror":False,"rot":0,"corner":"miter","gap":0}
    run(pg, "çerçeve", [fr, mem])
    pg.evaluate("localStorage.setItem('imajcad.techdraw', JSON.stringify({iso:true, section:false, dims:true, paper:'A3', cutTable:true}))")
    pg.click("#tabs button[data-tab='evaluate']"); time.sleep(0.2)
    pg.click("#cmds button:has-text('Teknik Resim')"); time.sleep(8)
    s = pg.evaluate("document.querySelector('dialog[open]')._svg")
    chk("kesim listesi tablosu", "KESİM LİSTESİ" in s and "Tanım" in s and "Adet" in s)
    rows = re.findall(r'>(\d)</text>', s)
    chk("2 satır (dış boy 640 ve 440, 2'şer adet)", ">640<" in s and ">440<" in s and s.count(">2<") >= 2, re.findall(r'>(\d{3})<', s))
    chk("uç açıları 45°/45°", "45°/45°" in s)
    chk("izometrikte balonlar (1, 2)", len(re.findall(r'<circle class="v" cx="[^"]+" cy="[^"]+" r="4"', s)) >= 2)
    chk("seçenek kutusu", pg.locator("dialog[open] label:has-text('Kesim listesi')").count()==1)
    pg.locator("dialog[open] label:has-text('Kesim listesi') input").uncheck(); time.sleep(1)
    chk("kapatınca tablo yok", "KESİM LİSTESİ" not in pg.evaluate("document.querySelector('dialog[open]')._svg"))
    pg.click("dialog[open] button:has-text('Kapat')"); time.sleep(0.3)
    # kaynak dikişi eklenmiş yapı: kaynak listesi
    welds = pg.evaluate("window.__app.kernel.cutListFull().then(r=>r.welds.length)")
    print("kaynak sayısı (önceden):", welds)
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

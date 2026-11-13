# v0.83 Kurumsal Şerit arayüzü: masaüstü başlık / sekmeler / gruplu şerit, telefon alt tepsisi
import cmdpatch
from h import *
ok = True
def chk(n, c, info=""):
    global ok
    ok = ok and bool(c)
    print(("TAMAM " if c else "HATA  ") + n, info)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width": 1440, "height": 900})
    pg.goto(URL); wait_ready(pg)
    ev = pg.evaluate
    box = lambda s: ev("s=>{const r=document.querySelector(s).getBoundingClientRect();return [r.left,r.top,r.right,r.bottom]}", s)
    chk("logo başlıkta", ev("(()=>{const i=document.querySelector('#menubar .brand img');return !!i&&i.complete&&i.naturalWidth>0&&i.getBoundingClientRect().height>20})()"))
    mb, tb, cb = box("#menubar"), box("#tabs"), box("#cmds")
    chk("başlık mavi", ev("getComputedStyle(document.querySelector('#menubar')).backgroundColor") == "rgb(32, 75, 155)")
    chk("sekmeler başlığın altında, şeridin üstünde", mb[3] <= tb[1] + 1 and tb[3] <= cb[1] + 1, (mb, tb, cb))
    caps = pg.locator("#cmds .rcap").all_inner_texts()
    chk("şerit grupları başlıklı", "Detay" in caps and "Yüzey" in caps and "Referans" in caps, caps)
    chk("kalabalık grup sık düzende", pg.locator("#cmds .rgrp.dense").count() >= 2)
    pg.click("#tabs button[data-tab='evaluate']"); time.sleep(0.3)
    pg.click("#cmds button[title='Ölç']"); time.sleep(0.4)
    col = ev("(()=>{const b=[...document.querySelectorAll('#cmds .cmd')].find(b=>b.title==='Ölç');return b&&b.classList.contains('active')?getComputedStyle(b.querySelector('svg')).color:''})()")
    chk("etkin komut turuncu", col == "rgb(240, 126, 20)", col)
    pg.keyboard.press("Escape"); time.sleep(0.2)
    pg.click("#tabs button[data-tab='features']"); time.sleep(0.3)
    chk("durum çubuğu koyu mavi", ev("getComputedStyle(document.querySelector('#statusbar')).backgroundColor") == "rgb(22, 58, 125)")
    chk("tepsi masaüstünde yok", pg.locator("#tray").count() == 0)
    # telefon
    pg.set_viewport_size({"width": 390, "height": 844}); time.sleep(0.6)
    ev("window.dispatchEvent(new Event('resize'))"); time.sleep(0.4)
    chk("telefonda komutlar alt tepside", ev("document.querySelector('#cmds').parentElement.id") == "tray")
    tr = box("#tray")
    chk("tepsi ekranın altında", abs(tr[3] - 844) < 2 and tr[1] > 600, tr)
    chk("logo simgesi başlıkta", pg.locator("#mbrand img").is_visible())
    chk("--tray-h ayarlı", ev("parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tray-h'))") > 60)
    pg.click("#cmds button[title='Radyüs']"); time.sleep(0.5)
    c = box("#pm-cancel")
    hit = ev("([x,y])=>{const e=document.elementFromPoint(x,y);return e&&(e.id==='pm-cancel'||!!e.closest('#pm-cancel'))}", [(c[0] + c[2]) / 2, (c[1] + c[3]) / 2])
    chk("panel açıkken ✕ ekran çubuğunun altında kalmıyor", hit)
    pg.click("#pm-cancel"); time.sleep(0.3)
    pg.set_viewport_size({"width": 1440, "height": 900}); time.sleep(0.4)
    ev("window.dispatchEvent(new Event('resize'))"); time.sleep(0.4)
    chk("masaüstüne dönünce şerit başlığa geri döner", ev("document.querySelector('#cmds').parentElement.id") == "cmdbar" and pg.locator("#tray").count() == 0)
    print("SONUC:", "TAMAM" if ok else "HATA")
    b.close()

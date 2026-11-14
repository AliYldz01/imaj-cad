# d10 — TELEFON 2 (390×844): dosya menüsünün alt öğeleri, giriş ayarları, dokunmatik fare, büyüteç, avuç reddi (kalem sonrası),
# aday çubuğu ve PM ✓ çakışması, mini çubuk
import sys; sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d10h import *


def pen(a, kind, x, y, buttons=0, button="none"):
    a.cdp.send("Input.dispatchMouseEvent", {"type": kind, "x": x, "y": y, "pointerType": "pen", "button": button, "buttons": buttons, "clickCount": 1 if kind != "mouseMoved" else 0})


with sync_playwright() as p:
    a = App(p, mobile=True)
    a.setup(block())
    vr = a.ev("(()=>{const r=document.querySelector('#view canvas').getBoundingClientRect();return [r.left,r.top,r.width,r.height]})()")

    if want("dosya"):
        a.btn("#file-btn"); time.sleep(0.3)
        last = a.pg.locator("#file-menu button[data-act='input']")
        bb0 = last.bounding_box()
        # kullanıcı menüyü parmakla yukarı kaydırmayı dener
        a.tdrag((200, 700), (200, 300), steps=10)
        a.btn("#file-btn") if a.pg.locator("#file-menu").is_hidden() else None
        time.sleep(0.3)
        bb1 = last.bounding_box()
        vis = bb1 and bb1["y"] + bb1["height"] / 2 < 844
        note("Kalem ve dokunmatik ayarları öğesi: önce", bb0, "kaydırma denemesi sonrası", bb1)
        chk("telefonda Dosya › Kalem ve dokunmatik ayarları ekrana gelir", vis, (bb0, bb1))
        a.close_dialogs(); a.ev("document.querySelector('#file-menu').hidden=true")
        # başka bir yoldan erişim? (ağaç, uzun basma, dairesel menü)
        a.tap(vr[0] + vr[2] / 2, vr[1] + vr[3] * 0.4)
        a.longpress(vr[0] + 60, vr[1] + vr[3] * 0.75)
        it = a.pg.locator(".sw-ctx .sw-mi").all_inner_texts()
        note("boşlukta uzun basma:", it)
        a.tap(vr[0] + 10, vr[1] + 10)

    if want("touchpad"):
        a.ev("localStorage.setItem('imajcad.input', JSON.stringify({profile:'finger', touchpad:true}))")  # hazır ortam: ayar penceresine telefonda ulaşılamıyor
        a.reload()
        a.show_tree(); a.btn("#tree li:has-text('Ön Düzlem')"); a.btn("#tree-actions button:text-is('Eskiz')"); a.wait(0.5)
        if a.pg.locator(".sheet-min").count() and a.pg.locator(".sheet-min").first.is_visible():
            a.btn(".sheet-min")
        bt = a.pg.locator("#tray button[title='Nokta']")
        bt.scroll_into_view_if_needed(); bb = bt.bounding_box(); a.tap(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2)
        cx, cy = vr[0] + vr[2] / 2, vr[1] + vr[3] * 0.35
        a.touch("touchStart", [(cx, cy)])
        for i in range(1, 9):
            a.touch("touchMove", [(cx + i * 8, cy)]); time.sleep(0.02)
        tc = a.ev("(()=>{const c=document.querySelector('.touch-cursor');return c?[getComputedStyle(c).display,c.style.left,c.style.top]:null})()")
        a.touch("touchEnd", []); time.sleep(0.2)
        note("dokunmatik fare imleci:", tc)
        chk("dokunmatik fare: imleç görünür ve hareket eder", tc and tc[0] != "none", tc)
        n0 = a.ed("return Object.keys(d.pts).length")
        a.tap(cx - 80, cy + 60)
        n1 = a.ed("return Object.keys(d.pts).length")
        chk("dokunmatik fare: tek dokunuş imleç yerine nokta koyar", n1 == n0 + 1, (n0, n1))
        a.ev("localStorage.setItem('imajcad.input', JSON.stringify({profile:'finger', touchpad:false}))")
        a.btn("#pm-cancel"); time.sleep(0.4)
        if a.pg.locator("dialog.exit-dialog[open]").count():
            a.btn("dialog.exit-dialog[open] button[data-v='discard']")
        a.reload()

    if want("buyutec"):
        a.show_tree(); a.btn("#tree li:has-text('Ön Düzlem')"); a.btn("#tree-actions button:text-is('Eskiz')"); a.wait(0.5)
        if a.pg.locator(".sheet-min").count() and a.pg.locator(".sheet-min").first.is_visible():
            a.btn(".sheet-min")
        cx, cy = vr[0] + vr[2] / 2, vr[1] + vr[3] * 0.45
        a.touch("touchStart", [(cx, cy)]); a.touch("touchMove", [(cx + 5, cy + 3)]); time.sleep(0.1)
        lv = a.ev("(()=>{const l=document.querySelector('.loupe');return !!l&&getComputedStyle(l).display!=='none'})()")
        a.touch("touchEnd", []); time.sleep(0.2)
        chk("parmakla çizimde büyüteç görünür", lv)
        # avuç reddi: kalem dokunuşundan hemen sonra gelen parmak dokunuşu yok sayılır
        pen(a, "mouseMoved", cx, cy + 40); pen(a, "mousePressed", cx, cy + 40, 1, "left"); pen(a, "mouseReleased", cx, cy + 40, 0, "left")
        n0 = a.ed("return d.ents.length")
        d0 = a.cam()["dir"]
        a.touch("touchStart", [(cx - 100, cy + 100)]); a.touch("touchMove", [(cx - 40, cy + 120)]); a.touch("touchEnd", []); time.sleep(0.2)
        note("kalem sonrası avuç dokunuşu: öğe", n0, "→", a.ed("return d.ents.length"), "bakış", a.cam()["dir"] == d0)
        chk("avuç reddi: kalemden hemen sonraki parmak dokunuşu çizim yapmaz", a.ed("return d.ents.length") == n0, (n0, a.ed("return d.ents.length")))
        a.press("Escape")
        a.btn("#pm-cancel"); time.sleep(0.4)
        if a.pg.locator("dialog.exit-dialog[open]").count():
            a.btn("dialog.exit-dialog[open] button[data-v='discard']")
        a.wait(0.4)

    if want("aday"):
        a.ev("localStorage.setItem('imajcad.input', JSON.stringify({profile:'finger'}))"); a.reload()
        # düzlemlerle örtüşen üst yüz: dokun → aday çubuğu
        fc = a.ev("(()=>{const m=window.__app.viewer.mesh;return m.faces.find(f=>f.n&&f.n[1]>0.99).c})()")
        x, y = a.wsc([fc[0] + 5, fc[1], fc[2] + 5])
        a.tap(x, y); time.sleep(0.3)
        cb = a.pg.locator(".cand-bar button").all_inner_texts()
        note("aday çubuğu:", cb)
        chk("dokunmada üst üste adaylar: aday çubuğu", len(cb) >= 1, cb)
        if cb:
            a.btn(".cand-bar button")
            note("aday seçildi → ipucu:", a.pg.inner_text("#hint"))
        # PM açıkken aday çubuğu ✓ / ✕ üstüne biniyor mu
        a.show_tree(); a.btn("#tree li:has-text('Üst Düzlem')"); a.btn("#tree-actions button:text-is('Eskiz')"); a.wait(0.4)
        a.tap(x, y + 30); time.sleep(0.2)
        a.tap(x, y); time.sleep(0.2)
        ov = a.ev("""(()=>{const c=document.querySelector('.cand-bar');if(!c)return null;const r=c.getBoundingClientRect();const out=[];for(const s of ['#pm-ok','#pm-cancel','.actbar button']){for(const b of document.querySelectorAll(s)){const q=b.getBoundingClientRect();if(q.width&&!(q.right<r.left||q.left>r.right||q.bottom<r.top||q.top>r.bottom))out.push(s+':'+(b.title||b.textContent).slice(0,12))}}return out})()""")
        note("eskizde aday çubuğu ile çakışan düğmeler:", ov)
        chk("aday çubuğu ✓ / ✕ / ekran çubuğunu örtmez", not ov, ov)
        a.wait(0.3)

    print("hatalar:", a.errs[:5])
    a.close()
finish()

# v0.30 masaüstü SolidWorks arayüzü: menü çubuğu, komut arama, kısayollar (özelleştirilebilir), fare hareketleri (8 yön),
# açılır özellik ağacı, durum çubuğu, bölgeye yakınlaştır, büyüteç, telefonda eski düzen
import cmdpatch, time
from h import *
ok = []
def chk(name, c):
    ok.append(bool(c)); print(("✓ " if c else "✗ ") + name)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1440,"height":860}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    cam = lambda: pg.evaluate("(()=>{const v=window.__app.viewer;const c=v.camera.position.clone().sub(v.controls.target).normalize();return [c.x,c.y,c.z,v.camera.zoom]})()")
    chk("menü çubuğu görünür", pg.is_visible("#menubar") and pg.is_visible("#statusbar"))
    pg.click("#menus button:has-text('Görünüm')"); time.sleep(0.2)
    pg.hover(".menu-drop .mrow:has-text('Görüntü stili')"); time.sleep(0.2)
    chk("alt menü açılır", pg.locator(".menu-drop .mrow:has-text('Tel kafes')").count() == 1)
    pg.screenshot(path="/home/claude/ui2_menu.png")
    pg.click(".menu-drop .mrow:has-text('Üstten')"); time.sleep(0.2)
    c = cam(); chk("Görünüm > Üstten", c[1] > 0.99)
    pg.mouse.move(800, 500)
    pg.keyboard.press("Control+1"); time.sleep(0.1); c = cam(); chk("Ctrl+1 önden", c[2] > 0.99)
    z0 = cam()[3]; pg.keyboard.press("Shift+Z"); z1 = cam()[3]; pg.keyboard.press("z"); z2 = cam()[3]
    chk("Shift+Z yakınlaş / Z uzaklaş", z1 > z0 and z2 < z1)
    pg.keyboard.press("Control+Shift+Z"); time.sleep(0.1); chk("Ctrl+Shift+Z önceki görünüm", abs(cam()[3]-z1) < 1e-6)
    pg.keyboard.press("Shift+ArrowRight"); time.sleep(0.1); c = cam(); chk("Shift+→ 90°", abs(c[0]) > 0.99)
    pg.keyboard.press("F5"); time.sleep(0.5); chk("F5 seçim filtresi", "yüz" in pg.inner_text("#toast") and "Filtre" in pg.inner_text("#sb-sel"))
    pg.keyboard.press("F5"); pg.keyboard.press("F5")
    pg.keyboard.press("g"); chk("G büyüteç", pg.evaluate("window.__app.viewer.mag")); pg.keyboard.press("g")
    # bölgeye yakınlaştır
    pg.keyboard.press("Control+7"); time.sleep(0.1); z0 = cam()[3]
    pg.click("#viewbar button[title='Bölgeye yakınlaştır']"); time.sleep(0.1)
    pg.mouse.move(800, 400); pg.mouse.down(); pg.mouse.move(900, 470, steps=4); pg.mouse.up(); time.sleep(0.2)
    chk("bölgeye yakınlaştır", cam()[3] > z0 * 3)
    pg.keyboard.press("f")
    # 8 yönlü fare hareketi: sağ üst = izometrik (varsayılan atama)
    pg.evaluate("localStorage.setItem('imajcad.gest', JSON.stringify({n:8}))")
    pg.reload(); wait_ready(pg); time.sleep(0.5)
    pg.keyboard.press("Control+1")
    pg.mouse.move(800, 500); pg.mouse.down(button="right"); pg.mouse.move(830, 470, steps=3); pg.mouse.move(870, 430, steps=3)
    chk("8 yön kılavuzu", pg.locator(".sw-gesture.g8 .sw-g").count() == 8)
    pg.screenshot(path="/home/claude/ui2_gest.png")
    pg.mouse.up(button="right"); time.sleep(0.2); c = cam(); chk("sağ üst hareket = izometrik", c[0] > 0.4 and c[1] > 0.4 and c[2] > 0.4)
    # komut arama
    pg.fill("#cmd-search", "radyüs"); time.sleep(0.2)
    chk("arama sonuçları", pg.locator(".search-drop .mrow").count() >= 1)
    pg.press("#cmd-search", "Enter"); time.sleep(0.4)
    chk("arama ile Radyüs özelliği açıldı", pg.evaluate("window.__app.mode.k") == "pm")
    chk("PM açıkken ağaç grafik alanda açılır", pg.evaluate("document.querySelector('#tree-panel').parentElement.id") == "view" and pg.is_visible("#tree-panel.flyout"))
    chk("durum çubuğu özellik", "Özellik" in pg.inner_text("#sb-mode"))
    pg.screenshot(path="/home/claude/ui2_pm.png")
    pg.keyboard.press("Escape"); time.sleep(0.3)
    chk("Esc ile çık, ağaç yerine döner", pg.evaluate("window.__app.mode.k") == "part" and pg.evaluate("document.querySelector('#tree-panel').parentElement.id") == "side")
    # özelleştir: Önden = Ctrl+Shift+F
    pg.click("#sb-keys"); time.sleep(0.2)
    pg.fill(".cust-q", "Önden"); time.sleep(0.1)
    pg.click(".cust-row:has-text('Önden') .cust-key"); pg.keyboard.press("Control+Shift+F"); time.sleep(0.1)
    chk("kısayol kaydedildi", "Ctrl+Shift+F" in pg.inner_text(".cust-row:has-text('Önden') .cust-key"))
    pg.click(".cust-tabs button[data-t='g']"); time.sleep(0.1)
    chk("fare hareketleri sekmesi", pg.locator(".cust-gcol select").count() == 16)
    pg.click(".cust-foot button[data-a='close']"); time.sleep(0.1)
    pg.keyboard.press("Control+7"); pg.keyboard.press("Control+Shift+F"); time.sleep(0.1); c = cam()
    chk("özel kısayol çalışır", c[2] > 0.99)
    chk("menüde yeni kısayol", (pg.click("#menus button:has-text('Görünüm')"), pg.inner_text(".menu-drop .mrow:has-text('Önden') .mk"))[1] == "Ctrl+Shift+F")
    pg.keyboard.press("Escape")
    chk("kilit düğmesi", pg.locator("#globals .lock-btn").count() == 1 and pg.inner_text("#sb-lock") in ("🔓","🔒"))
    chk("şerit tüm grupları gösterir", pg.locator("#cmds button[title='Ref. Düzlem']").count() == 1 and pg.locator(".cmd-chip").count() == 0)
    # telefon düzeni değişmedi
    m = b.new_page(viewport={"width":390,"height":800}, is_mobile=True, has_touch=True)
    m.goto(URL); wait_ready(m); time.sleep(0.4)
    chk("telefonda menü/durum çubuğu gizli, grup düğmeleri var", not m.is_visible("#menubar") and not m.is_visible("#statusbar") and m.locator(".cmd-chip").count() > 0)
    m.screenshot(path="/home/claude/ui2_mob.png")
    print("hatalar:", logs)
    print("SONUC:", "TAMAM" if all(ok) and not logs else "HATA")

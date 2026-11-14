# d10 — GÖRÜNÜM / GEZİNME (masaüstü 1400×900, gerçek fare + klavye): orta tuş, tekerlek, oklar, Ctrl+1…8, küp,
# görünüm çubuğu, bölgeye yakınlaştır, önceki görünüm, perspektif, stiller, kesit
import sys; sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d10h import *


def scr(a, w):
    return a.wsc(w)


def mid_drag(a, x, y, dx, dy, steps=12, mods=()):
    for m in mods:
        a.pg.keyboard.down(m)
    a.pg.mouse.move(x, y)
    a.pg.mouse.down(button="middle")
    for i in range(1, steps + 1):
        a.pg.mouse.move(x + dx * i / steps, y + dy * i / steps)
        time.sleep(0.015)
    a.pg.mouse.up(button="middle")
    for m in mods:
        a.pg.keyboard.up(m)
    time.sleep(0.25)


def center_scr(a):
    return a.ev("""(()=>{const m=window.__app.viewer.mesh;const c=[0,1,2].map(i=>(m.bbox.min[i]+m.bbox.max[i])/2);const s=window.__app.viewer.toScreen(c);return s})()""")


with sync_playwright() as p:
    a = App(p)
    a.setup(block())
    a.pg.keyboard.press("Control+7"); a.press("f")
    vc = a.view_center()

    if want("orta"):
        c0 = center_scr(a); cam0 = a.cam()
        # köşeden başlayan yatay sürükleme (model tümüyle görünür)
        cx, cy = scr(a, [40, 20, 30])
        mid_drag(a, cx, cy, 160, 0)
        c1 = center_scr(a); cam1 = a.cam()
        chk("orta sürükle (köşeden): model merkezi ekranda sabit", abs(c1[0] - c0[0]) < 2 and abs(c1[1] - c0[1]) < 2, (c0, c1))
        d0, u0 = cam0["dir"], cam0["up"]
        k = sum(u0[i] * d0[i] for i in range(3)); so = [u0[i] - k * d0[i] for i in range(3)]; nn = math.sqrt(sum(x * x for x in so)); so = [x / nn for x in so]
        chk("yatay sürükleme: ekranın yukarı yönü (dünyada) sabit → yuvarlanma yok", all(abs(cam1["up"][i] - so[i]) < 0.02 for i in range(3)), (so, cam1["up"]))
        ang = math.degrees(math.acos(max(-1, min(1, sum(cam0["dir"][i] * cam1["dir"][i] for i in range(3))))))
        note("160 px yatay → dönüş", round(ang, 1), "°")
        # hızlı ardışık vuruşlar sığdırma yapmaz
        z0 = a.cam()["zoom"]
        a.pg.keyboard.press("z"); z0 = a.cam()["zoom"]
        for k in range(3):
            mid_drag(a, vc[0], vc[1], 40, 10, steps=4)
        chk("hızlı ardışık 3 orta sürükleme: yakınlaştırma değişmez (sığdırma yok)", near(a.cam()["zoom"], z0, 1e-3), (z0, a.cam()["zoom"]))
        # çift orta tık → sığdır
        a.pg.mouse.move(vc[0] + 200, vc[1] + 150)
        a.pg.mouse.click(vc[0] + 200, vc[1] + 150, button="middle"); time.sleep(0.08)
        a.pg.mouse.click(vc[0] + 200, vc[1] + 150, button="middle"); time.sleep(0.5)
        chk("çift orta tık: sığdırır", not near(a.cam()["zoom"], z0, 1e-3), (z0, a.cam()["zoom"]))
        # Ctrl+orta kaydır 1:1
        p0 = scr(a, [40, 20, 30])
        mid_drag(a, vc[0], vc[1], 80, 40, mods=("Control",))
        p1 = scr(a, [40, 20, 30])
        chk("Ctrl+orta: kaydırma 80,40 px (1:1)", near(p1[0] - p0[0], 80, 2) and near(p1[1] - p0[1], 40, 2), (round(p1[0] - p0[0], 1), round(p1[1] - p0[1], 1)))
        z0 = a.cam()["zoom"]
        mid_drag(a, vc[0], vc[1], 0, -100, mods=("Shift",))
        chk("Shift+orta yukarı: yakınlaşır", a.cam()["zoom"] > z0, (z0, a.cam()["zoom"]))
        d0 = a.cam()["dir"]
        mid_drag(a, vc[0], vc[1], 100, 0, mods=("Alt",))
        chk("Alt+orta: bakış yönü sabit (çevirme)", all(abs(a.cam()["dir"][i] - d0[i]) < 0.01 for i in range(3)), (d0, a.cam()["dir"]))
        a.pg.keyboard.press("Control+7"); a.press("f")

    if want("teker"):
        z0 = a.cam()["zoom"]
        px, py = vc[0] + 150, vc[1] + 80
        w0 = a.ev("([x,y])=>{const v=window.__app.viewer;const r=document.querySelector('#view canvas').getBoundingClientRect();const p=v.pickFrame?null:null;return null}", [px, py])
        pt = scr(a, [40, 0, 30])
        a.pg.mouse.move(pt[0], pt[1]); a.pg.mouse.wheel(0, 120); time.sleep(0.4)
        z1 = a.cam()["zoom"]; pt2 = scr(a, [40, 0, 30])
        chk("tekerlek geri (deltaY>0, kullanıcıya doğru): yakınlaşır (SolidWorks)", z1 > z0, (z0, z1))
        chk("tekerlek: imleç altındaki nokta sabit", abs(pt2[0] - pt[0]) < 2 and abs(pt2[1] - pt[1]) < 2, (pt, pt2))
        a.pg.mouse.wheel(0, -120); time.sleep(0.4)
        chk("tekerlek ileri (deltaY<0): uzaklaşır", a.cam()["zoom"] < z1, a.cam()["zoom"])
        # tekerlek yönünü ters çevir kalıcı mı
        a.menu("Araçlar", "Tekerlek yönünü ters çevir")
        a.reload(); a.pg.keyboard.press("Control+7"); a.press("f")
        z0 = a.cam()["zoom"]; a.pg.mouse.move(vc[0], vc[1]); a.pg.mouse.wheel(0, 120); time.sleep(0.4)
        chk("ters tekerlek yenilemeden sonra da ters (geri = uzaklaş)", a.cam()["zoom"] < z0, (z0, a.cam()["zoom"]))
        a.menu("Araçlar", "Tekerlek yönünü ters çevir")

    if want("tus"):
        a.pg.keyboard.press("Control+7"); a.press("f")
        c0 = center_scr(a); d0 = a.cam()["dir"]
        a.press("ArrowRight")
        d1 = a.cam()["dir"]
        ang = math.degrees(math.acos(max(-1, min(1, sum(d0[i] * d1[i] for i in range(3))))))
        c1 = center_scr(a)
        chk("→: 15° döndürür", near(ang, 15, 0.5), round(ang, 2))
        note("→ sonrası model merkezi ekranda kayma:", round(c1[0] - c0[0], 1), round(c1[1] - c0[1], 1), "(A-6: ekran merkezi etrafında)")
        a.press("Shift+ArrowUp"); d2 = a.cam()["dir"]
        a.press("Shift+ArrowDown")
        chk("Shift+↑ / Shift+↓: 90° ve geri", all(abs(a.cam()["dir"][i] - d1[i]) < 0.01 for i in range(3)), a.cam()["dir"])
        u0 = a.cam()["up"]; a.press("Alt+ArrowLeft")
        chk("Alt+←: yuvarla (yukarı değişir, yön sabit)", any(abs(a.cam()["up"][i] - u0[i]) > 0.1 for i in range(3)) and all(abs(a.cam()["dir"][i] - d1[i]) < 0.01 for i in range(3)))
        t0 = a.cam()["t"]; a.press("Control+ArrowLeft")
        chk("Ctrl+←: kaydırır", a.cam()["t"] != t0, (t0, a.cam()["t"]))
        for k, d in [("1", [0, 0, 1]), ("2", [0, 0, -1]), ("3", [-1, 0, 0]), ("4", [1, 0, 0]), ("5", [0, 1, 0]), ("6", [0, -1, 0])]:
            a.press("Control+" + k)
            chk(f"Ctrl+{k}", [round(v) for v in a.cam()["dir"]] == d, a.cam()["dir"])
        a.press("Control+7"); a.press("f")
        a.press("Space"); time.sleep(0.3)
        it = a.pg.locator(".sw-popup button, .sw-popup .sw-mi").all_inner_texts()
        chk("Boşluk: görünüm yönü menüsü", len(it) >= 7, it[:10])
        a.btn(".sw-popup button:has-text('Üst')") if a.pg.locator(".sw-popup button:has-text('Üst')").count() else a.press("Escape")
        chk("yön menüsü › Üst", [round(v) for v in a.cam()["dir"]] == [0, 1, 0], a.cam()["dir"])
        z0 = a.cam()["zoom"]; a.press("Shift+z"); z1 = a.cam()["zoom"]; a.press("z"); z2 = a.cam()["zoom"]
        chk("Shift+Z ×1.25, Z ×0.8", near(z1 / z0, 1.25, 0.01) and near(z2 / z1, 0.8, 0.01), (z0, z1, z2))
        a.press("Control+Shift+z")
        chk("Ctrl+Shift+Z önceki görünüm", near(a.cam()["zoom"], z1, 1e-3), a.cam()["zoom"])
        a.press("g"); m1 = a.ev("!!window.__app.viewer.mag"); a.press("g")
        chk("G büyüteç aç/kapa", m1 and not a.ev("!!window.__app.viewer.mag"))

    if want("kup"):
        a.press("Control+7"); a.press("f")
        faces = a.pg.locator(".vcube .face").all_inner_texts()
        note("küp yüzleri:", faces)
        pt = a.ev("""(()=>{for(let y=172;y<=215;y+=2)for(let x=300;x<=398;x+=2){const e=document.elementFromPoint(x,y);if(e.title==='Üst')return [x,y]}return null})()""")
        a.click(pt[0], pt[1])
        chk("küp › Üst yüz (yüz hücresine tık)", [round(v) for v in a.cam()["dir"]] == [0, 1, 0], a.cam()["dir"])
        a.btn(".vcube .iso")
        # 'Üst' yazısının ortasına tık (kullanıcının en olası tıkladığı yer)
        lab = a.pg.locator(".vcube .cell.c:text-is('Üst')").bounding_box()
        seam = a.ev("""(()=>{let n=0,m=0;const out=[];for(let y=172;y<=215;y+=2)for(let x=300;x<=398;x+=2){const e=document.elementFromPoint(x,y);if(e.classList.contains('cube')){n++;out.push([x,y])}if(e.classList.contains('cell'))m++}return [n,m,out.slice(0,8)]})()""")
        note("küp üst bölgesinde boşluğa (kap öğesine) düşen örnek nokta:", seam[0], "/", seam[0] + seam[1], seam[2])
        # Chrome 3B dönüşümlü öğelerde dikiş çizgisi isabet testinde boş kalır; tık en yakın hücreye yönlendirilir (D10-16)
        ok_seam = seam[0] == 0
        if not ok_seam:
            d0 = a.cam()["dir"]; a.pg.mouse.click(*seam[2][0]); time.sleep(0.6)
            ok_seam = [round(v, 2) for v in a.cam()["dir"]] != [round(v, 2) for v in d0]
            a.btn(".vcube .iso")
        chk("küpte yüzler arasında tıklanmayan çizgi yok (dikişe tık bir hücreye gider)", ok_seam, seam[2])
        a.btn(".vcube .iso")
        chk("küp › İzo", a.cam()["dir"][0] > 0.5, a.cam()["dir"])
        # kenar / köşe bölgeleri: yüzün kenarına yakın tık
        fb = a.pg.locator(".vcube .face:has-text('Ön')").bounding_box()
        if fb:
            a.click(fb["x"] + fb["width"] / 2, fb["y"] + 3)
            d = a.cam()["dir"]
            chk("küp › Ön yüzün üst kenarı: 45° (ön-üst)", near(abs(d[1]), 0.707, 0.05) and near(abs(d[2]), 0.707, 0.05), d)
            a.btn(".vcube .iso")
            a.click(fb["x"] + 3, fb["y"] + 3)
            d = a.cam()["dir"]
            chk("küp › Ön yüzün köşesi: izometrik köşe", all(abs(abs(x) - 0.577) < 0.05 for x in d), d)
        # sürükle döndürür
        cb = a.pg.locator(".vcube").bounding_box()
        d0 = a.cam()["dir"]
        a.drag((cb["x"] + cb["width"] / 2, cb["y"] + cb["height"] / 2), (cb["x"] + cb["width"] / 2 + 40, cb["y"] + cb["height"] / 2))
        chk("küp sürükle: döndürür", any(abs(a.cam()["dir"][i] - d0[i]) > 0.05 for i in range(3)), (d0, a.cam()["dir"]))

    if want("cubuk"):
        a.press("Control+7"); a.press("f")
        vb = a.pg.locator("#viewbar button").evaluate_all("els=>els.map(e=>[e.title, e.offsetParent!==null])")
        note("görünüm çubuğu (başlık, görünür):", vb)
        st_vis = [v for t, v in vb if t.startswith("Görüntü stili")]
        chk("görünüm çubuğunda Görüntü stili düğmesi görünür (A-1)", st_vis and st_vis[0], st_vis)
        a.btn("#viewbar button[title='Önceki görünüm (Ctrl+Shift+Z)']")
        a.btn("#viewbar button[title='Bölgeye yakınlaştır']")
        z0 = a.cam()["zoom"]
        a.drag((vc[0] - 50, vc[1] - 30), (vc[0] + 50, vc[1] + 30))
        chk("çubuk › Bölgeye yakınlaştır", a.cam()["zoom"] > 2 * z0, (z0, a.cam()["zoom"]))
        a.btn("#viewbar button[title='Önceki görünüm (Ctrl+Shift+Z)']")
        chk("çubuk › Önceki görünüm", near(a.cam()["zoom"], z0, 1e-3), (z0, a.cam()["zoom"]))
        a.btn("#viewbar button[title='Görünüm yönü (Boşluk)']")
        chk("çubuk › Görünüm yönü menüsü", a.pg.locator(".sw-popup").count() > 0)
        a.press("Escape")
        pv = a.ev("window.__app.viewer.planesGroup.visible")
        a.btn("#viewbar button[title='Düzlemleri göster/gizle']")
        chk("çubuk › Düzlemleri gizle", a.ev("window.__app.viewer.planesGroup.visible") != pv)
        a.reload()
        chk("düzlem görünürlüğü yenilemede korunur (SolidWorks belgeyle saklar)", a.ev("window.__app.viewer.planesGroup.visible") == (not pv), a.ev("window.__app.viewer.planesGroup.visible"))
        a.btn("#viewbar button[title='Düzlemleri göster/gizle']") if a.ev("window.__app.viewer.planesGroup.visible") != pv else None
        # perspektif kalıcı
        a.menu("Görünüm", "Perspektif")
        a.reload()
        chk("perspektif yenilemede korunur", a.cam()["persp"], a.cam()["persp"])
        a.menu("Görünüm", "Perspektif")
        # stil kalıcı mı
        a.menu("Görünüm", "Görüntü stili", "Tel kafes")
        a.reload()
        chk("görüntü stili (tel kafes) yenilemede korunur", a.cam()["style"] == "wire", a.cam()["style"])
        a.menu("Görünüm", "Görüntü stili", "Kenarlı gölgeli")
        # kesit
        a.press("Control+7"); a.press("f")
        a.btn("#viewbar button[title='Kesit görünümü']"); a.wait(0.5)
        chk("çubuk › Kesit görünümü: PM", "Kesit" in a.pg.inner_text("#pm-title"), a.pg.inner_text("#pm-title"))
        a.btn("#pm-ok"); a.wait(0.4)
        cp = a.ev("window.__app.viewer.renderer.clippingPlanes.length")
        chk("kesit ✓: kesme düzlemi etkin", cp >= 1, cp)
        a.press("Escape"); a.wait(0.3)
        cp2 = a.ev("window.__app.viewer.renderer.clippingPlanes.length")
        note("kesit ✓ sonrası Esc → kesme düzlemi:", cp2, "(A-11)")
        a.btn("#viewbar button[title='Kesit görünümü']"); a.wait(0.5)
        cp3 = a.ev("window.__app.viewer.renderer.clippingPlanes.length")
        if a.mode() == "section":
            a.btn("#pm-cancel"); a.wait(0.3)
        note("kesit düğmesine yeniden basınca:", cp3, a.mode(), a.ev("window.__app.viewer.renderer.clippingPlanes.length"))
        chk("kesit kapatılabiliyor", a.ev("window.__app.viewer.renderer.clippingPlanes.length") == 0, a.ev("window.__app.viewer.renderer.clippingPlanes.length"))

    print("hatalar:", a.errs[:5])
    a.close()
finish()

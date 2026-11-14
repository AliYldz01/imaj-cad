# d10 — SEÇİM, SAĞ TIK MENÜLERİ, AĞAÇ İŞLEMLERİ (masaüstü 1400×900, gerçek fare)
import sys; sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d10h import *


def nsel(a):
    return a.ev("(()=>{const t=document.querySelector('#hint').textContent;return t})()")


def ctx_items(a):
    return a.pg.locator(".sw-ctx .sw-mi").all_inner_texts()


def rclick(a, x, y):
    a.pg.mouse.move(x, y, steps=2)
    a.pg.mouse.click(x, y, button="right")
    time.sleep(0.4)


def face_xy(a, pred):
    c = a.ev("p=>{const m=window.__app.viewer.mesh;const fn=eval(p);const f=m.faces.find(fn);return f?f.c:null}", pred)
    return a.wsc(c)


def edge_xy(a, pred):
    c = a.ev("p=>{const m=window.__app.viewer.mesh;const fn=eval(p);const e=m.edges.find(fn);return e?e.m:null}", pred)
    return a.wsc(c)


TOP = "f=>f.n&&f.n[1]>0.99"
FRONTF = "f=>f.n&&f.n[2]>0.99"
RIGHTF = "f=>f.n&&f.n[0]>0.99"

with sync_playwright() as p:
    a = App(p)
    # hazır model: 80×60×20 blok + R5 radyüs (üst ön kenar)
    feats = block()
    a.setup(feats)
    a.pg.keyboard.press("Control+7"); a.wait(0.3)
    a.btn("#viewbar button[title='Ekrana sığdır']") if a.pg.locator("#viewbar button[title='Ekrana sığdır']").count() else a.pg.keyboard.press("f")
    time.sleep(0.4)

    if want("secim"):
        x, y = face_xy(a, TOP); a.click(x, y)
        h1 = nsel(a)
        chk("tık: 1 yüz seçili (ipucu + durum çubuğu)", "1 yüz" in h1 and "yüz" in a.pg.inner_text("#sb-sel"), (h1, a.pg.inner_text("#sb-sel")))
        mb = a.pg.locator(".minibar .sw-sb").evaluate_all("els=>els.map(e=>e.title)")
        chk("bağlam mini çubuğu: Eskiz / Normal / Delik / Kabuk / Diğerini seç", "Eskiz" in mb and "Delik" in mb, mb)
        cr = a.pg.locator("#crumbs").inner_text()
        time.sleep(0.6); cr = a.pg.locator("#crumbs").inner_text()
        chk("kırıntılar: belge › Ekstrüzyon1 › Yüz (düz)", "Ekstrüzyon1" in cr and "Yüz" in cr, cr.replace("\n", " "))
        x2, y2 = face_xy(a, FRONTF); a.click(x2, y2)
        chk("başka yüze tık: seçim değişir (1 yüz)", "1 yüz" in nsel(a), nsel(a))
        a.click(x, y, mods=("Control",))
        chk("Ctrl+tık: 2 yüz", "2 yüz" in nsel(a), nsel(a))
        a.click(x, y, mods=("Control",))
        chk("Ctrl+tık aynı yüz: kaldırır → 1 yüz", "1 yüz" in nsel(a), nsel(a))
        ex, ey = edge_xy(a, "e=>e.type==='LINE'&&Math.abs(e.m[1]-20)<1e-6&&Math.abs(e.m[2]-30)<1e-6")
        a.click(ex, ey, mods=("Control",))
        chk("Ctrl+kenar: 1 yüz, 1 kenar", "1 yüz" in nsel(a) and "1 kenar" in nsel(a), nsel(a))
        a.press("Escape")
        chk("Esc seçimi temizler (durum çubuğu)", a.pg.inner_text("#sb-sel").strip() == "", a.pg.inner_text("#sb-sel"))
        note("Esc sonrası ipucu hâlâ:", nsel(a), "(A-10 hâlâ var)" if nsel(a) else "")
        # kırıntıya tıkla → özellik seçimi
        a.click(x, y); time.sleep(0.8)
        a.btn("#crumbs .crumb:has-text('Ekstrüzyon1')")
        sel_tree = a.ev("[...document.querySelectorAll('#tree li.sel')].map(l=>l.textContent.trim())")
        chk("kırıntı Ekstrüzyon1 → ağaçta seçili", any("Ekstrüzyon1" in s for s in sel_tree), sel_tree)
        a.press("Escape")
        # mini çubuk Eskiz → üst yüzde eskiz
        a.click(x, y); time.sleep(0.3)
        a.btn(".minibar .sw-sb[title='Eskiz']"); a.wait(0.5)
        fr = a.ev("window.__app.mode.k==='sketch'?window.__app.mode.editor.frame:null")
        chk("mini çubuk › Eskiz: üst yüzde eskiz (n=+Y, y=20)", fr and abs(fr["n"][1] - 1) < 1e-6 and abs(fr["o"][1] - 20) < 1e-6, fr)
        a.press("Escape"); a.wait(0.3)
        if a.mode() == "sketch":
            a.menu("Araçlar", "Eskizden çık"); a.wait(0.4)
        # kutu seçimi (soldan sağa pencere) tüm modeli içine alacak şekilde
        bb = a.ev("""(()=>{const v=window.__app.viewer,m=v.mesh;const r=document.querySelector('#view canvas').getBoundingClientRect();let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
          for(const x of [m.bbox.min[0],m.bbox.max[0]])for(const y of [m.bbox.min[1],m.bbox.max[1]])for(const z of [m.bbox.min[2],m.bbox.max[2]]){const s=v.toScreen([x,y,z]);x0=Math.min(x0,s[0]);y0=Math.min(y0,s[1]);x1=Math.max(x1,s[0]);y1=Math.max(y1,s[1])}
          return [r.left+x0-25,r.top+y0-25,r.left+x1+25,r.top+y1+25]})()""")
        a.drag((bb[0], bb[1]), (bb[2], bb[3]))
        note("pencere seçimi (tüm model):", nsel(a))
        chk("pencere seçimi bir şey seçer", "Seçili" in nsel(a), nsel(a))
        a.press("Escape")
        # diğerini seç: Alt+tık (arkadaki yüz)
        a.click(x, y); h0 = a.ev("[...window.__app.psel?window.__app.psel.faces:[]]") if a.ev("!!window.__app.psel") else None
        a.click(x, y, mods=("Alt",))
        note("Alt+tık (diğerini seç) sonrası:", nsel(a))
        chk("Alt+tık: hâlâ 1 yüz (arkadaki)", "1 yüz" in nsel(a), nsel(a))
        a.press("Escape")
        # seçim filtresi
        a.press("F5")
        a.click(ex, ey)
        chk("F5 yüz filtresi: kenara tık kenar seçmez", "kenar" not in nsel(a), nsel(a))
        a.press("F5"); a.press("F5"); a.press("Escape")

    if want("sagtik"):
        a.pg.keyboard.press("Control+7"); a.press("f")
        x, y = face_xy(a, TOP)
        rclick(a, x, y)
        it = ctx_items(a)
        note("yüzde sağ tık:", it)
        chk("yüz sağ tık: Eskiz / Dik var", "Eskiz" in it and any("Dik" in s for s in it), it)
        chk("yüz sağ tık: sahibi için 'Özelliği düzenle' / 'Eskizi düzenle' (SolidWorks)", any("düzenle" in s.lower() and "Özellik" in s for s in it) or any("Eskizi düzenle" in s for s in it), it)
        a.btn(".sw-ctx .sw-mi:has-text('Dik')")
        c = a.cam()
        chk("sağ tık › Dik: üstten bakış", [round(v) for v in c["dir"]] == [0, 1, 0], c["dir"])
        a.pg.keyboard.press("Control+7"); a.press("f")
        x, y = face_xy(a, TOP)
        rclick(a, x, y); a.btn(".sw-ctx .sw-mi:has-text('Eskiz')"); a.wait(0.5)
        chk("sağ tık › Eskiz: üst yüzde eskiz", a.mode() == "sketch")
        vc = a.view_center()
        rclick(a, vc[0] + 350, vc[1] + 250)
        it = ctx_items(a)
        note("eskizde boşluğa sağ tık:", it)
        a.btn(".sw-ctx .sw-mi:has-text('Eskizden çık')"); a.wait(0.5)
        chk("eskiz sağ tık › Eskizden çık", a.mode() == "part")
        # boşlukta sağ tık
        rclick(a, vc[0] + 350, vc[1] + 250)
        it = ctx_items(a)
        note("boşlukta sağ tık:", it)
        a.pg.keyboard.press("Control+1")
        a.btn(".sw-ctx .sw-mi:has-text('İzometrik')") if a.pg.locator(".sw-ctx").count() else (rclick(a, vc[0] + 350, vc[1] + 250), a.btn(".sw-ctx .sw-mi:has-text('İzometrik')"))
        c = a.cam()
        chk("boşluk sağ tık › İzometrik", c["dir"][0] > 0.5 and c["dir"][2] > 0.5, c["dir"])
        rclick(a, vc[0] + 350, vc[1] + 250); a.btn(".sw-ctx .sw-mi:has-text('Önceki görünüm')")
        c = a.cam()
        chk("boşluk sağ tık › Önceki görünüm (Ctrl+1 önüne)", [round(v) for v in c["dir"]] == [0, 0, 1], c["dir"])
        a.pg.keyboard.press("Control+7"); a.press("f")
        # renk
        x, y = face_xy(a, TOP)
        rclick(a, x, y)
        it = ctx_items(a)
        a.btn(".sw-ctx .sw-mi:has-text('parça rengi')"); time.sleep(0.5)
        inp = a.pg.locator("input[type=color]")
        note("parça rengi seçici:", inp.count(), a.dialogs_open())
        if inp.count():
            # işletim sistemi renk seçicisinde kırmızı seçildi (hazır ortam: değer + change)
            a.ev("(()=>{const i=document.querySelector('input[type=color]');i.value='#ff0000';i.dispatchEvent(new Event('change'))})()"); a.wait(0.4)
        chk("sağ tık › parça rengi → belgeye yazılır", (a.ev("JSON.stringify(window.__app.doc.look||null)") or "").lower().find("ff0000") >= 0, a.ev("JSON.stringify(window.__app.doc.look||null)"))
        a.undo()
        chk("Ctrl+Z renk geri alınır", a.ev("JSON.stringify(window.__app.doc.look||null)") in ("null", None), a.ev("JSON.stringify(window.__app.doc.look||null)"))
        # ağaçta sağ tık
        a.show_tree()
        li = a.pg.locator("#tree li", has=a.pg.locator("span:text-is('Ekstrüzyon1')")).first
        li.click(button="right"); time.sleep(0.4)
        it = ctx_items(a)
        note("ağaçta sağ tık (Ekstrüzyon1):", it)
        chk("ağaç sağ tık: Eskizi düzenle / Bastır / Sil / Adlandır (SolidWorks)", all(any(k in s for s in it) for k in ["Eskizi düzenle", "Bastır", "Sil"]), it)
        a.btn(".sw-ctx .sw-mi:has-text('Özelliği düzenle')"); a.wait(0.4)
        chk("ağaç sağ tık › Özelliği düzenle → PM", a.mode() == "pm" and "Ekstrüzyon" in a.pg.inner_text("#pm-title"), a.pg.inner_text("#pm-title"))
        rclick(a, vc[0] + 350, vc[1] + 250)
        it = ctx_items(a)
        note("PM açıkken sağ tık:", it)
        a.btn(".sw-ctx .sw-mi:has-text('İptal')"); a.wait(0.4)
        chk("PM sağ tık › İptal", a.mode() == "part")

    if want("agac"):
        a.setup(block() + [{"id": "f1", "type": "fillet", "name": "Radyüs1", "edges": [], "r": 3}])
        a.wait(0.5)
        # radyüs: üst ön kenar gerçek seçimle yeniden kur — ağaç işlemleri için hazır model yeterli: kenarsız radyüs hata verir mi?
        a.tsel("Radyüs1")
        a.btn("#tree-actions button:text-is('Sil')") if False else None
        a.setup(block())
        # Radyüs'ü gerçek UI ile ekle
        ex, ey = edge_xy(a, "e=>e.type==='LINE'&&Math.abs(e.m[1]-20)<1e-6&&Math.abs(e.m[2]-30)<1e-6")
        a.click(ex, ey)
        a.cmd("Radyüs"); a.pmfield("Yarıçap", 5); a.ok()
        v_f = a.vol()
        chk("radyüs R5 eklendi (96000 − 80·25(1−π/4))", near(v_f, 96000 - 80 * 25 * (1 - math.pi / 4), 1), v_f)
        # F2 adlandır
        a.tsel("Radyüs1"); a.dq[:] = ["KenarR"]; a.press("F2")
        chk("F2 → ad KenarR", "KenarR" in a.names(), a.names())
        # çift tık → PM
        a.pg.locator("#tree li", has=a.pg.locator("span:text-is('KenarR')")).first.dblclick(); a.wait(0.4)
        chk("ağaçta çift tık → özellik düzenle", a.mode() == "pm", a.mode())
        a.btn("#pm-cancel"); a.wait(0.3)
        # bastır
        a.tact("KenarR", "Bastır")
        chk("Bastır → 96000", near(a.vol(), 96000, 1), a.vol())
        a.tact("KenarR", "Etkinleştir")
        chk("Etkinleştir → radyüslü", near(a.vol(), v_f, 1), a.vol())
        # geri sar
        a.tact("Ekstrüzyon1", "Buraya geri sar")
        chk("Buraya geri sar (Ekstrüzyon1): model boş ya da yalnız eskiz", a.vol() in (None, 0) or near(a.vol(), 0, 1), a.vol())
        a.tact("Eskiz1", "Sona sar")
        chk("Sona sar → radyüslü", near(a.vol(), v_f, 1), a.vol())
        # ebeveyn / çocuk
        a.tact("Ekstrüzyon1", "Ebeveyn / çocuk")
        chk("Ebeveyn/çocuk: Eskiz1 / KenarR", "Eskiz1" in a.toast() and "KenarR" in a.toast(), a.toast())
        # ▲▼: KenarR'yi Ekstrüzyon1'in üstüne taşımak geçersiz olmalı
        a.tact("KenarR", "▲ Yukarı")
        note("KenarR ▲ sonrası sıra:", a.names(), a.toast())
        chk("radyüs ▲ ekstrüzyonun üstüne: model bozulmamalı (reddet ya da hata göster)", a.names()[-1] == "KenarR" or bool(a.errtree()), (a.names(), a.errtree()))
        if a.names()[-1] != "KenarR":
            a.undo()
        # sürükle-bırak sıralama
        a.setup(block() + [rect_sk("s2", "Eskiz2", TOP, -10, -10, 10, 10), ext("e2", "s2", 30)])
        a.ev("(()=>{const f=window.__app.doc.features.find(x=>x.id==='e2');f.name='Ekstrüzyon2'})()")
        a.show_tree()
        src = a.pg.locator("#tree li", has=a.pg.locator("span:text-is('Eskiz2')")).first
        dst = a.pg.locator("#tree li", has=a.pg.locator("span:text-is('Eskiz1')")).first
        src.drag_to(dst); a.wait(0.5)
        note("Eskiz2 sürüklendi → sıra:", a.names())
        chk("ağaçta sürükle-bırak sırayı değiştirir", a.names().index("Eskiz2") < a.names().index("Ekstrüzyon1"), a.names())
        a.undo()
        # klasör
        a.dq[:] = ["Gövde"]
        a.tact("Ekstrüzyon1", "Klasöre ekle…")
        chk("Klasöre ekle → klasör başlığı", a.pg.locator("#tree li.folder").count() == 1, a.pg.locator("#tree li.folder").all_inner_texts())
        # Sil + onay; bağımlı radyüs
        a.setup(block())
        ex, ey = edge_xy(a, "e=>e.type==='LINE'&&Math.abs(e.m[1]-20)<1e-6&&Math.abs(e.m[2]-30)<1e-6")
        a.click(ex, ey); a.cmd("Radyüs"); a.pmfield("Yarıçap", 5); a.ok()
        a.dq[:] = [True, False]
        a.tact("Ekstrüzyon1", "Sil")
        msg = [m for t, m in a.dlog[-2:]]
        note("Ekstrüzyon1 Sil mesajları:", msg, "kalan:", a.names(), "hatalı:", a.errtree())
        chk("Sil onayı bağımlı Radyüs1'i belirtir (SolidWorks: çocuk özellikler listelenir)", any("Radyüs1" in m for m in msg), msg)
        a.undo()
        chk("Ctrl+Z silmeyi geri alır", "Ekstrüzyon1" in a.names() and near(a.vol(), v_f, 1), (a.names(), a.vol()))
        a.dq[:] = [False]
        a.tact("Ekstrüzyon1", "Sil")
        chk("Sil → Vazgeç: değişmez", "Ekstrüzyon1" in a.names())

    print("hatalar:", a.errs[:5])
    a.close()
finish()

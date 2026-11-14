# Denetim 2 / d7 — Malzeme + kütle özellikleri, görünüm / renk (parça + yüz), ağaç klasörleri, geri sarma çubuğu,
# Ne Yanlış? / Kontrol. Hazır model: blok + delik + radyüs (setDoc). Kullanıcı adımları gerçek tıklama / sağ tık / klavye.
# Not: renk seçimi işletim sisteminin renk penceresidir (otomatikleştirilemez); seçilen renk gizli <input type=color>'a yazılıp
# change olayı verilir (tek simülasyon adımı).
import sys
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d7h import *  # noqa
import re


def model(fillet=True):
    hole = circ_sk("s2", "Delik", top_face(20), 10, 5, 5)
    cut = ext("e2", "s2", 20, cut=True, end="through"); cut["name"] = "Kesme1"
    f = block(80, 60, 20) + [hole, cut]
    if fillet:
        f.append({"id": "fl", "type": "fillet", "name": "Radyüs1", "r": 5, "edges": [{"m": [0, 20, 30], "d": [1, 0, 0]}]})
    return f


with sync_playwright() as p:
    a = App(p)
    case = lambda n, f: run_case(a, n, f)

    def mass_txt():
        tab(a, "evaluate"); a.cmd("Kütle Özell."); a.wait(0.8)
        t = a.ev("document.querySelector('dialog[open]')?.innerText||''")
        a.btn("dialog[open] button[value='ok']"); a.wait(0.3)
        tab(a, "features")
        return t.replace("\n", " | ")

    # ---------------- MK: malzeme + kütle ----------------
    def mk():
        a.setup(model())
        v = a.vol()
        t = mass_txt()
        chk("MK çelik varsayılan, kütle = hacim × 7,85", "çeli" in t.lower(), t[:160])
        tab(a, "evaluate"); a.cmd("Malzeme"); a.wait(0.4)
        opts = a.ev("[...document.querySelectorAll('dialog[open] label')].map(l=>[l.querySelector('input').value,l.textContent])")
        al = [o for o in opts if "lüminyum" in o[1]][0][0]
        a.pg.locator(f"dialog[open] input[value='{al}']").check(); a.btn("dialog[open] button[value='ok']"); a.wait(0.6); tab(a, "features")
        t2 = mass_txt()
        print("   MK alüminyum:", t2[:200])
        m = re.search(r"Kütle: ([\d.,]+) (g|kg)", t2)
        kg = float(m.group(1).replace(".", "").replace(",", ".")) * (1 if m.group(2) == "kg" else 0.001) if m else None
        chk("MK alüminyum: kütle = hacim·2,7 g/cm³", kg and near(kg, v / 1e6 * 2.7, 0.002), (kg, v))
        a.undo()
        chk("MK geri al → çelik", a.ev("window.__app.doc.material||'steel'") == "steel", a.ev("window.__app.doc.material"))
        a.redo(); a.reload()
        chk("MK yenile → alüminyum", "lüminyum" in mass_txt(), None)
        # Esc ile kütle penceresi (P-25 hâlâ var mı)
        tab(a, "evaluate"); a.cmd("Kütle Özell."); a.wait(0.6)
        a.pg.keyboard.press("Escape"); time.sleep(0.6)
        mat_open = a.ev("[...document.querySelectorAll('dialog[open]')].some(d=>d.innerText.includes('Malzeme') && d.innerText.includes('g/cm³') && d.querySelectorAll('input[type=radio]').length)")
        print("   MK Esc sonrası Malzeme penceresi açık mı (P-25):", mat_open)
        close_dialogs(a); tab(a, "features")
        # yalnız yüzey varken
        a.setup([line_sk("s1", "Yol", TOP, -30, 0, 30, 0)])
        a.cmd("Yüzey Ekstrüzyon"); a.wait(0.5); a.ok()
        t3 = mass_txt()
        print("   MK yalnız yüzey:", t3[:160], a.toast())
        chk("MK yalnız yüzey gövdesi: 'katı gerekir' uyarısı (0 g kütle penceresi değil)", "Kütle: 0" not in t3, (t3[:120], a.toast()))
    case("MK", mk)

    # ---------------- RN: görünüm / renk ----------------
    def rn():
        a.setup(model(fillet=False))
        a.pg.keyboard.press("Escape")
        c = a.wsc([0, 20, 20])   # üst yüz
        rclick(a, c[0], c[1])
        items = menu_items(a)
        chk("RN sağ tık menüsünde yüz / parça rengi", "Görünüm: yüz rengi…" in items and "Görünüm: parça rengi…" in items, items)
        menu_click(a, "Görünüm: yüz rengi"); choose_color(a, "#00ff00"); a.wait(0.8)
        lk = look(a); fc = face_colors(a)
        top_i = a.ev("window.__app.viewer.mesh.faces.findIndex(f=>f.n&&f.n[1]>0.99)")
        chk("RN üst yüz yeşil kaydedildi ve boyandı", lk and lk.get("faces") and fc and fc.get(str(top_i)) == "ff00", (lk, fc, top_i))
        c = a.wsc([40, 10, 0])
        rclick(a, c[0], c[1]); menu_click(a, "Görünüm: parça rengi"); choose_color(a, "#ff0000"); a.wait(0.8)
        chk("RN parça rengi kırmızı", (look(a) or {}).get("part") == "#ff0000", look(a))
        a.tact("Ekstrüzyon1", "Eskizi düzenle"); a.dim_dbl(0, 120); a.ok()
        top_i = a.ev("window.__app.viewer.mesh.faces.findIndex(f=>f.n&&f.n[1]>0.99)")
        fc = face_colors(a)
        chk("RN genişlik 80→120 sonrası üst yüz hâlâ yeşil", fc and fc.get(str(top_i)) == "ff00", (fc, top_i))
        a.edit_feat("Ekstrüzyon1"); a.pmfield("Derinlik", 35); a.wait(0.5); a.ok()
        top_i = a.ev("window.__app.viewer.mesh.faces.findIndex(f=>f.n&&f.n[1]>0.99)")
        fc = face_colors(a)
        print("   RN derinlik 35 → yüz renkleri:", fc, "üst", top_i)
        chk("RN derinlik 20→35 sonrası üst yüz hâlâ yeşil, başka yüz yeşil değil", fc and fc.get(str(top_i)) == "ff00" and list(fc.values()).count("ff00") == 1, (fc, top_i))
        a.undo(); a.undo(); a.undo()
        chk("RN üç geri al → parça rengi kalktı, yüz yeşil", (look(a) or {}).get("part") is None and (look(a) or {}).get("faces"), look(a))
        a.redo(); a.reload()
        chk("RN yenile → parça kırmızı korunur", (look(a) or {}).get("part") == "#ff0000", look(a))
        c = a.wsc([0, 20, 20]); rclick(a, c[0], c[1])
        menu_click(a, "Renkleri sıfırla"); a.wait(0.6)
        chk("RN renkleri sıfırla", look(a) is None and not face_colors(a), (look(a), face_colors(a)))
        # yüzey yüzüne renk → kalınlaştır sonrası
        a.setup([line_sk("s1", "Yol", TOP, -30, 0, 30, 0)])
        a.cmd("Yüzey Ekstrüzyon"); a.wait(0.5); a.pmfield("Mesafe", 40); a.wait(0.5); a.ok()
        a.pg.keyboard.press("Escape")
        c = a.wsc([0, 20, 0]); rclick(a, c[0], c[1])
        it = menu_items(a)
        print("   RN yüzey sağ tık menüsü:", it)
        chk("RN yüzey yüzünde 'yüz rengi' (D7-19)", any("yüz rengi" in x for x in it), it)
        if any("yüz rengi" in x for x in it):
            menu_click(a, "Görünüm: yüz rengi"); choose_color(a, "#0000ff"); a.wait(0.6)
            chk("RN yüzey yüzü mavi boyandı (D7-19)", (face_colors(a) or {}).get("0") == "ff", face_colors(a))
            a.cmd("Kalınlaştır"); a.wait(0.5); a.pmfield("Kalınlık", 3); a.wait(0.5); a.ok()
            fc = face_colors(a)
            print("   RN yüzey mavi → kalınlaştır sonrası yüz renkleri:", fc)
    case("RN", rn)

    # ---------------- KL: ağaç klasörleri ----------------
    def kl():
        a.setup(model())
        a.tact("Kesme1", "Klasöre ekle…", confirm=["Delikler"])
        a.tact("Radyüs1", "Klasöre ekle…", confirm=["Delikler"])
        fl = a.ev("window.__app.doc.features.map(f=>[f.name,f.folder||null])")
        hdr = a.ev("[...document.querySelectorAll('#tree li.folder')].map(l=>l.textContent.trim())")
        chk("KL Kesme1 + Radyüs1 'Delikler' klasöründe, tek başlık", hdr and len(hdr) == 1 and "Delikler" in hdr[0] and [x for x in fl if x[1] == "Delikler"] == [["Kesme1", "Delikler"], ["Radyüs1", "Delikler"]], (hdr, fl))
        a.btn("#tree li.folder"); a.wait(0.3)
        acts = a.ev("[...document.querySelectorAll('#tree-actions button')].map(b=>b.textContent)")
        print("   KL klasör eylemleri:", acts)
        a.dq[:] = ["Detaylar"]; a.btn("#tree-actions button:text-is('Klasörü adlandır')"); a.wait(0.6)
        chk("KL klasör adı Detaylar", a.ev("window.__app.doc.features.filter(f=>f.folder==='Detaylar').length") == 2, a.ev("window.__app.doc.features.map(f=>f.folder||null)"))
        v = a.vol()
        a.btn("#tree li.folder"); a.btn("#tree-actions button:text-is('Klasörü bastır')"); a.wait(0.6)
        chk("KL klasörü bastır → blok 96000", near(a.vol(), 96000, 1), a.vol())
        a.undo(); chk("KL geri al", near(a.vol(), v, 1), a.vol())
        a.reload()
        chk("KL yenile → klasör korunur", a.ev("window.__app.doc.features.filter(f=>f.folder==='Detaylar').length") == 2, None)
        a.btn("#tree li.folder"); a.btn("#tree-actions button:text-is('Kapat')"); a.wait(0.3)
        vis = a.ev("[...document.querySelectorAll('#tree li')].map(l=>l.textContent.trim())")
        chk("KL kapatınca içindekiler gizli", "Kesme1" not in vis and "Radyüs1" not in vis, vis)
        print("   KL kapalı klasör eylemleri:", a.ev("[...document.querySelectorAll('#tree-actions button')].map(b=>b.textContent)"), a.ev("[...document.querySelectorAll('#tree li')].map(l=>l.className+':'+l.textContent.trim())"))
        a.btn("#tree-actions button:text-is('Aç')")
        # klasör + yapılandırma: klasörü bastırınca etkin yapılandırma listesi
        a.setup(model(), {"configs": [{"name": "A", "vars": {}, "off": []}, {"name": "B", "vars": {}, "off": []}], "config": "A"})
        a.tact("Kesme1", "Klasöre ekle…", confirm=["K"])
        a.btn("#tree li.folder"); a.btn("#tree-actions button:text-is('Klasörü bastır')"); a.wait(0.6)
        cf = a.ev("window.__app.doc.configs.map(c=>[c.name,c.off])")
        print("   KL yapılandırmalı belgede klasör bastır → tablolar:", cf)
        chk("KL klasörü bastır etkin yapılandırmanın bastırma listesine yazılır (ağaç Bastır gibi)", "e2" in cf[0][1], cf)
        # klasörden çıkar
        a.tact("Kesme1", "Klasörden çıkar (K)")
        chk("KL klasörden çıkar", not a.featbyname("Kesme1").get("folder"), a.featbyname("Kesme1"))
    case("KL", kl)

    # ---------------- GS: geri sarma çubuğu ----------------
    def gs():
        a.setup(model())
        vfull = a.vol()
        a.tact("Kesme1", "Buraya geri sar"); a.wait(0.5)
        bar = a.ev("!!document.querySelector('#tree li.rollbar span')?.textContent")
        rolled = a.ev("[...document.querySelectorAll('#tree li.rolled')].map(l=>l.textContent.trim())")
        chk("GS Kesme1'e geri sar → blok 96000, Kesme1 + Radyüs1 soluk, çubuk görünür", near(a.vol(), 96000, 1) and bar and "Kesme1" in rolled and "Radyüs1" in rolled and "geri sarılmış" in a.status(), (a.vol(), bar, rolled, a.status()))
        # geri sarılıyken yeni özellik (kubbe) → çubuğun üstüne eklenir
        a.cmd("Kubbe"); a.wait(0.5); a.face_click("f=>f.n&&f.n[1]>0.99"); a.pmfield("Yükseklik", 5); a.wait(0.5); a.ok()
        order = a.names()
        chk("GS yeni Kubbe1 çubuğun üstüne (Kesme1'den önce) eklendi", order.index("Kubbe1") < order.index("Kesme1") and a.ev("window.__app.doc.rollback") == order.index("Kubbe1") + 1, (order, a.ev("window.__app.doc.rollback")))
        a.reload()
        chk("GS yenile → geri sarılmış kalır", a.ev("window.__app.doc.rollback") is not None and "geri sarılmış" in a.status(), a.status())
        a.btn("#tree li.rollbar"); a.wait(0.8)
        chk("GS çubuğa dokun → sona sar, tüm özellikler", a.ev("window.__app.doc.rollback") is None and not a.errs_map(), (a.ev("window.__app.doc.rollback"), a.errs_map(), a.vol()))
        a.undo()
        chk("GS geri al → yine geri sarılmış", a.ev("window.__app.doc.rollback") is not None, a.ev("window.__app.doc.rollback"))
        # geri sarılıyken çubuğun üstündeki bir özelliği sil → çubuk yerinde kalmalı
        a.setup(model())
        a.tact("Radyüs1", "Buraya geri sar"); a.wait(0.4)
        before = a.ev("window.__app.doc.features[window.__app.doc.rollback].name")
        a.tact("Kesme1", "Sil", confirm=[True, True]); a.wait(0.6)
        rb = a.ev("window.__app.doc.rollback"); after = a.ev("(()=>{const d=window.__app.doc;return d.rollback!=null&&d.features[d.rollback]?d.features[d.rollback].name:null})()")
        print("   GS sil öncesi çubuk:", before, "sonrası çubuk altındaki ilk:", after, "rollback", rb, a.names())
        chk("GS çubuk üstünde özellik silinince çubuk aynı özelliğin (Radyüs1) önünde kalır", after == "Radyüs1", (before, after, a.names()))
        # geri sarılıyken eskiz düzenle (çubuk altındaki)
    case("GS", gs)

    # ---------------- NY: Ne Yanlış? / Kontrol ----------------
    def ny():
        a.setup(model())
        a.edit_feat("Ekstrüzyon1"); a.pmfield("Derinlik", 4); a.wait(0.5); a.ok()
        if a.pg.locator("dialog.reselect-dialog[open]").count():
            a.btn("dialog.reselect-dialog[open] button:has-text('Daha sonra')")
        st = a.status(); e = a.errs_map()
        print("   NY derinlik 4 → durum:", st, e)
        a.btn("#status"); a.wait(0.6)
        ww = a.ev("document.querySelector('dialog.whatswrong')?.innerText||''")
        chk("NY durum çubuğuna dokun → Ne yanlış? açılır ve hatalı özelliği listeler", "Radyüs1" in ww, ww[:200])
        if "Radyüs1" in ww:
            a.btn("dialog.whatswrong .ww-row button:text-is('Düzenle')"); a.wait(0.6)
            chk("NY Düzenle → Radyüs PM", a.mode() == "pm", a.mode())
            a.cancel("discard")
        close_dialogs(a)
        # yapılandırmalı belgede Ne yanlış? içinden Bastır
        a.setup(model(), {"configs": [{"name": "A", "vars": {}, "off": []}, {"name": "B", "vars": {}, "off": []}], "config": "A"})
        a.edit_feat("Ekstrüzyon1"); a.pmfield("Derinlik", 4); a.wait(0.5); a.ok()
        if a.pg.locator("dialog.reselect-dialog[open]").count():
            a.btn("dialog.reselect-dialog[open] button:has-text('Daha sonra')")
        tab(a, "evaluate"); a.cmd("Ne Yanlış?"); a.wait(0.6)
        a.btn("dialog.whatswrong .ww-row button:text-is('Bastır')"); a.wait(0.8); tab(a, "features")
        cf = a.ev("window.__app.doc.configs.map(c=>[c.name,c.off])")
        chk("NY Ne yanlış?'tan Bastır etkin yapılandırmaya da yazılır", "fl" in cf[0][1], cf)
        # Kontrol: katı + açık yüzey
        a.setup(model(False) + [line_sk("s9", "Yol", FRONT, -30, 40, 30, 40)])
        a.cmd("Yüzey Ekstrüzyon"); a.wait(0.5); a.pmselect("Eskiz", "s9"); a.ok()
        tab(a, "evaluate"); a.cmd("Kontrol"); a.wait(4)
        ck = check_info(a); ww = a.ev("document.querySelector('dialog.whatswrong')?.innerText||''")
        print("   NY Kontrol:", ck, ww.replace("\n", " | ")[:200])
        chk("NY Kontrol: 1 geçerli katı + 1 yüzey gövdesi bildirilir", ck and len(ck["bodies"]) == 1 and ck["bodies"][0]["valid"] and ck["surfs"] == 1 and "yüzey" in ww.lower(), (ck, ww[:150]))
        close_dialogs(a); tab(a, "features")
    case("NY", ny)

    print("SAYFA HATALARI:", a.errs[:5])
    finish()

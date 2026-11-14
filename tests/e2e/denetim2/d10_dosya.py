# d10 — DOSYA YAŞAM DÖNGÜSÜ (masaüstü, indirme yolu: showSaveFilePicker yok)
# Yeni / Kaydet / Farklı kaydet / Aç / Son belgeler / belge sekmeleri / sekme kapatma / yenileme / PM ve eskiz akıbeti
import sys; sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d10h import *


def edit_depth(a, v, ok=True):
    a.edit_feat("Ekstrüzyon1")
    a.pmfield("Derinlik", v)
    if ok:
        a.ok()


with sync_playwright() as p:
    a = App(p)
    # hazır model: 80×60×20 blok
    a.setup(block())
    chk("hazır model hacmi 96000", near(a.vol(), 96000, 1), a.vol())

    if want("kaydet"):
        # F2 Dosya > Kaydet (ilk kez: ad sorulur)
        a.dq[:] = ["Kutu"]
        nm, data = a.download(lambda: a.menu("Dosya", "Kaydet"))
        d = json.loads(data)
        chk("Kaydet: Kutu.icad indirildi, ad soruldu", nm == "Kutu.icad" and any(t == "prompt" for t, _ in a.dlog), nm)
        chk("Kaydet: dosyada 2 özellik, d1=20", len(d["features"]) == 2 and d["features"][1]["d1"] == 20)
        chk("Kaydet: belge adı Kutu", a.docname() == "Kutu")
        note("dosyadaki iç alanlar:", [k for k in d if k not in ("features", "seq")])
        # F3 UI ile derinlik 30 → Kaydet (ad sorulmamalı)
        edit_depth(a, 30)
        chk("Düzenle: derinlik 30 → hacim 144000", near(a.vol(), 144000, 1), a.vol())
        n0 = len(a.dlog)
        nm, data = a.download(lambda: a.pg.keyboard.press("Control+s"))
        d = json.loads(data)
        chk("Ctrl+S: ad sorulmadan Kutu.icad, d1=30", nm == "Kutu.icad" and len(a.dlog) == n0 and d["features"][1]["d1"] == 30, (nm, len(a.dlog) - n0))
        uid1 = d.get("uid")
        # F4 Farklı kaydet
        a.dq[:] = ["Kutu2"]
        nm, data = a.download(lambda: a.menu("Dosya", "Farklı kaydet…"))
        d2 = json.loads(data)
        chk("Farklı kaydet: Kutu2.icad", nm == "Kutu2.icad" and a.docname() == "Kutu2", nm)
        chk("Farklı kaydet: yeni belge kimliği (uid farklı)", d2.get("uid") != uid1, f"uid1={uid1} uid2={d2.get('uid')}")
        # F5 Son belgeler: Kutu ve Kutu2 ikisi de listede mi
        a.menu("Dosya", "Son belgeler…")
        rows = a.ev("[...document.querySelectorAll('dialog[open] .pm-row span')].map(s=>s.textContent.split(' — ')[0])")
        chk("Son belgeler: Kutu ve Kutu2 ikisi de", "Kutu" in rows and "Kutu2" in rows, rows)
        a.close_dialogs()
        # F6 Yeni (Ctrl+N) → yeni sekme, eski belge korunur
        a.menu("Dosya", "Yeni parça")
        chk("Yeni: 2 sekme, yeni boş", a.nfeat() == 0 and len(a.tabs()) == 2, a.tabs())
        # F7 Aç: Kutu.icad (d1=30 sürümü değil: ilk kaydedilen?) — ilk indirme üzerine yazıldı → Kutu.icad = d1 30
        #     Kutu2 (d1=30, aynı uid) sekmede açıkken Kutu.icad'ı aç → hangi belge gelir?
        open(os.path.join(DL, "Kutu_eski.icad"), "w").write(json.dumps({**d, "features": [d["features"][0], {**d["features"][1], "d1": 20}], "name": "Kutu"}))
        a.open_file(lambda: a.menu("Dosya", "Aç…"), os.path.join(DL, "Kutu_eski.icad"))
        a.wait(1)
        chk("Aç (Kutu, d1=20): Kutu yüklendi (Kutu2 değil)", a.docname() == "Kutu" and near(a.vol(), 96000, 1), f"ad={a.docname()} hacim={a.vol()} sekmeler={a.tabs()} toast={a.toast()!r}")
        a.close_dialogs()

    if want("sekme"):
        a.pg.evaluate("localStorage.clear()"); a.pg.reload(); a.wait(1)
        a.setup(block())
        a.menu("Dosya", "Yeni parça")
        chk("sekme: 2 sekme", len(a.tabs()) == 2, a.tabs())
        # 2. sekmede hazır model değil: sihirbazsız, geri dön
        a.btn("#doctabs .dtab:nth-child(1) span")
        a.wait(1)
        chk("sekme 1'e dönüş: hacim 96000", near(a.vol(), 96000, 1), a.vol())
        # PM açıkken sekme değiştir → değişiklik?
        edit_depth(a, 45, ok=False)
        chk("PM açık, derinlik 45 önizleme", a.mode() == "pm")
        a.btn("#doctabs .dtab:nth-child(2) span")
        a.wait(0.8)
        dl = a.dialogs_open()
        note("PM açıkken sekme 2'ye tık → açık pencereler:", dl, "mod:", a.mode())
        a.btn("#doctabs .dtab:nth-child(1) span")
        a.wait(1)
        d1 = a.featv("Ekstrüzyon1", "d1")
        chk("PM'deki değişiklik sekme geçişinde uyarısız kaybolmuyor (sorulur ya da korunur)", d1 == 45 or len(dl) > 0, f"d1={d1} pencereler={dl}")
        # eskiz açıkken sekme geçişi
        a.tsel("Eskiz1"); a.btn("#tree-actions button:text-is('Eskizi düzenle')"); a.wait(0.5)
        chk("eskiz açıldı", a.mode() == "sketch")
        a.dim_dbl(0, 100)
        a.btn("#doctabs .dtab:nth-child(2) span"); a.wait(0.8)
        dl = a.dialogs_open()
        a.btn("#doctabs .dtab:nth-child(1) span"); a.wait(1.2)
        note("eskizde ölçü 100 → sekme geçişi: pencere", dl, "hacim", a.vol())
        chk("eskiz değişikliği sekme geçişinde korunuyor (100×60×20)", near(a.vol(), 120000, 1), a.vol())
        # yenile: iki sekme korunur mu
        a.reload()
        chk("yenileme: 2 sekme çubukta görünür", len(a.tabs()) == 2, a.tabs())
        a.filemenu("files")
        txt = a.pg.inner_text("dialog.filemgr[open]")
        chk("yenileme: dosya yöneticisinde 2 açık belge", "BELGELER (2)" in txt.upper(), txt[:60])
        a.btn("dialog.filemgr[open] .fm-row:has-text('●') button:text-is('Geç')")
        note("yöneticide etkin belgeye 'Geç' sonrası sekmeler:", a.tabs())
        chk("yenileme: etkin belge hacmi 120000", near(a.vol(), 120000, 1), a.vol())
        # geri al yığını sekme başına
        a.undo()
        note("yenilemeden sonra Ctrl+Z:", a.vol())
        # sekme kapat (kaydedilmemiş) → onay
        a.dq[:] = [False]
        a.btn("#doctabs .dtab:nth-child(1) .dtab-x"); time.sleep(0.5)
        last = a.dlog[-1] if a.dlog else None
        chk("sekme kapat: onay soruldu, Vazgeç → kalır", last and last[0] == "confirm" and len(a.tabs()) == 2, last)
        # değişmemiş boş sekmeyi kapat: yine soruyor mu
        n0 = len(a.dlog)
        a.dq[:] = [True]
        a.btn("#doctabs .dtab:nth-child(2) .dtab-x"); time.sleep(0.5)
        note("boş, değişmemiş sekmeyi kapatma: soru sayısı", len(a.dlog) - n0, a.dlog[-1] if len(a.dlog) > n0 else "")
        chk("boş sekme kapandı", a.tabs() == [] or len(a.tabs()) <= 1, a.tabs())

    if want("pmyenile"):
        a.pg.evaluate("localStorage.clear()"); a.pg.reload(); a.wait(1)
        a.setup(block())
        edit_depth(a, 33, ok=False)
        n0 = len(a.dlog)
        a.pg.reload(); wait_ready(a.pg); time.sleep(1); a.wait(0.5)
        bu = [x for x in a.dlog[n0:] if x[0] == "beforeunload"]
        chk("PM açık + değişmiş → yenilemede beforeunload uyarısı", len(bu) == 1, a.dlog[n0:])
        chk("yenileme (ayrıl) sonrası eski değer 20", a.featv("Ekstrüzyon1", "d1") == 20)
        # değişmemiş PM: uyarısız
        a.edit_feat("Ekstrüzyon1")
        n0 = len(a.dlog)
        a.pg.reload(); wait_ready(a.pg); time.sleep(1)
        chk("değişmemiş PM → yenilemede uyarı yok", not [x for x in a.dlog[n0:] if x[0] == "beforeunload"], a.dlog[n0:])
        # eskiz açık + değişmiş
        a.tsel("Eskiz1"); a.btn("#tree-actions button:text-is('Eskizi düzenle')"); a.wait(0.5)
        a.dim_dbl(0, 90)
        n0 = len(a.dlog)
        a.dq[:] = [False]  # yenilemeden vazgeç
        try:
            a.pg.reload(timeout=4000)
        except Exception:
            pass
        time.sleep(1)
        bu = [x for x in a.dlog[n0:] if x[0] == "beforeunload"]
        chk("eskiz değişmiş → yenilemede uyarı, kal → eskiz açık", len(bu) == 1 and a.mode() == "sketch", (a.dlog[n0:], a.mode()))
        a.btn("#pm-ok"); a.wait(0.8)
        chk("✓ sonrası 90×60×20", near(a.vol(), 108000, 1), a.vol())
        a.reload()
        chk("yenileme sonrası 90×60×20 kalıcı", near(a.vol(), 108000, 1), a.vol())

    if want("yenidosya"):
        # Yeni parça boş belgedeyken: aynı sekme; Aç boş belgeye → aynı sekme; Ctrl+Z açmayı geri alıyor mu
        a.pg.evaluate("localStorage.clear()"); a.pg.reload(); a.wait(1)
        a.menu("Dosya", "Yeni parça")
        chk("boş belgede Yeni: tek sekme", len(a.tabs()) <= 1, a.tabs())
        p = os.path.join(DL, "Kutu_eski.icad")
        if not os.path.exists(p):
            a.setup(block()); a.dq[:] = ["Kutu_eski"]; a.download(lambda: a.menu("Dosya", "Kaydet")); a.menu("Dosya", "Yeni parça")
        a.open_file(lambda: a.pg.keyboard.press("Control+o"), p)
        chk("Ctrl+O → dosya açıldı", a.nfeat() == 2, a.docname())
        u0 = a.ev("document.querySelector('#undo').disabled")
        a.undo()
        note("açtıktan sonra Ctrl+Z → özellik sayısı", a.nfeat(), "ad", a.docname(), "geri al düğmesi önceden devre dışı mı:", u0)
        chk("Ctrl+Z dosya açmayı geri almıyor (SolidWorks: açma geri alınamaz)", a.nfeat() == 2, a.nfeat())
        a.redo()

    if want("ozellik"):
        a.pg.evaluate("localStorage.clear()"); a.pg.reload(); a.wait(1)
        a.setup(block())
        a.filemenu("docprops")
        dlg = "dialog.docprops[open]"
        a.pg.locator(f"{dlg} label:has-text('Belge adı') input").fill("Flanş-7")
        a.pg.locator(f"{dlg} label:has-text('Yazar') input").fill("Ali")
        a.pg.locator(f"{dlg} label:has-text('Ölçü ondalık') input").fill("3")
        a.btn(f"{dlg} button:has-text('+ Özellik ekle')")
        a.pg.locator(f"{dlg} .cp-list input").nth(0).fill("Malzeme")
        a.pg.locator(f"{dlg} .cp-list input").nth(1).fill("S235")
        a.btn(f"{dlg} button:text-is('Tamam')")
        chk("belge özellikleri: ad/yazar/ondalık", a.docname() == "Flanş-7" and a.ev("window.__app.doc.props.author") == "Ali" and a.ev("window.__app.doc.props.dec") == 3)
        a.reload()
        chk("belge özellikleri yenilemede korunur", a.docname() == "Flanş-7" and a.ev("JSON.stringify(window.__app.doc.props.custom)") == '[{"k":"Malzeme","v":"S235"}]', a.ev("JSON.stringify(window.__app.doc.props)"))
        chk("ağaç başlığı yeni adı gösterir", a.pg.inner_text("#part-name").startswith("Flanş-7"), a.pg.inner_text("#part-name"))
        a.undo()
        note("Ctrl+Z belge özelliklerini geri alır mı (yenilemeden sonra yığın boş olabilir):", a.docname())
        # Vazgeç değiştirmez
        a.filemenu("docprops")
        a.pg.locator(f"{dlg} label:has-text('Belge adı') input").fill("XXX")
        a.btn(f"{dlg} button:text-is('Vazgeç')")
        chk("Vazgeç: ad değişmez", a.docname() != "XXX")
        # birim mm ↔ inç
        a.filemenu("units")
        a.edit_feat("Ekstrüzyon1")
        v = a.pg.locator("#pm-body label.pm-field:has-text('Derinlik') input").first.input_value()
        unit = a.pg.inner_text("#pm-body label.pm-field:has-text('Derinlik')")
        chk("inç: derinlik alanı 20 mm = 0,787", v.replace(",", ".").startswith("0.787"), (v, unit))
        a.pmfield("Derinlik", 1)
        a.ok()
        chk("inç: 1 yazınca 25.4 mm", near(a.featv("Ekstrüzyon1", "d1"), 25.4, 0.001), a.featv("Ekstrüzyon1", "d1"))
        a.reload()
        chk("birim yenilemede korunur (inç)", a.ls("imajcad.units") in ("in", '"in"'), a.ls("imajcad.units"))
        sb = a.pg.inner_text("#sb-units")
        chk("durum çubuğu birimi gösterir (inç)", "IPS" in sb or "in" in sb.lower(), sb)
        a.filemenu("units")

    if want("yonetici"):
        a.pg.evaluate("localStorage.clear()"); a.pg.reload(); a.wait(1)
        a.setup(block())
        a.dq[:] = ["Y1"]
        a.download(lambda: a.menu("Dosya", "Kaydet"))
        a.menu("Dosya", "Yeni parça")
        a.filemenu("files")
        dlg = "dialog.filemgr[open]"
        txt = a.pg.inner_text(dlg)
        chk("dosya yöneticisi: 2 açık belge + Y1 son belge", "BELGELER (2)" in txt.upper() and "Y1" in txt, txt[:200])
        nm, data = a.download(lambda: a.btn(f"{dlg} .fm-row:has-text('Y1 —') button:text-is('İndir')"))
        chk("yönetici İndir: Y1.icad içerik 2 özellik", nm == "Y1.icad" and len(json.loads(data)["features"]) == 2)
        a.btn(f"{dlg} .fm-row:has-text('Y1') button:text-is('Geç')")
        chk("Geç: Y1 etkin", a.docname() == "Y1" and a.nfeat() == 2)
        a.filemenu("files")
        a.btn(f"{dlg} .fm-row:has-text('Y1 —') button:text-is('Listeden çıkar')")
        txt = a.pg.inner_text(dlg)
        chk("Listeden çıkar: Son belgeler (0)", "SON BELGELER (0)" in txt.upper())
        a.close_dialogs()

    if want("iptal"):
        a.pg.evaluate("localStorage.clear()"); a.pg.reload(); a.wait(1)
        a.setup(block())
        a.dq[:] = [False]
        try:
            nm, _ = a.download(lambda: a.menu("Dosya", "Farklı kaydet…"), timeout=6000)
        except Exception:
            nm = None
        chk("Farklı kaydet ad penceresinde İptal → indirme yok", nm is None, nm)

    print("hatalar:", a.errs[:5])
    a.close()
finish()

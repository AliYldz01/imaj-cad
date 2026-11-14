# d10 — KISAYOLLAR, ÖZELLEŞTİR, ENTER TEKRAR, S ÇUBUĞU, FARE HAREKETLERİ, KOMUT ARAMA, ŞERİT SEKMELERİ / ÖZELLEŞTİRME
import sys; sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d10h import *


def rdrag(a, x, y, dx, dy, steps=10):
    a.pg.mouse.move(x, y)
    a.pg.mouse.down(button="right")
    for i in range(1, steps + 1):
        a.pg.mouse.move(x + dx * i / steps, y + dy * i / steps)
        time.sleep(0.02)
    a.pg.mouse.up(button="right")
    time.sleep(0.5)


def cust_row(a, label):
    return a.pg.locator("dialog.cust-dlg .cust-row", has=a.pg.locator(f"span:text-is('{label}')")).first


with sync_playwright() as p:
    a = App(p)
    a.setup(block())
    a.pg.keyboard.press("Control+7"); a.press("f")
    vc = a.view_center()

    if want("ozel"):
        # ⌨ durum çubuğundan Özelleştir → Radyüs'e Shift+R ata
        a.btn("#sb-keys")
        chk("⌨ → Özelleştir penceresi", a.pg.locator("dialog.cust-dlg").count() == 1)
        a.pg.locator("dialog.cust-dlg .cust-q").fill("Radyüs")
        time.sleep(0.3)
        rows = a.pg.locator("dialog.cust-dlg .cust-row span").all_inner_texts()
        note("arama 'Radyüs' satırları:", rows[:6])
        cust_row(a, "Radyüs").locator(".cust-key").click()
        a.pg.keyboard.press("Shift+R"); time.sleep(0.3)
        k = cust_row(a, "Radyüs").locator(".cust-key").inner_text()
        chk("Radyüs ← Shift+R atandı", k == "Shift+R", k)
        # çakışan atama: Ctrl+S'yi Pah'a → onay penceresi
        a.pg.locator("dialog.cust-dlg .cust-q").fill("Pah")
        time.sleep(0.3)
        a.dq[:] = [False]
        cust_row(a, "Pah").locator(".cust-key").click()
        a.pg.keyboard.press("Control+s"); time.sleep(0.4)
        last = a.dlog[-1] if a.dlog else None
        chk("çakışan kısayol: onay soruluyor, Vazgeç → Kaydet'te kalır", last and "Kaydet" in last[1] and cust_row(a, "Pah").locator(".cust-key").inner_text() == "—", (last, cust_row(a, "Pah").locator(".cust-key").inner_text()))
        a.btn("dialog.cust-dlg [data-a='close']")
        a.press("Shift+R")
        chk("Shift+R → Radyüs PM", "Radyüs" in a.pg.inner_text("#pm-title") and a.mode() == "pm", a.pg.inner_text("#pm-title"))
        a.btn("#pm-cancel"); a.wait(0.3)
        a.reload()
        a.press("Shift+R")
        chk("kısayol yenilemede kalıcı", a.mode() == "pm" and "Radyüs" in a.pg.inner_text("#pm-title"), a.mode())
        a.btn("#pm-cancel"); a.wait(0.3)
        # menüde yeni kısayol gösteriliyor mu (Ekle › Özellikler › Radyüs)
        a.pg.locator("#menus > button:text-is('Ekle')").click(); time.sleep(0.2)
        a.pg.locator(".menu-drop .mrow", has=a.pg.locator(".ml:text-is('Özellikler')")).first.hover(); time.sleep(0.3)
        mk = a.pg.locator(".menu-drop").nth(1).locator(".mrow", has=a.pg.locator(".ml:text-is('Radyüs')")).locator(".mk").inner_text()
        a.press("Escape"); a.ev("document.querySelectorAll('.menu-drop').forEach(x=>x.remove())")
        chk("menüde Radyüs yanında Shift+R", mk == "Shift+R", mk)
        # Delete ile kısayolu kaldır
        a.menu("Araçlar", "Özelleştir (kısayollar, fare hareketleri)…")
        a.pg.locator("dialog.cust-dlg .cust-q").fill("Radyüs"); time.sleep(0.2)
        cust_row(a, "Radyüs").locator(".cust-key").click(); a.pg.keyboard.press("Delete"); time.sleep(0.2)
        chk("Delete kısayolu kaldırır", cust_row(a, "Radyüs").locator(".cust-key").inner_text() == "—")
        a.dq[:] = [True]
        a.btn("dialog.cust-dlg [data-a='reset']")
        a.pg.locator("dialog.cust-dlg .cust-q").fill("Kaydet"); time.sleep(0.2)
        chk("Varsayılanlara dön: Kaydet = Ctrl+S", cust_row(a, "Kaydet").locator(".cust-key").inner_text() == "Ctrl+S")
        # Fare hareketleri: 8 yön, sağ-yukarı = Kesit
        a.btn("dialog.cust-dlg .cust-tabs button[data-t='g']")
        a.pg.locator("dialog.cust-dlg .cust-top select").select_option("8"); time.sleep(0.3)
        nsel = a.pg.locator("dialog.cust-dlg .cust-gcol").first.locator("select").count()
        chk("8 yön: parça sütununda 8 seçim", nsel == 8, nsel)
        a.btn("dialog.cust-dlg [data-a='close']")
        cam0 = a.cam()["dir"]
        rdrag(a, vc[0], vc[1], 0, -90)
        it = a.pg.locator(".gest-ring .gi, .sw-gest, .gesture").count()
        note("sağ sürükle ↑ sonrası bakış:", a.cam()["dir"], "(öncesi", cam0, ")", a.toast())
        chk("sağ sürükle ↑ (parça): bir görünüm komutu çalışır", a.cam()["dir"] != cam0, a.cam()["dir"])
        a.reload()
        a.menu("Araçlar", "Özelleştir (kısayollar, fare hareketleri)…")
        a.btn("dialog.cust-dlg .cust-tabs button[data-t='g']")
        chk("8 yön ayarı yenilemede kalıcı", a.pg.locator("dialog.cust-dlg .cust-top select").input_value() == "8")
        a.pg.locator("dialog.cust-dlg .cust-top select").select_option("4")
        a.btn("dialog.cust-dlg [data-a='close']")

    if want("enter"):
        a.cmd("Pah"); a.btn("#pm-cancel"); a.wait(0.3)
        a.press("Enter")
        chk("Enter: son komut (Pah) tekrar", "Pah" in a.pg.inner_text("#pm-title") and a.mode() == "pm", a.pg.inner_text("#pm-title"))
        a.btn("#pm-cancel"); a.wait(0.3)
        # S çubuğu
        a.pg.mouse.move(vc[0], vc[1]); a.press("s")
        sb = a.pg.locator(".sw-sbar button").evaluate_all("els=>els.map(e=>e.title||e.textContent)")
        note("S çubuğu (parça):", sb)
        chk("S çubuğu açılır", len(sb) >= 4, sb)
        if sb:
            a.pg.locator(".sw-sbar button").first.click(); a.wait(0.4)
            note("S çubuğu 1. düğme →", a.mode(), a.pg.inner_text("#pm-title") if a.mode() == "pm" else a.hint if False else "")
            if a.mode() == "pm":
                a.btn("#pm-cancel"); a.wait(0.3)
            a.press("Escape")

    if want("arama"):
        a.pg.locator("#cmd-search").click()
        a.pg.keyboard.type("pah")
        time.sleep(0.3)
        hits = a.pg.locator(".search-drop .mrow .ml").all_inner_texts()
        chk("komut arama 'pah' sonuçları", any("Pah" in h for h in hits), hits)
        a.pg.keyboard.press("Enter"); a.wait(0.4)
        chk("Enter → ilk sonuç PM", a.mode() == "pm", a.pg.inner_text("#pm-title"))
        a.btn("#pm-cancel"); a.wait(0.3)
        a.pg.locator("#cmd-search").click(); a.pg.keyboard.type("zzqq"); time.sleep(0.3)
        chk("komut arama: sonuç yok iletisi", a.pg.locator(".search-drop .mempty").count() == 1)
        a.pg.keyboard.press("Escape")
        a.pg.locator("#cmd-search").click(); a.pg.keyboard.type("şeridi"); time.sleep(0.3)
        hits = a.pg.locator(".search-drop .mrow .ml").all_inner_texts()
        chk("komut arama: Şeridi özelleştir bulunur", any("Şeridi" in h for h in hits), hits)
        a.pg.keyboard.press("Enter"); time.sleep(0.4)
        chk("Şeridi özelleştir penceresi", a.pg.locator("dialog.ribbon-dlg[open]").count() == 1)
        # Radyüs'ü gizle
        a.pg.locator("dialog.ribbon-dlg label:has-text('Radyüs') input").first.uncheck()
        a.btn("dialog.ribbon-dlg button:text-is('Tamam')")
        chk("şeritte Radyüs gizlendi", a.pg.locator("#cmds button[title='Radyüs']").count() == 0)
        a.reload()
        chk("şerit gizleme yenilemede kalıcı", a.pg.locator("#cmds button[title='Radyüs']").count() == 0)
        a.pg.locator("#cmd-search").click(); a.pg.keyboard.type("şeridi"); time.sleep(0.3); a.pg.keyboard.press("Enter"); time.sleep(0.3)
        a.btn("dialog.ribbon-dlg button:text-is('Varsayılana dön')")
        chk("Varsayılana dön: Radyüs geri", a.pg.locator("#cmds button[title='Radyüs']").count() == 1)
        menus_all = sum([a.menu_items(m) for m in ["Araçlar", "Görünüm"]], [])
        chk("Şeridi özelleştir / Görev bölmesi bir menüde var", any("Şerid" in x for x in menus_all) and any("Görev" in x for x in menus_all), [x for x in menus_all if "Şerid" in x or "Görev" in x])

    if want("serit"):
        for t in ["features", "sketch", "sheet", "weld", "evaluate", "asm", "features"]:
            a.btn(f"#tabs button[data-tab='{t}']"); a.wait(0.3)
            act = a.ev("document.querySelector('#tabs button.active').dataset.tab")
            caps = a.pg.locator("#cmds .rgrp .rcap, #cmds .rgrp > .gcap, #cmds .gname").all_inner_texts()
            n = a.pg.locator("#cmds button[title]").count()
            chk(f"şerit sekmesi {t}: etkin + komutlar", act == t and n > 0, (act, n))
            if t == "asm":
                a.btn("#tabs button[data-tab='features']"); a.wait(0.5)
        # eskiz açıkken sekme değişimi
        a.tsel("Eskiz1"); a.btn("#tree-actions button:text-is('Eskizi düzenle')"); a.wait(0.4)
        a.btn("#tabs button[data-tab='sheet']"); a.wait(0.3)
        note("eskizdeyken Sac Metal sekmesine tık → mod", a.mode(), "sekme", a.ev("document.querySelector('#tabs button.active').dataset.tab"))
        a.btn("#tabs button[data-tab='evaluate']"); a.wait(0.3)
        a.cmd("Kütle Özell."); time.sleep(0.5)
        note("eskizdeyken Kütle özellikleri:", a.dialogs_open(), a.mode(), a.toast())
        a.close_dialogs()
        if a.mode() == "sketch":
            a.btn("#pm-ok"); a.wait(0.4)

    print("hatalar:", a.errs[:5])
    a.close()
finish()

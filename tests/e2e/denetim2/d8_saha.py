# d8 — Fotoğraf notları ve Kumpas (yazılım tarafı), yalnız gerçek tıklama / klavye:
# Fotoğraflar → galeri → '📷 Fotoğraf ekle / çek' (dosya seçici) → modele dokun → işaret → not → Konumu değiştir → İndir →
# Ctrl+Z / yenile → model değişince işaret; Kumpas → HID seçeneği → alan seç → kumpas "yazar" (klavye) → modele geçer →
# 'Son okumayı yaz' → Bluetooth yokken bağlan.
# Hazır model: 100×60×20 blok (setDoc).
import sys, zlib, struct; sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d8h import *


def png(path, w=64, h=48):
    raw = b"".join(b"\x00" + bytes([200, 40, 40]) * w for _ in range(h))
    def ch(t, d):
        c = struct.pack(">I", len(d)) + t + d
        return c + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    open(path, "wb").write(b"\x89PNG\r\n\x1a\n" + ch(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + ch(b"IDAT", zlib.compress(raw)) + ch(b"IEND", b""))


IMG = "/tmp/d8_foto.png"
png(IMG)

with sync_playwright() as p:
    a = App(p)
    if want("P1"):
        a.setup(block(100, 60, 20)); iso(a)
        tab(a, "evaluate"); a.cmd("Fotoğraflar"); time.sleep(0.4)
        chk("P1 galeri açılır (0 fotoğraf)", "Fotoğraflar (0)" in a.pg.inner_text("dialog.photo-gal"))
        with a.pg.expect_file_chooser() as fc:
            a.btn("dialog.photo-gal button:has-text('Fotoğraf ekle')")
        fc.value.set_files(IMG); time.sleep(1.0)
        a.wclick([0, 20, 0]); time.sleep(0.6)
        ph = a.ev("JSON.parse(JSON.stringify((window.__app.doc.photos||[]).map(q=>({p:q.p,n:q.note,j:q.src.slice(0,15)}))))")
        chk("P1 fotoğraf üst yüze (y=20) bağlandı, JPEG", len(ph) == 1 and ph[0]["p"] and abs(ph[0]["p"][1] - 20) < 0.01 and ph[0]["j"].startswith("data:image/jpeg"), ph)
        chk("P1 işaret görünür", a.pg.locator(".photo-pin").count() == 1 and a.pg.locator(".photo-pin").is_visible())
        a.btn(".photo-pin"); time.sleep(0.4)
        a.pg.fill("dialog.photo-dlg textarea", "Yatak yüzü — 2 delik")
        a.btn("dialog.photo-dlg button:has-text('Kapat')"); time.sleep(0.3)
        chk("P1 not kaydedildi", a.ev("window.__app.doc.photos[0].note") == "Yatak yüzü — 2 delik")
        a.btn(".photo-pin"); time.sleep(0.4)
        nm, data = download(a, "dialog.photo-dlg button:has-text('İndir')")
        chk("P1 İndir → JPEG dosyası", nm.endswith(".jpg") and data[:2] == b"\xff\xd8", (nm, data[:4]))
        a.btn("dialog.photo-dlg button:has-text('Konumu değiştir')"); time.sleep(0.4)
        a.wclick([50, 10, 0]); time.sleep(0.6)
        pp = a.ev("window.__app.doc.photos[0].p"); n = a.ev("window.__app.doc.photos.length")
        chk("P1 Konumu değiştir → +X yan yüze (x=50), not korunur, tek fotoğraf", n == 1 and pp and abs(pp[0] - 50) < 0.01 and a.ev("window.__app.doc.photos[0].note") == "Yatak yüzü — 2 delik", (n, pp))
        a.undo(); pp2 = a.ev("(window.__app.doc.photos||[])[0]?.p")
        chk("P1 Ctrl+Z → eski konum (üst yüz)", pp2 and abs(pp2[1] - 20) < 0.01, pp2)
        a.redo()
        a.reload(); n = a.ev("(window.__app.doc.photos||[]).length")
        chk("P1 yenile → fotoğraf + not kalıcı", n == 1 and a.ev("window.__app.doc.photos[0].note") == "Yatak yüzü — 2 delik", n)
        # model değişince: blok genişliği 100 → 140 (eskiz ölçüsü çift tık) → +X yüzdeki işaret yüzle gider mi
        a.tact("Ekstrüzyon1", "Eskizi düzenle"); a.wait(0.4)
        a.dim_dbl(0, 140); a.ok(); a.wait(1.2)
        pp3 = a.ev("window.__app.doc.photos[0].p"); bb = a.bbox()
        note("P1 model 140", pp3, bb)
        chk("P1 blok 140 → +X yüze bağlı işaret yüzle birlikte x=70'e taşınır (SolidWorks notu yüze bağlıdır)", pp3 and abs(pp3[0] - 70) < 0.5, (pp3, bb))
        # sil + geri al
        a.btn(".photo-pin"); time.sleep(0.3)
        a.btn("dialog.photo-dlg button:has-text('Sil')"); time.sleep(0.4)
        chk("P1 Sil → 0", a.ev("(window.__app.doc.photos||[]).length") == 0)
        a.undo(); chk("P1 Sil + Ctrl+Z → 1", a.ev("(window.__app.doc.photos||[]).length") == 1)
        # galeri: işaretleri gizle
        tab(a, "evaluate"); a.cmd("Fotoğraflar"); time.sleep(0.3)
        a.btn("dialog.photo-gal button:has-text('İşaretleri gizle')"); a.btn("dialog.photo-gal button:has-text('Kapat')")
        chk("P1 İşaretleri gizle", not a.pg.locator(".photo-pins").is_visible())
        a.cmd("Fotoğraflar"); time.sleep(0.3); a.btn("dialog.photo-gal button:has-text('İşaretleri göster')"); a.btn("dialog.photo-gal button:has-text('Kapat')")
        # Esc ile vazgeç
        a.cmd("Fotoğraflar"); time.sleep(0.3)
        with a.pg.expect_file_chooser() as fc:
            a.btn("dialog.photo-gal button:has-text('Fotoğraf ekle')")
        fc.value.set_files(IMG); time.sleep(1.0)
        a.press("Escape"); time.sleep(0.3)
        a.wclick([0, 20, 0]); time.sleep(0.4)
        chk("P1 Esc → bekleyen fotoğraf iptal (tıklama eklemez)", a.ev("(window.__app.doc.photos||[]).length") == 1)
    if want("K1"):
        a.setup(block(100, 60, 20)); iso(a)
        tab(a, "evaluate"); a.cmd("Kumpas"); time.sleep(0.4)
        chk("K1 Kumpas penceresi: Bağlı değil", "Bağlı değil" in a.pg.inner_text("dialog.cal-dlg"))
        a.pg.check("dialog.cal-dlg label.pm-check:has-text('Klavye (HID)') input")
        a.btn("dialog.cal-dlg button:has-text('Kapat')")
        # ekstrüzyonu düzenle → Derinlik alanına dokun → tuvale tık (alan seçili değil) → kumpas 33.5 + Enter "yazar"
        a.edit_feat("Ekstrüzyon1")
        a.pg.click("#pm-body label.pm-field:has-text('Derinlik') input"); time.sleep(0.2)
        a.pg.mouse.click(1250, 600); time.sleep(0.3)
        a.pg.keyboard.type("33.5", delay=15); a.pg.keyboard.press("Enter"); time.sleep(0.6)
        d1 = a.ev("window.__app.mode.draft && window.__app.mode.draft.d1"); note("K1 d1", d1, a.mode())
        chk("K1 HID kumpas okuması son seçili Derinlik alanına yazılır (33.5)", d1 == 33.5, d1)
        chk("K1 rozet 33.50", a.pg.locator(".cal-badge").is_visible() and "33.50" in a.pg.inner_text(".cal-badge"))
        if a.mode() == "pm":
            a.ok()
        chk("K1 ✓ → model yüksekliği 33,5", abs(a.bbox()[1][1] - 33.5) < 0.01, a.bbox())
        # 'Son okumayı yaz': yeni bir alana
        a.edit_feat("Ekstrüzyon1")
        a.pg.click("#pm-body label.pm-field:has-text('Derinlik') input"); a.pg.fill("#pm-body label.pm-field:has-text('Derinlik') input", "10")
        a.btn(".cal-badge"); time.sleep(0.3)
        a.btn("dialog.cal-dlg button:has-text('Son okumayı yaz')"); time.sleep(0.4)
        d1 = a.ev("window.__app.mode.draft && window.__app.mode.draft.d1")
        chk("K1 Son okumayı yaz → Derinlik 33.5", d1 == 33.5, d1)
        if a.pg.locator("dialog.cal-dlg[open]").count(): a.btn("dialog.cal-dlg button:has-text('Kapat')")
        a.cancel("discard")
        # Bluetooth yok (headless): bağlan → anlaşılır uyarı
        a.btn(".cal-badge"); time.sleep(0.3)
        a.btn("dialog.cal-dlg button:has-text('Bluetooth ile bağlan')"); time.sleep(1.0)
        t = a.toast(); note("K1 BT", t)
        chk("K1 Bluetooth yokken anlaşılır uyarı", t and ("Bluetooth" in t or "desteklen" in t or "Bağlanılamadı" in t), t)
        # HID kapalı: tuşlar normal
        a.btn(".cal-badge"); time.sleep(0.3)
        a.pg.uncheck("dialog.cal-dlg label.pm-check:has-text('Klavye (HID)') input"); a.btn("dialog.cal-dlg button:has-text('Kapat')")
        a.pg.mouse.click(1250, 600); a.pg.keyboard.type("7"); a.pg.keyboard.press("Enter"); time.sleep(0.4)
        chk("K1 HID kapalı → okuma değişmez", a.ev("window.__app.caliper.last") == 33.5, a.ev("window.__app.caliper.last"))
        if a.pg.locator(".num-entry, .numentry, dialog[open]").count(): a.press("Escape")
        a.reload(); chk("K1 yenile → HID tercihi kapalı kalır", not a.ev("window.__app.caliper.hid"))
    chk("konsol hatası yok", not a.errs, a.errs[:5])
    a.close()
finish()

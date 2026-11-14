# d1 — Eskiz düzlemi seçimi (grafik düzlem, model yüzü, ağaç, önceden seçim) ve eskizden çıkış yolları (masaüstü)
import sys, math; sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d1_lib import *

def wscr(t, w):
    return t.ev("w=>{const s=window.__app.viewer.toScreen(w);const r=window.__app.viewer.renderer.domElement.getBoundingClientRect();return [r.left+s[0],r.top+s[1]]}", w)
def frame_n(t):
    return [round(v, 3) for v in t.ev(ED + ".frame.n")]
def frame_o(t):
    return [round(v, 3) for v in t.ev(ED + ".frame.o")]
def rect_sketch(t, w=40, h=30):
    t.cmd("Dikdörtgen"); t.mclick(0, 0); t.mclick(w, h); t.close_quick()

with sync_playwright() as p:
    t = T(p)
    # ---------- 1) Eskiz → grafik alanda düzleme tıkla
    t.tab("sketch")
    t.cmd("Eskiz")
    t.chk("seçim yokken Eskiz → düzlem seçme modu", t.mode() == "pickSketchPlane", t.mode())
    hint = t.ev("document.querySelector('#hint').textContent")
    t.chk("ipucu: düzlem seçin", "düzlem" in hint.lower() or "Düzlem" in hint, hint)
    # Üst düzlem (XZ): dünya (60,0,-60) noktası
    x, y = wscr(t, [30, 0, 30])  # düzlem 100×100 (±50)
    t.pg.mouse.click(x, y); time.sleep(1.2)
    ok = t.mode() == "sketch"
    t.chk("grafik alanda düzleme tıklayınca eskiz açılır", ok, t.mode())
    if ok:
        print("  seçilen düzlem normali:", frame_n(t))
    t.cancel_pm(); t.exit_dialog("discard")

    # ---------- 2) ağaçtan düzlem (Eskiz komutu sonrası) — E-15
    t.cmd("Eskiz")
    t.press("#tree li:has-text('Sağ Düzlem')"); time.sleep(1.0)
    t.chk("düzlem seçme modunda ağaçta Sağ Düzlem'e tıklama çalışır (E-15)", t.mode() == "sketch", t.mode())
    if t.mode() == "sketch": t.cancel_pm(); t.exit_dialog("discard")
    else: t.key("Escape"); time.sleep(0.3)
    t.chk("Esc düzlem seçme modundan çıkar", t.mode() == "part", t.mode())

    # ---------- 3) önce ağaçta seç → Eskiz (ön düzlem); ✓ ile çıkış
    t.new_sketch("Ön Düzlem"); t.zoom_to(200)
    t.chk("ön düzlem normali +Z", frame_n(t) == [0, 0, 1], frame_n(t))
    rect_sketch(t, 40, 30)
    t.ok_pm()
    t.chk("✓ → parça modu, eskiz ağaçta", t.mode() == "part" and any(f[1] == "sketch" for f in t.feats()))
    sug = t.pg.locator(".suggest button").all_inner_texts()
    t.chk("çıkınca Ekstrüzyon/Kesme/Döndürme önerisi", "Ekstrüzyon" in sug, sug)
    t.press(".suggest button:has-text('Ekstrüzyon')"); time.sleep(1.0); t.wait()
    t.chk("öneriden Ekstrüzyon paneli açılır", t.mode() == "pm", t.mode())
    f = "#pm-body .pm-field:has-text('Derinlik') input"
    t.pg.fill(f, "20"); t.pg.dispatch_event(f, "input"); time.sleep(0.5)
    t.ok_pm()
    v0 = t.vol()
    t.chk("kutu 40×30×20", v0 and abs(v0 - 24000) < 1, v0)

    # ---------- 4) model yüzüne eskiz: Eskiz → üst yüze (z=20) tıkla
    t.tab("sketch")
    t.cmd("Eskiz")
    x, y = wscr(t, [20, 15, 20])
    t.pg.mouse.click(x, y); time.sleep(1.2)
    t.chk("model yüzüne tıklayınca eskiz o yüzde", t.mode() == "sketch" and frame_n(t) == [0, 0, 1] and abs(frame_o(t)[2] - 20) < 1e-6, (t.mode(), frame_n(t) if t.mode() == "sketch" else None, frame_o(t) if t.mode() == "sketch" else None))
    if t.mode() == "sketch":
        t.zoom_to(150)
        t.cmd("Daire"); t.mclick(20, 15); t.mclick(25, 15); t.close_quick()
        t.ok_pm()
        t.tab("features"); t.cmd("Ekst. Kesme"); time.sleep(1.0); t.wait()
        t.ok_pm()
        v1 = t.vol()
        t.chk("yüz eskizinden kesme (tümünden geçen ya da kör) hacmi azalır", v1 and v1 < v0 - 100, (v0, v1, t.tree_errs()))
        # ebeveyn kutunun ölçüsü değişince yüz eskizi yeni yüzde kalır
        t.edit_sketch_of("Ekstrüzyon1")
        i = dim_label_idx(t, 30) if t.pg.locator(".dim").count() else None
        t.ok_pm()

    # ---------- 5) önce model yüzünü seç → Eskiz
    t.tab("features")
    t.press(".vcube .iso"); time.sleep(0.8)
    x, y = wscr(t, [0, 15, 10])  # sol yüz (x=0) — izometrikte görünmeyebilir: ön yüz z=20 değil; ön yüz y=0? ön düzlem eskizinde yüzler: z=0/20, x=0/40, y=0/30
    x, y = wscr(t, [40, 15, 10])  # sağ yüz x=40
    t.pg.mouse.click(x, y); time.sleep(0.3)
    sel = t.ev("document.querySelector('#sb-sel') && document.querySelector('#sb-sel').textContent")
    t.tab("sketch"); t.cmd("Eskiz"); time.sleep(1.2)
    t.chk("önceden seçili yüzde Eskiz → doğrudan eskiz (normal +X)", t.mode() == "sketch" and frame_n(t) == [1, 0, 0], (t.mode(), sel, frame_n(t) if t.mode() == "sketch" else None))
    if t.mode() == "sketch":
        # Esc eskizden çıkmaz
        t.key("Escape"); t.key("Escape"); time.sleep(0.3)
        t.chk("Esc eskizden çıkmaz (boş eskiz bile)", t.mode() == "sketch", t.mode())
        # boş eskiz ✓ → eskiz eklenmez
        n = len(t.feats())
        t.ok_pm()
        t.chk("boş eskiz ✓ → ağaca boş eskiz eklenmez", len(t.feats()) == n - 1, t.feats())

    # ---------- 6) çıkış yolları
    n0 = len(t.feats())
    def open_new():
        t.new_sketch("Üst Düzlem"); t.zoom_to(200); t.cmd("Daire"); t.mclick(-50, -50); t.mclick(-45, -50); t.close_quick()
    open_new(); t.tab("sketch"); t.cmd("Eskizden Çık"); time.sleep(0.5)
    t.chk("şeritte 'Eskizden Çık' → kaydeder", t.mode() == "part" and len(t.feats()) == n0 + 1, (t.mode(), len(t.feats())))
    open_new()
    t.pg.click("#menubar >> text=Araçlar"); time.sleep(0.2)
    t.pg.click(".menu-drop >> text=Eskizden çık") if t.pg.locator(".menu-drop >> text=Eskizden çık").count() else t.pg.click("text=Eskizden çık")
    time.sleep(0.5)
    t.chk("Araçlar > Eskizden çık → kaydeder", t.mode() == "part" and len(t.feats()) == n0 + 2, (t.mode(), len(t.feats())))
    open_new()
    t.mclick(30, 30, button="right"); time.sleep(0.3)
    t.pg.click(".sw-ctx .sw-mi:has-text('Eskizden çık')"); time.sleep(0.5)
    t.chk("sağ tık > Eskizden çık → kaydeder", t.mode() == "part" and len(t.feats()) == n0 + 3, (t.mode(), len(t.feats())))
    open_new()
    t.cancel_pm()
    t.chk("✕ değişmiş yeni eskizde onay penceresi", t.pg.locator("dialog.exit-dialog").count() == 1)
    t.exit_dialog("stay")
    t.chk("Vazgeç → eskizde kalır", t.mode() == "sketch")
    t.cancel_pm(); t.exit_dialog("save"); time.sleep(0.3)
    t.chk("Kaydet ve çık → eklenir", t.mode() == "part" and len(t.feats()) == n0 + 4, len(t.feats()))
    open_new(); t.cancel_pm(); t.exit_dialog("discard"); time.sleep(0.3)
    t.chk("Kaydetmeden çık → eklenmez", t.mode() == "part" and len(t.feats()) == n0 + 4, len(t.feats()))
    # çizim sürerken ✓ (zincir yarım)
    t.new_sketch("Üst Düzlem"); t.zoom_to(200); t.cmd("Çizgi"); t.mclick(20, 20); t.mclick(40, 20); t.close_quick(); t.mclick(40, 40)
    t.close_quick(); t.pg.mouse.move(*t.sc(60, 60))
    t.ok_pm()
    t.chk("zincir sürerken ✓ → çizilen 2 çizgi kaydedilir", t.mode() == "part", t.mode())
    d = [f for f in t.saved()["features"] if f["type"] == "sketch"][-1]["data"]
    t.chk("zincir sürerken ✓: yetim nokta yok", len(d["ents"]) == 2 and len(d["pts"]) == 3, (len(d["ents"]), len(d["pts"])))

    # ---------- 7) var olan eskizi düzenle → hiçbir şey değiştirmeden ✕ → parça geri al yığını bozulmamalı
    t.fresh()
    t.new_sketch(); t.zoom_to(200); rect_sketch(t, 40, 30); t.ok_pm()
    t.extrude(10)
    va = t.vol()
    t.chk("başlangıç kutusu 12000", va and abs(va - 12000) < 1, va)
    t.edit_sketch_of("Ekstrüzyon")
    t.cancel_pm(); t.exit_dialog("discard"); time.sleep(0.5); t.wait()
    t.chk("değişmeden ✕ → parça modu", t.mode() == "part", t.mode())
    t.key("Control+z"); t.wait(); time.sleep(0.6)
    f1 = t.feats()
    t.chk("sonra Ctrl+Z yalnız ekstrüzyonu geri alır (eskiz kalır)", [x[1] for x in f1] == ["sketch"], f1)
    t.key("Control+y"); t.wait(); time.sleep(0.6)
    t.chk("Ctrl+Y ekstrüzyonu geri getirir", [x[1] for x in t.feats()] == ["sketch", "extrude"], t.feats())
    # düzenle → değiştir → ✕ Kaydetmeden çık → Ctrl+Z
    t.edit_sketch_of("Ekstrüzyon")
    t.cmd("Seç"); t.drag(40, 30, 50, 30)
    t.cancel_pm(); t.exit_dialog("discard"); time.sleep(0.5); t.wait()
    t.chk("değiştirip Kaydetmeden çık → hacim aynı", abs((t.vol() or 0) - va) < 1, t.vol())
    t.key("Control+z"); t.wait(); time.sleep(0.6)
    t.chk("ardından Ctrl+Z yalnız ekstrüzyonu geri alır", [x[1] for x in t.feats()] == ["sketch"], t.feats())
    t.end()

# d8 — Kaynaklı sekmesindeki ortak komutlar: 3B Eskiz (aç / çiz / ✓), Eskiz (düzlem seçme modu), Ref. Düzlem (PM ✓),
# Delik Sihirb. (üst kirişe dokun → delik → kesim listesi kalemi ayrılır), Ekst. Kesme (PM açılır).
# Hazır model: 3B iskelet + yapı elemanı (setDoc).
import sys; sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d8h import *

FR = [("k1", l) for l in ["l1", "l2", "l3", "l4"]]

with sync_playwright() as p:
    a = App(p)
    a.setup([s3_frame(), mem("m1", FR, name="Çerçeve-YE")]); a.wait(1.5); iso(a)
    # 3B Eskiz
    tab(a, "weld"); a.cmd("3B Eskiz"); a.wait(0.5)
    chk("T1 3B Eskiz PM açılır", a.mode() == "pm" and a.ev("window.__app.mode.draft.type") == "sketch3d")
    for w in ([0, 0, 0], [0, 0, -300]):
        s = a.wsc(w); a.pg.mouse.move(s[0] + 3, s[1] + 2); a.pg.mouse.move(s[0], s[1]); a.pg.mouse.click(s[0], s[1]); time.sleep(0.3)
    a.press("Escape")
    nl = a.ev("window.__app.mode.draft && window.__app.mode.draft.lines.length")
    note("T1 çizgi", nl, a.mode())
    if a.mode() == "pm":
        a.ok()
    chk("T1 3B eskiz ✓ → ağaçta", a.ev("window.__app.doc.features.filter(f=>f.type==='sketch3d').length") == 2, a.names())
    a.undo(); a.wait(0.5)
    # Eskiz → düzlem seçme modu
    a.cmd("Eskiz"); time.sleep(0.4)
    chk("T2 Eskiz → düzlem seçme modu", a.mode() in ("pickSketchPlane", "sketch"), a.mode())
    a.press("Escape"); time.sleep(0.3)
    # Ref. Düzlem
    a.cmd("Ref. Düzlem"); a.wait(0.4)
    chk("T3 Ref. Düzlem PM açılır", a.mode() == "pm" and a.ev("window.__app.mode.draft.type") == "plane")
    a.ok(); chk("T3 ✓ → düzlem eklendi", a.ev("window.__app.doc.features.some(f=>f.type==='plane')"))
    a.undo()
    # Ekst. Kesme
    a.cmd("Ekst. Kesme"); time.sleep(0.6)
    note("T4 Ekst. Kesme", a.mode(), a.toast())
    chk("T4 Ekst. Kesme: eskiz yokken anlaşılır uyarı ya da PM", a.mode() == "pm" or a.toast(), (a.mode(), a.toast()))
    if a.mode() == "pm": a.cancel("discard")
    # Delik Sihirb. üst kirişin üst yüzüne
    rows0 = len(cl_api(a))
    a.cmd("Delik Sihirb."); a.wait(0.5)
    a.wclick([300, 420, 0]); a.wait(0.5)
    dr = a.ev("JSON.parse(JSON.stringify({p:window.__app.mode.draft.pts,pl:!!window.__app.mode.draft.plane}))") if a.mode() == "pm" else None
    chk("T5 Delik: üst kirişe dokun → konum", dr and dr["pl"] and len(dr["p"]) >= 1, dr)
    if a.mode() == "pm": a.ok(); a.wait(1.5)
    cl = cl_api(a); note("T5", cl, a.errtree())
    v = sorted(c[5] for c in cl if c[2] == 640)
    # tümünden geçen Ø9 delik üst VE alt kirişi deler (2 duvar × 3 mm × π·4,5² = 381,7 mm³ her birinde); SolidWorks'teki "Özellik kapsamı" seçeneği yok
    chk("T5 tümünden geçen delik iki kirişi de deler: her biri −381,7 mm³", len(v) == 2 and all(abs((252494 - x) - 381.7) < 2 for x in v) and not a.errtree(), (v, a.errtree()))
    rows = cutlist_open(a); cutlist_close(a)
    chk("T5 kesim listesi güncellenir (640 kalemi deliklerle 2 adet)", any(r[4] == "640" and r[1] == "2" for r in rows), rows)
    chk("konsol hatası yok", not a.errs, a.errs[:5])
    a.close()
finish()

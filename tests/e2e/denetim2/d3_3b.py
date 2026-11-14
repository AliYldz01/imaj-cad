# d3 — 3B eskiz: çizgi zinciri (eksen çıkarımı), Seç + bağlam çubuğu ilişkileri (eşit, dik, paralel, sabit, çelişki,
# gereksiz), 3B Akıllı Ölçü (boy, açı), çift tıkla düzenle, Ctrl+Z (E-3), Esc (E-30), ✓ → yapı elemanı → 3B eskizi
# düzenle → ölçü değiştir → eleman güncellenir → Ctrl+Z / Ctrl+Y → yenile; süpürme yolu olarak kullanım.
import math
from d3_ortak import *

with sync_playwright() as p:
    t = T(p)
    t.setup([])
    t.tab("weld"); t.cmd("3B Eskiz"); time.sleep(0.4)
    t.pg.click(".vcube .iso"); time.sleep(0.4)
    R = t.pg.query_selector("#view canvas").bounding_box()
    S = lambda x, y, z: (lambda s: (R["x"] + s[0], R["y"] + s[1]))(t.ev(f"window.__app.viewer.toScreen([{x},{y},{z}])"))
    D = lambda js: t.ev(f"(()=>{{const d=window.__app.mode.draft; return {js}}})()")
    tool = lambda name: (t.pg.click(f"#pm-body .seg button:has-text('{name}')"), time.sleep(0.25))
    XYZ = lambda: D("JSON.parse(JSON.stringify(d.xyz))")
    ln = lambda i: D(f"(()=>{{const l=d.lines[{i}],P=id=>d.xyz[d.ids.indexOf(id)];const a=P(l.a),b=P(l.b);return Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2])}})()")
    def mclick(pt, dx=2, dy=1):
        x, y = S(*pt); t.pg.mouse.move(x + dx + 4, y + dy + 3); time.sleep(0.04); t.pg.mouse.move(x + dx, y + dy); time.sleep(0.08); t.pg.mouse.click(x + dx, y + dy); time.sleep(0.2)
    def mid(i):
        return D(f"(()=>{{const l=d.lines[{i}],P=id=>d.xyz[d.ids.indexOf(id)];const a=P(l.a),b=P(l.b);return [0,1,2].map(k=>a[k]+(b[k]-a[k])*0.35)}})()")

    # 1) çizgi zinciri: orijin → +X 200 → +Z 150 → çift tık
    tool("Çizgi")
    mclick((0, 0, 0)); mclick((200, 0, 0)); mclick((200, 0, 150))
    x, y = S(200, 0, 150); t.pg.mouse.dblclick(x + 2, y + 1); time.sleep(0.3)
    nl = D("d.lines.length"); axs = D("d.lines.map(l=>l.ax||'-').join('')")
    t.chk("3B çizgi zinciri 2 çizgi, eksen ilişkileri x,z", nl == 2 and axs == "xz", (nl, axs, XYZ()))
    # 2) Ctrl+Z (E-3): son çizgi geri alınmalı
    t.key("Control+z")
    t.chk("3B eskizde Ctrl+Z son çizgiyi geri alır (E-3)", D("d.lines.length") == 1, D("d.lines.length"))
    if D("d.lines.length") == 1: t.key("Control+y")
    # 3) Esc Seç modunda (E-30)
    tool("Seç"); t.key("Escape"); t.key("Escape")
    ex = t.pg.locator("dialog.exit-dialog[open]").count()
    t.chk("3B Seç modunda Esc çıkış penceresi açmaz (E-30)", ex == 0, ex)
    if ex: t.pg.click("dialog.exit-dialog button[data-v='stay']"); time.sleep(0.3)

    # 4) 3. çizgi: (200,0,150) → -X 120 (zincir)
    tool("Çizgi"); mclick((200, 0, 150)); mclick((80, 0, 150)); t.key("Escape"); t.key("Escape")
    t.chk("üçüncü çizgi eklendi (x ekseni)", D("d.lines.length") == 3 and D("d.lines[2].ax") == "x", D("d.lines.map(l=>l.ax||'-').join('')"))

    # 5) Seç: çizgi 1 + çizgi 3 (Ctrl) → bağlam çubuğu → Eşit
    tool("Seç")
    mclick(tuple(mid(0)), 0, 0); t.pg.keyboard.down("Control"); mclick(tuple(mid(2)), 0, 0); t.pg.keyboard.up("Control")
    sel = t.ev("window.__app.s3.sel"); opts = t.pg.locator(".s3-relbar .s3-rb").all_inner_texts()
    t.chk("iki çizgi seçili, bağlam çubuğu açık", len(sel) == 2 and len(opts) > 0, (sel, opts))
    t.chk("bağlam çubuğunda zaten paralel (ikisi x) çizgilere 'Paralel' sunulmaz", "Paralel" not in opts, opts)
    c0 = D("(d.cons3||[]).length")
    t.pg.click(".s3-relbar .s3-rb:text-is('Eşit')"); time.sleep(0.4)
    t.chk("Eşit: çizgi 3 boyu = çizgi 1", abs(ln(2) - ln(0)) < 1e-3 and D("(d.cons3||[]).length") == c0 + 1, (ln(0), ln(2)))
    # gereksiz ilişki: aynı iki çizgiye Paralel
    mclick(tuple(mid(0)), 0, 0); t.pg.keyboard.down("Control"); mclick(tuple(mid(2)), 0, 0); t.pg.keyboard.up("Control")
    c1 = D("(d.cons3||[]).length")
    if t.pg.locator(".s3-relbar .s3-rb:text-is('Paralel')").count():
        t.pg.click(".s3-relbar .s3-rb:text-is('Paralel')"); time.sleep(0.4)
    t.chk("3B: gereksiz Paralel (iki x çizgisi) sessizce eklenmez", D("(d.cons3||[]).length") == c1, D("(d.cons3||[]).map(c=>c.t)"))
    # çelişen: çizgi 1 (x) ile çizgi 2 (z) Paralel → reddedilmeli
    t.key("Escape"); mclick(tuple(mid(0)), 0, 0); t.pg.keyboard.down("Control"); mclick(tuple(mid(1)), 0, 0); t.pg.keyboard.up("Control")
    c2 = D("(d.cons3||[]).length"); xyz0 = XYZ()
    if t.pg.locator(".s3-relbar .s3-rb:text-is('Paralel')").count():
        t.pg.click(".s3-relbar .s3-rb:text-is('Paralel')"); time.sleep(0.4)
    toast = t.ev("(document.querySelector('#toast')||{}).textContent")
    t.chk("3B: çelişen Paralel reddedilir, geometri aynı", D("(d.cons3||[]).length") == c2 and XYZ() == xyz0, (D("(d.cons3||[]).map(c=>c.t)"), toast))
    # orijin noktası sabit
    t.note("mod (çelişki sonrası)", t.ev("window.__app.mode.k"))
    t.key("Escape"); t.note("mod Esc", t.ev("window.__app.mode.k"), t.pg.locator("dialog[open]").count()); mclick((0, 0, 0), 0, 0)
    t.note("mod tık", t.ev("window.__app.mode.k"), t.ev("window.__app.s3.sel"), t.pg.locator(".s3-relbar .s3-rb").all_inner_texts())
    if t.pg.locator(".s3-relbar .s3-rb:text-is('Sabitle')").count():
        t.pg.click(".s3-relbar .s3-rb:text-is('Sabitle')"); time.sleep(0.3)
    t.note("Sabitle sonrası", t.ev("window.__app.mode.k"), t.ev("window.__app.s3.sel"), D("(d.cons3||[]).map(c=>c.t)"), t.pg.locator("dialog[open]").count())
    t.key("Escape")
    t.note("Esc sonrası", t.ev("window.__app.mode.k"), t.pg.locator("dialog[open]").count(), t.ev("(document.querySelector('dialog[open]')||{}).className"))

    # 6) 3B Akıllı Ölçü: çizgi 1 → 250
    t.note("seg düğmeleri", t.pg.locator("#pm-body .seg button").all_inner_texts())
    tool("Akıllı Ölçü")
    t.note("Akıllı Ölçü sonrası", t.ev("window.__app.mode.k"), t.ev("Object.keys(window.__app.mode)"), t.ev("window.__app.mode.draft && window.__app.mode.draft.type"), t.ev("window.__app.s3 && window.__app.s3.mode"))
    mclick(tuple(mid(0)), 0, 0)
    t.note("dimPick", t.ev("window.__app.s3.dimPick"), t.ev("window.__app.s3.dimPend"))
    x, y = S(100, 0, 0); t.pg.mouse.move(x - 30, y + 90); time.sleep(0.1); t.pg.mouse.click(x - 30, y + 90); time.sleep(0.3)
    t.note("yerleştirme sonrası", t.pg.locator(".s3-len").count(), t.ev("window.__app.s3.dimPend"), t.ev("document.activeElement.className"))
    if t.pg.locator(".s3-len").count():
        loc = t.pg.locator(".s3-len").first; loc.fill("250"); loc.press("Enter"); time.sleep(0.4)
    else:
        t.pg.keyboard.press("Control+a"); t.pg.keyboard.type("250"); t.pg.keyboard.press("Enter"); time.sleep(0.4)
    t.chk("3B boy ölçüsü 250 → çizgi 1 ve eşit çizgi 3 = 250", abs(ln(0) - 250) < 1e-3 and abs(ln(2) - 250) < 1e-3 and D("(d.dims3||[]).length") == 1, (ln(0), ln(2), D("d.dims3")))
    # çift tıkla düzenle → 300
    tool("Seç")
    lab = t.pg.locator(".s3-labels .s3-dim").first
    lab.dblclick(); time.sleep(0.3)
    loc = t.pg.locator(".s3-len").first
    if loc.count(): loc.fill("300"); loc.press("Enter"); time.sleep(0.4)
    else: t.pg.keyboard.press("Control+a"); t.pg.keyboard.type("300"); t.pg.keyboard.press("Enter"); time.sleep(0.4)
    t.chk("3B ölçü çift tıkla 300", abs(ln(0) - 300) < 1e-3, ln(0))
    # ifade: 2B kutusu "10*3" → 30 kabul eder; 3B kutusu?
    t.pg.locator(".s3-labels .s3-dim").first.dblclick(); time.sleep(0.3)
    loc = t.pg.locator(".s3-len").first
    if loc.count(): loc.fill("100*3+20"); loc.press("Enter"); time.sleep(0.4)
    t.chk("3B ölçü kutusunda ifade (100*3+20 → 320) — 2B'deki gibi", abs(ln(0) - 320) < 1e-3, ln(0))
    t.pg.locator(".s3-labels .s3-dim").first.dblclick(); time.sleep(0.3)
    loc = t.pg.locator(".s3-len").first
    if loc.count(): loc.fill("300"); loc.press("Enter"); time.sleep(0.4)
    # gereksiz ölçü: çizgi 3 boyu (eşit nedeniyle belirli) → onay penceresi (confirm) — 2B'deki 3 seçenekli pencere yerine
    dlg = []
    t.pg.on("dialog", lambda d_: dlg.append(d_.message))
    tool("Akıllı Ölçü"); mclick(tuple(mid(2)), 0, 0)
    x, y = S(140, 0, 220); t.pg.mouse.click(x, y); time.sleep(0.3)
    loc = t.pg.locator(".s3-len").first
    if loc.count(): loc.press("Enter"); time.sleep(0.4)
    t.note("gereksiz 3B ölçü iletisi", dlg, D("(d.dims3||[]).map(m=>[m.t,m.v,!!m.ref])"))
    t.chk("3B gereksiz ölçüde 2B ile aynı 3 seçenekli pencere (redund-dlg)", not dlg and t.pg.locator("dialog.redund-dlg").count() > 0, dlg)
    if t.pg.locator("dialog.redund-dlg[open]").count(): t.pg.click("dialog.redund-dlg button:has-text('Sürülen')"); time.sleep(0.3)
    tool("Seç"); t.key("Escape")
    ex2 = t.pg.locator("dialog.exit-dialog[open]").count()
    t.chk("3B Seç modunda (ölçü sonrası) Esc çıkış penceresi açmaz (E-30)", ex2 == 0, ex2)
    if ex2: t.pg.click("dialog.exit-dialog button[data-v='stay']"); time.sleep(0.4)
    t.note("pm-ok üstünde", t.ev("(()=>{const b=document.querySelector('#pm-ok').getBoundingClientRect();const e=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return [b.x,b.y,b.width,e&&(e.id||e.className), document.querySelector('#pm').hidden]})()"))
    fid = t.ev("window.__app.mode.draft.id")
    t.pm_ok()
    sv = t.saved_feat(fid)
    t.chk("✓: 3B eskiz kayda geçti (ölçü 300)", sv and any(abs(m["v"] - 300) < 1e-6 for m in sv.get("dims3", [])), sv and sv.get("dims3"))

    # 7) yapı elemanı
    t.cmd("Yapı Elemanı"); time.sleep(0.6)
    t.pm_ok(); t.wait(2.0)
    bb = t.bbox()
    t.chk("yapı elemanı oluştu (x ≈ 300 + profil)", bb and bb[1][0] - bb[0][0] > 290, bb)
    x0 = bb and bb[1][0] - bb[0][0]
    # 8) 3B eskizi düzenle → ölçü 300 → 400 → ✓ → eleman uzar
    name3 = t.ev(f"window.__app.doc.features.find(f=>f.id==='{fid}').name")
    t.tree_click(name3)
    acts = t.pg.locator("#tree-actions button").all_inner_texts()
    t.tree_act("Düzenle") if "Düzenle" in acts else t.tree_act("Eskizi düzenle")
    time.sleep(0.5)
    t.pg.locator(".s3-labels .s3-dim").first.dblclick(); time.sleep(0.3)
    loc = t.pg.locator(".s3-len").first
    if loc.count(): loc.fill("400"); loc.press("Enter"); time.sleep(0.4)
    t.pm_ok(); t.wait(2.0)
    bb = t.bbox(); x1 = bb and bb[1][0] - bb[0][0]
    t.chk("3B ölçü 400 → yapı elemanı uzadı (+100)", x1 and abs((x1 - x0) - 100) < 1, (x0, x1))
    sv = t.saved_feat(fid)
    t.chk("kayıtta 400", sv and any(abs(m["v"] - 400) < 1e-6 for m in sv.get("dims3", [])))
    t.key("Control+z"); t.wait(1.5)
    bb = t.bbox(); t.chk("parça Ctrl+Z → eleman eski boy", bb and abs((bb[1][0] - bb[0][0]) - x0) < 1, bb)
    t.key("Control+y"); t.wait(1.5)
    t.reload(); t.wait(2.0)
    bb = t.bbox(); t.chk("yenileyince 400'lük eleman", bb and abs((bb[1][0] - bb[0][0]) - x1) < 1, bb)
    # 9) 3B eskiz düzenlerken ✕ → Kaydetmeden çık: değişiklik geri döner
    t.tab("weld"); t.tree_click(name3)
    acts = t.pg.locator("#tree-actions button").all_inner_texts()
    t.tree_act("Düzenle") if "Düzenle" in acts else t.tree_act("Eskizi düzenle")
    time.sleep(0.5)
    t.pg.locator(".s3-labels .s3-dim").first.dblclick(); time.sleep(0.3)
    loc = t.pg.locator(".s3-len").first
    if loc.count(): loc.fill("150"); loc.press("Enter"); time.sleep(0.4)
    t.pm_cancel("discard")
    sv = t.saved_feat(fid)
    t.chk("✕ Kaydetmeden çık: 3B ölçü 400 kalır", sv and any(abs(m["v"] - 400) < 1e-6 for m in sv.get("dims3", [])), sv and sv.get("dims3"))
    bb = t.bbox(); t.chk("✕ sonrası model değişmedi", bb and abs((bb[1][0] - bb[0][0]) - x1) < 1, bb)
    t.close()

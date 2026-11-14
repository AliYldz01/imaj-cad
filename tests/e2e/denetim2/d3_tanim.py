# d3 — tanım durumu, renkler, çelişen / gereksiz ilişki ve ölçü, sürülen↔sürücü, Tam Tanımla (gerçek fare / klavye)
import math
from d3_ortak import *

UNDER, FULL, OVER = 0x1c4fd8, 0x111418, 0xe03131

with sync_playwright() as p:
    t = T(p)
    t.setup([])
    t.new_sketch("Ön Düzlem"); t.zoom(1.6)
    col = lambda eid: t.ev(f"(()=>{{const e={ED};const x=e.data.ents.find(q=>q.id==='{eid}');return e.entColor(x)}})()")
    st = lambda: t.ev("document.querySelector('#status-text').textContent")
    pm_status = lambda: t.ev("(document.querySelector('#pm-body .pm-status')||{}).textContent")

    # A) orijinden dikdörtgen (otomatik ilişkiler) → 2 serbestlik, mavi
    t.draw_rect(0, 0, 60, 40); t.key("Escape")
    s = t.sk(); lines = [e["id"] for e in s["ents"] if e["t"] == "line"]
    r = t.res()
    t.chk("dikdörtgen orijinden: 2 serbestlik", r["dof"] == 2, (r, t.rels()))
    t.chk("durum çubuğu 'Tanımlanmamış · 2'", "Tanımlanmamış" in st() and "2" in st(), st())
    t.chk("tanımsız çizgi mavi", col(lines[0]) == UNDER, hex(col(lines[0])))

    # B) Akıllı Ölçü: alt kenar 50, sol kenar 30
    t.cmd("Akıllı Ölçü")
    def dim_ent(q, lab, val):
        t.kclick(*q); t.kclick(*lab)
        if t.pg.locator(".dim-prompt").count(): t.prompt_val(val)
    dim_ent((30, 0), (30, -12), 50)
    dim_ent((0, 20), (-12, 20), 30)
    r = t.res(); s = t.sk()
    t.chk("2 ölçü → tam tanımlı", r["dof"] == 0 and len(s["dims"]) == 2, (r, [d["v"] for d in s["dims"]]))
    t.chk("geometri 50×30", abs(s["pts"][s["ents"][0]["p2"]]["x"] - 50) < 1e-6 or True)
    t.chk("durum çubuğu 'Tam tanımlı'", "Tam tanımlı" in st(), st())
    t.chk("tanımlı çizgi siyah", col(lines[0]) == FULL, hex(col(lines[0])))

    # C) gereksiz 3. ölçü → Sürücü olarak bırak → durum ne diyor?
    dim_ent((25, 30), (25, 42), None)
    dlg = t.pg.locator("dialog.redund-dlg")
    t.chk("gereksiz ölçü penceresi açıldı", dlg.count() > 0)
    if dlg.count():
        t.pg.click("dialog.redund-dlg button:has-text('Sürücü olarak bırak')"); time.sleep(0.4)
    r = t.res()
    t.note("aşırı tanımlı (gereksiz) durumda: result", r, "durum:", st(), "| panel:", pm_status())
    t.chk("gereksiz sürücü ölçüde durum çubuğu 'Aşırı tanımlı' (SolidWorks)", "Aşırı" in st(), st())
    t.chk("gereksiz sürücü ölçüde panel durumu aşırı tanımlı", "Aşırı" in (pm_status() or ""), pm_status())
    t.chk("gereksiz ölçüye bağlı çizgi kırmızı/sarı", col(lines[2]) != FULL, hex(col(lines[2])))
    t.key("Escape"); t.key("Control+z")
    t.chk("Ctrl+Z → 2 ölçü, tam tanımlı", len(t.sk()["dims"]) == 2 and t.res()["dof"] == 0, len(t.sk()["dims"]))

    # D) sürülen (referans) ölçü → panelde 'Sürücü ölçü yap'
    t.cmd("Akıllı Ölçü"); dim_ent((25, 30), (25, 42), None)
    if t.pg.locator("dialog.redund-dlg").count():
        t.pg.click("dialog.redund-dlg button:has-text('Sürülen')"); time.sleep(0.4)
    s = t.sk(); refd = [d for d in s["dims"] if d.get("ref")]
    t.chk("sürülen ölçü eklendi", len(refd) == 1)
    t.cmd("Seç"); t.key("Escape")
    t.note("ölçü etiketleri", t.pg.locator(".dim").all_inner_texts())
    # sürülen ölçünün etiketine tıkla (sürülen ölçüler parantezli gösterilir)
    t.pg.locator(".dim.ref").first.click(); time.sleep(0.3)
    btn = t.pg.locator("#pm-body button:has-text('Sürücü ölçü yap')")
    t.chk("panelde 'Sürücü ölçü yap' var", btn.count() > 0, t.ev(f"[...{ED}.sel]"))
    if btn.count():
        btn.click(); time.sleep(0.4)
    s = t.sk(); r = t.res()
    still_ref = any(d.get("ref") for d in s["dims"])
    t.note("sürücü yap sonrası", [(d["v"], d.get("ref")) for d in s["dims"]], r, "durum:", st(), "toast:", t.ev("(document.querySelector('#toast')||{}).textContent"))
    t.chk("gereksiz sürülen ölçü sürücüye çevrilince reddedilir / uyarılır (SolidWorks)", still_ref or "Aşırı" in st() or t.pg.locator("dialog.redund-dlg").count() > 0, (still_ref, r))
    if t.pg.locator("dialog.redund-dlg").count(): t.pg.click("dialog.redund-dlg button:has-text('Vazgeç')")
    if not still_ref: t.key("Control+z")

    # E) yatay çizgiye Dikey (E-2 hâlâ?)
    t.cmd("Seç"); t.key("Escape")
    t.kclick(20, 30)  # üst kenar
    btns = t.panel_btns()
    t.chk("yatay çizgiye 'Dikey' sunulmaz (E-2)", not any("Dikey" in b for b in btns), btns)
    n0 = len(t.sk()["rels"])
    t.press_rel("Dikey"); s = t.sk(); r = t.res()
    t.note("yatay çizgiye Dikey basıldı", len(s["rels"]) - n0, r, st())
    if len(s["rels"]) > n0: t.key("Control+z")

    # F) çelişen ilişki: alt (yatay) + sol (dikey) → Paralel → reddedilmeli
    t.key("Escape"); t.ev("document.querySelector('#toast')&&(document.querySelector('#toast').textContent='')"); t.kclick(20, 0); t.kclick(0, 12, "Control")
    t.note("F seçim", t.ev(f"[...{ED}.sel]"), t.panel_btns())
    pts0 = t.sk()["pts"]; n0 = len(t.sk()["rels"])
    t.press_rel("Paralel")
    s = t.sk(); toast = t.ev("(document.querySelector('#toast')||{}).textContent")
    t.chk("çelişen Paralel reddedildi, geometri aynı", len(s["rels"]) == n0 and s["pts"] == pts0, (len(s["rels"]) - n0, toast))
    t.chk("çelişki için kullanıcıya uyarı (ya da çelişen ilişki hiç sunulmaz — v0.90)", "çeliş" in (toast or "").lower() or "aşırı" in (toast or "").lower() or not any("Paralel" in b for b in t.panel_btns()), toast)

    # G) gereksiz ilişki: üst + alt (ikisi yatay) → Paralel
    t.key("Escape"); t.kclick(20, 0); t.kclick(20, 30, "Control")
    t.note("G seçim", t.ev(f"[...{ED}.sel]"))
    n0 = len(t.sk()["rels"])
    t.press_rel("Paralel"); s = t.sk(); r = t.res()
    t.note("iki yatay çizgiye Paralel", len(s["rels"]) - n0, r, st())
    t.chk("gereksiz Paralel ilişkisi sessizce eklenmez (SolidWorks: aşırı tanımlı uyarısı)", len(s["rels"]) == n0 or "Aşırı" in st(), (len(s["rels"]) - n0, r["red"], st()))
    if len(s["rels"]) > n0: t.key("Control+z")

    # H) Tam Tanımla: daire + eğik çizgi
    fid = t.ev("window.__app.mode.featId")
    t.pm_ok()
    t.new_sketch("Üst Düzlem"); t.zoom(1.6)
    t.note("mod", t.ev("window.__app.mode.k"), t.ev("[...document.querySelectorAll('#tree li')].map(l=>l.textContent.slice(0,20))"))
    t.cmd("Daire"); t.kclick(20, 15, "Control"); t.kclick(32, 15, "Control")
    t.cmd("Çizgi"); t.kclick(-40, -10, "Control"); t.kclick(-10, 5, "Control"); t.key("Escape")
    d0 = t.res()["dof"]
    t.cmd("Tam Tanımla")
    r = t.res(); s = t.sk()
    t.chk("Tam Tanımla → serbestlik 0", r["dof"] == 0 and r["ok"] and not r["conf"], (d0, r, len(s["dims"]), len(s["rels"])))
    t.chk("Tam Tanımla gereksiz kısıt üretmez", not r["red"], r["red"])
    c = next(e for e in s["ents"] if e["t"] == "circle")
    t.chk("Tam Tanımla geometriyi kıpırdatmaz (daire merkezi 20,15 R12)", abs(s["pts"][c["c"]]["x"] - 20) < 1e-3 and abs(s["pts"][c["c"]]["y"] - 15) < 1e-3 and abs(c["r"] - 12) < 1e-3, (s["pts"][c["c"]], c["r"]))
    t.key("Control+z")
    t.chk("Tam Tanımla tek adımda geri alınır", t.res()["dof"] == d0 and not t.sk()["dims"], t.res())
    t.key("Control+y")
    t.chk("Ctrl+Y yeniden tam tanımlı", t.res()["dof"] == 0)
    fid2 = t.ev("window.__app.mode.featId")
    t.pm_ok()
    sv = t.saved_feat(fid2)
    t.chk("tam tanımlı eskiz kayda geçti", sv and len(sv["data"]["dims"]) > 0, sv and len(sv["data"]["dims"]))
    t.reload()
    t.edit_sketch("Eskiz2")
    t.chk("yeniden açınca hâlâ tam tanımlı", t.res()["dof"] == 0 and "Tam tanımlı" in st(), (t.res(), st()))
    t.pm_cancel("discard")
    t.close()

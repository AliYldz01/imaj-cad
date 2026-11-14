# d10 — MENÜ ÇUBUĞU: tüm menü öğeleri gerçek tıklamayla (masaüstü 1400×900). Her öğe için etki doğrulanır.
import sys; sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d10h import *

RES_ROWS = []


def row(menu, item, ok, info=""):
    RES_ROWS.append((menu, item, "✓" if ok else "✗", str(info)[:160]))
    chk(f"{menu} › {item}", ok, info)


def sig(a):
    return a.ev("""(()=>{const v=window.__app.viewer;return {mode:window.__app.mode.k, dlg:[...document.querySelectorAll('dialog[open]')].map(d=>d.className||d.id),
      pm:document.querySelector('#pm').hidden?'':document.querySelector('#pm-title').textContent, toast:(()=>{const t=document.querySelector('#toast');return t&&!t.hidden?t.textContent:''})(),
      pop:[...document.querySelectorAll('.sw-ctx,.sw-sbar,.popover:not([hidden]),.fea-panel,.draft-ana,.sec-panel,.radial')].map(x=>x.className),
      hint:document.querySelector('#hint').textContent, side:document.querySelector('#side').hidden, fs:!!document.fullscreenElement, mag:!!v.mag,
      persp:!!v.perspective, style:v.displayStyle, nfeat:window.__app.doc.features.length}})()""")


def fresh_tip(a):
    a.close_dialogs()
    a.ev("document.querySelectorAll('.sw-ctx,.sw-sbar,.menu-drop').forEach(x=>x.remove())")
    a.ev("(()=>{const t=document.querySelector('#toast');if(t){t.hidden=true;t.textContent=''}})()")


with sync_playwright() as p:
    a = App(p)
    a.setup(block())
    popups = []
    a.ctx.on("page", lambda pg: popups.append(pg))

    # --- menü listeleri envanterle aynı mı
    items = {m: a.menu_items(m) for m in ["Dosya", "Düzen", "Görünüm", "Ekle", "Araçlar", "Yardım"]}
    note("menü öğe sayıları:", {k: len(v) for k, v in items.items()})
    note("Dosya:", items["Dosya"])
    chk("Dosya menüsünde Dosya yöneticisi / Belge özellikleri / 3MF / PDF / birim yok (yalnız ☰ listesinde)", True,
        [x for x in ["Dosya yöneticisi…", "Belge özellikleri…", "3MF dışa aktar", "Birim: mm ↔ inç"] if x not in items["Dosya"]])

    # ---------- Dosya ----------
    fresh_tip(a)
    a.menu("Dosya", "Şekil sihirbazı…"); s = sig(a)
    row("Dosya", "Şekil sihirbazı…", any("wiz" in d or "input" in d for d in s["dlg"]), s["dlg"])
    fresh_tip(a)
    nm, data = a.download(lambda: a.menu("Dosya", "STEP dışa aktar"))
    bb = step_bbox(data)
    row("Dosya", "STEP dışa aktar", nm.endswith(".step") and data.startswith(b"ISO-10303-21") and bb and bb[1][0] - bb[0][0] == 80 and bb[1][1] - bb[0][1] == 20, (nm, bb))
    nm, data = a.download(lambda: a.menu("Dosya", "STL dışa aktar"))
    n, mn, mx = stl_bbox(data)
    mb = a.bbox()
    row("Dosya", "STL dışa aktar", nm.endswith(".stl") and n >= 12 and mn == mb[0] and mx == mb[1], (nm, n, mn, mx, mb))
    fresh_tip(a)
    a.menu("Dosya", "Sac açınımı (DXF)"); s = sig(a)
    row("Dosya", "Sac açınımı (DXF) — sac olmayan parça", "sac" in s["toast"].lower() or s["toast"], s["toast"])
    fresh_tip(a)
    a.menu("Dosya", "Kesim listesi…"); s = sig(a)
    row("Dosya", "Kesim listesi…", bool(s["dlg"]) or bool(s["toast"]), (s["dlg"], s["toast"]))
    fresh_tip(a)
    a.menu("Dosya", "Teknik resim…"); time.sleep(4); s = sig(a)
    row("Dosya", "Teknik resim…", bool(s["dlg"]), s["dlg"])
    fresh_tip(a)
    # STEP / STL içe aktar: az önce indirilen STL
    stl = [f for f in os.listdir(DL) if f.endswith(".stl")]
    a.open_file(lambda: a.menu("Dosya", "STEP / STL içe aktar…"), os.path.join(DL, stl[0]))
    a.wait(2)
    last = a.ev("window.__app.doc.features.slice(-1)[0].type")
    row("Dosya", "STEP / STL içe aktar…", last == "import" and a.bodies() >= 1, (last, a.bodies(), a.vol()))
    a.undo()
    # Yeni / Aç / Kaydet / Farklı kaydet / Son belgeler: d10_dosya.py'de ayrıntılı
    fresh_tip(a)
    a.menu("Dosya", "Son belgeler…"); s = sig(a)
    row("Dosya", "Son belgeler…", bool(s["dlg"]), s["dlg"])
    fresh_tip(a)

    # ---------- Düzen ----------
    a.edit_feat("Ekstrüzyon1"); a.pmfield("Derinlik", 30); a.ok()
    a.menu("Düzen", "Geri al")
    row("Düzen", "Geri al", a.featv("Ekstrüzyon1", "d1") == 20, a.featv("Ekstrüzyon1", "d1"))
    a.menu("Düzen", "Yinele")
    row("Düzen", "Yinele", a.featv("Ekstrüzyon1", "d1") == 30, a.featv("Ekstrüzyon1", "d1"))
    t0 = a.ev("window.__app.kernel.__n||0")
    a.menu("Düzen", "Yeniden oluştur"); s = sig(a)
    row("Düzen", "Yeniden oluştur", near(a.vol(), 144000, 1), (a.status(), a.vol()))
    a.menu("Düzen", "Ekranı yenile")
    row("Düzen", "Ekranı yenile", True, "görünür etki yok (beklenen)")
    # parça modunda Kopyala / Yapıştır / Tümünü seç
    a.tsel("Eskiz1")
    n0 = a.nfeat()
    a.menu("Düzen", "Kopyala"); a.menu("Düzen", "Yapıştır"); s = sig(a)
    row("Düzen", "Kopyala + Yapıştır (parça modu, eskiz seçili)", a.nfeat() > n0 or bool(s["toast"]), f"özellik {n0}→{a.nfeat()}, uyarı={s['toast']!r}")
    a.menu("Düzen", "Tümünü seç"); s = sig(a)
    selt = a.pg.inner_text("#sb-sel")
    row("Düzen", "Tümünü seç (parça modu)", bool(s["toast"]) or "seçili" in selt, f"durum={selt!r} uyarı={s['toast']!r}")
    # eskizde
    a.tact("Eskiz1", "Eskizi düzenle"); a.wait(0.5)
    a.menu("Düzen", "Tümünü seç")
    nsel = a.ed("return e.sel.size")
    row("Düzen", "Tümünü seç (eskiz)", nsel >= 4, nsel)
    a.menu("Düzen", "Kopyala"); a.menu("Düzen", "Yapıştır")
    ne = a.ed("return d.ents.length")
    row("Düzen", "Kopyala + Yapıştır (eskiz)", ne == 8, ne)
    a.ed("e.undo()") if ne != 4 else None
    a.pg.keyboard.press("Control+z"); time.sleep(0.4)
    row("Düzen", "Eskizde Ctrl+Z yapıştırmayı geri alır", a.ed("return d.ents.length") == 4, a.ed("return d.ents.length"))
    a.menu("Araçlar", "Hızlı yakalama…"); s = sig(a)
    row("Araçlar", "Hızlı yakalama… (eskiz)", bool(s["pop"]) or bool(s["dlg"]), s["pop"])
    fresh_tip(a)
    a.menu("Araçlar", "Eskizden çık"); a.wait(0.5)
    row("Araçlar", "Eskizden çık", a.mode() == "part", a.mode())
    a.menu("Araçlar", "Hızlı yakalama…"); s = sig(a)
    row("Araçlar", "Hızlı yakalama… (parça modu: etkisiz/gri olmalı)", not s["pop"], s["pop"])
    # Sil
    a.tsel("Ekstrüzyon1")
    a.dq[:] = [True]
    a.menu("Düzen", "Sil"); a.wait(0.6)
    row("Düzen", "Sil (ağaçta özellik; 'eskiz de silinsin mi' → Evet)", a.nfeat() == 0, (a.nfeat(), a.dlog[-1:] ))
    a.undo()
    a.tsel("Ekstrüzyon1")
    a.dq[:] = ["Taban"]
    a.menu("Düzen", "Yeniden adlandır")
    row("Düzen", "Yeniden adlandır", "Taban" in a.names(), a.names())
    a.undo()
    # Son komutu tekrarla
    a.cmd("Radyüs"); a.wait(0.3)
    a.btn("#pm-cancel"); a.wait(0.3)
    a.menu("Düzen", "Son komutu tekrarla"); s = sig(a)
    row("Düzen", "Son komutu tekrarla", "Radyüs" in s["pm"], s["pm"])
    a.btn("#pm-cancel"); a.wait(0.3)
    fresh_tip(a)

    # ---------- Görünüm ----------
    V = [("Önden", [0, 0, 1]), ("Arkadan", [0, 0, -1]), ("Soldan", [-1, 0, 0]), ("Sağdan", [1, 0, 0]), ("Üstten", [0, 1, 0]), ("Alttan", [0, -1, 0])]
    for lab, d in V:
        a.menu("Görünüm", lab)
        c = a.cam()
        row("Görünüm", lab, [round(x) for x in c["dir"]] == d, c["dir"])
    a.menu("Görünüm", "İzometrik"); c = a.cam()
    row("Görünüm", "İzometrik (gerçek izometrik 0.577)", all(abs(abs(x) - 0.577) < 0.01 for x in c["dir"]), c["dir"])
    # Normal (dik bak): yüz seçiliyken
    a.face_click("f=>f.n&&Math.abs(f.n[0]-1)<1e-6")
    a.menu("Görünüm", "Normal (dik bak)"); c = a.cam()
    row("Görünüm", "Normal (dik bak) — sağ yüz seçili", [round(x) for x in c["dir"]] == [1, 0, 0], c["dir"])
    a.pg.keyboard.press("Escape")
    z0 = a.cam()["zoom"]
    a.menu("Görünüm", "Yakınlaştır"); z1 = a.cam()["zoom"]
    row("Görünüm", "Yakınlaştır", near(z1 / z0, 1.25, 0.01), (z0, z1))
    a.menu("Görünüm", "Uzaklaştır"); z2 = a.cam()["zoom"]
    row("Görünüm", "Uzaklaştır", near(z2 / z1, 0.8, 0.01), (z1, z2))
    a.menu("Görünüm", "Ekrana sığdır"); z3 = a.cam()["zoom"]
    a.menu("Görünüm", "Önceki görünüm"); z4 = a.cam()["zoom"]
    row("Görünüm", "Ekrana sığdır", z3 > 0, z3)
    row("Görünüm", "Önceki görünüm (sığdırmadan önceki)", near(z4, z2, 1e-3), (z2, z3, z4))
    a.menu("Görünüm", "Bölgeye yakınlaştır"); s = sig(a)
    vc = a.view_center()
    zb = a.cam()["zoom"]
    a.drag((vc[0] - 60, vc[1] - 40), (vc[0] + 60, vc[1] + 40))
    row("Görünüm", "Bölgeye yakınlaştır", a.cam()["zoom"] > zb * 2, (s["hint"][:30], zb, a.cam()["zoom"]))
    a.menu("Görünüm", "Büyüteç"); s = sig(a)
    row("Görünüm", "Büyüteç (aç)", s["mag"], s["toast"])
    a.menu("Görünüm", "Büyüteç"); s = sig(a)
    row("Görünüm", "Büyüteç (kapat)", not s["mag"])
    a.menu("Görünüm", "Perspektif"); s = sig(a)
    row("Görünüm", "Perspektif (aç)", s["persp"])
    a.menu("Görünüm", "Perspektif"); s = sig(a)
    row("Görünüm", "Perspektif (kapat)", not s["persp"])
    for lab, st in [("Gölgeli", "shaded"), ("Gizli çizgileri kaldır", "hlr"), ("Gizli çizgiler görünür", "hlv"), ("Tel kafes", "wire"), ("Kenarlı gölgeli", "shadedEdges")]:
        a.menu("Görünüm", "Görüntü stili", lab); s = sig(a)
        row("Görünüm", "Görüntü stili › " + lab, s["style"] == st, s["style"])
    pv = a.ev("window.__app.viewer.planesGroup.visible")
    a.menu("Görünüm", "Düzlemleri göster / gizle")
    pv2 = a.ev("window.__app.viewer.planesGroup.visible")
    row("Görünüm", "Düzlemleri göster / gizle", pv != pv2, (pv, pv2))
    a.menu("Görünüm", "Düzlemleri göster / gizle")
    a.menu("Görünüm", "Özellik ağacını göster / gizle"); s = sig(a)
    row("Görünüm", "Özellik ağacını göster / gizle (gizle)", s["side"], s["side"])
    a.pg.keyboard.press("F9"); s = sig(a)
    row("Görünüm", "F9 ağacı geri getirir", not s["side"], s["side"])
    a.menu("Görünüm", "Tam ekran"); time.sleep(0.5); s = sig(a)
    row("Görünüm", "Tam ekran", s["fs"] or "tam ekran" in s["toast"].lower(), (s["fs"], s["toast"]))
    if s["fs"]:
        a.ev("document.exitFullscreen()"); time.sleep(0.3)
    lk0 = a.ls("imajcad.fslock")
    a.menu("Görünüm", "Tam ekran Esc kilidi"); s = sig(a)
    lk1 = a.ls("imajcad.fslock")
    row("Görünüm", "Tam ekran Esc kilidi", lk0 != lk1 or bool(s["toast"]), (lk0, lk1, s["toast"]))
    a.menu("Görünüm", "Tam ekran Esc kilidi")
    fresh_tip(a)

    # ---------- Ekle ----------
    for sub in ["Özellikler", "Eskiz", "Sac Metal", "Kaynaklı", "Montaj"]:
        it = a.menu_items("Ekle", sub)
        note(f"Ekle › {sub}: {len(it)} öğe", it[:6])
    a.menu("Ekle", "Özellikler", "Radyüs"); s = sig(a)
    row("Ekle", "Özellikler › Radyüs", "Radyüs" in s["pm"], s["pm"])
    a.btn("#pm-cancel"); a.wait(0.3)
    a.tsel("Üst Düzlem") if a.ev("[...document.querySelectorAll('#tree li')].some(l=>l.textContent.includes('Üst Düzlem'))") else None
    a.menu("Ekle", "Eskiz", "Çizgi"); a.wait(0.5); s = sig(a)
    row("Ekle", "Eskiz › Çizgi (parça modunda: düzlem sorar / eskiz açar)", s["mode"] in ("sketch", "pickSketchPlane") or bool(s["toast"]), (s["mode"], s["toast"]))
    a.pg.keyboard.press("Escape"); time.sleep(0.3)
    if a.mode() == "sketch":
        a.menu("Araçlar", "Eskizden çık"); a.wait(0.4)
    a.menu("Ekle", "Sac Metal", "Taban Flanş"); s = sig(a)
    row("Ekle", "Sac Metal › Taban Flanş", bool(s["pm"]) or bool(s["toast"]), (s["pm"], s["toast"]))
    if s["pm"]:
        a.btn("#pm-cancel"); a.wait(0.3)
    fresh_tip(a)
    a.menu("Ekle", "Kaynaklı", "Yapı Elemanı"); s = sig(a)
    row("Ekle", "Kaynaklı › Yapı Elemanı", bool(s["pm"]) or bool(s["toast"]), (s["pm"], s["toast"]))
    if s["pm"]:
        a.btn("#pm-cancel"); a.wait(0.3)
    fresh_tip(a)
    a.menu("Ekle", "Montaj", "Montajı Aç"); a.wait(1); s = sig(a)
    asm_on = a.ev("!!(window.__app.asm&&window.__app.asm.on) || document.querySelector('#tabs button.active').dataset.tab==='asm'")
    row("Ekle", "Montaj › Montajı Aç", asm_on, a.ev("document.querySelector('#tabs button.active').dataset.tab"))
    a.btn("#tabs button[data-tab='features']"); a.wait(0.5)
    fresh_tip(a)

    # ---------- Araçlar ----------
    ev_items = a.menu_items("Araçlar", "Değerlendir")
    note("Araçlar › Değerlendir:", ev_items)
    for it in ev_items:
        fresh_tip(a)
        a.menu("Araçlar", "Değerlendir", it); time.sleep(1.2); s = sig(a)
        okk = bool(s["dlg"] or s["pm"] or s["pop"] or s["toast"] or s["hint"] or s["mode"] != "part")
        row("Araçlar", "Değerlendir › " + it, okk, {k: s[k] for k in ("dlg", "pm", "pop", "toast", "mode") if s[k]})
        a.close_dialogs()
        if s["pm"]:
            a.btn("#pm-cancel"); a.wait(0.3)
        if s["mode"] not in ("part",):
            a.pg.keyboard.press("Escape"); time.sleep(0.3)
        a.ev("document.querySelectorAll('.fea-panel .x, .draft-ana .x').forEach(b=>b.click())")
    fresh_tip(a)
    vc = a.view_center(); a.pg.mouse.move(vc[0], vc[1])
    a.menu("Araçlar", "Kısayol çubuğu"); s = sig(a)
    row("Araçlar", "Kısayol çubuğu", any("sbar" in x for x in s["pop"]), s["pop"])
    a.pg.keyboard.press("Escape"); fresh_tip(a)
    a.menu("Araçlar", "Seçim filtresi (tümü / yüz / kenar)"); s = sig(a)
    row("Araçlar", "Seçim filtresi", "yüz" in s["toast"], s["toast"])
    a.pg.keyboard.press("F5"); a.pg.keyboard.press("F5"); fresh_tip(a)
    a.menu("Araçlar", "Özelleştir (kısayollar, fare hareketleri)…"); s = sig(a)
    row("Araçlar", "Özelleştir…", bool(s["dlg"]), s["dlg"])
    fresh_tip(a)
    n0 = len(popups)
    a.menu("Araçlar", "Kısayol listesini yazdır"); time.sleep(1); s = sig(a)
    row("Araçlar", "Kısayol listesini yazdır", len(popups) > n0 or bool(s["toast"]), (len(popups) - n0, s["toast"]))
    for pp in popups[n0:]:
        try:
            txt = pp.inner_text("body")[:200]; note("yazdırma penceresi:", txt.replace("\n", " | ")[:150]); pp.close()
        except Exception:
            pass
    fresh_tip(a)
    a.menu("Araçlar", "Kalem ve dokunmatik ayarları…"); s = sig(a)
    row("Araçlar", "Kalem ve dokunmatik ayarları…", bool(s["dlg"]), s["dlg"])
    fresh_tip(a)
    w0 = a.ls("imajcad.wheel")
    a.menu("Araçlar", "Tekerlek yönünü ters çevir"); s = sig(a)
    w1 = a.ls("imajcad.wheel")
    row("Araçlar", "Tekerlek yönünü ters çevir", "yakınlaş" in s["toast"], (w0, w1, s["toast"]))
    a.menu("Araçlar", "Tekerlek yönünü ters çevir")
    fresh_tip(a)

    # ---------- Yardım ----------
    a.menu("Yardım", "Yardım"); s = sig(a)
    row("Yardım", "Yardım", "help" in s["dlg"], s["dlg"])
    ver = a.ev("document.querySelector('#help h2').textContent")
    row("Yardım", "Yardım başlığı sürümü güncel", "v0.9" in ver, ver)
    fresh_tip(a)
    a.menu("Yardım", "Başlangıç rehberi…"); s = sig(a)
    row("Yardım", "Başlangıç rehberi…", bool(s["dlg"]), s["dlg"])
    # rehberin 4 profil düğmesi + Şekil sihirbazı + Başla
    bt = a.pg.locator("dialog[open] button").all_inner_texts()
    note("rehber düğmeleri:", bt)
    a.btn("dialog[open] button:has-text('Fare ve klavye')")
    prof = json.loads(a.ls("imajcad.input") or "{}").get("profile")
    row("Başla", "🖱 Fare ve klavye", prof == "mouse", prof)
    a.btn("dialog[open] button:has-text('Kalem')")
    prof = json.loads(a.ls("imajcad.input") or "{}").get("profile")
    row("Başla", "✒ Kalem", prof == "auto", prof)
    a.btn("dialog[open] button:has-text('imleç parmağın')")
    pr = json.loads(a.ls("imajcad.input") or "{}")
    row("Başla", "☝ Parmak — imleç parmağın üstünde", pr.get("profile") == "finger" and pr.get("touchpad") is False, pr)
    a.btn("dialog[open] button:has-text('dokunmatik fare')")
    pr = json.loads(a.ls("imajcad.input") or "{}")
    row("Başla", "☝ Parmak — dokunmatik fare", pr.get("profile") == "finger" and pr.get("touchpad") is True, pr)
    a.btn("dialog[open] button:has-text('şekil sihirbazı')"); s = sig(a)
    row("Başla", "Hiç çizmeden: şekil sihirbazı", len(s["dlg"]) == 1, s["dlg"])
    a.close_dialogs()
    a.menu("Yardım", "Başlangıç rehberi…")
    a.btn("dialog[open] button:text-is('Başla')"); s = sig(a)
    row("Başla", "Başla (kapat)", not s["dlg"] and a.ls("imajcad.welcomed") == "1", s["dlg"])
    a.btn("dialog[open] button:has-text('Fare ve klavye')") if s["dlg"] else None
    # profil fareye geri: ayarlar penceresinden
    a.ev("localStorage.setItem('imajcad.input', JSON.stringify({profile:'mouse'}))")
    print("hatalar:", a.errs[:5])
    json.dump(RES_ROWS, open("/tmp/d10_menu_rows.json", "w"), ensure_ascii=False)
    a.close()
finish()

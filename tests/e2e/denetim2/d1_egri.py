# d1 — Elips, kısmi elips, parabol, konik, çokgen, spline, nokta, metin, denklem eğrisi (masaüstü, gerçek fare)
import sys, math; sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d1_lib import *
PI = math.pi
def close_line(t, a, b):
    t.cmd("Çizgi"); t.mclick(*a); t.mclick(*b); t.close_quick(); t.key("Escape")
    if t.st()["tool"] != "line": pass
with sync_playwright() as p:
    t = T(p)
    # ---------- elips
    t.new_sketch(); t.zoom_to(200)
    t.cmd("Elips")
    t.mclick(0, 0); t.mclick(30, 0); t.mclick(10, 15); t.close_quick()
    s = t.st(); e = t.ents_of("ellipse")
    t.chk("elips: elips + yapı büyük eksen çizgisi", s["ents"] == ["ellipse", "line*"], s["ents"])
    t.chk("elips: a=30, b=15", e and abs(t.P(e[0]["a"])[0] - 30) < 0.4 and abs(e[0]["rb"] - 15) < 0.4, e)
    t.chk("elips: merkez orijine bağlı", e and e[0]["c"] == "O", e)
    print("  elips serbestlik:", s["dof"], s["rels"], "(SW: büyük eksen yatay çizilince yatay ilişki; a, b, açı)")
    t.smart_dim([(15, 0)], 40, (15, -10))
    print("  elips ölçü sonrası:", t.st()["dims"], t.st()["dof"])
    life(t, "elips", PI * 40 * 15 * 10, 40, 50, PI * 50 * 15 * 10, tol=2)

    # elips küçük ekseni panelden (Seç → elips → alan)
    t.edit_sketch_of("Ekstrüzyon")
    t.mclick(0, 15)  # elipsin tepe noktası (küçük eksen ucu)
    fields = t.pg.locator("#pm-body .pm-field").all_inner_texts()
    print("  elips seçili panel alanları:", fields)
    t.ok_pm()

    # ---------- kısmi elips + kapatma çizgisi
    t.fresh(); t.new_sketch(); t.zoom_to(200)
    t.cmd("Kısmi Elips")
    t.mclick(0, 0); t.mclick(30, 0); t.mclick(0, 15)
    t.mclick(30, 0); t.mclick(-30, 0); t.close_quick()
    s = t.st(); e = t.ents_of("ellipse")
    t.chk("kısmi elips: 1 elips (t0/t1, s/e noktaları)", len(e) == 1 and "s" in e[0] and "e" in e[0], e)
    if e:
        S, E = t.P(e[0]["s"]), t.P(e[0]["e"])
        t.chk("kısmi elips: uçlar (30,0) ve (-30,0)", abs(S[0] - 30) < 0.5 and abs(E[0] + 30) < 0.5, (S, E))
    close_line(t, (30, 0), (-30, 0))
    s = t.st()
    t.chk("kısmi elips + çizgi: kapalı profil, uçlar çakışık (yeni nokta yok)", s["npts"] == 3 or s["npts"] == 4, (s["npts"], s["rels"]))
    t.ok_pm(); t.extrude(10)
    v = t.vol()
    t.chk("kısmi elips yarım: π·30·15/2·10", v and abs(v - PI * 30 * 15 / 2 * 10) < 5, v)

    # ---------- parabol + kiriş
    t.fresh(); t.new_sketch(); t.zoom_to(200)
    t.cmd("Parabol")
    t.mclick(-20, 0); t.mclick(20, 0); t.mclick(0, 20); t.close_quick()
    s = t.st()
    t.chk("parabol: 1 parabol öğesi", s["ents"] == ["parabola"], s["ents"])
    close_line(t, (-20, 0), (20, 0))
    t.ok_pm(); t.extrude(10)
    v = t.vol()
    t.chk("parabol kesiti alanı = 2/3·40·20 (tepesi 20)", v and abs(v - 2 / 3 * 40 * 20 * 10) < 30, v)
    # düzenle: tepe noktasını sürükle
    t.edit_sketch_of("Ekstrüzyon")
    t.cmd("Seç")
    q = t.ents_of("parabola")[0]; K = t.P(q["k"])
    print("  parabol kontrol noktası:", K)
    t.drag(0, 20, 0, 30)
    q2 = t.ents_of("parabola")[0]; S2 = t.P(q2["s"]); K2 = t.P(q2["k"])
    t.chk("parabol eğrisi tepeden sürüklenince biçim değişir, uçlar yerinde (SW)", abs(S2[1]) < 0.5 and abs(K2[1] - K[1]) > 1, (S2, K2))
    t.drag(K2[0], K2[1], K2[0], K2[1] + 20)  # kontrol noktası (eğrinin dışında)
    print("  kontrol noktası sürüklendi:", [t.P(t.ents_of("parabola")[0][k]) for k in "sek"])
    t.ok_pm()
    v2 = t.vol()
    t.chk("parabol (kontrol noktasıyla) değişince hacim artar", v2 and v2 > v + 100, (v, v2))
    t.key("Control+z"); t.wait(); time.sleep(0.5)
    t.chk("parabol: Ctrl+Z eski hacim", abs((t.vol() or 0) - v) < 1, t.vol())
    t.reload()
    t.chk("parabol: yenileme sonrası hacim (geri alınmış)", abs((t.vol() or 0) - v) < 1, t.vol())

    # ---------- konik
    t.fresh(); t.new_sketch(); t.zoom_to(200)
    t.cmd("Konik")
    rho = t.pg.locator("#pm-body .pm-field:has-text('rho') input, #pm-body .pm-field:has-text('Rho') input, #pm-body .pm-field:has-text('ρ') input")
    print("  konik panel:", t.pg.locator("#pm-body").inner_text()[:200].replace("\n", " | "))
    t.mclick(-20, 0); t.mclick(20, 0); t.mclick(0, 30); t.close_quick()
    s = t.st(); q = t.ents_of("parabola")
    t.chk("konik: 1 öğe (rho'lu)", len(q) == 1 and "rho" in q[0], q)
    close_line(t, (-20, 0), (20, 0))
    t.ok_pm(); t.extrude(10)
    v = t.vol()
    t.chk("konik: hacim > 0, hata yok", v and v > 1000 and not t.tree_errs(), (v, t.tree_errs()))

    # ---------- çokgen
    t.fresh(); t.new_sketch(); t.zoom_to(200)
    t.cmd("Çokgen")
    t.mclick(0, 0); t.mclick(20, 0)
    lbl = t.pg.locator(".dim-prompt.quick label").all_inner_texts() if t.quick_open() else []
    t.chk("çokgen: hızlı kutu 'Çevre dairesi çapı'", any("Çevre" in x for x in lbl), lbl)
    t.close_quick()
    s = t.st()
    t.chk("çokgen: 6 çizgi + yapı dairesi, 6 üzerinde + 5 eşit", s["ents"].count("line") == 6 and s["ents"].count("circle*") == 1 and s["rels"].count("onCircle") == 6 and s["rels"].count("equal") == 5, s)
    t.chk("çokgen: 2 serbestlik (çap, açı)", s["dof"] == 2, s["dof"])
    t.smart_dim([(14.1, 14.1)], 40, (30, 30))
    print("  çokgen ölçü sonrası:", t.st()["dims"], t.st()["dof"])
    hexa = lambda R: 3 * math.sqrt(3) / 2 * R * R * 10
    life(t, "çokgen", hexa(20), 40, 50, hexa(25))
    # kenar sayısı alanı
    t.fresh(); t.new_sketch(); t.zoom_to(200)
    t.cmd("Çokgen")
    f = "#pm-body .pm-field:has-text('Kenar') input"
    t.pg.fill(f, "8"); t.pg.dispatch_event(f, "change"); time.sleep(0.2)
    t.mclick(0, 0); t.mclick(20, 0); t.close_quick()
    t.chk("çokgen: kenar sayısı 8", t.st()["ents"].count("line") == 8, t.st()["ents"])

    # ---------- spline (açık + çizgi)
    t.fresh(); t.new_sketch(); t.zoom_to(200)
    t.cmd("Spline")
    t.mclick(-30, 0); t.mclick(-10, 15); t.mclick(10, 20); t.mclick(30, 0, dbl=True); t.close_quick()
    s = t.st(); sp = t.ents_of("spline")
    t.chk("spline: çift tıkla biter, 4 noktalı spline", len(sp) == 1 and len(sp[0]["pts"]) == 4 and not s["drawing"], sp)
    close_line(t, (30, 0), (-30, 0))
    s = t.st()
    t.chk("spline + çizgi: uçlar paylaşılır", s["npts"] == 4, s["npts"])
    t.ok_pm(); t.extrude(10)
    v = t.vol()
    t.chk("spline profili ekstrüzyon > 0", v and v > 1000, v)
    t.edit_sketch_of("Ekstrüzyon")
    t.cmd("Seç")
    t.drag(10, 20, 10, 35)
    t.ok_pm()
    v2 = t.vol()
    t.chk("spline ara noktası sürüklenince hacim artar", v2 and v2 > v + 100, (v, v2))
    t.reload()
    t.chk("spline: yenileme sonrası korunur", abs((t.vol() or 0) - v2) < 1, t.vol())

    # ---------- kapalı spline
    t.fresh(); t.new_sketch(); t.zoom_to(200)
    t.cmd("Spline")
    for q in [(-20, 0), (0, 20), (20, 0), (0, -20)]: t.mclick(*q)
    t.mclick(-20, 0); t.close_quick()
    sp = t.ents_of("spline")
    t.chk("kapalı spline: ilk noktaya dönünce kapanır", len(sp) == 1 and sp[0]["pts"][0] == sp[0]["pts"][-1], sp)
    t.ok_pm(); t.extrude(10)
    v = t.vol()
    t.chk("kapalı spline ekstrüzyon ≈ daire (π·400·10 ±%15)", v and abs(v - PI * 400 * 10) < 0.15 * PI * 4000, v)
    # spline tutamakları: Seç → spline → panel
    t.edit_sketch_of("Ekstrüzyon")
    sp = t.ents_of("spline")[0]
    poly = t.ev("id=>{const e=window.__app.mode.editor; const en=e.data.ents.find(x=>x.id===id); return e.entPolyline(en)}", sp["id"])
    q = poly[len(poly) // 8] if poly else (14.1, 14.1)
    t.mclick(q[0], q[1])
    txt = t.pg.locator("#pm-body").inner_text()
    t.chk("spline seçilince teğet / ağırlık alanları", "teğet" in txt.lower() or "Teğet" in txt, txt[:200].replace("\n", " | "))
    t.ok_pm()

    # ---------- nokta
    t.fresh(); t.new_sketch(); t.zoom_to(200)
    close_line(t, (0, 0), (40, 0))
    t.cmd("Nokta")
    t.pg.mouse.move(*t.sc(19.5, 0.4), steps=4); time.sleep(0.4)
    t.mclick(20, 0)
    t.mclick(10, 20)
    s = t.st()
    t.chk("nokta: 2 nokta öğesi", s["ents"].count("point") == 2, s["ents"])
    t.chk("nokta çizgi ortasında → orta nokta ilişkisi", "midpoint" in s["rels"], s["rels"])
    t.chk("nokta: serbest nokta 2 serbestlik ekler", s["dof"] == 1 + 2, s["dof"])
    t.key("Control+z")
    t.chk("nokta: Ctrl+Z son noktayı siler", t.st()["ents"].count("point") == 1, t.st()["ents"])

    # ---------- metin
    t.fresh(); t.new_sketch(); t.zoom_to(200)
    t.cmd("Metin")
    tf = "#pm-body .pm-field:has-text('Metin') input"
    t.pg.fill(tf, "AB"); t.pg.dispatch_event(tf, "input"); t.pg.dispatch_event(tf, "change")
    t.mclick(10, 10)
    tx = t.ents_of("text")
    t.chk("metin: 'AB' eklendi", tx and tx[0]["text"] == "AB", tx)
    t.ok_pm(); t.extrude(2)
    v = t.vol()
    t.chk("metin ekstrüzyonu > 0", v and v > 10, (v, t.tree_errs()))
    # düzenle: Seç → metne tıkla → panelde metin değiştir
    t.edit_sketch_of("Ekstrüzyon")
    t.mclick(14, 14)  # harflerin üstü
    on_glyph = t.ev(ED + ".sel.size")
    t.chk("metin harflerine tıklayınca metin seçilir (SW)", on_glyph and t.pg.locator("#pm-body .pm-field:has-text('Metin') input").count() > 0, t.pg.locator("#pm-body").inner_text()[:80])
    loc = t.pg.locator("#pm-body .pm-field:has-text('Metin') input")
    t.chk("metin seçilince panelde düzenlenebilir alan", loc.count() > 0, t.pg.locator("#pm-body").inner_text()[:150])
    if loc.count():
        loc.first.fill("ABCD"); loc.first.press("Enter"); t.pg.dispatch_event("#pm-body .pm-field:has-text('Metin') input", "change"); time.sleep(0.3)
        f2 = "#pm-body .pm-field:has-text('Yükseklik') input"
        if t.pg.locator(f2).count():
            t.pg.fill(f2, "15"); t.pg.dispatch_event(f2, "change"); time.sleep(0.3)
    t.ok_pm()
    tx = [f for f in t.saved()["features"] if f["type"] == "sketch"][0]["data"]["ents"]
    v2 = t.vol()
    t.chk("metin ABCD / 15 mm kayda ve modele geçer", any(e.get("text") == "ABCD" and e.get("size") == 15 for e in tx) and v2 and v2 > v * 2, (tx, v, v2))
    # yazı tipi
    t.edit_sketch_of("Ekstrüzyon"); t.mclick(14, 14)
    sel = t.pg.locator("#pm-body select:has(option[value='bold'])").first
    if sel.count():
        sel.select_option("bold"); time.sleep(0.3)
    t.ok_pm()
    v3 = t.vol()
    t.chk("kalın yazı tipi hacmi artırır", v3 and v3 > v2, (v2, v3))
    t.key("Control+z"); t.wait(); time.sleep(0.5)
    t.chk("yazı tipi Ctrl+Z", abs((t.vol() or 0) - v2) < 1, t.vol())

    # eğri üzerinde metin: yay çiz, metin aracında yaya dokun
    t.fresh(); t.new_sketch(); t.zoom_to(200)
    t.cmd("Merkez Yay"); t.mclick(0, 0); t.mclick(30, 0); t.mclick(-30, 0); t.close_quick()
    t.cmd("Metin")
    t.pg.fill(tf, "XYZ"); t.pg.dispatch_event(tf, "input"); t.pg.dispatch_event(tf, "change")
    t.mclick(0, 30)
    tx = t.ents_of("text")
    t.chk("eğri üzerinde metin: on = yay", tx and tx[0].get("on"), tx)

    # ---------- denklem eğrisi
    t.fresh(); t.new_sketch(); t.zoom_to(200)
    t.cmd("Denklem Eğrisi")
    t.pg.locator("#pm-body button:has-text('Eğriyi oluştur')").click(); time.sleep(0.4)
    sp = t.ents_of("spline")
    t.chk("denklem eğrisi: 25 noktalı spline (varsayılan)", sp and len(sp[0]["pts"]) == 25, len(sp[0]["pts"]) if sp else None)
    t.chk("denklem eğrisi: tam tanımlı (sabit noktalar)", t.st()["dof"] == 0, t.st()["dof"])
    t.key("Control+z")
    t.chk("denklem eğrisi: Ctrl+Z", not t.ents_of("spline"))
    t.end()

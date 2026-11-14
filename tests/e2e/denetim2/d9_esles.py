# d9 — Montaj: standart eşleşmelerin yaşam döngüsü (gerçek tıklama) + parça değişince montaj
# Hazır model: Plaka (100×60×10, Ø10 delik (30,30)) ve Pim (Ø10×30) belgeleri setDoc ile; Pim kütüphaneye şeritten kaydedilir.
import sys; sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d9h import *


def P(S, i):
    return S.comps()[i]["p"]


with sync_playwright() as p:
    A = App(p); S = Asm(A)
    to_lib(A, pin_doc())
    setdoc(A, plate_doc())
    S.open()
    c1 = S.add_current(); pin = S.add_lib("Pim"); c2 = S.add_current()
    chk("3 bileşen eklendi, ilk sabit", [c["fixed"] for c in S.comps()] == [True, False, False], [c["name"] for c in S.comps()])
    S.fit()
    # ---- E1: çakışık (Plaka1 üst ↔ pim alt; alttan görünüm Ctrl+6) ----
    A.cmd("Eşleşme")
    S.click_face(c1['id'], "f=>f.n&&f.n[1]>0.9", shift=[40, 0, 10])
    A.press("Control+6")
    S.click_local(pin['id'], [0, 0, 0])
    chk("E1 öneri Çakışık", "on" in (A.ev("document.querySelector('#pm-body .mate-types button[data-mate=coincident]').className") or ""))
    S.pmok()
    chk("E1 çakışık: pim alt yüzü y=10'da", abs(P(S, 1)[1] - 10) < 0.01, P(S, 1))
    chk("E1 ✓ sonrası panel açık kalır (SW)", S.pm_open())
    # ---- eş merkezli ----
    A.press("Control+7"); S.fit()
    S.click_local(pin['id'], [3.5, 20, 3.5])
    S.click_local(c1['id'], [30 - 3.5, 8, -30 - 3.5])
    S.pmok()
    chk("E1 eş merkezli: pim ekseni delikte (30,-30)", dist(P(S, 1), [30, 10, -30]) < 0.01, P(S, 1))
    # ---- mesafe (Plaka2 üst ↔ Plaka1 üst = 25) ----
    S.click_face(c2['id'], "f=>f.n&&f.n[1]>0.9", shift=[30, 0, 0])
    S.click_face(c1['id'], "f=>f.n&&f.n[1]>0.9", shift=[30, 0, 10])
    S.mate_type("distance")
    A.pmfield("Mesafe", 25)
    y0 = P(S, 2)[1]
    if y0 < 0:
        A.pmcheck("Ölçüyü ters çevir", True)
    chk("E1 mesafe 25 (gerekirse 'Ölçüyü ters çevir'): Plaka2 y = 25", abs(P(S, 2)[1] - 25) < 0.01, (y0, P(S, 2)))
    S.pmok()
    # ---- Plaka2 deliği ↔ pim eş merkezli ----
    S.click_local(c2['id'], [30 - 3.5, 8, -30 - 3.5])
    S.click_local(pin['id'], [3.5, 5, 3.5])
    S.pmok()
    chk("E1 Plaka2 deliği pim ekseninde", abs(P(S, 2)[0] - 0) < 0.01 and abs(P(S, 2)[2] - 0) < 0.01, P(S, 2))
    # ---- paralel ön yüzler ----
    S.fit()
    S.click_face(c2['id'], "f=>f.n&&f.n[2]>0.9", shift=[30, 0, 0])
    S.click_face(c1['id'], "f=>f.n&&f.n[2]>0.9", shift=[30, 0, 0])
    S.mate_type("parallel")
    S.pmok()
    S.pmok()  # seçimsiz ✓ paneli kapatır
    chk("E1 panel kapandı", not S.pm_open())
    ms = S.mates()
    chk("E1 5 eşleşme, hatasız", len(ms) == 5 and not any(m["bad"] for m in ms), [(m["type"], m["bad"]) for m in ms])
    tr = S.tree()
    chk("E1 ağaç: Plaka<2> tam tanımlı (işaretsiz), Pim (-)", any(t.startswith("Plaka<2>") for t in tr) and any(t.startswith("(-) Pim<1>") for t in tr), tr)
    pos0 = S.comps()
    # ---- E2: mesafeyi düzenle (ağaçta çift tık) 25 → 40 ----
    i = S.mate_li("Mesafe 25")
    A.pg.locator("#tree li").nth(i).dblclick(); time.sleep(0.5)
    chk("E2 çift tık düzenleme paneli", "Eşleşmeyi düzenle" in A.ev("document.querySelector('#pm-title')?.textContent||''"), A.ev("document.querySelector('#pm-title')?.textContent||''"))
    A.pmfield("Mesafe", 40)
    chk("E2 canlı önizleme y=40", abs(P(S, 2)[1] - 40) < 0.01, P(S, 2))
    S.pmok()
    chk("E2 ✓: Plaka2 y=40, ağaç 'Mesafe 40'", abs(P(S, 2)[1] - 40) < 0.01 and S.mate_li("Mesafe 40") >= 0, P(S, 2))
    chk("E2 düzenleme sonrası panel kapandı", not S.pm_open())
    chk("E2 kayıt (imajcad.asm) güncel", [m.get("v") for m in S.stored()["mates"] if m["type"] == "distance"] == [40])
    # ✕ ile vazgeç
    S.mate_select("Mesafe 40"); S.act("Düzenle")
    A.pmfield("Mesafe", 70)
    S.pmx()
    chk("E2 ✕: değer 40'ta kalır, Plaka2 y=40", abs(P(S, 2)[1] - 40) < 0.01 and S.mate_li("Mesafe 40") >= 0, P(S, 2))
    chk("E2 ✕ sonrası eşleşme etkin (bastırılmış kalmadı)", not [m for m in S.mates() if m["type"] == "distance"][0]["off"])
    # ---- E3: geri al / ileri al ----
    A.undo()
    chk("E3 Ctrl+Z: mesafe 25, Plaka2 y=25", abs(P(S, 2)[1] - 25) < 0.01 and S.mate_li("Mesafe 25") >= 0, P(S, 2))
    A.redo()
    chk("E3 Ctrl+Y: mesafe 40", abs(P(S, 2)[1] - 40) < 0.01 and S.mate_li("Mesafe 40") >= 0, P(S, 2))
    # ---- E4: hizalamayı çevir (paralel) ----
    q0 = S.comps()[2]["q"]
    S.mate_select("Paralel"); S.act("Hizalamayı çevir")
    q1 = S.comps()[2]["q"]; mp = [m for m in S.mates() if m["type"] == "parallel"][0]
    chk("E4 hizalamayı çevir: Plaka2 180° döner", abs(abs(q1[1]) - 1) < 0.01 or dist(q0, q1) > 0.5, (q0, q1, mp["flip"], mp["bad"], S.tree()[-1], A.toast()))
    S.mate_select("Paralel"); S.act("Hizalamayı çevir")
    chk("E4 ikinci çevirme: eski yön, hatasız", not [m for m in S.mates() if m["type"] == "parallel"][0]["bad"])
    # ---- E5: bastır ----
    S.mate_select("Mesafe 40"); S.act("Bastır")
    tr = S.tree()
    chk("E5 bastırınca Plaka<2> (-) olur", any(t.startswith("(-) Plaka<2>") for t in tr), tr)
    S.mate_select("Mesafe 40"); S.act("Etkinleştir")
    chk("E5 etkinleştir: tekrar tam tanımlı ve y=40", abs(P(S, 2)[1] - 40) < 0.01 and any(t.startswith("Plaka<2>") for t in S.tree()), S.tree())
    # ---- E6: aşırı tanım reddedilir ----
    A.cmd("Eşleşme")
    S.click_face(c2['id'], "f=>f.n&&f.n[1]>0.9", shift=[30, 0, 0])
    S.click_face(c1['id'], "f=>f.n&&f.n[1]>0.9", shift=[30, 0, 10])
    S.mate_type("coincident")
    st = S.mate_status()
    S.pmok()
    chk("E6 çelişen çakışık reddedilir, 5 eşleşme kalır", len(S.mates()) == 5, (st, A.toast()))
    S.pmx()
    # ---- E8: parça kalınlığı 10 → 15 (Özellikler: Ekstrüzyon1 Düzenle) ----
    A.btn("#tabs button[data-tab='features']"); A.wait(0.6)
    chk("E8 parça moduna dönüldü", not S.on())
    A.edit_feat("Ekstrüzyon1"); A.pmfield("Derinlik", 15); A.ok()
    chk("E8 parça kalınlığı 15", A.size() and abs(A.size()[1] - 15) < 0.01, A.size())
    S.open(); A.wait(1.5)
    bb1 = S.bbox(c1['id']); bb2 = S.bbox(c2['id'])
    chk("E8 iki plaka örneği de 15 mm", bb1 and abs(bb1[1][1] - bb1[0][1] - 15) < 0.01 and abs(bb2[1][1] - bb2[0][1] - 15) < 0.01, (bb1, bb2))
    chk("E8 pim yeni üst yüzde: y=15", abs(P(S, 1)[1] - 15) < 0.01, P(S, 1))
    chk("E8 Plaka2 mesafe yeni üst yüzden: alt yüzü y=40 (üst 55 − 15 = 40)", abs(P(S, 2)[1] - 40) < 0.01, P(S, 2))
    chk("E8 hatalı / kayıp eşleşme yok", not any(m["bad"] for m in S.mates()), [(m["type"], m["bad"]) for m in S.mates()])
    # ---- E9: deliği taşı (Eskizi düzenle: yatay ölçü 30 → 70) ----
    A.btn("#tabs button[data-tab='features']"); A.wait(0.6)
    A.tact("Delik1", "Eskizi düzenle")
    A.dim_dbl(0, 70); A.ok()
    hc = A.ev("(()=>{const m=window.__app.viewer.mesh;const f=m.faces.find(f=>!f.n&&f.r);return f&&(f.ac||f.c)})()")
    chk("E9 parçada delik x=70", hc and abs(hc[0] - 70) < 0.5, hc)
    S.open(); A.wait(1.5)
    ms = S.mates()
    chk("E9 montaj: pim deliği izler (x=70, z=-30)", abs(P(S, 1)[0] - 70) < 0.05 and abs(P(S, 1)[2] + 30) < 0.05, (P(S, 1), A.toast()))
    chk("E9 Plaka2 hâlâ hizalı (x=0)", abs(P(S, 2)[0]) < 0.05, P(S, 2))
    chk("E9 kayıp (⚠) eşleşme yok", not any(m["bad"] for m in ms) and not any("⚠" in t for t in S.tree()), [t for t in S.tree() if "⚠" in t])
    # ---- E10: eşleşme sil, bileşen sil ----
    n0 = len(S.mates())
    S.mate_select("Paralel"); S.act("Sil")
    chk("E10 eşleşme silindi", len(S.mates()) == n0 - 1)
    A.undo()
    chk("E10 geri al: eşleşme geri geldi", len(S.mates()) == n0)
    S.comp_act("Pim<1>", "Sil")
    ms = S.mates()
    chk("E10 Pim silinince ona bağlı eşleşmeler de gider", all(pin['id'] not in (m["a"]["comp"], m["b"]["comp"]) for m in ms), [(m["type"]) for m in ms])
    tr = S.tree()
    chk("E10 Plaka<2> (-) (pimle eş merkezli gitti)", any(t.startswith("(-) Plaka<2>") for t in tr), tr)
    A.undo()
    chk("E10 geri al: pim ve eşleşmeleri geri", len(S.comps()) == 3 and len(S.mates()) == n0, (len(S.comps()), len(S.mates())))
    # ---- E7: yenile → kalıcı ----
    pos0 = S.comps(); nm0 = len(S.mates())
    A.reload(); S.open()
    chk("E7 yenile: konumlar ve 5 eşleşme aynı", len(S.mates()) == nm0 and all(dist(a["p"], b["p"]) < 0.01 for a, b in zip(pos0, S.comps())), S.comps())
    print("hatalar:", A.errs[:5])
    chk("konsol hatası yok", not A.errs, A.errs[:3])
    A.close()
finish()

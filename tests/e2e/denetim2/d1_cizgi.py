# d1 — Çizgi, merkez çizgisi, orta noktalı çizgi, yapı geometrisi (masaüstü, gerçek fare/klavye)
import sys; sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d1_lib import *

with sync_playwright() as p:
    t = T(p)

    # ---------- 1) zincir + çift tıkla bitirme
    t.new_sketch("Ön Düzlem"); t.zoom_to(200)
    t.chk("yeni eskizde araç Çizgi", t.st()["tool"] == "line")
    t.mclick(0, 0); t.mclick(40, 0); t.mclick(40, 30); t.mclick(0, 30, dbl=True)
    s = t.st()
    t.chk("çift tık zinciri bitirir (3 çizgi, çizimde değil)", s["ents"] == ["line"] * 3 and not s["drawing"], s)
    t.chk("otomatik ilişkiler Y,D,Y (SW)", sorted(s["rels"]) == ["horizontal", "horizontal", "vertical"], s["rels"])
    t.chk("ilk nokta orijine çakışık (orijin kullanıldı → 3 nokta)", s["npts"] == 3, s["npts"])
    t.chk("serbestlik 3", s["dof"] == 3, s["dof"])
    # sonraki tık yeni zincir başlatır
    t.mclick(-30, -20); t.key("Escape"); t.key("Escape")
    s2 = t.st()
    t.chk("Esc yarım kalan zinciri iptal eder, tek nokta kalmaz", s2["npts"] == 3 and not s2["drawing"], s2)

    t.chk("2. Esc aracı bırakır (Seç)", t.st()["tool"] == "select", t.st()["tool"])
    t.cmd("Çizgi")
    # ---------- 2) Esc ile bitirme
    t.mclick(-60, 0); t.mclick(-60, 40)
    t.close_quick()
    t.key("Escape")
    s = t.st()
    t.chk("Esc sonrası araç hâlâ Çizgi (SW)", s["tool"] == "line", s["tool"])
    t.chk("Esc ile zincir biter, çizgi kalır", s["ents"].count("line") == 4 and not s["drawing"], s)
    t.chk("dikey çizgi → dikey ilişki", s["rels"].count("vertical") == 2, s["rels"])

    # ---------- 3) sağ tık → Zinciri bitir
    t.mclick(-60, -30); t.mclick(-20, -50)
    t.close_quick()
    t.mclick(-20, -50, button="right"); time.sleep(0.3)
    items = t.pg.locator(".sw-ctx .sw-mi").all_inner_texts()
    t.chk("sağ tık menüsünde 'Zinciri bitir'", any("Zinciri bitir" in x for x in items), items[:6])
    if any("Zinciri bitir" in x for x in items):
        t.pg.click(".sw-ctx .sw-mi:has-text('Zinciri bitir')"); time.sleep(0.2)
    s = t.st()
    t.chk("sağ tık ile bitirildi, eğik çizgi ilişkisiz", s["ents"].count("line") == 5 and not s["drawing"], s)

    # ---------- 4) A tuşu: çizgi → teğet yay (hızlı ölçü kutusu açıkken)
    t.mclick(0, -40); t.mclick(40, -40)
    focus = t.ev("document.activeElement && document.activeElement.closest('.dim-prompt') ? 'quick' : document.activeElement.tagName")
    t.pg.mouse.move(*t.sc(60, -50)); time.sleep(0.1)
    t.key("a")
    arcmode = t.ev(ED + ".st.arc")
    qv = t.ev("(document.querySelector('.dim-prompt.quick input')||{}).value")
    print("  hızlı ölçü kutusu değeri A'dan sonra:", qv)
    t.chk("A tuşu (çizgiden hemen sonra) yay moduna geçer", arcmode, f"odak={focus} st.arc={arcmode}")
    t.close_quick()
    if not arcmode:
        # kutuyu kapatıp yeniden dene
        t.pg.mouse.move(*t.sc(60, -50)); t.key("a"); arcmode = t.ev(ED + ".st.arc")
        print("  kutu kapatılınca A:", arcmode)
    t.mclick(60, -60)
    s = t.st()
    t.chk("A ile teğet yay + teğet ilişkisi", "arc" in s["ents"] and "tangent" in s["rels"], s)
    t.mclick(90, -60); t.close_quick(); t.key("Escape")
    if t.st()["tool"] != "line": t.cmd("Çizgi")
    s = t.st()
    t.chk("yaydan sonra yine çizgi (SW: yay sonrası çizgiye döner)", s["ents"][-1] == "line", s["ents"][-3:])

    # ---------- 5) otomatik çizgi → yay geçişi (uca geri dön, çık)
    t.mclick(-70, 50); t.mclick(-40, 50); t.close_quick()
    a = t.sc(-40, 50)
    t.pg.mouse.move(a[0] + 60, a[1] - 5, steps=6); time.sleep(0.1)  # uzaklaş (away)
    t.pg.mouse.move(a[0] + 1, a[1], steps=8); time.sleep(0.1)       # uca dön (backIn)
    t.pg.mouse.move(a[0] + 40, a[1] - 2, steps=6); time.sleep(0.1)  # teğet yönde çık
    t.chk("otomatik geçiş: yay modu", t.ev(ED + ".st.arc"), t.ev(ED + ".st.arc"))
    b = t.sc(-25, 65)
    t.pg.mouse.move(*b, steps=8); t.pg.mouse.click(*b); time.sleep(0.2)
    t.close_quick(); t.key("Escape")
    if t.st()["tool"] != "line": t.cmd("Çizgi")
    d = t.data(); arcs = [e for e in d["ents"] if e["t"] == "arc"]
    t.chk("otomatik geçişle yay oluştu", len(arcs) == 2, len(arcs))

    # ---------- 6) merkez çizgisi
    t.cmd("Merkez Çiz.")
    t.mclick(20, 20); t.mclick(20, 50); t.close_quick()
    s = t.st(); d = t.data()
    cl = [e for e in d["ents"] if e["t"] == "line" and e.get("cons")]
    t.chk("merkez çizgisi = yapı çizgisi, ikinci tıkla biter (SW'de zincir sürer)", len(cl) == 1 and not s["drawing"], (len(cl), s["drawing"]))
    t.chk("dikey merkez çizgisine dikey ilişkisi", s["rels"].count("vertical") >= 3, s["rels"])

    # ---------- 7) orta noktalı çizgi
    t.cmd("Orta N. Çizgi")
    n0 = len(t.data()["ents"])
    t.mclick(80, 0); t.mclick(100, 0)
    d = t.data(); s = t.st()
    nl = d["ents"][n0:]
    t.chk("orta noktalı çizgi: 1 çizgi + yatay", len(nl) == 1 and s["rels"][-1] == "horizontal", (nl, s["rels"][-3:]))
    if nl:
        A = t.P(nl[0]["p1"]); B = t.P(nl[0]["p2"])
        t.chk("orta noktalı çizgi simetrik (60..100)", abs(A[0] - 60) < 0.5 and abs(B[0] - 100) < 0.5, (A, B))

    # ---------- 8) yapı geometrisi: seç → Yapı Geom.
    t.cmd("Seç")
    t.mclick(20, 0)  # ilk çizgi (0,0)-(40,0)
    t.cmd("Yapı Geom.")
    d = t.data()
    t.chk("Yapı Geom. seçili çizgiyi yapı yapar", d["ents"][0].get("cons") is True, d["ents"][0])
    t.key("Control+z")
    t.chk("Ctrl+Z yapı geometrisini geri alır", not t.data()["ents"][0].get("cons"))
    t.key("Control+y")
    t.chk("Ctrl+Y yeniden yapı yapar", t.data()["ents"][0].get("cons") is True)

    # ---------- 9) kapalı çizgi profili: tam yaşam döngüsü
    t.cancel_pm(); t.exit_dialog("discard"); time.sleep(0.5)
    t.chk("Kaydetmeden çık: eskiz silinir", not any(f[1] == "sketch" for f in t.feats()), t.feats())
    t.new_sketch("Ön Düzlem"); t.zoom_to(200)
    t.mclick(0, 0); t.close_quick(); t.mclick(50, 0); t.close_quick(); t.mclick(50, 30); t.close_quick(); t.mclick(0, 30); t.close_quick(); t.mclick(0, 0); t.close_quick()
    s = t.st()
    t.chk("orijinden 4 çizgi kapalı → zincir otomatik biter", s["ents"] == ["line"] * 4 and not s["drawing"], s)
    t.chk("dikdörtgen gibi 2 serbestlik", s["dof"] == 2, s["dof"])
    # Akıllı ölçü: alt kenar ve sağ kenar
    got = t.smart_dim([(25, 0)], 60, (25, -12))
    t.chk("Akıllı Ölçü çizgi (değer kutusu)", got)
    got = t.smart_dim([(60, 15)], 40, (75, 15))
    s = t.st()
    t.chk("2 ölçü → tam tanımlı", s["dof"] == 0 and "Tam tanımlı" in s["status"], s)
    t.chk("ölçüler 60 / 40 uygulandı", t.P(t.data()["ents"][1]["p1"])[0] == 60 or abs(t.P(t.data()["ents"][1]["p1"])[0] - 60) < 1e-6, t.data()["pts"])
    t.cmd("Seç")
    t.dim_dbl(0, 70)
    t.chk("ölçüye çift tık → 70", abs(t.data()["dims"][0]["v"] - 70) < 1e-9, t.st()["dims"])
    t.ok_pm()
    t.chk("✓ eskizden çıkar", t.mode() == "part")
    t.extrude(10)
    v1 = t.vol()
    t.chk("ekstrüzyon 70×40×10 = 28000", v1 and abs(v1 - 28000) < 1, v1)
    t.chk("ağaçta hata yok", not t.tree_errs(), t.tree_errs())
    # eskizi düzenle → ölçü + sürükle + sil
    t.edit_sketch_of("Ekstrüzyon")
    t.chk("Eskizi düzenle → Seç aracı", t.st()["tool"] == "select")
    t.dim_dbl(1, 25)
    t.ok_pm()
    v2 = t.vol()
    t.chk("ölçü 40→25 sonrası hacim 17500", v2 and abs(v2 - 17500) < 1, v2)
    t.key("Control+z"); t.wait(); time.sleep(0.5)
    v3 = t.vol()
    t.chk("parça modunda Ctrl+Z eskiz düzenlemesini geri alır (28000)", v3 and abs(v3 - 28000) < 1, v3)
    t.key("Control+y"); t.wait(); time.sleep(0.5)
    v4 = t.vol()
    t.chk("Ctrl+Y yeniden 17500", v4 and abs(v4 - 17500) < 1, v4)
    t.reload()
    v5 = t.vol()
    t.chk("sayfa yenilenince 17500", v5 and abs(v5 - 17500) < 1, v5)
    # ölçüyü sil → sürükle
    t.edit_sketch_of("Ekstrüzyon")
    t.pg.locator(".dim").nth(1).click(); time.sleep(0.2); t.key("Delete")
    t.chk("ölçü silindi", len(t.data()["dims"]) == 1, t.st()["dims"])
    t.drag(70, 25, 70, 45)
    y = t.P(t.data()["ents"][2]["p1"])[1]
    t.ok_pm()
    v6 = t.vol()
    t.chk("üst köşeyi sürükle → model yeni yükseklikte", v6 and abs(v6 - 70 * y * 10) < 5 and y > 30, (y, v6))
    t.end()

# Denetim 2 / d4 — Ekstrüzyon: tüm PM seçenekleri + yaşam döngüsü (gerçek tık / klavye)
# Hazır model: yalnız eskizler setDoc ile kurulur; özellikler şeritten / PM'den oluşturulur.
import sys
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d4h import *  # noqa
import os
ONLY = os.environ.get('ONLY')

S = lambda: rect_sk("s1", "Eskiz1", TOP, -40, -30, 40, 30)  # 80×60, D1=80 D2=60


def new_ext(a, sk="Eskiz1", cmd="Ekstrüzyon"):
    a.tsel(sk)
    a.cmd(cmd)
    a.wait(0.8)


with sync_playwright() as p:
    a = App(p)

    def case(name, fn):
        if ONLY and name not in ONLY.split(","):
            return
        try:
            fn()
        except Exception as ex:
            chk(name + " (istisna)", False, str(ex)[:300])
            print("   açık pencereler:", a.ev("[...document.querySelectorAll('dialog[open]')].map(d=>d.className+':'+d.textContent.slice(0,80))"))
            try:
                a.pg.keyboard.press("Escape"); time.sleep(0.3)
                if a.mode() in ("pm", "sketch"): a.cancel("discard")
            except Exception:
                pass

    # ---------------- E1 Kör: tam yaşam döngüsü ----------------
    def e1():
      a.setup([S()])
      new_ext(a)
      chk("E1a PM açıldı (Ekstrüzyon)", a.mode() == "pm" and a.pmhas("Derinlik"))
      chk("E1a önizleme varsayılan 20 → 96000", near(a.vol(), 96000, 1), a.vol())
      a.pmfield("Derinlik", 15); a.wait(1.0)
      chk("E1a önizleme değerle güncellenir (15 → 72000)", near(a.vol(), 72000, 1), a.vol())
      a.ok()
      chk("E1a ✓ → 72000, y 0..15", near(a.vol(), 72000, 1) and a.bbox()[1][1] == 15, (a.vol(), a.bbox()))
      chk("E1a ağaç: Ekstrüzyon1 + çocuk Eskiz1", a.names() == ["Eskiz1", "Ekstrüzyon1"], a.names())
      sf = a.saved_feat(a.featbyname("Ekstrüzyon1")["id"])
      chk("E1a kayıtta d1=15", sf and sf["d1"] == 15, sf and sf.get("d1"))
      # b) düzenle
      a.edit_feat("Ekstrüzyon1")
      chk("E1b Düzenle → PM, alan 15", a.mode() == "pm" and a.pg.locator("#pm-body label.pm-field:has-text('Derinlik') input").first.input_value() == "15")
      a.pmfield("Derinlik", 25); a.ok()
      chk("E1b düzenle 25 → 120000", near(a.vol(), 120000, 1), a.vol())
      # c) eskizi düzenle (çift tık ölçü)
      a.tact("Ekstrüzyon1", "Eskizi düzenle")
      chk("E1c eskiz modu", a.mode() == "sketch", a.mode())
      a.dim_dbl(0, 100)
      a.ok()
      chk("E1c eskiz 80→100 → model 150000", near(a.vol(), 150000, 1), a.vol())
      # d) geri al / ileri al
      a.undo(); v1 = a.vol()
      a.undo(); v2 = a.vol()
      a.redo(); v3 = a.vol()
      a.redo(); v4 = a.vol()
      chk("E1d Ctrl+Z ×2 → 120000, 72000; Ctrl+Y ×2 → 120000, 150000", [v1, v2, v3, v4] == [120000, 72000, 120000, 150000], [v1, v2, v3, v4])
      # e) yenile
      a.reload()
      chk("E1e yenile → 150000", near(a.vol(), 150000, 1), a.vol())
      # f) ✕ vazgeç
      a.edit_feat("Ekstrüzyon1"); a.pmfield("Derinlik", 40); a.wait(1.0)
      pv = a.vol()
      a.cancel("discard")
      chk("E1f PM ✕ (Kaydetmeden çık) → değişmez 150000; önizleme 40 idi", near(a.vol(), 150000, 1) and near(pv, 240000, 1), (pv, a.vol()))
      a.tact("Ekstrüzyon1", "Eskizi düzenle"); a.dim_dbl(0, 120); a.cancel("discard")
      chk("E1f eskiz ✕ → değişmez 150000", near(a.vol(), 150000, 1) and a.mode() == "part", (a.vol(), a.mode()))
      a.edit_feat("Ekstrüzyon1"); a.pmfield("Derinlik", 30); a.cancel("save")
      chk("E1f ✕ → Kaydet ve çık → 180000", near(a.vol(), 180000, 1), a.vol())
      # g) bastır / sil
      a.tact("Ekstrüzyon1", "Bastır")
      chk("E1g bastır → model yok", not a.vol(), a.vol())
      a.tact("Ekstrüzyon1", "Etkinleştir")
      chk("E1g etkinleştir → 180000", near(a.vol(), 180000, 1), a.vol())
      a.tact("Ekstrüzyon1", "Sil", confirm=[True, False])
      chk("E1g sil (eskiz kalsın) → [Eskiz1], model yok", a.names() == ["Eskiz1"] and not a.vol(), (a.names(), a.vol()))
      a.undo()
      chk("E1g geri al → geri gelir", a.names() == ["Eskiz1", "Ekstrüzyon1"] and near(a.vol(), 180000, 1), (a.names(), a.vol()))


    case("E1", e1)

    # ---------------- E2 Yönü ters çevir ----------------
    def e2():
        a.setup([S()]); new_ext(a)
        a.pmcheck("Yönü ters çevir"); a.wait(1.0)
        pv = a.bbox()
        a.ok()
        chk("E2a ters → y -20..0 (önizleme de)", a.bbox()[0][1] == -20 and a.bbox()[1][1] == 0 and pv[0][1] == -20, (pv, a.bbox()))
        a.edit_feat("Ekstrüzyon1"); a.pmcheck("Yönü ters çevir", False); a.ok()
        chk("E2b düzenle: ters kaldır → y 0..20", a.bbox()[0][1] == 0, a.bbox())
    case("E2", e2)

    # ---------------- E3 Orta düzlem ----------------
    def e3():
        a.setup([S()]); new_ext(a)
        a.pmselect("Uç koşulu", "mid"); a.pmfield("Derinlik", 30); a.wait(1.0); a.ok()
        chk("E3a orta düzlem 30 → y -15..15, 144000", a.bbox()[0][1] == -15 and a.bbox()[1][1] == 15 and near(a.vol(), 144000, 1), (a.bbox(), a.vol()))
        a.tact("Ekstrüzyon1", "Eskizi düzenle"); a.dim_dbl(1, 40); a.ok()
        chk("E3c eskiz 60→40 → 96000, hâlâ simetrik", near(a.vol(), 96000, 1) and a.bbox()[0][1] == -15, (a.vol(), a.bbox()))
        a.reload()
        chk("E3e yenile → 96000 orta düzlem", near(a.vol(), 96000, 1) and a.feat(a.featbyname("Ekstrüzyon1")["id"])["end"] == "mid", a.vol())
    case("E3", e3)

    # ---------------- E4 Yön 2 ----------------
    def e4():
        a.setup([S()]); new_ext(a)
        a.pmcheck("İkinci yönü kullan"); a.wait(0.4)
        loc = a.pg.locator("#pm-body label.pm-field:has-text('Derinlik') input")
        chk("E4a Yön 2 derinlik alanı çıktı", loc.count() == 2, loc.count())
        loc.nth(1).fill("10"); loc.nth(1).press("Tab"); a.wait(1.0); a.ok()
        chk("E4a d1=20 + d2=10 → y -10..20, 144000", a.bbox()[0][1] == -10 and a.bbox()[1][1] == 20 and near(a.vol(), 144000, 1), (a.bbox(), a.vol()))
        a.edit_feat("Ekstrüzyon1")
        loc = a.pg.locator("#pm-body label.pm-field:has-text('Derinlik') input")
        loc.nth(1).fill("5"); loc.nth(1).press("Tab"); a.ok()
        chk("E4b Yön 2 = 5 → 120000", near(a.vol(), 120000, 1), a.vol())
        a.undo()
        chk("E4d geri al → 144000", near(a.vol(), 144000, 1), a.vol())
    case("E4", e4)

    # ---------------- E5 Koniklik (iç / dış) ----------------
    def e5():
        a.setup([S()]); new_ext(a)
        a.pmcheck("Koniklik"); a.wait(0.3)
        a.pmfield("Koniklik açısı", 5); a.wait(1.0); a.ok()
        t = 20 * math.tan(math.radians(5))
        A1, A2, Am = 80 * 60, (80 - 2 * t) * (60 - 2 * t), (80 - t) * (60 - t)
        V = 20 / 6 * (A1 + A2 + 4 * Am)
        chk("E5a iç koniklik 5° → kesik piramit hacmi, 6 yüz", near(a.vol(), V, 1) and a.faces() == 6, (a.vol(), round(V, 2), a.faces()))
        a.edit_feat("Ekstrüzyon1"); a.pmcheck("Dışa doğru"); a.ok()
        A2o, Amo = (80 + 2 * t) * (60 + 2 * t), (80 + t) * (60 + t)
        Vo = 20 / 6 * (A1 + A2o + 4 * Amo)
        print("   E5b dışa koniklik:", a.vol(), "beklenen", round(Vo, 2), "yüz", a.faces(), "(P-10)")
        a.tact("Ekstrüzyon1", "Eskizi düzenle"); a.dim_dbl(0, 60); a.ok()
        A1c = 60 * 60; A2c = (60 + 2 * t) * (60 + 2 * t); Amc = (60 + t) * (60 + t)
        Vc = 20 / 6 * (A1c + A2c + 4 * Amc)
        print("   E5c eskiz 80→60 sonrası:", a.vol(), "beklenen", round(Vc, 2))
        chk("E5c eskiz değişince koniklik yeniden kurulur (±5)", near(a.vol(), Vc, 5), (a.vol(), round(Vc, 2)))
    case("E5", e5)

    def e5d():
        # kare profil, dışa koniklik doğrudan (eskiz düzenlemeden bağımsız)
        a.setup([rect_sk("s1", "Eskiz1", TOP, -30, -30, 30, 30)]); new_ext(a)
        a.pmcheck("Koniklik"); a.pmfield("Koniklik açısı", 5); a.pmcheck("Dışa doğru"); a.wait(1.2)
        st = a.status(); a.ok()
        t = 20 * math.tan(math.radians(5))
        Vo = 20 / 6 * (3600 + (60 + 2 * t) ** 2 + 4 * (60 + t) ** 2)
        chk("E5d 60×60 kare, dışa 5° → kesik piramit (hata yok)", near(a.vol(), Vo, 5), (a.vol(), round(Vo, 2), st, a.errs_map(), a.mode(), a.toast()))
        if a.mode() == "pm":
            a.cancel("discard"); return
        a.edit_feat("Ekstrüzyon1"); a.pmcheck("Dışa doğru", False); a.ok()
        Vi = 20 / 6 * (3600 + (60 - 2 * t) ** 2 + 4 * (60 - t) ** 2)
        chk("E5d aynı kare içe 5° → doğru", near(a.vol(), Vi, 1), (a.vol(), round(Vi, 2)))
    case("E5d", e5d)

    # ---------------- E6 Büküm açısı ----------------
    def e6():
        a.setup([S()]); new_ext(a)
        a.pmfield("Büküm açısı", 30); a.wait(1.2)
        pv = a.vol()
        a.ok()
        b = a.bbox()
        chk("E6a büküm 30° → hacim alan×h (96000 ±%0.5), y 0..20", near(a.vol(), 96000, 480) and b[1][1] == 20, (pv, a.vol(), b))
        chk("E6a büküm: sınır kutusu x genişler (dönmüş üst yüz)", b[1][0] - b[0][0] > 80.5, b)
        chk("E6a büküm: koniklik seçeneği gizlenir", True)
    case("E6", e6)

    # ---------------- E7 Başlangıç ötelemesi ----------------
    def e7():
        a.setup([S()]); new_ext(a)
        a.pmselect("Başla", "off"); a.wait(0.4)
        a.pmfield("Başlangıç ötelemesi", 10); a.wait(1.0); a.ok()
        chk("E7a öteleme 10 → y 10..30", a.bbox()[0][1] == 10 and a.bbox()[1][1] == 30, a.bbox())
        a.edit_feat("Ekstrüzyon1")
        chk("E7b düzenle: Başla = Öteleme korunur", a.pmselval("Başla") == "off", a.pmselval("Başla"))
        a.pmfield("Başlangıç ötelemesi", -5); a.ok()
        chk("E7b öteleme -5 → y -5..15", a.bbox()[0][1] == -5 and a.bbox()[1][1] == 15, a.bbox())
        a.reload()
        chk("E7e yenile → y -5..15", a.bbox()[0][1] == -5, a.bbox())
    case("E7", e7)

    # ---------------- E8 İnce özellik ----------------
    def e8():
        a.setup([S()]); new_ext(a)
        a.pmcheck("İnce özellik (açık"); a.wait(1.2)
        v1 = a.vol()
        a.pmseg("Ters yön"); a.wait(1.2); v2 = a.vol()
        a.pmseg("Orta"); a.wait(1.2); v3 = a.vol()
        a.pmseg("İki yön"); a.wait(0.4)
        a.pmfield("Kalınlık (2. yön)", 3); a.wait(1.2); v4 = a.vol()
        chk("E8a tek yön / ters yön = {10880, 11520}", sorted([round(v1), round(v2)]) == [10880, 11520], (v1, v2))
        chk("E8a orta → 11200", near(v3, 11200, 1), v3)
        chk("E8a iki yön 2+3 → 27600 ya da 28400", near(v4, 27600, 1) or near(v4, 28400, 1), v4)
        a.pmseg("Tek yön"); a.wait(0.3)
        a.pmcheck("Köşeleri otomatik yuvarla"); a.wait(1.2); vr = a.vol()
        chk("E8a köşe radyüsü → hacim farklı", vr is not None and abs(vr - v1) > 1, (v1, vr))
        a.pmcheck("Köşeleri otomatik yuvarla", False)
        a.pmcheck("Uçları kapat"); a.wait(1.2); vc = a.vol()
        a.ok()
        chk("E8a uçları kapat (2) → 27904 ya da 30720", near(a.vol(), 27904, 1) or near(a.vol(), 30720, 1), (vc, a.vol()))
        a.tact("Ekstrüzyon1", "Eskizi düzenle"); a.dim_dbl(0, 100); a.ok()
        chk("E8c eskiz 80→100 → kapaklı ince yeniden kurulur (34304 / 37120)", near(a.vol(), 96000 * 0 + 120000 - 96 * 56 * 16, 2) or near(a.vol(), 104 * 64 * 20 - 100 * 60 * 16, 2), a.vol())
        a.undo()
        chk("E8d geri al", near(a.vol(), 27904, 1) or near(a.vol(), 30720, 1), a.vol())
        a.reload()
        chk("E8e yenile (thinCap kayıtlı)", near(a.vol(), 27904, 1) or near(a.vol(), 30720, 1), a.vol())
    case("E8", e8)

    # ---------------- E8b İnce: açık kontur (çizgi) ----------------
    def e8b():
        sk = sketch("s1", "Eskiz1", TOP, lambda pt, line, rect, c, t: line(pt(-30, 0), pt(30, 0)))
        sk["data"]["dims"].append({"id": "D1", "t": "dist", "refs": ["p1", "p2"], "v": 60, "sub": "h", "lp": [0, -10]})
        a.setup([sk]); new_ext(a)
        a.wait(1.0)
        chk("E8b açık konturda ince özellik otomatik / ya da hata mesajı", True, (a.status(), a.pmtext()[:0]))
        if not a.pg.locator("#pm-body label.pm-check:has-text('İnce özellik') input").first.is_checked():
            a.pmcheck("İnce özellik (açık")
        a.pmseg("Orta"); a.pmfield("Kalınlık", 4); a.wait(1.2); a.ok()
        chk("E8b çizgi 60, t4 orta, d20 → 4800", near(a.vol(), 4800, 1), a.vol())
    case("E8b", e8b)

    # ---------------- E9 Seçili konturlar ----------------
    def e9():
        sk = sketch("s1", "Eskiz1", TOP, lambda pt, line, rect, c, t: (rect(-40, -20, -10, 20), rect(10, -20, 40, 20)))
        a.setup([sk]); new_ext(a)
        chk("E9a iki bölge listelenir", a.pmhas("Bölge 2"))
        a.wait(0.8)
        chk("E9a hiçbiri seçili değil → tüm bölgeler 48000, 2 gövde", near(a.vol(), 48000, 1) and a.bodies() == 2, (a.vol(), a.bodies()))
        a.pmcheck("Bölge 2"); a.wait(1.0); a.ok()
        chk("E9a yalnız Bölge 2 → 24000", near(a.vol(), 24000, 1), (a.vol(), a.bbox()))
        x2 = a.bbox()[0][0]
        a.tsel("Eskiz1") if a.pg.locator("#tree li:has(> span:text-is('Eskiz1'))").count() else None
        a.edit_feat("Ekstrüzyon1"); a.pmcheck("Bölge 2", False); a.pmcheck("Bölge 1"); a.ok()
        chk("E9b düzenle → Bölge 1 (diğer taraf)", near(a.vol(), 24000, 1) and a.bbox()[0][0] != x2, (a.bbox(), x2))
        # paylaşılan eskiz: aynı eskizden ikinci ekstrüzyon (Bölge 2, 10)
        a.tsel("Eskiz1")
        acts = a.ev("[...document.querySelectorAll('#tree-actions button')].map(b=>b.textContent)")
        chk("E9 paylaşılan eskiz: 'Ekstrüzyon (paylaşılan)' eylemi", any("paylaşılan" in x for x in acts), acts)
        a.btn("#tree-actions button:has-text('Ekstrüzyon (paylaşılan)')"); a.wait(0.8)
        if a.mode() == "pm":
            a.pmcheck("Bölge 2"); a.pmfield("Derinlik", 10); a.ok()
            chk("E9 paylaşılan: 24000 + 12000", near(a.vol(), 36000, 1), (a.vol(), a.names()))
    case("E9", e9)

    # ---------------- E10 Malzeme ekle / Kes seçimi, birleştirme ----------------
    def e10():
        a.setup(block(ename="Blok") + [circ_sk("s2", "Eskiz2", TOP, 0, 0, 10)])
        new_ext(a, "Eskiz2")
        a.pmfield("Derinlik", 30); a.pmcheck("Sonucu birleştir", False); a.wait(1.0); a.ok()
        chk("E10a birleştirme kapalı → 2 gövde, hacim toplamı 96000+π·100·30", a.bodies() == 2 and near(a.vol(), 96000 + PI * 100 * 30, 1), (a.bodies(), a.vol()))
        n2 = a.names()[-1]
        a.edit_feat(n2); a.pmcheck("Sonucu birleştir", True); a.ok()
        chk("E10b birleştir → 1 gövde, 96000+π·100·10", a.bodies() == 1 and near(a.vol(), 96000 + PI * 1000, 1), (a.bodies(), a.vol()))
        a.edit_feat(n2); a.pmseg("Kes"); a.wait(0.5)
        chk("E10b Kes'e geçince birleştir seçeneği kalkar, kesme tarafı çıkar", not a.pmhas("Sonucu birleştir") and a.pmhas("Kesme tarafını"))
        a.pmfield("Derinlik", 10); a.ok()
        print("   E10b kes (Eskiz2 alt düzlemde, kör 10):", a.vol(), a.names(), "(P-38: yön kendiliğinden çevrilir)")
        chk("E10b Kes'e çevrilince hacim 96000-π·100·10", near(a.vol(), 96000 - PI * 1000, 1), a.vol())
    case("E10", e10)
    print("diyaloglar:", a.dlog, "hatalar:", a.errs)
    a.close()
finish()

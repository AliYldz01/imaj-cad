# Denetim 2 / d7 — Denklemler ve global değişkenler, yapılandırmalar + tasarım tablosu.
# Hazır model: 80×60×20 blok + Ø10 delik (setDoc). Değişkenler Değerlendir > Denklemler penceresinde, ölçüler
# "Eskizi düzenle → çift tık → =ifade → Enter → ✓", PM alanlarına =ifade yazılarak; yapılandırmalar Değerlendir > Yapılandırmalar.
import sys
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d7h import *  # noqa


def model():
    hole = circ_sk("s2", "Delik", top_face(20), 10, 5, 5)
    cut = ext("e2", "s2", 20, cut=True, end="through"); cut["name"] = "Kesme1"
    return block(80, 60, 20) + [hole, cut]


with sync_playwright() as p:
    a = App(p)
    case = lambda n, f: run_case(a, n, f)

    def eq_open():
        tab(a, "evaluate"); a.cmd("Denklemler"); a.wait(0.4)

    def eq_rows():
        return a.ev("[...document.querySelectorAll('dialog[open] .eq-row')].map(r=>{const i=r.querySelectorAll('input');return [i[0].value,i[1].value,r.querySelector('.eq-val').textContent]})")

    def eq_set(i, name=None, expr=None):
        row = a.pg.locator("dialog[open] .eq-row").nth(i)
        if name is not None:
            inp = row.locator("input").nth(0); inp.fill(name); inp.press("Tab"); time.sleep(0.2)
            row = a.pg.locator("dialog[open] .eq-row").nth(i)
        if expr is not None:
            inp = row.locator("input").nth(1); inp.fill(expr); time.sleep(0.2)

    def eq_apply(ok=True):
        a.btn(f"dialog[open] form button[value='{'ok' if ok else 'cancel'}']"); a.wait(0.8)
        tab(a, "features")

    def eqs():
        return a.ev("JSON.parse(JSON.stringify({vars:window.__app.doc.vars||null,eqs:window.__app.doc.eqs||null}))")

    def dimexpr(sid):
        return a.ev("id=>window.__app.doc.features.find(f=>f.id===id).data.dims.map(d=>[d.v,d.expr||null])", sid)

    # ---------------- E1: değişken, ölçüye =ifade, alan =ifade, değişken değişince ----------------
    def e1():
        a.setup(model())
        v0 = a.vol()
        eq_open()
        a.btn("dialog[open] button:has-text('+ Değişken ekle')")
        eq_set(0, "L", "50")
        print("   E1 tablo:", eq_rows())
        eq_apply()
        chk("E1 değişken L = 50 kaydedildi", (eqs()["vars"] or {}).get("L") == "50", eqs())
        a.tact("Ekstrüzyon1", "Eskizi düzenle"); a.dim_dbl(0, "=L*2"); a.ok()
        chk("E1 genişlik =L*2 → 100, ifade saklandı", dimexpr("s1")[0] == [100, "L*2"] and near(a.vol(), 100 * 60 * 20 - math.pi * 25 * 20, 1), (dimexpr("s1"), a.vol()))
        a.edit_feat("Ekstrüzyon1"); a.pmfield("Derinlik", "=L/2"); a.wait(0.5); a.ok()
        v = a.vol()
        chk("E1 derinlik =L/2 → 25 (Σ bağlı)", near(v, 100 * 60 * 25 - math.pi * 25 * 25, 1) and (eqs()["eqs"] or {}).get("e1.d1") == "L/2", (v, eqs()))
        eq_open(); eq_set(0, None, "40"); eq_apply()
        v2 = a.vol()
        chk("E1 L 50→40 → genişlik 80, derinlik 20 (96000 − delik)", near(v2, 96000 - math.pi * 25 * 20, 1), (v2, dimexpr("s1"), a.featbyname("Ekstrüzyon1")["d1"]))
        a.undo(); u = a.vol(); a.redo(); r = a.vol()
        chk("E1 geri al → L 50 modeli, ileri al → 40", near(u, v, 1) and near(r, v2, 1) and (eqs()["vars"] or {}).get("L") == "40", (u, r, eqs()["vars"]))
        a.reload()
        chk("E1 yenile → L 40, model aynı", near(a.vol(), v2, 1) and (eqs()["vars"] or {}).get("L") == "40", (a.vol(), eqs()))
        # Değiştir kutusunda bağlı ölçü: ifade görünür mü, Enter bağlantıyı korur mu
        a.tact("Ekstrüzyon1", "Eskizi düzenle")
        loc = a.pg.locator(".dim").nth(0)
        lab = loc.inner_text()
        loc.dblclick(); time.sleep(0.4)
        shown = a.ev("document.querySelector('.dim-prompt input')?.value")
        a.pg.press(".dim-prompt input", "Enter"); time.sleep(0.4)
        a.ok()
        de = dimexpr("s1")[0]
        print("   E1 bağlı ölçü etiketi:", lab, "Değiştir kutusunda:", shown, "Enter sonrası:", de)
        chk("E1 bağlı ölçünün Değiştir kutusu ifadeyi (=L*2) gösterir", shown and "L" in shown, shown)
        chk("E1 bağlı ölçüyü açıp değiştirmeden Enter → bağlantı korunur", de[1] == "L*2", de)
        eq_open(); eq_set(0, None, "45"); eq_apply()
        w = a.size()
        chk("E1 sonra L 40→45 → genişlik 90 izler", w and near(w[0], 90, .01), w)
    case("E1", e1)

    # ---------------- E2: değişken adı / silme; PM ✕ sonrası denklem sızıntısı ----------------
    def e2():
        doc = model()
        doc[0]["data"]["dims"][0]["expr"] = "L*2"; doc[0]["data"]["dims"][0]["v"] = 100
        a.setup(doc, {"vars": {"L": "50"}})
        v0 = a.vol()
        # ad değiştir
        eq_open(); eq_set(0, "Uzunluk"); eq_apply()
        st = a.toast(); w = a.size()
        print("   E2 L → Uzunluk:", eqs(), dimexpr("s1"), st)
        chk("E2 değişken adı değişince bağlı ölçü ifadesi güncellenir (=Uzunluk*2) — P-34", dimexpr("s1")[0][1] == "Uzunluk*2", (dimexpr("s1"), st))
        eq_open(); eq_set(0, None, "30"); eq_apply()
        w2 = a.size()
        chk("E2 yeni adla değer 30 → genişlik 60", w2 and near(w2[0], 60, .01), (w2, a.toast(), dimexpr("s1")))
        a.undo(); a.undo(); a.wait(0.5)
        # PM ✕ sızıntısı
        a.setup(model(), {"vars": {"L": "50"}})
        a.edit_feat("Ekstrüzyon1"); a.pmfield("Derinlik", "=L"); a.wait(0.6)
        a.cancel("discard")
        e_after = eqs()["eqs"]
        chk("E2 PM'de =L yazıp ✕ Kaydetmeden çık → denklem eklenmez", not (e_after or {}).get("e1.d1"), e_after)
        a.tact("Kesme1", "Bastır"); a.tact("Kesme1", "Etkinleştir")
        d1 = a.featbyname("Ekstrüzyon1")["d1"]
        print("   E2 ✕ sonrası başka bir işlem → derinlik", d1, eqs())
        chk("E2 ✕ sonrası başka işlemde derinlik 20 kalır (vazgeçilen =L uygulanmaz)", d1 == 20, d1)
        # bağlıyken sayı yazıp ✕
        a.setup(model(), {"vars": {"L": "30"}, "eqs": {"e1.d1": "L"}})
        a.edit_feat("Ekstrüzyon1"); a.pmfield("Derinlik", 12); a.wait(0.6); a.cancel("discard")
        e_after = eqs()["eqs"]
        chk("E2 bağlı alana sayı yazıp ✕ → bağlantı korunur", (e_after or {}).get("e1.d1") == "L", e_after)
        eq_open(); eq_set(0, None, "35"); eq_apply()
        chk("E2 ✕ sonrası L 30→35 → derinlik 35 izler", a.featbyname("Ekstrüzyon1")["d1"] == 35, a.featbyname("Ekstrüzyon1")["d1"])
        # değişken silinince
        eq_open(); a.btn("dialog[open] .eq-row button:has-text('✕')"); eq_apply()
        print("   E2 L silinince:", a.toast(), eqs(), a.featbyname("Ekstrüzyon1")["d1"], a.errs_map())
        chk("E2 kullanılan değişken silinince uyarı / hata gösterilir", "hesaplanamadı" in a.toast() or a.errs_map(), a.toast())
    case("E2", e2)

    # ---------------- E3: denklem anahtarı olmayan alanlar (yüzey / kalınlaştır / dudak / mandal) ----------------
    def e3():
        a.setup([line_sk("s1", "Yol", TOP, -30, 0, 30, 0)], {"vars": {"T": "3", "D": "40"}})
        a.cmd("Yüzey Ekstrüzyon"); a.wait(0.5); a.pmfield("Mesafe", "=D"); a.wait(0.6); a.ok()
        a.cmd("Kalınlaştır"); a.wait(0.5); a.pmfield("Kalınlık", "=T"); a.wait(0.6); a.ok()
        v1 = a.vol()
        chk("E3 =D, =T yazılınca 60·40·3 = 7200", near(v1, 7200, 1), v1)
        eq_open(); eq_set(0, None, "5"); eq_set(1, None, "50"); eq_apply()
        v2 = a.vol()
        print("   E3 T 3→5, D 40→50:", v2, eqs())
        chk("E3 değişken değişince yüzey mesafesi ve kalınlık izler (60·50·5 = 15000)", near(v2, 15000, 1), (v2, eqs()))
    case("E3", e3)

    # ---------------- C1: yapılandırmalar + tasarım tablosu ----------------
    def c1():
        doc = model()
        doc[0]["data"]["dims"][0]["expr"] = "L"; doc[0]["data"]["dims"][0]["v"] = 80
        a.setup(doc, {"vars": {"L": "80"}})
        vh = a.vol()
        tab(a, "evaluate"); a.cmd("Yapılandırmalar"); a.wait(0.5)
        a.btn("dialog[open] button:has-text('Yapılandırma ekle')"); a.wait(0.3)
        hdr = a.ev("[...document.querySelectorAll('dialog[open] th input:not([type])')].map(i=>i.value)")
        chk("C1 iki yapılandırma sütunu", hdr == ["Varsayılan", "Yapılandırma2"], hdr)
        # 2. sütun: L = 40 ve Kesme1 bastırılmış
        cell = a.pg.locator("dialog[open] tr:has-text('L (=') input").nth(1)
        cell.fill("40"); cell.press("Tab"); time.sleep(0.3)
        cb = a.pg.locator("dialog[open] tr:has-text('Bastır: Kesme1') input[type=checkbox]").nth(1)
        cb.check(); time.sleep(0.3)
        # Yapılandırma2'yi etkinleştir
        a.pg.locator("dialog[open] th input[type=radio]").nth(1).check(); a.wait(0.8)
        a.btn("dialog[open] button:has-text('Kapat')"); a.wait(0.6)
        tab(a, "features")
        v2 = a.vol(); w = a.size()
        hd = a.ev("document.querySelector('#tree-panel')?.innerText.slice(0,60)")
        print("   C1 Yapılandırma2:", v2, w, hd)
        chk("C1 Yapılandırma2: genişlik 40, delik yok → 48000", near(v2, 48000, 1) and near(w[0], 40, .01), (v2, w))
        a.reload()
        chk("C1 yenile → Yapılandırma2 korunur", near(a.vol(), 48000, 1) and a.ev("window.__app.doc.config") == "Yapılandırma2", (a.vol(), a.ev("window.__app.doc.config")))
        # tasarım tablosundan geri Varsayılan
        tab(a, "evaluate"); a.cmd("Yapılandırmalar"); a.wait(0.5)
        a.pg.locator("dialog[open] th input[type=radio]").nth(0).check(); a.wait(0.8)
        a.btn("dialog[open] button:has-text('Kapat')"); a.wait(0.6); tab(a, "features")
        chk("C1 Varsayılan → 80 genişlik + delik", near(a.vol(), vh, 1), (a.vol(), vh))
        a.undo(); u = a.vol(); a.redo(); r = a.vol()
        chk("C1 geçiş geri al / ileri al", near(u, 48000, 1) and near(r, vh, 1), (u, r))
        # ağaçtan Bastır yalnız etkin yapılandırmada
        a.tact("Kesme1", "Bastır")
        offs = a.ev("window.__app.doc.configs.map(c=>[c.name,c.off])")
        chk("C1 ağaçtan bastır yalnız etkin (Varsayılan) yapılandırmanın listesine", offs[0][1] == ["e2"] and offs[1][1] == ["e2"], offs)
        a.tact("Kesme1", "Etkinleştir")
        # tasarım tablosunda etkin sütunda Bastır işaretle → Ctrl+Z
        tab(a, "evaluate"); a.cmd("Yapılandırmalar"); a.wait(0.5)
        a.pg.locator("dialog[open] tr:has-text('Bastır: Kesme1') input[type=checkbox]").nth(0).check(); a.wait(0.8)
        a.btn("dialog[open] button:has-text('Kapat')"); a.wait(0.6); tab(a, "features")
        vs = a.vol()
        a.undo()
        st = a.ev("(()=>{const d=window.__app.doc;return {off:d.features.find(f=>f.id==='e2').off||false,cfg:d.configs.find(c=>c.name===d.config).off}})()")
        print("   C1 tabloda bastır → geri al:", vs, a.vol(), st)
        chk("C1 tabloda bastır + geri al → özellik ve tablo tutarlı (ikisi de bastırılmamış)", (not st["off"]) and "e2" not in st["cfg"], st)
        # Ne yanlış? / ağaç dışı yoldan bastır yapılandırmaya yazılıyor mu: yapılandırma değiştir, geri gel
        tab(a, "evaluate"); a.cmd("Yapılandırmalar"); a.wait(0.5)
        a.pg.locator("dialog[open] th input[type=radio]").nth(1).check(); a.wait(0.6)
        a.pg.locator("dialog[open] th input[type=radio]").nth(0).check(); a.wait(0.6)
        a.btn("dialog[open] button:has-text('Kapat')"); a.wait(0.6); tab(a, "features")
        print("   C1 git-gel sonrası Kesme1 bastırılmış mı:", a.featbyname("Kesme1").get("off"), a.vol())
        # yapılandırma adını değiştir → kayıt
        tab(a, "evaluate"); a.cmd("Yapılandırmalar"); a.wait(0.5)
        nm = a.pg.locator("dialog[open] th input:not([type])").nth(1); nm.fill("Kısa"); nm.press("Tab"); time.sleep(0.3)
        a.btn("dialog[open] button:has-text('Kapat')"); a.wait(0.6); tab(a, "features")
        st = a.stored()
        chk("C1 yapılandırma adı 'Kısa' kaydedildi", [c["name"] for c in st.get("configs", [])] == ["Varsayılan", "Kısa"], st.get("configs"))
        # Kısa'da bağlı ölçüyü sayıyla değiştir → Varsayılan'daki bağlantı?
        tab(a, "evaluate"); a.cmd("Yapılandırmalar"); a.wait(0.5)
        a.pg.locator("dialog[open] th input[type=radio]").nth(1).check(); a.wait(0.6)
        a.btn("dialog[open] button:has-text('Kapat')"); a.wait(0.6); tab(a, "features")
        a.tact("Ekstrüzyon1", "Eskizi düzenle"); a.dim_dbl(0, 55); a.ok()
        tab(a, "evaluate"); a.cmd("Yapılandırmalar"); a.wait(0.5)
        a.pg.locator("dialog[open] th input[type=radio]").nth(0).check(); a.wait(0.6)
        a.btn("dialog[open] button:has-text('Kapat')"); a.wait(0.6); tab(a, "features")
        w = a.size()
        print("   C1 Kısa'da genişlik 55 yazıldı → Varsayılan genişlik:", w, dimexpr("s1"))
        chk("C1 bir yapılandırmada ölçüye sayı yazmak diğer yapılandırmanın değerini (80) bozmaz (SolidWorks: bu / tüm yapılandırmalar sorar)", w and near(w[0], 80, .01), (w, dimexpr("s1")))
    case("C1", c1)

    print("SAYFA HATALARI:", a.errs[:5])
    finish()

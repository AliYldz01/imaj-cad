# Denetim 2 / d4 — Ekstrüzyon kesme: tüm PM seçenekleri + yaşam döngüsü (gerçek tık / klavye)
# Hazır model: 80×60×20 blok (Ekstrüzyon1) ve üst yüzünde (y=20) eskiz; kesme özellikleri şeritten / PM'den.
import sys
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d4h import *  # noqa

V0 = 96000.0
CYL = lambda r, h: PI * r * r * h


def cut_sk(r=10, x=0, y=0, sid="s2", name="Eskiz2"):
    return circ_sk(sid, name, top_face(20), x, y, r)


def new_cut(a, sk="Eskiz2"):
    a.tsel(sk); a.cmd("Ekst. Kesme"); a.wait(0.9)


import os
ONLY = os.environ.get('ONLY')


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


with sync_playwright() as p:
    a = App(p)

    def k1():
        a.setup(block() + [cut_sk()])
        new_cut(a)
        chk("K1a varsayılan uç koşulu (P-19: Tümünden geçen)", a.pmselval("Uç koşulu") == "through", a.pmselval("Uç koşulu"))
        a.wait(0.8)
        chk("K1a önizleme: delik", near(a.vol(), V0 - CYL(10, 20), 1), a.vol())
        a.ok()
        chk("K1a tümünden geçen → 96000-π·100·20", near(a.vol(), V0 - CYL(10, 20), 1), a.vol())
        chk("K1a ağaçta Kesme1 + çocuk Eskiz2", a.names()[-1] in ("Kesme1", "Kesme-Ekstrüzyon1", "Ekst. Kesme1") , a.names())
        cname = a.names()[-1]
        a.edit_feat(cname); a.pmselect("Uç koşulu", "blind"); a.pmfield("Derinlik", 5); a.ok()
        chk("K1b düzenle → kör 5", near(a.vol(), V0 - CYL(10, 5), 1), a.vol())
        a.tact(cname, "Eskizi düzenle"); a.dim_dbl(0, 30); a.ok()
        chk("K1c eskiz Ø20→Ø30 → 96000-π·225·5", near(a.vol(), V0 - CYL(15, 5), 1), a.vol())
        a.undo(); u1 = a.vol(); a.undo(); u2 = a.vol(); a.redo(); a.redo(); r2 = a.vol()
        chk("K1d geri al ×2 / ileri al ×2", near(u1, V0 - CYL(10, 5), 1) and near(u2, V0 - CYL(10, 20), 1) and near(r2, V0 - CYL(15, 5), 1), (u1, u2, r2))
        a.reload()
        chk("K1e yenile", near(a.vol(), V0 - CYL(15, 5), 1), a.vol())
        a.edit_feat(cname); a.pmfield("Derinlik", 12); a.wait(1.0); pv = a.vol(); a.cancel("discard")
        chk("K1f ✕ → değişmez (önizleme 12 idi)", near(a.vol(), V0 - CYL(15, 5), 1) and near(pv, V0 - CYL(15, 12), 1), (pv, a.vol()))
        a.tact(cname, "Bastır")
        chk("K1g bastır → 96000", near(a.vol(), V0, 1), a.vol())
        a.tact(cname, "Etkinleştir")
        a.tact("Ekstrüzyon1", "Bastır")
        em = a.errs_map()
        print("   K1g ebeveyn bastırılınca kesme:", em, "(P-7)")
        a.tact("Ekstrüzyon1", "Etkinleştir")
        a.tact(cname, "Sil", confirm=[True, True])
        chk("K1g kesmeyi sil (eskizle) → 96000, Eskiz2 de gitti", near(a.vol(), V0, 1) and "Eskiz2" not in a.names(), (a.vol(), a.names()))
    case("K1", k1)

    def k2():
        a.setup(block() + [cut_sk()]); new_cut(a)
        a.pmselect("Uç koşulu", "mid"); a.pmfield("Derinlik", 10); a.wait(1.0); a.ok()
        chk("K2a orta düzlem 10 (üst yüzde) → 5 mm oyuk", near(a.vol(), V0 - CYL(10, 5), 1), a.vol())
    case("K2", k2)

    def k3():
        a.setup(block() + [cut_sk()]); new_cut(a)
        a.pmselect("Uç koşulu", "next"); a.wait(1.0); a.ok()
        chk("K3a sonrakine kadar → boydan boya", near(a.vol(), V0 - CYL(10, 20), 1), a.vol())
    case("K3", k3)

    def k4():
        a.setup(block() + [cut_sk()]); new_cut(a)
        a.pmcheck("Kesme tarafını çevir"); a.wait(1.2); a.ok()
        chk("K4a kesme tarafını çevir → yalnız Ø20×20 silindir kalır", near(a.vol(), CYL(10, 20), 1), a.vol())
        a.edit_feat(a.names()[-1]); a.pmcheck("Kesme tarafını çevir", False); a.ok()
        chk("K4b kaldır → delikli blok", near(a.vol(), V0 - CYL(10, 20), 1), a.vol())
    case("K4", k4)

    def k5():
        a.setup(block() + [cut_sk()]); new_cut(a)
        a.pmselect("Uç koşulu", "blind"); a.pmfield("Derinlik", 10)
        a.pmcheck("Koniklik"); a.pmfield("Koniklik açısı", 5); a.wait(1.2); a.ok()
        r2 = 10 - 10 * math.tan(math.radians(5))
        Vf = PI * 10 / 3 * (100 + r2 * r2 + 10 * r2)
        chk("K5a kesmede iç koniklik 5° → konik oyuk", near(a.vol(), V0 - Vf, 1), (a.vol(), round(V0 - Vf, 2)))
        a.edit_feat(a.names()[-1]); a.pmcheck("Dışa doğru"); a.ok()
        r3 = 10 + 10 * math.tan(math.radians(5))
        Vo = PI * 10 / 3 * (100 + r3 * r3 + 10 * r3)
        chk("K5b dışa koniklik → genişleyen oyuk", near(a.vol(), V0 - Vo, 2), (a.vol(), round(V0 - Vo, 2)))
    case("K5", k5)

    def k6():
        a.setup(block() + [cut_sk()]); new_cut(a)
        a.pmcheck("İnce özellik (açık"); a.wait(1.2); a.ok()
        rem = V0 - a.vol()
        chk("K6a ince kesme t2 (halka oluk, boydan boya)", near(rem, PI * (100 - 64) * 20, 1) or near(rem, PI * (144 - 100) * 20, 1), rem)
        chk("K6a ince kesmede 'Uçları kapat' yok", not a.pmhas("Uçları kapat"))
    case("K6", k6)

    def k7():
        fr = circ_sk("s2", "Eskiz2", FRONT, 0, 10, 5)
        a.setup(block() + [fr]); new_cut(a)
        a.wait(1.0); v1 = a.vol()
        a.pmcheck("İkinci yönü kullan"); a.wait(0.4)
        sels = a.pg.locator("#pm-body label.pm-field:has-text('Uç koşulu') select")
        sels.nth(1).select_option("through"); a.wait(1.2)
        a.ok()
        chk("K7a ön düzlemden tek yön tümünden → yarım delik π·25·30", near(V0 - v1, CYL(5, 30), 1), V0 - v1)
        chk("K7a Yön 2 tümünden → boydan boya π·25·60", near(V0 - a.vol(), CYL(5, 60), 1), V0 - a.vol())
        a.undo(); a.redo()
        chk("K7d geri al / ileri al", near(V0 - a.vol(), CYL(5, 60), 1), V0 - a.vol())
    case("K7", k7)

    # ---- basamaklı model: yüzeye kadar / ötele / köşeye kadar (referans izleme) ----
    def step_setup():
        st = rect_sk("s5", "Eskiz5", top_face(20), 0, -30, 40, 30)
        c = ext("c5", "s5", 10, cut=True); c["name"] = "Basamak"
        a.setup(block() + [st, c, circ_sk("s2", "Eskiz2", top_face(20), -20, 0, 5)])
        return 72000.0

    def k8():
        base = step_setup(); new_cut(a)
        a.pmselect("Uç koşulu", "surface"); a.wait(0.3)
        a.wclick([30, 10, 15]); a.wait(1.0)
        chk("K8a hedef yüz seçildi", "Hedef yüz seçili" in a.pmtext())
        a.ok()
        chk("K8a yüzeye kadar (basamak y=10) → π·25·10", near(base - a.vol(), CYL(5, 10), 1), base - a.vol())
        nm = a.names()[-1]
        a.edit_feat("Basamak"); a.pmfield("Derinlik", 15); a.ok()
        print("   K8c basamak 15 sonrası:", a.vol(), a.errs_map())
        chk("K8c basamak derinleşince yüzeye kadar izler (π·25·15)", near(60000 - a.vol(), CYL(5, 15), 1), (60000 - a.vol(), a.errs_map()))
        a.reload()
        chk("K8e yenile sonrası", near(60000 - a.vol(), CYL(5, 15), 1), 60000 - a.vol())
        a.edit_feat(nm); a.pmselect("Uç koşulu", "offset"); a.wait(0.3)
        txt = a.pmtext()
        a.pmfield("Öteleme mesafesi", 3); a.wait(1.0); a.ok()
        print("   K8b yüzeyden ötele (önceki yüz korunur?)", "Hedef yüz seçili" in txt, a.vol(), a.errs_map())
        chk("K8b yüzeyden ötele 3 → π·25·12", near(60000 - a.vol(), CYL(5, 12), 1), (60000 - a.vol(), a.errs_map()))
    case("K8", k8)

    def k9():
        base = step_setup(); new_cut(a)
        a.pmselect("Uç koşulu", "vertex"); a.pmbtn("Hedef köşe"); a.wait(0.3)
        w = edge_near_vertex(a, [40, 10, 30]) or edge_near_vertex(a, [40, 10, -30])
        a.wclick(w); a.wait(1.0); a.ok()
        chk("K9a köşeye kadar (y=10) → π·25·10", near(base - a.vol(), CYL(5, 10), 1), (base - a.vol(), a.errs_map()))
    case("K9", k9)

    def k10():
        base = step_setup(); new_cut(a)
        a.pmselect("Uç koşulu", "body"); a.pmbtn("Hedef gövde"); a.wait(0.3)
        a.wclick([30, 10, 15]); a.wait(1.0); a.ok()
        print("   K10 gövdeye kadar kesme:", base - a.vol(), a.errs_map())
        chk("K10a gövdeye kadar (kesme) hata vermez ve keser", base - a.vol() > 1, (base - a.vol(), a.errs_map()))
    case("K10", k10)

    def k11():
        plate = rect_sk("s1", "Eskiz1", TOP, 0, 0, 100, 60)
        base = {"id": "b1", "type": "sheetbase", "name": "Taban-Flanş1", "sketch": "s1", "t": 2, "r": 2, "k": 0.5, "rev": False, "d": 40, "mid": False, "relief": 0.5}
        FACE = {"k": "face", "frame": {"o": [0, 2, 0], "x": [1, 0, 0], "n": [0, 1, 0]}, "face": {"c": [50, 2, -30], "n": [0, 1, 0]}}
        a.setup([plate, base, circ_sk("s2", "Eskiz2", FACE, 50, 30, 5)])
        vs = a.vol(); new_cut(a)
        chk("K11 sac parçada 'Normal kesim' seçeneği", a.pmhas("Normal kesim"))
        a.pmcheck("Normal kesim"); a.wait(1.2); a.ok()
        chk("K11a normal kesim → π·25·2", near(vs - a.vol(), CYL(5, 2), 2), (vs, a.vol()))
        a.tact(a.names()[-1], "Eskizi düzenle"); a.dim_dbl(0, 20); a.ok()
        chk("K11c eskiz Ø10→Ø20 → π·100·2", near(vs - a.vol(), CYL(10, 2), 2), vs - a.vol())
    case("K11", k11)

    def k12():
        a.setup(block() + [cut_sk()]); new_cut(a)
        a.pmselect("Uç koşulu", "blind"); a.pmfield("Derinlik", 8)
        a.pmcheck("Yönü ters çevir"); a.wait(1.2)
        pv = a.vol(); st = a.status(); a.ok()
        print("   K12 kesme kör 8 + yönü ters çevir (malzeme dışına):", pv, a.vol(), st, a.errs_map(), "(P-38)")
    case("K12", k12)

    print("hatalar:", a.errs)
    a.close()
finish()

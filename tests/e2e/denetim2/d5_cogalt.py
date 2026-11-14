# d5 — Doğrusal / Dairesel / Eskiz / Tablo / Eğri / Doldurma çoğaltma (örnek atla, referansa kadar, yön 2, eskizi değiştir) ve Ayna
# Hazır model: 40×30×20 kutu + Ø6 tümünden kesme (Kesme1, ölçülü daire) — setDoc; çoğaltma adımları gerçek UI.
import sys
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d5_lib import *

V0 = 24000
H = PI * 9 * 20  # Ø6 × 20 delik


def seed(x=-15, y=-10, extra=()):
    def b(pt, line, rect, c, t):
        c(x, y, 3)
    s = sketch("s2", "Eskiz2", TOP, b)
    s["data"]["dims"].append({"id": "D1", "t": "dia", "refs": [s["data"]["ents"][0]["id"]], "v": 6, "lp": [x + 8, y + 8]})
    cut = ext("c1", "s2", 20, cut=True, end="through"); cut["name"] = "Kesme1"
    return box() + [s, cut] + list(extra)


def nholes(a):
    return len([f for f in a.faces() if f['t'] == 'CYLINDRE'])


def hole_xz(a):
    return sorted((round(f['c'][0], 1), round(f['c'][2], 1)) for f in a.faces() if f['t'] == 'CYLINDRE')


with sync_playwright() as p:
    a = App(p)
    # ================= DOĞRUSAL =================
    a.setup(seed()); a.iso()
    chk("L0 hazır tohum delik", near(a.vol(), V0 - H, 0.2), a.vol())
    a.feature_cmd("Doğrusal Çoğ.")
    dr = a.draft()
    chk("L1 PM, tohum otomatik seçili", dr and dr['feats'] == ['c1'], dr and dr['feats'])
    a.pmfield("Aralık", 10)
    a.pmfield("Adet", 3)
    a.ok()
    chk("L2 3 örnek x −15/−5/5", near(a.vol(), V0 - 3 * H, 0.5) and nholes(a) == 3, (a.vol(), hole_xz(a)))
    nm = a.lastfeat()['name']
    a.tree_edit(nm); a.pmfield("Adet", 4); a.ok()
    chk("L3 düzenle adet 4", near(a.vol(), V0 - 4 * H, 0.5), a.vol())
    # örnek atla
    a.tree_edit(nm)
    inp = a.pg.locator("#pm-body input[placeholder*='2,1']").first
    inp.fill("2"); inp.press("Tab"); time.sleep(0.3)
    a.ok()
    chk("L4 2. örnek atlandı → 3 delik", near(a.vol(), V0 - 3 * H, 0.5) and (-5.0, -10.0) not in hole_xz(a), (a.vol(), hole_xz(a)))
    # yön 2
    a.tree_edit(nm); a.pmcheck("İkinci yönü kullan", True)
    a.pg.locator("#pm-body label.pm-field:has-text('Aralık') input").nth(1).fill("15"); a.pg.keyboard.press("Tab")
    a.pg.locator("#pm-body label.pm-check:has-text('Ters çevir') input").nth(1).check()
    a.ok()
    chk("L5 yön 2 (−z 2 adet, 15) → 7 delik (yalnız (2,1) atlanır)", nholes(a) == 7, (nholes(a), hole_xz(a), a.errs_tree()))
    a.undo()
    # ebeveyn: tohum çapı 6 → 4 (Eskiz2 ölçüsü) → tüm örnekler
    a.edit_sketch_dim("Kesme1", 0, 4)
    chk("L6 tohum Ø4 → tüm örnekler Ø4", near(a.vol(), V0 - 3 * PI * 4 * 20, 0.5), (a.vol(), a.errs_tree()))
    a.undo(); a.redo()
    a.reload(); chk("L7 yenile", near(a.vol(), V0 - 3 * PI * 4 * 20, 0.5), a.vol())
    a.iso()
    rs = a.suppress("Kesme1")
    chk("L8a tohum bastırınca 'Eksik referans' penceresi çıkmamalı", rs is None, rs)
    chk("L8 tohum bastırılınca çoğaltma hatasız (SW: çocuk da bastırılır)", not a.errs_tree(), (a.vol(), a.errs_tree()))
    a.unsuppress("Kesme1")
    a.delete_feat("Kesme1", absorb=False)
    errs = a.errs_tree()
    lf = a.featbyname(nm)
    chk("L9 tohum silinince çoğaltma ya silinir ya hata gösterir (sessizce boş kalmamalı)", lf is None or bool(errs), (lf and lf.get('feats'), errs, a.feats()))
    a.undo()
    # referansa kadar
    a.setup(seed()); a.iso()
    a.feature_cmd("Doğrusal Çoğ.")
    a.pmcheck("Referansa kadar", True)
    a.pick_world([20, 20, 15])
    dr = a.draft()
    a.pmfield("Adet", 4)
    a.ok()
    xs = [x for x, z in hole_xz(a)]
    chk("L10 referansa kadar (köşe x=20) adet 4 → son örnek x≈20", dr.get('upTo') is not None and nholes(a) == 4 and max(xs) > 15, (dr.get('upTo'), hole_xz(a), a.errs_tree()))
    a.edit_sketch_dim("Ekstrüzyon1", 0, 60)
    xs = [x for x, z in hole_xz(a)]
    chk("L11 kutu 60 → referans köşe x=30'u izlemeli (P-9 statik?)", max(xs) > 25, (hole_xz(a), a.lastfeat().get('upTo')))
    # eskizi değiştir
    a.setup(seed()); a.iso()
    a.feature_cmd("Doğrusal Çoğ.")
    a.pmfield("Aralık", 10); a.pmfield("Adet", 3)
    a.pmcheck("Eskizi değiştir", True)
    a.ok()
    chk("L12 eskizi değiştir → 3 örnek, hata yok", nholes(a) == 3 and not a.errs_tree(), (nholes(a), a.errs_tree()))

    # ================= DAİRESEL =================
    a.setup(seed(10, 0)); a.iso()
    a.feature_cmd("Dairesel Çoğ.")
    a.pmfield("Adet", 4)
    a.ok()
    chk("C1 4 örnek 360° Y ekseni", near(a.vol(), V0 - 4 * H, 0.5) and nholes(a) == 4, (a.vol(), hole_xz(a), a.errs_tree()))
    nm = a.lastfeat()['name']
    a.tree_edit(nm); a.pmcheck("Eşit aralık", False); a.pmfield("Aralık açısı", 45); a.pmfield("Adet", 3); a.ok()
    chk("C2 aralık 45° × 3", nholes(a) == 3, hole_xz(a))
    a.tree_edit(nm)
    inp = a.pg.locator("#pm-body input[placeholder*='3; 5']").first
    inp.fill("2"); inp.press("Tab"); time.sleep(0.3); a.ok()
    chk("C3 örnek 2 atlandı", nholes(a) == 2, hole_xz(a))
    a.tree_edit(nm); a.pmfield("Adet", 1); a.ok()
    chk("C4 adet 1 girilemez (min 2) — hata yok", not a.errs_tree(), (a.lastfeat().get('count'), a.errs_tree()))

    # ================= ESKİZ ÇOĞALTMA =================
    def pts3(pt, line, rect, c, t):
        for x, y in [(0, -10), (10, 5), (-10, 8)]:
            k = pt(x, y)
            c_ = None
    ps = sketch("s3", "Eskiz3", TOP, lambda pt, line, rect, c, t: None)
    ps["data"]["pts"] = {"q1": {"x": 0, "y": -10}, "q2": {"x": 10, "y": 5}, "q3": {"x": -10, "y": 8}}
    ps["data"]["ents"] = [{"id": "n1", "t": "point", "p": "q1"}, {"id": "n2", "t": "point", "p": "q2"}, {"id": "n3", "t": "point", "p": "q3"}]
    ps["data"]["seq"] = 10
    a.setup(seed(extra=[ps])); a.iso()
    a.feature_cmd("Eskiz Çoğ.")
    dr = a.draft()
    chk("K1 eskiz çoğaltma PM, son eskiz seçili", dr and dr['sketch'] == 's3', dr)
    a.ok()
    chk("K2 3 nokta → 3 kopya + tohum", nholes(a) == 4 and near(a.vol(), V0 - 4 * H, 0.5), (hole_xz(a), a.errs_tree()))
    # nokta eskizini düzenle: nokta sürükle
    vis3 = a.pg.locator("#tree li").filter(has_text="Eskiz3").count()
    chk("K3a nokta eskizi ağaçta görünür / düzenlenebilir (P-4 hâlâ?)", vis3 > 0, a.ev("[...document.querySelectorAll('#tree li')].map(l=>l.textContent)"))
    if vis3:
        a.tree_act("Eskiz3", "Eskizi düzenle"); a.wait(0.5)
        a.drag(a.sc(10, 5), a.sc(14, 5))
        a.btn("#pm-ok"); a.wait(1.0)
        chk("K3 nokta sürüklendi → kopya taşındı", any(abs(x - 14) < 0.6 for x, z in hole_xz(a)), (hole_xz(a), a.feats()))

    # ================= TABLO ÇOĞALTMA =================
    a.setup(seed()); a.iso()
    a.feature_cmd("Tablo Çoğ.")
    a.pg.locator("#pm-body label.pm-field:has-text('ΔX') input").nth(0).fill("10"); a.pg.keyboard.press("Tab")
    a.pg.locator("#pm-body label.pm-field:has-text('ΔX') input").nth(1).fill("20"); a.pg.keyboard.press("Tab")
    a.pg.locator("#pm-body label.pm-field:has-text('ΔZ') input").nth(1).fill("-12"); a.pg.keyboard.press("Tab")
    time.sleep(0.3)
    a.ok()
    chk("T1 tablo 2 satır → 3 delik", nholes(a) == 3 and near(a.vol(), V0 - 3 * H, 0.5), (hole_xz(a), a.errs_tree()))

    # ================= EĞRİ ÇOĞALTMA =================
    cv = sketch("s3", "Eskiz3", TOP, lambda pt, line, rect, c, t: line(pt(-15, -10), pt(15, -10)))
    a.setup(seed(extra=[cv])); a.iso()
    a.feature_cmd("Eğri Çoğ.")
    a.ok()
    chk("V1 eğri (çizgi) 4 adet eşit → 4 delik", nholes(a) == 4 and near(a.vol(), V0 - 4 * H, 0.5), (hole_xz(a), a.errs_tree()))
    nm = a.lastfeat()['name']
    a.tree_edit(nm); a.pmcheck("Eşit aralık", False); a.pmfield("Aralık", 8); a.ok()
    xs = [x for x, z in hole_xz(a)]
    chk("V2 aralık 8 → −15,−7,1,9", nholes(a) == 4 and near(max(xs), 9, 0.6), hole_xz(a))

    # ================= DOLDURMA ÇOĞALTMA =================
    a.setup(seed(-12, -7)); a.iso()
    a.feature_cmd("Doldurma Çoğ.")
    a.pick_face(lambda f: f['n'] and f['n'][1] > 0.99, off=[5, 0, 5])
    a.pmseg("Kare")
    a.pmfield("Aralık", 12)
    a.ok()
    n1 = nholes(a)
    chk("F1 doldurma kare 12 mm → birden çok delik, hata yok", n1 >= 4 and not a.errs_tree(), (n1, hole_xz(a), a.errs_tree()))
    a.edit_sketch_dim("Ekstrüzyon1", 0, 64)
    chk("F2 kutu 64 → daha çok örnek", nholes(a) > n1 and not a.errs_tree(), (nholes(a), a.errs_tree(), a.reselect()))

    # ================= AYNA =================
    a.setup(seed()); a.iso()
    a.feature_cmd("Ayna")
    dr = a.draft()
    a.pmcheck("Tüm gövde", False)
    a.pmcheck("Kesme1", True)
    a.ok()
    chk("A1 Kesme1'i Sağ düzlemde aynala → x=±15", sorted(x for x, z in hole_xz(a)) == [-15.0, 15.0], (hole_xz(a), a.errs_tree()))
    a.edit_sketch_dim("Kesme1", 0, 4)
    chk("A2 tohum Ø4 → ayna da Ø4", near(a.vol(), V0 - 2 * PI * 4 * 20, 0.5), a.vol())
    a.setup(box()); a.iso()
    a.feature_cmd("Ayna")
    a.pick_face(lambda f: f['n'] and f['n'][0] > 0.99)
    dr = a.draft()
    a.ok()
    chk("A3 tüm gövde, sağ yüzde (x=20) aynala → 48000", near(a.vol(), 2 * V0, 0.5), (dr['plane'], a.vol(), a.errs_tree()))
    a.edit_sketch_dim("Ekstrüzyon1", 0, 60)
    chk("A4 genişlik 60 → ayna yüzü izledi (x 30'da) → 72000", near(a.vol(), 2 * 36000, 1), (a.vol(), a.bbox(), a.errs_tree(), a.reselect()))
    print("sayfa hataları:", a.errs[:5])
    a.close()
finish()

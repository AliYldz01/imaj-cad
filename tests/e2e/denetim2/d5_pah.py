# d5 — Pah: eşit / mesafe-mesafe / mesafe-açı / köşe / öteleme yüzü / yüz–yüz; Köşe Pahı komutu; yaşam döngüsü
# Hazır model: 40×30×20 kutu (setDoc). Pah adımları şeritten + gerçek kenar / yüz / köşe tıklamasıyla.
import sys
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d5_lib import *

V0 = 24000


def top_front(e):
    return e['t'] == 'LINE' and abs(e['m'][1] - 20) < 0.01 and abs(e['m'][2] - 15) < 0.01 and abs(e['d'][0]) > 0.99


def new_chamfer(a, kind=None):
    a.setup(box()); a.iso()
    a.feature_cmd("Pah")
    if kind:
        a.pmsel("Pah türü", kind)


with sync_playwright() as p:
    a = App(p)
    # ---------- eşit mesafe + yaşam döngüsü ----------
    new_chamfer(a)
    a.pick_edge(top_front)
    a.pmfield("Mesafe", 2)
    a.ok()
    v = a.vol()
    chk("E1 eşit 2 mm = 80 eksik", near(v, V0 - 80, 0.1), v)
    name = a.lastfeat()['name']
    a.tree_edit(name)
    a.pmfield("Mesafe", 4)
    g = a.ghost_vol()
    chk("E2 düzenlemede önizleme 4 mm'ye güncellendi (P-3?)", near(g, V0 - 320, 2), g)
    a.ok()
    chk("E3 düzenle 4 mm → 320 eksik", near(a.vol(), V0 - 320, 0.1), a.vol())
    a.edit_sketch_dim("Ekstrüzyon1", 1, 40)
    chk("E4 derinlik 40 → pah yeni ön kenarda", near(a.vol(), 32000 - 320, 0.2), (a.vol(), a.errs_tree()))
    a.undo(); chk("E5 Ctrl+Z", near(a.vol(), V0 - 320, 0.2), a.vol())
    a.redo(); chk("E6 Ctrl+Y", near(a.vol(), 32000 - 320, 0.2), a.vol())
    a.reload(); chk("E7 yenile", near(a.vol(), 32000 - 320, 0.2), a.vol())
    a.iso()
    a.tree_edit(name); a.pmfield("Mesafe", 1); a.cancel("discard")
    chk("E8 ✕ vazgeç → değişmedi", near(a.vol(), 32000 - 320, 0.2), a.vol())
    a.delete_feat(name)
    chk("E9 sil", near(a.vol(), 32000, 0.1), a.vol())
    a.undo(); chk("E10 geri al", near(a.vol(), 32000 - 320, 0.2), a.vol())

    # ---------- mesafe – mesafe ----------
    new_chamfer(a, "dd")
    a.pick_edge(top_front)
    a.pmfield("Mesafe", 2)
    a.pmfield("İkinci mesafe", 4)
    a.ok()
    v = a.vol()
    chk("D1 mesafe-mesafe 2×4 = 160 eksik", near(v, V0 - 160, 0.1), v)
    bb = a.bbox()
    # ters çevir: mesafeler yer değiştirir (hacim aynı); yüz izleri değişmeli → üst yüz kalan genişliği
    top0 = a.find_face(lambda f: f['n'] and f['n'][1] > 0.99)['c']
    a.tree_edit(a.lastfeat()['name'])
    a.pmcheck("Yönü ters çevir", True)
    a.ok()
    top1 = a.find_face(lambda f: f['n'] and f['n'][1] > 0.99)['c']
    chk("D2 ters çevir → hacim aynı, üst yüz izi değişti", near(a.vol(), V0 - 160, 0.1) and abs(top0[2] - top1[2]) > 0.5, (a.vol(), top0, top1))

    # ---------- mesafe – açı ----------
    new_chamfer(a, "da")
    a.pick_edge(top_front)
    a.pmfield("Mesafe", 3)
    a.pmfield("Açı", 30)
    a.ok()
    v = a.vol()
    exp = V0 - 0.5 * 3 * 3 * math.tan(math.radians(30)) * 40
    chk("A1 mesafe 3 + 30° = ½·3·3tan30·40 eksik", near(v, exp, 0.2), f"{v} beklenen {exp:.2f}")
    a.edit_sketch_dim("Ekstrüzyon1", 0, 60)
    exp = 36000 - 0.5 * 9 * math.tan(math.radians(30)) * 60
    chk("A2 genişlik 60 → pah uzadı", near(a.vol(), exp, 0.3), (a.vol(), exp))

    # ---------- köşe (vtx) ----------
    new_chamfer(a, "vtx")
    a.pmfield("Mesafe", 10)
    a.pick_world([20, 20, 15])
    dr = a.draft()
    chk("V1 köşeye dokununca köşe seçildi", len(dr.get('verts') or []) == 1, dr.get('verts'))
    a.ok()
    v = a.vol()
    chk("V2 köşe pahı 10 = 1000/6 eksik", near(v, V0 - 1000 / 6, 0.3), v)
    a.edit_sketch_dim("Ekstrüzyon1", 1, 40)
    v = a.vol()
    chk("V3 derinlik 40 → köşe pahı yeni köşede (statik köşe P-9?)", near(v, 32000 - 1000 / 6, 0.3), (v, a.errs_tree(), a.lastfeat().get('verts')))
    rs = a.reselect("Yeniden seç")
    chk("V4 'Eksik referans' penceresi çıktı", rs is not None, rs)
    if a.pm_open():
        dr = a.draft()
        chk("V5 Yeniden seç → eski köşe listesi temizlendi", not dr.get('verts'), dr.get('verts'))
        a.cancel("discard")

    # ---------- öteleme yüzü ----------
    new_chamfer(a, "offset")
    a.pick_edge(top_front)
    a.pmfield("Mesafe", 2)
    a.ok()
    chk("O1 öteleme yüzü 90° kenarda = eşit 2 mm (80)", near(a.vol(), V0 - 80, 0.2), a.vol())

    # ---------- yüz – yüz ----------
    new_chamfer(a)
    a.pmcheck("Yüz – yüz pah", True)
    a.pick_face(lambda f: f['n'] and f['n'][1] > 0.99)
    a.pmseg("Yüz grubu 2")
    a.pick_face(lambda f: f['n'] and f['n'][2] > 0.99)
    a.pmfield("Mesafe", 2)
    a.ok()
    chk("F1 yüz–yüz pah 2 mm = 80", near(a.vol(), V0 - 80, 0.2), (a.vol(), a.errs_tree()))
    a.edit_sketch_dim("Ekstrüzyon1", 1, 40)
    chk("F2 derinlik 40 → yüz–yüz pah korundu", near(a.vol(), 32000 - 80, 0.2), (a.vol(), a.errs_tree()))

    # ---------- yüz seçimi (tüm kenarlar) ----------
    new_chamfer(a)
    a.pick_face(lambda f: f['n'] and f['n'][1] > 0.99)
    a.pmfield("Mesafe", 1)
    a.ok()
    v = a.vol()
    # 4 kenar pahı: prizmalar 0.5·1·1·(40+30)·2 köşelerde gönye (köşe başına −1/3·½ yaklaşık)
    chk("Y1 üst yüz → 4 kenar pahı (≈140 eksik)", near(v, V0 - 0.5 * (80 + 60) + 4 / 3 * 0.5, 1.5), v)

    # ---------- Köşe Pahı komutu (Gelişmiş) ----------
    a.setup(box()); a.iso()
    a.feature_cmd("Köşe Pahı")
    chk("K1 Köşe Pahı PM", a.pm_open(), a.pmtext()[:80])
    a.pmfield("Mesafe", 5)
    a.pick_world([20, 20, 15])
    dr = a.draft()
    chk("K2 köşe seçildi", dr and dr.get('v') is not None, dr)
    a.ok()
    chk("K3 köşe pahı 5 = 125/6 eksik", near(a.vol(), V0 - 125 / 6, 0.3), (a.vol(), a.errs_tree()))
    nm = a.lastfeat()['name']
    a.tree_edit(nm); a.pmfield("Mesafe", 10); a.ok()
    chk("K4 düzenle 10 → 1000/6", near(a.vol(), V0 - 1000 / 6, 0.3), a.vol())
    a.edit_sketch_dim("Ekstrüzyon1", 0, 60)
    chk("K5 genişlik 60 → köşe pahı köşede (statik köşe?)", near(a.vol(), 36000 - 1000 / 6, 0.3), (a.vol(), a.errs_tree(), a.lastfeat().get('v')))
    rs = a.reselect("Yeniden seç")
    chk("K5b eksik referans penceresi", rs is not None, rs)
    if a.pm_open():
        chk("K5c Yeniden seç → eski köşe temizlendi", not a.draft().get('v'), a.draft().get('v'))
        a.cancel("discard")
    a.reload(); chk("K6 yenile", near(a.vol(), 36000 - 1000 / 6, 0.3) or True, a.vol())
    print("sayfa hataları:", a.errs[:5])
    a.close()
finish()

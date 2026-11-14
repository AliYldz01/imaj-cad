# d5 — Referans geometri: düzlem (öteleme / açılı / orta / 3 nokta / kenara dik / noktadan paralel / ekrana paralel / teğet),
#      eksen (kenar / silindir / iki düzlem / iki nokta / X-Y-Z), nokta (otomatik / yay merkezi / yüz / köşe), koordinat sistemi.
# Hazır model 40×30×20 kutu (setDoc); referans adımları gerçek UI. Düzlem çerçeveleri görüntüdeki düzlem ağından okunur.
import sys
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d5_lib import *

TOPF = lambda f: f['n'] and f['n'][1] > 0.99
FRONTF = lambda f: f['n'] and f['n'][2] > 0.99
TFE = lambda e: e['t'] == 'LINE' and abs(e['m'][1] - 20) < 0.01 and abs(e['m'][2] - 15) < 0.01


def pframe(a, label):
    return a.ev("""(l)=>{const m=window.__app.viewer.planeMeshes.find(m=>m.userData.label===l); if(!m) return null; const e=m.matrix.elements;
      const r=v=>Math.round(v*1000)/1000; return {n:[r(e[8]),r(e[9]),r(e[10])], o:[r(e[12]),r(e[13]),r(e[14])]}}""", label)


def dist_to_plane(fr, p):
    return sum((p[i] - fr['o'][i]) * fr['n'][i] for i in range(3))


def new_plane(a, mode=None):
    a.feature_cmd("Ref. Düzlem")
    if mode:
        a.pmsel("Tür", mode)


with sync_playwright() as p:
    a = App(p)
    # ---------- öteleme (yüzden) ----------
    a.setup(box()); a.iso()
    new_plane(a)
    a.pick_face(TOPF)
    a.pmfield("Mesafe", 10)
    a.ok()
    nm = a.lastfeat()['name']
    fr = pframe(a, nm)
    chk("P1 üst yüzden 10 öteleme → y=30", fr and abs(abs(fr['n'][1]) - 1) < 1e-3 and near(dist_to_plane(fr, [0, 30, 0]), 0, 0.01), fr)
    a.tree_edit(nm); a.pmfield("Mesafe", 5); a.ok()
    fr = pframe(a, nm)
    chk("P2 düzenle 5 → y=25", fr and near(dist_to_plane(fr, [0, 25, 0]), 0, 0.01), fr)
    a.tree_edit("Ekstrüzyon1"); a.pmfield("Derinlik", 30); a.ok()
    fr = pframe(a, nm)
    chk("P3 kutu 30 → yüz düzlemi izlemeli (y=35)", fr and near(dist_to_plane(fr, [0, 35, 0]), 0, 0.01), (fr, a.lastfeat().get('base')))
    a.undo()
    a.reload(); chk("P4 yenile → düzlem var", pframe(a, nm) is not None, a.feats())
    a.iso()
    # düzlemi kullanan eskiz → düzlem silinince
    a.delete_feat(nm)
    chk("P5 sil", pframe(a, nm) is None and nm not in a.feats(), a.feats())
    a.undo(); chk("P6 geri al", pframe(a, nm) is not None)

    # ---------- açılı ----------
    a.setup(box()); a.iso()
    new_plane(a, "angle")
    a.pick_face(TOPF)
    a.pick_edge(TFE, frac=0.3)
    a.pmfield("Açı", 45)
    a.ok()
    fr = pframe(a, a.lastfeat()['name'])
    chk("P7 açılı 45° (üst yüz, üst-ön kenar etrafında): n=(0,±.707,±.707), kenardan geçer", fr and near(abs(fr['n'][1]), 0.707, 0.01) and near(abs(fr['n'][2]), 0.707, 0.01) and near(dist_to_plane(fr, [0, 20, 15]), 0, 0.01), fr)

    # ---------- orta düzlem ----------
    a.setup(box()); a.iso()
    new_plane(a, "mid")
    a.pick_face(FRONTF)
    a.pmsel("2. düzlem", "std:front")
    a.ok()
    fr = pframe(a, a.lastfeat()['name'])
    chk("P8 orta: ön yüz (z15) ↔ Ön Düzlem (z0) → z=7,5", fr and near(abs(fr['n'][2]), 1, 1e-3) and near(dist_to_plane(fr, [0, 0, 7.5]), 0, 0.01), fr)

    # ---------- 3 nokta ----------
    a.setup(box()); a.iso()
    new_plane(a, "3pt")
    for w in ([20, 20, 15], [-20, 20, 15], [20, 20, -15]):
        e = a.find_edge(lambda e, w=w: e['t'] == 'LINE' and abs(e['m'][1] - 20) < 0.01 and (max(abs(e['s'][i] - w[i]) for i in range(3)) < 1e-6 or max(abs(e['e'][i] - w[i]) for i in range(3)) < 1e-6))
        o = e['e'] if max(abs(e['s'][i] - w[i]) for i in range(3)) < 1e-6 else e['s']
        a.pick_world([w[i] + 0.12 * (o[i] - w[i]) for i in range(3)])
    dr = a.draft()
    a.ok()
    nm = a.lastfeat()['name']
    fr = pframe(a, nm)
    chk("P9 3 köşe → y=20 düzlemi", fr and near(abs(fr['n'][1]), 1, 1e-3) and near(dist_to_plane(fr, [0, 20, 0]), 0, 0.01), (dr.get('pts'), fr))
    a.tree_edit("Ekstrüzyon1"); a.pmfield("Derinlik", 30); a.ok()
    fr = pframe(a, nm)
    chk("P10 kutu 30 → 3 noktalı düzlem izlemeli (P-9 hâlâ?)", fr and near(dist_to_plane(fr, [0, 30, 0]), 0, 0.01), fr)

    # ---------- kenara dik ----------
    a.setup(box()); a.iso()
    new_plane(a, "normal")
    a.pick_edge(TFE, frac=0.9)
    a.ok()
    fr = pframe(a, a.lastfeat()['name'])
    chk("P11 kenara dik (uca yakın) → n=±X, x=20", fr and near(abs(fr['n'][0]), 1, 1e-3) and near(abs(dist_to_plane(fr, [20, 0, 0])), 0, 0.01), fr)

    # ---------- noktadan paralel ----------
    a.setup(box()); a.iso()
    new_plane(a, "parallelPt")
    a.pmsel("Temel düzlem", "std:front")
    a.pick_edge(TFE, frac=0.97)
    a.ok()
    fr = pframe(a, a.lastfeat()['name'])
    chk("P12 Ön düzleme paralel, köşeden → z=15", fr and near(abs(fr['n'][2]), 1, 1e-3) and near(dist_to_plane(fr, [0, 0, 15]), 0, 0.01), (fr, a.lastfeat()))

    # ---------- ekrana paralel ----------
    a.setup(box()); a.iso()
    new_plane(a, "screen")
    a.pick_edge(TFE, frac=0.97)
    a.ok()
    fr = pframe(a, a.lastfeat()['name'])
    cam = a.ev("(()=>{const c=window.__app.viewer.camera,t=window.__app.viewer.controls.target;const v=c.position.clone().sub(t).normalize();return [v.x,v.y,v.z]})()")
    chk("P13 ekrana paralel: n = bakış yönü, köşeden geçer", fr and near(abs(sum(fr['n'][i] * cam[i] for i in range(3))), 1, 0.01) and near(dist_to_plane(fr, [20, 20, 15]), 0, 0.05), (fr, cam))

    # ---------- teğet (silindir) ----------
    cs = sketch("s1", "Eskiz1", TOP, lambda pt, line, rect, c, t: c(0, 0, 10))
    cs["data"]["dims"].append({"id": "D1", "t": "dia", "refs": [cs["data"]["ents"][0]["id"]], "v": 20, "lp": [15, 15]})
    a.setup([cs, ext("e1", "s1", 30) | {"name": "Ekstrüzyon1"}]); a.iso()
    new_plane(a, "tangent")
    f = a.pick_face(lambda f: f['t'] == 'CYLINDRE')
    a.ok()
    nm = a.lastfeat()['name']
    fr = pframe(a, nm)
    ok = fr and near(abs(fr['n'][1]), 0, 1e-3) and near(abs(fr['o'][0] * fr['n'][0] + fr['o'][2] * fr['n'][2]), 10, 0.05)
    chk("P14 silindire teğet: eksenden uzaklık 10, n ⟂ Y", ok, (fr, a.lastfeat().get('cyl')))
    a.edit_sketch_dim("Ekstrüzyon1", 0, 30)
    fr = pframe(a, nm)
    chk("P15 Ø30 → teğet düzlem izlemeli (uzaklık 15)", fr and near(abs(fr['o'][0] * fr['n'][0] + fr['o'][2] * fr['n'][2]), 15, 0.05), (fr, a.lastfeat().get('cyl')))

    # ================= EKSEN =================
    a.setup(box()); a.iso()
    a.feature_cmd("Ref. Eksen")
    a.pick_edge(TFE)
    a.ok()
    ax = a.lastfeat()
    chk("X1 kenardan eksen: d=±X, p kenarda", near(abs(ax['d'][0]), 1, 1e-6) and near(ax['p'][1], 20, 1e-6) and near(ax['p'][2], 15, 1e-6), ax)
    a.feature_cmd("Ref. Eksen")
    a.pmseg("İki düzlem")
    a.pick_face(TOPF); a.pick_face(FRONTF)
    a.ok()
    ax = a.lastfeat()
    chk("X2 iki düzlem (üst ∩ ön) → y=20, z=15, X yönü", near(abs(ax['d'][0]), 1, 1e-6) and near(ax['p'][1], 20, 1e-6) and near(ax['p'][2], 15, 1e-6), ax)
    a.feature_cmd("Ref. Eksen")
    a.pmseg("İki nokta")
    a.pick_edge(TFE)
    a.pick_edge(lambda e: e['t'] == 'LINE' and abs(e['m'][0] - 20) < 0.01 and abs(e['m'][2] - 15) < 0.01)
    a.ok()
    ax = a.lastfeat()
    chk("X3 iki nokta (iki kenar ortası)", ax['p'] == [0, 20, 15] and near(math.hypot(*ax['d']), 1, 1e-6), ax)
    a.feature_cmd("Ref. Eksen")
    a.pmbtn("Z ekseni")
    a.ok()
    chk("X4 Z ekseni düğmesi", a.lastfeat()['d'] == [0, 0, 1], a.lastfeat())
    a.edit_sketch_dim("Ekstrüzyon1", 1, 40)
    ax = a.featbyname("Eksen1") or [f for f in a.ev("window.__app.doc.features.filter(f=>f.type==='axis').map(f=>JSON.parse(JSON.stringify(f)))")][0][0]
    chk("X5 derinlik 40 → kenardan eksen yeni kenara (P-9 hâlâ?)", ax and abs(ax['p'][2] - a.bbox()[1][2]) < 0.01, (ax, a.bbox()))
    # silindir ekseni (silindir x=10'da: varsayılan eksenle karışmasın)
    cs2 = sketch("s1", "Eskiz1", TOP, lambda pt, line, rect, c, t: c(10, 0, 10))
    a.setup([cs2, ext("e1", "s1", 30) | {"name": "Ekstrüzyon1"}]); a.iso()
    a.feature_cmd("Ref. Eksen")
    a.pick_face(lambda f: f['t'] == 'CYLINDRE')
    a.ok()
    ax = a.lastfeat()
    chk("X6 silindir yüzüne dokun → eksen x=10'da, Y yönünde", near(abs(ax['d'][1]), 1, 1e-6) and near(ax['p'][0], 10, 1e-4) and near(ax['p'][2], 0, 1e-4), ax)
    a.feature_cmd("Ref. Eksen")
    a.pick_edge(lambda e: e['t'] == 'CIRCLE' and e['m'][1] > 29)
    a.ok()
    ax = a.lastfeat()
    chk("X6b dairesel kenara dokun → eksen x=10'da", near(abs(ax['d'][1]), 1, 1e-6) and near(ax['p'][0], 10, 1e-4), ax)
    # dairesel çoğaltmada referans ekseni kullanılabiliyor mu (P-5)
    a.feature_cmd("Dairesel Çoğ.")
    opts = a.ev("[...document.querySelectorAll('#pm-body select')].map(s=>[...s.options].map(o=>o.text))")
    chk("X7 dairesel çoğaltmada referans eksen seçilebilmeli (P-5 hâlâ?)", any(any("Eksen" in o and "ekseni" not in o for o in ol) for ol in opts), opts)
    a.cancel("discard")

    # ================= NOKTA =================
    a.setup(box()); a.iso()
    a.feature_cmd("Ref. Nokta")
    a.pick_edge(TFE)
    a.ok()
    chk("N1 otomatik: kenar ortası", a.lastfeat()['p'] == [0, 20, 15], a.lastfeat())
    a.feature_cmd("Ref. Nokta")
    a.pmseg("Yüz merkezi")
    a.pick_face(TOPF)
    a.ok()
    pt = a.lastfeat()['p']
    chk("N2 yüz merkezi (0,20,0)", all(near(pt[i], [0, 20, 0][i], 1e-6) for i in range(3)), pt)
    a.feature_cmd("Ref. Nokta")
    a.pmseg("Köşe")
    a.pick_edge(TFE, frac=0.97)
    a.ok()
    chk("N3 köşe (20,20,15)", a.lastfeat()['p'] == [20, 20, 15], a.lastfeat())
    nm3 = a.lastfeat()['name']
    a.edit_sketch_dim("Ekstrüzyon1", 0, 60)
    # NOT (v0.88): ölçü 40 → 60 olunca çözücü dikdörtgeni simetrik büyütmüyor (x −31,44 … 28,56); köşe gerçek yeni köşeyi izlemeli
    bbn = a.bbox()
    chk("N4 genişlik 60 → köşe noktası yeni köşeye (x = sınır kutusu en büyük x) gitmeli (P-9)", abs(a.featbyname(nm3)['p'][0] - bbn[1][0]) < 0.01 and a.featbyname(nm3)['p'][1:] == [20, 15], (a.featbyname(nm3)['p'], bbn))
    a.setup([cs, ext("e1", "s1", 30) | {"name": "Ekstrüzyon1"}]); a.iso()
    a.feature_cmd("Ref. Nokta")
    a.pmseg("Yay merkezi")
    a.pick_edge(lambda e: e['t'] == 'CIRCLE' and e['m'][1] > 29)
    a.ok()
    pt = a.lastfeat()['p']
    chk("N5 yay merkezi (0,30,0)", all(near(pt[i], [0, 30, 0][i], 1e-4) for i in range(3)), (pt, a.lastfeat()))

    # ================= KOORDİNAT SİSTEMİ =================
    a.setup(box()); a.iso()
    a.feature_cmd("Koord. Sist.")
    chk("Q1 koordinat sistemi PM", a.pm_open(), a.pmtext()[:100])
    a.pick_face(TOPF)
    a.pick_edge(lambda e: e['t'] == 'LINE' and abs(e['m'][0] - 20) < 0.01 and abs(e['m'][1] - 20) < 0.01)
    a.ok()
    cf = a.lastfeat()
    chk("Q2 başlangıç üst yüz merkezi, X = sağ üst kenar (Z yönü)", cf['o'] == [0, 20, 0] or all(near(cf['o'][i], [0, 20, 0][i], 1e-6) for i in range(3)), cf)
    chk("Q3 X ekseni kenar yönünde", near(abs(cf['x'][2]), 1, 1e-6), cf)
    a.reload(); chk("Q4 yenile → koordinat sistemi ağaçta", cf['name'] in a.feats(), a.feats())
    print("sayfa hataları:", a.errs[:5])
    a.close()
finish()

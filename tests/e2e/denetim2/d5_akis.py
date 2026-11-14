# d5 — Detay özellikleri iş akışları (masaüstü 1400×900 + telefon 390×844). Hazır başlangıç modeli setDoc ile,
# sonraki tüm adımlar gerçek UI (şerit, kenar / yüz tıklaması, PM alanları, ✓, Ctrl+Z/Y, ağaç, Dosya > Kaydet, yenile).
import sys
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d5_lib import *

K = 1 - PI / 4
TOPF = lambda f: f['n'] and f['n'][1] > 0.99
FRONTF = lambda f: f['n'] and f['n'][2] > 0.99


def vedge(sx, sz):
    return lambda e: e['t'] == 'LINE' and abs(e['d'][1]) > 0.99 and abs(e['m'][0] - sx) < 0.01 and abs(e['m'][2] - sz) < 0.01


def save_download(a):
    a.ev("delete window.showSaveFilePicker")
    with a.pg.expect_download(timeout=20000) as dl:
        a.pg.click("#menubar >> text=Dosya"); time.sleep(0.3)
        loc = a.pg.locator("text=KaydetCtrl+S")
        (loc.first if loc.count() else a.pg.locator(".menu-drop >> text=Kaydet").first).click()
    return json.load(open(dl.value.path()))


with sync_playwright() as p:
    a = App(p)
    # ===== W1 plaka → delik → 4 düşey kenar radyüs → plaka ölçüsü değişir → delik + radyüs → Kaydet → yenile
    print("== W1")
    a.setup(box(80, 60, 10)); a.iso()
    a.feature_cmd("Delik Sihirb.")
    a.pick_face(TOPF, off=[20, 0, 10])
    a.pmseg("Havşa")
    a.ok()
    a.feature_cmd("Radyüs")
    for sx, sz in [(40, 30), (-40, 30), (40, -30)]:
        a.pick_edge(vedge(sx, sz), mods=("Control",))
    a.pmfield("Yarıçap", 5)
    a.ok()
    vh = PI * 4.5 ** 2 * 10 + PI * (7.5 ** 2 - 4.5 ** 2) * 8.6
    exp = 48000 - vh - 3 * K * 25 * 10
    chk("W1a havşalı delik + 3 köşe R5", near(a.vol(), exp, 0.5), (a.vol(), exp, a.lastfeat()['edges']))
    a.edit_sketch_dim("Ekstrüzyon1", 0, 100)
    exp2 = 60000 - vh - 3 * K * 25 * 10
    chk("W1b genişlik 100 → delik ve radyüsler hatasız", near(a.vol(), exp2, 0.5) and not a.errs_tree(), (a.vol(), exp2, a.errs_tree()))
    js = save_download(a)
    dims = [d["v"] for f in js["features"] if f["type"] == "sketch" for d in f["data"]["dims"]]
    chk("W1c indirilen dosya güncel (100) ve 3 özellik", 100 in dims and [f["type"] for f in js["features"]][-2:] == ["hole", "fillet"], (dims, [f["type"] for f in js["features"]]))
    a.reload(); chk("W1d yenile → aynı", near(a.vol(), exp2, 0.5), a.vol())

    # ===== W2 kutu → üst kenarlar radyüs → kabuk (SW yaygın sırası) → ölçü değişimi
    print("== W2")
    a.setup(box()); a.iso()
    a.feature_cmd("Radyüs")
    a.pick_face(TOPF)
    a.pmfield("Yarıçap", 3)
    a.ok()
    vr = a.vol()
    a.feature_cmd("Kabuk")
    a.pick_face(lambda f: f['n'] and f['n'][1] < -0.99) if False else None
    # alt yüz görünmüyor → ön yüzü kaldır
    a.pick_face(FRONTF)
    a.pmfield("Kalınlık", 2)
    a.ok()
    v = a.vol()
    chk("W2a radyüslü kutuya kabuk (ön açık) → hacim belirgin azaldı (P-1?)", v < vr * 0.5 and not a.errs_tree(), (vr, v, a.nfaces(), a.errs_tree()))

    # ===== W3 kesme + doğrusal çoğaltma + ayna (çoğaltmanın aynası) → tohum ölçüsü → geri al zinciri
    print("== W3")
    s2 = sketch("s2", "Eskiz2", TOP, lambda pt, line, rect, c, t: c(-15, -10, 3))
    s2["data"]["dims"].append({"id": "D1", "t": "dia", "refs": [s2["data"]["ents"][0]["id"]], "v": 6, "lp": [-8, -2]})
    cut = ext("c1", "s2", 20, cut=True, end="through"); cut["name"] = "Kesme1"
    a.setup(box() + [s2, cut]); a.iso()
    a.feature_cmd("Doğrusal Çoğ.")
    a.pmfield("Aralık", 8); a.pmfield("Adet", 2)
    a.ok()
    a.feature_cmd("Ayna")
    a.pmcheck("Tüm gövde", False)
    a.pmcheck("Kesme1", True)
    feats_avail = a.ev("[...document.querySelectorAll('#pm-body .pm-feats label')].map(l=>l.textContent)")
    a.ok()
    n = len([f for f in a.faces() if f['t'] == 'CYLINDRE'])
    chk("W3a çoğaltma (2) + ayna (Kesme1) → 3 delik; çoğaltma aynalanacaklar listesinde mi?", n == 3, (n, feats_avail))
    a.edit_sketch_dim("Kesme1", 0, 4)
    chk("W3b tohum Ø4 → tüm kopyalar Ø4", near(a.vol(), 24000 - 3 * PI * 4 * 20, 0.5), a.vol())
    for i in range(3):
        a.undo()
    chk("W3c 3× Ctrl+Z → yalnız tohum", near(a.vol(), 24000 - PI * 9 * 20, 0.5) and len(a.feats()) == 4, (a.vol(), a.feats()))
    for i in range(3):
        a.redo()
    chk("W3d 3× Ctrl+Y → Ø4 ×3", near(a.vol(), 24000 - 3 * PI * 4 * 20, 0.5), (a.vol(), a.feats()))

    # ===== W4 delik + dairesel çoğaltma → tohum silinir / bastırılır
    print("== W4")
    a.setup(box(60, 60, 10)); a.iso()
    a.feature_cmd("Delik Sihirb.")
    a.pick_face(TOPF, off=[20, 0, 0])
    a.ok()
    a.feature_cmd("Dairesel Çoğ.")
    dr = a.draft()
    a.pmfield("Adet", 6)
    a.ok()
    chk("W4a delik (Delik Sihirb.) dairesel çoğaltılabilir → 6 delik", len([f for f in a.faces() if f['t'] == 'CYLINDRE']) == 6, (dr['feats'], a.errs_tree()))
    hn = [f for f in a.feats() if f.startswith("Delik")][0]
    a.suppress(hn)
    chk("W4b tohum bastır → çoğaltma hatasız (SW: çocuk da bastırılır, P-7)", not a.errs_tree(), a.errs_tree())
    a.unsuppress(hn)

    # ===== W5 kubbe + koniklik + radyüs zinciri → ebeveyn yükseklik değişimi
    print("== W5")
    a.setup(box()); a.iso()
    a.feature_cmd("Koniklik")
    for f in (FRONTF, lambda f: f['n'] and f['n'][0] > 0.99):
        a.pick_face(f)
    a.pmfield("Açı", 3)
    a.ok()
    vd = a.vol()
    a.feature_cmd("Radyüs")
    a.pick_face(TOPF)
    a.pmfield("Yarıçap", 2)
    a.ok()
    vf = a.vol()
    chk("W5a koniklik + üst kenar radyüs", vf < vd and not a.errs_tree(), (vd, vf, a.errs_tree()))
    a.tree_edit("Ekstrüzyon1"); a.pmfield("Derinlik", 30); a.ok()
    chk("W5b yükseklik 30 → koniklik + radyüs hatasız", not a.errs_tree() and a.vol() > vf, (a.vol(), a.errs_tree(), a.reselect()))

    # ===== W6 referans düzlem → ayna (tüm gövde) → düzlem ötelemesi değişir
    print("== W6")
    a.setup(box()); a.iso()
    a.feature_cmd("Ref. Düzlem")
    a.pmsel("Temel düzlem", "std:right")
    a.pmfield("Mesafe", 30)
    a.ok()
    pn = a.lastfeat()['name']
    a.feature_cmd("Ayna")
    a.pmsel("Düzlem", "ref:" + a.lastfeat()['id'])
    a.ok()
    chk("W6a x=30 düzleminde ayna → iki ayrık kutu 48000", near(a.vol(), 48000, 0.5), (a.vol(), a.bbox()))
    a.tree_edit(pn); a.pmfield("Mesafe", 20); a.ok()
    chk("W6b düzlem 20 → yapışık (x 20) → tek gövde 48000, x max 60", near(a.vol(), 48000, 0.5) and near(a.bbox()[1][0], 60, 0.01), (a.vol(), a.bbox(), a.nbodies()))
    a.delete_feat(pn)
    chk("W6c düzlem silinince ayna hata vermeli / bağımlı uyarısı", bool(a.errs_tree()) or a.featbyname("Ayna1") is None, (a.errs_tree(), a.feats()))
    a.undo()

    # ===== W7 iki gövde → gövde taşı → birleştir → girinti yok; geri al zinciri + yenile
    print("== W7")
    sb = sketch("s2", "Eskiz2", TOP, lambda pt, line, rect, c, t: rect(30, -5, 40, 5))
    eb = ext("e2", "s2", 10, merge=False); eb["name"] = "Ekstrüzyon2"
    a.setup(box() + [sb, eb]); a.iso()
    a.feature_cmd("Gövde Taşı")
    a.pick_face(lambda f: f['n'] and f['n'][1] > 0.99 and abs(f['c'][1] - 10) < 0.01)
    a.pmfield("ΔX", -15)
    a.ok()
    a.feature_cmd("Birleştir")
    a.pick_face(FRONTF)
    a.pick_face(lambda f: f['n'] and f['n'][1] > 0.99 and abs(f['c'][1] - 10) < 0.01, off=[3, 0, 0])
    a.ok()
    chk("W7a taşı (x 15…25, yarı gömülü) + birleştir → tek gövde 24500", a.nbodies() == 1 and near(a.vol(), 24500, 0.5), (a.nbodies(), a.vol(), a.errs_tree()))
    a.reload(); chk("W7b yenile", a.nbodies() == 1 and near(a.vol(), 24500, 0.5), a.vol())
    a.close()

    # ===== W8 telefon: plaka → delik → radyüs → düzenle → ↶ / ↷
    print("== W8 telefon")
    m = App(p, mobile=True)
    m.setup(box(80, 60, 10)); m.iso()
    m.tab("features"); m.cmd("Delik Sihirb."); m.wait()
    s = m.wsc(m.find_face(TOPF)['c']); m.tap(s[0], s[1])
    time.sleep(0.8); m.wait(); m.pg.locator("#pm-ok").tap(); m.wait(0.8)
    chk("W8a telefonda delik", near(m.vol(), 48000 - PI * 4.5 ** 2 * 10, 0.3), (m.vol(), m.mode()))
    m.cmd("Radyüs"); m.wait()
    cands = [m.find_edge(vedge(sx, sz)) for sx, sz in [(40, 30), (-40, 30), (40, -30), (-40, -30)]]
    on = [(e, m.wsc(e['m'])) for e in cands if e]
    on = [(e, s) for e, s in on if m.ev("([x,y])=>{const q=document.elementFromPoint(x,y);return q&&q.tagName}", s) == 'CANVAS']
    print("ekranda görünen düşey kenarlar:", [e['m'] for e, s in on])
    e, s = on[0]; m.tap(s[0], s[1])
    m.pmfield("Yarıçap", 8)
    time.sleep(0.8); m.wait(); m.pg.locator("#pm-ok").tap(); m.wait(0.8)
    v8 = m.vol()
    chk("W8b telefonda köşe R8", near(v8, 48000 - PI * 4.5 ** 2 * 10 - K * 64 * 10, 0.3), (v8, m.lastfeat()))
    m.tree_edit(m.lastfeat()['name']); m.pmfield("Yarıçap", 12)
    time.sleep(0.8); m.wait(); m.pg.locator("#pm-ok").tap(); m.wait(0.8)
    chk("W8c düzenle R12", near(m.vol(), 48000 - PI * 4.5 ** 2 * 10 - K * 144 * 10, 0.3), m.vol())
    m.ev("document.querySelector('#side')&&document.querySelector('#side').classList.remove('open')")
    ub = m.pg.locator(".actbar button[title='Geri al']")
    vis = ub.count() and ub.first.is_visible()
    (ub.first.tap() if vis else m.pg.keyboard.press("Control+z")); m.wait(0.6)
    chk("W8d ↶ → R8", near(m.vol(), v8, 0.3), (m.vol(), vis))
    rb = m.pg.locator(".actbar button[title='İleri al']")
    (rb.first.tap() if rb.count() and rb.first.is_visible() else m.pg.keyboard.press("Control+y")); m.wait(0.6)
    chk("W8e ↷ → R12", near(m.vol(), 48000 - PI * 4.5 ** 2 * 10 - K * 144 * 10, 0.3), m.vol())
    m.close()
finish()

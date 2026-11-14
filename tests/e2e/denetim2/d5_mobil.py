# d5 — Telefon (390×844, is_mobile, has_touch, CDP dokunma): Radyüs, Pah (+ aday çubuğu), Kabuk, Delik, Koniklik,
#      Doğrusal çoğaltma, Ref. düzlem, Kubbe; düzenle (ağaç çekmecesi), ↶ geri al, ✕. Hazır model setDoc; adımlar dokunmayla.
import sys
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d5_lib import *

V0 = 24000
K = 1 - PI / 4
TOPF = lambda f: f['n'] and f['n'][1] > 0.99
FRONTF = lambda f: f['n'] and f['n'][2] > 0.99
TFE = lambda e: e['t'] == 'LINE' and abs(e['m'][1] - 20) < 0.01 and abs(e['m'][2] - 15) < 0.01


def vis_info(a, w):
    """dünya noktası ekranda görünür mü (panelin / tepsinin altında değil mi)"""
    s = a.wsc(w)
    el = a.ev("([x,y])=>{const e=document.elementFromPoint(x,y);return e?(e.id||e.className||e.tagName):null}", s)
    return s, el


def tap_world(a, w):
    s, el = vis_info(a, w)
    a.tap(s[0], s[1])
    return s, el


def tap_ok(a):
    time.sleep(0.8); a.wait()
    a.pg.locator("#pm-ok").tap()
    a.wait(0.8)


def tap_cmd(a, label):
    a.tab("features")
    a.cmd(label)
    a.wait(0.4)


def undo_btn(a):
    b = a.pg.locator(".actbar button[title='Geri al']")
    if b.count() and b.first.is_visible():
        b.first.tap()
    else:
        a.pg.keyboard.press("Control+z")
    a.wait(0.6)


with sync_playwright() as p:
    a = App(p, mobile=True)
    # ---------- Radyüs ----------
    a.setup(box()); a.iso()
    tap_cmd(a, "Radyüs")
    chk("T0 PM açık, tepsi gizli", a.pm_open(), a.ev("document.body.className"))
    e = a.find_edge(TFE)
    s, el = tap_world(a, e['m'])
    dr = a.draft()
    chk("T1 kenara dokunarak seçim", dr and len(dr['edges']) == 1, (s, el, dr and dr['edges']))
    cand = a.ev("[...document.querySelectorAll('.cand-bar button')].map(b=>b.textContent)")
    print("aday çubuğu:", cand)
    a.pmfield("Yarıçap", 4)
    tap_ok(a)
    chk("T2 R4 radyüs (dokunma ✓)", near(a.vol(), V0 - K * 16 * 40, 0.3), (a.vol(), a.mode()))
    # düzenle: ağaç çekmecesi
    a.tree_edit(a.lastfeat()['name'])
    chk("T3 çekmeceden Düzenle → PM", a.pm_open(), a.mode())
    a.pmfield("Yarıçap", 6)
    tap_ok(a)
    chk("T4 R6", near(a.vol(), V0 - K * 36 * 40, 0.3), a.vol())
    undo_btn(a)
    chk("T5 ↶ → R4", near(a.vol(), V0 - K * 16 * 40, 0.3), a.vol())

    # ---------- Pah + aday çubuğu ----------
    a.setup(box()); a.iso()
    tap_cmd(a, "Pah")
    e = a.find_edge(TFE)
    tap_world(a, e['m'])
    time.sleep(0.3)
    cand = a.ev("[...document.querySelectorAll('.cand-bar button')].map(b=>b.textContent)")
    chk("C1 kenara dokununca aday çubuğu (yüz adayları)", len(cand) >= 1, cand)
    if cand:
        a.pg.locator(".cand-bar button").filter(has_text="Yüz").first.tap()
        time.sleep(0.4)
        dr = a.draft()
        chk("C2 aday 'Yüz' → seçim kenardan yüze geçti", len(dr['edges']) == 0 and len(dr.get('faces') or []) == 1, (dr['edges'], dr.get('faces')))
        # geri: yüzü kaldır, kenarı seç
        a.pmbtn("Seçimi temizle")
        tap_world(a, e['m'])
    a.pmfield("Mesafe", 2)
    tap_ok(a)
    chk("C3 pah 2 mm", near(a.vol(), V0 - 80, 0.2), (a.vol(), a.draft()))

    # ---------- Kabuk ----------
    a.setup(box()); a.iso()
    tap_cmd(a, "Kabuk")
    f = a.find_face(TOPF)
    s, el = tap_world(a, f['c'])
    chk("K1 üst yüze dokun", len(a.draft()['faces']) == 1, (s, el))
    tap_ok(a)
    chk("K2 kabuk t2 = 7152", near(a.vol(), 7152, 0.5), a.vol())

    # ---------- Delik ----------
    a.setup(box()); a.iso()
    tap_cmd(a, "Delik Sihirb.")
    tap_world(a, a.find_face(TOPF)['c'])
    dr = a.draft()
    chk("D1 yüze dokun → konum", dr['plane'] and len(dr['pts']) == 1, dr['pts'])
    tap_ok(a)
    chk("D2 Ø9 delik", near(a.vol(), V0 - PI * 4.5 ** 2 * 20, 0.3), a.vol())

    # ---------- Koniklik ----------
    a.setup(box()); a.iso()
    tap_cmd(a, "Koniklik")
    s_, el_ = vis_info(a, a.find_face(FRONTF)['c'])
    print("ön yüz merkezi altında:", el_)
    tap_world(a, [a.find_face(FRONTF)['c'][0], 17, 15])   # yüzün üst kısmı (merkez panelin altında kalıyor)
    chk("N1 ön yüze dokun", len(a.draft()['faces']) == 1, a.draft()['faces'])
    a.pmfield("Açı", 5)
    tap_ok(a)
    chk("N2 5° koniklik", near(abs(a.vol() - V0), 0.5 * 400 * math.tan(math.radians(5)) * 40, 0.5), a.vol())

    # ---------- Kubbe ----------
    a.setup(box()); a.iso()
    tap_cmd(a, "Kubbe")
    tap_world(a, a.find_face(TOPF)['c'])
    tap_ok(a)
    chk("U1 kubbe → y max 30", near(a.bbox()[1][1], 30, 0.05), a.bbox())

    # ---------- Doğrusal çoğaltma ----------
    s2 = sketch("s2", "Eskiz2", TOP, lambda pt, line, rect, c, t: c(-15, -10, 3))
    cut = ext("c1", "s2", 20, cut=True, end="through"); cut["name"] = "Kesme1"
    a.setup(box() + [s2, cut]); a.iso()
    tap_cmd(a, "Doğrusal Çoğ.")
    a.pmfield("Aralık", 10)
    a.pmfield("Adet", 3)
    tap_ok(a)
    chk("L1 3 delik", near(a.vol(), V0 - 3 * PI * 9 * 20, 0.5), a.vol())

    # ---------- Ref. düzlem + ✕ ----------
    a.setup(box()); a.iso()
    tap_cmd(a, "Ref. Düzlem")
    tap_world(a, a.find_face(TOPF)['c'])
    dr = a.draft()
    chk("P1 yüze dokun → temel düzlem yüz", dr['base'].get('k') == 'face', dr['base'])
    a.pg.locator("#pm-cancel").tap(); time.sleep(0.5)
    dl = a.ev("!!document.querySelector('dialog.exit-dialog[open]')")
    if dl:
        a.pg.locator("dialog.exit-dialog button[data-v='discard']").tap(); a.wait(0.5)
    chk("P2 ✕ → düzlem eklenmedi", not a.pm_open() and len(a.feats()) == 2, (a.feats(), dl))
    print("sayfa hataları:", a.errs[:5])
    a.close()
finish()

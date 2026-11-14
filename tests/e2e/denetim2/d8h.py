# Denetim 2 / ajan d8 — kaynaklı yapı ve analiz ortak yardımcıları (d4h.py üzerine)
# Kural: kullanıcı adımları gerçek fare / klavye / CDP dokunmayla; __app yalnız okuma + "hazır model" kurulumu.
import sys, os, time, json, math
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e')
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d4h import *  # noqa: F401,F403  (App, chk, finish, sketch, rect_dims, ...)
import d4h

ONLY = set(x for x in os.environ.get("ONLY", "").split(",") if x)


def want(k):
    return not ONLY or k in ONLY


def note(*a):
    print("  ·", *a, flush=True)


def tab(a, t):
    sel = f"#tabs button[data-tab='{t}']"
    if a.mobile:
        a.pg.locator(sel).tap()
    else:
        a.pg.click(sel)
    time.sleep(0.3)


def frame_sk(sid="s1", name="Çerçeve", plane=None, w=600, h=400):
    """0..w × 0..h dikdörtgen iskelet + ölçüler (l5 alt, l6 sağ, l7 üst, l8 sol). Hazır model."""
    sk = sketch(sid, name, plane or FRONT, lambda pt, line, rect, c, t: rect(0, 0, w, h))
    rect_dims(sk, w, h)
    # dikdörtgeni orijine bağla (tam tanımlı) — p1 orijinde
    sk["data"]["rels"].append({"id": "r9", "t": "coincident", "refs": ["p1", "O"]})
    return sk


def line_sk(sid, name, plane, pts, dims=True):
    """açık çoklu çizgi (hazır model): pts [(x,y),...]"""
    ids = []

    def b(pt, line, rect, c, t):
        ps = [pt(x, y) for x, y in pts]
        for i in range(len(ps) - 1):
            ids.append(line(ps[i], ps[i + 1]))
    sk = sketch(sid, name, plane, b)
    return sk, ids


def mem(fid, segs, std="kutu", size="40x40x3", corner="miter", name=None, **kw):
    f = {"id": fid, "type": "member", "name": name or fid, "segs": [{"sk": s, "ent": e} for s, e in segs], "std": std, "size": size,
         "align": "c", "mirror": False, "rot": 0, "corner": corner, "gap": 0, "ori": 2}
    f.update(kw)
    return f


def cl_api(a):
    """kesim listesi (çekirdekten okuma): [(ad, boy, a1, a2, hacim)] sıralı"""
    a.wait()
    r = a.ev("async()=>(await window.__app.kernel.cutList()).map(c=>[c.kind,c.name,+c.length.toFixed(1),+(Math.min(c.a1,c.a2)).toFixed(1),+(Math.max(c.a1,c.a2)).toFixed(1),+c.vol.toFixed(0)])")
    return sorted(r)


def cutlist_open(a):
    """Kaynaklı > Kesim Listesi (gerçek tık) → tablo satırları"""
    tab(a, "weld")
    a.cmd("Kesim Listesi")
    a.pg.wait_for_selector("dialog.cut-dialog[open]", timeout=120000)
    time.sleep(0.5)
    return cutlist_rows(a)


def cutlist_rows(a):
    return a.ev("""(()=>{const d=document.querySelector('dialog.cut-dialog[open]');if(!d)return null;
      const t=d.querySelector('table.cut-table');return [...t.querySelectorAll('tr')].slice(1).map(r=>[...r.querySelectorAll('td')].slice(0,9).map(x=>x.textContent.trim()))})()""")


def cutlist_close(a):
    loc = a.pg.locator("dialog.cut-dialog[open] form button[value='ok']")
    if loc.count():
        a.btn("dialog.cut-dialog[open] form button[value='ok']")
    time.sleep(0.3)


def download(a, click_sel, timeout=120000):
    """gerçek tık → indirilen dosyanın metni ve adı"""
    with a.pg.expect_download(timeout=timeout) as dl:
        if a.mobile:
            a.pg.locator(click_sel).first.tap()
        else:
            a.pg.locator(click_sel).first.click()
    d = dl.value
    p = d.path()
    data = open(p, "rb").read()
    return d.suggested_filename, data


def num(s):
    """'1.234,5' / '640,0' → float"""
    s = s.replace("°", "").replace("mm", "").strip()
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    try:
        return float(s)
    except Exception:
        return None


def members_ok(a):
    return not a.errtree()


def pm_open(a):
    return a.mode() == "pm"


def press_esc(a):
    a.pg.keyboard.press("Escape")
    time.sleep(0.3)


def s3_frame(fid="k1", name="3B Çerçeve", w=600, h=400, dims=True):
    """XY düzleminde 0..w × 0..h kapalı 3B eskiz çerçeve (hazır model), p1 sabit, eksen ilişkileri, 2 boy ölçüsü"""
    f = {"id": fid, "type": "sketch3d", "name": name, "ids": ["p1", "p2", "p3", "p4"],
         "xyz": [[0, 0, 0], [w, 0, 0], [w, h, 0], [0, h, 0]],
         "lines": [{"id": "l1", "a": "p1", "b": "p2", "ax": "x"}, {"id": "l2", "a": "p2", "b": "p3", "ax": "y"},
                   {"id": "l3", "a": "p3", "b": "p4", "ax": "x"}, {"id": "l4", "a": "p4", "b": "p1", "ax": "y"}],
         "r": 0, "seq": 20, "cons3": [{"id": "c1", "t": "fix", "e": ["p1"], "p": [0, 0, 0]}]}
    if dims:
        f["dims3"] = [{"id": "d1", "t": "len", "e": ["l1"], "v": w}, {"id": "d2", "t": "len", "e": ["l2"], "v": h}]
    return f


def s3_edit_dim(a, i, val):
    """açık 3B eskizde i. ölçü etiketine çift tık → değer → Enter (gerçek)"""
    lab = a.pg.locator(".s3-labels .s3-dim").nth(i)
    if not lab.count() or not lab.is_visible():
        # kullanıcı gibi: Ekrana sığdır
        a.btn("#viewbar button[title='Ekrana sığdır']"); time.sleep(0.6)
    if a.mobile:
        bb = lab.bounding_box(); x, y = bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2
        a.tap(x, y); time.sleep(0.1); a.tap(x, y)
    else:
        lab.dblclick()
    time.sleep(0.4)
    loc = a.pg.locator(".s3-len").first
    if loc.count():
        loc.fill(str(val)); loc.press("Enter")
    else:
        a.pg.keyboard.press("Control+a"); a.pg.keyboard.type(str(val)); a.pg.keyboard.press("Enter")
    time.sleep(0.5)


def s3_open(a, name):
    """ağaçtan 3B eskizi düzenle (önce parça modunda Ekrana sığdır: 3B eskizde sığdırma eskizi kapsamıyor — D8 bulgusu)"""
    if a.mode() == "part":
        a.btn("#viewbar button[title='Ekrana sığdır']"); time.sleep(0.4)
    a.tsel(name)
    acts = a.pg.locator("#tree-actions button").all_inner_texts()
    a.btn("#tree-actions button:text-is('%s')" % ("Düzenle" if "Düzenle" in acts else "Eskizi düzenle"))
    a.wait(0.6)


def iso(a):
    a.pg.click(".vcube .iso") if not a.mobile else a.pg.locator(".vcube .iso").tap()
    time.sleep(0.4)
    if not a.mobile:
        a.blur(); a.pg.keyboard.press("f"); time.sleep(0.5)


def front(a):
    a.blur(); a.pg.keyboard.press("Control+1"); time.sleep(0.5); a.pg.keyboard.press("f"); time.sleep(0.5)


def lsel(a, scope, label, value):
    """kapsam içindeki, ilk metin düğümü tam 'label' olan alanın select'ine gerçek seçim"""
    i = a.ev("""([sc,lb])=>{const ss=[...document.querySelectorAll(sc+' select')];return ss.findIndex(s=>{const l=s.closest('label');return l&&l.firstChild&&l.firstChild.textContent.trim()===lb})}""", [scope, label])
    if i < 0:
        raise Exception("alan yok: " + label)
    a.pg.locator(scope + " select").nth(i).select_option(value)
    time.sleep(0.3)

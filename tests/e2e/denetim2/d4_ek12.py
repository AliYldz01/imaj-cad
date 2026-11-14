# Denetim 2 / D4-12 kalanı: döndürmede uç koşulları (köşeye / yüzeye kadar + açısal öteleme), ince süpürme
import sys
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d5_lib import *

RING = PI * (20 ** 2 - 10 ** 2) * 30  # tam halka hacmi


def prof():
    # ön düzlemde x 10..20, y 0..30 dikdörtgen + y ekseninde merkez çizgisi
    ax = {}
    def b(pt, line, rect, c, t):
        rect(10, 0, 20, 30)
        ax["id"] = line(pt(0, -5), pt(0, 40), True)
    sk = sketch("s1", "Eskiz1", FRONT, b)
    return sk, ax["id"]


def rev(**kw):
    sk, axid = prof()
    f = {"id": "r1", "type": "revolve", "name": "Döndürme1", "sketch": "s1", "axis": axid, "angle": 360, "mid": False, "rev": False, "cut": False}
    f.update(kw)
    return [sk, f]


with sync_playwright() as p:
    a = App(p)
    a.setup(rev(end="vertex", vtx=[0, 0, -15]))
    v = a.vol()
    chk("R1 köşeye kadar (−Z yönünde köşe) → çeyrek halka", near(v, RING / 4, 1) or near(v, 3 * RING / 4, 1), (v, RING / 4))
    q = v
    a.setup(rev(end="vertex", vtx=[0, 0, -15], offA=10))
    v = a.vol()
    chk("R2 açısal öteleme +10° → 100° ya da 280°", near(v, RING * 100 / 360, 1) or near(v, RING * 280 / 360, 1), v)
    a.setup(rev(end="vertex", vtx=[0, 0, -15], rev=True))
    v = a.vol()
    chk("R3 ters yön → tamamlayıcı açı", near(v + q, RING, 1), (v, q))
    # yüzeye kadar: eksenden geçen düz yüz (sağ düzlemde, x 0..−5 levha, z −40..−30)
    plate = sketch("s0", "Eskiz0", RIGHT, lambda pt, line, rect, c, t: rect(30, 0, 40, 30))
    pe = ext("e0", "s0", 5)
    a.setup([plate, pe])
    fs = a.ev("window.__app.viewer.mesh.faces.filter(f=>f.n&&Math.abs(Math.abs(f.n[0])-1)<1e-6).map(f=>({c:f.c,n:f.n}))")
    f0 = [f for f in fs if abs(f["c"][0]) < 1e-6][0]
    f5 = [f for f in fs if abs(f["c"][0]) > 1][0]
    print("   levha yüzleri:", fs)
    feats = rev(end="face", face=f0)
    a.setup([plate, pe] + feats)
    errs = a.errs_tree()
    v = a.vol()
    print("   yüzeye kadar:", v, errs)
    chk("R4 yüzeye kadar hatasız, levha + çeyrek / üç çeyrek halka", not errs and (near(v - 1500, RING / 4, 2) or near(v - 1500, 3 * RING / 4, 2)), (v, errs))
    a.setup([plate, pe] + rev(end="face", face=f5))
    chk("R5 ekseni içermeyen yüz → hata", any("eksenini içermeli" in e for e in a.errs_tree()), a.errs_tree())
    # ince süpürme: üst düzlemde R10 daire profil, ön düzlemde 0→50 yol
    pr = sketch("sp", "Profil", TOP, lambda pt, line, rect, c, t: c(0, 0, 10))
    pa = sketch("sy", "Yol", FRONT, lambda pt, line, rect, c, t: line(pt(0, 0), pt(0, 50)))
    sw = {"id": "w1", "type": "sweep", "name": "Süpürme1", "sketch": "sp", "path": "sy", "cut": False, "thin": True, "thinT": 2}
    a.setup([pr, pa, sw])
    v = a.vol()
    chk("S1 ince süpürme R10 t2 → boru (dış ya da iç halka)", near(v, PI * (144 - 100) * 50, 2) or near(v, PI * (100 - 64) * 50, 2), v)
    # açık profil (yay yerine düz çizgi) + ince
    pr2 = sketch("sp", "Profil", TOP, lambda pt, line, rect, c, t: line(pt(-10, 0), pt(10, 0)))
    a.setup([pr2, pa, dict(sw, thinMode="mid")])
    v = a.vol()
    chk("S2 açık profil ince süpürme (orta) 20×2×50", near(v, 20 * 2 * 50, 2), (v, a.errs_tree()))
    # PM: süpürmede İnce özellik grubu, döndürmede uç koşulu
    a.setup(rev())
    a.tree_edit("Döndürme1")
    chk("P1 döndürme PM'de Uç koşulu", "Uç koşulu" in a.ev("document.querySelector('#pm-body').innerText"))
    a.cancel("discard")
    a.setup([pr, pa, dict(sw, thin=False)])
    a.tree_edit("Süpürme1")
    chk("P2 süpürme PM'de İnce özellik", "İnce özellik" in a.ev("document.querySelector('#pm-body').innerText"))
    a.cancel("discard")
    print("sayfa hataları:", a.errs[:5])
    a.close()
finish()

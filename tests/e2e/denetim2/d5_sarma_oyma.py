# d5 — Sarma: kabartma / oyma derinlik taraması (oyma hacminin kabartmanın yarısı çıkması: D5 bulgusu)
# Hazır model: Ø40×40 silindir + Sağ düzlemden 20 mm teğet düzlem + 10×10 kare eskiz (setDoc); sarma adımları gerçek UI.
import sys
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d5_lib import *

cs = sketch("s1", "Eskiz1", FRONT, lambda pt, line, rect, c, t: c(0, 0, 20))
cyl = ext("e1", "s1", 40, end="mid"); cyl["name"] = "Ekstrüzyon1"  # kare silindirin tam üstünde (z −20…20)
pl = {"id": "pl1", "type": "plane", "name": "Düzlem1", "base": RIGHT, "offset": 20, "flip": False}
sq = sketch("s2", "Eskiz2", {"k": "ref", "id": "pl1"}, lambda pt, line, rect, c, t: rect(-5, -5, 5, 5))

with sync_playwright() as p:
    a = App(p)
    res = {}
    for mode in ("Kabartma", "Oyma"):
        for dep in (1, 2):
            a.setup([cs, cyl, pl, sq]); a.iso()
            vc = a.vol()
            a.feature_cmd("Sarma")
            a.pick_face(lambda f: f['t'] == 'CYLINDRE')
            a.pmseg(mode)
            a.pmfield("Derinlik", dep)
            a.ok()
            res[(mode, dep)] = round(abs(a.vol() - vc), 2)
            print(mode, dep, res[(mode, dep)], a.errs_tree(), a.nfaces())
    # beklenen (projeksiyon): kabartma ≈ 10 · ∫ genişlik ≈ 10·(2r·asin(5/r))·d ; oyma ≈ aynı mertebe (iç yarıçapta biraz az)
    for dep in (1, 2):
        exp_e = 10 * 2 * (20 + dep / 2) * math.asin(5 / (20 + dep / 2)) * dep
        exp_d = 10 * 2 * (20 - dep / 2) * math.asin(5 / (20 - dep / 2)) * dep
        chk(f"S{dep}a kabartma {dep} mm ≈ {exp_e:.1f}", near(res[("Kabartma", dep)], exp_e, exp_e * 0.05), res[("Kabartma", dep)])
        chk(f"S{dep}b oyma {dep} mm ≈ {exp_d:.1f}", near(res[("Oyma", dep)], exp_d, exp_d * 0.05), res[("Oyma", dep)])
    a.close()
finish()

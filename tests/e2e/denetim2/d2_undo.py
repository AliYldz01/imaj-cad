# d2: var olan eskizi açıp ✕ ile çıkmak parça geri alma yığınını bozuyor mu?
from d2h import *


def two():
    f = plate(80, 60, 10)
    sk2 = sketch("s2", "Eskiz2", TOP, lambda pt, line, rect, c, t: c(0, 0, 10))
    f += [sk2, ext("e2", "s2", 30)]
    return f


with sync_playwright() as p:
    A = App(p)
    A.setup(two())
    v_all = A.vol(); print("hazır model", v_all)
    # gerçek kullanıcı adımı: ağaçtan e2 → Bastır (geri alınabilir adım)
    A.tree_act("e2", "Bastır"); A.wait(0.6)
    v_sup = A.vol(); print("e2 bastırıldı", v_sup)
    chk("bastırma modeli küçülttü", v_sup < v_all)
    # eskizi düzenle → hiçbir şey yapmadan ✕
    A.edit_sketch_of("e1")
    chk("eskiz açık", A.mode() == "sketch")
    A.cancel("discard")
    chk("✕ sonrası parça modu", A.mode() == "part")
    chk("✕ sonrası model aynı", abs(A.vol() - v_sup) < 1, A.vol())
    # Ctrl+Z: son kullanıcı adımı (bastırma) geri alınmalı
    A.press("Control+z"); A.wait(0.8)
    v_u = A.vol(); n = len(A.ev("window.__app.doc.features"))
    chk("Ctrl+Z → bastırma geri alınır (e2 görünür, model tam)", v_u is not None and abs(v_u - v_all) < 1, (v_u, n, "özellik"))

    # 2) değişiklik yapıp Kaydetmeden çık → aynı durum
    A.setup(two())
    A.tree_act("e2", "Bastır"); A.wait(0.6)
    A.edit_sketch_of("e1")
    A.dim_dbl(0, 100)
    A.cancel("discard")
    chk("Kaydetmeden çık → genişlik 80 kalır", abs(A.size()[0] - 80) < 0.01, A.size())
    A.press("Control+z"); A.wait(0.8)
    v_u = A.vol()
    chk("Kaydetmeden çık sonrası Ctrl+Z → bastırma geri alınır", v_u is not None and abs(v_u - v_all) < 1, v_u)

    # 3) ✓ ile çıkış, sonra Ctrl+Z eskiz değişikliğini, ikinci Ctrl+Z bastırmayı geri almalı
    A.setup(two())
    A.tree_act("e2", "Bastır"); A.wait(0.6)
    A.edit_sketch_of("e1")
    A.dim_dbl(0, 100)
    A.ok()
    chk("✓ → 100", abs(A.size()[0] - 100) < 0.01, A.size())
    A.press("Control+z"); A.wait(0.8)
    chk("1. Ctrl+Z → 80", abs(A.size()[0] - 80) < 0.01, A.size())
    A.press("Control+z"); A.wait(0.8)
    chk("2. Ctrl+Z → bastırma geri alınır", abs(A.vol() - v_all) < 1, A.vol())
    A.press("Control+y"); A.wait(0.8); A.press("Control+y"); A.wait(0.8)
    chk("2× Ctrl+Y → 100 ve bastırılmış", abs(A.size()[0] - 100) < 0.01 and abs(A.vol() - 60000) < 1, (A.size(), A.vol()))

    # 4) değişiklik yapmadan ✓ → boş geri alma adımı oluşuyor mu
    A.setup(two())
    A.tree_act("e2", "Bastır"); A.wait(0.6)
    A.edit_sketch_of("e1"); A.ok()
    A.press("Control+z"); A.wait(0.8)
    chk("değişikliksiz ✓ sonrası tek Ctrl+Z bastırmayı geri alır (boş adım yok)", abs(A.vol() - v_all) < 1, A.vol())
    print("Konsol:", A.errs)
    A.close()
finish()

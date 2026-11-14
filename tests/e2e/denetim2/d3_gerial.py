# d3 — eskiz düzenleme oturumu ile parça geri al / ileri al yığını:
# A) Eskizi düzenle → ✕ (vazgeç) önceki geri alma adımını siliyor mu?  B) geri al → eskiz düzenle ✓ → İleri al eskiz değişikliğini siliyor mu?
# Hazır model: 80×50 dikdörtgen (ölçülü) + 20 mm ekstrüzyon.
from d3_ortak import *
src = open("/home/claude/imaj-cad/tests/e2e/denetim2/d3_olcu2.py").read().split("with sync_playwright")[0]
exec(src)

with sync_playwright() as p:
    t = T(p)
    depth = lambda: (lambda b: b and round(b[1][2] - b[0][2], 3))(t.bbox())
    span = lambda: (lambda b: b and round(b[1][0] - b[0][0], 3))(t.bbox())

    def set_depth(v):
        t.tree_click("e1"); t.tree_act("Düzenle")
        f = t.pg.locator("#pm-body label:has-text('Derinlik') input, #pm-body .pm-field:has-text('Derinlik') input").first
        f.fill(str(v)); f.press("Enter"); time.sleep(0.3)
        t.pm_ok()

    # A
    t.setup([rect_sketch(), ext("e1", "s1", 20)])
    set_depth(35)
    t.chk("A: derinlik 35", depth() == 35, depth())
    t.edit_sketch("e1")
    t.pm_cancel("discard")
    t.chk("A: Eskizi düzenle → ✕ sonrası model aynı (35)", depth() == 35, depth())
    t.key("Control+z"); t.wait(0.8)
    t.chk("A: Ctrl+Z derinlik değişikliğini geri alır (20)", depth() == 20, depth())

    # A2: eskizde değişiklik yapıp ✕ → Kaydetmeden çık
    t.setup([rect_sketch(), ext("e1", "s1", 20)])
    set_depth(35)
    t.edit_sketch("e1")
    t.pg.locator(".dim").first.dblclick(); time.sleep(0.3); t.prompt_val(120)
    t.pm_cancel("discard")
    t.chk("A2: Kaydetmeden çık → genişlik 80", span() == 80, span())
    t.key("Control+z"); t.wait(0.8)
    t.chk("A2: ardından Ctrl+Z derinliği geri alır (20)", depth() == 20, depth())

    # B
    t.setup([rect_sketch(), ext("e1", "s1", 20)])
    set_depth(35)
    t.key("Control+z"); t.wait(0.8)
    t.chk("B: geri al → 20", depth() == 20, depth())
    t.edit_sketch("e1")
    t.pg.locator(".dim").first.dblclick(); time.sleep(0.3); t.prompt_val(120)
    t.pm_ok()
    t.chk("B: eskiz 120 → model 120", span() == 120, span())
    t.key("Control+y"); t.wait(0.8)
    t.chk("B: yeni işlemden sonra İleri al eskiz değişikliğini silmez (genişlik 120 kalır)", span() == 120, (span(), depth()))
    t.note("B: Ctrl+Y sonrası", span(), depth())

    # C: değişiklik yapmadan eskizi açıp ✓ → geri alma yığınına boş adım
    t.setup([rect_sketch(), ext("e1", "s1", 20)])
    set_depth(35)
    t.edit_sketch("e1"); t.pm_ok()
    t.key("Control+z"); t.wait(0.8)
    t.chk("C: değişikliksiz eskiz ✓ sonrası tek Ctrl+Z derinliği geri alır", depth() == 20, depth())
    t.close()

# d10 — GERİ AL / İLERİ AL tutarlılığı (eskiz, PM, ağaç, montaj, sekme geçişi) + eskiz ✕ / yenileme akıbeti
import sys; sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d10h import *


def d1(a):
    return a.featv("Ekstrüzyon1", "d1")


def skw(a):
    """Eskiz1 genişlik ölçüsü (D1)"""
    return a.ev("(()=>{const f=window.__app.doc.features.find(f=>f.name==='Eskiz1');const d=f.data.dims.find(x=>x.id==='D1');return d?d.v:null})()")


with sync_playwright() as p:
    a = App(p)

    if want("eskizx"):
        a.setup(block())
        a.edit_feat("Ekstrüzyon1"); a.pmfield("Derinlik", 30); a.ok()
        chk("adım 1: derinlik 30", d1(a) == 30)
        # eskizi aç, ölçüyü değiştir, ✕ → Kaydetmeden çık
        a.tact("Eskiz1", "Eskizi düzenle")
        a.dim_dbl(0, 100)
        a.cancel("discard")
        chk("✕ Kaydetmeden çık: genişlik 80 kalır", skw(a) == 80 and near(a.vol(), 144000, 1), (skw(a), a.vol()))
        a.undo()
        chk("Ctrl+Z → derinlik 30'dan 20'ye (önceki adım)", d1(a) == 20 and a.nfeat() == 2, (d1(a), a.nfeat(), a.names()))
        a.redo()
        chk("Ctrl+Y → derinlik 30", d1(a) == 30, d1(a))
        # Kaydet ve çık
        a.tact("Eskiz1", "Eskizi düzenle")
        a.dim_dbl(0, 100)
        a.btn("#pm-ok"); a.wait(0.8)
        chk("eskiz ✓: genişlik 100 → 180000", near(a.vol(), 180000, 1), a.vol())
        a.undo()
        chk("Ctrl+Z eskiz düzenlemesini geri alır → 144000", near(a.vol(), 144000, 1) and skw(a) == 80, (a.vol(), skw(a)))
        a.redo()
        chk("Ctrl+Y → 180000", near(a.vol(), 180000, 1), a.vol())
        # eskiz içinde Ctrl+Z
        a.tact("Eskiz1", "Eskizi düzenle")
        a.dim_dbl(0, 120)
        w_in = a.ed("return d.dims.find(x=>x.id==='D1').v")
        a.blur(); a.pg.keyboard.press("Control+z"); time.sleep(0.4)
        w_un = a.ed("return d.dims.find(x=>x.id==='D1').v")
        chk("eskiz içinde Ctrl+Z ölçüyü geri alır (120 → 100)", w_in == 120 and w_un == 100, (w_in, w_un))
        a.btn("#pm-ok"); a.wait(0.8)
        chk("eskiz ✓ (değişiklik yok)", near(a.vol(), 180000, 1), a.vol())

    if want("eskizyenile"):
        a.setup(block())
        a.tact("Eskiz1", "Eskizi düzenle")
        a.dim_dbl(0, 90)
        time.sleep(1.2)
        st = a.stored()
        w_st = [d["v"] for f in st["features"] if f["name"] == "Eskiz1" for d in f["data"]["dims"] if d["id"] == "D1"]
        note("eskiz açık, ✓ yok — kayıtta genişlik:", w_st)
        a.dq[:] = [True]  # yenilemede 'Ayrıl'
        a.pg.reload(); wait_ready(a.pg); time.sleep(1); a.wait(0.5)
        note("yenileme (ayrıl) sonrası genişlik:", skw(a), "hacim", a.vol())
        chk("onaylanmamış eskiz değişikliği yenileme sonrası ✕ ile aynı davranır (80) ya da açıkça korunur", skw(a) == 80, (skw(a), a.vol()))

    if want("pm"):
        a.setup(block())
        ex = a.ev("(()=>{const m=window.__app.viewer.mesh;const e=m.edges.find(e=>e.type==='LINE'&&Math.abs(e.m[1]-20)<1e-6&&Math.abs(e.m[2]-30)<1e-6);return e.m})()")
        a.pg.keyboard.press("Control+7"); a.press("f")
        a.cmd("Radyüs")
        a.wclick(ex)
        ne = a.ev("window.__app.mode.draft&&window.__app.mode.draft.edges.length")
        a.blur(); a.pg.keyboard.press("Control+z"); time.sleep(0.4)
        ne2 = a.ev("window.__app.mode.k==='pm'&&window.__app.mode.draft.edges.length")
        note("PM'de kenar seçildi:", ne, "→ Ctrl+Z sonrası:", ne2, "mod", a.mode())
        chk("PM açıkken Ctrl+Z belgeyi değiştirmez / PM'i bozmaz", a.mode() == "pm" and a.nfeat() == 2, (a.mode(), a.nfeat()))
        a.pmfield("Yarıçap", 4); a.ok()
        v_f = a.vol()
        a.undo(); chk("Ctrl+Z radyüsü kaldırır", a.nfeat() == 2 and near(a.vol(), 96000, 1))
        a.redo(); chk("Ctrl+Y radyüs geri", a.nfeat() == 3 and near(a.vol(), v_f, 1))

    if want("agac"):
        a.setup(block())
        a.tact("Ekstrüzyon1", "Bastır"); a.undo()
        chk("bastır → Ctrl+Z", not a.ev("!!window.__app.doc.features[1].off") and near(a.vol(), 96000, 1))
        a.dq[:] = ["X"]; a.tact("Ekstrüzyon1", "Adlandır"); a.undo()
        chk("adlandır → Ctrl+Z", "Ekstrüzyon1" in a.names(), a.names())
        a.tact("Ekstrüzyon1", "Buraya geri sar"); a.undo()
        chk("geri sar → Ctrl+Z", near(a.vol(), 96000, 1), a.vol())

    if want("montaj"):
        a.setup(block())
        a.btn("#tabs button[data-tab='asm']"); a.wait(1.5)
        on = a.ev("!!document.querySelector('#tree')") and a.ev("document.querySelector('#tabs button.active').dataset.tab") == "asm"
        note("montaj açıldı:", on, a.pg.locator("#cmds button[title]").evaluate_all("els=>els.map(e=>e.title)")[:12])
        a.cmd("Montajı Aç"); a.wait(1.5)
        for k in range(2):
            a.cmd("Bileşen Ekle"); a.wait(0.6)
            a.btn("dialog[open] button:has-text('Geçerli parça')"); a.wait(2)
            a.pg.keyboard.press("Escape"); time.sleep(0.3)
        nc = a.ev("window.__app.asm.doc.comps.length")
        note("bileşen sayısı:", nc)
        a.undo()
        nc2 = a.ev("window.__app.asm.doc.comps.length")
        chk("montajda Ctrl+Z bileşen eklemeyi geri alır; parça değişmez", nc2 == nc - 1 and a.nfeat() == 2, (nc, nc2, a.nfeat()))
        a.cmd("Parçaya Dön"); a.wait(0.8)
        a.edit_feat("Ekstrüzyon1"); a.pmfield("Derinlik", 25); a.ok()
        a.undo()
        chk("parçaya dönünce Ctrl+Z parçayı geri alır (25 → 20)", d1(a) == 20, d1(a))
        a.btn("#tabs button[data-tab='asm']"); a.wait(1.5)
        nc3 = a.ev("window.__app.asm.doc.comps.length"); a.redo()
        note("montaja dönüş: bileşen", nc3, "→ Ctrl+Y", a.ev("window.__app.asm.doc.comps.length"))
        chk("montaja dönünce Ctrl+Y montaj yığınında hâlâ var", a.ev("window.__app.asm.doc.comps.length") == nc, (nc3, a.ev("window.__app.asm.doc.comps.length")))
        a.reload()
        note("yenileme sonrası etkin sekme:", a.ev("document.querySelector('#tabs button.active').dataset.tab"), "bileşen", a.ev("window.__app.asm&&window.__app.asm.doc.comps.length"))
        a.btn("#tabs button[data-tab='features']"); a.wait(0.5)

    if want("sekme"):
        a.setup(block())
        a.edit_feat("Ekstrüzyon1"); a.pmfield("Derinlik", 30); a.ok()
        a.menu("Dosya", "Yeni parça")
        a.undo()
        note("yeni sekmede Ctrl+Z → sekmeler", a.tabs(), "özellik", a.nfeat())
        chk("yeni (boş) sekmede Ctrl+Z diğer belgeye dokunmaz", a.nfeat() == 0 and len(a.tabs()) == 2, (a.tabs(), a.nfeat()))
        a.btn("#doctabs .dtab:nth-child(1) span"); a.wait(0.8)
        a.undo()
        chk("1. sekmeye dönünce Ctrl+Z → 20", d1(a) == 20, d1(a))
        a.redo()
        chk("Ctrl+Y → 30", d1(a) == 30, d1(a))

    print("hatalar:", a.errs[:5])
    a.close()
finish()

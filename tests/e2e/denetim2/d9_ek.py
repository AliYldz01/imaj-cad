# d9 — Montaj ekleri: SmartMate (Alt + sürükle), Fiziksel dinamik, kütüphaneden sil, Esc
import sys, math; sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d9h import *

with sync_playwright() as p:
    A = App(p); S = Asm(A)
    to_lib(A, pin_doc())
    setdoc(A, plate_doc())
    S.open()
    P1 = S.add_current(); PN = S.add_lib("Pim"); P2 = S.add_current(); S.fit()
    i1, ipn, i2 = P1["id"], PN["id"], P2["id"]

    def C(i):
        return [c for c in S.comps() if c["id"] == i][0]

    # ---------- SmartMate ----------
    if want("SM"):
        a = S.screen(S.world(ipn, [3.5, 20, 3.5]))
        b = S.screen(S.world(i1, [30 - 3.5, 8, -30 - 3.5]))
        A.pg.keyboard.down("Alt")
        A.drag(a, b, steps=20)
        A.pg.keyboard.up("Alt")
        A.wait(0.5)
        ms = S.mates()
        ax = S.js("const c=a.doc.comps.find(x=>x.id===arg);const T=window.__app.THREE;return new T.Vector3(0,1,0).applyQuaternion(new T.Quaternion(...c.q)).toArray().map(v=>+v.toFixed(3))", ipn)
        chk("SM Alt+sürükle pim → delik: SmartMate eş merkezli", ms and ms[-1]["type"] == "concentric" and abs(C(ipn)["p"][0] - 30) < 0.05, (ms and ms[-1]["type"], C(ipn)["p"], A.toast()))
        chk("SM pim ters dönmez (ekseni +Y)", ax[1] > 0.99, ax)
        A.undo()
        chk("SM geri al", not S.mates())
    # ---------- Fiziksel dinamik ----------
    if want("PH"):
        # Plaka2'yi Plaka1'in yanına (x=110) koy, aynı yükseklik
        S.select_comp("Plaka<2>")
        A.cmd("Bileşeni Taşı"); A.pmselect("Yöntem", "delta"); A.pmfield("X", 110 - C(i2)["p"][0]); A.pmbtn("Uygula"); S.pmok()
        A.cmd("Fiziksel Dinamik")
        on = S.js("return a.physics")
        # pimi Plaka2'ye doğru (x artan) sürükle: pim 130'da Plaka2 içinde başlıyor → önce pimi y=10 üstüne taşı
        x0 = C(i2)["p"][0]
        s = S.screen(S.world(i2, [50, 10, -10]))
        t = S.screen(S.world(i1, [50, 10, -10]))
        A.drag(s, t, steps=25)   # Plaka2'yi sabit Plaka1'e doğru it
        chk("PH Fiziksel dinamik: sabite dayanınca girmez (Plaka2 Plaka1 ile girişimsiz)", on and C(i2)["p"][0] >= 100 - 0.5 or abs(C(i2)["p"][1]) > 9.9, (on, C(i2)["p"], A.ev("(document.querySelector('#hint')||{}).textContent")))
        A.cmd("Fiziksel Dinamik")
    # ---------- kütüphaneden sil ----------
    if want("LIB"):
        A.cmd("Bileşen Ekle")
        n0 = A.pg.locator("dialog.input-dialog[open] .pm-row").count()
        A.btn("dialog.input-dialog[open] .pm-row:has-text('Pim') button:has-text('Sil')")
        n1 = A.pg.locator("dialog.input-dialog[open] .pm-row").count()
        A.btn("dialog.input-dialog[open] button:has-text('Kapat')")
        lib = json.loads(A.ev("localStorage.getItem('imajcad.lib')") or "{}")
        chk("LIB kütüphaneden Sil: satır ve kayıt gider (onay sormadan)", n1 == n0 - 1 and "Pim" not in lib, (n0, n1, list(lib)))
    # ---------- yenilemeden sonraki ilk işlem geri alınabilir mi ----------
    if want("UN"):
        A.reload(); S.open(); A.wait(1.5)
        n0 = len(S.comps())
        tr = S.tree()
        chk("UN yenileme sonrası (eşleşmesiz) montaj ağacı gösterilir (parça ağacı değil)", any("Pim<1>" in t for t in tr), tr)
        S.fit()
        S.click_local(ipn, [3.5, 20, 3.5])
        S.act("Sil")
        chk("UN yenileme sonrası bileşen silindi", len(S.comps()) == n0 - 1)
        und = A.ev("!document.querySelector('#undo').disabled")
        A.undo()
        chk("UN yenileme sonrası ilk işlem (Sil) Ctrl+Z ile geri alınır", len(S.comps()) == n0, (len(S.comps()), "geri al düğmesi etkin" if und else "geri al düğmesi pasif"))
    print("hatalar:", A.errs[:5])
    A.close()
finish()

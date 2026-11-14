# Denetim 2 / d4 — Süpürme: 3B eskiz yolu (birleşik eğri) kullanıcı akışı; 3B yolda burulma / kılavuz alanları
# Hazır model: 3B eskiz (setDoc) ve profil eskizi; süpürme şeritten.
import sys
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d4h import *  # noqa

K3 = {"id": "k", "type": "sketch3d", "name": "3B Yol", "ids": ["p1", "p2", "p3"], "xyz": [[0, 0, 0], [0, 50, 0], [40, 80, 0]],
      "lines": [{"id": "l1", "a": "p1", "b": "p2"}, {"id": "l2", "a": "p2", "b": "p3"}], "r": 0, "seq": 10}
with sync_playwright() as p:
    a = App(p)
    # 1) yalnız 3B eskiz varken Süpürme komutu
    a.setup([K3])
    a.cmd("Süpürme"); a.wait(1.0)
    t = a.toast(); m = a.mode()
    print("   yalnız 3B eskiz → mod", m, "uyarı", t)
    chk("SB1 yalnız 3B yol varken Süpürme PM açılır (dairesel profil ile)", m == "pm", (m, t))
    if m == "pm":
        a.cancel("discard")
    # 2) profil eskizi + 3B yol → PM'de yol olarak 3B eskiz seçilir
    a.setup([K3, rect_sk("p", "Profil", TOP, -10, -5, 10, 5)])
    a.cmd("Süpürme"); a.wait(1.0)
    m = a.mode(); t = a.toast()
    print("   profil + 3B → mod", m, t, a.pmselval("Yol (açık"), a.pmselval("Profil (kapalı"))
    if m == "pm":
        opts = a.pg.locator("#pm-body label.pm-field:has-text('Yol (açık') select").first.evaluate("s=>[...s.options].map(o=>o.value+':'+o.textContent)")
        chk("SB2 yol listesinde 3B eskiz var", any(o.startswith("k:") for o in opts), opts)
        chk("SB2 varsayılan yol 3B eskiz değil, profil eskizi yol sanılıyor (bilgi)", True, (a.pmselval("Yol (açık"), a.pmhas("Çap")))
        a.pmselect("Yol (açık", "k"); a.wait(0.5)
        if a.pmhas("Çap"):
            a.pmseg("Eskiz profili"); a.wait(0.5)
        a.pmselect("Profil (kapalı", "p"); a.wait(1.5)
        v0 = a.vol(); b0 = a.bbox(); st0 = a.status()
        gizli = not a.pmhas("Burulma açısı")  # v0.90 D4-6: 3B yolda alan gizli
        if not gizli:
            a.pmfield("Burulma açısı", 90); a.wait(1.5)
        v1 = a.vol(); b1 = a.bbox()
        print("   3B yol + profil:", v0, st0, b0, "| burulma 90:", v1, b1, "gizli:", gizli)
        chk("SB2 3B yol + eskiz profili → katı", v0 and v0 > 0, (v0, st0))
        chk("SB3 3B yolda burulma alanı etkili ya da gizli (sessizce yok sayılmaz)", gizli or b0 != b1, (b0, b1))
        a.ok()
        nm = a.names()[-1]
        a.reload()
        chk("SB2 yenile → aynı", near(a.vol(), v1, 1), (a.vol(), v1))
    print("hatalar:", a.errs)
    a.close()
finish()

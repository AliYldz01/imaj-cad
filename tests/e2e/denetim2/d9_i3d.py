# d9 — Parça modundaki Instant3D oku montaja geçince ekranda kalıyor; montajda sürüklenince parça derinliği sessizce değişiyor
import sys; sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d9h import *
with sync_playwright() as p:
    for mob in (False, True):
        tag = "telefon" if mob else "masaüstü"
        A = App(p, mobile=mob); S = Asm(A)
        setdoc(A, plate_doc())
        A.edit_feat("Ekstrüzyon1"); A.ok()          # ağaçta Ekstrüzyon1 seçili kalır → Instant3D oku
        S.open(); S.add_current()
        q = "(()=>{const e=document.querySelector('.i3d-ar');if(!e||e.offsetParent===null)return null;const r=e.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()"
        r = A.ev(q)
        chk(f"I1 {tag}: montajda parçanın Instant3D oku görünmez", r is None, r)
        if r:
            A.drag(r, (r[0], r[1] - 60), steps=15); time.sleep(1.5)
            d1 = A.ev("window.__app.doc.features[1].d1")
            st = json.loads(A.ev("localStorage.getItem('imajcad.doc.v2')"))["features"][1]["d1"]
            chk(f"I1 {tag}: montajda ok sürüklenince parça derinliği değişmez (10)", d1 == 10 and st == 10, (d1, st))
            bb = S.bbox(S.comps()[0]["id"])
            chk(f"I1 {tag}: (değiştiyse) montaj bileşeni de aynı (tutarlı)", abs(bb[1][1] - bb[0][1] - d1) < 0.01, (bb, d1))
        hint = A.ev("(()=>{const e=document.querySelector('#hint');return e&&!e.hidden?e.textContent:''})()")
        chk(f"I1 {tag}: bileşen eklenince 'Bileşen Ekle ile parça ekleyin' ipucu kalkar", "Bileşen Ekle" not in (hint or ""), hint)
        A.close()
finish()

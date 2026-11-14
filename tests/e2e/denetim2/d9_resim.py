# d9 — Teknik resim: görünüşler, otomatik ölçüler, kullanıcı ölçüsü + tolerans, pürüzlülük, GDT, referans, görünüş taşıma,
#      gizle / göster, detay B / 2. sayfa, kesit, izometrik, kağıt / ölçek / antet, belge özellikleri (ISO / ANSI, ondalık),
#      SVG / DXF indirme ve PARÇA DEĞİŞİNCE RESİM (eski ölçü kalmamalı), geri al, yenile.
# Hazır model: Ön düzlemde 100×60 plaka, 10 kalın, Ø10 delik (30,30) — setDoc; diğer tüm adımlar gerçek tıklama / klavye.
import sys, math; sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d9h import *


def front_plate():
    fs = [rect0_sk("s1", "Eskiz1", FRONT, 100, 60), ext("e1", "s1", 10, name="Ekstrüzyon1"),
          hole_sk("s2", "Eskiz2", FRONT, [(30, 30, 10)]), ext("e2", "s2", 10, cut=True, end="through", name="Delik1")]
    return {"version": 2, "name": "ResimPlaka", "features": fs, "seq": {}, "material": "steel"}


class TD:
    def __init__(self, A):
        self.A = A; self.pg = A.pg

    def open(self, how="cmd"):
        A = self.A
        if how == "cmd":
            A.btn("#tabs button[data-tab='evaluate']"); A.cmd("Teknik Resim")
        else:
            A.btn("#menus button:text-is('Dosya')")
            A.pg.locator(".menu-drop button:has-text('Teknik resim…')").first.click()
        for _ in range(120):
            time.sleep(0.25)
            if A.pg.locator("dialog.draw-dialog[open]").count() and self.svg():
                break
        time.sleep(0.6)

    def close(self):
        self.A.btn("dialog.draw-dialog[open] form button:has-text('Kapat')")
        time.sleep(0.4)

    def svg(self, i=0):
        return self.A.ev("i=>{const d=document.querySelector('dialog.draw-dialog[open]');return d&&d._sheets?d._sheets[i]||'':''}", i)

    def nsheets(self):
        return self.A.ev("(()=>{const d=document.querySelector('dialog.draw-dialog[open]');return d&&d._sheets?d._sheets.length:0})()")

    def texts(self, i=0):
        return re.findall(r"<text[^>]*>([^<]*)</text>", self.svg(i))

    def dr(self):
        return self.A.ev("(()=>{const d=document.querySelector('dialog.draw-dialog[open]');return JSON.parse(JSON.stringify(d._dr))})()")

    def places(self):
        return self.A.ev("(()=>{const d=document.querySelector('dialog.draw-dialog[open]');return JSON.parse(JSON.stringify(d._td.places))})()")

    def paper_to_screen(self, x, y):
        return self.A.ev("""([x,y])=>{const fr=document.querySelector('dialog.draw-dialog[open] iframe');const sv=fr.contentDocument.querySelector('.page svg');
          const m=sv.getScreenCTM();const p=new DOMPoint(x,y).matrixTransform(m);const r=fr.getBoundingClientRect();return [r.left+p.x,r.top+p.y]}""", [x, y])

    def view_to_screen(self, k, vx, vy, rel=True):
        """rel: (vx,vy) görünüşün sol alt köşesine göre (mm)"""
        P = self.places()[k]
        if rel:
            vx += P["min"][0]; vy += P["min"][1]
        x = P["ox"] + (vx - P["min"][0]) * P["s"]; y = P["oy"] + (P["max"][1] - vy) * P["s"]
        return self.paper_to_screen(x, y)

    def scroll_to(self, k, vx, vy, rel=True):
        s = self.view_to_screen(k, vx, vy, rel)
        fr = self.A.ev("(()=>{const r=document.querySelector('dialog.draw-dialog[open] iframe').getBoundingClientRect();return [r.top,r.bottom]})()")
        if not (fr[0] + 10 < s[1] < fr[1] - 10):
            self.A.ev("dy=>document.querySelector('dialog.draw-dialog[open] iframe').contentWindow.scrollBy(0,dy)", s[1] - (fr[0] + fr[1]) / 2)
            time.sleep(0.3)
            s = self.view_to_screen(k, vx, vy, rel)
        return s

    def click_view(self, k, vx, vy):
        s = self.scroll_to(k, vx, vy)
        self.pg.mouse.click(s[0], s[1]); time.sleep(0.6)
        return s

    def tool(self, t):
        self.A.btn(f"dialog.draw-dialog[open] .td-tools button[data-tool='{t}']")

    def dim_box(self, key):
        """ölçü grubunun ekran merkezi"""
        return self.A.ev("""k=>{const fr=document.querySelector('dialog.draw-dialog[open] iframe');const g0=fr.contentDocument.querySelector('[data-dim="'+k+'"]');if(!g0)return null;const g=g0.querySelector('text')||g0;
          const b=g.getBoundingClientRect();const r=fr.getBoundingClientRect();return [r.left+b.left+b.width/2,r.top+b.top+b.height/2]}""", key)

    def opt_check(self, label, on=True):
        loc = self.pg.locator(f"dialog.draw-dialog[open] .td-opts label.check:has-text('{label}') input").first
        if loc.is_checked() != on:
            loc.click(); time.sleep(1.5)
            for _ in range(60):
                if not self.A.busy():
                    break
                time.sleep(0.25)
            time.sleep(0.5)

    def opt_select(self, label, v):
        self.pg.locator(f"dialog.draw-dialog[open] .td-opts label.check:has-text('{label}') select").first.select_option(v); time.sleep(0.6)

    def opt_text(self, label, v):
        loc = self.pg.locator(f"dialog.draw-dialog[open] .td-opts label.check:has-text('{label}') input").first
        loc.fill(v); loc.press("Tab"); time.sleep(0.6)

    def edit_text(self):
        return self.A.ev("(()=>{const e=document.querySelector('dialog.draw-dialog[open] .td-edit');return e?e.innerText:''})()")


def numtexts(ts):
    return [t for t in ts if re.fullmatch(r"[Ø]?\d+([.,]\d+)?", t.strip())]


with sync_playwright() as p:
    A = App(p); T = TD(A)
    setdoc(A, front_plate())
    A.edit_feat("Ekstrüzyon1"); A.ok()
    chk("R0 parça 100×60×10", A.size() == [100, 60, 10], A.size())
    # ---------- R1: aç, görünüşler, otomatik ölçüler ----------
    T.open("menu")
    sv = T.svg(); ts = T.texts()
    nviews = len(re.findall(r'data-view="', sv))
    chk("R1 Dosya > Teknik resim…: 5 görünüş grubu (ön/üst/sol/izo + ?)", nviews >= 4, (nviews, re.findall(r'data-view="([^"]+)"', sv)))
    chk("R1 otomatik ölçüler 100 / 60 / 10 ve Ø10", all(x in ts for x in ["100", "60", "10"]) and any("Ø10" in t for t in ts), numtexts(ts))
    chk("R1 antet: parça adı, malzeme adı (anahtar değil)", "ResimPlaka" in sv and "steel" not in sv, [t for t in ts if "Çelik" in t or "steel" in t or "çeli" in t])
    # ---------- R2: kullanıcı ölçüsü (iki köşe) ----------
    T.tool("dim")
    T.click_view("front", 0, 0); T.click_view("front", 100, 0)
    d = T.dr()
    chk("R2 Ölçü ekle: iki köşe → kullanıcı ölçüsü 100", len(d["user"]) == 1 and abs(abs(d["user"][0]["a"][0] - d["user"][0]["b"][0]) - 100) < 0.01, d["user"])
    uk = "u:" + d["user"][0]["id"] if d["user"] else None
    # daire çevresi → çap
    T.click_view("front", 35, 30)
    d = T.dr()
    chk("R2 daire çevresine dokun → Ø10 ölçüsü", len(d["user"]) == 2 and d["user"][1]["dir"] == "d", [u["dir"] for u in d["user"]])
    # ---------- R3: tolerans ----------
    T.tool("sel")
    bx = T.dim_box(uk)
    A.pg.mouse.click(bx[0], bx[1]); time.sleep(0.6)
    et = T.edit_text()
    chk("R3 ölçüye tıklayınca düzenleme alanı", "Ölçü" in et and "Tolerans" in et, et[:120].replace("\n", " | "))
    A.pg.locator("dialog.draw-dialog[open] .td-edit label.check:has-text('Tolerans') select").first.select_option("sym"); time.sleep(0.6)
    sv = T.svg()
    chk("R3 ± tolerans resimde", "±" in sv and ("0,1" in sv or "0.1" in sv), [t for t in T.texts() if "±" in t])
    # ---------- R4: pürüzlülük / GDT / referans ----------
    for tl in ("ra", "gdt", "datum"):
        T.tool(tl)
        T.click_view("front", 100, 45)
    d = T.dr()
    chk("R4 Ra + GDT + referans eklendi", sorted(n["kind"] for n in d["notes"]) == ["datum", "gdt", "ra"], [n["kind"] for n in d["notes"]])
    sv = T.svg()
    chk("R4 sembol metinleri (3,2 / ⏥ 0,05 / A)", "3,2" in sv and "⏥" in sv and ">A<" in sv, None)
    # ---------- R5: otomatik ölçüyü sürükle, görünüşü taşı ----------
    T.tool("sel")
    keys = A.ev("(()=>{const fr=document.querySelector('dialog.draw-dialog[open] iframe');return [...fr.contentDocument.querySelectorAll('[data-dim]')].map(g=>g.dataset.dim)})()")
    k0 = [k for k in keys if k in ("fw", "fh", "th")][:1]
    if k0:
        bx = T.dim_box(k0[0])
        A.pg.mouse.move(bx[0], bx[1]); A.pg.mouse.down()
        for i in range(1, 11):
            A.pg.mouse.move(bx[0] + 2 * i, bx[1] + 3 * i); time.sleep(0.03)
        A.pg.mouse.up(); time.sleep(0.6)
    d = T.dr()
    chk("R5 otomatik ölçü sürüklendi (öteleme kaydı)", k0 and k0[0] in d["off"], (k0, d["off"]))
    # görünüşü taşı: sol görünüş grubunu sürükle
    P = T.places()
    lv = "left" if "left" in P else list(P)[2]
    L = P[lv]
    s = T.scroll_to(lv, (L["max"][0] - L["min"][0]) / 2, (L["max"][1] - L["min"][1]) / 2)
    A.pg.mouse.move(s[0], s[1]); A.pg.mouse.down()
    for i in range(1, 11):
        A.pg.mouse.move(s[0] + 4 * i, s[1] + 1 * i); time.sleep(0.03)
    A.pg.mouse.up(); time.sleep(0.6)
    d = T.dr()
    chk("R5 görünüş sürükle-bırak → vOff", lv in d["vOff"], (lv, d["vOff"]))
    # ---------- R6: otomatik ölçüyü gizle / göster ----------
    k1 = [k for k in keys if k == "fh"] or [k for k in keys if not k.startswith("u:") and not k.startswith("n:")][:1]
    bx = T.dim_box(k1[0]); A.pg.mouse.click(bx[0], bx[1]); time.sleep(0.5)
    A.btn("dialog.draw-dialog[open] .td-edit button:has-text('Gizle')")
    chk("R6 Gizle: ölçü kalkar", T.dim_box(k1[0]) is None, k1)
    shown = A.pg.locator("dialog.draw-dialog[open] .td-tools button:has-text('Gizli ölçüleri göster')").count()
    chk("R6 gizledikten hemen sonra 'Gizli ölçüleri göster' düğmesi görünür", shown == 1, shown)
    if not shown:
        T.tool("sel")
    A.btn("dialog.draw-dialog[open] .td-tools button:has-text('Gizli ölçüleri göster')")
    chk("R6 Gizli ölçüleri göster", T.dim_box(k1[0]) is not None)
    # ---------- R7: kesit, izometrik, detay, 2. sayfa, kağıt, ölçek, antet ----------
    T.opt_check("Kesit A-A", True)
    chk("R7 Kesit A-A: tarama + 'A-A'", "url(#hatch)" in T.svg() and any("A-A" in t for t in T.texts()), None)
    T.opt_check("İzometrik", False)
    chk("R7 İzometrik kapalı → iso görünüşü yok", 'data-view="iso"' not in T.svg())
    T.opt_check("İzometrik", True)
    T.opt_check("Detay B", True)
    chk("R7 Detay B → 2 sayfa", T.nsheets() == 2, T.nsheets())
    T.opt_select("Kağıt", "A3")
    chk("R7 Kağıt A3 → 420 mm genişlik", 'width="420mm"' in T.svg() or 'viewBox="0 0 420 297"' in T.svg(), re.findall(r'viewBox="[^"]*"', T.svg())[:1])
    T.opt_select("Ölçek", "1")
    chk("R7 Ölçek 1:1 antette", "1:1" in T.svg(), [t for t in T.texts() if ":" in t][:5])
    T.opt_text("Çizen", "Ali Y."); T.opt_text("Resim no", "R-001"); T.opt_text("Malzeme", "S235")
    sv = T.svg()
    chk("R7 antet: çizen / resim no / malzeme", "Ali Y." in sv and "R-001" in sv and "S235" in sv)
    # ---------- R8: SVG / DXF indir ----------
    S = Asm(A)
    fn, svgf, _ = S.download(lambda: A.btn("dialog.draw-dialog[open] .cut-bar button:has-text('SVG indir')"))
    chk("R8 SVG indir: içerik güncel (tolerans, A3)", fn.endswith(".svg") and "±" in svgf and "420" in svgf, fn)
    fn, dxf, _ = S.download(lambda: A.btn("dialog.draw-dialog[open] .cut-bar button:has-text('DXF indir')"))
    layers = set(re.findall(r"\n *8\n([A-Z]+)\n", dxf))
    chk("R8 DXF indir: katmanlar ve 100 / 60 yazıları", fn.endswith(".dxf") and {"GORUNUR", "OLCU"} <= layers and "\n100\n" in dxf and "\n60\n" in dxf, (fn, layers))
    T.close()
    # kalıcılık: yeniden aç
    T.open()
    d = T.dr()
    chk("R9 yeniden açınca kullanıcı ölçüleri / notlar / öteleme korunur", len(d["user"]) == 2 and len(d["notes"]) == 3 and d["vOff"], (len(d["user"]), len(d["notes"]), d["vOff"]))
    T.close()
    A.reload()
    T.open()
    d = T.dr()
    chk("R9 sayfa yenilendikten sonra da korunur", len(d["user"]) == 2 and len(d["notes"]) == 3, (len(d["user"]), len(d["notes"])))
    T.close()
    # ---------- R10: PARÇA DEĞİŞİR → resim ----------
    A.btn("#tabs button[data-tab='features']"); A.wait(0.5)
    A.tact("Ekstrüzyon1", "Eskizi düzenle"); A.dim_dbl(0, 120); A.ok()
    chk("R10 parça genişliği 120", A.size()[0] == 120, A.size())
    T.open()
    ts = T.texts(); d = T.dr()
    chk("R10 otomatik ölçü 120 (eski 100 değil)", "120" in ts, numtexts(ts))
    ud = [t for t in ts if t.startswith("100")]
    chk("R10 köşeden köşeye kullanıcı ölçüsü yeni geometriyi izler (120) — eski '100' kalmaz", "100" not in [t.split("±")[0].strip() for t in ts], (numtexts(ts), d["user"][0]))
    A.pg.screenshot(path=OUT + "/R10_resim.png")
    # ---------- R11: resimde not ekle → parçada Ctrl+Z → resim notları? ----------
    T.tool("datum"); T.click_view("front", 0, 45)
    n_before = len(T.dr()["notes"])
    T.close()
    A.undo()
    chk("R11 Ctrl+Z parçayı geri alır (100)", A.size()[0] == 100, A.size())
    T.open()
    n_after = len(T.dr()["notes"])
    chk("R11 parçada Ctrl+Z, resimde sonradan eklenen açıklamaları silmez", n_after == n_before, (n_before, n_after))
    T.close()
    # ---------- R12: Belge özellikleri ANSI + ondalık ----------
    A.press("Escape")
    A.btn("#menus button:text-is('Dosya')")
    items = A.ev("[...document.querySelectorAll('.menu-drop button')].map(b=>b.textContent)")
    A.press("Escape"); A.ev("document.body.click()")
    chk("R12 masaüstü Dosya menüsünde 'Belge özellikleri…' var", any("Belge özellikleri" in x for x in items), items)
    vis = A.ev("(()=>{const b=document.querySelector('#file-btn');return !!b&&b.offsetParent!==null})()")
    if vis:
        A.btn("#file-btn"); A.btn("#file-menu button[data-act='docprops']")
    else:
        A.pg.fill("#cmd-search", "Belge özellikleri"); time.sleep(0.6)
        A.pg.locator(".search-drop button").first.click()
    time.sleep(0.5)
    A.pg.locator("dialog.docprops[open] label.pm-field:has-text('Resim standardı') select").select_option("ANSI")
    A.pg.locator("dialog.docprops[open] label.pm-field:has-text('ondalık') input").fill("1")
    A.btn("dialog.docprops[open] button:has-text('Tamam')")
    T.open()
    sv = T.svg()
    chk("R12 ANSI: üçüncü açı + SAĞ GÖRÜNÜŞ", "Üçüncü açı" in sv, [t for t in T.texts() if "açı" in t.lower()][:3])
    T.close()
    print("hatalar:", A.errs[:5])
    A.close()
finish()

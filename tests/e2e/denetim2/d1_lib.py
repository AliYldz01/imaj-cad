# Denetim 2 / d1 (eskiz çizim araçları) ortak yardımcılar — yalnız kullanıcı gibi (gerçek fare / klavye / CDP dokunma)
import sys, time, json
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e')
import cmdpatch  # noqa: F401  (komut grubu düğmesini açar)
from h import wait_ready, URL
from playwright.sync_api import sync_playwright

ED = "window.__app.mode.editor"


class T:
    """Tek tarayıcı sayfası + ölçüm/yardımcılar"""

    def __init__(self, p, mobile=False, name="d1"):
        self.name = name
        self.mobile = mobile
        self.ok = True
        self.fails = []
        self.b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        if mobile:
            self.ctx = self.b.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True, device_scale_factor=2)
        else:
            self.ctx = self.b.new_context(viewport={"width": 1400, "height": 900})
        self.pg = self.ctx.new_page()
        self.errs = []
        self.pg.on("pageerror", lambda e: self.errs.append("pageerror: " + str(e)))
        self.pg.on("console", lambda m: m.type == "error" and self.errs.append("console: " + m.text))
        self.pg.on("dialog", lambda d: d.accept())
        self.pg.goto(URL)
        wait_ready(self.pg)
        time.sleep(0.5)
        self.cdp = self.ctx.new_cdp_session(self.pg) if mobile else None

    # ---------- genel
    def ev(self, js, arg=None):
        return self.pg.evaluate(js, arg) if arg is not None else self.pg.evaluate(js)

    def chk(self, n, c, info=""):
        c = bool(c)
        if not c:
            self.ok = False
            self.fails.append(n)
        print(("TAMAM " if c else "HATA  ") + n, info, flush=True)
        return c

    def fresh(self):
        """boş belge (başlangıç durumu: localStorage temizlenip sayfa yenilenir)"""
        self.ev("localStorage.removeItem('imajcad.doc.v2'); localStorage.removeItem('imajcad.tabs')")
        self.pg.reload()
        wait_ready(self.pg)
        time.sleep(0.6)

    def reload(self):
        time.sleep(0.8)  # saveDocSoon 400 ms
        self.pg.reload()
        wait_ready(self.pg)
        time.sleep(0.8)

    def wait(self):
        time.sleep(0.3)
        wait_ready(self.pg)

    def mode(self):
        return self.ev("window.__app.mode.k")

    # ---------- dokunma (telefon)
    def touch(self, kind, pts):
        self.cdp.send("Input.dispatchTouchEvent", {"type": kind, "touchPoints": [{"x": x, "y": y, "id": i} for i, (x, y) in enumerate(pts)]})

    def tap_xy(self, x, y, hold=0.0):
        self.touch("touchStart", [(x, y)])
        time.sleep(0.03 + hold)
        self.touch("touchEnd", [])
        time.sleep(0.4)

    def tap(self, sel):
        """DOM öğesine gerçek dokunma (CDP)"""
        loc = self.pg.locator(sel).first
        loc.scroll_into_view_if_needed()
        bb = loc.bounding_box()
        self.tap_xy(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2)

    def press(self, sel):
        """masaüstünde tık, telefonda dokunma"""
        if self.mobile:
            self.tap(sel)
        else:
            self.pg.click(sel)

    # ---------- şerit / komut
    def tab(self, t):
        self.press(f"#tabs button[data-tab='{t}']")
        time.sleep(0.2)

    def cmd(self, label):
        # grup gizliyse önce aç (telefon / dar ekran; masaüstünde hepsi görünür)
        self.ev("t=>window.__app && window.__app.showCmd && window.__app.showCmd(t)", label)
        sel = f"#cmds button[title='{label}'], #tray button[title='{label}']"
        loc = self.pg.locator(sel)
        vis = [i for i in range(loc.count()) if loc.nth(i).is_visible()]
        if not vis:
            raise RuntimeError("komut görünmüyor: " + label)
        el = loc.nth(vis[0])
        if self.mobile:
            # telefonda bildirim (#toast) alt tepsinin üstünü örter ve dokunuşu yutar: kaybolmasını bekle
            for _ in range(30):
                if self.ev("document.querySelector('#toast').hidden"): break
                time.sleep(0.2)
            el.scroll_into_view_if_needed()
            bb = el.bounding_box()
            self.tap_xy(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2)
        else:
            el.click()
        time.sleep(0.25)

    def ok_pm(self):
        self.press("#pm-ok")
        time.sleep(0.5)
        wait_ready(self.pg)

    def cancel_pm(self):
        self.press("#pm-cancel")
        time.sleep(0.5)

    def exit_dialog(self, v):
        loc = self.pg.locator(f"dialog.exit-dialog button[data-v='{v}']")
        if loc.count() and loc.first.is_visible():
            self.press(f"dialog.exit-dialog button[data-v='{v}']")
            time.sleep(0.5)
            return True
        return False

    def tree_click(self, text):
        if self.mobile:
            if not self.ev("document.querySelector('#side').classList.contains('open')") and not self.ev("document.querySelector('#side').classList.contains('pm-open')"):
                self.press("#tree-btn")
                time.sleep(0.3)
        sel = f"#tree li:has-text('{text}')"
        if "sel" in (self.pg.locator(sel).first.get_attribute("class") or "").split():
            return  # zaten seçili (tıklamak seçimi kaldırır)
        self.press(sel)
        time.sleep(0.2)

    def tree_action(self, text):
        self.press(f"#tree-actions button:has-text('{text}')")
        time.sleep(0.6)

    def new_sketch(self, plane="Ön Düzlem"):
        """ağaçta düzlemi seç → şeritte Eskiz (kullanıcı yolu)"""
        if self.mode() == "sketch":
            raise RuntimeError("zaten eskizde")
        self.tab("sketch")
        self.tree_click(plane)
        self.cmd("Eskiz")
        time.sleep(1.2)
        if self.mobile:
            self.close_sheet()
        return self.mode() == "sketch"

    def close_sheet(self):
        """telefonda alt paneli küçült (▾) — kullanıcı da çizim alanını açmak için böyle yapar"""
        if not self.ev("document.querySelector('#side').classList.contains('min')"):
            self.press("#pm .sheet-min"); time.sleep(0.4)

    # ---------- eskiz koordinatı ↔ ekran
    def sc(self, x, y):
        return self.ev("""([x,y])=>{const e=window.__app.mode.editor,f=e.frame;const yv=[f.n[1]*f.x[2]-f.n[2]*f.x[1],f.n[2]*f.x[0]-f.n[0]*f.x[2],f.n[0]*f.x[1]-f.n[1]*f.x[0]];
          const w=[0,1,2].map(i=>f.o[i]+f.x[i]*x+yv[i]*y);const s=window.__app.viewer.toScreen(w);const r=window.__app.viewer.renderer.domElement.getBoundingClientRect();return [r.left+s[0],r.top+s[1]]}""", [x, y])

    def ppx(self):
        """1 mm kaç piksel"""
        a = self.sc(0, 0); b = self.sc(10, 0)
        return abs(b[0] - a[0]) / 10

    def zoom_to(self, mm_w=200):
        """eskizi yakınlaştır: ekranda ~mm_w genişlik görünsün (tekerlek = kullanıcı hareketi; telefonda yapılmaz)"""
        if self.mobile: return
        sgn = 1
        for _ in range(40):
            vw = self.ev("window.__app.viewer.renderer.domElement.getBoundingClientRect().width")
            cur = vw / self.ppx()
            if abs(cur - mm_w) / mm_w < 0.2:
                return
            x, y = self.sc(0, 0)
            self.pg.mouse.move(x, y)
            want_in = cur > mm_w
            self.pg.mouse.wheel(0, sgn * (-100 if want_in else 100))
            time.sleep(0.2)
            nw = vw / self.ppx()
            if (nw > cur) == want_in and abs(nw - cur) > 1e-6:
                sgn = -sgn

    def mclick(self, x, y, mods=None, dbl=False, button="left"):
        sx, sy = self.sc(x, y)
        self.pg.mouse.move(sx - 6, sy - 4)
        self.pg.mouse.move(sx, sy, steps=3)
        time.sleep(0.05)
        if mods:
            for m in mods: self.pg.keyboard.down(m)
        if dbl:
            self.pg.mouse.dblclick(sx, sy)
        else:
            self.pg.mouse.click(sx, sy, button=button)
        if mods:
            for m in mods: self.pg.keyboard.up(m)
        time.sleep(0.12)

    OFF = 70  # parmakla çizimde imleç parmağın 70 px üstünde (prefs.cursorOffset)
    def tclick(self, x, y, off=None):
        """telefonda eskiz noktasına dokun: parmak imleci OFF px yukarıda olduğundan OFF px aşağıya dokunulur"""
        sx, sy = self.sc(x, y)
        if off is None:
            # v0.89 (D2-5): seçerek çalışan araçlarda (Akıllı Ölçü, kırp, radyüs…) imleç kayması yok
            tool = self.ev("(()=>{const m=window.__app.mode;return m.k==='sketch'?m.editor.tool:''})()")
            pick = ["select", "trim", "extend", "fillet", "schamfer", "split", "convert", "pierce", "isect", "dim", "eqcurve", "ordinate", "jog", "block", "offset", "mirror", "spat", "scpat", "move"]
            off = 0 if tool in pick else self.OFF
        self.tap_xy(sx, sy + off)

    def pick(self, x, y, **kw):
        if self.mobile:
            self.tclick(x, y)
        else:
            self.mclick(x, y, **kw)

    def drag(self, x0, y0, x1, y1, steps=10):
        a = self.sc(x0, y0); b = self.sc(x1, y1)
        if self.mobile and getattr(self, "drag_off", 0):
            a = (a[0], a[1] + self.drag_off); b = (b[0], b[1] + self.drag_off)
        if self.mobile:
            self.touch("touchStart", [a])
            for i in range(1, steps + 1):
                t = i / steps
                self.touch("touchMove", [(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)])
                time.sleep(0.02)
            self.touch("touchEnd", [])
        else:
            self.pg.mouse.move(*a)
            self.pg.mouse.down()
            self.pg.mouse.move(*b, steps=steps)
            self.pg.mouse.up()
        time.sleep(0.3)

    def key(self, k):
        self.pg.keyboard.press(k)
        time.sleep(0.15)

    def close_quick(self):
        """çizimden sonra açılan hızlı ölçü kutusu: ✕ (değer girmeden)"""
        loc = self.pg.locator(".dim-prompt.quick .no")
        if loc.count() and loc.first.is_visible():
            self.press(".dim-prompt.quick .no")
            time.sleep(0.1)

    def quick_open(self):
        loc = self.pg.locator(".dim-prompt.quick")
        return loc.count() > 0 and loc.first.is_visible()

    # ---------- durum okuma (yalnız okuma)
    def st(self):
        return self.ev("""(()=>{const e=window.__app.mode.editor; if(!e) return null; const d=e.data;
          return {ents:d.ents.map(x=>x.t+(x.cons?'*':'')), ids:d.ents.map(x=>x.id), rels:d.rels.map(r=>r.t), dims:d.dims.map(m=>[m.t,+(+m.v).toFixed(3),!!m.ref]),
            npts:Object.keys(d.pts).length, dof:e.result&&e.result.dof, ok:e.result&&e.result.ok, conf:e.result?e.result.conflicts.length:0,
            status:document.querySelector('#status-text').textContent, tool:e.tool, drawing:e.isDrawing()}})()""")

    def data(self):
        return self.ev(ED + ".data")

    def ents_of(self, t):
        return [e for e in self.data()["ents"] if e["t"] == t]

    def P(self, pid):
        d = self.data()
        if pid == "O" or pid not in d["pts"]: return (0.0, 0.0)
        q = d["pts"][pid]; return (q["x"], q["y"])

    def saved(self):
        return json.loads(self.ev("localStorage.getItem('imajcad.doc.v2')") or "null")

    def feats(self):
        return self.ev("window.__app.doc.features.map(f=>[f.id,f.type,f.name])")

    def vol(self):
        try:
            return round(self.ev("window.__app.kernel.props().then(p=>p.volume)"), 2)
        except Exception as ex:
            return None

    def bbox(self):
        m = self.ev("(()=>{const m=window.__app.viewer.mesh; return m&&m.bbox&&[m.bbox.min,m.bbox.max]})()")
        if not m: return None
        return [[round(v, 2) for v in m[0]], [round(v, 2) for v in m[1]]]

    def tree_errs(self):
        return self.pg.eval_on_selector_all("#tree li.err", "els=>els.map(e=>e.textContent)")

    def dim_dbl(self, idx=0, value=None):
        """ölçü etiketine çift tık → Değiştir kutusu → değer + Enter"""
        loc = self.pg.locator(".dim").nth(idx)
        for _ in range(8):  # etiket görünür alanda değilse uzaklaştır (tekerlek)
            bb = loc.bounding_box(); r = self.ev("(()=>{const r=window.__app.viewer.renderer.domElement.getBoundingClientRect();return [r.left,r.top,r.right,r.bottom]})()")
            if bb and r[0] + 5 < bb["x"] and bb["x"] + bb["width"] < r[2] - 5 and r[1] + 5 < bb["y"] and bb["y"] + bb["height"] < r[3] - 5:
                break
            if self.mobile: break
            z0 = self.ppx()
            self.pg.mouse.move((r[0] + r[2]) / 2, (r[1] + r[3]) / 2); self.pg.mouse.wheel(0, 200); time.sleep(0.25)
            if self.ppx() > z0:  # yanlış yön: geri al ve ters çevir
                self.pg.mouse.wheel(0, -400); time.sleep(0.25)
        if self.mobile:
            bb = loc.bounding_box(); x, y = bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2
            self.tap_xy(x, y)
            if not self.pg.locator(".dim-prompt input").count():
                self.tap_xy(x, y)
        else:
            loc.dblclick()
        time.sleep(0.3)
        if value is not None:
            self.pg.fill(".dim-prompt input", str(value))
            self.pg.press(".dim-prompt input", "Enter")
            time.sleep(0.4)

    def smart_dim(self, clicks, value, place):
        """Akıllı Ölçü: verilen noktalara/öğelere tıkla, etiket yeri, değer yaz, Enter"""
        self.cmd("Akıllı Ölçü")
        for c in clicks:
            self.pick(*c)
            time.sleep(0.1)
        self.pick(*place)
        time.sleep(0.3)
        loc = self.pg.locator(".dim-prompt input")
        got = loc.count() > 0 and loc.first.is_visible()
        if got:
            self.pg.fill(".dim-prompt input", str(value))
            self.pg.press(".dim-prompt input", "Enter")
            time.sleep(0.4)
        return got

    def extrude(self, depth=10):
        self.tab("features")
        self.cmd("Ekstrüzyon")
        time.sleep(0.8)
        wait_ready(self.pg)
        f = "#pm-body .pm-field:has-text('Derinlik') input"
        if self.pg.locator(f).count():
            self.pg.fill(f, str(depth))
            self.pg.dispatch_event(f, "input")
            time.sleep(0.6)
        wait_ready(self.pg)
        self.ok_pm()
        time.sleep(0.5)
        wait_ready(self.pg)

    def undo(self):
        if self.mobile: self.press("#undo")
        else: self.key("Control+z")
        time.sleep(0.2)

    def redo(self):
        if self.mobile: self.press("#redo")
        else: self.key("Control+y")
        time.sleep(0.2)

    def edit_sketch_of(self, feat_name):
        self.tree_click(feat_name)
        self.tree_action("Eskizi düzenle")
        time.sleep(0.8)
        if self.mobile and self.mode() == "sketch": self.close_sheet()
        return self.mode() == "sketch"

    def end(self):
        print("Konsol / sayfa hataları:", self.errs[:10])
        self.chk("konsol / sayfa hatası yok", not [e for e in self.errs if "favicon" not in e], self.errs[:3])
        print("BAŞARISIZLAR:", self.fails)
        print("SONUC:", "TAMAM" if self.ok else "HATA")
        self.b.close()


def dim_label_idx(t, value):
    """görünen ölçü etiketlerinden değeri value olanın sırası"""
    txt = t.pg.eval_on_selector_all(".dim", "els=>els.map(e=>e.textContent)")
    for i, s in enumerate(txt):
        num = "".join(ch for ch in s.replace(",", ".") if ch.isdigit() or ch == ".")
        try:
            if abs(float(num) - value) < 1e-6: return i
        except ValueError:
            pass
    print("  etiketler:", txt)
    return None


def life(t, tag, exp1, old, new, exp2, depth=10, tol=1.0, sketch_tree="Ekstrüzyon"):
    """✓ → ekstrüzyon → hacim; Eskizi düzenle → ölçü çift tık (old→new) → ✓ → hacim; Ctrl+Z/Y; yenile; ✕ vazgeç"""
    t.ok_pm()
    t.chk(f"{tag}: ✓ eskizden çıkar", t.mode() == "part", t.mode())
    t.extrude(depth)
    v = t.vol()
    t.chk(f"{tag}: ekstrüzyon hacmi {exp1}", v is not None and abs(v - exp1) < tol, (v, t.tree_errs()))
    if not t.edit_sketch_of(sketch_tree):
        t.chk(f"{tag}: Eskizi düzenle açılır", False); return
    i = dim_label_idx(t, old)
    if i is None:
        t.chk(f"{tag}: düzenlenecek ölçü ({old}) bulundu", False); t.ok_pm(); return
    t.dim_dbl(i, new)
    t.ok_pm(); time.sleep(0.3)
    v2 = t.vol()
    if exp2 is None:
        exp2 = v2
        t.chk(f"{tag}: eskiz ölçüsü {old}→{new} sonrası hacim değişti", v2 is not None and abs(v2 - exp1) > tol and not t.tree_errs(), (v2, t.tree_errs()))
    else:
        t.chk(f"{tag}: eskiz ölçüsü {old}→{new} sonrası hacim {exp2}", v2 is not None and abs(v2 - exp2) < tol, (v2, t.tree_errs()))
    t.undo(); t.wait(); time.sleep(0.6)
    v3 = t.vol()
    t.chk(f"{tag}: Ctrl+Z → {exp1}", v3 is not None and abs(v3 - exp1) < tol, v3)
    t.redo(); t.wait(); time.sleep(0.6)
    v4 = t.vol()
    t.chk(f"{tag}: Ctrl+Y → {exp2}", v4 is not None and abs(v4 - exp2) < tol, v4)
    t.reload()
    v5 = t.vol()
    t.chk(f"{tag}: sayfa yenilenince {exp2}", v5 is not None and abs(v5 - exp2) < tol, v5)
    # vazgeç: ölçüyü değiştir → ✕ → Kaydetmeden çık
    t.edit_sketch_of(sketch_tree)
    i = dim_label_idx(t, new)
    if i is not None:
        t.dim_dbl(i, new + 7)
        t.cancel_pm(); t.exit_dialog("discard"); time.sleep(0.5); t.wait()
        v6 = t.vol()
        t.chk(f"{tag}: ✕ Kaydetmeden çık → değişmez", v6 is not None and abs(v6 - exp2) < tol and t.mode() == "part", (v6, t.mode()))
    else:
        t.ok_pm()
    return v5

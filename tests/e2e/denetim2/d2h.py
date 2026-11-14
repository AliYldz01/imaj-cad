# Denetim 2 / ajan d2 — ortak yardımcılar (eskiz düzenleme araçları)
# Kural: kullanıcı adımları gerçek fare / klavye / CDP dokunmayla; __app yalnız okuma + "hazır model" kurulumu.
import sys, time, json
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e')
import cmdpatch  # noqa
from h import sketch, ext, wait_ready, TOP, FRONT, RIGHT  # noqa
from playwright.sync_api import sync_playwright  # noqa

URL = 'http://localhost:4173/'
RES = {"ok": True, "n": 0, "fail": []}


def chk(name, cond, info=""):
    RES["n"] += 1
    if not cond:
        RES["ok"] = False
        RES["fail"].append(name)
    print(("TAMAM " if cond else "HATA  ") + name, info, flush=True)
    return bool(cond)


def finish():
    print("BASARISIZ:", RES["fail"])
    print("SONUC:", "TAMAM" if RES["ok"] else "HATA")


class App:
    def __init__(self, p, mobile=False):
        self.b = p.chromium.launch(executable_path="/usr/bin/google-chrome",
                                   args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        self.mobile = mobile
        if mobile:
            self.ctx = self.b.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True, device_scale_factor=2)
        else:
            self.ctx = self.b.new_context(viewport={"width": 1400, "height": 900})
        self.pg = self.ctx.new_page()
        self.errs = []
        self.pg.on("pageerror", lambda e: self.errs.append("pageerror: " + str(e)))
        self.pg.on("console", lambda m: m.type == "error" and self.errs.append("console: " + m.text))
        self.pg.goto(URL)
        wait_ready(self.pg)
        time.sleep(0.5)
        self.cdp = self.ctx.new_cdp_session(self.pg) if mobile else None

    # ---------- okuma ----------
    def ev(self, js, arg=None):
        return self.pg.evaluate(js, arg) if arg is not None else self.pg.evaluate(js)

    def ed(self, js):
        return self.pg.evaluate("(()=>{const e=window.__app.mode.editor; const d=e&&e.data; " + js + "})()")

    def mode(self):
        return self.ev("window.__app.mode.k")

    def vol(self):
        self.wait()
        v = self.ev("window.__app.kernel.props().then(p=>p?p.volume:null)")
        return None if v is None else round(v, 2)

    def bbox(self):
        self.wait()
        b = self.ev("(()=>{const m=window.__app.viewer.mesh; return m?[m.bbox.min,m.bbox.max]:null})()")
        return None if not b else [[round(v, 2) for v in b[0]], [round(v, 2) for v in b[1]]]

    def size(self):
        b = self.bbox()
        return None if not b else [round(b[1][i] - b[0][i], 2) for i in range(3)]

    def errtree(self):
        return self.pg.eval_on_selector_all("#tree li.err", "els=>els.map(e=>e.textContent.trim())")

    def feat(self, fid):
        return self.ev("id=>JSON.parse(JSON.stringify(window.__app.doc.features.find(f=>f.id===id)||null))", fid)

    def saved_feat(self, fid):
        d = json.loads(self.ev("localStorage.getItem('imajcad.doc.v2')") or "{}")
        for f in d.get("features", []):
            if f["id"] == fid:
                return f
        return None

    def skinfo(self):
        """açık eskizin özeti"""
        return self.ed("const r=e.result; return {ents:d.ents.length, types:d.ents.map(x=>x.t+(x.cons?'*':'')), rels:d.rels.map(x=>x.t), dims:d.dims.map(x=>x.t+':'+(+x.v).toFixed(3)), pts:Object.keys(d.pts).length, dof:r&&r.dof, ok:r&&r.ok, conf:r?r.conflicts.length:0}")

    def wait(self, t=0.3):
        time.sleep(t)
        wait_ready(self.pg)

    # ---------- hazır model ----------
    def setup(self, feats, extra=None):
        doc = {"version": 2, "name": "T", "features": feats, "seq": {}}
        if extra:
            doc.update(extra)
        self.ev("d=>window.__app.setDoc(d)", doc)
        self.wait(0.6)

    # ---------- koordinat ----------
    def sc(self, x, y):
        """açık eskizde yerel (x,y) → ekran"""
        return self.ev("""([x,y])=>{const e=window.__app.mode.editor,f=e.frame;const yv=[f.n[1]*f.x[2]-f.n[2]*f.x[1],f.n[2]*f.x[0]-f.n[0]*f.x[2],f.n[0]*f.x[1]-f.n[1]*f.x[0]];
        const w=[0,1,2].map(i=>f.o[i]+f.x[i]*x+yv[i]*y);const s=window.__app.viewer.toScreen(w);const r=document.querySelector('#view canvas').getBoundingClientRect();return [r.left+s[0],r.top+s[1]]}""", [x, y])

    def wsc(self, w):
        return self.ev("""(w)=>{const s=window.__app.viewer.toScreen(w);const r=document.querySelector('#view canvas').getBoundingClientRect();return [r.left+s[0],r.top+s[1]]}""", w)

    def ptxy(self, pid):
        return self.ed(f"const p=d.pts['{pid}']; return p?[+p.x.toFixed(4),+p.y.toFixed(4)]:null")

    def lineyx(self, lid):
        """çizginin uç noktaları [(x,y),(x,y)]"""
        return self.ed(f"const l=d.ents.find(x=>x.id==='{lid}'); if(!l) return null; const q=k=>{{const p=k==='O'?{{x:0,y:0}}:d.pts[k]; return [+p.x.toFixed(4),+p.y.toFixed(4)]}}; return [q(l.p1),q(l.p2)]")

    # ---------- giriş ----------
    def click(self, x, y, mods=()):
        if self.mobile:
            return self.tap(x, y)
        for m in mods:
            self.pg.keyboard.down(m)
        self.pg.mouse.move(x, y, steps=3)
        time.sleep(0.05)
        self.pg.mouse.down()
        self.pg.mouse.up()
        for m in mods:
            self.pg.keyboard.up(m)
        time.sleep(0.25)

    def clk(self, x, y, mods=()):
        a = self.sc(x, y)
        self.click(a[0], a[1], mods)

    def drag(self, a, b, steps=15):
        if self.mobile:
            return self.tdrag(a, b, steps)
        self.pg.mouse.move(a[0], a[1], steps=2)
        self.pg.mouse.down()
        for i in range(1, steps + 1):
            self.pg.mouse.move(a[0] + (b[0] - a[0]) * i / steps, a[1] + (b[1] - a[1]) * i / steps)
            time.sleep(0.02)
        self.pg.mouse.up()
        time.sleep(0.3)

    def touch(self, kind, pts):
        self.cdp.send("Input.dispatchTouchEvent", {"type": kind, "touchPoints": [{"x": x, "y": y, "id": i} for i, (x, y) in enumerate(pts)]})

    def tap(self, x, y):
        self.touch("touchStart", [(x, y)])
        time.sleep(0.06)
        self.touch("touchEnd", [])
        time.sleep(0.35)

    def tdrag(self, a, b, steps=15):
        self.touch("touchStart", [a])
        for i in range(1, steps + 1):
            self.touch("touchMove", [(a[0] + (b[0] - a[0]) * i / steps, a[1] + (b[1] - a[1]) * i / steps)])
            time.sleep(0.03)
        self.touch("touchEnd", [])
        time.sleep(0.35)

    def press(self, k):
        self.pg.keyboard.press(k)
        time.sleep(0.3)

    def btn(self, sel):
        if self.mobile:
            self.pg.locator(sel).first.tap()
        else:
            self.pg.locator(sel).first.click()
        time.sleep(0.3)

    def cmd(self, title):
        """şerit komutu (gerçek tıklama)"""
        sel = f"#cmds button[title='{title}']"
        self.pg.evaluate("t=>window.__app.showCmd&&window.__app.showCmd(t)", title)
        loc = self.pg.locator(sel).first
        if self.mobile:
            loc.scroll_into_view_if_needed()
            loc.tap()
        else:
            loc.click()
        time.sleep(0.35)

    def pmfield(self, label, val):
        loc = self.pg.locator(f"#pm-body label.pm-field:has-text('{label}') input").first
        loc.fill(str(val))
        loc.press("Tab")
        time.sleep(0.2)

    def pmcheck(self, label, on=True):
        loc = self.pg.locator(f"#pm-body label.pm-check:has-text('{label}') input").first
        if loc.is_checked() != on:
            loc.click() if not self.mobile else loc.tap()
        time.sleep(0.2)

    def pmbtn(self, text):
        self.btn(f"#pm-body button:has-text('{text}')")

    def ok(self):
        self.btn("#pm-ok")
        self.wait(0.6)

    def cancel(self, choice="discard"):
        """✕ → çıkış penceresi: discard (Kaydetmeden çık) / save / cancel"""
        self.btn("#pm-cancel")
        time.sleep(0.4)
        dl = self.pg.locator("dialog.exit-dialog[open]")
        if dl.count():
            self.btn(f"dialog.exit-dialog button[data-v='{choice}']")
        self.wait(0.6)

    # ---------- ağaç ----------
    def show_tree(self):
        if self.mobile:
            self.ev("document.querySelector('#side').classList.add('open')")
            time.sleep(0.2)

    def tree_act(self, name, act):
        self.show_tree()
        self.btn(f"#tree li:has-text('{name}')")
        time.sleep(0.2)
        self.btn(f"#tree-actions button:has-text('{act}')")
        time.sleep(0.8)

    def edit_sketch_of(self, feat_name):
        """ağaçtan özelliği seç → 'Eskizi düzenle'"""
        self.tree_act(feat_name, "Eskizi düzenle")
        self.wait(0.4)

    def reload(self):
        self.pg.reload()
        wait_ready(self.pg)
        time.sleep(1.0)
        self.wait(0.5)

    def toast(self):
        return self.ev("[...document.querySelectorAll('.toast')].map(t=>t.textContent).join(' | ')")

    def dim_dbl(self, i, val):
        """i. ölçü etiketine çift tıkla → değer yaz → Enter (gerçek)"""
        loc = self.pg.locator(".dim").nth(i)
        if self.mobile:
            bb = loc.bounding_box()
            x, y = bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2
            self.touch("touchStart", [(x, y)]); self.touch("touchEnd", [])
            time.sleep(0.08)
            self.touch("touchStart", [(x, y)]); self.touch("touchEnd", [])
            time.sleep(0.4)
        else:
            loc.dblclick()
            time.sleep(0.3)
        self.pg.fill(".dim-prompt input", str(val))
        self.pg.press(".dim-prompt input", "Enter")
        time.sleep(0.4)

    def close(self):
        self.b.close()


# ---------- hazır modeller ----------
def rect_dims(sk, w, h, x0=None, y0=None):
    """dikdörtgene yatay/dikey + genişlik/yükseklik ölçüsü (p1..p4 köşeler, l5..l8 kenarlar)"""
    d = sk["data"]
    d["rels"] += [{"id": "r1", "t": "horizontal", "refs": ["l5"]}, {"id": "r2", "t": "vertical", "refs": ["l6"]},
                  {"id": "r3", "t": "horizontal", "refs": ["l7"]}, {"id": "r4", "t": "vertical", "refs": ["l8"]}]
    d["dims"] += [{"id": "D1", "t": "dist", "refs": ["p1", "p2"], "v": w, "sub": "h", "lp": [0, -h / 2 - 15]},
                  {"id": "D2", "t": "dist", "refs": ["p2", "p3"], "v": h, "sub": "v", "lp": [w / 2 + 15, 0]}]
    return sk


def plate(w=80, h=60, depth=10, dims=True, plane=None):
    sk = sketch("s1", "Eskiz1", plane or TOP, lambda pt, line, rect, c, t: rect(-w / 2, -h / 2, w / 2, h / 2))
    if dims:
        rect_dims(sk, w, h)
    return [sk, ext("e1", "s1", depth)]

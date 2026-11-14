# Denetim 2 / d3 ortak yardımcılar (ilişkiler, ölçüler, yakalama, seçim, 3B eskiz)
# Kural: kullanıcı adımı yalnız gerçek fare / klavye / dokunma; __app yalnız OKUMAK (ve "hazır model" kurmak) için.
import sys, time, json
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e')
import cmdpatch  # noqa: F401
from h import wait_ready, sketch, ext, FRONT, TOP, RIGHT
from playwright.sync_api import sync_playwright

URL = 'http://localhost:4173/'
ED = "window.__app.mode.editor"


class T:
    def __init__(self, p, mobile=False, w=1400, h=900):
        self.b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        if mobile:
            self.ctx = self.b.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True, device_scale_factor=2)
        else:
            self.ctx = self.b.new_context(viewport={"width": w, "height": h})
        self.pg = self.ctx.new_page()
        self.mobile = mobile
        self.errs = []
        self.pg.on("pageerror", lambda e: self.errs.append("pageerror: " + str(e)))
        self.pg.on("console", lambda m: m.type == "error" and self.errs.append("console: " + m.text))
        self.pg.on("dialog", lambda d: d.accept())
        self.pg.goto(URL); wait_ready(self.pg); time.sleep(0.6)
        self.cdp = self.ctx.new_cdp_session(self.pg) if mobile else None
        self.ok = True
        self.results = []

    # ---------- genel
    def ev(self, js, arg=None):
        return self.pg.evaluate(js, arg) if arg is not None else self.pg.evaluate(js)

    def chk(self, name, c, info=""):
        self.ok = self.ok and bool(c)
        self.results.append((name, bool(c), info))
        print(("TAMAM " if c else "HATA  ") + name, info, flush=True)
        return bool(c)

    def note(self, *a):
        print("  ·", *a, flush=True)

    def close(self):
        e = [x for x in self.errs if "favicon" not in x]
        self.chk("konsol hatası yok", not e, e[:5])
        print("SONUC:", "TAMAM" if self.ok else "HATA", flush=True)
        self.b.close()

    def wait(self, t=0.4):
        time.sleep(t)
        try:
            wait_ready(self.pg, 180000)
        except Exception as ex:
            print("  (wait_ready zaman aşımı)", ex)

    # ---------- hazır model (yalnız başlangıç durumu)
    def setup(self, feats, extra=None):
        doc = {"version": 2, "name": "T", "features": feats, "seq": {}}
        if extra: doc.update(extra)
        self.ev("d=>window.__app.setDoc(d)", doc); self.wait(0.6)

    # ---------- komut
    def tab(self, t):
        sel = f"#tabs button[data-tab='{t}']"
        if self.mobile: self.pg.locator(sel).tap()
        else: self.pg.click(sel)
        time.sleep(0.25)

    def cmd(self, title):
        sel = f"#cmds button[title='{title}']"
        if self.mobile:
            self.pg.evaluate("t=>window.__app.showCmd&&window.__app.showCmd(t)", title)
            self.pg.locator(sel).first.scroll_into_view_if_needed()
            self.pg.locator(sel).first.tap()
        else:
            self.pg.click(sel)
        time.sleep(0.3)

    def tree_click(self, text):
        loc = self.pg.locator(f"#tree li:has-text('{text}')").first
        if self.mobile:
            self.ev("document.querySelector('#side').classList.add('open')")
            loc.tap()
        else: loc.click()
        time.sleep(0.25)

    def tree_act(self, text):
        loc = self.pg.locator(f"#tree-actions button:has-text('{text}')").first
        if self.mobile: loc.tap()
        else: loc.click()
        time.sleep(0.6)

    def new_sketch(self, plane="Ön Düzlem"):
        self.tree_click(plane); self.tree_act("Eskiz")
        self.wait(0.5)
        # "Çizdikten sonra ölçü gir" kapat (PM onay kutusu, gerçek tık)
        self.quickdim(False)

    def quickdim(self, on):
        lab = self.pg.locator("#pm-body label.pm-check:has-text('Çizdikten sonra ölçü gir') input")
        if lab.count() and lab.is_checked() != on:
            if self.mobile: lab.tap()
            else: lab.click()
            time.sleep(0.15)

    def edit_sketch(self, feat_text):
        self.tree_click(feat_text)
        if not self.pg.locator("#tree-actions button:has-text('Eskizi düzenle')").count():
            self.tree_click(feat_text)
        self.tree_act("Eskizi düzenle"); self.wait(0.8)

    def pm_ok(self):
        sel = "#pm-ok"
        if self.mobile: self.pg.locator(sel).tap()
        else: self.pg.click(sel)
        self.wait(0.8)

    def pm_cancel(self, choice=None):
        sel = "#pm-cancel"
        if self.mobile: self.pg.locator(sel).tap()
        else: self.pg.click(sel)
        time.sleep(0.5)
        if choice and self.pg.locator(f"dialog.exit-dialog button[data-v='{choice}']").count():
            self.pg.click(f"dialog.exit-dialog button[data-v='{choice}']")
        self.wait(0.8)

    # ---------- eskiz koordinatı → ekran
    def sc(self, x, y):
        return self.ev("""([x,y])=>{const e=window.__app.mode.editor,f=e.frame;const yv=[f.n[1]*f.x[2]-f.n[2]*f.x[1],f.n[2]*f.x[0]-f.n[0]*f.x[2],f.n[0]*f.x[1]-f.n[1]*f.x[0]];
        const w=[0,1,2].map(i=>f.o[i]+f.x[i]*x+yv[i]*y);const s=window.__app.viewer.toScreen(w);const r=document.querySelector('#view canvas').getBoundingClientRect();return [r.left+s[0],r.top+s[1]]}""", [x, y])

    def scp(self, pid):
        p = self.ev(f"{ED}.data.pts['{pid}']")
        return self.sc(p["x"], p["y"])

    def zoom(self, z):
        self.ev(f"(()=>{{const v=window.__app.viewer; v.camera.zoom={z}; v.camera.updateProjectionMatrix(); v.requestRender&&v.requestRender();}})()")

    # ---------- giriş
    def click(self, x, y, mod=None):
        if self.mobile:
            return self.tap(x, y)
        self.pg.mouse.move(x - 3, y - 2); self.pg.mouse.move(x, y)
        if mod: self.pg.keyboard.down(mod)
        self.pg.mouse.click(x, y)
        if mod: self.pg.keyboard.up(mod)
        time.sleep(0.15)

    def kclick(self, sx, sy, mod=None):
        x, y = self.sc(sx, sy); self.click(x, y, mod)

    def dbl(self, x, y):
        self.pg.mouse.move(x, y); self.pg.mouse.dblclick(x, y); time.sleep(0.3)

    def drag(self, x0, y0, x1, y1, steps=12):
        if self.mobile:
            self.touch("touchStart", [(x0, y0)])
            for i in range(1, steps + 1):
                self.touch("touchMove", [(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps)]); time.sleep(0.02)
            self.touch("touchEnd", []); time.sleep(0.3); return
        self.pg.mouse.move(x0, y0); self.pg.mouse.down()
        for i in range(1, steps + 1):
            self.pg.mouse.move(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps); time.sleep(0.02)
        self.pg.mouse.up(); time.sleep(0.3)

    def touch(self, kind, pts):
        self.cdp.send("Input.dispatchTouchEvent", {"type": kind, "touchPoints": [{"x": x, "y": y, "id": i} for i, (x, y) in enumerate(pts)]})

    def tap(self, x, y):
        self.touch("touchStart", [(x, y)]); time.sleep(0.05); self.touch("touchEnd", []); time.sleep(0.35)

    def key(self, k):
        self.pg.keyboard.press(k); time.sleep(0.3)

    # ---------- okuma
    def sk(self):
        return self.ev(f"JSON.parse(JSON.stringify({ED}.data))")

    def res(self):
        return self.ev(f"(()=>{{const r={ED}.result;return {{ok:r.ok,dof:r.dof,conf:r.conflicts,red:r.redundant}}}})()")

    def status(self):
        return self.ev("document.querySelector('#status-text').textContent")

    def rels(self):
        return sorted(r["t"] for r in self.sk()["rels"])

    def bbox(self):
        m = self.ev("(()=>{const m=window.__app.viewer.mesh;return m&&{min:m.bbox.min,max:m.bbox.max}})()")
        return m and [[round(v, 3) for v in m["min"]], [round(v, 3) for v in m["max"]]]

    def saved(self):
        return json.loads(self.ev("localStorage.getItem('imajcad.doc.v2')") or "null")

    def saved_feat(self, fid):
        d = self.saved()
        return d and next((f for f in d["features"] if f["id"] == fid), None)

    def doc(self):
        return self.ev("JSON.parse(JSON.stringify(window.__app.doc))")

    def reload(self):
        self.pg.reload(); wait_ready(self.pg, 180000); time.sleep(1.0)

    def panel_btns(self):
        return self.pg.locator("#pm-body button.rel-btn").all_inner_texts()

    def press_rel(self, label):
        import re as _re
        loc = self.pg.locator("#pm-body button.rel-btn").filter(has_text=_re.compile(r"^\S+ " + _re.escape(label) + r"$")).first
        if not loc.count():
            return False
        if self.mobile: loc.tap()
        else: loc.click()
        time.sleep(0.4); return True

    def dim_labels(self):
        return self.pg.locator("#view .dim").all_inner_texts() if self.pg.locator("#view .dim").count() else self.pg.locator(".dim").all_inner_texts()

    def prompt_val(self, v, enter=True):
        self.pg.fill(".dim-prompt input", str(v))
        if enter: self.pg.press(".dim-prompt input", "Enter")
        time.sleep(0.4)

    def draw_rect(self, x0, y0, x1, y1):
        self.cmd("Dikdörtgen")
        self.kclick(x0, y0); self.kclick(x1, y1)
        time.sleep(0.2)

    def draw_lines(self, pts):
        self.cmd("Çizgi")
        for q in pts: self.kclick(*q)
        self.key("Escape")

# Denetim 2 / ajan d4 — ortak yardımcılar (temel özellikler: ekstrüzyon, kesme, döndürme, süpürme, loft)
# d2h.py'den türetildi + PM seçim / segment / ağaç / geri al yardımcıları
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
    def __init__(self, p, mobile=False, nosfp=False):
        self.b = p.chromium.launch(executable_path="/usr/bin/google-chrome",
                                   args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        self.mobile = mobile
        if mobile:
            self.ctx = self.b.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True, device_scale_factor=2, accept_downloads=True)
        else:
            self.ctx = self.b.new_context(viewport={"width": 1400, "height": 900}, accept_downloads=True)
        self.pg = self.ctx.new_page()
        if nosfp:
            self.pg.add_init_script("delete window.showSaveFilePicker; delete window.showOpenFilePicker;")
        self.errs = []
        self.pg.on("pageerror", lambda e: self.errs.append("pageerror: " + str(e)))
        self.pg.on("console", lambda m: m.type == "error" and self.errs.append("console: " + m.text))
        self.dq = []
        self.dlog = []
        def _dlg(d):
            v = self.dq.pop(0) if self.dq else True
            self.dlog.append(d.message)
            try:
                if d.type == "prompt":
                    d.accept(v if isinstance(v, str) else d.default_value) if v is not False else d.dismiss()
                else:
                    d.accept() if v else d.dismiss()
            except Exception:
                pass
        self.pg.on("dialog", _dlg)
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
        dl = self.pg.locator("dialog.exit-dialog[open]")
        for _ in range(8):
            time.sleep(0.25)
            if dl.count():
                break
            if self.mode() not in ("pm", "sketch"):
                break
        if dl.count():
            self.btn(f"dialog.exit-dialog[open] button[data-v='{choice}']")
        self.wait(0.6)

    # ---------- ağaç ----------
    def show_tree(self):
        if self.mobile:
            if not self.ev("document.querySelector('#side').classList.contains('open')"):
                self.pg.locator("#tree-btn").tap()
                time.sleep(0.4)

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
        return self.ev("(()=>{const t=document.querySelector('#toast');return t&&!t.hidden?t.textContent:''})()")

    def dim_dbl(self, i, val):
        """i. ölçü etiketine çift tıkla → değer yaz → Enter (gerçek)"""
        loc = self.pg.locator(".dim").nth(i)
        # etiket tuval dışında / şerit altında kalırsa kullanıcı gibi tekerlekle uzaklaş
        for k in range(8):
            ok = self.ev("""i=>{const d=document.querySelectorAll('.dim')[i];if(!d)return true;const r=d.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
              const e=document.elementFromPoint(x,y);return !!e&&(e===d||d.contains(e))}""", i)
            if ok:
                break
            if self.mobile:
                # telefonda etiket alt panelin arkasında kalırsa kullanıcı paneli küçültür (▾)
                self.covered_dims = getattr(self, "covered_dims", 0) + 1
                if self.pg.locator("#pm .sheet-min").count() and not self.ev("document.querySelector('#side').classList.contains('min')"):
                    self.pg.locator("#pm .sheet-min").tap(); time.sleep(0.5)
                    continue
                break
            cr = self.ev("(()=>{const r=document.querySelector('#view canvas').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()")
            self.pg.mouse.move(cr[0], cr[1]); self.pg.mouse.wheel(0, 240 if k < 3 else -240); time.sleep(0.4)
        if self.mobile:
            bb = loc.bounding_box()
            x, y = bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2
            self.touch("touchStart", [(x, y)]); self.touch("touchEnd", [])
            time.sleep(0.5)
        else:
            loc.dblclick()
            time.sleep(0.3)
        self.pg.fill(".dim-prompt input", str(val))
        self.pg.press(".dim-prompt input", "Enter")
        time.sleep(0.4)

    def close(self):
        self.b.close()

    # ---------- d4 ekleri ----------
    def pmselect(self, label, value):
        loc = self.pg.locator(f"#pm-body label.pm-field:has-text('{label}') select").first
        loc.select_option(value)
        time.sleep(0.3)

    def pmselval(self, label):
        loc = self.pg.locator(f"#pm-body label.pm-field:has-text('{label}') select").first
        return loc.input_value() if loc.count() else None

    def pmseg(self, text):
        self.btn(f"#pm-body .seg button:text-is('{text}')")

    def pmhas(self, label):
        return self.pg.locator(f"#pm-body label:has-text('{label}')").count() > 0

    def pmtext(self):
        return self.pg.inner_text("#pm-body") if self.pg.locator("#pm-body").count() else ""

    def tsel(self, name):
        """ağaçta öğeyi seç (gerçek tık)"""
        self.show_tree()
        i = self.ev("n=>[...document.querySelectorAll('#tree li')].findIndex(l=>{const s=l.querySelector(':scope > span');return s&&s.textContent.trim()===n})", name)
        if i < 0:
            raise Exception("ağaçta yok: " + name)
        loc = self.pg.locator("#tree li").nth(i)
        cls = loc.get_attribute("class") or ""
        if "sel" not in cls.split():
            loc.tap() if self.mobile else loc.click()
            time.sleep(0.3)
        time.sleep(0.2)

    def tact(self, name, act, confirm=None):
        """ağaçtan öğe seç → eylem düğmesi (tam metin). confirm: [True/False,...] sırayla confirm yanıtları"""
        if confirm is not None:
            self.dq[:] = list(confirm)
        self.tsel(name)
        self.btn(f"#tree-actions button:text-is('{act}')")
        time.sleep(0.6)
        self.wait(0.4)

    def edit_feat(self, name):
        self.tact(name, "Düzenle")
        self.wait(0.4)

    def blur(self):
        self.ev("document.activeElement && document.activeElement.blur && document.activeElement.blur()")

    def undo(self):
        if self.mobile:
            self.pg.locator("#undo").tap(); self.wait(0.8); return
        self.blur(); self.pg.keyboard.press("Control+z"); self.wait(0.8)

    def redo(self):
        if self.mobile:
            self.pg.locator("#redo").tap(); self.wait(0.8); return
        self.blur(); self.pg.keyboard.press("Control+y"); self.wait(0.8)

    def longpress(self, x, y, ms=800):
        self.touch("touchStart", [(x, y)])
        time.sleep(ms / 1000)
        self.touch("touchEnd", [])
        time.sleep(0.5)

    def names(self):
        return self.ev("window.__app.doc.features.map(f=>f.name)")

    def status(self):
        return self.pg.inner_text("#status-text")

    def busy(self):
        return self.ev("document.querySelector('#status').classList.contains('busy')")

    def saved_vol_after_reload(self):
        self.reload()
        return self.vol()

    def stored(self):
        return json.loads(self.ev("localStorage.getItem('imajcad.doc.v2')") or "{}")

    def featbyname(self, name):
        return self.ev("n=>JSON.parse(JSON.stringify(window.__app.doc.features.find(f=>f.name===n)||null))", name)

    def errs_map(self):
        return self.ev("(()=>{const o={};document.querySelectorAll('#tree li.err').forEach(e=>o[e.textContent.trim()]=e.title||'');return o})()")

    def faces(self):
        return self.ev("(()=>{const m=window.__app.viewer.mesh;return m?m.faces.length:0})()")

    def bodies(self):
        return self.ev("(()=>{const m=window.__app.viewer.mesh;return m?m.bodies:0})()")

    def face_click(self, pred_js):
        """pred_js: (f)=>bool f={c,n,...}; uygun ilk yüzün merkezine gerçek tık"""
        c = self.ev("p=>{const m=window.__app.viewer.mesh;const fn=eval(p);const i=m.faces.findIndex(fn);return i<0?null:m.faces[i].c}", pred_js)
        if c is None:
            return False
        s = self.wsc(c)
        self.click(s[0], s[1])
        return True

    def wclick(self, w):
        s = self.wsc(w)
        self.click(s[0], s[1])


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


# ---------- d4: hazır eskiz kurucuları ----------
import math  # noqa
PI = math.pi


def near(a, b, tol=0.5):
    return a is not None and b is not None and abs(a - b) <= tol


def rect_sk(sid, name, plane, x0, y0, x1, y1, dims=True):
    sk = sketch(sid, name, plane, lambda pt, line, rect, c, t: rect(x0, y0, x1, y1))
    if dims:
        rect_dims(sk, x1 - x0, y1 - y0)
    return sk


def circ_sk(sid, name, plane, x, y, r, dim=True):
    sk = sketch(sid, name, plane, lambda pt, line, rect, c, t: c(x, y, r))
    if dim:
        cid = sk["data"]["ents"][0]["id"]
        sk["data"]["dims"].append({"id": "D1", "t": "dia", "refs": [cid], "v": 2 * r, "lp": [x + r + 5, y + r + 5]})
    return sk


def face_plane(o, n, x):
    """düz yüz üzerindeki eskiz düzlemi (hazır model)"""
    return {"k": "face", "frame": {"o": o, "x": x, "n": n}, "label": "Yüz", "face": {"c": o, "n": n}}


def refplane(pid, name, base, off):
    return {"id": pid, "type": "plane", "name": name, "base": base, "offset": off, "flip": False}


def block(w=80, h=60, d=20, sid="s1", eid="e1", sname="Eskiz1", ename="Ekstrüzyon1", plane=None):
    sk = rect_sk(sid, sname, plane or TOP, -w / 2, -h / 2, w / 2, h / 2)
    e = ext(eid, sid, d)
    e["name"] = ename
    return [sk, e]


TOPFACE20 = None  # yardımcı: 80×60×20 bloğun üst yüzü (y=20)


def top_face(y=20):
    return face_plane([0, y, 0], [0, 1, 0], [1, 0, 0])


def edge_near_vertex(a, v, frac=0.12):
    """v köşesinden çıkan bir kenar üzerinde köşeye yakın nokta (dünya)"""
    return a.ev("""([v,fr])=>{const m=window.__app.viewer.mesh;const d=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2]);
      for(const e of m.edges){ if(!e.s||!e.e) continue; let o=null;
        if(d(e.s,v)<0.01) o=e.e; else if(d(e.e,v)<0.01) o=e.s; if(!o) continue;
        return [0,1,2].map(i=>v[i]+(o[i]-v[i])*fr);} return null}""", [v, frac])


def ctx_case(a):
    pass

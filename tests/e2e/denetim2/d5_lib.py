# Denetim 2 / ajan d5 (DETAY ÖZELLİKLERİ) — ortak yardımcılar
# Kural: kullanıcı adımları gerçek fare / klavye / CDP dokunmayla; __app yalnız okuma + "hazır model" kurulumu.
import sys, time, json, math
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e')
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d2h import App as _App, chk, finish, RES, rect_dims, plate  # noqa
from h import sketch, ext, wait_ready, TOP, FRONT, RIGHT  # noqa
from playwright.sync_api import sync_playwright  # noqa

PI = math.pi


def near(a, b, tol=0.5):
    return a is not None and b is not None and abs(a - b) <= tol


def box(w=40, d=30, hgt=20, plane=None, sid="s1", eid="e1", ename=None):
    """hazır model: w×d dikdörtgen (ölçülü), hgt yükseklik. Üst düzlemde → y ekseni yukarı."""
    sk = sketch(sid, "Eskiz1", plane or TOP, lambda pt, line, rect, c, t: rect(-w / 2, -d / 2, w / 2, d / 2))
    rect_dims(sk, w, d)
    e = ext(eid, sid, hgt)
    if ename:
        e["name"] = ename
    else:
        e["name"] = "Ekstrüzyon1"
    return [sk, e]


class App(_App):
    def __init__(self, p, mobile=False):
        super().__init__(p, mobile)
        self.pg.set_default_timeout(60000)

    # ---------- bekleme / okuma ----------
    def wait(self, t=0.3):
        time.sleep(t)
        wait_ready(self.pg, 240000)

    def vol(self):
        self.wait()
        v = self.ev("window.__app.kernel.props().then(p=>p?p.volume:null)")
        return None if v is None else round(v, 2)

    def nfaces(self):
        return self.ev("(()=>{const m=window.__app.viewer.mesh;return m?m.faces.length:0})()")

    def nbodies(self):
        return self.ev("(()=>{const m=window.__app.viewer.mesh;return m?(m.bodies||1):0})()")

    def facetypes(self):
        return self.ev("(()=>{const m=window.__app.viewer.mesh;const o={};if(m)m.faces.forEach(f=>o[f.type]=(o[f.type]||0)+1);return o})()")

    def feats(self):
        return self.ev("window.__app.doc.features.map(f=>f.name+(f.off?'(off)':''))")

    def featids(self):
        return self.ev("window.__app.doc.features.map(f=>f.id)")

    def lastfeat(self):
        return self.ev("JSON.parse(JSON.stringify(window.__app.doc.features[window.__app.doc.features.length-1]))")

    def featbyname(self, name):
        return self.ev("n=>JSON.parse(JSON.stringify(window.__app.doc.features.find(f=>f.name===n)||null))", name)

    def status(self):
        return self.pg.inner_text("#status-text")

    def errs_tree(self):
        return self.pg.eval_on_selector_all("#tree li.err", "els=>els.map(e=>e.textContent.trim()+' :: '+(e.title||''))")

    def ghost(self):
        """sarı önizleme var mı + hacmi (önizleme yapısının)"""
        return self.ev("(()=>{const v=window.__app.viewer;return !!(v.ghost&&v.ghost.visible!==false)})()")

    def pm_open(self):
        return self.ev("window.__app.mode.k") == "pm"

    def draft(self):
        return self.ev("(()=>{const m=window.__app.mode;return m.k==='pm'?JSON.parse(JSON.stringify(m.draft)):null})()")

    def saved(self):
        return json.loads(self.ev("localStorage.getItem('imajcad.doc.v2')") or "{}")

    def saved_names(self):
        return [f["name"] + ("(off)" if f.get("off") else "") for f in self.saved().get("features", [])]

    # ---------- görünüm ----------
    def iso(self):
        if self.mobile:
            self.pg.locator(".vcube .iso").first.tap()
        else:
            self.pg.click(".vcube .iso")
        time.sleep(0.3)
        self.fit()

    def fit(self):
        self.press("f") if not self.mobile else self.ev("window.__app.viewer.fit&&window.__app.viewer.fit()")
        time.sleep(0.4)

    def view(self, name):
        """görünüm küpünden yüz (Önden, Üstten...) — vcube yüz sınıfları"""
        self.pg.click(f".vcube .{name}")
        time.sleep(0.3)
        self.fit()

    # ---------- model seçim noktaları ----------
    def edges(self):
        return self.ev("(()=>{const m=window.__app.viewer.mesh;return m?m.edges.map((e,i)=>({i,m:e.m,d:e.d,t:e.type,s:e.s,e:e.e})):[]})()")

    def faces(self):
        return self.ev("(()=>{const m=window.__app.viewer.mesh;return m?m.faces.map((f,i)=>({i,c:f.c,n:f.n,t:f.type,r:f.r,b:f.b})):[]})()")

    def find_edge(self, test):
        """test: python fonksiyonu (edge dict) → ilk eşleşen"""
        for e in self.edges():
            if test(e):
                return e
        return None

    def find_face(self, test):
        for f in self.faces():
            if test(f):
                return f
        return None

    def pick_world(self, w, mods=()):
        a = self.wsc(w)
        self.click(a[0], a[1], mods)
        return a

    def pick_edge(self, test, frac=0.5, mods=()):
        e = self.find_edge(test)
        if not e:
            raise Exception("kenar yok")
        if e["s"] and e["e"] and e["t"] == "LINE":
            w = [e["s"][k] + (e["e"][k] - e["s"][k]) * frac for k in range(3)]
        else:
            w = e["m"]
        self.pick_world(w, mods)
        return e

    def pick_face(self, test, off=None, mods=()):
        f = self.find_face(test)
        if not f:
            raise Exception("yüz yok")
        w = f["c"] if off is None else [f["c"][k] + off[k] for k in range(3)]
        self.pick_world(w, mods)
        return f

    def hit_at(self, w):
        """ekranda w noktasında ne var (okuma)"""
        return self.ev("""(w)=>{const s=window.__app.viewer.toScreen(w);const r=document.querySelector('#view canvas').getBoundingClientRect();const h=window.__app.viewer.pick(r.left+s[0],r.top+s[1],{face:true,edge:true});return h?{k:h.kind,i:h.index}:null}""", w)

    # ---------- komut / PM ----------
    def feature_cmd(self, label):
        """Özellikler sekmesinden şerit komutu"""
        if self.mobile:
            self.ev("document.querySelector('#side')&&document.querySelector('#side').classList.remove('open')")
        self.tab("features")
        self.cmd(label)
        self.wait(0.4)

    def tab(self, k):
        loc = self.pg.locator(f"#tabs button[data-tab='{k}']").first
        if "active" in (loc.get_attribute("class") or ""):
            return
        if self.mobile:
            loc.tap()
        else:
            loc.click()
        time.sleep(0.3)

    def pmsel(self, label, value):
        loc = self.pg.locator(f"#pm-body label.pm-field:has-text('{label}') select").first
        loc.select_option(value)
        time.sleep(0.3)

    def pmseg(self, text):
        loc = self.pg.locator(f"#pm-body .seg button:has-text('{text}'), #pm-body .seg-wrap button:has-text('{text}')").first
        if self.mobile:
            loc.tap()
        else:
            loc.click()
        time.sleep(0.3)

    def pmtext(self):
        return self.pg.inner_text("#pm-body")

    def ok(self, wait=0.8, fast=False):
        if not fast:
            time.sleep(0.7)
            wait_ready(self.pg, 240000)
        self.btn("#pm-ok")
        self.wait(wait)

    def undo(self):
        if self.mobile:
            self.ev("document.querySelector('#side')&&document.querySelector('#side').classList.remove('open')")
        self.pg.keyboard.press("Control+z")
        self.wait(0.6)

    def redo(self):
        self.pg.keyboard.press("Control+y")
        self.wait(0.6)

    def tree_edit(self, name):
        self.tree_act(name, "Düzenle")
        self.wait(0.6)

    def tree_click(self, name):
        self.show_tree()
        self.btn(f"#tree li:has-text('{name}')")
        time.sleep(0.3)

    def tree_actions(self):
        return self.pg.eval_on_selector_all("#tree-actions button", "els=>els.map(e=>e.textContent.trim())")

    def accept_dialogs(self, accept=True):
        self.pg.on("dialog", lambda d: d.accept() if accept else d.dismiss())

    def reselect_dialog(self):
        return self.ev("!!document.querySelector('dialog.reselect-dialog[open]')")

    def dialogs_open(self):
        return self.ev("[...document.querySelectorAll('dialog[open]')].map(d=>d.className+': '+d.textContent.slice(0,120))")

    def close_dialogs(self):
        self.ev("[...document.querySelectorAll('dialog[open]')].forEach(d=>d.close())")

    def edit_sketch_dim(self, featname, i, val, save=True):
        """eskizi düzenle → i. ölçüye çift tık → değer → Enter → ✓ (gerçek)"""
        self.edit_sketch_of(featname)
        self.wait(0.5)
        self.dim_dbl(i, val)
        if save:
            self.btn("#pm-ok")
        self.wait(1.0)

    # ---------- ek ----------
    def tree_act(self, name, act):
        import re as _re
        r = self.reselect("Daha sonra")
        if r:
            print("  [açık 'Eksik referans' penceresi kapatıldı]:", r[:120])
        self.show_tree()
        li = self.pg.locator("#tree li").filter(has_text=name).last
        if self.mobile:
            li.tap()
        else:
            li.click()
        time.sleep(0.35)
        if not self.pg.locator("#tree-actions button").count():
            li.tap() if self.mobile else li.click()
            time.sleep(0.35)
        b = self.pg.locator("#tree-actions button").filter(has_text=_re.compile("^\\s*" + _re.escape(act) + "\\s*$"))
        if not b.count():
            raise Exception(f"ağaç eylemi yok: {act} / {self.tree_actions()}")
        if self.mobile:
            b.first.tap()
        else:
            b.first.click()
        time.sleep(0.8)

    def ghost_vol(self, wait=2.5):
        """sarı önizleme ağının hacmi (üçgen ağından); yoksa None"""
        time.sleep(wait)
        self.wait()
        return self.ev("""(()=>{const g=window.__app.viewer.ghost; if(!g) return null; const m=g.children[0]; const P=m.geometry.attributes.position.array, I=m.geometry.index.array; let v=0;
        for(let i=0;i<I.length;i+=3){const a=I[i]*3,b=I[i+1]*3,c=I[i+2]*3; v+=(P[a]*(P[b+1]*P[c+2]-P[b+2]*P[c+1]) - P[a+1]*(P[b]*P[c+2]-P[b+2]*P[c]) + P[a+2]*(P[b]*P[c+1]-P[b+1]*P[c]))/6}
        return Math.round(Math.abs(v)*100)/100})()""")

    def delete_feat(self, name, absorb=False):
        """ağaç → Sil (confirm: evet; 'eskiz de silinsin mi' → absorb)"""
        answers = [True, absorb]
        def h(d):
            d.accept() if (answers.pop(0) if answers else True) else d.dismiss()
        self.pg.on("dialog", h)
        self.tree_act(name, "Sil")
        self.wait(0.8)
        self.pg.remove_listener("dialog", h)

    def suppress(self, name):
        self.tree_act(name, "Bastır")
        self.wait(0.8)
        r = self.reselect("Daha sonra")
        if r:
            print("  [bastır sonrası 'Eksik referans' penceresi]:", r[:120])
        return r

    def unsuppress(self, name):
        self.tree_act(name, "Etkinleştir")
        self.wait(0.8)

    def setup(self, feats, extra=None):
        # açık kalmış pencereleri ve PM'i temizle (hazır model kurulumu)
        self.close_dialogs()
        if self.ev("window.__app.mode.k") == "pm":
            try:
                self.cancel("discard")
            except Exception:
                pass
        _App.setup(self, feats, extra)
        self.close_dialogs()

    def reselect(self, choice="Daha sonra"):
        """'Eksik referans' penceresi varsa düğmesine bas; pencere metnini döndür"""
        time.sleep(0.5)
        if not self.reselect_dialog():
            return None
        txt = self.ev("document.querySelector('dialog.reselect-dialog').textContent")
        self.btn(f"dialog.reselect-dialog button:has-text('{choice}')")
        time.sleep(0.5)
        return txt

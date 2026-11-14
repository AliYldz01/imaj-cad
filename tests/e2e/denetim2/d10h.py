# Denetim 2 / ajan d10 — arayüz, dosya, gezinme, telefon ortak yardımcıları (d4h.py üzerine)
# Kural: kullanıcı adımları gerçek fare / klavye / CDP dokunmayla; __app yalnız okuma + "hazır model" kurulumu.
import sys, os, time, json, math, struct, zipfile, io, re
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e')
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d4h import *  # noqa: F401,F403
import d4h
from d4h import App as _App

ONLY = set(x for x in os.environ.get("ONLY", "").split(",") if x)
DL = "/tmp/d10dl"
os.makedirs(DL, exist_ok=True)


def want(k):
    return not ONLY or k in ONLY


def note(*a):
    print("  ·", *a, flush=True)


# masaüstü dosya erişim API'si yerine sahte tutamaçlar (hazır ortam): yazılanlar window.__fs içinde
FS_MOCK = r"""
(()=>{window.__fs={}; window.__fsQ=[]; window.__fsLog=[];
 const mk=(name)=>({kind:'file', name, async getFile(){return new File([window.__fs[name]??''],name)},
   async createWritable(){let buf='';return {async write(t){buf+=typeof t==='string'?t:await new Response(t).text()},async close(){window.__fs[name]=buf;window.__fsLog.push('write:'+name)}}}});
 window.showSaveFilePicker=async(o)=>{const n=window.__fsQ.shift()??(o&&o.suggestedName)??'x.icad'; if(n==='__abort'){const e=new Error('a');e.name='AbortError';throw e} window.__fsLog.push('save-picker:'+n); return mk(n)};
 window.showOpenFilePicker=async()=>{const n=window.__fsQ.shift(); if(!n){const e=new Error('a');e.name='AbortError';throw e} window.__fsLog.push('open-picker:'+n); return [mk(n)]};
})();
"""


class App(_App):
    def __init__(self, p, mobile=False, nosfp=True, fsmock=False, tablet=False, clear=True, viewport=None):
        # d4h App'ini kur, sonra gerekirse bağlamı yeniden aç
        self._p = p
        self.b = p.chromium.launch(executable_path="/usr/bin/google-chrome",
                                   args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        self.mobile = mobile or tablet
        if tablet:
            self.ctx = self.b.new_context(viewport={"width": 820, "height": 1180}, has_touch=True, is_mobile=True, device_scale_factor=2, accept_downloads=True)
        elif mobile:
            self.ctx = self.b.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True, device_scale_factor=2, accept_downloads=True)
        else:
            self.ctx = self.b.new_context(viewport=viewport or {"width": 1400, "height": 900}, accept_downloads=True)
        self.pg = self.ctx.new_page()
        if fsmock:
            self.pg.add_init_script(FS_MOCK)
        elif nosfp:
            self.pg.add_init_script("delete window.showSaveFilePicker; delete window.showOpenFilePicker; delete window.showDirectoryPicker;")
        self.errs = []
        self.pg.on("pageerror", lambda e: self.errs.append("pageerror: " + str(e)))
        self.pg.on("console", lambda m: m.type == "error" and self.errs.append("console: " + m.text))
        self.dq = []
        self.dlog = []

        def _dlg(d):
            v = self.dq.pop(0) if self.dq else True
            self.dlog.append((d.type, d.message))
            try:
                if d.type == "prompt":
                    d.accept(v if isinstance(v, str) else d.default_value) if v is not False else d.dismiss()
                else:
                    d.accept() if v else d.dismiss()
            except Exception:
                pass
        self.pg.on("dialog", _dlg)
        self.pg.goto(URL)
        if clear:
            self.pg.evaluate("localStorage.clear()")
            self.pg.reload()
        wait_ready(self.pg)
        time.sleep(0.5)
        self.cdp = self.ctx.new_cdp_session(self.pg) if self.mobile else None

    # ---------- menüler ----------
    def menu(self, top, item, sub=None):
        """masaüstü menü çubuğu: top › item  (item alt menüyse sub ile alt öğe)"""
        self.pg.locator(f"#menus > button:text-is('{top}')").click()
        time.sleep(0.25)
        drop = self.pg.locator(".menu-drop").first
        row = drop.locator(".mrow", has=self.pg.locator(f".ml:text-is('{item}')")).first
        if sub is None:
            row.click()
        else:
            row.hover()
            time.sleep(0.25)
            subd = self.pg.locator(".menu-drop").nth(1)
            subd.locator(".mrow", has=self.pg.locator(f".ml:text-is('{sub}')")).first.click()
        time.sleep(0.4)

    def menu_items(self, top, sub=None):
        self.pg.locator(f"#menus > button:text-is('{top}')").click()
        time.sleep(0.25)
        drop = self.pg.locator(".menu-drop").first
        if sub:
            drop.locator(".mrow", has=self.pg.locator(f".ml:text-is('{sub}')")).first.hover()
            time.sleep(0.25)
            drop = self.pg.locator(".menu-drop").nth(1)
        r = drop.locator(".mrow .ml").all_inner_texts()
        self.pg.keyboard.press("Escape")
        self.ev("document.querySelectorAll('.menu-drop').forEach(x=>x.remove());document.querySelectorAll('#menus button.open').forEach(x=>x.classList.remove('open'))") if self.pg.locator(".menu-drop").count() else None
        time.sleep(0.2)
        return r

    def filemenu(self, act):
        """☰ / Dosya düğmesi açılır listesi (telefonda da var)"""
        self.btn("#file-btn")
        time.sleep(0.2)
        self.btn(f"#file-menu button[data-act='{act}']")
        time.sleep(0.4)

    def download(self, fn, timeout=120000):
        """fn() bir indirme başlatır → (ad, bayt)"""
        with self.pg.expect_download(timeout=timeout) as dl:
            fn()
        d = dl.value
        data = open(d.path(), "rb").read()
        open(os.path.join(DL, d.suggested_filename), "wb").write(data)
        return d.suggested_filename, data

    def open_file(self, fn, path):
        """fn() dosya seçiciyi açar → path seçilir"""
        with self.pg.expect_file_chooser(timeout=30000) as fc:
            fn()
        fc.value.set_files(path)
        time.sleep(0.8)
        self.wait(0.5)

    # ---------- okuma ----------
    def tabs(self):
        return self.ev("[...document.querySelectorAll('#doctabs .dtab')].map(t=>(t.classList.contains('on')?'*':'')+t.querySelector('span').textContent)")

    def docname(self):
        return self.ev("window.__app.doc.name")

    def nfeat(self):
        return self.ev("window.__app.doc.features.length")

    def featv(self, name, key):
        return self.ev("([n,k])=>{const f=window.__app.doc.features.find(f=>f.name===n);return f?f[k]:null}", [name, key])

    def toasts(self):
        return self.toast()

    def dialogs_open(self):
        return self.ev("[...document.querySelectorAll('dialog[open]')].map(d=>d.className||d.id)")

    def close_dialogs(self):
        self.ev("document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
        time.sleep(0.2)

    def cam(self):
        return self.ev("""(()=>{const v=window.__app.viewer,c=v.camera,t=v.controls.target;const d=c.position.clone().sub(t).normalize();
          return {dir:[d.x,d.y,d.z].map(x=>+x.toFixed(3)),up:[c.up.x,c.up.y,c.up.z].map(x=>+x.toFixed(3)),zoom:+c.zoom.toFixed(4),t:[t.x,t.y,t.z].map(x=>+x.toFixed(2)),persp:!!v.perspective,style:v.displayStyle}})()""")

    def view_center(self):
        return self.ev("(()=>{const r=document.querySelector('#view canvas').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()")

    def ls(self, k):
        return self.ev("k=>localStorage.getItem(k)", k)

    def block_ui_ok(self):
        return True


def stl_bbox(data):
    """ikili / ASCII STL → (üçgen sayısı, [min], [max])"""
    if data[:5] == b"solid" and b"facet" in data[:400]:
        vs = [tuple(map(float, m.groups())) for m in re.finditer(rb"vertex\s+(\S+)\s+(\S+)\s+(\S+)", data)]
        n = len(vs) // 3
    else:
        n = struct.unpack("<I", data[80:84])[0]
        vs = []
        for i in range(n):
            o = 84 + i * 50 + 12
            for k in range(3):
                vs.append(struct.unpack("<3f", data[o + k * 12:o + k * 12 + 12]))
    if not vs:
        return 0, None, None
    mn = [round(min(v[i] for v in vs), 2) for i in range(3)]
    mx = [round(max(v[i] for v in vs), 2) for i in range(3)]
    return n, mn, mx


def step_bbox(data):
    t = data.decode("latin-1")
    pts = [tuple(map(float, m.groups())) for m in re.finditer(r"CARTESIAN_POINT\('[^']*',\(([-\d.E+]+),([-\d.E+]+),([-\d.E+]+)\)\)", t)]
    if not pts:
        return None
    return [round(min(p[i] for p in pts), 2) for i in range(3)], [round(max(p[i] for p in pts), 2) for i in range(3)]


def threemf_bbox(data):
    z = zipfile.ZipFile(io.BytesIO(data))
    names = z.namelist()
    mod = [n for n in names if n.endswith(".model")]
    if not mod:
        return names, None
    t = z.read(mod[0]).decode()
    vs = [tuple(map(float, m.groups())) for m in re.finditer(r'<vertex x="([-\d.e+]+)" y="([-\d.e+]+)" z="([-\d.e+]+)"', t)]
    if not vs:
        return names, None
    return names, ([round(min(v[i] for v in vs), 2) for i in range(3)], [round(max(v[i] for v in vs), 2) for i in range(3)])

# Denetim 2 / ajan d9 — MONTAJ ve TEKNİK RESİM ortak yardımcıları (d4h.App üzerine)
# Kural: kullanıcı adımları gerçek fare / klavye / CDP dokunmayla; __app yalnız okuma + "hazır model" kurulumu.
import sys, time, json, os, re
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e')
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
import cmdpatch  # noqa
from d4h import App, chk, finish, RES, sketch, ext, wait_ready, TOP, FRONT, RIGHT, sync_playwright  # noqa

ONLY = [x for x in os.environ.get("ONLY", "").split(",") if x]
def want(k):
    return not ONLY or k in ONLY

OUT = "/home/claude/rapor2/d9_out"
os.makedirs(OUT, exist_ok=True)


def rect_sk(sid, name, plane, x0, y0, x1, y1, dims=True):
    """dikdörtgen eskiz; ölçülü + yatay/dikey (Eskizi düzenle → çift tık ile değiştirilebilsin)"""
    s = sketch(sid, name, plane, lambda pt, line, rect, c, t: rect(x0, y0, x1, y1))
    d = s["data"]
    ls = [e["id"] for e in d["ents"] if e["t"] == "line"]
    d["rels"] = [{"id": "r1", "t": "horizontal", "e": [ls[0]]}, {"id": "r2", "t": "vertical", "e": [ls[1]]},
                 {"id": "r3", "t": "horizontal", "e": [ls[2]]}, {"id": "r4", "t": "vertical", "e": [ls[3]]}]
    if dims:
        pk = list(d["pts"].keys())
        d["dims"] = [{"id": "d1", "t": "dist", "a": pk[0], "b": pk[1], "v": abs(x1 - x0), "dir": "h"},
                     {"id": "d2", "t": "dist", "a": pk[1], "b": pk[2], "v": abs(y1 - y0), "dir": "v"}]
        d["rels"].append({"id": "r5", "t": "fix", "p": [pk[0]]})
    return s


def plate_feats(w=100, h=60, t=10, hole=None, name="Plaka"):
    """Üst düzlemde w×h dikdörtgen (orijin köşede), t kalınlık; hole=(x,y,r) ile ön düzlemde değil üst yüzde delik (kesme)"""
    fs = [rect_sk("s1", "Eskiz1", TOP, 0, 0, w, h), ext("e1", "s1", t, name="Ekstrüzyon1")]
    if hole:
        x, y, r = hole
        fs.append(sketch("s2", "Eskiz2", TOP, lambda pt, line, rect, c, tt: c(x, y, r)))
        fs.append(ext("e2", "s2", t, cut=True, end="through", name="Delik1"))
    return fs


class Asm:
    """Montaj işlemleri: yalnız gerçek UI + okuma"""
    def __init__(self, A):
        self.A = A
        self.pg = A.pg

    # ----- okuma -----
    def js(self, body, arg=None):
        return self.A.ev("(arg)=>{const a=window.__app.asm; " + body + "}", arg if arg is not None else 0)

    def on(self):
        return self.js("return !!(a&&a.on)")

    def comps(self):
        return self.js("return a.doc.comps.map(c=>({id:c.id,name:c.name,p:c.p.map(v=>+v.toFixed(3)),q:c.q.map(v=>+v.toFixed(4)),fixed:!!c.fixed,hidden:!!c.hidden,sup:!!c.sup,cfg:c.cfg||null,mat:c.part.material||null,nf:c.part.features.length}))")

    def mates(self):
        return self.js("return a.doc.mates.map(m=>({id:m.id,type:m.type,v:m.v,vmax:m.vmax,off:!!m.off,flip:!!m.flip,bad:a.bad.has(m.id),a:m.a&&{comp:m.a.comp,kind:m.a.kind,c:m.a.c.map(v=>+v.toFixed(2)),n:m.a.n.map(v=>+v.toFixed(3))},b:m.b&&{comp:m.b.comp,kind:m.b.kind,c:m.b.c.map(v=>+v.toFixed(2)),n:m.b.n.map(v=>+v.toFixed(3))}}))")

    def stored(self):
        return json.loads(self.A.ev("localStorage.getItem('imajcad.asm')") or "{}")

    def bbox(self, cid):
        """bileşenin dünya sınır kutusu"""
        return self.js("const c=a.doc.comps.find(x=>x.id===arg); const b=a.bbox(c); return b?[b.min.toArray().map(v=>+v.toFixed(2)),b.max.toArray().map(v=>+v.toFixed(2))]:null", cid)

    def mesh_info(self, cid):
        return self.js("const m=a.meshes.get(arg); return m?{f:m.faces.length,e:m.edges.length,bb:[m.bbox.min,m.bbox.max]}:null", cid)

    def world(self, cid, lp):
        return self.js("""const c=a.doc.comps.find(x=>x.id===arg[0]);const T=window.__app.THREE;
          const v=new T.Vector3(...arg[1]).applyQuaternion(new T.Quaternion(...c.q)).add(new T.Vector3(...c.p));return v.toArray()""", [cid, lp])

    def screen(self, w):
        return self.A.wsc(w)

    def dof(self):
        return self.A.ev("""(()=>{const t=[...document.querySelectorAll('#tree li')].map(l=>l.textContent);return t})()""")

    def tree(self):
        return self.A.ev("[...document.querySelectorAll('#tree li')].map(l=>l.textContent.trim())")

    def acts(self):
        return self.A.ev("[...document.querySelectorAll('#tree-actions button')].map(b=>b.textContent.trim())")

    # ----- giriş -----
    def open(self):
        A = self.A
        A.show_tree() if A.mobile else None
        A.btn("#tabs button[data-tab='asm']")
        A.wait(0.8)
        if not self.on():
            A.cmd("Montajı Aç")
            A.wait(1.2)
        return self.on()

    def new(self):
        """şeritten Yeni Montaj (confirm → Evet)"""
        self.A.dq[:] = [True]
        self.A.cmd("Yeni Montaj")
        self.A.wait(0.5)

    def add_current(self):
        n = len(self.comps())
        self.A.cmd("Bileşen Ekle")
        self.A.btn("dialog.input-dialog[open] button:has-text('Geçerli parça')")
        for _ in range(120):
            time.sleep(0.25)
            if len(self.comps()) > n and not self.A.busy() and self.js("return a.meshes.size") >= n + 1:
                break
        self.A.wait(0.8)
        return self.comps()[-1]

    def add_lib(self, name):
        n = len(self.comps())
        self.A.cmd("Bileşen Ekle")
        self.A.btn(f"dialog.input-dialog[open] .pm-row button:text-is('{name}')")
        for _ in range(120):
            time.sleep(0.25)
            if len(self.comps()) > n and not self.A.busy():
                break
        self.A.wait(0.8)
        return self.comps()[-1]

    def add_file(self, path):
        n = len(self.comps())
        self.A.cmd("Bileşen Ekle")
        with self.pg.expect_file_chooser() as fc:
            self.A.btn("dialog.input-dialog[open] button:has-text('Parça dosyası aç')")
        fc.value.set_files(path)
        for _ in range(120):
            time.sleep(0.25)
            if len(self.comps()) > n and not self.A.busy():
                break
        self.A.wait(0.8)
        return self.comps()[-1]

    def face_world(self, cid, pred):
        """bileşen ağındaki yüz (yerel) için tahmin → (dünya merkez noktası, yerel yüz)"""
        r = self.js("""const m=a.meshes.get(arg[0]);const fn=eval(arg[1]);const i=m.faces.findIndex(fn);if(i<0)return null;const f=m.faces[i];return {c:f.c,n:f.n||null,r:f.r||null,i}""", [cid, pred])
        if not r:
            return None
        return self.world(cid, r["c"]), r

    def click_local(self, cid, lp, mods=()):
        s = self.screen(self.world(cid, lp))
        self.A.click(s[0], s[1], mods)
        return s

    def click_face(self, cid, pred, mods=(), shift=None):
        """yüzün merkezine (ya da yerel noktaya) gerçek tıklama"""
        fw = self.face_world(cid, pred)
        if not fw:
            raise Exception("yüz bulunamadı " + pred)
        w = fw[0]
        if shift:
            w = self.world(cid, [fw[1]["c"][i] + shift[i] for i in range(3)])
        s = self.screen(w)
        self.A.click(s[0], s[1], mods)
        return s

    def select_comp(self, name):
        self.A.show_tree()
        i = self.A.ev("n=>[...document.querySelectorAll('#tree li')].findIndex(l=>l.textContent.includes(n))", name)
        if i < 0:
            raise Exception("ağaçta yok " + name)
        loc = self.pg.locator("#tree li").nth(i)
        loc.tap() if self.A.mobile else loc.click()
        time.sleep(0.4)

    def act(self, text, confirm=None):
        if confirm is not None:
            self.A.dq[:] = list(confirm)
        self.A.btn(f"#tree-actions button:text-is('{text}')")
        self.A.wait(0.8)

    def comp_act(self, name, text, confirm=None):
        self.select_comp(name)
        self.act(text, confirm)

    def mate_li(self, sub):
        self.A.show_tree()
        i = self.A.ev("n=>[...document.querySelectorAll('#tree li')].findIndex(l=>l.classList.contains('child')&&l.textContent.includes(n)&&/\\(/.test(l.textContent)&&!l.classList.contains('plane-tog'))", sub)
        return i

    def mate_select(self, sub):
        i = self.mate_li(sub)
        if i < 0:
            raise Exception("eşleşme ağaçta yok " + sub)
        loc = self.pg.locator("#tree li").nth(i)
        if "sel" in (loc.get_attribute("class") or "").split():
            return
        loc.tap() if self.A.mobile else loc.click()
        time.sleep(0.4)

    def mate_type(self, t):
        self.A.btn(f"#pm-body .mate-types button[data-mate='{t}']")
        time.sleep(0.4)

    def mate_tab(self, t):
        self.A.btn(f"#pm-body .seg button:text-is('{t}')")
        time.sleep(0.3)

    def pmok(self):
        self.A.btn("#pm-ok")
        self.A.wait(0.6)

    def pmx(self):
        self.A.btn("#pm-cancel")
        self.A.wait(0.5)
        # çıkış penceresi açıldıysa kaydetmeden çık
        if self.pg.locator("dialog.exit-dialog[open]").count():
            self.A.btn("dialog.exit-dialog[open] button[data-v='discard']")
            self.A.wait(0.4)

    def pm_open(self):
        return not self.A.ev("document.querySelector('#pm').hidden")

    def mate_status(self):
        return self.A.ev("(()=>{const e=document.getElementById('mate-status');return e?e.textContent:''})()")

    def fit(self):
        if self.A.mobile:
            return
        self.A.blur()
        cr = self.A.ev("(()=>{const r=document.querySelector('#view canvas').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()")
        self.pg.mouse.move(cr[0], cr[1])
        self.pg.keyboard.press("f")
        time.sleep(0.4)

    def iso(self):
        self.A.ev("document.querySelector('.vcube .iso') && 0")
        loc = self.pg.locator(".vcube .iso")
        if loc.count():
            loc.first.tap() if self.A.mobile else loc.first.click()
            time.sleep(0.4)
        self.fit()

    def download(self, click):
        """click(): indirme tetikleyen eylem → (dosya adı, içerik metni)"""
        with self.pg.expect_download(timeout=180000) as dl:
            click()
        d = dl.value
        p = os.path.join(OUT, d.suggested_filename)
        d.save_as(p)
        try:
            txt = open(p, encoding="utf-8", errors="replace").read()
        except Exception:
            txt = ""
        return d.suggested_filename, txt, p


def pmsel(A, label, value):
    """etiketi tam olarak 'label' ile başlayan seçim kutusu (has-text alt dizgi sorununu önler)"""
    loc = A.pg.locator("#pm-body label.pm-field").filter(has_text=re.compile("^" + re.escape(label))).locator("select").first
    loc.select_option(value)
    time.sleep(0.3)


def dist(a, b):
    return sum((a[i] - b[i]) ** 2 for i in range(len(a))) ** 0.5


# ---------- hazır modeller (ölçülü; Eskizi düzenle ile değiştirilebilir) ----------
def rect0_sk(sid, name, plane, w, h):
    """(0,0) köşesi orijine çakışık w×h dikdörtgen; genişlik / yükseklik ölçülü, tam tanımlı"""
    s = sketch(sid, name, plane, lambda pt, line, rect, c, t: rect(0, 0, w, h))
    d = s["data"]
    d["rels"] = [{"id": "r1", "t": "horizontal", "refs": ["l5"]}, {"id": "r2", "t": "vertical", "refs": ["l6"]},
                 {"id": "r3", "t": "horizontal", "refs": ["l7"]}, {"id": "r4", "t": "vertical", "refs": ["l8"]},
                 {"id": "r5", "t": "coincident", "refs": ["p1", "O"]}]
    d["dims"] = [{"id": "D1", "t": "dist", "refs": ["p1", "p2"], "v": w, "sub": "h", "lp": [w / 2, -12]},
                 {"id": "D2", "t": "dist", "refs": ["p2", "p3"], "v": h, "sub": "v", "lp": [w + 12, h / 2]}]
    return s


def hole_sk(sid, name, plane, holes):
    """delikler: [(x,y,d)], merkez orijinden yatay / dikey ölçülü + çap"""
    d = {"pts": {}, "ents": [], "rels": [], "dims": [], "seq": 1}
    k = 0
    for i, (x, y, dd) in enumerate(holes):
        k += 1; pid = f"p{k}"; d["pts"][pid] = {"x": x, "y": y}
        k += 1; cid = f"c{k}"; d["ents"].append({"id": cid, "t": "circle", "c": pid, "r": dd / 2})
        d["dims"] += [{"id": f"H{i}x", "t": "dist", "refs": ["O", pid], "v": x, "sub": "h", "lp": [x / 2, y + 8]},
                      {"id": f"H{i}y", "t": "dist", "refs": ["O", pid], "v": y, "sub": "v", "lp": [x + 8, y / 2]},
                      {"id": f"H{i}d", "t": "dia", "refs": [cid], "v": dd, "lp": [x + dd, y + dd]}]
    d["seq"] = k + 1
    return {"id": sid, "type": "sketch", "name": name, "plane": plane, "data": d}


def plate_doc(w=100, h=60, t=10, holes=((30, 30, 10),), name="Plaka", mat=None):
    fs = [rect0_sk("s1", "Eskiz1", TOP, w, h), ext("e1", "s1", t, name="Ekstrüzyon1")]
    if holes:
        fs.append(hole_sk("s2", "Eskiz2", TOP, holes))
        fs.append(ext("e2", "s2", t, cut=True, end="through", name="Delik1"))
    d = {"version": 2, "name": name, "features": fs, "seq": {}}
    if mat:
        d["material"] = mat
    return d


def pin_doc(d=10, L=30, name="Pim"):
    s = {"pts": {"p1": {"x": 0, "y": 0}}, "ents": [{"id": "c2", "t": "circle", "c": "p1", "r": d / 2}],
         "rels": [{"id": "r1", "t": "coincident", "refs": ["p1", "O"]}],
         "dims": [{"id": "D1", "t": "dia", "refs": ["c2"], "v": d, "lp": [d, d]}], "seq": 3}
    return {"version": 2, "name": name, "features": [{"id": "s1", "type": "sketch", "name": "Eskiz1", "plane": TOP, "data": s},
                                                     ext("e1", "s1", L, name="Ekstrüzyon1")], "seq": {}}


def setdoc(A, d):
    """hazır model: belgeyi kur"""
    A.ev("d=>window.__app.setDoc(d)", d)
    A.wait(0.8)


def to_lib(A, d):
    """hazır model kur → Montaj sekmesi → şeritten 'Kütüphaneye Kaydet' (gerçek)"""
    setdoc(A, d)
    A.btn("#tabs button[data-tab='asm']")
    A.wait(0.8)
    if A.ev("!!window.__app.asm.on"):
        A.cmd("Parçaya Dön"); A.wait(0.5)
        A.btn("#tabs button[data-tab='asm']"); A.wait(0.5)
        if A.ev("!!window.__app.asm.on"):
            A.cmd("Parçaya Dön"); A.wait(0.5)
    A.cmd("Kütüphaneye Kaydet")
    A.wait(0.3)
    A.btn("#tabs button[data-tab='features']")
    A.wait(0.3)

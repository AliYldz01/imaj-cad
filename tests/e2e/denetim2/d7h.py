# Denetim 2 / ajan d7 — ortak yardımcılar (yüzeyler ve gelişmiş özellikler)
# d4h.py'den türetildi. Kural: kullanıcı adımları gerçek fare / klavye / CDP dokunmayla;
# __app yalnız okuma + "hazır model" kurulumu (setup) için.
import sys, os, time, json, math
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d4h import *  # noqa
ONLY = os.environ.get('ONLY')


def run_case(a, name, fn):
    if ONLY and name not in ONLY.split(","):
        return
    t0 = time.time()
    try:
        try:
            a.ev("document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
            a.btn("#tabs button[data-tab='features']")
        except Exception:
            pass
        fn()
    except Exception as ex:
        chk(name + " (istisna)", False, str(ex)[:300])
        try:
            print("   açık pencereler:", a.ev("[...document.querySelectorAll('dialog[open]')].map(d=>d.className+':'+d.textContent.slice(0,80))"))
            a.pg.keyboard.press("Escape"); time.sleep(0.3)
            for d in range(3):
                if a.ev("document.querySelectorAll('dialog[open]').length"):
                    a.ev("document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
            if a.mode() in ("pm", "sketch"):
                a.cancel("discard")
        except Exception:
            pass
    print(f"   [{name} {time.time()-t0:.0f} sn]", flush=True)


def line_sk(sid, name, plane, x0, y0, x1, y1, dim=True):
    """tek çizgili açık yol eskizi; yatay ise yatay ilişki + uzunluk ölçüsü"""
    sk = sketch(sid, name, plane, lambda pt, line, rect, c, t: line(pt(x0, y0), pt(x1, y1)))
    d = sk["data"]
    lid = d["ents"][0]["id"]
    if dim:
        if abs(y1 - y0) < 1e-9:
            d["rels"].append({"id": "r1", "t": "horizontal", "refs": [lid]})
        d["dims"].append({"id": "D1", "t": "dist", "refs": ["p1", "p2"], "v": abs(x1 - x0), "sub": "h", "lp": [(x0 + x1) / 2, y0 - 12]})
    return sk


def surf_feats(a):
    return a.ev("window.__app.doc.features.filter(f=>['surface','surftrim','knit','thicken','surfcut'].includes(f.type)).map(f=>({id:f.id,name:f.name,type:f.type,mode:f.mode,surf:f.surf,side:f.side,t:f.t,d:f.d,mid:f.mid,off:!!f.off,surfs:f.surfs,solid:f.solid,tool:f.tool,sketch:f.sketch,sketches:f.sketches}))")


def mesh_info(a):
    a.wait()
    return a.ev("(()=>{const m=window.__app.viewer.mesh;return m?{f:m.faces.length,b:m.bodies,bb:[m.bbox.min.map(v=>+v.toFixed(2)),m.bbox.max.map(v=>+v.toFixed(2))]}:null})()")


def check_info(a):
    """Kontrol penceresinin sonucu (okuma)"""
    return a.ev("window.__geomCheck||null")


def close_dialogs(a):
    for _ in range(3):
        if a.pg.locator("dialog[open]").count():
            a.pg.keyboard.press("Escape"); time.sleep(0.3)


def dlg_btn(a, text, sel="dialog[open]"):
    a.btn(f"{sel} button:text-is('{text}')")


def rclick(a, x, y):
    """sağ tık (masaüstü) / uzun basma (telefon)"""
    if a.mobile:
        a.longpress(x, y)
    else:
        a.pg.mouse.move(x, y, steps=3); time.sleep(0.05)
        a.pg.mouse.click(x, y, button="right")
    time.sleep(0.5)


def menu_items(a):
    return a.ev("[...document.querySelectorAll('.sw-mi')].filter(b=>b.offsetParent).map(b=>b.textContent.trim())")


def menu_click(a, text):
    a.btn(f".sw-mi:has-text('{text}')")
    time.sleep(0.4)


def face_pt(a, pred_js):
    """uygun yüzün merkezi (dünya)"""
    return a.ev("p=>{const m=window.__app.viewer.mesh;const fn=eval(p);const f=m.faces.find(fn);return f?f.c:null}", pred_js)


def choose_color(a, hexc):
    """pickColor'un açtığı gizli <input type=color> — işletim sistemi renk seçicisi otomatikleştirilemez;
    kullanıcının seçtiği rengi o girdiye yazıp change olayı veriyoruz (tek simülasyon adımı)."""
    time.sleep(0.3)
    return a.ev("""c=>{const i=[...document.querySelectorAll('input[type=color]')].pop(); if(!i) return false; i.value=c; i.dispatchEvent(new Event('change')); return true}""", hexc)


def look(a):
    return a.ev("JSON.parse(JSON.stringify(window.__app.doc.look||null))")


def face_colors(a):
    """viewer'daki yüz renkleri: {yüz indeksi: renk} (okuma)"""
    return a.ev("(()=>{const v=window.__app.viewer;const fc=v.faceColors;if(!fc) return null; const o={}; for(const [k,c] of fc) o[k]=c.toString(16); return o})()")


def tab(a, t):
    """şerit sekmesi: features / sketch / evaluate / sheet / weld / asm"""
    a.btn(f"#tabs button[data-tab='{t}']")
    time.sleep(0.3)


def evcmd(a, title):
    """Değerlendir sekmesindeki komut"""
    tab(a, "evaluate")
    a.cmd(title)
    tab_back = None
    return tab_back


def seg_click(a, text):
    """PM segment düğmesi (tırnaklı metinler için)"""
    a.ev("t=>{const b=[...document.querySelectorAll('#pm-body .seg button')].find(x=>x.textContent.trim()===t); b && (b.dataset.d7='1')}", text)
    a.btn("#pm-body .seg button[data-d7='1']")
    a.ev("document.querySelectorAll('[data-d7]').forEach(x=>delete x.dataset.d7)")


def mesh_vol(a):
    """görüntü ağından (üçgenler) diverjans hacmi ve yüz başına alanlar (okuma)"""
    return a.ev("""(()=>{const m=window.__app.viewer.mesh;if(!m) return null;const v=m.vertices,t=m.triangles;let s=0;
      for(let i=0;i<t.length;i+=3){const a=t[i]*3,b=t[i+1]*3,c=t[i+2]*3;
        s+=v[a]*(v[b+1]*v[c+2]-v[b+2]*v[c+1])-v[a+1]*(v[b]*v[c+2]-v[b+2]*v[c])+v[a+2]*(v[b]*v[c+1]-v[b+1]*v[c]);}
      return +(s/6).toFixed(2)})()""")


def face_list(a):
    return a.ev("(()=>{const m=window.__app.viewer.mesh;return m?m.faces.map(f=>({c:f.c.map(x=>+x.toFixed(2)),n:f.n&&f.n.map(x=>+x.toFixed(2)),t:f.type})):[]})()")

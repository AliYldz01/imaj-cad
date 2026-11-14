# d3 — telefonda (390×844, CDP dokunma) ilişki / ölçü / seçim / sürükleme / 3B eskiz:
# 1 çizgi çiz (parmak, 70 px imleç kayması) 2 çizgiye dokun → Yatay 3 iki çizgi (dokunuş ekler) → Paralel
# 4 Akıllı Ölçü dokunarak + değer + ✓ 5 ölçü etiketine dokun → Değiştir kutusu + / − 6 Mevcut ilişkiyi ✕ ile sil
# 7 noktayı parmakla sürükle 8 iki parmak dokunuşu geri al 9 ✓ → kayıt 10 3B eskiz: dokunarak çizgi + bağlam çubuğu
import math
from d3_ortak import *

with sync_playwright() as p:
    t = T(p, mobile=True)
    t.setup([])
    # parmak profili: önce bir dokunuş
    vr = t.pg.query_selector("#view").bounding_box()
    t.tap(vr["x"] + vr["width"] / 2, vr["y"] + vr["height"] * 0.3)
    t.new_sketch("Ön Düzlem"); t.zoom(0.9)
    OFF = 70  # parmakla çizimde imleç 70 px yukarıda (varsayılan cursorOffset)
    P = lambda s, k: (s["pts"][k]["x"], s["pts"][k]["y"])
    vis = lambda sel: t.pg.locator(sel).count() > 0 and t.pg.locator(sel).first.is_visible()

    def dtap(sx, sy, off=True):
        x, y = t.sc(sx, sy); t.tap(x, y + (OFF if off else 0))

    def new(before):
        old = {e["id"] for e in before["ents"]}
        return [e for e in t.sk()["ents"] if e["id"] not in old]

    # 1) eğik çizgi (Çizgi aracı tepsiden)
    t.cmd("Çizgi"); b0 = t.sk()
    dtap(-40, 70); dtap(30, 100)
    t.ev("0")
    ne = new(b0)
    if t.pg.locator(".actbar button:has-text('✓')").count() and t.ev(f"{ED}.isDrawing()"):
        pass
    t.key("Escape")
    s = t.sk(); L1 = ne[0] if ne else None
    ok1 = L1 and math.hypot(P(s, L1["p1"])[0] + 40, P(s, L1["p1"])[1] - 70) < 3
    t.chk("telefon: parmakla çizgi (imleç kayması ile) doğru yerde", ok1, L1 and (P(s, L1["p1"]), P(s, L1["p2"])))
    # ikinci çizgi
    b0 = t.sk(); t.cmd("Çizgi"); dtap(-40, 140); dtap(25, 160); t.key("Escape")
    ne2 = new(b0); L2 = ne2[0] if ne2 else None
    # 2) Seç → çizgiye dokun → Yatay
    t.cmd("Seç")
    a, b = P(t.sk(), L1["p1"]), P(t.sk(), L1["p2"])
    q = (a[0] + (b[0] - a[0]) * 0.3, a[1] + (b[1] - a[1]) * 0.3)
    dtap(*q, off=False)
    sel = t.ev(f"[...{ED}.sel]")
    t.chk("telefon: çizgiye dokununca seçilir", L1["id"] in sel, sel)
    okb = t.press_rel("Yatay")
    s = t.sk()
    t.chk("telefon: panelden Yatay ilişkisi", okb and abs(P(s, L1["p1"])[1] - P(s, L1["p2"])[1]) < 1e-6, t.rels())
    # 3) iki çizgi dokunarak (dokunuş seçime ekler) → Paralel
    t.key("Escape") if False else None
    t.ev(f"0")
    sel = t.ev(f"[...{ED}.sel]")
    if sel:
        dtap(-95, 40, off=False)  # boşluğa dokun: seçim temizlenir mi?
    sel0 = t.ev(f"[...{ED}.sel]")
    a, b = P(t.sk(), L1["p1"]), P(t.sk(), L1["p2"])
    dtap(a[0] + (b[0] - a[0]) * 0.3, a[1], off=False)
    a, b = P(t.sk(), L2["p1"]), P(t.sk(), L2["p2"])
    dtap(a[0] + (b[0] - a[0]) * 0.7, a[1] + (b[1] - a[1]) * 0.7, off=False)
    sel = t.ev(f"[...{ED}.sel]")
    t.chk("telefon: boşluğa dokunuş seçimi temizler, iki dokunuş iki çizgi seçer", not sel0 and len(sel) == 2, (sel0, sel))
    okp = t.press_rel("Paralel")
    s = t.sk(); a, b = P(s, L2["p1"]), P(s, L2["p2"])
    t.chk("telefon: Paralel → ikinci çizgi de yatay", okp and abs(a[1] - b[1]) < 1e-6, (okp, a, b))
    # 6) Mevcut ilişkiyi ✕ ile sil (tek çizgi seçili)
    dtap(-95, 40, off=False)
    a, b = P(t.sk(), L2["p1"]), P(t.sk(), L2["p2"])
    dtap(a[0] + (b[0] - a[0]) * 0.35, a[1], off=False)
    n0 = len(t.sk()["rels"])
    t.note("seçim", t.ev(f"[...{ED}.sel]"), t.pg.locator("#pm-body li.pm-rel").all_inner_texts(), t.ev("document.body.className"), t.ev("document.querySelector('#side').className"))
    t.pg.screenshot(path="/tmp/d3/m3.png")
    x = t.pg.locator("#pm-body li.pm-rel:has-text('Paralel') button.x")
    if x.count(): x.first.tap(); time.sleep(0.4)
    t.chk("telefon: Mevcut ilişkiler ✕ dokunuşu ilişkiyi siler", len(t.sk()["rels"]) == n0 - 1, (n0, len(t.sk()["rels"])))
    s_b = t.sk(); t.key("Control+z"); s_a = t.sk()
    t.note("geri al sonrası L1", P(s_b, L1["p1"]), "→", P(s_a, L1["p1"]), t.res())
    # 4) Akıllı Ölçü dokunarak: L1 → 50
    dtap(-95, 40, off=False)
    t.cmd("Akıllı Ölçü")
    a, b = P(t.sk(), L1["p1"]), P(t.sk(), L1["p2"])
    # v0.89 (D2-5): Akıllı Ölçü dokunulan öğeyi işler (imleç kayması yok)
    dtap(a[0] + (b[0] - a[0]) * 0.3, a[1], off=False)
    t.note("ölçü refs 1", t.ev(f"{ED}.st.refs"), t.ev(f"{ED}.tool"))
    dtap(a[0] + (b[0] - a[0]) * 0.5, a[1] - 12, off=False)
    t.note("ölçü refs 2", t.ev(f"{ED}.st.refs"), t.pg.locator(".dim-prompt").count())
    has = t.pg.locator(".dim-prompt").count() > 0
    t.chk("telefon: Akıllı Ölçü dokunarak → değer kutusu", has)
    if has:
        t.pg.fill(".dim-prompt input", "50"); t.pg.locator(".dim-prompt .ok").tap(); time.sleep(0.4)
    s = t.sk(); a, b = P(s, L1["p1"]), P(s, L1["p2"])
    t.chk("telefon: ölçü 50 uygulandı", abs(math.hypot(b[0] - a[0], b[1] - a[1]) - 50) < 1e-6 and len(s["dims"]) == 1, (a, b, s["dims"]))
    # 5) etikete dokun → Değiştir kutusu; + iki kez → 52 → ✓
    t.cmd("Seç"); dtap(-95, 40, off=False)
    lab = t.pg.locator(".dim").first
    lab.tap(); time.sleep(0.4)
    has = t.pg.locator(".dim-prompt").count() > 0
    t.chk("telefon: ölçü etiketine dokunuş Değiştir kutusunu açar", has)
    if has:
        t.pg.locator(".dim-prompt .inc").tap(); t.pg.locator(".dim-prompt .inc").tap(); time.sleep(0.3)
        live = t.sk()
        t.pg.locator(".dim-prompt .ok").tap(); time.sleep(0.4)
    s = t.sk(); a, b = P(s, L1["p1"]), P(s, L1["p2"])
    t.chk("telefon: + + → 52", abs(math.hypot(b[0] - a[0], b[1] - a[1]) - 52) < 1e-6, math.hypot(b[0] - a[0], b[1] - a[1]))
    # 7) tanımsız noktayı parmakla sürükle (L2 ucu)
    # v0.89: araç çubukları altında kalmayan uç seçilir (tuvalin üstü görünüm / ekran çubuğuyla dolu)
    PK = "p2"
    for k in ("p2", "p1"):
        qq = P(t.sk(), L2[k]); xx, yy = t.sc(*qq)
        if t.ev(f"document.elementFromPoint({xx},{yy})?.tagName") == "CANVAS":
            PK = k; break
    q0 = P(t.sk(), L2[PK]); x0, y0 = t.sc(*q0)
    t.drag(x0, y0, x0 + 40, y0 + 30, 10)
    q1 = P(t.sk(), L2[PK])
    cam0 = t.ev("window.__app.viewer.camera.position.toArray()")
    t.chk("telefon: Seç aracında noktayı parmakla sürükleme (parmak noktanın üstünde)", math.hypot(q1[0] - q0[0], q1[1] - q0[1]) > 5, (q0, q1))
    if math.hypot(q1[0] - q0[0], q1[1] - q0[1]) < 5:
        t.drag(x0, y0 + OFF, x0 + 40, y0 + 30 + OFF, 10)
        q1 = P(t.sk(), L2[PK])
        t.note("parmak noktanın 70 px altından sürüklenince", q0, "→", q1, "kamera", cam0, "→", t.ev("window.__app.viewer.camera.position.toArray()"))
    # 8) iki parmak dokunuşu = geri al
    x, y = 120, 330  # v0.89: tuvalin ortası (önceki nokta görünüm küpünün üstüne denk geliyordu)
    t.touch("touchStart", [(x, y), (x + 80, y)]); time.sleep(0.05); t.touch("touchEnd", []); time.sleep(0.4)
    q2 = P(t.sk(), L2[PK])
    # v0.89: sürükleme artık çalıştığı için son işlem sürüklemedir (D3-5); iki parmak onu geri alır, değilse (sürükleme olmadıysa) ölçü 52
    moved = math.hypot(q1[0] - q0[0], q1[1] - q0[1]) > 5
    t.chk("telefon: iki parmak dokunuşu son işlemi geri alır (sürükleme → nokta eski yerinde / yoksa ölçü 52 → 50)",
          (math.hypot(q2[0] - q0[0], q2[1] - q0[1]) < 1e-6) if moved else abs(t.sk()["dims"][0]["v"] - 50) < 1e-6, (q0, q2, t.sk()["dims"][0]["v"]))
    # 9) ✓ (ekran çubuğu ya da panel) → kayıt
    fid = t.ev("window.__app.mode.featId"); ed_before = t.sk()
    okbtn = t.pg.locator(".actbar button:has-text('✓')")
    (okbtn.first.tap() if okbtn.count() and okbtn.first.is_visible() else t.pg.locator("#pm-ok").tap()); t.wait(0.8)
    sv = t.saved_feat(fid)
    t.chk("telefon: ✓ → eskiz kayda geçti (editördeki ölçü ve ilişkiler)", sv and sv["data"]["dims"] == ed_before["dims"] and sv["data"]["rels"] == ed_before["rels"], sv and (sv["data"]["dims"], sv["data"]["rels"]))

    # 10) 3B eskiz telefonda
    t.tab("weld"); t.cmd("3B Eskiz"); time.sleep(0.5)
    t.pg.locator(".vcube .iso").tap() if t.pg.locator(".vcube .iso").count() else None
    time.sleep(0.4)
    t.ev("(()=>{const v=window.__app.viewer;v.camera.zoom*=0.6;v.camera.updateProjectionMatrix();v.requestRender&&v.requestRender()})()"); time.sleep(0.2)
    R = t.pg.query_selector("#view canvas").bounding_box()
    S = lambda x, y, z: (lambda s: (R["x"] + s[0], R["y"] + s[1]))(t.ev(f"window.__app.viewer.toScreen([{x},{y},{z}])"))
    D = lambda js: t.ev(f"(()=>{{const d=window.__app.mode.draft; return d && {js}}})()")
    t.pg.locator("#pm-body .seg button:has-text('Çizgi')").first.tap(); time.sleep(0.2)
    pts3 = [(0, 0, 0), (80, 0, 0), (80, 0, 60)]
    t.note("3B ekran noktaları", [tuple(round(v) for v in S(*q)) for q in pts3])
    for pt in pts3:
        x, y = S(*pt); t.tap(x, y)
    t.chk("telefon 3B: dokunarak 2 çizgi", D("d.lines.length") == 2, (D("d.lines.length"), D("JSON.stringify(d.xyz)")))
    t.pg.locator("#pm-body .seg button:has-text('Seç')").first.tap(); time.sleep(0.2)
    if D("d.lines.length"):
        m = D("(()=>{const l=d.lines[0],P=id=>d.xyz[d.ids.indexOf(id)];const a=P(l.a),b=P(l.b);return [0,1,2].map(k=>a[k]+(b[k]-a[k])*0.4)})()")
        x, y = S(*m); t.tap(x, y)
        bar = t.pg.locator(".s3-relbar .s3-rb").all_inner_texts()
        t.chk("telefon 3B: çizgiye dokununca bağlam çubuğu", len(bar) > 0 and t.ev("window.__app.s3.sel.length") == 1, bar)
    t.close()

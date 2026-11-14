# d3 — model kenarına ölçü (Akıllı Ölçü ile model kenarı) ve modele bağlılık; ölçü silme (Delete / şerit Sil) + geri al;
# ölçülü deliğin model değişince davranışı. Hazır model: Üst düzlemde 80×60 kutu (ölçülü), 20 mm.
from d3_ortak import *

with sync_playwright() as p:
    t = T(p)
    sk0 = sketch("s0", "Taban", TOP, lambda pt, line, rect, c, tx: rect(-40, -30, 40, 30))
    sk0["data"]["dims"] = [{"id": "W", "t": "dist", "refs": ["p1", "p2"], "v": 80, "sub": "a", "lp": [0, -40]}]
    t.setup([sk0, ext("e0", "s0", 20)])
    P = lambda s, k: (s["pts"][k]["x"], s["pts"][k]["y"]) if k != "O" else (0.0, 0.0)
    # üst yüzde eskiz
    t.pg.click(".vcube .iso"); time.sleep(0.4)
    R = t.pg.query_selector("#view canvas").bounding_box()
    s0 = t.ev("window.__app.viewer.toScreen([0,20,0])")
    t.pg.mouse.click(R["x"] + s0[0], R["y"] + s0[1]); time.sleep(0.3)
    t.cmd("Eskiz"); t.wait(0.6); t.quickdim(False)
    t.chk("üst yüzde eskiz", t.ev("window.__app.mode.k") == "sketch")
    # eskiz yerel ↔ dünya
    loc = lambda w: t.ev(f"(()=>{{const f={ED}.frame;const w={w};const d=[0,1,2].map(i=>w[i]-f.o[i]);const yv=[f.n[1]*f.x[2]-f.n[2]*f.x[1],f.n[2]*f.x[0]-f.n[0]*f.x[2],f.n[0]*f.x[1]-f.n[1]*f.x[0]];return [d[0]*f.x[0]+d[1]*f.x[1]+d[2]*f.x[2], d[0]*yv[0]+d[1]*yv[1]+d[2]*yv[2]]}})()")
    wld = lambda q: t.ev(f"(()=>{{const f={ED}.frame;const yv=[f.n[1]*f.x[2]-f.n[2]*f.x[1],f.n[2]*f.x[0]-f.n[0]*f.x[2],f.n[0]*f.x[1]-f.n[1]*f.x[0]];return [0,1,2].map(i=>+(f.o[i]+f.x[i]*{q[0]}+yv[i]*{q[1]}).toFixed(3))}})()")
    c = loc([10, 20, 5])
    t.cmd("Daire"); t.kclick(*c, "Control"); r_ = loc([16, 20, 5]); t.kclick(*r_, "Control")
    circ = t.sk()["ents"][-1]
    # Akıllı Ölçü: daire merkezi + modelin sağ kenarı (x=40)
    edge_pt = loc([40, 20, 12])
    t.cmd("Akıllı Ölçü")
    t.kclick(*P(t.sk(), circ["c"])); t.kclick(*edge_pt)
    t.note("refs", t.ev(f"{ED}.st.refs"))
    lab = loc([25, 20, 25]); t.kclick(*lab)
    if t.pg.locator(".dim-prompt").count(): t.prompt_val(12)
    cw = wld(P(t.sk(), circ["c"]))
    t.chk("model kenarına ölçü 12 → daire merkezi x=28", abs(cw[0] - 28) < 1e-3, (cw, [(d["t"], d["v"]) for d in t.sk()["dims"]]))
    fid = t.ev("window.__app.mode.featId")
    t.cmd("Seç"); t.pm_ok()
    # kutu genişliği 80 → 100 (x ±50): ölçü modele bağlıysa daire x=38'e gider
    t.edit_sketch("e0")
    t.pg.locator(".dim").first.dblclick(); time.sleep(0.3); t.prompt_val(100)
    t.pm_ok()
    f = next(x for x in t.doc()["features"] if x["id"] == fid)
    t.edit_sketch(f["name"])
    cw2 = wld(P(t.sk(), circ["c"]))
    t.chk("model kenarına verilen ölçü modeli izler (kutu 100 → daire x=38)", abs(cw2[0] - 38) < 1e-3, cw2)
    # ölçü silme: etiketi seç → Delete → geri al ; şeritten Sil
    nd = len(t.sk()["dims"])
    t.pg.locator(".dim").first.click(); time.sleep(0.2); t.key("Delete")
    t.chk("ölçü seçilip Delete ile silinir", len(t.sk()["dims"]) == nd - 1, len(t.sk()["dims"]))
    t.key("Control+z")
    t.chk("Ctrl+Z ölçüyü geri getirir", len(t.sk()["dims"]) == nd)
    t.pg.locator(".dim").first.click(); time.sleep(0.2); t.cmd("Sil")
    t.chk("şeritten Sil ölçüyü siler", len(t.sk()["dims"]) == nd - 1)
    t.key("Control+z")
    t.pm_cancel("discard")
    t.close()

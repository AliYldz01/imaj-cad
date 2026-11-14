# d3 — 3B eskiz süpürme yolu olarak: yalnız 3B eskiz varken Süpürme; dairesel profil + 3B yol → boru;
# 3B eskiz ölçüsü değişince süpürme güncellenir; geri al; yenile. Hazır model: L biçimli 3B eskiz (200 x, 150 z, ölçülü).
from d3_ortak import *

K3 = {"id": "k3", "type": "sketch3d", "name": "3B Eskiz1", "ids": ["p1", "p2", "p3"], "xyz": [[0, 0, 0], [200, 0, 0], [200, 0, 150]],
      "lines": [{"id": "l1", "a": "p1", "b": "p2", "ax": "x"}, {"id": "l2", "a": "p2", "b": "p3", "ax": "z"}], "r": 0, "seq": 10,
      "cons3": [{"id": "c1", "t": "fix", "e": ["p1"], "p": [0, 0, 0]}],
      "dims3": [{"id": "d1", "t": "len", "e": ["l1"], "v": 200}, {"id": "d2", "t": "len", "e": ["l2"], "v": 150}]}

with sync_playwright() as p:
    t = T(p)
    t.setup([K3])
    t.tab("features"); t.tree_click("3B Eskiz1"); t.cmd("Süpürme"); time.sleep(0.5)
    toast = t.ev("(document.querySelector('#toast')||{}).textContent")
    t.chk("yalnız 3B eskiz varken Süpürme açılır (dairesel profil + 3B yol)", t.ev("window.__app.mode.k") == "pm", (t.ev("window.__app.mode.k"), toast))
    if t.ev("window.__app.mode.k") != "pm":
        # hazır model: profil için ayrıca bir 2B eskiz (yalnız komutun açılabilmesi için)
        t.setup([K3, sketch("c1", "Profil", RIGHT, lambda pt, line, rect, c, tx: c(0, 0, 10))])
        t.tab("features"); t.cmd("Süpürme"); time.sleep(0.5)
    sels = t.pg.locator("#pm-body select")
    path_sel = None
    for i in range(sels.count()):
        if "k3" in t.ev("s=>[...s.options].map(o=>o.value).join(',')", sels.nth(i).element_handle()) if False else "k3" in sels.nth(i).inner_html():
            path_sel = sels.nth(i); break
    t.chk("yol listesinde 3B eskiz var", path_sel is not None)
    path_sel.select_option("k3"); time.sleep(0.3)
    t.pg.locator("#pm-body button:has-text('Dairesel profil'), #pm-body label:has-text('Dairesel profil')").first.click(); time.sleep(0.3)
    t.pm_ok(); t.wait(2.0)
    bb = t.bbox()
    t.chk("3B yol boyunca Ø20 boru (x 0..210, z ..150)", bb and abs(bb[1][0] - 210) < 1.5 and abs(bb[1][2] - 150) < 1.5, bb)
    # 3B eskizi düzenle → ölçü 200 → 300
    t.tree_click("3B Eskiz1")
    acts = t.pg.locator("#tree-actions button").all_inner_texts()
    t.tree_act("Düzenle") if "Düzenle" in acts else t.tree_act("Eskizi düzenle")
    time.sleep(0.5)
    t.chk("3B eskiz düzenleme açıldı", t.ev("window.__app.mode.k") == "pm" and t.ev("window.__app.mode.draft.type") == "sketch3d")
    labs = t.pg.locator(".s3-labels .s3-dim")
    ix = next(i for i in range(labs.count()) if labs.nth(i).inner_text().startswith("200"))
    labs.nth(ix).dblclick(); time.sleep(0.3)
    loc = t.pg.locator(".s3-len").first
    loc.fill("300"); loc.press("Enter"); time.sleep(0.4)
    t.pm_ok(); t.wait(2.0)
    bb = t.bbox()
    t.chk("3B ölçü 300 → süpürme 310'a uzadı", bb and abs(bb[1][0] - 310) < 1.5, bb)
    t.key("Control+z"); t.wait(1.5)
    bb = t.bbox(); t.chk("Ctrl+Z → 210", bb and abs(bb[1][0] - 210) < 1.5, bb)
    t.key("Control+y"); t.wait(1.5)
    t.reload(); t.wait(2.0)
    bb = t.bbox(); t.chk("yenile → 310", bb and abs(bb[1][0] - 310) < 1.5, bb)
    # 3B eskizde noktayı sürükle (tanımsız z ucu değil: tam tanımlı → kıpırdamaz)
    t.close()

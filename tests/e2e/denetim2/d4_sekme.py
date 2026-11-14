# Denetim 2 / d4 — Sac Metal ve Kaynaklı sekmelerindeki "Ekst. Kesme" düğmeleri (aynı komut, farklı sekme)
import sys
sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d4h import *  # noqa
with sync_playwright() as p:
    a = App(p)
    for tab in ["sheet", "weld"]:
        a.setup(block() + [circ_sk("s2", "Eskiz2", top_face(20), 0, 0, 10)])
        a.tsel("Eskiz2")
        a.btn(f"#tabs button[data-tab='{tab}']"); time.sleep(0.4)
        loc = a.pg.locator("#cmds button[title='Ekst. Kesme']")
        chk(f"{tab}: şeritte Ekst. Kesme var", loc.count() > 0)
        a.pg.evaluate("t=>window.__app.showCmd&&window.__app.showCmd(t)", "Ekst. Kesme")
        loc.first.click(); a.wait(1.0)
        a.ok()
        chk(f"{tab}: Ekst. Kesme → delik", near(a.vol(), 96000 - PI * 100 * 20, 1), (a.vol(), a.names()))
        a.btn("#tabs button[data-tab='features']")
    a.close()
finish()

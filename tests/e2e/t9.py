import cmdpatch
import sys, time
from playwright.sync_api import sync_playwright
URL=sys.argv[1] if len(sys.argv)>1 else "http://localhost:4173/"
def wait_ready(pg, t=90000):
    pg.wait_for_function("!document.querySelector('#status').classList.contains('busy') && !document.querySelector('#status-text').textContent.includes('yükleniyor')", timeout=t)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); pg.on("dialog", lambda d: d.accept())
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    r = pg.query_selector("#view").bounding_box()
    def zoom(z=0.9):
        pg.evaluate(f"(()=>{{const v=window.__app.viewer; v.camera.zoom={z}; v.camera.updateProjectionMatrix(); const d=v.camera.position.clone().sub(v.controls.target); v.controls.target.set(0,0,0); v.camera.position.copy(d); v.camera.updateMatrixWorld(); v.requestRender();}})()")
    def sc(x,y):
        s = pg.evaluate(f"window.__app.viewer.toScreen([{x},{y},0])"); return r["x"]+s[0], r["y"]+s[1]
    def clk(*pts):
        for q in pts: pg.mouse.click(*sc(*q)); time.sleep(0.12)
    def tool(t): pg.click(f"#cmds button[title='{t}']"); time.sleep(0.1)
    for name, pts in [("Kanal", [(-70,40),(-30,40),(-30,48)]), ("Yay Kanal", [(0,0),(30,0),(0,30),(36,0)]), ("Elips", [(70,40),(90,40),(70,48)]), ("Kısmi Elips", [(70,0),(90,0),(70,8),(90,0),(70,8)]), ("Parabol", [(-90,-20),(-50,-20),(-70,0)]), ("Teğet Yay", None)]:
        if pts is None: continue
        pg.click("#tree li:has-text('Ön Düzlem')"); pg.click("#tree-actions button:has-text('Eskiz')"); time.sleep(0.3); zoom()
        tool(name); clk(*pts); time.sleep(0.2)
        before = pg.inner_text("#status-text")
        tool("Tam Tanımla"); time.sleep(0.4)
        print(name, "|", before, "->", pg.inner_text("#status-text"))
        pg.click("#pm-cancel"); time.sleep(0.4)
        if pg.query_selector("dialog.exit-dialog[open]"): pg.click("dialog.exit-dialog button[data-v=discard]"); time.sleep(0.3)
    b.close()

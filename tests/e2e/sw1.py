import cmdpatch
import sys, time
from playwright.sync_api import sync_playwright
from h import wait_ready
URL=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:4173/'
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.on("dialog", lambda d: d.accept())
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    r = pg.query_selector("#view").bounding_box(); cx, cy = r["x"]+r["width"]/2, r["y"]+r["height"]/2
    camdir = lambda: pg.evaluate("(()=>{const v=window.__app.viewer; const d=v.camera.position.clone().sub(v.controls.target).normalize(); return [d.x,d.y,d.z].map(x=>+x.toFixed(2))})()")
    zoom = lambda: round(pg.evaluate("window.__app.viewer.camera.zoom"),4)
    pg.mouse.move(cx, cy)
    for k,n in [("Control+1","front"),("Control+5","top"),("Control+4","right"),("Control+7","iso")]:
        pg.keyboard.press(k); time.sleep(0.15); print(k, n, camdir())
    pg.keyboard.press("ArrowLeft"); time.sleep(0.1); print("arrow left", camdir())
    pg.keyboard.press("Control+Shift+Z"); time.sleep(0.1); print("prev view", camdir())
    z0=zoom(); pg.mouse.wheel(0,-200); time.sleep(0.2); z1=zoom(); print("wheel fwd zoom", z0, "->", z1, "OUT" if z1<z0 else "IN")
    pg.keyboard.press("z"); z2=zoom(); pg.keyboard.press("Shift+Z"); z3=zoom(); print("z/Z", z1, z2, z3)
    # middle drag rotate
    d0=camdir(); pg.mouse.move(cx,cy); pg.mouse.down(button="middle"); pg.mouse.move(cx+80,cy,steps=5); pg.mouse.up(button="middle"); print("middle rotate", d0, "->", camdir())
    # right gesture up -> top
    pg.keyboard.press("Control+7"); pg.mouse.move(cx,cy); pg.mouse.down(button="right"); pg.mouse.move(cx,cy-60,steps=6)
    print("gesture guide visible:", pg.locator(".sw-gesture").count(), pg.locator(".sw-g.on").all_inner_texts())
    pg.mouse.up(button="right"); time.sleep(0.15); print("after gesture up:", camdir())
    # right click -> context menu
    pg.mouse.click(cx+50, cy+50, button="right"); time.sleep(0.1)
    print("ctx menu:", pg.locator(".sw-ctx .sw-mi").all_inner_texts())
    pg.keyboard.press("Escape")
    pg.mouse.move(cx, cy); pg.keyboard.press("s"); time.sleep(0.1); print("S bar buttons:", pg.locator(".sw-sbar .sw-sb").count())
    pg.keyboard.press("Escape")
    # sketch: gesture left -> line, A arc
    pg.click("#tree li:has-text('Ön Düzlem')"); pg.click("#tree-actions button:has-text('Eskiz')"); time.sleep(0.4)
    pg.evaluate("window.__app.mode.editor.opts.quickDim=false")
    pg.mouse.move(cx,cy); pg.mouse.down(button="right"); pg.mouse.move(cx-70,cy,steps=6); pg.mouse.up(button="right"); time.sleep(0.1)
    print("tool after left gesture:", pg.evaluate("window.__app.mode.editor.tool"))
    pg.mouse.click(cx-200,cy+80); time.sleep(0.1); pg.mouse.click(cx-40,cy+83); time.sleep(0.1)
    pg.keyboard.press("a"); pg.mouse.move(cx+60,cy-20, steps=4); pg.mouse.click(cx+60,cy-20); time.sleep(0.1)
    pg.mouse.click(cx+60,cy-200); time.sleep(0.1); pg.keyboard.press("Escape"); time.sleep(0.2)
    print("ents:", pg.evaluate("window.__app.mode.editor.data.ents.map(e=>e.t).join(',')"),
          "rels:", pg.evaluate("window.__app.mode.editor.data.rels.map(r=>r.t).join(',')"))
    pg.screenshot(path="sw1_arc.png")
    pg.keyboard.press("Control+a"); pg.keyboard.press("Control+c"); pg.mouse.move(cx+250, cy+150); pg.keyboard.press("Control+v"); time.sleep(0.3)
    print("after paste ents:", pg.evaluate("window.__app.mode.editor.data.ents.length"))
    pg.keyboard.press("Escape"); pg.keyboard.press("Escape")
    # gesture down -> rect; Enter repeat
    pg.mouse.move(cx,cy); pg.mouse.down(button="right"); pg.mouse.move(cx,cy+70,steps=6); pg.mouse.up(button="right"); time.sleep(0.1)
    print("tool after down gesture:", pg.evaluate("window.__app.mode.editor.tool"))
    pg.keyboard.press("Escape"); pg.keyboard.press("Escape"); print("tool after esc:", pg.evaluate("window.__app.mode.editor.tool"))
    pg.keyboard.press("Enter"); time.sleep(0.1); print("tool after Enter (repeat):", pg.evaluate("window.__app.mode.editor.tool"))
    pg.mouse.click(cx+50, cy+50, button="right"); print("sketch ctx:", pg.locator(".sw-ctx .sw-mi").all_inner_texts())
    print("errors:", logs)

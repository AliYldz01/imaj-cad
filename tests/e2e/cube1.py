import cmdpatch
import time
from playwright.sync_api import sync_playwright
from h import wait_ready
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto('http://localhost:4173/'); wait_ready(pg); time.sleep(0.5)
    cam = lambda: pg.evaluate("(()=>{const v=window.__app.viewer; const d=v.camera.position.clone().sub(v.controls.target).normalize(); return [d.x,d.y,d.z].map(x=>+x.toFixed(2))})()")
    print("cube visible:", pg.locator(".vcube").is_visible(), "orient btns visible:", pg.locator("#viewbar button.orient").first.is_visible())
    pg.keyboard.press("Control+1"); time.sleep(0.2)
    def clickCell(face, row, col):
        loc = pg.locator(f".vcube .face:has-text('{face}') .cell").nth(row*3+col)
        bb = loc.bounding_box(); pg.mouse.click(bb["x"]+bb["width"]/2, bb["y"]+bb["height"]/2); time.sleep(0.2)
    clickCell("Ön", 0, 2); print("front top-right corner:", cam())
    clickCell("Ön", 1, 1); print("front center:", cam())
    clickCell("Ön", 1, 2); print("front right edge:", cam())
    clickCell("Ön", 0, 2); pg.mouse.move(700,500); time.sleep(0.2)
    bb = pg.locator(".vcube").bounding_box(); pg.screenshot(path="cube1.png", clip={"x":bb["x"]-20,"y":bb["y"]-20,"width":130,"height":140})
    print("errors:", logs)

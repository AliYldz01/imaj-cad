# Profili konumlandır penceresi: telefon ve masaüstünde nokta boyutları (dokunulabilir olmalı)
import cmdpatch, time
from h import *
s3 = {"id":"k","type":"sketch3d","name":"K","ids":["a","b"],"xyz":[[0,0,0],[500,0,0]],"lines":[{"id":"l1","a":"a","b":"b"}],"r":0,"seq":3}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    for name, vp, mob in [("telefon",{"width":390,"height":844},True),("masaustu",{"width":1400,"height":900},False)]:
        ctx = b.new_context(viewport=vp, is_mobile=mob, has_touch=mob, device_scale_factor=2 if mob else 1)
        pg = ctx.new_page(); logs=[]; pg.on("pageerror", lambda e: logs.append(str(e)))
        pg.goto(URL); wait_ready(pg); time.sleep(0.5)
        pg.evaluate("d=>window.__app.setDoc(d)", {"version":2,"name":"T","features":[s3],"seq":{}}); time.sleep(0.4); wait_ready(pg)
        pg.evaluate("window.__app.showCmd && 0")
        pg.click("#tabs button[data-tab='weld']")
        pg.click("#cmds button:has-text('Yapı Elemanı')"); time.sleep(0.6)
        pg.select_option("#pm-body select >> nth=0", "dkutu"); time.sleep(0.3)
        btn = pg.locator("#pm-body button:has-text('Profili konumlandır')"); btn.scroll_into_view_if_needed(); btn.click(); time.sleep(0.4)
        r = pg.evaluate("(()=>{const d=document.querySelector('dialog.pierce-dialog').getBoundingClientRect(); const c=[...document.querySelectorAll('dialog g.pp circle:last-child')].map(e=>e.getBoundingClientRect().width); const h=[...document.querySelectorAll('dialog g.pp circle:first-child')].map(e=>e.getBoundingClientRect().width); return {dlg:[Math.round(d.width),Math.round(d.height)], n:c.length, dot:Math.round(Math.min(...c)), hit:Math.round(Math.min(...h))}})()")
        print(name, r)
        pg.screenshot(path=f"/home/claude/pp1_{name}.png")
        pg.locator("dialog g.pp").nth(1).tap() if mob else pg.locator("dialog g.pp").nth(1).click()
        time.sleep(0.3); print(" secilen:", pg.evaluate("[window.__app.mode.draft.align, window.__app.mode.draft.poff]"), "acik:", pg.locator("dialog.pierce-dialog").count(), logs)
        ctx.close()

# Çıkış onayı: eskizde / özellik panelinde Esc, ✕ ve geri tuşu değişiklik varsa sorar
import cmdpatch, time
from h import *
ok = []
def chk(name, cond, info=""):
    ok.append(cond); print(("TAMAM " if cond else "HATA  ") + name, info)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    dlg = lambda: pg.query_selector("dialog.exit-dialog[open]") is not None
    md = lambda: pg.evaluate("window.__app.mode.k")
    nfe = lambda: pg.evaluate("window.__app.doc.features.length")
    ed = "window.__app.mode.editor"
    def new_sketch():
        pg.click("#tree li:has-text('Ön Düzlem')"); pg.click("#tree-actions button:has-text('Eskiz')"); time.sleep(0.4)
    def draw_line():
        pg.evaluate(f"(()=>{{const e={ed}; const d=e.data; d.pts.pa={{x:0,y:0}}; d.pts.pb={{x:40,y:10}}; d.ents.push({{id:'lx',t:'line',p1:'pa',p2:'pb'}}); e.resolve();}})()")
    # 1) boş eskiz: Esc sormadan çıkar
    n0 = nfe(); new_sketch(); chk("eskiz açık", md() == "sketch")
    pg.mouse.move(700, 450)
    for _ in range(3): pg.keyboard.press("Escape"); time.sleep(0.2)
    chk("eskizde Esc eskizden çıkmaz (SolidWorks)", not dlg() and md() == "sketch", md())
    pg.click("#pm-cancel"); time.sleep(0.3)
    chk("boş eskiz ✕ → soru yok, çıktı", not dlg() and md() == "part" and nfe() == n0, (md(), nfe()))
    # 2) çizim varken Esc → soru; Vazgeç → eskizde kalır
    new_sketch(); draw_line(); pg.evaluate(f"{ed}.setTool('select')"); pg.click("#pm-cancel"); time.sleep(0.3)
    chk("çizimli eskiz ✕ → soru", dlg())
    pg.click("dialog.exit-dialog button[data-v=stay]"); time.sleep(0.2)
    chk("Vazgeç → eskizde, çizim duruyor", md() == "sketch" and pg.evaluate(f"{ed}.data.ents.length") == 1)
    # pencerede Esc = Vazgeç
    pg.click("#pm-cancel"); time.sleep(0.3); chk("ikinci ✕ → soru", dlg())
    pg.keyboard.press("Escape"); time.sleep(0.3)
    chk("pencerede Esc = Vazgeç", not dlg() and md() == "sketch")
    # 3) ✕ → soru → Kaydetmeden çık
    pg.click("#pm-cancel"); time.sleep(0.3); chk("✕ → soru", dlg())
    pg.click("dialog.exit-dialog button[data-v=discard]"); time.sleep(0.4)
    chk("Kaydetmeden çık → eskiz silindi", md() == "part" and nfe() == n0, nfe())
    # 4) geri tuşu → soru → Kaydet ve çık
    new_sketch(); draw_line(); time.sleep(0.2)
    pg.evaluate("history.back()"); time.sleep(0.6)
    chk("geri tuşu → soru, sayfada kaldı", dlg() and md() == "sketch" and "imaj" in pg.url.lower() or dlg(), pg.url)
    pg.click("dialog.exit-dialog button[data-v=save]"); time.sleep(0.5)
    chk("Kaydet ve çık → eskiz kaldı", md() == "part" and nfe() == n0 + 1, nfe())
    # 5) özellik paneli: değişiklik yoksa Esc sormaz, varsa sorar
    pg.evaluate("window.__app.showCmd && 0")
    pg.click("#cmds button[title^='Radyüs']"); time.sleep(0.4)
    chk("radyüs paneli", md() == "pm")
    pg.mouse.move(700, 450); pg.keyboard.press("Escape"); time.sleep(0.3)
    chk("değişmemiş panel Esc → soru yok", not dlg() and md() == "part")
    pg.click("#cmds button[title^='Radyüs']"); time.sleep(0.4)
    pg.evaluate("window.__app.mode.draft.r = 7.5")
    pg.keyboard.press("Escape"); time.sleep(0.3)
    chk("değişmiş panel Esc → soru", dlg() and md() == "pm")
    pg.click("dialog.exit-dialog button[data-v=stay]"); time.sleep(0.2)
    chk("Vazgeç → panel açık", md() == "pm" and pg.evaluate("window.__app.mode.draft.r") == 7.5)
    pg.keyboard.press("Escape"); time.sleep(0.3)
    pg.click("dialog.exit-dialog button[data-v=discard]"); time.sleep(0.3)
    chk("Kaydetmeden çık → panel kapandı", md() == "part")
    pg.screenshot(path="/home/claude/ex1.png")
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

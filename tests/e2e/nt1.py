# Sağ tık > Dik (Normal To): model yüzü, ikinci kez arka taraf, ağaçta düzlem, grafik alanda düzlem
import cmdpatch, time
from h import *
ok = []
def chk(n, c): ok.append(bool(c)); print(("✓ " if c else "✗ ") + n)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(URL); wait_ready(pg); time.sleep(0.4)
    cam = lambda: pg.evaluate("(()=>{const v=window.__app.viewer;const c=v.camera.position.clone().sub(v.controls.target).normalize();return [c.x,c.y,c.z]})()")
    def ctx(x, y, item):
        pg.mouse.click(x, y, button="right"); time.sleep(0.2)
        n = pg.locator(f".sw-ctx .sw-mi:has-text('{item}')").count()
        if n: pg.click(f".sw-ctx .sw-mi:has-text('{item}')"); time.sleep(0.2)
        return n
    # grafik alanda düzlem (boş belge, izometrik): Üst düzlemin bir köşesi
    pg.evaluate("window.__app.viewer.viewStd('iso')"); time.sleep(0.2)
    r = pg.query_selector("#view").bounding_box()
    sc = lambda w: (lambda q: (r["x"]+q[0], r["y"]+q[1]))(pg.evaluate(f"window.__app.viewer.toScreen({w})"))
    run(pg, "box", [sketch("s1","S",TOP,lambda pt,line,rect,c,t: rect(-50,-30,50,30)), ext("e1","s1",20)])
    pg.evaluate("window.__app.viewer.viewStd('iso')"); time.sleep(0.2)
    chk("üst yüzde Dik", ctx(*sc("[10,20,5]"), "Dik") == 1 and cam()[1] > 0.99)
    chk("sağ tık yüzü seçti", pg.evaluate("window.__app.viewer.mesh && true") and "1 yüz" in (time.sleep(0.4) or pg.inner_text("#sb-sel")))
    pg.mouse.move(r["x"]+400, r["y"]+300)
    chk("ikinci Dik arka taraftan", ctx(*sc("[10,20,5]"), "Dik") == 1 and cam()[1] < -0.99)
    pg.evaluate("window.__app.viewer.viewStd('iso')"); time.sleep(0.2)
    chk("ön yüzde Dik", ctx(*sc("[0,10,30]"), "Dik") == 1 and cam()[2] > 0.99)
    # ağaçta düzlem
    pg.evaluate("window.__app.viewer.viewStd('iso')"); time.sleep(0.2)
    pg.click("#tree li:has-text('Sağ Düzlem')", button="right"); time.sleep(0.2)
    pg.click(".sw-ctx .sw-mi:has-text('Dik')"); time.sleep(0.2)
    chk("ağaçta Sağ Düzlem > Dik", cam()[0] > 0.99)
    # grafik alanda düzlem (model dışında kalan Ön düzlem köşesi)
    pg.evaluate("window.__app.viewer.viewStd('iso')"); time.sleep(0.3)
    pg.keyboard.press("Escape")
    hit = pg.evaluate("(()=>{const v=window.__app.viewer;const r=document.querySelector('#view').getBoundingClientRect();for(let i=0;i<60;i++)for(let j=0;j<40;j++){const x=r.left+i*r.width/60,y=r.top+j*r.height/40;const h=v.pick(x,y,{face:true,plane:true});if(h&&h.kind==='plane'&&h.id==='front')return [x,y]}return null})()")
    chk("grafik alanda Ön Düzlem > Dik", hit and ctx(hit[0], hit[1], "Dik") == 1 and cam()[2] > 0.99)
    print("hatalar:", logs); print("SONUC:", "TAMAM" if all(ok) and not logs else "HATA")

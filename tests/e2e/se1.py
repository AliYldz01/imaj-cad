# Ekstrüzyondan sonra eskizi düzenleme: değişiklik modele ve kayda geçmeli (v0.84)
import cmdpatch
from h import *
import json
ok = True
def chk(n, c, info=""):
    global ok
    ok = ok and bool(c)
    print(("TAMAM " if c else "HATA  ") + n, info)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width": 1400, "height": 900})
    pg.goto(URL); wait_ready(pg); ev = pg.evaluate
    ED = "window.__app.mode.editor"
    def base(dim=True):
        sk = sketch("s1", "Eskiz1", TOP, lambda pt, line, rect, c, t: rect(-40, -30, 40, 30))
        if dim: sk["data"]["dims"] = [{"id": "D1", "t": "dist", "refs": ["p1", "p2"], "v": 80, "sub": "h", "lp": [0, -45]}]
        run(pg, "başlangıç", [sk, ext("e1", "s1", 20)])
    def edit():
        pg.click("#tree li:has-text('e1')"); time.sleep(0.3)
        pg.click("#tree-actions button:has-text('Eskizi düzenle')"); time.sleep(0.8)
    def span():
        m = ev("window.__app.viewer.mesh.bbox"); return round(m["max"][0] - m["min"][0], 3)
    def saved_span():
        d = json.loads(ev("localStorage.getItem('imajcad.doc.v2')"))
        pts = [f for f in d["features"] if f["id"] == "s1"][0]["data"]["pts"]
        return round(pts["p2"]["x"] - pts["p1"]["x"], 3)
    def scr(k):
        return ev("k=>{const e=window.__app.mode.editor,p=e.data.pts[k],f=e.frame;const yv=[f.n[1]*f.x[2]-f.n[2]*f.x[1],f.n[2]*f.x[0]-f.n[0]*f.x[2],f.n[0]*f.x[1]-f.n[1]*f.x[0]];const w=[0,1,2].map(i=>f.o[i]+f.x[i]*p.x+yv[i]*p.y);const s=window.__app.viewer.toScreen(w);const r=document.querySelector('#view canvas').getBoundingClientRect();return [r.left+s[0],r.top+s[1]]}", k)

    # 1) Değiştir kutusuyla ölçü 80 → 100, ✓ → model ve kayıt 100
    base(); edit()
    chk("var olan eskiz Seç aracıyla açılır (SolidWorks)", ev(ED + ".tool") == "select", ev(ED + ".tool"))
    pg.locator(".dim").first.dblclick(); time.sleep(0.3)
    pg.fill(".dim-prompt input", "100"); pg.press(".dim-prompt input", "Enter"); time.sleep(0.4)
    chk("düzenleyici belgeyle aynı veriyi kullanır", ev(ED + ".data === window.__app.doc.features[0].data"))
    pg.click("#pm-ok"); time.sleep(0.5); wait_ready(pg)
    chk("✓ sonrası model 100 mm", abs(span() - 100) < 0.01, span())
    chk("kayıtta 100 mm", abs(saved_span() - 100) < 0.01, saved_span())
    pg.reload(); wait_ready(pg); time.sleep(0.8)
    chk("sayfa yenilenince de 100 mm", abs(span() - 100) < 0.01, span())

    # 2) ⟳ canlı önizleme + ✕ (vazgeç) sonra başka değer → yine belgeye yazılır
    base(); edit()
    pg.locator(".dim").first.dblclick(); time.sleep(0.3)
    pg.fill(".dim-prompt input", "120"); time.sleep(0.2)
    if pg.locator(".dim-prompt .rb").count(): pg.click(".dim-prompt .rb"); time.sleep(0.3)
    pg.click(".dim-prompt .no"); time.sleep(0.3)
    chk("✕ ile değer geri döner", abs(ev(ED + ".data.dims[0].v") - 80) < 1e-6)
    pg.locator(".dim").first.dblclick(); time.sleep(0.3)
    pg.fill(".dim-prompt input", "90"); pg.press(".dim-prompt input", "Enter"); time.sleep(0.3)
    pg.click("#pm-ok"); time.sleep(0.5); wait_ready(pg)
    chk("vazgeçtikten sonraki değişiklik de modele geçer (90)", abs(span() - 90) < 0.01, span())

    # 3) eskizde geri al sonra ✓
    base(); edit()
    pg.locator(".dim").first.dblclick(); time.sleep(0.3)
    pg.fill(".dim-prompt input", "110"); pg.press(".dim-prompt input", "Enter"); time.sleep(0.3)
    pg.locator(".dim").first.dblclick(); time.sleep(0.3)
    pg.fill(".dim-prompt input", "130"); pg.press(".dim-prompt input", "Enter"); time.sleep(0.3)
    pg.keyboard.press("Control+z"); time.sleep(0.3)
    pg.click("#pm-ok"); time.sleep(0.5); wait_ready(pg)
    chk("geri al sonrası ✓ → 110", abs(span() - 110) < 0.01, span())

    # 4) ölçüsüz eskizde köşeyi fareyle sürükle (Seç aracı varsayılan) → model değişir
    base(dim=False); edit()
    x, y = scr("p3")
    pg.mouse.move(x, y); pg.mouse.down(); pg.mouse.move(x + 60, y, steps=8); pg.mouse.up(); time.sleep(0.4)
    moved = ev(ED + ".data.pts.p3.x")
    pg.click("#pm-ok"); time.sleep(0.5); wait_ready(pg)
    mx = ev("window.__app.viewer.mesh.bbox.max[0]")
    chk("sürüklenen köşe modele geçer", moved > 45 and abs(mx - moved) < 0.01, (moved, mx))

    # 5) ✕ → "Kaydet ve çık" yolu (dikdörtgende ilişki yok: yalnız alt kenar uzar, genişlik = en geniş kenar)
    base(); edit()
    pg.locator(".dim").first.dblclick(); time.sleep(0.3)
    pg.fill(".dim-prompt input", "95"); pg.press(".dim-prompt input", "Enter"); time.sleep(0.3)
    pg.click("#pm-cancel"); time.sleep(0.5)
    if pg.locator("dialog.exit-dialog button[data-v='save']").count(): pg.click("dialog.exit-dialog button[data-v='save']"); time.sleep(0.5)
    time.sleep(0.5); wait_ready(pg)
    chk("✕ → Kaydet ve çık → 95", abs(span() - 95) < 0.01, span())
    print("SONUC:", "TAMAM" if ok else "HATA")
    b.close()

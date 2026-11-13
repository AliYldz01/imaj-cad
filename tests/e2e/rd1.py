# Gereksiz ölçü uyarısı: tam tanımlı kareye 3. kenar ölçüsü → uyarı (İptal: eklenmez / Tamam: sürülen); serbest ölçü normal
import cmdpatch, time
from h import *
ok=[]
def chk(n,c,i=""): ok.append(c); print(("TAMAM " if c else "HATA  ")+n, i)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1400,"height":900}); logs=[]
    pg.on("pageerror", lambda e: logs.append(str(e)))
    dlg=[]; mode={"acc":False}
    def ondlg(d): dlg.append(d.message); (d.accept() if mode["acc"] else d.dismiss())
    pg.on("dialog", ondlg)
    pg.goto(URL); wait_ready(pg); time.sleep(0.5)
    pg.click("#tree li:has-text('Ön Düzlem')"); pg.click("#tree-actions button:has-text('Eskiz')"); time.sleep(0.4)
    r = pg.query_selector("#view").bounding_box()
    pg.evaluate("(()=>{const v=window.__app.viewer; v.camera.zoom=0.9; v.camera.updateProjectionMatrix(); v.requestRender();})()")
    def sc(x,y):
        s = pg.evaluate(f"(()=>{{const e=window.__app.mode.editor; const f=e.frame; const yv=[f.n[1]*f.x[2]-f.n[2]*f.x[1], f.n[2]*f.x[0]-f.n[0]*f.x[2], f.n[0]*f.x[1]-f.n[1]*f.x[0]]; const w=[f.o[0]+f.x[0]*{x}+yv[0]*{y}, f.o[1]+f.x[1]*{x}+yv[1]*{y}, f.o[2]+f.x[2]*{x}+yv[2]*{y}]; return window.__app.viewer.toScreen(w);}})()")
        return r["x"]+s[0], r["y"]+s[1]
    ed = "window.__app.mode.editor"
    pg.evaluate(f"{ed}.opts.quickDim=false"); pg.evaluate(f"{ed}.setTool('line')")
    for q in [(0,0),(60,0),(60,60),(0,60),(0,0)]:
        x,y = sc(*q); pg.mouse.move(x,y); pg.mouse.click(x,y); time.sleep(0.15)
    pg.keyboard.press("Escape"); time.sleep(0.1)
    pg.evaluate(f"{ed}.setTool('dim')")
    def dimline(a, lab, val=None):
        pg.mouse.click(*sc(*a)); time.sleep(0.1); pg.mouse.click(*sc(*lab)); time.sleep(0.3)
        if val is not None and pg.locator(".dim-prompt").count():
            pg.fill(".dim-prompt input", str(val)); pg.press(".dim-prompt input","Enter"); time.sleep(0.3)
    dimline((30,0),(30,-10),50)   # alt kenar
    dimline((0,30),(-10,30),40)   # sol kenar
    nd = pg.evaluate(f"{ed}.data.dims.length"); dof = pg.evaluate(f"{ed}.result.dof")
    chk("2 ölçü, tam tanımlı", nd==2 and dof==0, (nd,dof))
    dimline((25,40),(25,52))      # üst kenar → gereksiz
    txt = pg.inner_text("dialog.redund-dlg") if pg.locator("dialog.redund-dlg").count() else ""
    chk("gereksiz ölçü penceresi (3 seçenek)", "Gereksiz" in txt and pg.locator("dialog.redund-dlg button").count()==3, txt)
    pg.click("dialog.redund-dlg button:has-text('Vazgeç')"); time.sleep(0.2)
    chk("Vazgeç: ölçü eklenmedi, değer sorulmadı", pg.evaluate(f"{ed}.data.dims.length")==2 and pg.locator(".dim-prompt").count()==0)
    dimline((25,40),(25,52))
    pg.click("dialog.redund-dlg button:has-text('Sürülen')"); time.sleep(0.3)
    ds = pg.evaluate(f"{ed}.data.dims.map(d=>[!!d.ref, d.v])")
    chk("Tamam: sürülen ölçü 50", len(ds)==3 and ds[2][0] and abs(ds[2][1]-50)<1e-6, ds)
    chk("eskiz hâlâ çözülür ve tam tanımlı", pg.evaluate(f"{ed}.result.ok") and pg.evaluate(f"{ed}.result.dof")==0)
    # sürücü olarak bırak: sağ kenar → aşırı tanımlı
    dimline((50,20),(62,20))
    pg.click("dialog.redund-dlg button:has-text('Sürücü olarak bırak')"); time.sleep(0.3)
    ds = pg.evaluate(f"{ed}.data.dims.map(d=>[!!d.ref, d.v])")
    chk("Sürücü olarak bırak: 4. ölçü sürücü 40", len(ds)==4 and not ds[3][0] and abs(ds[3][1]-40)<1e-6, ds)
    chk("eskiz aşırı tanımlı (gereksiz kısıt işaretli)", pg.evaluate(f"{ed}.result.ok") and len(pg.evaluate(f"{ed}.result.redundant"))>0)
    chk("aşırı tanımlı ölçü kırmızı", pg.locator(".dim.err, .dimlabel.err, .err").count()>0)
    pg.keyboard.press("Control+z"); time.sleep(0.3)
    chk("geri alınca 3 ölçü", pg.evaluate(f"{ed}.data.dims.length")==3)
    # programla eklenen fazla sürücü ölçü de op içinde reddedilir
    okop = pg.evaluate(f"""(()=>{{const e={ed}; const l=e.data.ents.filter(x=>x.t==='line')[1]; return e['op'](()=>e.data.dims.push({{id:'dz',t:'dist',sub:'a',refs:[l.p1,l.p2],v:40,lp:[0,0]}}))}})()""")
    chk("op: fazla sürücü ölçü reddedilir", okop is False and pg.evaluate(f"{ed}.data.dims.length")==3, okop)
    chk("hata yok", not logs, logs)
    print("SONUC:", "TAMAM" if all(ok) else "HATA")

# d10 — TELEFON (390×844) ve TABLET (820×1180): CDP dokunma. Ekran çubuğu, alt tepsi, panel, örtülen düğmeler,
# hareketler, uzun basma, dairesel menü, dosya menüsü, belge sekmeleri, sesle sayı (SpeechRecognition sahte — hazır ortam)
import sys; sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d10h import *

SR_MOCK = r"""
window.__srText='elli';
window.SpeechRecognition=class{constructor(){this.lang='';}start(){setTimeout(()=>{const alt={transcript:window.__srText};const res=[alt];res.length=1;this.onresult&&this.onresult({results:[res]});this.onend&&this.onend()},120)}stop(){}abort(){}};
"""

COVER_JS = r"""(sels)=>{const out=[];for(const s of sels){for(const b of document.querySelectorAll(s)){if(!b.offsetParent&&getComputedStyle(b).position!=='fixed')continue;const r=b.getBoundingClientRect();if(r.width<2||r.height<2)continue;
 const x=r.left+r.width/2,y=r.top+r.height/2;const scr=(()=>{for(let p=b.parentElement;p;p=p.parentElement){const cs=getComputedStyle(p);if(/(auto|scroll)/.test(cs.overflowX)&&p.scrollWidth>p.clientWidth+2)return true}return false})();
 if(x<0||y<0||x>innerWidth||y>innerHeight||(x>innerWidth-4)){if(!scr)out.push([s,(b.title||b.textContent).trim().slice(0,18),'ekran dışı (kaydırılamaz)',Math.round(x),Math.round(y)]);continue}
 const e=document.elementFromPoint(x,y);if(scr&&(!e||e.id==='tray'||e.closest&&e.closest('#tray')))continue;if(!e||!(e===b||b.contains(e)||e.contains(b))){out.push([s,(b.title||b.textContent).trim().slice(0,18),e?(e.id||e.className||e.tagName).toString().slice(0,30):'yok',Math.round(x),Math.round(y)])}
 if(r.width<32||r.height<32)out.push([s,(b.title||b.textContent).trim().slice(0,18),'küçük '+Math.round(r.width)+'×'+Math.round(r.height)])}}return out}"""
SELS = [".actbar button", "#tray button", "#pm-ok", "#pm-cancel", "#globals button", "#tabs button", "#viewbar button", ".vcube .iso", "#doctabs .dtab span", "#doctabs .dtab-x", "#doctabs .dtab-add", "#side-close", ".sheet-min"]


def covered(a, label):
    r = a.ev(COVER_JS, SELS)
    hard = [x for x in r if not str(x[2]).startswith("küçük")]
    small = [x for x in r if str(x[2]).startswith("küçük")]
    note(f"[{label}] örtülen/ekran dışı: {hard}")
    if small:
        note(f"[{label}] küçük (<32px) hedef: {len(small)} → {small[:6]}")
    return hard


def tap_el(a, sel, i=0):
    bb = a.pg.locator(sel).nth(i).bounding_box()
    a.tap(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2)


def run(p, tablet=False):
    tag = "tablet" if tablet else "telefon"
    a = App(p, mobile=not tablet, tablet=tablet)
    a.pg.add_init_script(SR_MOCK)
    a.pg.reload(); wait_ready(a.pg); time.sleep(0.8)
    a.setup(block())
    vr = a.ev("(()=>{const r=document.querySelector('#view canvas').getBoundingClientRect();return [r.left,r.top,r.width,r.height]})()")
    cx, cy = vr[0] + vr[2] / 2, vr[1] + vr[3] * 0.4
    # parmak profili: ilk dokunuş
    a.tap(cx, cy)
    acts = a.pg.locator(".actbar button").evaluate_all("els=>els.map(e=>e.title)")
    note(f"[{tag}] ekran çubuğu (parça):", acts)
    chk(f"[{tag}] ekran çubuğu görünür", len(acts) >= 6, acts)
    tray = a.pg.locator("#tray button").count()
    chk(f"[{tag}] alt komut tepsisi var ({tray} düğme)", tray > 5 if not tablet else True, tray)
    hard = covered(a, tag + " parça")
    chk(f"[{tag}] parça modunda örtülen düğme yok", not hard, hard)

    # mini çubuk telefonda kendiliğinden kapanıyor mu
    time.sleep(6)
    mb = a.pg.locator(".minibar").count()
    note(f"[{tag}] modele dokunduktan 6 sn sonra bağlam mini çubuğu açık:", mb)
    chk(f"[{tag}] dokunmatik: bağlam mini çubuğu ekran çubuğunu örtmez / kendiliğinden kapanır", mb == 0 or not covered(a, tag + " mini çubuk"), mb)
    a.tap(vr[0] + 15, vr[1] + vr[3] - 15); time.sleep(0.3)
    # ---- ekran çubuğu düğmeleri tek tek (parça)
    a.btn(".actbar button[title='Seçim filtresi']")
    chk(f"[{tag}] çubuk › Tümü → Yüz", a.pg.locator(".actbar button[title='Seçim filtresi']").inner_text() == "Yüz")
    a.btn(".actbar button[title='Seçim filtresi']"); a.btn(".actbar button[title='Seçim filtresi']")
    a.btn(".actbar button[title='Şekil sihirbazı']")
    chk(f"[{tag}] çubuk › ✚ sihirbaz", len(a.dialogs_open()) == 1, a.dialogs_open())
    a.close_dialogs()
    a.btn(".actbar button[title^='Ctrl']")
    chk(f"[{tag}] çubuk › Ctrl açık", "on" in (a.pg.locator(".actbar button[title^='Ctrl']").get_attribute("class") or ""))
    a.btn(".actbar button[title^='Ctrl']")
    a.btn(".actbar button[title='Araç menüsü']")
    rad = a.pg.locator(".sw-radial .sw-rb").count()
    rb = a.pg.locator(".sw-radial .sw-rb").all_inner_texts()
    chk(f"[{tag}] çubuk › ☰ dairesel menü", rad >= 4, rb)
    if rad:
        tap_el(a, ".sw-radial .sw-rb:has-text('Radyüs')") if a.pg.locator(".sw-radial .sw-rb:has-text('Radyüs')").count() else tap_el(a, ".sw-radial .sw-rb")
        a.wait(0.4)
        note(f"[{tag}] dairesel menü öğesi →", a.mode(), a.pg.inner_text("#pm-title") if a.mode() == "pm" else a.toast())
        if a.mode() == "pm":
            tap_el(a, "#pm-cancel"); a.wait(0.4)
    # kırıntı çubuğu görünüm küpünü örtüyor mu (yüz seçiliyken)
    fc0 = a.ev("(()=>{const m=window.__app.viewer.mesh;return m.faces.find(f=>f.n&&f.n[1]>0.99).c})()")
    a.tap(*a.wsc(fc0)); time.sleep(0.8)
    cubecov = a.ev("""(()=>{const out={};for(const f of document.querySelectorAll('.vcube .cell.c')){const r=f.getBoundingClientRect();if(r.width<3)continue;const e=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);out[f.textContent]=e?(e.classList.contains('cell')?'ok':(e.id||e.className)):'yok'}return out})()""")
    note(f"[{tag}] yüz seçiliyken küp yüz hücreleri (orta):", cubecov)
    chk(f"[{tag}] kırıntı / mini çubuk görünüm küpünü örtmez", all(v == "ok" for v in cubecov.values()), cubecov)
    a.tap(vr[0] + 20, vr[1] + vr[3] - 30); time.sleep(0.3)
    z0 = a.cam()["zoom"]; a.btn(".actbar button[title='Ekrana sığdır']")
    chk(f"[{tag}] çubuk › ⤢ sığdır", a.cam()["zoom"] > 0)
    # ↶ ↷ (değişiklik sonrası)
    a.edit_feat("Ekstrüzyon1"); a.pmfield("Derinlik", 30)
    hard = covered(a, tag + " PM açık")
    chk(f"[{tag}] PM açıkken örtülen düğme yok", not hard, hard)
    tr_vis = a.ev("(()=>{const t=document.getElementById('tray');return !!t&&t.offsetHeight>0&&getComputedStyle(t).display!=='none'})()")
    note(f"[{tag}] PM açıkken tepsi görünür:", tr_vis)
    # sesle sayı: Derinlik alanına odaklan → 🎤 (SpeechRecognition sahte: "elli")
    if a.pg.locator(".actbar button[title='Sesle ölçü gir']").count():
        a.pg.locator("#pm-body label.pm-field:has-text('Derinlik') input").first.tap(); time.sleep(0.3)
        a.ev("window.__srText='elli'")
        a.pg.locator(".actbar button[title='Sesle ölçü gir']").scroll_into_view_if_needed()
        tap_el(a, ".actbar button[title='Sesle ölçü gir']"); time.sleep(1.0)
        vv = a.pg.locator("#pm-body label.pm-field:has-text('Derinlik') input").first.input_value()
        chk(f"[{tag}] sesle 'elli' → Derinlik 50", vv.startswith("50"), vv)
        a.pmfield("Derinlik", 30)
    tap_el(a, "#pm-ok"); a.wait(0.8)
    chk(f"[{tag}] PM ✓ dokunmayla → 30", a.featv("Ekstrüzyon1", "d1") == 30, a.featv("Ekstrüzyon1", "d1"))
    a.btn(".actbar button[title='Geri al']"); a.wait(0.8)
    chk(f"[{tag}] çubuk › ↶ → 20", a.featv("Ekstrüzyon1", "d1") == 20, a.featv("Ekstrüzyon1", "d1"))
    a.btn(".actbar button[title='İleri al']"); a.wait(0.8)
    chk(f"[{tag}] çubuk › ↷ → 30", a.featv("Ekstrüzyon1", "d1") == 30, a.featv("Ekstrüzyon1", "d1"))
    # 2 / 3 parmak dokunuşu
    a.touch("touchStart", [(cx - 40, cy), (cx + 40, cy)]); time.sleep(0.05); a.touch("touchEnd", []); a.wait(0.8)
    chk(f"[{tag}] 2 parmak dokunuşu geri al → 20", a.featv("Ekstrüzyon1", "d1") == 20, a.featv("Ekstrüzyon1", "d1"))
    a.touch("touchStart", [(cx - 60, cy), (cx, cy), (cx + 60, cy)]); time.sleep(0.05); a.touch("touchEnd", []); a.wait(0.8)
    chk(f"[{tag}] 3 parmak dokunuşu ileri al → 30", a.featv("Ekstrüzyon1", "d1") == 30, a.featv("Ekstrüzyon1", "d1"))
    # hareketler
    a.btn(".vcube .iso") if a.pg.locator(".vcube .iso").count() else None
    a.btn(".actbar button[title='Ekrana sığdır']")
    d0 = a.cam()["dir"]
    a.tdrag((cx, cy), (cx + 100, cy), steps=12)
    d1 = a.cam()["dir"]
    ang = math.degrees(math.acos(max(-1, min(1, sum(d0[i] * d1[i] for i in range(3))))))
    chk(f"[{tag}] tek parmak döndürme 100 px ≈ 45.8°", near(ang, 45.8, 3), round(ang, 1))
    z0 = a.cam()["zoom"]
    a.touch("touchStart", [(cx - 50, cy), (cx + 50, cy)])
    for i in range(1, 11):
        a.touch("touchMove", [(cx - 50 - 5 * i, cy), (cx + 50 + 5 * i, cy)]); time.sleep(0.02)
    a.touch("touchEnd", []); time.sleep(0.3)
    chk(f"[{tag}] iki parmak açma ×2", near(a.cam()["zoom"] / z0, 2.0, 0.1), round(a.cam()["zoom"] / z0, 3))
    t0 = a.cam()["t"]
    a.touch("touchStart", [(cx - 60, cy), (cx + 60, cy)])
    for i in range(1, 11):
        a.touch("touchMove", [(cx - 60, cy + 6 * i), (cx + 60, cy + 6 * i)]); time.sleep(0.02)
    a.touch("touchEnd", []); time.sleep(0.3)
    chk(f"[{tag}] iki parmak kaydırma", a.cam()["t"] != t0, (t0, a.cam()["t"]))
    # uzun basma menüsü
    a.btn(".actbar button[title='Ekrana sığdır']")
    fc = a.ev("(()=>{const m=window.__app.viewer.mesh;return m.faces.find(f=>f.n&&f.n[1]>0.99).c})()")
    fx, fy = a.wsc(fc)
    a.longpress(fx, fy)
    lp = a.pg.locator(".sw-ctx .sw-mi").all_inner_texts()
    note(f"[{tag}] uzun basma (üst yüz):", lp)
    chk(f"[{tag}] uzun basma menüsü açılır", len(lp) >= 3, lp)
    if a.pg.locator(".sw-ctx .sw-mi:has-text('Eskiz')").count():
        tap_el(a, ".sw-ctx .sw-mi:has-text('Eskiz')"); a.wait(0.6)
        chk(f"[{tag}] uzun basma › Eskiz → eskiz", a.mode() == "sketch", a.mode())
    else:
        a.tap(vr[0] + 10, vr[1] + vr[3] - 20)
    if a.mode() == "sketch":
        acts = a.pg.locator(".actbar button").evaluate_all("els=>els.map(e=>e.title)")
        note(f"[{tag}] ekran çubuğu (eskiz):", acts)
        hard = covered(a, tag + " eskiz")
        chk(f"[{tag}] eskizde örtülen düğme yok (A-3)", not hard, hard)
        tray_vis = a.ev("(()=>{const t=document.getElementById('tray');return !!t&&t.offsetHeight>0})()")
        chk(f"[{tag}] eskizde komut tepsisi görünür", tray_vis)
        # tepsiden Dikdörtgen
        if a.pg.locator("#tray button[title='Dikdörtgen']").count():
            a.pg.locator("#tray button[title='Dikdörtgen']").scroll_into_view_if_needed()
            tap_el(a, "#tray button[title='Dikdörtgen']")
            chk(f"[{tag}] tepsi › Dikdörtgen aracı", a.ed("return e.tool") == "rect", a.ed("return e.tool"))
            # 123 ile sayıyla gir
            if a.pg.locator(".actbar button[title='Sayıyla gir']").count():
                a.btn(".actbar button[title='Sayıyla gir']")
                chk(f"[{tag}] 123 → sayı kutusu", a.pg.locator(".dim-prompt").count() == 1)
                ins = a.pg.locator(".dim-prompt input")
                note(f"[{tag}] 123 kutusu alanları:", ins.count(), a.pg.inner_text(".dim-prompt")[:80].replace("\n", " | "))
                if ins.count() >= 2:
                    ins.nth(0).fill("30"); ins.nth(1).fill("40"); ins.nth(1).press("Enter"); time.sleep(0.6)
                    note(f"[{tag}] 123 (köşe X/Y) sonrası öğe sayısı:", a.ed("return d.ents.length"), a.pg.inner_text(".dim-prompt")[:60].replace("\n", " | ") if a.pg.locator(".dim-prompt").count() else "")
                if a.pg.locator(".dim-prompt").count():
                    a.pg.keyboard.press("Escape")
        a.btn(".actbar button[title='Eskizden çık']") if a.pg.locator(".actbar button[title='Eskizden çık']").count() else a.btn(".actbar button.ok")
        a.wait(0.6)
        if a.mode() == "sketch":
            a.btn("#pm-cancel"); time.sleep(0.4)
            if a.pg.locator("dialog.exit-dialog[open]").count():
                a.btn("dialog.exit-dialog[open] button[data-v='discard']")
        a.wait(0.5)
    # dosya menüsü (☰ / Dosya)
    a.btn("#file-btn")
    fm = a.ev("(()=>{const m=document.querySelector('#file-menu');const r=m.getBoundingClientRect();return [!m.hidden,Math.round(r.top),Math.round(r.bottom),innerHeight,m.scrollHeight>m.clientHeight]})()")
    note(f"[{tag}] dosya menüsü (açık, üst, alt, ekran yüksekliği, kaydırmalı):", fm)
    bad = a.ev("""(()=>{const out=[];for(const b of document.querySelectorAll('#file-menu button')){const r=b.getBoundingClientRect();const e=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);if(!(e===b||b.contains(e)))out.push(b.textContent.trim().slice(0,20))}return out})()""")
    chk(f"[{tag}] dosya menüsünün tüm öğeleri ekranda ya da menü kaydırılabilir", not bad or fm[4], bad)
    a.btn("#file-menu button[data-act='docprops']")
    chk(f"[{tag}] dosya › Belge özellikleri", a.pg.locator("dialog.docprops[open]").count() == 1)
    dd = a.ev("(()=>{const d=document.querySelector('dialog[open]');const r=d.getBoundingClientRect();return [r.left,r.top,r.right,r.bottom,innerWidth,innerHeight]})()")
    chk(f"[{tag}] pencere ekrana sığar", dd[0] >= 0 and dd[2] <= dd[4] + 1 and dd[1] >= 0, dd)
    a.close_dialogs()
    # Kaydet (indirme / paylaşım)
    a.dq[:] = ["Tel"]
    try:
        nm, data = a.download(lambda: (a.btn("#file-btn"), a.btn("#file-menu button[data-act='save']")), timeout=20000)
        chk(f"[{tag}] dosya › Kaydet indirir", nm == "Tel.icad" and len(json.loads(data)["features"]) == 2, nm)
    except Exception as e:
        chk(f"[{tag}] dosya › Kaydet indirir", False, str(e)[:80])
    # Yeni → belge sekmeleri
    a.btn("#file-btn"); a.btn("#file-menu button[data-act='new']")
    tabs = a.tabs()
    chk(f"[{tag}] Yeni → 2 belge sekmesi", len(tabs) == 2, tabs)
    hard = covered(a, tag + " 2 sekme")
    chk(f"[{tag}] belge sekmeleri ve görünüm çubuğu örtülmez", not hard, hard)
    tap_el(a, "#doctabs .dtab:nth-child(1) span"); a.wait(0.8)
    chk(f"[{tag}] dokunmayla 1. sekmeye dönüş", a.docname() == "Tel" and near(a.vol(), 144000, 1), (a.docname(), a.vol()))
    # ağaç paneli (telefonda alt sayfa)
    a.show_tree()
    hard = covered(a, tag + " ağaç açık")
    chk(f"[{tag}] ağaç açıkken örtülen düğme yok", not hard, hard)
    a.btn("#side-close") if a.pg.locator("#side-close").is_visible() else None
    # Şeridi özelleştir / görev bölmesi / görüntü stili erişimi
    fm_txt = a.pg.locator("#file-menu button").all_inner_texts()
    chk(f"[{tag}] Görüntü stili (Saydam) dokunarak erişilebilir (A-1)", any("stil" in t.lower() for t in fm_txt) or a.ev("[...document.querySelectorAll('#viewbar button')].some(b=>b.title.startsWith('Görüntü stili')&&b.offsetParent)"))
    # montaj
    a.btn("#tabs button[data-tab='asm']"); a.wait(0.5)
    if a.pg.locator("#cmds button[title='Montajı Aç'], #tray button[title='Montajı Aç']").count():
        sel = "#tray button[title='Montajı Aç']" if a.pg.locator("#tray button[title='Montajı Aç']").count() else "#cmds button[title='Montajı Aç']"
        tap_el(a, sel); a.wait(1.5)
        hard = covered(a, tag + " montaj")
        chk(f"[{tag}] montajda örtülen düğme yok", not hard, hard)
        sel = "#tray button[title='Parçaya Dön']" if a.pg.locator("#tray button[title='Parçaya Dön']").count() else "#cmds button[title='Parçaya Dön']"
        if a.pg.locator(sel).count():
            a.pg.locator(sel).scroll_into_view_if_needed(); tap_el(a, sel); a.wait(0.8)
    print(f"[{tag}] hatalar:", a.errs[:5])
    a.close()


with sync_playwright() as p:
    if want("telefon"):
        run(p, tablet=False)
    if want("tablet"):
        run(p, tablet=True)
finish()

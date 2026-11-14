# d10 — DİĞER: ilk açılış rehberi (webdriver gizlenerek), giriş ayarları kalıcılığı, F1, PM açıkken dosya komutları,
# masaüstünde belge sekmeleri ile görünüm çubuğu çakışması, Delete ile yüz seçiliyken silme
import sys; sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d10h import *

with sync_playwright() as p:
    if want("rehber"):
        a = App(p)
        a.pg.add_init_script("Object.defineProperty(navigator,'webdriver',{get:()=>false})")
        a.pg.evaluate("localStorage.clear()"); a.pg.reload(); wait_ready(a.pg); time.sleep(1.5)
        dl = a.dialogs_open()
        chk("ilk açılışta başlangıç rehberi açılır", len(dl) == 1, dl)
        a.btn("dialog[open] button:has-text('Fare ve klavye')")
        a.btn("dialog[open] button:text-is('Başla')")
        a.pg.reload(); wait_ready(a.pg); time.sleep(1.5)
        chk("ikinci açılışta rehber açılmaz", not a.dialogs_open(), a.dialogs_open())
        chk("rehberde seçilen profil kalıcı (mouse)", json.loads(a.ls("imajcad.input") or "{}").get("profile") == "mouse", a.ls("imajcad.input"))
        # giriş ayarları penceresi
        a.menu("Araçlar", "Kalem ve dokunmatik ayarları…")
        txt = a.pg.inner_text("dialog[open]")
        note("giriş ayarları:", txt[:200].replace("\n", " | "))
        rad = a.pg.locator("dialog[open] input[type=radio]")
        note("profil seçenekleri:", rad.count())
        a.pg.locator("dialog[open] label.prof:has-text('Yalnız parmak') input[type=radio]").first.click(); time.sleep(0.3)
        a.close_dialogs()
        a.reload()
        chk("giriş ayarı (parmak) yenilemede kalıcı", json.loads(a.ls("imajcad.input") or "{}").get("profile") == "finger", a.ls("imajcad.input"))
        a.ev("localStorage.setItem('imajcad.input', JSON.stringify({profile:'mouse'}))")
        a.press("F1")
        chk("F1 yardım", "help" in a.dialogs_open(), a.dialogs_open())
        a.press("Escape")
        chk("Esc yardımı kapatır", not a.dialogs_open(), a.dialogs_open())
        a.close()

    if want("pmdosya"):
        a = App(p)
        a.setup(block())
        for lab, fn in [("Yeni parça (menü)", lambda: a.menu("Dosya", "Yeni parça")), ("STEP dışa aktar", lambda: a.menu("Dosya", "STEP dışa aktar")),
                        ("Son belgeler", lambda: a.menu("Dosya", "Son belgeler…")), ("Belge özellikleri", lambda: a.filemenu("docprops")), ("Ctrl+S", lambda: a.pg.keyboard.press("Control+s"))]:
            a.edit_feat("Ekstrüzyon1"); a.pmfield("Derinlik", 33)
            a.dq[:] = ["Z"]
            n0 = len(a.dlog)
            try:
                with a.pg.expect_download(timeout=5000):
                    fn()
            except Exception:
                pass
            time.sleep(0.5)
            asked = a.pg.locator("dialog.exit-dialog[open]").count() > 0
            st = (a.mode(), a.featv("Ekstrüzyon1", "d1"), asked)
            note(f"PM açık + değişmiş, {lab}: mod / d1 / soruldu mu →", st)
            chk(f"PM'de kaydedilmemiş değişiklik '{lab}' ile uyarısız kaybolmaz", st[0] == "pm" or st[1] == 33 or asked, st)
            a.close_dialogs()
            if a.mode() == "pm":
                a.btn("#pm-cancel"); time.sleep(0.3)
                if a.pg.locator("dialog.exit-dialog[open]").count():
                    a.btn("dialog.exit-dialog[open] button[data-v='discard']")
            if len(a.tabs()) > 1:
                a.btn("#doctabs .dtab:nth-child(1) span"); a.wait(0.6)
        a.close()

    if want("sekmecubuk"):
        a = App(p)
        a.setup(block())
        a.menu("Dosya", "Yeni parça")
        r = a.ev("""(()=>{const out=[];for(const b of document.querySelectorAll('#viewbar button, .vcube .iso, #crumbs .crumb')){if(!b.offsetParent)continue;const q=b.getBoundingClientRect();const e=document.elementFromPoint(q.left+q.width/2,q.top+q.height/2);if(!(e===b||b.contains(e)))out.push([(b.title||b.textContent).slice(0,20),e?(e.id||e.className):''])}return out})()""")
        chk("masaüstü: belge sekmeleri görünüm çubuğunu örtmez", not r, r)
        a.close()

    if want("delete"):
        a = App(p)
        a.setup(block())
        a.pg.keyboard.press("Control+7"); a.press("f")
        a.face_click("f=>f.n&&f.n[1]>0.99")
        a.dq[:] = [False, False]
        n0 = len(a.dlog)
        a.press("Delete"); a.wait(0.5)
        note("yüz seçiliyken Delete → pencereler:", a.dlog[n0:], "özellikler:", a.names(), a.toast())
        chk("yüz seçiliyken Delete: onay sorulmadan silmez", a.nfeat() == 2 or len(a.dlog) > n0, (a.dlog[n0:], a.names()))
        a.close()
    if want("globals"):
        a = App(p)
        a.setup(block())
        g = a.pg.locator("#globals button").evaluate_all("els=>els.map(e=>[e.id,e.title,!!e.offsetParent])")
        note("standart araç çubuğu:", g)
        a.edit_feat("Ekstrüzyon1"); a.pmfield("Derinlik", 30); a.ok()
        a.btn("#undo"); a.wait(0.6)
        chk("araç çubuğu ↶", a.featv("Ekstrüzyon1", "d1") == 20)
        a.btn("#redo"); a.wait(0.6)
        chk("araç çubuğu ↷", a.featv("Ekstrüzyon1", "d1") == 30)
        h0 = a.ev("document.querySelector('#side').hidden")
        a.btn("#tree-btn")
        h1 = a.ev("document.querySelector('#side').hidden")
        note("ağaç düğmesi: gizli", h0, "→", h1, a.ev("document.querySelector('#side').className"))
        chk("araç çubuğu › ağaç düğmesi ağacı gizler/gösterir", h0 != h1 or a.ev("document.querySelector('#tree-panel').offsetParent===null"), (h0, h1))
        a.btn("#tree-btn")
        a.btn("#help-btn")
        chk("araç çubuğu › yardım", "help" in a.dialogs_open(), a.dialogs_open())
        a.close_dialogs()
        a.btn("#file-btn")
        chk("araç çubuğu › Dosya listesi", a.ev("!document.querySelector('#file-menu').hidden"))
        a.btn("#file-menu button[data-act='persp']")
        chk("Dosya listesi › Perspektif / ortografik", a.cam()["persp"])
        a.btn("#file-btn"); a.btn("#file-menu button[data-act='persp']")
        a.btn("#file-btn"); a.btn("#file-menu button[data-act='keys']")
        chk("Dosya listesi › Klavye ve fare kısayolları", len(a.dialogs_open()) == 1, a.dialogs_open())
        a.close_dialogs()
        a.btn("#file-btn")
        off = a.ev("(()=>{const m=document.querySelector('#file-menu');if(m.getBoundingClientRect().bottom<=innerHeight+1&&m.scrollHeight>=m.clientHeight)return [];return [...m.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().bottom>innerHeight).map(b=>b.textContent.trim())})()")  # liste ekranda; taşan öğeler kaydırılarak erişilir (D10-8)
        chk("masaüstü 1400×900: Dosya listesinin tüm öğeleri ekranda", not off, off)
        a.ev("document.querySelector('#file-menu').hidden=true")
        a.btn("#sb-units")
        note("durum çubuğu birim (MMGS) tıklama → birim:", a.ls("imajcad.units"), a.toast())
        a.close()
finish()

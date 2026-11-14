# d8 — telefon (390×844, is_mobile, has_touch, CDP dokunma): Yapı Elemanı, Kesim Listesi + Özellikler, Uç Kapağı (yüze dokun),
# Kırp / Uzat (elemanlara dokun), Ölç, Mukavemet penceresi, Statik Analiz (yüzlere dokun → sabitle / yük → çöz), ↶ ↷.
# Hazır model: 3B iskelet / blok (setDoc). Kullanıcı adımları dokunma.
import sys, re; sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d8h import *

FR = [("k1", l) for l in ["l1", "l2", "l3", "l4"]]


def tapw(a, w):
    s = a.wsc(w)
    hit = a.ev("([x,y])=>{const e=document.elementFromPoint(x,y);return e?(e.tagName+'.'+e.className).slice(0,40):null}", s)
    a.tap(s[0], s[1])
    return hit


def fit(a):
    a.pg.locator("#viewbar button[title='Ekrana sığdır']").first.tap() if a.pg.locator("#viewbar button[title='Ekrana sığdır']").count() else None
    time.sleep(0.5)


def inview(a, sel):
    return a.ev("""s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return r.top>=0&&r.left>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1}""", sel)


with sync_playwright() as p:
    a = App(p, mobile=True)
    if want("M1"):
        a.setup([s3_frame()]); a.wait(1)
        a.tsel("3B Çerçeve")
        if a.ev("document.querySelector('#side').classList.contains('open')"):
            a.pg.locator("#tree-btn").tap(); time.sleep(0.4)
        tab(a, "weld"); a.cmd("Yapı Elemanı"); a.wait(1)
        chk("M1 telefonda Yapı Elemanı PM, 4 segment", a.mode() == "pm" and "Grup 1 (4)" in a.pmtext(), a.mode())
        chk("M1 ✓ düğmesi ekranda", inview(a, "#pm-ok"), None)
        a.ok(); a.wait(1.5)
        chk("M1 4 eleman 640/440", sorted(set(c[2] for c in cl_api(a))) == [440, 640])
        # ---------- M2: Kesim listesi + Özellikler
        rows = cutlist_open(a)
        chk("M2 telefonda kesim listesi 2 kalem", rows and len(rows) == 2, rows)
        chk("M2 pencere ekrana sığar (genişlik)", a.ev("(()=>{const r=document.querySelector('dialog.cut-dialog[open]').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1})()"))
        btn = "dialog.cut-dialog[open] table.cut-table >> nth=0 >> tr >> nth=1 >> button:has-text('Özellikler')"
        a.pg.locator(btn).scroll_into_view_if_needed(); a.btn(btn)
        a.pg.wait_for_selector("dialog.cutprops[open]")
        a.pg.locator("dialog.cutprops[open] label.pm-field:has-text('TANIM') input").tap()
        a.pg.fill("dialog.cutprops[open] label.pm-field:has-text('TANIM') input", "Üst kiriş")
        a.btn("dialog.cutprops[open] button:has-text('Tamam')"); time.sleep(1.5)
        rows = cutlist_rows(a)
        chk("M2 telefonda tanım kaydedildi", rows and any("Üst kiriş" in r[2] for r in rows), rows)
        cutlist_close(a)
        # ---------- M3: Kırp / Uzat yok; Köşe takviyesi dokunarak
        iso(a); fit(a)
        tab(a, "weld"); a.cmd("Köşe Takviyesi"); a.wait(0.4)
        h1 = tapw(a, [200, 20, 0]); h2 = tapw(a, [20, 200, 0]); a.wait(0.4)
        note("M3 dokunulan öğeler", h1, h2)
        if not a.ev("!!(window.__app.mode.draft.f1&&window.__app.mode.draft.f2)") and a.pg.locator("#pm .sheet-min").count():
            # kullanıcı paneli küçültür (▾) ve yeniden dokunur
            a.pg.locator("#pm .sheet-min").tap(); time.sleep(0.5)
            h1 = tapw(a, [200, 20, 0]); h2 = tapw(a, [20, 200, 0]); a.wait(0.4)
            note("M3 panel küçültülünce", h1, h2)
        ok3 = a.ev("!!(window.__app.mode.draft.f1&&window.__app.mode.draft.f2)")
        chk("M3 telefonda iki iç yüze dokunarak köşe takviyesi yüzleri seçilir", ok3, (h1, h2))
        if ok3:
            V0 = a.vol(); a.ok(); a.wait(1.2)
            chk("M3 takviye eklendi", any(c[0] != "member" for c in cl_api(a)))
        else:
            a.cancel("discard")
        a.pg.locator("#undo").tap(); a.wait(1)
        chk("M3 ↶ → takviye geri alındı", all(c[0] == "member" for c in cl_api(a)))
    if want("M4"):
        # ---------- M4: Uç kapağı (uç yüze dokun) + Ölç
        one = {"id": "k3", "type": "sketch3d", "name": "Tek", "ids": ["a", "b"], "xyz": [[0, 0, 0], [0, 300, 0]],
               "lines": [{"id": "n1", "a": "a", "b": "b", "ax": "y"}], "r": 0, "seq": 5}
        a.setup([one, mem("m1", [("k3", "n1")], name="Dikme-YE", corner="none")]); a.wait(1.2); iso(a); fit(a)
        tab(a, "weld"); a.cmd("Uç Kapağı"); a.wait(0.4)
        h = tapw(a, [18.5, 300, 0]); a.wait(0.4)
        nf = a.ev("window.__app.mode.draft.faces.length")
        chk("M4 telefonda uç yüze dokun → 1 yüz", nf == 1, (nf, h))
        if nf: a.ok(); a.wait(1)
        else: a.cancel("discard")
        chk("M4 kapak 305'te", abs(a.bbox()[1][1] - 305) < 0.1, a.bbox())
        tab(a, "evaluate"); a.cmd("Ölç"); a.wait(0.3)
        h = tapw(a, [0, 305, 0]); time.sleep(1.0)
        t = a.pg.inner_text("#pm-body") if a.pg.locator("#pm-body .pm-result").count() else ""
        chk("M4 telefonda Ölç: kapak üst yüz alanı", "Yüz alanı" in t, (t[-120:], h))
        a.btn("#pm-cancel"); time.sleep(0.4)
    if want("M5"):
        # ---------- M5: Mukavemet penceresi + Statik Analiz dokunarak
        sk = rect_sk("s1", "Kesit", FRONT, -5, 0, 5, 10); e = ext("e1", "s1", 100); e["name"] = "Kiriş"
        a.setup([sk, e]); a.wait(1); iso(a); fit(a)
        tab(a, "evaluate"); a.cmd("Mukavemet")
        a.pg.wait_for_selector("dialog.analysis-dialog[open]")
        r = a.ev("document.querySelector('dialog.analysis-dialog').__res")
        chk("M5 telefonda Mukavemet: L 100, I 833,3", abs(r["L"] - 100) < 0.5 and abs(r["I"] - 833.33) < 1, r)
        chk("M5 pencere ekrana sığar", a.ev("(()=>{const r=document.querySelector('dialog.analysis-dialog[open]').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.height<=innerHeight})()"))
        a.btn("dialog.analysis-dialog[open] button:has-text('Kapat')")
        a.cmd("Statik Analiz"); time.sleep(0.6)
        chk("M5 SEA paneli açık", a.pg.locator(".fea-panel").count() == 1)
        pr = a.ev("(()=>{const r=document.querySelector('.fea-panel').getBoundingClientRect();return [r.left,r.top,r.right,r.bottom,innerWidth,innerHeight]})()")
        note("M5 panel kutusu", pr)
        h1 = tapw(a, [0, 5, 100]); time.sleep(0.4)
        nsel = a.ev("(()=>{try{return window.__app.psel? window.__app.psel.faces.size: null}catch(e){return null}})()")
        a.pg.locator(".fea-panel button:has-text('Seçili yüzleri sabitle')").tap(); time.sleep(0.4)
        fx = a.ev("(window.__app.doc.fea||{fix:[]}).fix.length")
        chk("M5 telefonda uç yüze dokun → Sabitle (1 yüz)", fx == 1, (fx, h1, nsel))
        h2 = tapw(a, [0, 10, 50]); time.sleep(0.4)
        a.pg.locator(".fea-panel button:has-text('Seçili yüzlere yük ekle')").tap(); time.sleep(0.4)
        ld = a.ev("(window.__app.doc.fea||{loads:[]}).loads.length")
        chk("M5 üst yüze dokun → yük (1)", ld == 1, (ld, h2))
        if fx and ld:
            a.pg.locator(".fea-panel button:has-text('▶ Çöz')").tap()
            for _ in range(120):
                time.sleep(1)
                if "von Mises" in a.ev("document.querySelector('.fea-panel').textContent"): break
            m = re.search(r"En büyük yer değiştirme:\s*([\d.,]+)", a.ev("document.querySelector('.fea-panel').textContent"))
            u = num(m.group(1)) if m else None
            dU = 1000 * 100 ** 3 / (8 * 210000 * 833.33)
            chk("M5 telefonda çözüm: δ ≈ wL³/8EI (1000 N)", u and abs(u - dU) < 0.08 * dU, (u, dU))
        a.pg.locator(".fea-panel button:has-text('Kapat')").tap(); time.sleep(0.3)
    chk("konsol hatası yok", not a.errs, a.errs[:5])
    a.close()
finish()

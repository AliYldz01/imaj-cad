# d8 — Statik Analiz (SEA) yaşam döngüsü, yalnız gerçek tıklama: yüz seç → Sabitle → yük ekle (F / Fn / p) → ▶ Çöz → sonuç ↔ analitik;
# Ctrl+Z / Ctrl+Y sonuç geçersiz mi; model değişince (ekstrüzyon 100 → 150, aynı topoloji) sonuç geçersiz / referanslar izliyor mu;
# malzeme değişince; ağ; öz ağırlık; Temizle; Kapat; yenile → çalışma kalıcı.
# Hazır model: 10×10 kesit, 100 mm ekstrüzyon (z) (setDoc).
import sys, re; sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d8h import *

E, I, L = 210000, 10 * 10 ** 3 / 12, 100.0


def beam(Lz=100):
    sk = rect_sk("s1", "Kesit", FRONT, -5, 0, 5, 10)
    e = ext("e1", "s1", Lz); e["name"] = "Kiriş"
    return [sk, e]


def panel(a):
    return a.ev("(document.querySelector('.fea-panel')||{}).textContent||''")


def umax(a):
    m = re.search(r"En büyük yer değiştirme:\s*([\d.,]+)\s*mm", panel(a))
    return num(m.group(1)) if m else None


def solve(a, t=240):
    a.btn(".fea-panel button:has-text('▶ Çöz')")
    t0 = time.time()
    while time.time() - t0 < t:
        time.sleep(1)
        if "von Mises" in panel(a) or "Önce" in a.toast() or "yapılamadı" in a.toast():
            break
    time.sleep(0.5)
    return umax(a)


def pick(a, w, ctrl=False):
    a.wclick(w) if not ctrl else (lambda s: a.click(s[0], s[1], mods=("Control",)))(a.wsc(w))
    time.sleep(0.3)


with sync_playwright() as p:
    a = App(p)
    a.setup(beam()); iso(a)
    tab(a, "evaluate"); a.cmd("Statik Analiz"); time.sleep(0.5)
    chk("F1 panel açık, malzeme E 210000", "210000" in panel(a), panel(a)[:120])
    # sabitle: ön uç (z=100) ; yük: üst yüz (y=10) −Y 100 N
    pick(a, [0, 5, 100]); a.btn(".fea-panel button:has-text('Seçili yüzleri sabitle')"); a.wait(0.3)
    chk("F1 Sabitlemeler (1 yüz)", "Sabitlemeler (1 yüz)" in panel(a), panel(a)[:200])
    pick(a, [0, 10, 50])
    a.pg.select_option(".fea-panel label.pm-field:has-text('Yük türü') select", "F")
    f = a.pg.locator(".fea-panel label.pm-field:has-text('Toplam kuvvet') input"); f.fill("100"); f.press("Tab")
    lsel(a, ".fea-panel", "Yön", "0")
    a.btn(".fea-panel button:has-text('Seçili yüzlere yük ekle')"); a.wait(0.3)
    chk("F1 Yükler (1): Kuvvet 100 N −Y · 1 yüz", "Kuvvet 100 N −Y · 1 yüz" in panel(a), panel(a)[:300])
    a.pg.select_option(".fea-panel label.pm-field:has-text('Ağ') select", "6000"); time.sleep(0.3)
    u1 = solve(a)
    dU = 100 * L ** 3 / (8 * E * I)
    note("F1 sonuç", panel(a)[-400:])
    chk("F1 üst yüze yayılı 100 N konsol: δ ≈ wL³/8EI = %.4f (±%%8)" % dU, u1 and abs(u1 - dU) < 0.08 * dU, (u1, dU))
    tep = re.search(r"tepki ([\d.,]+) N", panel(a))
    chk("F1 tepki 100 N", tep and abs(num(tep.group(1)) - 100) < 1, tep and tep.group(0))
    # ---------- F2: yük türleri: basınç 0,1 MPa (×1000 mm² = 100 N) ve yüze dik 100 N → aynı sehim
    a.btn(".fea-panel .pm-relrow button.rel-x"); a.wait(0.3)
    pick(a, [0, 10, 50]); a.pg.select_option(".fea-panel label.pm-field:has-text('Yük türü') select", "p"); time.sleep(0.2)
    f = a.pg.locator(".fea-panel label.pm-field:has-text('Basınç') input"); f.fill("0.1"); f.press("Tab")
    a.btn(".fea-panel button:has-text('Seçili yüzlere yük ekle')"); a.wait(0.3)
    u2 = solve(a); chk("F2 basınç 0,1 MPa → aynı sehim", u2 and abs(u2 - u1) < 0.02 * u1, (u2, u1))
    a.btn(".fea-panel .pm-relrow button.rel-x"); a.wait(0.3)
    pick(a, [0, 10, 50]); a.pg.select_option(".fea-panel label.pm-field:has-text('Yük türü') select", "Fn"); time.sleep(0.2)
    f = a.pg.locator(".fea-panel label.pm-field:has-text('Toplam kuvvet') input"); f.fill("100"); f.press("Tab")
    a.btn(".fea-panel button:has-text('Seçili yüzlere yük ekle')"); a.wait(0.3)
    u3 = solve(a); chk("F2 yüze dik 100 N → aynı sehim (içeri doğru)", u3 and abs(u3 - u1) < 0.02 * u1, (u3, u1))
    # ---------- F3: Ctrl+Z (yükü geri al) → sonuç geçersiz olmalı
    nL = a.ev("window.__app.doc.fea.loads.length")
    a.undo(); time.sleep(0.5)
    nL2 = a.ev("window.__app.doc.fea.loads.length"); txt = panel(a)
    note("F3 geri al", nL, nL2, "von Mises" in txt, txt[:200])
    chk("F3 Ctrl+Z yükü geri alır, panel listesi güncellenir", nL2 == nL - 1 and f"Yükler ({nL2})" in txt, (nL, nL2, txt[:160]))
    chk("F3 Ctrl+Z sonrası eski sonuç gösterilmez (geçersiz)", "von Mises" not in txt, txt[-200:])
    a.redo(); time.sleep(0.5)
    chk("F3 Ctrl+Y yükü geri getirir", a.ev("window.__app.doc.fea.loads.length") == nL and f"Yükler ({nL})" in panel(a), panel(a)[:160])
    u3b = solve(a)
    # ---------- F4: model değişir (ekstrüzyon 100 → 150, aynı topoloji) → sonuç geçersiz olmalı, referanslar izlenmeli
    a.edit_feat("Kiriş"); a.pmfield("Derinlik", 150); a.ok(); a.wait(1.5)
    txt = panel(a)
    chk("F4 boy 150 olunca eski sonuç geçersiz (gösterilmez)", "von Mises" not in txt, txt[-250:])
    st = a.ev("JSON.parse(JSON.stringify(window.__app.doc.fea))")
    note("F4 çalışma referansları", st)
    u4 = solve(a); t4 = a.toast()
    dU4 = 100 * 150 ** 3 / (8 * E * I)
    chk("F4 boy 150: sabit (uç) ve yük (üst) yüzleri izlenir, δ ≈ %.4f" % dU4, u4 and abs(u4 - dU4) < 0.08 * dU4, (u4, dU4, t4, panel(a)[-200:]))
    a.undo(); a.wait(1.5)
    # ---------- F5: malzeme değişince sonuç geçersiz / yeni E
    u5a = solve(a)
    tab(a, "evaluate"); a.cmd("Malzeme"); time.sleep(0.4)
    a.pg.check("dialog[open] input[value='aluminium']"); a.btn("dialog[open] button[value='ok']"); a.wait(0.8)
    txt = panel(a)
    chk("F5 malzeme Alüminyum → panel başlığı E güncellenir ve eski (çelik) sonuç gösterilmez", "von Mises" not in txt and "210000" not in txt, txt[:300])
    u5 = solve(a)
    Ealu = a.ev("(()=>{const t=document.querySelector('.fea-panel').textContent;const m=t.match(/E (\\d+) MPa/);return m?+m[1]:null})()")
    chk("F5 alüminyum sehim = çelik × 210000 / E_al", u5 and Ealu and abs(u5 - u5a * 210000 / Ealu) < 0.03 * u5, (u5, u5a, Ealu))
    a.undo(); a.wait(0.8)
    # ---------- F6: ağ, öz ağırlık, Temizle, Kapat
    a.pg.select_option(".fea-panel label.pm-field:has-text('Ağ') select", "2000"); time.sleep(0.3)
    chk("F6 ağ Kaba → doc.fea.n 2000", a.ev("window.__app.doc.fea.n") == 2000)
    a.pg.click(".fea-panel label.pm-check:has-text('Öz ağırlık') input"); time.sleep(0.3)
    chk("F6 öz ağırlık işaretlendi", a.ev("!!window.__app.doc.fea.self"))
    u6 = solve(a)
    # öz ağırlık: 10×10×100 çelik = 0,0785 kg → 0,77 N yayılı → δ ek ≈ 0,77 × δ(100 N)/100
    chk("F6 öz ağırlık eklenince sehim biraz artar", u6 and u6 > u3b * 0.999, (u6, u3b))
    a.btn(".fea-panel button:has-text('Temizle')"); time.sleep(0.4)
    chk("F6 Temizle → Sabitlemeler (0 yüz)", "Sabitlemeler (0 yüz)" in panel(a), panel(a)[:150])
    a.btn(".fea-panel button:has-text('▶ Çöz')"); time.sleep(1)
    chk("F6 sabitleme yokken çözmez, uyarır", "sabit yüz" in a.toast(), a.toast())
    a.undo(); time.sleep(0.5)
    chk("F6 Ctrl+Z → Sabitlemeler (1 yüz)", "Sabitlemeler (1 yüz)" in panel(a), panel(a)[:150])
    a.btn(".fea-panel button:has-text('Kapat')"); time.sleep(0.4)
    chk("F6 Kapat → panel ve renkler gider", a.pg.locator(".fea-panel").count() == 0 and a.ev("!window.__app.viewer.modelMesh.geometry.getAttribute('color')"))
    # ---------- F7: yenile → çalışma kalıcı
    a.reload()
    st = a.ev("JSON.parse(JSON.stringify(window.__app.doc.fea||null))")
    chk("F7 yenile → fix 1, yük 1, n 2000, öz ağırlık", st and len(st["fix"]) == 1 and len(st["loads"]) == 1 and st["n"] == 2000 and st.get("self"), st)
    iso(a); tab(a, "evaluate"); a.cmd("Statik Analiz"); time.sleep(0.5)
    u7 = solve(a); chk("F7 yeniden çöz → aynı sonuç", u7 and abs(u7 - u6) < 1e-3 * max(u6, 1e-9) + 1e-4, (u7, u6))
    # ---------- F8: Statik Analiz komutuna yeniden basınca panel kapanır (aç / kapat)
    a.cmd("Statik Analiz"); time.sleep(0.4)
    chk("F8 komut yeniden → panel kapanır", a.pg.locator(".fea-panel").count() == 0)
    chk("konsol hatası yok", not a.errs, a.errs[:5])
    a.close()
finish()

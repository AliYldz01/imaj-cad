# d8 — Yapı Elemanı yaşam döngüsü: oluştur (şerit) → kesim listesi → Düzenle (profil / köşe / boşluk) → 3B iskelet ölçüsü
# (çift tık) → kesim listesi güncel mi → Ctrl+Z / Ctrl+Y → yenile → ✕ (Kaydetmeden / Kaydet ve çık) → bastır / sil → sıra (▲).
# Hazır model: yalnız iskelet eskizleri (2B çerçeve / 3B çerçeve) ve U6'da taban blok (setDoc).
import sys; sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d8h import *

SEGS = [("s1", e) for e in ["l5", "l6", "l7", "l8"]]

with sync_playwright() as p:
    a = App(p)
    if want("U1") or want("U2") or want("U5") or want("U7"):
        # ---------- U1: 2B iskelet → şeritten Yapı Elemanı → ✓
        a.setup([frame_sk()])
        tab(a, "weld"); a.cmd("Yapı Elemanı"); a.wait(1)
        chk("U1 PM açıldı, 4 segment seçili (Grup 1 (4))", a.mode() == "pm" and "Grup 1 (4)" in a.pmtext(), a.mode())
        chk("U1 varsayılan profil kutu 40x40x3, gönye", a.pmselval("Standart") == "kutu" and a.pmselval("Ölçü") == "40x40x3")
        a.ok(); a.wait(1.5)
        cl = cl_api(a)
        chk("U1 4 gövde, 640 ×2 / 440 ×2, hepsi 45°/45°", a.bodies() == 4 and [c[2] for c in cl] == [440, 440, 640, 640] and all(c[3] == 45 and c[4] == 45 for c in cl), cl)
        rows = cutlist_open(a)
        chk("U1 Kesim Listesi penceresi: 2 kalem (2× 640, 2× 440), 1,98 / 1,32 kg", rows and len(rows) == 2 and rows[0][1] == "2" and rows[0][4] == "640" and rows[1][4] == "440" and rows[0][7] == "1,98", rows)
        cutlist_close(a)
        fid = a.ev("window.__app.doc.features.find(f=>f.type==='member').id")
        mname = a.ev("window.__app.doc.features.find(f=>f.type==='member').name")
        V1 = a.vol()
        # U7: 2B iskelet eskizi ağaçta yok, "Eskizi düzenle" yok (P-4)
        tree = a.ev("[...document.querySelectorAll('#tree li')].map(l=>l.textContent.trim())")
        a.tsel(mname); acts = a.pg.locator("#tree-actions button").all_inner_texts()
        chk("U7 2B iskelet eskizi ağaçta görünür / Eskizi düzenle var (P-4)", "Çerçeve" in " ".join(tree) or "Eskizi düzenle" in acts, (tree, acts))
        a.btn("#tree-actions button:text-is('Ebeveyn / çocuk')"); t = a.toast()
        chk("U7 Ebeveyn / çocuk: yapı elemanının ebeveyni iskelet eskizi", "Çerçeve" in t, t)

        # ---------- U2: Düzenle → boru 42.4x3.2, Alın 1, boşluk 3 → ✓
        a.edit_feat(mname)
        a.pmselect("Standart", "boru"); a.pmselect("Ölçü", "42.4x3.2")
        a.pmseg("Alın 1"); a.pmfield("Boşluk", 3)
        a.ok(); a.wait(1.5)
        cl = cl_api(a)
        note("U2 alın1 boru:", cl)
        L = sorted(set(c[2] for c in cl))
        chk("U2 boru Alın 1 + 3 mm: tüm uçlar 0°", all(c[3] == 0 and c[4] == 0 for c in cl), cl)
        chk("U2 boylar 642,4 (sürekli) ve 400−42,4−2×3 = 351,6", len(L) == 2 and abs(L[1] - 642.4) < 0.2 and abs(L[0] - 351.6) < 0.2, L)
        rows = cutlist_open(a)
        chk("U2 Kesim Listesi tanımı Boru 42.4x3.2", rows and all("42.4" in r[2] or "42,4" in r[2] for r in rows), rows)
        cutlist_close(a)
        sv = a.saved_feat(fid)
        chk("U2 kayıt (localStorage) boru / butt1 / gap 3", sv and sv["std"] == "boru" and sv["corner"] == "butt1" and sv["gap"] == 3, sv and (sv["std"], sv["corner"], sv["gap"]))
        # Alın 2: öbür eleman sürekli
        a.edit_feat(mname); a.pmseg("Alın 2"); a.ok(); a.wait(1.5)
        L2 = sorted(set(c[2] for c in cl_api(a)))
        chk("U2 Alın 2: sürekli eleman değişir (442,4 / 551,6)", len(L2) == 2 and abs(L2[1] - 551.6) < 0.2 and abs(L2[0] - 442.4) < 0.2, L2)
        # Yok
        a.edit_feat(mname); a.pmseg("Yok"); a.ok(); a.wait(1.5)
        cl = cl_api(a)
        chk("U2 köşe işlemi Yok: eskiz boyları 600 / 400", sorted(set(c[2] for c in cl)) == [400, 600], cl)
        ifc = a.ev("window.__app.kernel.interfere().then(r=>r.length)")
        note("U2 'Yok' girişim çifti:", ifc)
        # ---------- U5: Ctrl+Z / Ctrl+Y zinciri
        a.undo(); L = sorted(set(c[2] for c in cl_api(a)))
        chk("U5 Ctrl+Z → Alın 2 geri (442,4 / 551,6)", L == L2, L)
        a.undo(); L = sorted(set(c[2] for c in cl_api(a)))
        chk("U5 Ctrl+Z ×2 → Alın 1 (351,6 / 642,4)", len(L) == 2 and abs(L[1] - 642.4) < 0.2, L)
        a.redo(); a.redo(); L = sorted(set(c[2] for c in cl_api(a)))
        chk("U5 Ctrl+Y ×2 → Yok (400 / 600)", L == [400, 600], L)
        a.reload(); L = sorted(set(c[2] for c in cl_api(a)))
        chk("U5 yenile → Yok (400 / 600), boru", L == [400, 600] and a.feat(fid)["std"] == "boru", L)
        # ✕
        V0 = a.vol()
        a.edit_feat(mname); a.pmselect("Ölçü", "60.3x3.6"); a.wait(1.0)
        a.cancel("discard"); V = a.vol()
        chk("U5 ✕ Kaydetmeden çık: model / kayıt değişmez", near(V, V0, 1) and a.saved_feat(fid)["size"] == "42.4x3.2", (V0, V, a.saved_feat(fid)["size"]))
        a.edit_feat(mname); a.pmselect("Ölçü", "60.3x3.6"); a.wait(1.0)
        a.cancel("save"); V = a.vol()
        chk("U5 ✕ Kaydet ve çık: 60.3x3.6 uygulanır", V > V0 * 1.2 and a.saved_feat(fid)["size"] == "60.3x3.6", (V0, V))
        # bastır / sil
        a.tact(mname, "Bastır"); chk("U5 Bastır → gövde yok", a.bodies() in (0, None), a.bodies())
        a.tact(mname, "Etkinleştir")
        chk("U5 Etkinleştir → 4 gövde", a.bodies() == 4, a.bodies())
        a.tact(mname, "Sil", confirm=[True, True])
        chk("U5 Sil → eleman yok, iskelet eskizi ağaçta yeniden görünür", not a.ev("window.__app.doc.features.some(f=>f.type==='member')") and "Çerçeve" in " ".join(a.ev("[...document.querySelectorAll('#tree li')].map(l=>l.textContent)")), a.names())
        a.undo(); chk("U5 Sil + Ctrl+Z → geri", a.bodies() == 4, a.bodies())

    if want("U3"):
        # ---------- U3: 3B iskelet (hazır) → Yapı Elemanı (şerit) → 3B ölçü 600→800 (çift tık) → kesim listesi
        a.setup([s3_frame()])
        a.tsel("3B Çerçeve")
        tab(a, "weld"); a.cmd("Yapı Elemanı"); a.wait(1)
        chk("U3 PM: 3B eskizin 4 çizgisi seçili", "Grup 1 (4)" in a.pmtext(), a.pmtext()[:80])
        a.ok(); a.wait(1.5)
        cl = cl_api(a)
        chk("U3 3B iskelet: 640 / 440 gönye", sorted(set(c[2] for c in cl)) == [440, 640], cl)
        mname = a.ev("window.__app.doc.features.find(f=>f.type==='member').name")
        s3_open(a, "3B Çerçeve")
        s3_edit_dim(a, 0, 800)
        xyz = a.ev("window.__app.mode.draft && window.__app.mode.draft.xyz")
        note("U3 3B noktalar:", xyz)
        a.ok(); a.wait(1.5)
        cl = cl_api(a)
        chk("U3 3B ölçü 800 → kesim listesi 840 / 440", sorted(set(c[2] for c in cl)) == [440, 840], cl)
        rows = cutlist_open(a)
        chk("U3 Kesim Listesi penceresi de 840", rows and rows[0][4] == "840", rows)
        cutlist_close(a)
        sv = [f for f in a.stored()["features"] if f["type"] == "sketch3d"][0]
        chk("U3 kayıtta 3B ölçü 800", any(abs(d["v"] - 800) < 1e-6 for d in sv.get("dims3", [])), sv.get("dims3"))
        a.undo(); cl = cl_api(a)
        chk("U3 Ctrl+Z → 640", sorted(set(c[2] for c in cl)) == [440, 640], cl)
        a.redo(); cl = cl_api(a)
        chk("U3 Ctrl+Y → 840", sorted(set(c[2] for c in cl)) == [440, 840], cl)
        a.reload(); cl = cl_api(a)
        chk("U3 yenile → 840", sorted(set(c[2] for c in cl)) == [440, 840], cl)
        # 3B iskelette çizgi silinince (sil → eleman güncellenir mi?)
        s3_open(a, "3B Çerçeve")
        s3_edit_dim(a, 1, 300)
        a.cancel("discard"); cl = cl_api(a)
        chk("U3 3B düzenle ✕ Kaydetmeden çık → 440 kalır", sorted(set(c[2] for c in cl)) == [440, 840], cl)

    if want("U6"):
        # ---------- U6: sıra — yapı elemanı ▲ Yukarı ile iskelet eskizinin önüne geçebiliyor mu
        blk = rect_sk("s0", "Taban", TOP, -50, -50, 50, 50)
        e0 = ext("e0", "s0", 10); e0["name"] = "Taban-Ekst"
        a.setup([blk, e0, frame_sk(), mem("m1", SEGS, name="Yapı-Elemanı1")])
        a.wait(1.5)
        chk("U6 başlangıç hatasız", not a.errtree(), a.errtree())
        a.tact("Yapı-Elemanı1", "▲ Yukarı"); a.wait(1.5)
        order = [f["id"] for f in a.ev("window.__app.doc.features.map(f=>({id:f.id}))")]
        err = a.errtree()
        chk("U6 ▲ Yukarı yapı elemanını iskelet eskizinin önüne taşımamalı (ya da hata vermemeli)", order.index("m1") > order.index("s1") and not err, (order, err, a.toast()))
    note("konsol:", a.errs[:5])
    chk("konsol hatası yok", not a.errs, a.errs[:5])
    a.close()
finish()

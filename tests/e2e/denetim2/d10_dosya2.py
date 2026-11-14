# d10 — DOSYA 2: masaüstü dosya tutamacı (showSave/OpenFilePicker sahte tutamaçla — hazır ortam), yanlış dosyaya yazma,
# localStorage dolu (fotoğraf notlarıyla), bozuk kayıt
import sys; sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d10h import *

BLOCK_DOC = {"version": 2, "name": "A", "uid": "uidA0001", "features": block(), "seq": {}}


def noisy_jpeg(path, w=1280, h=960):
    from PIL import Image
    import random
    im = Image.frombytes("RGB", (w, h), os.urandom(w * h * 3))
    im.save(path, quality=95)


with sync_playwright() as p:
    if want("tutamac"):
        a = App(p, fsmock=True)
        # diskte A.icad (hazır dosya)
        a.ev("t=>{window.__fs['A.icad']=t}", json.dumps(BLOCK_DOC))
        a.ev("()=>window.__fsQ.push('A.icad')")
        a.pg.keyboard.press("Control+o"); a.wait(1)
        chk("Ctrl+O (dosya seçici) → A açıldı, 96000", a.docname() == "A" and near(a.vol(), 96000, 1), (a.docname(), a.vol()))
        # Ctrl+Z → açma geri alınıyor mu; sonra Ctrl+S nereye yazar
        a.undo()
        n_after_undo = a.nfeat()
        note("A açıldıktan sonra Ctrl+Z → özellik", n_after_undo, "ad", a.docname())
        a.ev("()=>{window.__fsLog.length=0}")
        a.pg.keyboard.press("Control+s"); time.sleep(1)
        log = a.ev("window.__fsLog")
        diskA = json.loads(a.ev("window.__fs['A.icad']"))
        chk("Ctrl+Z sonrası Ctrl+S: A.icad boş belgeyle ezilmiyor", len(diskA["features"]) == 2, f"log={log} A.icad özellik={len(diskA['features'])} ad={diskA['name']}")
        # yeniden: A'yı aç, Ctrl+N → sekme 2, B.icad'ı aç (boş sekmeye)
        a.ev("t=>{window.__fs['A.icad']=t}", json.dumps(BLOCK_DOC))
        a.pg.evaluate("localStorage.clear()"); a.pg.reload(); a.wait(1)
        a.ev("t=>{window.__fs['A.icad']=t}", json.dumps(BLOCK_DOC))
        B = dict(BLOCK_DOC, name="B", uid="uidB0001")
        B["features"] = block(w=50)
        a.ev("t=>{window.__fs['B.icad']=t}", json.dumps(B))
        a.ev("()=>window.__fsQ.push('A.icad')"); a.menu("Dosya", "Aç…"); a.wait(1)
        a.menu("Dosya", "Yeni parça")
        a.ev("()=>window.__fsQ.push('B.icad')"); a.menu("Dosya", "Aç…"); a.wait(1)
        chk("2 sekme: A, B", a.tabs() == ["A", "*B"], a.tabs())
        # B'de derinlik 25 → Ctrl+S → B.icad
        a.edit_feat("Ekstrüzyon1"); a.pmfield("Derinlik", 25); a.ok()
        a.ev("()=>{window.__fsLog.length=0}")
        a.pg.keyboard.press("Control+s"); time.sleep(1)
        chk("B sekmesinde Ctrl+S → yalnız B.icad", a.ev("window.__fsLog") == ["write:B.icad"], a.ev("window.__fsLog"))
        a.btn("#doctabs .dtab:nth-child(1) span"); a.wait(1)
        a.edit_feat("Ekstrüzyon1"); a.pmfield("Derinlik", 35); a.ok()
        a.ev("()=>{window.__fsLog.length=0}")
        a.pg.keyboard.press("Control+s"); time.sleep(1)
        chk("A sekmesinde Ctrl+S → yalnız A.icad", a.ev("window.__fsLog") == ["write:A.icad"], a.ev("window.__fsLog"))
        dA = json.loads(a.ev("window.__fs['A.icad']")); dB = json.loads(a.ev("window.__fs['B.icad']"))
        chk("A.icad d1=35, B.icad d1=25", dA["features"][1]["d1"] == 35 and dB["features"][1]["d1"] == 25, (dA["features"][1]["d1"], dB["features"][1]["d1"]))
        # yenile: tutamaçlar kaybolur → Ctrl+S yeniden ad sorar mı (sessizce indirme / başka dosya?)
        a.reload()
        a.ev("t=>{window.__fs['A.icad']=t}", json.dumps(dA))  # sahte disk yenilemede sıfırlanır: geri yaz
        a.ev("()=>{window.__fsLog.length=0;window.__fsQ.push('__abort')}")
        a.pg.keyboard.press("Control+s"); time.sleep(1)
        note("yenilemeden sonra Ctrl+S:", a.ev("window.__fsLog"))
        # Farklı kaydet → C.icad, sonra A.icad'ı aç
        a.ev("()=>{window.__fsLog.length=0;window.__fsQ.push('C.icad')}")
        a.menu("Dosya", "Farklı kaydet…"); time.sleep(1)
        chk("Farklı kaydet → C.icad yazıldı, ad C", a.ev("window.__fsLog").count("write:C.icad") == 1 and a.docname() == "C", (a.ev("window.__fsLog"), a.docname()))
        a.edit_feat("Ekstrüzyon1"); a.pmfield("Derinlik", 5); a.ok()
        a.ev("()=>{window.__fsLog.length=0}")
        a.pg.keyboard.press("Control+s"); time.sleep(1)
        chk("Farklı kaydet sonrası Ctrl+S → C.icad (A değil)", a.ev("window.__fsLog") == ["write:C.icad"], a.ev("window.__fsLog"))
        a.menu("Dosya", "Yeni parça")
        a.ev("()=>window.__fsQ.push('A.icad')"); a.menu("Dosya", "Aç…"); a.wait(1)
        note("C açıkken A.icad aç → sekmeler", a.tabs(), "etkin ad", a.docname(), "d1", a.featv("Ekstrüzyon1", "d1"))
        chk("A.icad açılınca A (d1=35) gelir", a.docname() == "A" and a.featv("Ekstrüzyon1", "d1") == 35, (a.docname(), a.featv("Ekstrüzyon1", "d1")))
        # şimdi kullanıcı 'A' sandığı sekmede değişiklik yapıp Ctrl+S → hangi dosya?
        a.edit_feat("Ekstrüzyon1"); a.pmfield("Derinlik", 7); a.ok()
        a.ev("()=>{window.__fsLog.length=0}")
        a.pg.keyboard.press("Control+s"); time.sleep(1)
        note("ardından Ctrl+S yazılan:", a.ev("window.__fsLog"))
        print("hatalar:", a.errs[:5])
        a.close()

    if want("dolu"):
        a = App(p)
        a.setup(block())
        img = "/tmp/d10_noise.jpg"
        noisy_jpeg(img)
        sizes = []
        lost = None
        for i in range(12):
            a.cmd_tab = None
            a.btn("#tabs button[data-tab='evaluate']")
            a.cmd("Fotoğraflar")
            with a.pg.expect_file_chooser() as fc:
                a.btn("dialog[open] button:has-text('Fotoğraf ekle')")
            fc.value.set_files(img)
            time.sleep(1.5)
            # boşluğa tıkla = konumsuz
            vc = a.view_center()
            a.click(vc[0] - 300, vc[1] - 250)
            time.sleep(0.6)
            n_doc = a.ev("(window.__app.doc.photos||[]).length")
            st = json.loads(a.ls("imajcad.doc.v2") or "{}")
            n_st = len(st.get("photos", []))
            used = a.ev("(()=>{let n=0;for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);n+=k.length+localStorage.getItem(k).length}return n})()")
            sizes.append((n_doc, n_st, used, a.toast()))
            if n_st < n_doc:
                lost = i
                break
        note("foto (belge, kayıtta, kullanılan karakter, uyarı):", [(x[0], x[1], x[2], x[3][:40]) for x in sizes])
        if lost is not None:
            # depolama doldu: sonraki her değişiklik de kaydedilmiyor mu
            a.edit_feat("Ekstrüzyon1"); a.pmfield("Derinlik", 44); a.ok()
            tw = a.toast()
            a.pg.reload(); wait_ready(a.pg); time.sleep(1); a.wait(0.5)
            d1 = a.featv("Ekstrüzyon1", "d1"); nph = a.ev("(window.__app.doc.photos||[]).length")
            chk("depolama dolunca uyarı verilir ya da değişiklik korunur", (d1 == 44 and nph == sizes[-1][0]) or "depolama" in tw.lower() or "kayded" in tw.lower(),
                f"yenileme sonrası d1={d1} (beklenen 44), foto={nph} (belgede {sizes[-1][0]} idi), son uyarı={tw!r}")
        else:
            chk("12 fotoğrafa kadar depolama yetti", True)
        a.close()

    if want("bozuk"):
        a = App(p)
        a.setup(block())
        a.ev("localStorage.setItem('imajcad.doc.v2', localStorage.getItem('imajcad.doc.v2').slice(0, 200))")
        a.pg.reload(); wait_ready(a.pg); time.sleep(1)
        tw = a.toast()
        note("bozuk belge kaydıyla açılış: özellik", a.nfeat(), "uyarı", repr(tw))
        chk("bozuk kayıt: kullanıcı uyarılır", bool(tw), repr(tw))
        # bozuk son belgeler listesi
        a.ev("localStorage.setItem('imajcad.recent','[{bad')")
        a.menu("Dosya", "Son belgeler…")
        chk("bozuk son belgeler listesi: pencere yine açılır", len(a.dialogs_open()) > 0, (a.dialogs_open(), a.errs[-1:] if a.errs else ""))
        a.close_dialogs()
        a.dq[:] = ["Z"]
        try:
            a.download(lambda: a.menu("Dosya", "Kaydet"), timeout=8000)
        except Exception as e:
            note("indirme yok:", str(e)[:60])
        a.menu("Dosya", "Son belgeler…")
        chk("kaydettikten sonra son belgeler listesi onarılır", len(a.dialogs_open()) > 0, a.dialogs_open())
        a.close_dialogs()
        a.ev("localStorage.setItem('imajcad.techdraw','{bad')")
        a.menu("Dosya", "Teknik resim…"); time.sleep(3)
        chk("bozuk teknik resim ayarı: pencere yine açılır", len(a.dialogs_open()) > 0, a.dialogs_open())
        a.close_dialogs()
        a.ev("localStorage.setItem('imajcad.keys','{bad'); localStorage.setItem('imajcad.input','{bad'); localStorage.setItem('imajcad.ribbon','{bad'); localStorage.setItem('imajcad.tabs','{bad')")
        a.errs.clear()
        a.pg.reload(); wait_ready(a.pg); time.sleep(1)
        chk("bozuk kısayol/giriş/şerit/sekme ayarlarıyla açılış hatasız", a.mode() == "part" and not a.errs, a.errs[:3])
        a.close()
finish()

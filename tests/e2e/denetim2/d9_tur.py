# d9 — Montaj: tüm eşleşme türleri gerçek tıklamayla (Standart / Gelişmiş / Mekanik); her biri sonra Ctrl+Z ile geri alınır
# Hazır model: Plaka (100×60×10, Ø10 delik), Pim (Ø10×30), Yuvalı plaka (100×100×10, 70×10 yuva) setDoc ile; kütüphaneye şeritten kaydedilir.
import sys, math; sys.path.insert(0, '/home/claude/imaj-cad/tests/e2e/denetim2')
from d9h import *
from h import sketch as hsketch

CUT = dict(cut=True, end="through", dir2=True, end2="through")
slotp = {"version": 2, "name": "Yuvalı", "seq": {}, "features": [
    hsketch("s1", "S", TOP, lambda pt, line, rect, c, t: rect(-50, -50, 50, 50)), ext("e1", "s1", 10),
    hsketch("s5", "R", TOP, lambda pt, line, rect, c, t: rect(-30, -5, 30, 5)), ext("e5", "s5", 10, **CUT),
    hsketch("s6", "C", TOP, lambda pt, line, rect, c, t: (c(-30, 0, 5), c(30, 0, 5))), ext("e6", "s6", 10, **CUT)]}


def wn(S, cid, n):
    return S.js("const c=a.doc.comps.find(x=>x.id===arg[0]);const T=window.__app.THREE;return new T.Vector3(...arg[1]).applyQuaternion(new T.Quaternion(...c.q)).toArray().map(v=>+v.toFixed(4))", [cid, n])


def ang(u, v):
    d = sum(u[i] * v[i] for i in range(3))
    return math.degrees(math.acos(max(-1, min(1, d))))


with sync_playwright() as p:
    A = App(p); S = Asm(A)
    to_lib(A, pin_doc())
    to_lib(A, slotp)
    setdoc(A, plate_doc())
    S.open()
    P1 = S.add_current(); PN = S.add_lib("Pim"); P2 = S.add_current()
    S.fit()
    base = S.comps()
    i1, ipn, i2 = P1["id"], PN["id"], P2["id"]
    top = "f=>f.n&&f.n[1]>0.9"
    front = "f=>f.n&&f.n[2]>0.9"

    def C(i):
        return [c for c in S.comps() if c["id"] == i][0]

    def start(tabname=None, typ=None):
        A.cmd("Eşleşme")
        if tabname:
            S.mate_tab(tabname)
        if typ:
            S.mate_type(typ)

    def finish_mate():
        S.pmok()
        S.pmx() if S.pm_open() else None

    def back(name):
        """Ctrl+Z → başlangıç konumları"""
        n = 0
        while S.mates() and n < 4:
            A.undo(); n += 1
        ok = len(S.mates()) == 0 and all(dist(a["p"], b["p"]) < 0.01 and dist(a["q"], b["q"]) < 0.01 for a, b in zip(base, S.comps()))
        chk(f"{name}: Ctrl+Z eşleşmeyi ve konumu geri alır", ok, (n, len(S.mates()), [c["p"] for c in S.comps()]))
        if not ok:
            for m in S.mates():
                pass

    # ---------------- Standart ----------------
    if want("perp"):
        start()
        S.click_face(i2, top, shift=[30, 0, 0]); S.click_face(i1, top, shift=[30, 0, 10])
        S.mate_type("perpendicular"); finish_mate()
        a_ = ang(wn(S, i2, [0, 1, 0]), [0, 1, 0])
        chk("Dik: Plaka2 üst yüzü Plaka1 üst yüzüne dik (90°)", abs(a_ - 90) < 0.1, a_)
        back("Dik")
    if want("angle"):
        start()
        S.click_face(i2, top, shift=[30, 0, 0]); S.click_face(i1, top, shift=[30, 0, 10])
        S.mate_type("angle"); A.pmfield("Açı", 30); finish_mate()
        a_ = ang(wn(S, i2, [0, 1, 0]), [0, 1, 0])
        chk("Açı 30°", abs(a_ - 30) < 0.1 or abs(a_ - 150) < 0.1, a_)
        i = S.mate_li("Açı 30")
        A.pg.locator("#tree li").nth(i).dblclick(); time.sleep(0.4)
        A.pmfield("Açı", 60); S.pmok()
        a_ = ang(wn(S, i2, [0, 1, 0]), [0, 1, 0])
        chk("Açı düzenle 30 → 60", (abs(a_ - 60) < 0.1 or abs(a_ - 120) < 0.1) and S.mate_li("Açı 60") >= 0, (a_, S.tree()[-1]))
        back("Açı")
    if want("tangent"):
        start()
        S.click_local(ipn, [3.5, 20, 3.5]); S.click_face(i1, top, shift=[30, 0, 10])
        sug = A.ev("(document.querySelector('#pm-body .mate-types button.on')||{}).textContent")
        finish_mate()
        ax = wn(S, ipn, [0, 1, 0]); c = C(ipn)["p"]
        axpt = S.world(ipn, [0, 15, 0])
        chk("Teğet: silindir ↔ düz yüz önerisi Teğet", sug == "Teğet", sug)
        chk("Teğet: pim ekseni yüze paralel ve 5 mm uzakta", abs(ax[1]) < 1e-3 and abs(abs(axpt[1] - 10) - 5) < 0.05, (ax, axpt))
        back("Teğet")
    if want("lock"):
        start()
        S.click_local(ipn, [3.5, 20, 3.5]); S.click_face(i1, top, shift=[30, 0, 10])
        S.mate_type("lock"); finish_mate()
        tr = S.tree()
        chk("Kilit: Pim tam tanımlı (işaretsiz)", any(t.startswith("Pim<1>") for t in tr), tr)
        p0 = C(ipn)["p"]
        s = S.screen(S.world(ipn, [3.5, 25, 3.5]))
        A.drag(s, (s[0] + 80, s[1] + 40))
        chk("Kilit: sürükleyince pim kıpırdamaz", dist(C(ipn)["p"], p0) < 0.01, C(ipn)["p"])
        back("Kilit")
    if want("flipco"):
        start()
        S.click_face(i2, top, shift=[30, 0, 0]); S.click_face(i1, top, shift=[30, 0, 10])
        al = A.ev("(document.querySelector('#pm-body .seg button.on, #pm-body .seg button.sel')||{}).textContent")
        finish_mate()
        n0 = wn(S, i2, [0, 1, 0])
        chk("Çakışık üst↔üst: varsayılan hizalı (Plaka2 y=0)", abs(C(i2)["p"][1]) < 0.01 and n0[1] > 0.99, (C(i2)["p"], n0, al))
        S.mate_select("Çakışık"); S.act("Hizalamayı çevir")
        n1 = wn(S, i2, [0, 1, 0]); m = S.mates()[0]
        chk("Çakışık: Hizalamayı çevir → Plaka2 ters döner (üst yüz normali −Y), hatasız", n1[1] < -0.99 and not m["bad"], (n1, m["bad"], C(i2)))
        back("Çakışık çevir")
    # ---------------- Gelişmiş ----------------
    if want("limit"):
        start("Gelişmiş", "limit")
        S.click_face(i2, top, shift=[30, 0, 0]); S.click_face(i1, top, shift=[30, 0, 10])
        A.pmfield("En az", 10); A.pmfield("En çok", 30)
        finish_mate()
        y = S.world(i2, [50, 10, -30])[1] - 10
        chk("Limit 10…30: yüzler arası mesafe aralıkta", 10 - 0.01 <= abs(y) <= 30.01, (y, C(i2)))
        chk("Limit: önce tür seçilip sonra yüzler seçilince Plaka2 ters dönmez (hizalama otomatik)", wn(S, i2, [0, 1, 0])[1] > 0.99, (wn(S, i2, [0, 1, 0]), S.mates()[0]["flip"]))
        chk("Limit: Plaka2 (-) serbest", any(t.startswith("(-) Plaka<2>") for t in S.tree()))
        back("Limit")
    if want("limitAngle"):
        start("Gelişmiş", "limitAngle")
        S.click_face(i2, front, shift=[30, 0, 0]); S.click_face(i1, front, shift=[30, 0, 0])
        A.pmfield("En az açı", 20); A.pmfield("En çok açı", 40)
        finish_mate()
        a_ = ang(wn(S, i2, [0, 0, 1]), [0, 0, 1])
        chk("Açı limiti 20…40°", 19.9 <= a_ <= 40.1 or 139.9 <= a_ <= 160.1, (a_, [m["bad"] for m in S.mates()]))
        back("Açı limiti")
    if want("pcenter"):
        start("Gelişmiş", "profileCenter")
        S.click_face(i2, top, shift=[30, 0, 0]); S.click_face(i1, top, shift=[30, 0, 10])
        finish_mate()
        b1 = S.bbox(i1); b2 = S.bbox(i2)
        cx = lambda b: [(b[0][0] + b[1][0]) / 2, (b[0][2] + b[1][2]) / 2]
        chk("Profil merkezi: Plaka2 ters dönmez", wn(S, i2, [0, 1, 0])[1] > 0.99, wn(S, i2, [0, 1, 0]))
        chk("Profil merkezi: merkezler hizalı", b1 and b2 and dist(cx(b1), cx(b2)) < 0.1, (b1, b2, [m["bad"] for m in S.mates()]))
        back("Profil merkezi")
    if want("sym"):
        start("Gelişmiş", "symmetric")
        S.click_local(ipn, [0, 30, 0])          # pim üst yüzü
        S.click_face(i2, top, shift=[30, 0, 0])  # Plaka2 üst yüzü
        # simetri düzlemi: ağaçtan Montaj ana düzlemleri > Üst düzlem
        A.btn("#tree li.plane-tog:has-text('Montaj ana düzlemleri')")
        A.btn("#tree li:has-text('Üst düzlem')")
        txt = A.pmtext()
        finish_mate()
        yp = S.world(ipn, [0, 30, 0])[1]; y2 = S.world(i2, [50.27, 10, -30])[1]
        chk("Simetrik: bileşenler gereksiz yere 90° yatırılmaz", abs(wn(S, ipn, [0, 1, 0])[1]) > 0.99, (wn(S, ipn, [0, 1, 0]), wn(S, i2, [0, 1, 0])))
        chk("Simetrik: pim üstü ve Plaka2 üstü Üst düzleme göre simetrik", abs(yp + y2) < 0.05 and S.mates() and not S.mates()[0]["bad"], (yp, y2, txt[:160].replace("\n", " | ")))
        back("Simetrik")
    if want("width"):
        start("Gelişmiş", "width")
        S.click_face(i1, front, shift=[30, 0, 0])
        A.press("Control+2")
        S.click_face(i1, "f=>f.n&&f.n[2]<-0.9", shift=[30, 0, 0])
        A.press("Control+7"); S.fit()
        S.click_local(ipn, [3.5, 20, 3.5])
        txt = A.pmtext()
        finish_mate()
        ax = S.world(ipn, [0, 15, 0])
        chk("Genişlik: pim ekseni plakanın ortasında (z=-30)", abs(ax[2] + 30) < 0.05 and S.mates(), (ax, txt[:200].replace("\n", " | ")))
        back("Genişlik")
    if want("path"):
        start("Gelişmiş", "path")
        S.click_local(ipn, [3.5, 20, 3.5])
        s = S.click_local(i1, [50, 10, 0])  # üst ön kenar
        txt = A.pmtext()
        finish_mate()
        ax = S.world(ipn, [0, 15, 0]); ms = S.mates()
        onloop = (abs(ax[0]) < 0.1 or abs(ax[0] - 100) < 0.1) or (abs(ax[2]) < 0.1 or abs(ax[2] + 60) < 0.1)
        chk("Yol: pim üst yüz kenar zinciri üzerinde", ms and not ms[0]["bad"] and onloop, (ax, ms and ms[0]["type"], txt[:200].replace("\n", " | ")))
        back("Yol")
    if want("coupler"):
        start("Gelişmiş", "coupler")
        S.click_face(i2, top, shift=[30, 0, 0]); S.click_local(ipn, [3.5, 20, 3.5])
        finish_mate()
        ms = S.mates()
        chk("Bağlayıcı (coupler) oluşturulur, hatasız", ms and ms[0]["type"] == "coupler" and not ms[0]["bad"], ms)
        back("Bağlayıcı")
    # ---------------- Mekanik ----------------
    if want("hinge"):
        start("Mekanik", "hinge")
        S.click_local(ipn, [3.5, 20, 3.5]); S.click_local(i1, [30 - 3.5, 8, -30 - 3.5])
        S.click_face(i1, top, shift=[45, 0, 12])
        A.press("Control+6")
        S.click_local(ipn, [0, 0, 0])
        A.press("Control+7"); S.fit()
        finish_mate()
        chk("Menteşe: pim delikte ve yüzde (30,10,-30)", dist(C(ipn)["p"], [30, 10, -30]) < 0.05, (C(ipn)["p"], S.mates()))
        chk("Menteşe: Pim (-) yalnız dönme serbest", any(t.startswith("(-) Pim<1>") for t in S.tree()))
        back("Menteşe")
    if want("gear"):
        start("Mekanik", "gear")
        S.click_local(ipn, [3.5, 20, 3.5]); S.click_local(i1, [30 - 3.5, 8, -30 - 3.5])
        A.pmfield("Oran: 1. dişli çapı", 20); A.pmfield("Oran: 2. dişli çapı", 40)
        finish_mate()
        ms = S.mates()
        chk("Dişli oluşturulur 20:40, hatasız", ms and ms[0]["type"] == "gear" and ms[0]["v"] == 20 and ms[0]["vmax"] == 40 and not ms[0]["bad"], ms)
        back("Dişli")
    if want("rack"):
        start("Mekanik", "rack")
        S.click_local(i1, [50, 10, 0]); S.click_local(ipn, [3.5, 20, 3.5])
        A.pmfield("Pinyon hatve çapı", 20)
        finish_mate()
        ms = S.mates()
        chk("Kremayer-pinyon oluşturulur, hatasız", ms and ms[0]["type"] == "rack" and not ms[0]["bad"], ms)
        back("Kremayer")
    if want("screw"):
        start("Mekanik", "screw")
        S.click_local(ipn, [3.5, 20, 3.5]); S.click_local(i1, [30 - 3.5, 8, -30 - 3.5])
        A.pmfield("Hatve", 2)
        finish_mate()
        ms = S.mates()
        chk("Vida oluşturulur hatve 2, hatasız", ms and ms[0]["type"] == "screw" and ms[0]["v"] == 2 and not ms[0]["bad"], ms)
        back("Vida")
    if want("universal"):
        start("Mekanik", "universal")
        S.click_local(ipn, [3.5, 20, 3.5]); S.click_local(i1, [30 - 3.5, 8, -30 - 3.5])
        finish_mate()
        ms = S.mates()
        chk("Üniversal mafsal oluşturulur, hatasız", ms and ms[0]["type"] == "universal" and not ms[0]["bad"], ms)
        back("Üniversal")
    if want("cam"):
        start("Mekanik", "cam")
        S.click_local(i2, [30 - 3.5, 8, -30 - 3.5])     # takipçi: Plaka2 deliği
        S.click_local(ipn, [5 * 0.7071, 30, 5 * 0.7071])  # kam: pim üst daire kenarı
        txt = A.pmtext()
        finish_mate()
        ms = S.mates()
        h2 = S.world(i2, [30, 5, -30]); pa = S.world(ipn, [0, 30, 0])
        dxz = math.hypot(h2[0] - pa[0], h2[2] - pa[2])
        chk("Kam: takipçi (Ø10 delik) Ø10 kam çemberine teğet → eksenler arası 10", ms and not ms[0]["bad"] and abs(dxz - 10) < 0.1, (dxz, ms and ms[0]["type"], txt[:200].replace("\n", " | ")))
        back("Kam")
    if want("slot"):
        # yuvalı plaka ekle
        S.add_lib("Yuvalı"); S.fit()
        iy = S.comps()[-1]["id"]
        base = S.comps()
        start("Mekanik", "slot")
        S.click_local(ipn, [3.5, 20, 3.5])
        S.click_local(iy, [0, 10, 5])   # yuvanın uzun kenarı (üst)
        txt = A.pmtext()
        A.pmcheck("Yuva boyunca konum (%)", True); A.pmfield("Konum", 50)
        finish_mate()
        ms = S.mates()
        ax = S.world(ipn, [0, 15, 0]); yc = S.world(iy, [0, 0, 0])
        chk("Yuva %50: pim ekseni yuvanın ortasında", ms and not ms[0]["bad"] and math.hypot(ax[0] - yc[0], ax[2] - yc[2]) < 0.1, (ax, yc, txt[:160].replace("\n", " | ")))
        back("Yuva")
    print("hatalar:", A.errs[:5])
    A.close()
finish()

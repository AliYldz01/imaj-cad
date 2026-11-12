// SolidWorks tarzı 3B eskiz çizgi aracı:
// - etkin düzlem XY / YZ / ZX (Tab ile değişir), boşluğa tıklayınca nokta düzlem üzerinde oluşur
// - uzay tutamacı (space handle): son noktada etkin düzlemin eksenleri
// - lastik bant önizleme + canlı uzunluk, X / Y / Z eksenine çıkarım (Along X/Y/Z ilişkisi)
// - mevcut noktalara / model köşelerine yakalama, zincir (her tık yeni çizgi), çift tık / Esc zinciri bitirir
// - rakama basınca uzunluk girişi (yön önizlemeden alınır)
import * as THREE from "three";
import type { Viewer, InputHandler } from "../viewer";
import type { Sketch3DFeature, Vec3 } from "../doc/types";
import { solve3d, dimValue, REL3_TAG, type Solve3Result } from "./solver3d";

export type Axis3 = "x" | "y" | "z";
export const PLANES = ["XY", "YZ", "ZX"] as const;
const PLANE_AX: Record<string, [Axis3, Axis3, Axis3]> = { XY: ["x", "y", "z"], YZ: ["y", "z", "x"], ZX: ["z", "x", "y"] };
const AXV: Record<Axis3, THREE.Vector3> = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
const AXCOL: Record<Axis3, number> = { x: 0xe03131, y: 0x2f9e44, z: 0x1c7ed6 };

export interface S3Ctx {
  viewer: Viewer;
  draft(): (Sketch3DFeature & { _act?: number }) | null;
  /** yakalama adayları (model köşeleri, diğer eskiz noktaları) */
  cands(): Vec3[];
  /** yüzey üzerindeki nokta (model yüzüne tıklama) ve düz yüzse normali */
  surface(x: number, y: number): Vec3 | null;
  faceNormal?(x: number, y: number): Vec3 | null;
  changed(): void;
  hint(t: string): void;
  toast?(t: string, err?: boolean): void;
  /** yalnız seçim değişti: paneli ve çizimi yenile (yeniden kurma yok) */
  selChanged?(): void;
}
export type S3Mode = "line" | "rect" | "point" | "select" | "dim";
export type S3Sel = { k: "p" | "l"; id: string };

type Cand = { p: Vec3; idx: number; ax: Axis3 | null; kind: "pt" | "model" | "axis" | "plane" | "face" };

export class Sketch3DTool {
  plane = 0;
  private g = new THREE.Group();
  private tip: HTMLDivElement;
  private last: Cand | null = null;
  private press: { x: number; y: number } | null = null;
  private lastTap = 0;
  /** 3B eskiz eksen takımı (Ctrl + düz yüz ile hizalanır) */
  axes: Record<Axis3, THREE.Vector3> = { x: AXV.x.clone(), y: AXV.y.clone(), z: AXV.z.clone() };
  private drag: { i: number; moved: boolean } | null = null;
  /** etkin araç (SolidWorks: Çizgi, Dikdörtgen, Nokta, Seç, Akıllı Ölçü) */
  mode: S3Mode = "line";
  sel: S3Sel[] = [];
  private dimPick: S3Sel[] = [];
  private rectP: Vec3 | null = null;
  private hov: S3Sel | null = null;
  private labels: HTMLDivElement;
  last3: Solve3Result | null = null;
  private lastXY: [number, number] = [0, 0];
  constructor(private ctx: S3Ctx) {
    ctx.viewer.overlay.add(this.g);
    this.tip = document.createElement("div");
    this.tip.className = "s3-tip";
    this.tip.style.cssText = "position:fixed;pointer-events:none;z-index:40;font:12px system-ui;background:rgba(255,255,255,.92);border:1px solid #c9d1dc;border-radius:4px;padding:1px 5px;display:none;color:#1f2a37";
    document.body.appendChild(this.tip);
    window.addEventListener("keydown", (e) => this.key(e), true);
    this.labels = document.createElement("div");
    this.labels.className = "s3-labels";
    this.labels.style.cssText = "position:fixed;left:0;top:0;width:0;height:0;z-index:30";
    document.body.appendChild(this.labels);
    ctx.viewer.onRender(() => this.renderLabels());
  }
  active() {
    return !!this.ctx.draft();
  }
  get planeName() {
    return PLANES[this.plane];
  }
  /** zincirin başlangıç (çapa) noktası; -1 = zincir yok */
  anchor(): number {
    const d = this.ctx.draft();
    if (!d) return -1;
    const a = d._act ?? d.xyz.length - 1;
    return a >= 0 && a < d.xyz.length ? a : -1;
  }
  clear() {
    this.g.clear();
    this.tip.style.display = "none";
    this.labels.innerHTML = "";
    this.ctx.viewer.requestRender();
  }
  alignTo(n: Vec3 | null) {
    if (!n) {
      this.axes = { x: AXV.x.clone(), y: AXV.y.clone(), z: AXV.z.clone() };
      this.ctx.hint("3B eskiz eksenleri: global");
    } else {
      const z = new THREE.Vector3(...n).normalize();
      const ref = Math.abs(z.x) < 0.9 ? AXV.x : AXV.z;
      const x = ref.clone().addScaledVector(z, -ref.dot(z)).normalize();
      const y = new THREE.Vector3().crossVectors(z, x);
      this.axes = { x, y, z };
      this.plane = 0;
      this.ctx.hint("3B eskiz eksenleri seçilen yüze hizalandı (XY = yüz). Ctrl + boşluk = global eksenler");
    }
    if (this.last) this.draw(this.last, null);
  }
  cyclePlane(dir = 1) {
    this.plane = (this.plane + dir + 3) % 3;
    this.ctx.hint(`3B eskiz düzlemi: ${this.planeName} (Tab ile değiştir)`);
    if (this.last) this.draw(this.last, null);
  }
  endChain() {
    const d = this.ctx.draft();
    if (!d) return;
    d._act = -1;
    this.last = null;
    this.clear();
    this.ctx.changed();
    this.ctx.hint("Zincir bitti. Yeni çizgi için başlangıç noktasına tıklayın.");
  }

  // ---------- konum hesabı ----------
  private screenOf(p: Vec3) {
    const r = this.ctx.viewer.renderer.domElement.getBoundingClientRect();
    const s = this.ctx.viewer.toScreen(p);
    return [s[0] + r.left, s[1] + r.top];
  }
  /** ekran noktasının dünya konumu (yakalama + düzlem + eksen çıkarımı) */
  locate(x: number, y: number, snap = true): Cand | null {
    const d = this.ctx.draft();
    if (!d) return null;
    const v = this.ctx.viewer;
    const ai = this.mode === "line" ? this.anchor() : -1;
    const A = ai >= 0 ? d.xyz[ai] : this.mode === "rect" ? this.rectP : null;
    // 1) nokta yakalama (ekran mesafesi)
    if (snap) {
      let best: Cand | null = null, bd = 12;
      d.xyz.forEach((p, i) => {
        if (i === ai) return;
        const s = this.screenOf(p), dd = Math.hypot(s[0] - x, s[1] - y);
        if (dd < bd) (bd = dd), (best = { p: [...p] as Vec3, idx: i, ax: null, kind: "pt" });
      });
      for (const p of this.ctx.cands()) {
        const s = this.screenOf(p), dd = Math.hypot(s[0] - x, s[1] - y);
        if (dd < bd) (bd = dd), (best = { p: [...p] as Vec3, idx: -1, ax: null, kind: "model" });
      }
      if (best) {
        const b = best as Cand;
        if (A) b.ax = axisOf(A, b.p);
        return b;
      }
    }
    const ray = v.ray(x, y).ray;
    // 2) çapa varsa: eksen çıkarımı (ekranda eksen yönüne 7° yakınsa o eksene kilitlen)
    if (A && this.mode === "line") {
      const sa = this.screenOf(A);
      const ang = Math.atan2(y - sa[1], x - sa[0]);
      const pd = Math.hypot(x - sa[0], y - sa[1]);
      if (pd > 8) {
        const axes = PLANE_AX[this.planeName];
        let best: { ax: Axis3; p: Vec3; e: number } | null = null;
        // yalnız etkin düzlemin iki ekseni + düzlem normali (SolidWorks: tutamaçtaki üç eksen)
        for (const ax of axes) {
          const tip: Vec3 = [A[0] + this.axes[ax].x, A[1] + this.axes[ax].y, A[2] + this.axes[ax].z];
          const st = this.screenOf(tip);
          const sl = Math.hypot(st[0] - sa[0], st[1] - sa[1]);
          if (sl < 1e-3) continue; // eksen ekrana dik
          const aa = Math.atan2(st[1] - sa[1], st[0] - sa[0]);
          let e = Math.abs(((ang - aa + Math.PI * 3) % (2 * Math.PI)) - Math.PI);
          e = Math.min(e, Math.PI - e);
          if (e < (7 * Math.PI) / 180 && (!best || e < best.e)) {
            const p = closestOnLine(ray, new THREE.Vector3(...A), this.axes[ax]);
            best = { ax, p: [p.x, p.y, p.z], e };
          }
        }
        if (best) return { p: round3(best.p), idx: -1, ax: best.ax, kind: "axis" };
      }
    }
    // 3) model yüzü (çapa yokken veya düzleme kapalı açıda)
    if (!A) {
      const s = this.ctx.surface(x, y);
      if (s) return { p: round3(s), idx: -1, ax: null, kind: "face" };
    }
    // 4) etkin düzlem (çapadan veya orijinden geçen)
    const n = this.axes[PLANE_AX[this.planeName][2]];
    const o = A ? new THREE.Vector3(...A) : new THREE.Vector3();
    let pl = new THREE.Plane().setFromNormalAndCoplanarPoint(n, o);
    if (Math.abs(ray.direction.dot(n)) < 0.08) {
      // düzlem ekrana neredeyse dik: ekrana paralel düzlem kullan
      pl = new THREE.Plane().setFromNormalAndCoplanarPoint(ray.direction.clone().negate(), o);
    }
    const p = new THREE.Vector3();
    if (!ray.intersectPlane(pl, p)) return null;
    return { p: round3([p.x, p.y, p.z]), idx: -1, ax: null, kind: "plane" };
  }

  // ---------- çizim ----------
  private draw(c: Cand | null, ev: { x: number; y: number } | null) {
    const v = this.ctx.viewer;
    this.g.clear();
    const d = this.ctx.draft();
    if (!d) return;
    const ai = this.anchor();
    const A = ai >= 0 ? d.xyz[ai] : null;
    const k = v.worldPerPixel();
    // uzay tutamacı: çapada (yoksa imleçte) etkin düzlemin eksenleri
    const H = A ?? c?.p;
    if (H) {
      const [u, w, nn] = PLANE_AX[this.planeName];
      const L = k * 46;
      for (const ax of [u, w]) {
        const e = this.axes[ax];
        this.g.add(v.fatLines([H[0], H[1], H[2], H[0] + e.x * L, H[1] + e.y * L, H[2] + e.z * L], AXCOL[ax], 2.5));
      }
      const e = this.axes[nn];
      this.g.add(v.fatLines([H[0], H[1], H[2], H[0] + e.x * L * 0.5, H[1] + e.y * L * 0.5, H[2] + e.z * L * 0.5], AXCOL[nn], 1, true));
      // düzlem karesi
      const a = this.axes[u].clone().multiplyScalar(L * 0.7), b = this.axes[w].clone().multiplyScalar(L * 0.7);
      const h = new THREE.Vector3(...H);
      const q = [h.clone(), h.clone().add(a), h.clone().add(a).add(b), h.clone().add(b)];
      const pos: number[] = [];
      for (let i = 0; i < 4; i++) pos.push(...q[i].toArray(), ...q[(i + 1) % 4].toArray());
      this.g.add(v.fatLines(pos, 0xf59f00, 1, true));
    }
    if (c) {
      if (A) this.g.add(v.fatLines([...A, ...c.p], c.ax ? AXCOL[c.ax] : 0xf76707, 2, !c.ax));
      const r = k * 5;
      const p = c.p;
      this.g.add(v.fatLines([p[0] - r, p[1], p[2], p[0] + r, p[1], p[2], p[0], p[1] - r, p[2], p[0], p[1] + r, p[2], p[0], p[1], p[2] - r, p[0], p[1], p[2] + r], c.kind === "pt" || c.kind === "model" ? 0xf59f00 : 0x0ca5e9, c.kind === "pt" || c.kind === "model" ? 3 : 1.5));
    }
    if (c && ev) {
      const parts: string[] = [this.planeName];
      if (A) parts.push(`L ${fmt(Math.hypot(c.p[0] - A[0], c.p[1] - A[1], c.p[2] - A[2]))}`);
      if (c.ax) parts.push(`boyunca ${c.ax.toUpperCase()}`);
      else if (c.kind === "pt" || c.kind === "model") parts.push("nokta");
      this.tip.textContent = parts.join(" · ");
      this.tip.style.left = ev.x + 16 + "px";
      this.tip.style.top = ev.y + 14 + "px";
      this.tip.style.display = "";
    }
    v.requestRender();
  }

  // ---------- ekleme ----------
  /** c konumunu ekle: çapa varsa çizgi oluşturur, zincir devam eder */
  commit(c: Cand) {
    const d = this.ctx.draft();
    if (!d) return;
    const ai = this.anchor();
    let j = c.idx;
    if (j < 0) {
      const ex = d.xyz.findIndex((q) => Math.hypot(q[0] - c.p[0], q[1] - c.p[1], q[2] - c.p[2]) < 1e-6);
      if (ex >= 0) j = ex;
    }
    if (j < 0) {
      d.ids.push(`p${d.seq++}`);
      d.xyz.push(round3(c.p));
      j = d.xyz.length - 1;
    }
    if (ai >= 0 && ai !== j) {
      const a = d.ids[ai], b = d.ids[j];
      const gax = axisOf(d.xyz[ai], d.xyz[j]);
      if (!d.lines.some((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a))) d.lines.push({ id: `l${d.seq++}`, a, b, ...(gax ? { ax: gax } : {}) } as any);
    }
    // var olan noktaya kapanınca SolidWorks zinciri bitirir
    const closed = c.kind === "pt" && ai >= 0;
    d._act = closed ? -1 : j;
    if ((d.cons3?.length || d.dims3?.length)) this.last3 = solve3d(d, [j]);
    this.last = null;
    this.ctx.changed();
    this.ctx.hint(closed ? "Zincir kapandı. Yeni çizgi için başlangıç noktasına tıklayın." : `Sonraki noktaya tıklayın · rakam = uzunluk · Tab = düzlem (${this.planeName}) · çift tık/Esc = bitir`);
  }
  /** uzunluk girişi: önizleme yönünde */
  commitLength(len: number) {
    const d = this.ctx.draft();
    const ai = this.anchor();
    if (!d || ai < 0 || !this.last) return false;
    const A = d.xyz[ai], P = this.last.p;
    const dv = new THREE.Vector3(P[0] - A[0], P[1] - A[1], P[2] - A[2]);
    if (dv.length() < 1e-9) return false;
    dv.normalize().multiplyScalar(len);
    this.commit({ p: [A[0] + dv.x, A[1] + dv.y, A[2] + dv.z], idx: -1, ax: this.last.ax, kind: "axis" });
    return true;
  }

  // ---------- girdi ----------
  input: InputHandler = {
    hover: (e) => {
      if (this.mode === "select" || this.mode === "dim") {
        const h = this.pickEnt(e.clientX, e.clientY);
        if (JSON.stringify(h) !== JSON.stringify(this.hov)) ((this.hov = h), (this.ctx.selChanged ?? this.ctx.changed)());
        return;
      }
      const c = this.locate(e.clientX, e.clientY);
      this.last = c;
      this.draw(c, { x: e.clientX, y: e.clientY });
    },
    down: (e) => {
      this.press = { x: e.clientX, y: e.clientY };
      // var olan noktaya basıldı: sürükleme adayı (SolidWorks: noktayı sürükle)
      const d = this.ctx.draft();
      this.drag = null;
      if (d)
        d.xyz.forEach((p, i) => {
          const sp = this.screenOf(p);
          if (!this.drag && Math.hypot(sp[0] - e.clientX, sp[1] - e.clientY) < 10) this.drag = { i, moved: false };
        });
    },
    move: (e) => {
      const pr = this.press, dg = this.drag;
      if (dg && pr && (dg.moved || Math.hypot(e.clientX - pr.x, e.clientY - pr.y) > 6)) {
        dg.moved = true;
        const d = this.ctx.draft()!;
        const P = d.xyz[dg.i];
        // etkin düzlemde, noktanın içinden geçen düzlemde taşı
        const n = this.axes[PLANE_AX[this.planeName][2]];
        const ray = this.ctx.viewer.ray(e.clientX, e.clientY).ray;
        let pl = new THREE.Plane().setFromNormalAndCoplanarPoint(n, new THREE.Vector3(...P));
        if (Math.abs(ray.direction.dot(n)) < 0.08) pl = new THREE.Plane().setFromNormalAndCoplanarPoint(ray.direction.clone().negate(), new THREE.Vector3(...P));
        const q = new THREE.Vector3();
        if (ray.intersectPlane(pl, q)) {
          d.xyz[dg.i] = round3([q.x, q.y, q.z]);
          this.last3 = solve3d(d, [dg.i]);
          this.ctx.changed();
        }
        return;
      }
      const c = this.locate(e.clientX, e.clientY);
      this.last = c;
      this.draw(c, { x: e.clientX, y: e.clientY });
    },
    up: (e) => {
      const pr = this.press;
      this.press = null;
      const dg = this.drag;
      this.drag = null;
      if (dg?.moved) return;
      if (this.mode === "select" || this.mode === "dim") return this.pickClick(e);
      // Ctrl + düz yüz: eksen takımını yüze hizala (XY = yüz); Ctrl + boşluk: global eksenler
      if (e.ctrlKey || e.metaKey) return this.alignTo(this.ctx.faceNormal?.(e.clientX, e.clientY) ?? null);
      // tıkla-sürükle-bırak: basılan yerden bırakılan yere çizgi
      if (pr && Math.hypot(e.clientX - pr.x, e.clientY - pr.y) > 8 && this.anchor() < 0) {
        const c0 = this.locate(pr.x, pr.y);
        if (c0) this.commit(c0);
      }
      this.tap(e);
    },
    tap: (e) => (this.mode === "select" || this.mode === "dim" ? this.pickClick(e) : this.tap(e)),
  };
  // ---------- seçim / ilişki / ölçü ----------
  setMode(m: S3Mode) {
    this.mode = m;
    this.dimPick = [];
    this.rectP = null;
    const d = this.ctx.draft();
    if (d && m !== "line") d._act = -1;
    this.clear();
    this.ctx.hint(
      m === "line" ? `Çizgi: tıklayarak çizin · Tab = düzlem (${this.planeName})`
      : m === "rect" ? `Dikdörtgen: iki köşeye tıklayın (düzlem ${this.planeName}, Tab ile değiştir)`
      : m === "point" ? "Nokta: tıklayın"
      : m === "dim" ? "Akıllı Ölçü: çizgi (boy), iki nokta (mesafe) veya iki çizgi (açı) seçin"
      : "Seç: nokta / çizgiye tıklayın (Ctrl ile çoklu), sürükleyin; Delete = sil",
    );
    this.ctx.changed();
  }
  /** ekrandaki en yakın nokta (10 px) veya çizgi (8 px) */
  pickEnt(x: number, y: number): S3Sel | null {
    const d = this.ctx.draft();
    if (!d) return null;
    let best: S3Sel | null = null, bd = 10;
    d.xyz.forEach((p, i) => {
      const s = this.screenOf(p), dd = Math.hypot(s[0] - x, s[1] - y);
      if (dd < bd) (bd = dd), (best = { k: "p", id: d.ids[i] });
    });
    if (best) return best;
    bd = 8;
    for (const l of d.lines) {
      const a = this.screenOf(d.xyz[d.ids.indexOf(l.a)]), b = this.screenOf(d.xyz[d.ids.indexOf(l.b)]);
      const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
      const t = L2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L2)) : 0;
      const dd = Math.hypot(a[0] + t * dx - x, a[1] + t * dy - y);
      if (dd < bd) (bd = dd), (best = { k: "l", id: l.id });
    }
    return best;
  }
  private pickClick(e: PointerEvent) {
    const d = this.ctx.draft();
    if (!d) return;
    const en = this.pickEnt(e.clientX, e.clientY);
    if (this.mode === "select") {
      if (!en) this.sel = e.ctrlKey || e.metaKey ? this.sel : [];
      else if (e.ctrlKey || e.metaKey || e.shiftKey) {
        const k = this.sel.findIndex((q) => q.k === en.k && q.id === en.id);
        if (k >= 0) this.sel.splice(k, 1);
        else this.sel.push(en);
      } else this.sel = [en];
      (this.ctx.selChanged ?? this.ctx.changed)();
      return;
    }
    // Akıllı Ölçü
    const P = this.dimPick;
    if (!en) {
      // boşluğa tık: tek çizgi seçiliyse boyunu ölç
      if (P.length === 1 && P[0].k === "l") this.addDim("len", [P[0].id], e);
      this.dimPick = [];
      return this.ctx.changed();
    }
    P.push(en);
    if (P.length === 1 && en.k === "l") {
      // SolidWorks: çizgiye tıklayınca boy ölçüsü; ikinci çizgi seçilirse açı
      this.ctx.hint("Boy için boşluğa tıklayın veya açı için ikinci çizgiyi seçin");
      this.ctx.changed();
      return;
    }
    if (P.length === 2) {
      const [a, b] = P;
      this.dimPick = [];
      if (a.k === "p" && b.k === "p" && a.id !== b.id) this.addDim("dist", [a.id, b.id], e);
      else if (a.k === "l" && b.k === "l" && a.id !== b.id) this.addDim("ang", [a.id, b.id], e);
      else if (a.k === "l" && b.k === "p") this.addDim("len", [a.id], e);
      else this.ctx.toast?.("Bu seçimle ölçü verilemez", true);
    }
    this.ctx.changed();
  }
  addDim(t: "len" | "dist" | "ang", e: string[], ev: { clientX: number; clientY: number }) {
    const d = this.ctx.draft();
    if (!d) return;
    const cur = dimValue(d, t, e);
    this.askValue(ev.clientX, ev.clientY, Math.round(cur * 1000) / 1000, (v) => {
      const dm = { id: `d${d.seq++}`, t, e, v };
      d.dims3 = [...(d.dims3 ?? []), dm];
      if (!this.resolve()) {
        d.dims3 = d.dims3.filter((q) => q !== dm);
        this.resolve();
        this.ctx.toast?.("Bu ölçü eskizi aşırı tanımlar veya çözülemez; eklenmedi", true);
      }
      this.ctx.changed();
    });
  }
  /** çöz; başarısızsa false */
  resolve(hold: number[] = []): boolean {
    const d = this.ctx.draft();
    if (!d) return true;
    const bak = d.xyz.map((p) => [...p] as Vec3);
    this.last3 = solve3d(d, hold);
    if (!this.last3.ok) {
      d.xyz = bak;
      return false;
    }
    return true;
  }
  /** ilişki ekle (seçimden) */
  addRel(t: string) {
    const d = this.ctx.draft();
    if (!d) return;
    const S = this.sel;
    const ids = S.map((q) => q.id);
    const bakL = d.lines.map((l) => ({ ...l })), bakC = [...(d.cons3 ?? [])];
    if (t === "x" || t === "y" || t === "z") {
      for (const q of S) if (q.k === "l") (d.lines.find((l) => l.id === q.id) as any).ax = t;
    } else if (t === "cons") {
      for (const q of S) if (q.k === "l") {
        const l = d.lines.find((z) => z.id === q.id)!;
        l.cons = !l.cons;
      }
      return this.ctx.changed();
    } else if (t === "fix") {
      for (const q of S) if (q.k === "p") d.cons3 = [...(d.cons3 ?? []), { id: `c${d.seq++}`, t: "fix", e: [q.id], p: [...d.xyz[d.ids.indexOf(q.id)]] as Vec3 }];
    } else if (t === "par" || t === "perp" || t === "equal" || t === "collin") {
      const ls = S.filter((q) => q.k === "l").map((q) => q.id);
      for (let i = 1; i < ls.length; i++) d.cons3 = [...(d.cons3 ?? []), { id: `c${d.seq++}`, t: t as any, e: [ls[0], ls[i]] }];
    } else if (t === "mid" || t === "on") {
      const pt = S.find((q) => q.k === "p")!, ln = S.find((q) => q.k === "l")!;
      d.cons3 = [...(d.cons3 ?? []), { id: `c${d.seq++}`, t: t as any, e: [pt.id, ln.id] }];
    } else if (t === "coinc") {
      d.cons3 = [...(d.cons3 ?? []), { id: `c${d.seq++}`, t: "coinc", e: [ids[0], ids[1]] }];
    } else if (t === "parXY" || t === "parYZ" || t === "parZX") {
      for (const q of S) if (q.k === "l") d.cons3 = [...(d.cons3 ?? []), { id: `c${d.seq++}`, t: t as any, e: [q.id] }];
    }
    if (!this.resolve()) {
      d.lines = bakL;
      d.cons3 = bakC;
      this.resolve();
      this.ctx.toast?.("Bu ilişki diğer ilişki/ölçülerle çelişiyor; eklenmedi", true);
    }
    this.ctx.changed();
  }
  /** seçime uygun ilişkiler (SolidWorks "İlişki Ekle") */
  relOptions(): string[] {
    const np = this.sel.filter((q) => q.k === "p").length, nl = this.sel.filter((q) => q.k === "l").length;
    const o: string[] = [];
    if (nl >= 1 && !np) o.push("x", "y", "z", "parXY", "parYZ", "parZX", "cons");
    if (nl >= 2 && !np) o.push("par", "perp", "equal", "collin");
    if (np >= 1 && !nl) o.push("fix");
    if (np === 2 && !nl) o.push("coinc");
    if (np === 1 && nl === 1) o.push("mid", "on");
    return o;
  }
  deleteSel() {
    const d = this.ctx.draft();
    if (!d || !this.sel.length) return;
    const delP = new Set(this.sel.filter((q) => q.k === "p").map((q) => q.id));
    const delL = new Set(this.sel.filter((q) => q.k === "l").map((q) => q.id));
    for (const l of d.lines) if (delP.has(l.a) || delP.has(l.b)) delL.add(l.id);
    d.lines = d.lines.filter((l) => !delL.has(l.id));
    // artık hiçbir çizgide kullanılmayan noktaları da sil (yalnız çizgiye bağlıydıysa)
    const used = new Set(d.lines.flatMap((l) => [l.a, l.b]));
    const keep = d.ids.map((id, i) => !delP.has(id) && (used.has(id) || !this.sel.some((q) => q.k === "l")) ? i : -1).filter((i) => i >= 0);
    d.ids = keep.map((i) => d.ids[i]);
    d.xyz = keep.map((i) => d.xyz[i]);
    const live = (id: string) => d.ids.includes(id) || d.lines.some((l) => l.id === id);
    d.cons3 = (d.cons3 ?? []).filter((c) => c.e.every(live));
    d.dims3 = (d.dims3 ?? []).filter((m) => m.e.every(live));
    d._act = -1;
    this.sel = [];
    this.ctx.changed();
  }
  /** imleç yanında sayı kutusu */
  askValue(x: number, y: number, init: number, cb: (v: number) => void) {
    document.querySelector(".s3-len")?.remove();
    const box = document.createElement("input");
    box.className = "s3-len";
    box.inputMode = "decimal";
    box.value = String(init);
    box.style.cssText = `position:fixed;z-index:41;width:100px;font:15px system-ui;padding:4px;left:${Math.min(innerWidth - 120, x + 12)}px;top:${y + 12}px`;
    let done = false;
    const fin = () => {
      if (done) return;
      done = true;
      const v = parseFloat(box.value.replace(",", "."));
      box.remove();
      if (Number.isFinite(v)) cb(v);
    };
    box.addEventListener("keydown", (ev) => {
      ev.stopPropagation();
      if (ev.key === "Enter") fin();
      else if (ev.key === "Escape") ((done = true), box.remove());
    });
    box.addEventListener("blur", () => setTimeout(fin, 50));
    document.body.appendChild(box);
    box.focus();
    box.select();
  }
  /** ölçü / ilişki etiketleri (ekran üstü) */
  renderLabels() {
    const d = this.ctx.draft();
    if (!d) {
      if (this.labels.childElementCount) this.labels.innerHTML = "";
      return;
    }
    const r = this.ctx.viewer.renderer.domElement.getBoundingClientRect();
    const out: string[] = [];
    const P = (id: string) => d.xyz[d.ids.indexOf(id)];
    const mid = (lid: string, f = 0.5): Vec3 | null => {
      const l = d.lines.find((q) => q.id === lid);
      if (!l) return null;
      const a = P(l.a), b = P(l.b);
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    };
    const at = (p: Vec3 | null, dx = 0, dy = 0) => {
      if (!p) return null;
      const s = this.ctx.viewer.toScreen(p);
      const X = s[0] + dx, Y = s[1] + dy;
      return X < 0 || Y < 0 || X > r.width || Y > r.height ? null : [r.left + X, r.top + Y];
    };
    for (const m of d.dims3 ?? []) {
      const p = m.t === "len" ? mid(m.e[0]) : m.t === "dist" ? (() => { const a = P(m.e[0]), b = P(m.e[1]); return a && b ? ([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2] as Vec3) : null; })() : mid(m.e[0], 0.25);
      const s = at(p, 0, -16);
      if (s) out.push(`<span class="s3-dim" data-id="${m.id}" style="left:${s[0]}px;top:${s[1]}px">${m.t === "ang" ? fmt(m.v) + "°" : fmt(m.v)}</span>`);
    }
    const tags = new Map<string, string[]>();
    const tag = (lid: string, t: string) => tags.set(lid, [...(tags.get(lid) ?? []), t]);
    for (const l of d.lines) if (l.ax) tag(l.id, REL3_TAG[l.ax]);
    for (const c of d.cons3 ?? []) {
      if (c.t === "fix" || c.t === "coinc") continue;
      const lid = c.t === "mid" || c.t === "on" ? c.e[1] : c.e[0];
      tag(lid, REL3_TAG[c.t]);
      if (c.e[1] && c.t !== "mid" && c.t !== "on") tag(c.e[1], REL3_TAG[c.t]);
    }
    for (const [lid, ts] of tags) {
      const s = at(mid(lid, 0.62), 10, 10);
      if (s) out.push(`<span class="s3-rel" style="left:${s[0]}px;top:${s[1]}px">${ts.join(" ")}</span>`);
    }
    for (const c of d.cons3 ?? []) if (c.t === "fix") {
      const s = at(P(c.e[0]), 8, 8);
      if (s) out.push(`<span class="s3-rel" style="left:${s[0]}px;top:${s[1]}px">${REL3_TAG.fix}</span>`);
    }
    const html = out.join("");
    if (this.labels.innerHTML !== html) {
      this.labels.innerHTML = html;
      this.labels.querySelectorAll<HTMLElement>(".s3-dim").forEach((el) =>
        el.addEventListener("click", (ev) => (ev.stopPropagation(), this.editDim(el.dataset.id!, ev))),
      );
    }
  }
  /** ölçü değerini değiştir (çift tık / panel) */
  editDim(id: string, ev?: { clientX: number; clientY: number }, value?: number) {
    const d = this.ctx.draft();
    const m = d?.dims3?.find((q) => q.id === id);
    if (!d || !m) return;
    const apply = (v: number) => {
      const old = m.v;
      m.v = v;
      if (!this.resolve()) {
        m.v = old;
        this.resolve();
        this.ctx.toast?.("Bu değer çözülemedi", true);
      }
      this.ctx.changed();
    };
    if (value !== undefined) return apply(value);
    this.askValue(ev?.clientX ?? 200, ev?.clientY ?? 200, m.v, apply);
  }
  /** seçim vurgusu için çizim listesi (main.ts drawSketches) */
  selSegs(): { pts: number[]; lines: number[] } {
    const d = this.ctx.draft();
    const pts: number[] = [], lines: number[] = [];
    if (!d) return { pts, lines };
    const all = [...this.sel, ...this.dimPick, ...(this.hov ? [this.hov] : [])];
    for (const q of all) {
      if (q.k === "p") pts.push(...d.xyz[d.ids.indexOf(q.id)]);
      else {
        const l = d.lines.find((z) => z.id === q.id);
        if (l) lines.push(...d.xyz[d.ids.indexOf(l.a)], ...d.xyz[d.ids.indexOf(l.b)]);
      }
    }
    return { pts, lines };
  }
  private tap(e: PointerEvent) {
    const now = performance.now();
    const dbl = now - this.lastTap < 350 && Math.hypot(e.clientX - this.lastXY[0], e.clientY - this.lastXY[1]) < 8;
    this.lastTap = now;
    this.lastXY = [e.clientX, e.clientY];
    if (dbl && this.anchor() >= 0) {
      // çift tık: zinciri bitir (ilk tık zaten noktayı ekledi)
      return this.endChain();
    }
    const c = this.locate(e.clientX, e.clientY);
    if (c && this.mode === "point") {
      const d = this.ctx.draft()!;
      d._act = -1;
      if (c.idx < 0) (d.ids.push(`p${d.seq++}`), d.xyz.push(round3(c.p)));
      this.ctx.changed();
    } else if (c && this.mode === "rect") {
      if (!this.rectP) {
        this.rectP = round3(c.p);
        this.ctx.hint("Karşı köşeye tıklayın");
      } else this.addRect(this.rectP, c.p);
    } else if (c) this.commit(c);
    this.draw(this.locate(e.clientX, e.clientY), { x: e.clientX, y: e.clientY });
  }
  /** etkin düzlemde dikdörtgen (4 nokta, 4 çizgi, eksen ilişkileri) */
  addRect(P1: Vec3, P2: Vec3) {
    const d = this.ctx.draft();
    if (!d) return;
    const [ua, va] = PLANE_AX[this.planeName];
    const u = this.axes[ua], v = this.axes[va];
    const w = new THREE.Vector3(P2[0] - P1[0], P2[1] - P1[1], P2[2] - P1[2]);
    const du = w.dot(u), dv = w.dot(v);
    if (Math.abs(du) < 1e-6 || Math.abs(dv) < 1e-6) return this.ctx.toast?.("Dikdörtgen için iki farklı köşe seçin", true);
    const o = new THREE.Vector3(...P1);
    const Q = [o.clone(), o.clone().addScaledVector(u, du), o.clone().addScaledVector(u, du).addScaledVector(v, dv), o.clone().addScaledVector(v, dv)];
    const ids = Q.map((q) => {
      const p = round3([q.x, q.y, q.z]);
      const ex = d.xyz.findIndex((z) => Math.hypot(z[0] - p[0], z[1] - p[1], z[2] - p[2]) < 1e-6);
      if (ex >= 0) return d.ids[ex];
      const id = `p${d.seq++}`;
      d.ids.push(id);
      d.xyz.push(p);
      return id;
    });
    for (let i = 0; i < 4; i++) {
      const a = ids[i], b = ids[(i + 1) % 4];
      const ax = axisOf(d.xyz[d.ids.indexOf(a)], d.xyz[d.ids.indexOf(b)]);
      d.lines.push({ id: `l${d.seq++}`, a, b, ...(ax ? { ax } : {}) } as any);
    }
    this.rectP = null;
    d._act = -1;
    this.ctx.changed();
  }
  private key(e: KeyboardEvent) {
    if (!this.active()) return;
    const t = e.target as HTMLElement;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
    if (e.key === "Tab") {
      e.preventDefault();
      e.stopPropagation();
      this.cyclePlane(e.shiftKey ? -1 : 1);
    } else if ((e.key === "Delete" || e.key === "Backspace") && this.sel.length) {
      e.preventDefault();
      e.stopPropagation();
      this.deleteSel();
    } else if (e.key === "Escape" && (this.rectP || this.dimPick.length || this.sel.length)) {
      e.preventDefault();
      e.stopPropagation();
      this.rectP = null;
      this.dimPick = [];
      this.sel = [];
      this.ctx.changed();
    } else if (e.key === "Escape" && this.mode !== "select" && !(this.mode === "line" && this.anchor() >= 0)) {
      e.preventDefault();
      e.stopPropagation();
      this.setMode("select");
    } else if (e.key === "Escape" && this.anchor() >= 0) {
      e.preventDefault();
      e.stopPropagation();
      this.endChain();
    } else if (/^[0-9.,]$/.test(e.key) && !e.ctrlKey && !e.metaKey && this.anchor() >= 0 && this.last) {
      e.preventDefault();
      e.stopPropagation();
      this.askLength(e.key);
    }
  }
  /** sayıyla uzunluk kutusu (imleç yanında) */
  askLength(first = "") {
    document.querySelector(".s3-len")?.remove();
    const box = document.createElement("input");
    box.className = "s3-len";
    box.inputMode = "decimal";
    box.value = first;
    const r = this.tip.getBoundingClientRect();
    box.style.cssText = `position:fixed;z-index:41;width:90px;font:14px system-ui;left:${r.left || 100}px;top:${(r.bottom || 100) + 2}px`;
    const keep = this.last;
    box.addEventListener("keydown", (ev) => {
      ev.stopPropagation();
      if (ev.key === "Enter") {
        const v = parseFloat(box.value.replace(",", "."));
        box.remove();
        this.last = keep;
        if (v > 0) this.commitLength(v);
      } else if (ev.key === "Escape") box.remove();
    });
    box.addEventListener("blur", () => setTimeout(() => box.remove(), 50));
    document.body.appendChild(box);
    box.focus();
    box.setSelectionRange(box.value.length, box.value.length);
  }
}

export function axisOf(a: Vec3, b: Vec3): Axis3 | null {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const L = Math.hypot(d[0], d[1], d[2]);
  if (L < 1e-9) return null;
  for (let k = 0; k < 3; k++) if (Math.abs(d[k]) / L > 0.99999) return (["x", "y", "z"] as Axis3[])[k];
  return null;
}
function closestOnLine(ray: THREE.Ray, o: THREE.Vector3, dir: THREE.Vector3): THREE.Vector3 {
  // ışın ile doğru (o + t·dir) arasındaki en yakın nokta (doğru üzerinde)
  const w0 = o.clone().sub(ray.origin);
  const a = dir.dot(dir), b = dir.dot(ray.direction), c = ray.direction.dot(ray.direction);
  const d = dir.dot(w0), e = ray.direction.dot(w0);
  const den = a * c - b * b;
  const t = Math.abs(den) < 1e-12 ? 0 : (b * e - c * d) / den;
  return o.clone().addScaledVector(dir, t);
}
const round3 = (p: Vec3): Vec3 => [Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000, Math.round(p[2] * 1000) / 1000];
const fmt = (v: number) => (Math.round(v * 10) / 10).toString();

/** çizgi uzunluğunu değiştir: b ucu ve b tarafındaki bağlı noktalar birlikte kayar (çevrim varsa yalnız b) */
export function setLineLength(f: Sketch3DFeature, lineId: string, len: number) {
  const l = f.lines.find((x) => x.id === lineId);
  if (!l || len <= 0) return;
  const ia = f.ids.indexOf(l.a), ib = f.ids.indexOf(l.b);
  const A = f.xyz[ia], B = f.xyz[ib];
  const dv = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
  const L = Math.hypot(dv[0], dv[1], dv[2]);
  if (L < 1e-9) return;
  const s = len / L - 1;
  const delta: Vec3 = [dv[0] * s, dv[1] * s, dv[2] * s];
  // b tarafındaki bileşen (l hariç)
  const side = new Set<string>([l.b]);
  const st = [l.b];
  while (st.length) {
    const p = st.pop()!;
    for (const x of f.lines) {
      if (x === l) continue;
      const q = x.a === p ? x.b : x.b === p ? x.a : null;
      if (q && !side.has(q)) (side.add(q), st.push(q));
    }
  }
  const move = side.has(l.a) ? [l.b] : [...side];
  for (const id of move) {
    const k = f.ids.indexOf(id);
    f.xyz[k] = round3([f.xyz[k][0] + delta[0], f.xyz[k][1] + delta[1], f.xyz[k][2] + delta[2]]);
  }
}

/** Along X/Y/Z ilişkilerini koru: i noktası taşındıktan sonra eksen ilişkili çizgilerin diğer uçlarını hizalar (basit 3B çözücü) */
export function enforceAlong(f: Sketch3DFeature, i: number) {
  const K = { x: 0, y: 1, z: 2 } as const;
  const seen = new Set<number>([i]);
  const st = [i];
  while (st.length) {
    const pi = st.pop()!;
    const pid = f.ids[pi], P = f.xyz[pi];
    for (const l of f.lines) {
      if (!l.ax || (l.a !== pid && l.b !== pid)) continue;
      const qi = f.ids.indexOf(l.a === pid ? l.b : l.a);
      if (qi < 0 || seen.has(qi)) continue;
      const Q = f.xyz[qi], k = K[l.ax];
      const nq = [0, 1, 2].map((c) => (c === k ? Q[c] : P[c])) as Vec3;
      if (nq.some((v, c) => Math.abs(v - Q[c]) > 1e-9)) {
        f.xyz[qi] = nq;
        seen.add(qi);
        st.push(qi);
      }
    }
  }
}

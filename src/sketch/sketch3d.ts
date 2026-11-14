// SolidWorks tarzı 3B eskiz çizgi aracı:
// - etkin düzlem XY / YZ / ZX (Tab ile değişir), boşluğa tıklayınca nokta düzlem üzerinde oluşur
// - uzay tutamacı (space handle): son noktada etkin düzlemin eksenleri
// - lastik bant önizleme + canlı uzunluk, X / Y / Z eksenine çıkarım (Along X/Y/Z ilişkisi)
// - mevcut noktalara / model köşelerine yakalama, zincir (her tık yeni çizgi), çift tık / Esc zinciri bitirir
// - rakama basınca uzunluk girişi (yön önizlemeden alınır)
import * as THREE from "three";
import type { Viewer, InputHandler } from "../viewer";
import type { Sketch3DFeature, Vec3, Dim3Type } from "../doc/types";
import { evalNum } from "../doc/math";
import { solve3d, dimValue, dofOf, REL3_TAG, arcPts, circum, splinePts3, helixPts3, curves3, type Solve3Result } from "./solver3d";

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
export type S3Mode = "line" | "rect" | "point" | "arc" | "spline" | "trim" | "extend" | "select" | "dim";
export type S3Sel = { k: "p" | "l" | "a" | "c"; id: string };

type Cand = { p: Vec3; idx: number; ax: Axis3 | null; kind: "pt" | "model" | "axis" | "plane" | "face" | "on"; lid?: string; alQ?: string; alK?: 0 | 1 | 2 };

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
  /** seçimi tamamlanmış, yerleştirilmeyi bekleyen ölçü (imleci izler) */
  private dimPend: { t: Dim3Type; e: string[] } | null = null;
  private mouse: [number, number] = [0, 0];
  private rectP: Vec3 | null = null;
  private rectFix = false;
  /** 3 noktalı yay: seçilen başlangıç / bitiş */
  private arcPick: Cand[] = [];
  /** hizalama kılavuzu (mavi kesikli): hizalanan nokta → imleç */
  private guide: [Vec3, Vec3] | null = null;
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
  /** nokta sürükleniyor mu (geri alma anlık görüntüsü sürükleme bitince alınır) */
  dragging() {
    return !!this.drag?.moved;
  }
  /** geçici araç durumunu sıfırla (geri al / ileri al sonrası) */
  reset() {
    document.querySelector(".s3-relbar")?.remove();
    this.selDim = null;
    this.rectP = null;
    this.arcPick = [];
    this.dimPick = [];
    this.dimPend = null;
    this.splP = [];
    this.sel = [];
    this.last = null;
    this.drag = null;
    this.clear();
  }
  /** E-30: Esc — çıkmaz; sırayla bekleyen seçim / ölçü, zincir, araç bırakılır (2B eskiz gibi) */
  escape() {
    if (this.rectP || this.dimPick.length || this.sel.length || this.arcPick.length || this.dimPend || this.selDim) {
      this.selDim = null;
      document.querySelector(".s3-relbar")?.remove();
      this.rectP = null;
      this.arcPick = [];
      this.dimPick = [];
      this.dimPend = null;
      this.sel = [];
      this.ctx.changed();
    } else if (this.mode === "spline" && this.splP.length) this.finishSpline();
    else if (this.mode === "line" && this.anchor() >= 0) this.endChain();
    else if (this.mode !== "select") this.setMode("select");
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
    document.querySelector(".s3-relbar")?.remove();
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
  /** spline aracında toplanan nokta kimlikleri */
  splP: string[] = [];
  finishSpline() {
    const d = this.ctx.draft();
    if (!d) return;
    if (this.splP.length >= 2) d.spl3 = [...(d.spl3 ?? []), { id: `s${d.seq++}`, pts: this.splP.slice() }];
    this.splP = [];
    this.ctx.changed();
    this.ctx.hint("Spline eklendi. Yeni spline için ilk noktaya tıklayın.");
  }
  endChain() {
    const d = this.ctx.draft();
    if (!d) return;
    if (this.mode === "spline") return this.finishSpline();
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
    this.guide = null;
    const d = this.ctx.draft();
    if (!d) return null;
    const v = this.ctx.viewer;
    const ai = this.mode === "line" ? this.anchor() : -1;
    const A = ai >= 0 ? d.xyz[ai] : this.mode === "rect" ? this.rectP : this.mode === "arc" && this.arcPick.length ? this.arcPick[0].p : null;
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
    // 1b) çizgi / yay üzerinde yakalama (SolidWorks: kontur üzerinde, "Üzerinde" ilişkisi); eksen çıkarımından sonra değerlendirilir
    let onHit: { c: Cand; dist: number } | null = null;
    if (snap) {
      let best: Cand | null = null, bd = 9;
      for (const l of d.lines) {
        const ia = d.ids.indexOf(l.a), ib = d.ids.indexOf(l.b);
        if (ia === ai || ib === ai) continue;
        const a = this.screenOf(d.xyz[ia]), b = this.screenOf(d.xyz[ib]);
        const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
        const t = L2 ? ((x - a[0]) * dx + (y - a[1]) * dy) / L2 : -1;
        if (t <= 0.02 || t >= 0.98) continue;
        const dd = Math.hypot(a[0] + t * dx - x, a[1] + t * dy - y);
        if (dd < bd) {
          const A = new THREE.Vector3(...d.xyz[ia]), B = new THREE.Vector3(...d.xyz[ib]);
          const dir = B.clone().sub(A);
          const q = closestOnLine(ray, A, dir.clone().normalize());
          const tt = q.clone().sub(A).dot(dir) / dir.lengthSq();
          if (tt > 0 && tt < 1) (bd = dd), (best = { p: round3([q.x, q.y, q.z]), idx: -1, ax: null, kind: "on", lid: l.id });
        }
      }
      for (const ar of d.arcs3 ?? []) {
        for (const q of arcPts(d.xyz[d.ids.indexOf(ar.a)], d.xyz[d.ids.indexOf(ar.m)], d.xyz[d.ids.indexOf(ar.b)], 48)) {
          const sp = this.screenOf(q), dd = Math.hypot(sp[0] - x, sp[1] - y);
          if (dd < bd) (bd = dd), (best = { p: round3(q), idx: -1, ax: null, kind: "on" });
        }
      }
      if (best) {
        const b = best as Cand;
        if (A) b.ax = axisOf(A, b.p);
        onHit = { c: b, dist: bd };
      }
    }
    if (onHit && (onHit.dist < 4 || !A || this.mode !== "line")) return onHit.c;
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
        if (best) {
          // SolidWorks hizalama çıkarımı: eksen boyunca giderken başka bir noktanın aynı koordinatına yakalan (eşit uzunluk vb.)
          const k = best.ax === "x" ? 0 : best.ax === "y" ? 1 : 2;
          const glob = this.axes[best.ax].x === 1 || this.axes[best.ax].y === 1 || this.axes[best.ax].z === 1;
          if (glob) {
            const sp = this.screenOf(best.p);
            let al: { p: Vec3; q: Vec3; d: number; id?: string } | null = null;
            const qs: { q: Vec3; id?: string }[] = [...d.xyz.map((q, i) => ({ q, id: d.ids[i] })), ...this.ctx.cands().map((q) => ({ q }))];
            for (const { q, id } of qs) {
              if (q === A) continue;
              const P2 = [...best.p] as Vec3;
              P2[k] = q[k];
              const s2 = this.screenOf(P2), dd = Math.hypot(s2[0] - sp[0], s2[1] - sp[1]);
              if (dd < 7 && (!al || dd < al.d) && Math.abs(P2[k] - A[k]) > 1e-6) al = { p: P2, q, d: dd, id };
            }
            if (al) {
              this.guide = [al.q, al.p];
              return { p: round3(al.p), idx: -1, ax: best.ax, kind: "axis", ...(al.id ? { alQ: al.id, alK: k as 0 | 1 | 2 } : {}) };
            }
          }
          return { p: round3(best.p), idx: -1, ax: best.ax, kind: "axis" };
        }
      }
    }
    if (onHit) return onHit.c;
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
    if (c && this.mode === "arc" && this.arcPick.length === 2) {
      const ps = arcPts(this.arcPick[0].p, c.p, this.arcPick[1].p);
      const pos: number[] = [];
      for (let i = 0; i + 1 < ps.length; i++) pos.push(...ps[i], ...ps[i + 1]);
      this.g.add(v.fatLines(pos, 0xf76707, 2));
    } else if (c && this.mode === "arc" && this.arcPick.length === 1) this.g.add(v.fatLines([...this.arcPick[0].p, ...c.p], 0xf76707, 1, true));
    if (c) {
      if (A && this.mode !== "arc") this.g.add(v.fatLines([...A, ...c.p], c.ax ? AXCOL[c.ax] : 0xf76707, 2, !c.ax));
      const r = k * 5;
      const p = c.p;
      this.g.add(v.fatLines([p[0] - r, p[1], p[2], p[0] + r, p[1], p[2], p[0], p[1] - r, p[2], p[0], p[1] + r, p[2], p[0], p[1], p[2] - r, p[0], p[1], p[2] + r], c.kind === "pt" || c.kind === "model" || c.kind === "on" ? 0xf59f00 : 0x0ca5e9, c.kind === "pt" || c.kind === "model" || c.kind === "on" ? 3 : 1.5));
    }
    if (this.guide) this.g.add(v.fatLines([...this.guide[0], ...this.guide[1]], 0x1c7ed6, 1, true));
    if (c && ev) {
      const parts: string[] = [this.planeName];
      if (A) parts.push(`L ${fmt(Math.hypot(c.p[0] - A[0], c.p[1] - A[1], c.p[2] - A[2]))}`);
      if (c.ax) parts.push(`boyunca ${c.ax.toUpperCase()}`);
      else if (c.kind === "pt" || c.kind === "model") parts.push("nokta");
      else if (c.kind === "on") parts.push("üzerinde");
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
      if (c.kind === "on" && c.lid) d.cons3 = [...(d.cons3 ?? []), { id: `c${d.seq++}`, t: "on", e: [d.ids[j], c.lid] }];
      // SolidWorks: orijine / model köşesine yakalanan nokta sabit referansa bağlanır (çakışık → sabit)
      if (c.kind === "model") d.cons3 = [...(d.cons3 ?? []), { id: `c${d.seq++}`, t: "fix", e: [d.ids[j]], p: [...d.xyz[j]] as Vec3 }];
      // mavi hizalama kılavuzu ile konan nokta: hizalandığı noktayla aynı koordinatta kalır
      if (c.alQ && c.alK !== undefined) d.cons3 = [...(d.cons3 ?? []), { id: `c${d.seq++}`, t: (["eqX", "eqY", "eqZ"] as const)[c.alK], e: [c.alQ, d.ids[j]] }];
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
        this.mouse = [e.clientX, e.clientY];
        if (this.dimPend) this.ctx.viewer.requestRender();
        const h = this.pickEnt(e.clientX, e.clientY);
        if (JSON.stringify(h) !== JSON.stringify(this.hov)) ((this.hov = h), (this.ctx.selChanged ?? this.ctx.changed)());
        return;
      }
      const c = this.locate(e.clientX, e.clientY);
      this.last = c;
      this.draw(c, { x: e.clientX, y: e.clientY });
    },
    down: (e) => {
      if (this.selDim) ((this.selDim = null), document.querySelector(".s3-relbar")?.remove(), this.ctx.viewer.requestRender());
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
      if (dg?.moved) return this.ctx.changed();
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
    document.querySelector(".s3-relbar")?.remove();
    this.mode = m;
    this.dimPick = [];
    this.dimPend = null;
    this.rectP = null;
    this.arcPick = [];
    const d = this.ctx.draft();
    if (d && m !== "line") d._act = -1;
    this.clear();
    this.ctx.hint(
      m === "line" ? `Çizgi: tıklayarak çizin · Tab = düzlem (${this.planeName})`
      : m === "rect" ? `Dikdörtgen: iki köşeye tıklayın (düzlem ${this.planeName}, Tab ile değiştir)`
      : m === "point" ? "Nokta: tıklayın"
      : m === "arc" ? "3 noktalı yay: başlangıç, bitiş, sonra yay üzerindeki noktaya tıklayın"
      : m === "trim" ? "Kırp: silinecek çizgi parçasına tıklayın (kesişimlerden bölünür)"
      : m === "extend" ? "Uzat: uzatılacak çizginin ucuna yakın tıklayın"
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
    for (const ar of d.arcs3 ?? []) {
      const pts = arcPts(d.xyz[d.ids.indexOf(ar.a)], d.xyz[d.ids.indexOf(ar.m)], d.xyz[d.ids.indexOf(ar.b)], 24).map((q) => this.screenOf(q));
      for (let i = 0; i + 1 < pts.length; i++) {
        const a = pts[i], b = pts[i + 1];
        const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
        const t = L2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L2)) : 0;
        const dd = Math.hypot(a[0] + t * dx - x, a[1] + t * dy - y);
        if (dd < bd) (bd = dd), (best = { k: "a", id: ar.id });
      }
    }
    // eğriler (spline / helis / kesişim): k "c" (seç + sil)
    for (const cv of curves3(d)) {
      const pts = cv.pts.map((q) => this.screenOf(q));
      for (let i = 0; i + 1 < pts.length; i++) {
        const a = pts[i], b = pts[i + 1];
        const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
        const t = L2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L2)) : 0;
        const dd = Math.hypot(a[0] + t * dx - x, a[1] + t * dy - y);
        if (dd < bd) (bd = dd), (best = { k: "c", id: cv.id });
      }
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
      this.showRelBar(e.clientX, e.clientY);
      return;
    }
    // Akıllı Ölçü (SolidWorks): seçim tamamlanınca ölçü imleci izler, boşluğa tıklayınca yerleşir
    const P = this.dimPick;
    const pend = this.dimPend;
    if (!en) {
      if (pend) this.placeDim(pend.t, pend.e, e);
      this.dimPick = [];
      this.dimPend = null;
      return this.ctx.changed();
    }
    if (P.some((q) => q.k === en.k && q.id === en.id)) return;
    P.push(en);
    const ps = P.filter((q) => q.k === "p"), ls = P.filter((q) => q.k === "l"), as = P.filter((q) => q.k === "a");
    let next: { t: Dim3Type; e: string[] } | null = null;
    if (P.length === 1) {
      if (en.k === "l") next = { t: "len", e: [en.id] };
      if (en.k === "a") next = { t: "rad", e: [en.id] };
    } else if (P.length === 2) {
      if (ps.length === 2) next = { t: "dist", e: [ps[0].id, ps[1].id] };
      else if (ps.length === 1 && ls.length === 1) next = { t: "pl", e: [ps[0].id, ls[0].id] };
      else if (ls.length === 2) {
        const d = this.ctx.draft()!;
        const dir = (lid: string) => {
          const l = d.lines.find((q) => q.id === lid)!;
          const a = d.xyz[d.ids.indexOf(l.a)], b = d.xyz[d.ids.indexOf(l.b)];
          return new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
        };
        const par = Math.abs(dir(ls[0].id).dot(dir(ls[1].id))) > 0.9998;
        next = par ? { t: "ll", e: [ls[0].id, ls[1].id] } : { t: "ang", e: [ls[0].id, ls[1].id] };
      } else if (as.length === 1 && ps.length === 1) next = { t: "pc", e: [ps[0].id, as[0].id] };
    }
    if (!next) {
      this.dimPick = P.length >= 2 ? [] : P;
      this.dimPend = null;
      if (P.length >= 2) this.ctx.toast?.("Bu seçimle ölçü verilemez", true);
      return this.ctx.changed();
    }
    this.dimPend = next;
    this.ctx.hint(next.t === "len" ? "Ölçüyü yerleştirmek için boşluğa tıklayın · açı / mesafe için ikinci çizgiyi veya noktayı seçin" : next.t === "rad" ? "Yarıçap: yerleştirmek için tıklayın (D = çap)" : "Ölçüyü yerleştirmek için boşluğa tıklayın");
    this.ctx.changed();
    this.ctx.viewer.requestRender();
  }
  /** yerleştir: ekran ötelemesini imleçten hesapla, değeri sor, ekle */
  placeDim(t: Dim3Type, e: string[], ev: { clientX: number; clientY: number }) {
    const g = this.dimGeom({ t, e } as any, [ev.clientX, ev.clientY]);
    this.addDim(t, e, ev, g?.o, g && g.k === "ang" ? g.s : undefined);
  }
  addDim(t: Dim3Type, e: string[], ev: { clientX: number; clientY: number }, o?: number, sg?: [number, number]) {
    const d = this.ctx.draft();
    if (!d) return;
    const cur = dimValue(d, t, e, sg);
    this.dimPend = null;
    this.askValue(ev.clientX, ev.clientY, Math.round(cur * 1000) / 1000, (v) => {
      const dm: NonNullable<typeof d.dims3>[number] = { id: `d${d.seq++}`, t, e, v, ...(o !== undefined ? { o } : {}), ...(sg ? { s: sg } : {}) };
      const dof0 = dofOf(d);
      d.dims3 = [...(d.dims3 ?? []), dm];
      // SolidWorks: serbestliği azaltmayan (fazlalık) veya çözülemeyen ölçü aşırı tanımlar
      if (!this.resolve() || dofOf(d) >= dof0) {
        d.dims3 = d.dims3.filter((q) => q !== dm);
        this.resolve();
        // D3-20: 2B ile aynı 3 seçenekli pencere (Sürülen yap / Sürücü olarak bırak / Vazgeç)
        void askRedundant3().then((a) => {
          if (!a) return;
          dm.ref = a === "ref" || undefined;
          dm.v = Math.round(cur * 1000) / 1000;
          d.dims3 = [...(d.dims3 ?? []), dm];
          this.resolve();
          if (a === "keep") this.ctx.toast?.("Eskiz aşırı tanımlı: gereksiz ölçü sürücü olarak bırakıldı", true);
          this.ctx.changed();
        });
        return;
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
    const dof0 = dofOf(d);
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
    } else if (t === "tan") {
      d.cons3 = [...(d.cons3 ?? []), { id: `c${d.seq++}`, t: "tan", e: [ids[0], ids[1]] }];
    } else if (t === "fillet") {
      return this.askValue(innerWidth / 2, innerHeight / 2, 20, (R) => this.fillet(S[0].id, R));
    } else if (t === "mirXY" || t === "mirYZ" || t === "mirZX") {
      return this.mirror(t === "mirXY" ? "z" : t === "mirYZ" ? "x" : "y");
    } else if (t === "parXY" || t === "parYZ" || t === "parZX") {
      for (const q of S) if (q.k === "l") d.cons3 = [...(d.cons3 ?? []), { id: `c${d.seq++}`, t: t as any, e: [q.id] }];
    }
    if (!this.resolve()) {
      d.lines = bakL;
      d.cons3 = bakC;
      this.resolve();
      this.ctx.toast?.("Bu ilişki diğer ilişki/ölçülerle çelişiyor; eklenmedi", true);
    } else if (dofOf(d) >= dof0 && !["fillet", "mirXY", "mirYZ", "mirZX"].includes(t)) {
      // D3-8: serbestliği azaltmayan ilişki gereksizdir (zaten sağlanıyor)
      d.lines = bakL;
      d.cons3 = bakC;
      this.resolve();
      this.ctx.toast?.("Gereksiz ilişki: bu ilişki zaten sağlanıyor; eklenmedi", true);
    }
    this.ctx.changed();
  }
  /** SolidWorks bağlam çubuğu: seçimin yanında ilişki düğmeleri (telefonda panel kapalıyken de) */
  showRelBar(x: number, y: number) {
    document.querySelector(".s3-relbar")?.remove();
    if (!this.sel.length) return;
    const NAMES: Record<string, string> = { x: "X boyunca", y: "Y boyunca", z: "Z boyunca", parXY: "XY'ye paralel", parYZ: "YZ'ye paralel", parZX: "ZX'e paralel", cons: "Yapı geometrisi", par: "Paralel", perp: "Dik", equal: "Eşit", collin: "Doğrusal", fix: "Sabitle", coinc: "Çakışık", mid: "Orta nokta", on: "Üzerinde", tan: "Teğet", fillet: "Radyüs", mirXY: "Ayna XY", mirYZ: "Ayna YZ", mirZX: "Ayna ZX" };
    const bar = document.createElement("div");
    bar.className = "sw-popup s3-relbar";
    bar.style.left = Math.max(4, Math.min(innerWidth - 300, x + 18)) + "px";
    bar.style.top = "-9999px";
    const head = document.createElement("div");
    head.className = "s3-rb-head";
    head.innerHTML = `<span>${this.sel.length} öğe seçili</span>`;
    const x0 = document.createElement("button");
    x0.className = "s3-rb-x";
    x0.textContent = "✕";
    x0.title = "Kapat";
    x0.addEventListener("click", () => bar.remove());
    head.appendChild(x0);
    bar.appendChild(head);
    const section = (title: string) => {
      const g = document.createElement("div");
      g.className = "s3-rb-sec";
      g.innerHTML = `<div class="s3-rb-t">${title}</div>`;
      const row = document.createElement("div");
      row.className = "s3-rb-row";
      g.appendChild(row);
      return { g, row };
    };
    const add = (row: HTMLElement, t: string, fn: () => void, cls = "") => {
      const b = document.createElement("button");
      b.className = "s3-rb" + (cls ? " " + cls : "");
      b.textContent = t;
      b.addEventListener("pointerdown", (ev) => ev.stopPropagation());
      b.addEventListener("click", () => (bar.remove(), fn()));
      row.appendChild(b);
    };
    const rel = section("İlişki ekle"), mir = section("Aynala"), dim = section("Ölçü / düzenle");
    for (const o of this.relOptions()) add(o.startsWith("mir") ? mir.row : rel.row, NAMES[o] ?? o, () => this.addRel(o));
    // seçimden ölçü (SolidWorks: seçili iki öğe → Akıllı Ölçü)
    const S = this.sel;
    if (S.length === 1 && S[0].k === "l") add(dim.row, "Boy ölçüsü", () => this.addDim("len", [S[0].id], { clientX: x, clientY: y }));
    if (S.length === 1 && S[0].k === "a") add(dim.row, "Yarıçap ölçüsü", () => this.addDim("rad", [S[0].id], { clientX: x, clientY: y }));
    if (S.length === 2 && S.every((q) => q.k === "p")) add(dim.row, "Mesafe ölçüsü", () => this.addDim("dist", [S[0].id, S[1].id], { clientX: x, clientY: y }));
    const dd3 = this.ctx.draft(), ax2 = S.map((q) => (dd3?.lines.find((l) => l.id === q.id) as any)?.ax ?? null);
    if (S.length === 2 && S.every((q) => q.k === "l") && !(ax2[0] && ax2[0] === ax2[1])) add(dim.row, "Açı ölçüsü", () => this.addDim("ang", [S[0].id, S[1].id], { clientX: x, clientY: y }));
    add(dim.row, "Sil", () => this.deleteSel(), "del");
    for (const sct of [rel, mir, dim]) if (sct.row.childElementCount) bar.appendChild(sct.g);
    bar.addEventListener("pointerdown", (ev) => ev.stopPropagation());
    document.body.appendChild(bar);
    // imlecin üstüne (seçilecek diğer öğeleri örtmesin); sığmazsa altına
    const hb = bar.offsetHeight;
    bar.style.top = (y - hb - 18 >= 4 ? y - hb - 18 : Math.min(innerHeight - hb - 4, y + 22)) + "px";
  }
  /** seçime uygun ilişkiler (SolidWorks "İlişki Ekle") */
  relOptions(): string[] {
    const o0 = this.relOptions0();
    // D3-21: zaten sağlanan seçenekler sunulmaz (aynı eksen, paralel eksenli çizgiler, sabit nokta)
    const d = this.ctx.draft();
    if (!d) return o0;
    const L = this.sel.filter((q) => q.k === "l").map((q) => d.lines.find((l) => l.id === q.id) as any).filter(Boolean);
    const axes = L.map((l) => l.ax ?? null);
    const sameAx = axes.length > 1 && axes[0] && axes.every((a) => a === axes[0]);
    const fixed = (id: string) => (d.cons3 ?? []).some((c: any) => c.t === "fix" && c.e[0] === id);
    return o0.filter((t) => {
      if ((t === "x" || t === "y" || t === "z") && L.length && L.every((l) => l.ax === t)) return false;
      if ((t === "par" || t === "collin") && sameAx && t === "par") return false;
      if (t === "fix" && this.sel.filter((q) => q.k === "p").every((q) => fixed(q.id))) return false;
      return true;
    });
  }
  private relOptions0(): string[] {
    const np = this.sel.filter((q) => q.k === "p").length, nl = this.sel.filter((q) => q.k === "l").length, na = this.sel.filter((q) => q.k === "a").length;
    const o: string[] = [];
    if (na >= 1 && nl + na === 2 && !np) o.push("tan");
    if (na) return o.concat(np || nl || na ? ["mirXY", "mirYZ", "mirZX"] : []);
    if (nl >= 1 && !np) o.push("x", "y", "z", "parXY", "parYZ", "parZX", "cons");
    if (nl >= 2 && !np) o.push("par", "perp", "equal", "collin");
    if (np >= 1 && !nl) o.push("fix");
    if (np === 2 && !nl) o.push("coinc");
    if (np === 1 && nl === 1) o.push("mid", "on");
    if (np === 1 && !nl && this.cornerLines(this.sel[0].id)) o.push("fillet");
    if (np + nl) o.push("mirXY", "mirYZ", "mirZX");
    return o;
  }
  /** nokta kimliği (varsa yeniden kullan) */
  private ptId(p: Vec3, reuse = true): string {
    const d = this.ctx.draft()!;
    const q = round3(p);
    const ex = reuse ? d.xyz.findIndex((z) => Math.hypot(z[0] - q[0], z[1] - q[1], z[2] - q[2]) < 1e-4) : -1;
    if (ex >= 0) return d.ids[ex];
    const id = `p${d.seq++}`;
    d.ids.push(id);
    d.xyz.push(q);
    return id;
  }
  addArc(A: Cand, B: Cand, M: Cand) {
    const d = this.ctx.draft();
    if (!d) return;
    if (!circum(A.p, M.p, B.p)) return this.ctx.toast?.("Üç nokta aynı doğru üzerinde; yay oluşmaz", true);
    const a = A.idx >= 0 ? d.ids[A.idx] : this.ptId(A.p), b = B.idx >= 0 ? d.ids[B.idx] : this.ptId(B.p);
    const m = this.ptId(M.p, false);
    d.arcs3 = [...(d.arcs3 ?? []), { id: `a${d.seq++}`, a, b, m }];
    d._act = -1;
    this.ctx.changed();
  }
  /** köşe noktasında tam iki çizgi varsa onları döndürür */
  cornerLines(pid: string) {
    const d = this.ctx.draft();
    if (!d) return null;
    const ls = d.lines.filter((l) => l.a === pid || l.b === pid);
    return ls.length === 2 && !(d.arcs3 ?? []).some((a) => a.a === pid || a.b === pid) ? ls : null;
  }
  /** eskiz radyüsü: köşeyi R yarıçaplı teğet yayla yuvarla (SolidWorks Sketch Fillet) */
  fillet(pid: string, R: number) {
    const d = this.ctx.draft();
    const ls = this.cornerLines(pid);
    if (!d || !ls || !(R > 0)) return;
    const P = new THREE.Vector3(...d.xyz[d.ids.indexOf(pid)]);
    const far = (l: { a: string; b: string }) => new THREE.Vector3(...d.xyz[d.ids.indexOf(l.a === pid ? l.b : l.a)]);
    const F1 = far(ls[0]), F2 = far(ls[1]);
    const u1 = F1.clone().sub(P), u2 = F2.clone().sub(P);
    const L1 = u1.length(), L2 = u2.length();
    u1.normalize();
    u2.normalize();
    const th = Math.acos(Math.max(-1, Math.min(1, u1.dot(u2))));
    if (th < 1e-3 || th > Math.PI - 1e-3) return this.ctx.toast?.("Düz devam eden çizgilere radyüs verilemez", true);
    const T = R / Math.tan(th / 2);
    if (T >= L1 - 1e-6 || T >= L2 - 1e-6) return this.ctx.toast?.("Yarıçap bu çizgiler için çok büyük", true);
    const bis = u1.clone().add(u2).normalize();
    const C = P.clone().addScaledVector(bis, R / Math.sin(th / 2));
    const M = C.clone().addScaledVector(bis, -R);
    const t1 = this.ptId(P.clone().addScaledVector(u1, T).toArray() as Vec3, false), t2 = this.ptId(P.clone().addScaledVector(u2, T).toArray() as Vec3, false);
    const m = this.ptId(M.toArray() as Vec3, false);
    ls[0].a === pid ? (ls[0].a = t1) : (ls[0].b = t1);
    ls[1].a === pid ? (ls[1].a = t2) : (ls[1].b = t2);
    const aid = `a${d.seq++}`;
    d.arcs3 = [...(d.arcs3 ?? []), { id: aid, a: t1, b: t2, m }];
    // köşe noktası artık kullanılmıyorsa sil (ona bağlı ilişki/ölçülerle birlikte)
    const stillUsed = d.lines.some((l) => l.a === pid || l.b === pid);
    if (!stillUsed) {
      const k = d.ids.indexOf(pid);
      d.ids.splice(k, 1);
      d.xyz.splice(k, 1);
      d.cons3 = (d.cons3 ?? []).filter((c) => !c.e.includes(pid));
      d.dims3 = (d.dims3 ?? []).filter((q) => !q.e.includes(pid));
    }
    // çizgi boyu ölçüleri artık uca kadar değil: kaldır
    d.dims3 = (d.dims3 ?? []).filter((q) => !(q.t === "len" && (q.e[0] === ls[0].id || q.e[0] === ls[1].id)));
    d.cons3 = [...(d.cons3 ?? []), { id: `c${d.seq++}`, t: "tan", e: [ls[0].id, aid] }, { id: `c${d.seq++}`, t: "tan", e: [ls[1].id, aid] }];
    d.dims3 = [...d.dims3, { id: `d${d.seq++}`, t: "rad", e: [aid], v: R }];
    this.sel = [];
    this.resolve();
    this.ctx.changed();
  }
  /** ayna: seçili varlıkları global düzleme (seçili nokta varsa ondan geçen) göre kopyala */
  mirror(nax: "x" | "y" | "z") {
    const d = this.ctx.draft();
    if (!d) return;
    const k = nax === "x" ? 0 : nax === "y" ? 1 : 2;
    const ptSel = this.sel.filter((q) => q.k === "p");
    const ents = this.sel.filter((q) => q.k !== "p");
    const o = ents.length && ptSel.length === 1 ? d.xyz[d.ids.indexOf(ptSel[0].id)][k] : 0;
    const map = new Map<string, string>();
    const mp = (id: string) => {
      if (map.has(id)) return map.get(id)!;
      const p = [...d.xyz[d.ids.indexOf(id)]] as Vec3;
      if (Math.abs(p[k] - o) < 1e-6) return map.set(id, id), id;
      p[k] = 2 * o - p[k];
      const nid = this.ptId(p);
      map.set(id, nid);
      return nid;
    };
    for (const q of ents) {
      if (q.k === "l") {
        const l = d.lines.find((z) => z.id === q.id)!;
        d.lines.push({ id: `l${d.seq++}`, a: mp(l.a), b: mp(l.b), ...(l.ax ? { ax: l.ax } : {}), ...(l.cons ? { cons: true } : {}) } as any);
      } else {
        const a = d.arcs3!.find((z) => z.id === q.id)!;
        d.arcs3!.push({ id: `a${d.seq++}`, a: mp(a.a), b: mp(a.b), m: mp(a.m) });
      }
    }
    if (!ents.length) for (const q of ptSel) mp(q.id);
    this.sel = [];
    this.ctx.changed();
  }
  /** çizginin diğer çizgilerle kesişim / üzerindeki nokta parametreleri (0..1) */
  private splits(lid: string): number[] {
    const d = this.ctx.draft()!;
    const l = d.lines.find((z) => z.id === lid)!;
    const A = new THREE.Vector3(...d.xyz[d.ids.indexOf(l.a)]), B = new THREE.Vector3(...d.xyz[d.ids.indexOf(l.b)]);
    const D = B.clone().sub(A), L = D.length();
    const u = D.clone().divideScalar(L);
    const ts: number[] = [];
    for (const o of d.lines) {
      if (o === l) continue;
      const C = new THREE.Vector3(...d.xyz[d.ids.indexOf(o.a)]), E = new THREE.Vector3(...d.xyz[d.ids.indexOf(o.b)]);
      const w = E.clone().sub(C), Lw = w.length();
      const v = w.clone().divideScalar(Lw);
      const r = C.clone().sub(A), dd = u.dot(v);
      if (Math.abs(1 - dd * dd) < 1e-9) continue;
      const ta = (r.dot(u) - dd * r.dot(v)) / (1 - dd * dd), tb = (dd * r.dot(u) - r.dot(v)) / (1 - dd * dd);
      if (tb < -1e-6 || tb > Lw + 1e-6) continue;
      const PA = A.clone().addScaledVector(u, ta), PB = C.clone().addScaledVector(v, tb);
      if (PA.distanceTo(PB) < 0.01 && ta > 1e-6 && ta < L - 1e-6) ts.push(ta / L);
    }
    for (const p of d.xyz) {
      const q = new THREE.Vector3(...p);
      const t = q.clone().sub(A).dot(u);
      if (t > 1e-6 && t < L - 1e-6 && A.clone().addScaledVector(u, t).distanceTo(q) < 0.01) ts.push(t / L);
    }
    return [...new Set(ts.map((t) => Math.round(t * 1e6) / 1e6))].sort((a, b) => a - b);
  }
  /** ekrandaki tıklamanın çizgi üzerindeki parametresi */
  private clickParam(lid: string, x: number, y: number) {
    const d = this.ctx.draft()!;
    const l = d.lines.find((z) => z.id === lid)!;
    const a = this.screenOf(d.xyz[d.ids.indexOf(l.a)]), b = this.screenOf(d.xyz[d.ids.indexOf(l.b)]);
    const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
    return L2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L2)) : 0;
  }
  /** kırp: tıklanan parça (iki kesişim arası) silinir */
  trim(lid: string, x: number, y: number) {
    const d = this.ctx.draft()!;
    const l = d.lines.find((z) => z.id === lid)!;
    const ts = [0, ...this.splits(lid), 1];
    const tc = this.clickParam(lid, x, y);
    let k = 0;
    while (k < ts.length - 2 && tc > ts[k + 1]) k++;
    const [t0, t1] = [ts[k], ts[k + 1]];
    const A = d.xyz[d.ids.indexOf(l.a)], B = d.xyz[d.ids.indexOf(l.b)];
    const at = (t: number) => [0, 1, 2].map((c) => A[c] + (B[c] - A[c]) * t) as Vec3;
    d.dims3 = (d.dims3 ?? []).filter((m) => !m.e.includes(lid));
    if (t0 === 0 && t1 === 1) {
      this.sel = [{ k: "l", id: lid }];
      return this.deleteSel();
    }
    if (t0 === 0) l.a = this.ptId(at(t1));
    else if (t1 === 1) l.b = this.ptId(at(t0));
    else {
      const p0 = this.ptId(at(t0)), p1 = this.ptId(at(t1));
      const ob = l.b;
      l.b = p0;
      d.lines.push({ id: `l${d.seq++}`, a: p1, b: ob, ...(l.ax ? { ax: l.ax } : {}), ...(l.cons ? { cons: true } : {}) } as any);
    }
    this.ctx.changed();
  }
  /** uzat: tıklanan uca en yakın uçtan, ileri doğrultudaki ilk çizgiye kadar uzat */
  extend(lid: string, x: number, y: number) {
    const d = this.ctx.draft()!;
    const l = d.lines.find((z) => z.id === lid)!;
    const endB = this.clickParam(lid, x, y) > 0.5;
    const pid = endB ? l.b : l.a, oid = endB ? l.a : l.b;
    if (d.lines.some((z) => z !== l && (z.a === pid || z.b === pid))) return this.ctx.toast?.("Bu uç başka bir çizgiye bağlı; uzatılamaz", true);
    const P = new THREE.Vector3(...d.xyz[d.ids.indexOf(pid)]), O = new THREE.Vector3(...d.xyz[d.ids.indexOf(oid)]);
    const u = P.clone().sub(O).normalize();
    let best = Infinity;
    for (const o of d.lines) {
      if (o === l) continue;
      const C = new THREE.Vector3(...d.xyz[d.ids.indexOf(o.a)]), E = new THREE.Vector3(...d.xyz[d.ids.indexOf(o.b)]);
      const w = E.clone().sub(C), Lw = w.length(), v = w.clone().divideScalar(Lw);
      const r = C.clone().sub(P), dd = u.dot(v);
      if (Math.abs(1 - dd * dd) < 1e-9) continue;
      const ta = (r.dot(u) - dd * r.dot(v)) / (1 - dd * dd), tb = (dd * r.dot(u) - r.dot(v)) / (1 - dd * dd);
      if (ta <= 1e-6 || tb < -1e-6 || tb > Lw + 1e-6) continue;
      if (P.clone().addScaledVector(u, ta).distanceTo(C.clone().addScaledVector(v, tb)) < 0.01 && ta < best) best = ta;
    }
    if (!Number.isFinite(best)) return this.ctx.toast?.("Uzatılacak bir hedef çizgi yok", true);
    d.xyz[d.ids.indexOf(pid)] = round3(P.clone().addScaledVector(u, best).toArray() as Vec3);
    d.dims3 = (d.dims3 ?? []).filter((m) => !m.e.includes(lid));
    this.ctx.changed();
  }
  deleteSel() {
    const d = this.ctx.draft();
    if (!d || !this.sel.length) return;
    const delP = new Set(this.sel.filter((q) => q.k === "p").map((q) => q.id));
    const delL = new Set(this.sel.filter((q) => q.k !== "p").map((q) => q.id));
    for (const l of d.lines) if (delP.has(l.a) || delP.has(l.b)) delL.add(l.id);
    for (const a of d.arcs3 ?? []) if (delP.has(a.a) || delP.has(a.b) || delP.has(a.m)) delL.add(a.id);
    for (const sp of d.spl3 ?? []) if (sp.pts.some((p) => delP.has(p))) delL.add(sp.id);
    d.spl3 = (d.spl3 ?? []).filter((sp) => !delL.has(sp.id));
    d.hel3 = (d.hel3 ?? []).filter((x) => !delL.has(x.id));
    d.isc3 = (d.isc3 ?? []).filter((x) => !delL.has(x.id));
    // silinen yayın yay-üstü noktası da silinir
    for (const a of d.arcs3 ?? []) if (delL.has(a.id)) delP.add(a.m);
    d.lines = d.lines.filter((l) => !delL.has(l.id));
    d.arcs3 = (d.arcs3 ?? []).filter((a) => !delL.has(a.id));
    // artık hiçbir çizgide kullanılmayan noktaları da sil (yalnız çizgiye bağlıydıysa)
    const used = new Set([...d.lines.flatMap((l) => [l.a, l.b]), ...(d.arcs3 ?? []).flatMap((a) => [a.a, a.b, a.m]), ...(d.spl3 ?? []).flatMap((x) => x.pts)]);
    const keep = d.ids.map((id, i) => !delP.has(id) && (used.has(id) || !this.sel.some((q) => q.k === "l")) ? i : -1).filter((i) => i >= 0);
    d.ids = keep.map((i) => d.ids[i]);
    d.xyz = keep.map((i) => d.xyz[i]);
    const live = (id: string) => d.ids.includes(id) || d.lines.some((l) => l.id === id) || !!d.arcs3?.some((a) => a.id === id);
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
    const fin = (blur = false) => {
      if (done) return;
      // D3-12: ifade / değişken kabul edilir ("100*3+20"); geçersizse uygulanmaz
      const v = evalNum(box.value.trim().replace(/^=/, ""));
      if (v === null || !Number.isFinite(v)) {
        if (blur) return void ((done = true), box.remove());
        box.style.outline = "2px solid #e03131";
        return;
      }
      done = true;
      box.remove();
      cb(v); // kutudan çıkmak da değeri kabul eder (SolidWorks)
    };
    box.addEventListener("keydown", (ev) => {
      ev.stopPropagation();
      if (ev.key === "Enter") fin();
      else if (ev.key === "Escape") ((done = true), box.remove());
    });
    box.addEventListener("blur", () => setTimeout(() => fin(true), 50));
    document.body.appendChild(box);
    box.focus();
    box.select();
  }
  /** ölçünün ekran geometrisi (SolidWorks ölçü çizgisi); cur verilirse öteleme imleçten */
  dimGeom(m: { t: Dim3Type; e: string[]; o?: number; s?: [number, number] }, cur?: [number, number]):
    | { k: "lin"; S1: number[]; S2: number[]; E1: number[]; E2: number[]; L: number[]; nrm: number[]; o: number }
    | { k: "ang"; V: number[]; a1: number; a2: number; r: number; L: number[]; o: number; s: [number, number]; ext: number[] }
    | { k: "rad"; C: number[]; A: number[]; B: number[] | null; L: number[]; o: number }
    | null {
    const d = this.ctx.draft();
    if (!d) return null;
    const P = (id: string) => d.xyz[d.ids.indexOf(id)];
    const S = (p: Vec3) => {
      const r = this.ctx.viewer.renderer.domElement.getBoundingClientRect();
      const s = this.ctx.viewer.toScreen(p);
      return [r.left + s[0], r.top + s[1]];
    };
    const ln = (id: string) => {
      const l = d.lines.find((q) => q.id === id);
      return l ? [P(l.a), P(l.b)] : null;
    };
    const foot = (q: Vec3, a: Vec3, b: Vec3): Vec3 => {
      const dv = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L2 = dv[0] ** 2 + dv[1] ** 2 + dv[2] ** 2 || 1;
      const t = ((q[0] - a[0]) * dv[0] + (q[1] - a[1]) * dv[1] + (q[2] - a[2]) * dv[2]) / L2;
      return [a[0] + dv[0] * t, a[1] + dv[1] * t, a[2] + dv[2] * t];
    };
    if (m.t === "rad" || m.t === "dia") {
      const ar = d.arcs3?.find((q) => q.id === m.e[0]);
      if (!ar) return null;
      const A3 = P(ar.a), M3 = P(ar.m), B3 = P(ar.b);
      const C3 = circum(A3, M3, B3);
      if (!C3) return null;
      const C = S(C3.c as Vec3);
      const pts = arcPts(A3, M3, B3, 36).map(S);
      const ang = cur ? Math.atan2(cur[1] - C[1], cur[0] - C[0]) : m.o ?? Math.atan2(S(M3)[1] - C[1], S(M3)[0] - C[0]);
      let A = pts[0], best = Infinity;
      for (const q of pts) {
        const da = Math.abs(Math.atan2(Math.sin(Math.atan2(q[1] - C[1], q[0] - C[0]) - ang), Math.cos(Math.atan2(q[1] - C[1], q[0] - C[0]) - ang)));
        if (da < best) (best = da), (A = q);
      }
      const R = Math.hypot(A[0] - C[0], A[1] - C[1]) || 1;
      const L = [C[0] + Math.cos(ang) * (R + 26), C[1] + Math.sin(ang) * (R + 26)];
      const B = m.t === "dia" ? [2 * C[0] - A[0], 2 * C[1] - A[1]] : null;
      return { k: "rad", C, A, B, L, o: ang };
    }
    if (m.t === "ang") {
      const l1 = ln(m.e[0]), l2 = ln(m.e[1]);
      if (!l1 || !l2) return null;
      const s1 = l1.map(S), s2 = l2.map(S);
      // tepe: ortak nokta, yoksa ekrandaki kesişim
      const near = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.5;
      let V: number[] | null = null;
      for (const a of s1) for (const b of s2) if (!V && near(a, b)) V = a;
      if (!V) {
        const [p, q] = s1, [u, w] = s2;
        const d1 = [q[0] - p[0], q[1] - p[1]], d2 = [w[0] - u[0], w[1] - u[1]];
        const den = d1[0] * d2[1] - d1[1] * d2[0];
        if (Math.abs(den) < 1e-9) return null;
        const t = ((u[0] - p[0]) * d2[1] - (u[1] - p[1]) * d2[0]) / den;
        V = [p[0] + d1[0] * t, p[1] + d1[1] * t];
      }
      // yön işaretleri: imleç hangi iki ışın arasındaysa o açı (SolidWorks: yerleştirme bölgesi)
      const dir = (s: number[][]) => Math.atan2(s[1][1] - s[0][1], s[1][0] - s[0][0]);
      const b1 = dir(s1), b2 = dir(s2);
      const shared = (() => {
        const l1 = d.lines.find((q) => q.id === m.e[0])!, l2 = d.lines.find((q) => q.id === m.e[1])!;
        const sh = [l1.a, l1.b].find((q) => q === l2.a || q === l2.b);
        return sh === undefined ? null : ([sh === l1.a ? 1 : -1, sh === l2.a ? 1 : -1] as [number, number]);
      })();
      let sg: [number, number] = m.s ?? shared ?? [1, 1];
      const wrapA = (x: number) => Math.atan2(Math.sin(x), Math.cos(x));
      if (cur) {
        const ac = Math.atan2(cur[1] - V[1], cur[0] - V[0]);
        for (const c of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as [number, number][]) {
          const r1 = b1 + (c[0] < 0 ? Math.PI : 0), r2 = b2 + (c[1] < 0 ? Math.PI : 0);
          const span = wrapA(r2 - r1), off = wrapA(ac - r1);
          if ((span >= 0 && off >= 0 && off <= span) || (span < 0 && off <= 0 && off >= span)) {
            sg = c;
            break;
          }
        }
      }
      const a1 = b1 + (sg[0] < 0 ? Math.PI : 0);
      const a2 = a1 + wrapA(b2 + (sg[1] < 0 ? Math.PI : 0) - a1);
      const r = cur ? Math.max(14, Math.hypot(cur[0] - V[0], cur[1] - V[1])) : m.o ?? 40;
      const am = (a1 + a2) / 2;
      // ışın segmentin üzerinde değilse uzatma çizgisi gerekir
      const onSeg = (sArr: number[][], a: number) => sArr.some((q) => Math.hypot(q[0] - V![0], q[1] - V![1]) > 1 && Math.cos(Math.atan2(q[1] - V![1], q[0] - V![0]) - a) > 0.99);
      const ext = [onSeg(s1, a1) ? 0 : 1, onSeg(s2, a2) ? 0 : 1];
      return { k: "ang", V, a1, a2, r, L: [V[0] + Math.cos(am) * (r + 14), V[1] + Math.sin(am) * (r + 14)], o: r, s: sg, ext };
    }
    // doğrusal: iki uç nokta
    let p1: Vec3, p2: Vec3;
    if (m.t === "len") {
      const l = ln(m.e[0]);
      if (!l) return null;
      [p1, p2] = l as [Vec3, Vec3];
    } else if (m.t === "dist") [p1, p2] = [P(m.e[0]), P(m.e[1])];
    else if (m.t === "pc") {
      const ar = d.arcs3?.find((q) => q.id === m.e[1]);
      const C3 = ar && circum(P(ar.a), P(ar.m), P(ar.b));
      if (!C3) return null;
      [p1, p2] = [P(m.e[0]), C3.c as Vec3];
    }
    else if (m.t === "pl") {
      const l = ln(m.e[1]);
      if (!l) return null;
      p1 = P(m.e[0]);
      p2 = foot(p1, l[0], l[1]);
    } else {
      const l1 = ln(m.e[0]), l2 = ln(m.e[1]);
      if (!l1 || !l2) return null;
      p1 = [(l2[0][0] + l2[1][0]) / 2, (l2[0][1] + l2[1][1]) / 2, (l2[0][2] + l2[1][2]) / 2];
      p2 = foot(p1, l1[0], l1[1]);
    }
    if (!p1 || !p2) return null;
    const S1 = S(p1), S2 = S(p2);
    let ux = S2[0] - S1[0], uy = S2[1] - S1[1];
    const L0 = Math.hypot(ux, uy);
    if (L0 < 1e-6) (ux = 1), (uy = 0);
    else (ux /= L0), (uy /= L0);
    const nrm = [-uy, ux];
    const o = cur ? (cur[0] - S1[0]) * nrm[0] + (cur[1] - S1[1]) * nrm[1] : m.o ?? 24;
    const E1 = [S1[0] + nrm[0] * o, S1[1] + nrm[1] * o], E2 = [S2[0] + nrm[0] * o, S2[1] + nrm[1] * o];
    const L = [(E1[0] + E2[0]) / 2 + nrm[0] * Math.sign(o || 1) * 12, (E1[1] + E2[1]) / 2 + nrm[1] * Math.sign(o || 1) * 12];
    return { k: "lin", S1, S2, E1, E2, L, nrm, o };
  }
  private dimGeo = new Map<string, NonNullable<ReturnType<Sketch3DTool["dimGeom"]>>>();
  /** seçili ölçü (SolidWorks: tek tık seç, çift tık düzenle) */
  selDim: string | null = null;
  private dimClickT = 0;
  /** seçili ölçünün bağlam çubuğu */
  private showDimBar(id: string, x: number, y: number) {
    document.querySelector(".s3-relbar")?.remove();
    const d = this.ctx.draft();
    const m = d?.dims3?.find((q) => q.id === id);
    if (!d || !m) return;
    const bar = document.createElement("div");
    bar.className = "sw-popup s3-relbar";
    bar.style.left = Math.max(4, Math.min(innerWidth - 300, x + 18)) + "px";
    bar.style.top = Math.max(4, y + 18) + "px";
    bar.innerHTML = `<div class="s3-rb-head"><span>Ölçü ${m.ref ? "(sürülen)" : ""}</span></div><div class="s3-rb-sec"><div class="s3-rb-row"></div></div>`;
    const row = bar.querySelector(".s3-rb-row")!;
    const add = (t: string, fn: () => void, cls = "") => {
      const b = document.createElement("button");
      b.className = "s3-rb" + (cls ? " " + cls : "");
      b.textContent = t;
      b.addEventListener("pointerdown", (ev) => ev.stopPropagation());
      b.addEventListener("click", () => (bar.remove(), fn()));
      row.appendChild(b);
    };
    if (!m.ref) add("Değeri değiştir…", () => this.editDim(id, { clientX: x, clientY: y }));
    add(m.ref ? "Sürücü yap" : "Sürülen yap", () => this.toggleRef(id));
    add("Sil", () => this.deleteDim(id), "del");
    add("✕", () => ((this.selDim = null), this.ctx.viewer.requestRender()));
    bar.addEventListener("pointerdown", (ev) => ev.stopPropagation());
    document.body.appendChild(bar);
  }
  deleteDim(id: string) {
    const d = this.ctx.draft();
    if (!d) return;
    d.dims3 = (d.dims3 ?? []).filter((q) => q.id !== id);
    if (this.selDim === id) this.selDim = null;
    document.querySelector(".s3-relbar")?.remove();
    this.resolve();
    this.ctx.changed();
  }
  /** sürücü ↔ sürülen (referans) ölçü */
  toggleRef(id: string) {
    const d = this.ctx.draft();
    const m = d?.dims3?.find((q) => q.id === id);
    if (!d || !m) return;
    if (m.ref) {
      const dof0 = dofOf(d);
      m.ref = undefined;
      m.v = Math.round(dimValue(d, m.t, m.e, m.s) * 1000) / 1000;
      if (!this.resolve() || dofOf(d) >= dof0) {
        m.ref = true;
        this.resolve();
        this.ctx.toast?.("Sürücü yapılamaz: eskizi aşırı tanımlar", true);
      }
    } else m.ref = true;
    this.ctx.changed();
  }
  /** ölçü / ilişki etiketleri ve ölçü çizgileri (ekran üstü) */
  renderLabels() {
    const d = this.ctx.draft();
    if (!d) {
      if (this.labels.childElementCount) this.labels.innerHTML = "";
      return;
    }
    const r = this.ctx.viewer.renderer.domElement.getBoundingClientRect();
    const out: string[] = [];
    const svg: string[] = [];
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
    const inView = (q: number[]) => q[0] >= r.left && q[1] >= r.top && q[0] <= r.right && q[1] <= r.bottom;
    const f2 = (v: number) => v.toFixed(1);
    const arrow = (T: number[], from: number[], col: string) => {
      let dx = T[0] - from[0], dy = T[1] - from[1];
      const L = Math.hypot(dx, dy) || 1;
      (dx /= L), (dy /= L);
      const b = [T[0] - dx * 9, T[1] - dy * 9];
      return `<polygon points="${f2(T[0])},${f2(T[1])} ${f2(b[0] - dy * 3.2)},${f2(b[1] + dx * 3.2)} ${f2(b[0] + dy * 3.2)},${f2(b[1] - dx * 3.2)}" fill="${col}"/>`;
    };
    const line = (a: number[], b: number[], col: string, dash = false) => `<line x1="${f2(a[0])}" y1="${f2(a[1])}" x2="${f2(b[0])}" y2="${f2(b[1])}" stroke="${col}" stroke-width="1.2"${dash ? ' stroke-dasharray="4 3"' : ""}/>`;
    const drawDim = (g: NonNullable<ReturnType<Sketch3DTool["dimGeom"]>>, col: string) => {
      if (g.k === "lin") {
        const sg = Math.sign(g.o || 1);
        const ext = (S: number[], E: number[]) => line([S[0] + g.nrm[0] * sg * 3, S[1] + g.nrm[1] * sg * 3], [E[0] + g.nrm[0] * sg * 5, E[1] + g.nrm[1] * sg * 5], col);
        svg.push(ext(g.S1, g.E1), ext(g.S2, g.E2), line(g.E1, g.E2, col));
        const span = Math.hypot(g.E2[0] - g.E1[0], g.E2[1] - g.E1[1]);
        if (span > 24) svg.push(arrow(g.E1, g.E2, col), arrow(g.E2, g.E1, col));
        else {
          // dar ölçü: oklar dışarıdan
          const ux = (g.E2[0] - g.E1[0]) / (span || 1), uy = (g.E2[1] - g.E1[1]) / (span || 1);
          svg.push(arrow(g.E1, [g.E1[0] - ux * 12, g.E1[1] - uy * 12], col), arrow(g.E2, [g.E2[0] + ux * 12, g.E2[1] + uy * 12], col));
        }
      } else if (g.k === "ang") {
        const n = 24, pts: string[] = [];
        for (let i = 0; i <= n; i++) {
          const a = g.a1 + ((g.a2 - g.a1) * i) / n;
          pts.push(`${f2(g.V[0] + Math.cos(a) * g.r)},${f2(g.V[1] + Math.sin(a) * g.r)}`);
        }
        svg.push(`<polyline points="${pts.join(" ")}" fill="none" stroke="${col}" stroke-width="1.2"/>`);
        ([g.a1, g.a2] as number[]).forEach((a, i) => g.ext[i] && svg.push(line(g.V, [g.V[0] + Math.cos(a) * (g.r + 8), g.V[1] + Math.sin(a) * (g.r + 8)], col, true)));
        const P1 = [g.V[0] + Math.cos(g.a1) * g.r, g.V[1] + Math.sin(g.a1) * g.r], P2 = [g.V[0] + Math.cos(g.a2) * g.r, g.V[1] + Math.sin(g.a2) * g.r];
        const s = Math.sign(g.a2 - g.a1) || 1;
        svg.push(arrow(P1, [P1[0] - Math.sin(g.a1) * s * 10, P1[1] + Math.cos(g.a1) * s * 10], col), arrow(P2, [P2[0] + Math.sin(g.a2) * s * 10, P2[1] - Math.cos(g.a2) * s * 10], col));
      } else {
        svg.push(line(g.B ?? g.C, g.L, col), arrow(g.A, g.L, col));
        if (g.B) svg.push(arrow(g.B, g.A, col));
        else svg.push(`<circle cx="${f2(g.C[0])}" cy="${f2(g.C[1])}" r="2.5" fill="${col}"/>`);
      }
    };
    this.dimGeo.clear();
    for (const m of d.dims3 ?? []) {
      const g = this.dimGeom(m);
      if (!g || !inView(g.L)) continue;
      this.dimGeo.set(m.id, g);
      const col = this.selDim === m.id ? "#e8590c" : m.ref ? "#6b7686" : "#1c7ed6";
      drawDim(g, col);
      const v = m.ref ? dimValue(d, m.t, m.e, m.s) : m.v;
      const txt = (m.t === "rad" ? "R" : m.t === "dia" ? "Ø" : "") + fmt(v) + (m.t === "ang" ? "°" : "");
      out.push(`<span class="s3-dim${m.ref ? " ref" : ""}${this.selDim === m.id ? " sel" : ""}" data-id="${m.id}" style="left:${g.L[0]}px;top:${g.L[1]}px">${m.ref ? "(" + txt + ")" : txt}</span>`);
    }
    // yerleştirilmeyi bekleyen ölçü (imleci izler)
    if (this.dimPend && this.mode === "dim") {
      const g = this.dimGeom({ t: this.dimPend.t, e: this.dimPend.e }, this.mouse);
      if (g) {
        drawDim(g, "#f76707");
        const v = dimValue(d, this.dimPend.t, this.dimPend.e, g.k === "ang" ? g.s : undefined);
        const t = this.dimPend.t;
        out.push(`<span class="s3-dim ghost" style="left:${g.L[0]}px;top:${g.L[1]}px">${(t === "rad" ? "R" : t === "dia" ? "Ø" : "") + fmt(v) + (t === "ang" ? "°" : "")}</span>`);
      }
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
    const clip = `<clipPath id="s3clip"><rect x="${r.left}" y="${r.top}" width="${r.width}" height="${r.height}"/></clipPath>`;
    const html = (svg.length ? `<svg class="s3-dimsvg" width="${innerWidth}" height="${innerHeight}">${clip}<g clip-path="url(#s3clip)">${svg.join("")}</g></svg>` : "") + out.join("");
    if (this.labels.innerHTML !== html) {
      this.labels.innerHTML = html;
      this.labels.querySelectorAll<HTMLElement>(".s3-dim:not(.ghost)").forEach((el) => el.addEventListener("pointerdown", (ev) => this.dimDrag(el.dataset.id!, ev)));
    }
  }
  /** ölçü etiketini sürükle (konum) / tıkla (değer) */
  private dimDrag(id: string, ev: PointerEvent) {
    ev.stopPropagation();
    ev.preventDefault();
    const d = this.ctx.draft();
    const m = d?.dims3?.find((q) => q.id === id);
    if (!d || !m) return;
    const x0 = ev.clientX, y0 = ev.clientY;
    let moved = false;
    const mv = (e: PointerEvent) => {
      if (!moved && Math.hypot(e.clientX - x0, e.clientY - y0) < 4) return;
      moved = true;
      const g = this.dimGeom(m, [e.clientX, e.clientY]);
      if (g) m.o = g.o;
      if (g && g.k === "ang" && (!m.s || g.s[0] * g.s[1] !== m.s[0] * m.s[1])) {
        m.s = g.s;
        m.v = Math.round(dimValue(d, m.t, m.e, m.s) * 1000) / 1000;
      } else if (g && g.k === "ang") m.s = g.s;
      this.ctx.viewer.requestRender();
    };
    const up = (e: PointerEvent) => {
      removeEventListener("pointermove", mv);
      removeEventListener("pointerup", up);
      if (moved) return this.ctx.changed();
      const now = performance.now();
      const dbl = now - this.dimClickT < 400 && this.selDim === id;
      this.dimClickT = now;
      this.selDim = id;
      this.ctx.viewer.requestRender();
      if (dbl && !m.ref) {
        document.querySelector(".s3-relbar")?.remove();
        return this.editDim(id, e);
      }
      this.showDimBar(id, e.clientX, e.clientY);
    };
    addEventListener("pointermove", mv);
    addEventListener("pointerup", up);
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
      else if (q.k === "c") {
        const cv = curves3(d).find((z) => z.id === q.id);
        if (cv) for (let i = 0; i + 1 < cv.pts.length; i++) lines.push(...cv.pts[i], ...cv.pts[i + 1]);
      } else if (q.k === "a") {
        const ar = d.arcs3?.find((z) => z.id === q.id);
        if (ar) {
          const ps = arcPts(d.xyz[d.ids.indexOf(ar.a)], d.xyz[d.ids.indexOf(ar.m)], d.xyz[d.ids.indexOf(ar.b)]);
          for (let i = 0; i + 1 < ps.length; i++) lines.push(...ps[i], ...ps[i + 1]);
        }
      } else {
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
    if (this.mode === "trim" || this.mode === "extend") {
      const en = this.pickEnt(e.clientX, e.clientY);
      if (en?.k === "l") this.mode === "trim" ? this.trim(en.id, e.clientX, e.clientY) : this.extend(en.id, e.clientX, e.clientY);
      else this.ctx.toast?.("Bir çizgiye tıklayın", true);
      return;
    }
    const c = this.locate(e.clientX, e.clientY);
    if (c && this.mode === "arc") {
      this.arcPick.push(c);
      if (this.arcPick.length === 3) {
        const [A, B, M] = this.arcPick;
        this.arcPick = [];
        this.addArc(A, B, M);
      } else this.ctx.hint(this.arcPick.length === 1 ? "Yayın bitiş noktasına tıklayın" : "Yay üzerindeki bir noktaya tıklayın (yay düzlemi ve yarıçap)");
      this.draw(c, { x: e.clientX, y: e.clientY });
      return;
    }
    if (c && this.mode === "spline") {
      // SolidWorks 3B spline: noktalara tıkla, çift tık / Enter ile bitir
      const d = this.ctx.draft()!;
      d._act = -1;
      let id: string;
      if (c.idx >= 0) id = d.ids[c.idx];
      else {
        id = `p${d.seq++}`;
        d.ids.push(id);
        d.xyz.push(round3(c.p));
      }
      if (this.splP[this.splP.length - 1] !== id) this.splP.push(id);
      if (dbl) return this.finishSpline();
      this.ctx.hint(`${this.splP.length} nokta · sonraki noktaya tıklayın; bitirmek için çift tık / Enter`);
      this.ctx.changed();
      return;
    }
    if (c && this.mode === "point") {
      const d = this.ctx.draft()!;
      d._act = -1;
      if (c.idx < 0) (d.ids.push(`p${d.seq++}`), d.xyz.push(round3(c.p)));
      this.ctx.changed();
    } else if (c && this.mode === "rect") {
      if (!this.rectP) {
        this.rectP = round3(c.p);
        this.rectFix = c.kind === "model";
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
    if (this.rectFix && !(d.cons3 ?? []).some((c) => c.t === "fix" && c.e[0] === ids[0])) d.cons3 = [...(d.cons3 ?? []), { id: `c${d.seq++}`, t: "fix", e: [ids[0]], p: [...d.xyz[d.ids.indexOf(ids[0])]] as Vec3 }];
    this.rectP = null;
    this.rectFix = false;
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
    } else if ((e.key === "Delete" || e.key === "Backspace") && this.selDim) {
      e.preventDefault();
      e.stopPropagation();
      this.deleteDim(this.selDim);
    } else if ((e.key === "Delete" || e.key === "Backspace") && this.sel.length) {
      e.preventDefault();
      e.stopPropagation();
      this.deleteSel();
    } else if ((e.key === "d" || e.key === "D") && this.dimPend && (this.dimPend.t === "rad" || this.dimPend.t === "dia")) {
      // yarıçap ↔ çap
      e.preventDefault();
      e.stopPropagation();
      this.dimPend = { ...this.dimPend, t: this.dimPend.t === "rad" ? "dia" : "rad" };
      this.ctx.viewer.requestRender();
    } else if (e.key === "Escape" && !document.querySelector("dialog[open]")) {
      e.preventDefault();
      e.stopPropagation();
      this.escape();
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
        const v = evalNum(box.value.trim().replace(/^=/, ""));
        if (v === null || !(v > 0)) return void (box.style.outline = "2px solid #e03131");
        box.remove();
        this.last = keep;
        this.commitLength(v);
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

export { curves3 } from "./solver3d";

/** D3-20: gereksiz 3B ölçü penceresi (2B `askRedundant` ile aynı seçenekler) */
function askRedundant3(): Promise<"ref" | "keep" | null> {
  return new Promise((res) => {
    const d = document.createElement("dialog");
    d.className = "redund-dlg";
    d.innerHTML = `<h3>Gereksiz ölçü</h3><p>Bu ölçü eskizi aşırı tanımlıyor (değer zaten diğer ölçü / ilişkilerle belirli).</p>`;
    const row = document.createElement("div");
    row.className = "pm-row";
    const b = (t: string, v: "ref" | "keep" | null, cls = "btn") => {
      const x = document.createElement("button");
      x.className = cls;
      x.textContent = t;
      x.addEventListener("click", () => (d.close(), d.remove(), res(v)));
      row.appendChild(x);
    };
    b("Sürülen (referans) yap", "ref", "btn primary");
    b("Sürücü olarak bırak (aşırı tanımlı)", "keep");
    b("Vazgeç", null);
    d.appendChild(row);
    d.addEventListener("cancel", () => (d.remove(), res(null)));
    document.body.appendChild(d);
    // Enter ile onaylanan ölçü kutusunun tuşu ilk düğmeyi tetiklemesin: pencere tuş bittikten sonra açılır, odak başlıkta
    setTimeout(() => {
      d.showModal();
      const h = d.querySelector("h3") as HTMLElement;
      h.tabIndex = -1;
      h.focus();
    }, 0);
  });
}

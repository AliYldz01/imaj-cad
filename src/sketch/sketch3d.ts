// SolidWorks tarzı 3B eskiz çizgi aracı:
// - etkin düzlem XY / YZ / ZX (Tab ile değişir), boşluğa tıklayınca nokta düzlem üzerinde oluşur
// - uzay tutamacı (space handle): son noktada etkin düzlemin eksenleri
// - lastik bant önizleme + canlı uzunluk, X / Y / Z eksenine çıkarım (Along X/Y/Z ilişkisi)
// - mevcut noktalara / model köşelerine yakalama, zincir (her tık yeni çizgi), çift tık / Esc zinciri bitirir
// - rakama basınca uzunluk girişi (yön önizlemeden alınır)
import * as THREE from "three";
import type { Viewer, InputHandler } from "../viewer";
import type { Sketch3DFeature, Vec3 } from "../doc/types";

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
  /** yüzey üzerindeki nokta (model yüzüne tıklama) */
  surface(x: number, y: number): Vec3 | null;
  changed(): void;
  hint(t: string): void;
}

type Cand = { p: Vec3; idx: number; ax: Axis3 | null; kind: "pt" | "model" | "axis" | "plane" | "face" };

export class Sketch3DTool {
  plane = 0;
  private g = new THREE.Group();
  private tip: HTMLDivElement;
  private last: Cand | null = null;
  private press: { x: number; y: number } | null = null;
  private lastTap = 0;
  private lastXY: [number, number] = [0, 0];
  constructor(private ctx: S3Ctx) {
    ctx.viewer.overlay.add(this.g);
    this.tip = document.createElement("div");
    this.tip.className = "s3-tip";
    this.tip.style.cssText = "position:fixed;pointer-events:none;z-index:40;font:12px system-ui;background:rgba(255,255,255,.92);border:1px solid #c9d1dc;border-radius:4px;padding:1px 5px;display:none;color:#1f2a37";
    document.body.appendChild(this.tip);
    window.addEventListener("keydown", (e) => this.key(e), true);
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
    this.ctx.viewer.requestRender();
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
    const ai = this.anchor();
    const A = ai >= 0 ? d.xyz[ai] : null;
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
    if (A) {
      const sa = this.screenOf(A);
      const ang = Math.atan2(y - sa[1], x - sa[0]);
      const pd = Math.hypot(x - sa[0], y - sa[1]);
      if (pd > 8) {
        const axes = PLANE_AX[this.planeName];
        let best: { ax: Axis3; p: Vec3; e: number } | null = null;
        // yalnız etkin düzlemin iki ekseni + düzlem normali (SolidWorks: tutamaçtaki üç eksen)
        for (const ax of axes) {
          const tip: Vec3 = [A[0] + AXV[ax].x, A[1] + AXV[ax].y, A[2] + AXV[ax].z];
          const st = this.screenOf(tip);
          const sl = Math.hypot(st[0] - sa[0], st[1] - sa[1]);
          if (sl < 1e-3) continue; // eksen ekrana dik
          const aa = Math.atan2(st[1] - sa[1], st[0] - sa[0]);
          let e = Math.abs(((ang - aa + Math.PI * 3) % (2 * Math.PI)) - Math.PI);
          e = Math.min(e, Math.PI - e);
          if (e < (7 * Math.PI) / 180 && (!best || e < best.e)) {
            const p = closestOnLine(ray, new THREE.Vector3(...A), AXV[ax]);
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
    const n = AXV[PLANE_AX[this.planeName][2]];
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
        const e = AXV[ax];
        this.g.add(v.fatLines([H[0], H[1], H[2], H[0] + e.x * L, H[1] + e.y * L, H[2] + e.z * L], AXCOL[ax], 2.5));
      }
      const e = AXV[nn];
      this.g.add(v.fatLines([H[0], H[1], H[2], H[0] + e.x * L * 0.5, H[1] + e.y * L * 0.5, H[2] + e.z * L * 0.5], AXCOL[nn], 1, true));
      // düzlem karesi
      const a = AXV[u].clone().multiplyScalar(L * 0.7), b = AXV[w].clone().multiplyScalar(L * 0.7);
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
      if (!d.lines.some((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a))) d.lines.push({ id: `l${d.seq++}`, a, b, ...(c.ax ? { ax: c.ax } : {}) } as any);
    }
    // var olan noktaya kapanınca SolidWorks zinciri bitirir
    const closed = c.kind === "pt" && ai >= 0;
    d._act = closed ? -1 : j;
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
      const c = this.locate(e.clientX, e.clientY);
      this.last = c;
      this.draw(c, { x: e.clientX, y: e.clientY });
    },
    down: (e) => {
      this.press = { x: e.clientX, y: e.clientY };
    },
    move: (e) => {
      const c = this.locate(e.clientX, e.clientY);
      this.last = c;
      this.draw(c, { x: e.clientX, y: e.clientY });
    },
    up: (e) => {
      const pr = this.press;
      this.press = null;
      // tıkla-sürükle-bırak: basılan yerden bırakılan yere çizgi
      if (pr && Math.hypot(e.clientX - pr.x, e.clientY - pr.y) > 8 && this.anchor() < 0) {
        const c0 = this.locate(pr.x, pr.y);
        if (c0) this.commit(c0);
      }
      this.tap(e);
    },
    tap: (e) => this.tap(e),
  };
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
    if (c) this.commit(c);
    this.draw(this.locate(e.clientX, e.clientY), { x: e.clientX, y: e.clientY });
  }
  private key(e: KeyboardEvent) {
    if (!this.active()) return;
    const t = e.target as HTMLElement;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
    if (e.key === "Tab") {
      e.preventDefault();
      e.stopPropagation();
      this.cyclePlane(e.shiftKey ? -1 : 1);
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

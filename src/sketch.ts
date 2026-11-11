// 2D eskiz araçları: dikdörtgen, daire, çokgen.
// Tek parmak / sol tık ile çizilir; iki parmak kaydırma ve yakınlaştırma içindir.
import * as THREE from "three";
import type { Viewer } from "./viewer";
import type { Profile, Pt } from "./types";

export type SketchTool = "rect" | "circle" | "poly";

const COLOR = 0xf76707;

function niceStep(v: number) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p;
}

const fmt = (v: number) => (Math.round(v * 100) / 100).toString().replace(".", ",");

export function profileLabel(p: Profile) {
  if (p.kind === "rect") return `${fmt(p.w)} × ${fmt(p.h)}`;
  if (p.kind === "circle") return `Ø${fmt(p.r * 2)}`;
  return `${p.pts.length} nokta`;
}

export class Sketcher {
  tool: SketchTool | null = null;
  z = 0;
  private pointers = new Set<number>();
  private start: Pt | null = null;
  private polyPts: Pt[] = [];
  private hover: Pt | null = null;
  private downPos: { x: number; y: number } | null = null;
  private previewObj = new THREE.Group();
  private label: HTMLDivElement;

  /** Bir şekil tamamlandığında çağrılır */
  onComplete: (p: Profile, z: number) => void = () => {};
  /** Çokgen nokta sayısı değiştiğinde (arayüz "Kapat" düğmesi için) */
  onPolyChange: (count: number) => void = () => {};

  constructor(private viewer: Viewer) {
    viewer.overlay.add(this.previewObj);
    this.label = document.createElement("div");
    this.label.className = "dim-label";
    document.body.appendChild(this.label);
    const el = viewer.renderer.domElement;
    el.addEventListener("pointerdown", (e) => this.down(e));
    el.addEventListener("pointermove", (e) => this.move(e));
    el.addEventListener("pointerup", (e) => this.up(e));
    el.addEventListener("pointercancel", (e) => this.cancelPointer(e));
    el.addEventListener("pointerleave", () => {
      if (!this.start) this.hideLabel();
    });
  }

  setTool(t: SketchTool | null) {
    this.reset();
    this.tool = t;
  }

  reset() {
    this.start = null;
    this.polyPts = [];
    this.hover = null;
    this.clearPreview();
    this.hideLabel();
    this.onPolyChange(0);
  }

  private snap(v: number) {
    const step = niceStep(this.viewer.worldPerPixel() * 12);
    return Math.round(v / step) * step;
  }

  private worldPt(e: PointerEvent, raw = false): Pt | null {
    const p = this.viewer.pickPlane(e.clientX, e.clientY, this.z);
    if (!p) return null;
    return raw ? [p.x, p.y] : [this.snap(p.x), this.snap(p.y)];
  }

  private down(e: PointerEvent) {
    if (!this.tool) return;
    this.pointers.add(e.pointerId);
    if (this.pointers.size > 1) {
      // İkinci parmak geldi: kullanıcı kaydırıyor/yakınlaştırıyor, çizimi iptal et.
      this.start = null;
      this.downPos = null;
      this.drawCurrent();
      return;
    }
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // İlk noktada, dokunulan yatay yüzeyin yüksekliğini eskiz düzlemi yap.
    if (!this.start && this.polyPts.length === 0) {
      const hit = this.viewer.pickModel(e.clientX, e.clientY);
      this.z = hit && hit.normal.z > 0.99 ? Math.round(hit.point.z * 1000) / 1000 : 0;
    }
    const p = this.worldPt(e);
    if (!p) return;
    this.downPos = { x: e.clientX, y: e.clientY };
    if (this.tool === "rect" || this.tool === "circle") {
      this.start = p;
      this.hover = p;
      this.drawCurrent();
      this.showLabel(e);
    }
  }

  private move(e: PointerEvent) {
    if (!this.tool) return;
    if (this.pointers.size > 1) return;
    const p = this.worldPt(e);
    if (!p) return;
    this.hover = p;
    if (this.start || this.polyPts.length) {
      this.drawCurrent();
      this.showLabel(e);
    }
  }

  private up(e: PointerEvent) {
    const wasMulti = this.pointers.size > 1;
    this.pointers.delete(e.pointerId);
    if (!this.tool || wasMulti || !this.downPos) return;
    const moved = Math.hypot(e.clientX - this.downPos.x, e.clientY - this.downPos.y);
    this.downPos = null;
    const p = this.worldPt(e);
    if (!p) return;

    if (this.tool === "rect" && this.start) {
      const [x0, y0] = this.start;
      const x = Math.min(x0, p[0]);
      const y = Math.min(y0, p[1]);
      const w = Math.abs(p[0] - x0);
      const h = Math.abs(p[1] - y0);
      this.start = null;
      if (w > 0 && h > 0) this.finish({ kind: "rect", x, y, w, h });
      else this.reset();
    } else if (this.tool === "circle" && this.start) {
      const r = Math.hypot(p[0] - this.start[0], p[1] - this.start[1]);
      const [cx, cy] = this.start;
      this.start = null;
      if (r > 0) this.finish({ kind: "circle", cx, cy, r });
      else this.reset();
    } else if (this.tool === "poly") {
      if (moved > 15) return; // sürükleme, nokta ekleme değil
      const first = this.polyPts[0];
      if (first && this.polyPts.length >= 3) {
        const px = Math.hypot(p[0] - first[0], p[1] - first[1]) / this.viewer.worldPerPixel();
        if (px < 20) return this.closePoly();
      }
      const last = this.polyPts[this.polyPts.length - 1];
      if (!last || last[0] !== p[0] || last[1] !== p[1]) this.polyPts.push(p);
      this.onPolyChange(this.polyPts.length);
      this.drawCurrent();
    }
  }

  private cancelPointer(e: PointerEvent) {
    this.pointers.delete(e.pointerId);
    this.start = null;
    this.downPos = null;
    this.drawCurrent();
  }

  closePoly() {
    if (this.polyPts.length < 3) return;
    const pts = this.polyPts.slice();
    this.finish({ kind: "poly", pts });
  }

  undoPolyPoint() {
    this.polyPts.pop();
    this.onPolyChange(this.polyPts.length);
    this.drawCurrent();
  }

  private finish(p: Profile) {
    const z = this.z;
    this.polyPts = [];
    this.start = null;
    this.hideLabel();
    this.onPolyChange(0);
    this.showProfile(p, z);
    this.onComplete(p, z);
  }

  /** Çizim sırasında geçerli önizleme */
  private drawCurrent() {
    const h = this.hover;
    if (this.tool === "rect" && this.start && h) {
      const [x0, y0] = this.start;
      this.showProfile({ kind: "rect", x: Math.min(x0, h[0]), y: Math.min(y0, h[1]), w: Math.abs(h[0] - x0), h: Math.abs(h[1] - y0) }, this.z);
    } else if (this.tool === "circle" && this.start && h) {
      this.showProfile({ kind: "circle", cx: this.start[0], cy: this.start[1], r: Math.hypot(h[0] - this.start[0], h[1] - this.start[1]) }, this.z);
    } else if (this.tool === "poly" && this.polyPts.length) {
      const pts = h ? [...this.polyPts, h] : this.polyPts;
      this.showPolyline(pts, this.z, false);
    } else {
      this.clearPreview();
    }
  }

  clearPreview() {
    for (const c of [...this.previewObj.children]) {
      this.previewObj.remove(c);
      (c as any).geometry?.dispose();
    }
    this.viewer.requestRender();
  }

  /** Verilen profili turuncu çizgiyle gösterir (düzenleme panelinde de kullanılır) */
  showProfile(p: Profile, z: number) {
    if (p.kind === "rect") {
      this.showPolyline([[p.x, p.y], [p.x + p.w, p.y], [p.x + p.w, p.y + p.h], [p.x, p.y + p.h]], z, true);
    } else if (p.kind === "circle") {
      const pts: Pt[] = [];
      for (let i = 0; i < 72; i++) {
        const a = (i / 72) * Math.PI * 2;
        pts.push([p.cx + p.r * Math.cos(a), p.cy + p.r * Math.sin(a)]);
      }
      this.showPolyline(pts, z, true, [[p.cx, p.cy]]);
    } else {
      this.showPolyline(p.pts, z, true);
    }
  }

  private showPolyline(pts: Pt[], z: number, closed: boolean, extraPts: Pt[] = []) {
    this.clearPreview();
    const zz = z + 0.05;
    const v = pts.map(([x, y]) => new THREE.Vector3(x, y, zz));
    if (closed && v.length) v.push(v[0].clone());
    const mat = new THREE.LineBasicMaterial({ color: COLOR, depthTest: false });
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(v), mat);
    line.renderOrder = 10;
    const marks = [...pts.slice(0, closed ? pts.length : pts.length), ...extraPts];
    const dots = new THREE.Points(
      new THREE.BufferGeometry().setFromPoints((closed && pts.length > 8 ? extraPts : marks).map(([x, y]) => new THREE.Vector3(x, y, zz))),
      new THREE.PointsMaterial({ color: COLOR, size: 7, sizeAttenuation: false, depthTest: false }),
    );
    dots.renderOrder = 11;
    this.previewObj.add(line, dots);
    this.viewer.requestRender();
  }

  private showLabel(e: PointerEvent) {
    let text = "";
    const h = this.hover;
    if (this.tool === "rect" && this.start && h) text = `${fmt(Math.abs(h[0] - this.start[0]))} × ${fmt(Math.abs(h[1] - this.start[1]))}`;
    else if (this.tool === "circle" && this.start && h) text = `Ø${fmt(2 * Math.hypot(h[0] - this.start[0], h[1] - this.start[1]))}`;
    else if (this.tool === "poly" && h && this.polyPts.length) {
      const l = this.polyPts[this.polyPts.length - 1];
      text = `${fmt(Math.hypot(h[0] - l[0], h[1] - l[1]))}`;
    }
    if (!text) return this.hideLabel();
    if (this.z) text += `  (Z${fmt(this.z)})`;
    this.label.textContent = text;
    this.label.style.display = "block";
    const touch = e.pointerType === "touch";
    this.label.style.left = e.clientX + 14 + "px";
    this.label.style.top = e.clientY - (touch ? 70 : 30) + "px";
  }

  private hideLabel() {
    this.label.style.display = "none";
  }
}

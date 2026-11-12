// Serbest döndürme / kaydırma / yakınlaştırma — SolidWorks fare düzeni:
// orta tuş döndürür, Ctrl+orta kaydırır, Shift+orta yakınlaştırır, Alt+orta ekran ekseninde çevirir,
// tekerlek imlecin olduğu yere yakınlaştırır (ileri = uzaklaş, geri = yakınlaş; ters çevrilebilir),
// orta tuşa çift tıklama ekrana sığdırır. Sağ tuş hareket kılavuzu / bağlam menüsü içindir.
// Parmak: tek parmak döndürür (eskizde kaydırır), iki parmak kaydırır + yakınlaştırır.
import * as THREE from "three";
import { prefs } from "./input/prefs";

export class NavControls extends EventTarget {
  target = new THREE.Vector3();
  oneFingerRotate = true;
  private pointers = new Map<number, { x: number; y: number; type: string; button: number }>();
  private pinch: { d: number; mx: number; my: number; a: number } | null = null;

  constructor(private camera: THREE.OrthographicCamera, private el: HTMLElement) {
    super();
    el.addEventListener("pointerdown", (e) => this.down(e));
    el.addEventListener("pointermove", (e) => this.move(e));
    el.addEventListener("pointerup", (e) => this.up(e));
    el.addEventListener("pointercancel", (e) => this.up(e));
    el.addEventListener("wheel", (e) => this.wheel(e), { passive: false });
  }

  private changed() {
    this.dispatchEvent(new Event("change"));
  }

  /** tekerlek yönünü ters çevir (SolidWorks: Seçenekler > Görünüm) */
  reverseWheel = (() => {
    try {
      return localStorage.getItem("imajcad.wheelReverse") === "1";
    } catch {
      return false;
    }
  })();
  private lastMid = 0;
  private midMoved = false;

  /** dışarıdan parmak ekle (çizim iptal edilip gezinmeye geçerken) */
  inject(e: { pointerId: number; clientX: number; clientY: number }) {
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: "touch", button: 0 });
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {}
    if (this.touchCount() === 2) this.pinch = this.pinchState();
  }

  private down(e: PointerEvent) {
    if (e.pointerType === "pen") return; // kalem çizim içindir
    if (e.pointerType === "mouse" && e.button !== 1) return;
    if (e.pointerType === "mouse") {
      e.preventDefault();
      const now = performance.now();
      if (now - this.lastMid < 350) this.dispatchEvent(new Event("fit"));
      this.lastMid = now;
      this.midMoved = false;
    }
    try { this.el.setPointerCapture(e.pointerId); } catch {}
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType, button: e.button });
    if (this.touchCount() === 2) this.pinch = this.pinchState();
  }

  private touchCount() {
    let n = 0;
    this.pointers.forEach((p) => p.type === "touch" && n++);
    return n;
  }
  private pinchState() {
    const ps = [...this.pointers.values()].filter((p) => p.type === "touch");
    return { d: Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y), mx: (ps[0].x + ps[1].x) / 2, my: (ps[0].y + ps[1].y) / 2, a: Math.atan2(ps[1].y - ps[0].y, ps[1].x - ps[0].x) };
  }

  private move(e: PointerEvent) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (p.type === "touch") {
      const n = this.touchCount();
      if (n === 1) {
        if (this.oneFingerRotate) this.rotate(dx, dy);
        else this.pan(dx, dy);
      } else if (n === 2 && this.pinch) {
        const s = this.pinchState();
        this.pan(s.mx - this.pinch.mx, s.my - this.pinch.my);
        if (this.pinch.d > 0 && s.d > 0) this.zoomAt(s.d / this.pinch.d, s.mx, s.my);
        if (this.oneFingerRotate && prefs.twistRoll && s.d > 80) {
          let da = s.a - this.pinch.a;
          if (da > Math.PI) da -= 2 * Math.PI;
          if (da < -Math.PI) da += 2 * Math.PI;
          if (Math.abs(da) < 0.3) this.roll((-da * 180) / Math.PI);
        }
        this.pinch = s;
      }
      return;
    }
    if (Math.abs(dx) + Math.abs(dy) > 0) this.midMoved = true;
    if (e.ctrlKey) this.pan(dx, dy);
    else if (e.shiftKey) {
      const r = this.el.getBoundingClientRect();
      this.zoomAt(Math.exp(-dy * 0.01), r.left + r.width / 2, r.top + r.height / 2);
    } else if (e.altKey) this.roll(dx * 0.4);
    else this.rotate(dx, dy);
  }

  private up(e: PointerEvent) {
    this.pointers.delete(e.pointerId);
    this.pinch = this.touchCount() === 2 ? this.pinchState() : null;
  }

  private wheel(e: WheelEvent) {
    e.preventDefault();
    // SolidWorks varsayılanı: tekerleği ileri (deltaY < 0) itmek uzaklaştırır
    const sgn = this.reverseWheel ? -1 : 1;
    const f = Math.exp(sgn * e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015));
    this.zoomAt(f, e.clientX, e.clientY);
  }

  /** Ekran ekseni (bakış yönü) etrafında çevir, derece */
  roll(deg: number) {
    const cam = this.camera;
    const fwd = this.target.clone().sub(cam.position).normalize();
    cam.up.applyQuaternion(new THREE.Quaternion().setFromAxisAngle(fwd, (deg * Math.PI) / 180));
    cam.lookAt(this.target);
    cam.updateMatrixWorld();
    this.changed();
  }

  /** Açıyla döndür (ok tuşları): yatay ve dikey, derece */
  rotateDeg(yaw: number, pitch: number) {
    this.rotate(-(yaw * Math.PI) / 180 / 0.008, -(pitch * Math.PI) / 180 / 0.008);
  }

  rotate(dx: number, dy: number) {
    const cam = this.camera;
    const offset = cam.position.clone().sub(this.target);
    const up = cam.up.clone().normalize();
    const fwd = offset.clone().normalize().negate();
    const right = new THREE.Vector3().crossVectors(fwd, up).normalize();
    const q = new THREE.Quaternion()
      .setFromAxisAngle(up, -dx * 0.008)
      .multiply(new THREE.Quaternion().setFromAxisAngle(right, -dy * 0.008));
    offset.applyQuaternion(q);
    cam.up.applyQuaternion(q);
    cam.position.copy(this.target).add(offset);
    cam.lookAt(this.target);
    this.changed();
  }

  private wpp() {
    const h = this.el.clientHeight || 1;
    return (this.camera.top - this.camera.bottom) / this.camera.zoom / h;
  }

  pan(dx: number, dy: number) {
    const cam = this.camera;
    const k = this.wpp();
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
    const d = right.multiplyScalar(-dx * k).add(up.multiplyScalar(dy * k));
    cam.position.add(d);
    this.target.add(d);
    cam.updateMatrixWorld();
    this.changed();
  }

  zoomAt(factor: number, clientX: number, clientY: number) {
    const cam = this.camera;
    const r = this.el.getBoundingClientRect();
    const nx = ((clientX - r.left) / r.width) * 2 - 1;
    const ny = -((clientY - r.top) / r.height) * 2 + 1;
    const before = new THREE.Vector3(nx, ny, 0).unproject(cam);
    cam.zoom = Math.min(1e4, Math.max(1e-4, cam.zoom * factor));
    cam.updateProjectionMatrix();
    const after = new THREE.Vector3(nx, ny, 0).unproject(cam);
    const d = before.sub(after);
    cam.position.add(d);
    this.target.add(d);
    cam.updateMatrixWorld();
    this.changed();
  }
}

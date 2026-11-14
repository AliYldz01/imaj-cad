// Serbest döndürme / kaydırma / yakınlaştırma — SolidWorks fare düzeni:
// orta tuş döndürür, Ctrl+orta kaydırır, Shift+orta yakınlaştırır, Alt+orta ekran ekseninde çevirir,
// tekerlek imlecin olduğu yere yakınlaştırır (ileri = uzaklaş, geri = yakınlaş; ters çevrilebilir),
// orta tuşa çift tıklama ekrana sığdırır. Sağ tuş hareket kılavuzu / bağlam menüsü içindir.
// Parmak: tek parmak döndürür (eskizde kaydırır), iki parmak kaydırır + yakınlaştırır.
import * as THREE from "three";
import { prefs } from "./input/prefs";

/** döndürme merkezi: nokta ya da eksen (kenar / silindir / düz yüz normali) */
export interface Pivot { p: THREE.Vector3; axis?: THREE.Vector3 }

export class NavControls extends EventTarget {
  target = new THREE.Vector3();
  /** SolidWorks: orta tuşla döndürmede merkez — imleç altındaki model noktası (yoksa model merkezi / ekran merkezi);
   * entity = orta tuşla tek tıklanan varlık (köşe = nokta, kenar / silindir = eksen, düz yüz = normal ekseni) */
  pivotAt: ((x: number, y: number, entity: boolean) => Pivot | null) | null = null;
  /** etkin döndürme merkezi (sürükleme sırasında) ve orta tıkla seçilmiş varlık */
  pivot: Pivot | null = null;
  sticky: Pivot | null = null;
  oneFingerRotate = true;
  private pointers = new Map<number, { x: number; y: number; type: string; button: number }>();
  private pinch: { d: number; mx: number; my: number; a: number } | null = null;
  /** A-2: çevirme (yuvarlama) başvurusu — yalnız çevirme uygulanınca güncellenir; parmak aralığı hareketin başında */
  private roll0: { a: number; d0: number } | null = null;

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
  /** son SÜRÜKLEMESİZ orta tık bırakma zamanı (çift tık = sığdır yalnız iki gerçek tıkla) */
  private lastClick = 0;
  private downTime = 0;
  private midMoved = false;
  private downAt = { x: 0, y: 0 };

  /** dışarıdan parmak ekle (çizim iptal edilip gezinmeye geçerken) */
  inject(e: { pointerId: number; clientX: number; clientY: number }) {
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: "touch", button: 0 });
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {}
    if (this.touchCount() === 2) (this.pinch = this.pinchState()), (this.roll0 = { a: this.pinch.a, d0: this.pinch.d });
  }

  private down(e: PointerEvent) {
    if (e.pointerType === "pen") return; // kalem çizim içindir
    if (e.pointerType === "mouse" && e.button !== 1) return;
    if (e.pointerType === "mouse") {
      e.preventDefault();
      // not: çift tık (sığdır) artık bırakmada değerlendirilir; peş peşe hızlı döndürme vuruşları görünümü sıçratmaz
      this.downTime = performance.now();
      this.midMoved = false;
      this.downAt = { x: e.clientX, y: e.clientY };
      this.pivot = this.sticky ?? (e.ctrlKey || e.shiftKey || e.altKey ? null : this.pivotAt?.(e.clientX, e.clientY, false) ?? null);
      this.dispatchEvent(new Event("pivot"));
    }
    try { this.el.setPointerCapture(e.pointerId); } catch {}
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType, button: e.button });
    if (this.touchCount() === 2) (this.pinch = this.pinchState()), (this.roll0 = { a: this.pinch.a, d0: this.pinch.d });
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
        if (this.oneFingerRotate && prefs.twistRoll && this.roll0 && this.roll0.d0 > 80) {
          // sırayla gelen parmak olaylarının açı titremesi birikmesin: ölü bölge (≈ 3°), başvuru yalnız çevirince ilerler
          let da = s.a - this.roll0.a;
          if (da > Math.PI) da -= 2 * Math.PI;
          if (da < -Math.PI) da += 2 * Math.PI;
          if (Math.abs(da) > 0.05 && Math.abs(da) < 0.6) {
            this.roll((-da * 180) / Math.PI);
            this.roll0.a = s.a;
          } else if (Math.abs(da) >= 0.6) this.roll0.a = s.a;
        }
        this.pinch = s;
      }
      return;
    }
    if (Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y) > 3) this.midMoved = true;
    if (e.ctrlKey) this.pan(dx, dy);
    else if (e.shiftKey) {
      const r = this.el.getBoundingClientRect();
      this.zoomAt(Math.exp(-dy * 0.01), r.left + r.width / 2, r.top + r.height / 2);
    } else if (e.altKey) this.roll(dx * 0.4);
    else this.rotate(dx, dy, this.pivot);
  }

  private up(e: PointerEvent) {
    const p = this.pointers.get(e.pointerId);
    if (p && p.type === "mouse") {
      const now = performance.now();
      if (this.midMoved) {
        // sürükleme bitti: varlık seçimi kalkar (SolidWorks)
        this.sticky = null;
        this.lastClick = 0;
      } else if (now - this.lastClick < 400) {
        // iki gerçek tık → ekrana sığdır
        this.sticky = null;
        this.lastClick = 0;
        this.dispatchEvent(new Event("fit"));
      } else if (now - this.downTime < 300) {
        // kısa, kıpırdamadan orta tık: varlığı döndürme merkezi seç (köşe / kenar / yüz)
        this.sticky = this.pivotAt?.(e.clientX, e.clientY, true) ?? null;
        this.lastClick = now;
      } else {
        // uzun basılıp sürüklemeden bırakıldı: seçim yapma (yanlışlıkla eksen kilitlenmesin)
        this.sticky = null;
        this.lastClick = 0;
      }
      this.pivot = this.sticky;
      this.dispatchEvent(new Event("pivot"));
    }
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

  rotate(dx: number, dy: number, pv: Pivot | null = null) {
    const cam = this.camera;
    const offset = cam.position.clone().sub(this.target);
    const fwd = offset.clone().normalize().negate();
    // ekran eksenleri (dik): cam.up bakış yönüne dik olmayabilir (ör. izometrikte dünya Y);
    // onun etrafında döndürmek yatay sürüklemeyi "ekranda dönme"ye çeviriyordu. SolidWorks: yatay = ekran dikeyi, dikey = ekran yatayı
    let right = new THREE.Vector3().crossVectors(fwd, cam.up);
    if (right.lengthSq() < 1e-12) right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
    right.normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
    cam.up.copy(up);
    let q: THREE.Quaternion;
    if (pv?.axis) {
      // eksen etrafında (SolidWorks: kenar / eksen etrafında döndür): ekran yönündeki sürükleme bileşeni açıyı verir
      const A = pv.axis.clone().normalize();
      let ang = -0.008 * (dx * A.dot(up) + dy * A.dot(right));
      if (Math.abs(A.dot(fwd)) > 0.9) ang = -0.008 * dx * Math.sign(A.dot(fwd));
      q = new THREE.Quaternion().setFromAxisAngle(A, ang);
    } else
      q = new THREE.Quaternion()
        .setFromAxisAngle(up, -dx * 0.008)
        .multiply(new THREE.Quaternion().setFromAxisAngle(right, -dy * 0.008));
    // merkez etrafında katı dönüş: kamera ve hedef birlikte döner, merkez ekranda yerinde kalır
    const P = pv?.p ?? this.target;
    cam.position.sub(P).applyQuaternion(q).add(P);
    this.target.sub(P).applyQuaternion(q).add(P);
    cam.up.applyQuaternion(q);
    cam.lookAt(this.target);
    cam.updateMatrixWorld();
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

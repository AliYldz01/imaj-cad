// 3D görüntüleme: sahne, kamera (Y yukarı, SolidWorks gibi), düzlemler, model, seçim ve giriş yönlendirme.
import * as THREE from "three";
import { NavControls } from "./nav";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import type { Frame, MeshData, Vec3 } from "./doc/types";
import { frameY } from "./doc/math";
import { prefs, observe, touchDraws, touchOffset } from "./input/prefs";

export type PickHit =
  | { kind: "face"; index: number; point: Vec3 }
  | { kind: "edge"; index: number; point: Vec3 }
  | { kind: "plane"; id: string; point: Vec3 };

export interface PlaneDisplay { id: string; frame: Frame; label: string; size?: number }

export interface InputHandler {
  down?(e: PointerEvent): void;
  move?(e: PointerEvent): void; // basılıyken
  up?(e: PointerEvent): void;
  hover?(e: PointerEvent): void; // basılı değilken (kalem/fare)
  /** dokunmatik kısa dokunuş */
  tap?(e: PointerEvent): void;
  /** basış iptal (ikinci parmak geldi / uzun basma menüsü açıldı) */
  cancel?(): void;
}

const COL = {
  face: 0x9fb4cc,
  edge: 0x1f2a37,
  selFace: 0x2b7de9,
  hovFace: 0x74b0ff,
  selEdge: 0x0b5ed7,
  hovEdge: 0xf76707,
  plane: 0x4c9be8,
};

export class Viewer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  readonly controls: NavControls;
  /** eskiz çizimleri */
  readonly overlay = new THREE.Group();
  /** ölçü etiketleri için HTML katmanı */
  readonly labels: HTMLDivElement;
  readonly lineMaterials = new Set<LineMaterial>();
  private model = new THREE.Group();
  private hl = new THREE.Group();
  private planesGroup = new THREE.Group();
  private planeMeshes: THREE.Mesh[] = [];
  private modelMesh: THREE.Mesh | null = null;
  private edgeObj: THREE.LineSegments | null = null;
  mesh: MeshData | null = null;
  private viewHeight = 300;
  private needsRender = true;
  private renderHooks = new Set<() => void>();
  handler: InputHandler | null = null;
  bbox: THREE.Box3 | null = null;
  showPlanes = true;

  constructor(readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0xf3f5f8);
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = "none";
    this.labels = document.createElement("div");
    this.labels.className = "labels";
    container.appendChild(this.labels);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100000, 100000);
    this.camera.up.set(0, 1, 0);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.7);
    sun.position.set(0.4, 0.6, 1);
    this.camera.add(sun);
    this.scene.add(this.camera, this.model, this.hl, this.planesGroup, this.overlay, this.makeTriad());

    this.controls = new NavControls(this.camera, this.renderer.domElement);
    this.controls.addEventListener("change", () => this.requestRender());
    this.renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());

    this.setupInput();
    this.viewStd("iso");
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    const loop = () => {
      if (this.needsRender) {
        this.needsRender = false;
        this.renderer.render(this.scene, this.camera);
        this.renderHooks.forEach((h) => h());
      }
      requestAnimationFrame(loop);
    };
    loop();
  }

  requestRender() {
    this.needsRender = true;
  }

  /** Kesit görünüşü: düzlemin normal tarafı görünür kalır */
  setClip(frame: Frame | null, flip = false) {
    if (!frame) this.renderer.clippingPlanes = [];
    else {
      const n = new THREE.Vector3(...frame.n).multiplyScalar(flip ? 1 : -1);
      const pl = new THREE.Plane().setFromNormalAndCoplanarPoint(n, new THREE.Vector3(...frame.o));
      this.renderer.clippingPlanes = [pl];
    }
    this.requestRender();
  }
  onRender(fn: () => void) {
    this.renderHooks.add(fn);
    return () => this.renderHooks.delete(fn);
  }

  // ---------- Giriş: kalem/fare araç içindir, parmak gezinme içindir ----------
  /** ekrandaki Ctrl / Shift düğmeleri (yapışkan) */
  readonly mods = { ctrl: false, shift: false };
  /** tek parmak çizebilir mi (eskizde çizim aracı açıkken) */
  touchDrawOk: (() => boolean) | null = null;
  /** uzun basma menüsüne izin (çizim sırasında kalem sabit tutulabilir) */
  longPressOk: ((pointerType: string) => boolean) | null = null;
  onLongPress: ((x: number, y: number, pointerType: string) => void) | null = null;
  /** çok parmak dokunuşu (2: geri al, 3: ileri al) */
  onFingerTap: ((n: number) => void) | null = null;
  /** büyüteç gösterilsin mi */
  loupeOk: (() => boolean) | null = null;
  /** çizim işaretçisinin (kalem/parmak) etkin konumu */
  private drawPt: { x: number; y: number; type: string } | null = null;
  private lastPen = 0;

  /** olayı kaydırma ve ekran değiştiricileriyle sar */
  private wrap(e: PointerEvent, dy = 0): PointerEvent {
    const m = this.mods;
    if (!dy && !m.ctrl && !m.shift) return e;
    return new Proxy(e, {
      get: (t, k) => {
        if (k === "clientY") return t.clientY - dy;
        if (k === "ctrlKey") return t.ctrlKey || m.ctrl;
        if (k === "shiftKey") return t.shiftKey || m.shift;
        const v = Reflect.get(t, k, t);
        return typeof v === "function" ? v.bind(t) : v;
      },
    });
  }

  private setupInput() {
    const el = this.container;
    const canvas = this.renderer.domElement;
    let active: number | null = null;
    let activeType = "";
    let activeDy = 0;
    const touches = new Map<number, { x: number; y: number; t: number; moved: boolean }>();
    let multi = false;
    let gesture: { max: number; t: number; moved: boolean } | null = null;
    /** parmakla çizim (tek dokunuş araç olarak) */
    let drawTouch: { id: number; t: number; moved: boolean; x: number; y: number } | null = null;
    const blocked = new Set<number>();
    let lp: { timer: number; x: number; y: number; id: number; fired: boolean } | null = null;
    const clearLp = () => {
      if (lp) clearTimeout(lp.timer);
      lp = null;
    };
    const startLp = (e: PointerEvent) => {
      clearLp();
      if (!prefs.longPress || !this.onLongPress) return;
      if (this.longPressOk && !this.longPressOk(e.pointerType)) return;
      const x = e.clientX, y = e.clientY, type = e.pointerType;
      const st = { timer: 0, x, y, id: e.pointerId, fired: false };
      st.timer = window.setTimeout(() => {
        if (lp !== st) return;
        st.fired = true;
        navigator.vibrate?.(15);
        this.handler?.cancel?.();
        this.setDrawPt(null);
        this.onLongPress?.(x, y, type);
      }, 600);
      lp = st;
    };
    const lpMove = (e: PointerEvent) => {
      if (lp && lp.id === e.pointerId && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 9 && !lp.fired) clearLp();
    };
    const penRecent = () => prefs.palmReject && performance.now() - this.lastPen < 450;

    el.addEventListener(
      "pointerdown",
      (e) => {
        observe(e);
        if (e.target !== canvas) return;
        if (e.pointerType === "pen") this.lastPen = performance.now();
        if (e.pointerType === "touch") {
          if (penRecent() || blocked.size) {
            // avuç reddi: kalem kullanılırken parmak/avuç dokunuşları yok sayılır
            blocked.add(e.pointerId);
            e.stopPropagation();
            return;
          }
          if (drawTouch) {
            if (!drawTouch.moved || performance.now() - drawTouch.t < 300) {
              // ikinci parmak: çizimi bırak, gezinmeye geç
              this.handler?.cancel?.();
              this.setDrawPt(null);
              clearLp();
              this.controls.inject({ pointerId: drawTouch.id, clientX: drawTouch.x, clientY: drawTouch.y });
              touches.set(drawTouch.id, { x: drawTouch.x, y: drawTouch.y, t: drawTouch.t, moved: true });
              active = null;
              drawTouch = null;
              multi = true;
            } else {
              blocked.add(e.pointerId);
              e.stopPropagation();
              return;
            }
          }
          if (!touches.size) gesture = { max: 0, t: performance.now(), moved: false };
          touches.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), moved: false });
          if (gesture) gesture.max = Math.max(gesture.max, touches.size);
          if (touches.size > 1) {
            multi = true;
            clearLp();
            return;
          }
          if (touchDraws() && this.touchDrawOk?.()) {
            // tek parmak araç olarak çizer
            e.stopPropagation();
            touches.delete(e.pointerId);
            drawTouch = { id: e.pointerId, t: performance.now(), moved: false, x: e.clientX, y: e.clientY };
            active = e.pointerId;
            activeType = "touch";
            activeDy = touchOffset();
            try { canvas.setPointerCapture(e.pointerId); } catch {}
            const w = this.wrap(e, activeDy);
            this.setDrawPt(w);
            this.handler?.down?.(w);
            startLp(e);
            return;
          }
          startLp(e);
          return; // gezinmeye bırak
        }
        if (e.button !== 0 || (e.pointerType === "pen" && (e.buttons & 2) !== 0)) return; // orta/sağ tuş, kalem yan tuşu: gezinme / menü
        e.stopPropagation();
        active = e.pointerId;
        activeType = e.pointerType;
        activeDy = 0;
        try { canvas.setPointerCapture(e.pointerId); } catch {}
        const w = this.wrap(e);
        if (e.pointerType === "pen") {
          this.setDrawPt(w);
          startLp(e);
        }
        this.handler?.down?.(w);
      },
      true,
    );
    el.addEventListener(
      "pointermove",
      (e) => {
        observe(e);
        if (e.pointerType === "pen") this.lastPen = performance.now();
        lpMove(e);
        if (e.pointerType === "touch") {
          if (blocked.has(e.pointerId)) return void e.stopPropagation();
          if (drawTouch && drawTouch.id === e.pointerId) {
            e.stopPropagation();
            if (Math.hypot(e.clientX - drawTouch.x, e.clientY - drawTouch.y) > 8) drawTouch.moved = true;
            drawTouch.x = e.clientX;
            drawTouch.y = e.clientY;
            if (lp?.fired) return;
            const w = this.wrap(e, activeDy);
            this.setDrawPt(w);
            this.handler?.move?.(w);
            return;
          }
          const t = touches.get(e.pointerId);
          if (t && Math.hypot(e.clientX - t.x, e.clientY - t.y) > 10) {
            t.moved = true;
            if (gesture) gesture.moved = true;
          }
          return;
        }
        if (active === e.pointerId) {
          e.stopPropagation();
          if (lp?.fired) return;
          const w = this.wrap(e, activeDy);
          if (activeType === "pen") this.setDrawPt(w);
          this.handler?.move?.(w);
        } else if (e.buttons === 0 && e.target === canvas) this.handler?.hover?.(this.wrap(e));
      },
      true,
    );
    const end = (e: PointerEvent, cancel = false) => {
      if (e.pointerType === "pen") this.lastPen = performance.now();
      const fired = !!(lp && lp.id === e.pointerId && lp.fired);
      if (lp && lp.id === e.pointerId) clearLp();
      if (e.pointerType === "touch") {
        if (blocked.delete(e.pointerId)) return void e.stopPropagation();
        if (drawTouch && drawTouch.id === e.pointerId) {
          e.stopPropagation();
          drawTouch = null;
          active = null;
          this.setDrawPt(null);
          if (!cancel && !fired) this.handler?.up?.(this.wrap(e, activeDy));
          return;
        }
        const t = touches.get(e.pointerId);
        touches.delete(e.pointerId);
        if (!cancel && !fired && t && !t.moved && !multi && performance.now() - t.t < 450) this.handler?.tap?.(e);
        if (touches.size === 0) {
          multi = false;
          const g = gesture;
          gesture = null;
          if (!cancel && g && g.max >= 2 && !g.moved && performance.now() - g.t < 400 && prefs.fingerUndo) this.onFingerTap?.(g.max);
        }
        return;
      }
      if (active === e.pointerId) {
        active = null;
        e.stopPropagation();
        this.setDrawPt(null);
        if (!cancel && !fired) this.handler?.up?.(this.wrap(e, activeDy));
      }
    };
    el.addEventListener("pointerup", (e) => end(e), true);
    el.addEventListener("pointercancel", (e) => end(e, true), true);
    this.setupLoupe();
  }

  // ---------- Büyüteç ve kaydırılmış imleç ----------
  private loupe: HTMLCanvasElement | null = null;
  private tcursor: HTMLDivElement | null = null;
  private setDrawPt(e: { clientX: number; clientY: number; pointerType: string } | null) {
    this.drawPt = e ? { x: e.clientX, y: e.clientY, type: e.pointerType } : null;
    if (!e) {
      if (this.loupe) this.loupe.style.display = "none";
      if (this.tcursor) this.tcursor.style.display = "none";
      return;
    }
    this.requestRender();
  }
  private setupLoupe() {
    const lc = document.createElement("canvas");
    lc.className = "loupe";
    lc.width = lc.height = 150 * Math.min(2, devicePixelRatio || 1);
    document.body.appendChild(lc);
    this.loupe = lc;
    const tc = document.createElement("div");
    tc.className = "touch-cursor";
    document.body.appendChild(tc);
    this.tcursor = tc;
    this.onRender(() => this.drawLoupe());
  }
  private drawLoupe() {
    const d = this.drawPt, lc = this.loupe!, tc = this.tcursor!;
    if (!d) return;
    const off = d.type === "touch" && touchOffset() > 0;
    tc.style.display = off ? "block" : "none";
    if (off) {
      tc.style.left = d.x + "px";
      tc.style.top = d.y + "px";
    }
    if (!prefs.loupe || (this.loupeOk && !this.loupeOk())) return void (lc.style.display = "none");
    const src = this.renderer.domElement;
    const r = src.getBoundingClientRect();
    const sx = src.width / r.width;
    const size = 150, zoom = prefs.loupeZoom;
    const sw = (size / zoom) * sx;
    const cx = (d.x - r.left) * sx, cy = (d.y - r.top) * sx;
    const g = lc.getContext("2d")!;
    const k = lc.width / size;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = "#f3f5f8";
    g.fillRect(0, 0, lc.width, lc.height);
    try {
      g.drawImage(src, cx - sw / 2, cy - sw / 2, sw, sw, 0, 0, lc.width, lc.height);
    } catch {}
    g.setTransform(k, 0, 0, k, 0, 0);
    g.strokeStyle = "rgba(224,49,49,.9)";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(size / 2 - 12, size / 2);
    g.lineTo(size / 2 + 12, size / 2);
    g.moveTo(size / 2, size / 2 - 12);
    g.lineTo(size / 2, size / 2 + 12);
    g.stroke();
    const b = document.querySelector(".sk-badge") as HTMLElement | null;
    const txt = b && b.style.display !== "none" ? b.textContent || "" : "";
    if (txt) {
      g.font = "600 12px system-ui, sans-serif";
      const w = g.measureText(txt).width + 10;
      g.fillStyle = "rgba(255,249,219,.95)";
      g.fillRect(size / 2 - w / 2, size - 24, w, 18);
      g.fillStyle = "#222";
      g.fillText(txt, size / 2 - w / 2 + 5, size - 11);
    }
    // konum: el tarafının tersine, yukarıda
    const left = prefs.leftHanded ? d.x + 40 : d.x - size - 40;
    let top = d.y - size - (off ? 40 : 70);
    if (top < 60) top = d.y + 60;
    lc.style.left = Math.max(4, Math.min(innerWidth - size - 4, left)) + "px";
    lc.style.top = Math.max(4, top) + "px";
    lc.style.display = "block";
  }

  /** Eskiz modunda tek parmak kaydırır, 3D modunda döndürür */
  setTouchRotate(rotate: boolean) {
    this.controls.oneFingerRotate = rotate;
  }

  // ---------- Görünüm ----------
  private makeTriad() {
    const g = new THREE.Group();
    const axis = (to: THREE.Vector3, color: number) => {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), to]);
      const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, depthTest: false }));
      l.renderOrder = 5;
      return l;
    };
    g.add(axis(new THREE.Vector3(20, 0, 0), 0xd33f3f), axis(new THREE.Vector3(0, 20, 0), 0x2f9e44), axis(new THREE.Vector3(0, 0, 20), 0x1c7ed6));
    return g;
  }

  resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = w + "px";
    this.renderer.domElement.style.height = h + "px";
    const aspect = w / h;
    const vh = this.viewHeight;
    this.camera.left = (-vh * aspect) / 2;
    this.camera.right = (vh * aspect) / 2;
    this.camera.top = vh / 2;
    this.camera.bottom = -vh / 2;
    this.camera.updateProjectionMatrix();
    this.lineMaterials.forEach((m) => m.resolution.set(w, h));
    this.requestRender();
  }

  worldPerPixel() {
    return this.viewHeight / this.camera.zoom / (this.container.clientHeight || 1);
  }

  private viewHistory: { pos: THREE.Vector3; up: THREE.Vector3; target: THREE.Vector3; zoom: number }[] = [];
  /** Önceki görünüm (Ctrl+Shift+Z) için mevcut görünümü sakla */
  pushView() {
    this.viewHistory.push({ pos: this.camera.position.clone(), up: this.camera.up.clone(), target: this.controls.target.clone(), zoom: this.camera.zoom });
    if (this.viewHistory.length > 30) this.viewHistory.shift();
  }
  previousView() {
    const v = this.viewHistory.pop();
    if (!v) return;
    this.camera.position.copy(v.pos);
    this.camera.up.copy(v.up);
    this.controls.target.copy(v.target);
    this.camera.zoom = v.zoom;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(v.target);
    this.camera.updateMatrixWorld();
    this.requestRender();
  }
  /** Ekran merkezine göre yakınlaştır / uzaklaştır */
  zoomStep(f: number) {
    const r = this.container.getBoundingClientRect();
    this.controls.zoomAt(f, r.left + r.width / 2, r.top + r.height / 2);
  }

  setView(dir: THREE.Vector3, up: THREE.Vector3, target?: THREE.Vector3) {
    this.pushView();
    const t = target ?? this.controls.target.clone();
    this.controls.target.copy(t);
    this.camera.up.copy(up).normalize();
    this.camera.position.copy(t).addScaledVector(dir.clone().normalize(), 5000);
    this.camera.lookAt(t);
    this.camera.updateMatrixWorld();
    this.requestRender();
  }

  viewStd(name: "front" | "back" | "top" | "bottom" | "right" | "left" | "iso") {
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    const map = {
      front: [V(0, 0, 1), V(0, 1, 0)],
      back: [V(0, 0, -1), V(0, 1, 0)],
      top: [V(0, 1, 0), V(0, 0, -1)],
      bottom: [V(0, -1, 0), V(0, 0, 1)],
      right: [V(1, 0, 0), V(0, 1, 0)],
      left: [V(-1, 0, 0), V(0, 1, 0)],
      iso: [V(1, 0.82, 1), V(0, 1, 0)],
    } as const;
    const [d, u] = map[name];
    this.setView(d.clone(), u.clone());
  }

  /** Eskiz düzlemine dik bak (Normal To) */
  viewNormal(f: Frame) {
    const y = frameY(f);
    this.setView(new THREE.Vector3(...f.n), new THREE.Vector3(...y));
  }

  fit() {
    this.pushView();
    const box = this.bbox && !this.bbox.isEmpty() ? this.bbox.clone() : new THREE.Box3(new THREE.Vector3(-60, -60, -60), new THREE.Vector3(60, 60, 60));
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length() || 100;
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    const fitSize = size * 1.25;
    this.camera.zoom = Math.min(this.viewHeight / fitSize, (this.viewHeight * (w / h)) / fitSize);
    this.camera.updateProjectionMatrix();
    const dir = this.camera.position.clone().sub(this.controls.target);
    this.controls.target.copy(center);
    this.camera.position.copy(center).add(dir);
    this.camera.updateMatrixWorld();
    this.requestRender();
  }

  /** Belirli bir dünya kutusunu ekrana sığdır */
  fitBox(box: THREE.Box3) {
    const old = this.bbox;
    this.bbox = box;
    this.fit();
    this.bbox = old;
  }

  // ---------- Işın ve izdüşüm ----------
  ndc(clientX: number, clientY: number) {
    const r = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  }
  ray(clientX: number, clientY: number) {
    const rc = new THREE.Raycaster();
    rc.setFromCamera(this.ndc(clientX, clientY), this.camera);
    return rc;
  }
  /** Ekran noktasını düzleme izdüşürür (dünya koordinatı) */
  pickFrame(clientX: number, clientY: number, f: Frame): THREE.Vector3 | null {
    const n = new THREE.Vector3(...f.n);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, new THREE.Vector3(...f.o));
    const p = new THREE.Vector3();
    return this.ray(clientX, clientY).ray.intersectPlane(plane, p) ? p : null;
  }
  /** Dünya noktasının ekran (container) koordinatı */
  toScreen(p: Vec3): [number, number] {
    const v = new THREE.Vector3(...p).project(this.camera);
    const w = this.container.clientWidth, h = this.container.clientHeight;
    return [((v.x + 1) / 2) * w, ((1 - v.y) / 2) * h];
  }

  // ---------- Düzlemler ----------
  setPlanes(list: PlaneDisplay[]) {
    for (const m of this.planeMeshes) {
      this.planesGroup.remove(m);
      m.geometry.dispose();
    }
    this.planesGroup.clear();
    this.planeMeshes = [];
    const size = this.bbox ? Math.max(60, this.bbox.getSize(new THREE.Vector3()).length() * 0.6) : 100;
    for (const p of list) {
      const s = p.size ?? size;
      const geo = new THREE.PlaneGeometry(s, s);
      const mat = new THREE.MeshBasicMaterial({ color: COL.plane, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false });
      const m = new THREE.Mesh(geo, mat);
      const x = new THREE.Vector3(...p.frame.x), n = new THREE.Vector3(...p.frame.n);
      const y = new THREE.Vector3().crossVectors(n, x);
      m.matrixAutoUpdate = false;
      m.matrix.makeBasis(x, y, n).setPosition(...p.frame.o);
      m.userData = { id: p.id, label: p.label };
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: COL.plane, transparent: true, opacity: 0.45 }));
      m.add(edges);
      this.planesGroup.add(m);
      this.planeMeshes.push(m);
    }
    this.planesGroup.visible = this.showPlanes;
    this.requestRender();
  }

  setPlanesVisible(v: boolean) {
    this.showPlanes = v;
    this.planesGroup.visible = v;
    this.requestRender();
  }

  // ---------- Model ----------
  setModel(mesh: MeshData | null) {
    for (const c of [...this.model.children]) {
      this.model.remove(c);
      (c as any).geometry?.dispose();
    }
    this.modelMesh = null;
    this.edgeObj = null;
    this.mesh = mesh;
    this.bbox = null;
    if (mesh) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(mesh.vertices, 3));
      geo.setAttribute("normal", new THREE.BufferAttribute(mesh.normals, 3));
      geo.setIndex(new THREE.BufferAttribute(mesh.triangles, 1));
      const mat = new THREE.MeshStandardMaterial({ color: COL.face, metalness: 0.1, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
      this.modelMesh = new THREE.Mesh(geo, mat);
      const eg = new THREE.BufferGeometry();
      eg.setAttribute("position", new THREE.BufferAttribute(mesh.lines, 3));
      this.edgeObj = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: COL.edge }));
      this.model.add(this.modelMesh, this.edgeObj);
      if (mesh.bbox) this.bbox = new THREE.Box3(new THREE.Vector3(...mesh.bbox.min), new THREE.Vector3(...mesh.bbox.max));
    }
    this.requestRender();
  }

  setModelOpacity(op: number) {
    if (!this.modelMesh) return;
    const m = this.modelMesh.material as THREE.MeshStandardMaterial;
    m.transparent = op < 1;
    m.opacity = op;
    m.depthWrite = op >= 1;
    this.requestRender();
  }

  private faceGroupOf(tri: number): number {
    const g = this.mesh!.faceGroups;
    const idx = tri * 3;
    for (let i = 0; i < g.length; i += 3) if (idx >= g[i] && idx < g[i] + g[i + 1]) return g[i + 2];
    return -1;
  }
  private edgeGroupOf(vtx: number): number {
    const g = this.mesh!.edgeGroups;
    for (let i = 0; i < g.length; i += 3) if (vtx >= g[i] && vtx < g[i] + g[i + 1]) return g[i + 2];
    return -1;
  }

  pick(clientX: number, clientY: number, want: { face?: boolean; edge?: boolean; plane?: boolean }): PickHit | null {
    const rc = this.ray(clientX, clientY);
    const tol = 9 * this.worldPerPixel();
    if (want.edge && this.edgeObj) {
      rc.params.Line = { threshold: tol };
      const hits = rc.intersectObject(this.edgeObj, false);
      // Yüzün arkasında kalan kenarları ele
      let faceDist = Infinity;
      if (this.modelMesh) {
        const fh = rc.intersectObject(this.modelMesh, false)[0];
        if (fh) faceDist = fh.distance;
      }
      const h = hits.find((x) => x.distance <= faceDist + tol * 2);
      if (h && h.index !== undefined) {
        const idx = this.edgeGroupOf(h.index);
        if (idx >= 0) return { kind: "edge", index: idx, point: h.point.toArray() as Vec3 };
      }
    }
    if (want.face && this.modelMesh) {
      const h = rc.intersectObject(this.modelMesh, false)[0];
      if (h && h.faceIndex !== undefined && h.faceIndex !== null) {
        const idx = this.faceGroupOf(h.faceIndex);
        if (idx >= 0) return { kind: "face", index: idx, point: h.point.toArray() as Vec3 };
      }
    }
    if (want.plane && this.planesGroup.visible) {
      this.planeMeshes.forEach((m) => m.updateMatrixWorld());
      const h = rc.intersectObjects(this.planeMeshes, false)[0];
      if (h) return { kind: "plane", id: h.object.userData.id, point: h.point.toArray() as Vec3 };
    }
    return null;
  }

  // ---------- Vurgulama ----------
  setHighlight(sel: { faces: number[]; edges: number[]; planes: string[] }, hover: PickHit | null) {
    for (const c of [...this.hl.children]) {
      this.hl.remove(c);
      (c as any).geometry?.dispose();
    }
    this.planeMeshes.forEach((m) => {
      const id = m.userData.id;
      const on = sel.planes.includes(id) || (hover?.kind === "plane" && hover.id === id);
      (m.material as THREE.MeshBasicMaterial).opacity = on ? 0.22 : 0.06;
    });
    if (this.mesh && this.modelMesh) {
      const addFace = (i: number, color: number) => {
        const g = this.mesh!.faceGroups;
        for (let k = 0; k < g.length; k += 3) {
          if (g[k + 2] !== i) continue;
          const geo = new THREE.BufferGeometry();
          geo.setAttribute("position", this.modelMesh!.geometry.getAttribute("position"));
          geo.setAttribute("normal", this.modelMesh!.geometry.getAttribute("normal"));
          geo.setIndex(new THREE.BufferAttribute(this.mesh!.triangles.slice(g[k], g[k] + g[k + 1]), 1));
          const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
          this.hl.add(m);
        }
      };
      const addEdge = (i: number, color: number) => {
        const g = this.mesh!.edgeGroups;
        for (let k = 0; k < g.length; k += 3) {
          if (g[k + 2] !== i) continue;
          const pos = this.mesh!.lines.slice(g[k] * 3, (g[k] + g[k + 1]) * 3);
          this.hl.add(this.fatLines(Array.from(pos), color, 4));
        }
      };
      sel.faces.forEach((i) => addFace(i, COL.selFace));
      sel.edges.forEach((i) => addEdge(i, COL.selEdge));
      if (hover?.kind === "face" && !sel.faces.includes(hover.index)) addFace(hover.index, COL.hovFace);
      if (hover?.kind === "edge" && !sel.edges.includes(hover.index)) addEdge(hover.index, COL.hovEdge);
    }
    this.requestRender();
  }

  /** Kalın çizgi parçaları (piksel genişliğinde) */
  fatLines(positions: number[], color: number, width = 2, dashed = false, onTop = true): LineSegments2 {
    const geo = new LineSegmentsGeometry();
    geo.setPositions(positions);
    const mat = new LineMaterial({ color, linewidth: width, dashed, dashSize: 3, gapSize: 2, depthTest: !onTop, worldUnits: false });
    mat.resolution.set(this.container.clientWidth, this.container.clientHeight);
    if (dashed) {
      mat.dashScale = 1 / this.worldPerPixel() / 2;
    }
    this.lineMaterials.add(mat);
    const l = new LineSegments2(geo, mat);
    if (dashed) l.computeLineDistances();
    l.renderOrder = onTop ? 20 : 1;
    const origDispose = geo.dispose.bind(geo);
    geo.dispose = () => {
      this.lineMaterials.delete(mat);
      mat.dispose();
      origDispose();
    };
    return l;
  }
}

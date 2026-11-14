// 3D görüntüleme: sahne, kamera (Y yukarı, SolidWorks gibi), düzlemler, model, seçim ve giriş yönlendirme.
import * as THREE from "three";
import { NavControls, type Pivot } from "./nav";
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
  hovFace: 0xffb066,
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
  private triad!: THREE.Object3D;
  /** döndürme merkezi işareti (SolidWorks: macenta) */
  private pivotMark = new THREE.Group();
  showPlanes = true;

  constructor(readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0xe3e8f0);
    // Kurumsal Şerit: ortası açık, kenarları mavi-gri ışınsal zemin (dışa aktarılan görüntülerde de opak)
    {
      const c = document.createElement("canvas");
      c.width = c.height = 256;
      const g = c.getContext("2d")!;
      const gr = g.createRadialGradient(128, 102, 0, 128, 128, 190);
      gr.addColorStop(0, "#fbfcfe");
      gr.addColorStop(0.7, "#e3e8f0");
      gr.addColorStop(1, "#d5dce7");
      g.fillStyle = gr;
      g.fillRect(0, 0, 256, 256);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      this.scene.background = t;
    }
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
    this.triad = this.makeTriad();
    this.scene.add(this.camera, this.model, this.hl, this.planesGroup, this.overlay, this.triad, this.pivotMark);

    this.controls = new NavControls(this.camera, this.renderer.domElement);
    this.controls.addEventListener("change", () => this.requestRender());
    this.controls.pivotAt = (x, y, ent) => this.navPivot(x, y, ent);
    this.controls.addEventListener("pivot", () => this.showPivot(this.controls.pivot));
    this.renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());

    this.setupInput();
    this.viewStd("iso");
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    const loop = () => {
      if (this.needsRender) {
        this.needsRender = false;
        this.renderer.render(this.scene, this.viewCam());
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
  /** tek parmak bu noktada nesneyi tutar mı (montajda bileşen sürükleme); true → olaylar işleyiciye, kaydırma yok */
  touchGrab: ((x: number, y: number) => boolean) | null = null;
  /** D2-5: dokunulan öğeyi işleyen araçlarda (kırp, radyüs…) parmak imleç kayması yok */
  touchNoOffset: (() => boolean) | null = null;
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
  private wrap(e: PointerEvent, dy = 0, abs?: [number, number]): PointerEvent {
    const m = this.mods;
    if (!dy && !m.ctrl && !m.shift && !abs) return e;
    return new Proxy(e, {
      get: (t, k) => {
        if (abs && k === "clientX") return abs[0];
        if (abs && k === "clientY") return abs[1];
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
    let gesture: { max: number; t: number; moved: boolean; t2: number } | null = null;
    /** basılı parmaklar (çok parmak dokunuşu sayımı) */
    const live = new Map<number, [number, number]>();
    /** parmakla çizim (tek dokunuş araç olarak) */
    let drawTouch: { id: number; t: number; moved: boolean; x: number; y: number; tp?: boolean } | null = null;
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
        if (e.pointerType === "touch" && e.target === canvas && !penRecent()) {
          // D1-8: çok parmak dokunuşu (2 = geri al, 3 = ileri al) parmağın hangi yola (çizim / tutma / gezinme) gittiğinden bağımsız sayılır
          if (!live.size) gesture = { max: 0, t: performance.now(), moved: false, t2: 0 };
          live.set(e.pointerId, [e.clientX, e.clientY]);
          if (gesture && live.size === 2 && !gesture.t2) gesture.t2 = performance.now();
          if (gesture) gesture.max = Math.max(gesture.max, live.size);
        }
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
          touches.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), moved: false });
          if (touches.size > 1) {
            multi = true;
            clearLp();
            return;
          }
          if (this.touchGrab?.(e.clientX, e.clientY)) {
            // B3: parmak bileşeni tutar (imleç kaydırması yok); ikinci parmak gelince gezinmeye döner
            e.stopPropagation();
            touches.delete(e.pointerId);
            drawTouch = { id: e.pointerId, t: performance.now(), moved: false, x: e.clientX, y: e.clientY };
            active = e.pointerId;
            activeType = "touch";
            activeDy = 0;
            try { canvas.setPointerCapture(e.pointerId); } catch {}
            this.handler?.down?.(this.wrap(e, 0));
            startLp(e);
            return;
          }
          if (touchDraws() && this.touchDrawOk?.()) {
            // tek parmak araç olarak çizer
            e.stopPropagation();
            touches.delete(e.pointerId);
            drawTouch = { id: e.pointerId, t: performance.now(), moved: false, x: e.clientX, y: e.clientY };
            active = e.pointerId;
            activeType = "touch";
            activeDy = this.touchNoOffset?.() ? 0 : touchOffset();
            try { canvas.setPointerCapture(e.pointerId); } catch {}
            if (prefs.touchpad) {
              // dokunmatik fare: imleç göreli hareket eder, kısa dokunuş tıklar
              drawTouch.tp = true;
              const r = canvas.getBoundingClientRect();
              if (!this.tp || this.tp[0] < r.left || this.tp[0] > r.right || this.tp[1] < r.top || this.tp[1] > r.bottom) this.tp = [r.left + r.width / 2, r.top + r.height / 2];
              this.setDrawPt({ clientX: this.tp[0], clientY: this.tp[1], pointerType: "tp" });
              return;
            }
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
        if (e.pointerType === "touch" && gesture) {
          const st0 = live.get(e.pointerId);
          if (st0 && Math.hypot(e.clientX - st0[0], e.clientY - st0[1]) > 5) gesture.moved = true; // 5 px: kısa iki parmak kaydırması "dokunuş" (geri al) sayılmasın
        }
        if (e.pointerType === "touch") {
          if (blocked.has(e.pointerId)) return void e.stopPropagation();
          if (drawTouch && drawTouch.id === e.pointerId) {
            e.stopPropagation();
            const ddx = e.clientX - drawTouch.x, ddy = e.clientY - drawTouch.y;
            if (Math.hypot(e.clientX - drawTouch.x, e.clientY - drawTouch.y) > 8 || drawTouch.tp) drawTouch.moved = drawTouch.moved || Math.hypot(ddx, ddy) > 2;
            drawTouch.x = e.clientX;
            drawTouch.y = e.clientY;
            if (drawTouch.tp && this.tp) {
              const r = canvas.getBoundingClientRect();
              const g = 0.35 + Math.min(1.2, Math.hypot(ddx, ddy) / 25);
              this.tp = [Math.max(r.left, Math.min(r.right, this.tp[0] + ddx * g)), Math.max(r.top, Math.min(r.bottom, this.tp[1] + ddy * g))];
              this.setDrawPt({ clientX: this.tp[0], clientY: this.tp[1], pointerType: "tp" });
              this.handler?.hover?.(this.wrap(e, 0, this.tp));
              return;
            }
            if (lp?.fired) return;
            const w = this.wrap(e, activeDy);
            this.setDrawPt(w);
            this.handler?.move?.(w);
            return;
          }
          const t = touches.get(e.pointerId);
          if (t && Math.hypot(e.clientX - t.x, e.clientY - t.y) > 10) {
            t.moved = true;
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
      if (e.pointerType === "touch" && live.delete(e.pointerId) && !live.size) {
        const g = gesture;
        gesture = null;
        // gerçek çok parmak dokunuşu: parmaklar birlikte iner (≤ 150 ms), kıpırdamaz, kısa sürer (≤ 300 ms)
        if (!cancel && g && g.max >= 2 && !g.moved && g.t2 - g.t < 150 && performance.now() - g.t < 300 && prefs.fingerUndo) setTimeout(() => this.onFingerTap?.(g.max), 0);
      }
      if (e.pointerType === "touch") {
        if (blocked.delete(e.pointerId)) return void e.stopPropagation();
        if (drawTouch && drawTouch.id === e.pointerId) {
          e.stopPropagation();
          const dt = drawTouch;
          drawTouch = null;
          active = null;
          if (dt.tp && this.tp) {
            if (!cancel && !fired && !dt.moved && performance.now() - dt.t < 350) {
              const w = this.wrap(e, 0, this.tp);
              this.handler?.down?.(w);
              this.handler?.up?.(w);
            }
            this.setDrawPt({ clientX: this.tp[0], clientY: this.tp[1], pointerType: "tp" });
            return;
          }
          this.setDrawPt(null);
          if (!cancel && !fired) this.handler?.up?.(this.wrap(e, activeDy));
          return;
        }
        const t = touches.get(e.pointerId);
        touches.delete(e.pointerId);
        if (!cancel && !fired && t && !t.moved && !multi && performance.now() - t.t < 450) this.handler?.tap?.(e);
        if (touches.size === 0) {
          multi = false;
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
  /** dokunmatik fare imleci */
  private tp: [number, number] | null = null;
  /** dokunmatik fare imlecini gizle (mod değişince) */
  hideTouchpad() {
    this.tp = null;
    this.setDrawPt(null);
  }
  private tcursor: HTMLDivElement | null = null;
  /** dokunmatik/kalemde yakalama türü simgesi (fare imleci görünmediği için; eskiz düzenleyici ayarlar) */
  snapIcon: string | null = null;
  private sbadge: HTMLDivElement | null = null;
  private setDrawPt(e: { clientX: number; clientY: number; pointerType: string } | null) {
    this.drawPt = e ? { x: e.clientX, y: e.clientY, type: e.pointerType } : null;
    if (!e) {
      if (this.loupe) this.loupe.style.display = "none";
      if (this.tcursor) this.tcursor.style.display = "none";
      if (this.sbadge) this.sbadge.style.display = "none";
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
    const sb = document.createElement("div");
    sb.className = "snap-badge";
    sb.style.cssText = "position:fixed;z-index:45;pointer-events:none;width:40px;height:40px;display:none;filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))";
    document.body.appendChild(sb);
    this.sbadge = sb;
    this.onRender(() => this.drawLoupe());
  }
  private drawLoupe() {
    const d = this.drawPt, lc = this.loupe!, tc = this.tcursor!;
    if (!d) return;
    // yakalama simgesi: fare dışındaki girişlerde çizim noktasının yanında göster
    const sb = this.sbadge!;
    if (this.snapIcon && d.type !== "mouse") {
      if (sb.dataset.k !== this.snapIcon) ((sb.innerHTML = this.snapIcon), (sb.dataset.k = this.snapIcon));
      sb.style.display = "block";
      sb.style.left = d.x - 2 + "px";
      sb.style.top = d.y - 2 + "px";
    } else sb.style.display = "none";
    const off = (d.type === "touch" && touchOffset() > 0) || d.type === "tp";
    tc.style.display = off ? "block" : "none";
    if (off) {
      tc.style.left = d.x + "px";
      tc.style.top = d.y + "px";
    }
    if (!this.mag && (!prefs.loupe || d.type === "tp" || (this.loupeOk && !this.loupeOk()))) return void (lc.style.display = "none");
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
  /** Ekran dikdörtgenine yakınlaştır (Bölgeye Yakınlaştır) */
  zoomRect(x0: number, y0: number, x1: number, y1: number) {
    const r = this.container.getBoundingClientRect();
    const w = Math.abs(x1 - x0), hh = Math.abs(y1 - y0);
    if (w < 4 || hh < 4) return;
    this.pushView();
    const tgt = this.controls.target;
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const pl = new THREE.Plane().setFromNormalAndCoplanarPoint(dir, tgt);
    const p = new THREE.Vector3();
    if (!this.ray((x0 + x1) / 2, (y0 + y1) / 2).ray.intersectPlane(pl, p)) return;
    const d = p.sub(tgt);
    tgt.add(d);
    this.camera.position.add(d);
    this.camera.zoom *= Math.min(r.width / w, r.height / hh);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    this.requestRender();
  }
  /** fare büyüteci (G) */
  mag = false;
  setMag(on: boolean) {
    this.mag = on;
    if (!on) return this.setDrawPt(null);
    const mv = (e: PointerEvent) => {
      if (!this.mag) return removeEventListener("pointermove", mv);
      if (e.pointerType === "mouse") this.setDrawPt(e);
    };
    addEventListener("pointermove", mv);
  }
  /** Ekran merkezine göre yakınlaştır / uzaklaştır */
  zoomStep(f: number) {
    this.pushView();
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
      iso: [V(1, 1, 1), V(0, 1, 0)] /* D10-15: gerçek izometrik */,
    } as const;
    const [d, u] = map[name];
    this.setView(d.clone(), u.clone());
  }

  /** Eskiz düzlemine dik bak (Normal To) */
  viewNormal(f: Frame) {
    const y = frameY(f);
    this.setView(new THREE.Vector3(...f.n), new THREE.Vector3(...y));
  }

  /** D3-25: dünya noktasını görünür bandın (paneller hariç) ortasına getir — yakınlaştırma değişmez */
  centerOn(w: [number, number, number], ins: { t: number; b: number; l?: number }) {
    const h = this.container.clientHeight || 1, W = this.container.clientWidth || 1;
    const s = this.toScreen(w);
    const want = [(ins.l ?? 0) + (W - (ins.l ?? 0)) / 2, ins.t + (h - ins.t - ins.b) / 2];
    const px2w = this.viewHeight / this.camera.zoom / h;
    const up = this.camera.up.clone().normalize();
    const fwd = this.controls.target.clone().sub(this.camera.position).normalize();
    const right = new THREE.Vector3().crossVectors(fwd, up).normalize();
    const d = right.multiplyScalar((s[0] - want[0]) * px2w).add(up.multiplyScalar(-(s[1] - want[1]) * px2w));
    this.controls.target.add(d);
    this.camera.position.add(d);
    this.camera.updateMatrixWorld();
    this.requestRender();
  }
  /** D4-7: sığdırırken grafik alanı örten paneller (px, üst / alt) */
  fitInsets: { t: number; b: number; l?: number } | null = null;
  fit() {
    this.pushView();
    const box = this.bbox && !this.bbox.isEmpty() ? this.bbox.clone() : new THREE.Box3(new THREE.Vector3(-60, -60, -60), new THREE.Vector3(60, 60, 60));
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length() || 100;
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    const fitSize = size * 1.25;
    const ins = this.fitInsets, hv = ins ? Math.max(h * 0.35, h - ins.t - ins.b) : h;
    const wl = ins?.l ? Math.max(w * 0.35, w - ins.l) : w;
    this.camera.zoom = Math.min((this.viewHeight * (hv / h)) / fitSize, (this.viewHeight * (wl / h)) / fitSize);
    if (ins?.l && wl < w) {
      // sol çekmece açık: görünür alanın ortasına (hedef ekran solu yönünde kaydırılır)
      const px2w = this.viewHeight / this.camera.zoom / h;
      const fw = this.controls.target.clone().sub(this.camera.position).normalize();
      const rt = new THREE.Vector3().crossVectors(fw, this.camera.up).normalize();
      center.add(rt.multiplyScalar(-(ins.l / 2) * px2w));
    }
    this.camera.updateProjectionMatrix();
    if (ins && hv < h) {
      // görünür bandın ortasına: hedef ekran yukarısı yönünde kaydırılır
      const px2w = this.viewHeight / this.camera.zoom / h;
      const up = this.camera.up.clone().normalize();
      center.add(up.multiplyScalar(((ins.t - ins.b) / 2) * px2w * (hv === h - ins.t - ins.b ? 1 : 0)));
    }
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

  // ---------- döndürme merkezi (SolidWorks orta tuş) ----------
  /** görünür model ağları (parça + montaj); düzlemler, eskiz, vurgu ve eksen üçlüsü hariç */
  private navMeshes(): THREE.Mesh[] {
    const out: THREE.Mesh[] = [];
    const skip = new Set<THREE.Object3D>([this.planesGroup, this.overlay, this.hl, this.triad, this.pivotMark, this.camera]);
    const walk = (o: THREE.Object3D) => {
      if (!o.visible || skip.has(o) || o.userData.nonav) return;
      if ((o as THREE.Mesh).isMesh && !o.userData.ifc) out.push(o as THREE.Mesh);
      o.children.forEach(walk);
    };
    this.scene.children.forEach(walk);
    return out;
  }
  /** AR için görünür model ağları (sarı önizleme hariç) */
  arMeshes(): THREE.Mesh[] {
    const g = this.ghost;
    return this.navMeshes().filter((m) => {
      for (let o: THREE.Object3D | null = m; o; o = o.parent) if (o === g) return false;
      return true;
    });
  }
  /** döndürme merkezi: imleç altındaki model noktası (yakın köşeye yakalanır); boşlukta model tümüyle görünüyorsa model merkezi,
   * değilse hedef (null). entity: orta tıkla seçilen varlık → köşe = nokta, kenar / silindir = eksen, düz yüz = normal ekseni */
  navPivot(x: number, y: number, entity: boolean): Pivot | null {
    const meshes = this.navMeshes();
    if (!meshes.length) return null;
    const hit = this.ray(x, y).intersectObjects(meshes, false)[0];
    const r = this.renderer.domElement.getBoundingClientRect();
    const scr = (p: Vec3) => {
      const q = this.toScreen(p);
      return Math.hypot(q[0] + r.left - x, q[1] + r.top - y);
    };
    const md = this.mesh && this.modelMesh?.visible !== false && this.model.visible ? this.mesh : null;
    // model kutusu ve tümüyle ekranda mı
    const box = new THREE.Box3();
    meshes.forEach((m) => box.expandByObject(m));
    const allVisible = () => {
      if (box.isEmpty()) return false;
      const cs = [0, 1].flatMap((i) => [0, 1].flatMap((j) => [0, 1].map((k) => new THREE.Vector3(i ? box.max.x : box.min.x, j ? box.max.y : box.min.y, k ? box.max.z : box.min.z))));
      return cs.every((c) => {
        const v = c.clone().project(this.viewCam());
        return Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1;
      });
    };
    if (!entity) {
      // SolidWorks: orta tuşla serbest döndürmede merkez imlece bağlı DEĞİL —
      // model tümüyle görünüyorsa model merkezi; yakınlaştırılmışsa ekranın ortasındaki geometri
      // (imleç altındaki noktaya göre döndürmek görüntüyü bir anda kenara savuruyordu)
      if (allVisible()) return { p: box.getCenter(new THREE.Vector3()) };
      const c = this.ray(r.left + r.width / 2, r.top + r.height / 2).intersectObjects(meshes, false)[0];
      if (c) return { p: c.point.clone() };
      if (hit) return { p: hit.point.clone() };
      return null;
    }
    // yakın köşe (8 px) — yalnız orta TIKLA varlık seçerken
    if (md) {
      let best: Vec3 | null = null, bd = 8;
      for (const e of md.edges) for (const P of [e.s, e.e]) {
        const d = scr(P);
        if (d < bd) (bd = d), (best = P);
      }
      if (best && (!hit || this.visibleAt(best, hit))) return { p: new THREE.Vector3(...best) };
    }
    if (entity && md) {
      const pk = this.pick(x, y, { face: true, edge: true });
      if (pk?.kind === "edge") {
        const e = md.edges[pk.index];
        if (e.c && e.ax) return { p: new THREE.Vector3(...e.c), axis: new THREE.Vector3(...e.ax) };
        if (e.d) return { p: new THREE.Vector3(...pk.point), axis: new THREE.Vector3(...e.d) };
      }
      if (pk?.kind === "face") {
        const f = md.faces[pk.index];
        if (f.ax && f.ac) return { p: new THREE.Vector3(...f.ac), axis: new THREE.Vector3(...f.ax) };
        if (f.n) return { p: new THREE.Vector3(...pk.point), axis: new THREE.Vector3(...f.n) };
      }
    }
    // orta tık boşluğa ya da tanınmayan yere: varlık seçimi yok
    return null;
  }
  /** köşe, ışının çarptığı yüzeyin önünde ya da üzerinde mi (arkada kalan köşeye yakalanmasın) */
  private visibleAt(P: Vec3, hit: THREE.Intersection) {
    const cam = this.viewCam();
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    const v = new THREE.Vector3(...P);
    return v.clone().sub(hit.point).dot(dir) <= 1e-3 * hit.distance + 0.5;
  }
  /** döndürme merkezi işareti: macenta nokta (+ eksen çizgisi) */
  showPivot(pv: Pivot | null) {
    for (const c of [...this.pivotMark.children]) this.pivotMark.remove(c);
    if (pv) {
      const g = new THREE.BufferGeometry().setFromPoints([pv.p]);
      const pt = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xd6336c, size: 11, sizeAttenuation: false, depthTest: false }));
      pt.renderOrder = 20;
      this.pivotMark.add(pt);
      if (pv.axis) {
        const L = (this.bbox?.getSize(new THREE.Vector3()).length() ?? 200) * 0.75 + 20;
        const a = pv.axis.clone().normalize().multiplyScalar(L);
        const lg = new THREE.BufferGeometry().setFromPoints([pv.p.clone().sub(a), pv.p.clone().add(a)]);
        const ln = new THREE.Line(lg, new THREE.LineDashedMaterial({ color: 0xd6336c, dashSize: 6, gapSize: 4, depthTest: false }));
        ln.computeLineDistances();
        ln.renderOrder = 20;
        this.pivotMark.add(ln);
      }
    }
    this.requestRender();
  }

  // ---------- Işın ve izdüşüm ----------
  ndc(clientX: number, clientY: number) {
    const r = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  }
  /** perspektif görünüm: ortografik kameradan eşlenen perspektif kamera (gezinme ortografik kamerayla yapılır) */
  perspective = false;
  private pcam = new THREE.PerspectiveCamera(30, 1, 0.1, 1e6);
  viewCam(): THREE.Camera {
    if (!this.perspective) return this.camera;
    const c = this.camera, t = this.controls.target;
    const H = (c.top - c.bottom) / c.zoom;
    const d = H / 2 / Math.tan((this.pcam.fov * Math.PI) / 360);
    const dir = c.position.clone().sub(t).normalize();
    this.pcam.up.copy(c.up);
    this.pcam.position.copy(t).addScaledVector(dir, d);
    this.pcam.aspect = (c.right - c.left) / Math.max(1e-9, c.top - c.bottom);
    this.pcam.near = Math.max(0.01, d / 200);
    this.pcam.far = d * 200 + 1e5;
    this.pcam.lookAt(t);
    this.pcam.updateProjectionMatrix();
    this.pcam.updateMatrixWorld();
    return this.pcam;
  }
  setPerspective(on: boolean) {
    this.perspective = on;
    this.requestRender();
  }
  ray(clientX: number, clientY: number) {
    const rc = new THREE.Raycaster();
    rc.setFromCamera(this.ndc(clientX, clientY), this.viewCam());
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
    const v = new THREE.Vector3(...p).project(this.viewCam());
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
  /** SolidWorks sarı önizleme: özelliğin sonucu yarı saydam sarı (seçim ana modelde kalır) */
  ghost: THREE.Group | null = null;
  setGhost(mesh: MeshData | null) {
    if (this.ghost) {
      this.scene.remove(this.ghost);
      this.ghost.traverse((o: any) => o.geometry?.dispose());
      this.ghost = null;
    }
    if (mesh) {
      const g = new THREE.Group();
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(mesh.vertices, 3));
      geo.setAttribute("normal", new THREE.BufferAttribute(mesh.normals, 3));
      geo.setIndex(new THREE.BufferAttribute(mesh.triangles, 1));
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffd43b, transparent: true, opacity: 0.55, depthWrite: false, metalness: 0, roughness: 0.7 }));
      m.renderOrder = 5;
      const eg = new THREE.BufferGeometry();
      eg.setAttribute("position", new THREE.BufferAttribute(mesh.lines, 3));
      const l = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: 0xc99a00 }));
      g.add(m, l);
      g.name = "ghost";
      this.ghost = g;
      this.scene.add(g);
    }
    this.requestRender();
  }
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
      // D7-19: yüzey gövdesi (açık kabuk) varsa arka yüzü de çizilir ve seçilir (rengi verilebilir)
      if (mesh.faces.some((f) => f.srf)) mat.side = THREE.DoubleSide;
      this.modelMesh = new THREE.Mesh(geo, mat);
      const eg = new THREE.BufferGeometry();
      eg.setAttribute("position", new THREE.BufferAttribute(mesh.lines, 3));
      this.edgeObj = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: COL.edge }));
      this.model.add(this.modelMesh, this.edgeObj);
      // gizli kenarlar (gizli çizgi görünür stili için)
      const hid = new THREE.LineSegments(eg, new THREE.LineDashedMaterial({ color: 0x9aa5b1, dashSize: 2, gapSize: 1.5, depthFunc: THREE.GreaterDepth, depthWrite: false }));
      hid.computeLineDistances();
      hid.name = "hidden";
      this.model.add(hid);
      if (mesh.bbox) this.bbox = new THREE.Box3(new THREE.Vector3(...mesh.bbox.min), new THREE.Vector3(...mesh.bbox.max));
    }
    this.applyColors();
    this.applyStyle();
    this.requestRender();
  }

  /** görünüm renkleri: parça rengi ve yüz başına renk (yüz sırası → 0xRRGGBB) */
  partColor: number | null = null;
  faceColors = new Map<number, number>();
  setColors(part: number | null, faces: Map<number, number>) {
    this.partColor = part;
    this.faceColors = faces;
    this.applyColors();
    this.applyStyle();
  }
  /** Analiz renklendirmesi (koniklik analizi vb.): köşe normaline göre renk; null = kapalı */
  analysis: ((n: [number, number, number], i: number) => number) | null = null;
  setAnalysis(fn: ((n: [number, number, number], i: number) => number) | null) {
    this.analysis = fn;
    this.applyColors();
    this.applyStyle();
  }
  /** analiz: köşe yer değiştirmesi (null = asıl şekil); kenarlar gizlenir */
  setDeform(d: Float32Array | null) {
    if (!this.modelMesh || !this.mesh) return;
    const g = this.modelMesh.geometry as THREE.BufferGeometry;
    const v = this.mesh.vertices;
    if (!d) g.setAttribute("position", new THREE.BufferAttribute(v, 3));
    else {
      const p = new Float32Array(v.length);
      for (let i = 0; i < v.length; i++) p[i] = v[i] + d[i];
      g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    }
    g.computeBoundingSphere();
    if (this.edgeObj) this.edgeObj.visible = !d && this.displayStyle !== "shaded";
    this.requestRender();
  }
  private colorsOn() {
    return this.faceColors.size > 0 || !!this.analysis;
  }
  private applyColors() {
    if (!this.modelMesh || !this.mesh) return;
    const g = this.modelMesh.geometry as THREE.BufferGeometry;
    if (this.analysis) {
      const nr = this.mesh.normals as ArrayLike<number>, n = nr.length / 3, col = new Float32Array(n * 3), c = new THREE.Color();
      for (let i = 0; i < n; i++) c.setHex(this.analysis([nr[i * 3], nr[i * 3 + 1], nr[i * 3 + 2]], i)).toArray(col, i * 3);
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      (this.modelMesh.material as THREE.MeshStandardMaterial).vertexColors = true;
      return;
    }
    if (!this.faceColors.size) {
      g.deleteAttribute("color");
      (this.modelMesh.material as THREE.MeshStandardMaterial).vertexColors = false;
      return;
    }
    const n = this.mesh.vertices.length / 3;
    const base = new THREE.Color(this.partColor ?? COL.face);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) base.toArray(col, i * 3);
    const fg = this.mesh.faceGroups, tri = this.mesh.triangles;
    for (let i = 0; i < fg.length; i += 3) {
      const c = this.faceColors.get(fg[i + 2]);
      if (c === undefined) continue;
      const cc = new THREE.Color(c);
      for (let k = fg[i]; k < fg[i] + fg[i + 1]; k++) cc.toArray(col, tri[k] * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    (this.modelMesh.material as THREE.MeshStandardMaterial).vertexColors = true;
  }
  /** SolidWorks görüntü stilleri */
  displayStyle: "shadedEdges" | "shaded" | "hlr" | "hlv" | "wire" = "shadedEdges";
  transparent = false;
  setStyle(st: Viewer["displayStyle"]) {
    this.displayStyle = st;
    this.applyStyle();
    try {
      localStorage.setItem("imajcad.style", st); // D10-17
    } catch {}
  }
  applyStyle() {
    if (!this.modelMesh || !this.edgeObj) return;
    const st = this.displayStyle;
    const m = this.modelMesh.material as THREE.MeshStandardMaterial;
    const hid = this.model.getObjectByName("hidden");
    this.modelMesh.visible = st !== "wire";
    this.edgeObj.visible = st !== "shaded";
    if (hid) hid.visible = st === "hlv" || st === "wire";
    if (hid && st === "wire") ((hid as THREE.LineSegments).material as THREE.LineDashedMaterial).depthFunc = THREE.AlwaysDepth;
    else if (hid) ((hid as THREE.LineSegments).material as THREE.LineDashedMaterial).depthFunc = THREE.GreaterDepth;
    // gizli çizgi stillerinde yüzler arka plan rengiyle (yalnız derinlik için)
    const vc = this.colorsOn() && st !== "hlr" && st !== "hlv";
    m.vertexColors = vc;
    m.color.setHex(st === "hlr" || st === "hlv" ? 0xf3f5f8 : vc ? 0xffffff : this.partColor ?? COL.face);
    m.emissive.setHex(st === "hlr" || st === "hlv" ? 0xf3f5f8 : 0x000000);
    m.transparent = this.transparent && st !== "hlr" && st !== "hlv";
    m.opacity = m.transparent ? 0.35 : 1;
    m.depthWrite = !m.transparent;
    m.needsUpdate = true;
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

  /** imleç altındaki tüm yüz adayları (önden arkaya) — "diğerini seç" için */
  pickFacesAll(clientX: number, clientY: number): PickHit[] {
    if (!this.modelMesh) return [];
    const rc = this.ray(clientX, clientY);
    const out: PickHit[] = [];
    for (const h of rc.intersectObject(this.modelMesh, false)) {
      if (h.faceIndex === undefined || h.faceIndex === null) continue;
      const idx = this.faceGroupOf(h.faceIndex);
      if (idx >= 0 && !out.some((o) => o.kind === "face" && o.index === idx)) out.push({ kind: "face", index: idx, point: h.point.toArray() as Vec3 });
    }
    return out;
  }
  /** ekran kutusundaki yüz ve kenarlar (yüz merkezi / kenar orta noktası kutuda) */
  pickBox(x0: number, y0: number, x1: number, y1: number, cross: boolean): { faces: number[]; edges: number[] } {
    const r = this.renderer.domElement.getBoundingClientRect();
    const [ax, bx] = [Math.min(x0, x1) - r.left, Math.max(x0, x1) - r.left], [ay, by] = [Math.min(y0, y1) - r.top, Math.max(y0, y1) - r.top];
    const inB = (w: Vec3) => {
      const s = this.toScreen(w);
      return s[0] >= ax && s[0] <= bx && s[1] >= ay && s[1] <= by;
    };
    const m = this.mesh;
    if (!m) return { faces: [], edges: [] };
    const edges: number[] = [];
    m.edges.forEach((e, i) => {
      const ins = [e.s, e.m, e.e].map(inB);
      if (cross ? ins.some(Boolean) : ins.every(Boolean)) edges.push(i);
    });
    const faces: number[] = [];
    m.faces.forEach((f, i) => {
      if (f.c && inB(f.c) && !cross) faces.push(i);
    });
    return { faces, edges };
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
          const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, side: this.mesh!.faces[i]?.srf ? THREE.DoubleSide : THREE.FrontSide }));
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
      // ön seçim (SolidWorks dinamik vurgu): yüz turuncu + sınırı kalın
      const addOutline = (i: number, color: number) => {
        const pos = this.faceOutline(this.mesh!, i);
        if (pos.length) this.hl.add(this.fatLines(pos, color, 2.5, false, false));
      };
      sel.faces.forEach((i) => addFace(i, COL.selFace));
      sel.edges.forEach((i) => addEdge(i, COL.selEdge));
      if (hover?.kind === "face" && !sel.faces.includes(hover.index)) (addFace(hover.index, COL.hovFace), addOutline(hover.index, COL.hovEdge));
      if (hover?.kind === "edge" && !sel.edges.includes(hover.index)) addEdge(hover.index, COL.hovEdge);
    }
    this.requestRender();
  }

  /** yüzün sınır çizgileri (üçgenlerden: tek kez kullanılan kenarlar) → çizgi parçası konumları */
  faceOutline(md: MeshData, fi: number): number[] {
    const g = md.faceGroups, v = md.vertices, t = md.triangles;
    const key = (i: number) => `${Math.round(v[i * 3] * 1e3)},${Math.round(v[i * 3 + 1] * 1e3)},${Math.round(v[i * 3 + 2] * 1e3)}`;
    const cnt = new Map<string, [number, number, number]>();
    for (let k = 0; k < g.length; k += 3) {
      if (g[k + 2] !== fi) continue;
      for (let j = g[k]; j < g[k] + g[k + 1]; j += 3)
        for (let e = 0; e < 3; e++) {
          const a = t[j + e], b = t[j + ((e + 1) % 3)];
          const ka = key(a), kb = key(b);
          const kk = ka < kb ? ka + "|" + kb : kb + "|" + ka;
          const c = cnt.get(kk);
          cnt.set(kk, c ? [c[0] + 1, a, b] : [1, a, b]);
        }
    }
    const out: number[] = [];
    for (const [n, a, b] of cnt.values()) if (n === 1) out.push(v[a * 3], v[a * 3 + 1], v[a * 3 + 2], v[b * 3], v[b * 3 + 1], v[b * 3 + 2]);
    return out;
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

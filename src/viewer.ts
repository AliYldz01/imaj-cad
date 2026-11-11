// 3D görüntüleme: Three.js sahnesi, kamera, ızgara ve model çizimi.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { MeshData } from "./types";

export class Viewer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  readonly controls: OrbitControls;
  readonly overlay = new THREE.Group(); // eskiz önizlemeleri
  private model = new THREE.Group();
  private modelMesh: THREE.Mesh | null = null;
  private grid: THREE.Group;
  private viewHeight = 300; // görünür alan yüksekliği (mm)
  private needsRender = true;
  bbox: THREE.Box3 | null = null;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0xeef1f5);
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = "none";

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100000, 100000);
    this.camera.up.set(0, 0, 1);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(0.5, 0.3, 1);
    this.camera.add(sun);
    this.scene.add(this.camera);

    this.grid = this.makeGrid();
    this.scene.add(this.grid, this.model, this.overlay);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = false;
    this.controls.screenSpacePanning = true;
    this.controls.zoomToCursor = true;
    this.controls.addEventListener("change", () => this.requestRender());

    this.viewIso();
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    const loop = () => {
      if (this.needsRender) {
        this.needsRender = false;
        this.renderer.render(this.scene, this.camera);
      }
      requestAnimationFrame(loop);
    };
    loop();
  }

  requestRender() {
    this.needsRender = true;
  }

  private makeGrid() {
    const g = new THREE.Group();
    const minor = new THREE.GridHelper(1000, 100, 0xd3d9e2, 0xd3d9e2);
    const major = new THREE.GridHelper(1000, 10, 0xaab4c3, 0xaab4c3);
    for (const h of [minor, major]) {
      h.rotation.x = Math.PI / 2;
      (h.material as THREE.Material).depthWrite = false;
      g.add(h);
    }
    const axis = (to: THREE.Vector3, color: number) => {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), to]);
      return new THREE.Line(geo, new THREE.LineBasicMaterial({ color, depthTest: false }));
    };
    g.add(axis(new THREE.Vector3(60, 0, 0), 0xd33f3f));
    g.add(axis(new THREE.Vector3(0, 60, 0), 0x2f9e44));
    g.add(axis(new THREE.Vector3(0, 0, 60), 0x1c7ed6));
    g.renderOrder = -1;
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
    this.requestRender();
  }

  /** Bir ekran pikselinin dünyadaki karşılığı (mm) */
  worldPerPixel() {
    return this.viewHeight / this.camera.zoom / (this.container.clientHeight || 1);
  }

  private setView(dir: THREE.Vector3, target?: THREE.Vector3) {
    const t = target ?? this.controls.target.clone();
    this.controls.target.copy(t);
    this.camera.position.copy(t).addScaledVector(dir.normalize(), 2000);
    this.camera.lookAt(t);
    this.controls.update();
    this.requestRender();
  }

  viewTop() {
    this.setView(new THREE.Vector3(0, -0.0001, 1));
  }
  viewFront() {
    this.setView(new THREE.Vector3(0, -1, 0.0001));
  }
  viewIso() {
    this.setView(new THREE.Vector3(1, -1, 0.8));
  }

  fit() {
    const box = this.bbox && !this.bbox.isEmpty() ? this.bbox : new THREE.Box3(new THREE.Vector3(-100, -100, 0), new THREE.Vector3(100, 100, 0));
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length() || 100;
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    const fitSize = size * 1.3;
    this.camera.zoom = Math.min(this.viewHeight / fitSize, (this.viewHeight * (w / h)) / fitSize);
    this.camera.updateProjectionMatrix();
    const dir = this.camera.position.clone().sub(this.controls.target);
    this.setView(dir, center);
  }

  setRotateEnabled(on: boolean) {
    const c = this.controls;
    c.enableRotate = on;
    if (on) {
      c.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
      c.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    } else {
      // Eskiz modunda tek parmak / sol tık çizim içindir.
      c.mouseButtons = { LEFT: -1 as any, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN };
      c.touches = { ONE: -1 as any, TWO: THREE.TOUCH.DOLLY_PAN };
    }
  }

  private ndc(clientX: number, clientY: number) {
    const r = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  }

  /** Ekran noktasını Z=z yatay düzlemine izdüşürür */
  pickPlane(clientX: number, clientY: number, z: number): THREE.Vector3 | null {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(this.ndc(clientX, clientY), this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -z);
    const p = new THREE.Vector3();
    return ray.ray.intersectPlane(plane, p) ? p : null;
  }

  /** Modelin yüzeyine dokunulduysa noktayı ve normali döndürür */
  pickModel(clientX: number, clientY: number): { point: THREE.Vector3; normal: THREE.Vector3 } | null {
    if (!this.modelMesh) return null;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(this.ndc(clientX, clientY), this.camera);
    const hit = ray.intersectObject(this.modelMesh, false)[0];
    if (!hit || !hit.face) return null;
    return { point: hit.point, normal: hit.face.normal.clone() };
  }

  setModel(mesh: MeshData | null) {
    for (const c of [...this.model.children]) {
      this.model.remove(c);
      (c as any).geometry?.dispose();
    }
    this.modelMesh = null;
    this.bbox = null;
    if (mesh) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(mesh.vertices, 3));
      geo.setAttribute("normal", new THREE.BufferAttribute(mesh.normals, 3));
      geo.setIndex(new THREE.BufferAttribute(mesh.triangles, 1));
      const mat = new THREE.MeshStandardMaterial({
        color: 0x8fa9c8,
        metalness: 0.15,
        roughness: 0.55,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      });
      this.modelMesh = new THREE.Mesh(geo, mat);
      const eg = new THREE.BufferGeometry();
      eg.setAttribute("position", new THREE.BufferAttribute(mesh.lines, 3));
      const edges = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: 0x1f2a37 }));
      this.model.add(this.modelMesh, edges);
      if (mesh.bbox) {
        this.bbox = new THREE.Box3(new THREE.Vector3(...mesh.bbox.min), new THREE.Vector3(...mesh.bbox.max));
      }
    }
    this.requestRender();
  }
}

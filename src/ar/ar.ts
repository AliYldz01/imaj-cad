// Artırılmış gerçeklik (AR) görüntüleme
// - Android (Chrome): WebXR immersive-ar + hit-test → model gerçek boyutta yere / masaya konur (uygulama içinde)
// - iPhone / iPad (Safari): USDZ (three USDZExporter) → sistemin AR Quick Look görüntüleyicisi
// - ikisi de yoksa (dokunmatik cihaz): kamera görüntüsünün üstünde model (sahneye sabitlenmez)
import * as THREE from "three";
import { USDZExporter } from "three/examples/jsm/exporters/USDZExporter.js";

export type ArKind = "webxr" | "quicklook" | "camera" | "none";

const DEF_COLOR = 0x9aa7b8;

/** cihazın AR yolu (başlangıçta bir kez sorulur; requestSession kullanıcı dokunuşundan hemen sonra çağrılabilsin diye) */
let xrOk: boolean | null = null;
const xr = (navigator as any).xr;
if (xr?.isSessionSupported) xr.isSessionSupported("immersive-ar").then((v: boolean) => (xrOk = !!v)).catch(() => (xrOk = false));
else xrOk = false;

export function arKind(): ArKind {
  if (xrOk) return "webxr";
  try {
    if (document.createElement("a").relList.supports("ar")) return "quicklook";
  } catch {}
  const touch = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 1;
  if (touch && !!navigator.mediaDevices) return "camera";
  return "none";
}

/** görünür model ağlarından AR modeli: dünya koordinatında, renklere göre parçalanmış, metre biriminde,
 * tabanı y = 0'da ve x / z'de ortalanmış. size = mm cinsinden sınır kutusu */
export function buildArModel(meshes: THREE.Mesh[]): { model: THREE.Group; size: [number, number, number] } | null {
  const byColor = new Map<number, number[]>();
  const push = (c: number, a: ArrayLike<number>, i: number) => {
    let arr = byColor.get(c);
    if (!arr) byColor.set(c, (arr = []));
    for (let k = 0; k < 9; k++) arr.push(a[i + k]);
  };
  for (const m of meshes) {
    const src = m.geometry as THREE.BufferGeometry;
    if (!src?.attributes?.position) continue;
    m.updateWorldMatrix(true, false);
    let g = src.clone().applyMatrix4(m.matrixWorld);
    if (g.index) g = g.toNonIndexed();
    const pos = g.attributes.position.array as ArrayLike<number>;
    const mat: any = Array.isArray(m.material) ? m.material[0] : m.material;
    const base = mat?.color ? (mat.color as THREE.Color).getHex() : DEF_COLOR;
    const col = mat?.vertexColors ? (g.attributes.color as THREE.BufferAttribute | undefined) : undefined;
    const cc = new THREE.Color();
    for (let t = 0; t + 2 < g.attributes.position.count; t += 3) {
      let c = base;
      if (col) {
        cc.setRGB(col.getX(t), col.getY(t), col.getZ(t));
        // aynı rengi tek parçada topla (küçük gölgeleme farklarını yuvarla)
        c = cc.getHex() & 0xfcfcfc;
      }
      push(c, pos, t * 3);
    }
    g.dispose();
  }
  if (!byColor.size) return null;
  const inner = new THREE.Group();
  for (const [c, arr] of byColor) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
    g.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: c, metalness: 0.15, roughness: 0.55, side: THREE.DoubleSide });
    inner.add(new THREE.Mesh(g, mat));
  }
  const box = new THREE.Box3().setFromObject(inner);
  const ctr = box.getCenter(new THREE.Vector3());
  inner.position.set(-ctr.x, -box.min.y, -ctr.z);
  const model = new THREE.Group();
  model.add(inner);
  model.scale.setScalar(0.001); // mm → m
  const s = box.getSize(new THREE.Vector3());
  return { model, size: [s.x, s.y, s.z] };
}

export async function usdzBytes(model: THREE.Group): Promise<Uint8Array> {
  const scene = new THREE.Scene();
  scene.add(model.clone());
  const out: any = await new USDZExporter().parseAsync(scene);
  return out instanceof Uint8Array ? out : new Uint8Array(out);
}

const fmt = (v: number) => (v >= 100 ? v.toFixed(0) : v.toFixed(1)).replace(".", ",");
const sizeText = (s: [number, number, number]) => `${fmt(s[0])} × ${fmt(s[2])} × ${fmt(s[1])} mm`;
const scaleText = (k: number) => (Math.abs(k - 1) < 1e-3 ? "1:1" : k < 1 ? `1:${fmt(1 / k)}` : `${fmt(k)}:1`);

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text = ""): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/** Ortak AR arayüzü: üst bant (kapat, ölçek, boyut), ipucu, alt düğmeler. Düğmelere dokunuş XR "select" olayı üretmez */
function arUi(size: [number, number, number], onClose: () => void) {
  const root = el("div", "ar-ui");
  const top = el("div", "ar-top");
  const close = el("button", "ar-btn ar-close", "✕ Kapat");
  const info = el("div", "ar-info");
  const scaleL = el("b", "ar-scale", "1:1");
  info.append(scaleL, document.createTextNode(" · " + sizeText(size)));
  top.append(close, info);
  const hint = el("div", "ar-hint");
  const bar = el("div", "ar-bar");
  root.append(top, hint, bar);
  close.onclick = (e) => (e.stopPropagation(), onClose());
  const btn = (t: string, f: () => void) => {
    const b = el("button", "ar-btn", t);
    b.onclick = (e) => (e.stopPropagation(), f());
    bar.appendChild(b);
    return b;
  };
  // XR: düğmeye dokunuş modeli yerleştirmesin
  root.addEventListener("beforexrselect", (e: Event) => {
    if ((e.target as HTMLElement).closest?.(".ar-btn")) e.preventDefault();
  });
  document.body.appendChild(root);
  return { root, hint, scaleL, btn };
}

/** model üstünde parmak hareketleri: tek parmak yatay = döndür, iki parmak = ölçek (serbest) */
function gestures(root: HTMLElement, onRot: (d: number) => void, onPinch: (k: number) => void) {
  const pts = new Map<number, { x: number; y: number }>();
  let d0 = 0;
  const dist = () => {
    const [a, b] = [...pts.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  root.addEventListener("pointerdown", (e) => {
    if ((e.target as HTMLElement).closest(".ar-btn")) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) d0 = dist();
  });
  root.addEventListener("pointermove", (e) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    p.x = e.clientX;
    p.y = e.clientY;
    if (pts.size === 1) onRot(dx * 0.012);
    else if (pts.size === 2 && d0 > 0) {
      const d = dist();
      onPinch(d / d0);
      d0 = d;
    }
  });
  const up = (e: PointerEvent) => pts.delete(e.pointerId);
  root.addEventListener("pointerup", up);
  root.addEventListener("pointercancel", up);
}

const SCALES = [1, 0.5, 0.2, 0.1];

function lights(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8890a0, 2.2));
  const d = new THREE.DirectionalLight(0xffffff, 1.6);
  d.position.set(0.5, 2, 1);
  scene.add(d);
}

/** Android: WebXR ile gerçek boyutta yerleştirme */
export async function startWebXR(model: THREE.Group, size: [number, number, number], onMsg: (m: string, err?: boolean) => void) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  renderer.setSize(innerWidth, innerHeight);
  renderer.xr.enabled = true;
  renderer.domElement.className = "ar-canvas";
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  lights(scene);
  const camera = new THREE.PerspectiveCamera();
  const reticle = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.08, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff7a1a }));
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle, model);
  model.visible = false;
  let session: any = null;
  let placed = false;
  let k = 1;
  const base = model.scale.x;
  const ui = arUi(size, () => session?.end());
  const setHint = () =>
    (ui.hint.textContent = placed
      ? "Tek parmakla kaydır: döndür · iki parmak: ölçek · etrafında yürüyebilirsin"
      : reticle.visible
        ? "Turuncu halka yüzeyde: yerleştirmek için ekrana dokun"
        : "Telefonu yavaşça gezdir: zemin ya da masa aranıyor…");
  const setScale = (v: number) => {
    k = Math.min(10, Math.max(0.01, v));
    model.scale.setScalar(base * k);
    ui.scaleL.textContent = scaleText(k);
  };
  for (const s of SCALES) ui.btn(scaleText(s), () => setScale(s));
  ui.btn("Taşı", () => ((placed = false), setHint()));
  ui.btn("⟲ 90°", () => (model.rotation.y += Math.PI / 2));
  gestures(ui.root, (d) => placed && (model.rotation.y += d), (f) => setScale(k * f));
  const cleanup = () => {
    renderer.setAnimationLoop(null);
    ui.root.remove();
    renderer.domElement.remove();
    renderer.dispose();
    model.traverse((o: any) => (o.geometry?.dispose(), o.material?.dispose?.()));
  };
  try {
    session = await xr.requestSession("immersive-ar", { requiredFeatures: ["hit-test"], optionalFeatures: ["dom-overlay"], domOverlay: { root: ui.root } });
  } catch (e: any) {
    cleanup();
    onMsg("AR oturumu açılamadı: " + (e?.message || e), true);
    return;
  }
  renderer.xr.setReferenceSpaceType("local");
  await renderer.xr.setSession(session);
  const viewerSpace = await session.requestReferenceSpace("viewer");
  const hitSource = await session.requestHitTestSource({ space: viewerSpace });
  session.addEventListener("select", () => {
    if (!placed && reticle.visible) {
      placed = true;
      setHint();
    }
  });
  session.addEventListener("end", () => (hitSource?.cancel?.(), cleanup()));
  const tmp = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  setHint();
  renderer.setAnimationLoop((_t: number, frame: any) => {
    if (frame) {
      const ref = renderer.xr.getReferenceSpace();
      const hits = frame.getHitTestResults(hitSource);
      const was = reticle.visible;
      if (hits.length && ref) {
        const pose = hits[0].getPose(ref);
        reticle.visible = !!pose;
        if (pose) {
          reticle.matrix.fromArray(pose.transform.matrix);
          if (!placed) {
            reticle.matrix.decompose(tmp, q, sc);
            model.position.copy(tmp);
            model.visible = true;
            // önü kullanıcıya baksın (yalnız düşey eksende)
            const cam = renderer.xr.getCamera();
            const dx = cam.position.x - tmp.x,
              dz = cam.position.z - tmp.z;
            if (dx * dx + dz * dz > 1e-6) model.rotation.set(0, Math.atan2(dx, dz), 0);
          }
        }
      } else reticle.visible = false;
      reticle.visible = reticle.visible && !placed;
      if (was !== reticle.visible) setHint();
    }
    renderer.render(scene, camera);
  });
}

/** iPhone / iPad: USDZ → AR Quick Look. Dışa aktarma sürerken kullanıcı etkinliği düşebildiği için açma ayrı bir dokunuşla */
export async function startQuickLook(model: THREE.Group, size: [number, number, number], onMsg: (m: string, err?: boolean) => void) {
  const dlg = el("div", "ar-ql");
  const box = el("div", "ar-ql-box");
  const msg = el("p", "", "AR modeli hazırlanıyor…");
  const close = el("button", "ar-btn", "Vazgeç");
  box.append(el("h3", "", "AR'de Gör"), msg, close);
  dlg.appendChild(box);
  document.body.appendChild(dlg);
  let url = "";
  const done = () => (dlg.remove(), url && setTimeout(() => URL.revokeObjectURL(url), 60000));
  close.onclick = done;
  try {
    const bytes = await usdzBytes(model);
    url = URL.createObjectURL(new Blob([bytes as any], { type: "model/vnd.usdz+zip" }));
    msg.textContent = `Boyut: ${sizeText(size)} — gerçek boyutta açılır. Yüzeye koymak için iPhone'u gezdir.`;
    const a = el("a", "ar-btn ar-open", "") as HTMLAnchorElement;
    a.rel = "ar";
    a.href = url + "#allowsContentScaling=1";
    const img = document.createElement("img");
    img.alt = "";
    a.append(img, document.createTextNode("AR'de aç"));
    a.addEventListener("click", () => setTimeout(done, 500));
    box.insertBefore(a, close);
  } catch (e: any) {
    done();
    onMsg("AR modeli hazırlanamadı: " + (e?.message || e), true);
  }
}

/** AR desteği olmayan dokunmatik cihaz: kamera görüntüsü üstünde model (sahneye sabitlenmez) */
export async function startCamera(model: THREE.Group, size: [number, number, number], onMsg: (m: string, err?: boolean) => void) {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
  } catch (e: any) {
    onMsg("Kamera açılamadı: " + (e?.message || e), true);
    return;
  }
  const video = el("video", "ar-video") as HTMLVideoElement;
  video.playsInline = true;
  video.muted = true;
  video.srcObject = stream;
  document.body.appendChild(video);
  void video.play().catch(() => {});
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  renderer.setSize(innerWidth, innerHeight);
  renderer.domElement.className = "ar-canvas ar-cam";
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  lights(scene);
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.001, 100);
  scene.add(model);
  // modelin en büyük boyutu ekranın ~%60'ı olacak uzaklık
  const m = Math.max(...size) * 0.001;
  const d = m / (0.6 * 2 * Math.tan((25 * Math.PI) / 180) * Math.min(1, innerWidth / innerHeight));
  const cy = (size[1] * 0.001) / 2;
  camera.position.copy(new THREE.Vector3(0.55, 0.5, 1).normalize().multiplyScalar(d)).add(new THREE.Vector3(0, cy, 0));
  camera.lookAt(0, cy, 0);
  let k = 1;
  const base = model.scale.x;
  let running = true;
  const ui = arUi(size, () => end());
  ui.hint.textContent = "Bu cihazda AR (yüzey algılama) yok: model kamera görüntüsünün üstünde gösterilir. Kaydır: döndür · iki parmak: büyüt / küçült";
  ui.scaleL.textContent = "önizleme";
  ui.btn("⟲ 90°", () => (model.rotation.y += Math.PI / 2));
  gestures(ui.root, (d) => (model.rotation.y += d), (f) => ((k = Math.min(20, Math.max(0.05, k * f))), model.scale.setScalar(base * k)));
  const loop = () => {
    if (!running) return;
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  };
  loop();
  const end = () => {
    running = false;
    stream.getTracks().forEach((t) => t.stop());
    video.remove();
    ui.root.remove();
    renderer.domElement.remove();
    renderer.dispose();
  };
}

/** giriş: cihaza göre AR yolunu seçer */
export async function openAR(meshes: THREE.Mesh[], onMsg: (m: string, err?: boolean) => void) {
  const kind = arKind();
  if (kind === "none") return onMsg("AR görüntüleme telefon ve tablette çalışır (Android: Chrome, iPhone / iPad: Safari)", true);
  const r = buildArModel(meshes);
  if (!r) return onMsg("AR için görünür model yok", true);
  if (kind === "webxr") return startWebXR(r.model, r.size, onMsg);
  if (kind === "quicklook") return startQuickLook(r.model, r.size, onMsg);
  return startCamera(r.model, r.size, onMsg);
}

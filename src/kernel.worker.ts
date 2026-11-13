/// <reference lib="webworker" />
// Geometri çekirdeği: OpenCascade (WebAssembly) ayrı bir iş parçacığında çalışır.
// OpenCascade Technology, LGPL 2.1 (+ OCCT istisnası) lisanslıdır ve ayrı bir .wasm dosyası olarak yüklenir.

import opencascade from "replicad-opencascadejs";
import wasmUrl from "replicad-opencascadejs/wasm?url";
import {
  setOC, getOC, cast, makeCircle, drawCircle, drawEllipse, drawText, loadFont, draw, Plane, Sketch, genericSweep, makeCompound, makeCylinder,
  importSTEP, basicFaceExtrusion, makeVertex, makeThreePointArc, assembleWire, makeFace, makeLine, ProjectionCamera, makeProjectedEdges, makeHelix, makeOffset, loft, drawPointsInterpolation, Vector, measureArea, measureLength, measureDistanceBetween, measureShapeVolumeProperties,
} from "replicad";
import type {
  EdgeInfo, EdgeRef, FaceInfo, FaceRef, Frame, KFeature, KPlane, KernelRequest, KernelResponse, Loop, MassProps, MeasureItem, MeshData,
  Seg, SectionItem, TextItem, Vec2, Vec3, CutItem, MemberItem, WeldItem, DrawView, DrawData,
} from "./doc/types";
import { thinRegion, segPoints, revSeg } from "./sketch/profile";
import { sheetOpenRegion } from "./sheet/sheet";
import { unfold, cylinderParams } from "./sheet/unfold";

type Shape = any;
/** Çoklu gövde: her eleman ayrı bir katı */
let bodies: Shape[] = [];
/** kaynak dikişleri: görüntü ve dışa aktarmaya katılır, gövde işlemlerine katılmaz */
let welds: Shape[] = [];
let weldInfo: WeldItem[] = [];
let frames: Record<string, Frame> = {};
let fontReady: Promise<void> | null = null;

const post = (msg: KernelResponse, transfer: Transferable[] = []) =>
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg, transfer);
const errMsg = (e: unknown) => {
  const m = String((e as Error)?.message ?? e);
  return /^\d+$/.test(m) || m === "[object WebAssembly.Exception]" ? "Geometri işlemi başarısız (OpenCascade hatası)" : m;
};

async function init() {
  try {
    const OC = await (opencascade as any)({ locateFile: () => wasmUrl });
    setOC(OC);
    post({ type: "ready" });
  } catch (e) {
    post({ type: "fatal", message: errMsg(e) });
  }
}

// ---------- vektör yardımcıları ----------
const vadd = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const vmul = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const vsub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vdot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vlen = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const vnorm = (a: Vec3): Vec3 => vmul(a, 1 / (vlen(a) || 1));
const vcross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const toWorld = (f: Frame, p: Vec2): Vec3 => {
  const y = vcross(f.n, f.x);
  return vadd(f.o, vadd(vmul(f.x, p[0]), vmul(y, p[1])));
};
const tup = (v: any): Vec3 => v.toTuple() as Vec3;
const solidsOf = (s: Shape): Shape[] => {
  try {
    const arr = s.solids as Shape[] | undefined;
    return arr && arr.length ? arr : [s];
  } catch {
    return [s];
  }
};

function makePlane(f: Frame, shift = 0) {
  return new Plane(vadd(f.o, vmul(f.n, shift)), f.x, f.n);
}

/** Tüm gövdeler tek şekil olarak */
function all(): Shape | null {
  const list = [...bodies, ...welds];
  if (!list.length) return null;
  // makeCompound girdileri siler: kopyalarla çalış
  return list.length === 1 ? list[0] : makeCompound(list.map((b) => b.clone()));
}
const freeAll = (a: Shape) => { if (bodies.length + welds.length > 1) try { a.delete(); } catch {} };
const allFaces = () => bodies.flatMap((b) => b.faces as any[]);
const allEdges = () => bodies.flatMap((b) => b.edges as any[]);

/** Yüz üzerindeki eskizler: modeldeki yüzü bul, çerçeveyi yüzün güncel konumuna taşı */
function resolvePlane(pl: KPlane): Frame {
  const f = pl.frame;
  if (!pl.face || !bodies.length) return f;
  const n = pl.face.n ?? f.n;
  let best: Vec3 | null = null;
  let bd = Infinity;
  for (const face of allFaces()) {
    if (String(face.geomType) !== "PLANE") continue;
    const c = tup(face.center);
    let fn: Vec3;
    try {
      fn = vnorm(tup(face.normalAt(c)));
    } catch {
      continue;
    }
    if (vdot(fn, n) < 0.999) continue;
    const d = vlen(vsub(c, pl.face.c));
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  if (!best) return f;
  const shift = vdot(vsub(best, f.o), f.n);
  if (Math.abs(shift) < 1e-7) return f;
  const nf: Frame = { o: vadd(f.o, vmul(f.n, shift)), x: f.x, n: f.n };
  if (pl.sketchId) frames[pl.sketchId] = nf;
  return nf;
}

function penSegs(pen: any, segs: Seg[]) {
  for (const s of segs) {
    if (s.t === "l") pen = pen.lineTo(s.b);
    else if (s.t === "a") pen = pen.threePointsArcTo(s.b, s.m);
    else if (s.t === "c") pen = pen.cubicBezierCurveTo(s.b, s.c1, s.c2);
    else if (s.t === "q") pen = pen.quadraticBezierCurveTo(s.b, s.k);
    else if (s.t === "e") pen = pen.ellipseTo(s.b, s.rx, s.ry, s.rot, s.long, s.sweep);
  }
  return pen;
}

function loopDrawing(l: Loop) {
  if ("circle" in l) return drawCircle(l.circle.r).translate(l.circle.c[0], l.circle.c[1]);
  if ("ellipse" in l) {
    const { c, rx, ry, rot } = l.ellipse;
    return drawEllipse(rx, ry).rotate(rot, [0, 0]).translate(c[0], c[1]);
  }
  return penSegs(draw(l.segs[0].a), l.segs).close();
}

function textDrawing(t: TextItem) {
  let d: any = drawText(t.text, { startX: t.x, startY: t.y, fontSize: t.size });
  if (t.angle) d = d.rotate(t.angle, [t.x, t.y]);
  return d;
}

function profile(loops: Loop[], texts: TextItem[] = []) {
  if (!loops.length && !texts.length) throw new Error("Eskizde kapalı kontur yok");
  let d: any = null;
  for (const l of loops) {
    const ld = loopDrawing(l);
    if (!d) d = ld;
    else d = l.depth % 2 === 0 ? d.fuse(ld) : d.cut(ld);
  }
  for (const t of texts) {
    const td = textDrawing(t);
    d = d ? d.fuse(td) : td;
  }
  return d;
}

function bodySize() {
  const a = all();
  if (!a) return 1000;
  const bb = a.boundingBox.bounds as [Vec3, Vec3];
  return Math.max(1000, 4 * vlen(vsub(bb[1], bb[0])) + 4 * Math.max(...bb[0].map(Math.abs), ...bb[1].map(Math.abs)));
}

const bbOverlap = (a: Shape, b: Shape) => {
  const A = a.boundingBox.bounds, B = b.boundingBox.bounds;
  for (let i = 0; i < 3; i++) if (A[1][i] < B[0][i] - 1e-6 || B[1][i] < A[0][i] - 1e-6) return false;
  return true;
};

/** Hacimsel örtüşme (yalnızca yüzeyde değme sayılmaz) */
const bbOverlapStrict = (a: Shape, b: Shape) => {
  const A = a.boundingBox.bounds, B = b.boundingBox.bounds;
  for (let i = 0; i < 3; i++) if (A[1][i] <= B[0][i] + 1e-6 || B[1][i] <= A[0][i] + 1e-6) return false;
  return true;
};

/** Özelliklerin "takım" katıları: çoğaltma ve aynada yeniden kullanılır */
const tools = new Map<string, { solid: Shape; cut: boolean; merge: boolean }>();

function applyTool(solid: Shape, cut: boolean, merge = true) {
  if (cut) {
    if (!bodies.length) throw new Error("Kesilecek bir katı yok");
    bodies = bodies.flatMap((b) => (bbOverlap(b, solid) ? solidsOf(b.cut(solid)) : [b]));
    return;
  }
  if (!merge) {
    bodies.push(solid);
    return;
  }
  // SolidWorks gibi: dokunduğu gövdelerle birleşir, dokunmuyorsa yeni gövde olur
  const touch = bodies.filter((b) => bbOverlap(b, solid));
  const rest = bodies.filter((b) => !touch.includes(b));
  let merged = solid;
  for (const b of touch) merged = merged.fuse(b);
  bodies = [...rest, ...solidsOf(merged)];
}

/** Hash'leri içeren gövdeye işlem uygular */
/** son sabit yarıçaplı radyüs (sonraki radyüs başarısız olursa sırayı değiştirip yeniden denemek için) */
let filletHist: { before: Shape; after: Shape; refs: EdgeRef[]; rad: number } | null = null;
function onOwner(hashes: Set<number>, kind: "edges" | "faces", fn: (b: Shape) => Shape) {
  let done = false;
  bodies = bodies.map((b) => {
    const has = (b[kind] as any[]).some((x) => hashes.has(x.hashCode));
    if (!has) return b;
    done = true;
    return fn(b);
  });
  if (!done) throw new Error("Seçim modelde bulunamadı");
}

function planarFace(ref: FaceRef): { c: Vec3; n: Vec3; face: any } | null {
  let best: { c: Vec3; n: Vec3; face: any } | null = null;
  let bd = Infinity;
  for (const face of allFaces()) {
    const c = tup(face.center);
    let d = vlen(vsub(c, ref.c));
    if (ref.n && String(face.geomType) === "PLANE") {
      // aynı merkezli zıt yönlü yüzleri normal ile ayır
      try {
        d += (1 - vdot(vnorm(tup(face.normalAt(c))), ref.n)) * 5;
      } catch {}
    }
    if (ref.r !== undefined) {
      // aynı merkezli silindirleri yarıçapla ayır
      if (String(face.geomType) !== "CYLINDRE") d += 1000;
      else
        try {
          d += Math.abs(cylinderParams(face).rho - ref.r) * 10;
        } catch {
          d += 1000;
        }
    }
    if (d < bd) {
      bd = d;
      const planar = String(face.geomType) === "PLANE";
      best = { c, n: planar ? vnorm(tup(face.normalAt(c))) : [0, 0, 0], face };
    }
  }
  return best && bd < 2 ? best : null;
}

/** Profil yüzüne değen parçalar */
function touching(pieces: Shape[], ref: Shape) {
  return pieces.filter((p) => {
    try {
      return measureDistanceBetween(p, ref) < 1e-4;
    } catch {
      return false;
    }
  });
}

function extrudeTool(f: Extract<KFeature, { type: "extrude" }>, flipped = false): Shape {
  const frame0 = resolvePlane(f.pl);
  // başlangıç: yüz / köşe / öteleme
  let so = f.startOff ?? 0;
  if (f.fromFace) {
    const pf = planarFace(f.fromFace);
    if (!pf) throw new Error("Başlangıç yüzü bulunamadı");
    if (Math.abs(Math.abs(vdot(pf.n, frame0.n)) - 1) > 1e-6) throw new Error("Başlangıç yüzü eskiz düzlemine paralel olmalı");
    so = vdot(vsub(pf.c, frame0.o), frame0.n);
  } else if (f.fromVtx) so = vdot(vsub(f.fromVtx, frame0.o), frame0.n);
  const frame = so ? { ...frame0, o: vadd(frame0.o, vmul(frame0.n, so)) } : frame0;
  const sign = (f.rev ? -1 : 1) * (f.cut ? -1 : 1) * (flipped ? -1 : 1);
  if (f.flipCut && f.cut) {
    // kesme tarafını çevir: profilin dışında kalan malzemeyi kes
    const inner = extrudeTool({ ...f, flipCut: false }, flipped);
    const big = extrudeTool({ ...f, flipCut: false, loops: [{ circle: { c: [0, 0], r: bodySize() * 4 }, depth: 0 }], texts: [] }, flipped);
    return big.cut(inner);
  }
  const through = bodySize();
  const sk = (shift: number) => profile(f.loops, f.texts).sketchOnPlane(makePlane(frame, shift));
  let d1 = f.d1;
  let clipFace: any = null;
  if (f.end === "vertex") {
    if (!f.vtx) throw new Error("Hedef köşeyi seçin");
    d1 = vdot(vsub(f.vtx, frame.o), vmul(frame.n, sign));
    if (d1 <= 1e-6) throw new Error("Köşe bu yönde değil; yönü ters çevirin");
  }
  if (f.end === "surface" || f.end === "offset") {
    if (!f.face) throw new Error("Hedef yüzü seçin");
    const pf = planarFace(f.face);
    if (!pf) throw new Error("Hedef yüz bulunamadı");
    if (vlen(pf.n) > 0 && Math.abs(Math.abs(vdot(pf.n, frame.n)) - 1) < 1e-6) {
      d1 = vdot(vsub(pf.c, frame.o), vmul(frame.n, sign)) - (f.end === "offset" ? f.offd ?? 0 : 0);
      if (d1 <= 1e-6) throw new Error("Hedef yüz bu yönde değil; yönü ters çevirin");
    } else {
      // eğri / eğik yüz: uzun takımı yüzün ötesinden kırp
      if (f.end === "offset") throw new Error("Yüzeyden ötele yalnızca paralel düz yüzlerde kullanılabilir");
      clipFace = pf.face;
    }
  }
  let solid: Shape;
  if (clipFace) {
    const long = sk(0).extrude(sign * through);
    const beyond = basicFaceExtrusion(clipFace, new Vector(vmul(frame.n, sign * through)));
    const pieces = solidsOf(long.cut(beyond));
    const base = sk(0).face();
    const keep = touching(pieces, base);
    if (!keep.length) throw new Error("Hedef yüz profili kesmiyor");
    solid = keep.reduce((a, b) => a.fuse(b));
  } else if (f.end === "body") {
    if (!f.bodyRef) throw new Error("Hedef gövdeyi seçin");
    const target = bodies[bodyIdxOf(f.bodyRef)];
    if (!target) throw new Error("Hedef gövde bulunamadı");
    const long = sk(0).extrude(sign * through);
    const pieces = solidsOf(f.cut ? long.intersect(target) : long.cut(target));
    const keep = touching(pieces, sk(0).face());
    if (!keep.length) throw new Error("Profil yönünde gövde bulunamadı");
    solid = keep.reduce((x, y) => x.fuse(y));
  } else if (f.end === "next") {
    const long = sk(0).extrude(sign * through);
    const a = all();
    if (!a) throw new Error("Sonrakine kadar için önce bir katı gerekir");
    const pieces = solidsOf(f.cut ? long.intersect(a) : long.cut(a));
    const keep = touching(pieces, sk(0).face());
    if (!keep.length) throw new Error("Profil yönünde bir yüz bulunamadı");
    solid = keep.reduce((x, y) => x.fuse(y));
  } else if (f.draft && f.draft > 0 && (f.end === "blind" || f.end === "surface" || f.end === "offset")) {
    if (f.loops.length > 1 || f.texts?.length) throw new Error("Koniklik şimdilik tek konturlu profillerde destekleniyor");
    const off = d1 * Math.tan((f.draft * Math.PI) / 180) * (f.draftOut ? 1 : -1);
    const s1 = sk(0);
    const s2 = profile(f.loops).offset(off, { lineJoinType: "miter" }).sketchOnPlane(makePlane(frame, sign * d1));
    solid = s1.loftWith(s2, { ruled: true });
  } else if (f.end === "mid") solid = sk((-sign * f.d1) / 2).extrude(sign * f.d1, f.twist ? { twistAngle: f.twist } : undefined);
  else if (f.dirVec && (f.end === "blind" || f.end === "through" || f.end === "vertex")) {
    // ekstrüzyon yönü: kenar vektörü (eğik ekstrüzyon); derinlik normal doğrultusunda ölçülür
    let dv = vnorm(f.dirVec);
    if (vdot(dv, frame.n) * sign < 0) dv = vmul(dv, -1);
    const cosA = Math.abs(vdot(dv, frame.n));
    if (cosA < 1e-3) throw new Error("Yön vektörü eskiz düzlemine paralel olamaz");
    const dist = (f.end === "through" ? through : d1) / cosA;
    solid = sk(0).extrude(dist, { extrusionDirection: dv as any });
  } else if (f.end === "through") solid = sk(0).extrude(sign * through);
  else solid = sk(0).extrude(sign * d1, f.twist ? { twistAngle: f.twist } : undefined);
  if (f.dir2 && (f.end === "blind" || f.end === "through")) {
    const d2 = f.end2 === "through" ? through : f.d2;
    if (d2 > 0) solid = solid.fuse(sk(0).extrude(-sign * d2));
  }
  // Kesme hiçbir gövdeye değmiyorsa (ör. standart düzlemde eskiz) malzeme tarafına çevir
  if (f.cut && !flipped && !f.dir2 && (f.end === "blind" || f.end === "through") && bodies.length && !bodies.some((b) => bbOverlapStrict(b, solid))) {
    return extrudeTool(f, true);
  }
  return solid;
}

function revolveTool(f: Extract<KFeature, { type: "revolve" }>) {
  const frame = resolvePlane(f.pl);
  const a = toWorld(frame, f.axis[0]);
  const b = toWorld(frame, f.axis[1]);
  let dir = vnorm(vsub(b, a));
  if (f.rev) dir = vmul(dir, -1);
  const angle = Math.min(360, Math.max(0.01, f.angle));
  let solid = profile(f.loops).sketchOnPlane(makePlane(frame)).revolve(dir, { origin: a, angle });
  if (f.mid && angle < 360) solid = solid.rotate(-angle / 2, a, dir);
  return solid;
}

function pathWire(segs: Seg[], closed: boolean, frame: Frame) {
  const pen = penSegs(draw(segs[0].a), segs);
  const d = closed ? pen.close() : pen.done();
  return (d.sketchOnPlane(makePlane(frame)) as any).wire;
}

function sweepTool(f: Extract<KFeature, { type: "sweep" }>) {
  const sframe = resolvePlane(f.path.pl);
  const spine = pathWire(f.path.segs, f.path.closed, sframe);
  const oc = getOC();
  const sp: any = spine;
  const p0 = sp.startPoint, t0 = sp.tangentAt(0);
  // SolidWorks profil yönelimi: yolu izle (Frenet) / normali sabit tut (sabit üçyüzlü)
  const opts: any = f.orient === "normal" ? { support: new oc.gp_Ax2(new oc.gp_Pnt(p0.x, p0.y, p0.z), new oc.gp_Dir(t0.x, t0.y, t0.z)), transitionMode: "right" } : { frenet: true, transitionMode: "right" };
  if (f.circ && f.circ > 0) {
    // dairesel profil: yalnız çap ile boru / çubuk (profil eskizi gerekmez)
    const ring = (d: number) => genericSweep(assembleWire([makeCircle(d / 2, [p0.x, p0.y, p0.z], [t0.x, t0.y, t0.z])]) as any, spine, opts, false);
    let solid: Shape = ring(f.circ);
    if (f.circIn && f.circIn > 0 && f.circIn < f.circ) solid = solid.cut(ring(f.circIn));
    return solid;
  }
  if (!f.pl) throw new Error("Profil eskizi yok");
  const pframe = resolvePlane(f.pl);
  let solid: Shape | null = null;
  for (const l of f.loops) {
    const w = (loopDrawing(l).sketchOnPlane(makePlane(pframe)) as any).wire;
    const s = genericSweep(w, spine, opts, false);
    if (!solid) solid = s;
    else solid = l.depth % 2 === 0 ? solid.fuse(s) : solid.cut(s);
  }
  if (!solid) throw new Error("Profil yok");
  return solid;
}

/** Kapalı çoklu çizgiyi eşit yay uzunluğu aralıklı M noktaya örnekler */
function resampleClosed(pts: Vec3[], M: number): Vec3[] {
  const P = [...pts, pts[0]];
  const cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + vlen(vsub(P[i], P[i - 1])));
  const T = cum[cum.length - 1];
  const out: Vec3[] = [];
  let j = 1;
  for (let k = 0; k < M; k++) {
    const s = (T * k) / M;
    while (j < cum.length - 1 && cum[j] < s) j++;
    const t = (s - cum[j - 1]) / ((cum[j] - cum[j - 1]) || 1);
    out.push(vadd(P[j - 1], vmul(vsub(P[j], P[j - 1]), t)));
  }
  return out;
}
/** Açık çoklu çizgide oransal konum */
function pointAtFrac(pts: Vec3[], t: number): Vec3 {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + vlen(vsub(pts[i], pts[i - 1])));
  const s = Math.max(0, Math.min(1, t)) * cum[cum.length - 1];
  let j = 1;
  while (j < cum.length - 1 && cum[j] < s) j++;
  const k = (s - cum[j - 1]) / ((cum[j] - cum[j - 1]) || 1);
  return vadd(pts[j - 1], vmul(vsub(pts[j], pts[j - 1]), k));
}
function loopWorldPts(l: Loop, fr: Frame): Vec3[] {
  let p2: Vec2[];
  if ("circle" in l) p2 = Array.from({ length: 96 }, (_, i) => [l.circle.c[0] + l.circle.r * Math.cos((i / 96) * 2 * Math.PI), l.circle.c[1] + l.circle.r * Math.sin((i / 96) * 2 * Math.PI)] as Vec2);
  else if ("ellipse" in l) {
    const { c, rx, ry, rot } = l.ellipse;
    const cr = Math.cos((rot * Math.PI) / 180), sr = Math.sin((rot * Math.PI) / 180);
    p2 = Array.from({ length: 96 }, (_, i) => {
      const a = (i / 96) * 2 * Math.PI, x = rx * Math.cos(a), y = ry * Math.sin(a);
      return [c[0] + x * cr - y * sr, c[1] + x * sr + y * cr] as Vec2;
    });
  } else p2 = l.segs.flatMap((sg) => segPoints(sg, 24).slice(0, -1));
  return p2.map((q) => toWorld(fr, q));
}

/** Kılavuz eğrili loft: ara kesitler kılavuzlara oturacak şekilde ölçeklenir / döndürülür */
function guidedLoft(f: Extract<KFeature, { type: "loft" }>): Shape {
  if (f.profiles.length !== 2) throw new Error("Kılavuz eğrili loft iki profil ile çalışır");
  const M = 72, K = 16;
  const frA = resolvePlane(f.profiles[0].pl), frB = resolvePlane(f.profiles[1].pl);
  let A = resampleClosed(loopWorldPts(f.profiles[0].loops[0], frA), M);
  let B = resampleClosed(loopWorldPts(f.profiles[1].loops[0], frB), M);
  const G = f.guides!;
  const near = (arr: Vec3[], p: Vec3) => arr.reduce((bi, q, i) => (vlen(vsub(q, p)) < vlen(vsub(arr[bi], p)) ? i : bi), 0);
  // kılavuzların uçları profillere değmeli; başlangıç yönü düzeltilir
  G.forEach((g, i) => {
    const s = g[0], e = g[g.length - 1];
    if (vlen(vsub(A[near(A, e)], e)) + vlen(vsub(B[near(B, s)], s)) < vlen(vsub(A[near(A, s)], s)) + vlen(vsub(B[near(B, e)], e))) G[i] = [...g].reverse();
  });
  const ia = near(A, G[0][0]), ib = near(B, G[0][G[0].length - 1]);
  A = [...A.slice(ia), ...A.slice(0, ia)];
  B = [...B.slice(ib), ...B.slice(0, ib)];
  // dolanım yönü eşleşmesi
  const cen = (arr: Vec3[]) => vmul(arr.reduce((s, p) => vadd(s, p), [0, 0, 0] as Vec3), 1 / arr.length);
  const nA = frA.n;
  const turn = (arr: Vec3[]) => vdot(vcross(vsub(arr[1], cen(arr)), vsub(arr[Math.floor(arr.length / 4)], cen(arr))), nA);
  if (Math.sign(turn(A)) !== Math.sign(turn(B))) B = [B[0], ...B.slice(1).reverse()];
  const idx = G.map((g) => near(A, g[0]));
  const wires: any[] = [];
  for (let k = 0; k <= K; k++) {
    const t = k / K;
    const S = A.map((p, i) => vadd(vmul(p, 1 - t), vmul(B[i], t)));
    const C = cen(S);
    const n = vnorm(vadd(vmul(frA.n, 1 - t), vmul(frB.n, t)));
    const u = vnorm(vsub(vsub(S[0], C), vmul(n, vdot(vsub(S[0], C), n))));
    const v = vcross(n, u);
    const to2 = (p: Vec3): [number, number] => [vdot(vsub(p, C), u), vdot(vsub(p, C), v)];
    const xs = idx.map((j) => to2(S[j]));
    const ys = G.map((g) => to2(pointAtFrac(g, t)));
    let T: (q: [number, number]) => [number, number];
    if (G.length === 1) {
      const x = xs[0], y = ys[0];
      const sc = (x[0] * y[0] + x[1] * y[1]) / ((x[0] * x[0] + x[1] * x[1]) || 1);
      const dx = y[0] - sc * x[0], dy = y[1] - sc * x[1];
      T = (q) => [sc * q[0] + dx, sc * q[1] + dy];
    } else {
      // 2B benzerlik (karmaşık sayı en küçük kareler)
      const mx = xs.reduce((s, q) => [s[0] + q[0] / xs.length, s[1] + q[1] / xs.length], [0, 0]);
      const my = ys.reduce((s, q) => [s[0] + q[0] / ys.length, s[1] + q[1] / ys.length], [0, 0]);
      let re = 0, im = 0, nn = 0;
      xs.forEach((x, i) => {
        const a0 = x[0] - mx[0], a1 = x[1] - mx[1], b0 = ys[i][0] - my[0], b1 = ys[i][1] - my[1];
        re += a0 * b0 + a1 * b1;
        im += a0 * b1 - a1 * b0;
        nn += a0 * a0 + a1 * a1;
      });
      const cr = re / (nn || 1), ci = im / (nn || 1);
      T = (q) => {
        const a0 = q[0] - mx[0], a1 = q[1] - mx[1];
        return [cr * a0 - ci * a1 + my[0], ci * a0 + cr * a1 + my[1]];
      };
    }
    const sec = S.map((p) => {
      const w = vdot(vsub(p, C), n);
      const q = T(to2(p));
      return vadd(vadd(vadd(C, vmul(u, q[0])), vmul(v, q[1])), vmul(n, w));
    });
    wires.push(assembleWire(sec.map((p, i) => makeLine(p, sec[(i + 1) % sec.length]))));
  }
  return loft(wires, { ruled: false });
}

function loftTool(f: Extract<KFeature, { type: "loft" }>) {
  if (f.profiles.length < 2) throw new Error("Loft için en az iki profil eskizi seçin");
  for (const p of f.profiles) if (p.loops.length !== 1) throw new Error("Her loft profili tek bir kapalı kontur olmalı");
  if (f.guides?.length) return guidedLoft(f);
  if (f.center) {
    // merkez çizgisi boyunca: OCCT boru kabuğu, birden çok kesit
    const oc = getOC() as any;
    const spine = pathWire(f.center.segs, f.center.closed, resolvePlane(f.center.pl));
    const ps = new oc.BRepOffsetAPI_MakePipeShell(spine.wrapped);
    ps.SetMode(false);
    for (const p of f.profiles) {
      const w = (loopDrawing(p.loops[0]).sketchOnPlane(makePlane(resolvePlane(p.pl))) as any).wire;
      ps.Add(w.wrapped, false, true);
    }
    ps.Build(new oc.Message_ProgressRange());
    if (!ps.MakeSolid()) throw new Error("Merkez çizgili loft katı oluşturamadı");
    return cast(ps.Shape());
  }
  const sks = f.profiles.map((p) => loopDrawing(p.loops[0]).sketchOnPlane(makePlane(resolvePlane(p.pl))) as any);
  return sks[0].loftWith(sks.slice(1), { ruled: f.ruled });
}

function holeTool(f: Extract<KFeature, { type: "hole" }>) {
  if (!f.pts.length) throw new Error("Delik konumu seçin (yüze dokunun)");
  const frame = resolvePlane(f.pl);
  const v = vmul(frame.n, -1); // malzemenin içine
  const u = frame.x;
  const nrm = vcross(u, v);
  const R = f.d / 2;
  if (!(R > 0)) throw new Error("Delik çapı sıfırdan büyük olmalı");
  const D = f.through ? bodySize() : f.depth;
  const tip = f.through ? 0 : R / Math.tan((59 * Math.PI) / 180);
  const e = 0.05;
  let pts: Vec2[];
  if (f.htype === "cbore") {
    const Rc = Math.max(f.cd / 2, R + 0.01);
    pts = [[0, -e], [Rc, -e], [Rc, f.cdepth], [R, f.cdepth], [R, D], [0, D + tip]];
  } else if (f.htype === "csink") {
    const Rc = Math.max(f.cd / 2, R + 0.01);
    const h = (Rc - R) / Math.tan(((f.cangle || 90) * Math.PI) / 360);
    pts = [[0, -e], [Rc + e, -e], [Rc, 0], [R, h], [R, D], [0, D + tip]];
  } else pts = [[0, -e], [R, -e], [R, D], [0, D + tip]];
  let res: Shape | null = null;
  for (const p of f.pts) {
    const P = toWorld(frame, p);
    let pen: any = draw(pts[0]);
    for (let i = 1; i < pts.length; i++) pen = pen.lineTo(pts[i]);
    const t = pen.close().sketchOnPlane(new Plane(P, u, nrm)).revolve(v, { origin: P, angle: 360 });
    res = res ? res.fuse(t) : t;
  }
  return res!;
}

function ribTool(f: Extract<KFeature, { type: "rib" }>) {
  const frame = resolvePlane(f.pl);
  const a = all();
  if (!a) throw new Error("Kaburga için önce bir katı gerekir");
  const chains = [{ segs: f.chain, closed: false }];
  const big = bodySize();
  if (f.normal) {
    // eskize dik: kalın profili sonraki yüze kadar uzat
    const mode = f.side === "mid" ? "mid" : f.side === "one" ? "one" : "rev";
    const loops = thinRegion(chains, f.t, mode);
    const sk = profile(loops).sketchOnPlane(makePlane(frame));
    const sign = f.flip ? -1 : 1;
    const long = sk.extrude(sign * big);
    const keep = touching(solidsOf(long.cut(a)), profile(loops).sketchOnPlane(makePlane(frame)).face());
    if (!keep.length) throw new Error("Kaburga bir yüze ulaşmıyor; yönü ters çevirin");
    return keep.reduce((x, y) => x.fuse(y));
  }
  // eskize paralel: çizgi ile gövde arasındaki bölge, eskiz düzlemine göre kalınlıkta
  const band = thinRegion(chains, big / 4, f.flip ? "rev" : "one");
  const shift = f.side === "mid" ? -f.t / 2 : f.side === "one" ? 0 : -f.t;
  const slab = profile(band).sketchOnPlane(makePlane(frame, shift)).extrude(f.t);
  const pieces = solidsOf(slab.cut(a));
  const wire = pathWire(f.chain, false, frame);
  // bant kenarına (uzak tarafa) ulaşan parçalar kapalı değildir
  const far = big / 8;
  const chainPts = f.chain.flatMap((sg) => [toWorld(frame, sg.a), toWorld(frame, sg.b)]);
  const bounded = (p: Shape) => {
    const bb = p.boundingBox.bounds as [Vec3, Vec3];
    const corners: Vec3[] = [bb[0], bb[1]];
    return corners.every((c) => chainPts.some((q) => vlen(vsub(c, q)) < far));
  };
  const keep = touching(pieces, wire).filter((p) => touching([p], a).length && bounded(p));
  if (!keep.length) throw new Error("Kaburga gövdeyle kapalı bir bölge oluşturmuyor; malzeme tarafını ters çevirin");
  keep.sort((x, y) => measureShapeVolumeProperties(x).volume - measureShapeVolumeProperties(y).volume);
  return keep[0];
}

function domeTool(f: Extract<KFeature, { type: "dome" }>) {
  const pf = planarFace(f.face);
  if (!pf || !vlen(pf.n)) throw new Error("Kubbe için düz bir yüz seçin");
  const face = pf.face;
  const w0 = face.clone().outerWire();
  const c = pf.c;
  const secs = [30, 60].map((deg) => {
    const t = (deg * Math.PI) / 180;
    return new Sketch(w0.clone().scale(Math.cos(t), c).translate(vmul(pf.n, f.h * Math.sin(t))));
  });
  const base = new Sketch(w0.clone());
  return (base as any).loftWith(secs, { ruled: false, endPoint: vadd(c, vmul(pf.n, f.h)) });
}

function cylinderOf(face: any): { c: Vec3; ax: Vec3; r: number } | null {
  for (const e of face.edges as any[]) {
    if (String(e.geomType) !== "CIRCLE") continue;
    const c = circle3d(tup(e.pointAt(0)), tup(e.pointAt(1 / 3)), tup(e.pointAt(2 / 3)));
    if (c) return c;
  }
  return null;
}

function wrapTool(f: Extract<KFeature, { type: "wrap" }>) {
  const pf = planarFace(f.face);
  if (!pf || String(pf.face.geomType) !== "CYLINDRE") throw new Error("Sarma için silindirik bir yüz seçin");
  const cyl = cylinderOf(pf.face);
  if (!cyl) throw new Error("Silindir ekseni bulunamadı");
  const frame = resolvePlane(f.pl);
  // takım yalnızca eskiz tarafındaki yüzeye uygulanır: eskiz düzleminden eksene kadar
  const dn = vdot(vsub(cyl.c, frame.o), frame.n);
  const dir = dn < 0 ? -1 : 1;
  const margin = f.depth + 1;
  const tool = profile(f.loops, f.texts).sketchOnPlane(makePlane(frame, -dir * margin)).extrude(dir * (Math.abs(dn) + margin));
  const big = bodySize();
  const L = big;
  const base = vsub(cyl.c, vmul(cyl.ax, L / 2));
  const C = (r: number) => makeCylinder(r, L, base, cyl.ax);
  const ring = f.mode === "deboss" ? C(cyl.r).cut(C(Math.max(0.01, cyl.r - f.depth))) : C(cyl.r + f.depth).cut(C(cyl.r));
  return { solid: tool.intersect(ring), cut: f.mode === "deboss" };
}

/** Saklanan geometrik referansa en yakın kenarları bulur */
function matchEdges(refs: EdgeRef[]): Set<number> {
  const info = allEdges().map((e) => ({ h: e.hashCode, m: tup(e.pointAt(0.5)) }));
  const out = new Set<number>();
  for (const r of refs) {
    let best: (typeof info)[0] | null = null;
    let bd = Infinity;
    for (const i of info) {
      const d = vlen(vsub(i.m, r.m));
      if (d < bd) [bd, best] = [d, i];
    }
    if (best && bd < 2) out.add(best.h);
  }
  return out;
}

function matchFaces(refs: FaceRef[]): Set<number> {
  const info = allFaces().map((f) => {
    const c = tup(f.center);
    let n: Vec3 | null = null;
    if (String(f.geomType) === "PLANE")
      try {
        n = vnorm(tup(f.normalAt(c)));
      } catch {}
    return { h: f.hashCode, c, n };
  });
  const out = new Set<number>();
  for (const r of refs) {
    let best: (typeof info)[0] | null = null;
    let bd = Infinity;
    for (const i of info) {
      const d = vlen(vsub(i.c, r.c)) + (r.n && i.n ? (1 - vdot(i.n, r.n)) * 5 : 0);
      if (d < bd) [bd, best] = [d, i];
    }
    if (best && bd < 2) out.add(best.h);
  }
  return out;
}

function edgesOfFaces(set: Set<number>) {
  const out = new Set<number>();
  for (const f of allFaces()) if (set.has(f.hashCode)) for (const e of f.edges as any[]) out.add(e.hashCode);
  return out;
}

/** Kenara komşu yüzler */
function facesOfEdge(body: Shape, edgeHash: number) {
  return (body.faces as any[]).filter((f) => (f.edges as any[]).some((e) => e.hashCode === edgeHash));
}

function fullRoundEdges(faceSet: Set<number>): { edges: Set<number>; r: number } {
  const face = allFaces().find((f) => faceSet.has(f.hashCode));
  if (!face) throw new Error("Tam yuvarlak için orta yüzü seçin");
  const lines = (face.edges as any[]).filter((e) => String(e.geomType) === "LINE");
  let best: { a: any; b: any; d: number; len: number } | null = null;
  for (let i = 0; i < lines.length; i++)
    for (let j = i + 1; j < lines.length; j++) {
      const A = lines[i], B = lines[j];
      const da = vnorm(vsub(tup(A.endPoint), tup(A.startPoint))), db = vnorm(vsub(tup(B.endPoint), tup(B.startPoint)));
      if (Math.abs(Math.abs(vdot(da, db)) - 1) > 1e-6) continue;
      const w = vsub(tup(B.startPoint), tup(A.startPoint));
      const d = vlen(vsub(w, vmul(da, vdot(w, da))));
      const len = Math.min(measureLength(A), measureLength(B));
      if (!best || len > best.len) best = { a: A, b: B, d, len };
    }
  if (!best) throw new Error("Seçili yüzde paralel iki kenar bulunamadı");
  return { edges: new Set([best.a.hashCode, best.b.hashCode]), r: (best.d / 2) * 0.995 };
}

// ---------- Gövde işlemleri ----------

/** Yüz referansının ait olduğu gövde sırası */
function bodyIdxOf(ref: FaceRef): number {
  const h = [...matchFaces([ref])][0];
  const i = h === undefined ? -1 : bodies.findIndex((b) => (b.faces as any[]).some((x) => x.hashCode === h));
  if (i < 0) throw new Error("Seçili gövde modelde bulunamadı");
  return i;
}

function combineTool(f: Extract<KFeature, { type: "combine" }>) {
  const mi = bodyIdxOf(f.main);
  const ti = [...new Set(f.tools.map(bodyIdxOf))].filter((i) => i !== mi);
  if (!ti.length) throw new Error("Ana gövdeden farklı araç gövdesi seçin");
  let m = bodies[mi];
  for (const i of ti) m = f.op === "add" ? m.fuse(bodies[i]) : f.op === "sub" ? m.cut(bodies[i]) : m.intersect(bodies[i]);
  if (volOf(m) < 1e-9) throw new Error("Sonuç boş (gövdeler kesişmiyor)");
  bodies = [...bodies.filter((_, i) => i !== mi && !ti.includes(i)), ...solidsOf(m)];
}

function splitBodyTool(f: Extract<KFeature, { type: "splitbody" }>) {
  const i = bodyIdxOf(f.body);
  const b = bodies[i];
  const a1 = b.cut(halfSpace(f.frame.o, f.frame.n));
  const a2 = b.cut(halfSpace(f.frame.o, vmul(f.frame.n, -1)));
  const parts = [...solidsOf(a1), ...solidsOf(a2)].filter((x) => volOf(x) > 1e-9);
  if (parts.length < 2) throw new Error("Düzlem gövdeyi kesmiyor");
  bodies.splice(i, 1, ...parts);
}

function moveBodyTool(f: Extract<KFeature, { type: "movebody" }>) {
  const i = bodyIdxOf(f.body);
  let b = bodies[i].clone();
  if (f.angle) b = b.rotate(f.angle, centroid(bodies[i]), f.axis);
  if (vlen(f.d) > 0) b = b.translate(f.d);
  if (f.copy) bodies.push(b);
  else bodies[i] = b;
}

function delBodyTool(f: Extract<KFeature, { type: "delbody" }>) {
  const sel = new Set(f.bodies.map(bodyIdxOf));
  bodies = bodies.filter((_, i) => (f.keep ? sel.has(i) : !sel.has(i)));
}

function indentTool(f: Extract<KFeature, { type: "indent" }>) {
  const ti = bodyIdxOf(f.target), ki = bodyIdxOf(f.tool);
  if (ti === ki) throw new Error("Hedef ve araç farklı gövdeler olmalı");
  const tool = f.clearance > 0 ? makeOffset(bodies[ki].clone(), f.clearance) : bodies[ki];
  const res = solidsOf(bodies[ti].cut(tool));
  const keep = bodies[ki];
  bodies = bodies.filter((_, i) => i !== ti && i !== ki);
  bodies.push(...res);
  if (f.keepTool) bodies.push(keep);
}

// ---------- Ek çoğaltmalar ----------

type ToolItem = { solid: Shape; cut: boolean; merge: boolean };
const toolItems = (ids: string[]) => {
  const items = ids.map((id) => tools.get(id)).filter(Boolean) as ToolItem[];
  if (!items.length) throw new Error("Çoğaltılacak özellik bulunamadı");
  return items;
};

function patternAt(items: ToolItem[], offsets: Vec3[], rot?: (it: ToolItem, k: number) => Shape) {
  for (const it of items)
    offsets.forEach((o, k) => {
      let s = rot ? rot(it, k) : it.solid.clone();
      s = s.translate(o);
      applyTool(s, it.cut, it.merge);
    });
}

function curvePattern(f: Extract<KFeature, { type: "cvpattern" }>) {
  const items = toolItems(f.feats);
  const P = f.path;
  const cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + vlen(vsub(P[i], P[i - 1])));
  const total = cum[cum.length - 1];
  const at = (s: number): { p: Vec3; t: Vec3 } => {
    s = Math.max(0, Math.min(total, s));
    let i = cum.findIndex((c) => c >= s);
    if (i <= 0) i = 1;
    const k = (s - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1);
    const t = vnorm(vsub(P[i], P[i - 1]));
    return { p: vadd(P[i - 1], vmul(vsub(P[i], P[i - 1]), k)), t };
  };
  for (const it of items) {
    const c = centroid(it.solid);
    // tohumun eğri üzerindeki yeri
    let s0 = 0, bd = Infinity;
    for (let i = 0; i < P.length; i++) {
      const d = vlen(vsub(P[i], c));
      if (d < bd) [bd, s0] = [d, cum[i]];
    }
    const base = at(s0);
    const step = f.equal ? (total - s0) / Math.max(1, f.count - 1) : f.spacing;
    for (let k = 1; k < f.count; k++) {
      const sk = s0 + k * step;
      if (sk > total + 1e-6) break;
      const q = at(sk);
      let sh = it.solid.clone();
      if (f.align) {
        const ang = (Math.atan2(vdot(vcross(base.t, q.t), f.n), vdot(base.t, q.t)) * 180) / Math.PI;
        if (Math.abs(ang) > 1e-9) sh = sh.rotate(ang, base.p, f.n);
      }
      applyTool(sh.translate(vsub(q.p, base.p)), it.cut, it.merge);
    }
  }
}

function fillPattern(f: Extract<KFeature, { type: "fpattern" }>) {
  const items = toolItems(f.feats);
  const pf = planarFace(f.face);
  if (!pf || String(pf.face.geomType) !== "PLANE") throw new Error("Doldurma için düz bir yüz seçin");
  const n = pf.n;
  const ax0 = vnorm(Math.abs(n[2]) < 0.9 ? vcross(n, [0, 0, 1]) : vcross(n, [1, 0, 0]));
  const a = (f.angle * Math.PI) / 180;
  const u = vnorm(vadd(vmul(ax0, Math.cos(a)), vmul(vcross(n, ax0), Math.sin(a)))), v = vcross(n, u);
  const pts = (pf.face.edges as any[]).flatMap((e) => [0, 0.5, 1].map((q) => tup(e.pointAt(q))));
  const edges = pf.face.edges as any[];
  for (const it of items) {
    const c0 = centroid(it.solid);
    const seed = vsub(c0, vmul(n, vdot(vsub(c0, pf.c), n)));
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const p of pts) {
      const r = vsub(p, seed);
      u0 = Math.min(u0, vdot(r, u)); u1 = Math.max(u1, vdot(r, u));
      v0 = Math.min(v0, vdot(r, v)); v1 = Math.max(v1, vdot(r, v));
    }
    const sp = f.spacing;
    const rowH = f.layout === "stagger" ? sp * Math.sqrt(3) / 2 : sp;
    const offs: Vec3[] = [];
    for (let j = Math.ceil(v0 / rowH); j <= Math.floor(v1 / rowH); j++) {
      const shift = f.layout === "stagger" && j % 2 !== 0 ? sp / 2 : 0;
      for (let i = Math.ceil((u0 - shift) / sp); i <= Math.floor((u1 - shift) / sp); i++) {
        if (i === 0 && j === 0) continue;
        const o = vadd(vmul(u, i * sp + shift), vmul(v, j * rowH));
        const p = vadd(seed, o);
        const vx = makeVertex(p);
        try {
          if (measureDistanceBetween(pf.face, vx) > 1e-4) continue;
          if (f.margin > 0 && Math.min(...edges.map((e) => measureDistanceBetween(e, vx))) < f.margin) continue;
        } catch {
          continue;
        }
        offs.push(o);
        if (offs.length > 2000) throw new Error("Çok fazla kopya; aralığı büyütün");
      }
    }
    patternAt([it], offs);
  }
}

// ---------- Diş ----------
// Helisel oluk, dişin eksene dik kesitinin hatve başına 360° burularak ekstrüzyonuyla oluşturulur
// (helis boyunca profil süpürmeye göre Boolean işlemlerinde çok daha sağlamdır).
function threadTool(f: Extract<KFeature, { type: "thread" }>) {
  const pf = planarFace(f.face);
  if (!pf || String(pf.face.geomType) !== "CYLINDRE") throw new Error("Diş için silindirik bir yüz seçin");
  const cy = cylinderParams(pf.face);
  const a = cy.a;
  let lo = Infinity, hi = -Infinity;
  for (const e of pf.face.edges as any[])
    for (const q of [0, 0.5, 1]) {
      const t = vdot(vsub(tup(e.pointAt(q)), cy.L), a);
      lo = Math.min(lo, t);
      hi = Math.max(hi, t);
    }
  const L = f.length > 0 ? Math.min(f.length, hi - lo) : hi - lo;
  const P = f.pitch;
  if (L / P > 300) throw new Error("Diş çok uzun (300 turdan fazla)");
  const c0 = tup(pf.face.center);
  const radial0 = vsub(vsub(c0, cy.L), vmul(a, vdot(vsub(c0, cy.L), a)));
  const internal = vdot(vnorm(tup(pf.face.normalAt(c0))), vnorm(radial0)) < 0;
  const depth = (internal ? 0.5413 : 0.6134) * P;
  const startT = f.fromEnd ? hi - L : lo;
  const endT = startT + L;
  const R = cy.rho, m = 0.3 * P;
  const cot30 = Math.sqrt(3);
  const N = 48;
  const pts: [number, number][] = [];
  for (let i = 0; i <= N; i++) {
    const th = (i / N) * 2 * Math.PI;
    let d = -(P * th) / (2 * Math.PI);
    d = d - P * Math.round(d / P);
    const dep = Math.max(0, depth - cot30 * Math.abs(d));
    const r = internal ? R + dep : R - dep;
    pts.push([r * Math.cos(th), r * Math.sin(th)]);
  }
  pts[N] = pts[0];
  const curve = drawPointsInterpolation(pts as any, {}, { closeShape: true });
  const base = vadd(cy.L, vmul(a, startT));
  const u0 = vnorm(Math.abs(a[2]) < 0.9 ? vcross(a, [0, 0, 1]) : vcross(a, [1, 0, 0]));
  const len = endT - startT;
  const twist = (f.left ? -1 : 1) * 360 * (len / P);
  // dişli bölge: kesiti diş profili olan burulmuş çubuk (Boolean'da burulmuş yüzey başka yüzeyi kesmez)
  const core = (curve as any).sketchOnPlane(new Plane(base, u0, a)).extrude(len, { twistAngle: twist });
  const h = [...matchFaces([f.face])][0];
  onOwner(new Set([h]), "faces", (b) => {
    const v0 = volOf(b);
    let r: Shape;
    if (!internal) {
      // dış diş: diş boyundaki silindiri (R + pay) çıkar, burulmuş çubuğu ekle
      const slab = makeCylinder(R + m, len, base, a);
      const rest = b.cut(slab);
      const keep = b.intersect(makeCylinder(R + m, len, base, a));
      // diş bölgesinde gövde silindir dışında malzeme varsa (ör. omuz) korunur
      const outside = keep.cut(makeCylinder(R + 1e-3, len, base, a));
      r = volOf(rest) > 1e-6 ? rest.fuse(core) : core;
      if (volOf(outside) > 1e-6) r = r.fuse(outside);
    } else {
      // iç diş: deliği doldur, burulmuş çekirdeği çıkar
      const fill = makeCylinder(R, len, base, a);
      r = b.fuse(fill).cut(core);
    }
    if (Math.abs(volOf(r) - v0) < 1e-6) throw new Error("Diş gövdeye uygulanamadı");
    return r;
  });
}

/** Toleranslı (bulanık) Boolean kesme: helis gibi zor geometrilerde sağlam sonuç verir */
function fuzzyCut(a: Shape, b: Shape, fuzz = 1e-4): Shape {
  const oc = getOC() as any;
  const op = new oc.BRepAlgoAPI_Cut();
  const args = new oc.NCollection_List_TopoDS_Shape();
  args.Append(a.wrapped);
  const tl = new oc.NCollection_List_TopoDS_Shape();
  tl.Append(b.wrapped);
  op.SetArguments(args);
  op.SetTools(tl);
  op.SetFuzzyValue(fuzz);
  op.SetNonDestructive?.(true);
  op.Build(new oc.Message_ProgressRange());
  if (op.HasErrors()) {
    op.delete();
    throw new Error("Boolean kesme başarısız");
  }
  const r = cast(op.Shape());
  op.delete();
  return r;
}

// ---------- Esnet (kesitlerden yeniden örme) ----------
function sectionLoops(body: Shape, o: Vec3, n: Vec3): any[] {
  const oc = getOC() as any;
  const pln = new oc.gp_Pln(new oc.gp_Pnt(...o), new oc.gp_Dir(...n));
  const sec = new oc.BRepAlgoAPI_Section(body.wrapped, pln, true);
  const edges = [...(cast(sec.Shape()) as any).edges];
  sec.delete();
  const loops: any[] = [];
  const used = new Set<number>();
  const key = (p: Vec3) => p;
  void key;
  for (let i = 0; i < edges.length; i++) {
    if (used.has(i)) continue;
    used.add(i);
    const chain = [edges[i]];
    const start = tup(edges[i].startPoint);
    let cur = tup(edges[i].endPoint);
    let guard = 0;
    while (vlen(vsub(cur, start)) > 1e-5 && guard++ < edges.length) {
      const j = edges.findIndex((e, k) => !used.has(k) && (vlen(vsub(tup(e.startPoint), cur)) < 1e-5 || vlen(vsub(tup(e.endPoint), cur)) < 1e-5));
      if (j < 0) break;
      used.add(j);
      chain.push(edges[j]);
      cur = vlen(vsub(tup(edges[j].startPoint), cur)) < 1e-5 ? tup(edges[j].endPoint) : tup(edges[j].startPoint);
    }
    const w = assembleWire(chain);
    loops.push({ w, area: measureArea(makeFace(w.clone())) });
  }
  return loops.sort((x, y) => y.area - x.area).map((x) => x.w);
}

function flexTool(f: Extract<KFeature, { type: "flex" }>) {
  const bi = bodyIdxOf(f.body);
  const body = bodies[bi];
  const a = vnorm(f.axis);
  const bb = body.boundingBox.bounds as [Vec3, Vec3];
  const cc = vmul(vadd(bb[0], bb[1]), 0.5);
  let t0 = Infinity, t1 = -Infinity;
  for (const e of body.edges as any[])
    for (const q of [0, 0.5, 1]) {
      const t = vdot(tup(e.pointAt(q)), a);
      t0 = Math.min(t0, t);
      t1 = Math.max(t1, t);
    }
  const Lt = t1 - t0;
  if (Lt < 1e-6) throw new Error("Gövde bu eksende uzunluğa sahip değil");
  const P0 = vadd(cc, vmul(a, t0 - vdot(cc, a)));
  const N = f.mode === "bend" || f.mode === "twist" ? 24 : 6;
  const eps = Lt * 1e-4;
  const sections: any[][] = [];
  for (let i = 0; i <= N; i++) {
    const s = i === 0 ? eps : i === N ? Lt - eps : (Lt * i) / N;
    const o = vadd(P0, vmul(a, s));
    let loops = sectionLoops(body, o, a);
    if (!loops.length) throw new Error("Kesit alınamadı");
    if (sections.length && loops.length !== sections[0].length) throw new Error("Gövdenin kesiti boyunca değişiyor (delik / çıkıntı var); esnet yalnızca kesiti sabit gövdelerde (çubuk, profil, mil) çalışır");
    const ax = vadd(P0, vmul(a, s));
    loops = loops.map((w: any) => {
      if (f.mode === "twist") return w.rotate((f.value * s) / Lt, ax, a);
      if (f.mode === "taper") return w.scale(1 + ((f.value - 1) * s) / Lt, ax);
      if (f.mode === "stretch") return w.translate(vmul(a, (s * (f.value - 1)))) ;
      // bük: kesit başlangıç düzlemine alınıp büküm ekseni etrafında döndürülür
      const th = (f.value * Math.PI) / 180;
      if (Math.abs(th) < 1e-9) return w;
      const b = vnorm(vsub(f.dir, vmul(a, vdot(f.dir, a))));
      if (vlen(b) < 0.5) throw new Error("Büküm yönü eksene dik olmalı");
      const R = Lt / th;
      const O = vadd(P0, vmul(b, R));
      const k = vcross(a, b);
      return w.translate(vmul(a, -s)).rotate((f.value * s) / Lt, O, k);
    });
    sections.push(loops);
  }
  let res: Shape | null = null;
  for (let k = 0; k < sections[0].length; k++) {
    const solid = loft(sections.map((sc) => sc[k]), { ruled: false });
    res = !res ? solid : res.cut(solid);
  }
  bodies[bi] = res;
}

// ---------- Köşe pahı ----------
function vertexChamferTool(f: Extract<KFeature, { type: "vchamfer" }>) {
  const near = (p: Vec3) => vlen(vsub(p, f.v)) < 1e-4;
  const bi = bodies.findIndex((b) => (b.edges as any[]).some((e) => near(tup(e.startPoint)) || near(tup(e.endPoint))));
  if (bi < 0) throw new Error("Köşe modelde bulunamadı");
  const es = (bodies[bi].edges as any[]).filter((e) => near(tup(e.startPoint)) || near(tup(e.endPoint)));
  if (es.length !== 3) throw new Error("Köşe pahı üç kenarın birleştiği köşelerde uygulanır");
  const pts = es.map((e) => {
    const L = measureLength(e);
    if (f.d >= L) throw new Error("Pah mesafesi kenar boyundan büyük");
    const fromStart = near(tup(e.startPoint));
    return tup(e.pointAt(fromStart ? f.d / L : 1 - f.d / L));
  });
  let n = vnorm(vcross(vsub(pts[1], pts[0]), vsub(pts[2], pts[0])));
  if (vdot(vsub(f.v, pts[0]), n) > 0) n = vmul(n, -1);
  bodies[bi] = bodies[bi].cut(halfSpace(pts[0], n));
}

function interfere(id: number) {
  const pairs: { a: number; b: number; vol: number }[] = [];
  for (let i = 0; i < bodies.length; i++)
    for (let j = i + 1; j < bodies.length; j++) {
      if (!bbOverlapStrict(bodies[i], bodies[j])) continue;
      try {
        const v = volOf(bodies[i].intersect(bodies[j]));
        if (v > 1e-6) pairs.push({ a: i, b: j, vol: v });
      } catch {}
    }
  post({ id, type: "interfere", pairs });
}

// ---------- Sac metal: kademe, gönye flanş, köşe kapatma, saca dönüştür ----------

function mapLoop2(l: Loop, f: (p: Vec2) => Vec2): Loop {
  if ("circle" in l) return { circle: { c: f(l.circle.c), r: l.circle.r }, depth: l.depth };
  if ("ellipse" in l) return l;
  return { segs: l.segs.map((s) => (s.t === "a" ? { t: "a", a: f(s.a), b: f(s.b), m: f(s.m) } : { ...s, a: f(s.a), b: f(s.b) }) as Seg), depth: l.depth };
}

function sheetJog(f: Extract<KFeature, { type: "sheetjog" }>) {
  if (!bodies.length) throw new Error("Önce bir taban flanş oluşturun");
  const frame = resolvePlane(f.pl);
  const P0 = toWorld(frame, f.line[0]), Q0 = toWorld(frame, f.line[1]);
  const e = vnorm(vsub(Q0, P0));
  const nF = frame.n;
  const hs = f.pl.face ? matchFaces([f.pl.face]) : new Set<number>();
  let bi = bodies.findIndex((b) => (b.faces as any[]).some((x) => hs.has(x.hashCode)));
  if (bi < 0) bi = 0;
  const body = bodies[bi];
  const t = f.t, r = Math.max(0.01, f.r);
  if (f.H < 2 * r + t + 0.01) throw new Error(`Kademe yüksekliği en az ${Math.round((2 * r + t + 0.01) * 100) / 100} mm olmalı (2 × büküm yarıçapı + kalınlık)`);
  const left = vcross(nF, e);
  const m = f.side ? left : vmul(left, -1);
  const u = f.flip ? vmul(nF, -1) : nF;
  const O = f.flip ? vsub(P0, vmul(nF, t)) : P0;
  const Ls = r + t + 0.5;
  const segs: Seg[] = [
    { t: "l", a: [-Ls, 0], b: [0, 0] },
    { t: "l", a: [0, 0], b: [0, f.H] },
    { t: "l", a: [0, f.H], b: [Ls, f.H] },
  ];
  const loops = sheetOpenRegion(segs, t, r, true);
  let lo = Infinity, hi = -Infinity;
  for (const ed of body.edges as any[])
    for (const q of [0, 1]) {
      const d = vdot(vsub(tup(q ? ed.endPoint : ed.startPoint), O), e);
      lo = Math.min(lo, d);
      hi = Math.max(hi, d);
    }
  const pn = vcross(m, u);
  const sign = vdot(pn, e) > 0 ? 1 : -1;
  const jog = profile(loops).sketchOnPlane(new Plane(vadd(O, vmul(e, lo)), m, pn)).extrude(sign * (hi - lo));
  const big = bodySize();
  const A = body.cut(boxIn(O, m, u, e, -Ls, big, -big, big, -big, big));
  const B = body.cut(boxIn(O, m, u, e, -big, Ls, -big, big, -big, big));
  if (volOf(A) < 1e-9 || volOf(B) < 1e-9) throw new Error("Kademe çizgisinin iki yanında da malzeme olmalı");
  bodies[bi] = A.fuse(jog).fuse(B.translate(vmul(u, f.H)));
  bodies = bodies.flatMap(solidsOf);
}

function miterFlange(f: Extract<KFeature, { type: "miterflange" }>) {
  if (!bodies.length) throw new Error("Önce bir taban flanş oluşturun");
  const infos = f.edges.map((ref) => flangeEdgeInfo(ref, f.t));
  const g0 = infos[0];
  const map = (q: Vec2): Vec2 => {
    const W = toWorld(f.skFrame, q);
    const rr = vsub(W, g0.A);
    return [vdot(rr, g0.s), vdot(rr, g0.nF)];
  };
  // profil zinciri kenar koordinatlarına (s: dışa, u: yüz normali) taşınır; başı kenara yakın uç olur
  let chain: Seg[] = f.chain.map((sg) => mapLoop2({ segs: [sg], depth: 0 }, map) as any).map((l: any) => l.segs[0]);
  const len2v = (p: Vec2) => Math.hypot(p[0], p[1]);
  if (len2v(chain[chain.length - 1].b) < len2v(chain[0].a)) chain = [...chain].reverse().map(revSeg);
  if (len2v(chain[0].a) > Math.max(1, f.t * 2)) throw new Error("Profil eskizi seçilen ilk kenarın ucundan başlamalı");
  // taban ile profil arası büküm: tabanda bir saplama eklenir, taban o kadar kırpılır
  const Ls = f.r + f.t + 0.5;
  const st = chain[0].a;
  const full: Seg[] = [{ t: "l", a: [st[0] - Ls, st[1]], b: st }, ...chain];
  const loops = sheetOpenRegion(full, f.t, f.r, !f.rev);
  const R = profileSupport(loops, [1, 0, 0], [0, 0, 1], [1, 0, 0]) + profileSupport(loops, [1, 0, 0], [0, 0, 1], [0, 1, 0]) + f.t;
  const ext = infos.map(() => [0, 0]);
  type J = { V: Vec3; i: number; j: number; ei: 0 | 1; ej: 0 | 1 };
  const joints: J[] = [];
  infos.forEach((g, i) =>
    infos.forEach((h, j) => {
      if (j <= i) return;
      const gE = [g.A, vadd(g.A, vmul(g.e, g.Le))], hE = [h.A, vadd(h.A, vmul(h.e, h.Le))];
      gE.forEach((V, ei) =>
        hE.forEach((W, ej) => {
          if (vlen(vsub(V, W)) < 1e-3) {
            joints.push({ V, i, j, ei: ei as 0 | 1, ej: ej as 0 | 1 });
            ext[i][ei] = 2 * R + f.gap + 1;
            ext[j][ej] = 2 * R + f.gap + 1;
          }
        }),
      );
    }),
  );
  const solids = infos.map((g, i) => {
    const u = g.nF;
    const pn = vcross(g.s, u);
    const sign = vdot(pn, g.e) > 0 ? 1 : -1;
    const o = vsub(g.A, vmul(g.e, ext[i][0]));
    return profile(loops).sketchOnPlane(new Plane(o, g.s, pn)).extrude(sign * (g.Le + ext[i][0] + ext[i][1]));
  });
  for (const jn of joints) {
    const gi = infos[jn.i], gj = infos[jn.j];
    const dA = jn.ei === 0 ? gi.e : vmul(gi.e, -1);
    const dB = jn.ej === 0 ? gj.e : vmul(gj.e, -1);
    const nm = vnorm(vsub(dA, dB));
    solids[jn.i] = solids[jn.i].cut(halfSpace(vadd(jn.V, vmul(nm, f.gap / 2)), nm));
    solids[jn.j] = solids[jn.j].cut(halfSpace(vsub(jn.V, vmul(nm, f.gap / 2)), vmul(nm, -1)));
  }
  let b = bodies[g0.bi];
  infos.forEach((g) => {
    const z0 = ext[infos.indexOf(g)][0] > 0 ? -f.t : 0, z1 = g.Le + (ext[infos.indexOf(g)][1] > 0 ? f.t : 0);
    b = b.cut(boxIn(g.A, g.s, g.nF, g.e, -Ls, 0.01, -f.t - 0.01, 0.01, z0, z1));
  });
  for (const sld of solids) b = b.fuse(sld);
  bodies[g0.bi] = b;
  bodies = bodies.flatMap(solidsOf);
}

function closeCorner(f: Extract<KFeature, { type: "closecorner" }>) {
  for (const ref of f.faces) {
    const pf = planarFace(ref);
    if (!pf || String(pf.face.geomType) !== "PLANE") throw new Error("Flanşın düz uç yüzünü seçin");
    const bi = bodyIdxOf(ref);
    const body = bodies[bi];
    const n = pf.n, c = pf.c;
    let best = Infinity;
    for (const fc of body.faces as any[]) {
      if (String(fc.geomType) !== "PLANE") continue;
      const fcc = tup(fc.center);
      const nn = vnorm(tup(fc.normalAt(fcc)));
      const dd = vdot(nn, n);
      if (f.overlap ? dd < 0.999 : dd > -0.999) continue;
      const d = vdot(vsub(fcc, c), n);
      if (d > 1e-6 && d < best) best = d;
    }
    if (!isFinite(best)) throw new Error("Uç yüzün karşısında komşu flanş bulunamadı");
    const dist = best - (f.overlap ? 0 : f.gap);
    if (dist <= 1e-6) continue;
    let prism = basicFaceExtrusion(pf.face.clone(), new Vector(vmul(n, dist)));
    // yalnızca düz flanş kısmı uzatılır: tabandan büküm (r + t) yüksekliğinin altı kırpılır
    let base: any = null, ba = 0;
    for (const fc of body.faces as any[]) {
      if (String(fc.geomType) !== "PLANE") continue;
      const nn = vnorm(tup(fc.normalAt(tup(fc.center))));
      if (Math.abs(vdot(nn, n)) > 0.01) continue;
      const ar = measureArea(fc);
      if (ar > ba) [ba, base] = [ar, fc];
    }
    if (base) {
      const cb = tup(base.center);
      let ub = vnorm(tup(base.normalAt(cb)));
      if (vdot(vsub(c, cb), ub) < 0) ub = vmul(ub, -1);
      let umin = Infinity;
      for (const ed of body.edges as any[]) umin = Math.min(umin, vdot(vsub(tup(ed.startPoint), cb), ub), vdot(vsub(tup(ed.endPoint), cb), ub));
      prism = prism.cut(halfSpace(vadd(cb, vmul(ub, umin + f.r + f.t)), ub));
    }
    if (volOf(prism) > 1e-9) bodies[bi] = bodies[bi].fuse(prism);
  }
  bodies = bodies.flatMap(solidsOf);
}

function toSheet(f: Extract<KFeature, { type: "tosheet" }>) {
  if (!bodies.length) throw new Error("Dönüştürülecek katı yok");
  const t = f.t;
  // yarıklar
  for (const ref of f.rips) {
    const h = [...matchEdges([ref])][0];
    const bi = bodies.findIndex((b) => (b.edges as any[]).some((x) => x.hashCode === h));
    if (bi < 0) throw new Error("Yarık kenarı bulunamadı");
    const E = (bodies[bi].edges as any[]).find((x) => x.hashCode === h);
    if (String(E.geomType) !== "LINE") throw new Error("Yarık için düz bir köşe kenarı seçin");
    const A = tup(E.startPoint), B = tup(E.endPoint);
    const e = vnorm(vsub(B, A)), L = vlen(vsub(B, A));
    const fs = facesOfEdge(bodies[bi], h).filter((x) => String(x.geomType) === "PLANE");
    if (fs.length !== 2) throw new Error("Yarık kenarı iki düz yüz arasında olmalı");
    const mid = vmul(vadd(A, B), 0.5);
    const n1 = vnorm(tup(fs[0].normalAt(mid))), n2 = vnorm(tup(fs[1].normalAt(mid)));
    const nb = vnorm(vsub(n1, n2)), dg = vnorm(vadd(n1, n2));
    bodies[bi] = bodies[bi].cut(boxIn(A, nb, dg, e, -f.gap / 2, f.gap / 2, -3 * t, 3 * t, 0, L));
    // köşe boşaltması: yarığın büküm kenarlarına değen ucunda (r + t) kare boşaltma
    const bendRefs = f.bends.map((r) => r.m);
    const rt = f.r + t;
    for (const [V, dir] of [[A, e], [B, vmul(e, -1)]] as [Vec3, Vec3][]) {
      const nearBend = bendRefs.some((bm) => {
        const bh = [...matchEdges([{ m: bm }])][0];
        const be = (bodies[bi].edges as any[]).find((x) => x.hashCode === bh);
        if (!be) return false;
        try {
          return measureDistanceBetween(be, makeVertex(V)) < rt + 1;
        } catch {
          return false;
        }
      });
      if (!nearBend) continue;
      bodies[bi] = bodies[bi].cut(boxIn(V, n1, n2, dir, -rt, 1, -rt, 1, -1, rt));
    }
  }
  // bükümler: dış kenar r+t, karşılık gelen iç kenar r
  const outer = matchEdges(f.bends);
  const innerRefs: EdgeRef[] = [];
  for (const h of outer) {
    const b = bodies.find((x) => (x.edges as any[]).some((e) => e.hashCode === h))!;
    const E = (b.edges as any[]).find((e) => e.hashCode === h);
    if (String(E.geomType) !== "LINE") throw new Error("Büküm için düz bir dış kenar seçin");
    const A = tup(E.startPoint), dE = vnorm(vsub(tup(E.endPoint), A)), M = tup(E.pointAt(0.5));
    let best: any = null, bd = Infinity;
    for (const c of b.edges as any[]) {
      if (c.hashCode === h || String(c.geomType) !== "LINE") continue;
      const dC = vnorm(vsub(tup(c.endPoint), tup(c.startPoint)));
      if (Math.abs(vdot(dC, dE)) < 0.999) continue;
      const w = vsub(tup(c.pointAt(0.5)), M);
      const perpD = vlen(vsub(w, vmul(dE, vdot(w, dE))));
      if (perpD < t * 0.9 || perpD > t * 2.1) continue;
      if (perpD < bd) [bd, best] = [perpD, c];
    }
    if (!best) throw new Error("Büküm kenarına karşılık gelen iç kenar bulunamadı (kalınlığı kontrol edin)");
    innerRefs.push({ m: tup(best.pointAt(0.5)), d: vnorm(vsub(tup(best.endPoint), tup(best.startPoint))) });
  }
  const outerRefs = [...outer].map((h) => {
    const E = allEdges().find((e) => e.hashCode === h)!;
    return { m: tup(E.pointAt(0.5)) } as EdgeRef;
  });
  const doFillet = (refs: EdgeRef[], rad: number) => {
    const set = matchEdges(refs);
    if (!set.size) return;
    try {
      onOwner(set, "edges", (b) => b.fillet((e: any) => (set.has(e.hashCode) ? rad : null)));
    } catch {
      // toplu yuvarlatma başarısızsa tek tek dene
      for (const r of refs) {
        const one = matchEdges([r]);
        if (!one.size) continue;
        onOwner(one, "edges", (b) => b.fillet((e: any) => (one.has(e.hashCode) ? rad : null)));
      }
    }
  };
  doFillet(outerRefs, f.r + t);
  if (f.r > 1e-6) doFillet(innerRefs, f.r);
}

// ---------- Kaynaklı yapı ----------

interface MemberReg {
  key: string;
  name: string;
  a: Vec3;
  b: Vec3;
  /** çizgi yönü (yay için başlangıç teğeti) */
  d: Vec3;
  x: Vec3;
  loops: Loop[];
  R: number;
  arc: boolean;
  len: number;
  m?: Vec3;
  /** zincir elemanlar: eşleştirme için yol noktaları */
  path?: Vec3[];
}
let memberReg = new Map<string, MemberReg>();

/** P'den geçen, n'ye dik düzlemin n'nin tersi tarafını kaplayan büyük kutu (bu tarafı siler) */
function halfSpace(P: Vec3, n: Vec3): Shape {
  const big = bodySize();
  const u = vnorm(Math.abs(n[2]) < 0.9 ? vcross(n, [0, 0, 1]) : vcross(n, [1, 0, 0]));
  return boxIn(P, n, u, vcross(n, u), -big, 0, -big, big, -big, big);
}

const centroid = (s: Shape): Vec3 => {
  try {
    return measureShapeVolumeProperties(s).centerOfMass as Vec3;
  } catch {
    const bb = s.boundingBox.bounds;
    return vmul(vadd(bb[0], bb[1]), 0.5);
  }
};

/** Parçalardan dir yönünde V'den en uzaktakini tut */
function keepFar(shape: Shape, V: Vec3, dir: Vec3): Shape {
  const pieces = solidsOf(shape).filter((p) => volOf(p) > 1e-6);
  if (!pieces.length) throw new Error("Kırpma sonucunda eleman kalmadı");
  let best = pieces[0], bd = -Infinity;
  for (const p of pieces) {
    const d = vdot(vsub(centroid(p), V), dir);
    if (d > bd) [bd, best] = [d, p];
  }
  return best;
}

/** Profilin 3B kesit noktalarının dir yönündeki en büyük izdüşümü (eleman ekseninden) */
function profileSupport(loops: Loop[], x: Vec3, d: Vec3, dir: Vec3): number {
  const y = vcross(d, x);
  let m = -Infinity;
  for (const l of loops) {
    const pts: Vec2[] =
      "circle" in l
        ? Array.from({ length: 36 }, (_, i) => [l.circle.c[0] + l.circle.r * Math.cos((i / 36) * 2 * Math.PI), l.circle.c[1] + l.circle.r * Math.sin((i / 36) * 2 * Math.PI)] as Vec2)
        : "segs" in l
          ? l.segs.flatMap((s) => (s.t === "a" ? [s.a, s.m] : [s.a]))
          : [];
    for (const p of pts) m = Math.max(m, vdot(vadd(vmul(x, p[0]), vmul(y, p[1])), dir));
  }
  return Math.max(0, m);
}

function sweepProfile(loops: Loop[], plane: any, spine: any): Shape {
  let solid: Shape | null = null;
  for (const l of loops) {
    const w = (loopDrawing(l).sketchOnPlane(plane) as any).wire;
    const s = genericSweep(w, spine, { frenet: true, transitionMode: "right" }, false);
    if (!solid) solid = s;
    else solid = l.depth % 2 === 0 ? solid.fuse(s) : solid.cut(s);
  }
  return solid;
}

/** profil düzleminin X ekseni: Y = n'nin yola dik bileşeni, X = Y × d (replicad Plane: yDir = d × xDir) */
function profileX(n: Vec3, d: Vec3, legacy = false): Vec3 {
  if (legacy) {
    // v0.17 öncesi: profil X = −n (eski belgeler aynı görünsün)
    let x = vmul(n, -1);
    x = vsub(x, vmul(d, vdot(x, d)));
    if (vlen(x) < 1e-6) x = Math.abs(d[2]) < 0.9 ? vcross(d, [0, 0, 1]) : vcross(d, [1, 0, 0]);
    return vnorm(x);
  }
  let y = vsub(n, vmul(d, vdot(n, d)));
  if (vlen(y) < 1e-6) y = Math.abs(d[1]) < 0.9 ? vsub([0, 1, 0], vmul(d, d[1])) : vsub([0, 0, 1], vmul(d, d[2]));
  y = vnorm(y);
  return vnorm(vcross(y, d));
}
type MemberPart = { prio?: number; keys: string[]; solids: (Shape | null)[]; lines: ({ a: Vec3; b: Vec3; d: Vec3; L: number; x: Vec3 } | null)[]; chained: Set<number>; loops: Loop[]; g: number; treated: Set<string> };
function memberTool(f: Extract<KFeature, { type: "member" }>) {
  // SolidWorks grupları: her grup kendi profil konumu ve köşe işlemiyle (köşe işlemi grup içinde)
  const parts: MemberPart[] = [];
  if (f.ori === 2) f = { ...f, items: autoRotate({ ...f, items: planarize(f) }) };
  if (!f.gl || f.gl.length < 2) parts.push({ ...memberCore(f), g: 0 });
  else
    f.gl.forEach((gp, k) => {
      const items = f.items.filter((it) => (it.g ?? 0) === k);
      if (items.length) parts.push({ ...memberCore({ ...f, items, loops: gp.loops, R: gp.R, corner: gp.corner, gap: gp.gap, name: gp.name ?? f.name }), g: k, prio: gp.prio });
    });
  // akıllı birleşimler: T birleşimi, gruplar arası köşe, 3+ elemanlı köşe
  xSplits = [];
  if (f.ori === 2) resolveJoints(parts, f.gap);
  for (const xs of xSplits) {
    const reg = memberReg.get(xs.key);
    if (!reg) continue;
    const L1 = vlen(vsub(xs.V, reg.a)), L2 = vlen(vsub(reg.b, xs.V));
    memberReg.set(xs.key + "/2", { ...reg, key: xs.key + "/2", a: xs.V, len: L2 });
    memberReg.set(xs.key, { ...reg, b: xs.V, len: L1 });
  }
  if (f.ori === 2 && f.tp) trimToPrevious(f.id, parts, f.gap);
  for (const p of parts) for (const s of p.solids) if (s) for (const q of solidsOf(s)) applyTool(q, false, false);
}
/** Özellikler arası birleşim (SolidWorks Kırp/Uzat gibi, otomatik): bu özelliğin uçları önceki yapı elemanlarına değiyorsa
 *  T: uç, önceki elemanın yüzünde kırpılır; köşe (iki uç aynı noktada): önceki eleman uzatılır, yeni eleman onun yüzünde biter. */
function trimToPrevious(fid: string, parts: MemberPart[], gap: number) {
  const prev = [...memberReg.values()].filter((r) => !r.key.startsWith(fid + ":") && !r.arc);
  if (!prev.length) return;
  // önceki elemanların gövdeleri (yalnız önceki kayıtlarla eşleştir)
  const cs = bodies.map((b) => centroid(b));
  const bodyOf = new Map<string, number>();
  const used = new Set<number>();
  for (const r of prev) {
    let best = -1, bd = Infinity;
    cs.forEach((c, i) => {
      if (used.has(i)) return;
      const d = segDist(c, r.a, r.b);
      if (d < bd) [bd, best] = [d, i];
    });
    if (best >= 0 && bd < r.R * 1.2 + 1) (bodyOf.set(r.key, best), used.add(best));
  }
  const extended = new Set<string>();
  for (const p of parts)
    p.lines.forEach((li, i) => {
      if (!li || p.chained.has(i) || !p.solids[i]) return;
      ([li.a, li.b] as Vec3[]).forEach((V, end) => {
        const dO = end === 0 ? li.d : vmul(li.d, -1); // elemanın içine doğru
        for (const h of prev) {
          if (Math.abs(vdot(h.d, li.d)) > 0.9999) continue; // aynı doğrultu: dokunma
          const t = vdot(vsub(V, h.a), h.d);
          if (t < -1e-3 || t > h.len + 1e-3) continue;
          if (vlen(vsub(vadd(h.a, vmul(h.d, t)), V)) > 1e-3) continue;
          const corner = t < 1e-3 || t > h.len - 1e-3;
          // köşede başka önceki eleman da bitiyorsa (gönyeli çerçeve köşesi) uzatma: köşe zaten dolu
          const mates = prev.filter((o) => vlen(vsub(o.a, V)) < 1e-3 || vlen(vsub(o.b, V)) < 1e-3).length;
          if (corner && mates === 1 && !extended.has(h.key)) {
            // önceki elemanı yeni elemanın profilini kaplayacak kadar uzat
            const hEnd = t < h.len / 2 ? 0 : 1;
            const dH = hEnd === 0 ? vmul(h.d, -1) : h.d; // uçtan dışarı
            const e = profileSupport(p.loops, li.x, li.d, dH);
            const bi = bodyOf.get(h.key);
            if (e > 1e-6 && bi !== undefined) {
              const o = hEnd === 0 ? vsub(h.a, vmul(h.d, e)) : h.b;
              try {
                const ext = profile(h.loops).sketchOnPlane(new Plane(o, h.x, h.d)).extrude(e);
                bodies[bi] = bodies[bi].fuse(ext);
                extended.add(h.key);
              } catch {}
            }
          }
          // yeni elemanı önceki elemanın yüzünde bitir
          const sup = profileSupport(h.loops, h.x, h.d, dO);
          try {
            p.solids[i] = keepFar(p.solids[i]!.cut(halfSpace(vadd(V, vmul(dO, sup + gap)), dO)), V, dO);
          } catch {}
          break;
        }
      });
    });
  // ters T: önceki elemanın ucu yeni elemanın orta kısmına değiyor → önceki eleman yeni elemanın yüzünde biter
  for (const h of prev) {
    const bi = bodyOf.get(h.key);
    if (bi === undefined) continue;
    ([h.a, h.b] as Vec3[]).forEach((E, end) => {
      for (const p of parts)
        p.lines.forEach((li, i) => {
          if (!li || !p.solids[i] || Math.abs(vdot(h.d, li.d)) > 0.9999) return;
          const t = vdot(vsub(E, li.a), li.d);
          if (t < 1e-3 || t > li.L - 1e-3 || vlen(vsub(vadd(li.a, vmul(li.d, t)), E)) > 1e-3) return;
          const dO = end === 0 ? h.d : vmul(h.d, -1);
          const sup = profileSupport(p.loops, li.x, li.d, dO);
          try {
            bodies[bi] = keepFar(bodies[bi].cut(halfSpace(vadd(E, vmul(dO, sup + gap)), dO)), E, dO);
          } catch {}
        });
    });
  }
}
/** düzlemsel bağlı zincirde (ör. ters U çerçeve) tüm segmentlerin profil dikey ekseni = zincir düzlemi normali (2B eskizdeki gibi; köşede profiller aynı yönde buluşur) */
function planarize(f: Extract<KFeature, { type: "member" }>): MemberItem[] {
  const items = f.items.map((it) => ({ ...it }));
  const kk = (p: Vec3) => p.map((v) => Math.round(v * 1000)).join(",");
  const par = items.map((_, i) => i);
  const find = (i: number): number => (par[i] === i ? i : (par[i] = find(par[i])));
  const at = new Map<string, number>();
  items.forEach((it, i) => [it.a, it.b].forEach((p) => {
    const k = kk(p);
    if (at.has(k) && (items[at.get(k)!].g ?? 0) === (it.g ?? 0)) par[find(i)] = find(at.get(k)!);
    else at.set(k, i);
  }));
  const comps = new Map<number, number[]>();
  items.forEach((_, i) => comps.set(find(i), [...(comps.get(find(i)) ?? []), i]));
  for (const ids of comps.values()) {
    if (ids.length < 2) continue;
    const gp = f.gl?.[items[ids[0]].g ?? 0];
    if (gp ? gp.auto === false : f.auto === false) continue;
    const ds = ids.map((i) => vnorm(vsub(items[i].b, items[i].a)));
    let n: Vec3 | null = null;
    for (let u = 0; u < ds.length && !n; u++) for (let w = u + 1; w < ds.length && !n; w++) if (vlen(vcross(ds[u], ds[w])) > 1e-3) n = vnorm(vcross(ds[u], ds[w]));
    if (!n || ds.some((d) => Math.abs(vdot(d, n!)) > 1e-3)) continue;
    // işaret: yukarı / öne / sağa bakan
    if (n[1] < -1e-9 || (Math.abs(n[1]) < 1e-9 && (n[2] < -1e-9 || (Math.abs(n[2]) < 1e-9 && n[0] < 0)))) n = vmul(n, -1);
    for (const i of ids) items[i].n = n;
  }
  return items;
}
/** profilin kesit ağırlık merkezi − sınır kutusu merkezi (profil koordinatlarında); simetrikse ~0 */
function profileBias(loops: Loop[]): [number, number] {
  let A = 0, cx = 0, cy = 0;
  const xs: number[] = [], ys: number[] = [];
  for (const l of loops) {
    const pts: Vec2[] = "circle" in l ? Array.from({ length: 24 }, (_, i) => [l.circle.c[0] + l.circle.r * Math.cos((i / 24) * 2 * Math.PI), l.circle.c[1] + l.circle.r * Math.sin((i / 24) * 2 * Math.PI)] as Vec2) : "segs" in l ? l.segs.flatMap((q) => (q.t === "a" ? [q.a, q.m] : [q.a])) : [];
    let a = 0, x = 0, y = 0;
    for (let i = 0; i < pts.length; i++) {
      const [p, q] = [pts[i], pts[(i + 1) % pts.length]];
      const c = p[0] * q[1] - q[0] * p[1];
      a += c;
      x += (p[0] + q[0]) * c;
      y += (p[1] + q[1]) * c;
      xs.push(p[0]);
      ys.push(p[1]);
    }
    const sg = (l.depth % 2 ? -1 : 1) * Math.sign(a || 1);
    A += sg * a;
    cx += sg * x;
    cy += sg * y;
  }
  if (Math.abs(A) < 1e-9) return [0, 0];
  const gx = cx / (3 * A), gy = cy / (3 * A);
  return [gx - (Math.min(...xs) + Math.max(...xs)) / 2, gy - (Math.min(...ys) + Math.max(...ys)) / 2];
}
/** SolidWorks'te elle yapılan işi otomatik yap: köşeye gelen tekil elemanı (ör. ayak) profilin içi köşeye bakacak şekilde 90° adımlarla döndür */
function autoRotate(f: Extract<KFeature, { type: "member" }>): MemberItem[] {
  const items = f.items.map((it) => ({ ...it }));
  const kk = (p: Vec3) => p.map((v) => Math.round(v * 1000)).join(",");
  const J = new Map<string, { i: number; end: 0 | 1 }[]>();
  items.forEach((it, i) => ([it.a, it.b] as Vec3[]).forEach((p, e) => {
    const k = kk(p);
    if (!J.has(k)) J.set(k, []);
    J.get(k)!.push({ i, end: e as 0 | 1 });
  }));
  items.forEach((it, i) => {
    if (it.k !== "l") return;
    const gp = f.gl?.[it.g ?? 0];
    if (gp ? gp.auto === false : f.auto === false) return;
    const loops = gp?.loops ?? f.loops;
    const bias = profileBias(loops);
    if (Math.hypot(bias[0], bias[1]) < 0.05) return; // simetrik profil
    const sameG = (q: { i: number }) => (items[q.i].g ?? 0) === (it.g ?? 0);
    // grup içi zincirin parçasıysa (gönyeli köşe) dokunma
    const ends = ([0, 1] as const).map((e) => J.get(kk(e === 0 ? it.a : it.b))!);
    if (ends.some((l) => l.some((q) => q.i !== i && sameG(q)))) return;
    const d = vnorm(vsub(it.b, it.a));
    let sum: Vec3 = [0, 0, 0];
    ends.forEach((list, e) => {
      for (const q of list) {
        if (q.i === i) continue;
        const o = items[q.i];
        const dirO = vnorm(q.end === 0 ? vsub(o.b, o.a) : vsub(o.a, o.b));
        sum = vadd(sum, vsub(dirO, vmul(d, vdot(dirO, d))));
      }
      void e;
    });
    if (vlen(sum) < 1e-6) return;
    const x0 = profileX(it.n, d);
    const y0 = vcross(d, x0);
    // içe bakan vektör: ağırlık merkezinden kutu merkezine (−bias); en iyi 90° adımı seç
    let best = x0, bd = -Infinity;
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      const x = vadd(vmul(x0, Math.cos(a)), vmul(y0, Math.sin(a)));
      const y = vcross(d, x);
      const inward = vadd(vmul(x, -bias[0]), vmul(y, -bias[1]));
      const sc = vdot(vnorm(inward), vnorm(sum));
      if (sc > bd + 1e-9) [bd, best] = [sc, x];
    }
    // n'yi (profil Y) seçilen döndürmeye göre ayarla: profileX(n,d) = x olsun
    it.n = vcross(d, best);
  });
  return items;
}
/** Bağlı segmentleri uç uca aynı yönde akacak şekilde çevirir (profil kanatları köşede ters dönmesin) */
function orientChains(src: MemberItem[]): MemberItem[] {
  const items = src.map((it) => ({ ...it }));
  const kk = (p: Vec3) => p.map((v) => Math.round(v * 1000)).join(",");
  const J = new Map<string, { i: number; end: 0 | 1 }[]>();
  items.forEach((it, i) => ([it.a, it.b] as Vec3[]).forEach((p, e) => {
    const k = kk(p);
    if (!J.has(k)) J.set(k, []);
    J.get(k)!.push({ i, end: e as 0 | 1 });
  }));
  const flip = (i: number) => {
    const it = items[i];
    [it.a, it.b] = [it.b, it.a];
  };
  const seen = new Set<number>();
  for (let s0 = 0; s0 < items.length; s0++) {
    if (seen.has(s0)) continue;
    seen.add(s0);
    const st = [s0];
    while (st.length) {
      const i = st.pop()!;
      for (const end of [0, 1] as const) {
        const list = J.get(kk(end === 0 ? items[i].a : items[i].b))!;
        if (list.length !== 2) continue;
        const o = list.find((q) => q.i !== i);
        if (!o || seen.has(o.i)) continue;
        // i bu uçtan çıkıyorsa (end 0) komşu buraya varmalı (end 1) ve tersi
        const oEnd = kk(items[o.i].a) === kk(end === 0 ? items[i].a : items[i].b) ? 0 : 1;
        if (oEnd === end) flip(o.i);
        seen.add(o.i);
        st.push(o.i);
      }
    }
  }
  return items;
}
/** T birleşimleri ve gruplar arası / 3+ elemanlı köşeler: elemanları birbirinin yüzünde biter */
function resolveJoints(parts: MemberPart[], gap: number) {
  type M = { p: MemberPart; i: number; key: string; a: Vec3; b: Vec3; d: Vec3; L: number; x: Vec3 };
  const ms: M[] = [];
  for (const p of parts) p.lines.forEach((li, i) => li && !p.chained.has(i) && p.solids[i] && ms.push({ p, i, key: p.keys[i], ...li }));
  const kk = (q: Vec3) => q.map((v) => Math.round(v * 1000)).join(",");
  const J = new Map<string, { m: M; end: 0 | 1 }[]>();
  for (const m of ms)
    ([m.a, m.b] as Vec3[]).forEach((q, e) => {
      const k = kk(q);
      if (!J.has(k)) J.set(k, []);
      J.get(k)!.push({ m, end: e as 0 | 1 });
    });
  const away = (m: M, end: 0 | 1) => (end === 0 ? m.d : vmul(m.d, -1));
  const trimTo = (m: M, end: 0 | 1, V: Vec3, by: M[]) => {
    const dO = away(m, end);
    const s = Math.max(...by.map((r) => profileSupport(r.p.loops, r.x, r.d, dO)));
    m.p.solids[m.i] = keepFar(m.p.solids[m.i]!.cut(halfSpace(vadd(V, vmul(dO, s + gap)), dO)), V, dO);
  };
  for (const [k, list] of J) {
    const V = list[0].end === 0 ? list[0].m.a : list[0].m.b;
    if (list.length === 1) {
      // T birleşimi: serbest uç başka bir elemanın orta kısmına değiyor
      const { m, end } = list[0];
      const hosts = ms.filter((o) => {
        if (o === m) return false;
        const t = vdot(vsub(V, o.a), o.d);
        if (t < 1e-3 || t > o.L - 1e-3) return false;
        return vlen(vsub(vadd(o.a, vmul(o.d, t)), V)) < 1e-3;
      });
      if (hosts.length) trimTo(m, end, V, hosts);
      continue;
    }
    const groups = new Set(list.map((q) => q.m.p));
    if (list.length === 2 && groups.size === 1) continue; // grup içi köşe: köşe işlemi uygulandı
    // birincil (sürekli) eleman: grup içinde zaten köşe işlemi görmüş çift varsa o, yoksa en düşey eleman
    const byPart = new Map<MemberPart, { m: M; end: 0 | 1 }[]>();
    for (const q of list) byPart.set(q.m.p, [...(byPart.get(q.m.p) ?? []), q]);
    // 0) kullanıcı kırpma önceliği verdiyse: en küçük öncelikli grubun elemanları sürekli
    let prim: { m: M; end: 0 | 1 }[] | null = null;
    if (list.some((q) => q.m.p.prio !== undefined) && groups.size > 1) {
      const pr = (q: { m: M }) => q.m.p.prio ?? 1e9;
      const mn = Math.min(...list.map(pr));
      const top = list.filter((q) => pr(q) === mn);
      if (top.length < list.length) prim = top.slice(0, 2);
    }
    // 1) aynı doğrultuda devam eden iki parça (bölünmüş düz kiriş) sürekli sayılır
    for (let u = 0; u < list.length && !prim; u++)
      for (let w = u + 1; w < list.length && !prim; w++)
        if (vdot(away(list[u].m, list[u].end), away(list[w].m, list[w].end)) < -0.9999) prim = [list[u], list[w]];
    // 2) grup içinde köşe işlemi görmüş çift
    prim ??= [...byPart.values()].find((v) => v.length === 2) ?? null;
    if (!prim) {
      const best = [...list].sort((u, w) => Math.abs(w.m.d[1]) - Math.abs(u.m.d[1]) || u.m.p.g - w.m.p.g || u.m.i - w.m.i)[0];
      prim = [best];
    }
    const others = list.filter((q) => !prim!.includes(q));
    if (!others.length) continue;
    if (prim.length === 1) {
      // birincil elemanı diğerlerinin profilini kaplayacak kadar uzat
      const P = prim[0];
      const dP = away(P.m, P.end);
      const e = Math.max(0, ...others.map((o) => profileSupport(o.m.p.loops, o.m.x, o.m.d, vmul(dP, -1))));
      if (e > 1e-6) {
        const o = P.end === 0 ? vsub(P.m.a, vmul(P.m.d, e)) : P.m.b;
        const ext = profile(P.m.p.loops).sketchOnPlane(new Plane(o, P.m.x, P.m.d)).extrude(e);
        P.m.p.solids[P.m.i] = P.m.p.solids[P.m.i]!.fuse(ext);
      }
    }
    for (const o of others) trimTo(o.m, o.end, V, prim.map((q) => q.m));
    void k;
  }
  // X kesişimi: iki eleman birbirini ortasından kesiyor → biri sürekli, diğeri iki parçaya ayrılır
  for (let u = 0; u < ms.length; u++)
    for (let w = u + 1; w < ms.length; w++) {
      const A = ms[u], B = ms[w];
      const c = vcross(A.d, B.d);
      if (vlen(c) < 1e-6) continue;
      const r = vsub(B.a, A.a);
      // iki doğru arasındaki en yakın noktalar
      const dd = vdot(A.d, B.d);
      const ta = (vdot(r, A.d) - dd * vdot(r, B.d)) / (1 - dd * dd);
      const tb = (dd * vdot(r, A.d) - vdot(r, B.d)) / (1 - dd * dd);
      if (ta < 1e-3 || ta > A.L - 1e-3 || tb < 1e-3 || tb > B.L - 1e-3) continue;
      const PA = vadd(A.a, vmul(A.d, ta)), PB = vadd(B.a, vmul(B.d, tb));
      if (vlen(vsub(PA, PB)) > 1e-3) continue;
      // birincil: daha düşey olan, sonra düşük grup / sıra
      const pa = A.p.prio, pb = B.p.prio;
      const [P, S] = pa !== undefined || pb !== undefined
        ? ((pb ?? 1e9) < (pa ?? 1e9) ? [B, A] : [A, B])
        : Math.abs(B.d[1]) > Math.abs(A.d[1]) + 1e-6 || (Math.abs(B.d[1]) >= Math.abs(A.d[1]) - 1e-6 && B.p.g < A.p.g) ? [B, A] : [A, B];
      // sürekli elemanın dış konturu boyunca uzun prizma ile kes (açılı kesişimde de tam oturur)
      const big = bodySize();
      const outer = P.p.loops.filter((l) => l.depth === 0);
      const prism = profile(outer).sketchOnPlane(new Plane(vsub(PA, vmul(P.d, big)), P.x, P.d)).extrude(2 * big);
      const cut = S.p.solids[S.i]!.cut(prism);
      const pieces = solidsOf(cut).filter((q) => volOf(q) > 1e-3);
      S.p.solids[S.i] = pieces.length > 1 ? (makeCompound(pieces.map((q) => q.clone())) as any) : pieces[0] ?? null;
      xSplits.push({ key: S.key, V: PA });
    }
}
/** X kesişiminde ikiye ayrılan elemanların kesim listesi kaydı */
let xSplits: { key: string; V: Vec3 }[] = [];
function memberCore(f: Extract<KFeature, { type: "member" }>): Omit<MemberPart, "g"> {
  const items = f.ori === 2 ? orientChains(f.items) : f.items;
  type LI = { a: Vec3; b: Vec3; d: Vec3; L: number; x: Vec3 };
  const lines: (LI | null)[] = items.map((it) => {
    if (it.k !== "l") return null;
    const L = vlen(vsub(it.b, it.a));
    if (L < 1e-6) throw new Error("Sıfır uzunlukta segment");
    const d = vnorm(vsub(it.b, it.a));
    // SolidWorks: profilin dikey ekseni (Y) eskiz düzlemi normali (3B'de dünya yukarısı); yatay ekseni X = Y × yol
    const x = profileX(it.n, d, f.ori !== 2);
    return { a: it.a, b: it.b, d, L, x };
  });
  // köşeler: tam iki çizginin buluştuğu uçlar
  const ext = items.map(() => [0, 0]);
  const kk = (p: Vec3) => p.map((v) => Math.round(v * 1000)).join(",");
  const joints = new Map<string, { i: number; end: 0 | 1 }[]>();
  items.forEach((it, i) => {
    if (it.k !== "l") return;
    ([it.a, it.b] as Vec3[]).forEach((p, e) => {
      const k = kk(p);
      if (!joints.has(k)) joints.set(k, []);
      joints.get(k)!.push({ i, end: e as 0 | 1 });
    });
  });
  type Tr = { V: Vec3; A: { i: number; end: 0 | 1 }; B: { i: number; end: 0 | 1 }; da: Vec3; db: Vec3 };
  const treat: Tr[] = [];
  if (f.corner !== "none")
    for (const list of joints.values()) {
      if (list.length !== 2) continue;
      const [A, B] = list;
      const la = lines[A.i], lb = lines[B.i];
      if (!la || !lb) continue;
      const V = A.end === 0 ? la.a : la.b;
      const da = A.end === 0 ? la.d : vmul(la.d, -1);
      const db = B.end === 0 ? lb.d : vmul(lb.d, -1);
      const cos = vdot(da, db);
      if (cos < -0.9999) continue; // düz devam
      const th = Math.acos(Math.max(-1, Math.min(1, cos)));
      const M = f.R * (1 + 1 / Math.tan(Math.max(th, 0.35) / 2)) + f.gap + 1;
      ext[A.i][A.end] = M;
      ext[B.i][B.end] = M;
      treat.push({ V, A, B, da, db });
    }
  // teğet zincirler: iki öğenin teğet buluştuğu uçlar birleştirilir
  const tanAt = (it: MemberItem, end: 0 | 1): Vec3 => {
    const P = end === 0 ? it.a : it.b;
    if (it.k === "l") return vnorm(vsub(end === 0 ? it.b : it.a, P));
    const c = circle3d(it.a, it.m, it.b)!;
    let t = vnorm(vcross(c.ax, vsub(P, c.c)));
    if (vdot(t, vsub(it.m, P)) < 0) t = vmul(t, -1);
    return t;
  };
  const parent = items.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const link: { i: number; end: 0 | 1; j: number; endj: 0 | 1 }[] = [];
  {
    const kj = (p: Vec3) => p.map((v) => Math.round(v * 1000)).join(",");
    const J = new Map<string, { i: number; end: 0 | 1 }[]>();
    items.forEach((it, i) => ([it.a, it.b] as Vec3[]).forEach((p, e) => {
      const k = kj(p);
      if (!J.has(k)) J.set(k, []);
      J.get(k)!.push({ i, end: e as 0 | 1 });
    }));
    for (const list of J.values()) {
      if (list.length !== 2) continue;
      const [A, B] = list;
      if (items[A.i].k === "l" && items[B.i].k === "l") continue;
      if (vdot(tanAt(items[A.i], A.end), tanAt(items[B.i], B.end)) > -0.999) continue;
      parent[find(A.i)] = find(B.i);
      link.push({ i: A.i, end: A.end, j: B.i, endj: B.end });
    }
  }
  const groups = new Map<number, number[]>();
  items.forEach((_, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(i);
  });
  const chained = new Set<number>();
  const solids: (Shape | null)[] = items.map(() => null);
  for (const g of groups.values()) {
    if (g.length < 2 && items[g[0]].k === "l") continue;
    g.forEach((i) => chained.add(i));
    // zinciri uçtan uca sırala
    const nb = (i: number) => link.filter((l) => l.i === i || l.j === i);
    let start = g.find((i) => nb(i).length < 2) ?? g[0];
    const order: { i: number; rev: boolean }[] = [];
    const used = new Set<number>();
    let cur = start;
    // başlangıç yönü: serbest uçtan başla
    const l0 = nb(start);
    let rev = l0.length === 1 ? (l0[0].i === start ? l0[0].end === 0 : l0[0].endj === 0) : false;
    while (cur !== undefined && !used.has(cur)) {
      used.add(cur);
      order.push({ i: cur, rev });
      const outEnd: 0 | 1 = rev ? 0 : 1;
      const nx = link.find((l) => (l.i === cur && l.end === outEnd && !used.has(l.j)) || (l.j === cur && l.endj === outEnd && !used.has(l.i)));
      if (!nx) break;
      const [ni, nend] = nx.i === cur ? [nx.j, nx.endj] : [nx.i, nx.end];
      cur = ni;
      rev = nend === 1;
    }
    const first = items[order[0].i];
    const P0 = order[0].rev ? first.b : first.a;
    const t0 = tanAt(first, order[0].rev ? 1 : 0);
    const fl = f.ori === 2 ? order.map((o) => items[o.i]).find((it) => it.k === "l") ?? first : first;
    const x = profileX(fl.n, t0, f.ori !== 2);
    const edges = order.map(({ i }) => {
      const it = items[i];
      return it.k === "l" ? makeLine(it.a, it.b) : makeThreePointArc(it.a, it.m, it.b);
    });
    const spine = assembleWire(edges);
    let len = 0;
    const path: Vec3[] = [];
    for (const { i, rev: rv } of order) {
      const it = items[i];
      const [A, B] = rv ? [it.b, it.a] : [it.a, it.b];
      if (it.k === "l") {
        len += vlen(vsub(B, A));
        path.push(A, B);
      } else {
        const c = circle3d(it.a, it.m, it.b)!;
        const ang = 2 * Math.asin(Math.min(1, vlen(vsub(it.b, it.a)) / (2 * c.r)));
        const big = vdot(vsub(it.m, vmul(vadd(it.a, it.b), 0.5)), vsub(c.c, vmul(vadd(it.a, it.b), 0.5))) >= 0;
        len += c.r * (big ? 2 * Math.PI - ang : ang);
        path.push(A, it.m, B);
      }
    }
    const lastIt = items[order[order.length - 1].i];
    const Pend = order[order.length - 1].rev ? lastIt.a : lastIt.b;
    const key = items[g[0]].key;
    memberReg.set(key, { key, name: f.name, a: P0, b: Pend, d: t0, x, loops: f.loops, R: f.R, arc: true, len, m: path[Math.floor(path.length / 2)], path });
    solids[g[0]] = sweepProfile(f.loops, new Plane(P0, x, t0), spine);
  }
  for (const tr of treat)
    if (chained.has(tr.A.i) || chained.has(tr.B.i)) {
      ext[tr.A.i][tr.A.end] = 0;
      ext[tr.B.i][tr.B.end] = 0;
    }
  items.forEach((it, i) => {
    if (chained.has(i)) return;
    const li = lines[i]!;
    const o = vsub(li.a, vmul(li.d, ext[i][0]));
    memberReg.set(it.key, { key: it.key, name: f.name, a: li.a, b: li.b, d: li.d, x: li.x, loops: f.loops, R: f.R, arc: false, len: li.L });
    solids[i] = profile(f.loops).sketchOnPlane(new Plane(o, li.x, li.d)).extrude(li.L + ext[i][0] + ext[i][1]);
  });
  for (const tr of treat) {
    const { V, A, B, da, db } = tr;
    if (chained.has(A.i) || chained.has(B.i) || !solids[A.i] || !solids[B.i]) continue;
    if (f.corner === "miter") {
      const nA = vnorm(vsub(da, db));
      solids[A.i] = solids[A.i]!.cut(halfSpace(vadd(V, vmul(nA, f.gap / 2)), nA));
      solids[B.i] = solids[B.i]!.cut(halfSpace(vsub(V, vmul(nA, f.gap / 2)), vmul(nA, -1)));
    } else {
      const [R, T] = f.corner === "butt1" ? [A, B] : [B, A];
      const dR = R === A ? da : db, dT = R === A ? db : da;
      const lt = lines[T.i]!, lr = lines[R.i]!;
      const sT = profileSupport(f.loops, lt.x, lt.d, vmul(dR, -1));
      const sR = profileSupport(f.loops, lr.x, lr.d, dT);
      solids[R.i] = solids[R.i]!.cut(halfSpace(vsub(V, vmul(dR, sT)), dR));
      // düz kesim: kesilen eleman, sürekli elemanın yüzeyinde biter
      solids[T.i] = keepFar(solids[T.i]!.cut(halfSpace(vadd(V, vmul(dT, sR + f.gap)), dT)), V, dT);
    }
  }
  return { keys: items.map((it) => it.key), solids, lines, chained, loops: f.loops, treated: new Set() };
}

const segDist = (p: Vec3, a: Vec3, b: Vec3) => {
  const ab = vsub(b, a);
  const t = Math.max(0, Math.min(1, vdot(vsub(p, a), ab) / (vdot(ab, ab) || 1)));
  return vlen(vsub(p, vadd(a, vmul(ab, t))));
};

/** Kayıtlı elemanları güncel gövdelerle eşleştirir: anahtar -> gövde sırası */
function memberBodyMap(): Map<string, number> {
  const cs = bodies.map((b) => centroid(b));
  const used = new Set<number>();
  const out = new Map<string, number>();
  for (const reg of memberReg.values()) {
    let best = -1, bd = Infinity;
    cs.forEach((c, i) => {
      if (used.has(i)) return;
      const d = reg.path ? Math.min(...reg.path.slice(1).map((q, k) => segDist(c, reg.path![k], q))) : reg.arc ? Math.min(segDist(c, reg.a, reg.m!), segDist(c, reg.m!, reg.b)) : segDist(c, reg.a, reg.b);
      if (d < bd) [bd, best] = [d, i];
    });
    const tol = reg.arc ? reg.R * 1.5 + reg.len * 0.2 : reg.R * 1.2 + 1;
    if (best >= 0 && bd < tol) {
      out.set(reg.key, best);
      used.add(best);
    }
  }
  return out;
}

/** Köşe kaynağı: iki düz yüz arasında üçgen kesitli dikiş; boru–levha için çevresel dikiş */
function weldTool(f: Extract<KFeature, { type: "weld" }>) {
  const z = f.a * Math.SQRT2; // bacak boyu
  let total = 0, count = 0, vol = 0;
  for (const pr of f.pairs) {
    const p1 = planarFace(pr.f1), p2 = planarFace(pr.f2);
    if (!p1 || !p2) throw new Error("Kaynak yüzü modelde bulunamadı");
    const t1 = String(p1.face.geomType), t2 = String(p2.face.geomType);
    if ((t1 === "CYLINDRE" && t2 === "PLANE") || (t1 === "PLANE" && t2 === "CYLINDRE")) {
      const [pc, pp] = t1 === "CYLINDRE" ? [p1, p2] : [p2, p1];
      const cy = cylinderParams(pc.face);
      if (Math.abs(Math.abs(vdot(cy.a, pp.n)) - 1) > 1e-3) throw new Error("Boru ekseni levhaya dik olmalı");
      const tt = vdot(vsub(pp.c, cy.L), pp.n) / vdot(cy.a, pp.n);
      const C = vadd(cy.L, vmul(cy.a, tt));
      // dış yüzey mi iç yüzey mi: silindir yüzü normali eksenden dışa bakıyorsa dış yüzey
      const pc0 = tup(pc.face.center);
      const radial = vnorm(vsub(vsub(pc0, cy.L), vmul(cy.a, vdot(vsub(pc0, cy.L), cy.a))));
      const outer = vdot(vnorm(tup(pc.face.normalAt(pc0))), radial) > 0;
      const R = cy.rho, s = outer ? 1 : -1;
      const ax = vmul(pp.n, 1);
      const xd = vnorm(Math.abs(ax[2]) < 0.9 ? vcross(ax, [0, 0, 1]) : vcross(ax, [1, 0, 0]));
      const prof = draw([R, 0]).lineTo([R + s * z, 0]).lineTo([R, z]).close();
      // profil düzlemi: x = radyal, y = levha normali (eksen boyunca, boruya doğru)
      const plane = new Plane(C, xd, vcross(xd, ax));
      const ring = (prof as any).sketchOnPlane(plane).revolve(ax, { origin: C, angle: 360 });
      welds.push(ring);
      total += 2 * Math.PI * R;
      count++;
      vol += volOf(ring);
      continue;
    }
    if (t1 !== "PLANE" || t2 !== "PLANE") throw new Error("Kaynak için iki düz yüz veya boru + düz yüz seçin");
    const n1 = p1.n, n2 = p2.n;
    const Lr = vcross(n1, n2);
    if (vlen(Lr) < 1e-6) throw new Error("Seçili yüzler paralel; kaynak için birbirine açılı yüzler seçin");
    const L = vnorm(Lr);
    const d1 = vdot(p1.c, n1), d2 = vdot(p2.c, n2);
    const det = vdot(n1, vcross(n2, L));
    const C0 = vmul(vadd(vmul(vcross(n2, L), d1), vmul(vcross(L, n1), d2)), 1 / det);
    // yüzlerin köşe çizgisi boyunca ortak aralığı
    const span = (fc: any) => {
      let lo = Infinity, hi = -Infinity;
      for (const e of fc.edges as any[])
        for (const q of [0, 0.5, 1]) {
          const t = vdot(vsub(tup(e.pointAt(q)), C0), L);
          lo = Math.min(lo, t);
          hi = Math.max(hi, t);
        }
      return [lo, hi];
    };
    const [a1, b1] = span(p1.face), [a2, b2] = span(p2.face);
    const lo = Math.max(a1, a2), hi = Math.min(b1, b2);
    if (hi - lo < 1e-3) throw new Error("Seçili yüzler köşe çizgisi boyunca örtüşmüyor");
    let u1 = vnorm(vcross(L, n1));
    if (vdot(u1, n2) < 0) u1 = vmul(u1, -1);
    let u2 = vnorm(vcross(L, n2));
    if (vdot(u2, n1) < 0) u2 = vmul(u2, -1);
    const y = vcross(L, u1);
    const P2: Vec2 = [vdot(u2, u1) * z, vdot(u2, y) * z];
    const runs: [number, number][] = [];
    if (f.intermittent) {
      const n = Math.max(1, Math.floor((hi - lo - f.len) / f.pitch) + 1);
      const used = (n - 1) * f.pitch + f.len;
      const st = lo + (hi - lo - used) / 2;
      for (let k = 0; k < n; k++) runs.push([st + k * f.pitch, Math.min(hi, st + k * f.pitch + f.len)]);
    } else runs.push([lo, hi]);
    for (const [r0, r1] of runs) {
      const bead = (draw([0, 0]).lineTo([z, 0]).lineTo(P2).close() as any).sketchOnPlane(new Plane(vadd(C0, vmul(L, r0)), u1, L)).extrude(r1 - r0);
      welds.push(bead);
      total += r1 - r0;
      count++;
      vol += volOf(bead);
    }
  }
  weldInfo.push({ name: `Köşe kaynağı a${fmt3(f.a)}${f.intermittent ? ` kesikli ${fmt3(f.len)}/${fmt3(f.pitch)}` : ""}`, a: f.a, length: total, count, vol });
}
const fmt3 = (v: number) => String(Math.round(v * 100) / 100);

function trimTool(f: Extract<KFeature, { type: "trim" }>) {
  const map = memberBodyMap();
  const bPairs = f.bounds.map((k) => ({ k, i: map.get(k) })).filter((x): x is { k: string; i: number } => x.i !== undefined);
  const bIdx = bPairs.map((x) => x.i);
  const planes = (f.faces ?? []).map((r) => {
    const pf = planarFace(r);
    if (!pf || String(pf.face.geomType) !== "PLANE") throw new Error("Sınır yüzü bulunamadı (düz bir yüz seçin)");
    return { c: pf.c, n: pf.n };
  });
  if (!bIdx.length && !planes.length) throw new Error("Sınır elemanı bulunamadı");
  const bR = Math.max(0, ...f.bounds.map((k) => memberReg.get(k)?.R ?? 0));
  for (const k of f.targets) {
    const reg = memberReg.get(k);
    const ti = map.get(k);
    if (!reg || ti === undefined) throw new Error("Kırpılacak eleman bulunamadı");
    if (bIdx.includes(ti)) continue;
    if (reg.arc) throw new Error("Yay elemanlar kırpılamıyor");
    let body = bodies[ti];
    let touched = false;
    for (const end of [0, 1] as const) {
      const P = end === 0 ? reg.a : reg.b;
      const dOut = end === 0 ? vmul(reg.d, -1) : reg.d;
      const v = makeVertex(P);
      const near = bPairs
        .map(({ k: bk, i }) => {
          const bs = bodies[i];
          try {
            return { bs, k: bk, dist: measureDistanceBetween(v, bs) };
          } catch {
            return { bs, k: bk, dist: Infinity };
          }
        })
        .filter((x) => x.dist < 3 * (reg.R + bR) && vdot(vsub(centroid(x.bs), P), dOut) > -(reg.R + bR));
      if (!near.length) continue;
      touched = true;
      const M = 4 * bR + 2 * reg.R + Math.max(...near.map((x) => x.dist)) + 5;
      const extPiece = profile(reg.loops).sketchOnPlane(new Plane(P, reg.x, reg.d)).extrude(end === 1 ? M : -M);
      body = body.fuse(extPiece);
      for (const { bs, k: bk } of near) {
        const br = memberReg.get(bk);
        if (f.coped || !br || br.arc) body = keepFar(body.cut(bs), P, vmul(dOut, -1));
        else {
          // düz kesim: sınır elemanın eksenine izdüşümden profil yüzeyine kadar
          const ab = vsub(br.b, br.a);
          const tq = vdot(vsub(P, br.a), ab) / (vdot(ab, ab) || 1);
          const Q = vadd(br.a, vmul(ab, tq));
          const inward = vmul(dOut, -1);
          const sB = profileSupport(br.loops, br.x, br.d, inward);
          const off = vdot(vsub(Q, P), inward) + sB;
          body = keepFar(body.cut(halfSpace(vadd(P, vmul(inward, off)), inward)), P, inward);
        }
      }
    }
    // düz yüz sınırları: elemanın yüze yakın ucu yüz düzlemine kadar uzatılır / kırpılır
    for (const pl of planes) {
      const da = vdot(vsub(reg.a, pl.c), pl.n), db = vdot(vsub(reg.b, pl.c), pl.n);
      const nearA = Math.abs(da) < Math.abs(db);
      const P = nearA ? reg.a : reg.b, other = nearA ? reg.b : reg.a;
      const dOut = nearA ? vmul(reg.d, -1) : reg.d;
      const cs = vdot(dOut, pl.n);
      if (Math.abs(cs) < 0.05) continue; // eleman yüze paralel
      const keep = Math.sign(vdot(vsub(other, pl.c), pl.n)) || 1;
      const dist = Math.abs(nearA ? da : db);
      const M = dist / Math.abs(cs) + 3 * reg.R + 5;
      body = body.fuse(profile(reg.loops).sketchOnPlane(new Plane(P, reg.x, reg.d)).extrude(nearA ? -M : M));
      body = keepFar(body.cut(halfSpace(pl.c, vmul(pl.n, keep))), P, vmul(dOut, -1));
      touched = true;
    }
    if (!touched) throw new Error("Hedef elemanın uçları sınır elemanlara yakın değil");
    bodies[ti] = body;
  }
}

function endCapTool(f: Extract<KFeature, { type: "endcap" }>) {
  for (const ref of f.faces) {
    const pf = planarFace(ref);
    if (!pf || String(pf.face.geomType) !== "PLANE") throw new Error("Uç kapağı için elemanın düz uç yüzünü seçin");
    // outerWire() kaynağı siler: her seferinde yüzün kopyasını kullan
    const ow = () => pf.face.clone().outerWire();
    const area0 = measureArea(makeFace(ow()));
    let capFace = makeFace(ow());
    if (f.inset > 0) {
      capFace = makeFace(ow().offset2D(-f.inset));
      if (measureArea(capFace) > area0) capFace = makeFace(ow().offset2D(f.inset));
    }
    const cap = basicFaceExtrusion(capFace, new Vector(vmul(pf.n, f.t)));
    applyTool(cap, false, false);
  }
}

function gussetTool(f: Extract<KFeature, { type: "gusset" }>) {
  const p1 = planarFace(f.f1), p2 = planarFace(f.f2);
  if (!p1 || !p2 || String(p1.face.geomType) !== "PLANE" || String(p2.face.geomType) !== "PLANE") throw new Error("Köşe takviyesi için iki düz yüz seçin");
  const n1 = p1.n, n2 = p2.n;
  const Lr = vcross(n1, n2);
  if (vlen(Lr) < 1e-6) throw new Error("Seçili yüzler paralel");
  const L = vnorm(Lr);
  const d1 = vdot(p1.c, n1), d2 = vdot(p2.c, n2);
  const s = (vdot(p1.c, L) + vdot(p2.c, L)) / 2 + f.offset;
  const det = vdot(n1, vcross(n2, L));
  const C = vmul(vadd(vadd(vmul(vcross(n2, L), d1), vmul(vcross(L, n1), d2)), vmul(vcross(n1, n2), s)), 1 / det);
  // bacaklar: her yüz boyunca, diğer yüzün baktığı (açık) tarafa
  let u1 = vnorm(vcross(L, n1));
  if (vdot(u1, n2) < 0) u1 = vmul(u1, -1);
  let u2 = vnorm(vcross(L, n2));
  if (vdot(u2, n1) < 0) u2 = vmul(u2, -1);
  const y = vcross(L, u1);
  const P1: Vec2 = [f.d1, 0];
  const P2: Vec2 = [vdot(u2, u1) * f.d2, vdot(u2, y) * f.d2];
  const c = Math.max(0, f.chamfer);
  let pen: any;
  if (c > 1e-6) {
    const k = c / f.d2;
    pen = draw([c, 0]).lineTo(P1).lineTo(P2).lineTo([P2[0] * k, P2[1] * k]);
  } else pen = draw([0, 0]).lineTo(P1).lineTo(P2);
  const plate = pen.close().sketchOnPlane(new Plane(vsub(C, vmul(L, f.t / 2)), u1, L)).extrude(f.t);
  applyTool(plate, false, false);
}

function cutList(id: number) {
  const items: CutItem[] = [];
  try {
    const map = memberBodyMap();
    const inv = new Map<number, string>();
    map.forEach((b, k) => inv.set(b, k));
    bodies.forEach((b, i) => {
      const vol = volOf(b);
      const bb = b.boundingBox.bounds as [Vec3, Vec3];
      const key = inv.get(i);
      const faces = b.faces as any[];
      if (key) {
        const reg = memberReg.get(key)!;
        if (reg.arc) {
          items.push({ body: i, kind: "member", name: reg.name + " (bükümlü)", length: reg.len, a1: 0, a2: 0, vol, dims: [0, 0, 0], key });
          return;
        }
        let lo = Infinity, hi = -Infinity;
        for (const e of b.edges as any[])
          for (const q of [0, 0.5, 1]) {
            const t = vdot(vsub(tup(e.pointAt(q)), reg.a), reg.d);
            lo = Math.min(lo, t);
            hi = Math.max(hi, t);
          }
        let a1 = 0, a2 = 0;
        for (const fc of faces) {
          if (String(fc.geomType) !== "PLANE") continue;
          const c = tup(fc.center);
          const n = vnorm(tup(fc.normalAt(c)));
          const k = Math.abs(vdot(n, reg.d));
          if (k < 0.01) continue;
          const ang = (Math.acos(Math.min(1, k)) * 180) / Math.PI;
          const t = vdot(vsub(c, reg.a), reg.d);
          if (t - lo < (hi - lo) / 2) a1 = Math.max(a1, ang);
          else a2 = Math.max(a2, ang);
        }
        items.push({ body: i, kind: "member", name: reg.name, length: hi - lo, a1, a2, vol, dims: [0, 0, 0], key });
        return;
      }
      // levha / parça
      let big: any = null, ba = 0;
      for (const fc of faces) {
        if (String(fc.geomType) !== "PLANE") continue;
        const ar = measureArea(fc);
        if (ar > ba) [ba, big] = [ar, fc];
      }
      if (big) {
        const t = vol / ba;
        const c = tup(big.center);
        const n = vnorm(tup(big.normalAt(c)));
        let ux: Vec3 | null = null, lm = 0;
        for (const e of big.edges as any[]) {
          if (String(e.geomType) !== "LINE") continue;
          const dv = vsub(tup(e.endPoint), tup(e.startPoint));
          if (vlen(dv) > lm) [lm, ux] = [vlen(dv), vnorm(dv)];
        }
        if (!ux) ux = vnorm(Math.abs(n[2]) < 0.9 ? vcross(n, [0, 0, 1]) : vcross(n, [1, 0, 0]));
        const uy = vcross(n, ux);
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const e of b.edges as any[])
          for (const q of [0, 0.25, 0.5, 0.75, 1]) {
            const p = vsub(tup(e.pointAt(q)), c);
            x0 = Math.min(x0, vdot(p, ux)); x1 = Math.max(x1, vdot(p, ux));
            y0 = Math.min(y0, vdot(p, uy)); y1 = Math.max(y1, vdot(p, uy));
          }
        const w = x1 - x0, h = y1 - y0;
        if (t > 0 && t < 0.25 * Math.min(w, h) + 1e-9) {
          const dims = [w, h, t].sort((p, q) => q - p) as [number, number, number];
          items.push({ body: i, kind: "plate", name: `Levha t=${Math.round(t * 100) / 100}`, length: dims[0], a1: 0, a2: 0, vol, dims });
          return;
        }
      }
      const dims = [bb[1][0] - bb[0][0], bb[1][1] - bb[0][1], bb[1][2] - bb[0][2]].sort((p, q) => q - p) as [number, number, number];
      items.push({ body: i, kind: "part", name: "Parça", length: dims[0], a1: 0, a2: 0, vol, dims });
    });
  } catch (e) {
    console.warn(e);
  }
  post({ id, type: "cutlist", items, welds: weldInfo });
}

// ---------- İmalat resmi ----------

/** Gövdenin dir yönünde bakılan görünüşü; yatay eksen xAxis */
function projectView(shape: Shape, name: string, origin: Vec3, dir: Vec3, xAxis: Vec3): DrawView {
  const cam = new ProjectionCamera(origin, dir, xAxis);
  const { visible, hidden } = makeProjectedEdges(shape, cam, true);
  const v: DrawView = { name, vis: [], hid: [], circles: [], min: [Infinity, Infinity], max: [-Infinity, -Infinity] };
  const grow = (x: number, y: number) => {
    v.min = [Math.min(v.min[0], x), Math.min(v.min[1], y)];
    v.max = [Math.max(v.max[0], x), Math.max(v.max[1], y)];
  };
  const add = (edges: any[], arr: number[], hid: boolean) => {
    for (const e of edges) {
      const t = String(e.geomType);
      const P = (q: number) => tup(e.pointAt(q));
      if (t === "LINE") {
        const a = tup(e.startPoint), b = tup(e.endPoint);
        arr.push(a[0], a[1], b[0], b[1]);
        grow(a[0], a[1]);
        grow(b[0], b[1]);
        continue;
      }
      if (t === "CIRCLE") {
        const a = tup(e.startPoint), b = tup(e.endPoint);
        if (vlen(vsub(a, b)) < 1e-6) {
          const c = circle3d(P(0), P(1 / 3), P(2 / 3));
          if (c) {
            v.circles.push({ c: [c.c[0], c.c[1]], r: c.r, hidden: hid });
            grow(c.c[0] - c.r, c.c[1] - c.r);
            grow(c.c[0] + c.r, c.c[1] + c.r);
            continue;
          }
        }
      }
      const n = t === "CIRCLE" ? 16 : 24;
      let prev = P(0);
      grow(prev[0], prev[1]);
      for (let k = 1; k <= n; k++) {
        const cur = P(k / n);
        arr.push(prev[0], prev[1], cur[0], cur[1]);
        grow(cur[0], cur[1]);
        prev = cur;
      }
    }
  };
  add(visible, v.vis, false);
  add(hidden, v.hid, true);
  return v;
}

function drawingData(id: number, bi: number) {
  const out: DrawData = { kind: "part", views: [], holes: [], length: 0, a1: 0, a2: 0 };
  try {
    const b = bodies[bi];
    if (!b) throw new Error("Gövde bulunamadı");
    const map = memberBodyMap();
    const key = [...map].find(([, i]) => i === bi)?.[0];
    const reg = key ? memberReg.get(key) : undefined;
    const cyls = (b.faces as any[]).filter((fc) => String(fc.geomType) === "CYLINDRE").map((fc) => ({ fc, ...cylinderParams(fc) }));
    if (reg && !reg.arc) {
      out.kind = "member";
      const d = reg.d, x = reg.x, y = vcross(d, x);
      // gövdenin eksen boyunca başlangıcı
      let lo = Infinity, hi = -Infinity;
      for (const e of b.edges as any[])
        for (const q of [0, 0.5, 1]) {
          const t = vdot(vsub(tup(e.pointAt(q)), reg.a), d);
          lo = Math.min(lo, t);
          hi = Math.max(hi, t);
        }
      const O = vadd(reg.a, vmul(d, lo));
      out.length = hi - lo;
      out.views.push(projectView(b, "Önden", O, vmul(x, -1), d));
      out.views.push(projectView(b, "Üstten", O, y, d));
      out.views.push(projectView(b, "Yandan (kesit)", O, d, x));
      // delikler: eksene dik silindirik yüzler (profil dış yüzeyi hariç)
      for (const c of cyls) {
        if (Math.abs(vdot(c.a, d)) > 1e-3 || c.rho > reg.R * 0.95) continue;
        const ax = Math.abs(vdot(c.a, x)) > 0.999 ? 0 : Math.abs(vdot(c.a, y)) > 0.999 ? 1 : -1;
        if (ax < 0) continue;
        const rel = vsub(c.L, O);
        const pos: Vec2 = ax === 0 ? [vdot(rel, d), vdot(rel, y)] : [vdot(rel, d), vdot(rel, x)];
        if (!out.holes.some((hh) => hh.view === ax && Math.hypot(hh.c[0] - pos[0], hh.c[1] - pos[1]) < 1e-3 && Math.abs(hh.d - 2 * c.rho) < 1e-3))
          out.holes.push({ view: ax, c: pos, d: 2 * c.rho });
      }
    } else {
      // levha: en büyük düz yüz
      let big: any = null, ba = 0;
      for (const fc of b.faces as any[]) {
        if (String(fc.geomType) !== "PLANE") continue;
        const ar = measureArea(fc);
        if (ar > ba) [ba, big] = [ar, fc];
      }
      const vol = volOf(b);
      const bb = b.boundingBox.bounds as [Vec3, Vec3];
      if (big && !reg) {
        const c = tup(big.center);
        const n = vnorm(tup(big.normalAt(c)));
        let ux: Vec3 | null = null, lm = 0;
        for (const e of big.edges as any[]) {
          if (String(e.geomType) !== "LINE") continue;
          const dv = vsub(tup(e.endPoint), tup(e.startPoint));
          if (vlen(dv) > lm) [lm, ux] = [vlen(dv), vnorm(dv)];
        }
        if (!ux) ux = vnorm(Math.abs(n[2]) < 0.9 ? vcross(n, [0, 0, 1]) : vcross(n, [1, 0, 0]));
        const uy = vcross(n, ux);
        const t = vol / ba;
        const isPlate = t < 0.25 * Math.sqrt(ba);
        out.kind = isPlate ? "plate" : "part";
        out.t = isPlate ? t : undefined;
        out.views.push(projectView(b, "Önden", c, n, ux));
        out.views.push(projectView(b, isPlate ? "Kenar" : "Üstten", c, vmul(uy, -1), ux));
        if (!isPlate) out.views.push(projectView(b, "Yandan", c, ux, vmul(uy, -1)));
        for (const cy of cyls) {
          if (Math.abs(Math.abs(vdot(cy.a, n)) - 1) > 1e-3) continue;
          const rel = vsub(cy.L, c);
          const pos: Vec2 = [vdot(rel, ux), vdot(rel, uy)];
          if (!out.holes.some((hh) => Math.hypot(hh.c[0] - pos[0], hh.c[1] - pos[1]) < 1e-3 && Math.abs(hh.d - 2 * cy.rho) < 1e-3)) out.holes.push({ view: 0, c: pos, d: 2 * cy.rho });
        }
      } else {
        // genel parça (ör. bükümlü boru): standart görünüşler
        const c = vmul(vadd(bb[0], bb[1]), 0.5);
        out.views.push(projectView(b, "Önden", c, [0, 0, 1], [1, 0, 0]));
        out.views.push(projectView(b, "Üstten", c, [0, 1, 0], [1, 0, 0]));
        out.views.push(projectView(b, "Sağdan", c, [1, 0, 0], [0, 0, -1]));
        if (reg) out.length = reg.len;
      }
    }
    post({ id, type: "drawing", ...out });
  } catch (e) {
    post({ id, type: "drawing", ...out, error: errMsg(e) });
  }
}

function exportBody(id: number, i: number) {
  const b = bodies[i];
  if (!b) return post({ id, type: "exported", blob: null, message: "Gövde bulunamadı" });
  try {
    post({ id, type: "exported", blob: b.blobSTEP() });
  } catch (e) {
    post({ id, type: "exported", blob: null, message: errMsg(e) });
  }
}

// ---------- Sac metal ----------

/** Yerel eksenlerde kutu: x = s yönü [sa,sb], y = u yönü [wa,wb], e yönünde [za,zb] (O başlangıç) */
function boxIn(O: Vec3, s: Vec3, u: Vec3, e: Vec3, sa: number, sb: number, wa: number, wb: number, za: number, zb: number): Shape {
  const pn = vcross(s, u);
  const sign = vdot(pn, e) > 0 ? 1 : -1;
  const pl = new Plane(vadd(O, vmul(e, za)), s, pn);
  return (draw([sa, wa]).lineTo([sb, wa]).lineTo([sb, wb]).lineTo([sa, wb]).close() as any).sketchOnPlane(pl).extrude(sign * (zb - za));
}

const volOf = (s: Shape) => {
  try {
    return measureShapeVolumeProperties(s).volume;
  } catch {
    return 0;
  }
};

function sheetBaseTool(f: Extract<KFeature, { type: "sheetbase" }>): Shape {
  const frame = resolvePlane(f.pl);
  if (!f.open) return profile(f.loops).sketchOnPlane(makePlane(frame)).extrude((f.rev ? -1 : 1) * f.t);
  if (f.mid) return profile(f.loops).sketchOnPlane(makePlane(frame, -f.d / 2)).extrude(f.d);
  return profile(f.loops).sketchOnPlane(makePlane(frame)).extrude(f.d);
}

interface FlangeEdge { bi: number; A: Vec3; e: Vec3; Le: number; nF: Vec3; s: Vec3 }

/** Seçili kenarın sac bilgisi: büyük yüz normali nF ve kalınlık yüzünün dış normali s */
function flangeEdgeInfo(ref: EdgeRef, t: number): FlangeEdge {
  const h = [...matchEdges([ref])][0];
  if (h === undefined) throw new Error("Seçili kenar modelde bulunamadı");
  const bi = bodies.findIndex((b) => (b.edges as any[]).some((x) => x.hashCode === h));
  const E = (bodies[bi].edges as any[]).find((x) => x.hashCode === h);
  if (String(E.geomType) !== "LINE") throw new Error("Flanş için düz bir kenar seçin");
  const A = tup(E.startPoint), B = tup(E.endPoint);
  const e = vnorm(vsub(B, A)), Le = vlen(vsub(B, A));
  const mid = vmul(vadd(A, B), 0.5);
  const fs = facesOfEdge(bodies[bi], h).filter((f) => String(f.geomType) === "PLANE");
  if (fs.length !== 2) throw new Error("Kenar iki düz yüz arasında olmalı (sacın dış kenarı)");
  const ns = fs.map((f) => vnorm(tup(f.normalAt(mid))));
  // Doğru eşleşmede büyük yüzün t kadar karşısında, kenarın hemen yanında paralel bir karşı yüz vardır
  const valid = (iF: number) => {
    const nF = ns[iF], sN = ns[1 - iF];
    const p = vsub(vsub(mid, vmul(nF, t)), vmul(sN, Math.min(0.05, t / 4)));
    const v = makeVertex(p);
    return (bodies[bi].faces as any[]).some((fc) => {
      if (String(fc.geomType) !== "PLANE") return false;
      try {
        if (vdot(vnorm(tup(fc.normalAt(p))), nF) > -0.999) return false;
        return measureDistanceBetween(fc, v) < 1e-4;
      } catch {
        return false;
      }
    });
  };
  const ok = [0, 1].filter(valid);
  if (!ok.length) throw new Error("Seçili kenar sacın dış kenarı değil (kalınlık yüzü bulunamadı)");
  const iF = ok.length === 1 ? ok[0] : 0;
  const info = [{ n: ns[1 - iF] }, { n: ns[iF] }];
  return { bi, A, e, Le, nF: info[1].n, s: info[0].n };
}

function edgeFlange(f: Extract<KFeature, { type: "edgeflange" }>) {
  if (!bodies.length) throw new Error("Önce bir taban flanş oluşturun");
  const t = f.t, r = Math.max(0.01, f.r);
  const th = (f.angle * Math.PI) / 180;
  const shift = f.pos === "bendout" ? 0 : f.pos === "outside" ? -r : -(r + t);
  let Lf = f.L;
  if (f.lenRef !== "tangent") {
    const R = f.lenRef === "outer" ? r + t : r;
    Lf = f.L - (f.angle <= 90 ? R * Math.tan(th / 2) : R);
  }
  if (Lf < -1e-9) throw new Error("Flanş uzunluğu büküm için çok kısa");
  Lf = Math.max(0, Lf);
  const infos = f.edges.map((ref) => flangeEdgeInfo(ref, t));
  const big = bodySize();
  const ops: { bi: number; cut: Shape[]; add: Shape }[] = [];
  infos.forEach((g, idx) => {
    const u = f.flip ? vmul(g.nF, -1) : g.nF;
    const O = f.flip ? vsub(g.A, vmul(g.nF, t)) : g.A;
    const z0 = f.o1, z1 = g.Le - f.o2;
    if (z1 - z0 < 1e-3) throw new Error("Kısaltmalar kenar uzunluğundan büyük");
    const pn = vcross(g.s, u);
    const sign = vdot(pn, g.e) > 0 ? 1 : -1;
    const pl = new Plane(vadd(O, vmul(g.e, z0)), g.s, pn);
    const P = (rad: number, phi: number): Vec2 => [shift + rad * Math.sin(phi), r - rad * Math.cos(phi)];
    const T: Vec2 = [Math.cos(th), Math.sin(th)];
    const Ai1 = P(r, th), Ao1 = P(r + t, th);
    let pen: any = draw([shift, -t]).lineTo([shift, 0]).threePointsArcTo(Ai1, P(r, th / 2));
    if (Lf > 1e-6) pen = pen.lineTo([Ai1[0] + T[0] * Lf, Ai1[1] + T[1] * Lf]).lineTo([Ao1[0] + T[0] * Lf, Ao1[1] + T[1] * Lf]).lineTo(Ao1);
    else pen = pen.lineTo(Ao1);
    let flange: Shape = pen.threePointsArcTo([shift, -t], P(r + t, th / 2)).close().sketchOnPlane(pl).extrude(sign * (z1 - z0));
    // birlikte seçilen komşu kenarlar: dışbükey köşede gönye
    infos.forEach((h, jdx) => {
      if (jdx === idx || h.bi !== g.bi || vdot(g.nF, h.nF) < 0.999) return;
      const gE = [g.A, vadd(g.A, vmul(g.e, g.Le))], hE = [h.A, vadd(h.A, vmul(h.e, h.Le))];
      for (const V of gE)
        for (const W of hE) {
          if (vlen(vsub(V, W)) > 1e-3) continue;
          const dh = vlen(vsub(hE[0], W)) < 1e-6 ? h.e : vmul(h.e, -1);
          if (vdot(dh, g.s) > -1e-6) continue; // içbükey köşe
          const nm = vnorm(vsub(g.s, h.s));
          flange = flange.cut(boxIn(vadd(V, vmul(nm, f.gap / 2)), nm, u, vcross(nm, u), -big, 0, -big, big, -big, big));
          // köşe boşaltması (SolidWorks dikdörtgen köşe boşaltması): iki büküm bölgesinin köşede üst üste
          // geldiği kareyi kaldır; böylece açınımda bükümler birbirine geçmez (malzeme içte/dışta/büküm dışı hepsinde)
          const Q = vadd(V, vmul(vadd(g.s, h.s), shift));
          const w = r + t + f.gap;
          flange = flange.cut(boxIn(Q, g.s, h.s, u, -0.01, w, -0.01, w, -t - 0.01, r + 0.001));
        }
    });
    const cuts: Shape[] = [];
    if (shift < 0) {
      cuts.push(boxIn(O, g.s, u, g.e, shift, 0.01, -t - 0.01, 0.01, z0, z1));
      const rr = f.relief * t;
      if (rr > 0) {
        if (z0 > 1e-6) cuts.push(boxIn(O, g.s, u, g.e, shift - rr, 0.01, -t - 0.01, 0.01, Math.max(0, z0 - rr), z0));
        if (g.Le - z1 > 1e-6) cuts.push(boxIn(O, g.s, u, g.e, shift - rr, 0.01, -t - 0.01, 0.01, z1, Math.min(g.Le, z1 + rr)));
      }
    }
    ops.push({ bi: g.bi, cut: cuts, add: flange });
  });
  const res = new Map<number, Shape>();
  for (const op of ops) {
    let b = res.get(op.bi) ?? bodies[op.bi];
    for (const c of op.cut) b = b.cut(c);
    res.set(op.bi, b);
  }
  for (const op of ops) res.set(op.bi, res.get(op.bi).fuse(op.add));
  const out: Shape[] = [];
  bodies.forEach((b, i) => out.push(...(res.has(i) ? solidsOf(res.get(i)) : [b])));
  bodies = out;
}

function sketchBend(f: Extract<KFeature, { type: "sketchbend" }>) {
  if (!bodies.length) throw new Error("Önce bir taban flanş oluşturun");
  const frame = resolvePlane(f.pl);
  const P0 = toWorld(frame, f.line[0]), Q0 = toWorld(frame, f.line[1]);
  const e = vnorm(vsub(Q0, P0));
  const nF = frame.n;
  const hs = f.pl.face ? matchFaces([f.pl.face]) : new Set<number>();
  let bi = bodies.findIndex((b) => (b.faces as any[]).some((x) => hs.has(x.hashCode)));
  if (bi < 0) bi = 0;
  const body = bodies[bi];
  const t = f.t, r = Math.max(0.01, f.r), th = (f.angle * Math.PI) / 180;
  const BA = th * (r + f.k * t);
  const left = vcross(nF, e);
  const m = f.side ? left : vmul(left, -1);
  const u = f.flip ? vmul(nF, -1) : nF;
  const O = f.flip ? vsub(P0, vmul(nF, t)) : P0;
  const s0 = f.pos === "center" ? -BA / 2 : f.pos === "inside" ? -(r + t) : -r;
  const big = bodySize();
  const zz = vcross(m, u);
  const A = body.intersect(boxIn(O, m, u, zz, -big, s0, -big, big, -big, big));
  const S = body.intersect(boxIn(O, m, u, zz, s0, s0 + BA, -big, big, -big, big));
  const B = body.intersect(boxIn(O, m, u, zz, s0 + BA, big, -big, big, -big, big));
  if (volOf(S) < 1e-9) throw new Error("Büküm çizgisi sacın üzerinde değil");
  if (volOf(B) < 1e-9 || volOf(A) < 1e-9) throw new Error("Büküm çizgisinin bir tarafında malzeme yok");
  let lo = Infinity, hi = -Infinity;
  for (const ed of S.edges as any[])
    for (const p of [tup(ed.startPoint), tup(ed.endPoint)]) {
      const d = vdot(vsub(p, O), zz);
      lo = Math.min(lo, d);
      hi = Math.max(hi, d);
    }
  const P = (rad: number, phi: number): Vec2 => [s0 + rad * Math.sin(phi), r - rad * Math.cos(phi)];
  const ring = (draw([s0, -t]).lineTo([s0, 0]).threePointsArcTo(P(r, th), P(r, th / 2)).lineTo(P(r + t, th)).threePointsArcTo([s0, -t], P(r + t, th / 2)).close() as any)
    .sketchOnPlane(new Plane(vadd(O, vmul(zz, lo)), m, zz))
    .extrude(hi - lo);
  const C3 = vadd(vadd(O, vmul(m, s0)), vmul(u, r));
  const moved = B.translate(vmul(m, -BA)).rotate(f.angle, C3, zz);
  bodies[bi] = A.fuse(ring).fuse(moved);
  bodies = bodies.flatMap(solidsOf);
}

function flatPattern(id: number, bodyIdx: number, t: number, k: number) {
  try {
    if (!bodies.length) throw new Error("Açılacak sac yok");
    const b = bodies[Math.max(0, Math.min(bodyIdx, bodies.length - 1))];
    const u = unfold(b, t, k);
    const solid = profile(u.loops).sketchOnPlane(makePlane(u.frame)).extrude(-t);
    const mesh = toMesh(solid);
    const sh = (p: Vec2): Vec2 => [p[0] - u.min[0], p[1] - u.min[1]];
    const outline = u.outline.map((o) => (o.k === "l" ? { ...o, a: sh(o.a), b: sh(o.b) } : { ...o, c: sh(o.c) }));
    const lift = vmul(u.frame.n, 0.05);
    const bends = u.bends.map((x) => ({ ...x, a: sh(x.a), b: sh(x.b), a3: vadd(x.a3, lift), b3: vadd(x.b3, lift) }));
    post({ id, type: "flat", mesh, outline, bends, w: u.max[0] - u.min[0], h: u.max[1] - u.min[1], area: u.area }, [
      mesh.vertices.buffer, mesh.normals.buffer, mesh.triangles.buffer, mesh.lines.buffer, mesh.faceGroups.buffer, mesh.edgeGroups.buffer,
    ]);
  } catch (e) {
    post({ id, type: "flat", mesh: null, outline: [], bends: [], w: 0, h: 0, area: 0, error: errMsg(e) });
  }
}

async function buildFeature(f: KFeature) {
  switch (f.type) {
    case "sheetjog":
      return sheetJog(f);
    case "miterflange":
      return miterFlange(f);
    case "closecorner":
      return closeCorner(f);
    case "tosheet":
      return toSheet(f);
    case "combine":
      return combineTool(f);
    case "splitbody":
      return splitBodyTool(f);
    case "movebody":
      return moveBodyTool(f);
    case "delbody":
      return delBodyTool(f);
    case "indent":
      return indentTool(f);
    case "spattern": {
      const items = toolItems(f.feats);
      for (const it of items) {
        const c = centroid(it.solid);
        const offs = f.pts.map((p) => {
          const d = vsub(p, c);
          return vsub(d, vmul(f.n, vdot(d, f.n)));
        }).filter((o) => vlen(o) > 1e-6);
        patternAt([it], offs);
      }
      return;
    }
    case "tpattern":
      return patternAt(toolItems(f.feats), f.rows.filter((r) => vlen(r) > 1e-9));
    case "cvpattern":
      return curvePattern(f);
    case "fpattern":
      return fillPattern(f);
    case "thread":
      return threadTool(f);
    case "flex":
      return flexTool(f);
    case "vchamfer":
      return vertexChamferTool(f);
    case "member":
      memberTool(f);
      return;
    case "trim":
      trimTool(f);
      return;
    case "weld":
      weldTool(f);
      return;
    case "endcap":
      endCapTool(f);
      return;
    case "gusset":
      gussetTool(f);
      return;
    case "sheetbase": {
      const solid = sheetBaseTool(f);
      tools.set(f.id, { solid, cut: false, merge: f.merge !== false });
      applyTool(solid, false, f.merge !== false);
      return;
    }
    case "edgeflange":
      edgeFlange(f);
      return;
    case "sketchbend":
      sketchBend(f);
      return;
    case "extrude":
    case "revolve":
    case "sweep":
    case "loft": {
      if ((f.type === "extrude" && f.texts?.length) || false) await ensureFont();
      let solid = f.type === "extrude" ? extrudeTool(f) : f.type === "revolve" ? revolveTool(f) : f.type === "sweep" ? sweepTool(f) : loftTool(f);
      if (f.type === "loft" && f.sheetT && f.sheetT > 0) {
        // sac geçiş parçası: profil düzlemlerindeki uç yüzleri açık, sabit kalınlıklı cidar
        const frames = f.profiles.map((p) => resolvePlane(p.pl));
        const onEnd = (fc: any) => {
          const c = fc.center, n = fc.normalAt();
          return frames.some((fr) => Math.abs(vdot(vsub([c.x, c.y, c.z], fr.o), fr.n)) < 1e-3 && Math.abs(Math.abs(n.x * fr.n[0] + n.y * fr.n[1] + n.z * fr.n[2]) - 1) < 1e-4);
        };
        solid = solid.shell(f.sheetT, (ff: any) => ff.when(({ element }: any) => onEnd(element)));
      }
      const merge = (f as any).merge !== false;
      tools.set(f.id, { solid, cut: f.cut, merge });
      applyTool(solid, f.cut, merge);
      return;
    }
    case "rib": {
      const solid = ribTool(f);
      tools.set(f.id, { solid, cut: false, merge: true });
      applyTool(solid, false);
      return;
    }
    case "hole": {
      if (!bodies.length) throw new Error("Delik için önce bir katı oluşturun");
      const solid = holeTool(f);
      tools.set(f.id, { solid, cut: true, merge: true });
      applyTool(solid, true);
      return;
    }
    case "dome": {
      const solid = domeTool(f);
      applyTool(solid, false);
      return;
    }
    case "wrap": {
      if (f.texts?.length) await ensureFont();
      const { solid, cut } = wrapTool(f);
      applyTool(solid, cut);
      return;
    }
    case "import": {
      const shape = await importSTEP(new Blob([f.data], { type: "application/step" }));
      const parts = solidsOf(shape);
      if (!parts.length) throw new Error("STEP dosyasında katı bulunamadı");
      parts.forEach((p) => applyTool(p, false, false));
      return;
    }
    case "scale": {
      if (!bodies.length) throw new Error("Ölçeklenecek katı yok");
      const c: Vec3 = f.center === "origin" ? [0, 0, 0] : (measureShapeVolumeProperties(all()).centerOfMass as Vec3);
      bodies = bodies.map((b) => b.scale(f.factor, c));
      return;
    }
    case "fillet":
    case "chamfer": {
      if (!bodies.length) throw new Error("Önce bir katı oluşturun");
      if (f.type === "fillet" && f.kind === "full") {
        const { edges, r } = fullRoundEdges(matchFaces(f.faces ?? []));
        onOwner(edges, "edges", (b) => b.fillet((e: any) => (edges.has(e.hashCode) ? r : null)));
        return;
      }
      const set = matchEdges(f.edges);
      if (f.faces?.length) edgesOfFaces(matchFaces(f.faces)).forEach((h) => set.add(h));
      if (!set.size) throw new Error("Seçili kenarlar modelde bulunamadı");
      const v = f.type === "fillet" ? f.r : f.d;
      if (!(v > 0)) throw new Error("Değer sıfırdan büyük olmalı");
      if (f.type === "fillet") {
        const rad = f.kind === "var" ? ([f.r, f.r2 ?? f.r] as [number, number]) : f.r;
        // SolidWorks çoklu yarıçap: kenar başına farklı yarıçap
        const per = new Map<number, number>();
        if (f.radii?.length && f.kind !== "var")
          f.edges.forEach((ref, i) => {
            const rr = f.radii![i];
            if (rr > 0) matchEdges([ref]).forEach((hh) => per.set(hh, rr));
          });
        const simple = typeof rad === "number" && !per.size && !f.faces?.length;
        const hist = filletHist;
        try {
          onOwner(set, "edges", (b) => {
            const before = simple ? b.clone() : null;
            const out = b.fillet((e: any) => (set.has(e.hashCode) ? per.get(e.hashCode) ?? rad : null));
            filletHist = before ? { before, after: out, refs: f.edges, rad: rad as number } : null;
            return out;
          });
        } catch (err) {
          // SolidWorks'te çalışan durum: önceki radyüse değen kenarlar (ör. üst kenarlar sonra düşey kenarlar, R2 ≥ R1).
          // OCC bunu tek başına yapamıyor → önceki radyüsten önceki gövdeye dön, önce bu kenarları sonra öncekileri radyüsle.
          if (!simple || !hist || !bodies.includes(hist.after)) throw err;
          const cur = (hist.after.edges as any[]).filter((e) => set.has(e.hashCode)).map((e) => {
            const A = tup(e.pointAt(0)), B = tup(e.pointAt(1));
            return { A, d: vnorm(vsub(B, A)) };
          });
          const S0 = hist.before.clone();
          const on = (q: Vec3, A: Vec3, d: Vec3) => vlen(vsub(vsub(q, A), vmul(d, vdot(vsub(q, A), d)))) < 1e-3;
          const set0 = new Set<number>();
          for (const e of S0.edges as any[]) {
            if (String(e.geomType) !== "LINE") continue;
            const P = tup(e.pointAt(0.5)), D = vnorm(vsub(tup(e.pointAt(1)), tup(e.pointAt(0))));
            if (cur.some((c) => Math.abs(Math.abs(vdot(c.d, D)) - 1) < 1e-6 && on(P, c.A, c.d))) set0.add(e.hashCode);
          }
          if (set0.size !== set.size) throw err;
          const s1 = S0.fillet((e: any) => (set0.has(e.hashCode) ? (rad as number) : null));
          const prev = new Set<number>();
          for (const r of hist.refs) {
            let bh = -1, bd = 2;
            for (const e of s1.edges as any[]) {
              const dd = vlen(vsub(tup(e.pointAt(0.5)), r.m));
              if (dd < bd) [bd, bh] = [dd, e.hashCode];
            }
            if (bh >= 0) prev.add(bh);
          }
          if (prev.size !== hist.refs.length) throw err;
          const s2 = s1.fillet((e: any) => (prev.has(e.hashCode) ? hist.rad : null));
          bodies = bodies.map((x) => (x === hist.after ? s2 : x));
          filletHist = null;
        }
      } else {
        const kind = f.kind ?? "equal";
        onOwner(set, "edges", (b) =>
          b.chamfer((e: any) => {
            if (!set.has(e.hashCode)) return null;
            if (kind === "equal") return f.d;
            const faces = facesOfEdge(b, e.hashCode);
            const ref = faces[f.flip ? 1 : 0] ?? faces[0];
            const sel = (ff: any) => ff.when(({ element }: any) => element.hashCode === ref.hashCode);
            return kind === "dd" ? { distances: [f.d, f.d2 ?? f.d], selectedFace: sel } : { distance: f.d, angle: f.angle ?? 45, selectedFace: sel };
          }),
        );
      }
      return;
    }
    case "shell": {
      if (!bodies.length) throw new Error("Önce bir katı oluşturun");
      const set = matchFaces(f.faces);
      if (!set.size) throw new Error("Kaldırılacak yüz seçin");
      onOwner(set, "faces", (b) => b.shell((f.out ? -1 : 1) * Math.abs(f.t), (ff: any) => ff.when(({ element }: any) => set.has(element.hashCode))));
      return;
    }
    case "draft": {
      if (!bodies.length) throw new Error("Önce bir katı oluşturun");
      const set = matchFaces(f.faces);
      if (!set.size) throw new Error("Koniklik verilecek yüzleri seçin");
      onOwner(set, "faces", (b) => b.draft((f.rev ? -1 : 1) * f.angle, (ff: any) => ff.when(({ element }: any) => set.has(element.hashCode)), makePlane(f.frame)));
      return;
    }
    case "lpattern": {
      const items = f.feats.map((id) => tools.get(id)).filter(Boolean) as { solid: Shape; cut: boolean; merge: boolean }[];
      if (!items.length) throw new Error("Çoğaltılacak özellik seçin");
      const [d1, d2] = [f.dirs[0], f.dirs[1] ?? { v: [0, 0, 0] as Vec3, count: 1, spacing: 0 }];
      for (const it of items)
        for (let i = 0; i < Math.max(1, d1.count); i++)
          for (let j = 0; j < Math.max(1, d2.count); j++) {
            if (!i && !j) continue;
            if (f.skip?.includes(`${i + 1},${j + 1}`) || (!j && f.skip?.includes(`${i + 1}`))) continue;
            const off = vadd(vmul(d1.v, i * d1.spacing), vmul(d2.v, j * d2.spacing));
            applyTool(it.solid.clone().translate(off), it.cut, it.merge);
          }
      return;
    }
    case "cpattern": {
      const items = f.feats.map((id) => tools.get(id)).filter(Boolean) as { solid: Shape; cut: boolean; merge: boolean }[];
      if (!items.length) throw new Error("Çoğaltılacak özellik seçin");
      for (const it of items) for (let i = 1; i < f.count; i++) if (!f.skip?.includes(`${i + 1}`)) applyTool(it.solid.clone().rotate(f.angle * i, f.origin ?? [0, 0, 0], f.axis), it.cut, it.merge);
      return;
    }
    case "mirror": {
      const plane = makePlane(f.frame);
      if (f.body) {
        if (!bodies.length) throw new Error("Aynalanacak katı yok");
        if (f.only) bodies = bodies.map((b) => b.clone().mirror(plane));
        else bodies = bodies.flatMap((b) => solidsOf(b.fuse(b.clone().mirror(plane))));
        return;
      }
      const items = f.feats.map((id) => tools.get(id)).filter(Boolean) as { solid: Shape; cut: boolean; merge: boolean }[];
      if (!items.length) throw new Error("Aynalanacak özellik seçin");
      for (const it of items) applyTool(it.solid.clone().mirror(plane), it.cut, it.merge);
      return;
    }
  }
}

let fontUrl = "";
function ensureFont() {
  if (!fontReady) fontReady = loadFont(fontUrl).then(() => undefined);
  return fontReady;
}

function circle3d(a: Vec3, b: Vec3, c: Vec3): { c: Vec3; r: number; ax: Vec3 } | null {
  const ab = vsub(b, a), ac = vsub(c, a);
  const n = vcross(ab, ac);
  const nn = vdot(n, n);
  if (nn < 1e-18) return null;
  const t = vadd(vmul(vcross(n, ab), vdot(ac, ac)), vmul(vcross(ac, n), vdot(ab, ab)));
  const center = vadd(a, vmul(t, 1 / (2 * nn)));
  return { c: center, r: vlen(vsub(a, center)), ax: vnorm(n) };
}

function toMesh(shape: Shape): MeshData {
  const m = shape.mesh({ tolerance: 0.05, angularTolerance: 0.25 });
  const e = shape.meshEdges({ tolerance: 0.05, angularTolerance: 0.25 });
  const faces = shape.faces as any[];
  const edges = shape.edges as any[];
  const fIdx = new Map<number, number>();
  const eIdx = new Map<number, number>();
  const faceInfo: FaceInfo[] = faces.map((f, i) => {
    fIdx.set(f.hashCode, i);
    const c = tup(f.center);
    const type = String(f.geomType);
    let n: Vec3 | null = null;
    if (type === "PLANE") {
      try {
        n = vnorm(tup(f.normalAt(c)));
      } catch {
        n = null;
      }
    }
    const info: FaceInfo = { c, n, type };
    if (type === "CYLINDRE")
      try {
        info.r = cylinderParams(f).rho;
      } catch {}
    return info;
  });
  const edgeInfo: EdgeInfo[] = edges.map((ed, i) => {
    eIdx.set(ed.hashCode, i);
    const type = String(ed.geomType);
    const s = tup(ed.startPoint), en = tup(ed.endPoint);
    const info: EdgeInfo = { m: tup(ed.pointAt(0.5)), d: type === "LINE" ? vnorm(vsub(en, s)) : null, type, s, e: en, closed: vlen(vsub(s, en)) < 1e-6 };
    if (type === "CIRCLE") {
      const c = circle3d(tup(ed.pointAt(0)), tup(ed.pointAt(1 / 3)), tup(ed.pointAt(2 / 3)));
      if (c) Object.assign(info, c);
    }
    return info;
  });
  const fg = new Int32Array(m.faceGroups.length * 3);
  m.faceGroups.forEach((g: any, i: number) => fg.set([g.start, g.count, fIdx.get(g.faceId) ?? -1], i * 3));
  const eg = new Int32Array(e.edgeGroups.length * 3);
  e.edgeGroups.forEach((g: any, i: number) => eg.set([g.start, g.count, eIdx.get(g.edgeId) ?? -1], i * 3));
  const bb = shape.boundingBox.bounds;
  return {
    vertices: new Float32Array(m.vertices),
    normals: new Float32Array(m.normals),
    triangles: new Uint32Array(m.triangles),
    faceGroups: fg,
    lines: new Float32Array(e.lines),
    edgeGroups: eg,
    faces: faceInfo,
    edges: edgeInfo,
    bbox: { min: bb[0], max: bb[1] },
    bodies: bodies.length,
  };
}

async function build(id: number, features: KFeature[]) {
  const errors: { featureId: string; message: string }[] = [];
  bodies = [];
  frames = {};
  tools.clear();
  memberReg = new Map();
  welds = [];
  weldInfo = [];
  for (const f of features) {
    try {
      await buildFeature(f);
    } catch (e) {
      errors.push({ featureId: f.id, message: errMsg(e) });
    }
  }
  const a = all();
  if (!a) return post({ id, type: "built", mesh: null, errors, frames });
  try {
    const mesh = toMesh(a);
    freeAll(a);
    // yüz -> gövde sırası
    const counts = [...bodies, ...welds].map((b) => (b.faces as any[]).length);
    if (counts.reduce((x, y) => x + y, 0) === mesh.faces.length) {
      let k = 0;
      counts.forEach((c, bi) => {
        for (let j = 0; j < c; j++) mesh.faces[k++].b = bi;
      });
    }
    let members: { key: string; name: string; body: number }[] = [];
    if (memberReg.size) members = [...memberBodyMap()].map(([key, body]) => ({ key, name: memberReg.get(key)!.name, body }));
    post({ id, type: "built", mesh, errors, frames, members }, [
      mesh.vertices.buffer,
      mesh.normals.buffer,
      mesh.triangles.buffer,
      mesh.lines.buffer,
      mesh.faceGroups.buffer,
      mesh.edgeGroups.buffer,
    ]);
  } catch (e) {
    errors.push({ featureId: "", message: "Görüntü üretilemedi: " + errMsg(e) });
    post({ id, type: "built", mesh: null, errors, frames });
  }
}

const f3 = (v: number) => (Math.round(v * 1000) / 1000).toString().replace(".", ",");

function measure(id: number, items: MeasureItem[]) {
  const lines: string[] = [];
  try {
    if (!bodies.length) throw new Error("Model yok");
    const resolve = (it: MeasureItem) => {
      if (it.k === "edge") {
        const set = matchEdges([it.ref]);
        return allEdges().find((e) => set.has(e.hashCode));
      }
      const set = matchFaces([it.ref]);
      return allFaces().find((f) => set.has(f.hashCode));
    };
    const shapes = items.map(resolve);
    if (shapes.some((s) => !s)) throw new Error("Seçim modelde bulunamadı");
    shapes.forEach((s, i) => {
      const it = items[i];
      const tag = items.length > 1 ? `${i + 1}. ` : "";
      if (it.k === "edge") {
        lines.push(`${tag}Kenar uzunluğu: ${f3(measureLength(s))} mm`);
        if (String(s.geomType) === "CIRCLE") {
          const c = circle3d(tup(s.pointAt(0)), tup(s.pointAt(1 / 3)), tup(s.pointAt(2 / 3)));
          if (c) lines.push(`${tag}Çap: ${f3(c.r * 2)} mm (R ${f3(c.r)})`);
        }
      } else {
        lines.push(`${tag}Yüz alanı: ${f3(measureArea(s))} mm²`);
        if (String(s.geomType) === "CYLINDRE") {
          const c = cylinderOf(s);
          if (c) lines.push(`${tag}Silindir çapı: ${f3(c.r * 2)} mm`);
        }
      }
    });
    if (shapes.length === 2) {
      lines.push(`En kısa mesafe: ${f3(measureDistanceBetween(shapes[0], shapes[1]))} mm`);
      const dirOf = (s: any, it: MeasureItem): Vec3 | null => {
        if (it.k === "face") return String(s.geomType) === "PLANE" ? vnorm(tup(s.normalAt(tup(s.center)))) : null;
        return String(s.geomType) === "LINE" ? vnorm(vsub(tup(s.endPoint), tup(s.startPoint))) : null;
      };
      const a = dirOf(shapes[0], items[0]), b = dirOf(shapes[1], items[1]);
      if (a && b) {
        let ang = (Math.acos(Math.max(-1, Math.min(1, Math.abs(vdot(a, b))))) * 180) / Math.PI;
        if (items[0].k !== items[1].k) ang = 90 - ang;
        lines.push(`Açı: ${f3(ang)}°`);
        if (items[0].k === "face" && items[1].k === "face" && Math.abs(Math.abs(vdot(a, b)) - 1) < 1e-6) {
          const c0 = tup(shapes[0].center), c1 = tup(shapes[1].center);
          lines.push(`Paralel yüzler arası: ${f3(Math.abs(vdot(vsub(c1, c0), a)))} mm`);
        }
      }
    }
  } catch (e) {
    lines.push(errMsg(e));
  }
  post({ id, type: "measured", lines });
}

function props(id: number) {
  const a = all();
  if (!a) return post({ id, type: "props", props: null });
  try {
    let vol = 0;
    const com: Vec3 = [0, 0, 0];
    for (const b of bodies) {
      const vp = measureShapeVolumeProperties(b);
      vol += vp.volume;
      const c = vp.centerOfMass as Vec3;
      for (let i = 0; i < 3; i++) com[i] += c[i] * vp.volume;
    }
    for (let i = 0; i < 3; i++) com[i] /= vol || 1;
    const bb = a.boundingBox.bounds;
    freeAll(a);
    const p: MassProps = { volume: vol, area: bodies.reduce((s, b) => s + measureArea(b), 0), com, bbox: { min: bb[0], max: bb[1] } };
    post({ id, type: "props", props: p });
  } catch {
    post({ id, type: "props", props: null });
  }
}

function section(id: number, fr: Frame) {
  const items: SectionItem[] = [];
  try {
    const a = all();
    if (a) {
      const oc = getOC() as any;
      const pln = new oc.gp_Pln(new oc.gp_Pnt(...fr.o), new oc.gp_Dir(...fr.n));
      const sec = new oc.BRepAlgoAPI_Section(a.wrapped, pln, true);
      const sh = cast(sec.Shape()) as any;
      freeAll(a);
      for (const e of sh.edges as any[]) {
        const type = String(e.geomType);
        const s = tup(e.startPoint), en = tup(e.endPoint);
        if (type === "LINE") items.push({ k: "line", s, e: en });
        else if (type === "CIRCLE") {
          const c = circle3d(tup(e.pointAt(0)), tup(e.pointAt(1 / 3)), tup(e.pointAt(2 / 3)));
          if (c) items.push({ k: "circle", c: c.c, r: c.r, closed: vlen(vsub(s, en)) < 1e-6, s, e: en, m: tup(e.pointAt(0.5)) });
        } else {
          const pts: Vec3[] = [];
          for (let i = 0; i <= 24; i++) pts.push(tup(e.pointAt(i / 24)));
          items.push({ k: "poly", pts });
        }
      }
    }
  } catch {
    /* kesişim yok */
  }
  post({ id, type: "section", items });
}

function exportShape(id: number, format: "step" | "stl") {
  const a = all();
  if (!a) return post({ id, type: "exported", blob: null, message: "Dışa aktarılacak katı yok" });
  try {
    const blob: Blob = format === "step" ? a.blobSTEP() : a.blobSTL({ binary: true, tolerance: 0.02, angularTolerance: 0.2 });
    freeAll(a);
    post({ id, type: "exported", blob });
  } catch (e) {
    post({ id, type: "exported", blob: null, message: errMsg(e) });
  }
}

/** Montaj: her bileşeni kur, dönüşüm matrisiyle yerleştir; STEP (bileşik) veya bileşenler arası girişim */
async function asmOp(id: number, op: "step" | "interfere" | "clearance", parts: { features: KFeature[]; q: number[]; p: Vec3; name: string }[]) {
  const placed: Shape[] = [];
  for (const p of parts) {
    bodies = [];
    frames = {};
    tools.clear();
    memberReg = new Map();
    welds = [];
    weldInfo = [];
    for (const f of p.features) {
      try {
        await buildFeature(f);
      } catch {}
    }
    const a = all();
    if (!a) {
      placed.push(null as any);
      continue;
    }
    // dörtlük (quaternion) → eksen-açı döndürme, sonra öteleme
    const [qx, qy, qz, qw] = p.q;
    const ang = 2 * Math.acos(Math.max(-1, Math.min(1, qw)));
    const sn = Math.sqrt(Math.max(0, 1 - qw * qw));
    let sh: Shape = a;
    if (ang > 1e-9 && sn > 1e-9) sh = sh.rotate((ang * 180) / Math.PI, [0, 0, 0], [qx / sn, qy / sn, qz / sn]);
    placed.push(sh.translate(p.p));
  }
  bodies = [];
  if (op === "step") {
    const ok = placed.filter(Boolean);
    if (!ok.length) return post({ id, type: "asm", blob: null, message: "Montajda katı yok" });
    const c = makeCompound(ok.map((x) => x.clone()));
    post({ id, type: "asm", blob: c.blobSTEP() });
    return;
  }
  if (op === "clearance") {
    // SolidWorks Boşluk Doğrulama: bileşen çiftleri arasındaki en kısa mesafe
    const dist: { a: number; b: number; d: number }[] = [];
    for (let i = 0; i < placed.length; i++)
      for (let j = i + 1; j < placed.length; j++) {
        if (!placed[i] || !placed[j]) continue;
        try {
          dist.push({ a: i, b: j, d: measureDistanceBetween(placed[i], placed[j]) });
        } catch {}
      }
    post({ id, type: "asm", dist });
    return;
  }
  const pairs: { a: number; b: number; vol: number }[] = [];
  for (let i = 0; i < placed.length; i++)
    for (let j = i + 1; j < placed.length; j++) {
      if (!placed[i] || !placed[j] || !bbOverlapStrict(placed[i], placed[j])) continue;
      try {
        const v = volOf(placed[i].clone().intersect(placed[j].clone()));
        if (v > 1e-3) pairs.push({ a: i, b: j, vol: v });
      } catch {}
    }
  post({ id, type: "asm", pairs });
}

// İstekler sırayla işlenir (yapım zaman uyumsuz olabilir)
let queue: Promise<void> = Promise.resolve();
self.onmessage = (ev: MessageEvent<KernelRequest>) => {
  const req = ev.data;
  queue = queue.then(async () => {
   try {
    if (req.type === "build") {
      if (req.fontUrl) fontUrl = req.fontUrl;
      await build(req.id, req.features);
    } else if (req.type === "export") exportShape(req.id, req.format);
    else if (req.type === "measure") measure(req.id, req.items);
    else if (req.type === "props") props(req.id);
    else if (req.type === "section") section(req.id, req.frame);
    else if (req.type === "flat") flatPattern(req.id, req.body, req.t, req.k);
    else if (req.type === "cutlist") cutList(req.id);
    else if (req.type === "exportBody") exportBody(req.id, req.body);
    else if (req.type === "drawing") drawingData(req.id, req.body);
    else if (req.type === "interfere") interfere(req.id);
    else if (req.type === "asm") await asmOp(req.id, req.op, req.parts);
   } catch (e) {
    // Hata kuyruğu kilitlemesin; isteği yanıtsız bırakma
    const t = req.type === "build" ? "built" : req.type === "export" ? "exported" : req.type === "measure" ? "measured" : req.type;
    post({ id: (req as any).id, type: t, mesh: null, errors: [{ featureId: "", message: errMsg(e) }], frames: {}, blob: null, message: errMsg(e), lines: [errMsg(e)], items: [] } as any);
   }
  });
};

init();

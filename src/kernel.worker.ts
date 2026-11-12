/// <reference lib="webworker" />
// Geometri çekirdeği: OpenCascade (WebAssembly) ayrı bir iş parçacığında çalışır.
// OpenCascade Technology, LGPL 2.1 (+ OCCT istisnası) lisanslıdır ve ayrı bir .wasm dosyası olarak yüklenir.

import opencascade from "replicad-opencascadejs";
import wasmUrl from "replicad-opencascadejs/wasm?url";
import {
  setOC, getOC, cast, drawCircle, drawEllipse, drawText, loadFont, draw, Plane, Sketch, genericSweep, makeCompound, makeCylinder,
  importSTEP, basicFaceExtrusion, makeVertex, makeThreePointArc, assembleWire, makeFace, makeLine, ProjectionCamera, makeProjectedEdges, Vector, measureArea, measureLength, measureDistanceBetween, measureShapeVolumeProperties,
} from "replicad";
import type {
  EdgeInfo, EdgeRef, FaceInfo, FaceRef, Frame, KFeature, KPlane, KernelRequest, KernelResponse, Loop, MassProps, MeasureItem, MeshData,
  Seg, SectionItem, TextItem, Vec2, Vec3, CutItem, MemberItem, WeldItem, DrawView, DrawData,
} from "./doc/types";
import { thinRegion } from "./sketch/profile";
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
  const frame = resolvePlane(f.pl);
  const sign = (f.rev ? -1 : 1) * (f.cut ? -1 : 1) * (flipped ? -1 : 1);
  const through = bodySize();
  const sk = (shift: number) => profile(f.loops, f.texts).sketchOnPlane(makePlane(frame, shift));
  let d1 = f.d1;
  let clipFace: any = null;
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
  else if (f.end === "through") solid = sk(0).extrude(sign * through);
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
  const pframe = resolvePlane(f.pl);
  const sframe = resolvePlane(f.path.pl);
  const spine = pathWire(f.path.segs, f.path.closed, sframe);
  let solid: Shape | null = null;
  for (const l of f.loops) {
    const w = (loopDrawing(l).sketchOnPlane(makePlane(pframe)) as any).wire;
    const s = genericSweep(w, spine, { frenet: true, transitionMode: "right" }, false);
    if (!solid) solid = s;
    else solid = l.depth % 2 === 0 ? solid.fuse(s) : solid.cut(s);
  }
  if (!solid) throw new Error("Profil yok");
  return solid;
}

function loftTool(f: Extract<KFeature, { type: "loft" }>) {
  if (f.profiles.length < 2) throw new Error("Loft için en az iki profil eskizi seçin");
  for (const p of f.profiles) if (p.loops.length !== 1) throw new Error("Her loft profili tek bir kapalı kontur olmalı");
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

function memberTool(f: Extract<KFeature, { type: "member" }>) {
  const items = f.items;
  type LI = { a: Vec3; b: Vec3; d: Vec3; L: number; x: Vec3 };
  const lines: (LI | null)[] = items.map((it) => {
    if (it.k !== "l") return null;
    const L = vlen(vsub(it.b, it.a));
    if (L < 1e-6) throw new Error("Sıfır uzunlukta segment");
    const d = vnorm(vsub(it.b, it.a));
    let x = vmul(it.n, -1);
    if (Math.abs(vdot(x, d)) > 0.999) x = vnorm(Math.abs(d[2]) < 0.9 ? vcross(d, [0, 0, 1]) : vcross(d, [1, 0, 0]));
    x = vnorm(vsub(x, vmul(d, vdot(x, d))));
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
    let x = vmul(first.n, -1);
    x = vsub(x, vmul(t0, vdot(x, t0)));
    if (vlen(x) < 1e-6) x = Math.abs(t0[2]) < 0.9 ? vcross(t0, [0, 0, 1]) : vcross(t0, [1, 0, 0]);
    x = vnorm(x);
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
  for (const s of solids) if (s) applyTool(s, false, false);
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
      const solid = f.type === "extrude" ? extrudeTool(f) : f.type === "revolve" ? revolveTool(f) : f.type === "sweep" ? sweepTool(f) : loftTool(f);
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
        onOwner(set, "edges", (b) => b.fillet((e: any) => (set.has(e.hashCode) ? rad : null)));
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
      onOwner(set, "faces", (b) => b.shell(Math.abs(f.t), (ff: any) => ff.when(({ element }: any) => set.has(element.hashCode))));
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
            const off = vadd(vmul(d1.v, i * d1.spacing), vmul(d2.v, j * d2.spacing));
            applyTool(it.solid.clone().translate(off), it.cut, it.merge);
          }
      return;
    }
    case "cpattern": {
      const items = f.feats.map((id) => tools.get(id)).filter(Boolean) as { solid: Shape; cut: boolean; merge: boolean }[];
      if (!items.length) throw new Error("Çoğaltılacak özellik seçin");
      for (const it of items) for (let i = 1; i < f.count; i++) applyTool(it.solid.clone().rotate(f.angle * i, f.origin ?? [0, 0, 0], f.axis), it.cut, it.merge);
      return;
    }
    case "mirror": {
      const plane = makePlane(f.frame);
      if (f.body) {
        if (!bodies.length) throw new Error("Aynalanacak katı yok");
        bodies = bodies.flatMap((b) => solidsOf(b.fuse(b.clone().mirror(plane))));
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
   } catch (e) {
    // Hata kuyruğu kilitlemesin; isteği yanıtsız bırakma
    const t = req.type === "build" ? "built" : req.type === "export" ? "exported" : req.type === "measure" ? "measured" : req.type;
    post({ id: (req as any).id, type: t, mesh: null, errors: [{ featureId: "", message: errMsg(e) }], frames: {}, blob: null, message: errMsg(e), lines: [errMsg(e)], items: [] } as any);
   }
  });
};

init();

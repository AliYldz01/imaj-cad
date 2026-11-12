/// <reference lib="webworker" />
// Geometri çekirdeği: OpenCascade (WebAssembly) ayrı bir iş parçacığında çalışır.
// OpenCascade Technology, LGPL 2.1 (+ OCCT istisnası) lisanslıdır ve ayrı bir .wasm dosyası olarak yüklenir.

import opencascade from "replicad-opencascadejs";
import wasmUrl from "replicad-opencascadejs/wasm?url";
import {
  setOC, getOC, cast, drawCircle, drawEllipse, drawText, loadFont, draw, Plane, Sketch, genericSweep, makeCompound, makeCylinder,
  importSTEP, basicFaceExtrusion, makeVertex, Vector, measureArea, measureLength, measureDistanceBetween, measureShapeVolumeProperties,
} from "replicad";
import type {
  EdgeInfo, EdgeRef, FaceInfo, FaceRef, Frame, KFeature, KPlane, KernelRequest, KernelResponse, Loop, MassProps, MeasureItem, MeshData,
  Seg, SectionItem, TextItem, Vec2, Vec3,
} from "./doc/types";
import { thinRegion } from "./sketch/profile";
import { unfold } from "./sheet/unfold";

type Shape = any;
/** Çoklu gövde: her eleman ayrı bir katı */
let bodies: Shape[] = [];
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
  if (!bodies.length) return null;
  // makeCompound girdileri siler: kopyalarla çalış
  return bodies.length === 1 ? bodies[0] : makeCompound(bodies.map((b) => b.clone()));
}
const freeAll = (a: Shape) => { if (bodies.length > 1) try { a.delete(); } catch {} };
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
    const d = vlen(vsub(c, ref.c));
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
  const w0 = face.outerWire();
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
  const info = allFaces().map((f) => ({ h: f.hashCode, c: tup(f.center) }));
  const out = new Set<number>();
  for (const r of refs) {
    let best: (typeof info)[0] | null = null;
    let bd = Infinity;
    for (const i of info) {
      const d = vlen(vsub(i.c, r.c));
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
    return { c, n, type };
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
    post({ id, type: "built", mesh, errors, frames }, [
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
   } catch (e) {
    // Hata kuyruğu kilitlemesin; isteği yanıtsız bırakma
    const t = req.type === "build" ? "built" : req.type === "export" ? "exported" : req.type === "measure" ? "measured" : req.type;
    post({ id: (req as any).id, type: t, mesh: null, errors: [{ featureId: "", message: errMsg(e) }], frames: {}, blob: null, message: errMsg(e), lines: [errMsg(e)], items: [] } as any);
   }
  });
};

init();

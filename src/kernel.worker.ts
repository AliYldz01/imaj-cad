/// <reference lib="webworker" />
// Geometri çekirdeği: OpenCascade (WebAssembly) ayrı bir iş parçacığında çalışır.
// OpenCascade Technology, LGPL 2.1 (+ OCCT istisnası) lisanslıdır ve ayrı bir .wasm dosyası olarak yüklenir.

import opencascade from "replicad-opencascadejs";
import wasmUrl from "replicad-opencascadejs/wasm?url";
import {
  setOC, drawCircle, draw, Plane, genericSweep, measureArea, measureLength, measureDistanceBetween, measureShapeVolumeProperties,
} from "replicad";
import type {
  EdgeInfo, EdgeRef, FaceInfo, FaceRef, Frame, KFeature, KPlane, KernelRequest, KernelResponse, Loop, MassProps, MeasureItem, MeshData, Seg, Vec2, Vec3,
} from "./doc/types";

type Shape = any;
let body: Shape | null = null;
let frames: Record<string, Frame> = {};

const post = (msg: KernelResponse, transfer: Transferable[] = []) =>
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg, transfer);
const errMsg = (e: unknown) => {
  const m = String((e as Error)?.message ?? e);
  return /^\d+$/.test(m) ? "Geometri işlemi başarısız (OpenCascade hatası)" : m;
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

function makePlane(f: Frame, shift = 0) {
  return new Plane(vadd(f.o, vmul(f.n, shift)), f.x, f.n);
}

/** Yüz üzerindeki eskizler: modeldeki yüzü bul, çerçeveyi yüzün güncel konumuna taşı */
function resolvePlane(pl: KPlane): Frame {
  const f = pl.frame;
  if (!pl.face || !body) return f;
  const n = pl.face.n ?? f.n;
  let best: Vec3 | null = null;
  let bd = Infinity;
  for (const face of body.faces as any[]) {
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

function loopDrawing(l: Loop) {
  if ("circle" in l) return drawCircle(l.circle.r).translate(l.circle.c[0], l.circle.c[1]);
  let pen: any = draw(l.segs[0].a);
  for (const s of l.segs) {
    if (s.t === "l") pen = pen.lineTo(s.b);
    else pen = pen.threePointsArcTo(s.b, s.m);
  }
  return pen.close();
}

function profile(loops: Loop[]) {
  if (!loops.length) throw new Error("Eskizde kapalı kontur yok");
  let d: any = null;
  for (const l of loops) {
    const ld = loopDrawing(l);
    if (!d) d = ld;
    else d = l.depth % 2 === 0 ? d.fuse(ld) : d.cut(ld);
  }
  return d;
}

function bodySize() {
  if (!body) return 1000;
  const bb = body.boundingBox.bounds as [Vec3, Vec3];
  return Math.max(1000, 4 * vlen(vsub(bb[1], bb[0])) + 4 * Math.max(...bb[0].map(Math.abs), ...bb[1].map(Math.abs)));
}

/** Özelliklerin "takım" katıları: çoğaltma ve aynada yeniden kullanılır */
const tools = new Map<string, { solid: Shape; cut: boolean }>();

function applyTool(solid: Shape, cut: boolean) {
  if (cut) {
    if (!body) throw new Error("Kesilecek bir katı yok");
    body = body.cut(solid);
  } else body = body ? body.fuse(solid) : solid;
}

function planarFace(ref: FaceRef): { c: Vec3; n: Vec3 } | null {
  if (!body) return null;
  let best: { c: Vec3; n: Vec3 } | null = null;
  let bd = Infinity;
  for (const face of body.faces as any[]) {
    if (String(face.geomType) !== "PLANE") continue;
    const c = tup(face.center);
    const d = vlen(vsub(c, ref.c));
    if (d < bd) {
      bd = d;
      best = { c, n: vnorm(tup(face.normalAt(c))) };
    }
  }
  return best && bd < 2 ? best : null;
}

function extrudeTool(f: Extract<KFeature, { type: "extrude" }>) {
  const frame = resolvePlane(f.pl);
  const sign = (f.rev ? -1 : 1) * (f.cut ? -1 : 1);
  const through = bodySize();
  const sk = (shift: number) => profile(f.loops).sketchOnPlane(makePlane(frame, shift));
  let d1 = f.d1;
  if (f.end === "surface" || f.end === "offset") {
    if (!f.face) throw new Error("Hedef yüzü seçin");
    const pf = planarFace(f.face);
    if (!pf) throw new Error("Hedef yüz bulunamadı (düz bir yüz seçin)");
    if (Math.abs(Math.abs(vdot(pf.n, frame.n)) - 1) > 1e-6) throw new Error("Hedef yüz eskiz düzlemine paralel olmalı");
    d1 = vdot(vsub(pf.c, frame.o), vmul(frame.n, sign)) - (f.end === "offset" ? f.offd ?? 0 : 0);
    if (d1 <= 1e-6) throw new Error("Hedef yüz bu yönde değil; yönü ters çevirin");
  }
  let solid: Shape;
  if (f.draft && f.draft > 0 && (f.end === "blind" || f.end === "surface" || f.end === "offset")) {
    if (f.loops.length > 1) throw new Error("Koniklik şimdilik tek konturlu profillerde destekleniyor");
    const off = d1 * Math.tan((f.draft * Math.PI) / 180) * (f.draftOut ? 1 : -1);
    const s1 = sk(0);
    const s2 = profile(f.loops).offset(off, { lineJoinType: "miter" }).sketchOnPlane(makePlane(frame, sign * d1));
    solid = s1.loftWith(s2, { ruled: true });
  } else if (f.end === "mid") solid = sk((-sign * f.d1) / 2).extrude(sign * f.d1);
  else if (f.end === "through") solid = sk(0).extrude(sign * through);
  else solid = sk(0).extrude(sign * d1);
  if (f.dir2 && f.end !== "mid") {
    const d2 = f.end2 === "through" ? through : f.d2;
    if (d2 > 0) solid = solid.fuse(sk(0).extrude(-sign * d2));
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
  let pen: any = draw(segs[0].a);
  for (const s of segs) {
    if (s.t === "l") pen = pen.lineTo(s.b);
    else pen = pen.threePointsArcTo(s.b, s.m);
  }
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
  const sks = f.profiles.map((p) => {
    if (p.loops.length !== 1) throw new Error("Her loft profili tek bir kapalı kontur olmalı");
    return loopDrawing(p.loops[0]).sketchOnPlane(makePlane(resolvePlane(p.pl))) as any;
  });
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
  let all: Shape | null = null;
  for (const p of f.pts) {
    const P = toWorld(frame, p);
    let pen: any = draw(pts[0]);
    for (let i = 1; i < pts.length; i++) pen = pen.lineTo(pts[i]);
    const sk = pen.close().sketchOnPlane(new Plane(P, u, nrm));
    const t = sk.revolve(v, { origin: P, angle: 360 });
    all = all ? all.fuse(t) : t;
  }
  return all!;
}

/** Saklanan geometrik referansa en yakın kenarları bulur */
function matchEdges(refs: EdgeRef[]): Set<number> {
  const edges = body.edges as any[];
  const info = edges.map((e) => ({ h: e.hashCode, m: tup(e.pointAt(0.5)) }));
  const out = new Set<number>();
  for (const r of refs) {
    let best: (typeof info)[0] | null = null;
    let bd = Infinity;
    for (const i of info) {
      const d = vlen(vsub(i.m, r.m));
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    if (best && bd < 2) out.add(best.h);
  }
  return out;
}

function matchFaces(refs: FaceRef[]): Set<number> {
  const faces = body.faces as any[];
  const info = faces.map((f) => ({ h: f.hashCode, c: tup(f.center) }));
  const out = new Set<number>();
  for (const r of refs) {
    let best: (typeof info)[0] | null = null;
    let bd = Infinity;
    for (const i of info) {
      const d = vlen(vsub(i.c, r.c));
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    if (best && bd < 2) out.add(best.h);
  }
  return out;
}

function edgesOfFaces(set: Set<number>) {
  const out = new Set<number>();
  for (const f of body.faces as any[]) if (set.has(f.hashCode)) for (const e of f.edges as any[]) out.add(e.hashCode);
  return out;
}

function buildFeature(f: KFeature) {
  switch (f.type) {
    case "extrude":
    case "revolve":
    case "sweep":
    case "loft": {
      const solid = f.type === "extrude" ? extrudeTool(f) : f.type === "revolve" ? revolveTool(f) : f.type === "sweep" ? sweepTool(f) : loftTool(f);
      tools.set(f.id, { solid, cut: f.cut });
      applyTool(solid, f.cut);
      return;
    }
    case "hole": {
      if (!body) throw new Error("Delik için önce bir katı oluşturun");
      const solid = holeTool(f);
      tools.set(f.id, { solid, cut: true });
      applyTool(solid, true);
      return;
    }
    case "fillet":
    case "chamfer": {
      if (!body) throw new Error("Önce bir katı oluşturun");
      const set = matchEdges(f.edges);
      if (f.faces?.length) edgesOfFaces(matchFaces(f.faces)).forEach((h) => set.add(h));
      if (!set.size) throw new Error("Seçili kenarlar modelde bulunamadı");
      const v = f.type === "fillet" ? f.r : f.d;
      if (!(v > 0)) throw new Error("Değer sıfırdan büyük olmalı");
      const fn = (e: any) => (set.has(e.hashCode) ? v : null);
      body = f.type === "fillet" ? body.fillet(fn) : body.chamfer(fn);
      return;
    }
    case "shell": {
      if (!body) throw new Error("Önce bir katı oluşturun");
      const set = matchFaces(f.faces);
      if (!set.size) throw new Error("Kaldırılacak yüz seçin");
      body = body.shell(Math.abs(f.t), (ff: any) => ff.when(({ element }: any) => set.has(element.hashCode)));
      return;
    }
    case "draft": {
      if (!body) throw new Error("Önce bir katı oluşturun");
      const set = matchFaces(f.faces);
      if (!set.size) throw new Error("Koniklik verilecek yüzleri seçin");
      body = body.draft((f.rev ? -1 : 1) * f.angle, (ff: any) => ff.when(({ element }: any) => set.has(element.hashCode)), makePlane(f.frame));
      return;
    }
    case "lpattern": {
      const items = f.feats.map((id) => tools.get(id)).filter(Boolean) as { solid: Shape; cut: boolean }[];
      if (!items.length) throw new Error("Çoğaltılacak özellik seçin");
      const [d1, d2] = [f.dirs[0], f.dirs[1] ?? { v: [0, 0, 0] as Vec3, count: 1, spacing: 0 }];
      for (const it of items)
        for (let i = 0; i < Math.max(1, d1.count); i++)
          for (let j = 0; j < Math.max(1, d2.count); j++) {
            if (!i && !j) continue;
            const off = vadd(vmul(d1.v, i * d1.spacing), vmul(d2.v, j * d2.spacing));
            applyTool(it.solid.clone().translate(off), it.cut);
          }
      return;
    }
    case "cpattern": {
      const items = f.feats.map((id) => tools.get(id)).filter(Boolean) as { solid: Shape; cut: boolean }[];
      if (!items.length) throw new Error("Çoğaltılacak özellik seçin");
      for (const it of items) for (let i = 1; i < f.count; i++) applyTool(it.solid.clone().rotate(f.angle * i, [0, 0, 0], f.axis), it.cut);
      return;
    }
    case "mirror": {
      const plane = makePlane(f.frame);
      if (f.body) {
        if (!body) throw new Error("Aynalanacak katı yok");
        body = body.fuse(body.clone().mirror(plane));
        return;
      }
      const items = f.feats.map((id) => tools.get(id)).filter(Boolean) as { solid: Shape; cut: boolean }[];
      if (!items.length) throw new Error("Aynalanacak özellik seçin");
      for (const it of items) applyTool(it.solid.clone().mirror(plane), it.cut);
      return;
    }
  }
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
  };
}

function build(id: number, features: KFeature[]) {
  const errors: { featureId: string; message: string }[] = [];
  body = null;
  frames = {};
  tools.clear();
  for (const f of features) {
    try {
      buildFeature(f);
    } catch (e) {
      errors.push({ featureId: f.id, message: errMsg(e) });
    }
  }
  if (!body) return post({ id, type: "built", mesh: null, errors, frames });
  try {
    const mesh = toMesh(body);
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
    if (!body) throw new Error("Model yok");
    const resolve = (it: MeasureItem) => {
      if (it.k === "edge") {
        const set = matchEdges([it.ref]);
        return (body.edges as any[]).find((e) => set.has(e.hashCode));
      }
      const set = matchFaces([it.ref]);
      return (body.faces as any[]).find((f) => set.has(f.hashCode));
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
          const ed = (s.edges as any[]).find((x) => String(x.geomType) === "CIRCLE");
          const c = ed && circle3d(tup(ed.pointAt(0)), tup(ed.pointAt(1 / 3)), tup(ed.pointAt(2 / 3)));
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
  if (!body) return post({ id, type: "props", props: null });
  try {
    const vp = measureShapeVolumeProperties(body);
    const bb = body.boundingBox.bounds;
    const p: MassProps = { volume: vp.volume, area: measureArea(body), com: vp.centerOfMass as Vec3, bbox: { min: bb[0], max: bb[1] } };
    post({ id, type: "props", props: p });
  } catch {
    post({ id, type: "props", props: null });
  }
}

function exportShape(id: number, format: "step" | "stl") {
  if (!body) return post({ id, type: "exported", blob: null, message: "Dışa aktarılacak katı yok" });
  try {
    const blob: Blob = format === "step" ? body.blobSTEP() : body.blobSTL({ binary: true, tolerance: 0.02, angularTolerance: 0.2 });
    post({ id, type: "exported", blob });
  } catch (e) {
    post({ id, type: "exported", blob: null, message: errMsg(e) });
  }
}

self.onmessage = (ev: MessageEvent<KernelRequest>) => {
  const req = ev.data;
  if (req.type === "build") build(req.id, req.features);
  else if (req.type === "export") exportShape(req.id, req.format);
  else if (req.type === "measure") measure(req.id, req.items);
  else if (req.type === "props") props(req.id);
};

init();

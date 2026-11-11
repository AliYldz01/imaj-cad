/// <reference lib="webworker" />
// Geometri çekirdeği: OpenCascade (WebAssembly) ayrı bir iş parçacığında çalışır.
// OpenCascade Technology, LGPL 2.1 (+ OCCT istisnası) lisanslıdır ve ayrı bir .wasm dosyası olarak yüklenir.

import opencascade from "replicad-opencascadejs";
import wasmUrl from "replicad-opencascadejs/wasm?url";
import { setOC, drawCircle, draw, Plane } from "replicad";
import type { EdgeInfo, EdgeRef, FaceInfo, FaceRef, Frame, KFeature, KernelRequest, KernelResponse, Loop, MeshData, Vec3 } from "./doc/types";

type Shape = any;
let body: Shape | null = null;

const post = (msg: KernelResponse, transfer: Transferable[] = []) =>
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg, transfer);
const errMsg = (e: unknown) => String((e as Error)?.message ?? e);

async function init() {
  try {
    const OC = await (opencascade as any)({ locateFile: () => wasmUrl });
    setOC(OC);
    post({ type: "ready" });
  } catch (e) {
    post({ type: "fatal", message: errMsg(e) });
  }
}

// ---------- yardımcılar ----------
const vadd = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const vmul = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const vsub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vlen = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const vnorm = (a: Vec3): Vec3 => vmul(a, 1 / (vlen(a) || 1));
const vcross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const toWorld = (f: Frame, p: [number, number]): Vec3 => {
  const y = vcross(f.n, f.x);
  return vadd(f.o, vadd(vmul(f.x, p[0]), vmul(y, p[1])));
};
const tup = (v: any): Vec3 => v.toTuple() as Vec3;

function makePlane(f: Frame, shift = 0) {
  return new Plane(vadd(f.o, vmul(f.n, shift)), f.x, f.n);
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

function extrudeTool(f: Extract<KFeature, { type: "extrude" }>) {
  // SolidWorks gibi: kesme varsayılan olarak eskiz normalinin tersine (malzemenin içine) gider
  const sign = (f.rev ? -1 : 1) * (f.cut ? -1 : 1);
  const through = bodySize();
  const sk = (shift: number) => profile(f.loops).sketchOnPlane(makePlane(f.frame, shift));
  let solid: Shape;
  if (f.end === "mid") solid = sk((-sign * f.d1) / 2).extrude(sign * f.d1);
  else if (f.end === "through") solid = sk(0).extrude(sign * through);
  else solid = sk(0).extrude(sign * f.d1);
  if (f.dir2 && f.end !== "mid") {
    const d2 = f.end2 === "through" ? through : f.d2;
    if (d2 > 0) solid = solid.fuse(sk(0).extrude(-sign * d2));
  }
  return solid;
}

function revolveTool(f: Extract<KFeature, { type: "revolve" }>) {
  const a = toWorld(f.frame, f.axis[0]);
  const b = toWorld(f.frame, f.axis[1]);
  let dir = vnorm(vsub(b, a));
  if (f.rev) dir = vmul(dir, -1);
  const angle = Math.min(360, Math.max(0.01, f.angle));
  let solid = profile(f.loops).sketchOnPlane(makePlane(f.frame)).revolve(dir, { origin: a, angle });
  if (f.mid && angle < 360) solid = solid.rotate(-angle / 2, a, dir);
  return solid;
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

function buildFeature(f: KFeature) {
  switch (f.type) {
    case "extrude": {
      const solid = extrudeTool(f);
      tools.set(f.id, { solid, cut: f.cut });
      applyTool(solid, f.cut);
      return;
    }
    case "revolve": {
      const solid = revolveTool(f);
      tools.set(f.id, { solid, cut: f.cut });
      applyTool(solid, f.cut);
      return;
    }
    case "fillet":
    case "chamfer": {
      if (!body) throw new Error("Önce bir katı oluşturun");
      const set = matchEdges(f.edges);
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
      for (const it of items)
        for (let i = 1; i < f.count; i++) applyTool(it.solid.clone().rotate(f.angle * i, [0, 0, 0], f.axis), it.cut);
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
    const mid = tup(ed.pointAt(0.5));
    const d = type === "LINE" ? vnorm(vsub(tup(ed.endPoint), tup(ed.startPoint))) : null;
    return { m: mid, d, type };
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
  tools.clear();
  for (const f of features) {
    try {
      buildFeature(f);
    } catch (e) {
      errors.push({ featureId: f.id, message: errMsg(e) });
    }
  }
  if (!body) return post({ id, type: "built", mesh: null, errors });
  try {
    const mesh = toMesh(body);
    post({ id, type: "built", mesh, errors }, [
      mesh.vertices.buffer,
      mesh.normals.buffer,
      mesh.triangles.buffer,
      mesh.lines.buffer,
      mesh.faceGroups.buffer,
      mesh.edgeGroups.buffer,
    ]);
  } catch (e) {
    errors.push({ featureId: "", message: "Görüntü üretilemedi: " + errMsg(e) });
    post({ id, type: "built", mesh: null, errors });
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
};

init();

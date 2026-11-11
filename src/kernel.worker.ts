/// <reference lib="webworker" />
// Geometri çekirdeği: OpenCascade (WebAssembly) ayrı bir iş parçacığında çalışır,
// böylece hesap sürerken arayüz donmaz.
//
// OpenCascade Technology, LGPL 2.1 (+ OCCT istisnası) lisanslıdır ve
// ayrı bir .wasm dosyası olarak yüklenir.

import opencascade from "replicad-opencascadejs";
import wasmUrl from "replicad-opencascadejs/wasm?url";
import { setOC, drawRectangle, drawCircle, draw } from "replicad";
import type { Feature, KernelRequest, KernelResponse, MeshData, Profile } from "./types";

type Shape = any; // replicad Shape3D
let current: Shape | null = null;

const post = (msg: KernelResponse, transfer: Transferable[] = []) =>
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg, transfer);

async function init() {
  try {
    const OC = await (opencascade as any)({ locateFile: () => wasmUrl });
    setOC(OC);
    post({ type: "ready" });
  } catch (e) {
    post({ type: "fatal", message: String((e as Error)?.message ?? e) });
  }
}

function profileDrawing(p: Profile) {
  switch (p.kind) {
    case "rect":
      if (p.w <= 0 || p.h <= 0) throw new Error("Genişlik ve yükseklik sıfırdan büyük olmalı");
      return drawRectangle(p.w, p.h).translate(p.x + p.w / 2, p.y + p.h / 2);
    case "circle":
      if (p.r <= 0) throw new Error("Çap sıfırdan büyük olmalı");
      return drawCircle(p.r).translate(p.cx, p.cy);
    case "poly": {
      if (p.pts.length < 3) throw new Error("Çokgen en az 3 nokta olmalı");
      let pen = draw(p.pts[0]);
      for (let i = 1; i < p.pts.length; i++) pen = pen.lineTo(p.pts[i]);
      return pen.close();
    }
  }
}

function buildFeature(f: Feature): Shape {
  if (!f.depth) throw new Error("Yükseklik sıfır olamaz");
  const sketch = profileDrawing(f.profile).sketchOnPlane("XY", f.z) as any;
  return sketch.extrude(f.depth);
}

function toMesh(shape: Shape): MeshData {
  const m = shape.mesh({ tolerance: 0.05, angularTolerance: 0.3 });
  const e = shape.meshEdges({ tolerance: 0.05, angularTolerance: 0.3 });
  const bb = shape.boundingBox;
  return {
    vertices: new Float32Array(m.vertices),
    normals: new Float32Array(m.normals),
    triangles: new Uint32Array(m.triangles),
    lines: new Float32Array(e.lines),
    bbox: { min: bb.bounds[0], max: bb.bounds[1] },
  };
}

function build(id: number, features: Feature[]) {
  const errors: { featureId: string; message: string }[] = [];
  let shape: Shape | null = null;
  for (const f of features) {
    try {
      const solid = buildFeature(f);
      if (f.op === "add") {
        shape = shape ? shape.fuse(solid) : solid;
      } else {
        if (!shape) throw new Error("Çıkarılacak bir katı yok. Önce 'Ekle' ile katı oluşturun.");
        shape = shape.cut(solid);
      }
    } catch (e) {
      errors.push({ featureId: f.id, message: String((e as Error)?.message ?? e) });
    }
  }
  current = shape;
  if (!shape) return post({ id, type: "built", mesh: null, errors });
  try {
    const mesh = toMesh(shape);
    post({ id, type: "built", mesh, errors }, [
      mesh.vertices.buffer,
      mesh.normals.buffer,
      mesh.triangles.buffer,
      mesh.lines.buffer,
    ]);
  } catch (e) {
    errors.push({ featureId: "", message: "Görüntü üretilemedi: " + String((e as Error)?.message ?? e) });
    post({ id, type: "built", mesh: null, errors });
  }
}

function exportShape(id: number, format: "step" | "stl") {
  if (!current) return post({ id, type: "exported", blob: null, message: "Dışa aktarılacak katı yok" });
  try {
    const blob: Blob =
      format === "step" ? current.blobSTEP() : current.blobSTL({ binary: true, tolerance: 0.02, angularTolerance: 0.2 });
    post({ id, type: "exported", blob });
  } catch (e) {
    post({ id, type: "exported", blob: null, message: String((e as Error)?.message ?? e) });
  }
}

self.onmessage = (ev: MessageEvent<KernelRequest>) => {
  const req = ev.data;
  if (req.type === "build") build(req.id, req.features);
  else if (req.type === "export") exportShape(req.id, req.format);
};

init();

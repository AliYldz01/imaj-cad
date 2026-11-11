// Uygulama genelinde paylaşılan veri tipleri.
// Model, "özellik" (feature) listesinden her seferinde yeniden üretilir:
// böylece geçmişteki her adım sonradan düzenlenebilir (parametrik model).

export type Pt = [number, number];

export type Profile =
  | { kind: "rect"; x: number; y: number; w: number; h: number }
  | { kind: "circle"; cx: number; cy: number; r: number }
  | { kind: "poly"; pts: Pt[] };

export type Operation = "add" | "cut";

export interface ExtrudeFeature {
  id: string;
  type: "extrude";
  profile: Profile;
  /** Eskiz düzleminin yüksekliği (Z, mm) */
  z: number;
  /** Katılaştırma yüksekliği (mm). Negatif değer aşağı doğru uzatır. */
  depth: number;
  op: Operation;
}

export type Feature = ExtrudeFeature;

export interface MeshData {
  vertices: Float32Array;
  normals: Float32Array;
  triangles: Uint32Array;
  lines: Float32Array;
  bbox: { min: [number, number, number]; max: [number, number, number] } | null;
}

// Ana iş parçacığı -> çekirdek
export type KernelRequest =
  | { id: number; type: "build"; features: Feature[] }
  | { id: number; type: "export"; format: "step" | "stl" };

// Çekirdek -> ana iş parçacığı
export type KernelResponse =
  | { type: "ready" }
  | { type: "fatal"; message: string }
  | { id: number; type: "built"; mesh: MeshData | null; errors: { featureId: string; message: string }[] }
  | { id: number; type: "exported"; blob: Blob | null; message?: string };

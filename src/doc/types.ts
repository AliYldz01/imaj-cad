// Parça belgesinin veri modeli (SolidWorks mantığı):
// Parça = Orijin + 3 standart düzlem + sıralı özellik listesi (FeatureManager ağacı).
// Model, özelliklerden her seferinde yeniden hesaplanır.

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

/** Eskiz düzlemi çerçevesi: o = başlangıç, x = yatay eksen, n = normal. (y = n × x) */
export interface Frame {
  o: Vec3;
  x: Vec3;
  n: Vec3;
}

export type StdPlane = "front" | "top" | "right";

export type PlaneRef =
  | { k: "std"; n: StdPlane }
  | { k: "ref"; id: string } // referans düzlem özelliği
  | { k: "face"; frame: Frame; label?: string; face?: FaceRef }; // düzlemsel yüz: model değişince yüzü takip eder

// ---------------- Eskiz ----------------

export type EntType = "point" | "line" | "circle" | "arc";

interface EntBase {
  id: string;
  /** Yapı geometrisi (merkez çizgisi vb.) — katıya katılmaz */
  cons?: boolean;
}
export interface SPointEnt extends EntBase { t: "point"; p: string }
export interface SLine extends EntBase { t: "line"; p1: string; p2: string }
export interface SCircle extends EntBase { t: "circle"; c: string; r: number }
/** Yay: merkez c, başlangıç s, bitiş e; s'den e'ye saat yönünün tersine */
export interface SArc extends EntBase { t: "arc"; c: string; s: string; e: string; r: number }
export type SEnt = SPointEnt | SLine | SCircle | SArc;

export type RelType =
  | "coincident" // nokta-nokta
  | "onLine" // nokta-çizgi
  | "onCircle" // nokta-daire/yay
  | "horizontal" // çizgi veya iki nokta
  | "vertical"
  | "parallel"
  | "perpendicular"
  | "collinear"
  | "equal"
  | "tangent"
  | "concentric"
  | "midpoint" // nokta, çizgi
  | "symmetric" // nokta, nokta, merkez çizgisi
  | "fix"; // nokta

export type DimType =
  | "dist" // nokta-nokta (sub: a=hizalı, h=yatay, v=dikey) — çizgi uzunluğu da budur
  | "dia" // daire/yay çapı
  | "rad" // yay/daire yarıçapı
  | "angle" // iki çizgi arası açı (derece)
  | "pldist"; // nokta-çizgi (veya paralel çizgiler) mesafesi

export interface SRel {
  id: string;
  t: RelType;
  refs: string[];
  /** sabitle için kayıtlı konum */
  fx?: number;
  fy?: number;
}
export interface SDim {
  id: string;
  t: DimType;
  refs: string[];
  v: number;
  sub?: "a" | "h" | "v";
  /** ölçü etiketinin eskiz düzlemindeki konumu */
  lp: Vec2;
  /** açı ölçüsü: l1'den l2'ye yön işareti (+1 / -1) */
  sgn?: number;
}

export interface SketchData {
  pts: Record<string, { x: number; y: number }>;
  ents: SEnt[];
  rels: SRel[];
  dims: SDim[];
  seq: number;
}

/** Orijin noktası her eskizde sabit (0,0) olarak bulunur */
export const ORIGIN = "O";

// ---------------- Özellikler ----------------

/** Kenar referansı: orta noktası ve (doğrusalsa) yönü ile geometrik olarak saklanır */
export interface EdgeRef { m: Vec3; d?: Vec3 | null }
/** Yüz referansı: merkezi ve normali */
export interface FaceRef { c: Vec3; n?: Vec3 | null }

interface FeatBase {
  id: string;
  name: string;
  /** Bastırılmış (devre dışı) */
  off?: boolean;
}

export interface SketchFeature extends FeatBase {
  type: "sketch";
  plane: PlaneRef;
  data: SketchData;
}

export type EndCond = "blind" | "mid" | "through" | "surface" | "offset";

export interface ExtrudeFeature extends FeatBase {
  type: "extrude";
  sketch: string;
  cut: boolean;
  end: EndCond;
  d1: number;
  rev: boolean;
  dir2: boolean;
  end2: "blind" | "through";
  d2: number;
  /** Yüzeye kadar / yüzeyden ötele için hedef yüz */
  face?: FaceRef | null;
  /** Yüzeyden ötele mesafesi */
  offd?: number;
  /** Koniklik açısı (derece, 0 = yok) */
  draft?: number;
  draftOut?: boolean;
}

export interface RevolveFeature extends FeatBase {
  type: "revolve";
  sketch: string;
  cut: boolean;
  /** eksen: eskizdeki çizgi/merkez çizgisi kimliği */
  axis: string;
  angle: number;
  mid: boolean;
  rev: boolean;
}

export interface FilletFeature extends FeatBase { type: "fillet"; r: number; edges: EdgeRef[]; faces?: FaceRef[] }
export interface ChamferFeature extends FeatBase { type: "chamfer"; d: number; edges: EdgeRef[]; faces?: FaceRef[] }

export interface SweepFeature extends FeatBase {
  type: "sweep";
  /** profil eskizi (kapalı) */
  sketch: string;
  /** yol eskizi (açık veya kapalı zincir) */
  path: string;
  cut: boolean;
}
export interface LoftFeature extends FeatBase {
  type: "loft";
  /** sırasıyla profil eskizleri */
  sketches: string[];
  cut: boolean;
  ruled: boolean;
}

export type HoleType = "simple" | "cbore" | "csink" | "tap";
export interface HoleFeature extends FeatBase {
  type: "hole";
  htype: HoleType;
  /** standart boyut (M3…M24) veya "custom" */
  size: string;
  /** delik çapı (özel boyutta veya standarttan hesaplanır) */
  d: number;
  depth: number;
  through: boolean;
  /** havşa / düz havşa çapı ve derinliği */
  cd: number;
  cdepth: number;
  /** havşa açısı */
  cangle: number;
  /** yerleştirildiği düz yüz */
  plane: PlaneRef | null;
  /** yüz düzlemindeki merkez noktaları */
  pts: Vec2[];
}
export interface DraftFeature extends FeatBase {
  type: "draft";
  angle: number;
  /** nötr düzlem */
  plane: PlaneRef;
  faces: FaceRef[];
  rev: boolean;
}
export interface ShellFeature extends FeatBase { type: "shell"; t: number; faces: FaceRef[] }

export type AxisName = "x" | "y" | "z";
export interface LPatternFeature extends FeatBase {
  type: "lpattern";
  feats: string[];
  axis: AxisName;
  rev: boolean;
  count: number;
  spacing: number;
  /** ikinci yön (isteğe bağlı) */
  dir2: boolean;
  axis2: AxisName;
  rev2: boolean;
  count2: number;
  spacing2: number;
}
export interface CPatternFeature extends FeatBase {
  type: "cpattern";
  feats: string[];
  axis: AxisName;
  count: number;
  angle: number;
  /** eşit aralık: toplam açıyı adede böl */
  equal: boolean;
}
export interface MirrorFeature extends FeatBase {
  type: "mirror";
  feats: string[];
  /** true: tüm gövdeyi aynala */
  body: boolean;
  plane: PlaneRef;
}
export interface PlaneFeature extends FeatBase {
  type: "plane";
  base: PlaneRef;
  offset: number;
  flip: boolean;
}

export type Feature =
  | SketchFeature
  | ExtrudeFeature
  | RevolveFeature
  | FilletFeature
  | ChamferFeature
  | ShellFeature
  | LPatternFeature
  | CPatternFeature
  | MirrorFeature
  | PlaneFeature
  | SweepFeature
  | LoftFeature
  | HoleFeature
  | DraftFeature;

export type FeatureType = Feature["type"];

export interface PartDoc {
  version: 2;
  name: string;
  features: Feature[];
  seq: Record<string, number>;
  /** malzeme anahtarı (bkz. MATERIALS) */
  material?: string;
}

// ---------------- Çekirdeğe giden çözülmüş tanımlar ----------------

export type Seg = { t: "l"; a: Vec2; b: Vec2 } | { t: "a"; a: Vec2; b: Vec2; m: Vec2 };
export type Loop = { circle: { c: Vec2; r: number }; depth: number } | { segs: Seg[]; depth: number };

/** Eskiz düzlemi: yüz üzerindeyse çekirdek yüzü bulup çerçeveyi günceller */
export interface KPlane { frame: Frame; face?: FaceRef; sketchId?: string }

export type KFeature =
  | { id: string; type: "extrude"; cut: boolean; pl: KPlane; loops: Loop[]; end: EndCond; d1: number; rev: boolean; dir2: boolean; end2: "blind" | "through"; d2: number; face?: FaceRef | null; offd?: number; draft?: number; draftOut?: boolean }
  | { id: string; type: "revolve"; cut: boolean; pl: KPlane; loops: Loop[]; axis: [Vec2, Vec2]; angle: number; mid: boolean; rev: boolean }
  | { id: string; type: "fillet"; r: number; edges: EdgeRef[]; faces?: FaceRef[] }
  | { id: string; type: "chamfer"; d: number; edges: EdgeRef[]; faces?: FaceRef[] }
  | { id: string; type: "sweep"; cut: boolean; pl: KPlane; loops: Loop[]; path: { pl: KPlane; segs: Seg[]; closed: boolean } }
  | { id: string; type: "loft"; cut: boolean; ruled: boolean; profiles: { pl: KPlane; loops: Loop[] }[] }
  | { id: string; type: "hole"; pl: KPlane; pts: Vec2[]; htype: HoleType; d: number; depth: number; through: boolean; cd: number; cdepth: number; cangle: number }
  | { id: string; type: "draft"; angle: number; frame: Frame; faces: FaceRef[]; rev: boolean }
  | { id: string; type: "shell"; t: number; faces: FaceRef[] }
  | { id: string; type: "lpattern"; feats: string[]; dirs: { v: Vec3; count: number; spacing: number }[] }
  | { id: string; type: "cpattern"; feats: string[]; axis: Vec3; count: number; angle: number }
  | { id: string; type: "mirror"; feats: string[]; body: boolean; frame: Frame };

export interface FaceInfo { c: Vec3; n: Vec3 | null; type: string }
export interface EdgeInfo {
  m: Vec3;
  d: Vec3 | null;
  type: string;
  /** başlangıç / bitiş noktaları */
  s: Vec3;
  e: Vec3;
  /** dairesel kenarlar: merkez, yarıçap, eksen */
  c?: Vec3;
  r?: number;
  ax?: Vec3;
  closed?: boolean;
}

export interface MeshData {
  vertices: Float32Array;
  normals: Float32Array;
  triangles: Uint32Array;
  /** üçgen dizisindeki [başlangıç, adet, yüz indeksi] üçlüleri */
  faceGroups: Int32Array;
  lines: Float32Array;
  /** çizgi köşe dizisindeki [başlangıç, adet, kenar indeksi] üçlüleri */
  edgeGroups: Int32Array;
  faces: FaceInfo[];
  edges: EdgeInfo[];
  bbox: { min: Vec3; max: Vec3 } | null;
}

export type MeasureItem = { k: "edge"; ref: EdgeRef } | { k: "face"; ref: FaceRef };

export interface MassProps {
  volume: number;
  area: number;
  com: Vec3;
  bbox: { min: Vec3; max: Vec3 };
}

export type KernelRequest =
  | { id: number; type: "build"; features: KFeature[] }
  | { id: number; type: "export"; format: "step" | "stl" }
  | { id: number; type: "measure"; items: MeasureItem[] }
  | { id: number; type: "props" };

export type KernelResponse =
  | { type: "ready" }
  | { type: "fatal"; message: string }
  | { id: number; type: "built"; mesh: MeshData | null; errors: { featureId: string; message: string }[]; frames: Record<string, Frame> }
  | { id: number; type: "measured"; lines: string[] }
  | { id: number; type: "props"; props: MassProps | null }
  | { id: number; type: "exported"; blob: Blob | null; message?: string };

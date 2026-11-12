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

export type EntType = "point" | "line" | "circle" | "arc" | "ellipse" | "spline" | "parabola" | "text";

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
/** Elips: merkez c, büyük eksen ucu a, küçük yarıçap rb. t0/t1 varsa kısmi elips (s, e uç noktaları türetilir) */
export interface SEllipse extends EntBase { t: "ellipse"; c: string; a: string; rb: number; t0?: number; t1?: number; s?: string; e?: string }
/** Noktalardan geçen spline */
export interface SSpline extends EntBase { t: "spline"; pts: string[] }
/** Parabol (ikinci derece Bezier): başlangıç, bitiş, kontrol noktası */
export interface SParabola extends EntBase { t: "parabola"; s: string; e: string; k: string; /** konik: rho (0,5 = parabol, <0,5 elips, >0,5 hiperbol) */ rho?: number }
/** Eskiz metni */
export interface SText extends EntBase { t: "text"; p: string; text: string; size: number; angle: number }
export type SEnt = SPointEnt | SLine | SCircle | SArc | SEllipse | SSpline | SParabola | SText;

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
  | "pldist" // nokta-çizgi (veya paralel çizgiler) mesafesi
  | "alen" // yay uzunluğu
  | "cl" // daire kenarı – çizgi en yakın mesafesi
  | "cc"; // iki daire kenarı arası en yakın mesafe

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
  /** referans (sürülen) ölçü: geometriyi değiştirmez */
  ref?: boolean;
  /** değer bir denklemden geliyorsa ifadesi */
  expr?: string;
}

/** Eskiz resmi: x,y = resim merkezi (eskiz koordinatı), w = genişlik (mm), aspect = yükseklik/genişlik */
export interface SketchPicture { src: string; aspect: number; x: number; y: number; w: number; rot: number; op: number; flip?: boolean }

export interface SketchData {
  pic?: SketchPicture;
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
export interface FaceRef { c: Vec3; n?: Vec3 | null; /** silindirik yüz yarıçapı (aynı merkezli yüzleri ayırmak için) */ r?: number }

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

export type EndCond = "blind" | "mid" | "through" | "surface" | "offset" | "next" | "vertex" | "body";

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
  /** İnce özellik */
  /** Seçili konturlar (bölge indeksleri; boş = tümü) */
  contours?: number[];
  /** Başlangıç: yüz / köşe (startOff yerine) */
  fromFace?: FaceRef | null;
  fromVtx?: Vec3 | null;
  /** Köşeye kadar */
  vtx?: Vec3 | null;
  /** Gövdeye kadar: gövdenin bir yüzü */
  bodyRef?: FaceRef | null;
  /** Ekstrüzyon yönü (kenar yönü) */
  dirVec?: Vec3 | null;
  /** Kesme tarafını çevir (profilin dışını kes) */
  flipCut?: boolean;
  thin?: boolean;
  thinT?: number;
  /** ince özellik yönü: tek taraf / ters / orta */
  thinMode?: "one" | "rev" | "mid";
  /** Bükümlü ekstrüzyon açısı */
  twist?: number;
  /** false: ayrı gövde oluştur (çoklu gövde) */
  merge?: boolean;
  /** başlangıç: eskiz düzleminden öteleme */
  startOff?: number;
}

export interface RevolveFeature extends FeatBase {
  type: "revolve";
  sketch: string;
  contours?: number[];
  cut: boolean;
  /** eksen: eskizdeki çizgi/merkez çizgisi kimliği */
  axis: string;
  angle: number;
  mid: boolean;
  rev: boolean;
  thin?: boolean;
  thinT?: number;
  thinMode?: "one" | "rev" | "mid";
  merge?: boolean;
}

export interface FilletFeature extends FeatBase {
  type: "fillet";
  r: number;
  edges: EdgeRef[];
  faces?: FaceRef[];
  /** sabit / değişken (başlangıç r, bitiş r2) / tam yuvarlak (seçili orta yüz) */
  kind?: "const" | "var" | "full";
  r2?: number;
  /** çoklu yarıçap: kenar başına yarıçap (edges ile aynı sırada) */
  radii?: number[];
}
export interface ChamferFeature extends FeatBase {
  type: "chamfer";
  d: number;
  edges: EdgeRef[];
  faces?: FaceRef[];
  /** eşit mesafe / iki mesafe / mesafe-açı */
  kind?: "equal" | "dd" | "da";
  d2?: number;
  angle?: number;
  flip?: boolean;
}

export interface SweepFeature extends FeatBase {
  type: "sweep";
  /** profil eskizi (kapalı) */
  sketch: string;
  /** yol eskizi (açık veya kapalı zincir) */
  path: string;
  cut: boolean;
  /** dairesel profil çapı (>0 ise profil eskizi gerekmez — boru/çubuk) */
  circ?: number;
  /** dairesel profilde iç çap (boru) */
  circIn?: number;
  /** profil yönelimi: yolu izle (varsayılan) / normali sabit tut */
  orient?: "follow" | "normal";
}
export interface LoftFeature extends FeatBase {
  type: "loft";
  /** sırasıyla profil eskizleri */
  sketches: string[];
  cut: boolean;
  ruled: boolean;
  /** merkez çizgisi eskizi (isteğe bağlı) */
  center?: string;
  /** sac geçiş parçası (loft büküm): sac kalınlığı — uçlar açık ince cidar */
  sheetT?: number;
  /** kılavuz eğri eskizleri (isteğe bağlı) */
  guides?: string[];
}

export type HoleType = "simple" | "cbore" | "csink" | "tap";
export type HoleStd = "iso" | "pipe" | "inch";
export interface HoleFeature extends FeatBase {
  type: "hole";
  htype: HoleType;
  /** standart boyut (M3…M24, G1/4, 1/4-20…) veya "custom" */
  size: string;
  /** standart: ISO metrik / boru dişi (G) / inç (UNC) */
  std?: HoleStd;
  /** kozmetik diş göster */
  cosmetic?: boolean;
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
/** Kaburga: açık eskizden, gövdeye kadar uzanan ince duvar */
export interface RibFeature extends FeatBase {
  type: "rib";
  sketch: string;
  t: number;
  /** kalınlık: orta / tek taraf / diğer taraf */
  side: "mid" | "one" | "rev";
  /** uzama yönü: eskize paralel / eskize dik */
  dir: "parallel" | "normal";
  flip: boolean;
}
export interface DomeFeature extends FeatBase { type: "dome"; face: FaceRef | null; h: number }
/** Sarma (projeksiyon yöntemi): eskiz silindirik yüze kabartma / oyma */
export interface WrapFeature extends FeatBase {
  type: "wrap";
  sketch: string;
  face: FaceRef | null;
  mode: "emboss" | "deboss";
  depth: number;
}
/** Ölçekle: gövdeyi bir noktaya göre düzgün ölçekler */
export interface ScaleFeature extends FeatBase { type: "scale"; factor: number; center: "origin" | "centroid" }
/** STEP içe aktarma */
export interface ImportFeature extends FeatBase { type: "import"; file: string; data: string }
/** Referans eksen / nokta / koordinat sistemi (yalnızca görüntü ve referans) */
export interface RefAxisFeature extends FeatBase { type: "axis"; p: Vec3; d: Vec3 }
export interface RefPointFeature extends FeatBase { type: "point"; p: Vec3 }
export interface CoordSysFeature extends FeatBase { type: "csys"; o: Vec3; x: Vec3; y: Vec3 }

export interface DraftFeature extends FeatBase {
  type: "draft";
  angle: number;
  /** nötr düzlem */
  plane: PlaneRef;
  faces: FaceRef[];
  rev: boolean;
}
export interface ShellFeature extends FeatBase { type: "shell"; t: number; faces: FaceRef[]; /** dışa kabuk */ out?: boolean }

export type AxisName = "x" | "y" | "z";
export interface LPatternFeature extends FeatBase {
  type: "lpattern";
  /** atlanacak örnekler: "i,j" (1'den; ör. "2,1") */
  skip?: string[];
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
  /** atlanacak örnek numaraları (1'den) */
  skip?: string[];
  feats: string[];
  axis: AxisName;
  /** referans eksen özelliği (varsa axis yerine kullanılır) */
  refAxis?: string;
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
  /** true: aslı silinir, yalnız aynalanmış gövde kalır (montajda ters el bileşen) */
  only?: boolean;
}
export interface PlaneFeature extends FeatBase {
  type: "plane";
  base: PlaneRef;
  offset: number;
  flip: boolean;
  /** SolidWorks düzlem türleri: öteleme (varsayılan), açılı, orta, 3 noktadan, kenara dik, noktadan paralel, ekrana paralel */
  mode?: "offset" | "angle" | "mid" | "3pt" | "normal" | "parallelPt" | "screen";
  /** açılı: dönme ekseni (kenar) */
  edge?: { m: Vec3; d: Vec3 } | null;
  angle?: number;
  /** orta düzlem: ikinci referans */
  base2?: PlaneRef;
  /** noktalar (3 nokta / kenara dik noktası / paralel nokta / ekran noktası) */
  pts?: Vec3[];
  /** ekrana paralel: oluşturulduğu andaki bakış yönü */
  nv?: Vec3;
}

// ---------------- Gövde işlemleri, ek çoğaltmalar, diş, esnet ----------------

export interface CombineFeature extends FeatBase { type: "combine"; op: "add" | "sub" | "common"; main: FaceRef | null; tools: FaceRef[] }
export interface SplitBodyFeature extends FeatBase { type: "splitbody"; body: FaceRef | null; plane: PlaneRef }
export interface MoveBodyFeature extends FeatBase { type: "movebody"; body: FaceRef | null; copy: boolean; d: Vec3; axis: "x" | "y" | "z"; angle: number }
export interface DeleteBodyFeature extends FeatBase { type: "delbody"; bodies: FaceRef[]; keep: boolean }
export interface IndentFeature extends FeatBase { type: "indent"; target: FaceRef | null; tool: FaceRef | null; clearance: number; keepTool: boolean }
/** Eskize bağlı çoğaltma: kopyalar eskiz noktalarına yerleşir */
export interface SketchPatternFeature extends FeatBase { type: "spattern"; feats: string[]; sketch: string }
/** Tabloya bağlı çoğaltma: her satır bir öteleme */
export interface TablePatternFeature extends FeatBase { type: "tpattern"; feats: string[]; rows: Vec3[] }
/** Eğriye bağlı çoğaltma */
export interface CurvePatternFeature extends FeatBase { type: "cvpattern"; feats: string[]; sketch: string; count: number; spacing: number; equal: boolean; align: boolean }
/** Doldurma çoğaltması: düz yüz içinde ızgara */
export interface FillPatternFeature extends FeatBase { type: "fpattern"; feats: string[]; face: FaceRef | null; spacing: number; layout: "square" | "stagger"; margin: number; angle: number }
/** Helisel diş */
export interface ThreadFeature extends FeatBase { type: "thread"; face: FaceRef | null; pitch: number; length: number; left: boolean; fromEnd: boolean }
/** Esnet: bük / bur / daralt / uzat (kesitlerden yeniden örme) */
export interface FlexFeature extends FeatBase { type: "flex"; body: FaceRef | null; mode: "bend" | "twist" | "taper" | "stretch"; axis: "x" | "y" | "z"; value: number; dir: "x" | "y" | "z" }
/** Köşe pahı: köşe noktasında üç kenarı keser */
export interface VertexChamferFeature extends FeatBase { type: "vchamfer"; v: Vec3 | null; d: number }

// ---------------- Sac metal ----------------

/** Taban flanş: kapalı eskizden düz levha, açık eskizden bükümlü profil. Sac parametrelerini taşır. */
export interface SheetBaseFeature extends FeatBase {
  type: "sheetbase";
  sketch: string;
  /** sac kalınlığı */
  t: number;
  /** iç büküm yarıçapı */
  r: number;
  /** K faktörü (nötr eksen konumu, 0..1) */
  k: number;
  /** büküm hesap yöntemi (SolidWorks): K-faktörü / büküm payı / büküm düşümü — BA/BD 90° için */
  bendMethod?: "k" | "ba" | "bd";
  ba?: number;
  bd?: number;
  /** kalınlık yönünü ters çevir */
  rev: boolean;
  /** açık profil: ekstrüzyon derinliği */
  d: number;
  /** açık profil: orta düzlem */
  mid: boolean;
  /** büküm boşaltma oranı (× kalınlık) */
  relief: number;
}
export type FlangePos = "inside" | "outside" | "bendout";
export type FlangeLen = "outer" | "inner" | "tangent";
/** Kenar flanş */
export interface EdgeFlangeFeature extends FeatBase {
  type: "edgeflange";
  edges: EdgeRef[];
  /** flanş uzunluğu */
  L: number;
  /** büküm açısı (derece) */
  angle: number;
  pos: FlangePos;
  lenRef: FlangeLen;
  flip: boolean;
  /** varsayılan büküm yarıçapını kullan */
  useDef: boolean;
  r: number;
  /** kenar başı / sonu kısaltma */
  o1: number;
  o2: number;
  /** köşe boşluğu (birlikte seçilen komşu kenarlarda gönye) */
  gap: number;
}
/** Kenet (hem) */
export interface HemFeature extends FeatBase {
  type: "hem";
  edges: EdgeRef[];
  kind: "closed" | "open";
  L: number;
  /** açık kenet aralığı */
  gap: number;
  pos: "inside" | "bendout";
  flip: boolean;
}
/** Çizgiden büküm: yüz üzerindeki eskiz çizgisinden levhayı büker */
export interface SketchBendFeature extends FeatBase {
  type: "sketchbend";
  sketch: string;
  angle: number;
  /** bükülecek taraf: çizginin sağı/solu */
  side: boolean;
  /** büküm yönü: yüzün normaline doğru / ters */
  flip: boolean;
  pos: "center" | "inside" | "outside";
  useDef: boolean;
  r: number;
}

// ---------------- Kaynaklı yapı ----------------

/** 3B eskiz: uzayda noktalar ve aralarındaki çizgiler (iskelet için) */
export interface Sketch3DFeature extends FeatBase {
  type: "sketch3d";
  /** nokta kimlikleri ve koordinatları (paralel diziler; denklemler xyz[i][k] ile bağlanır) */
  ids: string[];
  xyz: Vec3[];
  lines: { id: string; a: string; b: string; cons?: boolean; /** eksen boyunca ilişkisi (Along X/Y/Z) */ ax?: "x" | "y" | "z" }[];
  /** köşe büküm yarıçapı (0 = keskin köşe) */
  r: number;
  seq: number;
  /** 3B ilişkiler (çakışık, sabit, paralel, dik, eşit, orta nokta, üzerinde, doğrusal, düzleme paralel) */
  cons3?: { id: string; t: import("../sketch/solver3d").Rel3; e: string[]; p?: Vec3 }[];
  /** 3B sürücü ölçüler: çizgi boyu, iki nokta arası, iki çizgi arası açı */
  dims3?: { id: string; t: "len" | "dist" | "ang" | "rad"; e: string[]; v: number }[];
  /** 3B yaylar: başlangıç a, bitiş b, yay üzerindeki nokta m (nokta kimlikleri) */
  arcs3?: { id: string; a: string; b: string; m: string; cons?: boolean }[];
}

/** Eleman referansı: yapı elemanı özelliği + segment sırası */
export interface MemberRef { f: string; i: number }
export type CornerKind = "miter" | "butt1" | "butt2" | "none";
/** Yapı elemanı: iskelet eskiz segmentleri boyunca standart profil */
export interface MemberFeature extends FeatBase {
  type: "member";
  /** seçili segmentler: eskiz kimliği + varlık kimliği */
  segs: { sk: string; ent: string }[];
  std: string;
  size: string;
  /** profil konumu (delme noktası) */
  align: string;
  mirror: boolean;
  /** profil dönüş açısı (derece) */
  rot: number;
  corner: CornerKind;
  /** gönye köşesinde boşluk */
  gap: number;
  /** delme noktasına ek öteleme (profil koordinatlarında, mm) */
  poff?: [number, number];
  /** profil yönü sürümü: 2 = SolidWorks (profil Y ekseni = eskiz normali / dünya yukarısı); yoksa eski (v0.17 öncesi) yön */
  ori?: 2;
  /** profil ekseni hizalama (SolidWorks Alignment): eksen + hedef yön */
  alignAx?: "h" | "v";
  alignTo?: Vec3;
  /** 1. grubun kırpma önceliği */
  prio?: number;
  /** ek gruplar (1. grup = özelliğin kendi alanları) */
  groups?: MemberGroup[];
  /** önceki yapı elemanı özelliklerine değen uçları onların yüzünde kırp (varsayılan açık) */
  trimPrev?: boolean;
}
/** Yapı elemanı grubu: kendi segmentleri ve profil konumu / köşe işlemi */
export interface MemberGroup {
  segs: { sk: string; ent: string }[];
  /** grubun kendi profili (boşsa özelliğin profili) */
  std?: string;
  size?: string;
  align: string;
  mirror: boolean;
  rot: number;
  poff?: [number, number];
  corner: CornerKind;
  gap: number;
  alignAx?: "h" | "v";
  alignTo?: Vec3;
  /** gruplar arası birleşimde kırpma önceliği (küçük = sürekli kalır); boşsa otomatik */
  prio?: number;
}
/** Kırp / uzat: hedef elemanları sınır elemanlara göre kırpar ve gerekiyorsa uzatır */
export interface TrimFeature extends FeatBase { type: "trim"; targets: MemberRef[]; bounds: MemberRef[]; /** profile göre kesim (koplama) */ coped?: boolean; /** sınır düz yüzler (ör. taban levhası) */ faces?: FaceRef[] }
/** Uç kapağı */
export interface EndCapFeature extends FeatBase { type: "endcap"; faces: FaceRef[]; t: number; inset: number }
/** Kaynak dikişi (köşe kaynağı) */
export interface WeldFeature extends FeatBase {
  type: "weld";
  pairs: { f1: FaceRef; f2: FaceRef }[];
  /** kaynak kalınlığı (a ölçüsü) */
  a: number;
  intermittent: boolean;
  /** kesikli: dikiş boyu ve adım (merkezden merkeze) */
  len: number;
  pitch: number;
}
/** Köşe takviyesi (üçgen levha) */
export interface GussetFeature extends FeatBase {
  type: "gusset";
  f1: FaceRef | null;
  f2: FaceRef | null;
  d1: number;
  d2: number;
  t: number;
  /** iç köşe pahı (kaynak boşluğu) */
  chamfer: number;
  /** köşe çizgisi boyunca kaydırma */
  offset: number;
}

/** Kademe (jog): sacın düz yüzündeki çizgiden iki bükümlü ötelenmiş kademe */
export interface SheetJogFeature extends FeatBase { type: "sheetjog"; sketch: string; H: number; side: boolean; flip: boolean; useDef: boolean; r: number }
/** Gönye flanş: açık profil eskizi, seçilen kenar zinciri boyunca köşeleri gönyelenerek */
export interface MiterFlangeFeature extends FeatBase { type: "miterflange"; sketch: string; edges: EdgeRef[]; rev: boolean; gap: number }
/** Köşe kapatma: flanş uç yüzünü komşu flanşa kadar uzatır */
export interface CloseCornerFeature extends FeatBase { type: "closecorner"; faces: FaceRef[]; overlap: boolean; gap: number }
/** Katıdan saca dönüştür: büküm kenarlarına yarıçap, köşe kenarlarına yarık */
export interface ToSheetFeature extends FeatBase { type: "tosheet"; bends: EdgeRef[]; rips: EdgeRef[]; t: number; r: number; k: number; relief: number; gap: number }

export type Feature =
  | SheetJogFeature
  | MiterFlangeFeature
  | CloseCornerFeature
  | ToSheetFeature
  | CombineFeature
  | SplitBodyFeature
  | MoveBodyFeature
  | DeleteBodyFeature
  | IndentFeature
  | SketchPatternFeature
  | TablePatternFeature
  | CurvePatternFeature
  | FillPatternFeature
  | ThreadFeature
  | FlexFeature
  | VertexChamferFeature
  | Sketch3DFeature
  | MemberFeature
  | WeldFeature
  | TrimFeature
  | EndCapFeature
  | GussetFeature
  | SheetBaseFeature
  | EdgeFlangeFeature
  | HemFeature
  | SketchBendFeature
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
  | DraftFeature
  | RibFeature
  | DomeFeature
  | WrapFeature
  | ScaleFeature
  | ImportFeature
  | RefAxisFeature
  | RefPointFeature
  | CoordSysFeature;

export type FeatureType = Feature["type"];

export interface PartDoc {
  version: 2;
  name: string;
  features: Feature[];
  seq: Record<string, number>;
  /** malzeme anahtarı (bkz. MATERIALS) */
  material?: string;
  /** geri sarma çubuğu: bu indeksten sonraki özellikler hesaplanmaz */
  rollback?: number | null;
  /** global değişkenler: ad -> ifade */
  vars?: Record<string, string>;
  /** özellik alanlarına bağlı denklemler: "özellikId.alan" -> ifade */
  eqs?: Record<string, string>;
  /** belgeye gömülü özel profiller (kimlik -> ad + konturlar) */
  profiles?: Record<string, { name: string; loops: Loop[] }>;
}

// ---------------- Çekirdeğe giden çözülmüş tanımlar ----------------

export type Seg =
  | { t: "l"; a: Vec2; b: Vec2 }
  | { t: "a"; a: Vec2; b: Vec2; m: Vec2 }
  | { t: "c"; a: Vec2; b: Vec2; c1: Vec2; c2: Vec2 }
  | { t: "q"; a: Vec2; b: Vec2; k: Vec2 }
  | { t: "e"; a: Vec2; b: Vec2; rx: number; ry: number; rot: number; long: boolean; sweep: boolean };
export type Loop =
  | { circle: { c: Vec2; r: number }; depth: number }
  | { ellipse: { c: Vec2; rx: number; ry: number; rot: number }; depth: number }
  | { segs: Seg[]; depth: number };
export interface TextItem { text: string; x: number; y: number; size: number; angle: number }

/** Eskiz düzlemi: yüz üzerindeyse çekirdek yüzü bulup çerçeveyi günceller */
export interface KPlane { frame: Frame; face?: FaceRef; sketchId?: string }

export type KFeature =
  | { id: string; type: "extrude"; fromFace?: FaceRef | null; fromVtx?: Vec3 | null; vtx?: Vec3 | null; bodyRef?: FaceRef | null; dirVec?: Vec3 | null; flipCut?: boolean; startOff?: number; cut: boolean; pl: KPlane; loops: Loop[]; texts?: TextItem[]; end: EndCond; d1: number; rev: boolean; dir2: boolean; end2: "blind" | "through"; d2: number; face?: FaceRef | null; offd?: number; draft?: number; draftOut?: boolean; twist?: number; merge?: boolean }
  | { id: string; type: "revolve"; cut: boolean; pl: KPlane; loops: Loop[]; axis: [Vec2, Vec2]; angle: number; mid: boolean; rev: boolean; merge?: boolean }
  | { id: string; type: "fillet"; r: number; edges: EdgeRef[]; faces?: FaceRef[]; kind?: "const" | "var" | "full"; r2?: number; radii?: number[] }
  | { id: string; type: "chamfer"; d: number; edges: EdgeRef[]; faces?: FaceRef[]; kind?: "equal" | "dd" | "da"; d2?: number; angle?: number; flip?: boolean }
  | { id: string; type: "rib"; pl: KPlane; chain: Seg[]; normal: boolean; flip: boolean; t: number; side: "mid" | "one" | "rev" }
  | { id: string; type: "dome"; face: FaceRef; h: number }
  | { id: string; type: "wrap"; pl: KPlane; loops: Loop[]; texts?: TextItem[]; face: FaceRef; mode: "emboss" | "deboss"; depth: number }
  | { id: string; type: "scale"; factor: number; center: "origin" | "centroid" }
  | { id: string; type: "import"; data: string }
  | { id: string; type: "sweep"; cut: boolean; pl: KPlane | null; loops: Loop[]; path: { pl: KPlane; segs: Seg[]; closed: boolean }; circ?: number; circIn?: number; orient?: "follow" | "normal" }
  | { id: string; type: "loft"; sheetT?: number; cut: boolean; ruled: boolean; profiles: { pl: KPlane; loops: Loop[] }[]; center?: { pl: KPlane; segs: Seg[]; closed: boolean }; guides?: Vec3[][] }
  | { id: string; type: "hole"; pl: KPlane; pts: Vec2[]; htype: HoleType; d: number; depth: number; through: boolean; cd: number; cdepth: number; cangle: number }
  | { id: string; type: "draft"; angle: number; frame: Frame; faces: FaceRef[]; rev: boolean }
  | { id: string; type: "shell"; t: number; faces: FaceRef[]; out?: boolean }
  | { id: string; type: "lpattern"; feats: string[]; dirs: { v: Vec3; count: number; spacing: number }[]; skip?: string[] }
  | { id: string; type: "cpattern"; feats: string[]; axis: Vec3; origin?: Vec3; count: number; angle: number; skip?: string[] }
  | { id: string; type: "mirror"; feats: string[]; body: boolean; frame: Frame; only?: boolean }
  | { id: string; type: "sheetbase"; pl: KPlane; loops: Loop[]; open: boolean; t: number; rev: boolean; d: number; mid: boolean; merge?: boolean }
  | { id: string; type: "edgeflange"; edges: EdgeRef[]; L: number; angle: number; pos: FlangePos; lenRef: FlangeLen; flip: boolean; r: number; t: number; o1: number; o2: number; gap: number; relief: number }
  | { id: string; type: "sheetjog"; pl: KPlane; line: [Vec2, Vec2]; H: number; side: boolean; flip: boolean; r: number; t: number }
  | { id: string; type: "miterflange"; skFrame: Frame; chain: Seg[]; edges: EdgeRef[]; t: number; r: number; gap: number; rev: boolean }
  | { id: string; type: "closecorner"; faces: FaceRef[]; overlap: boolean; gap: number; t: number; r: number }
  | { id: string; type: "tosheet"; bends: EdgeRef[]; rips: EdgeRef[]; t: number; r: number; gap: number }
  | { id: string; type: "combine"; op: "add" | "sub" | "common"; main: FaceRef; tools: FaceRef[] }
  | { id: string; type: "splitbody"; body: FaceRef; frame: Frame }
  | { id: string; type: "movebody"; body: FaceRef; copy: boolean; d: Vec3; axis: Vec3; angle: number }
  | { id: string; type: "delbody"; bodies: FaceRef[]; keep: boolean }
  | { id: string; type: "indent"; target: FaceRef; tool: FaceRef; clearance: number; keepTool: boolean }
  | { id: string; type: "spattern"; feats: string[]; pts: Vec3[]; n: Vec3 }
  | { id: string; type: "tpattern"; feats: string[]; rows: Vec3[] }
  | { id: string; type: "cvpattern"; feats: string[]; path: Vec3[]; n: Vec3; count: number; spacing: number; equal: boolean; align: boolean }
  | { id: string; type: "fpattern"; feats: string[]; face: FaceRef; spacing: number; layout: "square" | "stagger"; margin: number; angle: number }
  | { id: string; type: "thread"; face: FaceRef; pitch: number; length: number; left: boolean; fromEnd: boolean }
  | { id: string; type: "flex"; body: FaceRef; mode: "bend" | "twist" | "taper" | "stretch"; axis: Vec3; value: number; dir: Vec3 }
  | { id: string; type: "vchamfer"; v: Vec3; d: number }
  | { id: string; type: "member"; items: MemberItem[]; loops: Loop[]; name: string; R: number; corner: CornerKind; gap: number; ori?: 2; auto?: boolean; gl?: { loops: Loop[]; R: number; corner: CornerKind; gap: number; auto?: boolean; prio?: number; name?: string }[]; tp?: boolean }
  | { id: string; type: "weld"; pairs: { f1: FaceRef; f2: FaceRef }[]; a: number; intermittent: boolean; len: number; pitch: number }
  | { id: string; type: "trim"; targets: string[]; bounds: string[]; coped?: boolean; faces?: FaceRef[] }
  | { id: string; type: "endcap"; faces: FaceRef[]; t: number; inset: number }
  | { id: string; type: "gusset"; f1: FaceRef; f2: FaceRef; d1: number; d2: number; t: number; chamfer: number; offset: number }
  | { id: string; type: "sketchbend"; pl: KPlane; line: [Vec2, Vec2]; angle: number; side: boolean; flip: boolean; pos: "center" | "inside" | "outside"; r: number; t: number; k: number };

/** Yapı elemanı segmenti (3B): çizgi veya yay; n = eskiz düzlemi normali */
export type MemberItem = ({ k: "l"; a: Vec3; b: Vec3; n: Vec3; key: string } | { k: "a"; a: Vec3; b: Vec3; m: Vec3; n: Vec3; key: string }) & { g?: number };
/** Yapı elemanı için segment grubu: teğet zincirler tek gövde olarak süpürülür */
/** Kesim listesi satırı (gövde başına) */
export interface CutItem {
  body: number;
  kind: "member" | "plate" | "part";
  name: string;
  /** eleman: kesim boyu; levha / parça: en büyük ölçü */
  length: number;
  /** uç kesim açıları (derece, 0 = dik kesim) */
  a1: number;
  a2: number;
  vol: number;
  /** sınır kutusu ölçüleri (büyükten küçüğe) */
  dims: [number, number, number];
  key?: string;
}

/** İmalat resmi görünüşü (mm, görünüş düzleminde) */
export interface DrawView {
  name: string;
  /** görünür / gizli çizgiler: [x1,y1,x2,y2] dizileri */
  vis: number[];
  hid: number[];
  circles: { c: Vec2; r: number; hidden: boolean }[];
  min: Vec2;
  max: Vec2;
}
export interface DrawHole { view: number; c: Vec2; d: number }
export interface DrawData {
  kind: "member" | "plate" | "part";
  views: DrawView[];
  holes: DrawHole[];
  /** elemanlar: boy ve uç açıları; levha: kalınlık */
  length: number;
  a1: number;
  a2: number;
  t?: number;
  error?: string;
}

/** Kaynak tablosu satırı */
export interface WeldItem { name: string; a: number; length: number; count: number; vol: number }

/** Açınım (düz desen) 2B öğeleri: çizgi, yay (saat yönü tersine a0→a1, derece), daire */
export type Flat2D =
  | { k: "l"; a: Vec2; b: Vec2 }
  | { k: "a"; c: Vec2; r: number; a0: number; a1: number }
  | { k: "c"; c: Vec2; r: number };
export interface FlatBend { a: Vec2; b: Vec2; up: boolean; angle: number; r: number; a3: Vec3; b3: Vec3 }
export interface FlatResult {
  mesh: MeshData | null;
  outline: Flat2D[];
  bends: FlatBend[];
  /** levha ölçüleri ve alanı */
  w: number;
  h: number;
  area: number;
  error?: string;
}

export interface FaceInfo { c: Vec3; n: Vec3 | null; type: string; /** gövde sırası */ b?: number; /** silindir yarıçapı */ r?: number }
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
  /** gövde sayısı */
  bodies?: number;
}

export type SectionItem =
  | { k: "line"; s: Vec3; e: Vec3 }
  | { k: "circle"; c: Vec3; r: number; closed: boolean; s: Vec3; e: Vec3; m: Vec3 }
  | { k: "poly"; pts: Vec3[] };

export type MeasureItem = { k: "edge"; ref: EdgeRef } | { k: "face"; ref: FaceRef };

export interface MassProps {
  volume: number;
  area: number;
  com: Vec3;
  bbox: { min: Vec3; max: Vec3 };
}

export type KernelRequest =
  | { id: number; type: "build"; features: KFeature[]; fontUrl?: string }
  | { id: number; type: "section"; frame: Frame }
  | { id: number; type: "export"; format: "step" | "stl" }
  | { id: number; type: "measure"; items: MeasureItem[] }
  | { id: number; type: "props" }
  | { id: number; type: "flat"; body: number; t: number; k: number }
  | { id: number; type: "cutlist" }
  | { id: number; type: "exportBody"; body: number }
  | { id: number; type: "drawing"; body: number }
  | { id: number; type: "interfere" }
  | { id: number; type: "asm"; op: "step" | "interfere"; parts: { features: KFeature[]; q: number[]; p: Vec3; name: string }[] };

export type KernelResponse =
  | { type: "ready" }
  | { type: "fatal"; message: string }
  | { id: number; type: "built"; mesh: MeshData | null; errors: { featureId: string; message: string }[]; frames: Record<string, Frame>; members?: { key: string; name: string; body: number }[] }
  | { id: number; type: "measured"; lines: string[] }
  | { id: number; type: "section"; items: SectionItem[] }
  | { id: number; type: "props"; props: MassProps | null }
  | { id: number; type: "exported"; blob: Blob | null; message?: string }
  | ({ id: number; type: "flat" } & FlatResult)
  | { id: number; type: "cutlist"; items: CutItem[]; welds: WeldItem[] }
  | ({ id: number; type: "drawing" } & DrawData)
  | { id: number; type: "interfere"; pairs: { a: number; b: number; vol: number }[] }
  | { id: number; type: "asm"; blob?: Blob | null; pairs?: { a: number; b: number; vol: number }[]; message?: string };

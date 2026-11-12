// Kaynaklı yapı profil kütüphanesi (EN standart ölçüleri, mm).
// Profil düzlemi: y = yükseklik (eskiz düzleminde, elemana dik), x = genişlik (eskiz düzlemine dik).
import type { Loop, Seg, Vec2 } from "../doc/types";

export type ProfileStd = "kutu" | "dkutu" | "boru" | "L" | "U" | "IPE" | "HEA" | "HEB" | "lama" | "yuvarlak" | "kare";
export type Align = "c" | "g" | "t" | "b" | "l" | "r" | "tl" | "tr" | "bl" | "br";

export const PROFILES: Record<ProfileStd, { label: string; std: string; sizes: Record<string, number[]> }> = {
  kutu: {
    label: "Kare kutu profil",
    std: "EN 10219",
    // a, t
    sizes: { "20x20x2": [20, 2], "25x25x2": [25, 2], "30x30x2": [30, 2], "30x30x3": [30, 3], "40x40x2": [40, 2], "40x40x3": [40, 3], "40x40x4": [40, 4], "50x50x2": [50, 2], "50x50x3": [50, 3], "50x50x4": [50, 4], "60x60x3": [60, 3], "60x60x4": [60, 4], "70x70x4": [70, 4], "80x80x3": [80, 3], "80x80x4": [80, 4], "80x80x5": [80, 5], "90x90x4": [90, 4], "100x100x4": [100, 4], "100x100x5": [100, 5], "100x100x6": [100, 6], "120x120x5": [120, 5], "120x120x6": [120, 6], "140x140x6": [140, 6], "150x150x6": [150, 6], "150x150x8": [150, 8], "200x200x8": [200, 8] },
  },
  dkutu: {
    label: "Dikdörtgen kutu profil",
    std: "EN 10219",
    // h, b, t
    sizes: { "30x20x2": [30, 20, 2], "40x20x2": [40, 20, 2], "40x30x2": [40, 30, 2], "50x30x2": [50, 30, 2], "50x30x3": [50, 30, 3], "60x30x2": [60, 30, 2], "60x40x2": [60, 40, 2], "60x40x3": [60, 40, 3], "80x40x2": [80, 40, 2], "80x40x3": [80, 40, 3], "80x40x4": [80, 40, 4], "80x60x3": [80, 60, 3], "100x40x3": [100, 40, 3], "100x50x3": [100, 50, 3], "100x50x4": [100, 50, 4], "100x60x4": [100, 60, 4], "120x60x4": [120, 60, 4], "120x80x4": [120, 80, 4], "140x80x5": [140, 80, 5], "150x100x5": [150, 100, 5], "160x80x5": [160, 80, 5], "200x100x6": [200, 100, 6] },
  },
  boru: {
    label: "Boru",
    std: "EN 10219 / EN 10255",
    // D, t
    sizes: { "21.3x2.6": [21.3, 2.6], "26.9x2.6": [26.9, 2.6], "33.7x3.2": [33.7, 3.2], "42.4x3.2": [42.4, 3.2], "48.3x3.2": [48.3, 3.2], "60.3x3.6": [60.3, 3.6], "76.1x3.6": [76.1, 3.6], "88.9x4": [88.9, 4], "101.6x4": [101.6, 4], "114.3x4.5": [114.3, 4.5], "139.7x5": [139.7, 5], "168.3x5": [168.3, 5] },
  },
  L: {
    label: "Eşit kollu köşebent (L)",
    std: "EN 10056-1",
    // a, t, r1
    sizes: { "20x20x3": [20, 3, 3.5], "25x25x3": [25, 3, 3.5], "25x25x4": [25, 4, 3.5], "30x30x3": [30, 3, 5], "30x30x4": [30, 4, 5], "35x35x4": [35, 4, 5], "40x40x4": [40, 4, 6], "40x40x5": [40, 5, 6], "45x45x5": [45, 5, 7], "50x50x5": [50, 5, 7], "50x50x6": [50, 6, 7], "60x60x6": [60, 6, 8], "60x60x8": [60, 8, 8], "70x70x7": [70, 7, 9], "80x80x8": [80, 8, 10], "90x90x9": [90, 9, 11], "100x100x10": [100, 10, 12], "120x120x12": [120, 12, 13] },
  },
  U: {
    label: "U profil (UPN)",
    std: "DIN 1026-1 (%8 eğimli flanş)",
    // h, b, tw, tf, r1
    sizes: { "UPN 50": [50, 38, 5, 7, 7], "UPN 65": [65, 42, 5.5, 7.5, 7.5], "UPN 80": [80, 45, 6, 8, 8], "UPN 100": [100, 50, 6, 8.5, 8.5], "UPN 120": [120, 55, 7, 9, 9], "UPN 140": [140, 60, 7, 10, 10], "UPN 160": [160, 65, 7.5, 10.5, 10.5], "UPN 180": [180, 70, 8, 11, 11], "UPN 200": [200, 75, 8.5, 11.5, 11.5], "UPN 220": [220, 80, 9, 12.5, 12.5], "UPN 240": [240, 85, 9.5, 13, 13] },
  },
  IPE: {
    label: "I profil (IPE)",
    std: "EN 10365",
    // h, b, tw, tf, r
    sizes: { "IPE 80": [80, 46, 3.8, 5.2, 5], "IPE 100": [100, 55, 4.1, 5.7, 7], "IPE 120": [120, 64, 4.4, 6.3, 7], "IPE 140": [140, 73, 4.7, 6.9, 7], "IPE 160": [160, 82, 5, 7.4, 9], "IPE 180": [180, 91, 5.3, 8, 9], "IPE 200": [200, 100, 5.6, 8.5, 12], "IPE 220": [220, 110, 5.9, 9.2, 12], "IPE 240": [240, 120, 6.2, 9.8, 15], "IPE 270": [270, 135, 6.6, 10.2, 15], "IPE 300": [300, 150, 7.1, 10.7, 15] },
  },
  HEA: {
    label: "Geniş başlıklı I (HEA)",
    std: "EN 10365",
    sizes: { "HEA 100": [96, 100, 5, 8, 12], "HEA 120": [114, 120, 5, 8, 12], "HEA 140": [133, 140, 5.5, 8.5, 12], "HEA 160": [152, 160, 6, 9, 15], "HEA 180": [171, 180, 6, 9.5, 15], "HEA 200": [190, 200, 6.5, 10, 18], "HEA 220": [210, 220, 7, 11, 18], "HEA 240": [230, 240, 7.5, 12, 21], "HEA 260": [250, 260, 7.5, 12.5, 24], "HEA 280": [270, 280, 8, 13, 24], "HEA 300": [290, 300, 8.5, 14, 27] },
  },
  HEB: {
    label: "Geniş başlıklı I (HEB)",
    std: "EN 10365",
    sizes: { "HEB 100": [100, 100, 6, 10, 12], "HEB 120": [120, 120, 6.5, 11, 12], "HEB 140": [140, 140, 7, 12, 12], "HEB 160": [160, 160, 8, 13, 15], "HEB 180": [180, 180, 8.5, 14, 15], "HEB 200": [200, 200, 9, 15, 18], "HEB 220": [220, 220, 9.5, 16, 18], "HEB 240": [240, 240, 10, 17, 21], "HEB 260": [260, 260, 10, 17.5, 24], "HEB 280": [280, 280, 10.5, 18, 24], "HEB 300": [300, 300, 11, 19, 27] },
  },
  lama: {
    label: "Lama (yassı çubuk)",
    std: "EN 10058",
    // b (yükseklik), t
    sizes: { "20x3": [20, 3], "20x5": [20, 5], "25x5": [25, 5], "30x3": [30, 3], "30x5": [30, 5], "40x4": [40, 4], "40x5": [40, 5], "40x8": [40, 8], "50x5": [50, 5], "50x8": [50, 8], "50x10": [50, 10], "60x6": [60, 6], "60x10": [60, 10], "80x8": [80, 8], "80x10": [80, 10], "100x10": [100, 10], "100x15": [100, 15], "120x10": [120, 10], "150x10": [150, 10] },
  },
  yuvarlak: {
    label: "Yuvarlak dolu çubuk",
    std: "EN 10060",
    sizes: Object.fromEntries([8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 30, 32, 35, 40, 45, 50, 60, 70, 80].map((d) => [`Ø${d}`, [d]])),
  },
  kare: {
    label: "Kare dolu çubuk",
    std: "EN 10059",
    sizes: Object.fromEntries([8, 10, 12, 14, 16, 20, 25, 30, 35, 40, 50].map((a) => [`□${a}`, [a]])),
  },
};

export const ALIGN_NAMES: Record<Align, string> = {
  c: "Merkez",
  g: "Ağırlık merkezi",
  t: "Üst orta",
  b: "Alt orta",
  l: "Sol orta",
  r: "Sağ orta",
  tl: "Sol üst köşe",
  tr: "Sağ üst köşe",
  bl: "Sol alt köşe",
  br: "Sağ alt köşe",
};

const sub = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];
const add = (a: Vec2, b: Vec2): Vec2 => [a[0] + b[0], a[1] + b[1]];
const mul = (a: Vec2, k: number): Vec2 => [a[0] * k, a[1] * k];
const nrm = (a: Vec2): Vec2 => mul(a, 1 / (Math.hypot(a[0], a[1]) || 1));

/** Köşeleri yuvarlatılmış kapalı çokgen (her köşe için yarıçap; 0 = keskin) */
export function filletPoly(pts: Vec2[], radii: number[]): Seg[] {
  const n = pts.length;
  const corners = pts.map((P, i) => {
    const r = radii[i] ?? 0;
    if (r <= 1e-9) return { A: P, B: P, M: null as Vec2 | null };
    const up = nrm(sub(pts[(i - 1 + n) % n], P)), un = nrm(sub(pts[(i + 1) % n], P));
    const th = Math.acos(Math.max(-1, Math.min(1, up[0] * un[0] + up[1] * un[1])));
    const T = r / Math.tan(th / 2);
    const bis = nrm(add(up, un));
    const C = add(P, mul(bis, r / Math.sin(th / 2)));
    return { A: add(P, mul(up, T)), B: add(P, mul(un, T)), M: sub(C, mul(bis, r)) };
  });
  const segs: Seg[] = [];
  for (let i = 0; i < n; i++) {
    const c = corners[i], nx = corners[(i + 1) % n];
    if (c.M) segs.push({ t: "a", a: c.A, b: c.B, m: c.M });
    if (Math.hypot(nx.A[0] - c.B[0], nx.A[1] - c.B[1]) > 1e-9) segs.push({ t: "l", a: c.B, b: nx.A });
  }
  return segs;
}

const rectPts = (w: number, h: number): Vec2[] => [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];

/** Profilin ham (hizalanmamış) konturları */
export function rawProfile(std: ProfileStd, size: string): Loop[] {
  const p = PROFILES[std]?.sizes[size];
  if (!p) throw new Error(`Profil ölçüsü bulunamadı: ${size}`);
  switch (std) {
    case "kutu":
    case "dkutu": {
      const [h, b, t] = std === "kutu" ? [p[0], p[0], p[1]] : p;
      const ro = 2 * t, ri = t;
      return [
        { segs: filletPoly(rectPts(b, h), [ro, ro, ro, ro]), depth: 0 },
        { segs: filletPoly(rectPts(b - 2 * t, h - 2 * t), [ri, ri, ri, ri]), depth: 1 },
      ];
    }
    case "boru":
      return [
        { circle: { c: [0, 0], r: p[0] / 2 }, depth: 0 },
        { circle: { c: [0, 0], r: p[0] / 2 - p[1] }, depth: 1 },
      ];
    case "yuvarlak":
      return [{ circle: { c: [0, 0], r: p[0] / 2 }, depth: 0 }];
    case "kare":
      return [{ segs: filletPoly(rectPts(p[0], p[0]), [0, 0, 0, 0]), depth: 0 }];
    case "lama":
      return [{ segs: filletPoly(rectPts(p[1], p[0]), [0, 0, 0, 0]), depth: 0 }];
    case "L": {
      const [a, t, r1] = p;
      const r2 = r1 / 2;
      const pts: Vec2[] = [[0, 0], [a, 0], [a, t], [t, t], [t, a], [0, a]];
      return [{ segs: filletPoly(pts, [0, 0, r2, r1, r2, 0]), depth: 0 }];
    }
    case "U": {
      // UPN: flanş iç yüzü %8 eğimli; tf flanş ortasında ölçülür
      const [h, b, tw, tf, r1] = p;
      const r2 = r1 / 2;
      const half = (b - tw) / 2;
      const yW = tf + 0.08 * half, yT = tf - 0.08 * half;
      const pts: Vec2[] = [[0, 0], [b, 0], [b, yT], [tw, yW], [tw, h - yW], [b, h - yT], [b, h], [0, h]];
      return [{ segs: filletPoly(pts, [0, 0, r2, r1, r1, r2, 0, 0]), depth: 0 }];
    }
    case "IPE":
    case "HEA":
    case "HEB": {
      const [h, b, tw, tf, r] = p;
      const x1 = b / 2, x2 = tw / 2, y1 = h / 2, y2 = h / 2 - tf;
      const pts: Vec2[] = [[-x1, -y1], [x1, -y1], [x1, -y2], [x2, -y2], [x2, y2], [x1, y2], [x1, y1], [-x1, y1], [-x1, y2], [-x2, y2], [-x2, -y2], [-x1, -y2]];
      return [{ segs: filletPoly(pts, [0, 0, 0, r, r, 0, 0, 0, 0, r, r, 0]), depth: 0 }];
    }
  }
}

function loopPoints(l: Loop): Vec2[] {
  if ("circle" in l) return Array.from({ length: 48 }, (_, i) => [l.circle.c[0] + l.circle.r * Math.cos((i / 48) * 2 * Math.PI), l.circle.c[1] + l.circle.r * Math.sin((i / 48) * 2 * Math.PI)] as Vec2);
  if ("ellipse" in l) return [];
  const out: Vec2[] = [];
  for (const s of l.segs) {
    out.push(s.a);
    if (s.t === "a") out.push(s.m);
  }
  return out;
}
const area2 = (pl: Vec2[]) => pl.reduce((s, p, i) => { const q = pl[(i + 1) % pl.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;

/** Kesit alanı (mm²) ve ağırlık merkezi */
export function sectionProps(loops: Loop[]): { area: number; c: Vec2 } {
  let A = 0, cx = 0, cy = 0;
  for (const l of loops) {
    const pts = "circle" in l ? loopPoints(l) : sampleLoop(l);
    const a = Math.abs(area2(pts)) * (l.depth % 2 ? -1 : 1);
    const c = pts.reduce((s, p) => add(s, p), [0, 0] as Vec2);
    A += a;
    cx += (a * c[0]) / pts.length;
    cy += (a * c[1]) / pts.length;
  }
  return { area: A, c: [cx / (A || 1), cy / (A || 1)] };
}
export function sampleLoop(l: Loop): Vec2[] {
  if ("circle" in l || "ellipse" in l) return loopPoints(l);
  const out: Vec2[] = [];
  for (const s of l.segs) {
    if (s.t !== "a") {
      out.push(s.a);
      continue;
    }
    // yay: 3 noktadan 8 parçaya böl
    const d = 2 * (s.a[0] * (s.m[1] - s.b[1]) + s.m[0] * (s.b[1] - s.a[1]) + s.b[0] * (s.a[1] - s.m[1]));
    if (Math.abs(d) < 1e-12) { out.push(s.a); continue; }
    const q = (p: Vec2) => p[0] * p[0] + p[1] * p[1];
    const ux = (q(s.a) * (s.m[1] - s.b[1]) + q(s.m) * (s.b[1] - s.a[1]) + q(s.b) * (s.a[1] - s.m[1])) / d;
    const uy = (q(s.a) * (s.b[0] - s.m[0]) + q(s.m) * (s.a[0] - s.b[0]) + q(s.b) * (s.m[0] - s.a[0])) / d;
    const r = Math.hypot(s.a[0] - ux, s.a[1] - uy);
    const a0 = Math.atan2(s.a[1] - uy, s.a[0] - ux), am = Math.atan2(s.m[1] - uy, s.m[0] - ux), a1 = Math.atan2(s.b[1] - uy, s.b[0] - ux);
    const nz = (x: number) => ((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const ccw = nz(am - a0) < nz(a1 - a0);
    const span = ccw ? nz(a1 - a0) : -nz(a0 - a1);
    for (let i = 0; i < 8; i++) out.push([ux + r * Math.cos(a0 + (span * i) / 8), uy + r * Math.sin(a0 + (span * i) / 8)]);
  }
  return out;
}

const mapLoop = (l: Loop, f: (p: Vec2) => Vec2): Loop => {
  if ("circle" in l) return { circle: { c: f(l.circle.c), r: l.circle.r }, depth: l.depth };
  if ("ellipse" in l) return l;
  return { segs: l.segs.map((s) => (s.t === "a" ? { t: "a", a: f(s.a), b: f(s.b), m: f(s.m) } : { ...s, a: f(s.a), b: f(s.b) }) as Seg), depth: l.depth };
};

/** Hizalanmış, aynalanmış ve döndürülmüş profil: (0,0) eleman ekseni üzerindedir */
export function placedProfile(std: ProfileStd, size: string, align: Align, mirror: boolean, rotDeg: number, custom?: Loop[], off?: Vec2): { loops: Loop[]; area: number; R: number } {
  let loops = custom ?? rawProfile(std, size);
  const pts = loops.flatMap(sampleLoop);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const sp = sectionProps(loops);
  const ref: Vec2 =
    align === "g" ? sp.c
    : align === "t" ? [cx, y1]
    : align === "b" ? [cx, y0]
    : align === "l" ? [x0, cy]
    : align === "r" ? [x1, cy]
    : align === "tl" ? [x0, y1]
    : align === "tr" ? [x1, y1]
    : align === "bl" ? [x0, y0]
    : align === "br" ? [x1, y0]
    : [cx, cy];
  const a = (rotDeg * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
  loops = loops.map((l) =>
    mapLoop(l, (p) => {
      // SolidWorks "profili konumlandır": delme noktasına ek öteleme
      let x = p[0] - ref[0] - (off?.[0] ?? 0);
      const y = p[1] - ref[1] - (off?.[1] ?? 0);
      if (mirror) x = -x;
      return [x * ca - y * sa, x * sa + y * ca];
    }),
  );
  const R = Math.max(...loops.flatMap(sampleLoop).map((p) => Math.hypot(p[0], p[1])));
  return { loops, area: sp.area, R };
}

/** Özel profil (eskizden): ad ve konturlar; konturlar eskiz koordinatlarında, orijin = delme noktası */
export interface CustomProfile { name: string; loops: Loop[]; std?: string }
const LIB_KEY = "imajcad.profiles";
export function loadLibrary(): Record<string, CustomProfile> {
  try {
    return JSON.parse(localStorage.getItem(LIB_KEY) ?? "{}");
  } catch {
    return {};
  }
}
export function saveLibrary(lib: Record<string, CustomProfile>) {
  try {
    localStorage.setItem(LIB_KEY, JSON.stringify(lib));
  } catch {}
}

export const profileName = (std: ProfileStd, size: string) =>
  std === "kutu" || std === "dkutu" ? `Kutu ${size}` : std === "boru" ? `Boru Ø${size}` : std === "L" ? `L ${size}` : std === "lama" ? `Lama ${size}` : std === "yuvarlak" ? `Çubuk ${size}` : std === "kare" ? `Kare çubuk ${size}` : size;

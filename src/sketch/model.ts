// Eskiz verisi üzerinde işlemler: varlık ekleme/silme, ölçü değerleri, uygulanabilir ilişkiler.
import type { DimType, RelType, SArc, SCircle, SDim, SEllipse, SEnt, SLine, SRel, SketchData, Vec2 } from "../doc/types";
import { ORIGIN } from "../doc/types";
import { ang, d2, normAng } from "./geom";

export function newSketch(): SketchData {
  return { pts: {}, ents: [], rels: [], dims: [], seq: 1 };
}

export const nid = (sk: SketchData, pre: string) => `${pre}${sk.seq++}`;

export function P(sk: SketchData, id: string): Vec2 {
  if (id === ORIGIN) return [0, 0];
  const p = sk.pts[id];
  return p ? [p.x, p.y] : [0, 0];
}

export function addPt(sk: SketchData, p: Vec2): string {
  const id = nid(sk, "p");
  sk.pts[id] = { x: p[0], y: p[1] };
  return id;
}

export function addLine(sk: SketchData, p1: string, p2: string, cons = false): SLine {
  const e: SLine = { id: nid(sk, "l"), t: "line", p1, p2, ...(cons ? { cons: true } : {}) };
  sk.ents.push(e);
  return e;
}
export function addCircle(sk: SketchData, c: string, r: number, cons = false): SCircle {
  const e: SCircle = { id: nid(sk, "c"), t: "circle", c, r, ...(cons ? { cons: true } : {}) };
  sk.ents.push(e);
  return e;
}
export function addArc(sk: SketchData, c: string, s: string, e: string, cons = false): SArc {
  const r = d2(P(sk, c), P(sk, s));
  const a: SArc = { id: nid(sk, "a"), t: "arc", c, s, e, r, ...(cons ? { cons: true } : {}) };
  sk.ents.push(a);
  return a;
}
export function addPointEnt(sk: SketchData, p: string) {
  const e = { id: nid(sk, "n"), t: "point" as const, p };
  sk.ents.push(e);
  return e;
}
export function addRel(sk: SketchData, t: RelType, refs: string[], extra: Partial<SRel> = {}): SRel {
  const r: SRel = { id: nid(sk, "r"), t, refs, ...extra };
  sk.rels.push(r);
  return r;
}

export function entPoints(e: SEnt): string[] {
  switch (e.t) {
    case "point": return [e.p];
    case "line": return [e.p1, e.p2];
    case "circle": return [e.c];
    case "arc": return [e.c, e.s, e.e];
    case "ellipse": return e.s && e.e ? [e.c, e.a, e.s, e.e] : [e.c, e.a];
    case "spline": return [...new Set(e.pts)];
    case "parabola": return [e.s, e.e, e.k];
    case "text": return [e.p];
  }
}

/** Elips geometrisi */
export function ellipseGeo(sk: SketchData, e: SEllipse) {
  const c = P(sk, e.c), a = P(sk, e.a);
  const rx = Math.hypot(a[0] - c[0], a[1] - c[1]) || 1e-9;
  const rot = Math.atan2(a[1] - c[1], a[0] - c[0]);
  const at = (t: number): Vec2 => {
    const x = rx * Math.cos(t), y = e.rb * Math.sin(t);
    return [c[0] + x * Math.cos(rot) - y * Math.sin(rot), c[1] + x * Math.sin(rot) + y * Math.cos(rot)];
  };
  /** noktanın elips parametresi */
  const param = (p: Vec2) => {
    const dx = p[0] - c[0], dy = p[1] - c[1];
    const lx = dx * Math.cos(rot) + dy * Math.sin(rot), ly = -dx * Math.sin(rot) + dy * Math.cos(rot);
    return Math.atan2(ly / (e.rb || 1e-9), lx / rx);
  };
  return { c, rx, ry: e.rb, rot, at, param };
}

/** Türetilmiş noktaları (kısmi elips uçları) günceller */
export function updateDerived(sk: SketchData) {
  for (const e of sk.ents) {
    if (e.t === "ellipse" && e.s && e.e && e.t0 !== undefined && e.t1 !== undefined) {
      const g = ellipseGeo(sk, e);
      const s = g.at(e.t0), en = g.at(e.t1);
      if (sk.pts[e.s]) sk.pts[e.s] = { x: s[0], y: s[1] };
      if (sk.pts[e.e]) sk.pts[e.e] = { x: en[0], y: en[1] };
    }
  }
}

/** Spline noktalarından kübik Bezier parçaları (Catmull-Rom) */
/** i. noktadaki tutamak (kontrol noktası ötelemesi): verilmişse o, yoksa Catmull–Rom */
export function splineHandle(pts: Vec2[], closed: boolean, i: number, h?: (Vec2 | null)[]): Vec2 {
  if (h?.[i]) return h[i]!;
  const n = pts.length;
  const get = (k: number): Vec2 => (closed ? pts[((k % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, k))]);
  const a = get(i - 1), b = get(i + 1);
  return [(b[0] - a[0]) / 6, (b[1] - a[1]) / 6];
}
export function splineBeziers(pts: Vec2[], closed: boolean, h?: (Vec2 | null)[]): { a: Vec2; b: Vec2; c1: Vec2; c2: Vec2 }[] {
  const n = pts.length;
  const out: { a: Vec2; b: Vec2; c1: Vec2; c2: Vec2 }[] = [];
  if (n < 2) return out;
  const get = (i: number): Vec2 => (closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    out.push({
      a: p1,
      b: p2,
      c1: h?.[i] ? [p1[0] + h[i]![0], p1[1] + h[i]![1]] : [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6],
      c2: h?.[(i + 1) % n] ? [p2[0] - h[(i + 1) % n]![0], p2[1] - h[(i + 1) % n]![1]] : [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6],
    });
  }
  return out;
}

export const bez3 = (a: Vec2, c1: Vec2, c2: Vec2, b: Vec2, t: number): Vec2 => {
  const u = 1 - t;
  return [u * u * u * a[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * b[0], u * u * u * a[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * b[1]];
};
export const bez2 = (a: Vec2, k: Vec2, b: Vec2, t: number): Vec2 => {
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * k[0] + t * t * b[0], u * u * a[1] + 2 * u * t * k[1] + t * t * b[1]];
};

/** Varlığın çizim için örneklenmiş noktaları */
export function entSamples(sk: SketchData, e: SEnt): Vec2[] {
  const TAU = Math.PI * 2;
  switch (e.t) {
    case "line":
      return [P(sk, e.p1), P(sk, e.p2)];
    case "circle": {
      const c = P(sk, e.c);
      const out: Vec2[] = [];
      for (let i = 0; i <= 72; i++) out.push([c[0] + e.r * Math.cos((i / 72) * TAU), c[1] + e.r * Math.sin((i / 72) * TAU)]);
      return out;
    }
    case "arc": {
      const c = P(sk, e.c);
      const s = Math.atan2(P(sk, e.s)[1] - c[1], P(sk, e.s)[0] - c[0]);
      const en = Math.atan2(P(sk, e.e)[1] - c[1], P(sk, e.e)[0] - c[0]);
      const span = (((en - s) % TAU) + TAU) % TAU || TAU;
      const n = Math.max(8, Math.ceil((span / TAU) * 72));
      const out: Vec2[] = [];
      for (let i = 0; i <= n; i++) out.push([c[0] + e.r * Math.cos(s + (span * i) / n), c[1] + e.r * Math.sin(s + (span * i) / n)]);
      return out;
    }
    case "ellipse": {
      const g = ellipseGeo(sk, e);
      const t0 = e.t0 ?? 0;
      let span = e.t1 !== undefined ? e.t1 - t0 : TAU;
      span = ((span % TAU) + TAU) % TAU || TAU;
      const out: Vec2[] = [];
      for (let i = 0; i <= 72; i++) out.push(g.at(t0 + (span * i) / 72));
      return out;
    }
    case "spline": {
      const closed = e.pts.length > 2 && e.pts[0] === e.pts[e.pts.length - 1];
      const pts = (closed ? e.pts.slice(0, -1) : e.pts).map((id) => P(sk, id));
      const out: Vec2[] = [];
      for (const b of splineBeziers(pts, closed, e.h)) for (let i = out.length ? 1 : 0; i <= 16; i++) out.push(bez3(b.a, b.c1, b.c2, b.b, i / 16));
      return out;
    }
    case "parabola": {
      const out: Vec2[] = [];
      const A = P(sk, e.s), K = P(sk, e.k), B = P(sk, e.e);
      const rho = e.rho ?? 0.5;
      const w = rho / (1 - rho);
      for (let i = 0; i <= 32; i++) {
        const t = i / 32, u = 1 - t;
        const d = u * u + 2 * w * u * t + t * t;
        out.push([(u * u * A[0] + 2 * w * u * t * K[0] + t * t * B[0]) / d, (u * u * A[1] + 2 * w * u * t * K[1] + t * t * B[1]) / d]);
      }
      return out;
    }
    default:
      return [];
  }
}

export const getEnt = (sk: SketchData, id: string) => sk.ents.find((e) => e.id === id);

/** Noktayı kullanan varlıklar */
export function usersOf(sk: SketchData, pid: string) {
  return sk.ents.filter((e) => entPoints(e).includes(pid));
}

/** Kimlik listesini siler (varlık, nokta, ilişki, ölçü); artık kullanılmayan noktaları temizler */
export function deleteIds(sk: SketchData, ids: Iterable<string>) {
  const del = new Set(ids);
  // tek başına seçilen noktalar: o noktayı kullanan "nokta" varlıklarını da sil
  sk.ents = sk.ents.filter((e) => !del.has(e.id) && !(e.t === "point" && del.has(e.p)));
  sk.rels = sk.rels.filter((r) => !del.has(r.id));
  sk.dims = sk.dims.filter((d) => !del.has(d.id));
  cleanup(sk);
}

/** Geçersiz referansları ve sahipsiz noktaları temizler */
export function cleanup(sk: SketchData) {
  const used = new Set<string>([ORIGIN]);
  sk.ents.forEach((e) => entPoints(e).forEach((p) => used.add(p)));
  for (const id of Object.keys(sk.pts)) if (!used.has(id)) delete sk.pts[id];
  const exists = (id: string) => id === ORIGIN || !!sk.pts[id] || sk.ents.some((e) => e.id === id);
  sk.rels = sk.rels.filter((r) => r.refs.every(exists));
  sk.dims = sk.dims.filter((d) => d.refs.every(exists));
  // kendi uç noktasına "üzerinde" ilişkisi gereksizdir
  sk.rels = sk.rels.filter((r) => {
    if (r.t !== "onLine" && r.t !== "onCircle") return true;
    const e = sk.ents.find((x) => x.id === r.refs[1]);
    return !(e && entPoints(e).includes(r.refs[0]));
  });
}

/** Bir noktayı diğerinin yerine koyar (birleştirme) */
export function replacePoint(sk: SketchData, from: string, to: string) {
  if (from === to) return;
  for (const e of sk.ents as any[]) {
    for (const k of ["p", "p1", "p2", "c", "s", "e", "a", "k"]) if (e[k] === from) e[k] = to;
    if (Array.isArray(e.pts)) e.pts = e.pts.map((x: string) => (x === from ? to : x));
  }
  for (const r of sk.rels) r.refs = r.refs.map((x) => (x === from ? to : x));
  for (const d of sk.dims) d.refs = d.refs.map((x) => (x === from ? to : x));
  // kendine bağlanan ilişkiler ve sıfır uzunluklu çizgiler
  sk.rels = sk.rels.filter((r) => !(r.t === "coincident" && r.refs[0] === r.refs[1]));
  sk.ents = sk.ents.filter((e) => !(e.t === "line" && e.p1 === e.p2));
  cleanup(sk);
}

// ---------------- Ölçüler ----------------

export function arcAngles(sk: SketchData, a: SArc) {
  const c = P(sk, a.c);
  return { c, s: ang(c, P(sk, a.s)), e: ang(c, P(sk, a.e)) };
}

/** Bir ölçünün geometrideki güncel değeri */
export function measure(sk: SketchData, d: { t: DimType; refs: string[]; sub?: string; sgn?: number; cond?: "min" | "c" | "max" }): number {
  const [a, b] = d.refs;
  const ea = getEnt(sk, a), eb = getEnt(sk, b);
  switch (d.t) {
    case "dist": {
      const A = P(sk, a), B = P(sk, b);
      if (d.sub === "h") return B[0] - A[0];
      if (d.sub === "v") return B[1] - A[1];
      return d2(A, B);
    }
    case "dia":
      return 2 * ((ea as any)?.r ?? 0);
    case "rad":
      return (ea as any)?.r ?? 0;
    case "angle": {
      const l1 = ea as SLine, l2 = eb as SLine;
      const u = sub(P(sk, l1.p2), P(sk, l1.p1)), v = sub(P(sk, l2.p2), P(sk, l2.p1));
      const th = Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1]);
      return (Math.abs(th) * 180) / Math.PI;
    }
    case "alen": {
      const a = ea as any;
      if (!a || a.t !== "arc") return 0;
      const c = P(sk, a.c), s0 = P(sk, a.s), e0 = P(sk, a.e);
      let sw = Math.atan2(e0[1] - c[1], e0[0] - c[0]) - Math.atan2(s0[1] - c[1], s0[0] - c[0]);
      if (sw <= 0) sw += 2 * Math.PI;
      return a.r * sw;
    }
    case "cl": {
      const c = ea as any, l = eb as SLine;
      const p = P(sk, c.c), A = P(sk, l.p1), B = P(sk, l.p2);
      const u = sub(B, A);
      const L = Math.hypot(u[0], u[1]) || 1;
      const cd = Math.abs((u[0] * (p[1] - A[1]) - u[1] * (p[0] - A[0])) / L);
      // yay koşulu (SolidWorks): en yakın / merkez / en uzak
      return d.cond === "c" ? cd : d.cond === "max" ? cd + c.r : cd - c.r;
    }
    case "cc": {
      const c1 = ea as any, c2 = eb as any;
      const cd = d2(P(sk, c1.c), P(sk, c2.c));
      return d.cond === "c" ? cd : d.cond === "max" ? cd + c1.r + c2.r : cd - c1.r - c2.r;
    }
    case "pldist": {
      let p: Vec2;
      let l: SLine;
      if (ea?.t === "line" && eb?.t === "line") [p, l] = [P(sk, eb.p1), ea];
      else if (ea && (ea.t === "circle" || ea.t === "arc")) [p, l] = [P(sk, ea.c), eb as SLine];
      else [p, l] = [P(sk, a), eb as SLine];
      const A = P(sk, l.p1), B = P(sk, l.p2);
      const u = sub(B, A);
      const L = Math.hypot(u[0], u[1]) || 1;
      return Math.abs((u[0] * (p[1] - A[1]) - u[1] * (p[0] - A[0])) / L) * ((d as any).dbl ? 2 : 1);
    }
  }
}
const sub = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];

export function lineAngleSign(sk: SketchData, l1: SLine, l2: SLine) {
  const u = sub(P(sk, l1.p2), P(sk, l1.p1)), v = sub(P(sk, l2.p2), P(sk, l2.p1));
  return u[0] * v[1] - u[1] * v[0] >= 0 ? 1 : -1;
}

// ---------------- İlişki adları ----------------

export const REL_NAMES: Record<RelType, string> = {
  coincident: "Çakışık",
  onLine: "Üzerinde",
  onCircle: "Üzerinde",
  horizontal: "Yatay",
  vertical: "Dikey",
  parallel: "Paralel",
  perpendicular: "Dik",
  collinear: "Doğrudaş",
  equal: "Eşit",
  tangent: "Teğet",
  concentric: "Eş merkezli",
  midpoint: "Orta nokta",
  symmetric: "Simetrik",
  eqcurve: "Eşit eğri uzunluğu",
  offset: "Öteleme",
  lpat: "Doğrusal çoğaltma",
  cpat: "Dairesel çoğaltma",
  fix: "Sabit",
};
export const REL_GLYPH: Record<RelType, string> = {
  coincident: "●",
  onLine: "∈",
  onCircle: "∈",
  horizontal: "⟷",
  vertical: "↕",
  parallel: "∥",
  perpendicular: "⊥",
  collinear: "⋯",
  equal: "=",
  tangent: "◠",
  concentric: "◎",
  midpoint: "◇",
  symmetric: "⇋",
  eqcurve: "≗",
  offset: "⫽",
  lpat: "⋰",
  cpat: "⟳",
  fix: "⚓",
};

export interface RelOption { t: RelType; label: string; build: () => { t: RelType; refs: string[]; fx?: number; fy?: number }[] }

/** öğenin ait olduğu kanal (2 yay + 2 çizgi, isteğe bağlı merkez yapı çizgisi); değilse null */
export function slotOf(sk: SketchData, id: string): { arcs: SArc[]; lines: SLine[]; cl?: SLine; key: string } | null {
  const e = getEnt(sk, id);
  if (!e || (e.t !== "arc" && e.t !== "line")) return null;
  const solid = sk.ents.filter((x) => (x.t === "arc" || x.t === "line") && !(x as any).cons);
  const ptsOf = (x: any): string[] => (x.t === "line" ? [x.p1, x.p2] : x.t === "arc" ? [x.s, x.e] : []);
  const seen = new Set<string>([e.id]), stack: SEnt[] = [e];
  while (stack.length) {
    const x = stack.pop()!;
    const ps = new Set(ptsOf(x));
    for (const y of solid) if (!seen.has(y.id) && ptsOf(y).some((q) => ps.has(q))) seen.add(y.id), stack.push(y);
    if (seen.size > 4) return null;
  }
  const comp = [...seen].map((k) => getEnt(sk, k)!) as SEnt[];
  const arcs = comp.filter((x) => x.t === "arc") as SArc[], lines = comp.filter((x) => x.t === "line") as SLine[];
  if (arcs.length !== 2 || lines.length !== 2 || (lines[0] as any).cons) return null;
  const cl = sk.ents.find((x) => x.t === "line" && (x as any).cons && ((x.p1 === arcs[0].c && x.p2 === arcs[1].c) || (x.p1 === arcs[1].c && x.p2 === arcs[0].c))) as SLine | undefined;
  return { arcs, lines, cl, key: [...seen].sort().join(",") };
}

/** Seçime uygulanabilecek ilişkiler (SolidWorks "İlişki Ekle") */
export function applicableRelations(sk: SketchData, sel: string[]): RelOption[] {
  const pts = sel.filter((id) => id === ORIGIN || sk.pts[id]);
  const ents = sel.map((id) => getEnt(sk, id)).filter(Boolean) as SEnt[];
  const lines = ents.filter((e) => e.t === "line") as SLine[];
  const curves = ents.filter((e) => e.t === "circle" || e.t === "arc") as (SCircle | SArc)[];
  const ptEnts = ents.filter((e) => e.t === "point").map((e) => (e as any).p as string);
  const allPts = [...pts, ...ptEnts];
  const out: RelOption[] = [];
  const nE = ents.length - ptEnts.length;

  if (lines.length >= 1 && nE === lines.length && allPts.length === 0) {
    out.push({ t: "horizontal", label: "Yatay", build: () => lines.map((l) => ({ t: "horizontal" as RelType, refs: [l.id] })) });
    out.push({ t: "vertical", label: "Dikey", build: () => lines.map((l) => ({ t: "vertical" as RelType, refs: [l.id] })) });
  }
  if (lines.length === 2 && nE === 2 && !allPts.length) {
    const [a, b] = lines;
    out.push({ t: "parallel", label: "Paralel", build: () => [{ t: "parallel", refs: [a.id, b.id] }] });
    out.push({ t: "perpendicular", label: "Dik", build: () => [{ t: "perpendicular", refs: [a.id, b.id] }] });
    out.push({ t: "collinear", label: "Doğrudaş", build: () => [{ t: "collinear", refs: [a.id, b.id] }] });
  }
  if (lines.length > 2 && nE === lines.length && !allPts.length) {
    out.push({ t: "parallel", label: "Paralel", build: () => lines.slice(1).map((l) => ({ t: "parallel" as RelType, refs: [lines[0].id, l.id] })) });
  }
  if (lines.length >= 2 && nE === lines.length && !allPts.length)
    out.push({ t: "equal", label: "Eşit", build: () => lines.slice(1).map((l) => ({ t: "equal" as RelType, refs: [lines[0].id, l.id] })) });
  if (curves.length >= 2 && nE === curves.length && !allPts.length) {
    out.push({ t: "equal", label: "Eşit", build: () => curves.slice(1).map((c) => ({ t: "equal" as RelType, refs: [curves[0].id, c.id] })) });
    if (curves.length === 2) {
      out.push({ t: "concentric", label: "Eş merkezli", build: () => [{ t: "concentric", refs: [curves[0].id, curves[1].id] }] });
      out.push({ t: "concentric", label: "Eş yarıçaplı", build: () => [{ t: "concentric", refs: [curves[0].id, curves[1].id] }, { t: "equal", refs: [curves[0].id, curves[1].id] }] });
      out.push({ t: "tangent", label: "Teğet", build: () => [{ t: "tangent", refs: [curves[0].id, curves[1].id] }] });
    }
  }
  {
    const arcs = ents.filter((e) => e.t === "arc");
    if (nE === 2 && !allPts.length && arcs.length >= 1 && lines.length + arcs.length === 2)
      out.push({ t: "eqcurve", label: "Eşit eğri uzunluğu", build: () => [{ t: "eqcurve", refs: [ents[0].id, ents[1].id] }] });
  }
  if (lines.length === 1 && curves.length === 1 && nE === 2 && !allPts.length)
    out.push({ t: "tangent", label: "Teğet", build: () => [{ t: "tangent", refs: [lines[0].id, curves[0].id] }] });
  if (allPts.length === 2 && nE === 0) {
    const [a, b] = allPts;
    out.push({ t: "coincident", label: "Çakışık", build: () => [{ t: "coincident", refs: [a, b] }] });
    if (a !== ORIGIN && b !== ORIGIN) out.push({ t: "coincident", label: "Birleştir (tek nokta)", build: () => [{ t: "coincident", refs: [a, b], merge: true } as any] });
    out.push({ t: "horizontal", label: "Yatay", build: () => [{ t: "horizontal", refs: [a, b] }] });
    out.push({ t: "vertical", label: "Dikey", build: () => [{ t: "vertical", refs: [a, b] }] });
  }
  if (allPts.length === 1 && lines.length === 1 && nE === 1) {
    out.push({ t: "onLine", label: "Üzerinde", build: () => [{ t: "onLine", refs: [allPts[0], lines[0].id] }] });
    out.push({ t: "midpoint", label: "Orta nokta", build: () => [{ t: "midpoint", refs: [allPts[0], lines[0].id] }] });
  }
  if (allPts.length === 1 && curves.length === 1 && nE === 1) {
    out.push({ t: "onCircle", label: "Üzerinde", build: () => [{ t: "onCircle", refs: [allPts[0], curves[0].id] }] });
    out.push({ t: "concentric", label: "Eş merkezli", build: () => [{ t: "coincident", refs: [allPts[0], curves[0].c] }] });
  }
  if (allPts.length === 2 && lines.length === 1 && nE === 1)
    out.push({ t: "symmetric", label: "Simetrik", build: () => [{ t: "symmetric", refs: [allPts[0], allPts[1], lines[0].id] }] });
  if (lines.length === 3 && nE === 3 && !allPts.length) {
    // iki çizgi + merkez çizgisi: uç noktaları simetrik
    const cl = lines.find((l) => l.cons);
    const others = lines.filter((l) => l !== cl);
    if (cl && others.length === 2)
      out.push({
        t: "symmetric",
        label: "Simetrik",
        build: () => [
          { t: "symmetric", refs: [others[0].p1, others[1].p1, cl.id] },
          { t: "symmetric", refs: [others[0].p2, others[1].p2, cl.id] },
        ],
      });
  }
  // eşit kanallar: seçilen öğeler tam iki kanala aitse
  if (nE >= 2 && !allPts.length) {
    const slots = new Map<string, NonNullable<ReturnType<typeof slotOf>>>();
    let all = true;
    for (const e of ents) {
      const q = e.t === "line" && (e as any).cons ? null : slotOf(sk, e.id);
      if (!q) {
        const host = e.t === "line" && (e as any).cons ? [...sk.ents].map((x) => slotOf(sk, x.id)).find((q2) => q2?.cl?.id === e.id) : null;
        if (host) slots.set(host.key, host);
        else all = false;
      } else slots.set(q.key, q);
    }
    if (all && slots.size === 2) {
      const [A, B] = [...slots.values()];
      out.push({
        t: "equal",
        label: "Eşit kanallar",
        build: () => [
          { t: "equal", refs: [A.arcs[0].id, B.arcs[0].id] },
          A.cl && B.cl ? { t: "equal", refs: [A.cl.id, B.cl.id] } : { t: "equal", refs: [A.lines[0].id, B.lines[0].id] },
        ],
      });
    }
  }
  if (allPts.length >= 1 && nE === 0 && !allPts.includes(ORIGIN))
    out.push({ t: "fix", label: "Sabitle", build: () => allPts.map((p) => ({ t: "fix" as RelType, refs: [p], fx: P(sk, p)[0], fy: P(sk, p)[1] })) });
  if (ents.length >= 1 && allPts.length === 0)
    out.push({
      t: "fix",
      label: "Sabitle",
      build: () => {
        const ps = new Set<string>();
        ents.forEach((e) => entPoints(e).forEach((p) => p !== ORIGIN && ps.add(p)));
        const rels: { t: RelType; refs: string[]; fx?: number; fy?: number }[] = [...ps].map((p) => ({ t: "fix", refs: [p], fx: P(sk, p)[0], fy: P(sk, p)[1] }));
        return rels;
      },
    });
  return out;
}

/** Bir varlık veya noktayla ilgili ilişkiler */
/** çizgi uzunluğu ya da yay uzunluğu */
export function curveLength(sk: SketchData, e: SEnt | undefined): number {
  if (!e) return 0;
  if (e.t === "line") return d2(P(sk, e.p1), P(sk, e.p2));
  if (e.t === "arc") return measure(sk, { t: "alen", refs: [e.id] });
  return 0;
}

export function relationsOf(sk: SketchData, id: string): SRel[] {
  const e = getEnt(sk, id);
  const ids = new Set([id, ...(e ? entPoints(e) : [])]);
  return sk.rels.filter((r) => r.refs.some((x) => ids.has(x)));
}

export function dimsOf(sk: SketchData, id: string): SDim[] {
  const e = getEnt(sk, id);
  const ids = new Set([id, ...(e ? entPoints(e) : [])]);
  return sk.dims.filter((d) => d.refs.some((x) => ids.has(x)));
}

/** Yay CCW mi? s'den e'ye açı aralığı */
export function arcSpan(sk: SketchData, a: SArc) {
  const { s, e } = arcAngles(sk, a);
  return normAng(e - s);
}

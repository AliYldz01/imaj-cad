// Eskiz verisi üzerinde işlemler: varlık ekleme/silme, ölçü değerleri, uygulanabilir ilişkiler.
import type { DimType, RelType, SArc, SCircle, SDim, SEnt, SLine, SRel, SketchData, Vec2 } from "../doc/types";
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
  for (const e of sk.ents as any[]) for (const k of ["p", "p1", "p2", "c", "s", "e"]) if (e[k] === from) e[k] = to;
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
export function measure(sk: SketchData, d: { t: DimType; refs: string[]; sub?: string; sgn?: number }): number {
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
    case "pldist": {
      let p: Vec2;
      let l: SLine;
      if (ea?.t === "line" && eb?.t === "line") [p, l] = [P(sk, eb.p1), ea];
      else if (ea && (ea.t === "circle" || ea.t === "arc")) [p, l] = [P(sk, ea.c), eb as SLine];
      else [p, l] = [P(sk, a), eb as SLine];
      const A = P(sk, l.p1), B = P(sk, l.p2);
      const u = sub(B, A);
      const L = Math.hypot(u[0], u[1]) || 1;
      return Math.abs((u[0] * (p[1] - A[1]) - u[1] * (p[0] - A[0])) / L);
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
  fix: "⚓",
};

export interface RelOption { t: RelType; label: string; build: () => { t: RelType; refs: string[]; fx?: number; fy?: number }[] }

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
      out.push({ t: "tangent", label: "Teğet", build: () => [{ t: "tangent", refs: [curves[0].id, curves[1].id] }] });
    }
  }
  if (lines.length === 1 && curves.length === 1 && nE === 2 && !allPts.length)
    out.push({ t: "tangent", label: "Teğet", build: () => [{ t: "tangent", refs: [lines[0].id, curves[0].id] }] });
  if (allPts.length === 2 && nE === 0) {
    const [a, b] = allPts;
    out.push({ t: "coincident", label: "Çakışık", build: () => [{ t: "coincident", refs: [a, b] }] });
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

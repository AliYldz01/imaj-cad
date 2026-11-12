// Eskizden kapalı konturları (profil) çıkarır. İç içe konturlar delik olur.
import type { Loop, Seg, SketchData, Vec2 } from "../doc/types";
import { ang, arcMid, normAng, pointInPoly, TAU } from "./geom";

export function pointPos(sk: SketchData, id: string): Vec2 {
  if (id === "O") return [0, 0];
  const p = sk.pts[id];
  return p ? [p.x, p.y] : [0, 0];
}

interface Edge { seg: Seg; a: string; b: string; used: boolean }

export function extractLoops(sk: SketchData): { loops: Loop[]; error?: string } {
  const key = (p: Vec2) => `${Math.round(p[0] * 1e4)}:${Math.round(p[1] * 1e4)}`;
  const edges: Edge[] = [];
  const loops: Loop[] = [];
  const polys: Vec2[][] = [];

  for (const e of sk.ents) {
    if (e.cons) continue;
    if (e.t === "line") {
      const a = pointPos(sk, e.p1), b = pointPos(sk, e.p2);
      if (key(a) === key(b)) continue;
      edges.push({ seg: { t: "l", a, b }, a: key(a), b: key(b), used: false });
    } else if (e.t === "arc") {
      const c = pointPos(sk, e.c), s = pointPos(sk, e.s), en = pointPos(sk, e.e);
      const r = Math.hypot(s[0] - c[0], s[1] - c[1]);
      const m = arcMid(c, r, ang(c, s), ang(c, en));
      edges.push({ seg: { t: "a", a: s, b: en, m }, a: key(s), b: key(en), used: false });
    } else if (e.t === "circle") {
      const c = pointPos(sk, e.c);
      loops.push({ circle: { c, r: e.r }, depth: 0 });
      const poly: Vec2[] = [];
      for (let i = 0; i < 48; i++) poly.push([c[0] + e.r * Math.cos((i / 48) * TAU), c[1] + e.r * Math.sin((i / 48) * TAU)]);
      polys.push(poly);
    }
  }

  const adj = new Map<string, Edge[]>();
  for (const ed of edges) {
    for (const k of [ed.a, ed.b]) {
      if (!adj.has(k)) adj.set(k, []);
      adj.get(k)!.push(ed);
    }
  }
  for (const [, list] of adj) {
    if (list.length === 1) return { loops: [], error: "Eskiz açık kontur içeriyor. Uç noktaları birleştirin." };
    if (list.length > 2) return { loops: [], error: "Eskizde bir noktada ikiden fazla çizgi birleşiyor. Konturlar kendini kesmemeli." };
  }

  for (const start of edges) {
    if (start.used) continue;
    const segs: Seg[] = [];
    let cur = start;
    let at = start.a;
    for (;;) {
      cur.used = true;
      const forward = cur.a === at;
      const s = cur.seg;
      segs.push(forward ? s : s.t === "l" ? { t: "l", a: s.b, b: s.a } : { t: "a", a: s.b, b: s.a, m: s.m });
      at = forward ? cur.b : cur.a;
      const next = adj.get(at)!.find((x) => !x.used);
      if (!next) break;
      cur = next;
    }
    loops.push({ segs, depth: 0 });
    polys.push(samplePoly(segs));
  }

  // İç içelik derinliği
  loops.forEach((l, i) => {
    const probe = polys[i][0];
    let depth = 0;
    polys.forEach((p, j) => {
      if (i !== j && pointInPoly(probe, p)) depth++;
    });
    l.depth = depth;
  });
  loops.sort((a, b) => a.depth - b.depth);
  return { loops };
}

function samplePoly(segs: Seg[]): Vec2[] {
  const out: Vec2[] = [];
  for (const s of segs) {
    if (s.t === "l") out.push(s.a);
    else {
      // üç noktadan yayı örnekle
      const c = circleFrom3(s.a, s.m, s.b);
      if (!c) {
        out.push(s.a);
        continue;
      }
      const a0 = ang(c.c, s.a), am = ang(c.c, s.m), a1 = ang(c.c, s.b);
      const ccw = normAng(am - a0) < normAng(a1 - a0);
      const span = ccw ? normAng(a1 - a0) : -normAng(a0 - a1);
      for (let i = 0; i < 12; i++) {
        const t = a0 + (span * i) / 12;
        out.push([c.c[0] + c.r * Math.cos(t), c.c[1] + c.r * Math.sin(t)]);
      }
    }
  }
  return out;
}

function circleFrom3(a: Vec2, b: Vec2, c: Vec2) {
  const bx = b[0] - a[0], by = b[1] - a[1], cx = c[0] - a[0], cy = c[1] - a[1];
  const D = 2 * (bx * cy - by * cx);
  if (Math.abs(D) < 1e-12) return null;
  const ux = (cy * (bx * bx + by * by) - by * (cx * cx + cy * cy)) / D;
  const uy = (bx * (cx * cx + cy * cy) - cx * (bx * bx + by * by)) / D;
  return { c: [a[0] + ux, a[1] + uy] as Vec2, r: Math.hypot(ux, uy) };
}

/** Süpürme yolu: tek bir açık veya kapalı zincir (yapı geometrisi hariç) */
export function extractPath(sk: SketchData): { segs: Seg[]; closed: boolean; error?: string } {
  const key = (p: Vec2) => `${Math.round(p[0] * 1e4)}:${Math.round(p[1] * 1e4)}`;
  const edges: Edge[] = [];
  for (const e of sk.ents) {
    if (e.cons) continue;
    if (e.t === "line") {
      const a = pointPos(sk, e.p1), b = pointPos(sk, e.p2);
      edges.push({ seg: { t: "l", a, b }, a: key(a), b: key(b), used: false });
    } else if (e.t === "arc") {
      const c = pointPos(sk, e.c), s = pointPos(sk, e.s), en = pointPos(sk, e.e);
      const r = Math.hypot(s[0] - c[0], s[1] - c[1]);
      edges.push({ seg: { t: "a", a: s, b: en, m: arcMid(c, r, ang(c, s), ang(c, en)) }, a: key(s), b: key(en), used: false });
    } else if (e.t === "circle") return { segs: [], closed: false, error: "Yol eskizinde tam daire kullanılamaz; yay kullanın" };
  }
  if (!edges.length) return { segs: [], closed: false, error: "Yol eskizi boş" };
  const adj = new Map<string, Edge[]>();
  for (const ed of edges) for (const k of [ed.a, ed.b]) (adj.get(k) ?? adj.set(k, []).get(k)!).push(ed);
  const ends = [...adj].filter(([, l]) => l.length === 1).map(([k]) => k);
  if ([...adj.values()].some((l) => l.length > 2) || (ends.length !== 0 && ends.length !== 2))
    return { segs: [], closed: false, error: "Yol tek bir kesintisiz zincir olmalı" };
  const closed = ends.length === 0;
  let at = closed ? edges[0].a : ends[0];
  const segs: Seg[] = [];
  for (;;) {
    const cur = adj.get(at)!.find((x) => !x.used);
    if (!cur) break;
    cur.used = true;
    const fwd = cur.a === at;
    const s = cur.seg;
    segs.push(fwd ? s : s.t === "l" ? { t: "l", a: s.b, b: s.a } : { t: "a", a: s.b, b: s.a, m: s.m });
    at = fwd ? cur.b : cur.a;
  }
  if (segs.length !== edges.length) return { segs: [], closed: false, error: "Yol tek bir kesintisiz zincir olmalı" };
  return { segs, closed };
}

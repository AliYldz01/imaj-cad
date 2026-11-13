// Eskizden kapalı konturları (profil), yolları ve ince özellik bölgelerini çıkarır.
import type { Loop, Seg, SketchData, TextItem, Vec2 } from "../doc/types";
import { ang, arcMid, circleCircle, d2, lineCircle, lineLine, mul2, add2, sub2, norm2, perp, normAng, pointInPoly, polyArea, TAU } from "./geom";
import { ellipseGeo, splineBeziers, bez2, bez3 } from "./model";

export function pointPos(sk: SketchData, id: string): Vec2 {
  if (id === "O") return [0, 0];
  const p = sk.pts[id];
  return p ? [p.x, p.y] : [0, 0];
}

interface Edge { seg: Seg; a: string; b: string; used: boolean }
const key = (p: Vec2) => `${Math.round(p[0] * 1e4)}:${Math.round(p[1] * 1e4)}`;

/** Bir parçayı ters çevirir */
export function revSeg(s: Seg): Seg {
  switch (s.t) {
    case "l": return { t: "l", a: s.b, b: s.a };
    case "a": return { t: "a", a: s.b, b: s.a, m: s.m };
    case "c": return { t: "c", a: s.b, b: s.a, c1: s.c2, c2: s.c1 };
    case "q": return { t: "q", a: s.b, b: s.a, k: s.k };
    case "e": return { ...s, a: s.b, b: s.a, sweep: !s.sweep };
  }
}

/** Yapı geometrisi dışındaki eğrileri kenar listesine çevirir */
function collect(sk: SketchData) {
  const edges: Edge[] = [];
  const closedLoops: Loop[] = [];
  const texts: TextItem[] = [];
  const P = (id: string) => pointPos(sk, id);
  for (const e of sk.ents) {
    if (e.cons) continue;
    if (e.t === "line") {
      const a = P(e.p1), b = P(e.p2);
      if (key(a) !== key(b)) edges.push({ seg: { t: "l", a, b }, a: key(a), b: key(b), used: false });
    } else if (e.t === "arc") {
      const c = P(e.c), s = P(e.s), en = P(e.e);
      const r = Math.hypot(s[0] - c[0], s[1] - c[1]);
      edges.push({ seg: { t: "a", a: s, b: en, m: arcMid(c, r, ang(c, s), ang(c, en)) }, a: key(s), b: key(en), used: false });
    } else if (e.t === "circle") {
      closedLoops.push({ circle: { c: P(e.c), r: e.r }, depth: 0 });
    } else if (e.t === "ellipse") {
      const g = ellipseGeo(sk, e);
      if (e.t0 === undefined || e.t1 === undefined || !e.s || !e.e) {
        closedLoops.push({ ellipse: { c: g.c, rx: g.rx, ry: g.ry, rot: (g.rot * 180) / Math.PI }, depth: 0 });
      } else {
        const a = P(e.s), b = P(e.e);
        const span = normAng(e.t1 - e.t0);
        edges.push({ seg: { t: "e", a, b, rx: g.rx, ry: g.ry, rot: (g.rot * 180) / Math.PI, long: span > Math.PI, sweep: true }, a: key(a), b: key(b), used: false });
      }
    } else if (e.t === "spline") {
      const closed = e.pts.length > 2 && e.pts[0] === e.pts[e.pts.length - 1];
      const pts = (closed ? e.pts.slice(0, -1) : e.pts).map(P);
      for (const bz of splineBeziers(pts, closed)) edges.push({ seg: { t: "c", ...bz }, a: key(bz.a), b: key(bz.b), used: false });
    } else if (e.t === "parabola") {
      const a = P(e.s), b = P(e.e), k = P(e.k);
      const rho = e.rho ?? 0.5;
      if (Math.abs(rho - 0.5) < 1e-9) edges.push({ seg: { t: "q", a, b, k }, a: key(a), b: key(b), used: false });
      else {
        // konik (rasyonel ikinci derece) → kübik yaklaşım: dörtte bir dairede bilinen 0,5523 katsayısını verir
        const w = rho / (1 - rho);
        const kk = (4 * w) / (3 * (1 + w));
        const c1: Vec2 = [a[0] + kk * (k[0] - a[0]), a[1] + kk * (k[1] - a[1])];
        const c2: Vec2 = [b[0] + kk * (k[0] - b[0]), b[1] + kk * (k[1] - b[1])];
        edges.push({ seg: { t: "c", a, b, c1, c2 }, a: key(a), b: key(b), used: false });
      }
    } else if (e.t === "text") {
      const p = P(e.p);
      if (e.text.trim()) texts.push({ text: e.text, x: p[0], y: p[1], size: e.size, angle: e.angle, font: (e as any).font });
    }
  }
  return { edges, closedLoops, texts };
}

function adjacency(edges: Edge[]) {
  const adj = new Map<string, Edge[]>();
  for (const ed of edges) for (const k of [ed.a, ed.b]) (adj.get(k) ?? adj.set(k, []).get(k)!).push(ed);
  return adj;
}

function trace(adj: Map<string, Edge[]>, start: Edge, at: string): Seg[] {
  const segs: Seg[] = [];
  let cur: Edge | undefined = start;
  while (cur) {
    cur.used = true;
    const fwd = cur.a === at;
    segs.push(fwd ? cur.seg : revSeg(cur.seg));
    at = fwd ? cur.b : cur.a;
    cur = adj.get(at)!.find((x) => !x.used);
  }
  return segs;
}

export function extractLoops(sk: SketchData): { loops: Loop[]; texts: TextItem[]; error?: string } {
  const { edges, closedLoops, texts } = collect(sk);
  const loops: Loop[] = [...closedLoops];
  const adj = adjacency(edges);
  for (const [, list] of adj) {
    if (list.length === 1) return { loops: [], texts, error: "Eskiz açık kontur içeriyor. Uç noktaları birleştirin (veya ince özellik kullanın)." };
    if (list.length > 2) return { loops: [], texts, error: "Eskizde bir noktada ikiden fazla çizgi birleşiyor. Konturlar kendini kesmemeli." };
  }
  for (const start of edges) if (!start.used) loops.push({ segs: trace(adj, start, start.a), depth: 0 });
  const polys = loops.map(loopPoly);
  loops.forEach((l, i) => {
    const probe = polys[i][0];
    let depth = 0;
    polys.forEach((p, j) => i !== j && pointInPoly(probe, p) && depth++);
    l.depth = depth;
  });
  loops.sort((a, b) => a.depth - b.depth);
  return { loops, texts };
}

/** Açık ve kapalı zincirler (ince özellik / kaburga / yol için) */
export function extractChains(sk: SketchData): { chains: { segs: Seg[]; closed: boolean }[]; error?: string } {
  const { edges, closedLoops } = collect(sk);
  const adj = adjacency(edges);
  if ([...adj.values()].some((l) => l.length > 2)) return { chains: [], error: "Eskizde dallanan çizgiler var" };
  const chains: { segs: Seg[]; closed: boolean }[] = [];
  for (const [k, l] of adj) if (l.length === 1 && !l[0].used) chains.push({ segs: trace(adj, l[0], k), closed: false });
  for (const e of edges) if (!e.used) chains.push({ segs: trace(adj, e, e.a), closed: true });
  for (const c of closedLoops) {
    if ("circle" in c) {
      const { c: cc, r } = c.circle;
      const p0: Vec2 = [cc[0] + r, cc[1]], p1: Vec2 = [cc[0] - r, cc[1]];
      chains.push({ closed: true, segs: [{ t: "a", a: p0, b: p1, m: [cc[0], cc[1] + r] }, { t: "a", a: p1, b: p0, m: [cc[0], cc[1] - r] }] });
    }
  }
  return { chains };
}

export function segPoints(s: Seg, n = 12): Vec2[] {
  switch (s.t) {
    case "l":
      return [s.a, s.b];
    case "a": {
      const c = circle3(s.a, s.m, s.b);
      if (!c) return [s.a, s.b];
      const a0 = ang(c.c, s.a), am = ang(c.c, s.m), a1 = ang(c.c, s.b);
      const ccw = normAng(am - a0) < normAng(a1 - a0);
      const span = ccw ? normAng(a1 - a0) : -normAng(a0 - a1);
      const out: Vec2[] = [];
      for (let i = 0; i <= n; i++) out.push([c.c[0] + c.r * Math.cos(a0 + (span * i) / n), c.c[1] + c.r * Math.sin(a0 + (span * i) / n)]);
      return out;
    }
    case "c": {
      const out: Vec2[] = [];
      for (let i = 0; i <= n; i++) out.push(bez3(s.a, s.c1, s.c2, s.b, i / n));
      return out;
    }
    case "q": {
      const out: Vec2[] = [];
      for (let i = 0; i <= n; i++) out.push(bez2(s.a, s.k, s.b, i / n));
      return out;
    }
    case "e":
      return [s.a, s.b];
  }
}

function loopPoly(l: Loop): Vec2[] {
  if ("circle" in l) {
    const { c, r } = l.circle;
    return Array.from({ length: 48 }, (_, i) => [c[0] + r * Math.cos((i / 48) * TAU), c[1] + r * Math.sin((i / 48) * TAU)] as Vec2);
  }
  if ("ellipse" in l) {
    const { c, rx, ry, rot } = l.ellipse;
    const t = (rot * Math.PI) / 180;
    return Array.from({ length: 48 }, (_, i) => {
      const a = (i / 48) * TAU, x = rx * Math.cos(a), y = ry * Math.sin(a);
      return [c[0] + x * Math.cos(t) - y * Math.sin(t), c[1] + x * Math.sin(t) + y * Math.cos(t)] as Vec2;
    });
  }
  const out: Vec2[] = [];
  for (const s of l.segs) out.push(...segPoints(s).slice(0, -1));
  return out;
}

function circle3(a: Vec2, b: Vec2, c: Vec2) {
  const bx = b[0] - a[0], by = b[1] - a[1], cx = c[0] - a[0], cy = c[1] - a[1];
  const D = 2 * (bx * cy - by * cx);
  if (Math.abs(D) < 1e-12) return null;
  const ux = (cy * (bx * bx + by * by) - by * (cx * cx + cy * cy)) / D;
  const uy = (bx * (cx * cx + cy * cy) - cx * (bx * bx + by * by)) / D;
  return { c: [a[0] + ux, a[1] + uy] as Vec2, r: Math.hypot(ux, uy) };
}

/** Süpürme yolu: tek bir açık veya kapalı zincir (yapı geometrisi hariç) */
export function extractPath(sk: SketchData): { segs: Seg[]; closed: boolean; error?: string } {
  const { chains, error } = extractChains(sk);
  if (error) return { segs: [], closed: false, error };
  if (chains.length !== 1) return { segs: [], closed: false, error: chains.length ? "Yol tek bir kesintisiz zincir olmalı" : "Yol eskizi boş" };
  return chains[0];
}

// ---------------- Kalınlaştırma (ince özellik, kaburga) ----------------

type Off = { t: "l"; a: Vec2; b: Vec2 } | { t: "c"; c: Vec2; r: number; a: Vec2; b: Vec2; ccw: boolean };

/** Çizgi/yay olmayan parçaları çizgilere böler */
function toLinesArcs(segs: Seg[]): Seg[] {
  const out: Seg[] = [];
  for (const s of segs) {
    if (s.t === "l" || s.t === "a") out.push(s);
    else {
      const pts = segPoints(s, 16);
      for (let i = 0; i < pts.length - 1; i++) out.push({ t: "l", a: pts[i], b: pts[i + 1] });
    }
  }
  return out;
}

/** Zinciri sol tarafa d kadar öteler (d<0 sağ) */
export function offsetSegs(segsIn: Seg[], d: number, closed: boolean): Seg[] {
  const segs = toLinesArcs(segsIn);
  const offs: Off[] = segs.map((s) => {
    if (s.t === "l") {
      const n = perp(norm2(sub2(s.b, s.a)));
      return { t: "l", a: add2(s.a, mul2(n, d)), b: add2(s.b, mul2(n, d)) };
    }
    const m = (s as Extract<Seg, { t: "a" }>).m;
    const c = circle3(s.a, m, s.b)!;
    const a0 = ang(c.c, s.a), am = ang(c.c, m), a1 = ang(c.c, s.b);
    const ccw = normAng(am - a0) < normAng(a1 - a0);
    const r = c.r + (ccw ? -d : d);
    if (r <= 1e-6) throw new Error("Kalınlık yay yarıçapından büyük");
    const k = r / c.r;
    return { t: "c", c: c.c, r, ccw, a: add2(c.c, mul2(sub2(s.a, c.c), k)), b: add2(c.c, mul2(sub2(s.b, c.c), k)) };
  });
  const n = offs.length;
  const join = (A: Off, B: Off): Vec2 => {
    const guess = mul2(add2(A.b, B.a), 0.5);
    let cands: Vec2[] = [];
    if (A.t === "l" && B.t === "l") {
      const x = lineLine(A.a, A.b, B.a, B.b);
      cands = x ? [x.p] : [];
    } else if (A.t === "l" && B.t === "c") cands = lineCircle(A.a, A.b, B.c, B.r).map((x) => x.p);
    else if (A.t === "c" && B.t === "l") cands = lineCircle(B.a, B.b, A.c, A.r).map((x) => x.p);
    else if (A.t === "c" && B.t === "c") cands = circleCircle(A.c, A.r, B.c, B.r);
    if (!cands.length) return guess;
    return cands.reduce((best, p) => (d2(p, guess) < d2(best, guess) ? p : best));
  };
  const pts: Vec2[] = [];
  for (let i = 0; i < n; i++) pts.push(i === 0 && !closed ? offs[0].a : join(offs[(i - 1 + n) % n], offs[i]));
  pts.push(closed ? pts[0] : offs[n - 1].b);
  return offs.map((o, i) => {
    const a = pts[i], b = pts[i + 1];
    if (o.t === "l") return { t: "l", a, b } as Seg;
    const a0 = ang(o.c, a), a1 = ang(o.c, b);
    const span = o.ccw ? normAng(a1 - a0) : -normAng(a0 - a1);
    const m = add2(o.c, mul2([Math.cos(a0 + span / 2), Math.sin(a0 + span / 2)], o.r));
    return { t: "a", a, b, m } as Seg;
  });
}

/** İnce özellik bölgesi: konturdan kalınlık kadar halka / şerit */
export function thinRegion(chains: { segs: Seg[]; closed: boolean }[], t: number, mode: "one" | "rev" | "mid"): Loop[] {
  const loops: Loop[] = [];
  for (const ch of chains) {
    if (ch.closed) {
      // kapalı kontur: "tek taraf" dışa doğru
      const poly: Vec2[] = [];
      ch.segs.forEach((s) => poly.push(...segPoints(s).slice(0, -1)));
      const sgn = polyArea(poly) > 0 ? -1 : 1;
      const outerD = sgn * (mode === "rev" ? 0 : mode === "mid" ? t / 2 : t);
      const innerD = sgn * (mode === "one" ? 0 : mode === "mid" ? -t / 2 : -t);
      const o = outerD === 0 ? toLinesArcs(ch.segs) : offsetSegs(ch.segs, outerD, true);
      const i = innerD === 0 ? toLinesArcs(ch.segs) : offsetSegs(ch.segs, innerD, true);
      loops.push({ segs: o, depth: 0 }, { segs: i, depth: 1 });
    } else {
      const [l, r] = mode === "mid" ? [t / 2, -t / 2] : mode === "one" ? [t, 0] : [0, -t];
      const left = l === 0 ? toLinesArcs(ch.segs) : offsetSegs(ch.segs, l, false);
      const right = r === 0 ? toLinesArcs(ch.segs) : offsetSegs(ch.segs, r, false);
      const back = [...right].reverse().map(revSeg);
      const segs: Seg[] = [...left, { t: "l", a: left[left.length - 1].b, b: back[0].a }, ...back, { t: "l", a: back[back.length - 1].b, b: left[0].a }];
      loops.push({ segs, depth: 0 });
    }
  }
  return loops;
}

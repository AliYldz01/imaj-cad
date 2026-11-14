// Seçili eskiz varlıkları üzerinde toplu işlemler:
// ötele (offset), aynala, doğrusal / dairesel çoğaltma, taşı / kopyala / döndür.
import type { SArc, SEnt, SLine, SketchData, Vec2 } from "../doc/types";
import { ORIGIN } from "../doc/types";
import { P, addArc, addCircle, addLine, addPt, addRel, entPoints, nid, ellipseGeo } from "./model";
import { add2, ang, circleCircle, crs2, d2, dot2, lineCircle, lineLine, mul2, norm2, perp, polyArea, sub2 } from "./geom";

const isCurve = (e: SEnt) => e.t === "line" || e.t === "arc" || e.t === "circle";

/** Varlıkları bir nokta dönüşümüyle kopyalar; iç ilişkileri isteğe bağlı kopyalar */
export function copyEnts(
  sk: SketchData,
  ents: SEnt[],
  map: (p: Vec2) => Vec2,
  opts: { reverse?: boolean; copyRels?: boolean; skipHV?: boolean; keep?: (pid: string) => boolean; scale?: number } = {},
): Map<string, string> {
  const idMap = new Map<string, string>();
  const ptOf = (pid: string) => {
    if (idMap.has(pid)) return idMap.get(pid)!;
    if (opts.keep?.(pid)) {
      idMap.set(pid, pid);
      return pid;
    }
    const nidp = addPt(sk, map(P(sk, pid)));
    idMap.set(pid, nidp);
    return nidp;
  };
  for (const e of ents) {
    const k = opts.scale ?? 1;
    if (e.t === "line") idMap.set(e.id, addLine(sk, ptOf(e.p1), ptOf(e.p2), e.cons).id);
    else if (e.t === "circle") idMap.set(e.id, addCircle(sk, ptOf(e.c), e.r * k, e.cons).id);
    else if (e.t === "ellipse" || e.t === "spline" || e.t === "parabola" || e.t === "text") {
      const ne: any = JSON.parse(JSON.stringify(e));
      ne.id = nid(sk, e.t[0]);
      for (const key of ["c", "a", "s", "e", "k", "p"]) if (typeof ne[key] === "string") ne[key] = ptOf(ne[key]);
      if (ne.pts) ne.pts = ne.pts.map(ptOf);
      if (e.t === "spline" && e.h) {
        const hv = (v: Vec2 | null, i: number) => {
          if (!v) return null;
          const q = P(sk, e.pts[i]), a = map(q), b = map([q[0] + v[0], q[1] + v[1]]);
          return [b[0] - a[0], b[1] - a[1]] as Vec2;
        };
        ne.h = e.h.map(hv);
      }
      if (e.t === "ellipse") ne.rb = e.rb * k;
      if (e.t === "text") ne.size = e.size * k;
      sk.ents.push(ne);
      if (ne.t === "ellipse" && ne.s && ne.e) {
        const g = ellipseGeo(sk, ne);
        let [t0, t1] = [g.param(P(sk, ne.s)), g.param(P(sk, ne.e))];
        if (opts.reverse) {
          [ne.s, ne.e] = [ne.e, ne.s];
          [t0, t1] = [t1, t0];
        }
        ne.t0 = t0;
        ne.t1 = t1;
      }
      idMap.set(e.id, ne.id);
    }
    else if (e.t === "arc") {
      const c = ptOf(e.c), s = ptOf(e.s), en = ptOf(e.e);
      const a = opts.reverse ? addArc(sk, c, en, s, e.cons) : addArc(sk, c, s, en, e.cons);
      a.r = e.r * k;
      idMap.set(e.id, a.id);
    } else if (e.t === "point") {
      const p = ptOf(e.p);
      const ne = { id: nid(sk, "n"), t: "point" as const, p };
      sk.ents.push(ne);
      idMap.set(e.id, ne.id);
    }
  }
  if (opts.copyRels) {
    const inside = (id: string) => idMap.has(id);
    for (const r of [...sk.rels]) {
      if (!r.refs.every(inside) || r.t === "fix") continue;
      if (opts.skipHV && (r.t === "horizontal" || r.t === "vertical")) continue;
      addRel(sk, r.t, r.refs.map((x) => idMap.get(x)!));
    }
    for (const d of [...sk.dims]) {
      if (!d.refs.every(inside)) continue;
      if (opts.skipHV && d.t === "dist" && d.sub !== "a") continue;
      sk.dims.push({ ...d, id: nid(sk, "d"), refs: d.refs.map((x) => idMap.get(x)!), lp: map(d.lp) });
    }
  }
  return idMap;
}

/** Bir doğruya göre yansıtma */
export function reflectFn(a: Vec2, b: Vec2) {
  const u = norm2(sub2(b, a));
  return (p: Vec2): Vec2 => {
    const v = sub2(p, a);
    const proj = mul2(u, dot2(v, u));
    const perpv = sub2(v, proj);
    return add2(a, sub2(proj, perpv));
  };
}

export function rotateFn(c: Vec2, angDeg: number) {
  const t = (angDeg * Math.PI) / 180;
  const cs = Math.cos(t), sn = Math.sin(t);
  return (p: Vec2): Vec2 => {
    const x = p[0] - c[0], y = p[1] - c[1];
    return [c[0] + x * cs - y * sn, c[1] + x * sn + y * cs];
  };
}

/** Aynala: noktaları eksene göre simetrik bağlar; eksen üzerindeki noktaları paylaşır */
export function mirrorEnts(sk: SketchData, ents: SEnt[], axis: SLine) {
  const A = P(sk, axis.p1), B = P(sk, axis.p2);
  const f = reflectFn(A, B);
  const u = norm2(sub2(B, A));
  const onAxis = (pid: string) => Math.abs(crs2(u, sub2(P(sk, pid), A))) < 1e-7;
  const map = copyEnts(sk, ents, f, { reverse: true, keep: onAxis });
  for (const [from, to] of map) {
    if (from === to) continue;
    if (from === ORIGIN || sk.pts[from]) addRel(sk, "symmetric", [from, to, axis.id]);
  }
  for (const e of ents) if (e.t === "circle") addRel(sk, "equal", [e.id, map.get(e.id)!]);
}

/** E-23: çoğaltma örneklerinin bağları — daireler tohumla eşit, noktalar ilişkiyle bağlı (kopyalanan iç ilişkiler gereksiz olurdu) */
function patternRest(sk: SketchData, ents: SEnt[], map: Map<string, string>) {
  for (const e of ents) if (e.t === "circle" && map.get(e.id)) addRel(sk, "equal", [e.id, map.get(e.id)!]);
}
/** çoğaltılan öğelerin tohum noktaları (sabit / orijin dışı) */
function seedPoints(ents: SEnt[]) {
  const pts: string[] = [];
  for (const e of ents) for (const q of entPoints(e)) if (q !== ORIGIN && !pts.includes(q)) pts.push(q);
  return pts;
}

/** Doğrusal eskiz çoğaltma */
export function linearPattern(sk: SketchData, ents: SEnt[], o: { n1: number; s1: number; a1: number; n2: number; s2: number; a2: number; skip?: string[] }) {
  const d1: Vec2 = [Math.cos((o.a1 * Math.PI) / 180), Math.sin((o.a1 * Math.PI) / 180)];
  const d2v: Vec2 = [Math.cos((o.a2 * Math.PI) / 180), Math.sin((o.a2 * Math.PI) / 180)];
  const g = nid(sk, "g");
  const seeds = seedPoints(ents);
  // yön başına aralık ölçüsü için en yakın örnek
  const first: Record<1 | 2, { k: number; map: Map<string, string> } | null> = { 1: null, 2: null };
  for (let i = 0; i < Math.max(1, o.n1); i++)
    for (let j = 0; j < Math.max(1, o.n2); j++) {
      if (!i && !j) continue;
      // örnek atla: "satır,sütun" (1'den başlar) ya da tek yönde sıra no
      if (o.skip?.includes(`${i + 1},${j + 1}`) || (o.n2 <= 1 && o.skip?.includes(String(i + 1)))) continue;
      const off = add2(mul2(d1, i * o.s1), mul2(d2v, j * o.s2));
      const map = copyEnts(sk, ents, (p) => add2(p, off));
      for (const q of seeds) if (map.get(q)) addRel(sk, "lpat", [q, map.get(q)!], { pk: [i, j], pg: g, pv: [d1[0] * o.s1, d1[1] * o.s1, d2v[0] * o.s2, d2v[1] * o.s2] });
      patternRest(sk, ents, map);
      if (!j && (!first[1] || i < first[1].k)) first[1] = { k: i, map };
      if (!i && (!first[2] || j < first[2].k)) first[2] = { k: j, map };
    }
  // aralık ölçüsü + 0° / 90° yönde yatay / dikey ilişki (SolidWorks: aralık ve açı ölçüsü)
  const s0 = seeds[0];
  ([1, 2] as const).forEach((w) => {
    const f = first[w];
    if (!s0 || !f) return;
    const q = f.map.get(s0)!;
    const a = (((w === 1 ? o.a1 : o.a2) % 180) + 180) % 180;
    if (Math.abs(a) < 1e-9) addRel(sk, "horizontal", [s0, q]);
    else if (Math.abs(a - 90) < 1e-9) addRel(sk, "vertical", [s0, q]);
    const v = f.k * (w === 1 ? o.s1 : o.s2);
    if (v > 1e-9) sk.dims.push({ id: nid(sk, "d"), t: "dist", sub: "a", refs: [s0, q], v, lp: add2(mul2(add2(P(sk, s0), P(sk, q)), 0.5), [0, 4]) } as any);
  });
}

/** Dairesel eskiz çoğaltma (cid: merkez noktası kimliği) */
export function circularPattern(sk: SketchData, ents: SEnt[], o: { c: Vec2; cid?: string; n: number; total: number; skip?: string[] }) {
  const step = Math.abs(o.total - 360) < 1e-9 ? o.total / o.n : o.total / Math.max(1, o.n - 1);
  const g = nid(sk, "g");
  const cid = o.cid ?? ORIGIN;
  const seeds = seedPoints(ents);
  for (let i = 1; i < o.n; i++) {
    if (o.skip?.includes(String(i + 1))) continue;
    const map = copyEnts(sk, ents, rotateFn(o.c, step * i));
    for (const q of seeds) {
      const m = map.get(q);
      if (!m) continue;
      if (q === cid || d2(P(sk, q), P(sk, cid)) < 1e-9) addRel(sk, "coincident", [q, m]);
      else addRel(sk, "cpat", [cid, q, m], { pa: (step * i * Math.PI) / 180, pg: g });
    }
    patternRest(sk, ents, map);
  }
}

/** Taşı / kopyala / döndür */
export function moveEnts(sk: SketchData, ents: SEnt[], o: { dx: number; dy: number; ang: number; c: Vec2; copy: boolean; scale?: number }) {
  const rot = rotateFn(o.c, o.ang);
  const k = o.scale ?? 1;
  const f = (p: Vec2): Vec2 => {
    const q = rot(p);
    return add2([o.c[0] + (q[0] - o.c[0]) * k, o.c[1] + (q[1] - o.c[1]) * k], [o.dx, o.dy]);
  };
  if (o.copy) return copyEnts(sk, ents, f, { copyRels: true, skipHV: Math.abs(o.ang) > 1e-9, scale: k });
  if (Math.abs(k - 1) > 1e-12) {
    for (const e of ents) {
      if (e.t === "circle" || e.t === "arc") e.r *= k;
      if (e.t === "ellipse") e.rb *= k;
      if (e.t === "text") e.size *= k;
    }
    // D2-14: ölçeklenen öğelerin uzunluk ölçüleri de ölçeklenir (SolidWorks); dışarıya bağlanan ölçüler kalkar
    const pts = new Set<string>();
    ents.forEach((e) => entPoints(e).forEach((p) => pts.add(p)));
    const inSel = (r: string) => pts.has(r) || ents.some((e) => e.id === r);
    sk.dims = sk.dims.filter((d) => {
      if (!d.refs.some(inSel)) return true;
      if (!d.refs.every(inSel)) return false;
      if (d.t !== "angle") {
        d.v *= k;
        delete d.expr;
      }
      return true;
    });
  }
  for (const e of ents)
    if (e.t === "spline" && e.h)
      e.h = e.h.map((v, i) => {
        if (!v) return null;
        const q = P(sk, e.pts[i]), a = f(q), b = f([q[0] + v[0], q[1] + v[1]]);
        return [b[0] - a[0], b[1] - a[1]] as Vec2;
      });
  const pts = new Set<string>();
  ents.forEach((e) => entPoints(e).forEach((p) => p !== ORIGIN && pts.add(p)));
  for (const id of pts) {
    const q = f(P(sk, id));
    sk.pts[id] = { x: q[0], y: q[1] };
  }
  // sabit noktalar taşınınca sabit değerleri de güncellenir
  for (const r of sk.rels) if (r.t === "fix" && pts.has(r.refs[0])) [r.fx, r.fy] = P(sk, r.refs[0]);
  if (Math.abs(o.ang) > 1e-9) {
    // D2-4: dönen öğelerin yatay / dikey ilişkileri ve ölçüleri döndürmeyle tutarlı hâle getirilir
    const q = ((Math.round(o.ang / 90) % 4) + 4) % 4, right = Math.abs(o.ang / 90 - Math.round(o.ang / 90)) < 1e-9;
    const eid = new Set(ents.map((e) => e.id));
    const moved = (r: { refs: string[] }) => r.refs.some((x) => eid.has(x)) || (r.refs.length > 1 && r.refs.every((x) => pts.has(x)));
    const swap = (t: string) => (t === "horizontal" ? "vertical" : t === "vertical" ? "horizontal" : t);
    sk.rels = sk.rels.filter((r) => {
      if ((r.t !== "horizontal" && r.t !== "vertical") || !moved(r)) return true;
      if (!right) return false;
      if (q % 2) r.t = swap(r.t) as any;
      return true;
    });
    for (const d of sk.dims) {
      if ((d.sub !== "h" && d.sub !== "v") || !moved(d)) continue;
      if (right) {
        if (q % 2) d.sub = d.sub === "h" ? "v" : "h";
        continue;
      }
      const ln = d.refs.length === 1 ? (sk.ents.find((e) => e.id === d.refs[0]) as any) : null;
      const [a, b] = ln?.t === "line" ? [ln.p1, ln.p2] : d.refs;
      if (!sk.pts[a] || !sk.pts[b]) continue;
      d.sub = "a";
      if (!d.expr) d.v = Math.hypot(sk.pts[a].x - sk.pts[b].x, sk.pts[a].y - sk.pts[b].y);
    }
  }
  return null;
}

export function centroid(sk: SketchData, ents: SEnt[]): Vec2 {
  let sx = 0, sy = 0, n = 0;
  for (const e of ents) for (const p of entPoints(e)) {
    const q = P(sk, p);
    sx += q[0];
    sy += q[1];
    n++;
  }
  return n ? [sx / n, sy / n] : [0, 0];
}

// ---------------- Ötele ----------------

interface Piece { e: SLine | SArc; fwd: boolean }

/** Seçili çizgi/yayları zincirlere ayırır */
function chains(sk: SketchData, ents: (SLine | SArc)[]): { pieces: Piece[]; closed: boolean }[] {
  const endsOf = (e: SLine | SArc) => (e.t === "line" ? [e.p1, e.p2] : [e.s, e.e]);
  const used = new Set<string>();
  const out: { pieces: Piece[]; closed: boolean }[] = [];
  const nb = (pid: string, not: string) => ents.filter((x) => x.id !== not && !used.has(x.id) && endsOf(x).includes(pid));
  for (const start of ents) {
    if (used.has(start.id)) continue;
    // zincirin başına git
    let first = start;
    let fp = endsOf(start)[0];
    const seen = new Set([start.id]);
    for (;;) {
      const prev = ents.filter((x) => !seen.has(x.id) && !used.has(x.id) && endsOf(x).includes(fp));
      if (prev.length !== 1) break;
      first = prev[0];
      seen.add(first.id);
      const [a, b] = endsOf(first);
      fp = a === fp ? b : a;
    }
    const pieces: Piece[] = [];
    let cur: SLine | SArc | undefined = first;
    let at = fp;
    while (cur) {
      used.add(cur.id);
      const [a, b] = endsOf(cur);
      const fwd = a === at;
      pieces.push({ e: cur, fwd });
      at = fwd ? b : a;
      const next: (SLine | SArc)[] = nb(at, cur.id);
      cur = next.length === 1 ? next[0] : undefined;
    }
    const startPt = pieces[0].fwd ? endsOf(pieces[0].e)[0] : endsOf(pieces[0].e)[1];
    out.push({ pieces, closed: pieces.length > 1 && at === startPt });
  }
  return out;
}

type OffCurve = { t: "l"; a: Vec2; b: Vec2 } | { t: "c"; c: Vec2; r: number; s: Vec2; e: Vec2 };

export function offsetEnts(sk: SketchData, ents: SEnt[], dist: number, reverse: boolean): string | null {
  // SolidWorks: yapı geometrisi (ör. merkez dikdörtgenin köşegenleri) ötelenmez; köşede zinciri bozmasın
  const all = ents.filter(isCurve);
  const curves = all.some((e) => !e.cons) ? all.filter((e) => !e.cons) : all;
  const circles = curves.filter((e) => e.t === "circle");
  const segs = curves.filter((e) => e.t !== "circle") as (SLine | SArc)[];
  if (!curves.length) return "Ötelemek için çizgi, yay veya daire seçin";
  // E-4: taban ↔ ötelenmiş çiftleri tek "öteleme" ilişkisinde (ortak mesafe) toplanır
  const pairs: string[] = [];
  let firstLine: { orig: SLine; neu: SLine } | null = null;
  for (const c of circles) {
    if (c.t !== "circle") continue;
    const r = c.r + (reverse ? -dist : dist);
    if (r <= 0) return "Öteleme mesafesi daire yarıçapından büyük";
    pairs.push(c.id, addCircle(sk, c.c, r, c.cons).id);
  }
  for (const ch of chains(sk, segs)) {
    // kapalı zincirde varsayılan: dışa doğru
    let sgn = reverse ? -1 : 1;
    if (ch.closed) {
      const poly = ch.pieces.map((p) => P(sk, p.fwd ? (p.e.t === "line" ? p.e.p1 : p.e.s) : p.e.t === "line" ? p.e.p2 : p.e.e));
      if (polyArea(poly) > 0) sgn = -sgn;
    }
    const d = dist * sgn; // sol tarafa pozitif
    const offs: OffCurve[] = ch.pieces.map(({ e, fwd }) => {
      if (e.t === "line") {
        const a = P(sk, fwd ? e.p1 : e.p2), b = P(sk, fwd ? e.p2 : e.p1);
        const n = perp(norm2(sub2(b, a)));
        return { t: "l", a: add2(a, mul2(n, d)), b: add2(b, mul2(n, d)) };
      }
      const c = P(sk, e.c);
      // yay CCW s→e; ileri yönde sol taraf merkeze doğrudur
      const r = e.r + (fwd ? -d : d);
      const s = P(sk, e.s), en = P(sk, e.e);
      const k = r / e.r;
      return { t: "c", c, r, s: add2(c, mul2(sub2(s, c), k)), e: add2(c, mul2(sub2(en, c), k)) };
    });
    if (offs.some((o) => o.t === "c" && o.r <= 0)) return "Öteleme mesafesi yay yarıçapından büyük";
    const startOf = (o: OffCurve, fwd: boolean, isLine: boolean) => (isLine ? (o as any).a : fwd ? (o as any).s : (o as any).e);
    const endOf = (o: OffCurve, fwd: boolean, isLine: boolean) => (isLine ? (o as any).b : fwd ? (o as any).e : (o as any).s);
    const joinPt = (i: number, j: number): Vec2 => {
      const A = offs[i], B = offs[j];
      const guess = mul2(add2(endOf(A, ch.pieces[i].fwd, A.t === "l"), startOf(B, ch.pieces[j].fwd, B.t === "l")), 0.5);
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
    const n = ch.pieces.length;
    const joins: string[] = [];
    for (let i = 0; i < n; i++) {
      if (i === 0 && !ch.closed) joins.push(addPt(sk, startOf(offs[0], ch.pieces[0].fwd, offs[0].t === "l")));
      else joins.push(addPt(sk, joinPt((i - 1 + n) % n, i)));
    }
    const last = ch.closed ? joins[0] : addPt(sk, endOf(offs[n - 1], ch.pieces[n - 1].fwd, offs[n - 1].t === "l"));
    for (let i = 0; i < n; i++) {
      const { e, fwd } = ch.pieces[i];
      const p0 = joins[i], p1 = i === n - 1 ? last : joins[i + 1];
      if (e.t === "line") {
        const l = addLine(sk, p0, p1, e.cons);
        addRel(sk, "parallel", [e.id, l.id]);
        pairs.push(e.id, l.id);
        if (!firstLine) firstLine = { orig: e, neu: l };
      } else {
        const a = fwd ? addArc(sk, e.c, p0, p1, e.cons) : addArc(sk, e.c, p1, p0, e.cons);
        a.r = Math.max(1e-6, d2(P(sk, e.c), P(sk, p0)));
        pairs.push(e.id, a.id);
      }
    }
  }
  if (pairs.length > 2 || (pairs.length && !firstLine)) addRel(sk, "offset", pairs);
  // mesafe ölçüsü (tüm öteleme bunu izler)
  if (firstLine) sk.dims.push({ id: nid(sk, "d"), t: "pldist", refs: [firstLine.orig.id, firstLine.neu.id], v: Math.abs(dist), lp: mul2(add2(P(sk, firstLine.neu.p1), P(sk, firstLine.neu.p2)), 0.5) });
  return null;
}

export const angOf = ang;

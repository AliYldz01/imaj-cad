// Sac metal açınımı (düz desen) — çekirdek iş parçacığında çalışır.
//
// Yöntem: Sacın bir yüzü (en büyük düz yüzün bulunduğu taraf) seçilir. Bu yüzden başlayarak
// teğet komşu yüzler (düz yüzler ve büküm silindirleri) dolaşılır; kalınlık yüzleri 90° ile
// birleştiği için dolaşıma girmez. Her düz yüz rijit dönüşümle, her büküm silindiri ise nötr
// eksen uzunluğuyla (açı × (r_iç + K·t)) düzleme açılır. Sonradan açılan delikler, kesimler ve
// köşe boşaltmaları da yüz sınırlarında yer aldığından açınıma kendiliğinden yansır.

import { getOC, measureArea, measureShapeVolumeProperties } from "replicad";
import type { Flat2D, FlatBend, Frame, Loop, Seg, Vec2, Vec3 } from "../doc/types";

type Shape = any;

const vadd = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const vmul = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const vsub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vdot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vlen = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const vnorm = (a: Vec3): Vec3 => vmul(a, 1 / (vlen(a) || 1));
const vcross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const tup = (v: any): Vec3 => v.toTuple() as Vec3;

/** Rijit dönüşüm: o1'deki A çerçevesini o2'deki B çerçevesine taşır */
interface Rigid { k: "p"; o1: Vec3; A: [Vec3, Vec3, Vec3]; o2: Vec3; B: [Vec3, Vec3, Vec3] }
/** Büküm silindiri açılımı */
interface CylMap {
  k: "c";
  L: Vec3; // eksen üzerinde nokta
  a: Vec3; // eksen yönü
  rho: number; // yüz yarıçapı
  p1: Vec3; // başlangıç teğet çizgisi üzerinde nokta
  rad1: Vec3;
  s: number; // açı işareti
  rhoN: number; // nötr eksen yarıçapı
  rin: number; // iç büküm yarıçapı
  inner: boolean; // bu taraf bükümün iç yüzü mü
  p1f: Vec3;
  af: Vec3;
  t1f: Vec3;
  nf: Vec3;
}
type FMap = Rigid | CylMap;

const ID: Rigid = { k: "p", o1: [0, 0, 0], A: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], o2: [0, 0, 0], B: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] };
const rigidV = (m: Rigid, v: Vec3): Vec3 => vadd(vadd(vmul(m.B[0], vdot(v, m.A[0])), vmul(m.B[1], vdot(v, m.A[1]))), vmul(m.B[2], vdot(v, m.A[2])));
const rigidP = (m: Rigid, x: Vec3): Vec3 => vadd(m.o2, rigidV(m, vsub(x, m.o1)));

function cylPhi(m: CylMap, x: Vec3) {
  const rel = vsub(x, m.L);
  const radX = vnorm(vsub(rel, vmul(m.a, vdot(rel, m.a))));
  let phi = m.s * Math.atan2(vdot(vcross(m.rad1, radX), m.a), vdot(m.rad1, radX));
  if (phi < -0.5) phi += 2 * Math.PI;
  return Math.max(0, phi);
}
function cylP(m: CylMap, x: Vec3): Vec3 {
  const z = vdot(vsub(x, m.p1), m.a);
  return vadd(vadd(m.p1f, vmul(m.af, z)), vmul(m.t1f, cylPhi(m, x) * m.rhoN));
}
const mapP = (m: FMap, x: Vec3) => (m.k === "p" ? rigidP(m, x) : cylP(m, x));

export function cylinderParams(face: Shape): { L: Vec3; a: Vec3; rho: number } {
  const oc = getOC() as any;
  const ad = new oc.BRepAdaptor_Surface(face.wrapped, false);
  try {
    const cy = ad.Cylinder();
    const ax = cy.Axis();
    const l = ax.Location(), d = ax.Direction();
    const out = { L: [l.X(), l.Y(), l.Z()] as Vec3, a: vnorm([d.X(), d.Y(), d.Z()]), rho: cy.Radius() };
    cy.delete?.();
    return out;
  } finally {
    ad.delete();
  }
}

const normalAt = (face: Shape, p: Vec3): Vec3 => vnorm(tup(face.normalAt(p)));

function circle3d(a: Vec3, b: Vec3, c: Vec3): { c: Vec3; r: number } | null {
  const ab = vsub(b, a), ac = vsub(c, a);
  const n = vcross(ab, ac);
  const nn = vdot(n, n);
  if (nn < 1e-18) return null;
  const t = vadd(vmul(vcross(n, ab), vdot(ac, ac)), vmul(vcross(ac, n), vdot(ab, ab)));
  const center = vadd(a, vmul(t, 1 / (2 * nn)));
  return { c: center, r: vlen(vsub(a, center)) };
}

export interface UnfoldOut {
  frame: Frame;
  loops: Loop[];
  outline: Flat2D[];
  bends: FlatBend[];
  area: number;
  min: Vec2;
  max: Vec2;
}

type Piece = { t: "l"; a: Vec2; b: Vec2 } | { t: "a"; a: Vec2; b: Vec2; m: Vec2 } | { t: "c"; c: Vec2; r: number };

export function unfold(body: Shape, t: number, kIn: number | ((angleDeg: number, rin: number) => number)): UnfoldOut {
  let k = typeof kIn === "number" ? kIn : 0.44;
  const faces = body.faces as Shape[];
  const types = faces.map((f) => String(f.geomType));
  const faceEdges = faces.map((f) => f.edges as Shape[]);
  const e2f = new Map<number, number[]>();
  faceEdges.forEach((es, i) =>
    es.forEach((e) => {
      const arr = e2f.get(e.hashCode) ?? [];
      if (!arr.includes(i)) arr.push(i);
      e2f.set(e.hashCode, arr);
    }),
  );

  // sabit yüz: en büyük düz yüz
  let i0 = -1, best = 0;
  faces.forEach((f, i) => {
    if (types[i] !== "PLANE") return;
    const ar = measureArea(f);
    if (ar > best) [best, i0] = [ar, i];
  });
  if (i0 < 0) throw new Error("Gövdede düz yüz yok");
  const F0 = faces[i0];
  const c0 = tup(F0.center);
  const n0 = normalAt(F0, c0);
  // yatay eksen: sabit yüzün en uzun düz kenarı
  let x0: Vec3 | null = null, lmax = 0;
  for (const e of faceEdges[i0]) {
    if (String(e.geomType) !== "LINE") continue;
    const d = vsub(tup(e.endPoint), tup(e.startPoint));
    if (vlen(d) > lmax) [lmax, x0] = [vlen(d), vnorm(d)];
  }
  if (!x0) x0 = vnorm(Math.abs(n0[2]) < 0.9 ? vcross([0, 0, 1], n0) : vcross([1, 0, 0], n0));
  const y0 = vcross(n0, x0);
  const frame: Frame = { o: c0, x: x0, n: n0 };
  const to2 = (p: Vec3): Vec2 => [vdot(vsub(p, c0), x0), vdot(vsub(p, c0), y0)];

  // dolaşım
  const maps = new Map<number, FMap>([[i0, ID]]);
  const tangent = new Set<number>();
  const queue = [i0];
  while (queue.length) {
    const i = queue.shift()!;
    const mi = maps.get(i)!;
    for (const e of faceEdges[i]) {
      const nb = (e2f.get(e.hashCode) ?? []).filter((j) => j !== i);
      if (nb.length !== 1) continue;
      const j = nb[0];
      const pm = tup(e.pointAt(0.5));
      let dot: number;
      try {
        dot = vdot(normalAt(faces[i], pm), normalAt(faces[j], pm));
      } catch {
        continue;
      }
      if (dot < 0.999) continue;
      tangent.add(e.hashCode);
      if (maps.has(j)) continue;
      const tj = types[j];
      let mj: FMap;
      if (tj !== "PLANE" && tj !== "CYLINDRE") throw new Error(`Açınım desteklenmeyen bir yüz içeriyor (${tj}). Sac yalnızca düz bölgeler ve silindirik bükümlerden oluşmalı.`);
      if (mi.k === "p" && tj === "PLANE") mj = mi;
      else if (mi.k === "p") {
        const { L, a, rho } = cylinderParams(faces[j]);
        const rel = vsub(pm, L);
        const rad1 = vnorm(vsub(rel, vmul(a, vdot(rel, a))));
        const nP = normalAt(faces[i], pm);
        let t1 = vnorm(vcross(a, nP));
        if (vdot(vsub(tup(faces[j].center), pm), t1) < 0) t1 = vmul(t1, -1);
        const s = Math.sign(vdot(vcross(a, rad1), t1)) || 1;
        const inner = vdot(normalAt(faces[j], pm), rad1) < 0;
        const rin = inner ? rho : rho - t;
        if (rin < -1e-6) throw new Error("Büküm yarıçapı sac kalınlığıyla uyumsuz (kalınlık yanlış olabilir)");
        if (typeof kIn === "function") {
          // büküm açısı: silindir yüzünün eksen etrafındaki açıklığı
          const w2 = vcross(a, rad1);
          let lo = 0, hi = 0;
          for (const ed of faceEdges[j]) for (const q of [0, 0.5, 1]) {
            const r = vsub(tup(ed.pointAt(q)), L);
            const pr = vsub(r, vmul(a, vdot(r, a)));
            const ang = Math.atan2(vdot(pr, w2), vdot(pr, rad1));
            lo = Math.min(lo, ang);
            hi = Math.max(hi, ang);
          }
          k = kIn(((hi - lo) * 180) / Math.PI, Math.max(0, rin));
        }
        mj = { k: "c", L, a, rho, p1: pm, rad1, s, rhoN: Math.max(0, rin) + k * t, rin: Math.max(0, rin), inner, p1f: rigidP(mi, pm), af: rigidV(mi, a), t1f: rigidV(mi, t1), nf: rigidV(mi, nP) };
      } else if (tj === "PLANE") {
        const mc = mi as CylMap;
        const rel = vsub(pm, mc.L);
        const rad2 = vnorm(vsub(rel, vmul(mc.a, vdot(rel, mc.a))));
        const t2 = vmul(vnorm(vcross(mc.a, rad2)), mc.s);
        const nQ = normalAt(faces[j], pm);
        mj = { k: "p", o1: pm, A: [mc.a, t2, nQ], o2: cylP(mc, pm), B: [mc.af, mc.t1f, mc.nf] };
      } else {
        const mc = mi as CylMap;
        const q = cylinderParams(faces[j]);
        const coax = vlen(vcross(q.a, mc.a)) < 1e-6 && vlen(vcross(vsub(q.L, mc.L), mc.a)) < 1e-4 && Math.abs(q.rho - mc.rho) < 1e-4;
        if (!coax) throw new Error("Arka arkaya farklı bükümler (aralarında düz bölge olmadan) henüz açılamıyor");
        mj = mc;
      }
      maps.set(j, mj);
      queue.push(j);
    }
  }

  // dış hatlar
  const pieces: Piece[] = [];
  const done = new Set<number>();
  const pushPoly = (pts: Vec2[]) => {
    // doğrusal mı?
    const a = pts[0], b = pts[pts.length - 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const straight = L > 1e-9 && pts.every((p) => Math.abs((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) / L < 1e-4);
    if (straight) pieces.push({ t: "l", a, b });
    else for (let i = 0; i + 1 < pts.length; i++) pieces.push({ t: "l", a: pts[i], b: pts[i + 1] });
  };
  for (const [i, m] of maps) {
    for (const e of faceEdges[i]) {
      const h = e.hashCode;
      if (tangent.has(h) || done.has(h)) continue;
      done.add(h);
      const et = String(e.geomType);
      const P = (x: Vec3) => to2(mapP(m, x));
      if (m.k === "p" && et === "CIRCLE") {
        const s3 = tup(e.startPoint), e3 = tup(e.endPoint);
        const c = circle3d(tup(e.pointAt(0)), tup(e.pointAt(1 / 3)), tup(e.pointAt(2 / 3)));
        if (c) {
          const cc = P(c.c);
          if (vlen(vsub(s3, e3)) < 1e-7) pieces.push({ t: "c", c: cc, r: c.r });
          else pieces.push({ t: "a", a: P(s3), b: P(e3), m: P(tup(e.pointAt(0.5))) });
          continue;
        }
      }
      if (et === "LINE") pushPoly([P(tup(e.startPoint)), P(tup(e.endPoint))]);
      else {
        const n = 32;
        const pts: Vec2[] = [];
        for (let q = 0; q <= n; q++) pts.push(P(tup(e.pointAt(q / n))));
        pushPoly(pts);
      }
    }
  }

  // bükümler
  const bends: FlatBend[] = [];
  const seenMaps = new Set<CylMap>();
  for (const [i, m] of maps) {
    if (m.k !== "c" || seenMaps.has(m)) continue;
    seenMaps.add(m);
    let zmin = Infinity, zmax = -Infinity, amax = 0;
    for (const [j, mj] of maps) {
      if (mj !== m) continue;
      for (const e of faceEdges[j])
        for (const q of [0, 0.5, 1]) {
          const x = tup(e.pointAt(q));
          const z = vdot(vsub(x, m.p1), m.a);
          zmin = Math.min(zmin, z);
          zmax = Math.max(zmax, z);
          amax = Math.max(amax, cylPhi(m, x));
        }
    }
    void i;
    const off = vmul(m.t1f, (amax / 2) * m.rhoN);
    let A3 = vadd(vadd(m.p1f, vmul(m.af, zmin)), off), B3 = vadd(vadd(m.p1f, vmul(m.af, zmax)), off);
    // büküm çizgisi kendi büküm bölgesinin açınımdaki sınırında bitmeli (bitişik bükümlerin gönyeli köşesinde
    // bölge sınırı köşegendir; eksen boyunca en uç nokta ile sınırlamak çizgiyi komşu bükümün alanına taşırır)
    {
      const a2 = to2(A3), b2 = to2(B3);
      const dx = b2[0] - a2[0], dy = b2[1] - a2[1];
      const hits: number[] = [];
      for (const [j, mj] of maps) {
        if (mj !== m) continue;
        for (const e of faceEdges[j]) {
          const n = String(e.geomType) === "LINE" ? 1 : 24;
          let prev: Vec2 | null = null;
          for (let q = 0; q <= n; q++) {
            const cur = to2(mapP(m, tup(e.pointAt(q / n))));
            if (prev) {
              const ex = cur[0] - prev[0], ey = cur[1] - prev[1];
              const den = dx * ey - dy * ex;
              if (Math.abs(den) > 1e-12) {
                const t = ((prev[0] - a2[0]) * ey - (prev[1] - a2[1]) * ex) / den;
                const u = ((prev[0] - a2[0]) * dy - (prev[1] - a2[1]) * dx) / den;
                if (u >= -1e-6 && u <= 1 + 1e-6 && t > -0.1 && t < 1.1) hits.push(t);
              }
            }
            prev = cur;
          }
        }
      }
      if (hits.length >= 2) {
        const t0 = Math.max(0, Math.min(...hits)), t1 = Math.min(1, Math.max(...hits));
        if (t1 - t0 > 1e-6) {
          const D = vsub(B3, A3);
          [A3, B3] = [vadd(A3, vmul(D, t0)), vadd(A3, vmul(D, t1))];
        }
      }
    }
    bends.push({ a: to2(A3), b: to2(B3), a3: A3, b3: B3, up: m.inner, angle: (amax * 180) / Math.PI, r: m.rin });
  }

  // döngüleri zincirle
  const tol = 0.01;
  const loops: Loop[] = [];
  const polys: Vec2[][] = [];
  const closeEq = (p: Vec2, q: Vec2) => Math.hypot(p[0] - q[0], p[1] - q[1]) < tol;
  const used = new Array(pieces.length).fill(false);
  const ends = (p: Piece): [Vec2, Vec2] => (p.t === "c" ? [p.c, p.c] : [p.a, p.b]);
  const rev = (p: Piece): Piece => (p.t === "l" ? { t: "l", a: p.b, b: p.a } : p.t === "a" ? { t: "a", a: p.b, b: p.a, m: p.m } : p);
  const segPts = (s: Piece): Vec2[] => {
    if (s.t === "l") return [s.a];
    if (s.t === "c") return Array.from({ length: 32 }, (_, i) => [s.c[0] + s.r * Math.cos((i / 32) * 2 * Math.PI), s.c[1] + s.r * Math.sin((i / 32) * 2 * Math.PI)] as Vec2);
    const c = circ2(s.a, s.m, s.b)!;
    const a0 = Math.atan2(s.a[1] - c.c[1], s.a[0] - c.c[0]);
    let sp = Math.atan2(s.b[1] - c.c[1], s.b[0] - c.c[0]) - a0, sm = Math.atan2(s.m[1] - c.c[1], s.m[0] - c.c[0]) - a0;
    const nrm = (x: number) => ((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    sp = nrm(sp); sm = nrm(sm);
    const span = sm < sp ? sp : sp - 2 * Math.PI;
    return Array.from({ length: 16 }, (_, i) => [c.c[0] + c.r * Math.cos(a0 + (span * i) / 16), c.c[1] + c.r * Math.sin(a0 + (span * i) / 16)] as Vec2);
  };
  for (let i = 0; i < pieces.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    const p0 = pieces[i];
    if (p0.t === "c") {
      loops.push({ circle: { c: p0.c, r: p0.r }, depth: 0 });
      polys.push(segPts(p0));
      continue;
    }
    const chain: Piece[] = [p0];
    const start = ends(p0)[0];
    let cur = ends(p0)[1];
    let guard = 0;
    while (!closeEq(cur, start) && guard++ < pieces.length + 2) {
      let found = -1, flip = false;
      for (let j = 0; j < pieces.length; j++) {
        if (used[j] || pieces[j].t === "c") continue;
        const [a, b] = ends(pieces[j]);
        if (closeEq(a, cur)) { found = j; break; }
        if (closeEq(b, cur)) { found = j; flip = true; break; }
      }
      if (found < 0) throw new Error("Açınım dış hattı kapanmıyor (sac geometrisi açılamadı)");
      used[found] = true;
      const p = flip ? rev(pieces[found]) : pieces[found];
      chain.push(p);
      cur = ends(p)[1];
    }
    if (!closeEq(cur, start)) throw new Error("Açınım dış hattı kapanmıyor");
    // uçları birbirine kenetle
    const segs: Seg[] = chain.map((p, idx) => {
      const a = idx === 0 ? start : (ends(chain[idx - 1])[1] as Vec2);
      const b = idx === chain.length - 1 ? start : (ends(p)[1] as Vec2);
      return p.t === "l" ? { t: "l", a, b } : { t: "a", a, b, m: (p as any).m };
    });
    const clean = segs.filter((s) => Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) > 1e-7);
    // köşe boşaltmasından kalan sıfır alanlı küçük döngüleri atla
    const poly = chain.flatMap(segPts);
    if (clean.length < 2 || Math.abs(poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) < 1e-6) continue;
    loops.push({ segs: clean, depth: 0 });
    polys.push(poly);
  }
  if (!loops.length) throw new Error("Açınım boş");
  // iç içe derinlik ve alan
  const area2 = (pl: Vec2[]) => pl.reduce((s, p, i) => { const q = pl[(i + 1) % pl.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
  const inside = (p: Vec2, pl: Vec2[]) => {
    let c = false;
    for (let i = 0, j = pl.length - 1; i < pl.length; j = i++) {
      const a = pl[i], b = pl[j];
      if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  };
  let area = 0;
  loops.forEach((l, i) => {
    const probe = polys[i][0];
    l.depth = polys.filter((pl, j) => j !== i && inside(probe, pl)).length;
    area += (l.depth % 2 === 0 ? 1 : -1) * Math.abs(area2(polys[i]));
  });
  // büküm çizgilerini açınımın malzeme alanına kırp: bitişik bükümler köşede gönyeyle buluşunca
  // çizgi komşu büküm bölgesine / köşe boşluğuna taşmasın (SolidWorks gibi büküm bölgesinde biter)
  const material = (q: Vec2) => polys.filter((pl) => inside(q, pl)).length % 2 === 1;
  for (const bd of bends) {
    const A = bd.a, B = bd.b;
    const dx = B[0] - A[0], dy = B[1] - A[1];
    const ts = [0, 1];
    for (const pl of polys)
      for (let i = 0; i < pl.length; i++) {
        const P = pl[i], Q = pl[(i + 1) % pl.length];
        const ex = Q[0] - P[0], ey = Q[1] - P[1];
        const den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-12) continue;
        const t = ((P[0] - A[0]) * ey - (P[1] - A[1]) * ex) / den;
        const u = ((P[0] - A[0]) * dy - (P[1] - A[1]) * dx) / den;
        if (t > 0 && t < 1 && u >= -1e-9 && u <= 1 + 1e-9) ts.push(t);
      }
    ts.sort((x, y) => x - y);
    let t0 = -1, t1 = -1;
    for (let i = 0; i + 1 < ts.length; i++) {
      if (ts[i + 1] - ts[i] < 1e-9) continue;
      const tm = (ts[i] + ts[i + 1]) / 2;
      if (material([A[0] + dx * tm, A[1] + dy * tm])) {
        if (t0 < 0) t0 = ts[i];
        t1 = ts[i + 1];
      }
    }
    if (t0 < 0 || (t0 <= 1e-9 && t1 >= 1 - 1e-9)) continue;
    const at2 = (t: number): Vec2 => [A[0] + dx * t, A[1] + dy * t];
    const at3 = (t: number): Vec3 => vadd(bd.a3, vmul(vsub(bd.b3, bd.a3), t));
    [bd.a, bd.b, bd.a3, bd.b3] = [at2(t0), at2(t1), at3(t0), at3(t1)];
  }

  // doğrulama: hacim ≈ alan × kalınlık
  const vol = measureShapeVolumeProperties(body).volume;
  const ratio = vol / (area * t);
  if (!(ratio > 0.85 && ratio < 1.15))
    throw new Error("Bu gövde sabit kalınlıklı bir sac değil ya da sac kalınlığı farklı (açınım yapılamadı)");

  // 2B çıktı
  const outline: Flat2D[] = [];
  const all = polys.flat();
  const min: Vec2 = [Math.min(...all.map((p) => p[0])), Math.min(...all.map((p) => p[1]))];
  const max: Vec2 = [Math.max(...all.map((p) => p[0])), Math.max(...all.map((p) => p[1]))];
  for (const p of pieces) {
    if (p.t === "l") outline.push({ k: "l", a: p.a, b: p.b });
    else if (p.t === "c") outline.push({ k: "c", c: p.c, r: p.r });
    else {
      const c = circ2(p.a, p.m, p.b);
      if (!c) { outline.push({ k: "l", a: p.a, b: p.b }); continue; }
      const deg = (q: Vec2) => (Math.atan2(q[1] - c.c[1], q[0] - c.c[0]) * 180) / Math.PI;
      const n360 = (x: number) => ((x % 360) + 360) % 360;
      const as = deg(p.a), ae = deg(p.b), am = deg(p.m);
      const ccw = n360(am - as) < n360(ae - as);
      outline.push(ccw ? { k: "a", c: c.c, r: c.r, a0: n360(as), a1: n360(ae) } : { k: "a", c: c.c, r: c.r, a0: n360(ae), a1: n360(as) });
    }
  }
  return { frame, loops, outline, bends, area, min, max };
}

function circ2(a: Vec2, b: Vec2, c: Vec2): { c: Vec2; r: number } | null {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
  if (Math.abs(d) < 1e-12) return null;
  const s = (p: Vec2) => p[0] * p[0] + p[1] * p[1];
  const ux = (s(a) * (b[1] - c[1]) + s(b) * (c[1] - a[1]) + s(c) * (a[1] - b[1])) / d;
  const uy = (s(a) * (c[0] - b[0]) + s(b) * (a[0] - c[0]) + s(c) * (b[0] - a[0])) / d;
  return { c: [ux, uy], r: Math.hypot(a[0] - ux, a[1] - uy) };
}

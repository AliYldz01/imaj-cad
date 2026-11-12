// 2D geometri yardımcıları (eskiz düzlemi koordinatlarında).
import type { Vec2 } from "../doc/types";

export const d2 = (a: Vec2, b: Vec2) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const sub2 = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];
export const add2 = (a: Vec2, b: Vec2): Vec2 => [a[0] + b[0], a[1] + b[1]];
export const mul2 = (a: Vec2, k: number): Vec2 => [a[0] * k, a[1] * k];
export const dot2 = (a: Vec2, b: Vec2) => a[0] * b[0] + a[1] * b[1];
export const crs2 = (a: Vec2, b: Vec2) => a[0] * b[1] - a[1] * b[0];
export const len2 = (a: Vec2) => Math.hypot(a[0], a[1]);
export const norm2 = (a: Vec2): Vec2 => {
  const l = len2(a) || 1;
  return [a[0] / l, a[1] / l];
};
export const perp = (a: Vec2): Vec2 => [-a[1], a[0]];
export const ang = (c: Vec2, p: Vec2) => Math.atan2(p[1] - c[1], p[0] - c[0]);
export const TAU = Math.PI * 2;
export const normAng = (a: number) => ((a % TAU) + TAU) % TAU;

/** Doğru parçası üzerindeki en yakın nokta ve parametresi */
export function nearestOnSeg(p: Vec2, a: Vec2, b: Vec2): { q: Vec2; t: number; d: number } {
  const ab = sub2(b, a);
  const l2 = dot2(ab, ab) || 1e-12;
  const t = Math.max(0, Math.min(1, dot2(sub2(p, a), ab) / l2));
  const q: Vec2 = [a[0] + ab[0] * t, a[1] + ab[1] * t];
  return { q, t, d: d2(p, q) };
}

/** Sonsuz doğruya dik uzaklık */
export function distToLine(p: Vec2, a: Vec2, b: Vec2) {
  const ab = norm2(sub2(b, a));
  return Math.abs(crs2(ab, sub2(p, a)));
}

/** Yay açı aralığında mı? (s'den e'ye saat yönü tersine) */
export function inArc(a: number, s: number, e: number) {
  const span = normAng(e - s);
  return normAng(a - s) <= span + 1e-9;
}

export function arcMid(c: Vec2, r: number, s: number, e: number): Vec2 {
  const m = s + normAng(e - s) / 2;
  return [c[0] + r * Math.cos(m), c[1] + r * Math.sin(m)];
}

export function nearestOnArc(p: Vec2, c: Vec2, r: number, s: number, e: number): { q: Vec2; d: number } {
  const a = ang(c, p);
  if (inArc(a, s, e)) {
    const q: Vec2 = [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
    return { q, d: d2(p, q) };
  }
  const ps: Vec2 = [c[0] + r * Math.cos(s), c[1] + r * Math.sin(s)];
  const pe: Vec2 = [c[0] + r * Math.cos(e), c[1] + r * Math.sin(e)];
  return d2(p, ps) < d2(p, pe) ? { q: ps, d: d2(p, ps) } : { q: pe, d: d2(p, pe) };
}

/** Sonsuz doğru-doğru kesişimi */
export function lineLine(a1: Vec2, a2: Vec2, b1: Vec2, b2: Vec2): { p: Vec2; ta: number; tb: number } | null {
  const r = sub2(a2, a1);
  const s = sub2(b2, b1);
  const den = crs2(r, s);
  if (Math.abs(den) < 1e-12) return null;
  const qp = sub2(b1, a1);
  const ta = crs2(qp, s) / den;
  const tb = crs2(qp, r) / den;
  return { p: [a1[0] + r[0] * ta, a1[1] + r[1] * ta], ta, tb };
}

/** Doğru (a+t(b-a)) - çember kesişimleri, t parametreleriyle */
export function lineCircle(a: Vec2, b: Vec2, c: Vec2, r: number): { p: Vec2; t: number }[] {
  // geometrik çözüm: merkezden doğruya dik ayak + yarım kiriş. Teğet (çözücüden gelen ~1e-9 hata) tek nokta verir.
  const d = sub2(b, a);
  const A = dot2(d, d);
  if (A < 1e-18) return [];
  const t0 = dot2(sub2(c, a), d) / A;
  const foot: Vec2 = [a[0] + d[0] * t0, a[1] + d[1] * t0];
  const h = Math.hypot(foot[0] - c[0], foot[1] - c[1]);
  const tol = 1e-6 * Math.max(1, r);
  if (h > r + tol) return [];
  if (Math.abs(h - r) <= tol) return [{ p: foot, t: t0 }];
  const half = Math.sqrt(Math.max(0, r * r - h * h)) / Math.sqrt(A);
  return [t0 - half, t0 + half].map((t) => ({ p: [a[0] + d[0] * t, a[1] + d[1] * t] as Vec2, t }));
}

export function circleCircle(c1: Vec2, r1: number, c2: Vec2, r2: number): Vec2[] {
  const d = Math.hypot(c2[0] - c1[0], c2[1] - c1[1]);
  const tol = 1e-6 * Math.max(1, r1, r2);
  if (d < 1e-12 || d > r1 + r2 + tol || d < Math.abs(r1 - r2) - tol) return [];
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h2 = r1 * r1 - a * a;
  const u = mul2(sub2(c2, c1), 1 / d);
  const m: Vec2 = add2(c1, mul2(u, a));
  // teğet çemberler: tek nokta
  if (h2 <= (2 * tol) * Math.max(1, r1) || Math.abs(d - (r1 + r2)) <= tol || Math.abs(d - Math.abs(r1 - r2)) <= tol) return [m];
  const h = Math.sqrt(h2);
  const pp = perp(u);
  return [add2(m, mul2(pp, h)), add2(m, mul2(pp, -h))];
}
/** Üç noktadan geçen çember */
export function circle3(a: Vec2, b: Vec2, c: Vec2): { c: Vec2; r: number } | null {
  const bx = b[0] - a[0], by = b[1] - a[1], cx = c[0] - a[0], cy = c[1] - a[1];
  const D = 2 * (bx * cy - by * cx);
  if (Math.abs(D) < 1e-12) return null;
  const ux = (cy * (bx * bx + by * by) - by * (cx * cx + cy * cy)) / D;
  const uy = (bx * (cx * cx + cy * cy) - cx * (bx * bx + by * by)) / D;
  const center: Vec2 = [a[0] + ux, a[1] + uy];
  return { c: center, r: Math.hypot(ux, uy) };
}

export function polyArea(pts: Vec2[]) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

export function pointInPoly(p: Vec2, poly: Vec2[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Yuvarlak "güzel" adım: 1, 2, 5 × 10^n */
export function niceStep(v: number) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p;
}

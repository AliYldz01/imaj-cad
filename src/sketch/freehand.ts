// Serbest çizim tanıyıcı (iPad / telefon "şekli tanı" gibi): kaba elle çizimi çizgi, yay, daire,
// açık / kapalı çokgen (dikdörtgen, üçgen…) ya da serbest eğriye dönüştürür.
// Girdiler eskiz koordinatında; `px` = bir ekran pikselinin eskiz birimindeki karşılığı (tolerans için).
import type { Vec2 } from "../doc/types";

export type Shape =
  | { kind: "line"; a: Vec2; b: Vec2 }
  | { kind: "circle"; c: Vec2; r: number }
  | { kind: "arc"; s: Vec2; m: Vec2; e: Vec2 }
  | { kind: "poly"; pts: Vec2[]; closed: boolean }
  | { kind: "spline"; pts: Vec2[] };

export const SHAPE_NAMES: Record<Shape["kind"], string> = { line: "Çizgi", circle: "Daire", arc: "Yay", poly: "Çokgen", spline: "Serbest eğri" };

const d2 = (a: Vec2, b: Vec2) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function pathLen(p: Vec2[]) {
  let L = 0;
  for (let i = 1; i < p.length; i++) L += d2(p[i - 1], p[i]);
  return L;
}
/** eşit aralıklı yeniden örnekleme */
function resample(p: Vec2[], n: number): Vec2[] {
  const L = pathLen(p);
  if (L <= 0) return [p[0]];
  const step = L / (n - 1);
  const out: Vec2[] = [p[0]];
  let acc = 0;
  for (let i = 1; i < p.length; i++) {
    let a = p[i - 1];
    const b = p[i];
    let seg = d2(a, b);
    while (acc + seg >= step && out.length < n) {
      const t = (step - acc) / seg;
      const q: Vec2 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      out.push(q);
      a = q;
      seg = d2(a, b);
      acc = 0;
    }
    acc += seg;
  }
  while (out.length < n) out.push(p[p.length - 1]);
  return out;
}
/** noktanın doğru parçasına uzaklığı */
function segDist(p: Vec2, a: Vec2, b: Vec2) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
  const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)) : 0;
  return Math.hypot(a[0] + dx * t - p[0], a[1] + dy * t - p[1]);
}
/** Douglas–Peucker: köşe indeksleri */
function dp(p: Vec2[], eps: number, i0 = 0, i1 = p.length - 1, out: number[] = []): number[] {
  if (i0 === 0 && i1 === p.length - 1 && !out.length) out.push(0);
  let mx = -1, k = -1;
  for (let i = i0 + 1; i < i1; i++) {
    const d = segDist(p[i], p[i0], p[i1]);
    if (d > mx) (mx = d), (k = i);
  }
  if (mx > eps && k > 0) {
    dp(p, eps, i0, k, out);
    dp(p, eps, k, i1, out);
  } else out.push(i1);
  return out.filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b);
}
/** cebirsel çember uydurma (Kåsa) */
export function fitCircle(p: Vec2[]): { c: Vec2; r: number; rms: number } | null {
  const n = p.length;
  let sx = 0, sy = 0;
  for (const q of p) (sx += q[0]), (sy += q[1]);
  const mx = sx / n, my = sy / n;
  let suu = 0, svv = 0, suv = 0, suuu = 0, svvv = 0, suvv = 0, svuu = 0;
  for (const q of p) {
    const u = q[0] - mx, v = q[1] - my;
    suu += u * u;
    svv += v * v;
    suv += u * v;
    suuu += u * u * u;
    svvv += v * v * v;
    suvv += u * v * v;
    svuu += v * u * u;
  }
  const det = suu * svv - suv * suv;
  if (Math.abs(det) < 1e-12) return null;
  const a = 0.5 * (suuu + suvv), b = 0.5 * (svvv + svuu);
  const uc = (a * svv - b * suv) / det, vc = (b * suu - a * suv) / det;
  const c: Vec2 = [uc + mx, vc + my];
  const r = Math.sqrt(uc * uc + vc * vc + (suu + svv) / n);
  let e = 0;
  for (const q of p) e += (d2(q, c) - r) ** 2;
  return { c, r, rms: Math.sqrt(e / n) };
}
/** çemberin kapsadığı açı (derece; noktaların sıralı açısal süpürmesi) */
function sweep(p: Vec2[], c: Vec2) {
  let tot = 0;
  for (let i = 1; i < p.length; i++) {
    let da = Math.atan2(p[i][1] - c[1], p[i][0] - c[0]) - Math.atan2(p[i - 1][1] - c[1], p[i - 1][0] - c[0]);
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    tot += da;
  }
  return Math.abs((tot * 180) / Math.PI);
}

/** kaba çizimi tanı */
export function recognize(raw: Vec2[], px: number): Shape | null {
  const pts = raw.filter((q, i) => i === 0 || d2(q, raw[i - 1]) > px * 0.5);
  const L = pathLen(pts);
  if (pts.length < 2 || L < 12 * px) return null;
  const p = resample(pts, 96);
  const a = p[0], b = p[p.length - 1];
  const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
  const diag = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const closed = d2(a, b) < Math.max(0.15 * diag, 18 * px) && L > 2.2 * d2(a, b) && diag > 14 * px;
  const eps = Math.max(7 * px, 0.045 * diag);
  // düz çizgi
  if (!closed) {
    let mx = 0;
    for (const q of p) mx = Math.max(mx, segDist(q, a, b));
    if (mx < Math.max(5 * px, 0.06 * d2(a, b))) return { kind: "line", a, b };
  }
  const fc = fitCircle(p);
  if (closed) {
    // daire: çember uydurması iyi ve neredeyse tam tur
    if (fc && fc.rms / fc.r < 0.07 && sweep(p, fc.c) > 300) return { kind: "circle", c: fc.c, r: fc.r };
    // kapalı çokgen: başlangıcı en uzak noktaya kaydırıp köşeleri bul
    const cx = xs.reduce((s, v) => s + v, 0) / p.length, cy = ys.reduce((s, v) => s + v, 0) / p.length;
    let k0 = 0, dm = -1;
    p.forEach((q, i) => {
      const dd = Math.hypot(q[0] - cx, q[1] - cy);
      if (dd > dm) (dm = dd), (k0 = i);
    });
    const ring = [...p.slice(k0), ...p.slice(1, k0 + 1)];
    const idx = dp(ring, eps);
    let vs = idx.map((i) => ring[i]);
    if (d2(vs[0], vs[vs.length - 1]) < eps) vs.pop();
    vs = mergeNear(vs, eps, true);
    if (vs.length >= 3 && vs.length <= 10 && straightOK(ring, idx, px)) return { kind: "poly", pts: vs, closed: true };
    if (fc && fc.rms / fc.r < 0.12) return { kind: "circle", c: fc.c, r: fc.r };
    return { kind: "spline", pts: [...smoothPts(p, eps * 0.6), p[0]] };
  }
  // yay: çember uydurması iyi, belirgin eğrilik
  const chord = d2(a, b);
  if (fc && fc.rms / fc.r < 0.05 && sweep(p, fc.c) > 25 && sweep(p, fc.c) < 330 && fc.r < chord * 8) {
    const m = p[Math.floor(p.length / 2)];
    return { kind: "arc", s: a, m, e: b };
  }
  // açık çokgen (köşeli çizgi zinciri)
  const idx = dp(p, eps);
  const vs = mergeNear(idx.map((i) => p[i]), eps, false);
  if (vs.length >= 2 && vs.length <= 10) {
    if (straightOK(p, idx, px)) return vs.length === 2 ? { kind: "line", a: vs[0], b: vs[1] } : { kind: "poly", pts: vs, closed: false };
  }
  return { kind: "spline", pts: smoothPts(p, eps * 0.6) };
}
/** köşeler arasındaki her parça elle çizilmiş düz çizgi kadar düz mü (sapma / boy) */
function straightOK(p: Vec2[], idx: number[], px: number) {
  for (let s = 0; s + 1 < idx.length; s++) {
    const a = p[idx[s]], b = p[idx[s + 1]];
    const L = d2(a, b);
    let mx = 0;
    for (let i = idx[s]; i <= idx[s + 1]; i++) mx = Math.max(mx, segDist(p[i], a, b));
    if (mx > Math.max(4 * px, 0.085 * L)) return false;
  }
  return true;
}
function mergeNear(vs: Vec2[], eps: number, closed: boolean): Vec2[] {
  const out: Vec2[] = [];
  for (const v of vs) if (!out.length || d2(out[out.length - 1], v) > eps * 1.2) out.push(v);
  if (closed && out.length > 2 && d2(out[0], out[out.length - 1]) < eps * 1.2) out.pop();
  // neredeyse doğrusal ara köşeleri at (açı < 18°)
  for (let changed = true; changed && out.length > (closed ? 3 : 2); ) {
    changed = false;
    const n = out.length;
    for (let i = closed ? 0 : 1; i < (closed ? n : n - 1); i++) {
      const p0 = out[(i - 1 + n) % n], p1 = out[i], p2 = out[(i + 1) % n];
      const a1 = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]), a2 = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
      let da = Math.abs(a2 - a1);
      if (da > Math.PI) da = 2 * Math.PI - da;
      if (da < (18 * Math.PI) / 180) {
        out.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return out;
}
/** serbest eğri için az sayıda kontrol noktası */
function smoothPts(p: Vec2[], eps: number): Vec2[] {
  const idx = dp(p, Math.max(eps, 1e-9));
  let vs = idx.map((i) => p[i]);
  if (vs.length < 4) vs = [p[0], p[Math.floor(p.length / 3)], p[Math.floor((2 * p.length) / 3)], p[p.length - 1]];
  return vs.slice(0, 16);
}

/** açı yakalama: yatay / dikey (derece toleransı) */
export function hvOf(a: Vec2, b: Vec2, tolDeg = 7): "h" | "v" | null {
  const ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
  const m = ((ang % 180) + 180) % 180;
  if (m < tolDeg || m > 180 - tolDeg) return "h";
  if (Math.abs(m - 90) < tolDeg) return "v";
  return null;
}

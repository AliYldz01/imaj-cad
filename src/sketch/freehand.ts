// Serbest çizim tanıyıcı (iPad / telefon "şekli tanı" gibi): kaba elle çizimi çizgi, yay, daire,
// açık / kapalı çokgen (dikdörtgen, üçgen…) ya da serbest eğriye dönüştürür.
// Girdiler eskiz koordinatında; `px` = bir ekran pikselinin eskiz birimindeki karşılığı (tolerans için).
import type { Vec2 } from "../doc/types";

export type Shape =
  | { kind: "line"; a: Vec2; b: Vec2 }
  | { kind: "circle"; c: Vec2; r: number }
  | { kind: "arc"; s: Vec2; m: Vec2; e: Vec2 }
  | { kind: "poly"; pts: Vec2[]; closed: boolean }
  /** dikdörtgen / kare (r = 0) ya da köşeleri yuvarlatılmış dikdörtgen; u = birinci kenar yönü (birim) */
  | { kind: "rect"; c: Vec2; u: Vec2; hx: number; hy: number; r: number; square: boolean; axis: boolean }
  | { kind: "ellipse"; c: Vec2; u: Vec2; a: number; b: number }
  | { kind: "spline"; pts: Vec2[] };

export const SHAPE_NAMES: Record<Shape["kind"], string> = { line: "Çizgi", circle: "Daire", arc: "Yay", poly: "Çokgen", spline: "Serbest eğri", rect: "Dikdörtgen", ellipse: "Elips" };
export function shapeName(s: Shape) {
  if (s.kind === "rect") return (s.r > 0 ? "Yuvarlatılmış " + (s.square ? "kare" : "dikdörtgen") : s.square ? "Kare" : "Dikdörtgen");
  if (s.kind === "poly" && s.closed) return s.pts.length === 3 ? "Üçgen" : s.pts.length + " kenarlı çokgen";
  if (s.kind === "poly") return "Çizgi zinciri";
  return SHAPE_NAMES[s.kind];
}

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
  const closed = d2(a, b) < Math.max(0.22 * diag, 18 * px) && L > 2.2 * d2(a, b) && diag > 14 * px;
  const eps = Math.max(7 * px, 0.045 * diag);
  // düz çizgi
  if (!closed) {
    let mx = 0;
    for (const q of p) mx = Math.max(mx, segDist(q, a, b));
    if (mx < Math.max(5 * px, 0.06 * d2(a, b))) return { kind: "line", a, b };
  }
  const fc = fitCircle(p);
  if (closed) return closedShape(p, px, eps, diag, fc);
  // yay: çember uydurması iyi, belirgin eğrilik
  const chord = d2(a, b);
  if (fc && fc.rms / fc.r < 0.05 && sweep(p, fc.c) > 25 && sweep(p, fc.c) < 330 && fc.r < chord * 8) {
    const m = p[Math.floor(p.length / 2)];
    return { kind: "arc", s: a, m, e: b };
  }
  // açık çokgen (köşeli çizgi zinciri)
  for (const f of [1, 1.6]) {
    const idx = dp(p, eps * f);
    const vs = mergeNear(idx.map((i) => p[i]), eps * f, false);
    if (vs.length >= 2 && vs.length <= 10 && straightOK(p, idx, px, f > 1 ? 0.12 : 0.085))
      return vs.length === 2 ? { kind: "line", a: vs[0], b: vs[1] } : { kind: "poly", pts: vs, closed: false };
  }
  return { kind: "spline", pts: smoothPts(p, eps * 0.6) };
}
/** köşeler arasındaki her parça elle çizilmiş düz çizgi kadar düz mü (sapma / boy) */
function straightOK(p: Vec2[], idx: number[], px: number, rel = 0.085) {
  for (let s = 0; s + 1 < idx.length; s++) {
    const a = p[idx[s]], b = p[idx[s + 1]];
    const L = d2(a, b);
    let mx = 0;
    for (let i = idx[s]; i <= idx[s + 1]; i++) mx = Math.max(mx, segDist(p[i], a, b));
    if (mx > Math.max(4 * px, rel * L)) return false;
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

// ---------------- kapalı şekiller: aday uydur, en iyi skoru seç ----------------
type Fit = { shape: Shape; err: number };
/** dışbükey zarf (monoton zincir) */
function hull(p: Vec2[]): Vec2[] {
  const q = [...p].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o: Vec2, a: Vec2, b: Vec2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: Vec2[] = [], up: Vec2[] = [];
  for (const v of q) {
    while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], v) <= 0) lo.pop();
    lo.push(v);
  }
  for (let i = q.length - 1; i >= 0; i--) {
    const v = q[i];
    while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], v) <= 0) up.pop();
    up.push(v);
  }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
}
const loc = (q: Vec2, c: Vec2, u: Vec2): Vec2 => [(q[0] - c[0]) * u[0] + (q[1] - c[1]) * u[1], -(q[0] - c[0]) * u[1] + (q[1] - c[1]) * u[0]];
/** yuvarlatılmış dikdörtgen işaretli uzaklığı (yerel koordinat) */
function rrDist(x: number, y: number, hx: number, hy: number, r: number) {
  const qx = Math.abs(x) - (hx - r), qy = Math.abs(y) - (hy - r);
  return Math.abs(Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r);
}
function fitRect(p: Vec2[], diag: number, px: number): Fit | null {
  const H = hull(p);
  if (H.length < 3) return null;
  // en küçük alanlı çevreleyen dikdörtgenin yönü
  let best = { area: Infinity, u: [1, 0] as Vec2 };
  for (let i = 0; i < H.length; i++) {
    const a = H[i], b = H[(i + 1) % H.length];
    const L = d2(a, b);
    if (L < 1e-12) continue;
    const u: Vec2 = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const q of H) {
      const [x, y] = loc(q, [0, 0], u);
      x0 = Math.min(x0, x), x1 = Math.max(x1, x), y0 = Math.min(y0, y), y1 = Math.max(y1, y);
    }
    const area = (x1 - x0) * (y1 - y0);
    if (area < best.area) best = { area, u };
  }
  let u = best.u;
  // eksene yakınsa eksene oturt
  const ang = Math.atan2(u[1], u[0]);
  const k = Math.round(ang / (Math.PI / 2));
  let axis = false;
  if (Math.abs(ang - (k * Math.PI) / 2) < (14 * Math.PI) / 180) (u = [1, 0]), (axis = true);
  // kenarları noktalardan ortalayarak bul (dış zarf yerine)
  let cx = 0, cy = 0;
  for (const q of p) (cx += q[0]), (cy += q[1]);
  let c: Vec2 = [cx / p.length, cy / p.length];
  let hx = 0, hy = 0;
  for (let it = 0; it < 3; it++) {
    const lp = p.map((q) => loc(q, c, u));
    if (!hx) {
      hx = Math.max(...lp.map((v) => Math.abs(v[0])));
      hy = Math.max(...lp.map((v) => Math.abs(v[1])));
    }
    const R: number[] = [], Lf: number[] = [], T: number[] = [], B: number[] = [];
    for (const [x, y] of lp) {
      if (Math.abs(x) / hx > Math.abs(y) / hy) (x > 0 ? R : Lf).push(x);
      else (y > 0 ? T : B).push(y);
    }
    const m = (v: number[], d: number) => (v.length ? v.reduce((s, t) => s + t, 0) / v.length : d);
    const xr = m(R, hx), xl = m(Lf, -hx), yt = m(T, hy), yb = m(B, -hy);
    hx = (xr - xl) / 2;
    hy = (yt - yb) / 2;
    const dx = (xr + xl) / 2, dy = (yt + yb) / 2;
    c = [c[0] + u[0] * dx - u[1] * dy, c[1] + u[1] * dx + u[0] * dy];
    if (hx <= 0 || hy <= 0) return null;
  }
  // çok ince ise dikdörtgen değil
  if (Math.min(hx, hy) < Math.max(4 * px, 0.04 * diag)) return null;
  const square = Math.abs(hx - hy) / Math.max(hx, hy) < 0.12;
  if (square) hx = hy = (hx + hy) / 2;
  const lp = p.map((q) => loc(q, c, u));
  let bestR = 0, bestE = Infinity;
  const rm = Math.min(hx, hy);
  for (let i = 0; i <= 16; i++) {
    const r = (rm * i) / 16 * 0.95;
    let e = 0;
    for (const [x, y] of lp) e += rrDist(x, y, hx, hy, r);
    e /= lp.length;
    if (e < bestE - 1e-12) (bestE = e), (bestR = r);
  }
  // küçük yuvarlatmalar keskin köşe sayılır
  let r = bestR < 0.28 * rm ? 0 : bestR;
  let err = 0;
  for (const [x, y] of lp) err += rrDist(x, y, hx, hy, r);
  err /= lp.length;
  if (r > 0.9 * rm) return null; // daire / elips gibi
  return { shape: { kind: "rect", c, u, hx, hy, r, square, axis }, err: err / diag };
}
/** eksenleri PCA ile, yarı eksenleri doğrusal en küçük kareler ile */
function fitEllipse(p: Vec2[], diag: number): Fit | null {
  const n = p.length;
  let mx = 0, my = 0;
  for (const q of p) (mx += q[0]), (my += q[1]);
  mx /= n;
  my /= n;
  let sxx = 0, syy = 0, sxy = 0;
  for (const q of p) {
    const x = q[0] - mx, y = q[1] - my;
    sxx += x * x;
    syy += y * y;
    sxy += x * y;
  }
  const th = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  let u: Vec2 = [Math.cos(th), Math.sin(th)];
  // A x² + C y² + D x + E y = 1 (yerel eksenlerde)
  const M = Array.from({ length: 4 }, () => [0, 0, 0, 0, 0]);
  for (const q of p) {
    const [x, y] = loc(q, [mx, my], u);
    const r = [x * x, y * y, x, y];
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) M[i][j] += r[i] * r[j];
      M[i][4] += r[i];
    }
  }
  const sol = gauss(M);
  if (!sol) return null;
  const [A, C, D, E] = sol;
  if (A <= 0 || C <= 0) return null;
  const x0 = -D / (2 * A), y0 = -E / (2 * C);
  const F = 1 + A * x0 * x0 + C * y0 * y0;
  let a = Math.sqrt(F / A), b = Math.sqrt(F / C);
  const c: Vec2 = [mx + u[0] * x0 - u[1] * y0, my + u[1] * x0 + u[0] * y0];
  if (b > a) {
    [a, b] = [b, a];
    u = [-u[1], u[0]];
  }
  // büyük eksen yatay/dikeye yakınsa oturt
  const ang = Math.atan2(u[1], u[0]);
  const k = Math.round(ang / (Math.PI / 2));
  if (Math.abs(ang - (k * Math.PI) / 2) < (10 * Math.PI) / 180) u = [Math.round(Math.cos((k * Math.PI) / 2)), Math.round(Math.sin((k * Math.PI) / 2))];
  let err = 0;
  for (const q of p) {
    const [x, y] = loc(q, c, u);
    const kk = Math.sqrt((x * x) / (a * a) + (y * y) / (b * b));
    err += kk > 1e-9 ? Math.abs(1 - 1 / kk) * Math.hypot(x, y) : b;
  }
  return { shape: { kind: "ellipse", c, u, a, b }, err: err / n / diag };
}
function gauss(M: number[][]): number[] | null {
  const n = M.length;
  for (let i = 0; i < n; i++) {
    let piv = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[piv][i])) piv = r;
    if (Math.abs(M[piv][i]) < 1e-14) return null;
    [M[i], M[piv]] = [M[piv], M[i]];
    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const f = M[r][i] / M[i][i];
      for (let c = i; c <= n; c++) M[r][c] -= f * M[i][c];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}
function polyErr(p: Vec2[], vs: Vec2[], diag: number) {
  let e = 0;
  for (const q of p) {
    let m = Infinity;
    for (let i = 0; i < vs.length; i++) m = Math.min(m, segDist(q, vs[i], vs[(i + 1) % vs.length]));
    e += m;
  }
  return e / p.length / diag;
}
function closedShape(p: Vec2[], px: number, eps: number, diag: number, fc: ReturnType<typeof fitCircle>): Shape {
  const cands: Fit[] = [];
  // daire
  if (fc && sweep(p, fc.c) > 280) {
    let e = 0;
    for (const q of p) e += Math.abs(d2(q, fc.c) - fc.r);
    cands.push({ shape: { kind: "circle", c: fc.c, r: fc.r }, err: e / p.length / diag });
  }
  const el = fitEllipse(p, diag);
  if (el && el.shape.kind === "ellipse") {
    if (el.shape.b / el.shape.a > 0.86) {
      // elips daireye çok yakın: daire yeter
    } else cands.push({ shape: el.shape, err: el.err + 0.004 });
  }
  const rc = fitRect(p, diag, px);
  if (rc) cands.push({ shape: rc.shape, err: rc.err - 0.004 + ((rc.shape as any).r > 0 ? 0.007 : 0) });
  // genel çokgen (üçgen, beşgen…)
  const cx = p.reduce((s, v) => s + v[0], 0) / p.length, cy = p.reduce((s, v) => s + v[1], 0) / p.length;
  let k0 = 0, dm = -1;
  p.forEach((q, i) => {
    const dd = Math.hypot(q[0] - cx, q[1] - cy);
    if (dd > dm) (dm = dd), (k0 = i);
  });
  const ring0 = [...p.slice(k0), ...p.slice(1, k0 + 1)];
  // titremeyi azalt: kısa pencereli kayan ortalama (uçlar sabit)
  const ring = ring0.map((q, i) => {
    if (true) return q;
    let x = 0, y = 0;
    for (let k = -2; k <= 2; k++) (x += ring0[i + k][0]), (y += ring0[i + k][1]);
    return [x / 5, y / 5] as Vec2;
  });
  // daha kaba çizimler için iki tolerans dene
  for (const f of [1, 1.6]) {
    const idx = dp(ring, eps * f);
    let vs = idx.map((i) => ring[i]);
    if (d2(vs[0], vs[vs.length - 1]) < eps * f) vs.pop();
    vs = cleanClosed(mergeNear(vs, Math.max(eps * f, 0.08 * diag), true));
    if (vs.length >= 3 && vs.length <= 10) cands.push({ shape: { kind: "poly", pts: vs, closed: true }, err: polyErr(p, vs, diag) + 0.0035 * (vs.length - 3) });
  }
  // uçları birleşmeyen / taşan çizim: açık zincirin ilk ve son kenarını uzatıp köşede buluştur
  for (const f of [1, 1.6]) {
    const idx = dp(p, eps * f);
    let vs = idx.map((i) => p[i]);
    if (vs.length >= 4) {
      const a0 = vs[0], a1 = vs[1], b0 = vs[vs.length - 2], b1 = vs[vs.length - 1];
      const t1 = Math.atan2(a1[1] - a0[1], a1[0] - a0[0]), t2 = Math.atan2(b1[1] - b0[1], b1[0] - b0[0]);
      let da = Math.abs(t1 - t2) % Math.PI;
      if (da > Math.PI / 2) da = Math.PI - da;
      if (da < (20 * Math.PI) / 180) vs = vs.slice(1, -1); // aynı kenar üzerinde başlayıp bitmiş
      else {
        const X = lineX(a0, a1, b0, b1);
        if (X && d2(X, a0) < 0.35 * diag && d2(X, b1) < 0.35 * diag) vs = [X, ...vs.slice(1, -1)];
      }
      vs = cleanClosed(mergeNear(vs, Math.max(eps * f, 0.08 * diag), true));
      if (vs.length >= 3 && vs.length <= 10) cands.push({ shape: { kind: "poly", pts: vs, closed: true }, err: polyErr(p, vs, diag) + 0.0035 * (vs.length - 3) });
    }
  }
  cands.sort((a, b) => a.err - b.err);
  const best = cands[0];
  // dik açılara yakın dörtgen = dikdörtgen (bozuk çizilmiş kare)
  if (best && best.shape.kind === "poly" && best.shape.pts.length === 4 && rc) {
    const vs = best.shape.pts;
    if (vs.every((_, i) => Math.abs(turn(vs, i) - Math.PI / 2) < (30 * Math.PI) / 180)) {
      (rc.shape as any).r = 0;
      return rc.shape;
    }
  }
  // yuvarlatılmış seçildi ama keskin köşeli dörtgen en az onun kadar uyuyorsa: köşeler gerçekten yuvarlak değil
  if (best && best.shape.kind === "rect" && best.shape.r > 0) {
    const q4 = cands.find((c) => c.shape.kind === "poly" && c.shape.pts.length === 4);
    if (q4 && q4.err - 0.0035 <= best.err + 0.004 - 0.007 + 0.002) best.shape.r = 0;
  }
  if (best && best.err < 0.05) return best.shape;
  return { kind: "spline", pts: [...smoothPts(p, eps * 0.6), p[0]] };
}

/** kapalı çokgende gürültü köşelerini at: çok kısa kenarlar ve küçük dönüşler */
function turn(vs: Vec2[], i: number) {
  const n = vs.length, p0 = vs[(i - 1 + n) % n], p1 = vs[i], p2 = vs[(i + 1) % n];
  let da = Math.abs(Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) - Math.atan2(p1[1] - p0[1], p1[0] - p0[0]));
  if (da > Math.PI) da = 2 * Math.PI - da;
  return da;
}
function cleanClosed(vs: Vec2[]): Vec2[] {
  vs = [...vs];
  for (let guard = 0; vs.length > 3 && guard < 20; guard++) {
    const n = vs.length;
    const per = vs.reduce((s, v, i) => s + d2(v, vs[(i + 1) % n]), 0);
    let worst = -1, wv = Infinity;
    for (let i = 0; i < n; i++) {
      const t = turn(vs, i);
      if (t < (38 * Math.PI) / 180 && t < wv) (wv = t), (worst = i);
    }
    if (worst < 0) {
      // kısa kenar: uçlarından dönüşü küçük olanı at
      let ei = -1, el = Infinity;
      for (let i = 0; i < n; i++) {
        const L = d2(vs[i], vs[(i + 1) % n]);
        if (L < 0.3 * (per / n) && L < el) (el = L), (ei = i);
      }
      if (ei < 0) break;
      worst = turn(vs, ei) < turn(vs, (ei + 1) % n) ? ei : (ei + 1) % n;
    }
    vs.splice(worst, 1);
  }
  return vs;
}

function lineX(a1: Vec2, a2: Vec2, b1: Vec2, b2: Vec2): Vec2 | null {
  const dx1 = a2[0] - a1[0], dy1 = a2[1] - a1[1], dx2 = b2[0] - b1[0], dy2 = b2[1] - b1[1];
  const den = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(den) < 1e-12) return null;
  const t = ((b1[0] - a1[0]) * dy2 - (b1[1] - a1[1]) * dx2) / den;
  return [a1[0] + dx1 * t, a1[1] + dy1 * t];
}

export function rectCorners(s: Extract<Shape, { kind: "rect" }>): Vec2[] {
  const v: Vec2 = [-s.u[1], s.u[0]];
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => [s.c[0] + s.u[0] * s.hx * i + v[0] * s.hy * j, s.c[1] + s.u[1] * s.hx * i + v[1] * s.hy * j] as Vec2);
}
/** önizleme için dış çizgi (kapalı) */
export function outline(s: Extract<Shape, { kind: "rect" | "ellipse" }>): Vec2[] {
  const v: Vec2 = [-s.u[1], s.u[0]];
  const W = (x: number, y: number): Vec2 => [s.c[0] + s.u[0] * x + v[0] * y, s.c[1] + s.u[1] * x + v[1] * y];
  if (s.kind === "ellipse") return Array.from({ length: 73 }, (_, i) => W(s.a * Math.cos((i / 72) * 2 * Math.PI), s.b * Math.sin((i / 72) * 2 * Math.PI)));
  if (s.r <= 0) {
    const c = rectCorners(s);
    return [...c, c[0]];
  }
  const ax = s.hx - s.r, ay = s.hy - s.r, out: Vec2[] = [];
  const cs: [number, number, number][] = [[ax, -ay, -90], [ax, ay, 0], [-ax, ay, 90], [-ax, -ay, 180]];
  for (const [x, y, a0] of cs) for (let k = 0; k <= 9; k++) {
    const a = ((a0 + 10 * k) * Math.PI) / 180;
    out.push(W(x + s.r * Math.cos(a), y + s.r * Math.sin(a)));
  }
  out.push(out[0]);
  return out;
}

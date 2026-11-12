// Sac geçiş parçası (loft büküm — kare→yuvarlak huni vb.) açınımı: üçgenleme ile geliştirme.
import type { Frame, Loop, Vec2, Vec3 } from "../doc/types";
import { toWorld } from "../doc/math";
import { loopSamples } from "../doc/compile";

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const d3 = (a: Vec3, b: Vec3) => len(sub(a, b));

/** kapalı çokgeni eşit yay aralıklı N noktaya örnekle */
function resample(pts: Vec3[], N: number): Vec3[] {
  const P = [...pts, pts[0]];
  const cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + d3(P[i], P[i - 1]));
  const T = cum[cum.length - 1];
  const out: Vec3[] = [];
  let j = 1;
  for (let k = 0; k < N; k++) {
    const s = (T * k) / N;
    while (j < cum.length - 1 && cum[j] < s) j++;
    const u = (s - cum[j - 1]) / (cum[j] - cum[j - 1] || 1);
    out.push([0, 1, 2].map((i) => P[j - 1][i] + (P[j][i] - P[j - 1][i]) * u) as Vec3);
  }
  return out;
}

export interface LoftFlat {
  outline: Vec2[];
  area: number;
  seam: number;
}

/** iki kapalı profili (dünya koordinatında) eşleyip açınımı hesapla */
export function loftFlatPattern(a: { frame: Frame; loop: Loop }, b: { frame: Frame; loop: Loop }, N = 72): LoftFlat {
  let A = resample(loopSamples(a.loop).map((p) => toWorld(a.frame, p)), N);
  let B = resample(loopSamples(b.loop).map((p) => toWorld(b.frame, p)), N);
  // aynı dönme yönü: iki profilin normali aynı yöne baksın
  const area = (P: Vec3[], n: Vec3) => P.reduce((s, p, i) => {
    const q = P[(i + 1) % P.length];
    const c: Vec3 = [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
    return s + c[0] * n[0] + c[1] * n[1] + c[2] * n[2];
  }, 0);
  if (Math.sign(area(A, a.frame.n)) !== Math.sign(area(B, a.frame.n))) B = B.reverse();
  // dikiş: A[0]'a en yakın B noktasından başla
  let k0 = 0;
  B.forEach((p, i) => d3(p, A[0]) < d3(B[k0], A[0]) && (k0 = i));
  B = [...B.slice(k0), ...B.slice(0, k0)];
  A = [...A, A[0]];
  B = [...B, B[0]];
  // şerit üçgenlemesi ile düzleme açma (kenar boyları korunur)
  const A2: Vec2[] = [[0, 0]];
  const B2: Vec2[] = [[0, -d3(A[0], B[0])]];
  const third = (p: Vec2, q: Vec2, dp: number, dq: number, side: number): Vec2 => {
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1e-9;
    const x = (dp * dp - dq * dq + L * L) / (2 * L);
    const y = Math.sqrt(Math.max(0, dp * dp - x * x));
    const ux = (q[0] - p[0]) / L, uy = (q[1] - p[1]) / L;
    return [p[0] + ux * x - uy * y * side, p[1] + uy * x + ux * y * side];
  };
  for (let i = 0; i < A.length - 1; i++) {
    // üçgen (A_i, B_i, A_{i+1}) — A_{i+1} kenarın sağına
    A2.push(third(A2[i], B2[i], d3(A[i], A[i + 1]), d3(B[i], A[i + 1]), -1));
    // üçgen (B_i, A_{i+1}, B_{i+1})
    B2.push(third(B2[i], A2[i + 1], d3(B[i], B[i + 1]), d3(A[i + 1], B[i + 1]), 1));
  }
  const outline = [...A2, ...[...B2].reverse()];
  let ar = 0;
  for (let i = 0; i < outline.length; i++) {
    const p = outline[i], q = outline[(i + 1) % outline.length];
    ar += p[0] * q[1] - q[0] * p[1];
  }
  return { outline, area: Math.abs(ar) / 2, seam: d3(A[0], B[0]) };
}

/** açınım dış hattı DXF (LWPOLYLINE) */
export function outlineDxf(pts: Vec2[]): string {
  const minx = Math.min(...pts.map((p) => p[0])), miny = Math.min(...pts.map((p) => p[1]));
  const v = pts.map((p) => `10\n${(p[0] - minx).toFixed(4)}\n20\n${(p[1] - miny).toFixed(4)}`).join("\n");
  return `0\nSECTION\n2\nENTITIES\n0\nLWPOLYLINE\n8\nKESIM\n90\n${pts.length}\n70\n1\n${v}\n0\nENDSEC\n0\nEOF\n`;
}

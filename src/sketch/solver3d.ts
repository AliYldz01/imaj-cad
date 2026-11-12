// 3B eskiz kısıt çözücü (Levenberg–Marquardt, sayısal Jacobian).
// Değişkenler: nokta koordinatları. Kısıtlar: çizgi `ax` (X/Y/Z boyunca), ilişkiler (cons3) ve sürücü ölçüler (dims3).
// Sönümlü en küçük kareler, kısıtlanmamış noktaları yerinde bırakır (SolidWorks gibi en az değişiklik).
import type { Sketch3DFeature, Vec3 } from "../doc/types";

export type Rel3 = "coinc" | "fix" | "par" | "perp" | "equal" | "mid" | "on" | "collin" | "parXY" | "parYZ" | "parZX";
export const REL3_NAMES: Record<Rel3 | "alongX" | "alongY" | "alongZ", string> = {
  coinc: "Çakışık",
  fix: "Sabitle",
  par: "Paralel",
  perp: "Dik",
  equal: "Eşit",
  mid: "Orta nokta",
  on: "Üzerinde",
  collin: "Doğrusal",
  parXY: "XY'ye paralel",
  parYZ: "YZ'ye paralel",
  parZX: "ZX'e paralel",
  alongX: "X boyunca",
  alongY: "Y boyunca",
  alongZ: "Z boyunca",
};
export const REL3_TAG: Record<string, string> = { coinc: "◎", fix: "⚓", par: "∥", perp: "⊥", equal: "=", mid: "◁▷", on: "∈", collin: "⋯", parXY: "∥XY", parYZ: "∥YZ", parZX: "∥ZX", x: "X", y: "Y", z: "Z" };

type F = Sketch3DFeature;
const sub = (a: number[], b: number[]) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const crs = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: number[]) => Math.hypot(a[0], a[1], a[2]);

/** bir çizgi ölçüsü / ilişkisi için varlıkların uç noktaları */
function lineEnds(f: F, lid: string): [number, number] | null {
  const l = f.lines.find((q) => q.id === lid);
  if (!l) return null;
  const a = f.ids.indexOf(l.a), b = f.ids.indexOf(l.b);
  return a < 0 || b < 0 ? null : [a, b];
}

/** artıklar (residuals) — X: nokta koordinatları (düz dizi) */
function residuals(f: F, X: number[], fixed0: Map<number, Vec3>): number[] {
  const P = (i: number) => [X[3 * i], X[3 * i + 1], X[3 * i + 2]];
  const r: number[] = [];
  const D = (lid: string) => {
    const e = lineEnds(f, lid);
    return e ? sub(P(e[1]), P(e[0])) : null;
  };
  for (const l of f.lines) {
    if (!l.ax) continue;
    const a = P(f.ids.indexOf(l.a)), b = P(f.ids.indexOf(l.b));
    const k = l.ax === "x" ? 0 : l.ax === "y" ? 1 : 2;
    for (let c = 0; c < 3; c++) if (c !== k) r.push(b[c] - a[c]);
  }
  for (const [i, p] of fixed0) for (let c = 0; c < 3; c++) r.push(X[3 * i + c] - p[c]);
  for (const c of f.cons3 ?? []) {
    const pt = (id: string) => f.ids.indexOf(id);
    if (c.t === "coinc") {
      const [a, b] = c.e.map(pt);
      if (a >= 0 && b >= 0) r.push(...sub(P(a), P(b)));
    } else if (c.t === "par" || c.t === "perp" || c.t === "equal" || c.t === "collin") {
      const d1 = D(c.e[0]), d2 = D(c.e[1]);
      if (!d1 || !d2) continue;
      const n1 = len(d1) || 1, n2 = len(d2) || 1;
      if (c.t === "par") r.push(...crs(d1, d2).map((v) => v / (n1 * n2)));
      else if (c.t === "perp") r.push(dot(d1, d2) / (n1 * n2));
      else if (c.t === "equal") r.push(n1 - n2);
      else {
        const e1 = lineEnds(f, c.e[0])!, e2 = lineEnds(f, c.e[1])!;
        r.push(...crs(d1, d2).map((v) => v / (n1 * n2)), ...crs(sub(P(e2[0]), P(e1[0])), d1).map((v) => v / n1));
      }
    } else if (c.t === "mid" || c.t === "on") {
      const p = pt(c.e[0]), e = lineEnds(f, c.e[1]);
      if (p < 0 || !e) continue;
      const A = P(e[0]), B = P(e[1]);
      if (c.t === "mid") r.push(...sub(P(p), [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2]));
      else {
        const d = sub(B, A);
        r.push(...crs(sub(P(p), A), d).map((v) => v / (len(d) || 1)));
      }
    } else if (c.t === "parXY" || c.t === "parYZ" || c.t === "parZX") {
      const d = D(c.e[0]);
      if (d) r.push(d[c.t === "parXY" ? 2 : c.t === "parYZ" ? 0 : 1]);
    }
  }
  for (const m of f.dims3 ?? []) {
    if (m.t === "len" || m.t === "dist") {
      let a: number, b: number;
      if (m.t === "len") {
        const e = lineEnds(f, m.e[0]);
        if (!e) continue;
        [a, b] = e;
      } else [a, b] = m.e.map((id) => f.ids.indexOf(id));
      if (a < 0 || b < 0) continue;
      r.push(len(sub(P(b), P(a))) - m.v);
    } else if (m.t === "ang") {
      const d1 = D(m.e[0]), d2 = D(m.e[1]);
      if (!d1 || !d2) continue;
      const l1 = lineEnds(f, m.e[0])!, l2 = lineEnds(f, m.e[1])!;
      const sh = [l1[0], l1[1]].find((q) => q === l2[0] || q === l2[1]);
      const sg = sh !== undefined && (sh === l1[0]) !== (sh === l2[0]) ? -1 : 1;
      r.push((sg * dot(d1, d2) / ((len(d1) || 1) * (len(d2) || 1)) - Math.cos((m.v * Math.PI) / 180)) * 100);
    }
  }
  return r;
}

/** n×n doğrusal sistem (Gauss, kısmi pivot) */
function solveLin(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-14) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const k = M[r][c] / M[c][c];
      if (k) for (let q = c; q <= n; q++) M[r][q] -= k * M[c][q];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

export interface Solve3Result {
  ok: boolean;
  /** kalan serbestlik derecesi (0 = tam tanımlı) */
  dof: number;
  err: number;
}

/** f.xyz'yi kısıtlara göre çözer. hold: sürüklenen / yeni girilen noktalar (yerinde sabit tutulur, mümkünse) */
export function solve3d(f: F, hold: number[] = []): Solve3Result {
  const n = f.xyz.length;
  if (!n) return { ok: true, dof: 0, err: 0 };
  const fixed0 = new Map<number, Vec3>();
  for (const c of f.cons3 ?? []) if (c.t === "fix") {
    const i = f.ids.indexOf(c.e[0]);
    if (i >= 0) fixed0.set(i, (c as any).p ?? [...f.xyz[i]]);
  }
  const X0 = f.xyz.flat();
  const tryHold = (holdSet: number[]) => {
    const hf = new Map(fixed0);
    for (const i of holdSet) if (!hf.has(i)) hf.set(i, [...f.xyz[i]] as Vec3);
    let X = X0.slice();
    let r = residuals(f, X, hf);
    let E = r.reduce((s, v) => s + v * v, 0);
    let lam = 1e-3;
    for (let it = 0; it < 60 && E > 1e-18; it++) {
      const m = r.length, N = X.length, h = 1e-6;
      const J: number[][] = Array.from({ length: m }, () => new Array(N).fill(0));
      for (let j = 0; j < N; j++) {
        const xj = X[j];
        X[j] = xj + h;
        const r2 = residuals(f, X, hf);
        X[j] = xj;
        for (let i = 0; i < m; i++) J[i][j] = (r2[i] - r[i]) / h;
      }
      const A: number[][] = Array.from({ length: N }, () => new Array(N).fill(0));
      const g = new Array(N).fill(0);
      for (let i = 0; i < m; i++) {
        const Ji = J[i];
        for (let a = 0; a < N; a++) {
          if (!Ji[a]) continue;
          g[a] += Ji[a] * r[i];
          for (let b = 0; b < N; b++) if (Ji[b]) A[a][b] += Ji[a] * Ji[b];
        }
      }
      let improved = false;
      for (let k = 0; k < 8 && !improved; k++) {
        const Al = A.map((row, a) => row.map((v, b) => (a === b ? v + lam * (1 + v) : v)));
        const dx = solveLin(Al, g.map((v) => -v));
        if (!dx) {
          lam *= 10;
          continue;
        }
        const Xn = X.map((v, j) => v + dx[j]);
        const rn = residuals(f, Xn, hf);
        const En = rn.reduce((s, v) => s + v * v, 0);
        if (En < E) {
          X = Xn;
          r = rn;
          E = En;
          lam = Math.max(lam / 10, 1e-9);
          improved = true;
        } else lam *= 10;
      }
      if (!improved) break;
    }
    return { X, E, hf };
  };
  let res = tryHold(hold);
  // tutulan noktalar kısıtlarla çelişiyorsa onları serbest bırakıp yeniden dene
  if (res.E > 1e-8 && hold.length) res = tryHold([]);
  const ok = res.E < 1e-8;
  if (ok) for (let i = 0; i < n; i++) f.xyz[i] = [3 * i, 3 * i + 1, 3 * i + 2].map((k) => Math.round(res.X[k] * 1e6) / 1e6) as Vec3;
  return { ok, dof: dofOf(f, fixed0), err: Math.sqrt(res.E) };
}

/** serbestlik: değişken sayısı − Jacobian rankı (orijin/global konum dahil; sabit nokta yoksa 3 öteleme kalır) */
export function dofOf(f: F, fixed0?: Map<number, Vec3>): number {
  const fx = fixed0 ?? new Map<number, Vec3>();
  if (!fixed0) for (const c of f.cons3 ?? []) if (c.t === "fix") {
    const i = f.ids.indexOf(c.e[0]);
    if (i >= 0) fx.set(i, [...f.xyz[i]] as Vec3);
  }
  const X = f.xyz.flat();
  const r0 = residuals(f, X, fx);
  const m = r0.length, N = X.length, h = 1e-6;
  if (!m) return N;
  const J: number[][] = Array.from({ length: m }, () => new Array(N).fill(0));
  for (let j = 0; j < N; j++) {
    const xj = X[j];
    X[j] = xj + h;
    const r2 = residuals(f, X, fx);
    X[j] = xj;
    for (let i = 0; i < m; i++) J[i][j] = (r2[i] - r0[i]) / h;
  }
  // rank (Gauss eleme)
  let rank = 0;
  const M = J.map((row) => row.slice());
  for (let c = 0; c < N && rank < m; c++) {
    let p = rank;
    for (let r = rank + 1; r < m; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-7) continue;
    [M[rank], M[p]] = [M[p], M[rank]];
    for (let r = rank + 1; r < m; r++) {
      const k = M[r][c] / M[rank][c];
      if (k) for (let q = c; q < N; q++) M[r][q] -= k * M[rank][q];
    }
    rank++;
  }
  return N - rank;
}

/** ölçünün güncel değeri */
export function dimValue(f: F, t: "len" | "dist" | "ang", e: string[]): number {
  const P = (id: string) => f.xyz[f.ids.indexOf(id)];
  if (t === "len") {
    const le = lineEnds(f, e[0]);
    return le ? len(sub(f.xyz[le[1]], f.xyz[le[0]])) : 0;
  }
  if (t === "dist") return len(sub(P(e[1]), P(e[0])));
  const l1 = lineEnds(f, e[0]), l2 = lineEnds(f, e[1]);
  if (!l1 || !l2) return 0;
  const d1 = sub(f.xyz[l1[1]], f.xyz[l1[0]]), d2 = sub(f.xyz[l2[1]], f.xyz[l2[0]]);
  let a = (Math.acos(Math.max(-1, Math.min(1, dot(d1, d2) / ((len(d1) || 1) * (len(d2) || 1))))) * 180) / Math.PI;
  // ortak noktada iç açı (SolidWorks gibi): uçlar ortaksa yönleri ortak noktadan dışa al
  const sh = [l1[0], l1[1]].find((q) => q === l2[0] || q === l2[1]);
  if (sh !== undefined && ((sh === l1[0]) !== (sh === l2[0]))) a = 180 - a;
  return a;
}

// Doğrusal statik sonlu eleman analizi (voksel ağ, 8 düğümlü uyumsuz kipli altı yüzlü eleman, CSR + Jacobi ön koşullu eşlenik gradyan).
// Birimler: mm, N, MPa.

export type V3 = [number, number, number];
export interface FeaLoad {
  /** yük yüzünün üçgenleri (9 sayı / üçgen) */
  tris: number[];
  /** toplam kuvvet vektörü (N) */
  F?: V3;
  /** yüz normaline göre toplam kuvvet (N, + = yüze bastırır / içeri) */
  Fn?: number;
  /** basınç (MPa, + = yüze bastırır) */
  p?: number;
}
export interface FeaInput {
  /** katının yüzey üçgenleri (9 sayı / üçgen) */
  tris: Float32Array | number[];
  /** hedef eleman sayısı */
  n: number;
  E: number;
  nu: number;
  /** sabit (ankastre) yüzlerin üçgenleri */
  fix: number[][];
  loads: FeaLoad[];
  /** yoğunluk (t/mm³) ve yerçekimi yönü — öz ağırlık için (isteğe bağlı) */
  rho?: number;
  g?: V3;
  maxIter?: number;
  tol?: number;
  onProgress?: (it: number, r: number) => void;
}
export interface FeaResult {
  ok: boolean;
  msg?: string;
  o: V3;
  h: V3;
  dims: V3;
  ne: number;
  nn: number;
  /** ızgara düğümü başına von Mises (NaN = etkin değil) */
  vm: Float32Array;
  /** ızgara düğümü başına yer değiştirme (3 bileşen) */
  u: Float32Array;
  vmMax: number;
  vmAt: V3;
  uMax: number;
  uAt: V3;
  iters: number;
  res: number;
  /** uygulanan toplam yük ve tepki kuvveti */
  Fapp: V3;
  Freac: V3;
  fixFaces: number;
  loadFaces: number;
}

// ---------------- eleman rijitliği ----------------
const NOD: V3[] = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];

function dmat(E: number, nu: number) {
  const l = (E * nu) / ((1 + nu) * (1 - 2 * nu)), m = E / (2 * (1 + nu));
  const D = new Float64Array(36);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) D[i * 6 + j] = l + (i === j ? 2 * m : 0);
  for (let i = 3; i < 6; i++) D[i * 6 + i] = m;
  return D;
}
/** B matrisi (6 × 33): 24 düğüm serbestliği + 9 uyumsuz kip */
function bmat(xi: number, et: number, ze: number, h: V3) {
  const B = new Float64Array(6 * 33);
  const sx = 2 / h[0], sy = 2 / h[1], sz = 2 / h[2];
  const put = (col: number, g: V3, c: number) => {
    const [gx, gy, gz] = g;
    if (c === 0) (B[0 * 33 + col] = gx), (B[3 * 33 + col] = gy), (B[5 * 33 + col] = gz);
    else if (c === 1) (B[1 * 33 + col] = gy), (B[3 * 33 + col] = gx), (B[4 * 33 + col] = gz);
    else (B[2 * 33 + col] = gz), (B[4 * 33 + col] = gy), (B[5 * 33 + col] = gx);
  };
  for (let a = 0; a < 8; a++) {
    const [p, q, r] = NOD[a];
    const g: V3 = [(p * (1 + et * q) * (1 + ze * r) * sx) / 8, ((1 + xi * p) * q * (1 + ze * r) * sy) / 8, ((1 + xi * p) * (1 + et * q) * r * sz) / 8];
    for (let c = 0; c < 3; c++) put(a * 3 + c, g, c);
  }
  const gp: V3[] = [[-2 * xi * sx, 0, 0], [0, -2 * et * sy, 0], [0, 0, -2 * ze * sz]];
  for (let j = 0; j < 3; j++) for (let c = 0; c < 3; c++) put(24 + j * 3 + c, gp[j], c);
  return B;
}
function inv(A: Float64Array, n: number) {
  const M = new Float64Array(A), I = new Float64Array(n * n);
  for (let i = 0; i < n; i++) I[i * n + i] = 1;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r * n + c]) > Math.abs(M[p * n + c])) p = r;
    if (p !== c)
      for (let k = 0; k < n; k++) {
        [M[c * n + k], M[p * n + k]] = [M[p * n + k], M[c * n + k]];
        [I[c * n + k], I[p * n + k]] = [I[p * n + k], I[c * n + k]];
      }
    const d = M[c * n + c];
    for (let k = 0; k < n; k++) (M[c * n + k] /= d), (I[c * n + k] /= d);
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r * n + c];
      if (!f) continue;
      for (let k = 0; k < n; k++) (M[r * n + k] -= f * M[c * n + k]), (I[r * n + k] -= f * I[c * n + k]);
    }
  }
  return I;
}
/** yoğunlaştırılmış eleman rijitliği Kc (24×24) ve kip geri kazanımı R (9×24): a = R·u */
export function hexKe(h: V3, E: number, nu: number) {
  const D = dmat(E, nu), K = new Float64Array(33 * 33), g = 1 / Math.sqrt(3), w = (h[0] * h[1] * h[2]) / 8;
  for (const xi of [-g, g])
    for (const et of [-g, g])
      for (const ze of [-g, g]) {
        const B = bmat(xi, et, ze, h);
        const DB = new Float64Array(6 * 33);
        for (let i = 0; i < 6; i++) for (let k = 0; k < 6; k++) { const d = D[i * 6 + k]; if (d) for (let j = 0; j < 33; j++) DB[i * 33 + j] += d * B[k * 33 + j]; }
        for (let i = 0; i < 33; i++) for (let k = 0; k < 6; k++) { const b = B[k * 33 + i]; if (b) for (let j = 0; j < 33; j++) K[i * 33 + j] += b * DB[k * 33 + j] * w; }
      }
  const Kaa = new Float64Array(81);
  for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) Kaa[i * 9 + j] = K[(24 + i) * 33 + 24 + j];
  const Ai = inv(Kaa, 9);
  const R = new Float64Array(9 * 24);
  for (let i = 0; i < 9; i++) for (let j = 0; j < 24; j++) { let s = 0; for (let k = 0; k < 9; k++) s += Ai[i * 9 + k] * K[(24 + k) * 33 + j]; R[i * 24 + j] = -s; }
  const Kc = new Float64Array(24 * 24);
  for (let i = 0; i < 24; i++) for (let j = 0; j < 24; j++) { let s = K[i * 33 + j]; for (let k = 0; k < 9; k++) s += K[i * 33 + 24 + k] * R[k * 24 + j]; Kc[i * 24 + j] = s; }
  // köşelerde gerilme matrisi S = D·B (6×33)
  const S: Float64Array[] = NOD.map(([p, q, r]) => {
    const B = bmat(p, q, r, h), DB = new Float64Array(6 * 33);
    for (let i = 0; i < 6; i++) for (let k = 0; k < 6; k++) { const d = D[i * 6 + k]; if (d) for (let j = 0; j < 33; j++) DB[i * 33 + j] += d * B[k * 33 + j]; }
    return DB;
  });
  return { Kc, R, S };
}

// ---------------- geometri yardımcıları ----------------
function closestTri(p: V3, t: ArrayLike<number>, o: number): [number, V3] {
  const a: V3 = [t[o], t[o + 1], t[o + 2]], b: V3 = [t[o + 3], t[o + 4], t[o + 5]], c: V3 = [t[o + 6], t[o + 7], t[o + 8]];
  const sub = (u: V3, v: V3): V3 => [u[0] - v[0], u[1] - v[1], u[2] - v[2]];
  const dot = (u: V3, v: V3) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a);
  const n: V3 = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
  const nl = Math.hypot(...n) || 1;
  const nn: V3 = [n[0] / nl, n[1] / nl, n[2] / nl];
  const d1 = dot(ab, ap), d2 = dot(ac, ap);
  let q: V3;
  if (d1 <= 0 && d2 <= 0) q = a;
  else {
    const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
    if (d3 >= 0 && d4 <= d3) q = b;
    else {
      const vc = d1 * d4 - d3 * d2;
      if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); q = [a[0] + v * ab[0], a[1] + v * ab[1], a[2] + v * ab[2]]; }
      else {
        const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
        if (d6 >= 0 && d5 <= d6) q = c;
        else {
          const vb = d5 * d2 - d1 * d6;
          if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); q = [a[0] + w * ac[0], a[1] + w * ac[1], a[2] + w * ac[2]]; }
          else {
            const va = d3 * d6 - d5 * d4;
            if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / (d4 - d3 + (d5 - d6)); q = [b[0] + w * (c[0] - b[0]), b[1] + w * (c[1] - b[1]), b[2] + w * (c[2] - b[2])]; }
            else { const den = 1 / (va + vb + vc), v = vb * den, w = vc * den; q = [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w]; }
          }
        }
      }
    }
  }
  return [Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]), nn];
}
/** yüz kümesine uzaklık + en yakın üçgenin normali */
function faceDist(p: V3, tris: number[]): [number, V3] {
  let best = Infinity, bn: V3 = [0, 0, 1];
  for (let o = 0; o < tris.length; o += 9) {
    const [d, n] = closestTri(p, tris, o);
    if (d < best) (best = d), (bn = n);
  }
  return [best, bn];
}
function triArea(t: ArrayLike<number>, o: number) {
  const ux = t[o + 3] - t[o], uy = t[o + 4] - t[o + 1], uz = t[o + 5] - t[o + 2];
  const vx = t[o + 6] - t[o], vy = t[o + 7] - t[o + 1], vz = t[o + 8] - t[o + 2];
  return Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
}

// ---------------- çözücü ----------------
export function solveFea(inp: FeaInput): FeaResult {
  const T = inp.tris;
  const nt = T.length / 9;
  const mn: V3 = [Infinity, Infinity, Infinity], mx: V3 = [-Infinity, -Infinity, -Infinity];
  let vol = 0;
  for (let i = 0; i < nt; i++) {
    const o = i * 9;
    for (let k = 0; k < 3; k++) for (let c = 0; c < 3; c++) (mn[c] = Math.min(mn[c], T[o + k * 3 + c])), (mx[c] = Math.max(mx[c], T[o + k * 3 + c]));
    // diverjans: hacim
    vol += (T[o] * (T[o + 4] * T[o + 8] - T[o + 5] * T[o + 7]) - T[o + 1] * (T[o + 3] * T[o + 8] - T[o + 5] * T[o + 6]) + T[o + 2] * (T[o + 3] * T[o + 7] - T[o + 4] * T[o + 6])) / 6;
  }
  vol = Math.abs(vol);
  const L: V3 = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]];
  const h0 = Math.cbrt(vol / Math.max(50, inp.n));
  const dims = L.map((l) => Math.max(1, Math.round(l / h0))) as V3;
  const h = L.map((l, i) => l / dims[i]) as V3;
  const [NX, NY, NZ] = dims;
  const empty = (msg: string): FeaResult => ({ ok: false, msg, o: mn, h, dims, ne: 0, nn: 0, vm: new Float32Array(0), u: new Float32Array(0), vmMax: 0, vmAt: [0, 0, 0], uMax: 0, uAt: [0, 0, 0], iters: 0, res: 0, Fapp: [0, 0, 0], Freac: [0, 0, 0], fixFaces: 0, loadFaces: 0 });
  if (NX * NY * NZ > 3e6) return empty("Ağ çok büyük");
  // voksel: x yönünde ışın paritesi
  const act = new Uint8Array(NX * NY * NZ);
  const eid = (i: number, j: number, k: number) => i + NX * (j + NY * k);
  const bins: number[][] = Array.from({ length: NY * NZ }, () => []);
  for (let t = 0; t < nt; t++) {
    const o = t * 9;
    const y0 = Math.min(T[o + 1], T[o + 4], T[o + 7]), y1 = Math.max(T[o + 1], T[o + 4], T[o + 7]);
    const z0 = Math.min(T[o + 2], T[o + 5], T[o + 8]), z1 = Math.max(T[o + 2], T[o + 5], T[o + 8]);
    const j0 = Math.max(0, Math.floor((y0 - mn[1]) / h[1] - 0.5)), j1 = Math.min(NY - 1, Math.ceil((y1 - mn[1]) / h[1] - 0.5));
    const k0 = Math.max(0, Math.floor((z0 - mn[2]) / h[2] - 0.5)), k1 = Math.min(NZ - 1, Math.ceil((z1 - mn[2]) / h[2] - 0.5));
    for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) bins[j + NY * k].push(t);
  }
  for (let k = 0; k < NZ; k++)
    for (let j = 0; j < NY; j++) {
      const y = mn[1] + (j + 0.5) * h[1] + 1.37e-6 * h[1], z = mn[2] + (k + 0.5) * h[2] + 2.11e-6 * h[2];
      const xs: number[] = [];
      for (const t of bins[j + NY * k]) {
        const o = t * 9;
        const ay = T[o + 1], az = T[o + 2], by = T[o + 4], bz = T[o + 5], cy = T[o + 7], cz = T[o + 8];
        const d = (by - ay) * (cz - az) - (cy - ay) * (bz - az);
        if (Math.abs(d) < 1e-14) continue;
        const u = ((y - ay) * (cz - az) - (cy - ay) * (z - az)) / d, v = ((by - ay) * (z - az) - (y - ay) * (bz - az)) / d;
        if (u < 0 || v < 0 || u + v > 1) continue;
        xs.push(T[o] + u * (T[o + 3] - T[o]) + v * (T[o + 6] - T[o]));
      }
      xs.sort((a, b) => a - b);
      for (let q = 0; q + 1 < xs.length; q += 2) {
        const i0 = Math.max(0, Math.ceil((xs[q] - mn[0]) / h[0] - 0.5)), i1 = Math.min(NX - 1, Math.floor((xs[q + 1] - mn[0]) / h[0] - 0.5));
        for (let i = i0; i <= i1; i++) act[eid(i, j, k)] = 1;
      }
    }
  // düğümler
  const GX = NX + 1, GY = NY + 1, GZ = NZ + 1;
  const gid = (i: number, j: number, k: number) => i + GX * (j + GY * k);
  const nmap = new Int32Array(GX * GY * GZ).fill(-1);
  const elems: number[] = [];
  let nn = 0;
  const off: V3[] = NOD.map(([p, q, r]) => [(p + 1) / 2, (q + 1) / 2, (r + 1) / 2]);
  for (let k = 0; k < NZ; k++)
    for (let j = 0; j < NY; j++)
      for (let i = 0; i < NX; i++) {
        if (!act[eid(i, j, k)]) continue;
        elems.push(i, j, k);
        for (const [a, b, c] of off) { const g = gid(i + a, j + b, k + c); if (nmap[g] < 0) nmap[g] = nn++; }
      }
  const ne = elems.length / 3;
  if (!ne) return empty("Katı ağlanamadı (kapalı gövde gerekli)");
  const ginv = new Int32Array(nn);
  for (let g = 0; g < nmap.length; g++) if (nmap[g] >= 0) ginv[nmap[g]] = g;
  const gxyz = (g: number): V3 => { const i = g % GX, j = Math.floor(g / GX) % GY, k = Math.floor(g / (GX * GY)); return [i, j, k]; };
  // dış voksel yüzleri: [eleman, yön 0..5]
  const DIRS: [V3, number[]][] = [
    [[-1, 0, 0], [0, 3, 7, 4]], [[1, 0, 0], [1, 2, 6, 5]], [[0, -1, 0], [0, 1, 5, 4]], [[0, 1, 0], [3, 2, 6, 7]], [[0, 0, -1], [0, 1, 2, 3]], [[0, 0, 1], [4, 5, 6, 7]],
  ];
  const ndof = nn * 3;
  const F = new Float64Array(ndof);
  const fixed = new Uint8Array(ndof);
  const tol = 0.75 * Math.max(...h);
  const areaOf = (d: number) => (d < 2 ? h[1] * h[2] : d < 4 ? h[0] * h[2] : h[0] * h[1]);
  const exposed: { e: number; d: number; c: V3 }[] = [];
  for (let e = 0; e < ne; e++) {
    const [i, j, k] = [elems[e * 3], elems[e * 3 + 1], elems[e * 3 + 2]];
    DIRS.forEach(([dv], d) => {
      const a = i + dv[0], b = j + dv[1], c = k + dv[2];
      if (a >= 0 && b >= 0 && c >= 0 && a < NX && b < NY && c < NZ && act[eid(a, b, c)]) return;
      exposed.push({ e, d, c: [mn[0] + (i + 0.5 + dv[0] / 2) * h[0], mn[1] + (j + 0.5 + dv[1] / 2) * h[1], mn[2] + (k + 0.5 + dv[2] / 2) * h[2]] });
    });
  }
  const boxOf = (tr: number[]) => {
    const a: V3 = [Infinity, Infinity, Infinity], b: V3 = [-Infinity, -Infinity, -Infinity];
    for (let o = 0; o < tr.length; o += 3) for (let c = 0; c < 3; c++) (a[c] = Math.min(a[c], tr[o + c])), (b[c] = Math.max(b[c], tr[o + c]));
    return [a, b];
  };
  const onFace = (tr: number[]) => {
    const [a, b] = boxOf(tr);
    const out: { x: (typeof exposed)[0]; n: V3 }[] = [];
    for (const x of exposed) {
      if (x.c.some((v, c) => v < a[c] - tol || v > b[c] + tol)) continue;
      const [dd, n] = faceDist(x.c, tr);
      if (dd > tol) continue;
      const dv = DIRS[x.d][0];
      if (Math.abs(dv[0] * n[0] + dv[1] * n[1] + dv[2] * n[2]) < 0.3) continue;
      out.push({ x, n });
    }
    return out;
  };
  const enode = (e: number, a: number) => {
    const [p, q, r] = off[a];
    return nmap[gid(elems[e * 3] + p, elems[e * 3 + 1] + q, elems[e * 3 + 2] + r)];
  };
  let fixFaces = 0;
  for (const tr of inp.fix) for (const { x } of onFace(tr)) { fixFaces++; for (const a of DIRS[x.d][1]) { const nd = enode(x.e, a); fixed[nd * 3] = fixed[nd * 3 + 1] = fixed[nd * 3 + 2] = 1; } }
  if (!fixFaces) return empty("Sabit yüz ağda bulunamadı (sabitleme seçin)");
  const Fapp: V3 = [0, 0, 0];
  let loadFaces = 0;
  for (const ld of inp.loads) {
    const sel = onFace(ld.tris);
    if (!sel.length) continue;
    loadFaces += sel.length;
    let At = 0;
    for (const s of sel) At += areaOf(s.x.d);
    let Ar = 0;
    for (let o = 0; o < ld.tris.length; o += 9) Ar += triArea(ld.tris, o);
    for (const s of sel) {
      const w = areaOf(s.x.d) / At; // pay
      const f: V3 = [0, 0, 0];
      if (ld.F) for (let c = 0; c < 3; c++) f[c] += ld.F[c] * w;
      // normal kuvvet / basınç: dış normale ters (yüze bastırır)
      const fn = (ld.Fn ?? 0) + (ld.p ?? 0) * Ar;
      if (fn) for (let c = 0; c < 3; c++) f[c] -= s.n[c] * fn * w;
      for (const a of DIRS[s.x.d][1]) { const nd = enode(s.x.e, a); for (let c = 0; c < 3; c++) F[nd * 3 + c] += f[c] / 4; }
      for (let c = 0; c < 3; c++) Fapp[c] += f[c];
    }
  }
  if (!loadFaces && !inp.rho) return empty("Yük yüzü ağda bulunamadı");
  const { Kc, R, S } = hexKe(h, inp.E, inp.nu);
  // öz ağırlık
  if (inp.rho && inp.g) {
    const m = inp.rho * h[0] * h[1] * h[2];
    for (let e = 0; e < ne; e++) for (let a = 0; a < 8; a++) { const nd = enode(e, a); for (let c = 0; c < 3; c++) F[nd * 3 + c] += (m * inp.g[c]) / 8; }
    for (let c = 0; c < 3; c++) Fapp[c] += m * ne * inp.g[c];
  }
  // CSR: düğüm başına 27 komşu yuvası
  const slot = new Int32Array(nn * 27).fill(-1);
  const cnt = new Int32Array(nn);
  for (let n = 0; n < nn; n++) {
    const [i, j, k] = gxyz(ginv[n]);
    for (let dk = -1; dk <= 1; dk++)
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          const a = i + di, b = j + dj, c = k + dk;
          if (a < 0 || b < 0 || c < 0 || a >= GX || b >= GY || c >= GZ) continue;
          if (nmap[gid(a, b, c)] < 0) continue;
          slot[n * 27 + di + 1 + (dj + 1) * 3 + (dk + 1) * 9] = cnt[n]++;
        }
  }
  const rp = new Int32Array(nn + 1);
  for (let n = 0; n < nn; n++) rp[n + 1] = rp[n] + cnt[n] * 9;
  const val = new Float64Array(rp[nn]);
  const col = new Int32Array(rp[nn]);
  for (let n = 0; n < nn; n++) {
    const [i, j, k] = gxyz(ginv[n]);
    for (let s = 0; s < 27; s++) {
      const p = slot[n * 27 + s];
      if (p < 0) continue;
      const di = (s % 3) - 1, dj = (Math.floor(s / 3) % 3) - 1, dk = Math.floor(s / 9) - 1;
      const m = nmap[gid(i + di, j + dj, k + dk)];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) col[rp[n] + p * 9 + r * 3 + c] = m * 3 + c;
    }
  }
  const en = new Int32Array(8);
  for (let e = 0; e < ne; e++) {
    for (let a = 0; a < 8; a++) en[a] = enode(e, a);
    for (let a = 0; a < 8; a++) {
      const na = en[a];
      for (let b = 0; b < 8; b++) {
        const d = [off[b][0] - off[a][0], off[b][1] - off[a][1], off[b][2] - off[a][2]];
        const p = slot[na * 27 + d[0] + 1 + (d[1] + 1) * 3 + (d[2] + 1) * 9];
        const base = rp[na] + p * 9;
        for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) val[base + r * 3 + c] += Kc[(a * 3 + r) * 24 + b * 3 + c];
      }
    }
  }
  // satır ofseti: düğümün 3 satırı ardışık değil (blok) → çarpım blok blok
  const mv = (x: Float64Array, y: Float64Array) => {
    for (let n = 0; n < nn; n++) {
      let y0 = 0, y1 = 0, y2 = 0;
      for (let q = rp[n]; q < rp[n + 1]; q += 9) {
        const c = col[q] - (col[q] % 3);
        const x0 = fixed[c] ? 0 : x[c], x1 = fixed[c + 1] ? 0 : x[c + 1], x2 = fixed[c + 2] ? 0 : x[c + 2];
        y0 += val[q] * x0 + val[q + 1] * x1 + val[q + 2] * x2;
        y1 += val[q + 3] * x0 + val[q + 4] * x1 + val[q + 5] * x2;
        y2 += val[q + 6] * x0 + val[q + 7] * x1 + val[q + 8] * x2;
      }
      const b = n * 3;
      y[b] = fixed[b] ? x[b] : y0;
      y[b + 1] = fixed[b + 1] ? x[b + 1] : y1;
      y[b + 2] = fixed[b + 2] ? x[b + 2] : y2;
    }
  };
  const dg = new Float64Array(ndof);
  for (let n = 0; n < nn; n++) {
    const s = slot[n * 27 + 13];
    for (let r = 0; r < 3; r++) dg[n * 3 + r] = fixed[n * 3 + r] ? 1 : val[rp[n] + s * 9 + r * 3 + r];
  }
  const fb = new Float64Array(F);
  for (let i = 0; i < ndof; i++) if (fixed[i]) fb[i] = 0;
  const U = new Float64Array(ndof), r = new Float64Array(fb), z = new Float64Array(ndof), pv = new Float64Array(ndof), Ap = new Float64Array(ndof);
  for (let i = 0; i < ndof; i++) (z[i] = r[i] / dg[i]), (pv[i] = z[i]);
  let rz = 0, b2 = 0;
  for (let i = 0; i < ndof; i++) (rz += r[i] * z[i]), (b2 += fb[i] * fb[i]);
  const bn = Math.sqrt(b2) || 1, tolr = inp.tol ?? 1e-7, maxIt = inp.maxIter ?? Math.max(2000, Math.round(40 * Math.cbrt(ne) * 10));
  let it = 0, res = 1;
  for (; it < maxIt; it++) {
    mv(pv, Ap);
    let pAp = 0;
    for (let i = 0; i < ndof; i++) pAp += pv[i] * Ap[i];
    if (!(pAp > 0)) break;
    const al = rz / pAp;
    let rr = 0;
    for (let i = 0; i < ndof; i++) (U[i] += al * pv[i]), (r[i] -= al * Ap[i]), (rr += r[i] * r[i]);
    res = Math.sqrt(rr) / bn;
    if (it % 50 === 0) inp.onProgress?.(it, res);
    if (res < tolr) break;
    let rz2 = 0;
    for (let i = 0; i < ndof; i++) (z[i] = r[i] / dg[i]), (rz2 += r[i] * z[i]);
    const be = rz2 / rz;
    rz = rz2;
    for (let i = 0; i < ndof; i++) pv[i] = z[i] + be * pv[i];
  }
  // tepki: K·U − F sabit düğümlerde
  const KU = new Float64Array(ndof);
  {
    const fx = fixed.slice();
    fixed.fill(0);
    mv(U, KU);
    fixed.set(fx);
  }
  const Freac: V3 = [0, 0, 0];
  for (let n = 0; n < nn; n++) for (let c = 0; c < 3; c++) if (fixed[n * 3 + c]) Freac[c] += KU[n * 3 + c] - F[n * 3 + c];
  // gerilme: köşelerde, düğümlerde ortalama
  const sig = new Float64Array(nn * 6), sc = new Float32Array(nn);
  const ue = new Float64Array(33);
  for (let e = 0; e < ne; e++) {
    for (let a = 0; a < 8; a++) { const nd = enode(e, a); for (let c = 0; c < 3; c++) ue[a * 3 + c] = U[nd * 3 + c]; }
    for (let i = 0; i < 9; i++) { let s = 0; for (let j = 0; j < 24; j++) s += R[i * 24 + j] * ue[j]; ue[24 + i] = s; }
    for (let a = 0; a < 8; a++) {
      const nd = enode(e, a), Sa = S[a];
      for (let q = 0; q < 6; q++) { let s = 0; for (let j = 0; j < 33; j++) s += Sa[q * 33 + j] * ue[j]; sig[nd * 6 + q] += s; }
      sc[nd]++;
    }
  }
  const G = GX * GY * GZ;
  const vm = new Float32Array(G).fill(NaN), uu = new Float32Array(G * 3).fill(0);
  let vmMax = 0, uMax = 0, vmAt: V3 = [0, 0, 0], uAt: V3 = [0, 0, 0];
  for (let n = 0; n < nn; n++) {
    const s = sig.subarray(n * 6, n * 6 + 6).map((v) => v / sc[n]);
    const v = Math.sqrt(0.5 * ((s[0] - s[1]) ** 2 + (s[1] - s[2]) ** 2 + (s[2] - s[0]) ** 2) + 3 * (s[3] ** 2 + s[4] ** 2 + s[5] ** 2));
    const g = ginv[n], [i, j, k] = gxyz(g);
    const P: V3 = [mn[0] + i * h[0], mn[1] + j * h[1], mn[2] + k * h[2]];
    vm[g] = v;
    for (let c = 0; c < 3; c++) uu[g * 3 + c] = U[n * 3 + c];
    const um = Math.hypot(U[n * 3], U[n * 3 + 1], U[n * 3 + 2]);
    if (v > vmMax) (vmMax = v), (vmAt = P);
    if (um > uMax) (uMax = um), (uAt = P);
  }
  return { ok: res < 1e-3, msg: res < 1e-3 ? undefined : "Çözüm yakınsamadı (sabitleme yetersiz olabilir)", o: mn, h, dims, ne, nn, vm, u: uu, vmMax, vmAt, uMax, uAt, iters: it, res, Fapp, Freac, fixFaces, loadFaces };
}

/** sonuç alanını bir noktada üç doğrusal ara değerle okur (etkin olmayan köşeler atlanır) */
export function sampleField(r: FeaResult, p: ArrayLike<number>, f: "vm" | "u", out?: number[]): number {
  const [NX, NY, NZ] = r.dims, GX = NX + 1, GY = NY + 1;
  const t = [0, 1, 2].map((c) => Math.min(r.dims[c] - 1e-9, Math.max(0, (p[c] - r.o[c]) / r.h[c])));
  const i = Math.floor(t[0]), j = Math.floor(t[1]), k = Math.floor(t[2]);
  const fx = t[0] - i, fy = t[1] - j, fz = t[2] - k;
  let sw = 0, sv = 0;
  const su = [0, 0, 0];
  for (let c = 0; c < 8; c++) {
    const a = c & 1, b = (c >> 1) & 1, d = (c >> 2) & 1;
    const g = i + a + GX * (j + b + GY * (k + d));
    const v = r.vm[g];
    if (Number.isNaN(v)) continue;
    const w = (a ? fx : 1 - fx) * (b ? fy : 1 - fy) * (d ? fz : 1 - fz) + 1e-9;
    sw += w;
    sv += w * v;
    for (let q = 0; q < 3; q++) su[q] += w * r.u[g * 3 + q];
  }
  void NZ;
  if (!sw) return f === "vm" ? 0 : 0;
  if (out) for (let q = 0; q < 3; q++) out[q] = su[q] / sw;
  return f === "vm" ? sv / sw : Math.hypot(su[0], su[1], su[2]) / sw;
}

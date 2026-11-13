import { solveFea, sampleField } from "../../src/fea/fea";
type V = [number, number, number];
const box = (a: V, b: V) => {
  const c = (i: number): V => [i & 1 ? b[0] : a[0], i & 2 ? b[1] : a[1], i & 4 ? b[2] : a[2]];
  const quads = [[0, 2, 6, 4], [1, 5, 7, 3], [0, 4, 5, 1], [2, 3, 7, 6], [0, 1, 3, 2], [4, 6, 7, 5]];
  const faces: number[][] = [];
  for (const q of quads) faces.push([...c(q[0]), ...c(q[1]), ...c(q[2]), ...c(q[0]), ...c(q[2]), ...c(q[3])]);
  return faces; // [x0, x1, y0, y1, z0, z1]
};
let fail = 0;
const chk = (n: string, ok: boolean, v: any) => (console.log((ok ? "TAMAM " : "HATA  ") + n, v), ok || fail++);
for (const n of [800, 3000]) {
  const f = box([0, 0, 0], [100, 10, 10]);
  const t0 = Date.now();
  const r = solveFea({ tris: f.flat(), n, E: 210000, nu: 0.3, fix: [f[0]], loads: [{ tris: f[1], F: [0, -100, 0] }] });
  const tip = [0, 0, 0];
  sampleField(r, [100, 5, 5], "u", tip);
  const mid = sampleField(r, [50, 10, 5], "vm");
  const d = (100 * 100 ** 3) / (3 * 210000 * (10 * 10 ** 3 / 12));
  console.log(`n=${n} ne=${r.ne} it=${r.iters} res=${r.res.toExponential(1)} ${Date.now() - t0} ms`, r.dims, "tepki", r.Freac.map((v) => +v.toFixed(2)));
  chk(`uç sehim ≈ ${d.toFixed(4)}`, Math.abs(-tip[1] - d) / d < 0.06, -tip[1]);
  chk("orta açıklık üst lif σ ≈ 30", Math.abs(mid - 30) / 30 < 0.15, mid);
  chk("tepki = −yük", Math.abs(r.Freac[1] - 100) < 0.5, r.Freac[1]);
}
console.log("TOPLAM BAŞARISIZ:", fail);

// Tam tanımla: orijine göre yatay/dikey ölçüler, yarıçaplar ve gerekirse sabitleme ekler (eklenen sayıyı döndürür)
import type { SDim, SketchData } from "../doc/types";
import { ORIGIN } from "../doc/types";
import { solve, analyze } from "./solver";
import { P, nid } from "./model";

const add2 = (a: number[], b: number[]): [number, number] => [a[0] + b[0], a[1] + b[1]];

export function autoDefine(sk: SketchData): number {
  let added = 0;
  const tryDim = (d: SDim) => {
    const b0 = solve(sk, undefined, false), before = b0.dof;
    sk.dims.push(d);
    const r = solve(sk, undefined, false);
    // gereksiz kısıt oluşturan ölçü eklenmez (eskiz "aşırı tanımlı (gereksiz)" olmasın)
    if (!r.ok || r.conflicts.length || r.dof >= before || r.redundant.length > b0.redundant.length) {
      sk.dims.pop();
      return false;
    }
    added++;
    return true;
  };
  let res = solve(sk);
  let def = analyze(sk, res.dof);
  // yarıçaplar
  for (const e of sk.ents) {
    if ((e.t === "circle" || e.t === "arc") && !def.radii.has(e.id)) {
      const c = P(sk, e.c);
      tryDim({ id: nid(sk, "d"), t: e.t === "circle" ? "dia" : "rad", refs: [e.id], v: e.t === "circle" ? e.r * 2 : e.r, lp: add2(c, [e.r * 0.8, e.r * 0.9]) });
    }
  }
  res = solve(sk);
  def = analyze(sk, res.dof);
  let k = 0;
  for (const id of Object.keys(sk.pts)) {
    if (def.pts.has(id)) continue;
    const q = P(sk, id);
    k++;
    const okx = Math.abs(q[0]) > 1e-9 && tryDim({ id: nid(sk, "d"), t: "dist", sub: "h", refs: q[0] >= 0 ? [ORIGIN, id] : [id, ORIGIN], v: Math.abs(q[0]), lp: [q[0] / 2, Math.min(0, q[1]) - 8 - (k % 5) * 6] });
    const oky = Math.abs(q[1]) > 1e-9 && tryDim({ id: nid(sk, "d"), t: "dist", sub: "v", refs: q[1] >= 0 ? [ORIGIN, id] : [id, ORIGIN], v: Math.abs(q[1]), lp: [Math.min(0, q[0]) - 8 - (k % 5) * 6, q[1] / 2] });
    if (okx || oky) {
      res = solve(sk);
      def = analyze(sk, res.dof);
    }
    if (res.dof === 0) break;
  }
  // orijinde duran ama tanımsız noktalar için sabitle
  res = solve(sk);
  def = analyze(sk, res.dof);
  for (const id of Object.keys(sk.pts)) {
    if (res.dof === 0) break;
    if (def.pts.has(id)) continue;
    const q = P(sk, id);
    const b0 = solve(sk, undefined, false), before = b0.dof;
    sk.rels.push({ id: nid(sk, "r"), t: "fix", refs: [id], fx: q[0], fy: q[1] });
    const r = solve(sk, undefined, false);
    if (!r.ok || r.conflicts.length || r.dof >= before || r.redundant.length > b0.redundant.length) sk.rels.pop();
    else added++;
    res = solve(sk);
    def = analyze(sk, res.dof);
  }
  return added;
}

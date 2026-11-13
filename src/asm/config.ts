// Montaj bileşen yapılandırmaları (SolidWorks: bileşenin başvurulan yapılandırması)
// Parça belgesindeki yapılandırma (değişken değerleri + bastırılan özellikler) bileşen için ayrı uygulanır; parça belgesi değişmez.
import type { Feature } from "../doc/types";
import { evalNum } from "../doc/math";
import { solve as solveSketch } from "../sketch/solver";
import { solve3d } from "../sketch/solver3d";
import type { AsmPart } from "./assembly";

export function partConfigs(p: AsmPart): string[] {
  return (p.configs ?? []).map((c) => c.name);
}

const cache = new Map<string, Feature[]>();
/** bileşenin yapılandırmasına göre özellik listesi (önbellekli; yapılandırma yoksa parçanın kendisi) */
export function configFeatures(p: AsmPart, name?: string): Feature[] {
  const cfg = name ? p.configs?.find((c) => c.name === name) : undefined;
  if (!cfg) return p.features;
  const key = name + "|" + JSON.stringify([p.features, p.vars, p.eqs, cfg]);
  const hit = cache.get(key);
  if (hit) return hit;
  const feats: Feature[] = JSON.parse(JSON.stringify(p.features));
  for (const f of feats) (f as any).off = cfg.off.includes(f.id) || undefined;
  const vv = (n: string, seen = new Set<string>()): number | undefined => {
    const ex = cfg.vars[n] ?? p.vars?.[n];
    if (ex === undefined || seen.has(n)) return undefined;
    seen.add(n);
    return evalNum(ex, (m) => vv(m, seen)) ?? undefined;
  };
  const ev = (ex: string) => evalNum(ex, (n) => vv(n));
  const byId = new Map(feats.map((f) => [f.id, f as any]));
  for (const [k, ex] of Object.entries((p.eqs ?? {}) as Record<string, string>)) {
    const fid = k.split(".")[0];
    const f = byId.get(fid);
    const v = ev(ex);
    if (!f || v === null) continue;
    const prop = k.slice(fid.length + 1);
    const m = prop.match(/^(\w+)\[(\d+)\]\[(\d+)\]$/);
    const m2 = prop.match(/^(\w+)\[(\d+)\]\.(\w+)$/);
    if (m && f[m[1]]?.[+m[2]]) f[m[1]][+m[2]][+m[3]] = v;
    else if (m2 && f[m2[1]]?.[+m2[2]]) {
      f[m2[1]][+m2[2]][m2[3]] = v;
      if (f.type === "sketch3d") solve3d(f);
    } else if (!prop.includes("[")) f[prop] = v;
  }
  for (const f of feats) {
    if (f.type !== "sketch") continue;
    let changed = false;
    for (const d of f.data.dims) {
      if (!d.expr) continue;
      const v = ev(d.expr);
      if (v === null) continue;
      const nv = d.t === "dist" && d.sub !== "a" ? Math.abs(v) * Math.sign(d.v || 1) : Math.abs(v);
      if (Math.abs(nv - d.v) > 1e-12) (d.v = nv), (changed = true);
    }
    if (changed) solveSketch(f.data);
  }
  if (cache.size > 50) cache.clear();
  cache.set(key, feats);
  return feats;
}

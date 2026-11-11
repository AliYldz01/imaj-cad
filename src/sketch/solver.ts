// Eskiz kısıt çözücüsü: FreeCAD PlaneGCS (WebAssembly, LGPL).
import { init_planegcs_module, GcsWrapper } from "@salusoft89/planegcs";
import wasmUrl from "@salusoft89/planegcs/dist/planegcs_dist/planegcs.wasm?url";
import type { SDim, SEnt, SRel, SketchData } from "../doc/types";
import { ORIGIN } from "../doc/types";

let gcs: GcsWrapper | null = null;

export async function initSolver() {
  const mod = await (init_planegcs_module as any)({ locateFile: () => wasmUrl });
  gcs = new GcsWrapper(new mod.GcsSystem());
  gcs.set_max_iterations(200);
}
export const solverReady = () => !!gcs;

export interface SolveResult {
  ok: boolean;
  dof: number;
  /** çakışan ilişki/ölçü kimlikleri */
  conflicts: string[];
  redundant: string[];
}

export interface DragTarget {
  pts?: Record<string, [number, number]>;
  radius?: Record<string, number>;
}

type Prim = Record<string, any>;

const ang = (cx: number, cy: number, x: number, y: number) => Math.atan2(y - cy, x - cx);

function entMap(sk: SketchData) {
  const m = new Map<string, SEnt>();
  sk.ents.forEach((e) => m.set(e.id, e));
  return m;
}

/** Eskizi çözücü ilkellerine çevirir */
function primitives(sk: SketchData, drag?: DragTarget): Prim[] {
  const out: Prim[] = [{ id: ORIGIN, type: "point", x: 0, y: 0, fixed: true }];
  for (const [id, p] of Object.entries(sk.pts)) out.push({ id, type: "point", x: p.x, y: p.y, fixed: false });
  const P = (id: string) => (id === ORIGIN ? { x: 0, y: 0 } : sk.pts[id]);
  for (const e of sk.ents) {
    if (e.t === "line") out.push({ id: e.id, type: "line", p1_id: e.p1, p2_id: e.p2 });
    else if (e.t === "circle") out.push({ id: e.id, type: "circle", c_id: e.c, radius: e.r });
    else if (e.t === "arc") {
      const c = P(e.c), s = P(e.s), en = P(e.e);
      let a0 = ang(c.x, c.y, s.x, s.y);
      let a1 = ang(c.x, c.y, en.x, en.y);
      if (a1 <= a0) a1 += Math.PI * 2;
      out.push({ id: e.id, type: "arc", c_id: e.c, radius: e.r, start_angle: a0, end_angle: a1, start_id: e.s, end_id: e.e });
      out.push({ id: e.id + "#rules", type: "arc_rules", a_id: e.id });
    }
  }
  const ents = entMap(sk);
  for (const r of sk.rels) out.push(...relPrims(r, ents, sk));
  for (const d of sk.dims) out.push(...dimPrims(d, ents, sk));
  if (drag?.pts)
    for (const [id, [x, y]] of Object.entries(drag.pts)) {
      out.push({ id: `drag#${id}#x`, type: "coordinate_x", p_id: id, x, temporary: true });
      out.push({ id: `drag#${id}#y`, type: "coordinate_y", p_id: id, y, temporary: true });
    }
  if (drag?.radius)
    for (const [id, r] of Object.entries(drag.radius)) {
      const e = ents.get(id);
      if (e?.t === "circle") out.push({ id: `drag#${id}#r`, type: "circle_radius", c_id: id, radius: r, temporary: true });
      if (e?.t === "arc") out.push({ id: `drag#${id}#r`, type: "arc_radius", a_id: id, radius: r, temporary: true });
    }
  return out;
}

const isCurve = (e?: SEnt) => e?.t === "circle" || e?.t === "arc";
const centerOf = (e: SEnt | undefined, id: string) => (e && (e.t === "circle" || e.t === "arc") ? e.c : id);

function relPrims(r: SRel, ents: Map<string, SEnt>, sk: SketchData): Prim[] {
  const id = r.id;
  const [a, b, c] = r.refs;
  const ea = ents.get(a), eb = ents.get(b);
  switch (r.t) {
    case "coincident":
      return [{ id, type: "p2p_coincident", p1_id: a, p2_id: b }];
    case "onLine":
      return [{ id, type: "point_on_line_pl", p_id: a, l_id: b }];
    case "onCircle":
      return [{ id, type: eb?.t === "arc" ? "point_on_arc" : "point_on_circle", p_id: a, ...(eb?.t === "arc" ? { a_id: b } : { c_id: b }) }];
    case "horizontal":
      return ea?.t === "line" ? [{ id, type: "horizontal_l", l_id: a }] : [{ id, type: "horizontal_pp", p1_id: a, p2_id: b }];
    case "vertical":
      return ea?.t === "line" ? [{ id, type: "vertical_l", l_id: a }] : [{ id, type: "vertical_pp", p1_id: a, p2_id: b }];
    case "parallel":
      return [{ id, type: "parallel", l1_id: a, l2_id: b }];
    case "perpendicular":
      return [{ id, type: "perpendicular_ll", l1_id: a, l2_id: b }];
    case "collinear": {
      const lb = eb as any;
      return [
        { id, type: "parallel", l1_id: a, l2_id: b },
        { id: id + "#2", type: "point_on_line_pl", p_id: lb.p1, l_id: a },
      ];
    }
    case "equal":
      if (ea?.t === "line") return [{ id, type: "equal_length", l1_id: a, l2_id: b }];
      if (ea?.t === "circle" && eb?.t === "circle") return [{ id, type: "equal_radius_cc", c1_id: a, c2_id: b }];
      if (ea?.t === "arc" && eb?.t === "arc") return [{ id, type: "equal_radius_aa", a1_id: a, a2_id: b }];
      if (ea?.t === "circle") return [{ id, type: "equal_radius_ca", c1_id: a, a2_id: b }];
      return [{ id, type: "equal_radius_ca", c1_id: b, a2_id: a }];
    case "tangent": {
      // Uç noktası paylaşan eğriler: FreeCAD gibi nokta üzerinden açı (0 veya π)
      const ends = (e?: SEnt) => (e?.t === "line" ? [e.p1, e.p2] : e?.t === "arc" ? [e.s, e.e] : []);
      const shared = ends(ea).find((p) => ends(eb).includes(p));
      if (shared && ea && eb) {
        const t1 = tangentDir(ea, shared, sk), t2 = tangentDir(eb, shared, sk);
        const angle = t1[0] * t2[0] + t1[1] * t2[1] >= 0 ? 0 : Math.PI;
        return [{ id, type: "angle_via_point", crv1_id: a, crv2_id: b, p_id: shared, angle }];
      }
      let [x, y] = [ea, eb];
      let [xi, yi] = [a, b];
      if (y?.t === "line") [x, y, xi, yi] = [y, x, yi, xi];
      if (x?.t === "line") return [{ id, type: y?.t === "arc" ? "tangent_la" : "tangent_lc", l_id: xi, ...(y?.t === "arc" ? { a_id: yi } : { c_id: yi }) }];
      if (x?.t === "circle" && y?.t === "circle") return [{ id, type: "tangent_cc", c1_id: xi, c2_id: yi }];
      if (x?.t === "arc" && y?.t === "arc") return [{ id, type: "tangent_aa", a1_id: xi, a2_id: yi }];
      if (x?.t === "circle") return [{ id, type: "tangent_ca", c_id: xi, a_id: yi }];
      return [{ id, type: "tangent_ca", c_id: yi, a_id: xi }];
    }
    case "concentric":
      return [{ id, type: "p2p_coincident", p1_id: centerOf(ea, a), p2_id: centerOf(eb, b) }];
    case "midpoint": {
      const l = eb as any;
      return [{ id, type: "p2p_symmetric_ppp", p1_id: l.p1, p2_id: l.p2, p_id: a }];
    }
    case "symmetric":
      return [{ id, type: "p2p_symmetric_ppl", p1_id: a, p2_id: b, l_id: c }];
    case "fix":
      return [
        { id, type: "coordinate_x", p_id: a, x: r.fx ?? 0 },
        { id: id + "#2", type: "coordinate_y", p_id: a, y: r.fy ?? 0 },
      ];
  }
  return [];
}

function dimPrims(d: SDim, ents: Map<string, SEnt>, _sk: SketchData): Prim[] {
  const id = d.id;
  const [a, b] = d.refs;
  const ea = ents.get(a), eb = ents.get(b);
  switch (d.t) {
    case "dist":
      if (d.sub === "h") return [{ id, type: "difference", param1: { o_id: a, prop: "x" }, param2: { o_id: b, prop: "x" }, difference: d.v }];
      if (d.sub === "v") return [{ id, type: "difference", param1: { o_id: a, prop: "y" }, param2: { o_id: b, prop: "y" }, difference: d.v }];
      return [{ id, type: "p2p_distance", p1_id: a, p2_id: b, distance: d.v }];
    case "dia":
      return ea?.t === "arc" ? [{ id, type: "arc_diameter", a_id: a, diameter: d.v }] : [{ id, type: "circle_diameter", c_id: a, diameter: d.v }];
    case "rad":
      return ea?.t === "arc" ? [{ id, type: "arc_radius", a_id: a, radius: d.v }] : [{ id, type: "circle_radius", c_id: a, radius: d.v }];
    case "angle": {
      const rad = (d.v * Math.PI) / 180;
      // açı l1'den l2'ye saat yönü tersine, işareti sgn ile
      const sign = d.sgn ?? 1;
      return [{ id, type: "l2l_angle_ll", l1_id: a, l2_id: b, angle: sign * rad }];
    }
    case "pldist": {
      if (eb?.t === "line" && ea?.t === "line") return [{ id, type: "p2l_distance", p_id: (eb as any).p1, l_id: a, distance: d.v }];
      if (isCurve(ea) && eb?.t === "line") return [{ id, type: "p2l_distance", p_id: (ea as any).c, l_id: b, distance: d.v }];
      return [{ id, type: "p2l_distance", p_id: a, l_id: b, distance: d.v }];
    }
  }
  return [];
}

const baseId = (s: string) => s.split("#")[0];

/** Eğrinin noktadaki teğet yönü (çizgi: p1→p2, yay: saat yönü tersine) */
function tangentDir(e: SEnt, pid: string, sk: SketchData): [number, number] {
  const P = (id: string) => (id === ORIGIN ? { x: 0, y: 0 } : sk.pts[id]);
  if (e.t === "line") {
    const a = P(e.p1), b = P(e.p2);
    return [b.x - a.x, b.y - a.y];
  }
  if (e.t === "arc") {
    const c = P(e.c), q = P(pid);
    return [-(q.y - c.y), q.x - c.x];
  }
  return [1, 0];
}

/** Eskizi çözer; başarılıysa koordinatları yerinde günceller */
export function solve(sk: SketchData, drag?: DragTarget, apply = true): SolveResult {
  if (!gcs) return { ok: true, dof: 0, conflicts: [], redundant: [] };
  gcs.clear_data();
  gcs.push_primitives_and_params(primitives(sk, drag) as any);
  const st = gcs.solve();
  const conflicts = [...new Set(gcs.get_gcs_conflicting_constraints().map(baseId))];
  const redundant = [...new Set(gcs.get_gcs_redundant_constraints().map(baseId))];
  const ok = st === 0 || st === 1;
  if (ok && apply) {
    gcs.apply_solution();
    readBack(sk);
  }
  return { ok, dof: gcs.gcs.dof(), conflicts, redundant };
}

function readBack(sk: SketchData) {
  for (const p of gcs!.sketch_index.get_primitives() as any[]) {
    if (p.type === "point" && p.id !== ORIGIN && sk.pts[p.id]) {
      sk.pts[p.id].x = p.x;
      sk.pts[p.id].y = p.y;
    } else if (p.type === "circle" || p.type === "arc") {
      const e = sk.ents.find((x) => x.id === p.id) as any;
      if (e) e.r = p.radius;
    }
  }
}

/**
 * Hangi noktaların / yarıçapların tam tanımlı olduğunu bulur:
 * her noktayı geçici olarak çekip hareket edip etmediğine bakar.
 */
export function analyze(sk: SketchData, dof: number): { pts: Set<string>; radii: Set<string> } {
  const pts = new Set<string>([ORIGIN]);
  const radii = new Set<string>();
  const allPts = Object.keys(sk.pts);
  const curves = sk.ents.filter((e) => e.t === "circle" || e.t === "arc") as any[];
  if (dof === 0 || !gcs) {
    allPts.forEach((p) => pts.add(p));
    curves.forEach((c) => radii.add(c.id));
    return { pts, radii };
  }
  let scale = 1;
  for (const p of Object.values(sk.pts)) scale = Math.max(scale, Math.abs(p.x), Math.abs(p.y));
  const delta = scale * 0.01 + 0.5;
  const copy: SketchData = JSON.parse(JSON.stringify(sk));
  for (const id of allPts) {
    const p = sk.pts[id];
    gcs.clear_data();
    gcs.push_primitives_and_params(primitives(copy, { pts: { [id]: [p.x + delta, p.y + delta * 0.7] } }) as any);
    gcs.solve();
    gcs.apply_solution();
    const q = (gcs.sketch_index.get_primitives() as any[]).find((x) => x.id === id);
    const moved = q ? Math.hypot(q.x - p.x, q.y - p.y) : 0;
    if (moved < delta * 1e-4) pts.add(id);
  }
  for (const c of curves) {
    gcs.clear_data();
    gcs.push_primitives_and_params(primitives(copy, { radius: { [c.id]: c.r + delta } }) as any);
    gcs.solve();
    gcs.apply_solution();
    const q = (gcs.sketch_index.get_primitives() as any[]).find((x) => x.id === c.id);
    if (q && Math.abs(q.radius - c.r) < delta * 1e-4) radii.add(c.id);
  }
  return { pts, radii };
}

// Eskiz kısıt çözücüsü: FreeCAD PlaneGCS (WebAssembly, LGPL).
import { init_planegcs_module, GcsWrapper } from "@salusoft89/planegcs";
import wasmUrl from "@salusoft89/planegcs/dist/planegcs_dist/planegcs.wasm?url";
import type { SDim, SEnt, SRel, SketchData } from "../doc/types";
import { ORIGIN } from "../doc/types";
import { updateDerived, curveLength } from "./model";

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
  // kısmi elips uçları türetilir: çözücüde sabit
  const slaved = new Set<string>();
  for (const e of sk.ents) if (e.t === "ellipse" && e.s && e.e) [e.s, e.e].forEach((x) => slaved.add(x));
  for (const [id, p] of Object.entries(sk.pts)) out.push({ id, type: "point", x: p.x, y: p.y, fixed: slaved.has(id) });
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
  const seen = new Set<string>();
  for (const r of sk.rels) out.push(...relPrims(r, ents, sk, seen));
  for (const d of sk.dims) if (!d.ref) out.push(...dimPrims(d, ents, sk));
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

/** doğrusal çoğaltma grubunun güncel adım vektörleri [V1x, V1y, V2x, V2y] */
function groupVec(sk: SketchData, g: string, r0: SRel): number[] {
  const v = (r0 as any).pv ? [...(r0 as any).pv] : [0, 0, 0, 0];
  const got = [false, false];
  const PT = (q: string) => (q === ORIGIN ? { x: 0, y: 0 } : sk.pts[q]);
  for (const r of sk.rels) {
    if (r.t !== "lpat" || (r.pg ?? r.id) !== g || !r.pk) continue;
    const [i, j] = r.pk, S = PT(r.refs[0]), Q = PT(r.refs[1]);
    if (!S || !Q) continue;
    if (!j && i && !got[0]) ((v[0] = (Q.x - S.x) / i), (v[1] = (Q.y - S.y) / i), (got[0] = true));
    if (!i && j && !got[1]) ((v[2] = (Q.x - S.x) / j), (v[3] = (Q.y - S.y) / j), (got[1] = true));
  }
  return v;
}

/** ortak serbest parametre (aynı adla bir kez eklenir) */
function sharedParam(seen: Set<string>, name: string, value: number): Prim[] {
  if (seen.has(name)) return [];
  seen.add(name);
  return [{ type: "param", name, value, free: true } as any];
}

function relPrims(r: SRel, ents: Map<string, SEnt>, sk: SketchData, seen: Set<string> = new Set()): Prim[] {
  const id = r.id;
  const PT = (q: string) => (q === ORIGIN ? { x: 0, y: 0 } : sk.pts[q]);
  const [a, b, c] = r.refs;
  const ea = ents.get(a), eb = ents.get(b);
  switch (r.t) {
    case "coincident":
      return [{ id, type: "p2p_coincident", p1_id: a, p2_id: b }];
    case "eqcurve": {
      // ortak serbest parametre L: her iki eğrinin uzunluğu L
      const name = "L_" + id;
      const len = (e: SEnt | undefined, k: string): Prim[] =>
        e?.t === "line" ? [{ id: id + k, type: "p2p_distance", p1_id: e.p1, p2_id: e.p2, distance: name }] : e?.t === "arc" ? [{ id: id + k, type: "arc_length", a_id: e.id, dist: name }] : [];
      return [{ type: "param", name, value: Math.max(1e-6, curveLength(sk, ea)), free: true } as any, ...len(ea, ""), ...len(eb, "#b")];
    }
    case "offset": {
      // E-4: ötelenen her parça tabanından aynı (ortak) mesafede: çizgi = uç noktasının tabana uzaklığı, yay / daire = yarıçap farkı
      const name = "O_" + id;
      const out: Prim[] = [];
      let v0 = 0;
      for (let i = 0; i + 1 < r.refs.length; i += 2) {
        const eo = ents.get(r.refs[i]) as any, en = ents.get(r.refs[i + 1]) as any;
        if (!eo || !en) continue;
        const k = id + "#" + i;
        if (eo.t === "line" && en.t === "line") {
          const A = PT(eo.p1), B = PT(eo.p2), Q = PT(en.p1);
          const L = Math.hypot(B.x - A.x, B.y - A.y) || 1;
          const cr = (B.x - A.x) * (Q.y - A.y) - (B.y - A.y) * (Q.x - A.x);
          v0 ||= Math.abs(cr) / L;
          // işaretli: yardımcı ayak noktası F tabanda, F→Q taban yönüne +/−90° (öteleme karşı tarafa geçemez)
          const ux = (B.x - A.x) / L, uy = (B.y - A.y) / L, t = (Q.x - A.x) * ux + (Q.y - A.y) * uy;
          const F = k + "#F", an = k + "#A";
          out.push({ id: F, type: "point", x: A.x + ux * t, y: A.y + uy * t, fixed: false });
          out.push({ type: "param", name: an, value: Math.atan2(uy, ux), free: true } as any);
          out.push({ id: k + "#ba", type: "p2p_angle", p1_id: eo.p1, p2_id: eo.p2, angle: an });
          out.push({ id: k + "#on", type: "point_on_line_pl", p_id: F, l_id: eo.id });
          out.push({ id: k + "#pa", type: "p2p_angle_incr_angle", p1_id: F, p2_id: en.p1, angle: an, incrAngle: cr >= 0 ? Math.PI / 2 : -Math.PI / 2 });
          out.push({ id: k, type: "p2p_distance", p1_id: F, p2_id: en.p1, distance: name });
        } else if ((eo.t === "arc" || eo.t === "circle") && (en.t === "arc" || en.t === "circle")) {
          v0 ||= Math.abs(en.r - eo.r);
          const big = en.r >= eo.r;
          out.push({ id: k, type: "difference", param1: { o_id: big ? eo.id : en.id, prop: "radius" }, param2: { o_id: big ? en.id : eo.id, prop: "radius" }, difference: name });
        }
      }
      return out.length ? [...sharedParam(seen, name, Math.max(1e-6, v0)), ...out] : [];
    }
    case "lpat": {
      // E-23: örnek = tohum + i·V1 + j·V2 (V1, V2 grubun ortak serbest vektörleri)
      const [i, j] = r.pk ?? [1, 0];
      const g = r.pg ?? id, S = PT(a), Q = PT(b);
      if (!S || !Q) return [];
      const out: Prim[] = [];
      // (proportional kısıtı bu derlemede oranı yok sayıyor) → tohumdan örneğe ara parametrelerle adım adım: i kez V1, j kez V2
      for (const ax of ["x", "y"] as const) {
        const dv = Q[ax] - S[ax];
        // ilk tahmin: grubun tek yönlü örneklerinden (tutarlı başlangıç; yoksa kayıtlı vektör)
        const gv = groupVec(sk, g, r);
        const v1 = ax === "x" ? gv[0] : gv[1], v2 = ax === "x" ? gv[2] : gv[3];
        void dv;
        const steps: string[] = [];
        if (i) out.push(...sharedParam(seen, `V1${ax}_${g}`, v1));
        if (j) out.push(...sharedParam(seen, `V2${ax}_${g}`, v2));
        for (let k = 0; k < i; k++) steps.push(`V1${ax}_${g}`);
        for (let k = 0; k < j; k++) steps.push(`V2${ax}_${g}`);
        let prev: any = { o_id: a, prop: ax }, cur = S[ax];
        steps.forEach((st, k) => {
          const last = k === steps.length - 1;
          cur += st.startsWith("V1") ? v1 : v2;
          const nx: any = last ? { o_id: b, prop: ax } : `T${ax}${k}_${id}`;
          if (!last) out.push({ type: "param", name: nx, value: cur, free: true } as any);
          out.push({ id: `${id}#${ax}${k}`, type: "difference", param1: prev, param2: nx, difference: st });
          prev = nx;
        });
      }
      return out;
    }
    case "cpat": {
      // E-23: örnek noktası merkezden tohumla aynı uzaklıkta ve tohum açısı + artım açısında
      const [cc, sp, qp] = r.refs;
      const C = PT(cc), S = PT(sp);
      if (!C || !S) return [];
      const g = r.pg ?? id;
      const R0 = Math.hypot(S.x - C.x, S.y - C.y);
      const rn = `R_${g}_${sp}`, an = `A_${g}_${sp}`;
      const out: Prim[] = [];
      if (!seen.has(rn)) {
        out.push(...sharedParam(seen, rn, Math.max(1e-6, R0)), ...sharedParam(seen, an, Math.atan2(S.y - C.y, S.x - C.x)));
        out.push({ id: `${id}#sr`, type: "p2p_distance", p1_id: cc, p2_id: sp, distance: rn });
        out.push({ id: `${id}#sa`, type: "p2p_angle", p1_id: cc, p2_id: sp, angle: an });
      }
      out.push({ id: `${id}#r`, type: "p2p_distance", p1_id: cc, p2_id: qp, distance: rn });
      out.push({ id: `${id}#a`, type: "p2p_angle_incr_angle", p1_id: cc, p2_id: qp, angle: an, incrAngle: r.pa ?? 0 });
      return out;
    }
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
    case "alen":
      return [{ id, type: "arc_length", a_id: a, dist: d.v }];
    case "cl": {
      const ca = ea as any;
      if (d.cond === "c") return [{ id, type: "p2l_distance", p_id: ca.c, l_id: b, distance: d.v }];
      if (d.cond === "max") return [{ id, type: "p2l_distance", p_id: ca.c, l_id: b, distance: Math.max(1e-9, d.v - ca.r) }];
      return [{ id, type: "c2ldistance", c_id: a, l_id: b, dist: d.v }];
    }
    case "cc": {
      const c1 = ea as any, c2 = eb as any;
      if (d.cond === "c") return [{ id, type: "p2p_distance", p1_id: c1.c, p2_id: c2.c, distance: d.v }];
      if (d.cond === "max") return [{ id, type: "p2p_distance", p1_id: c1.c, p2_id: c2.c, distance: Math.max(1e-9, d.v - c1.r - c2.r) }];
      return [{ id, type: "c2cdistance", c1_id: a, c2_id: b, dist: d.v }];
    }
    case "pldist": {
      const dv = d.dbl ? d.v / 2 : d.v;
      if (eb?.t === "line" && ea?.t === "line") return [{ id, type: "p2l_distance", p_id: (eb as any).p1, l_id: a, distance: dv }];
      if (isCurve(ea) && eb?.t === "line") return [{ id, type: "p2l_distance", p_id: (ea as any).c, l_id: b, distance: dv }];
      return [{ id, type: "p2l_distance", p_id: a, l_id: b, distance: dv }];
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

/** serbest parametreler (eşit eğri uzunluğu) önce serbest olarak eklenir */
function pushAll(list: Prim[]) {
  const rest: Prim[] = [];
  for (const p of list as any[]) {
    if (p.type === "param" && p.free) gcs!.push_sketch_param(p.name, p.value, false);
    else rest.push(p);
  }
  gcs!.push_primitives_and_params(rest as any);
}

/** Eskizi çözer; başarılıysa koordinatları yerinde günceller */
export function solve(sk: SketchData, drag?: DragTarget, apply = true): SolveResult {
  if (!gcs) return { ok: true, dof: 0, conflicts: [], redundant: [] };
  gcs.clear_data();
  pushAll(primitives(sk, drag));
  const st = gcs.solve();
  const conflicts = [...new Set(gcs.get_gcs_conflicting_constraints().map(baseId))];
  const redundant = [...new Set(gcs.get_gcs_redundant_constraints().map(baseId))];
  const ok = st === 0 || st === 1;
  if (ok && apply) {
    gcs.apply_solution();
    readBack(sk);
    updateDerived(sk);
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
 * her koordinata (ve yarıçapa) kalıcı küçük bir kaydırma kısıtı ekleyip
 * eskizin hâlâ çözülebilir olup olmadığına bakar. Çözülebiliyorsa o değer serbesttir.
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
  const delta = scale * 0.003 + 0.1;
  const base = primitives(sk);
  const movable = (extra: Prim): boolean => {
    gcs!.clear_data();
    pushAll([...base, extra]);
    const st = gcs!.solve();
    if (st !== 0 && st !== 1) return false;
    return gcs!.get_gcs_conflicting_constraints().length === 0 && gcs!.get_gcs_redundant_constraints().every((c: string) => !c.startsWith("probe"));
  };
  const slaved = new Set<string>();
  for (const e of sk.ents) if (e.t === "ellipse" && e.s && e.e) [e.s, e.e].forEach((x) => slaved.add(x));
  for (const id of allPts) {
    if (slaved.has(id)) {
      pts.add(id);
      continue;
    }
    const p = sk.pts[id];
    const fx = movable({ id: "probe", type: "coordinate_x", p_id: id, x: p.x + delta });
    const fy = !fx && movable({ id: "probe", type: "coordinate_y", p_id: id, y: p.y + delta });
    if (!fx && !fy) pts.add(id);
  }
  for (const c of curves) {
    const extra = c.t === "circle" ? { id: "probe", type: "circle_radius", c_id: c.id, radius: c.r + delta } : { id: "probe", type: "arc_radius", a_id: c.id, radius: c.r + delta };
    if (!movable(extra)) radii.add(c.id);
  }
  return { pts, radii };
}

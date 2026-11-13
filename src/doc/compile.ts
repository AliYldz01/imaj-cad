// Belge özelliklerini çekirdeğin anlayacağı çözülmüş tanımlara çevirir.
import type { Feature, Frame, KFeature, KPlane, Loop, PlaneRef, SketchFeature, Vec2, Vec3 } from "./types";
import { AXES, STD_FRAMES, offsetFrame } from "./math";
import { extractLoops, extractPath, extractChains, pointPos, thinRegion, segPoints } from "../sketch/profile";
import { sheetOpenRegion, sheetParamsBefore } from "../sheet/sheet";
import { placedProfile, profileName, PROFILES, type Align, type ProfileStd } from "../weld/profiles";
import type { MemberItem, Sketch3DFeature, CornerKind } from "./types";
import { toWorld, toLocal } from "./math";
import { solve } from "../sketch/solver";

/** Konturun örnek noktaları (içerme testi için) */
export function loopSamples(l: Loop): Vec2[] {
  if ("circle" in l) return Array.from({ length: 24 }, (_, i) => [l.circle.c[0] + l.circle.r * Math.cos((i / 24) * Math.PI * 2), l.circle.c[1] + l.circle.r * Math.sin((i / 24) * Math.PI * 2)] as Vec2);
  if ("ellipse" in l) {
    const { c, rx, ry, rot } = l.ellipse;
    const cr = Math.cos((rot * Math.PI) / 180), sr = Math.sin((rot * Math.PI) / 180);
    return Array.from({ length: 24 }, (_, i) => {
      const a = (i / 24) * Math.PI * 2, x = rx * Math.cos(a), y = ry * Math.sin(a);
      return [c[0] + x * cr - y * sr, c[1] + x * sr + y * cr] as Vec2;
    });
  }
  return l.segs.flatMap((sg) => segPoints(sg, 8).slice(0, -1));
}
function inPoly(p: Vec2, poly: Vec2[]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++)
    if (poly[i][1] > p[1] !== poly[j][1] > p[1] && p[0] < ((poly[j][0] - poly[i][0]) * (p[1] - poly[i][1])) / (poly[j][1] - poly[i][1]) + poly[i][0]) c = !c;
  return c;
}
/** Bölgeler: çift derinlikli (dış) konturlar; her bölge doğrudan içindeki delikleri de kapsar */
export function contourRegions(loops: Loop[]): number[][] {
  const out: number[][] = [];
  const pts = loops.map(loopSamples);
  loops.forEach((l, i) => {
    if (l.depth % 2) return;
    const reg = [i];
    loops.forEach((h, j) => {
      if (h.depth === l.depth + 1 && inPoly(pts[j][0], pts[i])) reg.push(j);
    });
    out.push(reg);
  });
  return out;
}
/** Seçili konturlar: verilen bölge indekslerindeki konturları döndür */
export function selectContours(loops: Loop[], sel?: number[]): Loop[] {
  if (!sel?.length) return loops;
  const regs = contourRegions(loops);
  const keep = new Set(sel.flatMap((r) => regs[r] ?? []));
  const out = loops.filter((_, i) => keep.has(i)).map((l) => ({ ...l, depth: l.depth % 2 }));
  if (!out.length) throw new Error("Seçili kontur bulunamadı");
  return out;
}

export function resolveFrame(ref: PlaneRef, feats: Feature[]): Frame | null {
  if (ref.k === "std") return STD_FRAMES[ref.n];
  if (ref.k === "face") return ref.frame;
  const pf = feats.find((f) => f.id === ref.id);
  if (!pf || pf.type !== "plane") return null;
  return planeFrame(pf, feats);
}

const V = {
  sub: (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  add: (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  mul: (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  norm: (a: Vec3): Vec3 => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  },
};
/** Referans düzlem çerçevesi (SolidWorks düzlem türleri) */
export function planeFrame(pf: Extract<Feature, { type: "plane" }>, feats: Feature[]): Frame | null {
  const mode = pf.mode ?? "offset";
  const flipF = (f: Frame): Frame => (pf.flip ? { o: f.o, n: V.mul(f.n, -1), x: V.mul(f.x, -1) } : f);
  const xFor = (n: Vec3, pref?: Vec3): Vec3 => {
    let x = pref ? V.sub(pref, V.mul(n, V.dot(pref, n))) : V.cross([0, 1, 0], n);
    if (Math.hypot(...x) < 1e-6) x = V.cross([0, 0, 1], n);
    if (Math.hypot(...x) < 1e-6) x = [1, 0, 0];
    return V.norm(x);
  };
  if (mode === "offset") {
    const base = resolveFrame(pf.base, feats);
    return base ? offsetFrame(base, pf.offset, pf.flip) : null;
  }
  if (mode === "angle") {
    const base = resolveFrame(pf.base, feats);
    if (!base || !pf.edge) return null;
    const k = V.norm(pf.edge.d), a = ((pf.angle ?? 45) * Math.PI) / 180;
    // Rodrigues: tabanın normalini kenar ekseni etrafında döndür
    const v = base.n, c = Math.cos(a), s = Math.sin(a);
    const n = V.norm(V.add(V.add(V.mul(v, c), V.mul(V.cross(k, v), s)), V.mul(k, V.dot(k, v) * (1 - c))));
    return flipF({ o: pf.edge.m, n, x: k });
  }
  if (mode === "mid") {
    const A = resolveFrame(pf.base, feats), B = pf.base2 && resolveFrame(pf.base2, feats);
    if (!A || !B) return null;
    const nb = V.dot(A.n, B.n) < 0 ? V.mul(B.n, -1) : B.n;
    const n = V.norm(V.add(A.n, nb));
    const o = V.mul(V.add(A.o, V.add(B.o, V.mul(nb, 0))), 0.5);
    // paralel düzlemlerde: A.o'yu iki düzlemin ortasına taşı
    const dB = V.dot(V.sub(B.o, A.o), n);
    const oo = Math.abs(Math.abs(V.dot(A.n, nb)) - 1) < 1e-6 ? V.add(A.o, V.mul(n, dB / 2)) : o;
    return flipF({ o: oo, n, x: xFor(n, A.x) });
  }
  const pts = pf.pts ?? [];
  if (mode === "3pt") {
    if (pts.length < 3) return null;
    const n = V.norm(V.cross(V.sub(pts[1], pts[0]), V.sub(pts[2], pts[0])));
    if (!isFinite(n[0]) || Math.hypot(...V.cross(V.sub(pts[1], pts[0]), V.sub(pts[2], pts[0]))) < 1e-9) return null;
    return flipF({ o: pts[0], n, x: V.norm(V.sub(pts[1], pts[0])) });
  }
  if (mode === "normal") {
    if (!pf.edge || !pts.length) return null;
    const n = V.norm(pf.edge.d);
    return flipF({ o: pts[0], n, x: xFor(n) });
  }
  if (mode === "parallelPt") {
    const base = resolveFrame(pf.base, feats);
    if (!base || !pts.length) return null;
    return flipF({ o: pts[0], n: base.n, x: base.x });
  }
  if (mode === "screen") {
    if (!pts.length || !pf.nv) return null;
    const n = V.norm(pf.nv);
    return flipF({ o: V.add(pts[0], V.mul(n, pf.offset || 0)), n, x: xFor(n) });
  }
  return null;
}

/** Doğrusal çoğaltma "eskizi değiştir": tek ekstrüzyonun eskizini her örnek için ötele (sabit / orijine bağlı noktalar hariç),
 *  yeniden çöz ve eskiz + ekstrüzyon kopyası olarak çoğaltma özelliğinin yerine ekle (kimlik "çoğaltma~i_j") */
function expandVary(feats: Feature[], errors: Map<string, string>): Feature[] {
  if (!feats.some((f) => f.type === "lpattern" && f.vary && !f.off)) return feats;
  const out: Feature[] = [];
  for (const f of feats) {
    out.push(f);
    if (f.type !== "lpattern" || !f.vary || f.off) continue;
    try {
      const seed = feats.find((x) => x.id === f.feats[0]);
      if (f.feats.length !== 1 || !seed || seed.type !== "extrude") throw new Error("Eskizi değiştir yalnız tek bir ekstrüzyon / kesme ile çalışır");
      const sk = feats.find((x) => x.id === seed.sketch) as SketchFeature | undefined;
      if (!sk) throw new Error("Eskiz bulunamadı");
      const pl = kplane(sk.plane, feats, sk.id);
      if (!pl) throw new Error("Eskiz düzlemi bulunamadı");
      const fr = pl.frame, yv: Vec3 = [fr.n[1] * fr.x[2] - fr.n[2] * fr.x[1], fr.n[2] * fr.x[0] - fr.n[0] * fr.x[2], fr.n[0] * fr.x[1] - fr.n[1] * fr.x[0]];
      const ax = (a: "x" | "y" | "z", rev: boolean): Vec3 => AXES[a].map((c) => (rev ? -c : c)) as Vec3;
      const dirs = [{ v: ax(f.axis, f.rev), count: f.count, spacing: f.spacing }];
      if (f.dir2) dirs.push({ v: ax(f.axis2, f.rev2), count: f.count2, spacing: f.spacing2 });
      const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      for (const d of dirs) if (Math.abs(dot(d.v, fr.n)) > 1e-6) throw new Error("Eskizi değiştir: çoğaltma yönü eskiz düzleminde olmalı");
      const fixed = new Set<string>(sk.data.rels.filter((r) => r.t === "fix").map((r) => r.refs[0]));
      const d2 = dirs[1] ?? { v: [0, 0, 0] as Vec3, count: 1, spacing: 0 };
      for (let i = 0; i < Math.max(1, dirs[0].count); i++)
        for (let j = 0; j < Math.max(1, d2.count); j++) {
          if (!i && !j) continue;
          if (f.skip?.includes(`${i + 1},${j + 1}`) || (!j && f.skip?.includes(`${i + 1}`))) continue;
          const w: Vec3 = [0, 1, 2].map((k) => dirs[0].v[k] * i * dirs[0].spacing + d2.v[k] * j * d2.spacing) as Vec3;
          const dx = dot(w, fr.x), dy = dot(w, yv);
          const data = JSON.parse(JSON.stringify(sk.data));
          const P0 = (id: string): [number, number] => (id === "O" ? [0, 0] : [sk.data.pts[id]?.x ?? 0, sk.data.pts[id]?.y ?? 0]);
          for (const [id, p] of Object.entries(data.pts) as [string, { x: number; y: number }][]) if (!fixed.has(id)) (p.x += dx), (p.y += dy);
          // sabit geometriden (orijin / sabit nokta) ölçülen konum ölçüleri örnek ötelemesi kadar artar (SolidWorks: çoğaltma yönündeki ölçü sürülür)
          const isFix = (id: string) => id === "O" || fixed.has(id);
          for (const dm of data.dims as any[]) {
            if (dm.t !== "dist" || dm.ref || dm.refs.length !== 2 || !sk.data.pts[dm.refs.find((r: string) => r !== "O") ?? ""]) continue;
            const [a, b2] = dm.refs as string[];
            if (isFix(a) === isFix(b2)) continue;
            const [fx, mv] = isFix(a) ? [a, b2] : [b2, a];
            const A = P0(fx), B = P0(mv), B2: [number, number] = [B[0] + dx, B[1] + dy];
            if (dm.sub === "h") dm.v = Math.abs(B2[0] - A[0]);
            else if (dm.sub === "v") dm.v = Math.abs(B2[1] - A[1]);
            else dm.v = Math.hypot(B2[0] - A[0], B2[1] - A[1]);
          }
          // sürülen (referans) olmayan ölçüler korunur; sabit geometriye bağlı olanlar çözücüyle uyum sağlar
          const r = solve(data);
          if (!r.ok) throw new Error(`Eskizi değiştir: ${i + 1},${j + 1}. örnekte eskiz çözülemedi`);
          const sid = `${f.id}~s${i}_${j}`;
          out.push({ ...(sk as any), id: sid, name: `${sk.name} (${i + 1},${j + 1})`, data } as SketchFeature);
          out.push({ ...(seed as any), id: `${f.id}~${i}_${j}`, name: `${seed.name} (${i + 1},${j + 1})`, sketch: sid });
        }
    } catch (e) {
      errors.set(f.id, (e as Error).message);
    }
  }
  return out;
}

function kplane(ref: PlaneRef, feats: Feature[], sketchId?: string): KPlane | null {
  const frame = resolveFrame(ref, feats);
  if (!frame) return null;
  return ref.k === "face" && ref.face ? { frame, face: ref.face, sketchId } : { frame, sketchId };
}

export function compile(feats0: Feature[], profiles: Record<string, { name: string; loops: Loop[] }> = {}): { kfeats: KFeature[]; errors: Map<string, string> } {
  const kfeats: KFeature[] = [];
  const errors = new Map<string, string>();
  const feats = expandVary(feats0, errors);
  const sketchOf = (id: string) => feats.find((f) => f.id === id && f.type === "sketch") as SketchFeature | undefined;
  const profileOf = (id: string) => {
    const sk = sketchOf(id);
    if (!sk) throw new Error("Eskiz bulunamadı");
    const pl = kplane(sk.plane, feats, sk.id);
    if (!pl) throw new Error("Eskiz düzlemi bulunamadı");
    const { loops, texts, error } = extractLoops(sk.data);
    if (error) throw new Error(`${sk.name}: ${error}`);
    if (!loops.length && !texts.length) throw new Error(`${sk.name}: kapalı kontur yok`);
    return { sk, pl, loops, texts };
  };
  /** İnce özellik: açık veya kapalı konturdan kalınlıklı bölge */
  const thinOf = (id: string, t: number, mode: "one" | "rev" | "mid") => {
    const sk = sketchOf(id);
    if (!sk) throw new Error("Eskiz bulunamadı");
    const pl = kplane(sk.plane, feats, sk.id);
    if (!pl) throw new Error("Eskiz düzlemi bulunamadı");
    const { chains, error } = extractChains(sk.data);
    if (error) throw new Error(`${sk.name}: ${error}`);
    if (!chains.length) throw new Error(`${sk.name}: eskiz boş`);
    if (!(t > 0)) throw new Error("İnce özellik kalınlığı sıfırdan büyük olmalı");
    return { sk, pl, loops: thinRegion(chains, t, mode) };
  };

  for (const f of feats) {
    if (f.off) continue;
    try {
      switch (f.type) {
        case "sketch3d":
          break;
        case "combine":
          if (!f.main || !f.tools.length) throw new Error("Ana gövdeyi ve araç gövde(ler)ini seçin");
          kfeats.push({ id: f.id, type: "combine", op: f.op, main: f.main, tools: f.tools });
          break;
        case "splitbody": {
          if (!f.body) throw new Error("Bölünecek gövdeyi seçin");
          const frame = resolveFrame(f.plane, feats);
          if (!frame) throw new Error("Bölme düzlemi bulunamadı");
          kfeats.push({ id: f.id, type: "splitbody", body: f.body, frame });
          break;
        }
        case "movebody":
          if (!f.body) throw new Error("Taşınacak gövdeyi seçin");
          kfeats.push({ id: f.id, type: "movebody", body: f.body, copy: f.copy, d: f.d, axis: AXES[f.axis], angle: f.angle });
          break;
        case "delbody":
          if (!f.bodies.length) throw new Error("Gövde seçin");
          kfeats.push({ id: f.id, type: "delbody", bodies: f.bodies, keep: f.keep });
          break;
        case "indent":
          if (!f.target || !f.tool) throw new Error("Hedef gövdeyi ve girinti aracını seçin");
          kfeats.push({ id: f.id, type: "indent", target: f.target, tool: f.tool, clearance: f.clearance, keepTool: f.keepTool });
          break;
        case "spattern": {
          if (!f.feats.length) throw new Error("Çoğaltılacak özelliği seçin");
          const sk = sketchOf(f.sketch);
          if (!sk) throw new Error("Nokta eskizini seçin");
          const fr = resolveFrame(sk.plane, feats);
          if (!fr) throw new Error("Eskiz düzlemi bulunamadı");
          let ids = sk.data.ents.filter((e) => e.t === "point").map((e) => (e as any).p as string);
          if (!ids.length) ids = [...new Set(sk.data.ents.filter((e) => e.t === "line" && !e.cons).flatMap((e: any) => [e.p1, e.p2]))];
          if (!ids.length) throw new Error(`${sk.name}: eskizde nokta yok`);
          kfeats.push({ id: f.id, type: "spattern", feats: f.feats, pts: ids.map((id) => toWorld(fr, pointPos(sk.data, id))), n: fr.n });
          break;
        }
        case "tpattern":
          if (!f.feats.length) throw new Error("Çoğaltılacak özelliği seçin");
          kfeats.push({ id: f.id, type: "tpattern", feats: f.feats, rows: f.rows });
          break;
        case "cvpattern": {
          if (!f.feats.length) throw new Error("Çoğaltılacak özelliği seçin");
          const sk = sketchOf(f.sketch);
          if (!sk) throw new Error("Eğri eskizini seçin");
          const fr = resolveFrame(sk.plane, feats);
          if (!fr) throw new Error("Eskiz düzlemi bulunamadı");
          const path = extractPath(sk.data);
          if (path.error) throw new Error(`${sk.name}: ${path.error}`);
          const pts: Vec3[] = [];
          path.segs.forEach((sg, i) => segPoints(sg, 24).slice(i ? 1 : 0).forEach((q) => pts.push(toWorld(fr, q))));
          kfeats.push({ id: f.id, type: "cvpattern", feats: f.feats, path: pts, n: fr.n, count: f.count, spacing: f.spacing, equal: f.equal, align: f.align });
          break;
        }
        case "fpattern":
          if (!f.feats.length) throw new Error("Çoğaltılacak özelliği seçin");
          if (!f.face) throw new Error("Doldurulacak düz yüzü seçin");
          if (!(f.spacing > 0)) throw new Error("Aralık sıfırdan büyük olmalı");
          kfeats.push({ id: f.id, type: "fpattern", feats: f.feats, face: f.face, spacing: f.spacing, layout: f.layout, margin: f.margin, angle: f.angle });
          break;
        case "thread":
          if (!f.face) throw new Error("Diş açılacak silindirik yüzü seçin");
          if (!(f.pitch > 0)) throw new Error("Hatve sıfırdan büyük olmalı");
          kfeats.push({ id: f.id, type: "thread", face: f.face, pitch: f.pitch, length: f.length, left: f.left, fromEnd: f.fromEnd, cos: f.cos });
          break;
        case "flex":
          if (!f.body) throw new Error("Esnetilecek gövdeyi seçin");
          kfeats.push({ id: f.id, type: "flex", body: f.body, mode: f.mode, axis: AXES[f.axis], value: f.value, dir: AXES[f.dir] });
          break;
        case "vchamfer":
          if (!f.v) throw new Error("Köşeyi seçin (kenarın ucuna yakın dokunun)");
          if (!(f.d > 0)) throw new Error("Mesafe sıfırdan büyük olmalı");
          kfeats.push({ id: f.id, type: "vchamfer", v: f.v, d: f.d });
          break;
        case "sketch":
        case "plane":
          if (!resolveFrame(f.type === "sketch" ? f.plane : f.base, feats)) throw new Error("Düzlem referansı bulunamadı");
          break;
        case "extrude": {
          const pr0 = f.thin ? { ...thinOf(f.sketch, f.thinT ?? 2, f.thinMode ?? "one"), texts: [] } : profileOf(f.sketch);
          const pr = { ...pr0, loops: selectContours(pr0.loops, f.contours) };
          kfeats.push({ id: f.id, type: "extrude", fromFace: f.fromFace, fromVtx: f.fromVtx, vtx: f.vtx, bodyRef: f.bodyRef, dirVec: f.dirVec, flipCut: f.flipCut, startOff: f.startOff, cut: f.cut, pl: pr.pl, loops: pr.loops, texts: pr.texts, end: f.end, d1: f.d1, rev: f.rev, dir2: f.dir2, end2: f.end2, d2: f.d2, face: f.face, offd: f.offd, draft: f.draft, draftOut: f.draftOut, twist: f.twist, merge: f.merge });
          break;
        }
        case "revolve": {
          const r0 = f.thin ? thinOf(f.sketch, f.thinT ?? 2, f.thinMode ?? "one") : profileOf(f.sketch);
          const { sk, pl } = r0;
          const loops = selectContours(r0.loops, f.contours);
          const ax = sk.data.ents.find((e) => e.id === f.axis);
          if (!ax || ax.t !== "line") throw new Error("Döndürme ekseni seçin (eskizde bir merkez çizgisi çizin)");
          kfeats.push({ id: f.id, type: "revolve", cut: f.cut, pl, loops, axis: [pointPos(sk.data, ax.p1), pointPos(sk.data, ax.p2)], angle: f.angle, mid: f.mid, rev: f.rev, merge: f.merge });
          break;
        }
        case "sweep": {
          const { pl, loops } = (f.circ && f.circ > 0) || f.tool ? { pl: null, loops: [] } : profileOf(f.sketch);
          const ps = sketchOf(f.path);
          if (!ps) throw new Error("Yol eskizini seçin");
          const ppl = kplane(ps.plane, feats, ps.id);
          if (!ppl) throw new Error("Yol eskizinin düzlemi bulunamadı");
          if (f.helix) {
            const ci = ps.data.ents.find((e: any) => e.t === "circle" && !e.cons) as any;
            if (!ci) throw new Error(`${ps.name}: helis için eskizde bir daire olmalı (taban çapı)`);
            kfeats.push({ id: f.id, type: "sweep", cut: f.cut, pl, loops, path: { pl: ppl, segs: [], closed: false }, circ: f.circ, circIn: f.circIn, orient: f.orient, helix: { ...f.helix, c: pointPos(ps.data, ci.c), r: ci.r } });
            break;
          }
          const path = extractPath(ps.data);
          if (path.error) throw new Error(`${ps.name}: ${path.error}`);
          let guide: { pl: KPlane; segs: any[]; closed: boolean } | undefined;
          if (f.guide) {
            const gs = sketchOf(f.guide);
            const gpl = gs && kplane(gs.plane, feats, gs.id);
            const gp = gs && extractPath(gs.data);
            if (!gs || !gpl || !gp || gp.error) throw new Error("Kılavuz eğri eskizi okunamadı");
            guide = { pl: gpl, segs: gp.segs, closed: gp.closed };
          }
          if (f.tool) {
            kfeats.push({ id: f.id, type: "sweep", cut: true, pl: null, loops: [], path: { pl: ppl, segs: path.segs, closed: path.closed }, tool: f.tool });
            break;
          }
          kfeats.push({ id: f.id, type: "sweep", cut: f.cut, pl, loops, path: { pl: ppl, segs: path.segs, closed: path.closed }, circ: f.circ, circIn: f.circIn, orient: f.orient, twist: f.twist, guide });
          break;
        }
        case "loft": {
          const profiles = f.sketches.map((id) => {
            const { pl, loops } = profileOf(id);
            return { pl, loops };
          });
          let center: { pl: KPlane; segs: any[]; closed: boolean } | undefined;
          if (f.center) {
            const cs = sketchOf(f.center);
            if (!cs) throw new Error("Merkez çizgisi eskizi bulunamadı");
            const cpl = kplane(cs.plane, feats, cs.id);
            const path = extractPath(cs.data);
            if (path.error || !cpl) throw new Error(`${cs.name}: ${path.error ?? "düzlem yok"}`);
            center = { pl: cpl, segs: path.segs, closed: path.closed };
          }
          let guides: Vec3[][] | undefined;
          if (f.guides?.length) {
            guides = f.guides.map((gid) => {
              const gs = sketchOf(gid);
              if (!gs) throw new Error("Kılavuz eğri eskizi bulunamadı");
              const gfr = resolveFrame(gs.plane, feats);
              const path = extractPath(gs.data);
              if (path.error || !gfr) throw new Error(`${gs.name}: ${path.error ?? "düzlem yok"}`);
              const pts: Vec3[] = [];
              path.segs.forEach((sg, i) => segPoints(sg, 24).slice(i ? 1 : 0).forEach((q) => pts.push(toWorld(gfr, q))));
              return pts;
            });
          }
          kfeats.push({ id: f.id, type: "loft", sheetT: f.sheetT, cut: f.cut, ruled: f.ruled, profiles, center, guides, tanStart: (f as any).tanStart, tanEnd: (f as any).tanEnd, conn: f.conn, faceStart: f.faceStart, faceEnd: f.faceEnd });
          break;
        }
        case "rib": {
          const sk = sketchOf(f.sketch);
          if (!sk) throw new Error("Kaburga eskizini seçin");
          const pl = kplane(sk.plane, feats, sk.id);
          if (!pl) throw new Error("Eskiz düzlemi bulunamadı");
          const { chains, error } = extractChains(sk.data);
          if (error) throw new Error(`${sk.name}: ${error}`);
          const open = chains.filter((c) => !c.closed);
          if (open.length !== 1) throw new Error("Kaburga eskizi tek bir açık zincir (ör. bir çizgi) olmalı");
          kfeats.push({ id: f.id, type: "rib", pl, chain: open[0].segs, normal: f.dir === "normal", flip: f.flip, t: f.t, side: f.side });
          break;
        }
        case "sheetbase": {
          const sk = sketchOf(f.sketch);
          if (!sk) throw new Error("Taban flanş eskizini seçin");
          const pl = kplane(sk.plane, feats, sk.id);
          if (!pl) throw new Error("Eskiz düzlemi bulunamadı");
          if (!(f.t > 0)) throw new Error("Sac kalınlığı sıfırdan büyük olmalı");
          const { chains, error } = extractChains(sk.data);
          if (error) throw new Error(`${sk.name}: ${error}`);
          if (!chains.length) throw new Error(`${sk.name}: eskiz boş`);
          const open = chains.filter((c) => !c.closed);
          if (open.length) {
            if (open.length > 1 || chains.length > 1) throw new Error("Açık profilli taban flanş tek bir açık zincir olmalı");
            if (!(f.d > 0)) throw new Error("Derinlik sıfırdan büyük olmalı");
            kfeats.push({ id: f.id, type: "sheetbase", pl, loops: sheetOpenRegion(open[0].segs, f.t, f.r, f.rev), open: true, t: f.t, rev: f.rev, d: f.d, mid: f.mid });
          } else {
            const { loops } = profileOf(f.sketch);
            kfeats.push({ id: f.id, type: "sheetbase", pl, loops, open: false, t: f.t, rev: f.rev, d: f.d, mid: f.mid });
          }
          break;
        }
        case "edgeflange":
        case "hem": {
          const sp = sheetParamsBefore(feats, f.id);
          if (!sp) throw new Error("Önce bir taban flanş oluşturun");
          if (!f.edges.length) throw new Error("Flanş eklenecek kenar(lar)ı seçin");
          if (f.type === "edgeflange") {
            if (!(f.L > 0)) throw new Error("Flanş uzunluğu sıfırdan büyük olmalı");
            if (!(f.angle > 0 && f.angle <= 180)) throw new Error("Büküm açısı 0–180° arasında olmalı");
            const r = f.useDef ? sp.r : f.r;
            kfeats.push({ id: f.id, type: "edgeflange", edges: f.edges, L: f.L, angle: f.angle, pos: f.pos, lenRef: f.lenRef, flip: f.flip, r, t: sp.t, o1: f.o1, o2: f.o2, gap: f.gap, relief: sp.relief, tp1: f.tp1, tp2: f.tp2 });
          } else {
            if (!(f.L > 0)) throw new Error("Kenet uzunluğu sıfırdan büyük olmalı");
            const r = f.kind === "open" ? Math.max(0.05, f.gap / 2) : 0.05;
            kfeats.push({ id: f.id, type: "edgeflange", edges: f.edges, L: f.L, angle: 180, pos: f.pos, lenRef: "tangent", flip: f.flip, r, t: sp.t, o1: 0, o2: 0, gap: 0, relief: sp.relief });
          }
          break;
        }
        case "member": {
          if (!f.segs.length && !(f.groups ?? []).some((g) => g.segs.length)) throw new Error("İskelet eskizinden en az bir segment seçin");
          // profil çözümü (özellik ya da grup kendi profili)
          const prof = (pstd: string, psize: string) => {
            let custom: Loop[] | undefined, cname = "";
            if (pstd === "sketch") {
              const ps = sketchOf(psize);
              if (!ps) throw new Error("Profil eskizi bulunamadı");
              const { loops, error } = extractLoops(ps.data);
              if (error || !loops.length) throw new Error(`${ps.name}: profil için kapalı kontur gerekir`);
              custom = loops;
              cname = ps.name;
            } else if (pstd === "custom") {
              const cp = profiles[psize];
              if (!cp) throw new Error("Özel profil belgede bulunamadı");
              custom = cp.loops;
              cname = cp.name;
            } else if (!PROFILES[pstd as ProfileStd]) throw new Error("Profil türü bulunamadı");
            return { std: pstd as ProfileStd, size: psize, custom, name: custom ? cname : profileName(pstd as ProfileStd, psize) };
          };
          const P0 = prof(f.std, f.size);
          // SolidWorks grupları: 1. grup = özelliğin kendi alanları, sonra f.groups
          const groups = [{ segs: f.segs, align: f.align, mirror: f.mirror, rot: f.rot, poff: f.poff, corner: f.corner, gap: f.gap, alignAx: f.alignAx, alignTo: f.alignTo, prio: f.prio }, ...(f.groups ?? [])];
          const items: MemberItem[] = [];
          const gl: { loops: Loop[]; R: number; corner: CornerKind; gap: number; auto?: boolean; prio?: number; name?: string }[] = [];
          let gi = 0;
          let pr0: ReturnType<typeof placedProfile> | null = null;
          groups.forEach((G, gk) => {
          const PG = (G as any).std && (G as any).size ? prof((G as any).std!, (G as any).size!) : P0;
          const pr = placedProfile(PG.std, PG.size, G.align as Align, G.mirror, G.rot, PG.custom, G.poff);
          pr0 ??= pr;
          gl.push({ loops: pr.loops, R: pr.R, corner: G.corner, gap: G.gap, auto: !G.rot && !G.mirror && !G.alignTo, prio: G.prio, name: PG.name });
          const gItems: MemberItem[] = [];
          // 3B eskiz çizgileri: köşe yarıçapı varsa çizgi–yay–çizgi zincirine çevrilir
          const s3: { f: Sketch3DFeature; lines: { a: Vec3; b: Vec3; key: string }[] }[] = [];
          G.segs.forEach((sg) => {
            const key = `${f.id}:${gi++}`;
            const any = feats.find((x) => x.id === sg.sk);
            if (any && any.type === "sketch3d") {
              const P = (id: string) => {
                const k = any.ids.indexOf(id);
                if (k < 0) throw new Error(`${any.name}: nokta bulunamadı`);
                return any.xyz[k];
              };
              const arc = any.arcs3?.find((q) => q.id === sg.ent);
              if (arc) {
                // 3B yay: üç noktalı yay öğesi (profil dikey ekseni = yay düzlemi normali, yukarı)
                const A = P(arc.a), M = P(arc.m), B = P(arc.b);
                let bn = n3(v3.cross(v3.sub(M, A), v3.sub(B, A)));
                if (bn[1] < -1e-9 || (Math.abs(bn[1]) < 1e-9 && bn[2] < 0)) bn = v3.mul(bn, -1);
                return void gItems.push({ k: "a", a: A, b: B, m: M, n: bn, key });
              }
              const ln = any.lines.find((l) => l.id === sg.ent);
              if (!ln) throw new Error(`${any.name}: seçili çizgi silinmiş`);
              let g = s3.find((x) => x.f === any);
              if (!g) s3.push((g = { f: any, lines: [] }));
              g.lines.push({ a: P(ln.a), b: P(ln.b), key });
              return;
            }
            const sk = sketchOf(sg.sk);
            if (!sk) throw new Error("İskelet eskizi bulunamadı");
            const fr = resolveFrame(sk.plane, feats);
            if (!fr) throw new Error("Eskiz düzlemi bulunamadı");
            const e = sk.data.ents.find((x) => x.id === sg.ent);
            if (!e) throw new Error(`${sk.name}: seçili segment silinmiş`);
            const W = (p: [number, number]) => toWorld(fr, p);
            if (e.t === "line") return void gItems.push({ k: "l", a: W(pointPos(sk.data, e.p1)), b: W(pointPos(sk.data, e.p2)), n: fr.n, key });
            if (e.t === "arc") {
              const c = pointPos(sk.data, e.c), a = pointPos(sk.data, e.s), b = pointPos(sk.data, e.e);
              const a0 = Math.atan2(a[1] - c[1], a[0] - c[0]);
              let a1 = Math.atan2(b[1] - c[1], b[0] - c[0]);
              if (a1 <= a0) a1 += 2 * Math.PI;
              const r = Math.hypot(a[0] - c[0], a[1] - c[1]);
              const am = (a0 + a1) / 2;
              return void gItems.push({ k: "a", a: W(a), b: W(b), m: W([c[0] + r * Math.cos(am), c[1] + r * Math.sin(am)]), n: fr.n, key });
            }
            throw new Error("Yapı elemanı yalnızca çizgi ve yay segmentleri boyunca oluşturulabilir");
          });
          for (const g of s3) gItems.push(...sketch3dItems(g.lines, g.f.r, f.ori !== 2));
          // Alignment: profilin yatay (h) / dikey (v) eksenini seçilen yöne hizala
          if (G.alignTo && f.ori === 2) {
            const t = n3(G.alignTo);
            for (const it of gItems) {
              const d = n3(v3.sub(it.b, it.a));
              const a = v3.sub(t, v3.mul(d, v3.dot(t, d)));
              if (v3.len(a) < 1e-6) continue;
              it.n = G.alignAx === "h" ? n3(v3.cross(d, a)) : n3(a);
            }
          }
          for (const it of gItems) items.push({ ...it, g: gk });
          });
          const pr = pr0!;
          kfeats.push({ id: f.id, type: "member", items, loops: pr.loops, name: P0.name, R: pr.R, corner: f.corner, gap: f.gap, ori: f.ori, auto: gl[0].auto, tp: f.trimPrev !== false, ...(groups.length > 1 ? { gl } : {}), cornerOv: (f as any).cornerOv } as any);
          break;
        }
        case "trim": {
          if (!f.targets.length) throw new Error("Kırpılacak elemanları seçin");
          if (!f.bounds.length && !f.faces?.length) throw new Error("Sınır elemanlarını veya sınır yüzünü seçin");
          kfeats.push({ id: f.id, type: "trim", targets: f.targets.map((r) => `${r.f}:${r.i}`), bounds: f.bounds.map((r) => `${r.f}:${r.i}`), coped: f.coped, faces: f.faces });
          break;
        }
        case "weld":
          if (!f.pairs.length) throw new Error("Kaynak yapılacak yüz çiftlerini seçin");
          if (!(f.a > 0)) throw new Error("Kaynak kalınlığı sıfırdan büyük olmalı");
          if (f.intermittent && !(f.len > 0 && f.pitch >= f.len)) throw new Error("Kesikli kaynakta adım, dikiş boyundan küçük olamaz");
          kfeats.push({ id: f.id, type: "weld", pairs: f.pairs, a: f.a, intermittent: f.intermittent, len: f.len, pitch: f.pitch });
          break;
        case "endcap":
          if (!f.faces.length) throw new Error("Elemanın uç yüzünü seçin");
          if (!(f.t > 0)) throw new Error("Kalınlık sıfırdan büyük olmalı");
          kfeats.push({ id: f.id, type: "endcap", faces: f.faces, t: f.t, inset: f.inset });
          break;
        case "gusset":
          if (!f.f1 || !f.f2) throw new Error("Birbirine dik iki düz yüz seçin");
          if (!(f.t > 0 && f.d1 > 0 && f.d2 > 0)) throw new Error("Ölçüler sıfırdan büyük olmalı");
          kfeats.push({ id: f.id, type: "gusset", f1: f.f1, f2: f.f2, d1: f.d1, d2: f.d2, t: f.t, chamfer: f.chamfer, offset: f.offset });
          break;
        case "sheetjog": {
          const sp = sheetParamsBefore(feats, f.id);
          if (!sp) throw new Error("Önce bir taban flanş oluşturun");
          const sk = sketchOf(f.sketch);
          if (!sk || sk.plane.k !== "face") throw new Error("Kademe çizgisi sacın düz yüzündeki bir eskizde olmalı");
          const pl = kplane(sk.plane, feats, sk.id);
          if (!pl) throw new Error("Eskiz düzlemi bulunamadı");
          const lines = sk.data.ents.filter((e) => e.t === "line" && !e.cons) as any[];
          if (lines.length !== 1) throw new Error("Eskizde tek bir kademe çizgisi olmalı");
          if (!(f.H > 0)) throw new Error("Kademe yüksekliği sıfırdan büyük olmalı");
          kfeats.push({ id: f.id, type: "sheetjog", pl, line: [pointPos(sk.data, lines[0].p1), pointPos(sk.data, lines[0].p2)], H: f.H, side: f.side, flip: f.flip, r: f.useDef ? sp.r : f.r, t: sp.t });
          break;
        }
        case "miterflange": {
          const sp = sheetParamsBefore(feats, f.id);
          if (!sp) throw new Error("Önce bir taban flanş oluşturun");
          if (!f.edges.length) throw new Error("Gönye flanşın ilerleyeceği kenarları seçin");
          const sk = sketchOf(f.sketch);
          if (!sk) throw new Error("Flanş profili eskizini seçin");
          const fr = resolveFrame(sk.plane, feats);
          if (!fr) throw new Error("Eskiz düzlemi bulunamadı");
          const { chains, error } = extractChains(sk.data);
          if (error) throw new Error(`${sk.name}: ${error}`);
          const open = chains.filter((c) => !c.closed);
          if (open.length !== 1) throw new Error("Profil eskizi tek bir açık zincir olmalı (ör. L profili)");
          kfeats.push({ id: f.id, type: "miterflange", skFrame: fr, chain: open[0].segs, edges: f.edges, t: sp.t, r: sp.r, gap: f.gap, rev: f.rev });
          break;
        }
        case "closecorner": {
          const sp = sheetParamsBefore(feats, f.id);
          if (!sp) throw new Error("Önce bir taban flanş oluşturun");
          if (!f.faces.length) throw new Error("Uzatılacak flanş uç yüzlerini seçin");
          kfeats.push({ id: f.id, type: "closecorner", faces: f.faces, overlap: f.overlap, gap: f.gap, t: sp.t, r: sp.r });
          break;
        }
        case "tosheet":
          if (!f.bends.length) throw new Error("Büküm olacak dış kenarları seçin");
          if (!(f.t > 0)) throw new Error("Sac kalınlığı sıfırdan büyük olmalı");
          kfeats.push({ id: f.id, type: "tosheet", bends: f.bends, rips: f.rips, t: f.t, r: f.r, gap: f.gap });
          break;
        case "sketchbend": {
          const sp = sheetParamsBefore(feats, f.id);
          if (!sp) throw new Error("Önce bir taban flanş oluşturun");
          const sk = sketchOf(f.sketch);
          if (!sk) throw new Error("Büküm çizgisi eskizini seçin");
          const pl = kplane(sk.plane, feats, sk.id);
          if (!pl) throw new Error("Eskiz düzlemi bulunamadı");
          if (sk.plane.k !== "face") throw new Error("Büküm çizgisi eskizi sacın düz yüzüne çizilmeli");
          const lines = sk.data.ents.filter((e) => e.t === "line" && !e.cons);
          if (lines.length !== 1) throw new Error("Eskizde tek bir büküm çizgisi olmalı");
          const ln = lines[0] as Extract<typeof lines[0], { t: "line" }>;
          if (!(f.angle > 0 && f.angle <= 180)) throw new Error("Büküm açısı 0–180° arasında olmalı");
          kfeats.push({ id: f.id, type: "sketchbend", pl, line: [pointPos(sk.data, ln.p1), pointPos(sk.data, ln.p2)], angle: f.angle, side: f.side, flip: f.flip, pos: f.pos, r: f.useDef ? sp.r : f.r, t: sp.t, k: sp.k });
          break;
        }
        case "flatcut": {
          const sp = sheetParamsBefore(feats, f.id);
          if (!sp) throw new Error("Önce bir taban flanş oluşturun");
          const sk = sketchOf(f.sketch);
          if (!sk || sk.plane.k !== "face") throw new Error("Kesim eskizi sacın düz yüzüne çizilmeli");
          const { pl, loops } = profileOf(f.sketch);
          kfeats.push({ id: f.id, type: "flatcut", pl, loops, t: sp.t, k: sp.k });
          break;
        }
        case "dome":
          if (!f.face) throw new Error("Kubbe yapılacak düz yüzü seçin");
          kfeats.push({ id: f.id, type: "dome", face: f.face, h: f.h });
          break;
        case "wrap": {
          if (!f.face) throw new Error("Silindirik yüzü seçin");
          const { pl, loops, texts } = profileOf(f.sketch);
          kfeats.push({ id: f.id, type: "wrap", pl, loops, texts, face: f.face, mode: f.mode, depth: f.depth });
          break;
        }
        case "scale":
          kfeats.push({ id: f.id, type: "scale", factor: f.factor, center: f.center });
          break;
        case "import":
          kfeats.push({ id: f.id, type: "import", data: f.data, fmt: f.fmt });
          break;
        case "axis":
        case "point":
        case "csys":
          break;
        case "hole": {
          if (!f.plane) throw new Error("Deliğin açılacağı yüzü seçin");
          const pl = kplane(f.plane, feats);
          if (!pl) throw new Error("Yüz bulunamadı");
          let pts = f.pts;
          if (f.sketch) {
            const sf = feats.find((x) => x.id === f.sketch) as SketchFeature | undefined;
            const fr = sf && resolveFrame(sf.plane, feats);
            if (!sf || !fr) throw new Error("Delik konum eskizi bulunamadı");
            pts = sf.data.ents.filter((e: any) => e.t === "point" && !e.cons).map((e: any) => toLocal(pl.frame, toWorld(fr, pointPos(sf.data, e.p))));
            if (!pts.length) throw new Error("Konum eskizinde nokta yok");
          }
          kfeats.push({ id: f.id, type: "hole", pl, pts, htype: f.htype, d: f.d, depth: f.depth, through: f.through, cd: f.cd, cdepth: f.cdepth, cangle: f.cangle, slot: f.slot, slotAng: f.slotAng, nearCs: f.nearCs, farCs: f.farCs });
          break;
        }
        case "draft": {
          const frame = resolveFrame(f.plane, feats);
          if (!frame) throw new Error("Nötr düzlem bulunamadı");
          kfeats.push({ id: f.id, type: "draft", angle: f.angle, frame, faces: f.faces, rev: f.rev, mode: f.mode, edges: f.edges, other: f.other });
          break;
        }
        case "fillet":
          kfeats.push({ id: f.id, type: "fillet", r: f.r, edges: f.edges, faces: f.faces, kind: f.kind, r2: f.r2, radii: f.radii, faces2: f.faces2 });
          break;
        case "chamfer":
          kfeats.push({ id: f.id, type: "chamfer", d: f.d, edges: f.edges, faces: f.faces, kind: f.kind, d2: f.d2, d3: f.d3, angle: f.angle, flip: f.flip, faces2: f.faces2, verts: f.verts });
          break;
        case "surface": {
          const sec = (id: string) => {
            const s2 = sketchOf(id);
            if (!s2) throw new Error("Eskiz bulunamadı");
            const pl2 = kplane(s2.plane, feats, s2.id);
            if (!pl2) throw new Error("Eskiz düzlemi bulunamadı");
            const lp = extractLoops(s2.data).loops;
            if (lp.length) return { pl: pl2, loops: lp.slice(0, 1), path: null };
            const p = extractPath(s2.data);
            if (p.error) throw new Error(`${s2.name}: ${p.error}`);
            return { pl: pl2, loops: [], path: { segs: p.segs, closed: p.closed } };
          };
          if (f.mode === "loft") {
            if ((f.sketches ?? []).length < 2) throw new Error("Yüzey loft için en az iki kesit eskizi seçin");
            const secs = f.sketches!.map(sec);
            if (new Set(secs.map((x) => !!x.path && !x.path.closed)).size > 1) throw new Error("Kesitlerin hepsi açık ya da hepsi kapalı olmalı");
            kfeats.push({ id: f.id, type: "surface", mode: "loft", pl: null, loops: [], path: null, d: 0, secs });
            break;
          }
          if (f.mode === "fill") {
            if ((f.edges ?? []).length < 1) throw new Error("Doldurulacak sınırın kenarlarını seçin");
            kfeats.push({ id: f.id, type: "surface", mode: "fill", pl: null, loops: [], path: null, d: 0, edges: f.edges });
            break;
          }
          const sk = sketchOf(f.sketch);
          if (!sk) throw new Error("Eskiz seçin");
          const pl = kplane(sk.plane, feats, sk.id);
          if (!pl) throw new Error("Eskiz düzlemi bulunamadı");
          const { loops } = extractLoops(sk.data);
          let path: { segs: any[]; closed: boolean } | null = null;
          if (!loops.length) {
            const p = extractPath(sk.data);
            if (p.error) throw new Error(`${sk.name}: ${p.error}`);
            path = { segs: p.segs, closed: p.closed };
          }
          if (f.mode === "planar" && !loops.length) throw new Error("Düzlemsel yüzey için kapalı kontur gerekir");
          kfeats.push({ id: f.id, type: "surface", mode: f.mode, pl, loops, path, d: f.d, mid: f.mid });
          break;
        }
        case "thicken":
        case "surfcut":
          if (!f.surf) throw new Error("Yüzey özelliğini seçin");
          kfeats.push({ id: f.id, type: f.type, surf: f.surf, t: f.t, side: f.side });
          break;
        case "surftrim": {
          if (!f.surf) throw new Error("Kırpılacak yüzeyi seçin");
          if (!f.tool) throw new Error("Kırpma aracını (düzlem ya da yüzey) seçin");
          const std = f.tool.startsWith("std:") ? kplane({ k: "std", n: f.tool.slice(4) } as any, feats, f.id) : undefined;
          kfeats.push({ id: f.id, type: "surftrim", surf: f.surf, tool: std ? undefined : f.tool, tpl: std ?? undefined, side: f.side });
          break;
        }
        case "knit":
          if ((f.surfs ?? []).length < 1) throw new Error("Dikilecek yüzeyleri seçin");
          kfeats.push({ id: f.id, type: "knit", surfs: f.surfs!, solid: !!f.solid });
          break;
        case "dface":
          kfeats.push({ id: f.id, type: "dface", mode: f.mode, d: f.d, faces: f.faces });
          break;
        case "shell":
          kfeats.push({ id: f.id, type: "shell", t: f.t, faces: f.faces, out: f.out, multi: f.multi });
          break;
        case "lpattern": {
          const v = (a: "x" | "y" | "z", rev: boolean): Vec3 => AXES[a].map((c) => (rev ? -c : c)) as Vec3;
          if (f.vary) break; // eskizi değiştir: örnekler expandVary ile ayrı ekstrüzyonlar olarak eklendi
          const dirs: { v: Vec3; count: number; spacing: number; upTo?: Vec3; upOff?: number; upMode?: "count" | "spacing" }[] = [{ v: v(f.axis, f.rev), count: f.count, spacing: f.spacing, ...(f.upTo ? { upTo: f.upTo, upOff: f.upOff ?? 0, upMode: f.upMode ?? "count" } : {}) }];
          if (f.dir2) dirs.push({ v: v(f.axis2, f.rev2), count: f.count2, spacing: f.spacing2 });
          kfeats.push({ id: f.id, type: "lpattern", feats: f.feats, dirs, skip: f.skip });
          break;
        }
        case "cpattern": {
          const step = f.equal ? (Math.abs(f.angle - 360) < 1e-6 ? 360 / f.count : f.angle / Math.max(1, f.count - 1)) : f.angle;
          const ra = f.refAxis ? feats.find((x) => x.id === f.refAxis) : null;
          if (ra && ra.type === "axis") kfeats.push({ id: f.id, type: "cpattern", feats: f.feats, axis: ra.d, origin: ra.p, count: f.count, angle: step, skip: f.skip });
          else kfeats.push({ id: f.id, type: "cpattern", feats: f.feats, axis: AXES[f.axis], count: f.count, angle: step, skip: f.skip });
          break;
        }
        case "mirror": {
          const frame = resolveFrame(f.plane, feats);
          if (!frame) throw new Error("Ayna düzlemi bulunamadı");
          kfeats.push({ id: f.id, type: "mirror", feats: f.feats, body: f.body, frame, ...(f.only ? { only: true } : {}) });
          break;
        }
      }
    } catch (e) {
      errors.set(f.id, (e as Error).message);
    }
  }
  // eskizi değiştir örneklerinin hataları çoğaltma özelliğine yazılır
  for (const [k, m] of [...errors]) if (k.includes("~")) (errors.delete(k), errors.has(k.split("~")[0]) || errors.set(k.split("~")[0], m));
  return { kfeats, errors };
}

const v3 = {
  sub: (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  add: (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  mul: (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a: Vec3) => Math.hypot(a[0], a[1], a[2]),
};
const n3 = (a: Vec3): Vec3 => v3.mul(a, 1 / (v3.len(a) || 1));
/** 3B çizgi için profil yönü: profil yüksekliği mümkünse dünya düşeyine (Y) yakın */
/** 3B eskiz çizgisinde profilin dikey ekseni: dünya yukarısı (Y) çizgiye dik izdüşümü; düşey çizgide +Z */
function sketch3dNormal(d: Vec3, legacy = false): Vec3 {
  const up: Vec3 = Math.abs(d[1]) > 0.999 ? [0, 0, 1] : [0, 1, 0];
  if (legacy) return n3(v3.cross(up, d));
  return n3(v3.sub(up, v3.mul(d, v3.dot(up, d))));
}
/** 3B eskiz çizgileri: ikiden fazla çizginin buluşmadığı köşeler r yarıçapıyla yuvarlatılır */
export function sketch3dItems(lines: { a: Vec3; b: Vec3; key: string }[], r: number, legacy = false): MemberItem[] {
  const L = lines.map((l) => ({ ...l }));
  const out: MemberItem[] = [];
  if (r > 1e-9) {
    const kk = (p: Vec3) => p.map((v) => Math.round(v * 1000)).join(",");
    const joints = new Map<string, { i: number; end: 0 | 1 }[]>();
    lines.forEach((l, i) => ([l.a, l.b] as Vec3[]).forEach((p, e) => {
      const k = kk(p);
      if (!joints.has(k)) joints.set(k, []);
      joints.get(k)!.push({ i, end: e as 0 | 1 });
    }));
    for (const list of joints.values()) {
      if (list.length !== 2) continue;
      const [A, B] = list;
      const V = A.end === 0 ? lines[A.i].a : lines[A.i].b;
      const ua = n3(v3.sub(A.end === 0 ? lines[A.i].b : lines[A.i].a, V));
      const ub = n3(v3.sub(B.end === 0 ? lines[B.i].b : lines[B.i].a, V));
      const cos = Math.max(-1, Math.min(1, v3.dot(ua, ub)));
      const th = Math.acos(cos);
      if (th > Math.PI - 1e-4 || th < 1e-4) continue;
      const T = r / Math.tan(th / 2);
      const la = v3.len(v3.sub(lines[A.i].b, lines[A.i].a)), lb = v3.len(v3.sub(lines[B.i].b, lines[B.i].a));
      if (T > la / 2 + 1e-6 || T > lb / 2 + 1e-6) throw new Error("3B eskiz köşe yarıçapı için çizgiler çok kısa");
      const PA = v3.add(V, v3.mul(ua, T)), PB = v3.add(V, v3.mul(ub, T));
      const bis = n3(v3.add(ua, ub));
      const C = v3.add(V, v3.mul(bis, r / Math.sin(th / 2)));
      const M = v3.sub(C, v3.mul(bis, r));
      if (A.end === 0) L[A.i].a = PA; else L[A.i].b = PA;
      if (B.end === 0) L[B.i].a = PB; else L[B.i].b = PB;
      let bn = n3(v3.cross(ua, ub));
      if (!legacy && bn[1] < -1e-9 || (Math.abs(bn[1]) < 1e-9 && bn[2] < 0)) bn = v3.mul(bn, -1);
      out.push({ k: "a", a: PA, b: PB, m: M, n: bn, key: `${lines[A.i].key}~${lines[B.i].key}` });
    }
  }
  return [...L.map((l) => ({ k: "l" as const, a: l.a, b: l.b, n: sketch3dNormal(n3(v3.sub(l.b, l.a)), legacy), key: l.key })), ...out];
}

/** Bir eskizin hangi özellik(ler) tarafından kullanıldığı */
export function sketchUsers(feats: Feature[], sketchId: string): Feature[] {
  return feats.filter(
    (f) =>
      ((f.type === "extrude" || f.type === "revolve" || f.type === "sweep") && (f.sketch === sketchId || (f.type === "sweep" && f.path === sketchId))) ||
      (f.type === "loft" && (f.sketches.includes(sketchId) || f.center === sketchId)) ||
      ((f.type === "rib" || f.type === "wrap" || f.type === "sheetbase" || f.type === "sketchbend" || f.type === "flatcut") && f.sketch === sketchId) ||
      (f.type === "member" && ([...f.segs, ...(f.groups ?? []).flatMap((g) => g.segs)].some((s) => s.sk === sketchId) || (f.std === "sketch" && f.size === sketchId))) ||
      ((f.type === "spattern" || f.type === "cvpattern" || f.type === "sheetjog" || f.type === "miterflange") && f.sketch === sketchId),
  );
}

// Belge özelliklerini çekirdeğin anlayacağı çözülmüş tanımlara çevirir.
import type { Feature, Frame, KFeature, KPlane, PlaneRef, SketchFeature, Vec3 } from "./types";
import { AXES, STD_FRAMES, offsetFrame } from "./math";
import { extractLoops, extractPath, pointPos } from "../sketch/profile";

export function resolveFrame(ref: PlaneRef, feats: Feature[]): Frame | null {
  if (ref.k === "std") return STD_FRAMES[ref.n];
  if (ref.k === "face") return ref.frame;
  const pf = feats.find((f) => f.id === ref.id);
  if (!pf || pf.type !== "plane") return null;
  const base = resolveFrame(pf.base, feats);
  return base ? offsetFrame(base, pf.offset, pf.flip) : null;
}

function kplane(ref: PlaneRef, feats: Feature[], sketchId?: string): KPlane | null {
  const frame = resolveFrame(ref, feats);
  if (!frame) return null;
  return ref.k === "face" && ref.face ? { frame, face: ref.face, sketchId } : { frame, sketchId };
}

export function compile(feats: Feature[]): { kfeats: KFeature[]; errors: Map<string, string> } {
  const kfeats: KFeature[] = [];
  const errors = new Map<string, string>();
  const sketchOf = (id: string) => feats.find((f) => f.id === id && f.type === "sketch") as SketchFeature | undefined;
  const profileOf = (id: string) => {
    const sk = sketchOf(id);
    if (!sk) throw new Error("Eskiz bulunamadı");
    const pl = kplane(sk.plane, feats, sk.id);
    if (!pl) throw new Error("Eskiz düzlemi bulunamadı");
    const { loops, error } = extractLoops(sk.data);
    if (error) throw new Error(`${sk.name}: ${error}`);
    if (!loops.length) throw new Error(`${sk.name}: kapalı kontur yok`);
    return { sk, pl, loops };
  };

  for (const f of feats) {
    if (f.off) continue;
    try {
      switch (f.type) {
        case "sketch":
        case "plane":
          if (!resolveFrame(f.type === "sketch" ? f.plane : f.base, feats)) throw new Error("Düzlem referansı bulunamadı");
          break;
        case "extrude": {
          const { pl, loops } = profileOf(f.sketch);
          kfeats.push({ id: f.id, type: "extrude", cut: f.cut, pl, loops, end: f.end, d1: f.d1, rev: f.rev, dir2: f.dir2, end2: f.end2, d2: f.d2, face: f.face, offd: f.offd, draft: f.draft, draftOut: f.draftOut });
          break;
        }
        case "revolve": {
          const { sk, pl, loops } = profileOf(f.sketch);
          const ax = sk.data.ents.find((e) => e.id === f.axis);
          if (!ax || ax.t !== "line") throw new Error("Döndürme ekseni seçin (eskizde bir merkez çizgisi çizin)");
          kfeats.push({ id: f.id, type: "revolve", cut: f.cut, pl, loops, axis: [pointPos(sk.data, ax.p1), pointPos(sk.data, ax.p2)], angle: f.angle, mid: f.mid, rev: f.rev });
          break;
        }
        case "sweep": {
          const { pl, loops } = profileOf(f.sketch);
          const ps = sketchOf(f.path);
          if (!ps) throw new Error("Yol eskizini seçin");
          const ppl = kplane(ps.plane, feats, ps.id);
          if (!ppl) throw new Error("Yol eskizinin düzlemi bulunamadı");
          const path = extractPath(ps.data);
          if (path.error) throw new Error(`${ps.name}: ${path.error}`);
          kfeats.push({ id: f.id, type: "sweep", cut: f.cut, pl, loops, path: { pl: ppl, segs: path.segs, closed: path.closed } });
          break;
        }
        case "loft": {
          const profiles = f.sketches.map((id) => {
            const { pl, loops } = profileOf(id);
            return { pl, loops };
          });
          kfeats.push({ id: f.id, type: "loft", cut: f.cut, ruled: f.ruled, profiles });
          break;
        }
        case "hole": {
          if (!f.plane) throw new Error("Deliğin açılacağı yüzü seçin");
          const pl = kplane(f.plane, feats);
          if (!pl) throw new Error("Yüz bulunamadı");
          kfeats.push({ id: f.id, type: "hole", pl, pts: f.pts, htype: f.htype, d: f.d, depth: f.depth, through: f.through, cd: f.cd, cdepth: f.cdepth, cangle: f.cangle });
          break;
        }
        case "draft": {
          const frame = resolveFrame(f.plane, feats);
          if (!frame) throw new Error("Nötr düzlem bulunamadı");
          kfeats.push({ id: f.id, type: "draft", angle: f.angle, frame, faces: f.faces, rev: f.rev });
          break;
        }
        case "fillet":
          kfeats.push({ id: f.id, type: "fillet", r: f.r, edges: f.edges, faces: f.faces });
          break;
        case "chamfer":
          kfeats.push({ id: f.id, type: "chamfer", d: f.d, edges: f.edges, faces: f.faces });
          break;
        case "shell":
          kfeats.push({ id: f.id, type: "shell", t: f.t, faces: f.faces });
          break;
        case "lpattern": {
          const v = (a: "x" | "y" | "z", rev: boolean): Vec3 => AXES[a].map((c) => (rev ? -c : c)) as Vec3;
          const dirs = [{ v: v(f.axis, f.rev), count: f.count, spacing: f.spacing }];
          if (f.dir2) dirs.push({ v: v(f.axis2, f.rev2), count: f.count2, spacing: f.spacing2 });
          kfeats.push({ id: f.id, type: "lpattern", feats: f.feats, dirs });
          break;
        }
        case "cpattern": {
          const step = f.equal ? (Math.abs(f.angle - 360) < 1e-6 ? 360 / f.count : f.angle / Math.max(1, f.count - 1)) : f.angle;
          kfeats.push({ id: f.id, type: "cpattern", feats: f.feats, axis: AXES[f.axis], count: f.count, angle: step });
          break;
        }
        case "mirror": {
          const frame = resolveFrame(f.plane, feats);
          if (!frame) throw new Error("Ayna düzlemi bulunamadı");
          kfeats.push({ id: f.id, type: "mirror", feats: f.feats, body: f.body, frame });
          break;
        }
      }
    } catch (e) {
      errors.set(f.id, (e as Error).message);
    }
  }
  return { kfeats, errors };
}

/** Bir eskizin hangi özellik(ler) tarafından kullanıldığı */
export function sketchUsers(feats: Feature[], sketchId: string): Feature[] {
  return feats.filter(
    (f) =>
      ((f.type === "extrude" || f.type === "revolve" || f.type === "sweep") && (f.sketch === sketchId || (f.type === "sweep" && f.path === sketchId))) ||
      (f.type === "loft" && f.sketches.includes(sketchId)),
  );
}

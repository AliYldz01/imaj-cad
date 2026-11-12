// Belge özelliklerini çekirdeğin anlayacağı çözülmüş tanımlara çevirir.
import type { Feature, Frame, KFeature, KPlane, PlaneRef, SketchFeature, Vec3 } from "./types";
import { AXES, STD_FRAMES, offsetFrame } from "./math";
import { extractLoops, extractPath, extractChains, pointPos, thinRegion } from "../sketch/profile";
import { sheetOpenRegion, sheetParamsBefore } from "../sheet/sheet";

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
        case "sketch":
        case "plane":
          if (!resolveFrame(f.type === "sketch" ? f.plane : f.base, feats)) throw new Error("Düzlem referansı bulunamadı");
          break;
        case "extrude": {
          const pr = f.thin ? { ...thinOf(f.sketch, f.thinT ?? 2, f.thinMode ?? "one"), texts: [] } : profileOf(f.sketch);
          kfeats.push({ id: f.id, type: "extrude", cut: f.cut, pl: pr.pl, loops: pr.loops, texts: pr.texts, end: f.end, d1: f.d1, rev: f.rev, dir2: f.dir2, end2: f.end2, d2: f.d2, face: f.face, offd: f.offd, draft: f.draft, draftOut: f.draftOut, twist: f.twist, merge: f.merge });
          break;
        }
        case "revolve": {
          const { sk, pl, loops } = f.thin ? thinOf(f.sketch, f.thinT ?? 2, f.thinMode ?? "one") : profileOf(f.sketch);
          const ax = sk.data.ents.find((e) => e.id === f.axis);
          if (!ax || ax.t !== "line") throw new Error("Döndürme ekseni seçin (eskizde bir merkez çizgisi çizin)");
          kfeats.push({ id: f.id, type: "revolve", cut: f.cut, pl, loops, axis: [pointPos(sk.data, ax.p1), pointPos(sk.data, ax.p2)], angle: f.angle, mid: f.mid, rev: f.rev, merge: f.merge });
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
          let center: { pl: KPlane; segs: any[]; closed: boolean } | undefined;
          if (f.center) {
            const cs = sketchOf(f.center);
            if (!cs) throw new Error("Merkez çizgisi eskizi bulunamadı");
            const cpl = kplane(cs.plane, feats, cs.id);
            const path = extractPath(cs.data);
            if (path.error || !cpl) throw new Error(`${cs.name}: ${path.error ?? "düzlem yok"}`);
            center = { pl: cpl, segs: path.segs, closed: path.closed };
          }
          kfeats.push({ id: f.id, type: "loft", cut: f.cut, ruled: f.ruled, profiles, center });
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
            kfeats.push({ id: f.id, type: "edgeflange", edges: f.edges, L: f.L, angle: f.angle, pos: f.pos, lenRef: f.lenRef, flip: f.flip, r, t: sp.t, o1: f.o1, o2: f.o2, gap: f.gap, relief: sp.relief });
          } else {
            if (!(f.L > 0)) throw new Error("Kenet uzunluğu sıfırdan büyük olmalı");
            const r = f.kind === "open" ? Math.max(0.05, f.gap / 2) : 0.05;
            kfeats.push({ id: f.id, type: "edgeflange", edges: f.edges, L: f.L, angle: 180, pos: f.pos, lenRef: "tangent", flip: f.flip, r, t: sp.t, o1: 0, o2: 0, gap: 0, relief: sp.relief });
          }
          break;
        }
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
          kfeats.push({ id: f.id, type: "import", data: f.data });
          break;
        case "axis":
        case "point":
        case "csys":
          break;
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
          kfeats.push({ id: f.id, type: "fillet", r: f.r, edges: f.edges, faces: f.faces, kind: f.kind, r2: f.r2 });
          break;
        case "chamfer":
          kfeats.push({ id: f.id, type: "chamfer", d: f.d, edges: f.edges, faces: f.faces, kind: f.kind, d2: f.d2, angle: f.angle, flip: f.flip });
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
          const ra = f.refAxis ? feats.find((x) => x.id === f.refAxis) : null;
          if (ra && ra.type === "axis") kfeats.push({ id: f.id, type: "cpattern", feats: f.feats, axis: ra.d, origin: ra.p, count: f.count, angle: step });
          else kfeats.push({ id: f.id, type: "cpattern", feats: f.feats, axis: AXES[f.axis], count: f.count, angle: step });
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
      (f.type === "loft" && (f.sketches.includes(sketchId) || f.center === sketchId)) ||
      ((f.type === "rib" || f.type === "wrap" || f.type === "sheetbase" || f.type === "sketchbend") && f.sketch === sketchId),
  );
}

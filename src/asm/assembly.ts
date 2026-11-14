// Montaj: bileşenler, eşleşmeler (SolidWorks standart eşleşmeleri), konum çözücü, serbestlik, malzeme listesi.
import * as THREE from "three";
import type { Feature, MeshData, Vec3 } from "../doc/types";

export interface AsmPart { name: string; features: Feature[]; eqs?: any; profiles?: any; /** malzeme anahtarı (MATERIALS) */ material?: string; /** parça değişkenleri, yapılandırmaları ve etkin yapılandırması */ vars?: Record<string, string>; configs?: { name: string; vars: Record<string, string>; off: string[] }[]; config?: string; /** parça kimliği: aynı parçanın örnekleri ve parça dosyasıyla bağ */ key?: string }
export interface AsmComp {
  id: string;
  name: string;
  part: AsmPart;
  /** dönüş (dörtlük x,y,z,w) ve konum */
  q: [number, number, number, number];
  p: Vec3;
  fixed: boolean;
  hidden?: boolean;
  /** desen örneği: { desen kimliği, tohum, örnek sırası } (konumu desenden hesaplanır) */
  pat?: { id: string; seed: string; k: number };
  /** bastırılmış (SolidWorks): çizilmez, çözücüye / malzeme listesine / girişime / kütleye / STEP'e girmez */
  sup?: boolean;
  transparent?: boolean;
  /** başvurulan yapılandırma (yoksa parçanın etkin yapılandırması) */
  cfg?: string;
}
/** eşleşme varlığı: bileşen yerel koordinatlarında düz yüz veya silindir */
/** eşleşme varlığı (bileşen yerel koordinatlarında): düz yüz, silindir ekseni, doğrusal kenar, dairesel kenar, köşe noktası */
export interface MateEnt { comp: string; kind: "plane" | "cyl" | "line" | "circle" | "point"; c: Vec3; n: Vec3; r?: number; label?: string }
export type MateType =
  | "coincident" | "parallel" | "perpendicular" | "distance" | "angle" | "concentric" | "lock" | "tangent"
  | "limit" | "limitAngle" | "symmetric" | "width"
  | "profileCenter" | "gear" | "rack" | "screw" | "coupler" | "hinge" | "universal"
  | "path" | "cam" | "slot";
export interface Mate {
  id: string;
  type: MateType;
  a: MateEnt;
  b: MateEnt;
  /** ek seçimler: simetri düzlemi / sekme yüzleri / menteşe çakışık yüzleri */
  c?: MateEnt;
  d?: MateEnt;
  v?: number;
  vmax?: number;
  /** hizalama: true = hizalı (aynı yön), yoksa ters hizalı; mekanik eşleşmelerde ters çevir */
  flip?: boolean;
  /** mesafe yönünü çevir */
  flipD?: boolean;
  off?: boolean;
  /** kilit / mekanik eşleşmeler için oluşturulduğu andaki konumlar */
  ref?: { pa: number[]; qa: number[]; pb: number[]; qb: number[] };
  /** dönme ölçeği (mm) */
  L?: number;
  /** açı limiti (menteşe) */
  lim?: boolean;
  /** alt montajın iç eşleşmesi (alt montaj rijitken devre dışı) */
  sub?: string;
  /** yol / kam / yuva: b bileşeninin yerel koordinatlarında kenar zinciri, kapalı mı, düzlem normali, yuva orta çizgisi */
  poly?: Vec3[];
  closed?: boolean;
  pn?: Vec3;
  seg?: [Vec3, Vec3];
}
/** alt montaj: üyeleri birlikte (rijit) veya kendi eşleşmeleriyle (esnek) hareket eder */
export interface SubAsm { id: string; name: string; comps: string[]; rigid: boolean; poses: Record<string, { p: Vec3; q: [number, number, number, number] }> }
/** patlatılmış görünüm adımı (SolidWorks Patlatma adımı) */
export interface ExplodeStep { id: string; comps: string[]; dir: Vec3; d: number }
/** montaj özelliği (SolidWorks montaj kesmesi / deliği): yalnız montajda, seçili bileşenleri keser */
export interface AsmFeat {
  id: string;
  type: "hole" | "cut";
  name: string;
  /** dünya çerçevesi: başlangıç noktası, x ekseni, yüz normali (dışa) */
  o: Vec3;
  x: Vec3;
  n: Vec3;
  /** çerçevede konumlar (mm) */
  pts: [number, number][];
  d: number;
  w: number;
  h: number;
  through: boolean;
  depth: number;
  comps: string[];
  off?: boolean;
}
/** desen güdümlü bileşen çoğaltma (SolidWorks): tohum bileşenler, sürücü bileşenin parçasındaki çoğaltma özelliğini izler */
/** desen güdümlü (drv + feat) ya da D9-14: montajın kendi doğrusal / dairesel bileşen çoğaltması (own) */
export interface DrivenPattern { id: string; seeds: string[]; drv: string; feat: string; own?: { kind: string; ax: string; n: number; d: number; ang: number; n2: number; d2: number; ax2: string } }
export interface AsmDoc { kind: "asm"; name: string; comps: AsmComp[]; mates: Mate[]; explode?: number; steps?: ExplodeStep[]; exploded?: boolean; subs?: SubAsm[]; feats?: AsmFeat[]; pdp?: DrivenPattern[]; /** D9-23: montaj resmi açıklamaları / sürüklemeleri (parça resmi gibi) */ drawing?: import("../doc/types").PartDoc["drawing"] }
/** montajın kendi ana düzlemleri / orijini için sanal bileşen kimliği */
export const ASM_ID = "__asm";

export const MATE_NAMES: Record<MateType, string> = {
  coincident: "Çakışık",
  path: "Yol",
  cam: "Kam",
  slot: "Yuva",
  parallel: "Paralel",
  perpendicular: "Dik",
  distance: "Mesafe",
  angle: "Açı",
  concentric: "Eş merkezli",
  lock: "Kilit",
  tangent: "Teğet",
  limit: "Limit mesafe",
  limitAngle: "Limit açı",
  symmetric: "Simetrik",
  width: "Genişlik",
  gear: "Dişli",
  rack: "Kremayer–pinyon",
  screw: "Vida",
  coupler: "Doğrusal bağlayıcı",
  hinge: "Menteşe",
  profileCenter: "Profil merkezi",
  universal: "Üniversal mafsal",
};
export const MATE_GROUPS: Record<"std" | "adv" | "mech", MateType[]> = {
  std: ["coincident", "parallel", "perpendicular", "tangent", "concentric", "lock", "distance", "angle"],
  adv: ["profileCenter", "symmetric", "width", "path", "limit", "limitAngle", "coupler"],
  mech: ["cam", "slot", "hinge", "gear", "rack", "screw", "universal"],
};

export const newAsm = (): AsmDoc => ({ kind: "asm", name: "Montaj1", comps: [], mates: [] });

const V = (a: Vec3) => new THREE.Vector3(a[0], a[1], a[2]);
const Q = (c: AsmComp) => new THREE.Quaternion(c.q[0], c.q[1], c.q[2], c.q[3]);

/** varlığın dünya geometrisi */
export function worldEnt(e: MateEnt, c: AsmComp) {
  const q = Q(c);
  const pt = V(e.c).applyQuaternion(q).add(V(c.p));
  const n = V(e.n).applyQuaternion(q).normalize();
  return { pt, n };
}

/** silindirik yüzün eksenini üçgen normallerinden bul (normaller eksene dik) */
export function cylAxis(mesh: MeshData, face: number): Vec3 | null {
  const g = mesh.faceGroups;
  const ns: THREE.Vector3[] = [];
  for (let i = 0; i < g.length; i += 3) {
    if (g[i + 2] !== face) continue;
    for (let t = g[i]; t < g[i] + g[i + 1]; t += 3) {
      const vi = mesh.triangles[t] * 3;
      ns.push(new THREE.Vector3(mesh.normals[vi], mesh.normals[vi + 1], mesh.normals[vi + 2]));
    }
  }
  let best: THREE.Vector3 | null = null;
  for (let i = 0; i < ns.length && !best; i++)
    for (let j = i + 1; j < ns.length; j++) {
      const c = new THREE.Vector3().crossVectors(ns[i], ns[j]);
      if (c.length() > 0.2) {
        best = c.normalize();
        break;
      }
    }
  return best ? [best.x, best.y, best.z] : null;
}

/** eşleşmenin kaldırdığı serbestlik */
const DOF_REMOVED: Record<MateType, number> = { coincident: 3, distance: 3, parallel: 2, perpendicular: 1, angle: 1, concentric: 4, lock: 6, tangent: 2, limit: 0, limitAngle: 0, symmetric: 1, width: 1, gear: 1, rack: 1, screw: 1, coupler: 1, hinge: 5, profileCenter: 5, universal: 1, path: 2, cam: 1, slot: 2 };

export function dofOf(doc: AsmDoc, id: string): number {
  const c = doc.comps.find((x) => x.id === id);
  if (!c || c.fixed) return 0;
  const r = doc.mates.filter((m) => !m.off && (m.a.comp === id || m.b.comp === id)).reduce((s, m) => s + DOF_REMOVED[m.type], 0);
  return Math.max(0, 6 - r);
}

interface Locks { rot: THREE.Vector3[]; trans: THREE.Vector3[] }

function addTransLock(l: Locks, d: THREE.Vector3) {
  const v = d.clone();
  for (const u of l.trans) v.addScaledVector(u, -v.dot(u));
  if (v.length() > 1e-6) l.trans.push(v.normalize());
}
function perpOf(a: THREE.Vector3) {
  const t = Math.abs(a.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  return new THREE.Vector3().crossVectors(a, t).normalize();
}

/**
 * Konum çözücü (sıralı / açgözlü): sabit veya yerleşmiş bileşenden başlayarak her eşleşmeyi uygular.
 * Önceki eşleşmelerin kilitlediği dönme eksenlerini ve öteleme yönlerini korur.
 */
export function solve(doc: AsmDoc): { ok: boolean; unsolved: string[] } {
  const comps = new Map(doc.comps.map((c) => [c.id, c]));
  const solved = new Set(doc.comps.filter((c) => c.fixed).map((c) => c.id));
  if (!solved.size && doc.comps.length) solved.add(doc.comps[0].id);
  const locks = new Map<string, Locks>();
  const lk = (id: string) => locks.get(id) ?? (locks.set(id, { rot: [], trans: [] }), locks.get(id)!);
  const done = new Set<string>();
  const mates = doc.mates.filter((m) => !m.off);
  for (let pass = 0; pass < 4; pass++)
    for (const m of mates) {
      if (done.has(m.id)) continue;
      const ca = comps.get(m.a.comp), cb = comps.get(m.b.comp);
      if (!ca || !cb || ca === cb) continue;
      let base: MateEnt, mov: MateEnt, cm: AsmComp, cbase: AsmComp;
      if (solved.has(ca.id) && !cb.fixed) [base, mov, cbase, cm] = [m.a, m.b, ca, cb];
      else if (solved.has(cb.id) && !ca.fixed) [base, mov, cbase, cm] = [m.b, m.a, cb, ca];
      else continue;
      const L = lk(cm.id);
      const B = worldEnt(base, cbase);
      let M = worldEnt(mov, cm);
      // ---- dönme ----
      if (m.type !== "lock" && L.rot.length < 2) {
        const vb = B.n, vm = M.n;
        let tm: THREE.Vector3 | null = null;
        if (m.type === "coincident" || m.type === "distance") tm = m.flip ? vb.clone() : vb.clone().negate();
        else if (m.type === "parallel" || m.type === "concentric") tm = vb.clone().multiplyScalar((vm.dot(vb) >= 0 ? 1 : -1) * (m.flip ? -1 : 1));
        else if (m.type === "limit") tm = vb.clone().negate();
        else if (m.type === "perpendicular" || m.type === "tangent") {
          const t = vm.clone().addScaledVector(vb, -vm.dot(vb));
          tm = t.length() > 1e-6 ? t.normalize() : perpOf(vb);
        } else if (m.type === "angle") {
          const t = vm.clone().addScaledVector(vb, -vm.dot(vb));
          const pu = t.length() > 1e-6 ? t.normalize() : perpOf(vb);
          const th = ((m.v ?? 90) * Math.PI) / 180;
          tm = vb.clone().multiplyScalar(Math.cos(th)).addScaledVector(pu, Math.sin(th));
        }
        if (tm) {
          let r = new THREE.Quaternion();
          if (L.rot.length === 1) {
            const ax = L.rot[0];
            const a1 = vm.clone().addScaledVector(ax, -vm.dot(ax)), a2 = tm.clone().addScaledVector(ax, -tm.dot(ax));
            if (a1.length() > 1e-6 && a2.length() > 1e-6) {
              a1.normalize();
              a2.normalize();
              const ang = Math.atan2(new THREE.Vector3().crossVectors(a1, a2).dot(ax), a1.dot(a2));
              r.setFromAxisAngle(ax, ang);
            }
          } else r.setFromUnitVectors(vm, tm);
          // varlık noktası etrafında döndür
          const piv = M.pt;
          const q = r.clone().multiply(Q(cm));
          const p = V(cm.p).sub(piv).applyQuaternion(r).add(piv);
          cm.q = [q.x, q.y, q.z, q.w];
          cm.p = [p.x, p.y, p.z];
          M = worldEnt(mov, cm);
        }
      }
      // ---- öteleme ----
      let d = new THREE.Vector3();
      if (m.type === "coincident" || m.type === "distance") {
        const gap = m.type === "distance" ? m.v ?? 0 : 0;
        d = B.n.clone().multiplyScalar(gap - M.pt.clone().sub(B.pt).dot(B.n));
      } else if (m.type === "concentric") {
        const w = B.pt.clone().sub(M.pt);
        d = w.addScaledVector(B.n, -w.dot(B.n));
      } else if (m.type === "limit") {
        const gap = M.pt.clone().sub(B.pt).dot(B.n);
        const a = m.v ?? 0, b = m.vmax ?? a, lo = Math.min(a, b), hi = Math.max(a, b);
        if (gap < lo) d = B.n.clone().multiplyScalar(lo - gap);
        else if (gap > hi) d = B.n.clone().multiplyScalar(hi - gap);
      } else if (m.type === "tangent") {
        const planeIsBase = base.kind === "plane";
        const pl = planeIsBase ? B : M, cy = planeIsBase ? M : B;
        const r = (planeIsBase ? mov.r : base.r) ?? 0;
        const cur = cy.pt.clone().sub(pl.pt).dot(pl.n);
        const want = (cur >= 0 ? 1 : -1) * (m.flip ? -1 : 1) * r;
        d = pl.n.clone().multiplyScalar((want - cur) * (planeIsBase ? 1 : -1));
      }
      for (const u of L.trans) d.addScaledVector(u, -d.dot(u));
      cm.p = [cm.p[0] + d.x, cm.p[1] + d.y, cm.p[2] + d.z];
      // ---- kilitler ----
      const addRot = (ax: THREE.Vector3) => {
        if (!L.rot.some((x) => Math.abs(Math.abs(x.dot(ax)) - 1) < 1e-6)) L.rot.push(ax.clone());
      };
      if (m.type === "coincident" || m.type === "distance") (addTransLock(L, B.n), addRot(B.n));
      else if (m.type === "concentric") {
        const p1 = perpOf(B.n), p2 = new THREE.Vector3().crossVectors(B.n, p1);
        addTransLock(L, p1);
        addTransLock(L, p2);
        addRot(B.n);
      } else if (m.type === "parallel") addRot(B.n);
      else if (m.type === "tangent") addTransLock(L, base.kind === "plane" ? B.n : M.n);
      else if (m.type === "lock") {
        L.rot.push(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0));
        [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)].forEach((x) => addTransLock(L, x));
      }
      solved.add(cm.id);
      done.add(m.id);
    }
  const unsolved = mates.filter((m) => !done.has(m.id)).map((m) => m.id);
  return { ok: !unsolved.length, unsolved };
}

/** bileşenin dünya sınır kutusu (çarpışma) */
export function worldBox(c: AsmComp, bb: { min: Vec3; max: Vec3 }): THREE.Box3 {
  return new THREE.Box3(V(bb.min), V(bb.max)).applyMatrix4(new THREE.Matrix4().compose(V(c.p), Q(c), new THREE.Vector3(1, 1, 1)));
}

/** Malzeme listesi (BOM): parça adına göre adet */
export function bom(doc: AsmDoc) {
  const map = new Map<string, number>();
  // yapılandırması farklı örnekler ayrı satır (SolidWorks malzeme listesi)
  for (const c of doc.comps) {
    if (c.sup) continue;
    const cf = c.cfg ?? c.part.config;
    const n = c.part.configs && c.part.configs.length > 1 && cf ? `${c.part.name} [${cf}]` : c.part.name;
    map.set(n, (map.get(n) ?? 0) + 1);
  }
  return [...map].map(([name, qty], i) => ({ no: i + 1, name, qty }));
}

/** parça kütüphanesi (yerel) */
const LIB = "imajcad.lib";
export function loadLib(): Record<string, AsmPart> {
  try {
    return JSON.parse(localStorage.getItem(LIB) || "{}");
  } catch {
    return {};
  }
}
export function saveToLib(p: AsmPart) {
  const l = loadLib();
  const P: any = p; // D9-16: malzeme, değişkenler ve yapılandırmalar da
  l[p.name] = JSON.parse(JSON.stringify({ name: p.name, features: p.features, eqs: p.eqs, profiles: p.profiles, material: P.material, vars: P.vars, configs: P.configs, config: P.config, key: P.key }));
  try {
    localStorage.setItem(LIB, JSON.stringify(l));
  } catch {}
}
export function removeFromLib(name: string) {
  const l = loadLib();
  delete l[name];
  try {
    localStorage.setItem(LIB, JSON.stringify(l));
  } catch {}
}

/** SolidWorks: seçilen varlık türlerine göre geçerli standart eşleşmeler (ilki önerilen) */
export function mateTypesFor(ents: MateEnt[]): MateType[] {
  if (ents.length < 2) return MATE_GROUPS.std;
  const k = ents.map((e) => (e.kind === "cyl" || e.kind === "line" || e.kind === "circle" ? "ax" : e.kind)).sort().join("-");
  const T: Record<string, MateType[]> = {
    "plane-plane": ["coincident", "parallel", "perpendicular", "distance", "angle", "lock"],
    "ax-ax": ["concentric", "coincident", "parallel", "perpendicular", "distance", "angle", "tangent", "lock"],
    "ax-plane": ["tangent", "coincident", "parallel", "perpendicular", "distance", "lock"],
    "plane-point": ["coincident", "distance", "lock"],
    "ax-point": ["coincident", "distance", "lock"],
    "point-point": ["coincident", "distance", "lock"],
  };
  let t = T[k] ?? MATE_GROUPS.std;
  // teğet yalnız silindirle
  if (!ents.some((e) => e.kind === "cyl")) t = t.filter((x) => x !== "tangent");
  return t;
}

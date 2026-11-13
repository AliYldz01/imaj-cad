// Montaj eşleşme çözücüsü (SolidWorks gibi eşzamanlı): her serbest bileşen 6 serbestlik (öteleme + dönme),
// tüm eşleşmeler artık denklemleri olarak Levenberg–Marquardt ile birlikte çözülür.
// Serbestlik: Jacobian'ın sıfır uzayının bileşene düşen boyutu. Sürükleme: yumuşak hedef satırları.
import * as THREE from "three";
import type { Vec3 } from "../doc/types";
import type { AsmDoc, AsmComp, Mate, MateEnt } from "./assembly";
const ASM_ID = "__asm";
/** montaj ana düzlemleri / orijini: sabit birim dönüşümlü sanal bileşen */
const ASM_COMP = { id: ASM_ID, name: "Montaj", part: { name: "", features: [] }, q: [0, 0, 0, 1], p: [0, 0, 0], fixed: true } as unknown as AsmComp;
/** çözüm haritası: bileşenler + sanal montaj bileşeni */
function compMap(doc: AsmDoc) {
  const m = new Map(doc.comps.map((c) => [c.id, c]));
  m.set(ASM_ID, ASM_COMP);
  return m;
}
/** etkin eşleşmeler: bastırılanlar ve rijit alt montajın iç eşleşmeleri hariç; rijit alt montajlar için örtük kilitler */
function activeMates(doc: AsmDoc, cm: Map<string, AsmComp>): Mate[] {
  const rigid = new Set((doc.subs ?? []).filter((s) => s.rigid).map((s) => s.id));
  const ok = (e?: MateEnt) => !e || cm.has(e.comp);
  const out = doc.mates.filter((m) => !m.off && !(m.sub && rigid.has(m.sub)) && ok(m.a) && ok(m.b) && ok(m.c) && ok(m.d));
  for (const s of doc.subs ?? []) {
    if (!s.rigid) continue;
    const ids = s.comps.filter((id) => cm.has(id) && s.poses[id]);
    for (let i = 1; i < ids.length; i++) {
      const A = s.poses[ids[0]], B = s.poses[ids[i]];
      const e = (comp: string): MateEnt => ({ comp, kind: "point", c: [0, 0, 0], n: [0, 0, 1] });
      out.push({ id: `__rig_${s.id}_${i}`, type: "lock", a: e(ids[0]), b: e(ids[i]), ref: { pa: A.p, qa: A.q, pb: B.p, qb: B.q }, L: 50 });
    }
  }
  return out;
}

const V = (a: Vec3) => new THREE.Vector3(a[0], a[1], a[2]);
const QC = (c: AsmComp) => new THREE.Quaternion(c.q[0], c.q[1], c.q[2], c.q[3]);

/** varlığın dünya geometrisi: nokta, yön (düzlem normali / eksen), yarıçap */
export function wEnt(e: MateEnt, c: AsmComp) {
  const q = QC(c);
  return { P: V(e.c).applyQuaternion(q).add(V(c.p)), N: V(e.n).applyQuaternion(q).normalize(), r: e.r ?? 0, k: e.kind };
}
const isAxis = (k: string) => k === "cyl" || k === "line" || k === "circle";
const dot = (a: THREE.Vector3, b: THREE.Vector3) => a.dot(b);
const sub = (a: THREE.Vector3, b: THREE.Vector3) => a.clone().sub(b);
const cross = (a: THREE.Vector3, b: THREE.Vector3) => new THREE.Vector3().crossVectors(a, b);
const v3 = (a: THREE.Vector3) => [a.x, a.y, a.z];

/** dönme açısı (eksen etrafında): referans dönüşüme göre, sürekli (sarma) */
function twist(q: THREE.Quaternion, q0: number[], ax: THREE.Vector3) {
  const r = q.clone().multiply(new THREE.Quaternion(q0[0], q0[1], q0[2], q0[3]).invert());
  if (r.w < 0) r.set(-r.x, -r.y, -r.z, -r.w);
  return 2 * Math.atan2(r.x * ax.x + r.y * ax.y + r.z * ax.z, r.w);
}
const wrap = (a: number, ref: number) => a + 2 * Math.PI * Math.round((ref - a) / (2 * Math.PI));
const lastTw = new Map<string, number>();

/** hizalama: a = true → aynı yön, false → zıt yön; residu yön farkı */
const alignU = (A: THREE.Vector3, B: THREE.Vector3, same: boolean) => v3(same ? sub(B, A) : B.clone().add(A));
const ineq = (x: number, lo: number, hi: number) => (x < lo ? x - lo : x > hi ? x - hi : 0);

/** bir eşleşmenin artıkları (sıfır = sağlandı); lim=true: eşitsizlik (serbestlik saymaz) */
export function mateRes(m: Mate, cm: Map<string, AsmComp>): { r: number[]; lim?: boolean } {
  const E = (e: MateEnt) => wEnt(e, cm.get(e.comp)!);
  // açısal artıklar parça ölçeğiyle mm'ye çevrilir (mesafe artıklarıyla aynı birim → büyük parçalarda da yakınsar)
  const K = m.L ?? Math.max(50, (cm.get(m.a.comp) as any)?._L ?? 0, (cm.get(m.b.comp) as any)?._L ?? 0);
  const align = (P: THREE.Vector3, Q: THREE.Vector3, sm: boolean) => alignU(P, Q, sm).map((x) => x * K);
  const cr = (P: THREE.Vector3, Q: THREE.Vector3) => v3(cross(P, Q)).map((x) => x * K);
  const dt = (P: THREE.Vector3, Q: THREE.Vector3) => dot(P, Q) * K;
  const A = E(m.a), B = E(m.b);
  const same = !!m.flip; // varsayılan ters hizalı (SolidWorks çakışık düz yüzler)
  const t = m.type;
  const d = sub(B.P, A.P);
  const ka = A.k, kb = B.k;
  const pl = (k: string) => k === "plane";
  // yardımcı: eksen-eksen dik uzaklık
  const axDist = (P: THREE.Vector3, Q: THREE.Vector3, N: THREE.Vector3) => cross(sub(Q, P), N).length();
  switch (t) {
    case "coincident":
    case "concentric": {
      if (pl(ka) && pl(kb)) return { r: [...align(A.N, B.N, same), dot(d, A.N)] };
      if (pl(ka) || pl(kb)) {
        const [P, O] = pl(ka) ? [A, B] : [B, A];
        const dd = dot(sub(O.P, P.P), P.N);
        if (O.k === "point") return { r: [dd] };
        // dairesel kenar düz yüzde: kenar düzlemi = yüz (normaller paralel, merkez yüzde)
        if (O.k === "circle") return { r: [...cr(P.N, O.N), dd] };
        return { r: [dt(P.N, O.N), dd] }; // eksen / doğrusal kenar düzlemde
      }
      if (ka === "point" && kb === "point") return { r: v3(d) };
      if (ka === "point" || kb === "point") {
        const [X, Pt] = ka === "point" ? [B, A] : [A, B];
        // çakışık nokta–dairesel kenar: nokta çemberin üzerinde; eş merkezli: nokta eksende
        if (t === "coincident" && X.k === "circle") {
          const w = sub(Pt.P, X.P);
          const ax = dot(w, X.N);
          return { r: [ax, w.addScaledVector(X.N, -ax).length() - X.r] };
        }
        return { r: v3(cross(sub(Pt.P, X.P), X.N)) };
      }
      // eksen – eksen (eş merkezli / doğrusal): hizalı / ters hizalı; daire kenarı – daire kenarı çakışık: merkezler de çakışık
      const r = [...align(A.N, B.N, same), ...v3(cross(d, A.N))];
      if (t === "coincident" && ka === "circle" && kb === "circle") r.push(dot(d, A.N));
      return { r };
    }
    case "parallel":
      if (pl(ka) !== pl(kb)) return { r: [dt(A.N, B.N)] };
      return { r: align(A.N, B.N, same) };
    case "perpendicular":
      if (pl(ka) !== pl(kb)) return { r: cr(A.N, B.N) };
      return { r: [dt(A.N, B.N)] };
    case "angle": {
      const c = Math.cos(((m.v ?? 90) * Math.PI) / 180);
      return { r: [(dot(A.N, B.N) * (same ? 1 : -1) - c) * K] };
    }
    case "distance":
    case "limit": {
      const lo = m.v ?? 0, hi = t === "limit" ? m.vmax ?? lo : lo;
      let r: number[] = [], x = 0;
      if (pl(ka) && pl(kb)) (r = align(A.N, B.N, same)), (x = dot(d, A.N));
      else if (pl(ka) || pl(kb)) {
        const [P, O] = pl(ka) ? [A, B] : [B, A];
        if (O.k !== "point") r = [dt(P.N, O.N)];
        x = dot(sub(O.P, P.P), P.N) - (O.k === "cyl" ? Math.sign(dot(sub(O.P, P.P), P.N) || 1) * O.r : 0);
      } else if (isAxis(ka) && isAxis(kb)) (r = cr(A.N, B.N)), (x = axDist(A.P, B.P, A.N));
      else if (isAxis(ka) || isAxis(kb)) {
        const [X, Pt] = isAxis(ka) ? [A, B] : [B, A];
        x = axDist(X.P, Pt.P, X.N);
      } else x = d.length();
      if (m.flipD) x = -x;
      if (t === "limit") return { r: [...r, ineq(x, Math.min(lo, hi), Math.max(lo, hi))], lim: true };
      return { r: [...r, x - lo] };
    }
    case "profileCenter": {
      // iki düz yüzün profil merkezleri hizalı, yüzler çakışık (ötelemeli)
      return { r: [...align(A.N, B.N, same), ...v3(d.clone().addScaledVector(A.N, -(m.v ?? 0)))] };
    }
    case "universal": {
      // üniversal mafsal: θ2 = atan(tan θ1 · cos β)
      const ca = cm.get(m.a.comp)!, cb = cm.get(m.b.comp)!;
      const ref = m.ref!;
      const k1 = m.id + "u1", k2 = m.id + "u2";
      const t1 = wrap(twist(QC(ca), ref.qa, A.N), lastTw.get(k1) ?? 0);
      lastTw.set(k1, t1);
      const t2 = wrap(twist(QC(cb), ref.qb, B.N), lastTw.get(k2) ?? 0);
      lastTw.set(k2, t2);
      const cosb = Math.abs(dot(A.N, B.N));
      const raw = Math.atan2(Math.sin(t1) * cosb, Math.cos(t1));
      const tgt = t1 + Math.atan2(Math.sin(raw - t1), Math.cos(raw - t1));
      return { r: [(t2 - (m.flip ? -tgt : tgt)) * (m.L ?? 50) * 0.02] };
    }
    case "limitAngle": {
      const ang = (Math.acos(Math.max(-1, Math.min(1, dot(A.N, B.N) * (same ? 1 : -1)))) * 180) / Math.PI;
      const lo = m.v ?? 0, hi = m.vmax ?? lo;
      return { r: [((ineq(ang, Math.min(lo, hi), Math.max(lo, hi)) * Math.PI) / 180) * K], lim: true };
    }
    case "tangent": {
      if (pl(ka) || pl(kb)) {
        const [P, O] = pl(ka) ? [A, B] : [B, A];
        // silindir yüzün bulunduğu tarafta kalır (SolidWorks)
        const s = Math.sign(dot(sub(O.P, P.P), P.N) || 1);
        return { r: [dt(P.N, O.N), dot(sub(O.P, P.P), P.N) - s * O.r] };
      }
      // silindir–silindir: dıştan (r1+r2) ya da içten (|r1−r2|, "Ters" ile)
      return { r: [...cr(A.N, B.N), axDist(A.P, B.P, A.N) - (same ? Math.abs(A.r - B.r) : A.r + B.r)] };
    }
    case "lock": {
      // göreli konum, eşleşme oluşturulduğundaki gibi kalır
      const ca = cm.get(m.a.comp)!, cb = cm.get(m.b.comp)!;
      const ref = m.ref!;
      // b'nin a çerçevesindeki konumu (şimdi) − (referans)
      const qa = QC(ca).invert();
      const pbNow = V(cb.p).sub(V(ca.p)).applyQuaternion(qa), qbNow = qa.clone().multiply(QC(cb));
      const qa0 = new THREE.Quaternion(...(ref.qa as [number, number, number, number])).invert();
      const pb0 = V(ref.pb as Vec3).sub(V(ref.pa as Vec3)).applyQuaternion(qa0), qb0 = qa0.clone().multiply(new THREE.Quaternion(...(ref.qb as [number, number, number, number])));
      const dq = qbNow.multiply(qb0.invert());
      if (dq.w < 0) dq.set(-dq.x, -dq.y, -dq.z, -dq.w);
      const L = m.L ?? 50;
      return { r: [...v3(pbNow.sub(pb0)), dq.x * 2 * L, dq.y * 2 * L, dq.z * 2 * L] };
    }
    case "symmetric": {
      const S = E(m.c!);
      const mid = A.P.clone().add(B.P).multiplyScalar(0.5);
      const refl = A.N.clone().addScaledVector(S.N, -2 * dot(A.N, S.N));
      const r = [dot(sub(mid, S.P), S.N)];
      // simetri düzlemine paralel bileşenler eşit (aynı hizada)
      const w = d.clone().addScaledVector(S.N, -dot(d, S.N));
      if (!pl(ka)) r.push(...v3(w));
      if (pl(ka)) r.push(...v3(sub(B.N, refl)).map((x) => x * K));
      else if (ka !== "point") r.push(...cr(B.N, refl));
      return { r };
    }
    case "width": {
      // a,b: genişlik yüzleri; c,d: sekme yüzleri (veya c: silindir) → sekme ortada
      const C = E(m.c!), D = m.d ? E(m.d) : null;
      const W = A.P.clone().add(B.P).multiplyScalar(0.5);
      const T = D ? C.P.clone().add(D.P).multiplyScalar(0.5) : C.P;
      const r = [dot(sub(T, W), A.N)];
      if (C.k === "plane") r.push(...cr(A.N, C.N));
      else r.push(dt(A.N, C.N));
      return { r };
    }
    case "gear":
    case "rack":
    case "screw":
    case "coupler": {
      // referans dönüşüme göre dönme açısı / öteleme bağı
      const ca = cm.get(m.a.comp)!, cb = cm.get(m.b.comp)!;
      const ref = m.ref!;
      const rot = (c: AsmComp, q0: number[], ax: THREE.Vector3, key: string) => {
        const k = m.id + key;
        const a = wrap(twist(QC(c), q0, ax), lastTw.get(k) ?? 0);
        lastTw.set(k, a);
        return a;
      };
      const tr = (c: AsmComp, p0: number[], ax: THREE.Vector3) => dot(V(c.p).sub(new THREE.Vector3(p0[0], p0[1], p0[2])), ax);
      const s = m.flip ? -1 : 1;
      const k = m.v ?? 1, k2 = m.vmax ?? 1;
      const L = m.L ?? 50;
      if (t === "gear") return { r: [(rot(ca, ref.qa, A.N, "a") * k + s * rot(cb, ref.qb, B.N, "b") * k2) * L * 0.02] };
      if (t === "rack") {
        // a: kremayer (doğrusal kenar / düz yüz yönü), b: pinyon (silindir); v = pinyon hatve çapı
        return { r: [tr(ca, ref.pa, A.N) - s * rot(cb, ref.qb, B.N, "b") * (k / 2)] };
      }
      if (t === "screw") {
        // a: vida ekseni (eş merkezli ayrıca verilir), v = hatve (mm/tur)
        const rel = tr(cb, ref.pb, A.N) - tr(ca, ref.pa, A.N);
        return { r: [rel - s * (rot(cb, ref.qb, A.N, "b") - rot(ca, ref.qa, A.N, "a")) * (k / (2 * Math.PI))] };
      }
      // doğrusal bağlayıcı: a yönündeki öteleme × oran = b yönündeki öteleme
      return { r: [tr(ca, ref.pa, A.N) * k - s * tr(cb, ref.pb, B.N) * k2] };
    }
    case "hinge": {
      // a,b: eş merkezli silindirler; c,d: çakışık düz yüzler; açı limiti (isteğe bağlı)
      const C = E(m.c!), D = E(m.d!);
      const r = [...cr(A.N, B.N), ...v3(cross(d, A.N)), ...align(C.N, D.N, false), dot(sub(D.P, C.P), C.N)];
      return { r };
    }
  }
  return { r: [] };
}

export interface SolveOpts {
  /** sürükleme: bileşen, yerel tutma noktası ve dünya hedefi / hedef dönüş */
  drag?: { comp: string; local: Vec3; target: Vec3 } | { comp: string; rot: [number, number, number, number] };
  iters?: number;
  /** sabitlenmiş sayılacak ek bileşenler */
  hold?: Set<string>;
}
export interface SolveResult {
  ok: boolean;
  /** sağlanamayan (hatalı / aşırı tanımlayan) eşleşmeler */
  bad: string[];
  unsolved: string[];
}

/** bileşen ölçeği (dönme değişkenini mm birimine çevirir) */
const sizeOf = (c: AsmComp) => (c as any)._L ?? 50;

/** eşzamanlı çözüm */
export function solveAll(doc: AsmDoc, o: SolveOpts = {}): SolveResult {
  const cm = compMap(doc);
  const anyFixed = doc.comps.some((c) => c.fixed);
  const free = doc.comps.filter((c) => !c.fixed && !(o.hold?.has(c.id)) && (anyFixed || c !== doc.comps[0]));
  const mates = activeMates(doc, cm);
  // yalnız eşleşmeye bağlı serbest bileşenler (sürüklenen hariç diğerleri olduğu yerde)
  const linked = new Set<string>();
  for (const m of mates) for (const e of [m.a, m.b, m.c, m.d]) if (e) linked.add(e.comp);
  if (o.drag) linked.add(o.drag.comp);
  const vars = free.filter((c) => linked.has(c.id));
  const n = vars.length * 6;
  const piv = vars.map((c) => {
    const lc = (c as any)._lc as Vec3 | undefined;
    return lc ? V(lc) : new THREE.Vector3();
  });
  const save = vars.map((c) => ({ p: [...c.p] as Vec3, q: [...c.q] as [number, number, number, number] }));
  const apply = (x: number[], base = save) => {
    vars.forEach((c, i) => {
      const L = sizeOf(c);
      const rv = new THREE.Vector3(x[i * 6 + 3], x[i * 6 + 4], x[i * 6 + 5]).multiplyScalar(1 / L);
      const ang = rv.length();
      const dq = ang > 1e-12 ? new THREE.Quaternion().setFromAxisAngle(rv.clone().normalize(), ang) : new THREE.Quaternion();
      const q0 = new THREE.Quaternion(...base[i].q);
      const W = piv[i].clone().applyQuaternion(q0).add(V(base[i].p)).add(new THREE.Vector3(x[i * 6], x[i * 6 + 1], x[i * 6 + 2]));
      const q = dq.multiply(q0).normalize();
      const p = W.sub(piv[i].clone().applyQuaternion(q));
      c.q = [q.x, q.y, q.z, q.w];
      c.p = [p.x, p.y, p.z];
    });
  };
  const resid = (withDrag: boolean) => {
    const out: number[] = [];
    for (const m of mates) out.push(...mateRes(m, cm).r);
    if (withDrag && o.drag) {
      const c = cm.get(o.drag.comp)!;
      const w = 0.05;
      if ("target" in o.drag) {
        const P = V(o.drag.local).applyQuaternion(QC(c)).add(V(c.p));
        out.push(...v3(P.sub(V(o.drag.target)).multiplyScalar(w)));
      } else {
        const dq = QC(c).multiply(new THREE.Quaternion(...o.drag.rot).invert());
        if (dq.w < 0) dq.set(-dq.x, -dq.y, -dq.z, -dq.w);
        const L = sizeOf(c);
        out.push(dq.x * 2 * L * w, dq.y * 2 * L * w, dq.z * 2 * L * w);
      }
    }
    return out;
  };
  const run = (withDrag: boolean, iters: number) => {
    if (!n) return;
    let lam = 1e-3;
    for (let it = 0; it < iters; it++) {
      const base = vars.map((c) => ({ p: [...c.p] as Vec3, q: [...c.q] as [number, number, number, number] }));
      const zero = new Array(n).fill(0);
      apply(zero, base);
      const r0 = resid(withDrag);
      const e0 = r0.reduce((s, v) => s + v * v, 0);
      if (e0 < 1e-16) break;
      const m = r0.length;
      const J: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));
      const h = 1e-6;
      for (let j = 0; j < n; j++) {
        const x = zero.slice();
        x[j] = h;
        apply(x, base);
        const r1 = resid(withDrag);
        for (let i = 0; i < m; i++) J[i][j] = (r1[i] - r0[i]) / h;
      }
      apply(zero, base);
      // (JᵀJ + λ diag) δ = −Jᵀr
      let improved = false;
      for (let tries = 0; tries < 8 && !improved; tries++) {
        const A = Array.from({ length: n }, () => new Array(n).fill(0)), g = new Array(n).fill(0);
        for (let i = 0; i < m; i++)
          for (let a = 0; a < n; a++) {
            if (!J[i][a]) continue;
            g[a] -= J[i][a] * r0[i];
            for (let b = 0; b < n; b++) A[a][b] += J[i][a] * J[i][b];
          }
        // sönüm: dönme değişkenleri daha "pahalı" (önce öteleme; SolidWorks gibi en kısa hareket)
        for (let a = 0; a < n; a++) A[a][a] += lam * (A[a][a] + (a % 6 >= 3 ? 4 : 1));
        const dx = gauss(A, g);
        if (!dx) {
          lam *= 10;
          continue;
        }
        // büyük adımı sınırla: öteleme ölçeğe göre, dönme adım başına ≤ 0.5 rad (doğrusallaştırma geçerli kalsın)
        const mx = Math.max(...dx.map(Math.abs));
        const cap = Math.max(200, ...vars.map((c) => 4 * sizeOf(c)));
        let sc = mx > cap ? cap / mx : 1;
        vars.forEach((c, i) => {
          const rv = Math.hypot(dx[i * 6 + 3], dx[i * 6 + 4], dx[i * 6 + 5]) / sizeOf(c);
          if (rv * sc > 0.5) sc = 0.5 / rv;
        });
        apply(dx.map((v) => v * sc), base);
        const e1 = resid(withDrag).reduce((s, v) => s + v * v, 0);
        if (e1 < e0) {
          improved = true;
          lam = Math.max(1e-9, lam / 5);
        } else {
          apply(zero, base);
          lam *= 10;
        }
      }
      if (!improved) break;
    }
  };
  if (o.drag) run(true, o.iters ?? 25);
  run(false, o.iters ? Math.max(o.iters, 40) : 150);
  const bad: string[] = [];
  for (const m of mates) {
    if (m.id.startsWith("__rig_")) continue;
    const r = mateRes(m, cm).r;
    if (r.some((v) => Math.abs(v) > 1e-3)) bad.push(m.id);
  }
  return { ok: !bad.length, bad, unsolved: bad };
}

/** bileşen başına kalan serbestlik derecesi (SolidWorks (-) göstergesi) */
export function dofAll(doc: AsmDoc): Map<string, number> {
  const out = new Map<string, number>();
  const cm = compMap(doc);
  const anyFixed = doc.comps.some((c) => c.fixed);
  const vars = doc.comps.filter((c) => !c.fixed && (anyFixed || c !== doc.comps[0]));
  for (const c of doc.comps) out.set(c.id, 0);
  const n = vars.length * 6;
  if (!n) return out;
  const mates = activeMates(doc, cm).filter((m) => !mateRes(m, cm).lim);
  const save = vars.map((c) => ({ p: [...c.p] as Vec3, q: [...c.q] as [number, number, number, number] }));
  const res = () => mates.flatMap((m) => mateRes(m, cm).r);
  const r0 = res();
  const m = r0.length;
  const J: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));
  const h = 1e-5;
  vars.forEach((c, i) => {
    const L = sizeOf(c);
    const lc = V(((c as any)._lc as Vec3) ?? [0, 0, 0]);
    for (let k = 0; k < 6; k++) {
      const s = save[i];
      if (k < 3) {
        const p = [...s.p] as Vec3;
        p[k] += h;
        c.p = p;
      } else {
        const ax = new THREE.Vector3(k === 3 ? 1 : 0, k === 4 ? 1 : 0, k === 5 ? 1 : 0);
        const q0 = new THREE.Quaternion(...s.q);
        const W = lc.clone().applyQuaternion(q0).add(V(s.p));
        const q = new THREE.Quaternion().setFromAxisAngle(ax, h / L).multiply(q0);
        const p = W.sub(lc.clone().applyQuaternion(q));
        c.q = [q.x, q.y, q.z, q.w];
        c.p = [p.x, p.y, p.z];
      }
      const r1 = res();
      for (let j = 0; j < m; j++) J[j][i * 6 + k] = (r1[j] - r0[j]) / h;
      c.p = s.p;
      c.q = s.q;
    }
  });
  // JᵀJ özdeğer ayrışımı → sıfır uzayı
  const A = Array.from({ length: n }, (_, a) => Array.from({ length: n }, (_, b) => J.reduce((s, row) => s + row[a] * row[b], 0)));
  const { vals, vecs } = jacobiEig(A);
  const mx = Math.max(1e-12, ...vals.map(Math.abs));
  const ns = vals.map((v, i) => (Math.abs(v) < mx * 1e-8 + 1e-10 ? i : -1)).filter((i) => i >= 0);
  vars.forEach((c, i) => {
    // sıfır uzayı vektörlerinin bu bileşene düşen 6 bileşeninin rankı
    const rows = ns.map((k) => Array.from({ length: 6 }, (_, j) => vecs[i * 6 + j][k]));
    const G = Array.from({ length: 6 }, (_, a) => Array.from({ length: 6 }, (_, b) => rows.reduce((s, r) => s + r[a] * r[b], 0)));
    const ev = jacobiEig(G).vals;
    out.set(c.id, ev.filter((v) => v > 1e-6).length);
  });
  return out;
}

function gauss(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-14) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      if (!f) continue;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
    x[r] = s / M[r][r];
  }
  return x;
}

/** simetrik matris için Jacobi özdeğer ayrışımı (vecs[satır][özvektör]) */
function jacobiEig(A0: number[][]) {
  const n = A0.length;
  const A = A0.map((r) => r.slice());
  const Vm: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] * A[i][j];
    if (off < 1e-22) break;
    for (let p = 0; p < n; p++)
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-300) continue;
        const th = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = A[k][p], akq = A[k][q];
          A[k][p] = c * akp - s * akq;
          A[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p][k], aqk = A[q][k];
          A[p][k] = c * apk - s * aqk;
          A[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = Vm[k][p], vkq = Vm[k][q];
          Vm[k][p] = c * vkp - s * vkq;
          Vm[k][q] = s * vkp + c * vkq;
        }
      }
  }
  return { vals: A.map((r, i) => r[i]), vecs: Vm };
}

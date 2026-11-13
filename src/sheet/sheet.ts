// Sac metal: 2B yardımcılar (açık profilli taban flanş) ve parametre çözümü.
import type { Feature, Loop, Seg, SheetBaseFeature, Vec2 } from "../doc/types";
import { thinRegion } from "../sketch/profile";

const sub = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];
const add = (a: Vec2, b: Vec2): Vec2 => [a[0] + b[0], a[1] + b[1]];
const mul = (a: Vec2, k: number): Vec2 => [a[0] * k, a[1] * k];
const len = (a: Vec2) => Math.hypot(a[0], a[1]);
const nrm = (a: Vec2): Vec2 => mul(a, 1 / (len(a) || 1));
const cross = (a: Vec2, b: Vec2) => a[0] * b[1] - a[1] * b[0];

/**
 * Açık zincirden bükümlü sac kesiti.
 * Çizgi–çizgi köşeleri büküm yarıçapıyla yuvarlatılır: eskiz çizgisi büküm iç yüzündeyse r,
 * dış yüzündeyse r + t kullanılır; böylece iç büküm yarıçapı her köşede r olur.
 * rev = false: malzeme zincirin solunda.
 */
export function sheetOpenRegion(segsIn: Seg[], t: number, r: number, rev: boolean): Loop[] {
  if (!(t > 0)) throw new Error("Sac kalınlığı sıfırdan büyük olmalı");
  const segs: Seg[] = segsIn.map((s) => ({ ...s }) as Seg);
  const out: Seg[] = [];
  let cur = segs[0];
  for (let i = 1; i < segs.length; i++) {
    const nx = segs[i];
    if (cur.t !== "l" || nx.t !== "l") {
      out.push(cur);
      cur = nx;
      continue;
    }
    const d1 = nrm(sub(cur.b, cur.a)), d2 = nrm(sub(nx.b, nx.a));
    const turn = cross(d1, d2);
    if (Math.abs(turn) < 1e-9) {
      // doğrusal devam: birleştir
      cur = { t: "l", a: cur.a, b: nx.b };
      continue;
    }
    const matLeft = !rev;
    const inner = (turn > 0) === matLeft; // malzeme dönüşün iç tarafında → eskiz dış yüzde
    const R = inner ? r + t : r;
    const P = cur.b;
    const cosT = Math.max(-1, Math.min(1, -(d1[0] * d2[0] + d1[1] * d2[1])));
    const th = Math.acos(cosT); // iki çizgi arasındaki açı
    if (th < 1e-6) throw new Error("Profil kendi üzerine katlanıyor");
    const T = R / Math.tan(th / 2);
    if (T > len(sub(cur.b, cur.a)) + 1e-6 || T > len(sub(nx.b, nx.a)) + 1e-6) throw new Error("Büküm yarıçapı için çizgi çok kısa");
    const A = sub(P, mul(d1, T)), B = add(P, mul(d2, T));
    const bis = nrm(add(mul(d1, -1), d2));
    const C = add(P, mul(bis, R / Math.sin(th / 2)));
    const M = sub(C, mul(bis, R));
    if (len(sub(A, cur.a)) > 1e-9) out.push({ t: "l", a: cur.a, b: A });
    out.push({ t: "a", a: A, b: B, m: M });
    cur = { t: "l", a: B, b: nx.b };
  }
  out.push(cur);
  return thinRegion([{ segs: out, closed: false }], t, rev ? "rev" : "one");
}

export interface SheetParams { t: number; r: number; k: number; relief: number }

/** Bir özellikten önceki son taban flanşın sac parametreleri */
export function sheetParamsBefore(feats: Feature[], id: string | null): SheetParams | null {
  let p: SheetParams | null = null;
  for (const f of feats) {
    if (f.id === id) break;
    if ((f.type === "sheetbase" || f.type === "tosheet") && !f.off) p = { t: f.t, r: f.r, k: effK(f as any), relief: f.relief };
  }
  return p;
}

/** Belgedeki son sac parametre kaynağı (taban flanş veya saca dönüştür) */
export function lastSheetBase(feats: Feature[]): (SheetParams & { id: string }) | null {
  let b: (SheetParams & { id: string }) | null = null;
  for (const f of feats) if ((f.type === "sheetbase" || f.type === "tosheet") && !f.off) b = { id: f.id, t: f.t, r: f.r, k: effK(f as any), relief: f.relief, ...((f as any).bendMethod === "table" ? { btable: (f as any).btable } : {}) } as any;
  return b;
}
void (null as unknown as SheetBaseFeature);

/**
 * SolidWorks büküm hesap yöntemleri: K-faktörü, büküm payı (BA), büküm düşümü (BD).
 * BA/BD değerleri 90° büküm için girilir ve eşdeğer K-faktörüne çevrilir:
 *   BA = (π/2)(r + K·t) ;  BD = 2(r + t) − BA
 */
/** büküm tablosu: açıya göre büküm payı (doğrusal ara değer; tablo dışında uçtaki K korunur) */
export function tableK(rows: { angle: number; ba: number }[], t: number, r: number, angleDeg: number): number {
  const R = rows.filter((x) => x.angle > 0 && x.ba > 0).sort((a, b) => a.angle - b.angle);
  if (!R.length) return 0.44;
  const kOf = (x: { angle: number; ba: number }) => ((x.ba / ((x.angle * Math.PI) / 180)) - r) / t;
  if (angleDeg <= R[0].angle) return Math.max(0, Math.min(1, kOf(R[0])));
  if (angleDeg >= R[R.length - 1].angle) return Math.max(0, Math.min(1, kOf(R[R.length - 1])));
  for (let i = 0; i + 1 < R.length; i++)
    if (angleDeg <= R[i + 1].angle) {
      const u = (angleDeg - R[i].angle) / (R[i + 1].angle - R[i].angle);
      const ba = R[i].ba + u * (R[i + 1].ba - R[i].ba);
      return Math.max(0, Math.min(1, (ba / ((angleDeg * Math.PI) / 180) - r) / t));
    }
  return 0.44;
}
export function effK(f: { t: number; r: number; k: number; bendMethod?: "k" | "ba" | "bd" | "table"; ba?: number; bd?: number; btable?: { angle: number; ba: number }[] }): number {
  const q = Math.PI / 2;
  if (f.bendMethod === "table" && f.btable?.length) return tableK(f.btable, f.t, f.r, 90);
  if (f.bendMethod === "ba" && f.ba! > 0) return Math.max(0, Math.min(1, (f.ba! / q - f.r) / f.t));
  if (f.bendMethod === "bd" && f.bd !== undefined) return Math.max(0, Math.min(1, ((2 * (f.r + f.t) - f.bd) / q - f.r) / f.t));
  return f.k;
}
/** Kalınlık tablosu (çelik sac, havada bükme; iç yarıçap ≈ kalınlık) */
export const GAUGE_TABLE: { name: string; t: number; r: number; k: number }[] = [
  { name: "0,8 mm", t: 0.8, r: 0.8, k: 0.42 }, { name: "1 mm", t: 1, r: 1, k: 0.42 }, { name: "1,2 mm", t: 1.2, r: 1.2, k: 0.42 },
  { name: "1,5 mm", t: 1.5, r: 1.5, k: 0.43 }, { name: "2 mm", t: 2, r: 2, k: 0.43 }, { name: "2,5 mm", t: 2.5, r: 2.5, k: 0.44 },
  { name: "3 mm", t: 3, r: 3, k: 0.44 }, { name: "4 mm", t: 4, r: 4, k: 0.45 }, { name: "5 mm", t: 5, r: 5, k: 0.45 },
  { name: "6 mm", t: 6, r: 6, k: 0.46 }, { name: "8 mm", t: 8, r: 10, k: 0.47 }, { name: "10 mm", t: 10, r: 12, k: 0.48 },
];

/** K faktörü ve büküm yarıçapından büküm payı (nötr eksen yay uzunluğu) */
export const bendAllowance = (angleDeg: number, r: number, t: number, k: number) => ((angleDeg * Math.PI) / 180) * (r + k * t);

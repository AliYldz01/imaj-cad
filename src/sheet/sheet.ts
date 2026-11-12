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
    if (f.type === "sheetbase" && !f.off) p = { t: f.t, r: f.r, k: f.k, relief: f.relief };
  }
  return p;
}

/** Belgedeki son taban flanş */
export function lastSheetBase(feats: Feature[]): SheetBaseFeature | null {
  let b: SheetBaseFeature | null = null;
  for (const f of feats) if (f.type === "sheetbase" && !f.off) b = f;
  return b;
}

/** K faktörü ve büküm yarıçapından büküm payı (nötr eksen yay uzunluğu) */
export const bendAllowance = (angleDeg: number, r: number, t: number, k: number) => ((angleDeg * Math.PI) / 180) * (r + k * t);

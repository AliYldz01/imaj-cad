// Bağlantı elemanları (SolidWorks Toolbox benzeri): ISO 4017 altı köşe cıvata, ISO 4032 somun, ISO 7089 pul.
// Parametrik parça (eskiz + ekstrüzyon) olarak üretilir; montaja bileşen olarak eklenir.
import type { AsmPart } from "./assembly";

/** M boyutu → [anahtar ağzı s, baş yüksekliği k, somun yüksekliği m, pul iç çap, pul dış çap, pul kalınlığı] */
export const FASTENER_SIZES: Record<string, [number, number, number, number, number, number]> = {
  M4: [7, 2.8, 3.2, 4.3, 9, 0.8],
  M5: [8, 3.5, 4.7, 5.3, 10, 1],
  M6: [10, 4, 5.2, 6.4, 12, 1.6],
  M8: [13, 5.3, 6.8, 8.4, 16, 1.6],
  M10: [16, 6.4, 8.4, 10.5, 20, 2],
  M12: [18, 7.5, 10.8, 13, 24, 2.5],
  M16: [24, 10, 14.8, 17, 30, 3],
  M20: [30, 12.5, 18, 21, 37, 3],
};
export type FastenerKind = "bolt" | "nut" | "washer";
export const FASTENER_NAMES: Record<FastenerKind, string> = { bolt: "Altı köşe cıvata (ISO 4017)", nut: "Altı köşe somun (ISO 4032)", washer: "Düz pul (ISO 7089)" };

type SkData = { pts: Record<string, { x: number; y: number }>; ents: any[]; rels: any[]; dims: any[]; seq: number };
function sk(): { d: SkData; pt: (x: number, y: number) => string; line: (a: string, b: string) => void; circle: (x: number, y: number, r: number) => void } {
  const d: SkData = { pts: {}, ents: [], rels: [], dims: [], seq: 1 };
  const pt = (x: number, y: number) => {
    const k = `p${d.seq++}`;
    d.pts[k] = { x, y };
    return k;
  };
  return {
    d,
    pt,
    line: (a, b) => void d.ents.push({ id: `l${d.seq++}`, t: "line", p1: a, p2: b }),
    circle: (x, y, r) => void d.ents.push({ id: `c${d.seq++}`, t: "circle", c: pt(x, y), r }),
  };
}
function hex(s: { pt: (x: number, y: number) => string; line: (a: string, b: string) => void }, af: number) {
  const R = af / Math.sqrt(3);
  const ids = Array.from({ length: 6 }, (_, i) => s.pt(+(R * Math.cos((i * Math.PI) / 3)).toFixed(4), +(R * Math.sin((i * Math.PI) / 3)).toFixed(4)));
  ids.forEach((a, i) => s.line(a, ids[(i + 1) % 6]));
}
const TOP = { k: "std", n: "top" };
const ext = (id: string, sketch: string, d1: number, rev = false) => ({ id, type: "extrude", name: id, sketch, cut: false, end: "blind", d1, rev, dir2: false, end2: "blind", d2: 10 });

/** bağlantı elemanı parçası (Y ekseni = eksen; cıvata başı altı ve somun/pul alt yüzü y = 0) */
export function fastener(kind: FastenerKind, size: string, length = 30): AsmPart {
  const [s, k, m, d1, d2, h] = FASTENER_SIZES[size];
  const D = parseFloat(size.slice(1));
  const feats: any[] = [];
  if (kind === "bolt") {
    const a = sk();
    hex(a, s);
    feats.push({ id: "s1", type: "sketch", name: "Baş", plane: TOP, data: a.d }, ext("e1", "s1", k));
    const b = sk();
    b.circle(0, 0, D / 2);
    feats.push({ id: "s2", type: "sketch", name: "Gövde", plane: TOP, data: b.d }, ext("e2", "s2", length, true));
    return { name: `Cıvata ${size}x${length}`, features: feats };
  }
  if (kind === "nut") {
    const a = sk();
    hex(a, s);
    a.circle(0, 0, D / 2);
    feats.push({ id: "s1", type: "sketch", name: "Somun", plane: TOP, data: a.d }, ext("e1", "s1", m));
    return { name: `Somun ${size}`, features: feats };
  }
  const a = sk();
  a.circle(0, 0, d2 / 2);
  a.circle(0, 0, d1 / 2);
  feats.push({ id: "s1", type: "sketch", name: "Pul", plane: TOP, data: a.d }, ext("e1", "s1", h));
  return { name: `Pul ${size}`, features: feats };
}

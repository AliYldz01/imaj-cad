// Şekil sihirbazları: ölçüleri yazarak, çizim yapmadan parametrik parça (eskiz + ekstrüzyon) üretir.
import type { Feature } from "../doc/types";
import { ORIGIN } from "../doc/types";
import { autoDefine } from "../sketch/define";

export interface WizField { k: string; label: string; v: number | string }
export interface Wizard { id: string; name: string; fields: WizField[]; build: (p: Record<string, any>, uid: () => string) => Feature[] }

type Sk = { pts: Record<string, { x: number; y: number }>; ents: any[]; rels: any[]; dims: any[]; seq: number };
function sk() {
  const d: Sk = { pts: {}, ents: [], rels: [], dims: [], seq: 1 };
  const id = (p: string) => p + d.seq++;
  const rel = (t: string, refs: string[]) => d.rels.push({ id: id("r"), t, refs });
  const pt = (x: number, y: number) => {
    const k = id("p");
    d.pts[k] = { x, y };
    if (Math.abs(x) < 1e-9 && Math.abs(y) < 1e-9) rel("coincident", [k, ORIGIN]);
    return k;
  };
  /** kapalı çokgen: yatay / dikey kenarlara ilişki; `dims` true ise kenar uzunluğu ölçüsü */
  const poly = (q: [number, number][], dims: boolean[] = []) => {
    const ids = q.map(([x, y]) => pt(x, y));
    ids.forEach((a, i) => {
      const j = (i + 1) % ids.length, b = ids[j];
      const l = id("l");
      d.ents.push({ id: l, t: "line", p1: a, p2: b });
      const [x0, y0] = q[i], [x1, y1] = q[j];
      if (Math.abs(y0 - y1) < 1e-9) rel("horizontal", [l]);
      else if (Math.abs(x0 - x1) < 1e-9) rel("vertical", [l]);
      if (dims[i]) {
        const L = Math.hypot(x1 - x0, y1 - y0);
        d.dims.push({ id: id("d"), t: "dist", refs: [a, b], sub: "a", v: L, lp: [(x0 + x1) / 2 + (y1 - y0) * 0.15, (y0 + y1) / 2 - (x1 - x0) * 0.15] });
      }
    });
    return ids;
  };
  const rect = (x0: number, y0: number, x1: number, y1: number) => poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], [true, true, false, false]);
  const circle = (x: number, y: number, r: number, dim = true) => {
    const c = id("c");
    const cp = pt(x, y);
    d.ents.push({ id: c, t: "circle", c: cp, r });
    if (dim) d.dims.push({ id: id("d"), t: "dia", refs: [c], v: 2 * r, lp: [x + r * 0.8, y + r * 1.2] });
    return { c, cp };
  };
  return { d, poly, rect, circle, rel, id };
}
/** Sihirbaz eskizini tam tanımlar (kalan noktalar orijinden yatay / dikey ölçülür) */
const define = (d: Sk) => {
  try {
    autoDefine(d as any);
  } catch {
    /* çözücü yoksa eskiz yine kullanılabilir */
  }
};
const feats = (uid: () => string, name: string, plane: string, d: Sk, depth: number, extra: Record<string, any> = {}): Feature[] => {
  const s = uid();
  define(d);
  return [
    { id: s, type: "sketch", name: name + "-Eskiz", plane: { k: "std", n: plane }, data: d } as any,
    { id: uid(), type: "extrude", name, sketch: s, cut: false, end: "blind", d1: depth, rev: false, dir2: false, end2: "blind", d2: 10, ...extra } as any,
  ];
};
const holesOnCircle = (c: ReturnType<typeof sk>, n: number, pcd: number, dh: number) => {
  const pc = c.circle(0, 0, pcd / 2);
  c.d.ents.find((e) => e.id === pc.c).cons = true;
  let first = "", firstP = "";
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.PI / 2;
    const h = c.circle((pcd / 2) * Math.cos(a), (pcd / 2) * Math.sin(a), dh / 2, i === 0);
    if (n % 2 === 0 && i === n / 2) {
      // ilk deliğin tam karşısındaki delik: orijin, iki deliği birleştiren yapı çizgisinin ortası (dikey + üzerinde ikilisi çözücüde "gereksiz" sayılıyordu)
      const l = c.id("l");
      c.d.ents.push({ id: l, t: "line", p1: firstP, p2: h.cp, cons: true });
      c.rel("midpoint", [ORIGIN, l]);
      c.rel("equal", [h.c, first]);
      continue;
    }
    c.rel("onCircle", [h.cp, pc.c]);
    if (i === 0) {
      firstP = h.cp;
      c.rel("vertical", [h.cp, ORIGIN]);
      first = h.c;
    } else c.rel("equal", [h.c, first]);
  }
};

export const WIZARDS: Wizard[] = [
  {
    id: "plate", name: "Delikli plaka",
    fields: [
      { k: "w", label: "Genişlik", v: 200 }, { k: "h", label: "Derinlik", v: 120 }, { k: "t", label: "Kalınlık", v: 10 },
      { k: "nx", label: "Delik sayısı X", v: 2 }, { k: "ny", label: "Delik sayısı Y", v: 2 }, { k: "dh", label: "Delik Ø", v: 11 }, { k: "e", label: "Kenar mesafesi", v: 20 },
    ],
    build: (p, uid) => {
      const c = sk();
      c.rect(-p.w / 2, -p.h / 2, p.w / 2, p.h / 2);
      // D1-17: köşe deliklerinin konumu kenarlardan "Kenar mesafesi" ile ölçülür (genişlik değişince kenara bağlı kalır)
      const [lb, lr, lt, ll] = c.d.ents.slice(-4).map((e) => e.id);
      const H: { i: number; j: number; c: string; cp: string }[] = [];
      if (p.dh > 0)
        for (let i = 0; i < p.nx; i++)
          for (let j = 0; j < p.ny; j++) {
            const x = p.nx > 1 ? -p.w / 2 + p.e + (i * (p.w - 2 * p.e)) / (p.nx - 1) : 0;
            const y = p.ny > 1 ? -p.h / 2 + p.e + (j * (p.h - 2 * p.e)) / (p.ny - 1) : 0;
            H.push({ i, j, ...c.circle(x, y, p.dh / 2, !H.length) });
          }
      if (H.length > 1 && p.nx > 1 && p.ny > 1) {
        const at = (i: number, j: number) => H.find((q) => q.i === i && q.j === j)!;
        const pd = (pt: string, ln: string, lp: [number, number]) => c.d.dims.push({ id: c.id("d"), t: "pldist", refs: [pt, ln], v: p.e, lp });
        const a = at(0, 0), b = at(p.nx - 1, 0), t = at(0, p.ny - 1);
        pd(a.cp, ll, [-p.w / 2 + p.e / 2, -p.h / 2 - 8]);
        pd(a.cp, lb, [-p.w / 2 - 8, -p.h / 2 + p.e / 2]);
        pd(b.cp, lr, [p.w / 2 - p.e / 2, -p.h / 2 - 8]);
        pd(t.cp, lt, [-p.w / 2 - 8, p.h / 2 - p.e / 2]);
        for (const q of H) {
          if (q !== a) c.rel("equal", [q.c, a.c]);
          if (q.j === 0 && q !== a) c.rel("horizontal", [q.cp, a.cp]);
          if (q.i === 0 && q !== a) c.rel("vertical", [q.cp, a.cp]);
          if (q.j > 0 && q.i > 0) (c.rel("vertical", [q.cp, at(q.i, 0).cp]), c.rel("horizontal", [q.cp, at(0, q.j).cp]));
        }
      }
      return feats(uid, "Plaka", "top", c.d, p.t);
    },
  },
  {
    id: "flange", name: "Flanş",
    fields: [
      { k: "D", label: "Dış Ø", v: 160 }, { k: "d", label: "İç Ø", v: 60 }, { k: "t", label: "Kalınlık", v: 16 },
      { k: "n", label: "Delik sayısı", v: 6 }, { k: "dh", label: "Delik Ø", v: 14 }, { k: "pcd", label: "Delik çemberi Ø", v: 125 },
    ],
    build: (p, uid) => {
      const c = sk();
      c.circle(0, 0, p.D / 2);
      if (p.d > 0) c.circle(0, 0, p.d / 2);
      if (p.n > 0 && p.dh > 0) holesOnCircle(c, p.n, p.pcd, p.dh);
      return feats(uid, "Flanş", "front", c.d, p.t);
    },
  },
  {
    id: "bush", name: "Burç / silindir / boru",
    fields: [{ k: "D", label: "Dış Ø", v: 50 }, { k: "d", label: "İç Ø (0 = dolu)", v: 30 }, { k: "L", label: "Boy", v: 60 }],
    build: (p, uid) => {
      const c = sk();
      c.circle(0, 0, p.D / 2);
      if (p.d > 0) c.circle(0, 0, p.d / 2);
      return feats(uid, "Burç", "front", c.d, p.L);
    },
  },
  {
    id: "shaft", name: "Kademeli mil",
    fields: [{ k: "steps", label: "Kademeler (Ø×boy; …)", v: "30x40; 40x80; 25x30" }],
    build: (p, uid) => {
      const out: Feature[] = [];
      let z = 0;
      String(p.steps).split(/[;\n]/).forEach((s, i) => {
        const m = s.replace(",", ".").match(/([\d.]+)\s*[x×*]\s*([\d.]+)/i);
        if (!m) return;
        const D = +m[1], L = +m[2];
        const c = sk();
        c.circle(0, 0, D / 2);
        out.push(...feats(uid, `Kademe${i + 1}`, "front", c.d, L, z ? { startOff: z } : {}));
        z += L;
      });
      return out;
    },
  },
  {
    id: "lbracket", name: "L braket",
    fields: [{ k: "a", label: "Yatay kol", v: 80 }, { k: "b", label: "Dikey kol", v: 60 }, { k: "t", label: "Kalınlık", v: 8 }, { k: "w", label: "Genişlik", v: 50 }],
    build: (p, uid) => {
      const c = sk();
      c.poly([[0, 0], [p.a, 0], [p.a, p.t], [p.t, p.t], [p.t, p.b], [0, p.b]], [true, true, false, false, false, true]);
      c.d.dims.push({ id: c.id("d"), t: "dist", refs: [Object.keys(c.d.pts)[3], Object.keys(c.d.pts)[2]], sub: "h", v: p.t, lp: [p.t / 2, p.t * 2] });
      return feats(uid, "Braket", "front", c.d, p.w);
    },
  },
  {
    id: "tube", name: "Kutu profil / dikdörtgen boru",
    fields: [{ k: "w", label: "Genişlik", v: 40 }, { k: "h", label: "Yükseklik", v: 40 }, { k: "t", label: "Et kalınlığı", v: 3 }, { k: "L", label: "Boy", v: 500 }],
    build: (p, uid) => {
      const c = sk();
      c.rect(-p.w / 2, -p.h / 2, p.w / 2, p.h / 2);
      if (p.t > 0) {
        const o = Object.keys(c.d.pts);
        const ii = c.poly([[-p.w / 2 + p.t, -p.h / 2 + p.t], [p.w / 2 - p.t, -p.h / 2 + p.t], [p.w / 2 - p.t, p.h / 2 - p.t], [-p.w / 2 + p.t, p.h / 2 - p.t]]);
        c.d.dims.push({ id: c.id("d"), t: "dist", refs: [o[0], ii[0]], sub: "h", v: p.t, lp: [-p.w / 2 + p.t / 2, -p.h / 2 - 6] });
        c.d.dims.push({ id: c.id("d"), t: "dist", refs: [o[0], ii[0]], sub: "v", v: p.t, lp: [-p.w / 2 - 6, -p.h / 2 + p.t / 2] });
        c.d.dims.push({ id: c.id("d"), t: "dist", refs: [ii[2], o[2]], sub: "h", v: p.t, lp: [p.w / 2 - p.t / 2, p.h / 2 + 6] });
        c.d.dims.push({ id: c.id("d"), t: "dist", refs: [ii[2], o[2]], sub: "v", v: p.t, lp: [p.w / 2 + 6, p.h / 2 - p.t / 2] });
      }
      return feats(uid, "Profil", "front", c.d, p.L);
    },
  },
  {
    id: "box", name: "Blok (kutu)",
    fields: [{ k: "w", label: "Genişlik", v: 100 }, { k: "h", label: "Derinlik", v: 60 }, { k: "t", label: "Yükseklik", v: 40 }],
    build: (p, uid) => {
      const c = sk();
      c.rect(-p.w / 2, -p.h / 2, p.w / 2, p.h / 2);
      return feats(uid, "Blok", "top", c.d, p.t);
    },
  },
];

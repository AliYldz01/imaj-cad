// Şekil sihirbazları: ölçüleri yazarak, çizim yapmadan parametrik parça (eskiz + ekstrüzyon) üretir.
import type { Feature } from "../doc/types";

export interface WizField { k: string; label: string; v: number | string }
export interface Wizard { id: string; name: string; fields: WizField[]; build: (p: Record<string, any>, uid: () => string) => Feature[] }

type Sk = { pts: Record<string, { x: number; y: number }>; ents: any[]; rels: any[]; dims: any[]; seq: number };
function sk() {
  const d: Sk = { pts: {}, ents: [], rels: [], dims: [], seq: 1 };
  const id = (p: string) => p + d.seq++;
  const pt = (x: number, y: number) => {
    const k = id("p");
    d.pts[k] = { x, y };
    return k;
  };
  const poly = (q: [number, number][]) => {
    const ids = q.map(([x, y]) => pt(x, y));
    ids.forEach((a, i) => d.ents.push({ id: id("l"), t: "line", p1: a, p2: ids[(i + 1) % ids.length] }));
  };
  const rect = (x0: number, y0: number, x1: number, y1: number) => poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
  const circle = (x: number, y: number, r: number) => {
    const c = id("c");
    d.ents.push({ id: c, t: "circle", c: pt(x, y), r });
    d.dims.push({ id: id("d"), t: "dia", refs: [c], v: 2 * r, lp: [x + r * 0.8, y + r * 1.2] });
  };
  return { d, poly, rect, circle };
}
const feats = (uid: () => string, name: string, plane: string, d: Sk, depth: number, extra: Record<string, any> = {}): Feature[] => {
  const s = uid();
  return [
    { id: s, type: "sketch", name: name + "-Eskiz", plane: { k: "std", n: plane }, data: d } as any,
    { id: uid(), type: "extrude", name, sketch: s, cut: false, end: "blind", d1: depth, rev: false, dir2: false, end2: "blind", d2: 10, ...extra } as any,
  ];
};
const holesOnCircle = (c: ReturnType<typeof sk>, n: number, pcd: number, dh: number) => {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.PI / 2;
    c.circle((pcd / 2) * Math.cos(a), (pcd / 2) * Math.sin(a), dh / 2);
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
      if (p.dh > 0)
        for (let i = 0; i < p.nx; i++)
          for (let j = 0; j < p.ny; j++) {
            const x = p.nx > 1 ? -p.w / 2 + p.e + (i * (p.w - 2 * p.e)) / (p.nx - 1) : 0;
            const y = p.ny > 1 ? -p.h / 2 + p.e + (j * (p.h - 2 * p.e)) / (p.ny - 1) : 0;
            c.circle(x, y, p.dh / 2);
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
      c.poly([[0, 0], [p.a, 0], [p.a, p.t], [p.t, p.t], [p.t, p.b], [0, p.b]]);
      return feats(uid, "Braket", "front", c.d, p.w);
    },
  },
  {
    id: "tube", name: "Kutu profil / dikdörtgen boru",
    fields: [{ k: "w", label: "Genişlik", v: 40 }, { k: "h", label: "Yükseklik", v: 40 }, { k: "t", label: "Et kalınlığı", v: 3 }, { k: "L", label: "Boy", v: 500 }],
    build: (p, uid) => {
      const c = sk();
      c.rect(-p.w / 2, -p.h / 2, p.w / 2, p.h / 2);
      if (p.t > 0) c.rect(-p.w / 2 + p.t, -p.h / 2 + p.t, p.w / 2 - p.t, p.h / 2 - p.t);
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

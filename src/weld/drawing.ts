// Kesim listesi kalemleri için imalat resmi (A4 yatay, SVG) ve levhalar için 1:1 DXF.
import type { DrawData, DrawView, Vec2 } from "../doc/types";

export interface SheetInfo {
  project: string;
  no: number;
  qty: number;
  desc: string;
  material: string;
  kg: number;
  a1: number;
  a2: number;
  length: number;
  date: string;
}

const SCALES = [5, 2, 1, 1 / 2, 1 / 2.5, 1 / 5, 1 / 10, 1 / 20, 1 / 25, 1 / 50, 1 / 100, 1 / 200];
const scaleLabel = (s: number) => (s >= 1 ? `${s}:1` : `1:${Math.round((1 / s) * 10) / 10}`);
const pickScale = (need: number) => SCALES.find((s) => s <= need) ?? SCALES[SCALES.length - 1];
const f1 = (v: number) => (Math.round(v * 10) / 10).toString().replace(".", ",");
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const W = 297, H = 210, M = 10;
/** antet kutusu */
const TB = { x: 297 - M - 120, y: 210 - M - 42, w: 120, h: 42 };

export class Svg {
  parts: string[] = [];
  line(x1: number, y1: number, x2: number, y2: number, cls = "v") {
    this.parts.push(`<line class="${cls}" x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"/>`);
  }
  circle(x: number, y: number, r: number, cls = "v") {
    this.parts.push(`<circle class="${cls}" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${r.toFixed(2)}"/>`);
  }
  text(x: number, y: number, s: string, size = 3, anchor = "middle", rot = 0, cls = "t") {
    const tr = rot ? ` transform="rotate(${rot} ${x.toFixed(2)} ${y.toFixed(2)})"` : "";
    this.parts.push(`<text class="${cls}" x="${x.toFixed(2)}" y="${y.toFixed(2)}" font-size="${size}" text-anchor="${anchor}"${tr}>${esc(s)}</text>`);
  }
  arrow(x: number, y: number, dx: number, dy: number) {
    const L = 2.2, w = 0.7;
    const nx = -dy, ny = dx;
    this.parts.push(`<path class="ar" d="M${x.toFixed(2)} ${y.toFixed(2)} L${(x - dx * L + nx * w).toFixed(2)} ${(y - dy * L + ny * w).toFixed(2)} L${(x - dx * L - nx * w).toFixed(2)} ${(y - dy * L - ny * w).toFixed(2)}Z"/>`);
  }
  /** yatay ölçü: (x1,ya) ve (x2,yb) noktaları, ölçü çizgisi y */
  dimH(x1: number, ya: number, x2: number, yb: number, y: number, label: string) {
    if (Math.abs(x2 - x1) < 0.01) return;
    const s = Math.sign(y - ya) || 1;
    this.line(x1, ya + s * 0.8, x1, y + s * 1.5, "d");
    this.line(x2, yb + s * 0.8, x2, y + s * 1.5, "d");
    this.line(x1, y, x2, y, "d");
    const dir = Math.sign(x2 - x1);
    this.arrow(x1, y, -dir, 0);
    this.arrow(x2, y, dir, 0);
    this.text((x1 + x2) / 2, y - 0.8, label, 2.8);
  }
  dimV(xa: number, y1: number, xb: number, y2: number, x: number, label: string) {
    if (Math.abs(y2 - y1) < 0.01) return;
    const s = Math.sign(x - xa) || 1;
    this.line(xa + s * 0.8, y1, x + s * 1.5, y1, "d");
    this.line(xb + s * 0.8, y2, x + s * 1.5, y2, "d");
    this.line(x, y1, x, y2, "d");
    const dir = Math.sign(y2 - y1);
    this.arrow(x, y1, 0, -dir);
    this.arrow(x, y2, 0, dir);
    this.text(x - 0.8, (y1 + y2) / 2, label, 2.8, "middle", -90);
  }
}

/** Görünüşü kağıda yerleştirir: sol üst köşe (ox, oy), ölçek s */
export function placeView(svg: Svg, v: DrawView, ox: number, oy: number, s: number) {
  const X = (x: number) => ox + (x - v.min[0]) * s;
  const Y = (y: number) => oy + (v.max[1] - y) * s;
  for (let i = 0; i < v.hid.length; i += 4) svg.line(X(v.hid[i]), Y(v.hid[i + 1]), X(v.hid[i + 2]), Y(v.hid[i + 3]), "h");
  for (let i = 0; i < v.vis.length; i += 4) svg.line(X(v.vis[i]), Y(v.vis[i + 1]), X(v.vis[i + 2]), Y(v.vis[i + 3]), "v");
  for (const c of v.circles) svg.circle(X(c.c[0]), Y(c.c[1]), c.r * s, c.hidden ? "h" : "v");
  return { X, Y, w: (v.max[0] - v.min[0]) * s, h: (v.max[1] - v.min[1]) * s };
}

const vw = (v: DrawView) => Math.max(1e-6, v.max[0] - v.min[0]);
const vh = (v: DrawView) => Math.max(1e-6, v.max[1] - v.min[1]);

function titleBlock(svg: Svg, info: SheetInfo, d: DrawData, scale: string) {
  const { x, y, w, h } = TB;
  svg.parts.push(`<rect class="v" x="${x}" y="${y}" width="${w}" height="${h}" fill="none"/>`);
  const rows: [string, string][] = [
    ["Proje", info.project],
    ["Parça no / Adet", `${info.no}  /  ${info.qty} adet`],
    ["Tanım", info.desc],
    [d.kind === "member" ? "Kesim boyu" : d.kind === "plate" ? "Kalınlık" : "Boy", d.kind === "plate" ? `${f1(d.t ?? 0)} mm` : `${f1(info.length)} mm`],
    ["Uç açıları", d.kind === "member" ? `${f1(info.a1)}° / ${f1(info.a2)}°` : "-"],
    ["Malzeme", info.material],
    ["Birim ağırlık", info.kg > 0 ? `${(Math.round(info.kg * 1000) / 1000).toString().replace(".", ",")} kg` : "-"],
    ["Ölçek / Tarih", `${scale}  ·  ${info.date}`],
  ];
  const rh = (h - 6) / rows.length;
  svg.parts.push(`<rect x="${x}" y="${y}" width="${w}" height="6" fill="#eef1f5" stroke="#000" stroke-width="0.35"/>`);
  svg.text(x + 3, y + 4.4, "İMAJ CAD — İMALAT RESMİ", 3.2, "start", 0, "tb");
  rows.forEach(([k, v], i) => {
    const yy = y + 6 + rh * (i + 1);
    svg.line(x, yy, x + w, yy, "g");
    svg.text(x + 2, yy - rh / 2 + 1.1, k, 2.4, "start", 0, "tk");
    svg.text(x + 34, yy - rh / 2 + 1.1, v, 2.9, "start", 0, "t");
  });
  svg.line(x + 32, y + 6, x + 32, y + h, "g");
}

export function sheetSvg(d: DrawData, info: SheetInfo): string {
  const svg = new Svg();
  svg.parts.push(`<rect class="v" x="${M}" y="${M}" width="${W - 2 * M}" height="${H - 2 * M}" fill="none"/>`);
  const area = { x: M + 8, y: M + 12, w: W - 2 * M - 16, h: TB.y - M - 22 };
  let scaleTxt = "";
  const [A, B, C] = d.views;
  if (d.kind === "member" && A && B && C) {
    // kesit için ayrı ölçek (detay)
    const sc = pickScale(Math.min(55 / vw(C), 55 / vh(C)));
    const secW = vw(C) * sc + 20;
    const s = pickScale(Math.min((area.w - secW - 20) / Math.max(vw(A), vw(B)), (area.h - 40) / (vh(A) + vh(B))));
    scaleTxt = `${scaleLabel(s)} (kesit ${scaleLabel(sc)})`;
    const ox = area.x + 6;
    const pa = placeView(svg, A, ox, area.y + 16, s);
    svg.text(ox, area.y + 2, `${A.name}`, 3, "start", 0, "vt");
    const hn = Math.min(6, d.holes.filter((hh) => hh.view === 0).length);
    const oyB = area.y + 16 + pa.h + 18 + hn * 5;
    const pb = placeView(svg, B, ox, oyB, s);
    svg.text(ox, oyB - 4, `${B.name}`, 3, "start", 0, "vt");
    // toplam boy
    svg.dimH(pa.X(A.min[0]), pa.Y(A.max[1]), pa.X(A.max[0]), pa.Y(A.max[1]), pa.Y(A.max[1]) - 6, f1(d.length));
    // uç açıları
    if (info.a1 > 0.05) svg.text(pa.X(A.min[0]) + 1, pa.Y(A.min[1]) + 5, `${f1(info.a1)}°`, 2.8, "start", 0, "an");
    if (info.a2 > 0.05) svg.text(pa.X(A.max[0]) - 1, pa.Y(A.min[1]) + 5, `${f1(info.a2)}°`, 2.8, "end", 0, "an");
    // delikler: soldan referanslı ölçüler
    const placed = [pa, pb];
    [0, 1].forEach((vi) => {
      const hs = d.holes.filter((hh) => hh.view === vi).sort((p, q) => p.c[0] - q.c[0]);
      const pv = placed[vi], V = d.views[vi];
      const baseY = pv.Y(V.min[1]) + 7;
      hs.forEach((hh, k) => {
        const cx = pv.X(hh.c[0]), cy = pv.Y(hh.c[1]);
        svg.line(cx - 2, cy, cx + 2, cy, "c");
        svg.line(cx, cy - 2, cx, cy + 2, "c");
        if (k < 6) svg.dimH(pv.X(V.min[0]), pv.Y(V.min[1]), cx, cy, baseY + k * 5, f1(hh.c[0] - V.min[0]));
      });
      // çap notları (aynı çaplar gruplanır)
      const groups = new Map<string, number>();
      hs.forEach((hh) => groups.set(f1(hh.d), (groups.get(f1(hh.d)) ?? 0) + 1));
      let ty = pv.Y(V.max[1]) - 2;
      for (const [dd, n] of groups) {
        svg.text(pv.X(V.max[0]) + 4, ty + 3, `${n > 1 ? n + " x " : ""}Ø${dd}`, 2.8, "start", 0, "an");
        ty += 4;
      }
    });
    // kesit
    const ocx = area.x + area.w - secW + 8;
    const pc = placeView(svg, C, ocx, area.y + 16, sc);
    svg.text(ocx, area.y + 2, `${C.name}`, 3, "start", 0, "vt");
    svg.dimH(pc.X(C.min[0]), pc.Y(C.min[1]), pc.X(C.max[0]), pc.Y(C.min[1]), pc.Y(C.min[1]) + 6, f1(vw(C)));
    svg.dimV(pc.X(C.max[0]), pc.Y(C.max[1]), pc.X(C.max[0]), pc.Y(C.min[1]), pc.X(C.max[0]) + 6, f1(vh(C)));
  } else if (A) {
    const views = d.views;
    const side = views[2];
    const s = pickScale(Math.min((area.w - 30 - (side ? vw(side) : 0) * 0) / (vw(A) + (side ? vw(side) + 30 : 0)), (area.h - 30) / (vh(A) + (B ? vh(B) + 25 : 0))));
    scaleTxt = scaleLabel(s);
    const ox = area.x + 12;
    const pa = placeView(svg, A, ox, area.y + 12, s);
    svg.text(ox, area.y + 6, A.name, 3, "start", 0, "vt");
    svg.dimH(pa.X(A.min[0]), pa.Y(A.min[1]), pa.X(A.max[0]), pa.Y(A.min[1]), pa.Y(A.min[1]) + 7, f1(vw(A)));
    svg.dimV(pa.X(A.min[0]), pa.Y(A.min[1]), pa.X(A.min[0]), pa.Y(A.max[1]), pa.X(A.min[0]) - 7, f1(vh(A)));
    if (B) {
      const oyB = area.y + 12 + pa.h + 22;
      const pb = placeView(svg, B, ox, oyB, s);
      svg.text(ox, oyB - 4, B.name, 3, "start", 0, "vt");
      svg.dimV(pb.X(B.max[0]), pb.Y(B.min[1]), pb.X(B.max[0]), pb.Y(B.max[1]), pb.X(B.max[0]) + 6, f1(vh(B)));
    }
    if (side) {
      const ocx = ox + pa.w + 30;
      const pc = placeView(svg, side, ocx, area.y + 12, s);
      svg.text(ocx, area.y + 6, side.name, 3, "start", 0, "vt");
      svg.dimV(pc.X(side.max[0]), pc.Y(side.min[1]), pc.X(side.max[0]), pc.Y(side.max[1]), pc.X(side.max[0]) + 6, f1(vh(side)));
    }
    // delikler (levha): sol alt köşeden koordinat tablosu
    const hs = d.holes.filter((hh) => hh.view === 0);
    hs.forEach((hh, k) => {
      const cx = pa.X(hh.c[0]), cy = pa.Y(hh.c[1]);
      svg.line(cx - 2, cy, cx + 2, cy, "c");
      svg.line(cx, cy - 2, cx, cy + 2, "c");
      svg.text(cx + 1.5, cy - 1.5, `D${k + 1}`, 2.4, "start", 0, "an");
    });
    if (hs.length) {
      let ty = area.y + 8;
      const tx = area.x + area.w - 58;
      svg.text(tx, ty, "Delik  X  Y  Ø  (sol alt köşeden)", 2.6, "start", 0, "tk");
      hs.slice(0, 18).forEach((hh, k) => {
        ty += 4;
        svg.text(tx, ty, `D${k + 1}   ${f1(hh.c[0] - A.min[0])}   ${f1(hh.c[1] - A.min[1])}   Ø${f1(hh.d)}`, 2.6, "start", 0, "t");
      });
    }
  }
  titleBlock(svg, info, d, scaleTxt);
  const style = `<style>
    .v{stroke:#000;stroke-width:0.45;fill:none;stroke-linecap:round}
    .h{stroke:#555;stroke-width:0.25;fill:none;stroke-dasharray:1.6 0.9}
    .d{stroke:#1c5fd1;stroke-width:0.18;fill:none}
    .c{stroke:#c0392b;stroke-width:0.18}
    .g{stroke:#000;stroke-width:0.25}
    .ar{fill:#1c5fd1;stroke:none}
    text{font-family:Arial,'DejaVu Sans',sans-serif}
    .t{fill:#000}.tk{fill:#555}.tb{fill:#000;font-weight:bold}.vt{fill:#333;font-weight:bold}.an{fill:#c0392b}
  </style>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="297mm" height="210mm" viewBox="0 0 297 210">${style}<rect x="0" y="0" width="297" height="210" fill="#fff"/>${svg.parts.join("")}</svg>`;
}

/** Levha görünüşünün 1:1 DXF'i (lazer / plazma kesim için) */
export function plateDxf(v: DrawView): string {
  const o: string[] = [];
  const p = (c: number, val: string | number) => o.push(String(c), typeof val === "number" ? (Math.round(val * 1e6) / 1e6).toString() : val);
  const ox = v.min[0], oy = v.min[1];
  p(0, "SECTION"); p(2, "HEADER"); p(9, "$ACADVER"); p(1, "AC1009"); p(9, "$INSUNITS"); p(70, "4"); p(0, "ENDSEC");
  p(0, "SECTION"); p(2, "TABLES"); p(0, "TABLE"); p(2, "LAYER"); p(70, "1");
  p(0, "LAYER"); p(2, "KESIM"); p(70, "0"); p(62, "7"); p(6, "CONTINUOUS");
  p(0, "ENDTAB"); p(0, "ENDSEC");
  p(0, "SECTION"); p(2, "ENTITIES");
  for (let i = 0; i < v.vis.length; i += 4) {
    p(0, "LINE"); p(8, "KESIM"); p(10, v.vis[i] - ox); p(20, v.vis[i + 1] - oy); p(30, 0); p(11, v.vis[i + 2] - ox); p(21, v.vis[i + 3] - oy); p(31, 0);
  }
  for (const c of v.circles) {
    if (c.hidden) continue;
    p(0, "CIRCLE"); p(8, "KESIM"); p(10, c.c[0] - ox); p(20, c.c[1] - oy); p(30, 0); p(40, c.r);
  }
  p(0, "ENDSEC"); p(0, "EOF");
  return o.join("\n") + "\n";
}

export const sheetsHtml = (svgs: string[], title: string) =>
  `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
  @page{size:A4 landscape;margin:0}
  html,body{margin:0;background:#e9ecef}
  .page{width:297mm;height:210mm;margin:8px auto;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.2);page-break-after:always;overflow:hidden}
  .page svg{width:100%;height:100%;display:block}
  @media print{html,body{background:#fff}.page{margin:0;box-shadow:none}}
  @media (max-width:1100px){.page{width:96vw;height:calc(96vw*210/297)}}
  </style></head><body>${svgs.map((s) => `<div class="page">${s}</div>`).join("")}</body></html>`;

export type { Vec2 };

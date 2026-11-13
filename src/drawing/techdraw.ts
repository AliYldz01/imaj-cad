// Teknik resim (SolidWorks Drawing benzeri): ilk açı (ISO E) standart görünüşler, izometrik, kesit A-A,
// otomatik ölçüler (toplam boyutlar, delik çapları ve konumları), antet, montajda malzeme listesi + balonlar.
import type { DrawView, Vec2, Vec3 } from "../doc/types";
import { Svg, placeView } from "../weld/drawing";

export interface TechData {
  views: DrawView[];
  iso: DrawView | null;
  sec: (DrawView & { hatch: number[][] }) | null;
  size: Vec3;
  c: Vec3;
  centers?: (Vec3 | null)[];
}
export interface TechInfo {
  title: string;
  material: string;
  drawnBy: string;
  date: string;
  no: string;
  paper: "A4" | "A3";
  scale: number | 0; // 0 = otomatik
  dims: boolean;
  bom?: { no: number; name: string; qty: number }[];
  /** balon: bileşen sırası → BOM no */
  balloonOf?: number[];
}

const SCALES = [10, 5, 2, 1, 1 / 2, 1 / 2.5, 1 / 5, 1 / 10, 1 / 20, 1 / 25, 1 / 50, 1 / 100, 1 / 200];
export const scaleLabel = (s: number) => (s >= 1 ? `${Math.round(s * 10) / 10}:1` : `1:${Math.round((1 / s) * 10) / 10}`);
const f1 = (v: number) => (Math.round(v * 100) / 100).toString().replace(".", ",");
const vw = (v: DrawView) => Math.max(1e-6, v.max[0] - v.min[0]);
const vh = (v: DrawView) => Math.max(1e-6, v.max[1] - v.min[1]);

/** görünüşteki benzersiz delik / daire çevreleri (tam daireler + yaylardan) */
export function circlesOf(v: DrawView): { c: Vec2; r: number }[] {
  const all = [...v.circles.filter((c) => !c.hidden), ...(v.arcs ?? []).filter((c) => !c.hidden)];
  const out: { c: Vec2; r: number }[] = [];
  for (const c of all) if (!out.some((o) => Math.hypot(o.c[0] - c.c[0], o.c[1] - c.c[1]) < 1e-3 && Math.abs(o.r - c.r) < 1e-3)) out.push({ c: c.c, r: c.r });
  return out;
}

export function techSheet(d: TechData, info: TechInfo): { svg: string; scale: number } {
  const W = info.paper === "A3" ? 420 : 297, H = info.paper === "A3" ? 297 : 210, M = 10;
  const TB = { w: 130, h: 36 };
  const tbx = W - M - TB.w, tby = H - M - TB.h;
  const svg = new Svg();
  svg.parts.push(`<rect class="v" x="${M}" y="${M}" width="${W - 2 * M}" height="${H - 2 * M}" fill="none"/>`);
  const asm = !!info.bom;
  const [F, T, L] = d.views;
  const S = d.sec, I = d.iso;
  // ızgara: üst sıra [ön, sol, (izo)], alt sıra [üst, kesit]; montajda yalnız izometrik büyük + ön/üst küçük
  const gap = info.dims ? 20 : 12;
  const cols = asm ? [vw(I ?? F)] : [Math.max(vw(F), vw(T)), Math.max(vw(L), S ? vw(S) : 0), ...(I && S ? [vw(I)] : [])];
  const rws = asm ? [vh(I ?? F)] : [Math.max(vh(F), vh(L), I && S ? vh(I) : 0), Math.max(vh(T), S ? vh(S) : I ? vh(I) : 0)];
  const bomW = asm ? 95 : 0;
  const availW = W - 2 * M - 10 - bomW - gap * cols.length, availH = H - 2 * M - TB.h - 14 - gap * rws.length;
  const need = Math.min(availW / cols.reduce((a, b) => a + b, 0), availH / rws.reduce((a, b) => a + b, 0));
  const s = info.scale || SCALES.find((x) => x <= need) || SCALES[SCALES.length - 1];
  const x0 = M + 5 + gap, y0 = M + 8 + 4;
  const place = (v: DrawView, cx: number, cy: number, cw: number, ch: number) => {
    // hücre içinde ortala
    const ox = cx + (cw * s - vw(v) * s) / 2, oy = cy + (ch * s - vh(v) * s) / 2;
    const p = placeView(svg, v, ox, oy, s);
    if (!asm) svg.text(ox + p.w / 2, oy - 3, v.name.toLocaleUpperCase("tr-TR"), 3, "middle", 0, "vt");
    return { ...p, ox, oy };
  };
  const out: Record<string, ReturnType<typeof place>> = {};
  if (asm) {
    const v = I ?? F;
    out.iso = place(v, x0, y0, cols[0], rws[0]);
  } else {
    const cx = [x0, x0 + cols[0] * s + gap, x0 + (cols[0] + cols[1]) * s + 2 * gap];
    const cy = [y0, y0 + rws[0] * s + gap];
    out.front = place(F, cx[0], cy[0], cols[0], rws[0]);
    out.left = place(L, cx[1], cy[0], cols[1], rws[0]);
    out.top = place(T, cx[0], cy[1], cols[0], rws[1]);
    if (S) out.sec = place(S, cx[1], cy[1], cols[1], rws[1]);
    if (I) out.iso = S ? place(I, cx[2], cy[0], cols[2], rws[0]) : place(I, cx[1], cy[1], cols[1], rws[1]);
  }
  // kesit taraması
  if (S && out.sec) {
    const { X, Y } = out.sec;
    const path = S.hatch.map((L) => "M" + L.reduce((acc: string[], _v, i) => (i % 2 ? acc : [...acc, `${X(L[i]).toFixed(2)} ${Y(L[i + 1]).toFixed(2)}`]), []).join(" L") + "Z").join(" ");
    svg.parts.push(`<path d="${path}" fill="url(#hatch)" fill-rule="evenodd" stroke="none"/>`);
    // kesme düzlemi üst görünüşte (z = merkez → görünüş y = 0)
    if (out.top) {
      const { X: tx, Y: ty, w } = out.top;
      const y = ty(0), xa = tx(T.min[0]) - 6, xb = tx(T.min[0]) + w + 6;
      svg.line(xa, y, xb, y, "c");
      svg.line(xa, y, xa, y + 5, "v");
      svg.line(xb, y, xb, y + 5, "v");
      svg.arrow(xa, y + 5, 0, 1);
      svg.arrow(xb, y + 5, 0, 1);
      svg.text(xa - 2, y - 1.5, "A", 3.5, "middle", 0, "tb");
      svg.text(xb + 2, y - 1.5, "A", 3.5, "middle", 0, "tb");
    }
  }
  // ölçüler
  if (info.dims && !asm && out.front && out.top) {
    const { X, Y, w, h, ox, oy } = out.front;
    svg.dimH(ox, oy + h, ox + w, oy + h, oy + h + 8, f1(vw(F)));
    svg.dimV(ox, oy, ox, oy + h, ox - 8, f1(vh(F)));
    const tp = out.top;
    svg.dimV(tp.ox + tp.w, tp.oy, tp.ox + tp.w, tp.oy + tp.h, tp.ox + tp.w + 8, f1(vh(T)));
    // delikler: ön görünüşte çaplar ve konumlar (sol alt köşeden)
    const cs = circlesOf(F).filter((c) => c.r * 2 < Math.min(vw(F), vh(F)) * 0.98);
    const byR = new Map<string, number>();
    cs.forEach((c) => byR.set(f1(c.r * 2), (byR.get(f1(c.r * 2)) ?? 0) + 1));
    const labeled = new Set<string>(), usedX = new Set<string>(), usedY = new Set<string>();
    cs.slice(0, 12).forEach((c, i) => {
      const cx = X(c.c[0]), cy = Y(c.c[1]), r = c.r * s;
      svg.line(cx - r - 1.5, cy, cx + r + 1.5, cy, "c");
      svg.line(cx, cy - r - 1.5, cx, cy + r + 1.5, "c");
      const key = f1(c.r * 2);
      if (!labeled.has(key)) {
        labeled.add(key);
        const n = byR.get(key)!;
        const lx = cx + r * 0.71 + 6, ly = cy - r * 0.71 - 6;
        svg.line(cx + r * 0.71, cy - r * 0.71, lx, ly, "d");
        svg.line(lx, ly, lx + 12, ly, "d");
        svg.arrow(cx + r * 0.71, cy - r * 0.71, -0.71, 0.71);
        svg.text(lx + 1, ly - 0.8, `${n > 1 ? n + "× " : ""}Ø${key}`, 2.8, "start");
      }
      const kx = f1(c.c[0] - F.min[0]), ky = f1(c.c[1] - F.min[1]);
      if (!usedX.has(kx) && usedX.size < 6) svg.dimH(ox, oy + h, cx, cy, oy + h + 14 + usedX.size * 5, kx), usedX.add(kx);
      if (!usedY.has(ky) && usedY.size < 6) svg.dimV(ox, oy + h, cx, cy, ox - 14 - usedY.size * 5, ky), usedY.add(ky);
    });
  }
  // montaj: balonlar ve malzeme listesi
  if (asm && out.iso && d.centers && info.balloonOf && I) {
    const dir: Vec3 = [1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3)], xa: Vec3 = [1 / Math.SQRT2, 0, -1 / Math.SQRT2];
    const ya: Vec3 = [dir[1] * xa[2] - dir[2] * xa[1], dir[2] * xa[0] - dir[0] * xa[2], dir[0] * xa[1] - dir[1] * xa[0]];
    const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const { X, Y, ox, oy, w, h } = out.iso;
    const mx = ox + w / 2, my = oy + h / 2;
    const done = new Set<number>();
    const placedB: [number, number][] = [];
    d.centers.forEach((p, i) => {
      const no = info.balloonOf![i];
      if (!p || done.has(no)) return;
      done.add(no);
      const r: Vec3 = [p[0] - d.c[0], p[1] - d.c[1], p[2] - d.c[2]];
      const px = X(dot(r, xa)), py = Y(dot(r, ya));
      let ang = Math.hypot(px - mx, py - my) > 5 ? Math.atan2(py - my, px - mx) : -Math.PI / 2 + done.size * 1.1;
      const R = Math.max(w, h) * 0.42 + 12;
      let bx = 0, by = 0;
      for (let k = 0; k < 14; k++) {
        bx = Math.min(W - M - bomW - 8, Math.max(M + 8, mx + Math.cos(ang) * R));
        by = Math.min(tby - 8, Math.max(M + 8, my + Math.sin(ang) * R));
        if (!placedB.some(([qx, qy]) => Math.hypot(qx - bx, qy - by) < 11)) break;
        ang += 0.45;
      }
      placedB.push([bx, by]);
      const L = Math.hypot(bx - px, by - py) || 1, dx = (bx - px) / L, dy = (by - py) / L;
      svg.parts.push(`<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="0.6" fill="#000"/>`);
      svg.line(px, py, bx - dx * 4, by - dy * 4, "g");
      svg.parts.push(`<circle class="v" cx="${bx.toFixed(2)}" cy="${by.toFixed(2)}" r="4" fill="#fff"/>`);
      svg.text(bx, by + 1.2, String(no), 3.4, "middle", 0, "tb");
    });
  }
  if (asm && info.bom) {
    const bx = W - M - bomW + 2, rowH = 6;
    let by = M + 6;
    const cw = [10, 63, 18];
    const row = (vals: string[], head = false) => {
      let x = bx;
      svg.parts.push(`<rect x="${bx}" y="${by}" width="${cw.reduce((a, b) => a + b)}" height="${rowH}" fill="${head ? "#eef1f5" : "none"}" stroke="#000" stroke-width="0.25"/>`);
      vals.forEach((v, k) => {
        svg.text(x + (k === 1 ? 1.5 : cw[k] / 2), by + 4.2, v, 2.8, k === 1 ? "start" : "middle", 0, head ? "tb" : "t");
        x += cw[k];
        if (k < 2) svg.line(x, by, x, by + rowH, "g");
      });
      by += rowH;
    };
    row(["No", "Parça adı", "Adet"], true);
    for (const r of info.bom) row([String(r.no), r.name, String(r.qty)]);
  }
  // antet
  const rows: [string, string][] = [
    ["Parça / montaj", info.title],
    ["Malzeme", info.material || "-"],
    ["Ölçek", scaleLabel(s) + "   ·   İlk açı (ISO E)"],
    ["Çizen / Tarih", `${info.drawnBy || "-"}  ·  ${info.date}`],
    ["Resim no", info.no || "-"],
  ];
  svg.parts.push(`<rect class="v" x="${tbx}" y="${tby}" width="${TB.w}" height="${TB.h}" fill="none"/>`);
  const rh = TB.h / rows.length;
  rows.forEach(([k, v], i) => {
    const yy = tby + rh * (i + 1);
    if (i < rows.length - 1) svg.line(tbx, yy, tbx + TB.w, yy, "g");
    svg.text(tbx + 2, yy - rh / 2 + 1, k, 2.3, "start", 0, "tk");
    svg.text(tbx + 30, yy - rh / 2 + 1.1, v, i === 0 ? 3.4 : 2.9, "start", 0, i === 0 ? "tb" : "t");
  });
  svg.line(tbx + 28, tby, tbx + 28, tby + TB.h, "g");
  svg.text(M + 3, H - M - 3, "Genel toleranslar: ISO 2768-m · Ölçüler mm · İmaj CAD", 2.4, "start", 0, "tk");
  const style = `<style>
    .v{stroke:#000;stroke-width:0.45;fill:none;stroke-linecap:round}
    .h{stroke:#555;stroke-width:0.25;fill:none;stroke-dasharray:1.6 0.9}
    .d{stroke:#1c5fd1;stroke-width:0.18;fill:none}
    .c{stroke:#c0392b;stroke-width:0.18;stroke-dasharray:6 1 1 1}
    .g{stroke:#000;stroke-width:0.25}
    .ar{fill:#1c5fd1;stroke:none}
    text{font-family:Arial,'DejaVu Sans',sans-serif}
    .t{fill:#000}.tk{fill:#555}.tb{fill:#000;font-weight:bold}.vt{fill:#333;font-weight:bold}
  </style><defs><pattern id="hatch" width="2.5" height="2.5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="2.5" stroke="#000" stroke-width="0.25"/></pattern></defs>`;
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">${style}<rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>${svg.parts.join("")}</svg>`, scale: s };
}

/** sayfadaki çizgi ve daireleri DXF'e (R12) aktar: SVG'den okur (mm, y aşağı → yukarı) */
export function sheetDxf(svgText: string, H: number): string {
  const o: string[] = [];
  const p = (c: number, v: string | number) => o.push(String(c), typeof v === "number" ? v.toFixed(4) : v);
  p(0, "SECTION"); p(2, "ENTITIES");
  const num = (s: string, k: string) => parseFloat((s.match(new RegExp(`${k}="([-0-9.]+)"`)) ?? [])[1] ?? "NaN");
  for (const m of svgText.matchAll(/<line class="(\w+)"([^>]*)\/>/g)) {
    const a = m[2];
    const layer = m[1] === "h" ? "GIZLI" : m[1] === "d" ? "OLCU" : m[1] === "c" ? "EKSEN" : "GORUNUR";
    p(0, "LINE"); p(8, layer); p(10, num(a, "x1")); p(20, H - num(a, "y1")); p(30, 0); p(11, num(a, "x2")); p(21, H - num(a, "y2")); p(31, 0);
  }
  for (const m of svgText.matchAll(/<circle class="(\w+)"([^>]*)\/>/g)) {
    const a = m[2];
    p(0, "CIRCLE"); p(8, m[1] === "h" ? "GIZLI" : "GORUNUR"); p(10, num(a, "cx")); p(20, H - num(a, "cy")); p(30, 0); p(40, num(a, "r"));
  }
  for (const m of svgText.matchAll(/<text class="(\w+)" x="([-0-9.]+)" y="([-0-9.]+)" font-size="([0-9.]+)"[^>]*>([^<]*)<\/text>/g)) {
    p(0, "TEXT"); p(8, "YAZI"); p(10, parseFloat(m[2])); p(20, H - parseFloat(m[3])); p(30, 0); p(40, parseFloat(m[4]) * 0.8); p(1, m[5].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"));
  }
  p(0, "ENDSEC"); p(0, "EOF");
  return o.join("\n") + "\n";
}

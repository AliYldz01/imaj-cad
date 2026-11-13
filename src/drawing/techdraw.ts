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
  /** sürüklenmiş ölçüler: anahtar → [dx, dy] kağıt mm */
  off?: Record<string, [number, number]>;
  /** detay görünüşü B: ön görünüş koordinatlarında merkez / yarıçap, büyütme k */
  detail?: { x: number; y: number; r: number; k: number } | null;
  /** sayfa no / toplam (antette) */
  page?: [number, number];
  /** kullanıcı ölçüleri, otomatik ölçü düzeltmeleri, açıklamalar (pürüzlülük, geometrik tolerans, referans), görünüş ötelemeleri */
  user?: UDim[];
  ovr?: Record<string, DimOvr>;
  notes?: Annot[];
  vOff?: Record<string, [number, number]>;
  /** kaynaklı yapı: kesim listesi tablosu (balon no = satır no), balon merkezleri, kaynak listesi */
  cut?: { no: number; name: string; len: number; a1: number; a2: number; qty: number }[];
  cutCenters?: { no: number; c: Vec3 }[];
  welds?: { name: string; a: number; length: number; count: number }[];
}
/** ölçü toleransı: simetrik ±, sapma (+üst / −alt), sınır (üst / alt boyut), ISO uyum (H7 vb.) */
export interface Tol { t: "none" | "sym" | "dev" | "lim" | "fit"; up?: number; lo?: number; fit?: string }
/** kullanıcı ölçüsü: görünüş koordinatlarında iki nokta (çapta a = merkez, b[0] = yarıçap); off = kağıtta ölçü çizgisi uzaklığı */
export interface UDim { id: string; view: string; a: Vec2; b: Vec2; dir: "h" | "v" | "al" | "d"; off: number; text?: string; tol?: Tol }
export interface DimOvr { text?: string; tol?: Tol; hide?: boolean }
/** açıklamalar: yüzey pürüzlülüğü (ISO 1302), geometrik tolerans çerçevesi (ISO 1101), referans (datum) */
export interface Annot { id: string; kind: "ra" | "gdt" | "datum"; view: string; at: Vec2; ra?: string; proc?: "any" | "req" | "proh"; sym?: string; tol?: string; dat?: string; letter?: string }
export const GDT_SYMS: [string, string][] = [
  ["⏤", "Doğrusallık"], ["⏥", "Düzlemsellik"], ["○", "Dairesellik"], ["⌭", "Silindiriklik"], ["⌒", "Çizgi profili"], ["⌓", "Yüzey profili"],
  ["∥", "Paralellik"], ["⟂", "Diklik"], ["∠", "Açısallık"], ["⌖", "Konum"], ["◎", "Eş merkezlilik"], ["⌯", "Simetri"], ["↗", "Dairesel salgı"], ["⌰", "Toplam salgı"],
];
const fT = (v: number) => (v >= 0 ? "+" : "−") + f1(Math.abs(v));
/** ölçü yazısı + tolerans */
export function tolText(base: string, val: number, t?: Tol): string {
  if (!t || t.t === "none") return base;
  if (t.t === "sym") return `${base} ±${f1(Math.abs(t.up ?? 0))}`;
  if (t.t === "dev") return `${base} ${fT(t.up ?? 0)} / ${fT(t.lo ?? 0)}`;
  if (t.t === "lim") {
    const pre = base.match(/^[^0-9−-]*/)?.[0] ?? "";
    return `${pre}${f1(val + (t.up ?? 0))} / ${f1(val + (t.lo ?? 0))}`;
  }
  return `${base} ${t.fit ?? "H7"}`;
}
/** ön görünüşün kağıttaki yerleşimi (önizlemede tıklayarak detay merkezi seçmek için) */
export interface FrontPlace { ox: number; oy: number; s: number; min: Vec2; max: Vec2 }
/** görünüşün yakalama noktaları (çizgi uçları, daire merkezleri) — önizlemede ölçü / açıklama eklerken */
export function snapPoints(v: DrawView): Vec2[] {
  const out: Vec2[] = [];
  const add = (p: Vec2) => !out.some((q) => Math.abs(q[0] - p[0]) < 1e-3 && Math.abs(q[1] - p[1]) < 1e-3) && out.push(p);
  for (let i = 0; i < v.vis.length; i += 4) add([v.vis[i], v.vis[i + 1]]), add([v.vis[i + 2], v.vis[i + 3]]);
  for (const c of [...v.circles, ...(v.arcs ?? [])]) if (!c.hidden) add(c.c);
  return out;
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

/** ölçüyü sürüklenebilir grup içine al */
function dimG(svg: Svg, key: string, ax: "x" | "y" | "xy", draw: () => void) {
  svg.parts.push(`<g data-dim="${key}" data-ax="${ax}" style="cursor:move">`);
  draw();
  svg.parts.push(`</g>`);
}

export function techSheet(d: TechData, info: TechInfo): { svg: string; scale: number; front?: FrontPlace; places?: Record<string, FrontPlace> } {
  const W = info.paper === "A3" ? 420 : 297, H = info.paper === "A3" ? 297 : 210, M = 10;
  const TB = { w: 130, h: 36 };
  const tbx = W - M - TB.w, tby = H - M - TB.h;
  const svg = new Svg();
  svg.parts.push(`<rect class="v" x="${M}" y="${M}" width="${W - 2 * M}" height="${H - 2 * M}" fill="none"/>`);
  const asm = !!info.bom;
  const weld = !asm && !!info.cut?.length;
  const [F, T, L] = d.views;
  const S = d.sec, I = d.iso;
  // ızgara: üst sıra [ön, sol, (izo)], alt sıra [üst, kesit]; montajda yalnız izometrik büyük + ön/üst küçük
  const gap = info.dims ? 20 : 12;
  const cols = asm ? [vw(I ?? F)] : [Math.max(vw(F), vw(T)), Math.max(vw(L), S ? vw(S) : 0), ...(I && S ? [vw(I)] : [])];
  const rws = asm ? [vh(I ?? F)] : [Math.max(vh(F), vh(L), I && S ? vh(I) : 0), Math.max(vh(T), S ? vh(S) : I ? vh(I) : 0)];
  const bomW = asm ? 95 : weld ? 112 : 0;
  const availW = W - 2 * M - 10 - bomW - gap * cols.length, availH = H - 2 * M - TB.h - 14 - gap * rws.length;
  const need = Math.min(availW / cols.reduce((a, b) => a + b, 0), availH / rws.reduce((a, b) => a + b, 0));
  const s = info.scale || SCALES.find((x) => x <= need) || SCALES[SCALES.length - 1];
  const x0 = M + 5 + gap, y0 = M + 8 + 4;
  const place = (v: DrawView, cx: number, cy: number, cw: number, ch: number, key = "") => {
    // hücre içinde ortala; kullanıcı görünüşü sürüklediyse öteleme
    const vo = info.vOff?.[key] ?? [0, 0];
    const ox = cx + (cw * s - vw(v) * s) / 2 + vo[0], oy = cy + (ch * s - vh(v) * s) / 2 + vo[1];
    svg.parts.push(`<g data-view="${key}" style="cursor:grab">`);
    const p = placeView(svg, v, ox, oy, s);
    // görünüşün tamamı tutulabilsin (boşluklar dahil)
    svg.parts.push(`<rect x="${ox.toFixed(2)}" y="${oy.toFixed(2)}" width="${p.w.toFixed(2)}" height="${p.h.toFixed(2)}" fill="transparent" stroke="none"/>`);
    if (!asm) svg.text(ox + p.w / 2, oy - 3, v.name.toLocaleUpperCase("tr-TR"), 3, "middle", 0, "vt");
    svg.parts.push(`</g>`);
    return { ...p, ox, oy, v };
  };
  const out: Record<string, ReturnType<typeof place>> = {};
  if (asm) {
    const v = I ?? F;
    out.iso = place(v, x0, y0, cols[0], rws[0], "iso");
  } else {
    const cx = [x0, x0 + cols[0] * s + gap, x0 + (cols[0] + cols[1]) * s + 2 * gap];
    const cy = [y0, y0 + rws[0] * s + gap];
    out.front = place(F, cx[0], cy[0], cols[0], rws[0], "front");
    out.left = place(L, cx[1], cy[0], cols[1], rws[0], "left");
    out.top = place(T, cx[0], cy[1], cols[0], rws[1], "top");
    if (S) out.sec = place(S, cx[1], cy[1], cols[1], rws[1], "sec");
    if (I) out.iso = S ? place(I, cx[2], cy[0], cols[2], rws[0], "iso") : place(I, cx[1], cy[1], cols[1], rws[1], "iso");
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
    const O = (k: string) => info.off?.[k] ?? [0, 0];
    /** otomatik ölçü yazısı: kullanıcı metni / toleransı; gizliyse null */
    const lab = (k: string, val: number, pre = "") => {
      const o = info.ovr?.[k];
      if (o?.hide) return null;
      return tolText(o?.text ?? pre + f1(val), val, o?.tol);
    };
    const L1 = lab("fw", vw(F)), L2 = lab("fh", vh(F)), L3 = lab("th", vh(T));
    if (L1) dimG(svg, "fw", "y", () => svg.dimH(ox, oy + h, ox + w, oy + h, oy + h + 8 + O("fw")[1], L1));
    if (L2) dimG(svg, "fh", "x", () => svg.dimV(ox, oy, ox, oy + h, ox - 8 + O("fh")[0], L2));
    const tp = out.top;
    if (L3) dimG(svg, "th", "x", () => svg.dimV(tp.ox + tp.w, tp.oy, tp.ox + tp.w, tp.oy + tp.h, tp.ox + tp.w + 8 + O("th")[0], L3));
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
      if (!labeled.has(key) && !info.ovr?.["d:" + key]?.hide) {
        labeled.add(key);
        const n = byR.get(key)!;
        const dl = tolText(info.ovr?.["d:" + key]?.text ?? `${n > 1 ? n + "× " : ""}Ø${key}`, c.r * 2, info.ovr?.["d:" + key]?.tol);
        const [dx, dy] = O("d:" + key);
        const lx = cx + r * 0.71 + 6 + dx, ly = cy - r * 0.71 - 6 + dy;
        dimG(svg, "d:" + key, "xy", () => {
          svg.line(cx + r * 0.71, cy - r * 0.71, lx, ly, "d");
          svg.line(lx, ly, lx + 12, ly, "d");
          const L = Math.hypot(lx - cx - r * 0.71, ly - cy + r * 0.71) || 1;
          svg.arrow(cx + r * 0.71, cy - r * 0.71, -(lx - cx - r * 0.71) / L, -(ly - cy + r * 0.71) / L);
          svg.line(lx + 12, ly, lx + Math.max(12, dl.length * 1.75 + 2), ly, "d");
          svg.text(lx + 1, ly - 0.8, dl, 2.8, "start");
        });
      }
      const kx = f1(c.c[0] - F.min[0]), ky = f1(c.c[1] - F.min[1]);
      if (!usedX.has(kx) && usedX.size < 6) { const n2 = usedX.size, t = lab("x:" + kx, c.c[0] - F.min[0]); if (t) dimG(svg, "x:" + kx, "y", () => svg.dimH(ox, oy + h, cx, cy, oy + h + 14 + n2 * 5 + O("x:" + kx)[1], t)); usedX.add(kx); }
      if (!usedY.has(ky) && usedY.size < 6) { const n2 = usedY.size, t = lab("y:" + ky, c.c[1] - F.min[1]); if (t) dimG(svg, "y:" + ky, "x", () => svg.dimV(ox, oy + h, cx, cy, ox - 14 - n2 * 5 + O("y:" + ky)[0], t)); usedY.add(ky); }
    });
  }
  if (!asm) annotate(svg, out, info, s);
  // detay görünüşü işareti (ön görünüşte daire + B)
  if (info.detail && !asm && out.front) {
    const { X, Y } = out.front, D = info.detail;
    svg.parts.push(`<circle class="g" cx="${X(D.x).toFixed(2)}" cy="${Y(D.y).toFixed(2)}" r="${(D.r * s).toFixed(2)}" fill="none" stroke-dasharray="3 1"/>`);
    svg.text(X(D.x) + D.r * s * 0.75 + 1.5, Y(D.y) - D.r * s * 0.75 - 1, "B", 3.5, "start", 0, "tb");
  }
  // montaj: balonlar ve malzeme listesi
  // kaynaklı yapı: izometrik görünüşte balonlar (kesim listesi satırı)
  const bl: { p: Vec3; no: number }[] = asm && d.centers && info.balloonOf ? d.centers.map((p, i) => ({ p: p as Vec3, no: info.balloonOf![i] })).filter((x) => x.p) : weld && info.cutCenters ? info.cutCenters.map((x) => ({ p: x.c, no: x.no })) : [];
  if ((asm || weld) && out.iso && I && bl.length) {
    const dir: Vec3 = [1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3)], xa: Vec3 = [1 / Math.SQRT2, 0, -1 / Math.SQRT2];
    const ya: Vec3 = [dir[1] * xa[2] - dir[2] * xa[1], dir[2] * xa[0] - dir[0] * xa[2], dir[0] * xa[1] - dir[1] * xa[0]];
    const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const { X, Y, ox, oy, w, h } = out.iso;
    const mx = ox + w / 2, my = oy + h / 2;
    const done = new Set<number>();
    const placedB: [number, number][] = [];
    bl.forEach(({ p, no }) => {
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
  if (weld && info.cut) {
    const bx = W - M - bomW + 2, rowH = 5.5;
    let by = M + 6;
    const cw = [8, 50, 18, 18, 10];
    const table = (head: string[], rowsT: string[][], widths: number[]) => {
      const tw = widths.reduce((a, b) => a + b);
      const row = (vals: string[], hd = false) => {
        let x = bx;
        svg.line(bx, by, bx + tw, by, "v");
        vals.forEach((v, k) => {
          svg.line(x, by, x, by + rowH, "v");
          svg.text(x + (k === 1 ? 1.2 : widths[k] / 2), by + 3.9, v, hd ? 2.4 : 2.5, k === 1 ? "start" : "middle", 0, hd ? "tb" : "t");
          x += widths[k];
        });
        svg.line(x, by, x, by + rowH, "v");
        by += rowH;
      };
      row(head, true);
      rowsT.forEach((r) => row(r));
      svg.line(bx, by, bx + tw, by, "v");
    };
    svg.text(bx, by - 1.5, "KESİM LİSTESİ", 3, "start", 0, "tb");
    table(["No", "Tanım", "Boy", "Açı", "Adet"], info.cut.map((r) => [String(r.no), r.name, f1(r.len), `${f1(r.a1)}°/${f1(r.a2)}°`, String(r.qty)]), cw);
    if (info.welds?.length) {
      by += 8;
      svg.text(bx, by - 1.5, "KAYNAK LİSTESİ", 3, "start", 0, "tb");
      const y0 = by;
      table(["", "Dikiş", "a", "Boy", "Adet"], info.welds.map((w) => ["", w.name, f1(w.a), f1(w.length), String(w.count)]), cw);
      // ISO 2553 köşe kaynağı sembolü (üçgen) her satırın ilk hücresinde
      info.welds.forEach((_, i) => {
        const cx = bx + 4, cy = y0 + rowH * (i + 1) + rowH / 2;
        svg.line(cx - 2, cy + 1.6, cx + 2, cy + 1.6, "v");
        svg.line(cx + 2, cy + 1.6, cx - 2, cy - 2, "v");
        svg.line(cx - 2, cy - 2, cx - 2, cy + 1.6, "v");
      });
      // örnek kaynak işareti: ok + referans çizgisi + kesikli tanımlama çizgisi + "a ◺ boy"
      const w0 = info.welds[0], rx = bx + 8, ry = by + 10;
      svg.line(rx, ry, rx + 34, ry, "v");
      svg.parts.push(`<line class="h" x1="${rx.toFixed(2)}" y1="${(ry + 1.2).toFixed(2)}" x2="${(rx + 34).toFixed(2)}" y2="${(ry + 1.2).toFixed(2)}" stroke-dasharray="1.5 1"/>`);
      svg.line(rx, ry, rx - 6, ry + 6, "v");
      svg.arrow(rx - 6, ry + 6, -0.707, 0.707);
      svg.line(rx + 10, ry, rx + 14, ry, "v");
      svg.line(rx + 10, ry, rx + 10, ry - 4, "v");
      svg.line(rx + 10, ry - 4, rx + 14, ry, "v");
      svg.text(rx + 8.5, ry - 1, `a${f1(w0.a)}`, 2.4, "end");
      svg.text(rx + 15.5, ry - 1, `${f1(w0.length)}`, 2.4, "start");
      svg.text(rx + 36, ry + 0.8, "(ISO 2553)", 2.2, "start", 0, "tk");
    }
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
  if (info.page) svg.text(tbx + TB.w - 2, tby - 2, `Sayfa ${info.page[0]} / ${info.page[1]}`, 2.6, "end", 0, "tk");
  const places: Record<string, FrontPlace> = {};
  for (const [k, p] of Object.entries(out)) if (p.v) places[k] = { ox: p.ox, oy: p.oy, s, min: p.v.min, max: p.v.max };
  return { svg: wrapSvg(svg, W, H), scale: s, front: places.front, places };
}

type Placed = { X: (x: number) => number; Y: (y: number) => number; w: number; h: number; ox: number; oy: number; v: DrawView };
/** kullanıcı ölçüleri, pürüzlülük, geometrik tolerans ve referans sembolleri (görünüşe bağlı, görünüşle birlikte taşınır) */
function annotate(svg: Svg, out: Record<string, Placed>, info: TechInfo, s: number) {
  const O = (k: string) => info.off?.[k] ?? [0, 0];
  for (const u of info.user ?? []) {
    const P = out[u.view];
    if (!P) continue;
    const ax = P.X(u.a[0]), ay = P.Y(u.a[1]), bx = P.X(u.b[0]), by = P.Y(u.b[1]);
    const k = "u:" + u.id, o = O(k);
    if (u.dir === "d") {
      const r = u.b[0], R = r * s, val = 2 * r;
      const t = tolText(u.text ?? "Ø" + f1(val), val, u.tol);
      dimG(svg, k, "xy", () => {
        const px = ax + R * 0.71, py = ay - R * 0.71, lx = px + 6 + o[0], ly = py - 6 + o[1];
        svg.line(px, py, lx, ly, "d");
        svg.line(lx, ly, lx + Math.max(12, t.length * 1.75 + 2), ly, "d");
        const L = Math.hypot(lx - px, ly - py) || 1;
        svg.arrow(px, py, -(lx - px) / L, -(ly - py) / L);
        svg.text(lx + 1, ly - 0.8, t, 2.8, "start");
      });
      continue;
    }
    const val = u.dir === "h" ? Math.abs(u.a[0] - u.b[0]) : u.dir === "v" ? Math.abs(u.a[1] - u.b[1]) : Math.hypot(u.a[0] - u.b[0], u.a[1] - u.b[1]);
    const t = tolText(u.text ?? f1(val), val, u.tol);
    if (u.dir === "h") dimG(svg, k, "y", () => svg.dimH(ax, ay, bx, by, Math.min(ay, by) - u.off + o[1], t));
    else if (u.dir === "v") dimG(svg, k, "x", () => svg.dimV(ax, ay, bx, by, Math.max(ax, bx) + u.off + o[0], t));
    else
      dimG(svg, k, "xy", () => {
        // hizalı ölçü: iki noktaya paralel, normal yönde öteleme (sürükleme dik bileşeni kullanır)
        const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
        let nx = -uy, ny = ux;
        if (ny > 0) (nx = -nx), (ny = -ny); // varsayılan yukarı
        const d = u.off + (o[0] * nx + o[1] * ny);
        const a2x = ax + nx * d, a2y = ay + ny * d, b2x = bx + nx * d, b2y = by + ny * d;
        svg.line(ax + nx * 0.8, ay + ny * 0.8, a2x + nx * 1.5, a2y + ny * 1.5, "d");
        svg.line(bx + nx * 0.8, by + ny * 0.8, b2x + nx * 1.5, b2y + ny * 1.5, "d");
        svg.line(a2x, a2y, b2x, b2y, "d");
        svg.arrow(a2x, a2y, -ux, -uy);
        svg.arrow(b2x, b2y, ux, uy);
        let ang = (Math.atan2(dy, dx) * 180) / Math.PI;
        if (ang > 90) ang -= 180;
        if (ang < -90) ang += 180;
        svg.text((a2x + b2x) / 2 + nx * 0.8, (a2y + b2y) / 2 + ny * 0.8, t, 2.8, "middle", ang);
      });
  }
  for (const n of info.notes ?? []) {
    const P = out[n.view];
    if (!P) continue;
    const k = "n:" + n.id, o = O(k);
    const px = P.X(n.at[0]), py = P.Y(n.at[1]);
    const lx = px + 10 + o[0], ly = py - 10 + o[1];
    dimG(svg, k, "xy", () => {
      if (n.kind === "ra") {
        // ISO 1302: kısa kol 60°, uzun kol; işlem gerekli = üst çizgi, yasak = daire; değer uzun kolun üstündeki yatayda
        svg.parts.push(`<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="0.5" fill="#000"/>`);
        svg.line(px, py, lx, ly + 3.2, "g");
        const h1 = 3.2, x0 = lx, y0 = ly + h1;
        svg.line(x0 - h1 * 0.58, y0 - h1, x0, y0, "v");
        svg.line(x0, y0, x0 + h1 * 1.16, y0 - h1 * 2, "v");
        svg.line(x0 + h1 * 1.16, y0 - h1 * 2, x0 + h1 * 1.16 + 9, y0 - h1 * 2, "v");
        if (n.proc === "req") svg.line(x0 - h1 * 0.58, y0 - h1, x0 + h1 * 0.58, y0 - h1, "v");
        if (n.proc === "proh") svg.parts.push(`<circle class="v" cx="${x0.toFixed(2)}" cy="${(y0 - h1 * 0.62).toFixed(2)}" r="${(h1 * 0.36).toFixed(2)}" fill="none"/>`);
        svg.text(x0 + h1 * 1.16 + 1, y0 - h1 * 2 - 0.8, `Ra ${n.ra ?? "3,2"}`, 2.6, "start");
      } else if (n.kind === "gdt") {
        // çerçeve: [sembol | tolerans | referanslar]
        const cells = [n.sym ?? "⏥", n.tol ?? "0,05", ...(n.dat ? n.dat.split(/[\s,|]+/).filter(Boolean) : [])];
        const hh = 5, ws = cells.map((c, i) => (i === 0 ? 5.5 : Math.max(5.5, c.length * 1.9 + 2)));
        const W = ws.reduce((a, b) => a + b, 0);
        const fx = lx, fy = ly - hh / 2;
        svg.line(fx, fy, fx + W, fy, "v");
        svg.line(fx, fy + hh, fx + W, fy + hh, "v");
        let x = fx;
        svg.line(x, fy, x, fy + hh, "v");
        cells.forEach((c, i) => {
          svg.text(x + ws[i] / 2, fy + hh - 1.4, c, i === 0 ? 3.4 : 2.8, "middle");
          x += ws[i];
          svg.line(x, fy, x, fy + hh, "v");
        });
        svg.line(fx, ly, px, ly, "g");
        svg.line(px, ly, px, py, "g");
        svg.arrow(px, py, 0, Math.sign(py - ly) || 1);
      } else {
        // referans (datum): içi dolu üçgen yüzeyde, kare içinde harf
        const L2 = n.letter ?? "A";
        svg.parts.push(`<path class="ar" d="M${(px - 1.6).toFixed(2)} ${py.toFixed(2)} L${(px + 1.6).toFixed(2)} ${py.toFixed(2)} L${px.toFixed(2)} ${(py - 2.6).toFixed(2)}Z"/>`);
        svg.line(px, py - 2.6, lx, ly + 2.5, "g");
        const q = 5;
        svg.line(lx - q / 2, ly - q / 2, lx + q / 2, ly - q / 2, "v");
        svg.line(lx - q / 2, ly + q / 2, lx + q / 2, ly + q / 2, "v");
        svg.line(lx - q / 2, ly - q / 2, lx - q / 2, ly + q / 2, "v");
        svg.line(lx + q / 2, ly - q / 2, lx + q / 2, ly + q / 2, "v");
        svg.text(lx, ly + 1.2, L2, 3.2, "middle", 0, "tb");
      }
    });
  }
}

function wrapSvg(svg: Svg, W: number, H: number) {
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
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">${style}<rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>${svg.parts.join("")}</svg>`;
}

/** antet (her sayfada) */
function titleBlock(svg: Svg, info: TechInfo, W: number, H: number, s: number) {
  const M = 10, TB = { w: 130, h: 36 };
  const tbx = W - M - TB.w, tby = H - M - TB.h;
  svg.parts.push(`<rect class="v" x="${M}" y="${M}" width="${W - 2 * M}" height="${H - 2 * M}" fill="none"/>`);
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
  if (info.page) svg.text(tbx + TB.w - 2, tby - 2, `Sayfa ${info.page[0]} / ${info.page[1]}`, 2.6, "end", 0, "tk");
  return { tbx, tby };
}

/**
 * 2. sayfa: detay görünüşü B (ön görünüşün büyütülmüş, daireyle kırpılmış parçası) ve
 * büyük izometrik — montajda patlatılmış izometrik + balonlar.
 */
export function techSheet2(d: TechData, info: TechInfo, sheet1Scale: number, exploded?: TechData | null): { svg: string; scale: number } {
  const W = info.paper === "A3" ? 420 : 297, H = info.paper === "A3" ? 297 : 210, M = 10;
  const svg = new Svg();
  const tbh = 36, availH = H - 2 * M - tbh - 16;
  const D = info.detail && !info.bom ? info.detail : null;
  const isoV = exploded?.iso ?? d.iso;
  const leftW = D ? (W - 2 * M) * 0.45 : 0;
  // detay
  if (D) {
    const F = d.views[0];
    const Rmax = Math.min(leftW / 2 - 8, availH / 2 - 8);
    // k = 0: otomatik — daire sol yarıyı dolduracak en büyük standart ölçek
    const sd = D.k > 0 ? sheet1Scale * D.k : SCALES.find((x) => x <= Rmax / D.r) ?? sheet1Scale * 2;
    const R = Math.min(D.r * sd, Rmax);
    const cx = M + 8 + R + 4, cy = M + 14 + R;
    const ox = cx - (D.x - F.min[0]) * sd, oy = cy - (F.max[1] - D.y) * sd;
    svg.parts.push(`<clipPath id="clipB"><circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${R.toFixed(2)}"/></clipPath><g clip-path="url(#clipB)">`);
    placeView(svg, F, ox, oy, sd);
    svg.parts.push(`</g><circle class="g" cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${R.toFixed(2)}" fill="none"/>`);
    // detay içindeki delik çapları
    for (const c of circlesOf(F)) {
      const px = ox + (c.c[0] - F.min[0]) * sd, py = oy + (F.max[1] - c.c[1]) * sd;
      if (Math.hypot(px - cx, py - cy) + c.r * sd > R) continue;
      svg.line(px - c.r * sd - 1.5, py, px + c.r * sd + 1.5, py, "c");
      svg.line(px, py - c.r * sd - 1.5, px, py + c.r * sd + 1.5, "c");
      svg.text(px, py - c.r * sd - 2, `Ø${f1(c.r * 2)}`, 2.8, "middle");
    }
    svg.text(cx, cy + R + 7, `DETAY B  (${scaleLabel(sd)})`, 3.4, "middle", 0, "tb");
  }
  // izometrik / patlatılmış izometrik
  let s = sheet1Scale;
  if (isoV) {
    const x0 = M + 8 + leftW, w0 = W - M - 8 - x0, h0 = availH;
    s = SCALES.find((x) => x <= Math.min(w0 / vw(isoV), h0 / vh(isoV))) ?? SCALES[SCALES.length - 1];
    const ox = x0 + (w0 - vw(isoV) * s) / 2, oy = M + 12 + (h0 - vh(isoV) * s) / 2;
    const p = placeView(svg, isoV, ox, oy, s);
    svg.text(ox + p.w / 2, oy + p.h + 8, exploded ? "PATLATILMIŞ GÖRÜNÜŞ" : "İZOMETRİK", 3, "middle", 0, "vt");
    if (exploded && exploded.centers && info.balloonOf) {
      const dir: Vec3 = [1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3)], xa: Vec3 = [1 / Math.SQRT2, 0, -1 / Math.SQRT2];
      const ya: Vec3 = [dir[1] * xa[2] - dir[2] * xa[1], dir[2] * xa[0] - dir[0] * xa[2], dir[0] * xa[1] - dir[1] * xa[0]];
      const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const done = new Set<number>();
      exploded.centers.forEach((q, i) => {
        const no = info.balloonOf![i];
        if (!q || done.has(no)) return;
        done.add(no);
        const r: Vec3 = [q[0] - exploded.c[0], q[1] - exploded.c[1], q[2] - exploded.c[2]];
        const px = p.X(dot(r, xa)), py = p.Y(dot(r, ya));
        const bx = px + 14, by = py - 14;
        svg.parts.push(`<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="0.6" fill="#000"/>`);
        svg.line(px, py, bx - 2.8, by + 2.8, "g");
        svg.parts.push(`<circle class="v" cx="${bx.toFixed(2)}" cy="${by.toFixed(2)}" r="4" fill="#fff"/>`);
        svg.text(bx, by + 1.2, String(no), 3.4, "middle", 0, "tb");
      });
    }
  }
  titleBlock(svg, info, W, H, s);
  svg.text(M + 3, H - M - 3, "Genel toleranslar: ISO 2768-m · Ölçüler mm · İmaj CAD", 2.4, "start", 0, "tk");
  return { svg: wrapSvg(svg, W, H), scale: s };
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

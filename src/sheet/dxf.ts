// Sac açınımından DXF (R12 / AC1009, mm) üretimi — lazer / plazma / abkant yazılımları için.
// Katmanlar: KESIM (dış hat ve delikler), BUKUM_YUKARI / BUKUM_ASAGI (büküm çizgileri), NOTLAR (büküm bilgisi).
import type { Flat2D, FlatBend, FlatMark } from "../doc/types";

const n = (v: number) => (Math.abs(v) < 1e-9 ? "0.0" : (Math.round(v * 1e6) / 1e6).toString());

export interface DxfOptions {
  bends: boolean;
  notes: boolean;
  /** başlık notu (parça adı, kalınlık, malzeme) */
  title?: string;
  /** D6-11: şekillendirme merkezleri / çapraz kırma çizgileri (ISARET katmanı, kesilmez) */
  marks?: FlatMark[];
}

/** DXF metinlerinde yalnızca ASCII kullan (Türkçe karakterleri sadeleştir) */
const ascii = (s: string) =>
  s.replace(/[çÇğĞıİöÖşŞüÜ]/g, (c) => ({ ç: "c", Ç: "C", ğ: "g", Ğ: "G", ı: "i", İ: "I", ö: "o", Ö: "O", ş: "s", Ş: "S", ü: "u", Ü: "U" })[c] ?? c).replace(/[^\x20-\x7e]/g, "");

export function flatToDxf(outline: Flat2D[], bends: FlatBend[], w: number, h: number, opt: DxfOptions): string {
  const o: string[] = [];
  const p = (code: number, v: string | number) => o.push(String(code), typeof v === "number" ? n(v) : v);
  // başlık
  p(0, "SECTION"); p(2, "HEADER");
  p(9, "$ACADVER"); p(1, "AC1009");
  p(9, "$INSUNITS"); p(70, "4");
  p(9, "$EXTMIN"); p(10, 0); p(20, 0);
  p(9, "$EXTMAX"); p(10, w); p(20, h);
  p(0, "ENDSEC");
  // tablolar
  p(0, "SECTION"); p(2, "TABLES");
  p(0, "TABLE"); p(2, "LTYPE"); p(70, "2");
  p(0, "LTYPE"); p(2, "CONTINUOUS"); p(70, "0"); p(3, "Solid line"); p(72, "65"); p(73, "0"); p(40, 0);
  p(0, "LTYPE"); p(2, "DASHED"); p(70, "0"); p(3, "__ __ __"); p(72, "65"); p(73, "2"); p(40, 6); p(49, 4); p(49, -2);
  p(0, "ENDTAB");
  const layers: [string, number, string][] = [
    ["KESIM", 7, "CONTINUOUS"],
    ["BUKUM_YUKARI", 3, "DASHED"],
    ["BUKUM_ASAGI", 1, "DASHED"],
    ["NOTLAR", 5, "CONTINUOUS"],
    ["ISARET", 6, "DASHED"],
  ];
  p(0, "TABLE"); p(2, "LAYER"); p(70, String(layers.length));
  for (const [name, color, lt] of layers) {
    p(0, "LAYER"); p(2, name); p(70, "0"); p(62, String(color)); p(6, lt);
  }
  p(0, "ENDTAB");
  p(0, "ENDSEC");
  // öğeler
  p(0, "SECTION"); p(2, "ENTITIES");
  const line = (layer: string, a: [number, number], b: [number, number]) => {
    p(0, "LINE"); p(8, layer); p(10, a[0]); p(20, a[1]); p(30, 0); p(11, b[0]); p(21, b[1]); p(31, 0);
  };
  const text = (x: number, y: number, hgt: number, rot: number, s: string) => {
    p(0, "TEXT"); p(8, "NOTLAR"); p(10, x); p(20, y); p(30, 0); p(40, hgt); p(1, ascii(s)); p(50, rot);
  };
  for (const e of outline) {
    if (e.k === "l") line("KESIM", e.a, e.b);
    else if (e.k === "c") {
      p(0, "CIRCLE"); p(8, "KESIM"); p(10, e.c[0]); p(20, e.c[1]); p(30, 0); p(40, e.r);
    } else {
      p(0, "ARC"); p(8, "KESIM"); p(10, e.c[0]); p(20, e.c[1]); p(30, 0); p(40, e.r); p(50, e.a0); p(51, e.a1);
    }
  }
  const th = Math.max(1.5, Math.min(6, Math.min(w, h) / 40));
  if (opt.bends)
    bends.forEach((b, i) => {
      line(b.up ? "BUKUM_YUKARI" : "BUKUM_ASAGI", b.a, b.b);
      if (opt.notes) {
        let rot = (Math.atan2(b.b[1] - b.a[1], b.b[0] - b.a[0]) * 180) / Math.PI;
        if (rot > 90.001) rot -= 180;
        if (rot < -89.999) rot += 180;
        const r = (rot * Math.PI) / 180;
        const mx = (b.a[0] + b.b[0]) / 2 - Math.sin(r) * th * 0.6, my = (b.a[1] + b.b[1]) / 2 + Math.cos(r) * th * 0.6;
        text(mx, my, th, rot, `B${i + 1} ${b.up ? "YUKARI" : "ASAGI"} ${Math.round(b.angle * 10) / 10}%%d R${Math.round(b.r * 100) / 100}`);
      }
    });
  // D6-11: şekillendirme (merkez artısı + dış çap) ve çapraz kırma köşegenleri — markalama katmanı
  for (const m of opt.marks ?? []) {
    if (m.k === "c") {
      p(0, "CIRCLE"); p(8, "ISARET"); p(10, m.c[0]); p(20, m.c[1]); p(30, 0); p(40, m.r);
      const s = Math.max(1, m.r * 0.3);
      line("ISARET", [m.c[0] - s, m.c[1]], [m.c[0] + s, m.c[1]]);
      line("ISARET", [m.c[0], m.c[1] - s], [m.c[0], m.c[1] + s]);
      if (opt.notes && m.label) text(m.c[0] + m.r + th * 0.3, m.c[1] + th * 0.3, th * 0.8, 0, m.label);
    } else {
      line("ISARET", m.a, m.b);
      if (opt.notes && m.label) text((m.a[0] + m.b[0]) / 2 + th * 0.3, (m.a[1] + m.b[1]) / 2 + th * 0.3, th * 0.8, 0, m.label);
    }
  }
  if (opt.notes && opt.title) text(0, -th * 2, th, 0, opt.title);
  // sınır kutusu ve büküm sayısı (abkant / lazer hazırlığı için)
  if (opt.notes) text(0, -th * 3.6, th * 0.8, 0, `Sinir kutusu ${Math.round(w * 100) / 100} x ${Math.round(h * 100) / 100} mm - ${bends.length} bukum (${bends.filter((b) => b.up).length} yukari, ${bends.filter((b) => !b.up).length} asagi)`);
  p(0, "ENDSEC");
  p(0, "EOF");
  return o.join("\n") + "\n";
}

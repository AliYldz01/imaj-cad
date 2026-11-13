// Dışa aktarma yardımcıları: eskiz / yüz DXF (R12), 3MF (zip içinde 3B model XML), görüntüden PDF (JPEG gömülü).
import type { MeshData, SketchData, Vec2, Vec3 } from "../doc/types";
import { entSamples, P, arcAngles } from "../sketch/model";

const n = (v: number) => (Math.abs(v) < 1e-9 ? "0.0" : (Math.round(v * 1e6) / 1e6).toString());

/** DXF R12 yazıcı: çizgi / daire / yay / çoklu çizgi, katmanlar */
export class Dxf {
  private ent: string[] = [];
  private lay = new Set<string>(["0"]);
  private p(c: number, v: string | number) {
    this.ent.push(String(c), typeof v === "number" ? n(v) : v);
  }
  line(a: Vec2, b: Vec2, layer = "0") {
    this.lay.add(layer);
    this.p(0, "LINE"); this.p(8, layer); this.p(10, a[0]); this.p(20, a[1]); this.p(30, 0); this.p(11, b[0]); this.p(21, b[1]); this.p(31, 0);
  }
  circle(c: Vec2, r: number, layer = "0") {
    this.lay.add(layer);
    this.p(0, "CIRCLE"); this.p(8, layer); this.p(10, c[0]); this.p(20, c[1]); this.p(30, 0); this.p(40, r);
  }
  /** yay: başlangıç / bitiş açısı derece, saat yönü tersine */
  arc(c: Vec2, r: number, a0: number, a1: number, layer = "0") {
    this.lay.add(layer);
    this.p(0, "ARC"); this.p(8, layer); this.p(10, c[0]); this.p(20, c[1]); this.p(30, 0); this.p(40, r); this.p(50, a0); this.p(51, a1);
  }
  poly(pts: Vec2[], closed = false, layer = "0") {
    this.lay.add(layer);
    this.p(0, "POLYLINE"); this.p(8, layer); this.p(66, "1"); this.p(70, closed ? "1" : "0");
    for (const q of pts) (this.p(0, "VERTEX"), this.p(8, layer), this.p(10, q[0]), this.p(20, q[1]), this.p(30, 0));
    this.p(0, "SEQEND");
  }
  text(at: Vec2, h: number, s: string, layer = "0") {
    this.lay.add(layer);
    this.p(0, "TEXT"); this.p(8, layer); this.p(10, at[0]); this.p(20, at[1]); this.p(30, 0); this.p(40, h); this.p(1, s.replace(/[^\x20-\x7e]/g, "?"));
  }
  toString() {
    const o: string[] = [];
    const p = (c: number, v: string) => o.push(String(c), v);
    p(0, "SECTION"); p(2, "HEADER"); p(9, "$ACADVER"); p(1, "AC1009"); p(9, "$INSUNITS"); p(70, "4"); p(0, "ENDSEC");
    p(0, "SECTION"); p(2, "TABLES"); p(0, "TABLE"); p(2, "LAYER"); p(70, String(this.lay.size));
    let col = 7;
    for (const l of this.lay) (p(0, "LAYER"), p(2, l), p(70, "0"), p(62, String(col)), p(6, "CONTINUOUS"), (col = col === 7 ? 1 : col + 1));
    p(0, "ENDTAB"); p(0, "ENDSEC");
    p(0, "SECTION"); p(2, "ENTITIES");
    o.push(...this.ent);
    p(0, "ENDSEC"); p(0, "EOF");
    return o.join("\r\n") + "\r\n";
  }
}

/** Eskizi DXF olarak (eskiz koordinatlarında, 1:1). Yapı geometrisi ayrı katmanda. */
export function sketchDxf(sk: SketchData): string {
  const d = new Dxf();
  for (const e of sk.ents) {
    const L = e.cons ? "YAPI" : "ESKIZ";
    if (e.t === "line") d.line(P(sk, e.p1), P(sk, e.p2), L);
    else if (e.t === "circle") d.circle(P(sk, e.c), e.r, L);
    else if (e.t === "arc") {
      const { c, s, e: en } = arcAngles(sk, e);
      d.arc(c, e.r, (s * 180) / Math.PI, (en * 180) / Math.PI, L);
    } else if (e.t === "point") {
      const q = P(sk, e.p);
      d.circle(q, 0.1, "NOKTA");
    } else if (e.t === "text") d.text(P(sk, e.p), e.size, e.text, "YAZI");
    else d.poly(entSamples(sk, e), false, L);
  }
  return d.toString();
}

/** Düz yüzün döngülerini (yüz düzleminde 2B) DXF olarak */
export function loopsDxf(loops: Vec2[][]): string {
  const d = new Dxf();
  loops.forEach((l, i) => d.poly(l, true, i === 0 ? "DIS" : "IC"));
  return d.toString();
}

// ---------- ZIP (yalnız saklama) ----------
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();
function crc32(b: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
export function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [], central: Uint8Array[] = [];
  let off = 0;
  for (const f of files) {
    const nm = enc.encode(f.name), crc = crc32(f.data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0, true); h.setUint16(8, 0, true);
    h.setUint16(10, 0, true); h.setUint16(12, 0x21, true); h.setUint32(14, crc, true); h.setUint32(18, f.data.length, true); h.setUint32(22, f.data.length, true);
    h.setUint16(26, nm.length, true); h.setUint16(28, 0, true);
    parts.push(new Uint8Array(h.buffer), nm, f.data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0, true); c.setUint16(10, 0, true);
    c.setUint16(12, 0, true); c.setUint16(14, 0x21, true); c.setUint32(16, crc, true); c.setUint32(20, f.data.length, true); c.setUint32(24, f.data.length, true);
    c.setUint16(28, nm.length, true); c.setUint16(30, 0, true); c.setUint16(32, 0, true); c.setUint16(34, 0, true); c.setUint16(36, 0, true); c.setUint32(38, 0, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), nm);
    off += 30 + nm.length + f.data.length;
  }
  const csize = central.reduce((a, b) => a + b.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
  const all = [...parts, ...central, new Uint8Array(e.buffer)];
  const out = new Uint8Array(all.reduce((a, b) => a + b.length, 0));
  let k = 0;
  for (const a of all) (out.set(a, k), (k += a.length));
  return out;
}

/** 3MF (3D Manufacturing Format): ağdaki üçgenler, mm */
export function mesh3mf(m: MeshData, name: string): Uint8Array {
  const V = m.vertices, T = m.triangles;
  // aynı konumdaki köşeleri birleştir (su geçirmez ağ)
  const key = (i: number) => `${Math.round(V[i * 3] * 1e4)},${Math.round(V[i * 3 + 1] * 1e4)},${Math.round(V[i * 3 + 2] * 1e4)}`;
  const map = new Map<string, number>(), idx: number[] = [], verts: string[] = [];
  for (let i = 0; i < V.length / 3; i++) {
    const k = key(i);
    let j = map.get(k);
    if (j === undefined) {
      j = verts.length;
      map.set(k, j);
      verts.push(`<vertex x="${n(V[i * 3])}" y="${n(V[i * 3 + 1])}" z="${n(V[i * 3 + 2])}"/>`);
    }
    idx.push(j);
  }
  const tris: string[] = [];
  for (let i = 0; i < T.length; i += 3) {
    const a = idx[T[i]], b = idx[T[i + 1]], c = idx[T[i + 2]];
    if (a === b || b === c || a === c) continue;
    tris.push(`<triangle v1="${a}" v2="${b}" v3="${c}"/>`);
  }
  const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);
  const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="tr-TR" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
<metadata name="Title">${esc(name)}</metadata>
<metadata name="Application">Imaj CAD</metadata>
<resources><object id="1" type="model" name="${esc(name)}"><mesh><vertices>${verts.join("")}</vertices><triangles>${tris.join("")}</triangles></mesh></object></resources>
<build><item objectid="1"/></build>
</model>`;
  const ct = `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`;
  const enc = new TextEncoder();
  return zipStore([
    { name: "[Content_Types].xml", data: enc.encode(ct) },
    { name: "_rels/.rels", data: enc.encode(rels) },
    { name: "3D/3dmodel.model", data: enc.encode(model) },
  ]);
}

/** JPEG görüntüyü (data URL) A4 yatay PDF sayfasına göm; başlık yazısı ile */
export function jpegPdf(jpegDataUrl: string, w: number, h: number, title: string): Uint8Array {
  const b64 = jpegDataUrl.split(",")[1];
  const bin = atob(b64);
  const img = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) img[i] = bin.charCodeAt(i);
  const PW = 842, PH = 595, M = 28;
  const sc = Math.min((PW - 2 * M) / w, (PH - 2 * M - 24) / h);
  const iw = w * sc, ih = h * sc, ix = (PW - iw) / 2, iy = M;
  const t = title.replace(/[^\x20-\x7e]/g, "?").replace(/[()\\]/g, "");
  const content = `q ${iw.toFixed(2)} 0 0 ${ih.toFixed(2)} ${ix.toFixed(2)} ${iy.toFixed(2)} cm /Im0 Do Q BT /F1 12 Tf ${M} ${PH - M - 8} Td (${t}) Tj ET`;
  const enc = new TextEncoder();
  const objs: (string | Uint8Array)[][] = [
    ["<< /Type /Catalog /Pages 2 0 R >>"],
    ["<< /Type /Pages /Kids [3 0 R] /Count 1 >>"],
    [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im0 4 0 R >> /Font << /F1 6 0 R >> >> /Contents 5 0 R >>`],
    [`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.length} >>\nstream\n`, img, "\nendstream"],
    [`<< /Length ${content.length} >>\nstream\n${content}\nendstream`],
    ["<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"],
  ];
  const chunks: Uint8Array[] = [];
  let len = 0;
  const push = (x: string | Uint8Array) => {
    const b = typeof x === "string" ? enc.encode(x) : x;
    chunks.push(b);
    len += b.length;
  };
  push("%PDF-1.4\n");
  const offs: number[] = [];
  objs.forEach((o, i) => {
    offs.push(len);
    push(`${i + 1} 0 obj\n`);
    o.forEach(push);
    push("\nendobj\n");
  });
  const xref = len;
  push(`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join(""));
  push(`trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(len);
  let k = 0;
  for (const c of chunks) (out.set(c, k), (k += c.length));
  return out;
}

/** yüzün dünya üçgenlerinden düzlemdeki sınır döngüleri (yalnız tek kez kullanılan kenarlar) */
export function faceLoops2D(m: MeshData, fi: number, toLocal: (p: Vec3) => Vec2): Vec2[][] {
  const fg = m.faceGroups, T = m.triangles, V = m.vertices;
  const key = (i: number) => `${Math.round(V[i * 3] * 1e4)},${Math.round(V[i * 3 + 1] * 1e4)},${Math.round(V[i * 3 + 2] * 1e4)}`;
  const pos = new Map<string, Vec3>();
  const cnt = new Map<string, number>();
  const ek = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const dir = new Map<string, [string, string]>();
  for (let g = 0; g < fg.length; g += 3) {
    if (fg[g + 2] !== fi) continue;
    for (let k = fg[g]; k < fg[g] + fg[g + 1]; k += 3) {
      const ids = [T[k], T[k + 1], T[k + 2]];
      const ks = ids.map(key);
      ids.forEach((id, j) => pos.set(ks[j], [V[id * 3], V[id * 3 + 1], V[id * 3 + 2]]));
      for (let j = 0; j < 3; j++) {
        const a = ks[j], b = ks[(j + 1) % 3], kk = ek(a, b);
        cnt.set(kk, (cnt.get(kk) ?? 0) + 1);
        dir.set(kk, [a, b]);
      }
    }
  }
  const next = new Map<string, string>();
  for (const [kk, c] of cnt) if (c === 1) next.set(dir.get(kk)![0], dir.get(kk)![1]);
  const loops: Vec2[][] = [];
  const seen = new Set<string>();
  for (const st of next.keys()) {
    if (seen.has(st)) continue;
    const l: Vec2[] = [];
    let cur = st;
    while (!seen.has(cur) && next.has(cur)) {
      seen.add(cur);
      l.push(toLocal(pos.get(cur)!));
      cur = next.get(cur)!;
    }
    if (l.length >= 3) loops.push(l);
  }
  const area = (l: Vec2[]) => Math.abs(l.reduce((a, p, i) => a + p[0] * l[(i + 1) % l.length][1] - l[(i + 1) % l.length][0] * p[1], 0) / 2);
  return loops.sort((a, b) => area(b) - area(a));
}

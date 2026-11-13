// Fotoğraftan kenar izleme: gri ton → Otsu eşiği → ikili maske → kenar eğrileri (marching squares) → sadeleştirme.
import type { Vec2 } from "../doc/types";

export interface TraceOpts {
  /** eşik 0..255; verilmezse Otsu ile bulunur */
  thr?: number;
  /** true: açık renkli nesne koyu zemin üzerinde */
  invert?: boolean;
  /** sadeleştirme toleransı (piksel) */
  eps?: number;
  /** en küçük kontur alanı (görüntü alanına oran) */
  minArea?: number;
  /** işlem çözünürlüğü (uzun kenar, piksel) */
  maxPx?: number;
}
export interface TraceResult {
  /** piksel koordinatlarında kapalı döngüler (y aşağı), işlem boyutunda */
  loops: Vec2[][];
  w: number;
  h: number;
  thr: number;
  /** her döngünün iç döngü (delik) olup olmadığı */
  hole: boolean[];
}

/** Otsu eşiği */
export function otsu(gray: Uint8Array): number {
  const hist = new Array(256).fill(0);
  for (const v of gray) hist[v]++;
  const N = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sB = 0, wB = 0, best = 0, thr = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = N - wB;
    if (!wF) break;
    sB += t * hist[t];
    const mB = sB / wB, mF = (sum - sB) / wF;
    const v = wB * wF * (mB - mF) ** 2;
    if (v > best) (best = v), (thr = t);
  }
  return thr;
}

/** kapalı çokgen alanı (işaretli) */
export function area(p: Vec2[]) {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[i], r = p[(i + 1) % p.length];
    a += q[0] * r[1] - r[0] * q[1];
  }
  return a / 2;
}

function dpOpen(p: Vec2[], eps: number): Vec2[] {
  if (p.length < 3) return p.slice();
  const keep = new Uint8Array(p.length);
  keep[0] = keep[p.length - 1] = 1;
  const st: [number, number][] = [[0, p.length - 1]];
  while (st.length) {
    const [a, b] = st.pop()!;
    const A = p[a], B = p[b];
    const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1e-9;
    let mi = -1, md = eps;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((p[i][0] - A[0]) * dy - (p[i][1] - A[1]) * dx) / L;
      if (d > md) (md = d), (mi = i);
    }
    if (mi >= 0) {
      keep[mi] = 1;
      st.push([a, mi], [mi, b]);
    }
  }
  return p.filter((_, i) => keep[i]);
}
/** kapalı döngü Douglas–Peucker (en uzak iki noktadan bölerek) */
export function simplifyClosed(p: Vec2[], eps: number): Vec2[] {
  if (p.length < 4) return p.slice();
  let far = 0, fd = -1;
  for (let i = 1; i < p.length; i++) {
    const d = (p[i][0] - p[0][0]) ** 2 + (p[i][1] - p[0][1]) ** 2;
    if (d > fd) (fd = d), (far = i);
  }
  const a = dpOpen(p.slice(0, far + 1), eps);
  const b = dpOpen([...p.slice(far), p[0]], eps);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}

/** ImageData → kenar döngüleri */
export function traceImage(img: { data: Uint8ClampedArray | number[]; width: number; height: number }, o: TraceOpts = {}): TraceResult {
  const W = img.width, H = img.height;
  const gray = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) gray[i] = Math.round(0.299 * img.data[i * 4] + 0.587 * img.data[i * 4 + 1] + 0.114 * img.data[i * 4 + 2]);
  // 3×3 ortalama ile gürültü azalt
  const bl = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let s = 0, n = 0;
      for (let j = -1; j <= 1; j++)
        for (let i = -1; i <= 1; i++) {
          const xx = x + i, yy = y + j;
          if (xx >= 0 && yy >= 0 && xx < W && yy < H) (s += gray[yy * W + xx]), n++;
        }
      bl[y * W + x] = Math.round(s / n);
    }
  const thr = o.thr ?? otsu(bl);
  // ön plan: koyu (invert değilse); kenarda çoğunluk ön plan çıkarsa otomatik çevir
  let inv = !!o.invert;
  const fg = (v: number) => (inv ? v > thr : v <= thr);
  if (o.invert === undefined) {
    let b = 0, n = 0;
    for (let x = 0; x < W; x++) (b += +fg(bl[x]) + +fg(bl[(H - 1) * W + x])), (n += 2);
    for (let y = 0; y < H; y++) (b += +fg(bl[y * W]) + +fg(bl[y * W + W - 1])), (n += 2);
    if (b > n / 2) inv = !inv;
  }
  // çerçeve: maske dışı 0 (kapalı döngü garantisi)
  const M = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : fg(bl[y * W + x]) ? 1 : 0);
  // marching squares: hücre köşeleri piksel merkezleri; kenar orta noktaları
  const segs = new Map<string, string[]>();
  const pt = new Map<string, Vec2>();
  const key = (x: number, y: number) => `${x},${y}`;
  const link = (a: Vec2, b: Vec2) => {
    const ka = key(a[0], a[1]), kb = key(b[0], b[1]);
    pt.set(ka, a);
    pt.set(kb, b);
    (segs.get(ka) ?? (segs.set(ka, []), segs.get(ka)!)).push(kb);
    (segs.get(kb) ?? (segs.set(kb, []), segs.get(kb)!)).push(ka);
  };
  for (let y = -1; y < H; y++)
    for (let x = -1; x < W; x++) {
      const tl = M(x, y), tr = M(x + 1, y), br = M(x + 1, y + 1), bl2 = M(x, y + 1);
      const c = tl * 8 + tr * 4 + br * 2 + bl2;
      if (c === 0 || c === 15) continue;
      const T: Vec2 = [x + 0.5, y], R: Vec2 = [x + 1, y + 0.5], B: Vec2 = [x + 0.5, y + 1], L: Vec2 = [x, y + 0.5];
      switch (c) {
        case 1: case 14: link(L, B); break;
        case 2: case 13: link(B, R); break;
        case 3: case 12: link(L, R); break;
        case 4: case 11: link(T, R); break;
        case 6: case 9: link(T, B); break;
        case 7: case 8: link(L, T); break;
        case 5: link(L, T), link(B, R); break;
        case 10: link(T, R), link(L, B); break;
      }
    }
  const seen = new Set<string>();
  const loops: Vec2[][] = [];
  for (const k0 of segs.keys()) {
    if (seen.has(k0)) continue;
    const loop: Vec2[] = [];
    let prev = "", cur = k0;
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      loop.push(pt.get(cur)!);
      const nx = segs.get(cur)!.find((k) => k !== prev && !seen.has(k));
      prev = cur;
      cur = nx!;
    }
    if (loop.length > 8) loops.push(loop);
  }
  const minA = (o.minArea ?? 0.002) * W * H;
  const eps = o.eps ?? Math.max(1, Math.max(W, H) / 400);
  const out: Vec2[][] = [], hole: boolean[] = [];
  const big = loops.map((l) => ({ l, a: Math.abs(area(l)) })).filter((q) => q.a >= minA).sort((a, b) => b.a - a.a);
  for (const q of big) {
    // içte mi (çift tek kuralı: daha büyük döngülerin içinde kalma sayısı)
    const p = q.l[0];
    let depth = 0;
    for (const r of big) if (r !== q && r.a > q.a && inside(p, r.l)) depth++;
    out.push(simplifyClosed(q.l, eps));
    hole.push(depth % 2 === 1);
  }
  return { loops: out, w: W, h: H, thr, hole };
}

function inside(p: Vec2, poly: Vec2[]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}

/** veri adresli resmi işlem boyutunda ImageData'ya çevirir */
export async function imageDataOf(src: string, maxPx = 600): Promise<ImageData> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error("Resim okunamadı"));
    im.src = src;
  });
  const k = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(img, 0, 0, w, h);
  return g.getImageData(0, 0, w, h);
}

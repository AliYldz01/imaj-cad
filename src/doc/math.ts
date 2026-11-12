// Küçük vektör ve düzlem yardımcıları.
import type { Frame, StdPlane, Vec2, Vec3 } from "./types";

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: Vec3): Vec3 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
export const dist3 = (a: Vec3, b: Vec3) => len(sub(a, b));

export const STD_FRAMES: Record<StdPlane, Frame> = {
  // SolidWorks yerleşimi: Y yukarı. Ön = XY, Üst = XZ, Sağ = YZ
  front: { o: [0, 0, 0], x: [1, 0, 0], n: [0, 0, 1] },
  top: { o: [0, 0, 0], x: [1, 0, 0], n: [0, 1, 0] },
  right: { o: [0, 0, 0], x: [0, 0, -1], n: [1, 0, 0] },
};
export const STD_NAMES: Record<StdPlane, string> = { front: "Ön Düzlem", top: "Üst Düzlem", right: "Sağ Düzlem" };

export const frameY = (f: Frame): Vec3 => cross(f.n, f.x);

export function toWorld(f: Frame, p: Vec2): Vec3 {
  const y = frameY(f);
  return [f.o[0] + f.x[0] * p[0] + y[0] * p[1], f.o[1] + f.x[1] * p[0] + y[1] * p[1], f.o[2] + f.x[2] * p[0] + y[2] * p[1]];
}
export function toLocal(f: Frame, p: Vec3): Vec2 {
  const d = sub(p, f.o);
  return [dot(d, f.x), dot(d, frameY(f))];
}

/** Bir yüz normali için SolidWorks'e benzer kararlı eskiz çerçevesi */
export function frameFromNormal(point: Vec3, n: Vec3): Frame {
  n = norm(n);
  let x = cross([0, 1, 0], n);
  if (len(x) < 1e-6) x = [1, 0, 0];
  x = norm(x);
  // Başlangıç: dünya orijininin düzleme izdüşümü
  const k = dot(sub([0, 0, 0], point), n);
  const o: Vec3 = [0 - n[0] * k, 0 - n[1] * k, 0 - n[2] * k];
  return { o, x, n };
}

export function offsetFrame(f: Frame, d: number, flip: boolean): Frame {
  const n: Vec3 = flip ? mul(f.n, -1) : f.n;
  const x: Vec3 = flip ? mul(f.x, -1) : f.x;
  return { o: add(f.o, mul(f.n, d)), x, n };
}

export const AXES: Record<"x" | "y" | "z", Vec3> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };

export const r3 = (v: number) => Math.round(v * 1000) / 1000;
export const fmtNum = (v: number, digits = 3) => {
  const p = Math.pow(10, digits);
  return (Math.round(v * p) / p).toString().replace(".", ",");
};

/** Global değişken çözücü (denklemler) */
let varResolver: (name: string) => number | undefined = () => undefined;
export function setVarResolver(fn: (name: string) => number | undefined) {
  varResolver = fn;
}

const FUNCS: Record<string, (x: number) => number> = {
  sin: (x) => Math.sin((x * Math.PI) / 180),
  cos: (x) => Math.cos((x * Math.PI) / 180),
  tan: (x) => Math.tan((x * Math.PI) / 180),
  sqrt: Math.sqrt,
  karekök: Math.sqrt,
  abs: Math.abs,
  round: Math.round,
};

/** "100/2", "40+12,5", "kalinlik*2", "=L/2+5" gibi ifadeleri hesaplar */
export function evalNum(s: string, extra?: (name: string) => number | undefined): number | null {
  let t = s.trim().replace(/^=/, "").replace(/,/g, ".");
  if (!t) return null;
  let bad = false;
  t = t.replace(/[A-Za-zçğıöşüÇĞİÖŞÜ_][A-Za-z0-9çğıöşüÇĞİÖŞÜ_]*/g, (name) => {
    if (FUNCS[name]) return `F.${name === "karekök" ? "sqrt" : name}`;
    if (name === "pi" || name === "PI") return String(Math.PI);
    const v = extra?.(name) ?? varResolver(name);
    if (v === undefined || !isFinite(v)) {
      bad = true;
      return "0";
    }
    return `(${v})`;
  });
  if (bad) return null;
  if (!/^[0-9+\-*/(). eEF.a-z]+$/.test(t)) return null;
  try {
    const v = Function("F", `"use strict";return (${t});`)(FUNCS);
    return typeof v === "number" && isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

/** İfade değişken içeriyor mu? */
export const hasVars = (s: string) => /[A-Za-zçğıöşüÇĞİÖŞÜ_]/.test(s.replace(/^=/, "").replace(/\b(sin|cos|tan|sqrt|abs|round|pi|PI|karekök)\b/g, ""));

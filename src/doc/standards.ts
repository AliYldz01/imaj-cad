// Standart tablolar: metrik delik ölçüleri (ISO 273 orta geçiş, DIN 974 havşa, ISO 10642 konik havşa,
// kılavuz matkap çapları) ve malzeme yoğunlukları. Değerler yaygın atölye tablolarından alınmıştır.
import type { HoleType } from "./types";

/** [geçiş deliği, havşa çapı, havşa derinliği, konik havşa çapı, kılavuz matkabı] */
export const HOLE_SIZES: Record<string, [number, number, number, number, number]> = {
  M3: [3.4, 6.5, 3.4, 6.3, 2.5],
  M4: [4.5, 8, 4.4, 8.4, 3.3],
  M5: [5.5, 10, 5.4, 10.4, 4.2],
  M6: [6.6, 11, 6.4, 12.4, 5],
  M8: [9, 15, 8.6, 16.4, 6.8],
  M10: [11, 18, 10.6, 20.4, 8.5],
  M12: [13.5, 20, 12.6, 24.4, 10.2],
  M14: [15.5, 24, 14.6, 27, 12],
  M16: [17.5, 26, 16.6, 32.4, 14],
  M20: [22, 33, 20.6, 40.4, 17.5],
  M24: [26, 40, 24.8, 48, 21],
};

export function holeDefaults(t: HoleType, size: string) {
  const r = HOLE_SIZES[size] ?? HOLE_SIZES.M8;
  const nominal = parseFloat(size.slice(1)) || 8;
  return {
    d: t === "tap" ? r[4] : r[0],
    depth: Math.round(nominal * 2.5),
    cd: t === "csink" ? r[3] : r[1],
    cdepth: r[2],
    cangle: 90,
  };
}

/** Malzemeler: yoğunluk g/cm³ */
export const MATERIALS: Record<string, { name: string; rho: number }> = {
  steel: { name: "Yapı çeliği (S235/S355)", rho: 7.85 },
  stainless: { name: "Paslanmaz çelik (AISI 304)", rho: 7.93 },
  castiron: { name: "Dökme demir (GG25)", rho: 7.2 },
  aluminium: { name: "Alüminyum (6061)", rho: 2.7 },
  brass: { name: "Pirinç", rho: 8.5 },
  copper: { name: "Bakır", rho: 8.96 },
  titanium: { name: "Titanyum (Ti-6Al-4V)", rho: 4.43 },
  pom: { name: "POM (Delrin)", rho: 1.41 },
  pa6: { name: "Poliamid (PA6)", rho: 1.14 },
  pe: { name: "Polietilen (PE-HD)", rho: 0.95 },
  abs: { name: "ABS", rho: 1.05 },
  pla: { name: "PLA", rho: 1.24 },
  wood: { name: "Ahşap (meşe)", rho: 0.75 },
};
